/**
 * What mentors and admins can read about peer feedback.
 *
 * Staff can read WHAT was written about a Cube: the kind, tags, note, which
 * mission it was about and when. They can never see WHO wrote it. No field
 * returned here identifies the giver, and giver_hash is never selected. The
 * Composer tells Cubes exactly this, so keep the two in step.
 */
import prisma from './prisma';
import {
  PeerContextType,
  PeerFeedbackKind,
  PeerFeedbackStatus
} from '@prisma/client';
import {
  CONCERN_TAGS,
  CORROBORATION_GIVERS,
  KUDOS_TAGS,
  MIN_CONCERN_SCORE_WEIGHT,
  OBSERVATION_TAGS,
  WEIGHT_SHARED_MEETING,
  WEIGHT_SHARED_WORK
} from '../config/peer';

const TAG_LABELS = new Map<string, string>(
  [...KUDOS_TAGS, ...OBSERVATION_TAGS, ...CONCERN_TAGS].map(t => [t.key, t.label])
);

export type FeedbackStrength = 'shared_work' | 'shared_meeting' | 'none';

export interface StaffFeedbackItem {
  id: string;
  kind: PeerFeedbackKind;
  tags: { key: string; label: string }[];
  note: string | null;
  context: { type: PeerContextType; label: string | null };
  /** How close the writer was to the person, from the weight frozen at write time. */
  strength: FeedbackStrength;
  /** A mentor judged this concern unfounded after talking to the person. */
  dismissed: boolean;
  /** Does it currently move the person's score? Concerns need corroboration. */
  counts_toward_score: boolean;
  created_at: Date;
  receiver?: { id: string; name: string; cube_number: string; avatar_url: string | null };
}

const strengthOf = (weight: number): FeedbackStrength =>
  weight >= WEIGHT_SHARED_WORK ? 'shared_work' : weight >= WEIGHT_SHARED_MEETING ? 'shared_meeting' : 'none';

async function contextLabels(
  rows: { context_type: PeerContextType; context_id: string | null }[]
): Promise<Map<string, string>> {
  const missions = [...new Set(rows.filter(r => r.context_type === 'MISSION' && r.context_id).map(r => r.context_id!))];
  const teams = [...new Set(rows.filter(r => r.context_type === 'TEAM' && r.context_id).map(r => r.context_id!))];
  const meetings = [...new Set(rows.filter(r => r.context_type === 'MEETING' && r.context_id).map(r => r.context_id!))];

  const [m, t, mt] = await Promise.all([
    missions.length ? prisma.mission.findMany({ where: { id: { in: missions } }, select: { id: true, title: true } }) : [],
    teams.length ? prisma.missionTeam.findMany({ where: { id: { in: teams } }, select: { id: true, name: true } }) : [],
    meetings.length ? prisma.meeting.findMany({ where: { id: { in: meetings } }, select: { id: true, title: true } }) : []
  ]);

  const map = new Map<string, string>();
  m.forEach(x => map.set(`MISSION:${x.id}`, x.title));
  t.forEach(x => map.set(`TEAM:${x.id}`, x.name));
  mt.forEach(x => map.set(`MEETING:${x.id}`, x.title));
  return map;
}

const select = {
  id: true,
  kind: true,
  tags: true,
  note: true,
  weight: true,
  status: true,
  context_type: true,
  context_id: true,
  created_at: true,
  // Deliberately NOT selected: giver_hash, helpful_at, is_pinned, was_quiet.
  receiver: {
    select: {
      id: true,
      cube_number: true,
      avatar_url: true,
      user: { select: { name: true, avatar_url: true } },
      peer_signal: { select: { concern_score: true } }
    }
  }
} as const;

function shape(row: any, labels: Map<string, string>, withReceiver: boolean): StaffFeedbackItem {
  const corroborated = (row.receiver?.peer_signal?.concern_score ?? 0) > 0;
  const isConcern = row.kind === PeerFeedbackKind.CONCERN;
  const active = row.status === PeerFeedbackStatus.ACTIVE;

  let counts = active;
  if (isConcern) counts = active && row.weight >= MIN_CONCERN_SCORE_WEIGHT && corroborated;
  if (row.kind === PeerFeedbackKind.OBSERVATION) counts = false; // signal only, never score

  return {
    id: row.id,
    kind: row.kind,
    tags: row.tags.map((key: string) => ({ key, label: TAG_LABELS.get(key) || key })),
    note: row.note,
    context: {
      type: row.context_type,
      label: row.context_id ? labels.get(`${row.context_type}:${row.context_id}`) ?? null : null
    },
    strength: strengthOf(row.weight),
    dismissed: row.status === PeerFeedbackStatus.DISMISSED,
    counts_toward_score: counts,
    created_at: row.created_at,
    ...(withReceiver
      ? {
          receiver: {
            id: row.receiver.id,
            name: row.receiver.user?.name || 'Unknown',
            cube_number: row.receiver.cube_number,
            avatar_url: row.receiver.avatar_url || row.receiver.user?.avatar_url || null
          }
        }
      : {})
  };
}

/** Everything written about one Cube, newest first, with a short summary. */
export async function listFeedbackForCube(cubeProfileId: string) {
  const rows = await prisma.peerFeedback.findMany({
    where: { receiver_id: cubeProfileId },
    orderBy: { created_at: 'desc' },
    take: 200,
    select
  });
  const labels = await contextLabels(rows);
  const items = rows.map(r => shape(r, labels, false));

  const active = rows.filter(r => r.status === PeerFeedbackStatus.ACTIVE);
  const concernGivers = items.filter(i => i.kind === 'CONCERN' && !i.dismissed && i.strength !== 'none').length;

  return {
    summary: {
      kudos: active.filter(r => r.kind === 'KUDOS').length,
      observations: active.filter(r => r.kind === 'OBSERVATION').length,
      concerns: active.filter(r => r.kind === 'CONCERN').length,
      /** Concerns that currently count (strong context). A score effect needs corroboration. */
      concerns_with_strong_context: concernGivers,
      concerns_needed_to_count: CORROBORATION_GIVERS
    },
    items
  };
}

/** A staff-wide feed, newest first, optionally filtered. Cursor is a created_at ISO string. */
export async function listFeedbackFeed(params: {
  kind?: string;
  cubeProfileId?: string;
  before?: string;
  take?: number;
}) {
  const take = Math.min(Math.max(params.take || 25, 1), 50);
  const kind = (['KUDOS', 'OBSERVATION', 'CONCERN'] as const).find(k => k === params.kind);
  const before = params.before && !Number.isNaN(Date.parse(params.before)) ? new Date(params.before) : undefined;

  const rows = await prisma.peerFeedback.findMany({
    where: {
      ...(kind ? { kind } : {}),
      ...(params.cubeProfileId ? { receiver_id: params.cubeProfileId } : {}),
      ...(before ? { created_at: { lt: before } } : {})
    },
    orderBy: { created_at: 'desc' },
    take: take + 1,
    select
  });

  const page = rows.slice(0, take);
  const labels = await contextLabels(page);

  return {
    items: page.map(r => shape(r, labels, true)),
    next: rows.length > take ? page[page.length - 1].created_at.toISOString() : null
  };
}
