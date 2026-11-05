/**
 * Pure webinar rules, kept free of Prisma so they can be unit tested.
 */
import { badRequest } from '../utils/http';

export const QUESTION_MIN_LENGTH = 30;
export const QUESTION_MAX_LENGTH = 1000;
/** Upper bound per Cube per webinar, so the list stays readable for the speaker. */
export const MAX_QUESTIONS_PER_CUBE = 5;
/** Default gap between the question deadline and the start of the webinar. */
export const DEFAULT_QUESTION_LEAD_HOURS = 24;

export type QuestionWindow = 'not_open' | 'open' | 'late' | 'closed';

/**
 * Where a webinar is in its question lifecycle at `now`.
 *  - open:   before the deadline; questions can be sent, edited and deleted
 *  - late:   after the deadline but before the start; new questions are marked late
 *  - closed: the webinar has started or is no longer published
 */
export function questionWindow(
  webinar: { status: string; date: Date | string; questions_close_at: Date | string },
  now: Date = new Date()
): QuestionWindow {
  if (webinar.status === 'Draft') return 'not_open';
  if (webinar.status !== 'Published') return 'closed';
  const start = new Date(webinar.date).getTime();
  const deadline = new Date(webinar.questions_close_at).getTime();
  const t = now.getTime();
  if (t >= start) return 'closed';
  if (t >= deadline) return 'late';
  return 'open';
}

/** Trims and validates a question body. Throws a 400 with a readable message. */
export function parseQuestionBody(value: any): string {
  const body = typeof value === 'string' ? value.trim() : '';
  if (body.length < QUESTION_MIN_LENGTH) {
    throw badRequest(
      `A question needs at least ${QUESTION_MIN_LENGTH} characters. Give the speaker some context.`
    );
  }
  if (body.length > QUESTION_MAX_LENGTH) {
    throw badRequest(`A question can be at most ${QUESTION_MAX_LENGTH} characters.`);
  }
  return body;
}

/**
 * Accepts only http(s) URLs. Anything else (including `javascript:`) would be
 * rendered as a clickable link for every Cube, so it is rejected outright.
 */
export function parseHttpUrl(value: any, field: string): string | null {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    throw badRequest(`${field} is not a valid URL.`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw badRequest(`${field} must be an http(s) link.`);
  }
  return url.toString();
}

export interface CareerEntry {
  title: string;
  company: string;
  period: string;
  description: string;
}

/** Normalizes the career timeline; drops empty rows and caps its length. */
export function parseCareer(value: any): CareerEntry[] {
  if (!Array.isArray(value)) return [];
  const str = (v: any, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  return value
    .slice(0, 20)
    .map(item => ({
      title: str(item?.title, 160),
      company: str(item?.company, 160),
      period: str(item?.period, 80),
      description: str(item?.description, 1000)
    }))
    .filter(item => item.title || item.company);
}

/** Normalizes expertise tags: trimmed, de-duplicated, at most 12. */
export function parseExpertise(value: any): string[] {
  const list = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of list) {
    const tag = typeof item === 'string' ? item.trim().slice(0, 40) : '';
    if (!tag || seen.has(tag.toLowerCase())) continue;
    seen.add(tag.toLowerCase());
    result.push(tag);
    if (result.length >= 12) break;
  }
  return result;
}

/**
 * Resolves the start time and the question deadline. When no deadline is
 * given it defaults to DEFAULT_QUESTION_LEAD_HOURS before the start.
 */
export function parseSchedule(
  dateValue: any,
  closeValue: any
): { date: Date; questions_close_at: Date } {
  const date = new Date(dateValue);
  if (!dateValue || Number.isNaN(date.getTime())) {
    throw badRequest('A valid webinar date is required.');
  }
  let close: Date;
  if (closeValue) {
    close = new Date(closeValue);
    if (Number.isNaN(close.getTime())) throw badRequest('The question deadline is not a valid date.');
  } else {
    close = new Date(date.getTime() - DEFAULT_QUESTION_LEAD_HOURS * 3600 * 1000);
  }
  if (close.getTime() > date.getTime()) {
    throw badRequest('The question deadline must be before the webinar starts.');
  }
  return { date, questions_close_at: close };
}

/**
 * Plain-text, anonymous question list to send to the speaker. Names are never
 * included; questions marked late are kept but listed after the on-time ones.
 */
export function formatQuestionsForSpeaker(
  webinarTitle: string,
  questions: { body: string; is_late: boolean }[]
): string {
  const ordered = [...questions.filter(q => !q.is_late), ...questions.filter(q => q.is_late)];
  const lines = [`Questions from the Cubes: ${webinarTitle}`, ''];
  ordered.forEach((q, i) => lines.push(`${i + 1}. ${q.body.replace(/\s+/g, ' ').trim()}`));
  if (ordered.length === 0) lines.push('(No questions yet.)');
  return lines.join('\n');
}
