const assert = require('assert');
const { STATUTE_PACK, RULES, runRules_ } = require('../js/rules.js');

console.log('--- Testing rules.js ---');
assert.strictEqual(STATUTE_PACK.version, '2026.09-M5', 'Statute pack version must be 2026.09-M5');
assert(RULES.length >= 22, 'Must have at least 22 rules');

// Test Case 1: Pretermitted Child (W-10)
const omittedChildFact = {
  doc_type: 'will',
  all_children: ['Child One', 'Child Two'],
  minor_children: [],
  will: {
    testator_signed: true,
    witness_count: 2,
    self_proving_affidavit: true,
    revocation_clause: true,
    executor: 'Executor Name',
    residuary_clause: true,
    beneficiaries: [{ name: 'Child One', relationship: 'child', property: 'all' }] // Child Two is omitted
  }
};
const defs1 = runRules_([omittedChildFact]);
const w10 = defs1.find(d => d.rule_id === 'W-10');
assert(w10, 'Rule W-10 must trigger when a child is omitted');
assert.strictEqual(w10.severity, 'critical');
console.log('✓ W-10 (Pretermitted heir) rule validated');

// Test Case 2: Financial POA defects (P-01, P-02, P-02B, P-03, P-04)
const poaFact = {
  doc_type: 'financial_poa',
  poa: {
    agent: 'John Agent',
    successor_agent: null, // P-02B
    notarized: false,      // P-01
    durable: false,        // P-03
    hot_powers: []         // P-04
  }
};
const defs2 = runRules_([poaFact]);
assert(defs2.find(d => d.rule_id === 'P-01'), 'P-01 must trigger for unnotarized POA');
assert(defs2.find(d => d.rule_id === 'P-02B'), 'P-02B must trigger for missing successor agent');
assert(defs2.find(d => d.rule_id === 'P-03'), 'P-03 must trigger for missing durability clause');
assert(defs2.find(d => d.rule_id === 'P-04'), 'P-04 must trigger for missing hot powers');
console.log('✓ P-01, P-02B, P-03, P-04 (RSA 564-E POA) rules validated');

// Test Case 3: Real Estate TOD Deed (N-03)
const reFact = {
  doc_type: 'will',
  real_estate_nh: [{ address: '123 Main St, Concord NH', tod_deed_recorded: false, titled_in_trust: false }],
  will: { testator_signed: true, witness_count: 2, self_proving_affidavit: true, revocation_clause: true, executor: 'E', residuary_clause: true, beneficiaries: [] }
};
const defs3 = runRules_([reFact]);
assert(defs3.find(d => d.rule_id === 'N-03'), 'N-03 must trigger for individually titled NH real estate');
console.log('✓ N-03 (RSA 563-D TOD Deed) rule validated');

console.log('All rules.js tests passed successfully!\n');
