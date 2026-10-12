/**
 * Badge rarity presentation, mirroring the BadgeRarity enum in the backend.
 *
 * The three tiers are meant to be distinguishable at a glance, across the room:
 *
 *   Common — flat and quiet. A plain card, a muted disc, no motion.
 *   Rare   — a lit gradient border and a coloured glow. Clearly above baseline.
 *   Epic   — dark card, animated rotating spectrum border, sheen sweep and
 *            sparkles. Nothing else on the page looks like it.
 *   Legendary — one step beyond: a molten-gold frame that burns brighter than
 *            Epic, a breathing aura, gold sheen and drifting embers. Meant to
 *            be held by almost no one, and to be seen by everyone.
 *
 * Every class below is a complete literal string so Tailwind emits it.
 */

export type Rarity = 'Common' | 'Rare' | 'Epic' | 'Legendary';

export const RARITIES: Rarity[] = ['Common', 'Rare', 'Epic', 'Legendary'];

export interface RarityMeta {
  key: Rarity;
  label: string;
  /** One line explaining when to use this tier. */
  hint: string;
  /** Sort weight, rarest first. */
  order: number;
  /** The card sits on a dark surface (light text, light controls). */
  dark: boolean;
  /** Animated frame with sheen and sparkles. */
  animated: boolean;
  /** Outer wrapper: provides the frame itself. */
  frame: string;
  /** Inner surface of the card. */
  surface: string;
  /** Icon disc. */
  disc: string;
  /** Icon colour inside the disc. */
  iconClass: string;
  /** Rarity pill. */
  pill: string;
  /** Title colour on the card. */
  title: string;
  /** Body text colour on the card. */
  body: string;
  /** Muted label colour on the card. */
  muted: string;
  /** Divider colour on the card. */
  divider: string;
  /** Chip used for the list of earners. */
  earnerChip: string;
}

export const RARITY_META: Record<Rarity, RarityMeta> = {
  Common: {
    key: 'Common',
    label: 'Common',
    hint: 'Expected of every Cube in the programme',
    order: 4,
    dark: false,
    animated: false,
    frame: 'rounded-2xl border border-gray-200 bg-white transition-shadow duration-300 hover:shadow-subtle',
    surface: 'rounded-2xl bg-white',
    disc: 'rounded-xl bg-slate-100 border border-slate-200',
    iconClass: 'text-slate-500',
    pill: 'bg-slate-100 text-slate-500 border border-slate-200',
    title: 'text-gray-900',
    body: 'text-gray-500',
    muted: 'text-gray-400',
    divider: 'border-gray-100',
    earnerChip: 'bg-slate-50 border border-slate-200 text-slate-600'
  },
  Rare: {
    key: 'Rare',
    label: 'Rare',
    hint: 'A real, demonstrated depth of skill',
    order: 3,
    dark: false,
    animated: false,
    // 1.5px gradient border via a padded gradient wrapper
    frame:
      'rounded-2xl p-[1.5px] bg-gradient-to-br from-sky-400 via-cyan-400 to-blue-600 ' +
      'shadow-[0_10px_30px_-12px_rgba(14,165,233,0.55)] transition-all duration-300 ' +
      'hover:shadow-[0_16px_40px_-12px_rgba(14,165,233,0.75)] hover:-translate-y-0.5',
    surface: 'rounded-[calc(1rem-1.5px)] bg-white',
    disc: 'rounded-xl bg-gradient-to-br from-sky-400 via-cyan-400 to-blue-600 shadow-[0_6px_16px_-4px_rgba(14,165,233,0.6)] ring-1 ring-inset ring-white/40',
    iconClass: 'text-white drop-shadow-sm',
    pill: 'bg-sky-50 text-sky-700 border border-sky-200',
    title: 'text-gray-900',
    body: 'text-gray-500',
    muted: 'text-gray-400',
    divider: 'border-sky-100',
    earnerChip: 'bg-sky-50 border border-sky-200 text-sky-700'
  },
  Epic: {
    key: 'Epic',
    label: 'Epic',
    hint: 'Moves the programme forward. Rarely earned.',
    order: 2,
    dark: true,
    animated: true,
    // The animated spectrum border lives in index.css (.badge-frame-epic)
    frame:
      'badge-frame-epic rounded-2xl shadow-[0_18px_50px_-16px_rgba(230,0,126,0.65)] ' +
      'transition-transform duration-300 hover:-translate-y-1',
    surface: 'rounded-2xl bg-transparent',
    disc: 'rounded-xl bg-gradient-to-br from-magenta via-violet-600 to-amber-500 shadow-[0_8px_22px_-4px_rgba(230,0,126,0.8)] ring-1 ring-inset ring-white/30',
    iconClass: 'text-white',
    pill: 'badge-pill-epic border border-white/20 text-white',
    title: 'text-white',
    body: 'text-slate-300',
    muted: 'text-slate-400',
    divider: 'border-white/10',
    earnerChip: 'bg-white/10 border border-white/20 text-slate-100'
  },
  Legendary: {
    key: 'Legendary',
    label: 'Legendary',
    hint: 'The summit. Held by almost no one.',
    order: 1,
    dark: true,
    animated: true,
    // The molten-gold spinning edge, the breathing aura and the warm inner
    // surface all live in index.css (.badge-frame-legendary).
    frame:
      'badge-frame-legendary badge-legendary-glow rounded-2xl ' +
      'transition-transform duration-300 hover:-translate-y-1.5 hover:scale-[1.015]',
    surface: 'rounded-2xl bg-transparent',
    disc:
      'rounded-xl bg-gradient-to-br from-yellow-100 via-amber-300 to-amber-600 ' +
      'shadow-[0_0_0_2px_rgba(253,230,138,0.55),0_10px_30px_-4px_rgba(245,158,11,0.95)] ' +
      'ring-1 ring-inset ring-white/70',
    iconClass: 'text-amber-950 drop-shadow-[0_1px_0_rgba(255,255,255,0.6)]',
    pill: 'badge-pill-legendary border border-amber-100/60 text-amber-950',
    title: 'badge-title-legendary',
    body: 'text-amber-100/75',
    muted: 'text-amber-200/55',
    divider: 'border-amber-300/20',
    earnerChip: 'bg-amber-300/10 border border-amber-300/35 text-amber-100'
  }
};

export const getRarityMeta = (rarity?: string | null): RarityMeta =>
  RARITY_META[(rarity as Rarity)] || RARITY_META.Common;

/** Rarest first. */
export const compareByRarity = (a?: string | null, b?: string | null) =>
  getRarityMeta(a).order - getRarityMeta(b).order;
