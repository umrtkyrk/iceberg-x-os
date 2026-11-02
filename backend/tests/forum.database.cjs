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
  process.env.DIRECT_URL = url.toString();
  const run = args => {
    const result = spawnSync(process.execPath, [require.resolve('prisma/build/index.js'), ...args], { encoding: 'utf8', env: process.env });
    if (result.status !== 0) throw new Error(`Prisma ${args[0]} failed: ${result.stderr.replace(/postgres(?:ql)?:\/\/\S+/g, '[redacted]')}`);
    return result.stdout;
  };
  let db;
  let createdSchema = false;
  try {
    await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    createdSchema = true;
    const current = fs.readFileSync(path.join(__dirname, '../prisma/schema.prisma'), 'utf8');
    const baseline = current.split('model ForumCategory')[0].replace(/^  forum_\w+ .+\r?\n/gm, '');
    const baselineFile = path.join(temp, 'baseline.prisma');
    fs.writeFileSync(baselineFile, baseline);
    const baselineSQL = run(['migrate', 'diff', '--from-empty', '--to-schema-datamodel', baselineFile, '--script']);
    const baselineSQLFile = path.join(temp, 'baseline.sql');
    fs.writeFileSync(baselineSQLFile, baselineSQL);
    run(['db', 'execute', '--file', baselineSQLFile, '--schema', baselineFile]);
    run(['db', 'execute', '--file', path.join(__dirname, '../prisma/migrations/20261028120000_add_forum/migration.sql'), '--schema', baselineFile]);
    run(['db', 'execute', '--file', path.join(__dirname, '../prisma/migrations/20261029120000_english_forum_categories/migration.sql'), '--schema', baselineFile]);
    run(['db', 'execute', '--file', path.join(__dirname, '../prisma/migrations/20261029120000_forum_portal_integration/migration.sql'), '--schema', baselineFile]);
    db = require('../dist/services/prisma').default;
    const forum = require('../dist/services/forum.service');
    const staff = { id: randomUUID(), role: 'MENTOR' }, cube = { id: randomUUID(), role: 'CUBE' }, other = { id: randomUUID(), role: 'CUBE' };
    for (const user of [staff, cube, other]) await db.user.create({ data: { ...user, name: 'Integration test', email: `${user.id}@example.invalid`, password_hash: 'unusable-test-only' } });
    assert.equal(await db.user.count(), 3);
    for (const [index, user] of [cube, other].entries()) await db.cubeProfile.create({ data: { user_id: user.id, cube_number: String(101 + index), cohort: 'QA', university: 'QA', department: 'QA' } });
    const cubeProfile = await db.cubeProfile.findUnique({ where: { user_id: cube.id } });
    const otherProfile = await db.cubeProfile.findUnique({ where: { user_id: other.id } });
    const identity = require('../dist/services/forumIdentity.service');
    const categories = require('../dist/services/forumCategory.service');
    const portalContext = require('../dist/services/forumContext.service');
    const badges = [];
    for (let i = 0; i < 4; i++) { const badge = await db.badge.create({ data: { name: 'Badge ' + i, description: 'QA', icon: 'Award' } }); badges.push(badge); await db.cubeBadge.create({ data: { cube_id: i === 3 ? otherProfile.id : cubeProfile.id, badge_id: badge.id, awarded_by_id: staff.id, reason: 'QA' } }); }
    await identity.saveForumProfile(cube, { signature: 'Stored signature', badge_ids: [badges[1].id, badges[0].id] });
    await assert.rejects(identity.saveForumProfile(cube, { signature: '', badge_ids: badges.map(b => b.id) }), e => e.status === 400);
    await assert.rejects(identity.saveForumProfile(cube, { signature: '', badge_ids: [badges[3].id] }), e => e.status === 400);
    await assert.rejects(identity.saveForumProfile(cube, { signature: '', badge_ids: [badges[0].id, badges[0].id] }), e => e.status === 400);
    assert.deepEqual((await identity.forumViewer(cube)).badge_ids, [badges[1].id, badges[0].id]);
    const quest = await db.quest.create({ data: { title: 'QA quest', description: 'QA', criteria_type: 'custom', criteria_value: 3 } });
    await db.cubeQuest.create({ data: { cube_id: cubeProfile.id, quest_id: quest.id } });
    assert.equal((await portalContext.forumContext(cube)).quests.length, 1);
    const mission = await db.mission.create({ data: { title: 'QA mission', description: 'QA', context: 'QA', problem_statement: 'QA', expected_output: 'QA', difficulty_level: 'Level_4_Integration_Candidate', created_by_id: staff.id } });
    await db.missionContributor.create({ data: { mission_id: mission.id, cube_id: cubeProfile.id } });
    assert.equal((await portalContext.forumContext(cube)).missions[0].id, mission.id);
    await assert.rejects(forum.createForumTopic(other, { category_id: 'help', title: 'A mission I cannot attach', body: 'A sufficiently long test body.', mission_id: mission.id }), e => e.status === 403);
    await assert.rejects(forum.createForumTopic(other, { category_id: 'help', title: 'A quest I do not have', body: 'A sufficiently long test body.', quest_id: quest.id }), e => e.status === 403);
    await assert.rejects(categories.manageForumCategory(staff, undefined, {}), e => e.status === 403);
    await categories.manageForumCategory({ ...staff, role: 'ADMIN' }, undefined, { id: 'qa-category', name: 'QA category', description: 'Temporary category', position: 20, staff_only: false });
    await categories.manageForumCategory({ ...staff, role: 'ADMIN' }, 'qa-category', {}, true);
    assert.equal((await forum.forumCategories()).length, 7);
    await assert.rejects(forum.createForumTopic(cube, { category_id: 'announcements', title: 'Test title', body: 'A sufficiently long test body.' }), e => e.status === 403);
    const topic = await forum.createForumTopic(cube, { category_id: 'help', title: 'A real persistence test', body: 'A sufficiently long original post.', quest_id: quest.id, mission_id: mission.id });
    const projected = (await forum.readForumTopic(staff, topic.id, 1)).topic;
    assert.equal(projected.context.quest.id, quest.id);
    assert.equal(projected.context.mission.id, mission.id);
    assert.equal(projected.edited, false);
    assert.equal(projected.author.signature, 'Stored signature');
    assert.deepEqual(projected.author.badges.map(b => b.id), [badges[1].id, badges[0].id]);
    assert.equal((await db.cubeQuest.findFirst({ where: { cube_id: cubeProfile.id, quest_id: quest.id } })).current_value, 0);
    await forum.setForumState(staff, topic.id, { following: true, saved: true });
    const reply = await forum.createForumReply(other, topic.id, { body: 'A helpful reply.' });
    assert.equal(await db.notification.count({ where: { user_id: staff.id } }), 1);
    assert.equal((await forum.readForumTopic(staff, topic.id, 1)).replies.length, 1);
    const beforeMention = await db.notification.count();
    const mentioned = await forum.createForumReply(other, topic.id, { body: '@cube-101 and @user-' + staff.id + ' thanks!' });
    assert.equal(await db.notification.count(), beforeMention + 2); // owner/follower/mention deduplicate
    assert.equal(await db.forumNotificationTarget.count({ where: { reply_id: mentioned.id } }), 2);
    await forum.changeForumReply(other, topic.id, mentioned.id, {}, true);
    for (let i = 0; i < 21; i++) await db.forumReply.create({ data: { topic_id: topic.id, author_id: other.id, body: 'Page test ' + i, created_at: new Date(Date.now() + 1000 + i) } });
    const lastReply = await db.forumReply.findFirst({ where: { topic_id: topic.id }, orderBy: { created_at: 'desc' } });
    assert.equal((await forum.readForumTopic(staff, topic.id, 1, lastReply.id)).page, 2);
    await db.forumReply.deleteMany({ where: { topic_id: topic.id, body: { startsWith: 'Page test ' } } });
    await forum.moderateForumTopic(staff, topic.id, { pinned: false, locked: false, category_id: 'ideas' });
    assert.equal((await forum.readForumTopic(cube, topic.id, 1)).topic.category_id, 'ideas');
    // A fresh connection sees the same content: this is not browser-local state.
    const second = new PrismaClient();
    try { assert.equal((await second.forumTopic.findUnique({ where: { id: topic.id } })).body, 'A sufficiently long original post.'); }
    finally { await second.$disconnect(); }
    await assert.rejects(forum.changeForumReply(cube, topic.id, reply.id, { body: 'Overwrite' }), e => e.status === 403);
    assert.equal((await forum.readForumTopic(cube, topic.id, 1)).topic.edited, false);
    await forum.changeForumTopic(cube, topic.id, { title: 'A real persistence test', body: 'A sufficiently long original post.' });
    assert.equal((await forum.readForumTopic(cube, topic.id, 1)).topic.edited, true);
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
    const unanswered = await forum.createForumTopic(cube, { category_id: 'showcase', title: 'An unanswered project log', body: 'A sufficiently long original post.' });
    const locked = await forum.createForumTopic(staff, { category_id: 'help', title: 'A locked unanswered topic', body: 'A sufficiently long original post.' });
    await forum.moderateForumTopic(staff, locked.id, { pinned: false, locked: true });
    const stats = await forum.forumStats();
    assert.equal(stats.topics, 2); assert.equal(stats.replies, 0);
    assert.deepEqual(stats.unanswered.map(t => t.id), [unanswered.id]);
    assert.deepEqual((await forum.listForumTopics(cube, { view: 'unanswered', page: 1 })).topics.map(t => t.id), [unanswered.id]);
    assert.equal((await forum.listForumTopics(cube, { view: 'unanswered', category: 'help', page: 1 })).total, 0);
    assert.equal(stats.contributors.find(c => c.author.id === cube.id).author.stage, 'cube');
    assert.doesNotMatch(JSON.stringify(stats), /forum_profile|cube_profile|password_hash|nda_status|@example/);
    const report2 = await forum.reportForumPost(staff, unanswered.id, { reason: 'Another report for projection validation.' });
    const reportProjection = (await forum.listForumReports(staff, 1)).reports.find(r => r.id === report2.id);
    assert.equal(reportProjection.reporter.stage, 'mentor');
    assert.doesNotMatch(JSON.stringify(reportProjection.reporter), /forum_profile|cube_profile|password_hash|nda_status|@example/);
    await forum.changeForumTopic(staff, unanswered.id, {}, true);
    assert.equal((await forum.forumStats()).unanswered.length, 0);
    // Forum history must not break the portal's existing account-deletion flow.
    await db.user.delete({ where: { id: other.id } });
    assert.equal((await db.forumReply.findUnique({ where: { id: reply.id } })).author_id, null);
    console.log('PASS: profile persistence, badge ownership, quest validation, no reward side effects, deduplicated mentions, reply targets, categories, topic movement, stats privacy and unanswered consistency; additive SQL migrations, permissions, reports, soft deletion and account deletion.');
  } finally {
    if (db) await db.$disconnect();
    if (createdSchema) await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await admin.$disconnect();
    // Only the known files created above are removed; no recursive directory deletion.
    for (const name of ['baseline.prisma', 'baseline.sql']) { const file = path.join(temp, name); if (fs.existsSync(file)) fs.unlinkSync(file); }
    fs.rmdirSync(temp);
  }
}
main().catch(error => { console.error(error.message.replace(/postgres(?:ql)?:\/\/\S+/g, '[redacted]')); process.exitCode = 1; });
