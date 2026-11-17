const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

// Execute the real backfill script with changes committed after each snapshot read.
async function backfill(concurrent) {
  let done;
  const finished = new Promise(resolve => { done = resolve; });
  const rows = { room: { id: 'r', name: 'Room', description: null, github_repo: null },
    message: { id: 'm', room_id: 'r', body: 'Old message' }, task: { id: 't', room_id: 'r', title: 'Old task' },
    link: { id: 'l', room_id: 'r', title: 'Old title', url: 'Old URL' },
    file: { id: 'f', room_id: 'r', original_name: 'old.txt', storage_key: 'invalid-key-no-file-io' } };
  const db = { $disconnect: async () => { done(); } };
  for (const [model, key] of [['forumChatRoom', 'room'], ['forumChatMessage', 'message'], ['forumChatTask', 'task'], ['forumChatLink', 'link'], ['forumChatAttachment', 'file']]) {
    db[model] = {
      findMany: async () => {
        const snapshot = { ...rows[key] };
        if (concurrent) for (const field of Object.keys(rows[key])) if (!['id', 'room_id', 'storage_key'].includes(field) && rows[key][field]) rows[key][field] = key === 'message' && concurrent !== 'edit' ? '' : 'enc:new';
        return [snapshot];
      },
      update: async ({ data }) => { Object.assign(rows[key], data); },
      updateMany: async ({ where, data }) => {
        if (!Object.entries(where).every(([field, value]) => rows[key][field] === value)) return { count: 0 };
        Object.assign(rows[key], data); return { count: 1 };
      },
    };
  }
  const source = fs.readFileSync(path.join(__dirname, '../scripts/forum-encrypt-chat.cjs'), 'utf8');
  let failure;
  vm.runInNewContext(source, { __dirname: path.join(__dirname, '../scripts'), console: { log() {}, error(error) { failure = error; } },
    process: { exit() { done(); } }, require: name => name === 'dotenv' ? { config() {} } : name === 'ts-node' ? { register() {} }
      : name === '@prisma/client' ? { PrismaClient: class { constructor() { return db; } } }
        : name.includes('forumChatCrypto.service') ? { forumChatKeyProblem: () => null, isSealedText: value => value.startsWith('enc:'), sealText: (_id, value) => 'enc:' + value }
          : name === '../src/config/env' ? { STORAGE_PATH: '.' } : require(name) });
  await finished; assert.equal(failure, undefined); return rows;
}
test('encryption backfill preserves concurrent field edits and message deletion', async () => {
  const rows = await backfill(true);
  assert.equal(rows.message.body, '');
  assert.equal(rows.room.name, 'enc:new'); assert.equal(rows.task.title, 'enc:new');
  assert.equal(rows.link.title, 'enc:new'); assert.equal(rows.link.url, 'enc:new'); assert.equal(rows.file.original_name, 'enc:new');
});
test('encryption backfill still converts unchanged legacy values', async () => {
  const rows = await backfill(false);
  assert.equal(rows.message.body, 'enc:Old message'); assert.equal(rows.room.name, 'enc:Room');
  assert.equal(rows.task.title, 'enc:Old task'); assert.equal(rows.link.url, 'enc:Old URL'); assert.equal(rows.file.original_name, 'enc:old.txt');
});

test('encryption backfill preserves a concurrently edited message body', async () => { const rows = await backfill('edit'); assert.equal(rows.message.body, 'enc:new'); });
