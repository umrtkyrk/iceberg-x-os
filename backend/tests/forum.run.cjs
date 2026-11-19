process.env.JWT_SECRET = 'forum-tests-only-not-a-real-secret';
process.env.FORUM_ENABLED = 'true';
process.env.NODE_ENV = 'test';
process.env.FORUM_CHAT_KEY ||= Buffer.alloc(32, 9).toString('base64');
require('ts-node').register({ project: require('node:path').join(__dirname, '../tsconfig.json') });
require('./forum.test.ts');

require('./forumPortal.test.ts');

require('./forumChatMigration.test.cjs');
