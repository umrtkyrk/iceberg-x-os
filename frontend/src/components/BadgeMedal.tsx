import React from 'react';
import { Crown } from 'lucide-react';
import { getBadgeIcon } from '../utils/badgeIcons';
import { getRarityMeta } from '../utils/badgeRarity';

type Size = 'sm' | 'md' | 'lg';

const DISC_SIZES: Record<Size, string> = {
  sm: 'w-9 h-9',
  md: 'w-12 h-12',
  lg: 'w-16 h-16'
};

const ICON_SIZES: Record<Size, string> = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-7 h-7'
};

/** Sparkle positions for Epic badges — fixed so they do not jump on re-render. */
const SPARKS = [
  { top: '14%', left: '82%', size: 3, delay: '0s' },
  { top: '68%', left: '8%', size: 2, delay: '1.2s' },
  { top: '30%', left: '92%', size: 2, delay: '2.1s' },
  { top: '82%', left: '70%', size: 3, delay: '0.6s' }
];

/** Embers rising off a Legendary badge. Fixed positions so they never jump. */
const EMBERS = [
  { left: '8%', size: 4, delay: '0s', drift: '8px' },
  { left: '22%', size: 3, delay: '1.1s', drift: '-6px' },
  { left: '38%', size: 5, delay: '2.2s', drift: '10px' },
  { left: '55%', size: 3, delay: '0.6s', drift: '-9px' },
  { left: '68%', size: 4, delay: '1.7s', drift: '7px' },
  { left: '82%', size: 3, delay: '2.8s', drift: '-5px' },
  { left: '92%', size: 4, delay: '0.3s', drift: '6px' }
];

export const BadgeEmbers: React.FC = () => (
  <>
    {EMBERS.map((e, i) => (
      <span
        key={i}
        className="badge-ember"
        style={
          {
            left: e.left,
            width: e.size,
            height: e.size,
            animationDelay: e.delay,
            '--ember-drift': e.drift
          } as React.CSSProperties
        }
      />
    ))}
  </>
);

export const BadgeSparks: React.FC = () => (
  <>
    {SPARKS.map((s, i) => (
      <span
        key={i}
        className="badge-spark"
        style={{ top: s.top, left: s.left, width: s.size, height: s.size, animationDelay: s.delay }}
      />
    ))}
  </>
);

/**
 * The icon disc on its own, in the badge's rarity treatment. Used wherever a
 * badge appears compactly — profiles, award lists, the design preview.
 */
export const BadgeDisc: React.FC<{
  icon?: string | null;
  rarity?: string | null;
  size?: Size;
  className?: string;
}> = ({ icon, rarity, size = 'md', className = '' }) => {
  const Icon = getBadgeIcon(icon);
  const meta = getRarityMeta(rarity);

  return (
    <span
      className={`relative shrink-0 flex items-center justify-center ${DISC_SIZES[size]} ${meta.disc} ${className}`}
    >
      <Icon className={`${ICON_SIZES[size]} ${meta.iconClass}`} />
      {meta.animated && <span className="badge-sheen rounded-xl" />}
      {meta.key === 'Legendary' && (
        <Crown className="absolute -top-2.5 left-1/2 h-3.5 w-3.5 -translate-x-1/2 text-amber-300 drop-shadow-[0_0_6px_rgba(251,191,36,0.9)]" />
      )}
    </span>
  );
};

/** The rarity label pill. */
export const RarityPill: React.FC<{ rarity?: string | null; className?: string }> = ({
  rarity,
  className = ''
}) => {
  const meta = getRarityMeta(rarity);
  return (
    <span
      title={meta.hint}
      className={`text-[9px] font-extrabold uppercase tracking-[0.14em] px-2 py-0.5 rounded-full ${meta.pill} ${className}`}
    >
      {meta.label}
    </span>
  );
};

/**
 * A full badge card. The frame, surface, disc and text colours all come from
 * the rarity, so Common / Rare / Epic read as three different objects rather
 * than the same card with a different label.
 */
export const BadgeMedal: React.FC<{
  badge: { name: string; description?: string; icon?: string | null; rarity?: string | null };
  /** Rendered inside the card, under the description. */
  children?: React.ReactNode;
  /** Rendered in the top-right corner (actions). */
  actions?: React.ReactNode;
  className?: string;
}> = ({ badge, children, actions, className = '' }) => {
  const meta = getRarityMeta(badge.rarity);
  const isAnimated = meta.animated;
  const isLegendary = meta.key === 'Legendary';

  return (
    <div className={`group relative ${meta.frame} ${className}`}>
      {isAnimated && <span className="badge-sheen" />}
      {isAnimated && <BadgeSparks />}
      {isLegendary && <BadgeEmbers />}

      <div className={`relative ${meta.surface} p-6 flex flex-col gap-4 h-full`}>
        <div className="flex items-start gap-4">
          <BadgeDisc icon={badge.icon} rarity={badge.rarity} size="md" />

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h3 className={`font-extrabold text-base leading-tight ${meta.title}`}>
                {badge.name}
              </h3>
              {actions}
            </div>
            <div className="mt-1.5">
              <RarityPill rarity={badge.rarity} />
            </div>
          </div>
        </div>

        {badge.description && (
          <p className={`text-xs leading-relaxed font-medium ${meta.body}`}>{badge.description}</p>
        )}

        {children}
      </div>
    </div>
  );
};
