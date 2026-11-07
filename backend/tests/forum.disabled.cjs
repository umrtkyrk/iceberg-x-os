// Run in a fresh process: the feature flag is deliberately read at module load.
process.env.JWT_SECRET = 'forum-flag-test-only';
process.env.FORUM_ENABLED = 'false';
process.env.NODE_ENV = 'test';
require('ts-node').register({ project: require('node:path').join(__dirname, '../tsconfig.json') });
const assert = require('node:assert/strict');
const express = require('express');
const router = require('../src/routes/forum.routes').default;
const app = express(); app.use('/api', router);
const server = app.listen(0, '127.0.0.1', async () => {
  try {
    const base = `http://127.0.0.1:${server.address().port}/api/forum`;
    for (const path of ['/stats', '/categories', '/topics', '/me/profile', '/context', '/mentions', '/reports']) {
      assert.equal((await fetch(base + path)).status, 404);
    }
    console.log('PASS: feature flag off hides all forum reads without accessing a database.');
  } catch (error) { console.error(error); process.exitCode = 1; }
  finally { server.closeAllConnections(); server.close(); }
});
