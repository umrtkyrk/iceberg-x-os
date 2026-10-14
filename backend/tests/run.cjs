const path = require('node:path');

// The frontend package is ESM; load its pure helpers through the CJS test runner.
require('ts-node').register({
  project: path.join(__dirname, '../tsconfig.json'),
  moduleTypes: { '../frontend/src/utils/*.ts': 'cjs' },
});
require('./adminOperations.test.ts');
require('./directory.test.ts');
require('./notificationRead.test.ts');
