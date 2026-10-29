import { Prisma } from '@prisma/client';
import prisma from './prisma';
import { badRequest, forbidden, notFound } from '../utils/http';
import { assertForumAuthor, assertForumCategory, ForumActor, forumText, isForumStaff } from './forumPolicy';

const author = { id: true, name: true, role: true, avatar_url: true } as const;
const pageSize = 20;
type Tx = Prisma.TransactionClient;

// Every topic mutation obtains the same row lock, including reply changes and moderation.
async function lockedTopic(tx: Tx, id: string) {
  await tx.$queryRaw`SELECT id FROM "ForumTopic" WHERE id = ${id} FOR UPDATE`;
  const topic = await tx.forumTopic.findFirst({ where: { id, deleted_at: null } });
  if (!topic) throw notFound('Topic not found.');
  return topic;
}

export async function forumCategories() {
  return prisma.forumCategory.findMany({ orderBy: { position: 'asc' }, include: {
    _count: { select: { topics: { where: { deleted_at: null } } } },
    topics: { where: { deleted_at: null }, orderBy: [{ last_activity_at: 'desc' }, { id: 'desc' }], take: 1,
      select: { id: true, title: true, last_activity_at: true } },
  } });
}

// Sidebar figures, computed over the whole board rather than the page the viewer happens to see.
export async function forumStats() {
  const since = new Date(Date.now() - 30 * 86400000);
  const liveTopic = { deleted_at: null };
  const liveReply = { deleted_at: null, topic: liveTopic };
  const [topics, replies, solved, topicAuthors, replyAuthors, unanswered] = await Promise.all([
    prisma.forumTopic.count({ where: liveTopic }),
    prisma.forumReply.count({ where: liveReply }),
    prisma.forumTopic.count({ where: { ...liveTopic, accepted_reply_id: { not: null } } }),
    prisma.forumTopic.groupBy({ by: ['author_id'], where: { ...liveTopic, author_id: { not: null }, created_at: { gte: since } }, _count: { _all: true } }),
    prisma.forumReply.groupBy({ by: ['author_id'], where: { ...liveReply, author_id: { not: null }, created_at: { gte: since } }, _count: { _all: true } }),
    prisma.forumTopic.findMany({ where: { ...liveTopic, locked: false, replies: { none: { deleted_at: null } } }, orderBy: [{ created_at: 'desc' }, { id: 'desc' }], take: 4,
      select: { id: true, title: true, category_id: true, created_at: true, author: { select: author } } }),
  ]);
  const counts = new Map<string, { topics: number; replies: number }>();
  for (const row of topicAuthors) if (row.author_id) counts.set(row.author_id, { topics: row._count._all, replies: 0 });
  for (const row of replyAuthors) if (row.author_id) counts.set(row.author_id, { topics: counts.get(row.author_id)?.topics || 0, replies: row._count._all });
  const top = [...counts].sort(([, a], [, b]) => (b.topics + b.replies) - (a.topics + a.replies)).slice(0, 5);
  const users = top.length ? await prisma.user.findMany({ where: { id: { in: top.map(([id]) => id) } }, select: author }) : [];
  const contributors = top.flatMap(([id, count]) => { const user = users.find(u => u.id === id); return user ? [{ author: user, ...count }] : []; });
  return { topics, replies, solved, contributors, unanswered };
}

export async function listForumTopics(actor: ForumActor, options: { category?: string; query?: string; view?: string; sort?: string; page: number }) {
  const where: Prisma.ForumTopicWhereInput = { deleted_at: null };
  if (options.category) where.category_id = options.category;
  if (options.query) where.OR = [
    { title: { contains: options.query, mode: 'insensitive' } },
    { body: { contains: options.query, mode: 'insensitive' } },
    { replies: { some: { deleted_at: null, body: { contains: options.query, mode: 'insensitive' } } } },
  ];
  if (options.view === 'saved' || options.view === 'following') where.states = { some: { user_id: actor.id, [options.view]: true } };
  if (options.view === 'unanswered') { where.category_id = 'help'; where.replies = { none: { deleted_at: null } }; }
  if (options.view === 'solved') { where.category_id = 'help'; where.accepted_reply_id = { not: null }; }
  const [total, topics] = await prisma.$transaction([
    prisma.forumTopic.count({ where }),
    prisma.forumTopic.findMany({ where, skip: (options.page - 1) * pageSize, take: pageSize,
      orderBy: [{ pinned: 'desc' }, options.sort === 'newest' ? { created_at: 'desc' } : { last_activity_at: 'desc' }, { id: 'desc' }],
      select: { id: true, title: true, body: true, accepted_reply_id: true, category_id: true, created_at: true, last_activity_at: true, pinned: true, locked: true,
        author: { select: author }, _count: { select: { replies: { where: { deleted_at: null } } } },
        states: { where: { user_id: actor.id }, select: { saved: true, following: true, read_at: true } } },
    }),
  ]);
  return { topics, total, page: options.page, pageSize };
}

export async function readForumTopic(actor: ForumActor, id: string, page: number) {
  return prisma.$transaction(async tx => {
    const topic = await tx.forumTopic.findFirst({ where: { id, deleted_at: null }, include: {
      author: { select: author }, category: true,
      states: { where: { user_id: actor.id }, select: { saved: true, following: true } },
    } });
    if (!topic) throw notFound('Topic not found.');
    const total = await tx.forumReply.count({ where: { topic_id: id, deleted_at: null } });
    const replies = await tx.forumReply.findMany({ where: { topic_id: id, deleted_at: null },
      orderBy: [{ created_at: 'asc' }, { id: 'asc' }], skip: (page - 1) * pageSize, take: pageSize, include: { author: { select: author } } });
    await tx.forumTopicState.upsert({ where: { user_id_topic_id: { user_id: actor.id, topic_id: id } },
      create: { user_id: actor.id, topic_id: id, read_at: topic.last_activity_at }, update: { read_at: topic.last_activity_at } });
    const acceptedReply = topic.accepted_reply_id ? await tx.forumReply.findFirst({ where: { id: topic.accepted_reply_id, topic_id: id, deleted_at: null }, include: { author: { select: author } } }) : null;
    return { topic, replies, acceptedReply, total, page, pageSize };
  });
}

export async function createForumTopic(actor: ForumActor, input: Record<string, unknown>) {
  const title = forumText(input.title, 'Title', 8, 160), body = forumText(input.body, 'Message', 15, 10000);
  const categoryId = forumText(input.category_id, 'Category', 1, 80);
  const category = await prisma.forumCategory.findUnique({ where: { id: categoryId } });
  if (!category) throw badRequest('Category not found.');
  assertForumCategory(actor, category.staff_only);
  return prisma.forumTopic.create({ data: { title, body, category_id: categoryId, author_id: actor.id,
    states: { create: { user_id: actor.id, following: true } } } });
}

export async function changeForumTopic(actor: ForumActor, id: string, input: Record<string, unknown>, remove = false) {
  return prisma.$transaction(async tx => {
    const topic = await lockedTopic(tx, id);
    if (remove) {
      if (!isForumStaff(actor)) assertForumAuthor(actor, topic.author_id);
      return tx.forumTopic.update({ where: { id }, data: { deleted_at: new Date(), deleted_by_id: actor.id } });
    }
    assertForumAuthor(actor, topic.author_id);
    if (topic.locked) throw forbidden('A locked topic cannot be edited.');
    return tx.forumTopic.update({ where: { id }, data: { title: forumText(input.title, 'Title', 8, 160), body: forumText(input.body, 'Message', 15, 10000) } });
  });
}

export async function moderateForumTopic(actor: ForumActor, id: string, input: Record<string, unknown>) {
  if (!isForumStaff(actor)) throw forbidden('Moderasyon yetkin yok.');
  if (typeof input.locked !== 'boolean' || typeof input.pinned !== 'boolean') throw badRequest('Locked and pinned values are required.');
  const locked = input.locked, pinned = input.pinned;
  return prisma.$transaction(async tx => {
    await lockedTopic(tx, id);
    return tx.forumTopic.update({ where: { id }, data: { locked, pinned } });
  });
}

export async function createForumReply(actor: ForumActor, topicId: string, input: Record<string, unknown>) {
  const body = forumText(input.body, 'Reply', 1, 5000);
  return prisma.$transaction(async tx => {
    const topic = await lockedTopic(tx, topicId);
    if (topic.locked) throw forbidden('This topic is closed to new replies.');
    const reply = await tx.forumReply.create({ data: { body, topic_id: topicId, author_id: actor.id } });
    await tx.forumTopic.update({ where: { id: topicId }, data: { last_activity_at: reply.created_at } });
    const followers = await tx.forumTopicState.findMany({ where: { topic_id: topicId, following: true, user_id: { not: actor.id },
      user: { OR: [{ role: { in: ['ADMIN', 'MENTOR'] } }, { cube_profile: { is: { current_level: { notIn: ['Alumni', 'Former_Cube'] } } } }] } }, select: { user_id: true } });
    if (followers.length) await tx.notification.createMany({ data: followers.map(f => ({ user_id: f.user_id,
      message: `New reply in “${topic.title}”, a topic you follow. /forum?topic=${topicId}` })) });
    return reply;
  });
}

export async function changeForumReply(actor: ForumActor, topicId: string, id: string, input: Record<string, unknown>, remove = false) {
  return prisma.$transaction(async tx => {
    const topic = await lockedTopic(tx, topicId);
    const reply = await tx.forumReply.findFirst({ where: { id, topic_id: topicId, deleted_at: null } });
    if (!reply) throw notFound('Reply not found.');
    if (remove) {
      if (!isForumStaff(actor)) assertForumAuthor(actor, reply.author_id);
      if (topic.accepted_reply_id === id) await tx.forumTopic.update({ where: { id: topicId }, data: { accepted_reply_id: null } });
      return tx.forumReply.update({ where: { id }, data: { deleted_at: new Date(), deleted_by_id: actor.id } });
    }
    assertForumAuthor(actor, reply.author_id);
    if (topic.locked) throw forbidden('Replies in a locked topic cannot be edited.');
    return tx.forumReply.update({ where: { id }, data: { body: forumText(input.body, 'Reply', 1, 5000) } });
  });
}

export async function acceptForumAnswer(actor: ForumActor, topicId: string, input: Record<string, unknown>) {
  const replyId = input.reply_id === null ? null : forumText(input.reply_id, 'Reply', 1, 100);
  return prisma.$transaction(async tx => {
    const topic = await lockedTopic(tx, topicId);
    assertForumAuthor(actor, topic.author_id);
    if (topic.category_id !== 'help') throw badRequest('Only Tech Support questions can have an accepted answer.');
    if (topic.locked) throw forbidden('The answer of a locked topic cannot be changed.');
    if (replyId && !await tx.forumReply.findFirst({ where: { id: replyId, topic_id: topicId, deleted_at: null } })) throw notFound('Reply not found.');
    return tx.forumTopic.update({ where: { id: topicId }, data: { accepted_reply_id: replyId } });
  });
}

export async function setForumState(actor: ForumActor, id: string, input: Record<string, unknown>) {
  const data: { saved?: boolean; following?: boolean } = {};
  for (const key of ['saved', 'following'] as const) {
    if (input[key] !== undefined) {
      if (typeof input[key] !== 'boolean') throw badRequest('Invalid preference.');
      data[key] = input[key];
    }
  }
  if (!Object.keys(data).length) throw badRequest('Bir tercih gerekli.');
  return prisma.$transaction(async tx => {
    await lockedTopic(tx, id);
    return tx.forumTopicState.upsert({ where: { user_id_topic_id: { user_id: actor.id, topic_id: id } },
      create: { user_id: actor.id, topic_id: id, ...data }, update: data });
  });
}

export async function reportForumPost(actor: ForumActor, id: string, input: Record<string, unknown>) {
  const reason = forumText(input.reason, 'Bildirim nedeni', 10, 1000);
  const replyId = input.reply_id === undefined ? undefined : forumText(input.reply_id, 'Reply', 1, 100);
  return prisma.$transaction(async tx => {
    await lockedTopic(tx, id);
    if (replyId && !await tx.forumReply.findFirst({ where: { id: replyId, topic_id: id, deleted_at: null } })) throw notFound('Reply not found.');
    const existing = await tx.forumReport.findFirst({ where: { topic_id: id, reply_id: replyId || null, reporter_id: actor.id, resolved_at: null } });
    if (existing) return existing;
    return tx.forumReport.create({ data: { topic_id: id, reply_id: replyId, reporter_id: actor.id, reason } });
  });
}

export async function listForumReports(actor: ForumActor, page: number) {
  if (!isForumStaff(actor)) throw forbidden('Moderasyon yetkin yok.');
  const where = { resolved_at: null };
  const [total, reports] = await prisma.$transaction([
    prisma.forumReport.count({ where }),
    prisma.forumReport.findMany({ where, orderBy: [{ created_at: 'asc' }, { id: 'asc' }], skip: (page - 1) * pageSize, take: pageSize,
      include: { reporter: { select: author }, topic: { select: { title: true, body: true, deleted_at: true } }, reply: { select: { body: true, deleted_at: true } } } }),
  ]);
  return { reports, total, page, pageSize };
}

export async function resolveForumReport(actor: ForumActor, id: string) {
  if (!isForumStaff(actor)) throw forbidden('Moderasyon yetkin yok.');
  const result = await prisma.forumReport.updateMany({ where: { id, resolved_at: null }, data: { resolved_at: new Date(), resolved_by_id: actor.id } });
  if (!result.count) throw notFound('Open report not found.');
  return { ok: true };
}
