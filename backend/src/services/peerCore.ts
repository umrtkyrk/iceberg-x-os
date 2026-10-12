/**
 * Dependency-free peer helpers: giver pseudonyms and delivery timing.
 *
 * Kept separate from the services that talk to quests and notifications so
 * every peer module can import it without creating a cycle.
 */
import crypto from 'crypto';
import { JWT_SECRET } from '../config/env';

let warnedFallback = false;

function pseudonymKey(): string {
  const dedicated = process.env.PEER_PSEUDONYM_SECRET?.trim();
  if (dedicated) return dedicated;

  if (!warnedFallback) {
    warnedFallback = true;
    console.warn(
      '[peer] PEER_PSEUDONYM_SECRET is not set; deriving the pseudonym key from JWT_SECRET. ' +
      'Set a dedicated secret so rotating JWT_SECRET does not invalidate peer hashes.'
    );
  }
  return crypto.createHmac('sha256', JWT_SECRET).update('peer-pseudonym-v1').digest('hex');
}

/**
 * Keyed hash of a giver's user id. It is deliberately not reversible through
 * the schema and is never returned by any endpoint; it exists only for rate
 * limits, normalisation and abuse detection.
 */
export function giverHash(userId: string): string {
  return crypto.createHmac('sha256', pseudonymKey()).update(`peer:v1:${userId}`).digest('hex');
}

/**
 * Start of the current ISO week (Monday 00:00 UTC). Anything written before
 * this moment counts as "delivered": recipients, titles and quest progress only
 * see feedback in weekly steps, so timing cannot reveal who wrote it.
 */
export function digestCutoff(now: Date = new Date()): Date {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = d.getUTCDay(); // 0 = Sunday
  const sinceMonday = day === 0 ? 6 : day - 1;
  d.setUTCDate(d.getUTCDate() - sinceMonday);
  return d;
}

export function daysAgo(days: number, now: Date = new Date()): Date {
  return new Date(now.getTime() - days * 86400000);
}

export function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Inclusive start, exclusive end of a "YYYY-MM" period, or null if invalid. */
export function monthRange(period: string): { start: Date; end: Date } | null {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(period);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  return {
    start: new Date(Date.UTC(year, month, 1)),
    end: new Date(Date.UTC(year, month + 1, 1))
  };
}

export function previousMonthKey(period: string): string | null {
  const range = monthRange(period);
  if (!range) return null;
  return monthKey(new Date(range.start.getTime() - 86400000));
}

export function monthLabel(period: string): string {
  const range = monthRange(period);
  if (!range) return period;
  return range.start.toLocaleString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}
