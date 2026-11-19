/**
 * Scoring v2 data access: loads the raw records once per batch of Cubes and
 * feeds the pure formula in scoreV2.ts. Also the weekly snapshot backfill,
 * the admin shadow and calibration reports, and check-ins.
 *
 * Nothing here changes an existing record. Snapshots are derived data and are
 * rebuilt wholesale per formula version.
 */
import prisma from './prisma';
import { badRequest, forbidden, notFound } from '../utils/http';
import { computeScoreBreakdown, peerConfidence, peerSignalValue } from './score.service';
import { criteriaForDiscipline } from './rubric.service';
import { normalizeRatings } from './scorecard.service';
import { IN_PROGRAMME_CUBE_LEVELS } from '../config/constants';
import {
  FORMULA_VERSION,
  computeScoreV2,
  growthOver,
  weekStart,
  weeksBetween,
  type Assessment,
  type ScoreInput,
  type ScoreV2,
} from './scoreV2';

/** Cube-facing v2 score is off until the programme goes live with it. */
export const isScoringV2Live = () => process.env.SCORING_V2_LIVE === 'true';

const DELIVERY_DUE_STATUSES = ['demo_ready', 'pending_approval', 'completed', 'reviewed', 'promoted_to_product_backlog'];
const LEGACY_COLUMNS = [
  'technical_ability_score',
  'research_ability_score',
  'demo_output_score',
  'ownership_score',
  'communication_score',
  'leadership_score',
  'product_thinking_score',
  'reliability_score',
  'self_reflection_score',
] as const;

interface CubeMeta {
  id: string;
  user_id: string;
  name: string;
  cube_number: string;
  started_at: Date;
}

/** Raw records for many Cubes in a fixed number of queries. */
export async function loadScoreInputs(cubeProfileIds: string[]): Promise<Map<string, { meta: CubeMeta; input: ScoreInput }>> {
  const result = new Map<string, { meta: CubeMeta; input: ScoreInput }>();
  if (cubeProfileIds.length === 0) return result;

  const profiles = await prisma.cubeProfile.findMany({
    where: { id: { in: cubeProfileIds } },
    select: { id: true, user_id: true, cube_number: true, created_at: true, user: { select: { name: true } } },
  });
  const userIds = profiles.map(p => p.user_id);
  const profileIds = profiles.map(p => p.id);

  const [criteria, feedback, checkins, notes, memberships, updates, demos, attendance, quizzes, peers] = await Promise.all([
    prisma.criterion.findMany({ select: { id: true, key: true, name: true, discipline_id: true, legacy_key: true } }),
    prisma.mentorFeedback.findMany({
      where: { cube_id: { in: userIds } },
      select: {
        cube_id: true,
        mentor_id: true,
        mission_id: true,
        created_at: true,
        ...Object.fromEntries(LEGACY_COLUMNS.map(c => [c, true])),
        mission: { select: { difficulty_level: true } },
        ratings: { select: { criterion_id: true, value: true } },
      } as any,
    }) as Promise<any[]>,
    prisma.checkIn.findMany({
      where: { cube_id: { in: profileIds }, kind: 'checkin' },
      select: { cube_id: true, author_id: true, mission_id: true, created_at: true, ratings: { select: { criterion_id: true, value: true } } },
    }),
    prisma.privateNote.findMany({ where: { cube_id: { in: profileIds }, score: { not: null } }, select: { cube_id: true, score: true, created_at: true } }),
    prisma.missionTeamMember.findMany({
      where: { cube_id: { in: profileIds } },
      select: { cube_id: true, created_at: true, team_id: true, team: { select: { mission: { select: { id: true, status: true, difficulty_level: true } } } } },
    }),
    prisma.update.findMany({ where: { cube_id: { in: userIds } }, select: { cube_id: true, created_at: true } }),
    prisma.demoSubmission.findMany({ select: { mission_id: true, team_id: true, submitted_by_id: true, created_at: true } }),
    prisma.meetingAttendance.findMany({ where: { cube_id: { in: profileIds } }, select: { cube_id: true, attended: true, meeting: { select: { date: true } } } }),
    prisma.quizAttempt.findMany({
      where: { cube_id: { in: profileIds }, status: 'completed' },
      select: { cube_id: true, score: true, completed_at: true, started_at: true },
    }),
    prisma.peerSignal.findMany({ where: { cube_id: { in: profileIds } } }),
  ]);

  const criterionById = new Map(criteria.map(c => [c.id, c]));
  const keyByLegacy = new Map(criteria.filter(c => c.legacy_key).map(c => [c.legacy_key!, c.key]));
  const criteriaInfo = Object.fromEntries(criteria.map(c => [c.key, { name: c.name, core: !c.discipline_id, discipline_id: c.discipline_id }]));
  const missionDifficulty = new Map<string, string>();
  for (const m of memberships) if (m.team.mission) missionDifficulty.set(m.team.mission.id, m.team.mission.difficulty_level);

  const toRatings = (rows: { criterion_id: string; value: number | null }[]) =>
    Object.fromEntries(rows.map(r => [criterionById.get(r.criterion_id)?.key || r.criterion_id, r.value]));

  for (const p of profiles) {
    const mine = memberships.filter(m => m.cube_id === p.id && m.team.mission);
    const teamIds = new Set(mine.map(m => m.team_id));
    const assessments: Assessment[] = [
      ...feedback
        .filter(f => f.cube_id === p.user_id)
        .map(f => {
          const legacy = f.ratings.length === 0;
          const ratings = legacy
            ? Object.fromEntries(
                LEGACY_COLUMNS.filter(c => keyByLegacy.has(c)).map(c => [keyByLegacy.get(c)!, typeof f[c] === 'number' ? f[c] : null])
              )
            : toRatings(f.ratings);
          return {
            at: f.created_at,
            kind: 'scorecard' as const,
            ratings,
            difficulty: f.mission?.difficulty_level ?? null,
            mission_id: f.mission_id,
            legacy,
            mentor_id: f.mentor_id,
          };
        }),
      ...checkins
        .filter(c => c.cube_id === p.id)
        .map(c => ({
          at: c.created_at,
          kind: 'checkin' as const,
          ratings: toRatings(c.ratings),
          difficulty: c.mission_id ? missionDifficulty.get(c.mission_id) ?? null : null,
          mission_id: c.mission_id,
          legacy: false,
          mentor_id: c.author_id,
        })),
    ];
    const peer = peers.find(s => s.cube_id === p.id);
    const confidence = peer ? peerConfidence(peer.distinct_givers, peer.distinct_contexts) : 0;

    result.set(p.id, {
      meta: {
        id: p.id,
        user_id: p.user_id,
        name: p.user.name,
        cube_number: p.cube_number,
        started_at: [p.created_at, ...mine.map(m => m.created_at), ...assessments.map(a => a.at)].reduce((a, b) => (b < a ? b : a)),
      },
      input: {
        assessments,
        private_scores: notes.filter(n => n.cube_id === p.id).map(n => ({ at: n.created_at, score: n.score! })),
        memberships: mine.map(m => ({ mission_id: m.team.mission!.id, joined_at: m.created_at })),
        delivery_due_mission_ids: mine.filter(m => DELIVERY_DUE_STATUSES.includes(m.team.mission!.status)).map(m => m.team.mission!.id),
        update_times: updates.filter(u => u.cube_id === p.user_id).map(u => u.created_at),
        demos: demos
          .filter(d => d.submitted_by_id === p.user_id || (d.team_id && teamIds.has(d.team_id)))
          .map(d => ({ mission_id: d.mission_id, at: d.created_at })),
        attendance: attendance.filter(a => a.cube_id === p.id).map(a => ({ at: a.meeting.date, attended: a.attended })),
        quiz_scores: quizzes.filter(q => q.cube_id === p.id).map(q => ({ at: q.completed_at || q.started_at, score: q.score })),
        peer: peer && confidence > 0 ? { signal: peerSignalValue(peer.kudos_score, peer.concern_score), confidence } : null,
        criteria: criteriaInfo,
      },
    });
  }
  return result;
}

/** The live v2 score for one Cube, with its growth line and self-assessment gap. */
export async function liveScore(cubeProfileId: string) {
  const loaded = (await loadScoreInputs([cubeProfileId])).get(cubeProfileId);
  if (!loaded) throw notFound('Cube not found.');
  const score = computeScoreV2(loaded.input, new Date(), { includePeer: true });
  const snapshots = await prisma.scoreSnapshot.findMany({
    where: { cube_id: cubeProfileId, formula_version: FORMULA_VERSION },
    select: { week_start: true, overall: true },
    orderBy: { week_start: 'asc' },
  });

  // Latest self-assessment, per criterion, next to the mentor's view.
  const self = await prisma.checkIn.findFirst({
    where: { cube_id: cubeProfileId, kind: 'self' },
    orderBy: { created_at: 'desc' },
    select: { created_at: true, ratings: { select: { value: true, criterion: { select: { key: true } } } } },
  });
  const selfByKey = new Map((self?.ratings || []).map(r => [r.criterion.key, r.value]));

  // The profile shows core criteria and the Cube's own discipline. Older
  // ratings on another discipline's criteria still count in the score.
  const cube = await prisma.cubeProfile.findUnique({ where: { id: cubeProfileId }, select: { discipline_id: true } });
  const relevant = (key: string) => {
    const info = loaded.input.criteria[key];
    return !cube?.discipline_id || !info || info.core || info.discipline_id === cube.discipline_id;
  };

  return {
    ...score,
    criteria: score.criteria.filter(c => relevant(c.key)).map(c => ({ ...c, self: selfByKey.get(c.key) ?? null })),
    self_assessed_at: self?.created_at.toISOString() ?? null,
    growth: {
      weekly: snapshots.map(s => ({ week_start: s.week_start.toISOString(), overall: s.overall })),
      last_12_weeks: growthOver(snapshots, 12),
      since_start: growthOver(snapshots, 10_000),
    },
  };
}

/**
 * Rebuilds the weekly snapshots of the current formula version for the given
 * Cubes (default: everyone). Deterministic and safe to re-run.
 */
export async function backfillSnapshots(cubeProfileIds?: string[]) {
  const ids = cubeProfileIds ?? (await prisma.cubeProfile.findMany({ select: { id: true } })).map(c => c.id);
  const loaded = await loadScoreInputs(ids);
  const now = new Date();
  const currentWeek = weekStart(now).getTime();
  let written = 0;

  for (const [cubeId, { meta, input }] of loaded) {
    const rows = weeksBetween(meta.started_at, now).map(week => {
      const isCurrent = week.getTime() === currentWeek;
      const asOf = isCurrent ? now : new Date(week.getTime() + 7 * 86_400_000 - 1);
      const s = computeScoreV2(input, asOf, { includePeer: isCurrent });
      return {
        cube_id: cubeId,
        week_start: week,
        formula_version: FORMULA_VERSION,
        overall: s.overall,
        mentor: s.pillars.mentor,
        delivery: s.pillars.delivery,
        private_effect: s.private_effect,
        band: s.band,
        provisional: s.provisional,
        detail: { pillars: s.pillars, basis: s.basis } as any,
      };
    });
    await prisma.$transaction([
      prisma.scoreSnapshot.deleteMany({ where: { cube_id: cubeId, formula_version: FORMULA_VERSION } }),
      prisma.scoreSnapshot.createMany({ data: rows }),
    ]);
    written += rows.length;
  }
  return { cubes: loaded.size, snapshots: written, formula_version: FORMULA_VERSION };
}

/**
 * Current v2 score of every Cube, for staff lists such as the Directory.
 * Computed live in one batch (a fixed number of queries).
 */
export async function scoresForAllCubes() {
  const ids = (await prisma.cubeProfile.findMany({ select: { id: true } })).map(c => c.id);
  const loaded = await loadScoreInputs(ids);
  const now = new Date();
  const scores: Record<string, { overall: number | null; band: string | null; provisional: boolean }> = {};
  for (const [id, { input }] of loaded) {
    const s = computeScoreV2(input, now, { includePeer: true });
    scores[id] = { overall: s.overall, band: s.band, provisional: s.provisional };
  }
  return { formula_version: FORMULA_VERSION, scores };
}

/** Admin shadow view: legacy score next to v2, biggest moves first. */
export async function shadowReport() {
  const cubes = await prisma.cubeProfile.findMany({
    where: { current_level: { in: IN_PROGRAMME_CUBE_LEVELS } },
    select: { id: true, discipline: { select: { name: true } } },
  });
  const loaded = await loadScoreInputs(cubes.map(c => c.id));
  const snapshots = await prisma.scoreSnapshot.findMany({
    where: { cube_id: { in: cubes.map(c => c.id) }, formula_version: FORMULA_VERSION },
    select: { cube_id: true, week_start: true, overall: true, computed_at: true },
    orderBy: { week_start: 'asc' },
  });
  const now = new Date();
  const rows = [];
  for (const cube of cubes) {
    const data = loaded.get(cube.id);
    if (!data) continue;
    const legacy = await computeScoreBreakdown(cube.id);
    const v2 = computeScoreV2(data.input, now, { includePeer: true });
    const mine = snapshots.filter(s => s.cube_id === cube.id);
    rows.push({
      cube_profile_id: cube.id,
      name: data.meta.name,
      cube_number: data.meta.cube_number,
      discipline: cube.discipline?.name ?? null,
      legacy: legacy.overall === null ? null : Math.round(legacy.overall * 10) / 10,
      v2: v2.overall,
      delta: legacy.overall !== null && v2.overall !== null ? Math.round((v2.overall - legacy.overall) * 10) / 10 : null,
      band: v2.band,
      provisional: v2.provisional,
      private_effect: v2.private_effect,
      pillars: v2.pillars,
      basis: v2.basis,
      trend: mine.slice(-12).map(s => s.overall),
    });
  }
  rows.sort((a, b) => Math.abs(b.delta ?? 0) - Math.abs(a.delta ?? 0));
  const lastComputed = snapshots.reduce<Date | null>((latest, s) => (!latest || s.computed_at > latest ? s.computed_at : latest), null);
  return { formula_version: FORMULA_VERSION, last_backfill_at: lastComputed?.toISOString() ?? null, rows };
}

/**
 * Mentor calibration: how each mentor's ratings compare with everyone's.
 * Made visible, never used to correct scores automatically.
 */
export async function calibrationReport() {
  const [feedback, checkins, mentors] = await Promise.all([
    prisma.mentorFeedback.findMany({ select: { mentor_id: true, ratings: { select: { value: true } }, ...Object.fromEntries(LEGACY_COLUMNS.map(c => [c, true])) } as any }) as Promise<any[]>,
    prisma.checkIn.findMany({ where: { kind: 'checkin' }, select: { author_id: true, ratings: { select: { value: true } } } }),
    prisma.user.findMany({ where: { role: { in: ['MENTOR', 'ADMIN'] } }, select: { id: true, name: true } }),
  ]);
  const values = new Map<string, number[]>();
  const counts = new Map<string, number>();
  const add = (mentorId: string, vals: (number | null)[]) => {
    const observed = vals.filter((v): v is number => typeof v === 'number');
    if (observed.length === 0) return;
    if (!values.has(mentorId)) values.set(mentorId, []);
    values.get(mentorId)!.push(...observed);
    counts.set(mentorId, (counts.get(mentorId) || 0) + 1);
  };
  for (const f of feedback) add(f.mentor_id, f.ratings.length ? f.ratings.map((r: any) => r.value) : LEGACY_COLUMNS.map(c => f[c]));
  for (const c of checkins) add(c.author_id, c.ratings.map(r => r.value));

  const all = [...values.values()].flat();
  const programmeMean = all.length ? all.reduce((a, b) => a + b, 0) / all.length : null;
  const nameById = new Map(mentors.map(m => [m.id, m.name]));
  const rows = [...values.entries()].map(([mentorId, vals]) => {
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const distribution = [1, 2, 3, 4, 5].map(level => vals.filter(v => v === level).length);
    return {
      mentor_id: mentorId,
      name: nameById.get(mentorId) || 'Unknown',
      assessments: counts.get(mentorId) || 0,
      ratings: vals.length,
      mean: Math.round(mean * 100) / 100,
      offset: programmeMean === null ? null : Math.round((mean - programmeMean) * 100) / 100,
      distribution,
    };
  });
  rows.sort((a, b) => Math.abs(b.offset ?? 0) - Math.abs(a.offset ?? 0));
  return { programme_mean: programmeMean === null ? null : Math.round(programmeMean * 100) / 100, mentors: rows };
}

export interface Viewer {
  id: string;
  role: string;
  cubeProfileId?: string;
}

/**
 * A mentor check-in (counts at half weight) or a Cube's self-assessment
 * (never counts towards the score). Criteria come from the mission's or the
 * Cube's discipline, like a scorecard.
 */
export async function createCheckIn(
  viewer: Viewer,
  input: { cube_profile_id?: unknown; mission_id?: unknown; kind?: unknown; ratings?: unknown; note?: unknown }
) {
  const kind = input.kind === 'self' ? 'self' : input.kind === 'checkin' ? 'checkin' : null;
  if (!kind) throw badRequest('kind must be "checkin" or "self".');
  if (typeof input.cube_profile_id !== 'string') throw badRequest('cube_profile_id is required.');
  const cube = await prisma.cubeProfile.findUnique({ where: { id: input.cube_profile_id }, select: { id: true, discipline_id: true } });
  if (!cube) throw notFound('Cube not found.');

  if (kind === 'self' && viewer.cubeProfileId !== cube.id) throw forbidden('Only the Cube can rate themselves.');
  if (kind === 'checkin' && viewer.role !== 'ADMIN' && viewer.role !== 'MENTOR') throw forbidden('Only mentors can check in.');

  let missionId: string | null = null;
  let disciplineId = cube.discipline_id;
  if (typeof input.mission_id === 'string' && input.mission_id) {
    const mission = await prisma.mission.findUnique({ where: { id: input.mission_id }, select: { id: true, discipline_id: true } });
    if (!mission) throw badRequest('Unknown mission.');
    missionId = mission.id;
    disciplineId = mission.discipline_id ?? disciplineId;
  }
  const applicable = await criteriaForDiscipline(disciplineId);
  const ratings = normalizeRatings(input.ratings, applicable);
  const note = typeof input.note === 'string' && input.note.trim() ? input.note.trim().slice(0, 2000) : null;

  return prisma.checkIn.create({
    data: {
      cube_id: cube.id,
      mission_id: missionId,
      author_id: viewer.id,
      kind,
      note,
      ratings: { create: ratings.map(r => ({ criterion_id: r.criterion_id, value: r.value })) },
    },
    select: { id: true, kind: true, created_at: true },
  });
}

/** Check-ins on a Cube: staff see all; the Cube sees their own self-assessments and mentor check-ins. */
export async function listCheckIns(viewer: Viewer, cubeProfileId: string) {
  const isStaff = viewer.role === 'ADMIN' || viewer.role === 'MENTOR';
  if (!isStaff && viewer.cubeProfileId !== cubeProfileId) throw forbidden('You can only see your own check-ins.');
  const rows = await prisma.checkIn.findMany({
    where: { cube_id: cubeProfileId },
    orderBy: { created_at: 'desc' },
    take: 20,
    select: {
      id: true,
      kind: true,
      note: true,
      created_at: true,
      mission_id: true,
      author_id: true,
      ratings: { select: { value: true, criterion: { select: { key: true, name: true, sort_order: true } } }, orderBy: { criterion: { sort_order: 'asc' } } },
    },
  });
  const authors = await prisma.user.findMany({ where: { id: { in: [...new Set(rows.map(r => r.author_id))] } }, select: { id: true, name: true } });
  const nameById = new Map(authors.map(a => [a.id, a.name]));
  return rows.map(r => ({ ...r, author: nameById.get(r.author_id) || 'Unknown' }));
}

export { type ScoreV2 };
