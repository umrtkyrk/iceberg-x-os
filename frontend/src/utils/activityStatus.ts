export type ActivityStatus = 'active' | 'slowing' | 'inactive' | 'never';

export interface ActivityUser {
  last_seen_at?: string | null;
  last_login_at?: string | null;
}

export interface ActivityState {
  status: ActivityStatus;
  /** Most recent sign of life: the later of last seen and last login. */
  lastSeenAt: Date | null;
  /** Whole days since lastSeenAt, or null if never seen. */
  daysAgo: number | null;
  /**
   * True when the status is a pessimistic guess because tracking is brand new:
   * someone not yet seen since tracking started may just not have opened the
   * portal yet. The page marks these instead of calling them inactive.
   */
  provisional: boolean;
}

/** Seen within this many days counts as active. */
export const ACTIVE_WITHIN_DAYS = 7;
/** Seen within this many days (but not active) is slowing down; older is inactive. */
export const SLOWING_WITHIN_DAYS = 21;
/** Tracking younger than this has not had time to see everyone. */
export const TRACKING_WARMUP_DAYS = 7;

const DAY_MS = 86_400_000;

function toDate(value?: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function activityState(
  user: ActivityUser,
  now: Date = new Date(),
  trackingStartedAt?: string | null
): ActivityState {
  const seen = toDate(user.last_seen_at);
  const login = toDate(user.last_login_at);
  const lastSeenAt = seen && login ? (seen > login ? seen : login) : seen || login;

  const started = toDate(trackingStartedAt);
  const warmingUp = !started || now.getTime() - started.getTime() < TRACKING_WARMUP_DAYS * DAY_MS;

  if (!lastSeenAt) {
    return { status: 'never', lastSeenAt: null, daysAgo: null, provisional: warmingUp };
  }

  const daysAgo = Math.max(0, Math.floor((now.getTime() - lastSeenAt.getTime()) / DAY_MS));
  const status: ActivityStatus =
    daysAgo <= ACTIVE_WITHIN_DAYS ? 'active' : daysAgo <= SLOWING_WITHIN_DAYS ? 'slowing' : 'inactive';

  return { status, lastSeenAt, daysAgo, provisional: status !== 'active' && warmingUp };
}

export function formatDaysAgo(daysAgo: number | null): string {
  if (daysAgo === null) return 'Never';
  if (daysAgo === 0) return 'Today';
  if (daysAgo === 1) return 'Yesterday';
  return `${daysAgo} days ago`;
}

export const STATUS_LABELS: Record<ActivityStatus, string> = {
  active: 'Active',
  slowing: 'Slowing',
  inactive: 'Inactive',
  never: 'Never signed in'
};

export type ActivitySortKey = 'last_seen' | 'active_days' | 'name';

export interface ActivityRow {
  name: string;
  state: ActivityState;
  activeDays: number;
}

/** Sorts rows without mutating the input. Least recently seen comes first. */
export function sortActivityRows<T extends ActivityRow>(rows: T[], key: ActivitySortKey): T[] {
  const copy = [...rows];
  if (key === 'name') return copy.sort((a, b) => a.name.localeCompare(b.name));
  if (key === 'active_days') {
    return copy.sort((a, b) => a.activeDays - b.activeDays || a.name.localeCompare(b.name));
  }
  // Never seen sorts before everyone; then oldest last-seen first.
  return copy.sort((a, b) => {
    const at = a.state.lastSeenAt ? a.state.lastSeenAt.getTime() : -Infinity;
    const bt = b.state.lastSeenAt ? b.state.lastSeenAt.getTime() : -Infinity;
    return at === bt ? a.name.localeCompare(b.name) : at - bt;
  });
}

export function countByStatus(states: ActivityState[]): Record<ActivityStatus, number> {
  const counts: Record<ActivityStatus, number> = { active: 0, slowing: 0, inactive: 0, never: 0 };
  states.forEach((s) => { counts[s.status] += 1; });
  return counts;
}
