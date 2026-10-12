/**
 * Peer feedback client: types, API calls and presentation metadata.
 *
 * The tag catalogue and limits come from the server (`/peer-feedback/catalog`),
 * so nothing here mirrors a server constant. Only presentation (icon, colour)
 * lives on the client.
 */
import {
  Unlock,
  Telescope,
  Handshake,
  MessageCircle,
  ShieldCheck,
  Eye,
  Lightbulb,
  Crown,
  Sparkles,
  TrendingUp,
  type LucideIcon
} from 'lucide-react';
import { api } from './api';

export type PeerKind = 'KUDOS' | 'OBSERVATION' | 'CONCERN';

export interface PeerTag {
  key: string;
  label: string;
  description: string;
  category?: string;
}

export interface PeerCatalog {
  kudos_tags: PeerTag[];
  observation_tags: PeerTag[];
  concern_tags: PeerTag[];
  limits: {
    kudos_weekly_budget: number;
    kudos_target_cooldown_days: number;
    concern_target_cooldown_days: number;
    concern_daily_limit: number;
    max_tags: number;
    note_max_length: number;
    note_min_length_other_context: number;
    max_pinned: number;
    k_anonymity: number;
  };
}

export interface PeerBudget {
  kudos: { limit: number; used: number; remaining: number };
  concerns: { daily_limit: number; used_today: number; remaining_today: number };
}

export interface PeerTitle {
  category: string;
  label: string;
  rarity: 'Common' | 'Rare' | 'Epic';
}

export const peerApi = {
  catalog: () => api.get<PeerCatalog>('/peer-feedback/catalog'),
  budget: () => api.get<PeerBudget>('/peer-feedback/budget'),
  create: (body: Record<string, unknown>) => api.post('/peer-feedback', body),
  received: () => api.get<any[]>('/peer-feedback/received'),
  given: () => api.get<any[]>('/peer-feedback/given'),
  pin: (id: string) => api.post(`/peer-feedback/${id}/pin`, {}),
  unpin: (id: string) => api.delete(`/peer-feedback/${id}/pin`),
  helpful: (id: string) => api.post(`/peer-feedback/${id}/helpful`, {}),
  summary: (cubeId: string) => api.get<any>(`/cubes/${cubeId}/peer-summary`),
  hiddenGems: () => api.get<any>('/radar/hidden-gems'),
  needsAttention: () => api.get<any>('/radar/needs-attention'),
  setSignalState: (id: string, body: { state: string; outcome?: string }) =>
    api.post(`/radar/signals/${id}/state`, body),
  mvcubes: (period?: string) => api.get<any>(`/mvcubes${period ? `?period=${period}` : ''}`),
  computeMvcubes: (period: string) => api.post('/mvcubes/compute', { period })
};

/** Icon and accent for each positive tag / peer title category. */
export const TAG_STYLE: Record<
  string,
  { icon: LucideIcon; ring: string; tint: string; text: string }
> = {
  UNBLOCKER: { icon: Unlock, ring: 'ring-amber-300', tint: 'bg-amber-50', text: 'text-amber-700' },
  DEEP_DIVER: { icon: Telescope, ring: 'ring-sky-300', tint: 'bg-sky-50', text: 'text-sky-700' },
  TEAM_GLUE: { icon: Handshake, ring: 'ring-fuchsia-300', tint: 'bg-fuchsia-50', text: 'text-fuchsia-700' },
  CLEAR_COMMUNICATOR: { icon: MessageCircle, ring: 'ring-emerald-300', tint: 'bg-emerald-50', text: 'text-emerald-700' },
  RELIABLE: { icon: ShieldCheck, ring: 'ring-indigo-300', tint: 'bg-indigo-50', text: 'text-indigo-700' },
  RISING_STAR: { icon: TrendingUp, ring: 'ring-rose-300', tint: 'bg-rose-50', text: 'text-rose-700' }
};

export const tagStyle = (key: string) =>
  TAG_STYLE[key] || { icon: Sparkles, ring: 'ring-slate-300', tint: 'bg-slate-50', text: 'text-slate-700' };

export const CATEGORY_LABELS: Record<string, string> = {
  UNBLOCKER: 'Unblocker',
  DEEP_DIVER: 'Deep Diver',
  TEAM_GLUE: 'Team Glue',
  CLEAR_COMMUNICATOR: 'Clear Communicator',
  RELIABLE: 'Reliable',
  RISING_STAR: 'Rising Star'
};

/** MVCubes category presentation: colour world per category. */
export const MVCUBES_STYLE: Record<string, { gradient: string; glow: string; icon: LucideIcon; blurb: string }> = {
  UNBLOCKER: {
    gradient: 'from-amber-400 via-orange-400 to-rose-500',
    glow: 'shadow-[0_24px_60px_-20px_rgba(251,146,60,0.65)]',
    icon: Unlock,
    blurb: 'Cleared the path for others the most.'
  },
  DEEP_DIVER: {
    gradient: 'from-sky-400 via-cyan-400 to-blue-600',
    glow: 'shadow-[0_24px_60px_-20px_rgba(14,165,233,0.65)]',
    icon: Telescope,
    blurb: 'Went the furthest to truly understand.'
  },
  TEAM_GLUE: {
    gradient: 'from-fuchsia-500 via-pink-500 to-rose-500',
    glow: 'shadow-[0_24px_60px_-20px_rgba(217,70,239,0.6)]',
    icon: Handshake,
    blurb: 'Kept the team connected and moving.'
  },
  RISING_STAR: {
    gradient: 'from-violet-500 via-magenta to-amber-400',
    glow: 'shadow-[0_24px_60px_-20px_rgba(230,0,126,0.6)]',
    icon: Crown,
    blurb: 'Noticed by the most new people this month.'
  }
};

export const SIGNAL_ICON = { observation: Eye, gem: Sparkles, hint: Lightbulb };

/** Quest criteria labels for the peer types (used by Quests and dashboards). */
export function peerQuestLabel(type: string, value: number, minSample?: number | null): string | null {
  switch (type) {
    case 'peer_kudos_given':
      return `Recognise ${value} different Cube${value === 1 ? '' : 's'}`;
    case 'peer_feedback_streak':
      return `Give feedback ${value} week${value === 1 ? '' : 's'} in a row`;
    case 'peer_quiet_kudos':
      return `Recognise ${value} quiet teammate${value === 1 ? '' : 's'} who rarely get noticed`;
    case 'peer_helpful_feedback':
      return `Write kudos that ${value} different Cube${value === 1 ? '' : 's'} found helpful`;
    case 'peer_calibration':
      return `Keep ${value}% of your reviewed concerns accurate${minSample ? ` (across at least ${minSample})` : ''}`;
    case 'peer_distinct_givers_received':
      return `Be recognised by ${value} different people`;
    case 'peer_title_tier':
      return `Earn a ${['', 'Common', 'Rare', 'Epic'][value] || ''} peer title`;
    case 'mvcubes_awards':
      return `Win MVCubes ${value} time${value === 1 ? '' : 's'}`;
    default:
      return null;
  }
}

export function peerQuestProgressText(type: string, current: number, target: number): string | null {
  switch (type) {
    case 'peer_feedback_streak':
      return `${current} / ${target} wks`;
    case 'peer_calibration':
      return `${Math.round(current)}% / ${target}%`;
    case 'peer_title_tier':
      return `Tier ${current} / ${target}`;
    case 'peer_kudos_given':
    case 'peer_quiet_kudos':
    case 'peer_helpful_feedback':
    case 'peer_distinct_givers_received':
    case 'mvcubes_awards':
      return `${current} / ${target}`;
    default:
      return null;
  }
}

export const PEER_CRITERIA_OPTIONS: { value: string; label: string; help: string }[] = [
  { value: 'peer_kudos_given', label: 'Peer: Cubes Recognised', help: 'Number of different Cubes this Cube has given kudos to.' },
  { value: 'peer_feedback_streak', label: 'Peer: Feedback Streak (Weeks)', help: 'Consecutive ISO weeks in which the Cube gave any peer feedback.' },
  { value: 'peer_quiet_kudos', label: 'Peer: Quiet Teammates Recognised', help: 'Kudos given to Cubes who had fewer than 3 people recognising them at the time.' },
  { value: 'peer_helpful_feedback', label: 'Peer: Kudos Marked Helpful', help: 'Distinct recipients who marked this Cube\'s kudos as helpful. Assigned after their first kudos.' },
  { value: 'peer_calibration', label: 'Peer: Concern Accuracy (%)', help: 'Share of this Cube\'s mentor-reviewed concerns that were confirmed. Assigned after their first concern; uses Minimum Sample Size.' },
  { value: 'peer_distinct_givers_received', label: 'Peer: People Who Recognised You', help: 'Distinct people who gave this Cube kudos (delivered weekly).' },
  { value: 'peer_title_tier', label: 'Peer: Title Tier (1-3)', help: '1 = Common, 2 = Rare, 3 = Epic peer title.' },
  { value: 'mvcubes_awards', label: 'MVCubes Awards Won', help: 'Number of MVCubes monthly awards won.' }
];

export const PEER_RATE_CRITERIA = ['peer_calibration'];
export const isPeerCriteria = (type: string) =>
  PEER_CRITERIA_OPTIONS.some(o => o.value === type);
