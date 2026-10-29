import { Prisma } from '@prisma/client';
import prisma from './prisma';
import { badRequest, forbidden } from '../utils/http';
import { ForumActor, isForumStaff, forumText } from './forumPolicy';

export const forumContextSelect = { edited_at: true, quest: { select: { id: true, title: true } }, mission: { select: { id: true, title: true } } } as const;
export async function forumContext(actor: ForumActor) {
  const cube = await prisma.cubeProfile.findUnique({ where: { user_id: actor.id }, select: { id: true } });
  const missionWhere: Prisma.MissionWhereInput = isForumStaff(actor) ? {} : {
    OR: [{ contributors: { some: { cube_id: cube?.id || '', released_at: null } } }, { teams: { some: { members: { some: { cube_id: cube?.id || '' } } } } }],
  };
  const [missions, quests] = await Promise.all([
    prisma.mission.findMany({ where: missionWhere, select: { id: true, title: true, status: true }, orderBy: { updated_at: 'desc' } }),
    isForumStaff(actor)
      ? prisma.quest.findMany({ select: { id: true, title: true }, orderBy: { created_at: 'desc' } })
      : prisma.cubeQuest.findMany({ where: { cube_id: cube?.id || '' }, select: { current_value: true, is_completed: true, quest: { select: { id: true, title: true, criteria_value: true } } } })
        .then(rows => rows.map(row => ({ ...row.quest, current: row.current_value, completed: row.is_completed }))),
  ]);
  return { missions, quests, personal_progress: actor.role === 'CUBE' };
}

export async function topicContextInput(actor: ForumActor, input: Record<string, unknown>, tx: Prisma.TransactionClient) {
  const questId = input.quest_id == null || input.quest_id === '' ? null : forumText(input.quest_id, 'Quest', 1, 100);
  const missionId = input.mission_id == null || input.mission_id === '' ? null : forumText(input.mission_id, 'Mission', 1, 100);
  if (!questId && !missionId) return { quest_id: null, mission_id: null };
  const cube = isForumStaff(actor) ? null : await tx.cubeProfile.findUnique({ where: { user_id: actor.id }, select: { id: true } });
  if (questId) {
    if (!await tx.quest.findUnique({ where: { id: questId }, select: { id: true } })) throw badRequest('Quest bulunamadı.');
    if (!isForumStaff(actor) && !await tx.cubeQuest.findFirst({ where: { cube_id: cube?.id || '', quest_id: questId }, select: { id: true } })) throw forbidden('Yalnızca sana atanmış questleri bağlayabilirsin.');
  }
  if (missionId) {
    const where: Prisma.MissionWhereInput = { id: missionId };
    if (!isForumStaff(actor)) where.OR = [{ contributors: { some: { cube_id: cube?.id || '', released_at: null } } }, { teams: { some: { members: { some: { cube_id: cube?.id || '' } } } } }];
    if (!await tx.mission.findFirst({ where, select: { id: true } })) throw forbidden('Bu mission konuya bağlanamaz.');
  }
  return { quest_id: questId, mission_id: missionId };
}
