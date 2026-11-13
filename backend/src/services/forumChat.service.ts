import { Prisma } from '@prisma/client';
import prisma from './prisma';
import { badRequest, forbidden, notFound } from '../utils/http';
import { ForumActor, forumText } from './forumPolicy';
import { assertForumPosting } from './forumIdentity.service';

// Chat deliberately never joins public topic search, stats, mentions or notifications.
export const chatAttachmentSelect = { id: true, original_name: true, byte_size: true };
const person = { id: true, name: true, role: true, avatar_url: true,
  cube_profile: { select: { cube_number: true } } } satisfies Prisma.UserSelect;
const eligible: Prisma.UserWhereInput = { OR: [{ role: { in: ['ADMIN', 'MENTOR'] } },
  { role: 'CUBE', cube_profile: { is: { current_level: { notIn: ['Alumni', 'Former_Cube'] } } } }] };
const roomSummary = { id: true, name: true, updated_at: true, _count: { select: { members: true } } };
const size = 25;
function admin(actor: ForumActor) { if (actor.role !== 'ADMIN') throw forbidden('Only admins can manage chat rooms.'); }
async function lockRoom(tx: Prisma.TransactionClient, id: string) {
  await tx.$queryRaw`SELECT id FROM "ForumChatRoom" WHERE id = ${id} FOR UPDATE`;
  const room = await tx.forumChatRoom.findUnique({ where: { id } });
  if (!room) throw notFound('Chat room not found.');
  return room;
}
async function membership(tx: Prisma.TransactionClient, actor: ForumActor, id: string) {
  const room = await lockRoom(tx, id);
  if (!await tx.forumChatMember.findUnique({ where: { room_id_user_id: { room_id: id, user_id: actor.id } } })) {
    // Same response for absent and inaccessible ids. Admin management is a separate endpoint.
    throw notFound('Chat room not found.');
  }
  return room;
}
async function validateMembers(tx: Prisma.TransactionClient, ids: string[]) {
  if (await tx.user.count({ where: { AND: [eligible, { id: { in: ids } }] } }) !== ids.length) {
    throw badRequest('Select active portal accounts only.');
  }
}
export async function chatPeople(actor: ForumActor, query: string, page: number) {
  admin(actor);
  const where = { AND: [eligible, { name: { contains: query, mode: 'insensitive' as const } }] };
  const [total, people] = await prisma.$transaction([prisma.user.count({ where }),
    prisma.user.findMany({ where, select: person, orderBy: [{ name: 'asc' }, { id: 'asc' }], skip: (page - 1) * size, take: size })]);
  return { people, total, page, pageSize: size };
}
export async function listChatRooms(actor: ForumActor, page: number, manage = false) {
  if (manage) admin(actor);
  const where = manage ? {} : { members: { some: { user_id: actor.id } } };
  const [total, rooms] = await prisma.$transaction([prisma.forumChatRoom.count({ where }),
    prisma.forumChatRoom.findMany({ where, select: roomSummary, orderBy: [{ updated_at: 'desc' }, { id: 'asc' }], skip: (page - 1) * size, take: size })]);
  return { rooms, total, page, pageSize: size };
}
export async function createChatRoom(actor: ForumActor, input: Record<string, unknown>) {
  admin(actor);
  const name = forumText(input.name, 'Room name', 1, 80);
  if (!Array.isArray(input.member_ids) || input.member_ids.length > 99 || !input.member_ids.every(id => typeof id === 'string' && id.length > 0 && id.length <= 100)) {
    throw badRequest('Choose up to 99 members.');
  }
  const ids = [...new Set([actor.id, ...input.member_ids as string[]])];
  return prisma.$transaction(async tx => {
    await validateMembers(tx, ids);
    return tx.forumChatRoom.create({ data: { name, created_by_id: actor.id, members: { create: ids.map(user_id => ({ user_id })) } }, select: roomSummary });
  });
}
export async function chatRoomDetails(actor: ForumActor, id: string, manage = false) {
  if (manage) admin(actor);
  return prisma.$transaction(async tx => {
    const room = manage ? await lockRoom(tx, id) : await membership(tx, actor, id);
    const members = await tx.forumChatMember.findMany({ where: { room_id: id }, select: { user: { select: person } }, orderBy: { joined_at: 'asc' } });
    const typing = manage ? [] : await tx.forumChatMember.findMany({ where: { room_id: id, user_id: { not: actor.id }, typing_until: { gt: new Date() } }, select: { user: { select: { id: true, name: true } } } });
    return { id: room.id, name: room.name, members: members.map(row => row.user), typing: typing.map(row => row.user) };
  });
}
export async function changeChatMember(actor: ForumActor, roomId: string, userId: string, remove: boolean) {
  admin(actor);
  return prisma.$transaction(async tx => {
    await lockRoom(tx, roomId);
    if (remove) await tx.forumChatMember.deleteMany({ where: { room_id: roomId, user_id: userId } });
    else {
      await validateMembers(tx, [userId]);
      const existing = await tx.forumChatMember.findUnique({ where: { room_id_user_id: { room_id: roomId, user_id: userId } } });
      if (!existing && await tx.forumChatMember.count({ where: { room_id: roomId } }) >= 100) throw badRequest('A room can have up to 100 members.');
      await tx.forumChatMember.upsert({ where: { room_id_user_id: { room_id: roomId, user_id: userId } }, create: { room_id: roomId, user_id: userId }, update: {} });
    }
    return { ok: true };
  });
}
export async function withChatMember<T>(actor: ForumActor, id: string, fn: (tx: Prisma.TransactionClient) => Promise<T>) {
  return prisma.$transaction(async tx => { await membership(tx, actor, id); return fn(tx); });
}
export const CHAT_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
export async function chatMessages(actor: ForumActor, id: string, page: number, query = '') {
  return withChatMember(actor, id, async tx => {
    const where: Prisma.ForumChatMessageWhereInput = { room_id: id, ...(query ? { deleted_at: null, body: { contains: query, mode: 'insensitive' } } : {}) };
    const total = await tx.forumChatMessage.count({ where });
    const messages = await tx.forumChatMessage.findMany({ where, orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * 50, take: 50, select: { id: true, body: true, created_at: true, edited_at: true, deleted_at: true,
        author: { select: person }, attachments: { select: chatAttachmentSelect }, reactions: { select: { user_id: true, emoji: true } },
        reply_to: { select: { id: true, body: true, deleted_at: true, author: { select: { name: true } } } } } });
    const readers = await tx.forumChatMember.findMany({ where: { room_id: id }, select: { user_id: true, read_at: true, read_message_id: true } });
    return { messages: messages.reverse().map(message => ({ ...message,
      ...(message.deleted_at ? { body: '', attachments: [], reactions: [], reply_to: null } : {}),
      reply_to: !message.deleted_at && message.reply_to ? { ...message.reply_to, body: message.reply_to.deleted_at ? '' : message.reply_to.body.slice(0, 160) } : null,
      read_by: readers.filter(reader => reader.user_id !== message.author?.id && reader.read_at && (reader.read_at > message.created_at || (+reader.read_at === +message.created_at && (!reader.read_message_id || reader.read_message_id >= message.id)))).map(reader => reader.user_id)
    })), total, page, pageSize: 50 };
  });
}
function messageBody(value: unknown, hasAttachments: boolean) {
  if (typeof value !== 'string' || value.length > 5000 || (!value.trim() && !hasAttachments)) throw badRequest('Write a message or attach a file (up to 5,000 characters).');
  return value.trim();
}
export async function sendChatMessage(actor: ForumActor, id: string, input: Record<string, unknown>) {
  await assertForumPosting(actor);
  const ids = input.attachment_ids ?? [];
  if (!Array.isArray(ids) || ids.length > 5 || !ids.every(value => typeof value === 'string') || new Set(ids).size !== ids.length) throw badRequest('Attach up to five files.');
  const body = messageBody(input.body, ids.length > 0);
  const replyId = input.reply_to_id === undefined || input.reply_to_id === null ? null : forumText(input.reply_to_id, 'Reply', 1, 100);
  return withChatMember(actor, id, async tx => {
    if (replyId && !await tx.forumChatMessage.findFirst({ where: { id: replyId, room_id: id, deleted_at: null } })) throw notFound('Reply target not found.');
    if (await tx.forumChatAttachment.count({ where: { id: { in: ids }, room_id: id, uploader_id: actor.id, message_id: null } }) !== ids.length) throw badRequest('An attachment is no longer available.');
    const message = await tx.forumChatMessage.create({ data: { room_id: id, author_id: actor.id, body, reply_to_id: replyId }, select: { id: true } });
    if (ids.length) await tx.forumChatAttachment.updateMany({ where: { id: { in: ids } }, data: { message_id: message.id } });
    await tx.forumChatMember.update({ where: { room_id_user_id: { room_id: id, user_id: actor.id } }, data: { typing_until: null } });
    await tx.forumChatRoom.update({ where: { id }, data: { updated_at: new Date() } });
    return message;
  });
}
export async function editChatMessage(actor: ForumActor, roomId: string, messageId: string, input: Record<string, unknown>, remove = false) {
  await assertForumPosting(actor);
  return withChatMember(actor, roomId, async tx => {
    const message = await tx.forumChatMessage.findFirst({ where: { id: messageId, room_id: roomId, deleted_at: null }, include: { _count: { select: { attachments: true } } } });
    if (!message) throw notFound('Message not found.');
    if (message.author_id !== actor.id) throw forbidden('You can only change your own messages.');
    await tx.forumChatMessage.update({ where: { id: messageId }, data: remove ? { body: '', deleted_at: new Date() } : { body: messageBody(input.body, message._count.attachments > 0), edited_at: new Date() } });
    if (remove) await tx.forumChatReaction.deleteMany({ where: { message_id: messageId } });
    return { ok: true };
  });
}
export async function reactToChatMessage(actor: ForumActor, roomId: string, messageId: string, input: Record<string, unknown>) {
  await assertForumPosting(actor);
  if (input.emoji !== null && (typeof input.emoji !== 'string' || !CHAT_REACTIONS.includes(input.emoji))) throw badRequest('Choose a supported emoji.');
  return withChatMember(actor, roomId, async tx => {
    if (!await tx.forumChatMessage.findFirst({ where: { id: messageId, room_id: roomId, deleted_at: null } })) throw notFound('Message not found.');
    if (input.emoji === null) await tx.forumChatReaction.deleteMany({ where: { message_id: messageId, user_id: actor.id } });
    else await tx.forumChatReaction.upsert({ where: { message_id_user_id: { message_id: messageId, user_id: actor.id } }, create: { message_id: messageId, user_id: actor.id, emoji: input.emoji as string }, update: { emoji: input.emoji as string } });
    return { ok: true };
  });
}
export async function chatPresence(actor: ForumActor, roomId: string, input: Record<string, unknown>) {
  if (typeof input.typing !== 'boolean') throw badRequest('A typing value is required.');
  const readId = input.read_message_id === undefined || input.read_message_id === null ? null : forumText(input.read_message_id, 'Read message', 1, 100);
  return withChatMember(actor, roomId, async tx => {
    const member = await tx.forumChatMember.findUniqueOrThrow({ where: { room_id_user_id: { room_id: roomId, user_id: actor.id } } });
    const message = readId ? await tx.forumChatMessage.findFirst({ where: { id: readId, room_id: roomId }, select: { created_at: true } }) : null;
    if (readId && !message) throw notFound('Message not found.');
    await tx.forumChatMember.update({ where: { room_id_user_id: { room_id: roomId, user_id: actor.id } }, data: {
      typing_until: input.typing ? new Date(Date.now() + 8000) : null,
      ...(message && (!member.read_at || message.created_at > member.read_at || (+message.created_at === +member.read_at && !!member.read_message_id && readId! > member.read_message_id)) ? { read_at: message.created_at, read_message_id: readId } : {})
    } });
    return { ok: true };
  });
}

/** Aggregate only memberships belonging to the caller, never the admin-management room list. */
export async function chatUnread(actor: ForumActor) {
  const rows = await prisma.$queryRaw<Array<{ room_id: string; unread: bigint }>>`
    SELECT member.room_id, count(*) AS unread
    FROM "ForumChatMember" member
    JOIN "ForumChatMessage" message ON message.room_id = member.room_id
    WHERE member.user_id = ${actor.id} AND message.author_id IS DISTINCT FROM ${actor.id}
      AND message.deleted_at IS NULL
      AND (member.read_at IS NULL OR message.created_at > member.read_at
        OR (message.created_at = member.read_at AND member.read_message_id IS NOT NULL AND message.id > member.read_message_id))
    GROUP BY member.room_id
  `;
  const rooms = rows.map(row => ({ id: row.room_id, count: Number(row.unread) }));
  return { total: rooms.reduce((sum, room) => sum + room.count, 0), rooms };
}
