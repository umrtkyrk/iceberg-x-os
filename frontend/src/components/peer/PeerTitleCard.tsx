import React from 'react';
import { BadgeSparks, RarityPill } from '../BadgeMedal';
import { getRarityMeta } from '../../utils/badgeRarity';
import { CATEGORY_LABELS, tagStyle, type PeerTitle } from '../../utils/peer';

const HINTS: Record<string, string> = {
  UNBLOCKER: 'Teammates say they clear the way when others are stuck.',
  DEEP_DIVER: 'Teammates say they go the extra mile to truly understand.',
  TEAM_GLUE: 'Teammates say they keep the team connected and supported.',
  CLEAR_COMMUNICATOR: 'Teammates say they make sure everyone is on the same page.',
  RELIABLE: 'Teammates say they do what they said they would.'
};

/**
 * A peer-earned title, drawn with the same rarity treatment as badges so the
 * peer shelf reads as part of the same system (Common flat, Rare lit, Epic
 * animated). The tier is the only thing shown: no counts, no names.
 */
export const PeerTitleCard: React.FC<{ title: PeerTitle; compact?: boolean }> = ({ title, compact }) => {
  const meta = getRarityMeta(title.rarity);
  const isEpic = meta.key === 'Epic';
  const Icon = tagStyle(title.category).icon;
  const label = title.label || CATEGORY_LABELS[title.category] || title.category;

  return (
    <div className={`group relative ${meta.frame}`} title={HINTS[title.category] || label}>
      {isEpic && <span className="badge-sheen" />}
      {isEpic && <BadgeSparks />}
      <div className={`relative ${meta.surface} flex items-center gap-3 ${compact ? 'p-3' : 'p-4'}`}>
        <span className={`relative flex shrink-0 items-center justify-center ${compact ? 'h-10 w-10' : 'h-12 w-12'} ${meta.disc}`}>
          <Icon className={`${compact ? 'h-4 w-4' : 'h-5 w-5'} ${meta.iconClass}`} />
          {isEpic && <span className="badge-sheen rounded-xl" />}
        </span>
        <div className="min-w-0">
          <p className={`truncate text-sm font-extrabold leading-tight ${meta.title}`}>{label}</p>
          <div className="mt-1">
            <RarityPill rarity={title.rarity} />
          </div>
        </div>
      </div>
    </div>
  );
};
