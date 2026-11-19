import { Prisma } from '@prisma/client';
import prisma from './prisma';
import { badRequest, forbidden, notFound } from '../utils/http';
import { ForumActor, forumText } from './forumPolicy';
import { assertForumPosting } from './forumIdentity.service';
import { githubActivity, parseGithubRepo } from './forumGithub.service';
import { openText, sealText } from './forumChatCrypto.service';
import { castPollVote, createPoll, pollInput, pollSelect, projectPoll } from './forumPoll.service';

/**
 * Private rooms work like WhatsApp groups. Any active portal user can start one and becomes its group
 * admin; group admins add and remove people, appoint other admins and choose who may edit the group
 * info or send messages. Everything said in a room (name, description, messages, file names, tasks,
 * links, repository) is stored encrypted and is visible only to the room's members: portal Admins
 * and Mentors have no special access, and an inaccessible room answers exactly like a missing one.
 * Chat never joins public topic search, stats, mentions or notifications.
 */
type Tx = Prisma.TransactionClient;
export type ChatRole = 'ADMIN' | 'MEMBER';
export const chatAttachmentSelect = { id: true, original_name: true, byte_size: true };
const person = { id: true, name: true, role: true, avatar_url: true,
  cube_profile: { select: { cube_number: true } } } satisfies Prisma.UserSelect;
const eligible: Prisma.UserWhereInput = { OR: [{ role: { in: ['ADMIN', 'MENTOR'] } },
  { role: 'CUBE', cube_profile: { is: { current_level: { notIn: ['Alumni', 'Former_Cube'] } } } }] };
const size = 25;
const MAX_MEMBERS = 100;
const taskSelect = { id: true, title: true, status: true, created_at: true, creator: { select: { id: true, name: true } } } satisfies Prisma.ForumChatTaskSelect;
export const MAX_ROOM_REPOS = 5;
function roomRepos(roomId: string, stored: string | null) {
  const value = openText(roomId, stored);
  if (!value) return [] as string[];
  if (!value.startsWith('[')) return [value];
  try { const list = JSON.parse(value); return Array.isArray(list) ? list.filter((item): item is string => typeof item === 'string') : []; } catch { return []; }
}
const MAX_PINS = 3;
const pinnedPreview = (roomId: string, row: { body: string; poll: { question: string } | null; _count: { attachments: number } }) =>
  (openText(roomId, row.body) || (row.poll ? `📊 ${openText(roomId, row.poll.question)}` : row._count.attachments ? 'Attachment' : '')).slice(0, 160);
const linkSelect = { id: true, title: true, url: true, created_at: true } satisfies Prisma.ForumChatLinkSelect;

async function lockRoom(tx: Tx, id: string) {
  await tx.$queryRaw`SELECT id FROM "ForumChatRoom" WHERE id = ${id} FOR UPDATE`;
  const room = await tx.forumChatRoom.findUnique({ where: { id } });
  if (!room) throw notFound('Chat room not found.');
  return room;
}
async function membership(tx: Tx, actor: ForumActor, id: string) {
  const room = await lockRoom(tx, id);
  const member = await tx.forumChatMember.findUnique({ where: { room_id_user_id: { room_id: id, user_id: actor.id } } });
  // Same response for absent and inaccessible ids, whatever the caller's portal role.
  if (!member) throw notFound('Chat room not found.');
  return { room, member };
}
function assertGroupAdmin(member: { role: string }, action: string) {
  if (member.role !== 'ADMIN') throw forbidden(`Only group admins can ${action}.`);
}
async function validateMembers(tx: Tx, ids: string[]) {
  if (await tx.user.count({ where: { AND: [eligible, { id: { in: ids } }] } }) !== ids.length) {
    throw badRequest('Select active portal accounts only.');
  }
}
function userIds(value: unknown, max: number) {
  if (!Array.isArray(value) || value.length > max || !value.every(id => typeof id === 'string' && id.length > 0 && id.length <= 100)) throw badRequest(`Choose up to ${max} people.`);
  return [...new Set(value as string[])];
}
const roomText = (roomId: string, value: unknown, label: string, min: number, max: number) => sealText(roomId, forumText(value, label, min, max));
function roomDescription(value: unknown) {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value !== 'string' || value.trim().length > 500) throw badRequest('Description can be up to 500 characters.');
  return value.trim();
}

export async function withChatMember<T>(actor: ForumActor, id: string, fn: (tx: Tx, member: { role: string }) => Promise<T>) {
  return prisma.$transaction(async tx => { const { member } = await membership(tx, actor, id); return fn(tx, member); });
}

/** People who can be added to a room. Any signed-in user may search; only names and Cube numbers are returned. */
export async function chatPeople(_actor: ForumActor, query: string, page: number) {
  const where = { AND: [eligible, { name: { contains: query, mode: 'insensitive' as const } }] };
  const [total, people] = await prisma.$transaction([prisma.user.count({ where }),
    prisma.user.findMany({ where, select: person, orderBy: [{ name: 'asc' }, { id: 'asc' }], skip: (page - 1) * size, take: size })]);
  return { people, total, page, pageSize: size };
}

/** The caller's rooms, newest activity first, with the last message like a chat list. */
export async function listChatRooms(actor: ForumActor, page: number) {
  const where = { members: { some: { user_id: actor.id } } };
  const [total, rooms] = await prisma.$transaction([prisma.forumChatRoom.count({ where }),
    prisma.forumChatRoom.findMany({ where, orderBy: [{ updated_at: 'desc' }, { id: 'asc' }], skip: (page - 1) * size, take: size,
      select: { id: true, name: true, updated_at: true, _count: { select: { members: true } },
        members: { where: { user_id: actor.id }, select: { role: true } },
        messages: { orderBy: [{ created_at: 'desc' }, { id: 'desc' }], take: 1,
          select: { body: true, deleted_at: true, created_at: true, author: { select: { id: true, name: true } }, poll: { select: { question: true } }, _count: { select: { attachments: true } } } } } })]);
  return { rooms: rooms.map(({ members, messages, ...room }) => {
    const last = messages[0];
    return { ...room, name: openText(room.id, room.name), my_role: members[0]?.role || 'MEMBER',
      last_message: last ? { created_at: last.created_at, author: last.author, deleted: !!last.deleted_at,
        body: last.deleted_at ? '' : (openText(room.id, last.body) || (last.poll ? `📊 ${openText(room.id, last.poll.question)}` : '') || (last._count.attachments ? 'Attachment' : '')).slice(0, 120) } : null };
  }), total, page, pageSize: size };
}

export async function createChatRoom(actor: ForumActor, input: Record<string, unknown>) {
  await assertForumPosting(actor);
  const name = forumText(input.name, 'Group name', 1, 80);
  const description = roomDescription(input.description);
  const ids = userIds(input.member_ids ?? [], MAX_MEMBERS - 1).filter(id => id !== actor.id);
  return prisma.$transaction(async tx => {
    await validateMembers(tx, [actor.id, ...ids]);
    const room = await tx.forumChatRoom.create({ data: { name: '', created_by_id: actor.id, members: { create: [
      { user_id: actor.id, role: 'ADMIN' }, ...ids.map(user_id => ({ user_id })),
    ] } }, select: { id: true } });
    // The id is part of the encryption context, so the name is sealed once the row exists.
    await tx.forumChatRoom.update({ where: { id: room.id }, data: { name: sealText(room.id, name), description: description ? sealText(room.id, description) : null } });
    return { id: room.id, name, _count: { members: ids.length + 1 } };
  });
}

export async function chatRoomDetails(actor: ForumActor, id: string) {
  return prisma.$transaction(async tx => {
    const { room, member } = await membership(tx, actor, id);
    const [members, typing, tasks, links, pinned] = await Promise.all([
      tx.forumChatMember.findMany({ where: { room_id: id }, select: { role: true, joined_at: true, user: { select: person } }, orderBy: [{ role: 'asc' }, { joined_at: 'asc' }] }),
      tx.forumChatMember.findMany({ where: { room_id: id, user_id: { not: actor.id }, typing_until: { gt: new Date() } }, select: { user: { select: { id: true, name: true } } } }),
      tx.forumChatTask.findMany({ where: { room_id: id }, orderBy: [{ created_at: 'asc' }, { id: 'asc' }], select: taskSelect }),
      tx.forumChatLink.findMany({ where: { room_id: id }, orderBy: [{ created_at: 'asc' }, { id: 'asc' }], select: linkSelect }),
      tx.forumChatMessage.findMany({ where: { room_id: id, deleted_at: null, pinned_at: { not: null } }, orderBy: [{ pinned_at: 'desc' }, { id: 'asc' }], take: MAX_PINS,
        select: { id: true, body: true, created_at: true, author: { select: { id: true, name: true } }, poll: { select: { question: true } }, _count: { select: { attachments: true } } } }),
    ]);
    const admin = member.role === 'ADMIN';
    return {
      id: room.id, name: openText(id, room.name), description: openText(id, room.description) || '', created_at: room.created_at,
      github_repo: roomRepos(id, room.github_repo)[0] || null, github_repos: roomRepos(id, room.github_repo), only_admins_edit: room.only_admins_edit, only_admins_send: room.only_admins_send,
      my_role: member.role, can_edit_info: admin || !room.only_admins_edit, can_send: admin || !room.only_admins_send,
      members: members.map(row => ({ ...row.user, group_role: row.role, joined_at: row.joined_at })), typing: typing.map(row => row.user),
      tasks: tasks.map(task => ({ ...task, title: openText(id, task.title) })),
      links: links.map(link => ({ ...link, title: openText(id, link.title), url: openText(id, link.url) })),
      pinned: pinned.map(row => ({ id: row.id, created_at: row.created_at, author: row.author, body: pinnedPreview(id, row) })),
    };
  });
}

/** Group info: name and description (admins, or everyone when allowed) and the two group settings (admins). */
export async function updateChatRoom(actor: ForumActor, id: string, input: Record<string, unknown>) {
  await assertForumPosting(actor);
  return prisma.$transaction(async tx => {
    const { room, member } = await membership(tx, actor, id);
    const data: Prisma.ForumChatRoomUpdateInput = {};
    if (input.name !== undefined || input.description !== undefined) {
      if (room.only_admins_edit) assertGroupAdmin(member, 'edit the group info');
      if (input.name !== undefined) data.name = roomText(id, input.name, 'Group name', 1, 80);
      if (input.description !== undefined) { const text = roomDescription(input.description); data.description = text ? sealText(id, text) : null; }
    }
    for (const key of ['only_admins_edit', 'only_admins_send'] as const) {
      if (input[key] === undefined) continue;
      if (typeof input[key] !== 'boolean') throw badRequest('Invalid group setting.');
      assertGroupAdmin(member, 'change group settings');
      data[key] = input[key] as boolean;
    }
    if (!Object.keys(data).length) throw badRequest('Nothing to change.');
    await tx.forumChatRoom.update({ where: { id }, data });
    return { ok: true };
  });
}

export async function addChatMembers(actor: ForumActor, id: string, input: Record<string, unknown>) {
  await assertForumPosting(actor);
  const ids = userIds(input.user_ids, MAX_MEMBERS);
  if (!ids.length) throw badRequest('Choose at least one person.');
  return prisma.$transaction(async tx => {
    const { member } = await membership(tx, actor, id);
    assertGroupAdmin(member, 'add people');
    await validateMembers(tx, ids);
    const existing = new Set((await tx.forumChatMember.findMany({ where: { room_id: id }, select: { user_id: true } })).map(row => row.user_id));
    const fresh = ids.filter(userId => !existing.has(userId));
    if (existing.size + fresh.length > MAX_MEMBERS) throw badRequest(`A group can have up to ${MAX_MEMBERS} members.`);
    await tx.forumChatMember.createMany({ data: fresh.map(user_id => ({ room_id: id, user_id })) });
    return { added: fresh.length };
  });
}

export async function setChatMemberRole(actor: ForumActor, id: string, userId: string, input: Record<string, unknown>) {
  await assertForumPosting(actor);
  if (input.role !== 'ADMIN' && input.role !== 'MEMBER') throw badRequest('Choose admin or member.');
  return prisma.$transaction(async tx => {
    const { member } = await membership(tx, actor, id);
    assertGroupAdmin(member, 'change admins');
    const target = await tx.forumChatMember.findUnique({ where: { room_id_user_id: { room_id: id, user_id: userId } } });
    if (!target) throw notFound('Member not found.');
    await tx.forumChatMember.update({ where: { room_id_user_id: { room_id: id, user_id: userId } }, data: { role: input.role as ChatRole } });
    await keepAnAdmin(tx, id);
    return { ok: true };
  });
}

/** A group always keeps an admin: when the last one leaves or steps down, the longest-standing member takes over. */
async function keepAnAdmin(tx: Tx, id: string) {
  if (await tx.forumChatMember.count({ where: { room_id: id, role: 'ADMIN' } })) return;
  const next = await tx.forumChatMember.findFirst({ where: { room_id: id }, orderBy: [{ joined_at: 'asc' }, { user_id: 'asc' }] });
  if (next) await tx.forumChatMember.update({ where: { room_id_user_id: { room_id: id, user_id: next.user_id } }, data: { role: 'ADMIN' } });
}

/** Removing someone (group admins) or leaving the group (anyone). The last person to leave deletes the group. */
export async function removeChatMember(actor: ForumActor, id: string, userId: string) {
  const result = await prisma.$transaction(async tx => {
    const { member } = await membership(tx, actor, id);
    if (userId !== actor.id) {
      await assertForumPosting(actor);
      assertGroupAdmin(member, 'remove people');
    }
    const removed = await tx.forumChatMember.deleteMany({ where: { room_id: id, user_id: userId } });
    if (!removed.count) throw notFound('Member not found.');
    if (!await tx.forumChatMember.count({ where: { room_id: id } })) return { deleted: await deleteRoomRows(tx, id) };
    await keepAnAdmin(tx, id);
    return { deleted: null };
  });
  if (result.deleted) await removeStoredFiles(result.deleted);
  return { ok: true };
}

export async function deleteChatRoom(actor: ForumActor, id: string) {
  const keys = await prisma.$transaction(async tx => {
    const { member } = await membership(tx, actor, id);
    assertGroupAdmin(member, 'delete the group');
    return deleteRoomRows(tx, id);
  });
  await removeStoredFiles(keys);
  return { ok: true };
}
async function deleteRoomRows(tx: Tx, id: string) {
  const keys = (await tx.forumChatAttachment.findMany({ where: { room_id: id }, select: { storage_key: true } })).map(row => row.storage_key);
  await tx.forumChatRoom.delete({ where: { id } });
  return keys;
}
async function removeStoredFiles(keys: string[]) {
  if (!keys.length) return;
  const { removeChatFiles } = await import('./forumChatFiles.service');
  await removeChatFiles(keys);
}

export const CHAT_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
const messageSelect = { id: true, body: true, created_at: true, edited_at: true, deleted_at: true, pinned_at: true,
  author: { select: person }, attachments: { select: chatAttachmentSelect }, reactions: { select: { user_id: true, emoji: true } },
  reply_to: { select: { id: true, body: true, deleted_at: true, author: { select: { name: true } }, poll: { select: { question: true } } } },
  poll: { select: pollSelect } } satisfies Prisma.ForumChatMessageSelect;
const SEARCH_WINDOW = 5000;

export async function chatMessages(actor: ForumActor, id: string, page: number, query = '') {
  return withChatMember(actor, id, async tx => {
    let total: number, messages: Prisma.ForumChatMessageGetPayload<{ select: typeof messageSelect }>[];
    if (query) {
      // Bodies are encrypted, so search runs over the decrypted recent history instead of in SQL.
      const needle = query.toLocaleLowerCase('tr');
      const recent = await tx.forumChatMessage.findMany({ where: { room_id: id, deleted_at: null }, orderBy: [{ created_at: 'desc' }, { id: 'desc' }], take: SEARCH_WINDOW, select: { id: true, body: true, poll: { select: { question: true } } } });
      const hits = recent.filter(row => `${openText(id, row.body)}
${row.poll ? openText(id, row.poll.question) : ''}`.toLocaleLowerCase('tr').includes(needle)).map(row => row.id);
      total = hits.length;
      const pageIds = hits.slice((page - 1) * 50, page * 50);
      messages = await tx.forumChatMessage.findMany({ where: { id: { in: pageIds } }, orderBy: [{ created_at: 'desc' }, { id: 'desc' }], select: messageSelect });
    } else {
      total = await tx.forumChatMessage.count({ where: { room_id: id } });
      messages = await tx.forumChatMessage.findMany({ where: { room_id: id }, orderBy: [{ created_at: 'desc' }, { id: 'desc' }], skip: (page - 1) * 50, take: 50, select: messageSelect });
    }
    const readers = await tx.forumChatMember.findMany({ where: { room_id: id }, select: { user_id: true, read_at: true, read_message_id: true, joined_at: true } });
    const hasRead = (reader: typeof readers[number], message: { id: string; created_at: Date }) => !!reader.read_at && (reader.read_at > message.created_at
      || (+reader.read_at === +message.created_at && (!reader.read_message_id || reader.read_message_id >= message.id)));
    return { messages: messages.reverse().map(message => {
      // Like WhatsApp, "seen by everyone" counts the people who were in the group when the message was sent.
      const others = readers.filter(reader => reader.user_id !== message.author?.id);
      const present = others.filter(reader => reader.joined_at <= message.created_at);
      const audience = present.length ? present : others;
      const readBy = readers.filter(reader => reader.user_id !== message.author?.id && hasRead(reader, message)).map(reader => reader.user_id);
      return { ...message,
        body: message.deleted_at ? '' : openText(id, message.body),
        attachments: message.deleted_at ? [] : message.attachments.map(file => ({ ...file, original_name: openText(id, file.original_name) })),
        reactions: message.deleted_at ? [] : message.reactions,
        poll: message.deleted_at ? null : projectPoll(message.poll, actor.id, value => openText(id, value)),
        reply_to: !message.deleted_at && message.reply_to ? { id: message.reply_to.id, deleted_at: message.reply_to.deleted_at, author: message.reply_to.author,
          body: message.reply_to.deleted_at ? '' : (openText(id, message.reply_to.body) || (message.reply_to.poll ? `📊 ${openText(id, message.reply_to.poll.question)}` : '')).slice(0, 160) } : null,
        read_by: readBy,
        read_all: audience.length > 0 && audience.every(reader => hasRead(reader, message)),
      };
    }), total, page, pageSize: 50 };
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
  const poll = pollInput(input.poll);
  if (poll && ids.length) throw badRequest('Send a poll without attachments.');
  const body = poll ? '' : messageBody(input.body, ids.length > 0);
  const replyId = input.reply_to_id === undefined || input.reply_to_id === null ? null : forumText(input.reply_to_id, 'Reply', 1, 100);
  return prisma.$transaction(async tx => {
    const { room, member } = await membership(tx, actor, id);
    if (room.only_admins_send) assertGroupAdmin(member, 'send messages in this group');
    if (replyId && !await tx.forumChatMessage.findFirst({ where: { id: replyId, room_id: id, deleted_at: null } })) throw notFound('Reply target not found.');
    if (await tx.forumChatAttachment.count({ where: { id: { in: ids }, room_id: id, uploader_id: actor.id, message_id: null } }) !== ids.length) throw badRequest('An attachment is no longer available.');
    const message = await tx.forumChatMessage.create({ data: { room_id: id, author_id: actor.id, body: body ? sealText(id, body) : '', reply_to_id: replyId }, select: { id: true } });
    if (ids.length) await tx.forumChatAttachment.updateMany({ where: { id: { in: ids } }, data: { message_id: message.id } });
    if (poll) await createPoll(tx, { message_id: message.id }, poll, value => sealText(id, value));
    await tx.forumChatMember.update({ where: { room_id_user_id: { room_id: id, user_id: actor.id } }, data: { typing_until: null } });
    await tx.forumChatRoom.update({ where: { id }, data: { updated_at: new Date() } });
    return message;
  });
}
export async function editChatMessage(actor: ForumActor, roomId: string, messageId: string, input: Record<string, unknown>, remove = false) {
  await assertForumPosting(actor);
  return withChatMember(actor, roomId, async tx => {
    const message = await tx.forumChatMessage.findFirst({ where: { id: messageId, room_id: roomId, deleted_at: null }, include: { poll: { select: { id: true } }, _count: { select: { attachments: true } } } });
    if (!message) throw notFound('Message not found.');
    if (message.author_id !== actor.id) throw forbidden('You can only change your own messages.');
    if (message.poll && !remove) throw badRequest('Polls cannot be edited. Delete it and send a new one.');
    const body = remove ? '' : messageBody(input.body, message._count.attachments > 0);
    await tx.forumChatMessage.update({ where: { id: messageId }, data: remove ? { body: '', deleted_at: new Date(), pinned_at: null, pinned_by_id: null } : { body: body ? sealText(roomId, body) : '', edited_at: new Date() } });
    if (remove) { await tx.forumChatReaction.deleteMany({ where: { message_id: messageId } }); await tx.forumPoll.deleteMany({ where: { message_id: messageId } }); }
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
/** Any member may vote, like reacting, even when only admins can send messages. */
export async function voteChatPoll(actor: ForumActor, roomId: string, messageId: string, input: Record<string, unknown>) {
  await assertForumPosting(actor);
  return withChatMember(actor, roomId, async tx => {
    const message = await tx.forumChatMessage.findFirst({ where: { id: messageId, room_id: roomId, deleted_at: null }, select: { poll: { select: { id: true } } } });
    if (!message?.poll) throw notFound('Poll not found.');
    await castPollVote(tx, message.poll.id, actor.id, input);
    return projectPoll(await tx.forumPoll.findUnique({ where: { id: message.poll.id }, select: pollSelect }), actor.id, value => openText(roomId, value));
  });
}
/** Group admins pin up to three messages; pinning a fourth unpins the oldest pin, as in WhatsApp. */
export async function pinChatMessage(actor: ForumActor, roomId: string, messageId: string, input: Record<string, unknown>) {
  await assertForumPosting(actor);
  if (typeof input.pinned !== 'boolean') throw badRequest('A pinned value is required.');
  const pinned = input.pinned;
  return withChatMember(actor, roomId, async (tx, member) => {
    assertGroupAdmin(member, 'pin messages');
    if (!await tx.forumChatMessage.findFirst({ where: { id: messageId, room_id: roomId, deleted_at: null }, select: { id: true } })) throw notFound('Message not found.');
    if (!pinned) { await tx.forumChatMessage.update({ where: { id: messageId }, data: { pinned_at: null, pinned_by_id: null } }); return { ok: true }; }
    await tx.forumChatMessage.update({ where: { id: messageId }, data: { pinned_at: new Date(), pinned_by_id: actor.id } });
    const extra = await tx.forumChatMessage.findMany({ where: { room_id: roomId, pinned_at: { not: null } }, orderBy: [{ pinned_at: 'desc' }, { id: 'asc' }], skip: MAX_PINS, select: { id: true } });
    if (extra.length) await tx.forumChatMessage.updateMany({ where: { id: { in: extra.map(row => row.id) } }, data: { pinned_at: null, pinned_by_id: null } });
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

/** Aggregate only memberships belonging to the caller. */
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

/* Room workspace: a shared to-do board, pinned links and the GitHub repository panel. Any member can change them. */
const TASK_STATUSES = ['TODO', 'DOING', 'DONE'];
function taskStatus(value: unknown) {
  if (typeof value !== 'string' || !TASK_STATUSES.includes(value)) throw badRequest('Choose To do, Doing or Done.');
  return value;
}
const projectTask = (roomId: string, task: Prisma.ForumChatTaskGetPayload<{ select: typeof taskSelect }>) => ({ ...task, title: openText(roomId, task.title) });
export async function addChatTask(actor: ForumActor, roomId: string, input: Record<string, unknown>) {
  await assertForumPosting(actor);
  const title = forumText(input.title, 'Task', 1, 200);
  const status = input.status === undefined ? 'TODO' : taskStatus(input.status);
  return withChatMember(actor, roomId, async tx => {
    if (await tx.forumChatTask.count({ where: { room_id: roomId } }) >= 200) throw badRequest('A room can have up to 200 tasks. Remove finished ones first.');
    return projectTask(roomId, await tx.forumChatTask.create({ data: { room_id: roomId, title: sealText(roomId, title), status, created_by_id: actor.id }, select: taskSelect }));
  });
}
export async function changeChatTask(actor: ForumActor, roomId: string, taskId: string, input: Record<string, unknown>, remove = false) {
  await assertForumPosting(actor);
  const data = remove ? {} : { ...(input.title !== undefined ? { title: sealText(roomId, forumText(input.title, 'Task', 1, 200)) } : {}), ...(input.status !== undefined ? { status: taskStatus(input.status) } : {}) };
  if (!remove && !Object.keys(data).length) throw badRequest('Nothing to change.');
  return withChatMember(actor, roomId, async tx => {
    if (!await tx.forumChatTask.findFirst({ where: { id: taskId, room_id: roomId }, select: { id: true } })) throw notFound('Task not found.');
    if (remove) { await tx.forumChatTask.delete({ where: { id: taskId } }); return { ok: true }; }
    return projectTask(roomId, await tx.forumChatTask.update({ where: { id: taskId }, data, select: taskSelect }));
  });
}
function linkUrl(value: unknown) {
  const text = forumText(value, 'Link', 1, 500);
  let url: URL;
  try { url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`); } catch { throw badRequest('Enter a valid web address.'); }
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname.includes('.')) throw badRequest('Only http and https links can be pinned.');
  if (url.href.length > 500) throw badRequest('Links can be up to 500 characters.');
  return url.href;
}
export async function addChatLink(actor: ForumActor, roomId: string, input: Record<string, unknown>) {
  await assertForumPosting(actor);
  const url = linkUrl(input.url);
  const title = input.title === undefined || input.title === null || (typeof input.title === 'string' && !input.title.trim()) ? new URL(url).hostname.replace(/^www\./, '').slice(0, 80) : forumText(input.title, 'Title', 1, 80);
  return withChatMember(actor, roomId, async tx => {
    if (await tx.forumChatLink.count({ where: { room_id: roomId } }) >= 30) throw badRequest('A room can pin up to 30 links.');
    const link = await tx.forumChatLink.create({ data: { room_id: roomId, title: sealText(roomId, title), url: sealText(roomId, url), created_by_id: actor.id }, select: linkSelect });
    return { ...link, title, url };
  });
}
export async function removeChatLink(actor: ForumActor, roomId: string, linkId: string) {
  await assertForumPosting(actor);
  return withChatMember(actor, roomId, async tx => {
    const removed = await tx.forumChatLink.deleteMany({ where: { id: linkId, room_id: roomId } });
    if (!removed.count) throw notFound('Link not found.');
    return { ok: true };
  });
}
/** Sets the room's repositories: `repos` (up to five, first is the default) or a single legacy `repo`. */
export async function setChatRepo(actor: ForumActor, roomId: string, input: Record<string, unknown>) {
  await assertForumPosting(actor);
  let repos: string[];
  if (input.repos !== undefined) {
    if (!Array.isArray(input.repos) || input.repos.length > MAX_ROOM_REPOS) throw badRequest(`Connect up to ${MAX_ROOM_REPOS} repositories.`);
    repos = [...new Set(input.repos.map(parseGithubRepo).filter((repo): repo is string => !!repo).map(repo => repo))];
  } else { const repo = parseGithubRepo(input.repo); repos = repo ? [repo] : []; }
  return withChatMember(actor, roomId, async tx => {
    await tx.forumChatRoom.update({ where: { id: roomId }, data: { github_repo: repos.length ? sealText(roomId, JSON.stringify(repos)) : null } });
    return { github_repo: repos[0] || null, github_repos: repos };
  });
}
export async function chatGithub(actor: ForumActor, roomId: string, wanted?: string) {
  // Membership is checked first; the GitHub request runs outside the database transaction.
  const repos = await withChatMember(actor, roomId, async tx => roomRepos(roomId, (await tx.forumChatRoom.findUnique({ where: { id: roomId }, select: { github_repo: true } }))?.github_repo || null));
  // Only the room's own repositories can be fetched, so the endpoint is not a general GitHub proxy.
  const repo = wanted ? repos.find(item => item.toLowerCase() === wanted.toLowerCase()) : repos[0];
  if (wanted && !repo) throw notFound('Repository not found in this group.');
  return repo ? githubActivity(repo) : null;
}
