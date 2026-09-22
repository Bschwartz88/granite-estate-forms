/**
 * Granite Estate — Web App Controller (Browser)
 * State machine, review gates (G1, G2, G3), sealing, and UI orchestration.
 */

var APP_VERSION = '2026.09-WEB';
var state = {
  engagement: null,
  documents: [],
  deficiencies: [],
  questions: [],
  plan: [],
  brief: null,
  briefNotes: []
};

// ---------------------------------------------------- UI Helpers
function $(id) { return document.getElementById(id); }
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

var toastTimer = null;
function toast(msg, isError) {
  var t = $('toast');
  if (!t) return;
  clearTimeout(toastTimer);
  t.className = 'toast show' + (isError ? ' err' : '');
  t.innerHTML = '<span>' + esc(msg) + '</span>' + (isError ? '<span class="x" onclick="hideToast()" title="Dismiss">✕</span>' : '');
  if (!isError) toastTimer = setTimeout(hideToast, 5000);
}
function hideToast() { var t = $('toast'); if (t) t.classList.remove('show'); }

// ---------------------------------------------------- Initialization
async function initApp() {
  await DB.init();

  // Version banner
  var verEl = $('ver');
  if (verEl) verEl.textContent = APP_VERSION;

  // Disclaimer acknowledgment
  var ack = false;
  try { ack = localStorage.getItem('granite_disclaimer_ack') === 'true'; } catch (e) { /* storage blocked */ }
  $('disclaimer').classList.toggle('hidden', ack);

  // The AI key is requested just before it is needed (see requestKeyThen()),
  // never on arrival — a key prompt is meaningless until the user has files.
  updateKeyBadge();
  if (getStoredKey_()) {
    $('keyStatus').textContent = 'Connected (using saved key)';
    $('keyStatus').className = 'status-ok';
  }
  $('keyCard').classList.add('hidden');

  // Active engagement restore
  var eng = await DB.getActiveEngagement();
  if (eng) {
    await loadEngagementState(eng);
  } else {
    renderUI();
  }
}

function ackDisclaimer() {
  try { localStorage.setItem('granite_disclaimer_ack', 'true'); } catch (e) { /* storage blocked */ }
  $('disclaimer').classList.add('hidden');
  DB.addAudit('DISCLAIMER_ACK', 'User acknowledged informational disclaimer');
}

// ---------------------------------------------------- Gemini Key Management
/**
 * localStorage can throw (private windows, blocked site data). Every read and
 * write goes through these so a blocked store degrades to offline mode instead
 * of breaking the page.
 */
function getStoredKey_() {
  try { return localStorage.getItem('gemini_api_key') || ''; } catch (e) { return ''; }
}

function updateKeyBadge() {
  var badge = $('keyBadge');
  if (!badge) return;
  if (getStoredKey_()) {
    badge.innerHTML = '<span class="key-pill ok" onclick="disconnectKey()" title="AI reading is on. Click to disconnect.">🔑 AI reading on</span>';
  } else {
    badge.innerHTML = '<span class="key-pill" onclick="showKeyCard()" title="Optional. Only needed to read uploaded documents.">Offline mode</span>';
  }
}

function showKeyCard() {
  $('keyCard').classList.remove('hidden');
  $('keyCard').scrollIntoView({ behavior: 'smooth', block: 'center' });
  $('geminiKey').focus();
}

function hideKeyCard() {
  $('keyCard').classList.add('hidden');
}

function disconnectKey() {
  if (!confirm('Remove your saved Google AI key from this browser?\n\nYou can still build NH statutory forms and run the offline check on text documents.')) return;
  try {
    localStorage.removeItem('gemini_api_key');
    localStorage.removeItem('gemini_preferred_model');
  } catch (e) { /* storage blocked */ }
  $('geminiKey').value = '';
  $('keyStatus').textContent = '';
  $('keyStatus').className = '';
  updateKeyBadge();
  $('keyCard').classList.add('hidden');
  DB.addAudit('KEY_DISCONNECT', 'User removed stored Google AI key');
  toast('Key removed. Offline mode is still fully available.');
}

async function saveKey() {
  var key = $('geminiKey').value.trim();
  if (!key) return toast('Paste your Gemini API key first.', true);

  $('keyStatus').textContent = 'Testing connection…';
  $('keyStatus').className = '';
  var res = await testGeminiKey(key);
  $('keyStatus').textContent = res.message;
  $('keyStatus').className = res.ok ? 'status-ok' : 'status-bad';

  if (res.ok) {
    updateKeyBadge();
    DB.addAudit('KEY_CONNECT', 'Google AI key verified and stored in this browser');
    toast('Connected. AI reading is on for this browser.');
    setTimeout(function () { $('keyCard').classList.add('hidden'); }, 1000);
  }
}

// ---------------------------------------------------- Engagement Lifecycle
/**
 * Shown above the start button; continuing records it. The attorney brief
 * prints "Client-attested at intake", so a record must exist and must match the
 * words the client actually saw (PRD SQC-4 / RSA 551:1).
 */
var ATTESTATION_TEXT = 'By continuing, you confirm you are 18 or older, are domiciled in New Hampshire, and are acting for yourself or as an authorized agent.';

function attestationRecord_(method) {
  return {
    attest_domicile: true,
    attest_adult: true,
    attest_text: ATTESTATION_TEXT,
    attest_method: method,
    attest_at: new Date().toISOString()
  };
}

/** "I already have documents" — reveal the goal field without a mode switch. */
function focusGoals() {
  var block = $('goalsBlock');
  if (block) block.classList.add('focused');
  var ta = $('goals');
  if (ta) { ta.scrollIntoView({ behavior: 'smooth', block: 'center' }); ta.focus(); }
}

async function startEng() {
  var goals = $('goals').value.trim();
  if (!goals) return toast('Please describe what you want to accomplish.', true);

  var engId = 'ENG-' + Math.random().toString(36).substring(2, 10).toUpperCase();
  var eng = {
    id: engId,
    created: new Date().toISOString(),
    status: 'intake',
    goals: goals
  };
  Object.assign(eng, attestationRecord_('affirmed by continuing from goal intake'));

  await DB.saveEngagement(eng);
  await DB.addAudit('ENGAGEMENT_START', engId + ' | goals captured (' + goals.length + ' chars)');
  await DB.addAudit('ATTESTATION', engId + ' | ' + ATTESTATION_TEXT);
  await loadEngagementState(eng);
  toast('Engagement started. Next, upload draft documents or use the NH form builder.');
}

async function loadEngagementState(eng) {
  state.engagement = eng;
  state.documents = await DB.listDocuments(eng.id);
  state.deficiencies = await DB.listDeficiencies(eng.id);
  state.questions = await DB.listQuestions(eng.id);
  state.plan = await DB.listPlan(eng.id);
  state.brief = await DB.getBrief(eng.id);
  state.briefNotes = state.plan.filter(function (r) { return r.section === 'N'; });
  renderUI();
}

function renderUI() {
  var eng = state.engagement;
  var status = eng ? eng.status : null;

  var findings = status === 'findings_ready';
  var questions = status === 'g1_questions';
  var planReady = status === 'plan_ready';
  var planApproved = status === 'plan_approved';
  var briefReady = status === 'brief_ready';
  var done = status === 'sealed';

  // Step indicator
  var reached2 = findings || questions || planReady || planApproved || briefReady || done;
  var reached3 = planReady || planApproved || briefReady || done;
  var reached4 = planApproved || briefReady || done;
  $('st2').classList.toggle('on', reached2);
  $('st3').classList.toggle('on', reached3);
  $('st4').classList.toggle('on', reached4);

  // Cards visibility
  $('goalCard').classList.toggle('hidden', !!eng || done);
  $('engCard').classList.toggle('hidden', !eng || findings || questions || planReady || planApproved || briefReady || done);
  $('findingsCard').classList.toggle('hidden', !findings);
  $('qCard').classList.toggle('hidden', !questions);
  $('planCard').classList.toggle('hidden', !planReady);
  $('briefCard').classList.toggle('hidden', !(planApproved || briefReady));
  $('doneCard').classList.toggle('hidden', !done);

  if (eng) {
    $('engId').textContent = eng.id;
    $('engGoals').textContent = '“' + eng.goals + '”';
    renderDocs(state.documents);
  }

  if (findings) {
    $('fEngId').textContent = eng.id;
    $('packVer').textContent = STATUTE_PACK.version;
    renderFindings(state.deficiencies);
  }

  if (questions) {
    $('qEngId').textContent = eng.id;
    renderQuestions(state.questions);
  }

  if (planReady) {
    $('pEngId').textContent = eng.id;
    renderPlan(state.plan);
  }

  if (planApproved || briefReady) {
    $('bEngId').textContent = eng.id;
    $('briefBuild').classList.toggle('hidden', briefReady);
    $('briefReview').classList.toggle('hidden', !briefReady);
    if (briefReady && state.brief) {
      renderBriefPreview(state.brief);
    }
  }

  if (done && state.brief) {
    renderDoneScreen(state.brief);
  }
}

// ---------------------------------------------------- Document Uploads & Handling
function renderDocs(docs) {
  var ul = $('docList');
  ul.innerHTML = '';
  docs.forEach(function (d) {
    var li = document.createElement('li');
    var isText = !!d.content;
    li.innerHTML =
      '<span>📄 ' + esc(d.filename) + ' <span class="meta">(' + esc(d.doc_type || 'unclassified') + ')</span></span>' +
      '<div class="doc-actions">' +
      '<button class="btn-sm ghost" onclick="viewDocContent(\'' + esc(d.id) + '\')">View</button> ' +
      (isText
        ? '<button class="btn-sm ghost" onclick="printDoc(\'' + esc(d.id) + '\')">Print / PDF</button> ' +
          '<button class="btn-sm ghost" onclick="downloadDoc(\'' + esc(d.id) + '\')">Download</button> '
        : '') +
      '<button class="btn-del btn-sm" onclick="deleteDoc(\'' + esc(d.id) + '\')" title="Delete permanently">✕</button>' +
      '</div>';
    ul.appendChild(li);
  });

  var anyText = docs.some(function (d) { return !!d.content; });
  var printAll = $('printAllBtn');
  if (printAll) printAll.classList.toggle('hidden', !anyText);

  var ready = docs.length > 0;
  $('analyzeBtn').disabled = !ready;
  $('analyzeBtn').classList.toggle('pulse', ready);
  $('analyzeHint').textContent = ready
    ? '✓ ' + docs.length + ' document' + (docs.length > 1 ? 's' : '') + ' ready for analysis.'
    : 'Upload at least one document or build statutory forms to continue.';
  $('analyzeHint').className = ready ? 'nextstep' : '';
}

async function handleFileUpload(files) {
  if (!state.engagement) return toast('Start an engagement first.', true);
  for (var i = 0; i < files.length; i++) {
    var f = files[i];
    await processSingleFile(f);
  }
  state.documents = await DB.listDocuments(state.engagement.id);
  renderDocs(state.documents);
}

function processSingleFile(file) {
  var MAX_BYTES = 15 * 1024 * 1024; // 15MB limit to prevent browser memory exhaustion
  if (file.size > MAX_BYTES) {
    toast('File "' + file.name + '" exceeds the 15MB limit (' + Math.round(file.size / (1024 * 1024)) + 'MB).', true);
    return Promise.resolve(null);
  }
  return new Promise(function (resolve) {
    var reader = new FileReader();
    var isText = file.type.indexOf('text/') === 0 || /\.(txt|md|markdown|json)$/i.test(file.name);

    if (isText) {
      reader.onload = async function (e) {
        var doc = {
          id: 'DOC-' + Math.random().toString(36).substring(2, 10).toUpperCase(),
          engagement_id: state.engagement.id,
          filename: file.name,
          mime: file.type || 'text/plain',
          size_bytes: file.size,
          doc_type: 'unclassified',
          content: e.target.result,
          uploaded: new Date().toISOString()
        };
        await DB.saveDocument(doc);
        resolve(doc);
      };
      reader.readAsText(file);
    } else {
      // PDF or Image — read as base64 for Gemini multimodal
      reader.onload = async function (e) {
        var b64Data = e.target.result.split(',')[1];
        var doc = {
          id: 'DOC-' + Math.random().toString(36).substring(2, 10).toUpperCase(),
          engagement_id: state.engagement.id,
          filename: file.name,
          mime: file.type || 'application/octet-stream',
          size_bytes: file.size,
          doc_type: 'unclassified',
          base64: b64Data,
          uploaded: new Date().toISOString()
        };
        await DB.saveDocument(doc);
        resolve(doc);
      };
      reader.readAsDataURL(file);
    }
  });
}

async function loadSampleDocuments() {
  if (!state.engagement) return toast('Click "Begin" to start your engagement first.', true);
  var samples = [
    {
      name: 'TEST_Will_Draft_Sam_Whitfield.txt',
      type: 'will',
      text: 'LAST WILL AND TESTAMENT OF SAMUEL WHITFIELD\nI, Samuel Whitfield of Portsmouth, NH declare this my Will...\nI leave my home to my brother David Whitfield.\nWitness 1: David Whitfield'
    },
    {
      name: 'TEST_Advance_Directive_Sam_Whitfield.txt',
      type: 'advance_directive',
      text: 'NEW HAMPSHIRE ADVANCE DIRECTIVE\nI, Samuel Whitfield appoint Mary Whitfield as health care agent.\n(No alternate agent named, unnotarized draft)'
    }
  ];

  for (var i = 0; i < samples.length; i++) {
    var doc = {
      id: 'DOC-SAMPLE-' + (i + 1),
      engagement_id: state.engagement.id,
      filename: samples[i].name,
      mime: 'text/plain',
      size_bytes: samples[i].text.length,
      doc_type: samples[i].type,
      content: samples[i].text,
      uploaded: new Date().toISOString()
    };
    await DB.saveDocument(doc);
  }
  state.documents = await DB.listDocuments(state.engagement.id);
  renderDocs(state.documents);
  toast('Sample test documents loaded.');
}

async function deleteDoc(docId) {
  var d = findDoc_(docId);
  var name = d ? d.filename : 'this document';
  if (!confirm('Permanently delete "' + name + '" from this browser?\n\nThis cannot be undone.')) return;

  await DB.deleteDocument(docId);
  await DB.addAudit('DOCUMENT_DELETE', name);
  state.documents = await DB.listDocuments(state.engagement.id);
  renderDocs(state.documents);
  toast('Deleted "' + name + '" from this browser.');
}

/**
 * Erase every engagement, document, extraction, finding and brief stored in
 * this browser. The saved API key is removed separately by disconnectKey().
 */
async function clearAllData() {
  if (!confirm('Erase ALL Granite Estate data stored in this browser?\n\nEvery document, finding and brief is deleted permanently. This cannot be undone.')) return;
  if (!confirm('Last check — this is permanent. Erase everything?')) return;

  await DB.clearAll();
  try { localStorage.removeItem('granite_disclaimer_ack'); } catch (e) { /* storage may be unavailable */ }
  toast('All Granite Estate data erased from this browser.');
  setTimeout(function () { location.reload(); }, 900);
}

function findDoc_(docId) {
  return (state.documents || []).find(function (x) { return x.id === docId; });
}

/**
 * Show the full document. Uses textContent (never innerHTML) so a draft —
 * which is untrusted input — can never execute as markup.
 */
function viewDocContent(docId) {
  var d = findDoc_(docId);
  if (!d) return;
  $('docViewTitle').textContent = d.filename;
  $('docViewBody').textContent = d.content ||
    (d.base64
      ? '[' + d.filename + ' is a PDF or image (' + Math.round(d.size_bytes / 1024) + ' KB). AI analysis can read it, but it cannot be previewed as text here.]'
      : 'No preview available.');
  $('docViewModal').classList.remove('hidden');
}

function closeDocView() {
  $('docViewModal').classList.add('hidden');
}

/**
 * Print or save one document as PDF. Renders into a dedicated print area via
 * textContent and lets the print stylesheet isolate it — no popup window and
 * no document.write, so no new script surface is introduced.
 */
function printDocArea_(title, body, auditEvent, auditDetail) {
  $('printDocTitle').textContent = title;
  $('printDocBody').textContent = body;
  document.body.classList.add('printing-doc');
  window.print();
  setTimeout(function () { document.body.classList.remove('printing-doc'); }, 500);
  DB.addAudit(auditEvent, auditDetail);
}

function printDoc(docId) {
  var d = findDoc_(docId);
  if (!d) return;
  if (!d.content) return toast('This is a PDF or image — open it in its own app to print.', true);
  printDocArea_(d.filename, d.content, 'DOCUMENT_PRINT', d.filename);
}

function printAllDocs() {
  var docs = (state.documents || []).filter(function (d) { return !!d.content; });
  if (!docs.length) return toast('Nothing to print yet.', true);
  var body = docs.map(function (d) {
    return '===== ' + d.filename + ' =====\n\n' + d.content;
  }).join('\n\n\n');
  printDocArea_('Granite Estate — Document Set', body, 'DOCUMENT_PRINT_ALL', docs.length + ' documents');
}

function downloadDoc(docId) {
  var d = findDoc_(docId);
  if (!d) return;
  if (!d.content) return toast('This is a PDF or image — it is already a file on your computer.', true);
  var safeName = String(d.filename || 'document').replace(/[^A-Za-z0-9._-]/g, '_');
  if (!/\.(txt|md)$/i.test(safeName)) safeName += '.txt';
  var a = document.createElement('a');
  a.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(d.content));
  a.setAttribute('download', safeName);
  document.body.appendChild(a);
  a.click();
  a.remove();
  DB.addAudit('DOCUMENT_DOWNLOAD', d.filename);
}

// ---------------------------------------------------- Statutory Form Assembly Flow
function openAssembleModal() {
  $('assembleModal').classList.remove('hidden');
  if (!$('as_childrenList').children.length) {
    addChildRow('', false);
  }
  toggleSpouseField();
  toggleRealEstateFields();
  toggleResidueField();
}

function closeAssembleModal() {
  $('assembleModal').classList.add('hidden');
}

function toggleSpouseField() {
  var isMarried = $('as_marital').value === 'married';
  $('as_spouseGroup').classList.toggle('hidden', !isMarried);
}

function toggleRealEstateFields() {
  var hasRE = $('as_hasRealEstate').checked;
  $('as_reFields').classList.toggle('hidden', !hasRE);
}

function toggleTODBeneficiaryField() {
  var inc = $('as_includeTODDeed').checked;
  $('as_todBeneficiaryGroup').classList.toggle('hidden', !inc);
}

function toggleResidueField() {
  var custom = document.querySelector('input[name="as_residue"]:checked').value === 'custom';
  $('as_customResidue').classList.toggle('hidden', !custom);
}

function addChildRow(name, isMinor) {
  var wrap = $('as_childrenList');
  var div = document.createElement('div');
  div.className = 'child-row';
  div.innerHTML =
    '<input type="text" placeholder="Child full name" value="' + esc(name) + '" class="as-cname">' +
    '<label class="chk" style="margin:0 4px; white-space:nowrap;"><input type="checkbox" class="as-cminor"' + (isMinor ? ' checked' : '') + '> Minor (under 18)</label>' +
    '<button type="button" class="btn-del" onclick="removeChildRow(this)" title="Remove">✕</button>';
  wrap.appendChild(div);
  updateGuardianVisibility();
  div.querySelector('.as-cminor').addEventListener('change', updateGuardianVisibility);
}

function removeChildRow(btn) {
  var row = btn.parentNode;
  row.parentNode.removeChild(row);
  updateGuardianVisibility();
}

function updateGuardianVisibility() {
  var minors = Array.prototype.slice.call(document.querySelectorAll('.as-cminor')).some(function (cb) { return cb.checked; });
  $('as_guardianGroup').classList.toggle('hidden', !minors);
}

async function submitAssembleForm() {
  var clientName = $('as_clientName').value.trim();
  if (!clientName) return toast('Please enter your full legal name.', true);

  if (!state.engagement) {
    var engId = 'ENG-' + Math.random().toString(36).substring(2, 10).toUpperCase();
    var eng = {
      id: engId,
      created: new Date().toISOString(),
      status: 'intake',
      goals: 'Prepare complete New Hampshire estate plan with statutory forms for ' + clientName
    };
    Object.assign(eng, attestationRecord_('affirmed by continuing from the NH statutory form builder'));
    await DB.saveEngagement(eng);
    state.engagement = eng;
  }

  var children = [];
  var cRows = document.querySelectorAll('#as_childrenList .child-row');
  cRows.forEach(function (row) {
    var n = row.querySelector('.as-cname').value.trim();
    var m = row.querySelector('.as-cminor').checked;
    if (n) children.push({ name: n, isMinor: m });
  });

  var residueEl = document.querySelector('input[name="as_residue"]:checked');
  var payload = {
    clientName: clientName,
    town: $('as_town').value.trim() || 'Portsmouth',
    county: $('as_county').value,
    maritalStatus: $('as_marital').value,
    spouseName: $('as_marital').value === 'married' ? $('as_spouse').value.trim() : '',
    children: children,
    executorName: $('as_executor').value.trim(),
    executorSuccessor: $('as_executorSucc').value.trim(),
    guardianName: $('as_guardian').value.trim(),
    hcAgentName: $('as_hcAgent').value.trim(),
    hcAgentPhone: $('as_hcPhone').value.trim(),
    hcAgentAlternate: $('as_hcAlt').value.trim(),
    hcAgentAlternatePhone: $('as_hcAltPhone').value.trim(),
    finAgentName: $('as_finAgent').value.trim(),
    finAgentPhone: $('as_finPhone').value.trim(),
    finAgentAlternate: $('as_finAlt').value.trim(),
    finAgentAlternatePhone: $('as_finAltPhone').value.trim(),
    hasRealEstate: $('as_hasRealEstate').checked,
    realEstateAddress: $('as_reAddress').value.trim(),
    includeTODDeed: $('as_hasRealEstate').checked && $('as_includeTODDeed').checked,
    todBeneficiary: $('as_todBeneficiary').value.trim(),
    residuePlan: residueEl ? residueEl.value : 'spouse_then_children',
    customResidue: $('as_customResidue').value.trim()
  };

  var assembled = assembleAllDocuments(payload);
  for (var i = 0; i < assembled.length; i++) {
    var a = assembled[i];
    var doc = {
      id: 'DOC-STAT-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
      engagement_id: state.engagement.id,
      filename: a.filename,
      mime: 'text/plain',
      size_bytes: a.content.length,
      doc_type: a.docType,
      content: a.content,
      uploaded: new Date().toISOString()
    };
    await DB.saveDocument(doc);
  }

  closeAssembleModal();
  state.documents = await DB.listDocuments(state.engagement.id);
  renderUI();
  toast('✓ ' + assembled.length + ' NH statutory documents assembled! Click "Run analysis" to evaluate compliance.');
}

// ---------------------------------------------------- Analysis Pipeline
async function analyze() {
  if (!state.documents || !state.documents.length) return toast('Add documents first.', true);

  var hasKey = !!getStoredKey_();
  var aBtn = $('analyzeBtn');
  aBtn.disabled = true;
  aBtn.innerHTML = '<span class="spin"></span>' + (hasKey ? 'Reading your documents…' : 'Checking your documents…');

  try {
    var extractions = [];
    var skipped = [];

    for (var i = 0; i < state.documents.length; i++) {
      var d = state.documents[i];
      var facts = null;

      if (hasKey) {
        var base64Part = d.base64 ? { mimeType: d.mime, data: d.base64 } : null;
        facts = await geminiExtract_(d.content, d.filename, base64Part);
      } else if (isLocallyReadable(d)) {
        // Offline statutory check: deterministic pattern extraction, no network.
        facts = localExtract_(d.content, d.filename);
      } else {
        // A PDF, scan or photo cannot be read without AI. Skipping is mandatory:
        // empty facts would make every rule fire as a false critical finding.
        skipped.push(d.filename);
        continue;
      }

      facts._doc = d;
      d.doc_type = facts.doc_type;
      d.extraction_source = facts.extraction_source;
      await DB.saveDocument(d);
      await DB.saveExtraction(d.id, state.engagement.id, facts);
      extractions.push(facts);
    }

    if (!extractions.length) {
      toast('These files need AI to be read. Connect a key, paste the text instead, or build NH forms.', true);
      return;
    }

    var defs = runRules_(extractions);
    await DB.saveDeficiencies(state.engagement.id, defs);
    await DB.setEngagementStatus(state.engagement.id, 'findings_ready');

    state.deficiencies = defs;
    state.engagement.status = 'findings_ready';
    state.engagement.analysis_mode = hasKey ? 'gemini' : 'local';
    state.engagement.skipped_files = skipped;
    await DB.saveEngagement(state.engagement);
    await DB.addAudit('ANALYSIS_RUN',
      state.engagement.id + ' | mode=' + state.engagement.analysis_mode +
      ' | docs=' + extractions.length + ' | skipped=' + skipped.length +
      ' | findings=' + defs.length);

    renderUI();
    toast((hasKey ? 'Analysis complete — ' : 'Offline check complete — ') +
      defs.length + ' statutory finding' + (defs.length === 1 ? '' : 's') + ' identified.');
  } catch (err) {
    toast('Analysis error: ' + err.message, true);
  } finally {
    aBtn.disabled = false;
    aBtn.innerHTML = 'Check my documents →';
  }
}

// ---------------------------------------------------- Findings (Step 2 Part 1)
function renderFindings(defs) {
  var counts = { critical: 0, high: 0, medium: 0, informational: 0 };
  defs.forEach(function (d) { if (counts[d.severity] != null) counts[d.severity]++; });
  var colors = { critical: 'var(--crit)', high: 'var(--high)', medium: 'var(--med)', informational: 'var(--info)' };
  var parts = [];
  ['critical', 'high', 'medium', 'informational'].forEach(function (sv) {
    if (counts[sv]) parts.push('<b style="background:' + colors[sv] + '">' + counts[sv] + '</b>' + sv);
  });

  $('fSummary').innerHTML = defs.length
    ? defs.length + ' findings: &nbsp;' + parts.join(' &nbsp; ')
    : 'No compliance gaps found against current NH rule catalog.';

  // State how these findings were produced and what was left out.
  var modeBox = $('analysisModeNote');
  if (modeBox) {
    var eng = state.engagement || {};
    var skipped = eng.skipped_files || [];
    var html = '';
    if (eng.analysis_mode === 'local') {
      html += '<b>Offline check.</b> Your documents were checked here in your browser by pattern matching — nothing was sent anywhere. ' +
              'This is less thorough than AI reading and can miss clauses that are worded unusually, so treat these findings as a starting point and confirm them against your documents.';
    } else {
      html += '<b>AI reading.</b> Your documents were read by Google Gemini using your key.';
    }
    if (skipped.length) {
      html += '<br><br><b>' + skipped.length + ' file' + (skipped.length === 1 ? ' was' : 's were') + ' not checked:</b> ' +
              skipped.map(function (f) { return esc(f); }).join(', ') +
              '. PDFs, scans and photos can only be read with AI. Connect a key, or paste the text into a .txt file, to include them.';
    }
    modeBox.innerHTML = html;
    modeBox.className = eng.analysis_mode === 'local' ? 'mode-note local' : 'mode-note ai';
  }

  var wrap = $('fList');
  wrap.innerHTML = '';
  defs.forEach(function (d) {
    var div = document.createElement('div');
    var rid = d.rule_id || d.ruleId;
    div.className = 'finding ' + d.severity;
    div.innerHTML =
      '<div class="top"><b>' + esc(d.title) + '</b><span class="sev ' + d.severity + '">' + esc(d.severity) + '</span></div>' +
      '<div class="cite">' + esc(d.citation) + (d.source_doc ? ' · ' + esc(d.source_doc) : '') + ' · ' + esc(rid) + '</div>' +
      '<div class="plain">' + esc(d.plain_language || d.plainLanguage) + '</div>';
    wrap.appendChild(div);
  });
}

function showUploads() {
  $('findingsCard').classList.add('hidden');
  $('engCard').classList.remove('hidden');
}

// ---------------------------------------------------- Clarification Questions (Step 2 Part 2)
async function startQs() {
  var extractions = await DB.listExtractions(state.engagement.id);
  var qs = buildQuestions_(state.deficiencies, extractions);
  await DB.saveQuestions(state.engagement.id, qs);
  await DB.setEngagementStatus(state.engagement.id, 'g1_questions');
  state.questions = qs;
  state.engagement.status = 'g1_questions';
  renderUI();
  toast(qs.length ? qs.length + ' question' + (qs.length === 1 ? '' : 's') + ' generated to clarify your intentions.' : 'No questions needed — building plan.');
  if (!qs.length) submitQs();
}

function renderQuestions(qs) {
  var wrap = $('qList');
  wrap.innerHTML = '';
  qs.forEach(function (q) {
    var div = document.createElement('div');
    div.className = 'q';
    div.id = 'q_' + q.id;
    var chips = (q.options || []).map(function (o, i) {
      return '<label onclick="pickChoice(\'' + q.id + '\',' + i + ')" id="chip_' + q.id + '_' + i + '">' + esc(o) + '</label>';
    }).join('');
    div.innerHTML =
      '<div class="qt">' + esc(q.question) + '</div>' +
      '<div class="chips">' + chips + '</div>' +
      '<div class="other">Other: <input type="text" id="other_' + q.id + '" placeholder="Type custom answer" oninput="clearChoice(\'' + q.id + '\')"></div>' +
      '<div class="skip"><label><input type="checkbox" id="skip_' + q.id + '" onchange="toggleSkipQ(\'' + q.id + '\')"> Skip — flag for attorney discussion</label></div>';
    wrap.appendChild(div);
  });
}

var picks = {};
function pickChoice(qid, idx) {
  picks[qid] = idx;
  $('other_' + qid).value = '';
  $('skip_' + qid).checked = false;
  $('q_' + qid).classList.remove('skipped');
  refreshChips(qid);
}
function clearChoice(qid) {
  if ($('other_' + qid).value) {
    delete picks[qid];
    $('skip_' + qid).checked = false;
    $('q_' + qid).classList.remove('skipped');
    refreshChips(qid);
  }
}
function toggleSkipQ(qid) {
  var on = $('skip_' + qid).checked;
  $('q_' + qid).classList.toggle('skipped', on);
  if (on) { delete picks[qid]; $('other_' + qid).value = ''; refreshChips(qid); }
}
function refreshChips(qid) {
  var q = state.questions.find(function (x) { return x.id === qid; });
  if (!q) return;
  (q.options || []).forEach(function (o, i) {
    var c = $('chip_' + qid + '_' + i);
    if (c) c.classList.toggle('sel', picks[qid] === i);
  });
}

async function submitQs() {
  for (var i = 0; i < state.questions.length; i++) {
    var q = state.questions[i];
    var skipped = $('skip_' + q.id) ? $('skip_' + q.id).checked : false;
    var other = $('other_' + q.id) ? $('other_' + q.id).value.trim() : '';
    var answer = other || (picks[q.id] != null ? q.options[picks[q.id]] : '');
    await DB.updateQuestionAnswer(q.id, answer, (skipped || !answer) ? 'skipped' : 'answered');
  }

  state.questions = await DB.listQuestions(state.engagement.id);
  var plan = buildPlan_(state.engagement, state.deficiencies, state.questions, null);
  await DB.savePlan(state.engagement.id, plan);
  await DB.setEngagementStatus(state.engagement.id, 'plan_ready');
  state.plan = plan;
  state.engagement.status = 'plan_ready';
  renderUI();
  toast('Plan assembled — review and approve below.');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ---------------------------------------------------- Remediation Plan (Step 3)
function renderPlan(items) {
  var wrap = $('pList');
  wrap.innerHTML = '';
  var secs = [
    { key: 'A', label: 'For your attorney to address' },
    { key: 'B', label: 'Your answers, to be implemented' },
    { key: 'C', label: 'Open items & comments' }
  ];
  secs.forEach(function (sec) {
    var rows = items.filter(function (r) { return r.section === sec.key; });
    if (!rows.length) return;
    var h = document.createElement('div');
    h.className = 'plan-sec';
    h.textContent = sec.label;
    wrap.appendChild(h);

    rows.forEach(function (r) {
      var d = document.createElement('div');
      d.className = 'plan-item' + (r.source === 'default' || r.source === 'client_comment' ? ' open' : '');
      d.innerHTML = esc(r.item) + (r.citation ? ' <span class="cite">· ' + esc(r.citation) + '</span>' : '');
      wrap.appendChild(d);
    });
  });
}

async function approveP() {
  await DB.setEngagementStatus(state.engagement.id, 'plan_approved');
  state.engagement.status = 'plan_approved';
  renderUI();
  toast('Plan approved. Final step: build your attorney brief.');
}

function toggleChange() { $('changeBox').classList.toggle('hidden'); }
async function sendChange() {
  var txt = $('changeText').value.trim();
  if (!txt) return toast('Describe what should change first.', true);
  await DB.addPlanItem(state.engagement.id, {
    section: 'C', related_rule: '', citation: '',
    item: 'CLIENT COMMENT: ' + txt, source: 'client_comment'
  });
  $('changeText').value = '';
  state.plan = await DB.listPlan(state.engagement.id);
  renderPlan(state.plan);
  toast('Comment added to plan.');
}

// ---------------------------------------------------- Attorney Brief (Step 4)
async function buildBrief() {
  var eng = state.engagement;
  var extractions = await DB.listExtractions(eng.id);
  var ppl = harvestPeople_(extractions);

  // Provenance (PRD FR-ARCH-3): an attorney must be able to see how these facts
  // were derived, and that an offline pass is pattern-based rather than read.
  var mode = eng.analysis_mode || 'gemini';
  var briefData = {
    engagement_id: eng.id,
    generated: new Date().toISOString(),
    app_version: APP_VERSION,
    statute_pack: STATUTE_PACK.version,
    client: ppl.primary || 'Self',
    goals: eng.goals,
    people: ppl,
    documents: state.documents,
    deficiencies: state.deficiencies,
    questions: state.questions,
    plan: state.plan,
    analysis_mode: mode,
    analysis_engine: mode === 'local'
      ? (typeof LOCAL_EXTRACTOR_VERSION !== 'undefined' ? LOCAL_EXTRACTOR_VERSION : 'local')
      : 'google-gemini',
    analysis_caveat: mode === 'local'
      ? 'Facts were extracted offline by deterministic pattern matching, not read by AI. Pattern matching can miss clauses that are phrased unusually, so findings below should be confirmed against the source documents.'
      : 'Facts were extracted by Google Gemini from the documents listed.',
    files_not_analyzed: eng.skipped_files || [],
    attestation: {
      text: eng.attest_text || null,
      method: eng.attest_method || null,
      recorded_at: eng.attest_at || null,
      domicile_nh: eng.attest_domicile === true,
      adult_self_acting: eng.attest_adult === true
    }
  };

  await DB.saveBrief(briefData);
  await DB.setEngagementStatus(eng.id, 'brief_ready');
  state.brief = briefData;
  state.engagement.status = 'brief_ready';
  renderUI();
  toast('Attorney brief ready for inspection.');
}

/**
 * Render the attorney brief as a readable, printable document.
 * Every interpolated value goes through esc() — names and answers originate in
 * untrusted documents and user input.
 */
function renderBriefBody(b) {
  var host = $('briefBody');
  if (!host || !b) return;
  var out = [];

  out.push('<div class="brief-head">' +
    '<h3>New Hampshire Attorney Preparation Brief</h3>' +
    '<div class="brief-meta">' +
    'Engagement ' + esc(b.engagement_id) + ' · Prepared ' + esc(new Date(b.generated).toLocaleString()) +
    '<br>Statute pack ' + esc(b.statute_pack) + ' · App ' + esc(b.app_version) +
    '</div></div>');

  out.push('<div class="brief-disclaim">Informational preparation material only. Granite Estate Forms is not a law firm, provides no legal advice, and creates no attorney–client relationship. All statutory references are reference points for review by a New Hampshire-licensed attorney.</div>');

  // 1. Client snapshot
  var ppl = b.people || {};
  out.push('<h4>1. Client snapshot</h4><table class="brief-tbl">');
  out.push('<tr><th>Client</th><td>' + esc(b.client || 'Not identified') + '</td></tr>');
  out.push('<tr><th>Adults identified</th><td>' + esc((ppl.adults || []).join(', ') || 'None identified') + '</td></tr>');
  out.push('<tr><th>Minor children</th><td>' + esc((ppl.minors || []).join(', ') || 'None identified') + '</td></tr>');
  var att = b.attestation || {};
  out.push('<tr><th>NH domicile</th><td>' + (att.domicile_nh ? 'Client-attested at intake' : 'Not collected') + '</td></tr>');
  out.push('<tr><th>Age / capacity</th><td>' + (att.adult_self_acting ? 'Client-attested 18+ acting for self (capacity not assessed by software)' : 'Not collected') + '</td></tr>');
  if (att.text) {
    out.push('<tr><th>Attestation wording</th><td>' + esc(att.text) +
      (att.recorded_at ? '<br><i>Recorded ' + esc(new Date(att.recorded_at).toLocaleString()) + ' — ' + esc(att.method || '') + '</i>' : '') +
      '</td></tr>');
  }
  out.push('</table>');

  // 2. Goals, verbatim
  out.push('<h4>2. Client goals (verbatim)</h4><blockquote class="brief-quote">' + esc(b.goals || '') + '</blockquote>');

  // 3. How these facts were derived
  out.push('<h4>3. Basis of analysis</h4><table class="brief-tbl">');
  out.push('<tr><th>Method</th><td>' + (b.analysis_mode === 'local' ? 'Offline pattern matching (no data left the browser)' : 'AI document reading') + '</td></tr>');
  out.push('<tr><th>Engine</th><td>' + esc(b.analysis_engine || 'unknown') + '</td></tr>');
  out.push('<tr><th>Reliability note</th><td>' + esc(b.analysis_caveat || '') + '</td></tr>');
  if ((b.files_not_analyzed || []).length) {
    out.push('<tr><th>Files NOT analyzed</th><td>' + esc(b.files_not_analyzed.join(', ')) + '</td></tr>');
  }
  out.push('</table>');

  // 4. Document manifest
  out.push('<h4>4. Document manifest</h4>');
  if ((b.documents || []).length) {
    out.push('<table class="brief-tbl"><tr><th>File</th><th>Classified as</th><th>Source</th></tr>');
    b.documents.forEach(function (d) {
      out.push('<tr><td>' + esc(d.filename) + '</td><td>' + esc(d.doc_type || 'unclassified') +
        '</td><td>' + esc(d.extraction_source || (d.id && d.id.indexOf('DOC-STAT-') === 0 ? 'assembled by Granite Estate' : 'not analyzed')) + '</td></tr>');
    });
    out.push('</table>');
  } else {
    out.push('<p>No documents recorded.</p>');
  }

  // 5. Deficiency register
  out.push('<h4>5. Deficiency register (NH RSA citations)</h4>');
  var defs = b.deficiencies || [];
  if (defs.length) {
    out.push('<table class="brief-tbl"><tr><th>Rule</th><th>Severity</th><th>Finding</th><th>Authority</th></tr>');
    defs.forEach(function (d) {
      out.push('<tr><td>' + esc(d.rule_id || d.ruleId || '') + '</td><td>' + esc(d.severity || '') +
        '</td><td><b>' + esc(d.title || '') + '</b><br>' + esc(d.plain_language || d.plainLanguage || '') +
        (d.note ? '<br><i>' + esc(d.note) + '</i>' : '') +
        '</td><td>' + esc(d.citation || '') + '</td></tr>');
    });
    out.push('</table>');
  } else {
    out.push('<p>No deficiencies identified against statute pack ' + esc(b.statute_pack) + '.</p>');
  }

  // 6. Client answers
  out.push('<h4>6. Client answers to clarification questions</h4>');
  var qs = b.questions || [];
  if (qs.length) {
    out.push('<table class="brief-tbl"><tr><th>Question</th><th>Answer</th></tr>');
    qs.forEach(function (q) {
      var ans = q.answer && String(q.answer).trim();
      out.push('<tr><td>' + esc(q.question || '') + '</td><td>' +
        (ans ? esc(ans) : '<i>Skipped — flagged for attorney discussion</i>') + '</td></tr>');
    });
    out.push('</table>');
  } else {
    out.push('<p>No clarification questions were raised.</p>');
  }

  // 7. Preparation plan and open items
  out.push('<h4>7. Preparation plan &amp; open items</h4>');
  var plan = b.plan || [];
  var groups = [
    { key: 'A', label: 'For the attorney to address' },
    { key: 'B', label: 'Client instructions to implement' },
    { key: 'C', label: 'Open items' },
    { key: 'N', label: 'Client notes for the attorney' }
  ];
  var anyPlan = false;
  groups.forEach(function (g) {
    var rows = plan.filter(function (r) { return r.section === g.key; });
    if (!rows.length) return;
    anyPlan = true;
    out.push('<h5>' + esc(g.label) + '</h5><ul class="brief-list">');
    rows.forEach(function (r) { out.push('<li>' + esc(r.item || '') + '</li>'); });
    out.push('</ul>');
  });
  if (!anyPlan) out.push('<p>No plan items recorded.</p>');

  host.innerHTML = out.join('');
}

function renderBriefPreview(b) {
  renderBriefBody(b);

  var wrap = $('briefLinks');
  wrap.innerHTML =
    '<button onclick="window.print()" class="pulse">🖨️ Print / Save as PDF</button> ' +
    '<button class="ghost" onclick="downloadBriefJson()">💾 Export Data JSON</button>';

  var notesWrap = $('noteList');
  notesWrap.innerHTML = '';
  var notes = state.plan.filter(function (r) { return r.section === 'N'; });
  notes.forEach(function (n) {
    var d = document.createElement('div');
    d.className = 'plan-item open';
    d.textContent = n.item;
    notesWrap.appendChild(d);
  });
}

function toggleNote() { $('noteBox').classList.toggle('hidden'); }
async function sendNote() {
  var txt = $('noteText').value.trim();
  if (!txt) return toast('Write your note first.', true);
  await DB.addPlanItem(state.engagement.id, {
    section: 'N', related_rule: '', citation: '',
    item: txt, source: 'client_note'
  });
  $('noteText').value = '';
  state.plan = await DB.listPlan(state.engagement.id);
  renderBriefPreview(state.brief);
  toast('Note saved for attorney.');
}

function downloadBriefJson() {
  if (!state.brief) return;
  var dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(state.brief, null, 2));
  var a = document.createElement('a');
  a.setAttribute('href', dataStr);
  a.setAttribute('download', 'AttorneyBrief_' + state.engagement.id + '.json');
  document.body.appendChild(a);
  a.click();
  a.remove();
}

async function approveB() {
  // Compute SHA-256 seal manifest in browser
  var eng = state.engagement;
  var manifestContent =
    'GRANITE ESTATE — SEALED ENGAGEMENT MANIFEST\n' +
    'Engagement: ' + eng.id + '\n' +
    'Sealed: ' + new Date().toISOString() + '\n' +
    'Version: ' + APP_VERSION + '\n' +
    'Statute Pack: ' + STATUTE_PACK.version + '\n\n';

  var encoder = new TextEncoder();
  var briefBytes = encoder.encode(JSON.stringify(state.brief));
  var hashBuffer = await crypto.subtle.digest('SHA-256', briefBytes);
  var hashArray = Array.from(new Uint8Array(hashBuffer));
  var hashHex = hashArray.map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');

  manifestContent += 'AttorneyBrief_' + eng.id + '.json SHA-256: ' + hashHex + '\n';
  state.documents.forEach(function (d) {
    manifestContent += d.filename + ' (' + d.size_bytes + ' bytes)\n';
  });

  state.brief.pdf_sha256 = hashHex;
  state.brief.manifest = manifestContent;
  await DB.saveBrief(state.brief);
  await DB.setEngagementStatus(eng.id, 'sealed');
  state.engagement.status = 'sealed';

  await DB.addAudit('G3_APPROVED_SEALED', eng.id + ' | sha256: ' + hashHex);
  renderUI();
  toast('Engagement sealed with cryptographic tamper-evident manifest.');
}

function renderDoneScreen(brief) {
  $('doneLinks').innerHTML =
    '<button onclick="window.print()">🖨️ Print / Save PDF Brief</button> ' +
    '<button class="ghost" onclick="downloadBriefJson()">💾 Download JSON Brief</button> ' +
    '<button class="ghost" onclick="downloadManifest()">📜 Download Seal Manifest</button>';
}

function downloadManifest() {
  if (!state.brief || !state.brief.manifest) return;
  var dataStr = 'data:text/plain;charset=utf-8,' + encodeURIComponent(state.brief.manifest);
  var a = document.createElement('a');
  a.setAttribute('href', dataStr);
  a.setAttribute('download', 'Manifest_' + state.engagement.id + '.txt');
  document.body.appendChild(a);
  a.click();
  a.remove();
}

async function startNewEngagement() {
  await DB.clearAll();
  state = { engagement: null, documents: [], deficiencies: [], questions: [], plan: [], brief: null, briefNotes: [] };
  $('goals').value = '';
  renderUI();
  toast('Fresh start ready.');
}

window.addEventListener('DOMContentLoaded', initApp);
