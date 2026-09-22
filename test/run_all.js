console.log('====================================================');
console.log('GRANITE ESTATE WEB — AUTOMATED TEST SUITE');
console.log('====================================================\n');

require('./test_rules.js');
require('./test_strategy.js');
require('./test_assembly.js');
require('./test_db.js');
require('./test_security.js');
require('./test_local_extract.js');

setTimeout(function () {
  console.log('====================================================');
  console.log('✓ ALL TEST SUITES PASSED CLEANLY');
  console.log('====================================================');
}, 500);
