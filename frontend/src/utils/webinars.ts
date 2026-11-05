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

export interface WebinarQuestion {
  id: string;
  body: string;
  is_late?: boolean;
  asked_live?: boolean;
  is_strong?: boolean;
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
  // Detail (Cube)
  my_questions?: WebinarQuestion[];
  other_questions?: WebinarQuestion[];
  others_locked?: boolean;
  // Detail (staff)
  questions?: WebinarQuestion[];
  participation?: {
    cube_id: string;
    cube_number: string;
    name: string;
    avatar_url?: string | null;
    question_count: number;
  }[];
}

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
