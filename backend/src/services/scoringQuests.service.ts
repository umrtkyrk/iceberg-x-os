/**
 * Scoring v2 quests: the quest types that read the v2 score, and the one-off
 * switch that retires the old average-score quests and adds the v2 ones.
 * Retiring is additive (Quest.retired_at); badges already earned stay.
 */
import prisma from './prisma';
import { badRequest } from '../utils/http';
import { BAND_RANK, computeScoreV2, growthOver, FORMULA_VERSION } from './scoreV2';
import { isScoringV2Live, loadScoreInputs } from './scoreV2.data';

export const SCORING_V2_CRITERIA = ['v2_band', 'v2_growth', 'v2_core_level'] as const;
export const isScoringV2Criteria = (type: string) => (SCORING_V2_CRITERIA as readonly string[]).includes(type);

export const V2_QUESTS = [
  {
    title: 'Strong Standing',
    description: 'Reach the Strong band on your score, based on at least two assessments.',
    difficulty: 'Rare',
    criteria_type: 'v2_band',
    criteria_value: BAND_RANK.Strong,
    badgeName: 'StrongStanding',
    badgeIcon: 'trending-up',
    badgeRarity: 'Rare',
  },
  {
    title: 'Exceptional Cube',
    description: 'Reach the Exceptional band on your score, based on at least two assessments.',
    difficulty: 'Epic',
    criteria_type: 'v2_band',
    criteria_value: BAND_RANK.Exceptional,
    badgeName: 'ExceptionalCube',
    badgeIcon: 'crown',
    badgeRarity: 'Epic',
  },
  {
    title: 'Rising Fast',
    description: 'Grow your score by 10 points or more within 12 weeks.',
    difficulty: 'Rare',
    criteria_type: 'v2_growth',
    criteria_value: 10,
    badgeName: 'RisingFast',
    badgeIcon: 'rocket',
    badgeRarity: 'Rare',
  },
  {
    title: 'All-Round Core',
    description: 'Reach level 4 or above on every core criterion.',
    difficulty: 'Rare',
    criteria_type: 'v2_core_level',
    criteria_value: 4,
    badgeName: 'AllRoundCore',
    badgeIcon: 'shield-check',
    badgeRarity: 'Rare',
  },
] as const;

/** Progress value for a v2 quest. 0 until the v2 score is live. */
export async function scoringV2QuestValue(cubeProfileId: string, criteriaType: string): Promise<number> {
  if (!isScoringV2Live()) return 0;
  const loaded = (await loadScoreInputs([cubeProfileId])).get(cubeProfileId);
  if (!loaded) return 0;
  const score = computeScoreV2(loaded.input, new Date(), { includePeer: true });

  if (criteriaType === 'v2_band') {
    return score.band && !score.provisional ? BAND_RANK[score.band] : 0;
  }
  if (criteriaType === 'v2_growth') {
    const snapshots = await prisma.scoreSnapshot.findMany({
      where: { cube_id: cubeProfileId, formula_version: FORMULA_VERSION },
      select: { week_start: true, overall: true },
    });
    return Math.max(0, growthOver(snapshots, 12) ?? 0);
  }
  if (criteriaType === 'v2_core_level') {
    const coreKeys = Object.entries(loaded.input.criteria).filter(([, c]) => c.core).map(([key]) => key);
    const levels = new Map(score.criteria.map(c => [c.key, c.level]));
    if (coreKeys.length === 0 || coreKeys.some(k => !levels.has(k))) return 0;
    return Math.min(...coreKeys.map(k => levels.get(k)!));
  }
  return 0;
}

/**
 * Go-live switch for quests: retires the average-score quests and creates the
 * v2 quests and badges (auto-assigned). Idempotent.
 */
export async function activateV2Quests(autoAssign: (questId: string) => Promise<unknown>) {
  if (!isScoringV2Live()) throw badRequest('Turn on SCORING_V2_LIVE before switching quests to v2.');
  const retired = await prisma.quest.updateMany({
    where: { criteria_type: 'average_score', retired_at: null },
    data: { retired_at: new Date() },
  });

  const created: string[] = [];
  for (const q of V2_QUESTS) {
    const badge =
      (await prisma.badge.findUnique({ where: { name: q.badgeName } })) ??
      (await prisma.badge.create({
        data: { name: q.badgeName, description: `Awarded for completing the quest: ${q.title}`, icon: q.badgeIcon, rarity: q.badgeRarity } as any,
      }));
    let quest = await prisma.quest.findFirst({ where: { title: q.title } });
    if (!quest) {
      quest = await prisma.quest.create({
        data: {
          title: q.title,
          description: q.description,
          difficulty: q.difficulty as any,
          criteria_type: q.criteria_type,
          criteria_value: q.criteria_value,
          auto_assign: true,
          rewards: { connect: [{ id: badge.id }] },
        },
      });
      created.push(q.title);
    }
    await autoAssign(quest.id);
  }
  return { retired: retired.count, created };
}
