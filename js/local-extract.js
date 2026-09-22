/**
 * Granite Estate — Local (Offline) Fact Extractor
 * Pack-aligned with analysis.js EXTRACTION_SCHEMA_HINT.
 *
 * Produces the SAME fact shape as geminiExtract_() using deterministic pattern
 * matching, so the NH rule catalog in rules.js can run with no network calls and
 * no API key. Nothing in this file performs I/O of any kind.
 *
 * DESIGN CONSTRAINTS (read before editing):
 *  1. Plain text only. Callers MUST NOT pass PDF/image bytes here — a document
 *     that cannot be read produces empty facts, and empty facts make every rule
 *     fire as a false "critical" finding. isLocallyReadable() is the gate.
 *  2. Name patterns are CASE-SENSITIVE by design: NAME_RE depends on real
 *     capitalisation to tell a person from prose. Never add the /i flag to a
 *     regex built with NAME_RE — use the ci_() helper for keyword literals.
 *  3. Bracketed editorial annotations are stripped before extraction, matching
 *     the instruction given to Gemini. Otherwise a note reading "gaps: no
 *     residuary clause" is itself detected as a residuary clause.
 *  4. Every fact object is stamped extraction_source:'local' so the UI, the
 *     attorney brief, and the audit log can state how the facts were derived
 *     (PRD FR-ARCH-3 provenance).
 *
 * Universal Module: Works in both browser and Node.js.
 */

var LOCAL_EXTRACTOR_VERSION = 'local-1.0.0';

/* A personal name: a capitalised word, then up to 3 more words or initials. */
// Words within a name are joined by HORIZONTAL space only. Using \s+ here lets a
// name run across a line break and swallow the next line's label (e.g.
// "Mary Doe\nPhone:" -> "Mary Doe Phone"), which the stopword filter then rejects.
var NAME_RE = "([A-Z][a-z'\\-][a-zA-Z'\\-]*(?:[ \\t]+(?:[A-Z]\\.|[A-Z][a-zA-Z'\\-]+)){0,3})";

/* Case-insensitive literal, without the /i flag that would break NAME_RE. */
function ci_(word) {
  return word.split('').map(function (ch) {
    return /[a-zA-Z]/.test(ch)
      ? '[' + ch.toUpperCase() + ch.toLowerCase() + ']'
      : ch;
  }).join('');
}

/* Words that are never a person's name, however they are capitalised. */
var NAME_STOPWORDS = [
  'article', 'witness', 'witnesses', 'testator', 'testatrix', 'principal', 'agent',
  'executor', 'executrix', 'guardian', 'trustee', 'settlor', 'grantor', 'notary',
  'schedule', 'exhibit', 'the', 'this', 'that', 'and', 'or', 'of', 'my', 'his',
  'her', 'their', 'declaration', 'trust', 'will', 'testament', 'state', 'county',
  'new', 'hampshire', 'signed', 'dated', 'page', 'section', 'part', 'name',
  'address', 'phone', 'date', 'public', 'peace', 'justice', 'missing', 'none',
  'declares', 'holds', 'serve', 'serves', 'appoint', 'appoints', 'director'
];

function lx_has_(text, re) {
  return re.test(text);
}

function cleanName_(raw) {
  if (!raw) return null;
  var name = raw.replace(/\s+/g, ' ').trim().replace(/[.,;:]+$/, '').trim();
  if (name.length < 3 || name.length > 60) return null;

  var words = name.split(/\s+/);
  for (var i = 0; i < words.length; i++) {
    var bare = words[i].replace(/[.'\-]/g, '').toLowerCase();
    if (!bare) continue;
    if (NAME_STOPWORDS.indexOf(bare) !== -1) return null;
    // All-caps run of 4+ letters is a section heading, not a name.
    if (words[i].length >= 4 && words[i] === words[i].toUpperCase() && /[A-Z]{4}/.test(words[i])) return null;
  }
  if (words.length === 1 && name.length < 4) return null;
  return name;
}

function lx_first_(text, patterns) {
  for (var i = 0; i < patterns.length; i++) {
    var re = patterns[i];
    re.lastIndex = 0;
    var m;
    // Scan all matches for this pattern; the first that survives cleaning wins.
    var global = new RegExp(re.source, re.flags.indexOf('g') === -1 ? re.flags + 'g' : re.flags);
    while ((m = global.exec(text)) !== null) {
      if (!m[1]) continue;
      var name = cleanName_(m[1]);
      if (name) return name;
      if (global.lastIndex === m.index) global.lastIndex++;
    }
  }
  return null;
}

/**
 * Remove bracketed editorial/test annotations so note text is not mistaken for
 * document content. Mirrors the instruction given to Gemini in analysis.js.
 */
function stripAnnotations_(text) {
  return String(text || '').replace(/\[[^\]]{0,800}\]/g, ' ');
}

/**
 * True when the document body is plain text this extractor can actually read.
 * PDFs, scans and photos are NOT locally readable and must be skipped, not
 * guessed at — see constraint 1 above.
 */
function isLocallyReadable(doc) {
  if (!doc) return false;
  if (!doc.content || typeof doc.content !== 'string') return false;
  if (doc.content.replace(/\s/g, '').length < 40) return false;
  return true;
}

function classifyLocal_(text, filename) {
  var t = text.toLowerCase();
  var f = String(filename || '').toLowerCase();
  var hay = t + ' ' + f;
  var scores = {
    will: 0, revocable_trust: 0, advance_directive: 0,
    financial_poa: 0, deed: 0, beneficiary_form: 0
  };

  if (/last will and testament|\bmy will\b|testator|testatrix|bequeath|devise/.test(hay)) scores.will += 3;
  if (/\bwill\b/.test(f)) scores.will += 2;
  if (/residuary|pretermitted|codicil/.test(hay)) scores.will += 2;

  if (/revocable (living )?trust|declaration of trust|settlor|trust agreement/.test(hay)) scores.revocable_trust += 4;
  if (/\btrust\b/.test(f)) scores.revocable_trust += 2;

  if (/advance directive|living will|health care agent|healthcare agent|power of attorney for health care|137-j/.test(hay)) scores.advance_directive += 4;
  if (/advance|directive/.test(f)) scores.advance_directive += 2;

  if (/(financial|general|statutory) power of attorney|564-e|notice to the principal|attorney-in-fact/.test(hay)) scores.financial_poa += 4;
  if (/poa|power.of.attorney/.test(f) && !/health/.test(hay)) scores.financial_poa += 2;

  if (/transfer on death deed|quitclaim|warranty deed|registry of deeds|563-d/.test(hay)) scores.deed += 4;
  if (/deed/.test(f)) scores.deed += 2;

  if (/beneficiary designation|pay(?:able)? on death|\bpod\b/.test(hay)) scores.beneficiary_form += 3;

  var best = 'other', bestScore = 0;
  Object.keys(scores).forEach(function (k) {
    if (scores[k] > bestScore) { bestScore = scores[k]; best = k; }
  });

  // Confidence is deliberately capped below the 0.85 routing threshold in the
  // PRD: local classification should never suppress a clarification question.
  if (bestScore === 0) return { doc_type: 'other', confidence: 0.1 };
  var confidence = bestScore >= 6 ? 0.8 : bestScore >= 4 ? 0.65 : bestScore >= 2 ? 0.45 : 0.2;
  return { doc_type: best, confidence: confidence };
}

function countWitnessSlots_(text) {
  // Matches "WITNESS:", "Witness 2 -", and statutory execution blocks such as
  // "Witness 1 Signature: ______" / "Witness 2 Printed Name: ______".
  var slots = (text.match(/witness\s*(?:#?\s*\d)?\s*(?:printed\s+)?(?:signature|name|address)?\s*[:\-_]/gi) || []).length;
  var named = (text.match(/signed in the presence/gi) || []).length;
  return Math.max(slots, named ? 1 : 0);
}

function extractWill_(text) {
  var witnessNames = [];
  var wre = new RegExp('(?:' + ci_('witness') + '\\s*(?:#?\\s*\\d)?[ \\t]*[:\\-][ \\t]*|' + ci_('signed in the presence of the testator by') + '[ \\t]*[:\\-]?[ \\t]*(?:_+\\s*)?)' + NAME_RE, 'g');
  var m;
  while ((m = wre.exec(text)) !== null) {
    var wn = cleanName_(m[1]);
    if (wn && witnessNames.indexOf(wn) === -1) witnessNames.push(wn);
  }

  var beneficiaries = [];
  var bre = new RegExp('(?:' + ci_('i give') + '|' + ci_('i devise') + '|' + ci_('i bequeath') + ')'
    + '[^.]{0,220}?' + ci_('to') + '[ \\t]+(?:' + ci_('my') + '[ \\t]+[a-z]+,?[ \\t]+)?' + NAME_RE, 'g');
  while ((m = bre.exec(text)) !== null) {
    var bn = cleanName_(m[1]);
    if (bn && !beneficiaries.some(function (b) { return b.name === bn; })) {
      beneficiaries.push({ name: bn, relationship: '', property: '' });
    }
  }

  return {
    testator_signed: lx_has_(text, /[Ii]n [Ww]itness [Ww]hereof|hereunto set my hand|\/s\/|[Ss]ignature of [Tt]estat|[Tt]estator'?s? [Ss]ignature|,\s*[Tt]estator\b/i),
    witness_count: Math.max(witnessNames.length, countWitnessSlots_(text)),
    witness_names: witnessNames,
    self_proving_affidavit: lx_has_(text, /[Ss]elf[- ][Pp]roving|551:35|[Aa]ffidavit of (?:[Ee]xecution|[Aa]ttesting)/i)
      && lx_has_(text, /[Nn]otary|[Jj]ustice of the [Pp]eace|subscribed and sworn/i),
    revocation_clause: lx_has_(text, /[Rr]evoke[s]?\s+(?:any\s+and\s+)?all\s+(?:prior|former|previous)|[Rr]evoke all wills|[Rr]evoking all prior/i),
    executor: lx_first_(text, [
      new RegExp(ci_('appoint') + '\\s+(?:' + ci_('my') + '\\s+[a-z]+,?\\s+)?' + NAME_RE + '[^.]{0,40}?' + ci_('as') + '\\s+(?:(?:' + ci_('my') + '|' + ci_('the') + '|' + ci_('sole') + ')\\s+){0,2}' + ci_('executor')),
      new RegExp(ci_('nominate') + '\\s+(?:' + ci_('my') + '\\s+[a-z]+,?\\s+)?' + NAME_RE),
      new RegExp('(?:' + ci_('primary') + '\\s+)?' + ci_('executor') + '[^\\S\\n]*(?:\\([^)]{0,30}\\))?[^\\S\\n]*[:\\-][^\\S\\n]*' + NAME_RE)
    ]),
    successor_executor: lx_first_(text, [
      new RegExp('(?:' + ci_('successor') + '|' + ci_('alternate') + '|' + ci_('backup') + '|' + ci_('substitute') + ')\\s+' + ci_('executor') + '[^A-Za-z\\n]{0,20}' + NAME_RE),
      new RegExp(NAME_RE + '\\s+' + ci_('as successor executor'))
    ]),
    residuary_clause: lx_has_(text, /[Rr]esiduary|[Rr]esidue(?:\s+and\s+remainder)?|[Rr]est,?\s+residue|[Rr]emainder of my estate|[Aa]ll the rest/i),
    guardian_named: lx_has_(text, /[Gg]uardian/i),
    guardian_name: lx_first_(text, [
      new RegExp('(?:' + ci_('appoint') + '|' + ci_('nominate') + ')\\s+(?:' + ci_('my') + '\\s+[a-z]+,?\\s+)?' + NAME_RE + '[^.]{0,40}?' + ci_('as') + '[^.]{0,25}?' + ci_('guardian')),
      new RegExp(ci_('guardian') + '[^A-Za-z]{0,20}' + NAME_RE)
    ]),
    pour_over_to_trust: lx_has_(text, /[Pp]our[- ]?over|to the [Tt]rustee of[^.]{0,60}[Tt]rust/i),
    beneficiaries: beneficiaries
  };
}

function extractTrust_(text) {
  var assets = [];
  var titled = lx_has_(text, /titled in the name of the trust|conveyed to the trust|deeded to the trust/i);
  var stillIndividual = lx_has_(text, /still (?:individually )?(?:titled|owned)|remains? (?:individually )?titled|not (?:yet )?(?:been )?(?:re)?titled|individual name|unfunded/i);
  if (lx_has_(text, /schedule a|trust property|trust estate/i)) {
    assets.push({
      description: 'Asset schedule referenced in trust instrument',
      titled_in_trust: titled && !stillIndividual
    });
  }
  // Emit real property as its own asset so rule T-03 (funding formalities,
  // RSA 564-B:4-401) can evaluate titling — it keys off the description text.
  if (lx_has_(text, /real (?:property|estate)|homestead|residence at|\bparcel\b/i)) {
    assets.push({
      description: 'Real property referenced in trust instrument',
      titled_in_trust: titled && !stillIndividual
    });
  }
  return {
    settlor: lx_first_(text, [
      new RegExp('(?:' + ci_('made') + '|' + ci_('dated') + ')[^.]{0,40}?,?\\s+' + ci_('by') + '\\s+' + NAME_RE),
      new RegExp('\\bI,\\s+' + NAME_RE + '[^.]{0,60}?(?:' + ci_('settlor') + '|' + ci_('grantor') + ')'),
      new RegExp('(?:' + ci_('settlor') + '|' + ci_('grantor') + '|' + ci_('trustor') + ')[ \\t]*[:\\-][ \\t]*' + NAME_RE)
    ]),
    trustee: lx_first_(text, [
      new RegExp(NAME_RE + '\\s+' + ci_('shall serve as') + '\\s+(?:' + ci_('the') + '\\s+)?' + ci_('trustee')),
      new RegExp('(?:' + ci_('initial') + '\\s+)?' + ci_('trustee') + '[ \\t]*[:\\-][ \\t]*' + NAME_RE),
      new RegExp(ci_('appoint') + '\\s+' + NAME_RE + '[^.]{0,30}' + ci_('as') + '\\s+(?:' + ci_('the') + '\\s+)?' + ci_('trustee'))
    ]),
    successor_trustee: lx_first_(text, [
      new RegExp(ci_('successor trustee') + '[^A-Za-z]{0,20}' + NAME_RE),
      new RegExp(NAME_RE + '\\s+' + ci_('as successor trustee'))
    ]),
    revocable: lx_has_(text, /[Rr]evocable/i) && !lx_has_(text, /[Ii]rrevocable/i),
    pour_over_will_referenced: lx_has_(text, /[Pp]our[- ]?over will/i),
    assets: assets,
    beneficiaries: []
  };
}

function extractAd_(text) {
  return {
    agent: lx_first_(text, [
      new RegExp('(?:' + ci_('appoint') + '|' + ci_('designate') + ')\\s+(?:' + ci_('my') + '\\s+[a-z]+,?\\s+)?' + NAME_RE + '[^.]{0,80}?' + ci_('as my') + '\\s+(?:' + ci_('health care') + '|' + ci_('healthcare') + ')\\s+' + ci_('agent')),
      new RegExp('(?:' + ci_('primary') + '\\s+)?(?:' + ci_('health care') + '|' + ci_('healthcare') + ')\\s+' + ci_('agent')
        + '[^\\S\\n]*(?:\\([^)]{0,30}\\))?[^\\S\\n]*[:\\-][^\\S\\n]*' + NAME_RE),
      new RegExp('(?:^|\\n)\\s*' + ci_('agent') + '[ \\t]*[:\\-][ \\t]*' + NAME_RE)
    ]),
    alternate_agent: lx_first_(text, [
      new RegExp('(?:' + ci_('alternate') + '|' + ci_('successor') + '|' + ci_('backup') + '|' + ci_('substitute') + ')\\s+(?:(?:' + ci_('health care') + '|' + ci_('healthcare') + ')\\s+)?' + ci_('agent')
        + '[^\\S\\n]*(?:\\([^)]{0,30}\\))?[^\\S\\n]*[:\\-]?[^\\S\\n]*' + NAME_RE)
    ]),
    witness_count: countWitnessSlots_(text),
    notarized: lx_has_(text, /[Nn]otary [Pp]ublic|[Jj]ustice of the [Pp]eace|subscribed and sworn|[Aa]cknowledged before me/i),
    hipaa_release: lx_has_(text, /HIPAA|[Hh]ealth [Ii]nsurance [Pp]ortability|[Pp]rotected [Hh]ealth [Ii]nformation/i),
    statutory_disclosure: lx_has_(text, /137-J|137-j|[Dd][Ii][Ss][Cc][Ll][Oo][Ss][Uu][Rr][Ee] [Ss][Tt][Aa][Tt][Ee][Mm][Ee][Nn][Tt]|[Tt]his is an important legal document/i),
    living_will_included: lx_has_(text, /[Ll]iving [Ww]ill|terminal condition|permanently unconscious|life[- ]sustaining/i)
  };
}

function extractPoa_(text) {
  var hot = [];
  if (lx_has_(text, /\b[Gg]ift(?:s|ing)?\b/i)) hot.push('gifting');
  if (lx_has_(text, /(?:[Cc]reate|[Aa]mend|[Rr]evoke)[^.]{0,30}[Tt]rust/i)) hot.push('trust creation or amendment');
  if (lx_has_(text, /[Bb]eneficiary designation/i)) hot.push('change beneficiary designations');
  if (lx_has_(text, /[Rr]ight of survivorship/i)) hot.push('create or change survivorship rights');

  var alt = lx_first_(text, [
    new RegExp('(?:' + ci_('successor') + '|' + ci_('alternate') + '|' + ci_('backup') + '|' + ci_('substitute') + ')\\s+' + ci_('agent') + '[ \\t]*[:\\-]?[ \\t]*' + NAME_RE)
  ]);

  return {
    agent: lx_first_(text, [
      new RegExp('(?:' + ci_('appoint') + '|' + ci_('designate') + ')\\s+(?:' + ci_('my') + '\\s+[a-z]+,?\\s+)?' + NAME_RE + '[^.]{0,80}?' + ci_('as my') + '\\s+(?:' + ci_('agent') + '|' + ci_('attorney-in-fact') + ')'),
      new RegExp('(?:^|\\n)[^\\S\\n]*(?:' + ci_('primary') + '[^\\S\\n]+)?' + ci_('agent')
        + '[^\\S\\n]*(?:\\([^)]{0,30}\\))?[^\\S\\n]*[:\\-][^\\S\\n]*' + NAME_RE)
    ]),
    alternate_agent: alt,
    // rules.js and strategy.js historically read successor_agent; keep both keys
    // populated so neither path silently misses the alternate.
    successor_agent: alt,
    notarized: lx_has_(text, /[Nn]otary [Pp]ublic|[Jj]ustice of the [Pp]eace|[Aa]cknowledged before me|subscribed and sworn/i),
    durable: lx_has_(text, /[Dd]urable|shall not be affected by (?:my )?(?:subsequent )?(?:disability|incapacity)/i),
    statutory_notice: lx_has_(text, /564-E|564-e|[Nn]otice to the [Pp]rincipal|[Aa]gent'?s? [Aa]cknowledgment/i),
    hot_powers: hot
  };
}

function extractPeople_(text) {
  var spouse = lx_first_(text, [
    new RegExp(ci_('my') + '\\s+(?:' + ci_('wife') + '|' + ci_('husband') + '|' + ci_('spouse') + ')[,\\s]+' + NAME_RE),
    new RegExp(ci_('married to') + '\\s+' + NAME_RE),
    new RegExp(NAME_RE + ',?\\s+' + ci_('my') + '\\s+(?:' + ci_('wife') + '|' + ci_('husband') + '|' + ci_('spouse') + ')')
  ]);

  var all = [], minors = [];
  function addChild(n, isMinor) {
    var c = cleanName_(n);
    if (!c) return;
    if (all.indexOf(c) === -1) all.push(c);
    if (isMinor && minors.indexOf(c) === -1) minors.push(c);
  }

  var m;
  var cre = new RegExp(ci_('my') + '\\s+(?:' + ci_('son') + '|' + ci_('daughter') + '|' + ci_('child') + ')[,\\s]+' + NAME_RE, 'g');
  while ((m = cre.exec(text)) !== null) addChild(m[1], false);

  // "We have one child, Maya Whitfield, born March 4, 2016."
  var hre = new RegExp('(?:' + ci_('have') + '|' + ci_('has') + ')\\s+(?:[a-z]+\\s+|\\d+\\s+)?(?:' + ci_('child') + '|' + ci_('children') + ')[,:\\s]+' + NAME_RE, 'g');
  while ((m = hre.exec(text)) !== null) addChild(m[1], false);

  function splitList(block, isMinor) {
    block.split(/,| and /).forEach(function (part) {
      var n = part.replace(/\s+/g, ' ').trim();
      if (/^[A-Z][a-zA-Z'\-]+(\s+(?:[A-Z]\.|[A-Z][a-zA-Z'\-]+)){0,3}[.,]?$/.test(n)) addChild(n, isMinor);
    });
  }
  var listM = text.match(new RegExp(ci_('my children') + '[,:\\s]+([^.;]{3,160})'));
  if (listM) splitList(listM[1], false);
  var minorBlock = text.match(new RegExp(ci_('minor') + '\\s+(?:' + ci_('child') + '|' + ci_('children') + ')[,:\\s]+([^.;]{3,160})'));
  if (minorBlock) splitList(minorBlock[1], true);

  // Deterministic minority check from an explicit birth year near a child's name.
  var thisYear = new Date().getFullYear();
  all.forEach(function (name) {
    var esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    var bm = text.match(new RegExp(esc + '[^.]{0,60}?' + ci_('born') + '[^.]{0,30}?(\\d{4})'));
    if (bm) {
      var yr = parseInt(bm[1], 10);
      if (yr > 1900 && (thisYear - yr) < 18 && minors.indexOf(name) === -1) minors.push(name);
    }
  });

  var realEstate = [];
  if (lx_has_(text, /[Nn]ew [Hh]ampshire|,\s*NH\b/i) &&
      lx_has_(text, /[Rr]eal (?:property|estate)|[Rr]esidence|[Hh]omestead|\d+\s+[A-Z][a-z]+\s+(?:Street|St\.|Road|Rd\.|Avenue|Ave\.|Lane|Drive|Dr\.|Way|Court)/i)) {
    var addr = text.match(/(\d+\s+[A-Za-z.'\- ]{2,40}(?:Street|St\.|Road|Rd\.|Avenue|Ave\.|Lane|Drive|Dr\.|Way|Court)[^,\n]{0,30})/);
    realEstate.push({
      description: 'New Hampshire real property referenced in document',
      address: addr ? addr[1].trim() : '',
      tod_deed_referenced: lx_has_(text, /[Tt]ransfer on [Dd]eath|563-D|563-d|\bTOD [Dd]eed\b/i),
      titled_in_trust: lx_has_(text, /titled in the name of the trust|conveyed to the trust|deeded to the trust/i)
    });
  }

  return { spouse: spouse, all_children: all, minor_children: minors, real_estate_nh: realEstate };
}

/**
 * Extract facts from plain document text without any network call.
 * Mirrors the return contract of geminiExtract_().
 */
function localExtract_(rawText, filename) {
  var text = stripAnnotations_(rawText);
  var cls = classifyLocal_(text, filename);
  var people = extractPeople_(text);

  return {
    doc_type: cls.doc_type,
    confidence: cls.confidence,
    person_primary: lx_first_(text, [
      new RegExp('\\bI,\\s+' + NAME_RE),
      new RegExp('(?:' + ci_('testator') + '|' + ci_('principal') + '|' + ci_('settlor') + ')[ \\t]*[:\\-][ \\t]*' + NAME_RE),
      new RegExp(NAME_RE + ',\\s*(?:' + ci_('testator') + '|' + ci_('principal') + '|' + ci_('settlor') + ')')
    ]),
    spouse: people.spouse,
    minor_children: people.minor_children,
    all_children: people.all_children,
    real_estate_nh: people.real_estate_nh,
    will: extractWill_(text),
    trust: extractTrust_(text),
    ad: extractAd_(text),
    poa: extractPoa_(text),
    extraction_source: 'local',
    extraction_engine: LOCAL_EXTRACTOR_VERSION
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    LOCAL_EXTRACTOR_VERSION: LOCAL_EXTRACTOR_VERSION,
    localExtract_: localExtract_,
    isLocallyReadable: isLocallyReadable,
    classifyLocal_: classifyLocal_,
    stripAnnotations_: stripAnnotations_,
    cleanName_: cleanName_
  };
}
