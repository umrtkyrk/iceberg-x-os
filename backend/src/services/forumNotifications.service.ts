import { Prisma } from '@prisma/client';
import prisma from './prisma';
import { ForumActor } from './forumPolicy';

export function forumMentionHandles(body: string): string[] {
  const prose = body.replace(/```[\s\S]*?(?:```|$)/g, '').replace(/`[^`\n]*`/g, '').replace(/^\s*>.*$/gm, '');
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
  for (const recipient of recipients) await tx.notification.create({ data: {
    user_id: recipient.id, message: `“${topic.title}” konusunda ${replyId ? 'yeni bir yanıt var veya senden bahsedildi.' : 'senden bahsedildi.'}`,
    forum_target: { create: { topic_id: topic.id, ...(replyId ? { reply_id: replyId } : {}) } },
  } });
}

export async function forumNotificationLinks(ids: string[]) {
  return prisma.forumNotificationTarget.findMany({ where: { notification_id: { in: ids } },
    select: { notification_id: true, topic_id: true, reply_id: true, topic: { select: { deleted_at: true } }, reply: { select: { deleted_at: true } } } });
}
