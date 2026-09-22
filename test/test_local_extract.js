/**
 * Tests for the offline (no-API-key) extraction path.
 * Guards the invariants that make offline findings safe to show a client.
 */
const path = require('path');
const ROOT = path.join(__dirname, '..');
const L = require(path.join(ROOT, 'js/local-extract.js'));
const R = require(path.join(ROOT, 'js/rules.js'));

function assert(cond, msg) {
  if (!cond) { console.error('✗ ' + msg); process.exit(1); }
  console.log('✓ ' + msg);
}

console.log('\n--- Testing local-extract.js (offline mode) ---');

// 1. Binary documents must never be extracted locally: empty facts would make
//    every rule fire as a false critical finding.
assert(L.isLocallyReadable({ content: 'x'.repeat(100) }) === true, 'Plain text document is locally readable');
assert(L.isLocallyReadable({ base64: 'JVBERi0x', content: '' }) === false, 'PDF/base64 document is NOT locally readable');
assert(L.isLocallyReadable({ content: 'too short' }) === false, 'Trivially short content is not treated as a document');
assert(L.isLocallyReadable(null) === false, 'Null document is not readable');

// 2. Bracketed editorial annotations must not be read as document content.
const annotated = '[deliberate gaps: no residuary clause] I, Jane A. Doe, of Concord, New Hampshire, declare this my Last Will and Testament. I appoint my brother, Karl Doe, as Executor.';
const strippedFacts = L.localExtract_(annotated, 'will.txt');
assert(strippedFacts.will.residuary_clause === false,
  'Annotation text "no residuary clause" is NOT counted as a residuary clause');

// 3. Names must be real names, not headings or prose fragments.
assert(L.cleanName_('TRUSTEE') === null, 'ALL-CAPS heading rejected as a name');
assert(L.cleanName_('of this Will') === null, 'Prose fragment rejected as a name');
assert(L.cleanName_('Elena R. Whitfield') === 'Elena R. Whitfield', 'Real name with middle initial accepted');
assert(L.cleanName_('Maya Whitfield.') === 'Maya Whitfield', 'Trailing punctuation stripped from a name');

// 4. Capitalisation must survive: legal text is full of ALL-CAPS clauses.
const caps = 'THE DOE FAMILY REVOCABLE TRUST\nDECLARATION OF TRUST made January 2, 2026, by Jane A. Doe of Concord, New Hampshire.\nJane A. Doe shall serve as Trustee.\nSCHEDULE A — TRUST PROPERTY';
const trust = L.localExtract_(caps, 'trust.txt');
assert(trust.doc_type === 'revocable_trust', 'ALL-CAPS trust instrument classified correctly');
assert(trust.trust.revocable === true, 'ALL-CAPS "REVOCABLE" detected');
assert(trust.trust.trustee === 'Jane A. Doe', 'Trustee extracted from ALL-CAPS document');

// 5. Provenance must be stamped so the brief can disclose how facts were derived.
assert(trust.extraction_source === 'local', 'Extraction stamped as local');
assert(!!trust.extraction_engine, 'Extraction engine version recorded');

// 6. End to end: offline facts must actually drive the NH rule catalog.
const will = L.localExtract_(
  'LAST WILL AND TESTAMENT OF JANE A. DOE\nI, Jane A. Doe, of Concord, New Hampshire, declare this my Last Will and Testament.\n' +
  'I revoke all prior wills.\nI appoint my brother, Karl Doe, as Executor of this Will.\n' +
  'IN WITNESS WHEREOF, I have signed this Will.\nWITNESS:\nThomas Greer\n', 'will.txt');
will._doc = { filename: 'will.txt' };
assert(will.doc_type === 'will', 'Will classified offline');
assert(will.will.executor === 'Karl Doe', 'Executor extracted despite intervening relationship phrase');
assert(will.will.revocation_clause === true, 'Revocation clause detected');
assert(will.will.witness_count === 1, 'Single witness counted correctly');

const defs = R.runRules_([will]);
const ids = defs.map(d => d.rule_id || d.ruleId);
assert(defs.length > 0, 'Offline extraction produces statutory findings (' + defs.length + ')');
assert(ids.indexOf('W-01') !== -1, 'W-01 fires offline for a will with fewer than two witnesses (RSA 551:2)');
assert(ids.indexOf('W-07') !== -1, 'W-07 fires offline for a missing residuary clause (RSA 561)');

// 7. Regression: P-02B must not fire when only the alternate_agent key is set.
const poaFacts = {
  doc_type: 'financial_poa', confidence: 0.9,
  all_children: [], minor_children: [], real_estate_nh: [],
  will: {}, trust: {}, ad: {},
  poa: { agent: 'Karl Doe', alternate_agent: 'Mary Doe', notarized: true, durable: true, statutory_notice: true, hot_powers: [] },
  _doc: { filename: 'poa.txt' }
};
const poaIds = R.runRules_([poaFacts]).map(d => d.rule_id || d.ruleId);
assert(poaIds.indexOf('P-02B') === -1,
  'P-02B does NOT report a missing successor agent when alternate_agent is named');

// 8. Granite must not report false deficiencies against its OWN assembled
//    documents. Statutory forms use label lines ("Primary Health Care Agent: X")
//    and blank execution blocks ("Witness 1 Signature: ____"); a name must never
//    run across a line break and swallow the next line's label.
const A = require(path.join(ROOT, 'js/assembly.js'));
const assembled = A.assembleAllDocuments({
  clientName: 'Jane M. Doe', town: 'Portsmouth', county: 'Rockingham',
  maritalStatus: 'married', spouseName: 'John A. Doe',
  children: [{ name: 'Sam Doe', isMinor: true }],
  executorName: 'John A. Doe', executorSuccessor: 'Ann Roe', guardianName: 'Ann Roe',
  hcAgentName: 'Mary Doe', hcAgentAlternate: 'Bea Fox',
  finAgentName: 'John A. Doe', finAgentAlternate: 'Ann Roe',
  hasRealEstate: true, realEstateAddress: '12 Elm St, Portsmouth, NH',
  includeTODDeed: true, todBeneficiary: 'Sam Doe', residuePlan: 'spouse_then_children'
});
const selfFacts = assembled.map(d => {
  const f = L.localExtract_(d.content, d.filename);
  f._doc = { filename: d.filename };
  return f;
});
const willF = selfFacts.find(f => f.doc_type === 'will');
const adF   = selfFacts.find(f => f.doc_type === 'advance_directive');
const poaF  = selfFacts.find(f => f.doc_type === 'financial_poa');

assert(willF.will.executor === 'John A. Doe', 'Executor read from "appoint X as the Executor"');
assert(willF.will.witness_count >= 2, 'Both witness signature blocks counted (got ' + willF.will.witness_count + ')');
assert(adF.ad.agent === 'Mary Doe', 'Health care agent read from a label line without swallowing the next line');
assert(adF.ad.alternate_agent === 'Bea Fox', 'Alternate health care agent read from its label line');
assert(poaF.poa.agent === 'John A. Doe', 'Financial agent read from "Primary Agent:" label');
assert(poaF.poa.successor_agent === 'Ann Roe', 'Successor financial agent read from its own label line');
assert(willF.will.beneficiaries.some(b => b.name === 'John A. Doe'),
  'Residuary taker captured as a beneficiary (long-form "rest, residue and remainder ... to my spouse, X")');

const selfDefs = R.runRules_(selfFacts);
const criticals = selfDefs.filter(d => d.severity === 'critical');
assert(criticals.length === 0,
  'No CRITICAL findings against Granite\'s own assembled documents (got ' +
  criticals.map(d => (d.rule_id || d.ruleId)).join(', ') + ')');

console.log('All local-extract.js tests passed successfully!');
