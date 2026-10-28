// Isolated PostgreSQL integration test. Never changes the application's public schema.
require('dotenv').config();
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');

async function main() {
  const url = new URL(process.env.DATABASE_URL || '');
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error('Integration tests require localhost.');
  const schema = `forum_test_${randomUUID().replaceAll('-', '')}`;
  if (!/^forum_test_[a-f0-9]{32}$/.test(schema)) throw new Error('Invalid test schema');
  const admin = new PrismaClient();
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'iceberg-forum-test-'));
  url.searchParams.set('schema', schema);
  process.env.DATABASE_URL = url.toString();
  const run = args => {
    const result = spawnSync(process.execPath, [require.resolve('prisma/build/index.js'), ...args], { encoding: 'utf8', env: process.env });
    if (result.status !== 0) throw new Error(`Prisma ${args[0]} failed: ${result.stderr.replace(/postgres(?:ql)?:\/\/\S+/g, '[redacted]')}`);
    return result.stdout;
  };
  let db;
  try {
    await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    const current = fs.readFileSync(path.join(__dirname, '../prisma/schema.prisma'), 'utf8');
    const baseline = current.split('model ForumCategory')[0].replace(/^  forum_(topics|replies|states|reports) .+\r?\n/gm, '');
    const baselineFile = path.join(temp, 'baseline.prisma');
    fs.writeFileSync(baselineFile, baseline);
    const baselineSQL = run(['migrate', 'diff', '--from-empty', '--to-schema-datamodel', baselineFile, '--script']);
    const baselineSQLFile = path.join(temp, 'baseline.sql');
    fs.writeFileSync(baselineSQLFile, baselineSQL);
    run(['db', 'execute', '--file', baselineSQLFile, '--schema', baselineFile]);
    run(['db', 'execute', '--file', path.join(__dirname, '../prisma/migrations/20261028120000_add_forum/migration.sql'), '--schema', baselineFile]);
    db = require('../dist/services/prisma').default;
    const forum = require('../dist/services/forum.service');
    const staff = { id: randomUUID(), role: 'MENTOR' }, cube = { id: randomUUID(), role: 'CUBE' }, other = { id: randomUUID(), role: 'CUBE' };
    for (const user of [staff, cube, other]) await db.user.create({ data: { ...user, name: 'Integration test', email: `${user.id}@example.invalid`, password_hash: 'unusable-test-only' } });
    assert.equal(await db.user.count(), 3);
    assert.equal((await forum.forumCategories()).length, 6);
    await assert.rejects(forum.createForumTopic(cube, { category_id: 'announcements', title: 'Test title', body: 'A sufficiently long test body.' }), e => e.status === 403);
    const topic = await forum.createForumTopic(cube, { category_id: 'help', title: 'A real persistence test', body: 'A sufficiently long original post.' });
    await forum.setForumState(staff, topic.id, { following: true, saved: true });
    const reply = await forum.createForumReply(other, topic.id, { body: 'A helpful reply.' });
    assert.equal(await db.notification.count({ where: { user_id: staff.id } }), 1);
    assert.equal((await forum.readForumTopic(staff, topic.id, 1)).replies.length, 1);
    // A fresh connection sees the same content: this is not browser-local state.
    const second = new PrismaClient();
    try { assert.equal((await second.forumTopic.findUnique({ where: { id: topic.id } })).body, 'A sufficiently long original post.'); }
    finally { await second.$disconnect(); }
    await assert.rejects(forum.changeForumReply(cube, topic.id, reply.id, { body: 'Overwrite' }), e => e.status === 403);
    await forum.moderateForumTopic(staff, topic.id, { pinned: true, locked: true });
    await assert.rejects(forum.createForumReply(other, topic.id, { body: 'Blocked reply' }), e => e.status === 403);
    const report = await forum.reportForumPost(cube, topic.id, { reply_id: reply.id, reason: 'Please review this reply.' });
    assert.equal((await forum.listForumReports(staff, 1)).total, 1);
    await forum.resolveForumReport(staff, report.id);
    await forum.changeForumReply(staff, topic.id, reply.id, {}, true);
    assert.equal((await forum.readForumTopic(cube, topic.id, 1)).total, 0);
    assert.ok((await db.forumReply.findUnique({ where: { id: reply.id } })).deleted_at);
    await forum.changeForumTopic(staff, topic.id, {}, true);
    assert.equal((await forum.listForumTopics(staff, { view: 'saved', page: 1 })).total, 0);
    await assert.rejects(forum.readForumTopic(staff, topic.id, 1), e => e.status === 404);
    // Forum history must not break the portal's existing account-deletion flow.
    await db.user.delete({ where: { id: other.id } });
    assert.equal((await db.forumReply.findUnique({ where: { id: reply.id } })).author_id, null);
    console.log('PASS: additive SQL migration, categories, persistence, permissions, notifications, reports, soft deletion and account deletion.');
  } finally {
    if (db) await db.$disconnect();
    await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await admin.$disconnect();
    // Only the known files created above are removed; no recursive directory deletion.
    for (const name of ['baseline.prisma', 'baseline.sql']) { const file = path.join(temp, name); if (fs.existsSync(file)) fs.unlinkSync(file); }
    fs.rmdirSync(temp);
  }
}
main().catch(error => { console.error(error.message.replace(/postgres(?:ql)?:\/\/\S+/g, '[redacted]')); process.exitCode = 1; });
