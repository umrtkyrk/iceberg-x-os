import prisma from './prisma';
import { badRequest } from '../utils/http';
import { listContributors } from './contributor.service';

/**
 * Mission lineage: "this mission continues that one".
 *
 * A mission may follow several earlier missions, and may itself be followed by
 * many. Links live in their own table (MissionLink), so no Mission row is ever
 * touched by linking or unlinking.
 */

export const MAX_PREDECESSORS = 5;

export interface LinkedMission {
  id: string;
  title: string;
  status: string;
  decision: string | null;
  category: string;
}

const linkedSelect = { id: true, title: true, status: true, decision: true, category: true } as const;

/** Drops blanks and duplicates, keeping order. */
export function normalizeIds(input: any): string[] {
  if (!Array.isArray(input)) return [];
  return [...new Set(input.filter((v): v is string => typeof v === 'string' && v.length > 0))];
}

/**
 * Replaces a mission's predecessor set. Rejects self-links, unknown missions
 * and anything that would create a loop (A continues B continues A).
 */
export async function setPredecessors(tx: any, missionId: string, ids: string[]) {
  if (ids.length > MAX_PREDECESSORS) {
    throw badRequest(`A mission can continue at most ${MAX_PREDECESSORS} earlier missions.`);
  }
  if (ids.includes(missionId)) throw badRequest('A mission cannot continue itself.');

  if (ids.length > 0) {
    const found = await tx.mission.findMany({ where: { id: { in: ids } }, select: { id: true } });
    if (found.length !== ids.length) throw badRequest('One or more linked missions no longer exist.');

    // Walk up each candidate's own ancestry; reaching this mission means a loop
    const seen = new Set<string>();
    let frontier = [...ids];
    while (frontier.length > 0) {
      const links = await tx.missionLink.findMany({
        where: { mission_id: { in: frontier } },
        select: { predecessor_id: true }
      });
      frontier = [];
      for (const l of links) {
        if (l.predecessor_id === missionId) {
          throw badRequest('That link would create a loop: the selected mission already continues this one.');
        }
        if (!seen.has(l.predecessor_id)) {
          seen.add(l.predecessor_id);
          frontier.push(l.predecessor_id);
        }
      }
    }
  }

  const existing = await tx.missionLink.findMany({
    where: { mission_id: missionId },
    select: { id: true, predecessor_id: true }
  });
  const keep = new Set(ids);
  const stale = existing.filter((e: any) => !keep.has(e.predecessor_id)).map((e: any) => e.id);
  const have = new Set(existing.map((e: any) => e.predecessor_id));

  if (stale.length > 0) await tx.missionLink.deleteMany({ where: { id: { in: stale } } });
  const fresh = ids.filter(id => !have.has(id));
  if (fresh.length > 0) {
    await tx.missionLink.createMany({
      data: fresh.map(predecessor_id => ({ mission_id: missionId, predecessor_id })),
      skipDuplicates: true
    });
  }
}

/**
 * Predecessors and follow-ups for the given missions. Cubes only see linked
 * missions they could open anyway (assigned to a mentor or a team).
 */
export async function loadLinks(
  missionIds: string[],
  role?: string
): Promise<Map<string, { predecessors: LinkedMission[]; followups: LinkedMission[] }>> {
  const result = new Map<string, { predecessors: LinkedMission[]; followups: LinkedMission[] }>();
  if (missionIds.length === 0) return result;

  const visible = role === 'CUBE' ? { OR: [{ mentor_id: { not: null } }, { teams: { some: {} } }] } : {};

  const [up, down] = await Promise.all([
    prisma.missionLink.findMany({
      where: { mission_id: { in: missionIds }, predecessor: visible },
      select: { mission_id: true, predecessor: { select: linkedSelect } }
    }),
    prisma.missionLink.findMany({
      where: { predecessor_id: { in: missionIds }, mission: visible },
      select: { predecessor_id: true, mission: { select: linkedSelect } }
    })
  ]);

  const entry = (id: string) => {
    let e = result.get(id);
    if (!e) {
      e = { predecessors: [], followups: [] };
      result.set(id, e);
    }
    return e;
  };
  up.forEach(l => entry(l.mission_id).predecessors.push(l.predecessor));
  down.forEach(l => entry(l.predecessor_id).followups.push(l.mission));
  return result;
}

const clip = (text: string | null | undefined, max = 1500) => {
  const t = (text || '').trim();
  return t.length > max ? t.slice(0, max) + '…' : t;
};

export interface PredecessorBrief {
  title: string;
  status: string;
  decision: string | null;
  category: string;
  description: string;
  context: string;
  problem_statement: string;
  expected_output: string;
  team: string[];
  demo: {
    what_we_built: string;
    what_we_learned: string;
    what_worked_well: string;
    what_could_we_have_done_better: string;
    recommendation: string | null;
  } | null;
}

/** Everything worth carrying forward from earlier missions, trimmed for a prompt. */
export async function loadPredecessorBriefs(ids: string[]): Promise<PredecessorBrief[]> {
  if (ids.length === 0) return [];

  const [missions, contributors] = await Promise.all([
    prisma.mission.findMany({
      where: { id: { in: ids } },
      select: {
        id: true, title: true, status: true, decision: true, category: true,
        description: true, context: true, problem_statement: true, expected_output: true,
        demo_submissions: {
          orderBy: { submitted_at: 'desc' },
          take: 1,
          select: {
            what_we_built: true, what_we_learned: true, what_worked_well: true,
            what_could_we_have_done_better: true, recommendation: true
          }
        }
      }
    }),
    listContributors(ids)
  ]);

  // Keep the order the caller picked
  return ids
    .map(id => missions.find(m => m.id === id))
    .filter((m): m is NonNullable<typeof m> => !!m)
    .map(m => {
      const demo = m.demo_submissions[0];
      return {
        title: m.title,
        status: m.status,
        decision: m.decision,
        category: m.category,
        description: clip(m.description),
        context: clip(m.context),
        problem_statement: clip(m.problem_statement),
        expected_output: clip(m.expected_output),
        team: (contributors.get(m.id) || []).map(c => c.name),
        demo: demo
          ? {
              what_we_built: clip(demo.what_we_built),
              what_we_learned: clip(demo.what_we_learned),
              what_worked_well: clip(demo.what_worked_well),
              what_could_we_have_done_better: clip(demo.what_could_we_have_done_better),
              recommendation: demo.recommendation ? clip(demo.recommendation) : null
            }
          : null
      };
    });
}
