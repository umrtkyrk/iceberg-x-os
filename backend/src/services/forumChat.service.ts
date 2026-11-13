import { Prisma } from '@prisma/client';
import prisma from './prisma';
import { badRequest, forbidden, notFound } from '../utils/http';
import { ForumActor, forumText } from './forumPolicy';
import { assertForumPosting } from './forumIdentity.service';

// Chat deliberately never joins public topic search, stats, mentions or notifications.
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
    return { id: room.id, name: room.name, members: members.map(row => row.user) };
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
export async function chatMessages(actor: ForumActor, id: string, page: number) {
  return prisma.$transaction(async tx => {
    await membership(tx, actor, id);
    const where = { room_id: id };
    const total = await tx.forumChatMessage.count({ where });
    const messages = await tx.forumChatMessage.findMany({ where, orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * 50, take: 50, select: { id: true, body: true, created_at: true, author: { select: person } } });
    return { messages: messages.reverse(), total, page, pageSize: 50 };
  });
}
export async function sendChatMessage(actor: ForumActor, id: string, input: Record<string, unknown>) {
  await assertForumPosting(actor);
  const body = forumText(input.body, 'Message', 1, 5000);
  return prisma.$transaction(async tx => {
    await membership(tx, actor, id);
    const message = await tx.forumChatMessage.create({ data: { room_id: id, author_id: actor.id, body }, select: { id: true } });
    await tx.forumChatRoom.update({ where: { id }, data: { updated_at: new Date() } });
    return message;
  });
}
