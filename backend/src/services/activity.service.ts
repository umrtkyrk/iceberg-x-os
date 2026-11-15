/**
 * Portal usage tracking: which pages people open and for how long they are
 * actually at the keyboard. Stored as one rollup row per person per day
 * (`UserActivityDay`) plus `User.last_seen_at`, never as an event log, and only
 * as a normalized route (`/missions/:id`), so no ids, queries or content are kept.
 */
import prisma from './prisma';

export type ActivityKind = 'view' | 'heartbeat';

/** A heartbeat counts as one active minute, so ignore any that arrive faster. */
const MIN_HEARTBEAT_GAP_MS = 50_000;
/** Page views arrive on navigation; this only drops accidental double fires. */
const MIN_VIEW_GAP_MS = 1_500;
const MAX_PATH_LENGTH = 120;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// userId -> last accepted timestamp, per kind. One entry per user, so it stays small.
const lastAccepted: Record<ActivityKind, Map<string, number>> = {
  view: new Map(),
  heartbeat: new Map()
};

/**
 * Reduces a browser path to its route shape. Returns null for anything that
 * is not a plain in-app path. Ids and cube numbers become `:id`.
 */
export function normalizeActivityPath(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const raw = input.split('?')[0].split('#')[0].trim();
  if (!raw.startsWith('/') || raw.startsWith('//')) return null;

  const segments = raw
    .split('/')
    .filter(Boolean)
    .map((segment) => {
      if (UUID.test(segment)) return ':id';
      if (/^\d+$/.test(segment)) return ':id';
      if (/^[0-9a-f]{16,}$/i.test(segment)) return ':id';
      // Anything long or oddly shaped is more likely a token or a slug with content.
      if (segment.length > 40 || !/^[A-Za-z0-9_-]+$/.test(segment)) return ':x';
      return segment.toLowerCase();
    });

  const path = '/' + segments.join('/');
  return path.length > MAX_PATH_LENGTH ? path.slice(0, MAX_PATH_LENGTH) : path;
}

/** Calendar day in Europe/Istanbul, as a Date at 00:00 UTC for a DATE column. */
export function istanbulDay(now: Date = new Date()): Date {
  const iso = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(now);
  return new Date(`${iso}T00:00:00.000Z`);
}

/**
 * Records one activity signal. Returns false when the signal was dropped
 * (bad path or too soon after the previous one); that is not an error.
 */
export async function recordActivity(
  userId: string,
  kind: ActivityKind,
  rawPath: unknown,
  now: Date = new Date()
): Promise<boolean> {
  const path = normalizeActivityPath(rawPath);
  if (!path) return false;

  const gap = kind === 'heartbeat' ? MIN_HEARTBEAT_GAP_MS : MIN_VIEW_GAP_MS;
  const previous = lastAccepted[kind].get(userId);
  if (previous !== undefined && now.getTime() - previous < gap) return false;
  lastAccepted[kind].set(userId, now.getTime());

  const day = istanbulDay(now);
  const views = kind === 'view' ? 1 : 0;
  const minutes = kind === 'heartbeat' ? 1 : 0;

  await prisma.userActivityDay.upsert({
    where: { user_id_day: { user_id: userId, day } },
    create: {
      user_id: userId,
      day,
      page_views: views,
      active_minutes: minutes,
      last_path: path,
      first_seen_at: now,
      last_seen_at: now
    },
    update: {
      page_views: { increment: views },
      active_minutes: { increment: minutes },
      last_path: path,
      last_seen_at: now
    }
  });

  await prisma.user.update({
    where: { id: userId },
    data: { last_seen_at: now }
  });

  return true;
}

export const ACTIVITY_WINDOW_DAYS = 30;

export interface ActivitySummary {
  active_days: number;
  page_views: number;
  active_minutes: number;
}

/**
 * Per-person usage over the last ACTIVITY_WINDOW_DAYS days (today included).
 * A day row only exists when the person was seen that day, so the row count is
 * the number of active days. People with no rows are simply absent from the map.
 */
export async function listActivitySummaries(now: Date = new Date()): Promise<Map<string, ActivitySummary>> {
  const today = istanbulDay(now);
  const since = new Date(today.getTime() - (ACTIVITY_WINDOW_DAYS - 1) * 86_400_000);

  const rows = await prisma.userActivityDay.groupBy({
    by: ['user_id'],
    where: { day: { gte: since } },
    _count: { _all: true },
    _sum: { page_views: true, active_minutes: true }
  });

  return new Map(
    rows.map((row) => [
      row.user_id,
      {
        active_days: row._count._all,
        page_views: row._sum.page_views ?? 0,
        active_minutes: row._sum.active_minutes ?? 0
      }
    ])
  );
}

/** When tracking first recorded anything, or null if it has not recorded yet. */
export async function getTrackingStartedAt(): Promise<Date | null> {
  const result = await prisma.userActivityDay.aggregate({ _min: { first_seen_at: true } });
  return result._min.first_seen_at ?? null;
}
