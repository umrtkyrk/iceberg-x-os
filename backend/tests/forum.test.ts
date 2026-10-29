import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../src/services/prisma';
import router from '../src/routes/forum.routes';
import { assertForumAuthor, assertForumCategory, forumPage, forumText } from '../src/services/forumPolicy';
import { changeForumTopic, createForumReply, reportForumPost, listForumTopics, moderateForumTopic, forumStats } from '../src/services/forum.service';
import { HttpError } from '../src/utils/http';

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

test('topic mutations reject foreign ownership and soft-delete with an audit actor', async () => {
  const original = prisma.$transaction;
  let update: any;
  const tx = { $queryRaw: async () => [], forumTopic: {
    findFirst: async () => ({ id: 'topic', author_id: cube.id, locked: false }),
    update: async (args: any) => { update = args; return args.data; },
  } };
  prisma.$transaction = (async (fn: any) => fn(tx)) as typeof original;
  try {
    await assert.rejects(changeForumTopic(staff, 'topic', { title: 'Valid title', body: 'A sufficiently long body' }), isStatus(403));
    assert.equal(update === undefined, true);
    await changeForumTopic(staff, 'topic', {}, true);
    assert.ok(update.data.deleted_at instanceof Date);
    assert.equal(update.data.deleted_by_id, staff.id);
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
  let followerQuery: any, notification: any, activity: any;
  const created = new Date();
  const tx = { $queryRaw: async () => [], forumTopic: { findFirst: async () => ({ title: 'Topic', locked: false }), update: async (args: any) => { activity = args; } },
    forumReply: { create: async () => ({ id: 'reply', created_at: created }) },
    forumTopicState: { findMany: async (args: any) => { followerQuery = args; return [{ user_id: 'other' }]; } },
    notification: { createMany: async (args: any) => { notification = args; } } };
  prisma.$transaction = (async (fn: any) => fn(tx)) as typeof original;
  try {
    await createForumReply(cube, 'topic', { body: 'Helpful reply' });
    assert.equal(activity.data.last_activity_at, created);
    assert.equal(followerQuery.where.user_id.not, cube.id);
    assert.deepEqual(followerQuery.where.user.OR[1].cube_profile.is.current_level.notIn, ['Alumni', 'Former_Cube']);
    assert.equal(notification.data[0].user_id, 'other');
  } finally { prisma.$transaction = original; }
});

test('reporting validates the reply belongs to the topic and deduplicates open reports', async () => {
  const original = prisma.$transaction;
  let reply: any = null, creates = 0;
  const tx = { $queryRaw: async () => [], forumTopic: { findFirst: async () => ({ id: 'topic' }) }, forumReply: { findFirst: async () => reply },
    forumReport: { findFirst: async () => ({ id: 'existing' }), create: async () => { creates++; } } };
  prisma.$transaction = (async (fn: any) => fn(tx)) as typeof original;
  try {
    await assert.rejects(reportForumPost(cube, 'topic', { reply_id: 'foreign', reason: 'This is a test report' }), isStatus(404));
    reply = { id: 'valid' };
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

test('moderation rejects Cubes before opening a transaction', async () => {
  await assert.rejects(moderateForumTopic(cube, 'topic', { locked: true, pinned: false }), isStatus(403));
  await assert.rejects(moderateForumTopic(staff, 'topic', { locked: 'false', pinned: false }), isStatus(400));
});

test('stats rank contributors by topics plus replies and skip deleted accounts', async () => {
  const t = prisma.forumTopic as any, r = prisma.forumReply as any, u = prisma.user as any;
  const original = { tCount: t.count, tGroup: t.groupBy, tFind: t.findMany, rCount: r.count, rGroup: r.groupBy, uFind: u.findMany };
  let unansweredWhere: any;
  t.count = async () => 3; r.count = async () => 7;
  t.groupBy = async () => [{ author_id: 'a', _count: { _all: 1 } }, { author_id: 'b', _count: { _all: 2 } }];
  r.groupBy = async () => [{ author_id: 'a', _count: { _all: 4 } }, { author_id: 'gone', _count: { _all: 9 } }];
  t.findMany = async (args: any) => { unansweredWhere = args.where; return []; };
  u.findMany = async () => [{ id: 'a', name: 'A', role: 'CUBE' }, { id: 'b', name: 'B', role: 'MENTOR' }];
  try {
    const stats = await forumStats();
    assert.equal(stats.topics, 3); assert.equal(stats.replies, 7);
    assert.deepEqual(stats.contributors.map(c => [c.author.id, c.topics, c.replies]), [['a', 1, 4], ['b', 2, 0]]);
    assert.equal(unansweredWhere.deleted_at, null); assert.equal(unansweredWhere.locked, false);
  } finally { t.count = original.tCount; t.groupBy = original.tGroup; t.findMany = original.tFind; r.count = original.rCount; r.groupBy = original.rGroup; u.findMany = original.uFind; }
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
    const oldError = console.error; console.error = () => {};
    try { const response = await fetch(`${base}/categories`, { headers }); assert.equal(response.status, 500); assert.doesNotMatch(await response.text(), /sensitive|SQL/); }
    finally { console.error = oldError; }
  } finally { prisma.user.findUnique = originalUser; prisma.forumCategory.findMany = originalCategory; server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); await prisma.$disconnect(); }
});
