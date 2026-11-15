/**
 * Types and wording for the Cube signals served by /api/cube/focus (and, later,
 * the mentor's view of their Cubes). The rules live in the backend
 * (services/cubeSignals.service.ts); this file only says them in words.
 */
export type SignalStatus = 'on_track' | 'needs_attention' | 'quiet';

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
  email: string;
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
  /** Latest scorecard or check-in. */
  last_assessed_at?: string | null;
  /** Scoring v2, mentor-side: an active mission has gone 6 weeks without an assessment. */
  checkin_due?: boolean;
}

export const STATUS_COPY: Record<SignalStatus, { label: string; pill: string; dot: string }> = {
  on_track: { label: 'On track', pill: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  needs_attention: { label: 'Needs attention', pill: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  quiet: { label: 'Quiet', pill: 'bg-rose-50 text-rose-700 border-rose-200', dot: 'bg-rose-500' },
};

const DAY_MS = 86_400_000;

/** "today", "yesterday", "3 days ago", "in 2 days", "tomorrow". */
export function relativeDay(value: string | null | undefined, now: Date = new Date()): string {
  if (!value) return 'never';
  const date = new Date(value);
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = Math.round((startOf(date) - startOf(now)) / DAY_MS);
  if (diff === 0) return 'today';
  if (diff === -1) return 'yesterday';
  if (diff === 1) return 'tomorrow';
  return diff < 0 ? `${-diff} days ago` : `in ${diff} days`;
}

export const formatDateTime = (value: string) =>
  new Date(value).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

const STATUS_RANK: Record<SignalStatus, number> = { quiet: 0, needs_attention: 1, on_track: 2 };

/**
 * Mentor order: quiet first, then needs attention, then on track; within a
 * group, the Cube whose last contribution is oldest (or missing) first.
 */
export function sortForMentor<T extends Pick<CubeSignals, 'status' | 'name' | 'activity'>>(cubes: T[]): T[] {
  const lastContribution = (c: T) => (c.activity.last_contribution_at ? new Date(c.activity.last_contribution_at).getTime() : 0);
  return [...cubes].sort(
    (a, b) =>
      STATUS_RANK[a.status] - STATUS_RANK[b.status] ||
      lastContribution(a) - lastContribution(b) ||
      a.name.localeCompare(b.name)
  );
}

/** One line per signal, written for the mentor ("Ayşe is ..."). */
export function describeForMentor(item: SignalItem, now: Date = new Date()): string {
  switch (item.kind) {
    case 'quiet_no_visits':
      return item.days === null ? 'Has not signed in yet' : `Not seen on the portal for ${item.days} days`;
    case 'quiet_no_contribution':
      return item.days === null ? 'No visible contribution yet' : `No visible contribution for ${item.days} days`;
    case 'update_overdue':
      return item.days === null
        ? `No update since joining ${item.mission_title}`
        : `No update on ${item.mission_title} for ${item.days} days`;
    case 'open_blocker':
      return `Blocked on ${item.mission_title} (reported ${relativeDay(item.reported_at, now)})`;
    case 'no_mission':
      return 'Not on a mission';
    case 'nda_pending':
      return 'NDA not signed yet';
    case 'document_rejected':
      return item.count === 1 ? '1 rejected document to re-upload' : `${item.count} rejected documents to re-upload`;
    case 'webinar_question_due':
      return `Webinar question not sent: ${item.title}`;
  }
}
