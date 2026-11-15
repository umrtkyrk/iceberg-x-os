/**
 * Scoring v2 disciplines (Engineer, Marketing, ...): admin management and the
 * suggestions shown when assigning disciplines to existing Cubes and missions.
 *
 * Suggestions are only ever shown to an admin, who confirms each one; nothing
 * is assigned automatically.
 */
import prisma from './prisma';
import { badRequest, notFound } from '../utils/http';

export interface DisciplineSuggestion {
  key: string;
  /** Why this discipline was suggested, shown next to the suggestion. */
  reason: string;
}

/** "Customer Success" -> "customer-success". */
export function disciplineKey(name: string): string {
  const key = name
    .toLocaleLowerCase('tr')
    .replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  if (!key) throw badRequest('The name needs at least one letter or digit.');
  return key;
}

const KEYWORDS: { key: string; pattern: RegExp }[] = [
  { key: 'marketing', pattern: /pazarlama|marketing|reklam|advertis|halkla ili|public relations|brand|marka|growth|social media|sosyal medya/i },
  { key: 'sales', pattern: /satış|satis|sales|business development|iş geliştirme/i },
  { key: 'editor', pattern: /edebiyat|literature|gazetecilik|journalism|editör|editor|çeviri|translation|copywrit/i },
  {
    key: 'engineer',
    pattern: /mühendis|muhendis|engineer|bilgisayar|computer|yazılım|yazilim|software|elektri|electr|matemati|math|istatisti|statistic|veri|data|fizik|physics|informatics|bilişim/i,
  },
];

const ENGINEERING_CATEGORIES = new Set(['AI/ML', 'Frontend', 'Backend', 'DevOps', 'Data Science']);

const keywordMatch = (text: string | null | undefined) =>
  text ? KEYWORDS.find(k => k.pattern.test(text))?.key || null : null;

/** Suggested discipline for a mission from its category and title. */
export function suggestMissionDiscipline(mission: { category?: string | null; title: string }): DisciplineSuggestion | null {
  if (mission.category && ENGINEERING_CATEGORIES.has(mission.category)) {
    return { key: 'engineer', reason: `Category is ${mission.category}` };
  }
  const fromTitle = keywordMatch(mission.title);
  if (fromTitle) return { key: fromTitle, reason: 'Matched words in the title' };
  if (mission.category === 'Research' || mission.category === 'General' || !mission.category) {
    return { key: 'engineer', reason: `Category is ${mission.category || 'not set'}; missions so far have been engineering` };
  }
  return null;
}

/**
 * Suggested discipline for a Cube. In order of strength: legacy scorecards
 * (the old 9 criteria only fit engineering), the disciplines of their
 * missions, then their university department.
 */
export function suggestCubeDiscipline(cube: {
  legacy_scorecards: number;
  mission_discipline_keys: string[];
  department?: string | null;
}): DisciplineSuggestion | null {
  if (cube.legacy_scorecards > 0) {
    return {
      key: 'engineer',
      reason: `${cube.legacy_scorecards} legacy scorecard${cube.legacy_scorecards === 1 ? '' : 's'} (engineering criteria)`,
    };
  }
  if (cube.mission_discipline_keys.length > 0) {
    const counts = new Map<string, number>();
    for (const key of cube.mission_discipline_keys) counts.set(key, (counts.get(key) || 0) + 1);
    const [top] = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    return { key: top[0], reason: `${top[1]} of their missions ${top[1] === 1 ? 'is' : 'are'} ${top[0]}` };
  }
  const fromDepartment = keywordMatch(cube.department);
  if (fromDepartment) return { key: fromDepartment, reason: `Department: ${cube.department}` };
  return null;
}

export async function listDisciplines({ includeInactive = false } = {}) {
  return prisma.discipline.findMany({
    where: includeInactive ? {} : { active: true },
    orderBy: [{ sort_order: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      key: true,
      name: true,
      description: true,
      active: true,
      sort_order: true,
      _count: { select: { cubes: true, missions: true } },
    },
  });
}

export async function createDiscipline(input: { name?: unknown; description?: unknown }) {
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (!name || name.length > 60) throw badRequest('Give the discipline a name of up to 60 characters.');
  const description = typeof input.description === 'string' && input.description.trim() ? input.description.trim().slice(0, 300) : null;
  const key = disciplineKey(name);
  const existing = await prisma.discipline.findUnique({ where: { key } });
  if (existing) throw badRequest(`A discipline called "${existing.name}" already exists.`);
  const last = await prisma.discipline.aggregate({ _max: { sort_order: true } });
  return prisma.discipline.create({
    data: { key, name, description, sort_order: (last._max.sort_order || 0) + 10 },
  });
}

/** Rename, describe, reorder or (de)activate. The key never changes. */
export async function updateDiscipline(
  id: string,
  input: { name?: unknown; description?: unknown; active?: unknown; sort_order?: unknown }
) {
  const existing = await prisma.discipline.findUnique({ where: { id } });
  if (!existing) throw notFound('Discipline not found.');
  const data: { name?: string; description?: string | null; active?: boolean; sort_order?: number } = {};
  if (input.name !== undefined) {
    const name = typeof input.name === 'string' ? input.name.trim() : '';
    if (!name || name.length > 60) throw badRequest('Give the discipline a name of up to 60 characters.');
    data.name = name;
  }
  if (input.description !== undefined) {
    data.description = typeof input.description === 'string' && input.description.trim() ? input.description.trim().slice(0, 300) : null;
  }
  if (input.active !== undefined) {
    if (typeof input.active !== 'boolean') throw badRequest('active must be true or false.');
    data.active = input.active;
  }
  if (input.sort_order !== undefined) {
    if (!Number.isInteger(input.sort_order)) throw badRequest('sort_order must be a whole number.');
    data.sort_order = input.sort_order as number;
  }
  return prisma.discipline.update({ where: { id }, data });
}

/** Everything the admin assignment screen needs: current value and a suggestion per row. */
export async function loadAssignments() {
  const [disciplines, cubes, missions, legacy] = await Promise.all([
    prisma.discipline.findMany({ select: { id: true, key: true } }),
    prisma.cubeProfile.findMany({
      select: {
        id: true,
        user_id: true,
        cube_number: true,
        department: true,
        current_level: true,
        discipline_id: true,
        user: { select: { name: true } },
        team_memberships: { select: { team: { select: { mission: { select: { discipline_id: true } } } } } },
      },
      orderBy: { cube_number: 'asc' },
    }),
    prisma.mission.findMany({
      select: { id: true, title: true, category: true, status: true, discipline_id: true },
      orderBy: { created_at: 'desc' },
    }),
    prisma.mentorFeedback.groupBy({ by: ['cube_id'], _count: { _all: true } }),
  ]);
  const keyById = new Map(disciplines.map(d => [d.id, d.key]));
  const idByKey = new Map(disciplines.map(d => [d.key, d.id]));
  const legacyByUser = new Map(legacy.map(l => [l.cube_id, l._count._all]));

  const withId = (s: DisciplineSuggestion | null) =>
    s && idByKey.has(s.key) ? { discipline_id: idByKey.get(s.key)!, reason: s.reason } : null;

  return {
    cubes: cubes.map(c => ({
      id: c.id,
      name: c.user.name,
      cube_number: c.cube_number,
      department: c.department,
      current_level: c.current_level,
      discipline_id: c.discipline_id,
      suggestion: withId(
        suggestCubeDiscipline({
          legacy_scorecards: legacyByUser.get(c.user_id) || 0,
          mission_discipline_keys: c.team_memberships
            .map(m => keyById.get(m.team.mission?.discipline_id || ''))
            .filter((k): k is string => Boolean(k)),
          department: c.department,
        })
      ),
    })),
    missions: missions.map(m => ({
      id: m.id,
      title: m.title,
      category: m.category,
      status: m.status,
      discipline_id: m.discipline_id,
      suggestion: withId(suggestMissionDiscipline(m)),
    })),
  };
}

/**
 * Applies several assignments at once (the admin confirming suggestions).
 * `discipline_id: null` clears an assignment. All or nothing.
 */
export async function applyAssignments(input: { cubes?: unknown; missions?: unknown }) {
  const parse = (list: unknown, label: string) => {
    if (list === undefined) return [];
    if (!Array.isArray(list) || list.length > 1000) throw badRequest(`${label} must be a list.`);
    return list.map(row => {
      const r = row as { id?: unknown; discipline_id?: unknown };
      if (typeof r.id !== 'string' || (r.discipline_id !== null && typeof r.discipline_id !== 'string')) {
        throw badRequest(`Each ${label} entry needs an id and a discipline_id (or null).`);
      }
      return { id: r.id, discipline_id: r.discipline_id as string | null };
    });
  };
  const cubes = parse(input.cubes, 'cubes');
  const missions = parse(input.missions, 'missions');
  const wanted = new Set([...cubes, ...missions].map(r => r.discipline_id).filter((id): id is string => Boolean(id)));
  if (wanted.size > 0) {
    const found = await prisma.discipline.count({ where: { id: { in: [...wanted] } } });
    if (found !== wanted.size) throw badRequest('Unknown discipline.');
  }
  await prisma.$transaction([
    ...cubes.map(r => prisma.cubeProfile.update({ where: { id: r.id }, data: { discipline_id: r.discipline_id } })),
    ...missions.map(r => prisma.mission.update({ where: { id: r.id }, data: { discipline_id: r.discipline_id } })),
  ]);
  return { cubes: cubes.length, missions: missions.length };
}

/**
 * Reads `discipline_id` from a mission form: undefined leaves it unchanged,
 * null or "" clears it, anything else must be an existing discipline.
 */
export async function resolveDisciplineId(value: unknown): Promise<string | null | undefined> {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value !== 'string') throw badRequest('discipline_id must be an id.');
  const found = await prisma.discipline.findUnique({ where: { id: value }, select: { id: true } });
  if (!found) throw badRequest('Unknown discipline.');
  return found.id;
}
