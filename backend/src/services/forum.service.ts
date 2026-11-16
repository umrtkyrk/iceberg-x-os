import { Prisma } from '@prisma/client';
import prisma from './prisma';
import { badRequest, forbidden, notFound } from '../utils/http';
import { forumAuthorSelect, publicForumAuthor } from './forumIdentity.service';
import { forumContextSelect, topicContextInput } from './forumContext.service';
import { forgetForumReply, notifyForumEvent, syncForumLikeNotification, syncForumRepostNotification } from './forumNotifications.service';
import { assertForumAuthor, assertForumCategory, ForumActor, forumText, isForumStaff } from './forumPolicy';
import { recalculateForumQuestsForUsers } from './quest.service';
import { castPollVote, createPoll, pollInput, pollSelect, projectPoll } from './forumPoll.service';
import { openText } from './forumChatCrypto.service';

/*
 * Post visibility. PUBLIC posts are seen by everyone; GROUP posts by the members of one private group;
 * PRIVATE posts by the author and the people they chose. Every read and write goes through
 * visibleTopicWhere, so a post someone cannot see answers exactly like a missing one, and it never
 * appears in counts, stats, previews, liker lists or notifications meant for others.
 */
export const TOPIC_VISIBILITY = ['PUBLIC', 'GROUP', 'PRIVATE'] as const;
const MAX_AUDIENCE = 50;
export const visibleTopicWhere = (actor: ForumActor): Prisma.ForumTopicWhereInput => ({ OR: [
  { visibility: 'PUBLIC' }, { author_id: actor.id },
  { visibility: 'GROUP', audience_room: { is: { members: { some: { user_id: actor.id } } } } },
  { visibility: 'PRIVATE', audience: { some: { user_id: actor.id } } },
] });
const audienceSelect = { visibility: true, audience_room: { select: { id: true, name: true } },
  audience: { orderBy: { user_id: 'asc' as const }, take: MAX_AUDIENCE, select: { user: { select: { id: true, name: true } } } } };
type AudienceRow = { visibility: string; audience_room?: { id: string; name: string } | null; audience?: { user: { id: string; name: string } }[] };
const projectAudience = <T extends AudienceRow>(topic: T) => {
  const { audience_room, audience, ...rest } = topic;
  return { ...rest, audience: topic.visibility === 'GROUP' ? { room: audience_room ? { id: audience_room.id, name: openText(audience_room.id, audience_room.name) } : null }
    : topic.visibility === 'PRIVATE' ? { people: (audience || []).map(row => row.user) } : null };
};
const eligibleUser: Prisma.UserWhereInput = { OR: [{ role: { in: ['ADMIN', 'MENTOR'] } },
  { role: 'CUBE', cube_profile: { is: { current_level: { notIn: ['Alumni', 'Former_Cube'] } } } }] };
/** Validates who can see a post: one of the author's groups, or up to 50 active portal people. */
async function topicAudience(tx: Tx, actor: ForumActor, input: Record<string, unknown>) {
  const visibility = input.visibility === undefined || input.visibility === null ? 'PUBLIC' : input.visibility;
  if (typeof visibility !== 'string' || !(TOPIC_VISIBILITY as readonly string[]).includes(visibility)) throw badRequest('Choose who can see this post.');
  if (visibility === 'GROUP') {
    const roomId = forumText(input.audience_room_id, 'Group', 1, 100);
    if (!await tx.forumChatMember.findUnique({ where: { room_id_user_id: { room_id: roomId, user_id: actor.id } }, select: { user_id: true } })) throw badRequest('Choose one of your groups.');
    return { visibility, audience_room_id: roomId, people: [] as string[] };
  }
  if (visibility === 'PRIVATE') {
    const raw = input.audience_user_ids;
    if (!Array.isArray(raw) || !raw.every(id => typeof id === 'string' && id.length > 0 && id.length <= 100)) throw badRequest('Choose who can see this post.');
    const people = [...new Set(raw as string[])].filter(id => id !== actor.id);
    if (!people.length || people.length > MAX_AUDIENCE) throw badRequest(`Choose 1–${MAX_AUDIENCE} people.`);
    if (await tx.user.count({ where: { AND: [eligibleUser, { id: { in: people } }] } }) !== people.length) throw badRequest('Select active portal accounts only.');
    return { visibility, audience_room_id: null, people };
  }
  return { visibility: 'PUBLIC', audience_room_id: null, people: [] as string[] };
}

const author = forumAuthorSelect;
const projectPost = <T extends { author: Parameters<typeof publicForumAuthor>[0] }>(post: T) => ({ ...post, author: publicForumAuthor(post.author) });
const pageSize = 20;
// Like totals plus whether the viewer liked the post, without exposing who else did.
const likeSelect = (userId: string) => ({ where: { user_id: userId }, select: { user_id: true }, take: 1 });
const projectLikes = <T extends { likes?: unknown[]; _count?: { likes?: number } }>(post: T) => {
  const { likes, ...rest } = post;
  return { ...rest, liked: !!likes?.length, like_count: post._count?.likes ?? 0 };
};
type Tx = Prisma.TransactionClient;
// The three most recent reposters (for "Ayşe and 2 others reposted") plus the total.
const repostSelect = { orderBy: [{ created_at: 'desc' as const }, { user_id: 'asc' as const }], take: 3, select: { user: { select: { id: true, name: true } } } };
async function viewerReposts(db: Tx | typeof prisma, userId: string, topicIds: string[]) {
  if (!topicIds.length) return new Set<string>();
  return new Set((await db.forumTopicRepost.findMany({ where: { user_id: userId, topic_id: { in: topicIds } }, select: { topic_id: true } })).map(row => row.topic_id));
}
const projectReposts = <T extends { reposts: { user: { id: string; name: string } }[]; _count?: { reposts?: number } }>(topic: T, mine: Set<string>, id: string) => {
  const { reposts, ...rest } = topic;
  return { ...rest, reposted: mine.has(id), repost_count: topic._count?.reposts ?? 0, reposted_by: reposts.map(row => row.user) };
};

// Forum quests are re-evaluated after the post is committed, off the request path.
function refreshForumQuests(userIds: (string | null | undefined)[]) {
  void recalculateForumQuestsForUsers(userIds).catch(error => console.error('Forum quest refresh failed:', error));
}

// Every topic mutation obtains the same row lock, including reply changes and moderation.
async function lockedTopic(tx: Tx, id: string, actor: ForumActor) {
  await tx.$queryRaw`SELECT id FROM "ForumTopic" WHERE id = ${id} FOR UPDATE`;
  const topic = await tx.forumTopic.findFirst({ where: { id, deleted_at: null, AND: [visibleTopicWhere(actor)] } });
  if (!topic) throw notFound('Topic not found.');
  return topic;
}

export async function forumCategories() {
  const categories = await prisma.forumCategory.findMany({ orderBy: { position: 'asc' }, include: {
    _count: { select: { topics: { where: { deleted_at: null, visibility: 'PUBLIC' } } } },
    topics: { where: { deleted_at: null, visibility: 'PUBLIC' }, orderBy: [{ last_activity_at: 'desc' }, { id: 'desc' }], take: 1,
      select: { id: true, title: true, last_activity_at: true } },
  } });
  const counts = await prisma.$queryRaw<Array<{ category_id: string; count: bigint }>>`SELECT t.category_id, count(r.id) AS count FROM "ForumTopic" t JOIN "ForumReply" r ON r.topic_id = t.id WHERE t.deleted_at IS NULL AND t.visibility = 'PUBLIC' AND r.deleted_at IS NULL GROUP BY t.category_id`;
  return categories.map(category => ({ ...category, reply_count: Number(counts.find(c => c.category_id === category.id)?.count || 0) }));
}

// Sidebar figures, computed over the whole board rather than the page the viewer happens to see.
export async function forumStats() {
  const since = new Date(Date.now() - 30 * 86400000);
  const liveTopic = { deleted_at: null, visibility: 'PUBLIC' };
  const liveReply = { deleted_at: null, topic: liveTopic };
  const [topics, replies, solved, topicAuthors, unanswered] = await Promise.all([
    prisma.forumTopic.count({ where: liveTopic }),
    prisma.forumReply.count({ where: liveReply }),
    prisma.forumTopic.count({ where: { ...liveTopic, category_id: 'help', accepted_reply_id: { not: null } } }),
    prisma.forumTopic.groupBy({ by: ['author_id'], where: { ...liveTopic, author_id: { not: null }, created_at: { gte: since } }, _count: { _all: true } }),
    prisma.forumTopic.findMany({ where: { ...liveTopic, locked: false, accepted_reply_id: null, replies: { none: { deleted_at: null } } }, orderBy: [{ created_at: 'desc' }, { id: 'desc' }], take: 4,
      select: { id: true, title: true, category_id: true, created_at: true, author: { select: author } } }),
  ]);
  // "Most active" counts the posts people started; comments are not counted.
  const counts = new Map<string, { topics: number }>();
  for (const row of topicAuthors) if (row.author_id) counts.set(row.author_id, { topics: row._count._all });
  const top = [...counts].sort(([, a], [, b]) => b.topics - a.topics).slice(0, 5);
  const users = top.length ? await prisma.user.findMany({ where: { id: { in: top.map(([id]) => id) } }, select: author }) : [];
  const contributors = top.flatMap(([id, count]) => { const user = users.find(u => u.id === id); return user ? [{ author: publicForumAuthor(user), ...count }] : []; });
  return { topics, replies, solved, contributors, unanswered: unanswered.map(projectPost) };
}

// The dashboard card: what moved on the board recently, plus the viewer's own pulse.
export async function forumDashboard(actor: ForumActor) {
  const weekAgo = new Date(Date.now() - 7 * 86400000);
  const liveTopic = { deleted_at: null, AND: [visibleTopicWhere(actor)] };
  const liveReply = { deleted_at: null, topic: liveTopic };
  const staff = isForumStaff(actor);
  const [recent, unanswered, myTopics, myReplies, weekTopics, weekReplies, followed, openReports] = await Promise.all([
    prisma.forumTopic.findMany({ where: liveTopic, orderBy: [{ last_activity_at: 'desc' }, { id: 'desc' }], take: 5,
      select: { id: true, title: true, last_activity_at: true, accepted_reply_id: true, author: { select: author },
        category: { select: { id: true, name: true } }, _count: { select: { replies: { where: { deleted_at: null } } } },
        states: { where: { user_id: actor.id }, select: { read_at: true } } } }),
    prisma.forumTopic.findMany({ where: { ...liveTopic, locked: false, accepted_reply_id: null, author_id: { not: actor.id }, replies: { none: { deleted_at: null } } },
      orderBy: [{ created_at: 'desc' }, { id: 'desc' }], take: 3,
      select: { id: true, title: true, created_at: true, author: { select: author }, category: { select: { id: true, name: true } } } }),
    prisma.forumTopic.count({ where: { ...liveTopic, author_id: actor.id } }),
    prisma.forumReply.count({ where: { ...liveReply, author_id: actor.id } }),
    prisma.forumTopic.count({ where: { ...liveTopic, created_at: { gte: weekAgo } } }),
    prisma.forumReply.count({ where: { ...liveReply, created_at: { gte: weekAgo } } }),
    prisma.$queryRaw<Array<{ count: bigint }>>`SELECT count(*) AS count FROM "ForumTopicState" s JOIN "ForumTopic" t ON t.id = s.topic_id
      WHERE s.user_id = ${actor.id} AND s.following AND t.deleted_at IS NULL AND (s.read_at IS NULL OR s.read_at < t.last_activity_at)`,
    staff ? prisma.forumReport.count({ where: { resolved_at: null } }) : Promise.resolve(null),
  ]);
  return {
    recent: recent.map(({ states, ...topic }) => ({ ...projectPost(topic), read_at: states[0]?.read_at ?? null })),
    unanswered: unanswered.map(projectPost),
    my_posts: myTopics + myReplies,
    week_posts: weekTopics + weekReplies,
    followed_unread: Number(followed[0]?.count ?? 0),
    open_reports: openReports,
  };
}

export async function listForumTopics(actor: ForumActor, options: { category?: string; query?: string; view?: string; sort?: string; quest?: string; mission?: string; page: number }) {
  const where: Prisma.ForumTopicWhereInput = { deleted_at: null, AND: [visibleTopicWhere(actor)] };
  if (options.quest) where.context = { is: { quest_id: options.quest } };
  if (options.mission) where.context = { is: { ...options.quest ? { quest_id: options.quest } : {}, mission_id: options.mission } };
  if (options.category) where.category_id = options.category;
  if (options.query) where.OR = [
    { title: { contains: options.query, mode: 'insensitive' } },
    { body: { contains: options.query, mode: 'insensitive' } },
    { replies: { some: { deleted_at: null, body: { contains: options.query, mode: 'insensitive' } } } },
  ];
  if (options.view === 'saved' || options.view === 'following') where.states = { some: { user_id: actor.id, [options.view]: true } };
  if (options.view === 'unanswered') { where.locked = false; where.accepted_reply_id = null; where.replies = { none: { deleted_at: null } }; }
  if (options.view === 'solved') {
    // Intersect with the requested community instead of silently replacing it.
    where.AND = [...(Array.isArray(where.AND) ? where.AND : []), { category_id: 'help' }];
    where.accepted_reply_id = { not: null };
  }
  const [total, topics] = await prisma.$transaction([
    prisma.forumTopic.count({ where }),
    prisma.forumTopic.findMany({ where, skip: (options.page - 1) * pageSize, take: pageSize,
      orderBy: [{ pinned: 'desc' }, options.sort === 'newest' ? { created_at: 'desc' } : { last_activity_at: 'desc' }, { id: 'desc' }],
      select: { ...audienceSelect, id: true, title: true, body: true, accepted_reply_id: true, category_id: true, created_at: true, last_activity_at: true, pinned: true, locked: true,
        author: { select: author }, context: { select: forumContextSelect }, _count: { select: { replies: { where: { deleted_at: null } }, likes: true, reposts: true } },
        likes: likeSelect(actor.id), poll: { select: pollSelect }, reposts: repostSelect,
        states: { where: { user_id: actor.id }, select: { saved: true, following: true, read_at: true } } },
    }),
  ]);
  const mine = await viewerReposts(prisma, actor.id, topics.map(topic => topic.id));
  return { topics: topics.map(({ poll, ...topic }) => ({ ...projectAudience(projectReposts(projectLikes(projectPost(topic)), mine, topic.id)), has_poll: !!poll, poll: projectPoll(poll, actor.id) })), total, page: options.page, pageSize };
}

// Comments are threaded one level deep, like YouTube: top-level comments are paginated and each carries
// its replies. A removed top-level comment stays as a placeholder while it still has live replies.
const topLevelReplies = (topicId: string): Prisma.ForumReplyWhereInput => ({ topic_id: topicId, parent_id: null,
  OR: [{ deleted_at: null }, { children: { some: { deleted_at: null } } }] });
const threadOrder = [{ created_at: 'asc' as const }, { id: 'asc' as const }];

export async function readForumTopic(actor: ForumActor, id: string, page: number, replyId?: string) {
  // Reading must not take the topic row lock: GETs are not rate limited, so a lock here would let any
  // signed-in user stall replies and moderation on a topic just by reloading it.
  return prisma.$transaction(async tx => {
    const topic = await tx.forumTopic.findFirst({ where: { id, deleted_at: null, AND: [visibleTopicWhere(actor)] }, include: {
      audience_room: { select: { id: true, name: true } }, audience: audienceSelect.audience,
      author: { select: author }, category: true, context: { select: forumContextSelect },
      states: { where: { user_id: actor.id }, select: { saved: true, following: true } },
      likes: likeSelect(actor.id), _count: { select: { likes: true, reposts: true } }, poll: { select: pollSelect }, reposts: repostSelect,
    } });
    if (!topic) throw notFound('Topic not found.');
    const topLevel = topLevelReplies(id);
    if (replyId) {
      const target = await tx.forumReply.findFirst({ where: { id: replyId, topic_id: id, deleted_at: null },
        select: { id: true, created_at: true, parent: { select: { id: true, created_at: true } } } });
      // A reply inside a thread is found on the page of its top-level comment.
      const anchor = target?.parent || target;
      if (anchor) {
        const before = await tx.forumReply.count({ where: { AND: [topLevel, { OR: [
          { created_at: { lt: anchor.created_at } }, { created_at: anchor.created_at, id: { lte: anchor.id } },
        ] }] } });
        page = Math.max(1, Math.ceil(before / pageSize));
      }
    }
    const total = await tx.forumReply.count({ where: topLevel });
    const commentCount = await tx.forumReply.count({ where: { topic_id: id, deleted_at: null } });
    // Moderation may have removed the last comment on the requested page.
    page = Math.max(1, Math.min(page, Math.ceil(total / pageSize)));
    const replyInclude = { author: { select: author }, likes: likeSelect(actor.id), _count: { select: { likes: true } }, poll: { select: pollSelect } };
    const replies = await tx.forumReply.findMany({ where: topLevel, orderBy: threadOrder, skip: (page - 1) * pageSize, take: pageSize,
      include: { ...replyInclude, children: { where: { deleted_at: null }, orderBy: threadOrder, include: replyInclude } } });
    await tx.forumTopicState.upsert({ where: { user_id_topic_id: { user_id: actor.id, topic_id: id } },
      create: { user_id: actor.id, topic_id: id, read_at: topic.last_activity_at }, update: { read_at: topic.last_activity_at } });
    const acceptedReply = topic.accepted_reply_id ? await tx.forumReply.findFirst({ where: { id: topic.accepted_reply_id, topic_id: id, deleted_at: null }, include: replyInclude }) : null;
    const reply = ({ poll, ...post }: NonNullable<typeof acceptedReply>) => ({ ...projectLikes(projectPost(post)), poll: projectPoll(poll, actor.id), deleted: false });
    const thread = ({ children, ...post }: typeof replies[number]) => ({
      ...(post.deleted_at ? { ...reply(post), body: '', author: null, liked: false, like_count: 0, poll: null, deleted: true } : reply(post)),
      replies: children.map(reply),
    });
    const { poll, ...topicRow } = topic;
    const mine = await viewerReposts(tx, actor.id, [id]);
    return { topic: { ...projectAudience(projectReposts(projectLikes(projectPost(topicRow)), mine, id)), edited: !!topic.context?.edited_at, poll: projectPoll(poll, actor.id) }, replies: replies.map(thread),
      acceptedReply: acceptedReply ? reply(acceptedReply) : null, total, comment_count: commentCount, page, pageSize };
  });
}

export async function createForumTopic(actor: ForumActor, input: Record<string, unknown>) {
  const title = forumText(input.title, 'Title', 1, 160), body = forumText(input.body, 'Message', 1, 10000);
  const categoryId = forumText(input.category_id, 'Category', 1, 80);
  const poll = pollInput(input.poll);
  const category = await prisma.forumCategory.findUnique({ where: { id: categoryId } });
  if (!category) throw badRequest('Category not found.');
  assertForumCategory(actor, category.staff_only);
  const created = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "ForumCategory" WHERE id = ${categoryId} FOR UPDATE`;
    const liveCategory = await tx.forumCategory.findUnique({ where: { id: categoryId } });
    if (!liveCategory) throw badRequest('Category not found.');
    assertForumCategory(actor, liveCategory.staff_only);
    const context = await topicContextInput(actor, input, tx);
    const now = new Date();
    const { people, ...scope } = await topicAudience(tx, actor, input);
    const topic = await tx.forumTopic.create({ data: { title, body, category_id: categoryId, author_id: actor.id,
      created_at: now, last_activity_at: now, ...scope, ...(people.length ? { audience: { create: people.map(user_id => ({ user_id })) } } : {}),
      context: { create: context }, states: { create: { user_id: actor.id, following: true, read_at: now } } } });
    if (poll) await createPoll(tx, { topic_id: topic.id }, poll);
    await notifyForumEvent(tx, actor, topic, body);
    return topic;
  });
  refreshForumQuests([actor.id]);
  return created;
}

export async function changeForumTopic(actor: ForumActor, id: string, input: Record<string, unknown>, remove = false) {
  return prisma.$transaction(async tx => {
    const topic = await lockedTopic(tx, id, actor);
    if (remove) {
      if (!isForumStaff(actor)) assertForumAuthor(actor, topic.author_id);
      const now = new Date();
      await tx.forumReport.updateMany({ where: { topic_id: id, resolved_at: null }, data: { resolved_at: now, resolved_by_id: actor.id } });
      return tx.forumTopic.update({ where: { id }, data: { deleted_at: now, deleted_by_id: actor.id } });
    }
    assertForumAuthor(actor, topic.author_id);
    if (topic.locked) throw forbidden('A locked topic cannot be edited.');
    const context = 'quest_id' in input || 'mission_id' in input ? await topicContextInput(actor, input, tx) : {};
    const edit = { ...context, edited_at: new Date() };
    const title = forumText(input.title, 'Title', 1, 160), body = forumText(input.body, 'Message', 1, 10000);
    if ('visibility' in input) {
      const { people, ...scope } = await topicAudience(tx, actor, input);
      await tx.forumTopicAudience.deleteMany({ where: { topic_id: id } });
      if (people.length) await tx.forumTopicAudience.createMany({ data: people.map(user_id => ({ topic_id: id, user_id })) });
      // Reposts only make sense for public posts.
      if (scope.visibility !== 'PUBLIC') await tx.forumTopicRepost.deleteMany({ where: { topic_id: id } });
      return tx.forumTopic.update({ where: { id }, data: { title, body, ...scope, context: { upsert: { create: edit, update: edit } } } });
    }
    return tx.forumTopic.update({ where: { id }, data: { title, body, context: { upsert: { create: edit, update: edit } } } });
  });
}

export async function moderateForumTopic(actor: ForumActor, id: string, input: Record<string, unknown>) {
  if (!isForumStaff(actor)) throw forbidden('Moderation permission is required.');
  if (typeof input.locked !== 'boolean' || typeof input.pinned !== 'boolean') throw badRequest('Locked and pinned values are required.');
  const locked = input.locked, pinned = input.pinned;
  return prisma.$transaction(async tx => {
    const current = await lockedTopic(tx, id, actor);
    if (pinned !== current.pinned && actor.role !== 'ADMIN') throw forbidden('Only Admins can pin posts.');
    const categoryId = input.category_id === undefined ? undefined : forumText(input.category_id, 'Category', 1, 80);
    if (categoryId) await tx.$queryRaw`SELECT id FROM "ForumCategory" WHERE id = ${categoryId} FOR UPDATE`;
    if (categoryId && !await tx.forumCategory.findUnique({ where: { id: categoryId }, select: { id: true } })) throw badRequest('Category not found.');
    return tx.forumTopic.update({ where: { id }, data: { locked, pinned, ...(categoryId ? {
      category_id: categoryId,
      // Accepted answers belong to Tech Support; the replies themselves are preserved.
      ...(categoryId !== 'help' ? { accepted_reply_id: null } : {}),
    } : {}) } });
  });
}

export async function createForumReply(actor: ForumActor, topicId: string, input: Record<string, unknown>) {
  // A comment can be just a poll, like a poll message in WhatsApp.
  const poll = pollInput(input.poll);
  const body = poll && (input.body === undefined || input.body === null || (typeof input.body === 'string' && !input.body.trim())) ? '' : forumText(input.body, 'Reply', 1, 5000);
  const parentId = input.parent_id === undefined || input.parent_id === null ? null : forumText(input.parent_id, 'Reply', 1, 100);
  const created = await prisma.$transaction(async tx => {
    const topic = await lockedTopic(tx, topicId, actor);
    if (topic.locked) throw forbidden('This topic is closed to new replies.');
    // Replying to a reply keeps the thread one level deep: it joins the same top-level comment.
    const target = parentId ? await tx.forumReply.findFirst({ where: { id: parentId, topic_id: topicId, deleted_at: null }, select: { id: true, parent_id: true, author_id: true } }) : null;
    if (parentId && !target) throw notFound('The comment you replied to is no longer available.');
    const reply = await tx.forumReply.create({ data: { body, topic_id: topicId, author_id: actor.id, parent_id: target ? target.parent_id || target.id : null } });
    if (poll) await createPoll(tx, { reply_id: reply.id }, poll);
    await tx.forumTopic.update({ where: { id: topicId }, data: { last_activity_at: reply.created_at } });
    await tx.forumTopicState.upsert({ where: { user_id_topic_id: { user_id: actor.id, topic_id: topicId } },
      create: { user_id: actor.id, topic_id: topicId, read_at: reply.created_at }, update: { read_at: reply.created_at } });
    await notifyForumEvent(tx, actor, topic, body || `📊 ${poll?.question}`, reply.id, target?.author_id ?? null);
    return reply;
  });
  refreshForumQuests([actor.id]);
  return created;
}

export async function changeForumReply(actor: ForumActor, topicId: string, id: string, input: Record<string, unknown>, remove = false) {
  return prisma.$transaction(async tx => {
    const topic = await lockedTopic(tx, topicId, actor);
    const reply = await tx.forumReply.findFirst({ where: { id, topic_id: topicId, deleted_at: null } });
    if (!reply) throw notFound('Reply not found.');
    if (remove) {
      if (!isForumStaff(actor)) assertForumAuthor(actor, reply.author_id);
      const now = new Date();
      const removed = await tx.forumReply.update({ where: { id }, data: { deleted_at: now, deleted_by_id: actor.id } });
      await tx.forumReport.updateMany({ where: { topic_id: topicId, reply_id: id, resolved_at: null }, data: { resolved_at: now, resolved_by_id: actor.id } });
      await forgetForumReply(tx, topic, id);
      const latest = await tx.forumReply.findFirst({ where: { topic_id: topicId, deleted_at: null }, orderBy: [{ created_at: 'desc' }, { id: 'desc' }], select: { created_at: true } });
      await tx.forumTopic.update({ where: { id: topicId }, data: {
        last_activity_at: latest?.created_at || topic.created_at,
        ...(topic.accepted_reply_id === id ? { accepted_reply_id: null } : {}),
      } });
      return removed;
    }
    assertForumAuthor(actor, reply.author_id);
    if (topic.locked) throw forbidden('Replies in a locked topic cannot be edited.');
    const hasPoll = !!await tx.forumPoll.findUnique({ where: { reply_id: id }, select: { id: true } });
    const text = hasPoll && typeof input.body === 'string' && !input.body.trim() ? '' : forumText(input.body, 'Reply', 1, 5000);
    return tx.forumReply.update({ where: { id }, data: { body: text } });
  });
}

export async function acceptForumAnswer(actor: ForumActor, topicId: string, input: Record<string, unknown>) {
  const replyId = input.reply_id === null ? null : forumText(input.reply_id, 'Reply', 1, 100);
  const result = await prisma.$transaction(async tx => {
    const topic = await lockedTopic(tx, topicId, actor);
    assertForumAuthor(actor, topic.author_id);
    if (topic.category_id !== 'help') throw badRequest('Only Tech Support questions can have an accepted answer.');
    if (topic.locked) throw forbidden('The answer of a locked topic cannot be changed.');
    const reply = replyId ? await tx.forumReply.findFirst({ where: { id: replyId, topic_id: topicId, deleted_at: null }, select: { author_id: true } }) : null;
    if (replyId && !reply) throw notFound('Reply not found.');
    const updated = await tx.forumTopic.update({ where: { id: topicId }, data: { accepted_reply_id: replyId } });
    return { updated, answerAuthorId: reply?.author_id };
  });
  // The answer's author may complete "accepted answers"; the asker "questions solved".
  if (result.answerAuthorId) refreshForumQuests([result.answerAuthorId, actor.id]);
  return result.updated;
}

export async function voteForumPoll(actor: ForumActor, topicId: string, input: Record<string, unknown>) {
  return prisma.$transaction(async tx => {
    const topic = await tx.forumTopic.findFirst({ where: { id: topicId, deleted_at: null, AND: [visibleTopicWhere(actor)] }, select: { locked: true, poll: { select: { id: true } } } });
    if (!topic?.poll) throw notFound('Poll not found.');
    if (topic.locked) throw forbidden('Voting is closed on a locked topic.');
    await castPollVote(tx, topic.poll.id, actor.id, input);
    return projectPoll(await tx.forumPoll.findUnique({ where: { id: topic.poll.id }, select: pollSelect }), actor.id);
  });
}

/** Repost or undo a repost. People cannot repost their own posts. */
export async function repostForumTopic(actor: ForumActor, topicId: string, input: Record<string, unknown>) {
  if (typeof input.reposted !== 'boolean') throw badRequest('A reposted value is required.');
  const reposted = input.reposted;
  return prisma.$transaction(async tx => {
    const topic = await tx.forumTopic.findFirst({ where: { id: topicId, deleted_at: null, AND: [visibleTopicWhere(actor)] }, select: { id: true, title: true, author_id: true, visibility: true } });
    if (!topic) throw notFound('Topic not found.');
    if (reposted && topic.author_id === actor.id) throw badRequest('You cannot repost your own post.');
    if (reposted && topic.visibility !== 'PUBLIC') throw badRequest('Only public posts can be reposted.');
    const key = { user_id_topic_id: { user_id: actor.id, topic_id: topicId } };
    if (reposted) await tx.forumTopicRepost.upsert({ where: key, create: { user_id: actor.id, topic_id: topicId }, update: {} });
    else await tx.forumTopicRepost.deleteMany({ where: { user_id: actor.id, topic_id: topicId } });
    await syncForumRepostNotification(tx, actor, reposted, topic);
    return { reposted, repost_count: await tx.forumTopicRepost.count({ where: { topic_id: topicId } }) };
  });
}

/** A small card for a topic link shared in a group chat: no read-state change and no body beyond a snippet. */
export async function forumTopicPreview(actor: ForumActor, id: string) {
  const topic = await prisma.forumTopic.findFirst({ where: { id, deleted_at: null, AND: [visibleTopicWhere(actor)] }, select: { id: true, title: true, body: true, category_id: true, created_at: true,
    author: { select: { id: true, name: true, avatar_url: true } }, poll: { select: { id: true } }, _count: { select: { likes: true, replies: { where: { deleted_at: null } } } } } });
  if (!topic) throw notFound('Topic not found.');
  const image = /!\[[^\]]*\]\((\/(?!\/)[^\s)]+|https:\/\/[^\s)]+)\)/.exec(topic.body)?.[1] || null;
  const snippet = topic.body.replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[#>*_`~|-]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);
  return { id: topic.id, title: topic.title, category_id: topic.category_id, created_at: topic.created_at, author: topic.author, snippet, image,
    has_poll: !!topic.poll, like_count: topic._count.likes, comment_count: topic._count.replies };
}

export async function voteForumReplyPoll(actor: ForumActor, topicId: string, replyId: string, input: Record<string, unknown>) {
  return prisma.$transaction(async tx => {
    const topic = await tx.forumTopic.findFirst({ where: { id: topicId, deleted_at: null, AND: [visibleTopicWhere(actor)] }, select: { locked: true } });
    const reply = topic && await tx.forumReply.findFirst({ where: { id: replyId, topic_id: topicId, deleted_at: null }, select: { poll: { select: { id: true } } } });
    if (!topic || !reply?.poll) throw notFound('Poll not found.');
    if (topic.locked) throw forbidden('Voting is closed on a locked topic.');
    await castPollVote(tx, reply.poll.id, actor.id, input);
    return projectPoll(await tx.forumPoll.findUnique({ where: { id: reply.poll.id }, select: pollSelect }), actor.id);
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
  if (!Object.keys(data).length) throw badRequest('A preference is required.');
  return prisma.$transaction(async tx => {
    await lockedTopic(tx, id, actor);
    return tx.forumTopicState.upsert({ where: { user_id_topic_id: { user_id: actor.id, topic_id: id } },
      create: { user_id: actor.id, topic_id: id, ...data }, update: data });
  });
}

export async function likeForumPost(actor: ForumActor, topicId: string, replyId: string | undefined, input: Record<string, unknown>) {
  if (typeof input.liked !== 'boolean') throw badRequest('A liked value is required.');
  const liked = input.liked;
  return prisma.$transaction(async tx => {
    const topic = await tx.forumTopic.findFirst({ where: { id: topicId, deleted_at: null, AND: [visibleTopicWhere(actor)] }, select: { id: true, title: true, author_id: true } });
    if (!topic) throw notFound('Topic not found.');
    if (replyId) {
      const reply = await tx.forumReply.findFirst({ where: { id: replyId, topic_id: topicId, deleted_at: null }, select: { id: true, author_id: true } });
      if (!reply) throw notFound('Reply not found.');
      const key = { user_id_reply_id: { user_id: actor.id, reply_id: replyId } };
      if (liked) await tx.forumReplyLike.upsert({ where: key, create: { user_id: actor.id, reply_id: replyId }, update: {} });
      else await tx.forumReplyLike.deleteMany({ where: { user_id: actor.id, reply_id: replyId } });
      await syncForumLikeNotification(tx, actor, liked, topic, reply);
      return { liked, like_count: await tx.forumReplyLike.count({ where: { reply_id: replyId } }) };
    }
    const key = { user_id_topic_id: { user_id: actor.id, topic_id: topicId } };
    if (liked) await tx.forumTopicLike.upsert({ where: key, create: { user_id: actor.id, topic_id: topicId }, update: {} });
    else await tx.forumTopicLike.deleteMany({ where: { user_id: actor.id, topic_id: topicId } });
    await syncForumLikeNotification(tx, actor, liked, topic, null);
    return { liked, like_count: await tx.forumTopicLike.count({ where: { topic_id: topicId } }) };
  });
}

export async function reportForumPost(actor: ForumActor, id: string, input: Record<string, unknown>) {
  const reason = forumText(input.reason, 'Report reason', 10, 1000);
  const replyId = input.reply_id === undefined ? undefined : forumText(input.reply_id, 'Reply', 1, 100);
  return prisma.$transaction(async tx => {
    const topic = await lockedTopic(tx, id, actor);
    const reply = replyId ? await tx.forumReply.findFirst({ where: { id: replyId, topic_id: id, deleted_at: null } }) : null;
    if (replyId && !reply) throw notFound('Reply not found.');
    if ((reply ? reply.author_id : topic.author_id) === actor.id) throw badRequest('You cannot report your own post.');
    const existing = await tx.forumReport.findFirst({ where: { topic_id: id, reply_id: replyId || null, reporter_id: actor.id, resolved_at: null } });
    if (existing) return existing;
    return tx.forumReport.create({ data: { topic_id: id, reply_id: replyId, reporter_id: actor.id, reason } });
  });
}

export async function listForumReports(actor: ForumActor, page: number) {
  if (!isForumStaff(actor)) throw forbidden('Moderation permission is required.');
  const where = { resolved_at: null };
  const [total, reports] = await prisma.$transaction([
    prisma.forumReport.count({ where }),
    prisma.forumReport.findMany({ where, orderBy: [{ created_at: 'asc' }, { id: 'asc' }], skip: (page - 1) * pageSize, take: pageSize,
      include: { reporter: { select: author }, topic: { select: { title: true, body: true, deleted_at: true } }, reply: { select: { body: true, deleted_at: true } } } }),
  ]);
  return { reports: reports.map(report => ({ ...report, reporter: publicForumAuthor(report.reporter) })), total, page, pageSize };
}

export async function resolveForumReport(actor: ForumActor, id: string) {
  if (!isForumStaff(actor)) throw forbidden('Moderation permission is required.');
  const result = await prisma.forumReport.updateMany({ where: { id, resolved_at: null }, data: { resolved_at: new Date(), resolved_by_id: actor.id } });
  if (!result.count) throw notFound('Open report not found.');
  return { ok: true };
}

export async function forumPostLikers(actor: ForumActor, topicId: string, replyId: string | undefined, page: number) {
  return prisma.$transaction(async tx => {
    if (!await tx.forumTopic.findFirst({ where: { id: topicId, deleted_at: null, AND: [visibleTopicWhere(actor)] }, select: { id: true } })) throw notFound('Topic not found.');
    if (replyId && !await tx.forumReply.findFirst({ where: { id: replyId, topic_id: topicId, deleted_at: null }, select: { id: true } })) throw notFound('Reply not found.');
    const args = { orderBy: [{ created_at: 'desc' as const }, { user_id: 'asc' as const }], skip: (page - 1) * 20, take: 20, select: { user: { select: author } } };
    const total = replyId ? await tx.forumReplyLike.count({ where: { reply_id: replyId } }) : await tx.forumTopicLike.count({ where: { topic_id: topicId } });
    const rows = replyId ? await tx.forumReplyLike.findMany({ ...args, where: { reply_id: replyId } }) : await tx.forumTopicLike.findMany({ ...args, where: { topic_id: topicId } });
    return { people: rows.map(row => publicForumAuthor(row.user)), total, page, pageSize: 20 };
  });
}
