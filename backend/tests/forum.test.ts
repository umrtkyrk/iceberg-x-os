import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../src/services/prisma';
import router from '../src/routes/forum.routes';
import { assertForumAuthor, assertForumCategory, forumPage, forumText } from '../src/services/forumPolicy';
import { changeForumReply, changeForumTopic, createForumReply, reportForumPost, listForumTopics, moderateForumTopic, readForumTopic } from '../src/services/forum.service';
import { HttpError } from '../src/utils/http';

// Forum write unit tests isolate the post-commit quest refresh from a real database.
const missionRoomFindMany = prisma.forumChatRoom.findMany;
const cubeQuestFindMany = prisma.cubeQuest.findMany;
test.before(() => { prisma.forumChatRoom.findMany = (async () => []) as any; prisma.cubeQuest.findMany = (async () => []) as any; });
test.after(() => { prisma.forumChatRoom.findMany = missionRoomFindMany; prisma.cubeQuest.findMany = cubeQuestFindMany; });

const cube = { id: 'cube-a', role: 'CUBE' as const };
const staff = { id: 'mentor-a', role: 'MENTOR' as const };
const isStatus = (status: number) => (error: unknown) => error instanceof HttpError && error.status === status;

test('forum validation rejects objects, blank/oversized posts and unbounded pagination', () => {
  for (const value of [null, {}, [], '', ' '.repeat(20), 'x'.repeat(10001)]) assert.throws(() => forumText(value, 'Mesaj', 15, 10000), isStatus(400));
  assert.equal(forumText('  normal message  ', 'Mesaj', 1, 100), 'normal message');
  for (const value of ['0', '-1', '1.2', '1e2', '100000', [], {}]) assert.throws(() => forumPage(value), isStatus(400));
  assert.equal(forumPage(undefined), 1);
});

test('announcements require staff; even staff cannot rewrite someone else’s words', () => {
  assert.throws(() => assertForumCategory(cube, true), isStatus(403));
  assert.doesNotThrow(() => assertForumCategory(staff, true));
  assert.throws(() => assertForumAuthor(staff, cube.id), isStatus(403));
});

test('topic mutations reject foreign ownership and soft-delete with an audit actor and auto-resolve open reports', async () => {
  const original = prisma.$transaction;
  let update: any, reportUpdate: any;
  const tx = {
    $queryRaw: async () => [],
    forumTopic: {
      findFirst: async () => ({ id: 'topic', author_id: cube.id, locked: false }),
      update: async (args: any) => { update = args; return args.data; },
    },
    forumReport: {
      updateMany: async (args: any) => { reportUpdate = args; return { count: 1 }; },
    },
  };
  prisma.$transaction = (async (fn: any) => fn(tx)) as typeof original;
  try {
    await assert.rejects(changeForumTopic(staff, 'topic', { title: 'Valid title', body: 'A sufficiently long body' }), isStatus(403));
    assert.equal(update === undefined, true);
    await changeForumTopic(staff, 'topic', {}, true);
    assert.ok(update.data.deleted_at instanceof Date);
    assert.equal(update.data.deleted_by_id, staff.id);
    assert.equal(reportUpdate.where.topic_id, 'topic');
    assert.equal(reportUpdate.where.resolved_at, null);
    assert.ok(reportUpdate.data.resolved_at instanceof Date);
    assert.equal(reportUpdate.data.resolved_by_id, staff.id);
  } finally { prisma.$transaction = original; }
});

test('soft-deleting a reply auto-resolves open reports and recomputes topic last_activity_at', async () => {
  const original = prisma.$transaction;
  const topicCreated = new Date('2026-11-01T10:00:00Z');
  const prevReplyCreated = new Date('2026-11-02T12:00:00Z');
  let topicUpdate: any, reportUpdate: any, notificationDelete: any;
  const tx = {
    $queryRaw: async () => [],
    notification: { deleteMany: async (args: any) => { notificationDelete = args; return { count: 1 }; } },
    forumReply: {
      findFirst: async (args: any) => args.where.id
        ? ({ id: 'reply-2', author_id: cube.id })
        : ({ created_at: prevReplyCreated }),
      update: async (args: any) => args.data,
    },
    forumReport: {
      updateMany: async (args: any) => { reportUpdate = args; return { count: 1 }; },
    },
    forumTopic: {
      findFirst: async () => ({ id: 'topic', locked: false, accepted_reply_id: 'reply-2', created_at: topicCreated }),
      update: async (args: any) => { topicUpdate = args; return args.data; },
    },
  };
  prisma.$transaction = (async (fn: any) => fn(tx)) as typeof original;
  try {
    await changeForumReply(cube, 'topic', 'reply-2', {}, true);
    assert.equal(reportUpdate.where.reply_id, 'reply-2');
    assert.ok(reportUpdate.data.resolved_at instanceof Date);
    assert.equal(reportUpdate.data.resolved_by_id, cube.id);
    assert.equal(topicUpdate.data.accepted_reply_id, null);
    assert.equal(topicUpdate.data.last_activity_at, prevReplyCreated);
    assert.deepEqual(notificationDelete.where, { forum_target: { is: { reply_id: 'reply-2' } } });
  } finally { prisma.$transaction = original; }
});

test('locked and deleted topics reject replies before any insert or notification', async () => {
  const original = prisma.$transaction;
  let row: any = { locked: true }, writes = 0;
  const tx = { $queryRaw: async () => [], forumTopic: { findFirst: async () => row }, forumReply: { create: async () => { writes++; } } };
  prisma.$transaction = (async (fn: any) => fn(tx)) as typeof original;
  try {
    await assert.rejects(createForumReply(cube, 'topic', { body: 'Hello' }), isStatus(403));
    row = null;
    await assert.rejects(createForumReply(cube, 'topic', { body: 'Hello' }), isStatus(404));
    assert.equal(writes, 0);
  } finally { prisma.$transaction = original; }
});

test('reply and activity update share a transaction; notifications exclude self and exited Cubes', async () => {
  const original = prisma.$transaction;
  let recipientQuery: any, notification: any, activity: any, stateUpsert: any;
  const created = new Date();
  const tx = { $queryRaw: async () => [], forumTopic: { findFirst: async () => ({ title: 'Topic', locked: false }), findUnique: async () => ({ visibility: 'PUBLIC', audience_room_id: null }), update: async (args: any) => { activity = args; } },
    forumReply: { create: async () => ({ id: 'reply', created_at: created }) },
    forumTopicState: { findMany: async () => [{ user_id: 'other' }], upsert: async (args: any) => { stateUpsert = args; return {}; } },
    user: { findMany: async (args: any) => { recipientQuery = args; return [{ id: 'other' }]; }, findUnique: async () => ({ name: 'Yunus Altanay' }) },
    notification: { create: async (args: any) => { notification = args; } } };
  prisma.$transaction = (async (fn: any) => fn(tx)) as typeof original;
  try {
    await createForumReply(cube, 'topic', { body: 'Helpful reply' });
    assert.equal(notification.data.message, 'Yunus Altanay commented on “Topic”: “Helpful reply”');
    assert.equal(activity.data.last_activity_at, created);
    assert.equal(stateUpsert.update.read_at, created);
    assert.equal(stateUpsert.create.read_at, created);
    assert.deepEqual(recipientQuery.where.AND[1], {}); // a public post may reach anyone
    assert.equal(recipientQuery.where.AND[2].id.not, cube.id);
    assert.deepEqual(recipientQuery.where.AND[0].OR[1].cube_profile.is.current_level.notIn, ['Alumni', 'Former_Cube']);
    assert.equal(notification.data.user_id, 'other');
    assert.equal(notification.data.forum_target.create.reply_id, 'reply');
  } finally { prisma.$transaction = original; }
});

test('a reply to a reply joins the top-level thread and tells the person replied to what was said', async () => {
  const original = prisma.$transaction;
  let createdReply: any;
  const notifications: any[] = [];
  const created = new Date();
  const tx = { $queryRaw: async () => [], forumTopic: { findFirst: async () => ({ id: 'topic', title: 'Topic', locked: false, author_id: null }), findUnique: async () => ({ visibility: 'PUBLIC', audience_room_id: null }), update: async () => ({}) },
    forumReply: { findFirst: async (args: any) => args.where.id === 'child' ? { id: 'child', parent_id: 'root', author_id: 'medine' } : null,
      create: async (args: any) => { createdReply = args; return { id: 'reply', created_at: created }; } },
    forumTopicState: { findMany: async () => [], upsert: async () => ({}) },
    user: { findMany: async () => [{ id: 'medine', cube_profile: null }], findUnique: async () => ({ name: 'Yunus Altanay' }) },
    notification: { create: async (args: any) => { notifications.push(args); } } };
  prisma.$transaction = (async (fn: any) => fn(tx)) as typeof original;
  try {
    await createForumReply(cube, 'topic', { body: '[@Medine Kaynak](@cube-018) ne o', parent_id: 'child' });
    assert.equal(createdReply.data.parent_id, 'root');
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0].data.user_id, 'medine');
    assert.equal(notifications[0].data.message, 'Yunus Altanay replied to your comment in “Topic”: “ne o”');
    await assert.rejects(createForumReply(cube, 'topic', { body: 'Hello', parent_id: 'gone' }), isStatus(404));
  } finally { prisma.$transaction = original; }
});

test('reporting validates the reply belongs to the topic, blocks self-reports and deduplicates open reports', async () => {
  const original = prisma.$transaction;
  let topic: any = { id: 'topic', author_id: 'other' }, reply: any = null, creates = 0;
  const tx = { $queryRaw: async () => [], forumTopic: { findFirst: async () => topic }, forumReply: { findFirst: async () => reply },
    forumReport: { findFirst: async () => ({ id: 'existing' }), create: async () => { creates++; } } };
  prisma.$transaction = (async (fn: any) => fn(tx)) as typeof original;
  try {
    await assert.rejects(reportForumPost(cube, 'topic', { reply_id: 'foreign', reason: 'This is a test report' }), isStatus(404));
    reply = { id: 'own-reply', author_id: cube.id };
    await assert.rejects(reportForumPost(cube, 'topic', { reply_id: 'own-reply', reason: 'Reporting my own reply' }), isStatus(400));
    topic = { id: 'topic', author_id: cube.id };
    await assert.rejects(reportForumPost(cube, 'topic', { reason: 'Reporting my own topic' }), isStatus(400));
    topic = { id: 'topic', author_id: 'other' };
    reply = { id: 'valid', author_id: 'other' };
    assert.equal((await reportForumPost(cube, 'topic', { reply_id: 'valid', reason: 'This is a test report' })).id, 'existing');
    assert.equal(creates, 0);
  } finally { prisma.$transaction = original; }
});

test('search excludes deleted topics and replies; bookmarks are scoped to requester', async () => {
  const original = { transaction: prisma.$transaction, find: prisma.forumTopic.findMany, count: prisma.forumTopic.count };
  let query: any;
  prisma.forumTopic.findMany = (async (args: any) => { query = args; return []; }) as typeof original.find;
  prisma.forumTopic.count = (async () => 0) as typeof original.count;
  prisma.$transaction = (async (operations: any) => Promise.all(operations)) as typeof original.transaction;
  try {
    await listForumTopics(cube, { page: 2, view: 'saved', query: 'search' });
    assert.equal(query.where.deleted_at, null);
    assert.equal(query.where.OR[2].replies.some.deleted_at, null);
    assert.deepEqual(query.where.states.some, { user_id: cube.id, saved: true });
    assert.equal(query.take, 20); assert.equal(query.skip, 20);
  } finally { prisma.$transaction = original.transaction; prisma.forumTopic.findMany = original.find; prisma.forumTopic.count = original.count; }
});

test('reading a topic never takes the row lock that writers wait on', async () => {
  const original = prisma.$transaction;
  let locks = 0;
  const tx = {
    $queryRaw: async () => { locks++; return []; },
    forumTopic: { findFirst: async () => ({ id: 'topic', accepted_reply_id: null, last_activity_at: new Date(), author: null, context: null, reposts: [], poll: null }) },
    forumReply: { count: async () => 0, findMany: async () => [], findFirst: async () => null },
    forumTopicState: { upsert: async () => ({}) },
    forumTopicRepost: { findMany: async () => [] },
  };
  prisma.$transaction = (async (fn: any) => fn(tx)) as typeof original;
  try {
    const result = await readForumTopic(cube, 'topic', 1);
    assert.equal(result.page, 1);
    assert.equal(locks, 0);
  } finally { prisma.$transaction = original; }
});

test('moderation rejects Cubes before opening a transaction', async () => {
  await assert.rejects(moderateForumTopic(cube, 'topic', { locked: true, pinned: false }), isStatus(403));
  await assert.rejects(moderateForumTopic(staff, 'topic', { locked: 'false', pinned: false }), isStatus(400));
});

test('HTTP endpoints require authentication, sanitize server errors and reject invalid bodies', async () => {
  const originalUser = prisma.user.findUnique, originalCategory = prisma.forumCategory.findMany;
  prisma.user.findUnique = (async () => ({ ...cube, email: 'test@example.invalid', cube_profile: null })) as any;
  prisma.forumCategory.findMany = (async () => { throw new Error('sensitive SQL details'); }) as any;
  const app = express(); app.use(express.json()); app.use('/api', router);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address() as { port: number };
  const base = `http://127.0.0.1:${address.port}/api/forum`;
  const token = jwt.sign({ id: cube.id }, process.env.JWT_SECRET!);
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  try {
    assert.equal((await fetch(`${base}/categories`)).status, 401);
    assert.equal((await fetch(`${base}/topics`, { method: 'POST', headers, body: '[]' })).status, 400);
    assert.equal((await fetch(`${base}/topics?page=-2`, { headers })).status, 400);
    assert.equal((await fetch(`${base}/reports`, { headers })).status, 403);
    let limited;
    for (let i = 0; i < 21; i++) limited = await fetch(base + '/topics', { method: 'POST', headers, body: '[]' });
    assert.equal(limited!.status, 429);
    assert.ok(Number(limited!.headers.get('Retry-After')) > 0);
    const oldError = console.error; console.error = () => {};
    try { const response = await fetch(`${base}/categories`, { headers }); assert.equal(response.status, 500); assert.doesNotMatch(await response.text(), /sensitive|SQL/); }
    finally { console.error = oldError; }
  } finally { prisma.user.findUnique = originalUser; prisma.forumCategory.findMany = originalCategory; server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); await prisma.$disconnect(); }
});
