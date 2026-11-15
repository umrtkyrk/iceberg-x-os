/**
 * Cube signals: "what am I working on, what should I do next, how do I look to
 * my mentor". One set of rules feeds both the Cube's own focus panel and the
 * mentor's view of their Cubes, so the two can never disagree.
 *
 * Privacy: mentor feedback is only ever read for its date (and, for the Cube's
 * own view, only feedback marked visible to the Cube). `private_notes` is never
 * selected here.
 */
import { CubeLevel } from '@prisma/client';
import prisma from './prisma';
import { IN_PROGRAMME_CUBE_LEVELS } from '../config/constants';

/** An active mission with no update for this many days asks for one. */
export const UPDATE_STALE_DAYS = 5;
/** No visit, or no visible contribution, for this many days marks a Cube quiet. */
export const QUIET_DAYS = 7;
/** A webinar question is flagged this many days before the question deadline. */
export const WEBINAR_DUE_DAYS = 3;
/** A blocker in the latest update stops counting as open after this many days. */
export const BLOCKER_OPEN_DAYS = 14;

const DAY_MS = 86_400_000;
const CLOSED_MISSION_STATUSES = ['completed', 'reviewed', 'promoted_to_product_backlog', 'archived', 'cancelled'];

export type SignalStatus = 'on_track' | 'needs_attention' | 'quiet';
export type SignalAudience = 'cube' | 'staff';

/** Something the Cube should act on. The frontend owns the wording and links. */
export type SignalItem =
  | { kind: 'quiet_no_visits'; severity: 'quiet'; last_active_at: string | null; days: number | null }
  | { kind: 'quiet_no_contribution'; severity: 'quiet'; last_contribution_at: string | null; days: number | null }
  | { kind: 'update_overdue'; severity: 'attention'; mission_id: string; mission_title: string; last_update_at: string | null; days: number | null }
  | { kind: 'open_blocker'; severity: 'attention'; mission_id: string; mission_title: string; blockers: string; reported_at: string }
  | { kind: 'no_mission'; severity: 'attention' }
  | { kind: 'nda_pending'; severity: 'attention' }
  | { kind: 'document_rejected'; severity: 'attention'; count: number }
  | { kind: 'webinar_question_due'; severity: 'attention'; webinar_id: string; title: string; closes_at: string; starts_at: string };

export interface CubeSignals {
  cube_profile_id: string;
  user_id: string;
  name: string;
  cube_number: string;
  avatar_url: string | null;
  status: SignalStatus;
  items: SignalItem[];
  mentor: { id: string; name: string; email: string } | null;
  missions: { id: string; title: string; status: string; role: string; joined_at: string }[];
  activity: {
    active_days_7: number;
    active_days_30: number;
    last_active_at: string | null;
    last_contribution_at: string | null;
  };
  last_update: { at: string; mission_id: string; mission_title: string; type: string } | null;
  next_meeting: { id: string; title: string; date: string } | null;
  next_webinar: { id: string; title: string; date: string; questions_close_at: string; has_question: boolean } | null;
  last_feedback_at: string | null;
}

// ---------------------------------------------------------------------------
// Pure rules (unit-tested without a database)
// ---------------------------------------------------------------------------

export interface SignalInput {
  now: Date;
  account_created_at: Date;
  nda_status: string;
  missions: { id: string; title: string; joined_at: Date }[];
  last_active_at: Date | null;
  last_contribution_at: Date | null;
  last_update: { at: Date; mission_id: string; blockers: string | null } | null;
  /** Latest update per active mission. */
  last_update_by_mission: Map<string, Date>;
  rejected_documents: number;
  webinar_due: { id: string; title: string; closes_at: Date; starts_at: Date } | null;
}

const daysBetween = (from: Date, to: Date) => Math.floor((to.getTime() - from.getTime()) / DAY_MS);
const iso = (d: Date | null) => (d ? d.toISOString() : null);

export function deriveSignalItems(input: SignalInput): SignalItem[] {
  const { now } = input;
  const items: SignalItem[] = [];
  // A brand-new account has had no chance to be active yet.
  const settledIn = daysBetween(input.account_created_at, now) >= QUIET_DAYS;

  if (settledIn) {
    const sinceActive = input.last_active_at ? daysBetween(input.last_active_at, now) : null;
    if (sinceActive === null || sinceActive >= QUIET_DAYS) {
      items.push({ kind: 'quiet_no_visits', severity: 'quiet', last_active_at: iso(input.last_active_at), days: sinceActive });
    }
    const sinceContribution = input.last_contribution_at ? daysBetween(input.last_contribution_at, now) : null;
    if (sinceContribution === null || sinceContribution >= QUIET_DAYS) {
      items.push({
        kind: 'quiet_no_contribution',
        severity: 'quiet',
        last_contribution_at: iso(input.last_contribution_at),
        days: sinceContribution,
      });
    }
  }

  if (input.missions.length === 0) {
    items.push({ kind: 'no_mission', severity: 'attention' });
  }

  for (const mission of input.missions) {
    const lastUpdate = input.last_update_by_mission.get(mission.id) || null;
    // Measured from the later of the last update and joining the mission.
    const reference = lastUpdate && lastUpdate > mission.joined_at ? lastUpdate : mission.joined_at;
    if (daysBetween(reference, now) >= UPDATE_STALE_DAYS) {
      items.push({
        kind: 'update_overdue',
        severity: 'attention',
        mission_id: mission.id,
        mission_title: mission.title,
        last_update_at: iso(lastUpdate),
        days: lastUpdate ? daysBetween(lastUpdate, now) : null,
      });
    }
  }

  const blockers = input.last_update?.blockers?.trim();
  if (input.last_update && blockers && daysBetween(input.last_update.at, now) < BLOCKER_OPEN_DAYS) {
    const mission = input.missions.find(m => m.id === input.last_update!.mission_id);
    if (mission) {
      items.push({
        kind: 'open_blocker',
        severity: 'attention',
        mission_id: mission.id,
        mission_title: mission.title,
        blockers,
        reported_at: input.last_update.at.toISOString(),
      });
    }
  }

  if (input.nda_status === 'pending') items.push({ kind: 'nda_pending', severity: 'attention' });
  if (input.rejected_documents > 0) {
    items.push({ kind: 'document_rejected', severity: 'attention', count: input.rejected_documents });
  }
  if (input.webinar_due) {
    items.push({
      kind: 'webinar_question_due',
      severity: 'attention',
      webinar_id: input.webinar_due.id,
      title: input.webinar_due.title,
      closes_at: input.webinar_due.closes_at.toISOString(),
      starts_at: input.webinar_due.starts_at.toISOString(),
    });
  }

  return items;
}

export function deriveStatus(items: SignalItem[]): SignalStatus {
  if (items.some(i => i.severity === 'quiet')) return 'quiet';
  if (items.some(i => i.severity === 'attention')) return 'needs_attention';
  return 'on_track';
}

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

const maxDate = (...dates: (Date | null | undefined)[]) =>
  dates.reduce<Date | null>((best, d) => (d && (!best || d > best) ? d : best), null);

/**
 * Signals for the given Cube profiles, batched (a fixed number of queries
 * however many Cubes). `audience: 'cube'` limits feedback to what the Cube can
 * already see.
 */
export async function loadCubeSignals(
  cubeProfileIds: string[],
  { audience, now = new Date() }: { audience: SignalAudience; now?: Date }
): Promise<CubeSignals[]> {
  if (cubeProfileIds.length === 0) return [];

  const profiles = await prisma.cubeProfile.findMany({
    where: { id: { in: cubeProfileIds } },
    select: {
      id: true,
      user_id: true,
      cube_number: true,
      avatar_url: true,
      current_level: true,
      nda_status: true,
      created_at: true,
      user: { select: { name: true, created_at: true, last_seen_at: true, last_login_at: true } },
      assigned_mentor: { select: { id: true, name: true, email: true } },
    },
    orderBy: { cube_number: 'asc' },
  });
  const userIds = profiles.map(p => p.user_id);
  const profileIds = profiles.map(p => p.id);
  const since30 = new Date(now.getTime() - 30 * DAY_MS);
  const since7 = new Date(now.getTime() - 7 * DAY_MS);

  const [
    memberships,
    activityDays,
    lastUpdates,
    lastTopics,
    lastReplies,
    lastQuestions,
    lastAttendance,
    documents,
    feedback,
    meetings,
    webinars,
  ] = await Promise.all([
    prisma.missionTeamMember.findMany({
      where: { cube_id: { in: profileIds }, team: { mission: { status: { notIn: CLOSED_MISSION_STATUSES as any } } } },
      select: {
        cube_id: true,
        role: true,
        created_at: true,
        team: { select: { mission: { select: { id: true, title: true, status: true } } } },
      },
      orderBy: { created_at: 'asc' },
    }),
    prisma.userActivityDay.findMany({
      where: { user_id: { in: userIds }, day: { gte: since30 } },
      select: { user_id: true, day: true },
    }),
    prisma.update.findMany({
      where: { cube_id: { in: userIds } },
      select: { cube_id: true, mission_id: true, type: true, blockers: true, created_at: true, mission: { select: { title: true } } },
      orderBy: { created_at: 'desc' },
      distinct: ['cube_id', 'mission_id'],
    }),
    prisma.forumTopic.groupBy({
      by: ['author_id'],
      where: { author_id: { in: userIds }, deleted_at: null },
      _max: { created_at: true },
    }),
    prisma.forumReply.groupBy({
      by: ['author_id'],
      where: { author_id: { in: userIds }, deleted_at: null },
      _max: { created_at: true },
    }),
    prisma.webinarQuestion.groupBy({
      by: ['cube_id'],
      where: { cube_id: { in: profileIds } },
      _max: { created_at: true },
    }),
    prisma.meetingAttendance.findMany({
      where: { cube_id: { in: profileIds }, attended: true, meeting: { date: { lte: now } } },
      select: { cube_id: true, meeting: { select: { date: true } } },
      orderBy: { meeting: { date: 'desc' } },
      distinct: ['cube_id'],
    }),
    prisma.cubeDocument.findMany({
      where: { cube_id: { in: profileIds } },
      select: { cube_id: true, type: true, status: true, created_at: true },
      orderBy: { created_at: 'desc' },
    }),
    prisma.mentorFeedback.groupBy({
      by: ['cube_id'],
      where: { cube_id: { in: userIds }, ...(audience === 'cube' ? { visible_to_cube: true } : {}) },
      _max: { created_at: true },
    }),
    prisma.meeting.findMany({
      where: { date: { gte: now }, is_completed: false },
      select: { id: true, title: true, date: true, invited_cube_ids: true },
      orderBy: { date: 'asc' },
      take: 50,
    }),
    prisma.webinar.findMany({
      where: { status: 'Published', date: { gte: now } },
      select: { id: true, title: true, date: true, questions_close_at: true, invited_cube_ids: true },
      orderBy: { date: 'asc' },
      take: 20,
    }),
  ]);

  const webinarIds = webinars.map(w => w.id);
  const askedRows = webinarIds.length
    ? await prisma.webinarQuestion.findMany({
        where: { webinar_id: { in: webinarIds }, cube_id: { in: profileIds } },
        select: { webinar_id: true, cube_id: true },
        distinct: ['webinar_id', 'cube_id'],
      })
    : [];
  const asked = new Set(askedRows.map(r => `${r.webinar_id}:${r.cube_id}`));

  const byKey = <T, K>(rows: T[], key: (row: T) => K) => {
    const map = new Map<K, T[]>();
    for (const row of rows) {
      const k = key(row);
      const list = map.get(k);
      if (list) list.push(row);
      else map.set(k, [row]);
    }
    return map;
  };
  const membershipsByCube = byKey(memberships, m => m.cube_id);
  const daysByUser = byKey(activityDays, d => d.user_id);
  const updatesByUser = byKey(lastUpdates, u => u.cube_id);
  const docsByCube = byKey(documents, d => d.cube_id);
  const topicAt = new Map(lastTopics.map(r => [r.author_id, r._max.created_at]));
  const replyAt = new Map(lastReplies.map(r => [r.author_id, r._max.created_at]));
  const questionAt = new Map(lastQuestions.map(r => [r.cube_id, r._max.created_at]));
  const attendedAt = new Map(lastAttendance.map(r => [r.cube_id, r.meeting.date]));
  const feedbackAt = new Map(feedback.map(r => [r.cube_id, r._max.created_at]));

  return profiles.map(profile => {
    const invitedTo = (list: string[]) => list.length === 0 || list.includes(profile.id);
    const inProgramme = IN_PROGRAMME_CUBE_LEVELS.includes(profile.current_level as CubeLevel);

    // Active missions, one entry per mission.
    const missionMap = new Map<string, CubeSignals['missions'][number] & { joined: Date }>();
    for (const m of membershipsByCube.get(profile.id) || []) {
      const mission = m.team?.mission;
      if (!mission || missionMap.has(mission.id)) continue;
      missionMap.set(mission.id, {
        id: mission.id,
        title: mission.title,
        status: mission.status,
        role: m.role,
        joined_at: m.created_at.toISOString(),
        joined: m.created_at,
      });
    }
    const missions = [...missionMap.values()];

    const days = daysByUser.get(profile.user_id) || [];
    const latestDay = maxDate(...days.map(d => d.day));
    // A day row is a calendar day; count it as active at the end of that day.
    const latestDayEnd = latestDay ? new Date(latestDay.getTime() + DAY_MS - 1) : null;
    const lastActive = maxDate(latestDayEnd && latestDayEnd > now ? now : latestDayEnd, profile.user.last_seen_at, profile.user.last_login_at);

    const updates = updatesByUser.get(profile.user_id) || [];
    const lastUpdate = updates[0] || null;
    const lastUpdateByMission = new Map(updates.map(u => [u.mission_id, u.created_at]));
    const lastContribution = maxDate(
      lastUpdate?.created_at,
      topicAt.get(profile.user_id),
      replyAt.get(profile.user_id),
      questionAt.get(profile.id),
      attendedAt.get(profile.id)
    );

    // A rejected document counts until a newer one of the same type replaces it.
    const latestDocByType = new Map<string, string>();
    for (const doc of docsByCube.get(profile.id) || []) {
      if (!latestDocByType.has(doc.type)) latestDocByType.set(doc.type, doc.status);
    }
    const rejectedDocuments = [...latestDocByType.values()].filter(s => s === 'REJECTED').length;

    const myWebinars = inProgramme ? webinars.filter(w => invitedTo(w.invited_cube_ids)) : [];
    const nextWebinar = myWebinars[0] || null;
    const dueWebinar =
      myWebinars.find(
        w =>
          !asked.has(`${w.id}:${profile.id}`) &&
          w.questions_close_at.getTime() - now.getTime() <= WEBINAR_DUE_DAYS * DAY_MS
      ) || null;
    const nextMeeting = meetings.find(m => invitedTo(m.invited_cube_ids)) || null;

    const items = deriveSignalItems({
      now,
      account_created_at: profile.user.created_at,
      nda_status: profile.nda_status,
      missions: missions.map(m => ({ id: m.id, title: m.title, joined_at: m.joined })),
      last_active_at: lastActive,
      last_contribution_at: lastContribution,
      last_update: lastUpdate
        ? { at: lastUpdate.created_at, mission_id: lastUpdate.mission_id, blockers: lastUpdate.blockers }
        : null,
      last_update_by_mission: lastUpdateByMission,
      rejected_documents: rejectedDocuments,
      webinar_due: dueWebinar
        ? { id: dueWebinar.id, title: dueWebinar.title, closes_at: dueWebinar.questions_close_at, starts_at: dueWebinar.date }
        : null,
    });

    return {
      cube_profile_id: profile.id,
      user_id: profile.user_id,
      name: profile.user.name,
      cube_number: profile.cube_number,
      avatar_url: profile.avatar_url,
      status: deriveStatus(items),
      items,
      mentor: profile.assigned_mentor,
      missions: missions.map(({ joined, ...m }) => m),
      activity: {
        active_days_7: days.filter(d => d.day >= since7).length,
        active_days_30: days.length,
        last_active_at: iso(lastActive),
        last_contribution_at: iso(lastContribution),
      },
      last_update: lastUpdate
        ? {
            at: lastUpdate.created_at.toISOString(),
            mission_id: lastUpdate.mission_id,
            mission_title: lastUpdate.mission.title,
            type: lastUpdate.type,
          }
        : null,
      next_meeting: nextMeeting ? { id: nextMeeting.id, title: nextMeeting.title, date: nextMeeting.date.toISOString() } : null,
      next_webinar: nextWebinar
        ? {
            id: nextWebinar.id,
            title: nextWebinar.title,
            date: nextWebinar.date.toISOString(),
            questions_close_at: nextWebinar.questions_close_at.toISOString(),
            has_question: asked.has(`${nextWebinar.id}:${profile.id}`),
          }
        : null,
      last_feedback_at: iso(feedbackAt.get(profile.user_id) || null),
    };
  });
}
