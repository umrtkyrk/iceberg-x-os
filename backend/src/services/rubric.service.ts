/**
 * Scoring v2 criteria and their rubric (what 1-5 means). Seeded from
 * docs/scoring-v2.md and edited by admins. Criteria are never deleted, only
 * deactivated, so past ratings keep their meaning.
 */
import prisma from './prisma';
import { badRequest, notFound } from '../utils/http';
import { disciplineKey } from './discipline.service';

export const RUBRIC_LEVELS = [1, 2, 3, 4, 5] as const;
const MAX_LEVEL_TEXT = 300;
const MAX_NAME = 60;

export interface LevelInput {
  level: number;
  description: string;
}

/** Exactly one non-empty description for each level 1-5, in order. */
export function normalizeLevels(input: unknown): LevelInput[] {
  if (!Array.isArray(input)) throw badRequest('levels must be a list of 5 descriptions.');
  const byLevel = new Map<number, string>();
  for (const row of input) {
    const r = row as { level?: unknown; description?: unknown };
    if (!RUBRIC_LEVELS.includes(r.level as 1)) throw badRequest('Each level must be 1, 2, 3, 4 or 5.');
    const text = typeof r.description === 'string' ? r.description.trim() : '';
    if (!text) throw badRequest(`Describe level ${r.level}.`);
    if (text.length > MAX_LEVEL_TEXT) throw badRequest(`Level ${r.level} is longer than ${MAX_LEVEL_TEXT} characters.`);
    if (byLevel.has(r.level as number)) throw badRequest(`Level ${r.level} is listed twice.`);
    byLevel.set(r.level as number, text);
  }
  if (byLevel.size !== RUBRIC_LEVELS.length) throw badRequest('Describe all five levels.');
  return RUBRIC_LEVELS.map(level => ({ level, description: byLevel.get(level)! }));
}

/** "Content & creative quality" -> "content_creative_quality". */
export const criterionKey = (name: string) => disciplineKey(name).replace(/-/g, '_');

const readName = (value: unknown) => {
  const name = typeof value === 'string' ? value.trim() : '';
  if (!name || name.length > MAX_NAME) throw badRequest(`Give the criterion a name of up to ${MAX_NAME} characters.`);
  return name;
};
const readDescription = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value.trim().slice(0, 300) : null;

const CRITERION_SELECT = {
  id: true,
  key: true,
  name: true,
  description: true,
  discipline_id: true,
  legacy_key: true,
  active: true,
  sort_order: true,
  levels: { select: { level: true, description: true, updated_at: true }, orderBy: { level: 'asc' as const } },
};

/**
 * The criteria a scorecard shows for a discipline: active core criteria plus
 * that discipline's. Without a discipline, core criteria only.
 */
export async function criteriaForDiscipline(disciplineId: string | null) {
  return prisma.criterion.findMany({
    where: {
      active: true,
      OR: [{ discipline_id: null }, ...(disciplineId ? [{ discipline_id: disciplineId }] : [])],
    },
    orderBy: [{ sort_order: 'asc' }, { name: 'asc' }],
    select: CRITERION_SELECT,
  });
}

/** Every criterion, active or not, for the admin rubric editor. */
export async function listAllCriteria() {
  return prisma.criterion.findMany({
    orderBy: [{ sort_order: 'asc' }, { name: 'asc' }],
    select: CRITERION_SELECT,
  });
}

export async function createCriterion(
  input: { name?: unknown; description?: unknown; discipline_id?: unknown; levels?: unknown },
  userId: string
) {
  const name = readName(input.name);
  const levels = normalizeLevels(input.levels);
  let disciplineId: string | null = null;
  if (input.discipline_id !== undefined && input.discipline_id !== null && input.discipline_id !== '') {
    if (typeof input.discipline_id !== 'string') throw badRequest('discipline_id must be an id.');
    const discipline = await prisma.discipline.findUnique({ where: { id: input.discipline_id }, select: { id: true } });
    if (!discipline) throw badRequest('Unknown discipline.');
    disciplineId = discipline.id;
  }
  const key = criterionKey(name);
  if (await prisma.criterion.findUnique({ where: { key }, select: { id: true } })) {
    throw badRequest('A criterion with this name already exists.');
  }
  const last = await prisma.criterion.aggregate({ _max: { sort_order: true } });
  return prisma.criterion.create({
    data: {
      key,
      name,
      description: readDescription(input.description),
      discipline_id: disciplineId,
      sort_order: (last._max.sort_order || 0) + 10,
      levels: { create: levels.map(l => ({ ...l, updated_by_id: userId })) },
    },
    select: CRITERION_SELECT,
  });
}

/** Rename, describe, reorder or (de)activate. The key, discipline and legacy mapping never change. */
export async function updateCriterion(id: string, input: { name?: unknown; description?: unknown; active?: unknown; sort_order?: unknown }) {
  if (!(await prisma.criterion.findUnique({ where: { id }, select: { id: true } }))) throw notFound('Criterion not found.');
  const data: { name?: string; description?: string | null; active?: boolean; sort_order?: number } = {};
  if (input.name !== undefined) data.name = readName(input.name);
  if (input.description !== undefined) data.description = readDescription(input.description);
  if (input.active !== undefined) {
    if (typeof input.active !== 'boolean') throw badRequest('active must be true or false.');
    data.active = input.active;
  }
  if (input.sort_order !== undefined) {
    if (!Number.isInteger(input.sort_order)) throw badRequest('sort_order must be a whole number.');
    data.sort_order = input.sort_order as number;
  }
  return prisma.criterion.update({ where: { id }, data, select: CRITERION_SELECT });
}

/** Replaces the five level descriptions of a criterion. */
export async function saveLevels(id: string, input: unknown, userId: string) {
  const levels = normalizeLevels(input);
  if (!(await prisma.criterion.findUnique({ where: { id }, select: { id: true } }))) throw notFound('Criterion not found.');
  await prisma.$transaction(
    levels.map(l =>
      prisma.rubricLevel.upsert({
        where: { criterion_id_level: { criterion_id: id, level: l.level } },
        update: { description: l.description, updated_by_id: userId },
        create: { criterion_id: id, level: l.level, description: l.description, updated_by_id: userId },
      })
    )
  );
  return prisma.criterion.findUnique({ where: { id }, select: CRITERION_SELECT });
}
