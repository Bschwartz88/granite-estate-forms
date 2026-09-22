/**
 * Granite Estate — Strategy & Remediation Plan Engine
 * Pack: 2026.09-M5
 * Universal Module: Works in both browser and Node.js.
 */

var QUESTION_BUDGET = 7;

function harvestPeople_(facts) {
  var adults = [], minors = [], primary = null, seen = {};
  function add(name, list) {
    var n = String(name || '').trim();
    if (!n || n.length < 3) return;
    var k = n.toLowerCase();
    if (seen[k]) return;
    seen[k] = true;
    list.push(n);
  }

  facts.forEach(function (f) {
    if (!primary && f.person_primary) primary = f.person_primary;
    (f.minor_children || []).forEach(function (n) { add(n, minors); });
    (f.all_children || []).forEach(function (n) {
      var lc = String(n || '').toLowerCase();
      var isMin = (f.minor_children || []).some(function (m) { return String(m || '').toLowerCase() === lc; });
      if (!isMin) add(n, adults);
    });
  });

  var minorKeys = minors.map(function (n) { return n.toLowerCase(); });
  facts.forEach(function (f) {
    var w = f.will || {}, t = f.trust || {}, a = f.ad || {}, p = f.poa || {};
    [f.spouse, w.executor, w.successor_executor, w.guardian_name,
     t.trustee, t.successor_trustee, a.agent, a.alternate_agent,
     p.agent, p.successor_agent, p.alternate_agent]
      .forEach(function (n) { maybeAdult(n); });
    (w.beneficiaries || []).concat(t.beneficiaries || []).forEach(function (b) { maybeAdult(b && b.name); });
    (w.witness_names || []).forEach(function (n) { maybeAdult(n); });
  });

  function maybeAdult(n) {
    n = String(n || '').trim();
    if (!n) return;
    var k = n.toLowerCase();
    if (minorKeys.some(function (m) { return k.indexOf(m) !== -1 || m.indexOf(k) !== -1; })) return;
    if (primary && (k === primary.toLowerCase())) return;
    add(n, adults);
  }

  return { adults: adults, minors: minors, primary: primary };
}

function buildQuestions_(defs, facts) {
  var ppl = harvestPeople_(facts);
  var opts = ppl.adults.slice(0, 4);

  function optsExcluding_() {
    var ex = Array.prototype.slice.call(arguments).map(function (n) { return String(n || '').toLowerCase(); });
    return opts.filter(function (o) {
      var k = o.toLowerCase();
      return !ex.some(function (e) { return e && (k.indexOf(e) !== -1 || e.indexOf(k) !== -1); });
    });
  }

  var qs = [];
  var have = {};
  defs.forEach(function (d) { have[d.ruleId || d.rule_id] = d; });

  function push(ruleId, impact, question, options, defaultNote) {
    qs.push({
      rule_id: ruleId, impact: impact, question: question,
      options: options, default_note: defaultNote
    });
  }

  if (have['W-08']) {
    var spouseName = (facts.filter(function (f) { return f.spouse; })[0] || {}).spouse;
    push('W-08', 95,
      'If both parents were unavailable, who should care for ' + (ppl.minors.join(' and ') || 'your minor child(ren)') + '?',
      optsExcluding_(spouseName), 'Guardian preference unconfirmed — attorney to elicit and draft nomination (RSA 463).');
  }
  if (have['W-10']) {
    var allChildren = [];
    facts.forEach(function (f) {
      (f.all_children || []).forEach(function (c) { if (allChildren.indexOf(c) === -1) allChildren.push(c); });
      (f.minor_children || []).forEach(function (c) { if (allChildren.indexOf(c) === -1) allChildren.push(c); });
    });
    var wf10 = facts.filter(function (f) { return f.doc_type === 'will'; })[0];
    var wb10 = wf10 ? (wf10.will.beneficiaries || []).map(function (b) { return (b.name || '').toLowerCase(); }) : [];
    var omitted = allChildren.filter(function (c) {
      var lc = c.toLowerCase();
      return !wb10.some(function (b) { return b && (b.indexOf(lc) !== -1 || lc.indexOf(b) !== -1); });
    });
    var childList = omitted.length ? omitted.join(', ') : 'one or more children';
    push('W-10', 92,
      'Your draft will does not explicitly name or mention ' + childList + '. In New Hampshire, omitted children automatically claim a full intestate share under RSA 551:10. How should the attorney address this?',
      ['Include and name them as a beneficiary', 'Explicitly acknowledge them with a nominal bequest', 'Explicitly state intention to omit (disinherit)', 'Attorney to advise on options'],
      'Omitted child intention unconfirmed — attorney must explicitly acknowledge child in will to prevent RSA 551:10 pretermitted heir claim.');
  }
  if (have['W-05']) {
    var w = facts.filter(function (f) { return f.doc_type === 'will'; })[0];
    var overlap = w ? (w.will.witness_names || []).join(', ') : 'a witness';
    push('W-05', 88,
      'It looks like ' + overlap + ' may be both a witness and a beneficiary of the will. Is that correct?',
      ['Yes, same person', 'No, different people', 'Not sure'],
      'Interested-witness status unconfirmed — attorney to verify witness identities.');
  }
  if (have['W-07']) {
    push('W-07', 85,
      'Your will has no “everything else” clause. Anything not specifically listed — who should receive it?',
      (facts[0] && facts[0].spouse ? [facts[0].spouse + ' (spouse)'] : []).concat(['Split among my children', 'Split among family', 'Someone else / it’s complicated']),
      'Residuary intent unconfirmed — attorney to elicit residuary scheme (RSA 561 exposure until resolved).');
  }
  if (have['W-09S']) {
    var spName = (facts.filter(function (f) { return f.spouse; })[0] || {}).spouse || 'your spouse';
    push('W-09S', 82,
      'Under NH RSA 560:10, surviving spouses have a statutory elective share right. Is ' + spName + ' aware of and in agreement with your proposed estate distribution?',
      ['Yes, we have discussed and agree', 'No, we need to discuss', 'We have a prenuptial or marital agreement', 'Attorney to advise on spousal rights'],
      'Spousal elective share agreement unconfirmed — attorney to verify RSA 560:10 spousal rights.');
  }
  if (have['T-01B']) {
    var tf = facts.filter(function (f) { return f.doc_type === 'revocable_trust'; })[0];
    push('T-01B', 75,
      'Your trust has no backup trustee. Who should take over managing the trust if you cannot?',
      optsExcluding_(tf && tf.trust.trustee), 'Successor trustee preference unconfirmed — attorney to elicit.');
  }
  if (have['A-02']) {
    var adf = facts.filter(function (f) { return f.doc_type === 'advance_directive'; })[0];
    var agent = adf && adf.ad.agent ? adf.ad.agent : 'your health care agent';
    push('A-02', 70,
      'If ' + agent + ' were unavailable in a medical emergency, who should decide instead?',
      optsExcluding_(agent), 'Alternate health-care agent unconfirmed — attorney to elicit (RSA 137-J).');
  }
  if (have['P-02B']) {
    var pf = facts.filter(function (f) { return f.doc_type === 'financial_poa' || (f.poa && f.poa.agent); })[0];
    var pAgent = pf && pf.poa && pf.poa.agent ? pf.poa.agent : 'your primary financial agent';
    push('P-02B', 68,
      'If ' + pAgent + ' could not serve as your financial agent under your Power of Attorney, who should serve as backup (RSA 564-E:111)?',
      optsExcluding_(pAgent), 'Successor financial agent unconfirmed — attorney to elicit backup agent nomination.');
  }
  if (have['W-06B']) {
    var wf = facts.filter(function (f) { return f.doc_type === 'will'; })[0];
    var ex = wf && wf.will.executor ? wf.will.executor : 'your executor';
    push('W-06B', 65,
      'If ' + ex + ' could not serve as executor, who should step in?',
      optsExcluding_(ex), 'Successor executor preference unconfirmed — attorney to elicit.');
  }
  if (have['N-03']) {
    push('N-03', 62,
      'You own New Hampshire real estate that may pass through probate. New Hampshire allows non-probate transfer via a Transfer on Death Deed (RSA 563-D). Would you like to explore passing your real estate outside probate without a trust?',
      ['Yes, explore an RSA 563-D TOD Deed to avoid probate', 'I prefer creating or funding a revocable trust', 'Probate is fine / keep as-is', 'Attorney to advise on real estate options'],
      'Client interest in RSA 563-D Transfer on Death Deed unconfirmed — attorney to discuss non-probate transfer options.');
  }
  if (have['W-06']) {
    push('W-06', 80, 'Your will names no executor. Who should carry out your will?',
      opts, 'Executor preference unconfirmed — attorney to elicit (RSA 553).');
  }

  defs.filter(function (d) { return (d.ruleId || d.rule_id) === 'X-01'; }).forEach(function (d) {
    var pl = d.plainLanguage || d.plain_language || '';
    push('X-01', 60, 'I read “' + (d.sourceDoc || d.source_doc) + '” as: ' + (pl.match(/read as: (\w+)/) ? pl.match(/read as: (\w+)/)[1] : 'unknown') + '. Is that right?',
      ['Yes, correct', 'It’s a will', 'It’s a trust', 'It’s an advance directive'],
      'Document type unconfirmed — attorney to verify.');
  });

  qs.sort(function (a, b) { return b.impact - a.impact; });
  var kept = qs.slice(0, QUESTION_BUDGET);
  kept.forEach(function (q, i) { q.id = 'Q' + (i + 1); });
  return kept;
}

function buildPlan_(eng, defs, qs, aiSummary) {
  var rows = [];

  if (aiSummary) {
    rows.push({ section: 'S', related_rule: '', citation: '', item: aiSummary, source: 'ai_summary' });
  }

  // A — Attorney actions
  defs.forEach(function (d) {
    var rid = d.ruleId || d.rule_id;
    if (rid === 'X-01') return;
    var note = d.attorneyNote || d.attorney_note || d.title;
    var sev = d.severity || 'medium';
    rows.push({
      section: 'A', related_rule: rid, citation: d.citation || '',
      item: note + ' [' + sev + ']', source: 'finding'
    });
  });

  // B — Client intentions
  qs.filter(function (q) { return q.status === 'answered' && q.answer; }).forEach(function (q) {
    rows.push({
      section: 'B', related_rule: q.rule_id || q.ruleId || '', citation: '',
      item: q.question + ' → Client answered: “' + q.answer + '”. Attorney to implement.', source: 'answer'
    });
  });

  // C — Open items
  qs.filter(function (q) { return q.status !== 'answered'; }).forEach(function (q) {
    rows.push({
      section: 'C', related_rule: q.rule_id || q.ruleId || '', citation: '',
      item: 'OPEN ITEM: ' + (q.default_note || q.defaultNote || 'Client deferred to attorney.'), source: 'default'
    });
  });

  return rows;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    QUESTION_BUDGET: QUESTION_BUDGET,
    harvestPeople_: harvestPeople_,
    buildQuestions_: buildQuestions_,
    buildPlan_: buildPlan_
  };
}
