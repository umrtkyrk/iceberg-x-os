/** Shared types and helpers for the webinar pages. */

export type WebinarStatus = 'Draft' | 'Published' | 'Completed' | 'Cancelled';
export type QuestionWindow = 'not_open' | 'open' | 'late' | 'closed';

export interface CareerEntry {
  title: string;
  company: string;
  period: string;
  description: string;
}

export interface Speaker {
  id: string;
  name: string;
  headline?: string | null;
  company?: string | null;
  photo_url?: string | null;
  bio?: string | null;
  linkedin_url?: string | null;
  website_url?: string | null;
  career?: CareerEntry[] | null;
  expertise?: string[];
  _count?: { webinars: number };
}

export type AttendanceStatus = 'Present' | 'Late' | 'Absent' | 'Excused';
export type RecoveryStatus = 'Pending' | 'Approved' | 'Rejected';
export type QuestionLevel = 'strong' | 'on_time' | 'late' | 'none';

export interface WebinarAttendance {
  id: string;
  status: AttendanceStatus;
  note?: string | null;
  recovery_note?: string | null;
  recovery_status?: RecoveryStatus | null;
  recovery_submitted_at?: string | null;
  recovery_reviewed_at?: string | null;
  recovery_feedback?: string | null;
}

export interface WebinarScore {
  question_level: QuestionLevel;
  question_points: number;
  attendance_status: AttendanceStatus;
  recovered: boolean;
  attendance_points: number | null;
  score: number;
}

export interface EngagementSummary {
  average: number | null;
  scored: number;
  missed_questions: number;
  strong_questions: number;
  attended: number;
  absent: number;
  excused: number;
  recovered: number;
  attendance_rate: number | null;
}

export interface QuestionGroup {
  title: string;
  question_ids: string[];
}

export interface WebinarQuestion {
  id: string;
  body: string;
  is_late?: boolean;
  asked_live?: boolean;
  is_strong?: boolean;
  vote_count?: number;
  voted?: boolean;
  created_at: string;
  cube_id?: string;
  cube?: { id: string; cube_number?: string; avatar_url?: string | null; user?: { name?: string } | null } | null;
}

export interface Webinar {
  id: string;
  title: string;
  description?: string | null;
  date: string;
  duration_minutes: number;
  meeting_url?: string | null;
  questions_close_at: string;
  status: WebinarStatus;
  invited_cube_ids: string[];
  recording_url?: string | null;
  slides_url?: string | null;
  summary?: string | null;
  speakers: Speaker[];
  question_window: QuestionWindow;
  question_count?: number;
  my_question_count?: number;
  my_score?: number | null;
  my_result?: WebinarScore | null;
  completed_at?: string | null;
  recovery_deadline?: string | null;
  // Detail (Cube)
  my_questions?: WebinarQuestion[];
  other_questions?: WebinarQuestion[];
  others_locked?: boolean;
  my_attendance?: WebinarAttendance | null;
  can_recover?: boolean;
  // Detail (staff)
  questions?: WebinarQuestion[];
  participation?: Participant[];
  attendance_taken?: boolean;
  engagement?: EngagementSummary | null;
  question_groups?: QuestionGroup[] | null;
  question_groups_at?: string | null;
}

export interface Participant {
  cube_id: string;
  cube_number: string;
  name: string;
  avatar_url?: string | null;
  question_count: number;
  attendance?: WebinarAttendance | null;
  score?: WebinarScore | null;
}

export interface ScoredWebinar {
  webinar_id: string;
  title: string;
  date: string;
  result: WebinarScore;
}

export const ATTENDANCE_STATUSES: AttendanceStatus[] = ['Present', 'Late', 'Absent', 'Excused'];

export const attendanceStyle: Record<AttendanceStatus, string> = {
  Present: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Late: 'bg-amber-50 text-amber-700 border-amber-200',
  Absent: 'bg-red-50 text-red-600 border-red-200',
  Excused: 'bg-slate-100 text-slate-600 border-slate-200'
};

export const questionLevelLabel: Record<QuestionLevel, string> = {
  strong: 'Strong question',
  on_time: 'Question on time',
  late: 'Late question',
  none: 'No question'
};

export const RECOVERY_NOTE_MIN_LENGTH = 300;
export const RECOVERY_NOTE_MAX_LENGTH = 5000;

/** Colour for a 0-100 webinar score. */
export const scoreTone = (score?: number | null) =>
  score === null || score === undefined
    ? 'bg-gray-100 text-gray-500'
    : score >= 80
      ? 'bg-emerald-50 text-emerald-700'
      : score >= 50
        ? 'bg-amber-50 text-amber-700'
        : 'bg-red-50 text-red-600';

export const QUESTION_MIN_LENGTH = 30;
export const QUESTION_MAX_LENGTH = 1000;
export const MAX_QUESTIONS_PER_CUBE = 5;

const TZ = 'Europe/Istanbul';

export const formatWebinarDate = (value?: string | null) => {
  if (!value) return '';
  return (
    new Date(value).toLocaleString('tr-TR', {
      timeZone: TZ,
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }) + ' (TSİ)'
  );
};

/** ISO string → value for a <input type="datetime-local"> in Istanbul time. */
export const toIstanbulInput = (value?: string | null) => {
  if (!value) return '';
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(new Date(value));
  const v = (type: string) => parts.find(p => p.type === type)?.value || '';
  return `${v('year')}-${v('month')}-${v('day')}T${v('hour')}:${v('minute')}`;
};

/** <input type="datetime-local"> value (Istanbul time) → ISO string. */
export const fromIstanbulInput = (value: string) => (value ? `${value}:00+03:00` : '');

/** "in 3 days", "in 5 hours", or null once the moment has passed. */
export const timeUntil = (value?: string | null, now = Date.now()) => {
  if (!value) return null;
  const ms = new Date(value).getTime() - now;
  if (ms <= 0) return null;
  const hours = Math.floor(ms / 3600000);
  if (hours >= 48) return `in ${Math.floor(hours / 24)} days`;
  if (hours >= 1) return `in ${hours} hour${hours === 1 ? '' : 's'}`;
  return `in ${Math.max(1, Math.floor(ms / 60000))} min`;
};

export const statusStyle: Record<WebinarStatus, string> = {
  Draft: 'bg-gray-100 text-gray-600',
  Published: 'bg-indigo-50 text-indigo-700',
  Completed: 'bg-emerald-50 text-emerald-700',
  Cancelled: 'bg-red-50 text-red-600'
};

export const isUpcoming = (w: Pick<Webinar, 'status' | 'date' | 'duration_minutes'>, now = Date.now()) => {
  if (w.status === 'Completed' || w.status === 'Cancelled') return false;
  const end = new Date(w.date).getTime() + (w.duration_minutes || 60) * 60000;
  return w.status === 'Draft' || end > now;
};

export const speakerLine = (s: Pick<Speaker, 'headline' | 'company'>) =>
  [s?.headline, s?.company].filter(Boolean).join(' · ');

// ---------------------------------------------------------------------------
// Quest criteria (mirrors WEBINAR_CRITERIA in the backend)
// ---------------------------------------------------------------------------

export const WEBINAR_RATE_CRITERIA = ['webinar_attendance', 'webinar_score'];

export const WEBINAR_CRITERIA_OPTIONS = [
  { value: 'webinar_questions', label: 'Webinars with an on-time question (count)' },
  { value: 'webinar_strong_questions', label: 'Strong webinar questions (count)' },
  { value: 'webinar_attendance', label: 'Webinar attendance (%)' },
  { value: 'webinar_score', label: 'Average webinar score (0-100)' }
];

export function webinarQuestLabel(type: string, value: number, minSample?: number | null): string | null {
  const sample = minSample ? ` (across at least ${minSample} webinars)` : '';
  switch (type) {
    case 'webinar_questions':
      return value === 1 ? 'Send an on-time question for a webinar' : `Send on-time questions for ${value} webinars`;
    case 'webinar_strong_questions':
      return value === 1 ? 'Ask a question marked strong' : `Ask ${value} questions marked strong`;
    case 'webinar_attendance':
      return `Reach ${value}% webinar attendance${sample}`;
    case 'webinar_score':
      return `Keep an average webinar score of ${value}+${sample}`;
    default:
      return null;
  }
}

export function webinarQuestProgressText(type: string, current: number, target: number): string | null {
  switch (type) {
    case 'webinar_questions':
      return `${current} / ${target} webinars`;
    case 'webinar_strong_questions':
      return `${current} / ${target} strong`;
    case 'webinar_attendance':
      return `${Math.round(current)}% / ${target}%`;
    case 'webinar_score':
      return `${Math.round(current)} / ${target} avg`;
    default:
      return null;
  }
}
