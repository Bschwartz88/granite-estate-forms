const assert = require('assert');
const { DB } = require('../js/db.js');

console.log('--- Testing db.js ---');

async function runDbTests() {
  await DB.init();
  await DB.clearAll();

  // Test Engagement
  const eng = {
    id: 'ENG-TEST-101',
    created: new Date().toISOString(),
    status: 'intake',
    goals: 'Create valid NH will and advance directive',
    attest_domicile: true,
    attest_adult: true
  };
  await DB.saveEngagement(eng);
  const activeEng = await DB.getActiveEngagement();
  assert(activeEng, 'Must retrieve active engagement');
  assert.strictEqual(activeEng.id, 'ENG-TEST-101');
  console.log('✓ Engagement saved and retrieved');

  // Test Document
  const doc = {
    id: 'DOC-1',
    engagement_id: eng.id,
    filename: 'Will_Draft.txt',
    doc_type: 'will',
    size_bytes: 1024,
    content: 'Sample text'
  };
  await DB.saveDocument(doc);
  const docs = await DB.listDocuments(eng.id);
  assert.strictEqual(docs.length, 1);
  assert.strictEqual(docs[0].filename, 'Will_Draft.txt');
  console.log('✓ Document saved and listed');

  // Test Deficiencies
  const defs = [
    { rule_id: 'W-01', severity: 'critical', title: 'Fewer than two witnesses', citation: 'RSA 551:2' }
  ];
  await DB.saveDeficiencies(eng.id, defs);
  const loadedDefs = await DB.listDeficiencies(eng.id);
  assert.strictEqual(loadedDefs.length, 1);
  assert.strictEqual(loadedDefs[0].rule_id, 'W-01');
  console.log('✓ Deficiencies saved and listed');

  // Test Questions
  const qs = [
    { id: 'Q1', rule_id: 'W-08', impact: 95, question: 'Who should care for your minor children?', options: ['Brother', 'Sister'] }
  ];
  await DB.saveQuestions(eng.id, qs);
  await DB.updateQuestionAnswer('Q1', 'Brother', 'answered');
  const loadedQs = await DB.listQuestions(eng.id);
  assert.strictEqual(loadedQs[0].answer, 'Brother');
  assert.strictEqual(loadedQs[0].status, 'answered');
  console.log('✓ Question saved, answered, and updated');

  // Test Plan
  const plan = [
    { section: 'A', related_rule: 'W-01', item: 'Witness count' },
    { section: 'B', related_rule: 'W-08', item: 'Brother as guardian' }
  ];
  await DB.savePlan(eng.id, plan);
  const loadedPlan = await DB.listPlan(eng.id);
  assert.strictEqual(loadedPlan.length, 2);
  console.log('✓ Plan saved and listed');

  // Test Audit Trail
  const audit1 = await DB.addAudit('TEST_EVENT_1', 'detail 1');
  const audit2 = await DB.addAudit('TEST_EVENT_2', 'detail 2');
  assert.strictEqual(audit2.prev_hash, audit1.hash, 'Audit hash chain must link consecutive events');
  console.log('✓ Hash-chained audit log validated');

  console.log('All db.js tests passed successfully!\n');
}

runDbTests().catch(err => {
  console.error('DB test failed:', err);
  process.exit(1);
});
