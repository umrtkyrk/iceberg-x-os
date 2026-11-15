const path = require('node:path');

// The frontend package is ESM; load its pure helpers through the CJS test runner.
require('ts-node').register({
  project: path.join(__dirname, '../tsconfig.json'),
  moduleTypes: { '../frontend/src/utils/*.ts': 'cjs' },
});
require('./adminOperations.test.ts');
require('./directory.test.ts');
require('./notificationRead.test.ts');
require('./caseEvaluation.test.ts');
require('./webinar.test.ts');
require('./activity.test.ts');
require('./activityStatus.test.ts');
require('./cubeSignals.test.ts');
require('./mentorCubes.test.ts');
require('./discipline.test.ts');
require('./rubric.test.ts');
require('./scorecard.test.ts');
require('./scoreV2.test.ts');
require('./attachment.test.ts');
