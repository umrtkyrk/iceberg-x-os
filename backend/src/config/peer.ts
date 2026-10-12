/**
 * Peer feedback configuration: tag catalogue, limits and thresholds.
 *
 * Everything tunable lives here. There are no feature flags: with no peer data
 * the peer weight in the overall score is 0, so a fresh deploy changes nothing.
 */
import { BadgeRarity } from '@prisma/client';

/** Peer contribution to the overall score never exceeds this share. */
export const PEER_SCORE_CAP = 0.2;

/** No aggregate is shown (or counted) below this many distinct givers. */
export const K_ANONYMITY = 3;

/** Distinct, context-weighted concern givers needed before a concern counts. */
export const CORROBORATION_GIVERS = 3;

export const KUDOS_WEEKLY_BUDGET = 5;
export const KUDOS_TARGET_COOLDOWN_DAYS = 7;
export const CONCERN_TARGET_COOLDOWN_DAYS = 14;
export const CONCERN_DAILY_LIMIT = 3;

export const MAX_PINNED = 3;
export const MAX_TAGS = 3;
export const NOTE_MAX_LENGTH = 500;
/** A concern filed against the "other" context must explain itself. */
export const NOTE_MIN_LENGTH_OTHER_CONTEXT = 20;

/** Rolling window the live aggregate looks at. */
export const SIGNAL_WINDOW_DAYS = 120;
/** Mentor response target once a growth signal opens. */
export const MENTOR_SLA_DAYS = 7;
/** A resolved signal for the same category is not reopened for this long. */
export const SIGNAL_REOPEN_COOLDOWN_DAYS = 30;

/** Context weights, frozen on each feedback row at write time. */
export const WEIGHT_SHARED_WORK = 1.0;
export const WEIGHT_SHARED_MEETING = 0.5;
export const WEIGHT_NO_CONTEXT = 0.2;
/** Concerns below this weight are recorded but never count toward the score. */
export const MIN_CONCERN_SCORE_WEIGHT = 0.5;

/** Abuse adjustments. */
export const MUTUAL_KUDOS_FACTOR = 0.7;
export const RIVAL_CONCERN_FACTOR = 0.5;
export const RECIPROCAL_CONCERN_WINDOW_DAYS = 7;
export const RIVAL_TOP_N = 5;
export const MIN_RELIABILITY = 0.3;
export const MAX_RELIABILITY = 1.2;

/** A Cube with fewer distinct givers than this was "quiet" when recognised. */
export const QUIET_GIVERS_THRESHOLD = 3;

export interface PeerTagDef {
  key: string;
  label: string;
  description: string;
}

export interface PeerConcernTagDef extends PeerTagDef {
  /** Broad category shown to the Cube and used for growth signals. */
  category: string;
}

/** Positive tags. Each one is also a peer title category. */
export const KUDOS_TAGS: PeerTagDef[] = [
  { key: 'UNBLOCKER', label: 'Unblocker', description: 'Cleared the way for me or the team when we were stuck.' },
  { key: 'DEEP_DIVER', label: 'Deep Diver', description: 'Went further than expected to really understand a problem.' },
  { key: 'TEAM_GLUE', label: 'Team Glue', description: 'Keeps the team connected, supported and moving together.' },
  { key: 'CLEAR_COMMUNICATOR', label: 'Clear Communicator', description: 'Explains things so everyone is on the same page.' },
  { key: 'RELIABLE', label: 'Reliable', description: 'Does what they said they would, when they said they would.' }
];

/** "I could not see their contribution": neutral, not an accusation. */
export const OBSERVATION_TAGS: PeerConcernTagDef[] = [
  {
    key: 'CONTRIBUTION_NOT_VISIBLE',
    label: "I couldn't see their contribution",
    description: 'I did not notice what this person worked on.',
    category: 'Contribution'
  },
  {
    key: 'LIMITED_INTERACTION',
    label: 'We barely worked together',
    description: 'I had little chance to see how this person works.',
    category: 'Collaboration'
  }
];

/** Behavioural concerns. Never shown to the Cube; only to mentors, aggregated. */
export const CONCERN_TAGS: PeerConcernTagDef[] = [
  {
    key: 'NO_VISIBLE_CONTRIBUTION',
    label: 'Not contributing to the work',
    description: 'On this task I saw little or no contribution toward the shared goal.',
    category: 'Contribution'
  },
  {
    key: 'LOW_INITIATIVE',
    label: 'Waits to be told what to do',
    description: 'Rarely picks things up without being asked.',
    category: 'Contribution'
  },
  {
    key: 'MISSES_COMMITMENTS',
    label: 'Misses commitments',
    description: 'Agreed work often arrives late or not at all.',
    category: 'Reliability'
  },
  {
    key: 'COMMUNICATION_GAPS',
    label: 'Communication gaps',
    description: 'Hard to reach, or leaves the team without updates.',
    category: 'Communication'
  },
  {
    key: 'HARD_TO_COLLABORATE',
    label: 'Hard to collaborate with',
    description: 'Working together is regularly difficult.',
    category: 'Collaboration'
  }
];

export const GROWTH_CATEGORIES = ['Contribution', 'Reliability', 'Communication', 'Collaboration'];

const KUDOS_KEYS = new Set(KUDOS_TAGS.map(t => t.key));
const OBSERVATION_BY_KEY = new Map(OBSERVATION_TAGS.map(t => [t.key, t]));
const CONCERN_BY_KEY = new Map(CONCERN_TAGS.map(t => [t.key, t]));

export function isKudosTag(key: string): boolean {
  return KUDOS_KEYS.has(key);
}

/** Category for an observation or concern tag, or null for anything else. */
export function concernCategory(key: string): string | null {
  return CONCERN_BY_KEY.get(key)?.category ?? OBSERVATION_BY_KEY.get(key)?.category ?? null;
}

export function tagsForCategory(category: string): string[] {
  return [...CONCERN_TAGS, ...OBSERVATION_TAGS].filter(t => t.category === category).map(t => t.key);
}

export function validTagsFor(kind: 'KUDOS' | 'OBSERVATION' | 'CONCERN'): Set<string> {
  if (kind === 'KUDOS') return KUDOS_KEYS;
  if (kind === 'OBSERVATION') return new Set(OBSERVATION_TAGS.map(t => t.key));
  return new Set(CONCERN_TAGS.map(t => t.key));
}

export const TITLE_LABELS: Record<string, string> = Object.fromEntries(
  KUDOS_TAGS.map(t => [t.key, t.label])
);

/** Peer title tiers. Distinct givers / distinct contexts / sustained weeks. */
export const TITLE_TIERS: {
  rarity: BadgeRarity;
  givers: number;
  contexts: number;
  weeks: number;
}[] = [
  { rarity: BadgeRarity.Epic, givers: 15, contexts: 3, weeks: 8 },
  { rarity: BadgeRarity.Rare, givers: 8, contexts: 2, weeks: 0 },
  { rarity: BadgeRarity.Common, givers: 3, contexts: 0, weeks: 0 }
];

export const RARITY_ORDINAL: Record<BadgeRarity, number> = {
  [BadgeRarity.Common]: 1,
  [BadgeRarity.Rare]: 2,
  [BadgeRarity.Epic]: 3
};

/** MVCubes categories. RISING_STAR is computed from trend, not from a tag. */
export const MVCUBES_TAG_CATEGORIES = ['UNBLOCKER', 'DEEP_DIVER', 'TEAM_GLUE'];
export const MVCUBES_RISING_STAR = 'RISING_STAR';
export const MVCUBES_CATEGORIES = [...MVCUBES_TAG_CATEGORIES, MVCUBES_RISING_STAR];
