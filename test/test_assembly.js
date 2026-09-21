const assert = require('assert');
const {
  assembleSimpleWill_,
  assembleAdvanceDirective_,
  assembleFinancialPOA_,
  assembleTODDeed_,
  assembleAllDocuments
} = require('../js/assembly.js');

console.log('--- Testing assembly.js ---');

const intake = {
  clientName: 'Jane M. Doe',
  town: 'Concord',
  county: 'Merrimack',
  maritalStatus: 'married',
  spouseName: 'John A. Doe',
  children: [
    { name: 'Billy Doe', isMinor: true },
    { name: 'Sarah Doe', isMinor: false }
  ],
  executorName: 'John A. Doe',
  executorSuccessor: 'Robert Smith',
  guardianName: 'Robert Smith',
  hcAgentName: 'John A. Doe',
  hcAgentPhone: '(603) 555-0100',
  hcAgentAlternate: 'Robert Smith',
  hcAgentAlternatePhone: '(603) 555-0101',
  finAgentName: 'John A. Doe',
  finAgentPhone: '(603) 555-0100',
  finAgentAlternate: 'Robert Smith',
  finAgentAlternatePhone: '(603) 555-0101',
  hasRealEstate: true,
  realEstateAddress: '123 Main St, Concord, NH',
  includeTODDeed: true,
  todBeneficiary: 'John A. Doe',
  residuePlan: 'spouse_then_children'
};

// Will
const will = assembleSimpleWill_(intake);
assert(will.content.includes('Jane M. Doe'), 'Will must include client name');
assert(will.content.includes('RSA 551:10'), 'Will must include RSA 551:10 statutory pretermitted heir clause');
assert(will.content.includes('RSA 551:35'), 'Will must include RSA 551:35 self-proving affidavit');
assert(will.content.includes('Billy Doe (minor)'), 'Will must state minor children');
assert(will.content.includes('Sarah Doe (adult)'), 'Will must state adult children');
console.log('✓ Simple Will assembled with statutory heir protections');

// Advance Directive
const ad = assembleAdvanceDirective_(intake);
assert(ad.content.includes('RSA 137-J:39'), 'Advance Directive must cite RSA 137-J:39');
assert(ad.content.includes('John A. Doe'), 'Must appoint HC agent');
assert(ad.content.includes('Robert Smith'), 'Must appoint alternate HC agent');
console.log('✓ Advance Directive assembled per RSA 137-J:39');

// Financial POA
const poa = assembleFinancialPOA_(intake);
assert(poa.content.includes('RSA 564-E:301'), 'Financial POA must cite RSA 564-E:301');
assert(poa.content.includes('RSA 564-E:105'), 'Financial POA must include RSA 564-E:105 notary acknowledgment');
assert(/durab/i.test(poa.content), 'Financial POA must include durability clause');
console.log('✓ Financial POA assembled per RSA 564-E:301');

// TOD Deed
const deed = assembleTODDeed_(intake);
assert(deed.content.includes('RSA 563-D:19'), 'TOD Deed must cite RSA 563-D:19');
assert(deed.content.includes('60 days'), 'TOD Deed must include mandatory 60-day recording warning');
console.log('✓ TOD Deed assembled per RSA 563-D:19');

// All documents
const docs = assembleAllDocuments(intake);
assert.strictEqual(docs.length, 4, 'Must assemble 4 documents when real estate TOD deed is requested');
console.log('✓ assembleAllDocuments successfully generated all 4 documents');

console.log('All assembly.js tests passed successfully!\n');
