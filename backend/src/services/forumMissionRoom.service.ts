import { Prisma } from '@prisma/client';
import prisma from './prisma';
import { ForumActor } from './forumPolicy';
import { forbidden, notFound } from '../utils/http';
import { sealText } from './forumChatCrypto.service';

// Membership follows live mission teams, never historical contributor records.
export async function syncMissionRoom(tx: Prisma.TransactionClient, roomId: string) {
  const room = await tx.forumChatRoom.findUnique({ where: { id: roomId }, include: { mission: true } });
  if (!room?.mission) return;
  const mission = room.mission;
  const users = await tx.user.findMany({ where: { OR: [
    { role: { in: ['ADMIN', 'MENTOR'] } },
    { role: 'CUBE', cube_profile: { is: { current_level: { notIn: ['Alumni', 'Former_Cube'] }, team_memberships: { some: { team: { mission_id: mission.id } } } } } },
  ] }, select: { id: true, role: true } });
  await tx.forumChatMember.deleteMany({ where: { room_id: roomId, user_id: { notIn: users.map(u => u.id) } } });
  for (const user of users) {
    const role = user.role === 'CUBE' ? 'MEMBER' : 'ADMIN';
    await tx.forumChatMember.upsert({ where: { room_id_user_id: { room_id: roomId, user_id: user.id } }, create: { room_id: roomId, user_id: user.id, role }, update: { role } });
  }
  // Do not advance updated_at: roster refresh must not reorder the room list.
  await tx.forumChatRoom.update({ where: { id: roomId }, data: { name: sealText(roomId, mission.title), only_admins_edit: true } });
}

export async function syncMissionRooms() {
  const rooms = await prisma.forumChatRoom.findMany({ where: { mission_id: { not: null } }, select: { id: true } });
  for (const room of rooms) await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "ForumChatRoom" WHERE id = ${room.id} FOR UPDATE`;
    await syncMissionRoom(tx, room.id);
  });
}

export async function missionRoom(actor: ForumActor, missionId: string, create = false) {
  if (create && !['ADMIN', 'MENTOR'].includes(actor.role)) throw forbidden('Only Admins and Mentors can create mission rooms.');
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Mission" WHERE id = ${missionId} FOR UPDATE`;
    if (!await tx.mission.findUnique({ where: { id: missionId } })) throw notFound('Mission not found.');
    let room = await tx.forumChatRoom.findUnique({ where: { mission_id: missionId } });
    if (!room && create) room = await tx.forumChatRoom.create({ data: { name: '', mission_id: missionId, created_by_id: actor.id, only_admins_edit: true } });
    if (!room) return { room: null };
    await tx.$queryRaw`SELECT id FROM "ForumChatRoom" WHERE id = ${room.id} FOR UPDATE`;
    await syncMissionRoom(tx, room.id);
    if (!await tx.forumChatMember.findUnique({ where: { room_id_user_id: { room_id: room.id, user_id: actor.id } } })) return { room: null };
    return { room: { id: room.id } };
  });
}
