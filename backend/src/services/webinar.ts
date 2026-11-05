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

export interface ExportQuestion {
  id: string;
  body: string;
  is_late: boolean;
  votes?: number;
}

export interface QuestionGroup {
  title: string;
  question_ids: string[];
}

/** On-time questions first, then by upvotes, then in the order they were sent. */
function orderForSpeaker(questions: ExportQuestion[]): ExportQuestion[] {
  return questions
    .map((q, index) => ({ q, index }))
    .sort(
      (a, b) =>
        Number(a.q.is_late) - Number(b.q.is_late) ||
        (b.q.votes || 0) - (a.q.votes || 0) ||
        a.index - b.index
    )
    .map(x => x.q);
}

/**
 * Plain-text, anonymous question list to send to the speaker. Names are never
 * included. Late questions are listed after on-time ones, and more upvoted
 * questions come first. When themes exist the list is grouped by theme.
 */
export function formatQuestionsForSpeaker(
  webinarTitle: string,
  questions: ExportQuestion[],
  groups?: QuestionGroup[] | null
): string {
  const lines = [`Questions from the Cubes: ${webinarTitle}`, ''];
  const clean = (body: string) => body.replace(/\s+/g, ' ').trim();
  if (questions.length === 0) {
    lines.push('(No questions yet.)');
    return lines.join('\n');
  }

  const byId = new Map(questions.map(q => [q.id, q]));
  const usable = (groups || [])
    .map(g => ({ title: g.title, items: g.question_ids.map(id => byId.get(id)).filter(Boolean) as ExportQuestion[] }))
    .filter(g => g.items.length > 0);

  if (usable.length === 0) {
    orderForSpeaker(questions).forEach((q, i) => lines.push(`${i + 1}. ${clean(q.body)}`));
    return lines.join('\n');
  }

  const placed = new Set(usable.flatMap(g => g.items.map(q => q.id)));
  const rest = questions.filter(q => !placed.has(q.id));
  if (rest.length > 0) usable.push({ title: 'Other questions', items: rest });

  let n = 0;
  usable.forEach((g, gi) => {
    if (gi > 0) lines.push('');
    lines.push(`## ${g.title}`);
    orderForSpeaker(g.items).forEach(q => lines.push(`${++n}. ${clean(q.body)}`));
  });
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// AI themes
// ---------------------------------------------------------------------------

export const MIN_QUESTIONS_TO_GROUP = 4;
export const MAX_QUESTION_GROUPS = 8;

/**
 * Validates the model's grouping. The model only ever sees short references
 * (q1, q2, ...), never ids or names. Unknown references are dropped, a question
 * is kept in the first group that claims it, empty groups disappear, and
 * anything left over goes to "Other questions".
 */
export function parseQuestionGroups(raw: string, refs: Map<string, string>): QuestionGroup[] {
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  const list = Array.isArray(parsed?.groups) ? parsed.groups : [];
  const used = new Set<string>();
  const groups: QuestionGroup[] = [];
  for (const g of list) {
    if (groups.length >= MAX_QUESTION_GROUPS) break;
    const title = typeof g?.title === 'string' ? g.title.replace(/\s+/g, ' ').trim().slice(0, 80) : '';
    if (!title || !Array.isArray(g?.questions)) continue;
    const ids: string[] = [];
    for (const ref of g.questions) {
      const id = refs.get(String(ref).trim().toLowerCase());
      if (!id || used.has(id)) continue;
      used.add(id);
      ids.push(id);
    }
    if (ids.length > 0) groups.push({ title, question_ids: ids });
  }
  if (groups.length === 0) return [];
  const leftover = [...refs.values()].filter(id => !used.has(id));
  if (leftover.length > 0) groups.push({ title: 'Other questions', question_ids: leftover });
  return groups;
}

// ---------------------------------------------------------------------------
// Attendance and score
// ---------------------------------------------------------------------------

export const ATTENDANCE_STATUSES = ['Present', 'Late', 'Absent', 'Excused'] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];
export type RecoveryStatus = 'Pending' | 'Approved' | 'Rejected';

/** Question part: the best question a Cube sent counts. */
export const QUESTION_POINTS = { strong: 100, on_time: 70, late: 40, none: 0 } as const;
/** Attendance part. Excused is left out; an approved recovery note earns `recovered`. */
export const ATTENDANCE_POINTS = { Present: 100, Late: 70, Absent: 0, recovered: 50 } as const;

export const RECOVERY_NOTE_MIN_LENGTH = 300;
export const RECOVERY_NOTE_MAX_LENGTH = 5000;
/** How long after the webinar closes an absent Cube can still send a recovery note. */
export const RECOVERY_WINDOW_DAYS = 14;

export type QuestionLevel = keyof typeof QUESTION_POINTS;

export function questionLevel(questions: { is_late: boolean; is_strong: boolean }[]): QuestionLevel {
  if (questions.some(q => q.is_strong)) return 'strong';
  if (questions.some(q => !q.is_late)) return 'on_time';
  if (questions.length > 0) return 'late';
  return 'none';
}

export interface WebinarScore {
  question_level: QuestionLevel;
  question_points: number;
  attendance_status: AttendanceStatus;
  recovered: boolean;
  /** Null when excused: the attendance part is left out of the score. */
  attendance_points: number | null;
  score: number;
}

/**
 * Score for one Cube in one webinar: half questions, half attendance. Returns
 * null when no attendance was recorded (the webinar is not scored for them).
 */
export function scoreWebinar(
  questions: { is_late: boolean; is_strong: boolean }[],
  attendance: { status: AttendanceStatus; recovery_status?: RecoveryStatus | null } | null
): WebinarScore | null {
  if (!attendance) return null;
  const level = questionLevel(questions);
  const questionPoints = QUESTION_POINTS[level];
  const recovered = attendance.status === 'Absent' && attendance.recovery_status === 'Approved';
  let attendancePoints: number | null;
  if (attendance.status === 'Excused') attendancePoints = null;
  else if (recovered) attendancePoints = ATTENDANCE_POINTS.recovered;
  else attendancePoints = ATTENDANCE_POINTS[attendance.status];

  const score = attendancePoints === null ? questionPoints : (questionPoints + attendancePoints) / 2;
  return {
    question_level: level,
    question_points: questionPoints,
    attendance_status: attendance.status,
    recovered,
    attendance_points: attendancePoints,
    score: Math.round(score)
  };
}

export interface EngagementSummary {
  /** Mean of the per-webinar scores, or null with nothing scored yet. */
  average: number | null;
  scored: number;
  /** Scored webinars with no question at all. */
  missed_questions: number;
  strong_questions: number;
  /** Present or late, over webinars that were not excused. */
  attended: number;
  absent: number;
  excused: number;
  recovered: number;
  /** Attendance rate in %, excused left out, or null with nothing counted. */
  attendance_rate: number | null;
}

export function summarizeEngagement(scores: WebinarScore[]): EngagementSummary {
  const counted = scores.filter(s => s.attendance_status !== 'Excused');
  const attended = counted.filter(s => s.attendance_status === 'Present' || s.attendance_status === 'Late').length;
  return {
    average: scores.length ? Math.round(scores.reduce((sum, s) => sum + s.score, 0) / scores.length) : null,
    scored: scores.length,
    missed_questions: scores.filter(s => s.question_level === 'none').length,
    strong_questions: scores.filter(s => s.question_level === 'strong').length,
    attended,
    absent: scores.filter(s => s.attendance_status === 'Absent').length,
    excused: scores.length - counted.length,
    recovered: scores.filter(s => s.recovered).length,
    attendance_rate: counted.length ? Math.round((attended / counted.length) * 100) : null
  };
}

export function parseAttendanceStatus(value: any): AttendanceStatus {
  if (ATTENDANCE_STATUSES.includes(value)) return value;
  throw badRequest(`Attendance must be one of: ${ATTENDANCE_STATUSES.join(', ')}.`);
}

/** Last moment an absent Cube can send a recovery note. */
export function recoveryDeadline(webinar: { date: Date | string; completed_at?: Date | string | null }): Date {
  const from = new Date(webinar.completed_at || webinar.date).getTime();
  return new Date(from + RECOVERY_WINDOW_DAYS * 24 * 3600 * 1000);
}

/**
 * Whether a Cube can (re)send a recovery note: they were absent, a recording
 * exists, the window is still open and the note was not already approved.
 */
export function canSubmitRecovery(
  webinar: { status: string; date: Date | string; completed_at?: Date | string | null; recording_url?: string | null },
  attendance: { status: string; recovery_status?: string | null } | null,
  now: Date = new Date()
): boolean {
  if (!attendance || attendance.status !== 'Absent') return false;
  if (webinar.status !== 'Completed' || !webinar.recording_url) return false;
  if (attendance.recovery_status === 'Approved') return false;
  return now.getTime() <= recoveryDeadline(webinar).getTime();
}

export function parseRecoveryNote(value: any): string {
  const note = typeof value === 'string' ? value.trim() : '';
  if (note.length < RECOVERY_NOTE_MIN_LENGTH) {
    throw badRequest(
      `Write at least ${RECOVERY_NOTE_MIN_LENGTH} characters: what you learned and how you will use it.`
    );
  }
  if (note.length > RECOVERY_NOTE_MAX_LENGTH) {
    throw badRequest(`The note can be at most ${RECOVERY_NOTE_MAX_LENGTH} characters.`);
  }
  return note;
}

// ---------------------------------------------------------------------------
// Reminders
// ---------------------------------------------------------------------------

/** The deadline reminder goes out this long before the question deadline. */
export const DEADLINE_REMINDER_LEAD_HOURS = 24;
/** ...but not right after publishing, which already sent a notification. */
export const REMINDER_QUIET_AFTER_PUBLISH_HOURS = 3;
export const START_REMINDER_LEAD_MINUTES = 60;

export function reminderDue(
  webinar: {
    status: string;
    date: Date | string;
    questions_close_at: Date | string;
    published_at?: Date | string | null;
    deadline_reminder_sent_at?: Date | string | null;
    start_reminder_sent_at?: Date | string | null;
  },
  now: Date = new Date()
): { deadline: boolean; start: boolean } {
  if (webinar.status !== 'Published') return { deadline: false, start: false };
  const t = now.getTime();
  const close = new Date(webinar.questions_close_at).getTime();
  const start = new Date(webinar.date).getTime();
  const published = webinar.published_at ? new Date(webinar.published_at).getTime() : 0;
  const quiet = t - published < REMINDER_QUIET_AFTER_PUBLISH_HOURS * 3600 * 1000;
  return {
    deadline:
      !webinar.deadline_reminder_sent_at &&
      !quiet &&
      t < close &&
      t >= close - DEADLINE_REMINDER_LEAD_HOURS * 3600 * 1000,
    start: !webinar.start_reminder_sent_at && t < start && t >= start - START_REMINDER_LEAD_MINUTES * 60 * 1000
  };
}

// ---------------------------------------------------------------------------
// Quest criteria
// ---------------------------------------------------------------------------

/** Webinars with at least one on-time question; questions marked strong. */
export const WEBINAR_COUNT_CRITERIA = ['webinar_questions', 'webinar_strong_questions'];
/** Attendance % and average webinar score, both need a minimum sample. */
export const WEBINAR_RATE_CRITERIA = ['webinar_attendance', 'webinar_score'];
export const WEBINAR_CRITERIA = [...WEBINAR_COUNT_CRITERIA, ...WEBINAR_RATE_CRITERIA];
