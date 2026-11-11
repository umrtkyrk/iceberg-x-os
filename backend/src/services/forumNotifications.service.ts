import { Prisma } from '@prisma/client';
import prisma from './prisma';
import { ForumActor } from './forumPolicy';

export function forumMentionHandles(body: string): string[] {
  let fence: { marker: string; length: number } | null = null;
  const prose = body.split(/\r?\n/).map(line => {
    // Ignore quotations and indented code before looking for fenced blocks.
    if (/^\s*>/.test(line) || /^(?: {4}|\t)/.test(line)) return '';
    const delimiter = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (fence) {
      if (delimiter && delimiter[1][0] === fence.marker && delimiter[1].length >= fence.length && !delimiter[2].trim()) fence = null;
      return '';
    }
    if (delimiter) { fence = { marker: delimiter[1][0], length: delimiter[1].length }; return ''; }
    return line;
  }).join('\n').replace(/(`+)([\s\S]*?)\1(?!`)/g, '');
  return [...new Set(Array.from(prose.matchAll(/(?:^|[\s(])@(cube-\d{1,6}|user-[a-f0-9-]{36})(?![\w-])/gi), m => m[1].toLowerCase()))].slice(0, 10);
}
const eligible: Prisma.UserWhereInput = { OR: [
  { role: { in: ['ADMIN', 'MENTOR'] } },
  { role: 'CUBE', cube_profile: { is: { current_level: { notIn: ['Alumni', 'Former_Cube'] } } } },
] };

export async function forumMentionPeople(query: string) {
  const users = await prisma.user.findMany({ where: { AND: [eligible, { name: { contains: query, mode: 'insensitive' } }] },
    take: 10, orderBy: { name: 'asc' }, select: { id: true, name: true, cube_profile: { select: { cube_number: true } } } });
  return users.map(user => ({ id: user.id, name: user.name, handle: user.cube_profile ? `cube-${user.cube_profile.cube_number}` : `user-${user.id}` }));
}

export async function notifyForumEvent(tx: Prisma.TransactionClient, actor: ForumActor, topic: { id: string; title: string; author_id: string | null }, body: string, replyId?: string) {
  const handles = forumMentionHandles(body);
  const users = handles.filter(h => h.startsWith('user-')).map(h => h.slice(5));
  const numbers = handles.filter(h => h.startsWith('cube-')).map(h => h.slice(5).padStart(3, '0'));
  const followed = replyId ? await tx.forumTopicState.findMany({ where: { topic_id: topic.id, following: true }, select: { user_id: true } }) : [];
  const ids = [...new Set([...followed.map(f => f.user_id), ...(replyId && topic.author_id ? [topic.author_id] : []), ...users])];
  if (!ids.length && !numbers.length) return;
  const recipients = await tx.user.findMany({ where: { AND: [eligible, { id: { not: actor.id } }, { OR: [
    { id: { in: ids } }, { cube_profile: { is: { cube_number: { in: numbers } } } },
  ] }] }, select: { id: true } });
  // One row per recipient/event even when owner, follower and mention overlap.
  for (const recipient of recipients) {
    if (replyId && recipient.id === topic.author_id) { await notifyTopicOwner(tx, recipient.id, topic, body, replyId); continue; }
    await tx.notification.create({ data: {
    user_id: recipient.id, message: `${replyId ? 'New reply or mention' : 'You were mentioned'} in “${topic.title}”.`,
    forum_target: { create: { topic_id: topic.id, ...(replyId ? { reply_id: replyId } : {}) } },
    } });
  }
}

const OWNER_REPLY = 'commented on your post';
/** Plain one-line text of a comment for a notification: mentions as names, no images or formatting marks. */
export function forumNotificationSnippet(body: string, max = 140) {
  const text = body.replace(/\[@([^\]\n]{1,80})\]\(@[^)\s]+\)/g, '@$1').replace(/!\[[^\]\n]*\]\([^)\n]*\)/g, ' ')
    .replace(/^\s*>.*$/gm, ' ').replace(/[#*_`~]/g, '').replace(/\s+/g, ' ').trim();
  return text.length > max ? text.slice(0, max - 1).trimEnd() + '…' : text;
}
/** "A", "A and B", "A, B and C", "A, B, C and 2 others". */
export function forumPeopleList(names: string[]) {
  if (names.length <= 1) return names[0] || 'Someone';
  if (names.length <= 3) return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  const others = names.length - 3;
  return `${names.slice(0, 3).join(', ')} and ${others} ${others === 1 ? 'other' : 'others'}`;
}

/**
 * The post owner gets one notification per topic that names everyone who commented since they last read
 * it and quotes the newest comment. An unread one is updated and moved to the top instead of adding rows.
 */
async function notifyTopicOwner(tx: Prisma.TransactionClient, ownerId: string, topic: { id: string; title: string }, body: string, replyId: string) {
  const state = await tx.forumTopicState.findUnique({ where: { user_id_topic_id: { user_id: ownerId, topic_id: topic.id } }, select: { read_at: true } });
  const recent = await tx.forumReply.findMany({ where: { topic_id: topic.id, deleted_at: null, author_id: { not: ownerId },
    ...(state?.read_at ? { created_at: { gt: state.read_at } } : {}) }, orderBy: [{ created_at: 'desc' }, { id: 'desc' }], take: 50,
    select: { author: { select: { name: true } } } });
  const names = [...new Set(recent.map(reply => reply.author?.name?.trim() || 'A Cube'))];
  const snippet = forumNotificationSnippet(body);
  const message = `${forumPeopleList(names)} ${OWNER_REPLY} “${topic.title}”${snippet ? `: “${snippet}”` : '.'}`;
  const existing = await tx.notification.findFirst({ where: { user_id: ownerId, read_at: null, message: { contains: OWNER_REPLY },
    forum_target: { is: { topic_id: topic.id } } }, orderBy: { created_at: 'desc' }, select: { id: true } });
  if (existing) {
    await tx.notification.update({ where: { id: existing.id }, data: { message, created_at: new Date(),
      forum_target: { update: { reply_id: replyId } } } });
    return;
  }
  await tx.notification.create({ data: { user_id: ownerId, message, forum_target: { create: { topic_id: topic.id, reply_id: replyId } } } });
}

export async function forumNotificationLinks(ids: string[]) {
  return prisma.forumNotificationTarget.findMany({ where: { notification_id: { in: ids } },
    select: { notification_id: true, topic_id: true, reply_id: true, topic: { select: { deleted_at: true } }, reply: { select: { deleted_at: true } } } });
}
