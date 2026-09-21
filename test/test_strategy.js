const assert = require('assert');
const { harvestPeople_, buildQuestions_, buildPlan_ } = require('../js/strategy.js');

console.log('--- Testing strategy.js ---');

const facts = [
  {
    doc_type: 'will',
    person_primary: 'Brian Schwartz',
    spouse: 'Sarah Schwartz',
    all_children: ['Emma Schwartz', 'Lucas Schwartz'],
    minor_children: ['Emma Schwartz'],
    will: {
      executor: 'Sarah Schwartz',
      successor_executor: 'David Schwartz',
      guardian_name: 'David Schwartz',
      beneficiaries: [{ name: 'Sarah Schwartz' }]
    },
    poa: {
      agent: 'Sarah Schwartz',
      successor_agent: 'David Schwartz'
    }
  }
];

const ppl = harvestPeople_(facts);
assert.strictEqual(ppl.primary, 'Brian Schwartz', 'Primary person must be extracted');
assert(ppl.minors.includes('Emma Schwartz'), 'Minor child must be in minors list');
assert(ppl.adults.includes('Sarah Schwartz'), 'Spouse must be in adults list');
assert(ppl.adults.includes('David Schwartz'), 'Successor executor must be in adults list');
assert(ppl.adults.includes('Lucas Schwartz'), 'Adult child must be in adults list');
console.log('✓ Person harvester correctly categorizes adults, minors, and primary');

// Test Questions for W-10
const defs = [
  { rule_id: 'W-10', severity: 'critical', title: 'Child omitted from will' },
  { rule_id: 'N-03', severity: 'informational', title: 'Streamlined real estate probate bypass via TOD Deed' }
];

const qs = buildQuestions_(defs, facts);
assert(qs.length >= 1, 'Must build at least 1 question');
assert(qs.length <= 7, 'Must not exceed 7 question budget');
const q10 = qs.find(q => q.rule_id === 'W-10');
assert(q10, 'Question for W-10 must be built');
assert(q10.question.includes('Lucas Schwartz'), 'Question must mention omitted child');
console.log('✓ Question engine built impact-scored questions');

// Test Plan Builder
qs[0].status = 'answered';
qs[0].answer = 'Include and name them as a beneficiary';
const plan = buildPlan_({ id: 'ENG-TEST' }, defs, qs, 'Sample AI summary');
assert(plan.length >= 2, 'Plan must contain findings and answered questions');
assert(plan.find(p => p.section === 'S'), 'Plan must contain AI summary');
assert(plan.find(p => p.section === 'B'), 'Plan must contain client intention');
console.log('✓ Remediation plan builder correctly assembled plan items');

console.log('All strategy.js tests passed successfully!\n');
