/**
 * Peer feedback: the write path and the recipient/profile read models.
 *
 * Privacy contract (enforced here, not just in the UI):
 *  - giver_hash is never selected into any returned object.
 *  - Recipients only ever see KUDOS text, and only after the weekly cutoff.
 *  - OBSERVATION and CONCERN text is never returned to anyone, including staff.
 *    Staff see aggregates (see radar.routes.ts).
 */
import prisma from './prisma';
import {
  PeerContextType,
  PeerFeedbackKind,
  PeerFeedbackStatus,
  PeerSignalState
} from '@prisma/client';
import { badRequest, conflict, forbidden, notFound } from '../utils/http';
import { IN_PROGRAMME_CUBE_LEVELS } from '../config/constants';
import {
  CONCERN_DAILY_LIMIT,
  CONCERN_TAGS,
  CONCERN_TARGET_COOLDOWN_DAYS,
  KUDOS_TAGS,
  KUDOS_TARGET_COOLDOWN_DAYS,
  KUDOS_WEEKLY_BUDGET,
  K_ANONYMITY,
  MAX_PINNED,
  MAX_TAGS,
  NOTE_MAX_LENGTH,
  NOTE_MIN_LENGTH_OTHER_CONTEXT,
  OBSERVATION_TAGS,
  QUIET_GIVERS_THRESHOLD,
  TITLE_LABELS,
  WEIGHT_NO_CONTEXT,
  WEIGHT_SHARED_MEETING,
  WEIGHT_SHARED_WORK,
  validTagsFor
} from '../config/peer';
import { daysAgo, digestCutoff, giverHash, monthKey, monthLabel, previousMonthKey, monthRange } from './peerCore';
import { recomputeCubePeerState, refreshPeerSignal } from './peerSignal.service';
import { getHashIndex } from './peerAbuse.service';
import { ensureAutoQuestsForCube, recalculateAllQuestsForCube } from './quest.service';

const KINDS = Object.values(PeerFeedbackKind) as string[];
const CONTEXT_TYPES = Object.values(PeerContextType) as string[];

export interface CreatePeerFeedbackInput {
  receiver_id?: unknown;
  kind?: unknown;
  tags?: unknown;
  note?: unknown;
  context_type?: unknown;
  context_id?: unknown;
  confirmed_firsthand?: unknown;
}

/** Everything the composer needs, so the frontend never mirrors the catalogue. */
export function getCatalog() {
  return {
    kudos_tags: KUDOS_TAGS,
    observation_tags: OBSERVATION_TAGS,
    concern_tags: CONCERN_TAGS,
    limits: {
      kudos_weekly_budget: KUDOS_WEEKLY_BUDGET,
      kudos_target_cooldown_days: KUDOS_TARGET_COOLDOWN_DAYS,
      concern_target_cooldown_days: CONCERN_TARGET_COOLDOWN_DAYS,
      concern_daily_limit: CONCERN_DAILY_LIMIT,
      max_tags: MAX_TAGS,
      note_max_length: NOTE_MAX_LENGTH,
      note_min_length_other_context: NOTE_MIN_LENGTH_OTHER_CONTEXT,
      max_pinned: MAX_PINNED,
      k_anonymity: K_ANONYMITY
    }
  };
}

export async function getBudget(userId: string) {
  const hash = giverHash(userId);
  const [kudosUsed, concernsToday] = await Promise.all([
    prisma.peerFeedback.count({
      where: { giver_hash: hash, kind: PeerFeedbackKind.KUDOS, created_at: { gte: daysAgo(7) } }
    }),
    prisma.peerFeedback.count({
      where: {
        giver_hash: hash,
        kind: { in: [PeerFeedbackKind.CONCERN, PeerFeedbackKind.OBSERVATION] },
        created_at: { gte: daysAgo(1) }
      }
    })
  ]);

  return {
    kudos: {
      limit: KUDOS_WEEKLY_BUDGET,
      used: kudosUsed,
      remaining: Math.max(0, KUDOS_WEEKLY_BUDGET - kudosUsed)
    },
    concerns: {
      daily_limit: CONCERN_DAILY_LIMIT,
      used_today: concernsToday,
      remaining_today: Math.max(0, CONCERN_DAILY_LIMIT - concernsToday)
    }
  };
}

/** Cubes that share a mission or team with the given Cube. */
async function sharedWork(giverId: string, receiverId: string): Promise<boolean> {
  const [giverMissions, receiverMissions, giverTeams, receiverTeams] = await Promise.all([
    prisma.missionContributor.findMany({ where: { cube_id: giverId }, select: { mission_id: true } }),
    prisma.missionContributor.findMany({ where: { cube_id: receiverId }, select: { mission_id: true } }),
    prisma.missionTeamMember.findMany({ where: { cube_id: giverId }, select: { team_id: true } }),
    prisma.missionTeamMember.findMany({ where: { cube_id: receiverId }, select: { team_id: true } })
  ]);

  const missions = new Set(giverMissions.map(m => m.mission_id));
  if (receiverMissions.some(m => missions.has(m.mission_id))) return true;

  const teams = new Set(giverTeams.map(t => t.team_id));
  return receiverTeams.some(t => teams.has(t.team_id));
}

async function resolveContext(
  giverId: string,
  receiverId: string,
  type: PeerContextType,
  contextId: string | null
): Promise<{ weight: number; context_type: PeerContextType; context_id: string | null }> {
  // An explicit context must be real and must actually include the receiver.
  if (type === PeerContextType.MISSION) {
    if (!contextId) throw badRequest('Choose the mission this feedback is about.');
    const [receiverOn, giverOn] = await Promise.all([
      prisma.missionContributor.findFirst({ where: { mission_id: contextId, cube_id: receiverId }, select: { id: true } }),
      prisma.missionContributor.findFirst({ where: { mission_id: contextId, cube_id: giverId }, select: { id: true } })
    ]);
    const receiverTeam = receiverOn
      ? null
      : await prisma.missionTeamMember.findFirst({
          where: { cube_id: receiverId, team: { mission_id: contextId } },
          select: { id: true }
        });
    if (!receiverOn && !receiverTeam) {
      throw badRequest('That person was not part of the selected mission.');
    }
    const giverTeam = giverOn
      ? null
      : await prisma.missionTeamMember.findFirst({
          where: { cube_id: giverId, team: { mission_id: contextId } },
          select: { id: true }
        });
    return {
      weight: giverOn || giverTeam ? WEIGHT_SHARED_WORK : WEIGHT_NO_CONTEXT,
      context_type: type,
      context_id: contextId
    };
  }

  if (type === PeerContextType.TEAM) {
    if (!contextId) throw badRequest('Choose the team this feedback is about.');
    const [receiverIn, giverIn] = await Promise.all([
      prisma.missionTeamMember.findFirst({ where: { team_id: contextId, cube_id: receiverId }, select: { id: true } }),
      prisma.missionTeamMember.findFirst({ where: { team_id: contextId, cube_id: giverId }, select: { id: true } })
    ]);
    if (!receiverIn) throw badRequest('That person is not in the selected team.');
    return {
      weight: giverIn ? WEIGHT_SHARED_WORK : WEIGHT_NO_CONTEXT,
      context_type: type,
      context_id: contextId
    };
  }

  if (type === PeerContextType.MEETING) {
    if (!contextId) throw badRequest('Choose the meeting this feedback is about.');
    const meeting = await prisma.meeting.findUnique({
      where: { id: contextId },
      select: { invited_cube_ids: true }
    });
    if (!meeting || !meeting.invited_cube_ids.includes(receiverId)) {
      throw badRequest('That person was not part of the selected meeting.');
    }
    return {
      weight: meeting.invited_cube_ids.includes(giverId) ? WEIGHT_SHARED_MEETING : WEIGHT_NO_CONTEXT,
      context_type: type,
      context_id: contextId
    };
  }

  // No explicit context: fall back to the real relationship between the two.
  if (await sharedWork(giverId, receiverId)) {
    return { weight: WEIGHT_SHARED_WORK, context_type: PeerContextType.OTHER, context_id: null };
  }
  const sharedMeeting = await prisma.meeting.findFirst({
    where: { invited_cube_ids: { hasEvery: [giverId, receiverId] } },
    select: { id: true }
  });
  return {
    weight: sharedMeeting ? WEIGHT_SHARED_MEETING : WEIGHT_NO_CONTEXT,
    context_type: PeerContextType.OTHER,
    context_id: null
  };
}

function parseTags(raw: unknown, kind: PeerFeedbackKind): string[] {
  if (!Array.isArray(raw)) throw badRequest('Choose at least one tag.');
  const tags = [...new Set(raw.map(t => String(t)))];
  if (tags.length === 0) throw badRequest('Choose at least one tag.');
  if (tags.length > MAX_TAGS) throw badRequest(`Choose at most ${MAX_TAGS} tags.`);

  const allowed = validTagsFor(kind);
  const invalid = tags.filter(t => !allowed.has(t));
  if (invalid.length > 0) throw badRequest('One or more tags are not valid for this type of feedback.');
  return tags;
}

/** Creates peer feedback. Returns only what the giver needs to see. */
export async function createPeerFeedback(
  userId: string,
  giverCubeId: string,
  input: CreatePeerFeedbackInput
) {
  if (!KINDS.includes(String(input.kind))) {
    throw badRequest('Choose what kind of feedback this is.');
  }
  const kind = String(input.kind) as PeerFeedbackKind;

  const receiverId = input.receiver_id ? String(input.receiver_id) : '';
  if (!receiverId) throw badRequest('Choose who this feedback is for.');
  if (receiverId === giverCubeId) throw badRequest('You cannot give feedback to yourself.');

  const [giver, receiver] = await Promise.all([
    prisma.cubeProfile.findUnique({ where: { id: giverCubeId }, select: { id: true, current_level: true } }),
    prisma.cubeProfile.findUnique({
      where: { id: receiverId },
      select: { id: true, current_level: true, user: { select: { name: true } } }
    })
  ]);
  if (!giver || !IN_PROGRAMME_CUBE_LEVELS.includes(giver.current_level)) {
    throw forbidden('Only Cubes currently in the programme can give peer feedback.');
  }
  if (!receiver) throw notFound('Cube not found.');
  if (!IN_PROGRAMME_CUBE_LEVELS.includes(receiver.current_level)) {
    throw conflict(`${receiver.user?.name || 'This Cube'} is no longer in the programme.`);
  }

  const tags = parseTags(input.tags, kind);

  let note: string | null = null;
  if (input.note !== undefined && input.note !== null) {
    const trimmed = String(input.note).trim();
    if (trimmed.length > NOTE_MAX_LENGTH) {
      throw badRequest(`Keep the note under ${NOTE_MAX_LENGTH} characters.`);
    }
    note = trimmed.length > 0 ? trimmed : null;
  }

  const contextTypeRaw = input.context_type ? String(input.context_type) : PeerContextType.OTHER;
  if (!CONTEXT_TYPES.includes(contextTypeRaw)) throw badRequest('Choose where you observed this.');
  const contextType = contextTypeRaw as PeerContextType;
  const contextId = input.context_id ? String(input.context_id) : null;

  if (kind === PeerFeedbackKind.CONCERN) {
    if (input.confirmed_firsthand !== true) {
      throw badRequest('Please confirm that you observed this yourself before sending a concern.');
    }
    if (contextType === PeerContextType.OTHER && (note?.length ?? 0) < NOTE_MIN_LENGTH_OTHER_CONTEXT) {
      throw badRequest(
        `Without a mission, team or meeting, please add a short note (at least ${NOTE_MIN_LENGTH_OTHER_CONTEXT} characters) describing what you saw.`
      );
    }
  }

  const hash = giverHash(userId);

  // Budgets and cooldowns.
  if (kind === PeerFeedbackKind.KUDOS) {
    const [used, recentForTarget] = await Promise.all([
      prisma.peerFeedback.count({
        where: { giver_hash: hash, kind: PeerFeedbackKind.KUDOS, created_at: { gte: daysAgo(7) } }
      }),
      prisma.peerFeedback.findFirst({
        where: {
          giver_hash: hash,
          receiver_id: receiverId,
          kind: PeerFeedbackKind.KUDOS,
          created_at: { gte: daysAgo(KUDOS_TARGET_COOLDOWN_DAYS) }
        },
        select: { id: true }
      })
    ]);
    if (used >= KUDOS_WEEKLY_BUDGET) {
      throw conflict(
        `You have used all ${KUDOS_WEEKLY_BUDGET} kudos for this week. Your budget refills on a rolling 7-day basis.`
      );
    }
    if (recentForTarget) {
      throw conflict(
        `You already recognised this person in the last ${KUDOS_TARGET_COOLDOWN_DAYS} days. Spread it around, or come back later.`
      );
    }
  } else {
    const [todayCount, recentForTarget] = await Promise.all([
      prisma.peerFeedback.count({
        where: {
          giver_hash: hash,
          kind: { in: [PeerFeedbackKind.CONCERN, PeerFeedbackKind.OBSERVATION] },
          created_at: { gte: daysAgo(1) }
        }
      }),
      prisma.peerFeedback.findFirst({
        where: {
          giver_hash: hash,
          receiver_id: receiverId,
          kind: { in: [PeerFeedbackKind.CONCERN, PeerFeedbackKind.OBSERVATION] },
          created_at: { gte: daysAgo(CONCERN_TARGET_COOLDOWN_DAYS) }
        },
        select: { id: true }
      })
    ]);
    if (todayCount >= CONCERN_DAILY_LIMIT) {
      throw conflict('You have reached the daily limit for this type of feedback. Please try again tomorrow.');
    }
    if (recentForTarget) {
      throw conflict(
        `You already shared an observation or concern about this person in the last ${CONCERN_TARGET_COOLDOWN_DAYS} days.`
      );
    }
  }

  const context = await resolveContext(giverCubeId, receiverId, contextType, contextId);

  // "Quiet" is judged at write time and frozen, so it cannot be gamed later.
  let wasQuiet = false;
  if (kind === PeerFeedbackKind.KUDOS) {
    const existing = await prisma.peerFeedback.findMany({
      where: {
        receiver_id: receiverId,
        kind: PeerFeedbackKind.KUDOS,
        status: PeerFeedbackStatus.ACTIVE
      },
      distinct: ['giver_hash'],
      select: { giver_hash: true }
    });
    wasQuiet = existing.length < QUIET_GIVERS_THRESHOLD;
  }

  const created = await prisma.peerFeedback.create({
    data: {
      giver_hash: hash,
      receiver_id: receiverId,
      kind,
      tags,
      note,
      context_type: context.context_type,
      context_id: context.context_id,
      weight: context.weight,
      was_quiet: wasQuiet
    },
    select: { id: true, kind: true }
  });

  // Aggregates and quests are best-effort; the feedback itself is saved.
  void (async () => {
    try {
      await refreshPeerSignal(receiverId);
      await ensureAutoQuestsForCube(giverCubeId);
      await recalculateAllQuestsForCube(giverCubeId);
    } catch (err) {
      console.error('[peer] post-write refresh failed:', err);
    }
  })();

  return { id: created.id, kind: created.kind, budget: await getBudget(userId) };
}

/** Kudos the Cube has received, after the weekly cutoff. No giver, no dates. */
export async function listReceived(cubeProfileId: string) {
  await recomputeCubePeerState(cubeProfileId).catch(err =>
    console.error('[peer] recompute on inbox failed:', err)
  );

  const rows = await prisma.peerFeedback.findMany({
    where: {
      receiver_id: cubeProfileId,
      kind: PeerFeedbackKind.KUDOS,
      status: PeerFeedbackStatus.ACTIVE,
      created_at: { lt: digestCutoff() }
    },
    orderBy: { created_at: 'desc' },
    select: {
      id: true,
      tags: true,
      note: true,
      is_pinned: true,
      helpful_at: true,
      created_at: true
    }
  });

  return rows.map(r => ({
    id: r.id,
    tags: r.tags,
    note: r.note,
    pinned: r.is_pinned,
    helpful: r.helpful_at !== null,
    // Month only: coarse enough that it cannot be matched to a moment.
    period: monthLabel(monthKey(r.created_at))
  }));
}

/** The caller's own history, including who it was for. Never any other giver. */
export async function listGiven(userId: string) {
  const rows = await prisma.peerFeedback.findMany({
    where: { giver_hash: giverHash(userId) },
    orderBy: { created_at: 'desc' },
    take: 100,
    select: {
      id: true,
      kind: true,
      tags: true,
      note: true,
      status: true,
      created_at: true,
      receiver: { select: { id: true, cube_number: true, user: { select: { name: true } } } }
    }
  });

  return rows.map(r => ({
    id: r.id,
    kind: r.kind,
    tags: r.tags,
    note: r.note,
    // DISMISSED means a mentor judged it unfounded after talking to the person.
    dismissed: r.status === PeerFeedbackStatus.DISMISSED,
    created_at: r.created_at,
    receiver: {
      id: r.receiver.id,
      cube_number: r.receiver.cube_number,
      name: r.receiver.user?.name || 'Unknown'
    }
  }));
}

async function ownDeliveredKudos(cubeProfileId: string, feedbackId: string) {
  const item = await prisma.peerFeedback.findFirst({
    where: {
      id: feedbackId,
      receiver_id: cubeProfileId,
      kind: PeerFeedbackKind.KUDOS,
      status: PeerFeedbackStatus.ACTIVE,
      created_at: { lt: digestCutoff() }
    }
  });
  if (!item) throw notFound('Feedback not found.');
  return item;
}

export async function pinFeedback(cubeProfileId: string, feedbackId: string) {
  const item = await ownDeliveredKudos(cubeProfileId, feedbackId);
  if (!item.note) throw badRequest('Only kudos with a written note can be pinned.');
  if (item.is_pinned) return { id: item.id, pinned: true };

  const pinned = await prisma.peerFeedback.count({
    where: { receiver_id: cubeProfileId, is_pinned: true }
  });
  if (pinned >= MAX_PINNED) {
    throw conflict(`You can pin up to ${MAX_PINNED} quotes. Unpin one first.`);
  }

  // A pinned quote is public to the programme, so it must not name anyone.
  const lowered = item.note.toLowerCase();
  if (/#\d{2,}/.test(lowered)) {
    throw badRequest('This note refers to another Cube by number, so it cannot be pinned.');
  }
  const people = await prisma.user.findMany({
    where: { role: 'CUBE', cube_profile: { id: { not: cubeProfileId } } },
    select: { name: true }
  });
  const mentioned = people.some(p => {
    const name = p.name.trim().toLowerCase();
    return name.length >= 4 && lowered.includes(name);
  });
  if (mentioned) {
    throw badRequest('This note names another person, so it cannot be pinned.');
  }

  await prisma.peerFeedback.update({
    where: { id: item.id },
    data: { is_pinned: true, pinned_at: new Date() }
  });
  return { id: item.id, pinned: true };
}

export async function unpinFeedback(cubeProfileId: string, feedbackId: string) {
  const item = await prisma.peerFeedback.findFirst({
    where: { id: feedbackId, receiver_id: cubeProfileId, kind: PeerFeedbackKind.KUDOS }
  });
  if (!item) throw notFound('Feedback not found.');
  await prisma.peerFeedback.update({
    where: { id: item.id },
    data: { is_pinned: false, pinned_at: null }
  });
  return { id: item.id, pinned: false };
}

/** The recipient marks a piece of kudos as useful. Drives a giver-side quest. */
export async function markHelpful(cubeProfileId: string, feedbackId: string) {
  const item = await ownDeliveredKudos(cubeProfileId, feedbackId);
  if (item.helpful_at) return { id: item.id, helpful: true };

  await prisma.peerFeedback.update({ where: { id: item.id }, data: { helpful_at: new Date() } });

  // Re-evaluate the giver's quests. The giver is identified only server-side.
  void (async () => {
    try {
      const index = await getHashIndex();
      const giverCube = index.get(item.giver_hash);
      if (giverCube) await recalculateAllQuestsForCube(giverCube);
    } catch (err) {
      console.error('[peer] helpful recalculation failed:', err);
    }
  })();

  return { id: item.id, helpful: true };
}

export interface PeerSummaryViewer {
  role: 'ADMIN' | 'MENTOR' | 'CUBE';
  cubeProfileId?: string;
}

/**
 * Profile-facing peer data.
 *  - Everyone signed in: titles, pinned quotes, MVCubes awards.
 *  - The Cube themselves additionally: tag distribution, trend, growth
 *    indicator (category only, never text), inbox count.
 */
export async function getPeerSummary(targetCubeId: string, viewer: PeerSummaryViewer) {
  const target = await prisma.cubeProfile.findUnique({
    where: { id: targetCubeId },
    select: { id: true }
  });
  if (!target) throw notFound('Cube not found.');

  const isSelf = viewer.cubeProfileId === targetCubeId;
  if (isSelf) {
    await recomputeCubePeerState(targetCubeId).catch(err =>
      console.error('[peer] recompute on summary failed:', err)
    );
  }

  const [titles, pinned, awards] = await Promise.all([
    prisma.peerTitle.findMany({
      where: { cube_id: targetCubeId },
      orderBy: { earned_at: 'asc' }
    }),
    prisma.peerFeedback.findMany({
      where: {
        receiver_id: targetCubeId,
        is_pinned: true,
        kind: PeerFeedbackKind.KUDOS,
        status: PeerFeedbackStatus.ACTIVE
      },
      orderBy: { pinned_at: 'desc' },
      select: { id: true, tags: true, note: true, created_at: true }
    }),
    prisma.mvcubesAward.findMany({
      where: { cube_id: targetCubeId },
      orderBy: { period: 'desc' },
      take: 12
    })
  ]);

  const summary: any = {
    titles: titles.map(t => ({
      category: t.category,
      label: TITLE_LABELS[t.category] || t.category,
      rarity: t.rarity
    })),
    pinned: pinned.map(p => ({
      id: p.id,
      tags: p.tags,
      note: p.note,
      period: monthLabel(monthKey(p.created_at))
    })),
    awards: awards.map(a => ({
      period: a.period,
      period_label: monthLabel(a.period),
      category: a.category,
      note: a.note
    })),
    self: null
  };

  if (!isSelf) return summary;

  const cutoff = digestCutoff();
  const [delivered, growth] = await Promise.all([
    prisma.peerFeedback.findMany({
      where: {
        receiver_id: targetCubeId,
        kind: PeerFeedbackKind.KUDOS,
        status: PeerFeedbackStatus.ACTIVE,
        created_at: { lt: cutoff }
      },
      select: { giver_hash: true, tags: true, created_at: true }
    }),
    prisma.peerGrowthSignal.findFirst({
      where: {
        cube_id: targetCubeId,
        state: { in: [PeerSignalState.OPEN, PeerSignalState.IN_CONVERSATION] }
      },
      orderBy: { created_at: 'desc' },
      select: { category: true, state: true }
    })
  ]);

  const tagGivers = new Map<string, Set<string>>();
  const allGivers = new Set<string>();
  for (const item of delivered) {
    allGivers.add(item.giver_hash);
    for (const tag of item.tags) {
      if (!tagGivers.has(tag)) tagGivers.set(tag, new Set());
      tagGivers.get(tag)!.add(item.giver_hash);
    }
  }

  // Month over month, on delivered kudos. Needs a real baseline to be shown.
  const nowKey = monthKey(new Date());
  const prevKey = previousMonthKey(nowKey);
  const inMonth = (key: string | null) => {
    const range = key ? monthRange(key) : null;
    if (!range) return 0;
    return delivered.filter(d => d.created_at >= range.start && d.created_at < range.end).length;
  };
  const current = inMonth(nowKey);
  const previous = inMonth(prevKey);
  const trend =
    previous >= 3
      ? { current, previous, change_pct: Math.round(((current - previous) / previous) * 100) }
      : null;

  summary.self = {
    received_count: delivered.length,
    distinct_givers: allGivers.size,
    tags: Object.fromEntries(
      [...tagGivers.entries()].map(([tag, givers]) => [tag, givers.size])
    ),
    trend,
    growth_indicator: growth
      ? {
          category: growth.category,
          state: growth.state,
          message:
            'Your peers and mentors have noticed a growth area. Your mentor will talk it through with you.'
        }
      : null
  };

  return summary;
}
