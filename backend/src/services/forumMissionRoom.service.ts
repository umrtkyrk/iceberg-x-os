import { Prisma } from '@prisma/client';
import prisma from './prisma';
import { ForumActor } from './forumPolicy';
import { forbidden, notFound } from '../utils/http';
import { openText, sealText } from './forumChatCrypto.service';

type Tx = Prisma.TransactionClient;
type Role = 'ADMIN' | 'MEMBER';
const OFFBOARDED = ['Alumni', 'Former_Cube'] as const;

// Membership follows live mission teams, never historical contributor records.
// Every portal Admin and Mentor is a room admin; assigned active Cubes are members.
async function desiredRoster(db: Tx | typeof prisma, missionIds: string[]) {
  const [staff, assigned] = await Promise.all([
    db.user.findMany({ where: { role: { in: ['ADMIN', 'MENTOR'] } }, select: { id: true } }),
    db.missionTeamMember.findMany({
      where: { team: { mission_id: { in: missionIds } }, cube: { current_level: { notIn: [...OFFBOARDED] }, user: { role: 'CUBE' } } },
      select: { team: { select: { mission_id: true } }, cube: { select: { user_id: true } } },
    }),
  ]);
  return (missionId: string) => {
    const roster = new Map<string, Role>();
    for (const row of assigned) if (row.team.mission_id === missionId) roster.set(row.cube.user_id, 'MEMBER');
    for (const user of staff) roster.set(user.id, 'ADMIN');
    return roster;
  };
}

function rosterChanged(roster: Map<string, Role>, members: { user_id: string; role: string }[]) {
  if (roster.size !== members.length) return true;
  return members.some(member => roster.get(member.user_id) !== member.role);
}

/**
 * Brings one linked room in line with its mission. The caller holds the room row lock.
 * Writes only what differs, so a steady-state check is read-only and the room's
 * ciphertext and activity timestamp are left untouched.
 */
export async function syncMissionRoom(tx: Tx, roomId: string) {
  const room = await tx.forumChatRoom.findUnique({ where: { id: roomId },
    select: { name: true, only_admins_edit: true, mission: { select: { id: true, title: true } }, members: { select: { user_id: true, role: true } } } });
  if (!room?.mission) return;
  const roster = (await desiredRoster(tx, [room.mission.id]))(room.mission.id);
  const current = new Map(room.members.map(member => [member.user_id, member.role]));
  const stale = room.members.filter(member => !roster.has(member.user_id)).map(member => member.user_id);
  if (stale.length) await tx.forumChatMember.deleteMany({ where: { room_id: roomId, user_id: { in: stale } } });
  const missing = [...roster].filter(([userId]) => !current.has(userId));
  if (missing.length) await tx.forumChatMember.createMany({ data: missing.map(([user_id, role]) => ({ room_id: roomId, user_id, role })), skipDuplicates: true });
  for (const [userId, role] of roster) {
    const had = current.get(userId);
    if (had && had !== role) await tx.forumChatMember.update({ where: { room_id_user_id: { room_id: roomId, user_id: userId } }, data: { role } });
  }
  // Do not advance updated_at: a roster or name refresh must not reorder the room list.
  if (openText(roomId, room.name) !== room.mission.title || !room.only_admins_edit)
    await tx.forumChatRoom.update({ where: { id: roomId }, data: { name: sealText(roomId, room.mission.title), only_admins_edit: true } });
}

/** One read-only pass over every linked room; only rooms that drifted are locked and rewritten. Unthrottled; exported for tests. */
export async function reconcileMissionRoomsNow() {
  const rooms = await prisma.forumChatRoom.findMany({ where: { mission_id: { not: null } },
    select: { id: true, name: true, only_admins_edit: true, mission: { select: { id: true, title: true } }, members: { select: { user_id: true, role: true } } } });
  if (!rooms.length) return;
  const rosterFor = await desiredRoster(prisma, rooms.flatMap(room => room.mission ? [room.mission.id] : []));
  const drifted = rooms.filter(room => room.mission && (!room.only_admins_edit || rosterChanged(rosterFor(room.mission.id), room.members) || openText(room.id, room.name) !== room.mission.title));
  for (const room of drifted) await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "ForumChatRoom" WHERE id = ${room.id} FOR UPDATE`;
    await syncMissionRoom(tx, room.id);
  });
}

// Room lists and unread counts are polled every few seconds by every open forum tab, so the
// global pass is shared and spaced out. Access to a room's content does not depend on it:
// every room operation re-syncs that one room under its lock before checking membership.
const RECONCILE_INTERVAL_MS = 5000;
let lastReconcile = 0;
let inFlight: Promise<void> | null = null;
export async function reconcileMissionRooms() {
  if (inFlight) return inFlight;
  if (Date.now() - lastReconcile < RECONCILE_INTERVAL_MS) return;
  inFlight = reconcileMissionRoomsNow()
    .catch(error => { console.error('Mission room reconciliation failed:', error); })
    .finally(() => { lastReconcile = Date.now(); inFlight = null; });
  return inFlight;
}

export async function missionRoom(actor: ForumActor, missionId: string, create = false) {
  if (create && !['ADMIN', 'MENTOR'].includes(actor.role)) throw forbidden('Only Admins and Mentors can create mission rooms.');
  return prisma.$transaction(async tx => {
    // Only creation needs the mission lock (it serialises concurrent creates); a lookup does not.
    if (create) await tx.$queryRaw`SELECT id FROM "Mission" WHERE id = ${missionId} FOR UPDATE`;
    if (!await tx.mission.findUnique({ where: { id: missionId }, select: { id: true } })) throw notFound('Mission not found.');
    let room = await tx.forumChatRoom.findUnique({ where: { mission_id: missionId }, select: { id: true } });
    if (!room && create) room = await tx.forumChatRoom.create({ data: { name: '', mission_id: missionId, created_by_id: actor.id, only_admins_edit: true }, select: { id: true } });
    if (!room) return { room: null };
    await tx.$queryRaw`SELECT id FROM "ForumChatRoom" WHERE id = ${room.id} FOR UPDATE`;
    await syncMissionRoom(tx, room.id);
    if (!await tx.forumChatMember.findUnique({ where: { room_id_user_id: { room_id: room.id, user_id: actor.id } } })) return { room: null };
    return { room: { id: room.id } };
  });
}
