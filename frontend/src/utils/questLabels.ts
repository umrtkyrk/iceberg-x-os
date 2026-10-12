/**
 * Human-readable quest goals, progress text and percentages, shared by the
 * dashboard. Mirrors the labels used on the Quest Board so the same quest reads
 * the same everywhere.
 */
import { peerQuestLabel, peerQuestProgressText } from './peer';

/** Criteria whose value is a yes/no (progress is 0 or 1). */
const BINARY = ['profile_completion', 'nda_signed', 'profile_picture', 'avatar_upload', 'quiz_completed'];

export function isBinaryQuest(type: string): boolean {
  return BINARY.includes(type);
}

export function questGoalLabel(q: {
  criteria_type: string;
  criteria_value: number;
  min_sample_size?: number | null;
}): string {
  const { criteria_type: type, criteria_value: v } = q;
  switch (type) {
    case 'missions_completed':
      return `Complete ${v} mission${v === 1 ? '' : 's'}`;
    case 'missions_assigned':
      return `Join ${v} mission team${v === 1 ? '' : 's'}`;
    case 'average_score':
      return `Keep a scorecard average of ${v}/5`;
    case 'login_streak':
      return `Sign in ${v} days in a row`;
    case 'meeting_attendance':
      return `Reach ${v}% meeting attendance`;
    case 'profile_completion':
      return 'Complete your profile';
    case 'nda_signed':
      return 'Sign the NDA';
    case 'profile_picture':
    case 'avatar_upload':
      return 'Upload your profile picture';
    case 'quiz_score':
      return `Score ${v}+ in the Web Fundamentals quiz`;
    case 'quiz_completed':
      return 'Complete the Web Fundamentals quiz';
    case 'write_testimonial':
      return `Submit ${v} testimonial${v === 1 ? '' : 's'}`;
    case 'mission_updates_count':
    case 'mission_updates':
      return v === 1 ? 'Post a mission update' : `Post ${v} mission updates`;
    case 'daily_update_streak':
      return `Post an update ${v} days in a row`;
    case 'weekly_update_streak':
      return `Post an update ${v} weeks in a row`;
    case 'custom':
      return 'Awarded by the programme team';
    default:
      return peerQuestLabel(type, v, q.min_sample_size) ?? `Goal: ${v}`;
  }
}

/** "2 / 5", "Signed", "80% / 90%" ... */
export function questValueText(
  q: { criteria_type: string; criteria_value: number },
  current: number
): string {
  const { criteria_type: type, criteria_value: target } = q;
  switch (type) {
    case 'profile_completion':
      return current >= 1 ? 'Completed' : 'Incomplete';
    case 'nda_signed':
      return current >= 1 ? 'Signed' : 'Not signed';
    case 'profile_picture':
    case 'avatar_upload':
      return current >= 1 ? 'Uploaded' : 'Missing';
    case 'quiz_completed':
      return current >= 1 ? 'Completed' : 'Not yet';
    case 'quiz_score':
      return `${Math.round(current)} / ${target} pts`;
    case 'average_score':
      return `${current.toFixed(2)} / ${target.toFixed(1)}`;
    case 'meeting_attendance':
      return `${current.toFixed(1)}% / ${target}%`;
    case 'daily_update_streak':
      return `${current} / ${target} days`;
    case 'weekly_update_streak':
      return `${current} / ${target} wks`;
    default:
      return peerQuestProgressText(type, current, target) ?? `${current} / ${target}`;
  }
}

/** 0-100, capped. A finished quest is always 100. */
export function questPercent(
  q: { criteria_type: string; criteria_value: number },
  current: number,
  completed: boolean
): number {
  if (completed) return 100;
  if (isBinaryQuest(q.criteria_type)) return current >= 1 ? 100 : 0;
  if (!q.criteria_value || q.criteria_value <= 0) return 0;
  return Math.max(0, Math.min(100, (current / q.criteria_value) * 100));
}

/** A short "how far to go" phrase for count-like quests, or null. */
export function questRemainingText(
  q: { criteria_type: string; criteria_value: number },
  current: number
): string | null {
  if (isBinaryQuest(q.criteria_type) || q.criteria_type === 'custom') return null;
  if (['average_score', 'meeting_attendance', 'quiz_score', 'peer_calibration'].includes(q.criteria_type)) {
    return null;
  }
  const left = Math.max(0, q.criteria_value - current);
  if (left <= 0) return null;
  return left === 1 ? '1 to go' : `${left} to go`;
}
