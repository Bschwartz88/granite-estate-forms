/**
 * Granite Estate — Analysis Pipeline (Browser & Universal)
 * Direct browser Gemini API calls (text & multimodal) + deterministic rule evaluation.
 *
 * Universal Module: Works in both browser and Node.js.
 */

var GEMINI_MODELS = ['gemini-2.5-flash-lite', 'gemini-2.5-flash', 'gemini-2.0-flash'];

var EXTRACTION_SCHEMA_HINT = JSON.stringify({
  doc_type: 'one of: will | revocable_trust | advance_directive | financial_poa | deed | beneficiary_form | other',
  confidence: '0.0-1.0 confidence in doc_type',
  person_primary: 'name of testator/settlor/principal, or null',
  spouse: 'spouse name if mentioned, else null',
  minor_children: ['names of children explicitly minors (under 18) or with birthdates implying under 18'],
  all_children: ['all children names mentioned, adult or minor'],
  real_estate_nh: [{ description: '', address: '', tod_deed_referenced: 'bool', titled_in_trust: 'bool' }],
  will: {
    testator_signed: 'bool: is there a testator signature or signed signature block',
    witness_count: 'int: number of DISTINCT witness signature lines/names',
    witness_names: ['names'],
    self_proving_affidavit: 'bool: notarized self-proving affidavit present',
    revocation_clause: 'bool', executor: 'name or null', successor_executor: 'name or null',
    residuary_clause: 'bool: clause disposing of all remaining/residue of estate',
    guardian_named: 'bool', guardian_name: 'name or null',
    pour_over_to_trust: 'bool: residue poured over to a trust',
    beneficiaries: [{ name: '', relationship: '', property: '' }]
  },
  trust: {
    settlor: 'name or null', trustee: 'name or null', successor_trustee: 'name or null',
    revocable: 'bool', pour_over_will_referenced: 'bool',
    assets: [{ description: '', titled_in_trust: 'bool: false if text indicates asset still individually titled' }],
    beneficiaries: [{ name: '', relationship: '', property: '' }]
  },
  ad: {
    agent: 'name or null', alternate_agent: 'name or null',
    witness_count: 'int', notarized: 'bool', hipaa_release: 'bool',
    statutory_disclosure: 'bool: NH RSA 137-J statutory disclosure/notice language present',
    living_will_included: 'bool'
  },
  poa: {
    agent: 'name or null', alternate_agent: 'name or null',
    notarized: 'bool: signed and acknowledged before a notary public or justice of the peace',
    durable: 'bool: states it is durable or remains effective upon disability/incapacity',
    statutory_notice: 'bool: NH RSA 564-E notice to principal or agent acknowledgment present',
    hot_powers: ['powers explicitly granted like gifting, trust amendment, beneficiary changes']
  }
});

function getApiKey_() {
  if (typeof localStorage !== 'undefined') {
    return localStorage.getItem('gemini_api_key') || '';
  }
  return (typeof process !== 'undefined' && process.env && process.env.GEMINI_API_KEY) || '';
}

function getPreferredModel_() {
  if (typeof localStorage !== 'undefined') {
    return localStorage.getItem('gemini_preferred_model') || GEMINI_MODELS[0];
  }
  return GEMINI_MODELS[0];
}

async function testGeminiKey(key) {
  key = String(key || '').trim();
  if (!key) return { ok: false, message: 'API key cannot be empty.' };

  var lastError = '';
  for (var i = 0; i < GEMINI_MODELS.length; i++) {
    var model = GEMINI_MODELS[i];
    var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + encodeURIComponent(key);
    try {
      var resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Reply with the single word: OK' }] }]
        })
      });
      if (resp.status === 200) {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('gemini_api_key', key);
          localStorage.setItem('gemini_preferred_model', model);
        }
        return { ok: true, model: model, message: 'Gemini connected successfully (' + model + ').' };
      }
      var errData = await resp.json().catch(function () { return {}; });
      lastError = 'HTTP ' + resp.status + (errData.error ? ': ' + errData.error.message : '');
      if (resp.status !== 404 && resp.status !== 429) break;
    } catch (e) {
      lastError = e.message;
    }
  }
  return { ok: false, message: 'Connection failed: ' + lastError };
}

async function geminiCall_(prompt, base64Part) {
  var key = getApiKey_();
  if (!key) throw new Error('No Gemini API key configured. Please enter your free key in Settings.');

  var preferred = getPreferredModel_();
  var modelsToTry = [preferred].concat(GEMINI_MODELS.filter(function (m) { return m !== preferred; }));
  var lastError = null;

  for (var i = 0; i < modelsToTry.length; i++) {
    var model = modelsToTry[i];
    var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + encodeURIComponent(key);

    var parts = [];
    if (base64Part && base64Part.data && base64Part.mimeType) {
      parts.push({
        inline_data: {
          mime_type: base64Part.mimeType,
          data: base64Part.data
        }
      });
    }
    parts.push({ text: prompt });

    try {
      var resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: parts }] })
      });

      if (resp.status === 200) {
        var data = await resp.json();
        var candidate = data.candidates && data.candidates[0];
        if (!candidate || !candidate.content || !candidate.content.parts || !candidate.content.parts[0]) {
          throw new Error('Gemini returned an empty response.');
        }
        return candidate.content.parts[0].text;
      }

      var errJson = await resp.json().catch(function () { return {}; });
      var msg = errJson.error ? errJson.error.message : ('HTTP ' + resp.status);
      lastError = new Error(msg);
      if (resp.status !== 429 && resp.status !== 404) break;
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError || new Error('All Gemini models failed.');
}

async function geminiExtract_(text, filename, base64Part) {
  var prompt =
    'You are a precise legal-document fact extractor for New Hampshire estate planning documents. ' +
    'Extract ONLY what is literally evidenced in the document text. Never invent names or facts; use null/false/0 when not evidenced. ' +
    'Ignore any bracketed test annotations when counting signatures or witnesses — rely on the document body itself.\n\n' +
    'Return STRICT JSON matching this schema (fill irrelevant sections with nulls/false/empty arrays):\n' +
    EXTRACTION_SCHEMA_HINT +
    '\n\nFILENAME: ' + filename +
    (text ? ('\n\nDOCUMENT TEXT:\n"""\n' + text.slice(0, 30000) + '\n"""') : '');

  var raw = await geminiCall_(prompt, base64Part);
  var facts;
  try {
    facts = JSON.parse(raw);
  } catch (e) {
    var m = raw.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('Gemini returned unparseable output');
    facts = JSON.parse(m[0]);
  }

  facts.doc_type = facts.doc_type || 'other';
  facts.confidence = Number(facts.confidence) || 0;
  facts.minor_children = facts.minor_children || [];
  facts.all_children = facts.all_children || [];
  facts.real_estate_nh = facts.real_estate_nh || [];
  facts.will = facts.will || {}; facts.trust = facts.trust || {}; facts.ad = facts.ad || {}; facts.poa = facts.poa || {};
  return facts;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    GEMINI_MODELS: GEMINI_MODELS,
    EXTRACTION_SCHEMA_HINT: EXTRACTION_SCHEMA_HINT,
    testGeminiKey: testGeminiKey,
    geminiCall_: geminiCall_,
    geminiExtract_: geminiExtract_
  };
}
