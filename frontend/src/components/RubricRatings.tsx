import React, { useState } from 'react';

/**
 * Scoring v2 rating input: one row per criterion, levels 1-5 described by the
 * rubric, plus "Not observed". Nothing is pre-selected, so every rating is a
 * deliberate choice.
 */
export interface RubricCriterion {
  id: string;
  key: string;
  name: string;
  description: string | null;
  discipline_id: string | null;
  legacy_key: string | null;
  levels: { level: number; description: string }[];
}

/** criterion id -> 1-5, null (not observed); missing = not answered yet. */
export type RatingState = Record<string, number | null>;

const LEVELS = [1, 2, 3, 4, 5];

export const RubricRatings: React.FC<{
  criteria: RubricCriterion[];
  value: RatingState;
  /** Called per answer; apply it to the latest state (several can land in one render). */
  onRate: (criterionId: string, level: number | null) => void;
  disabled?: boolean;
}> = ({ criteria, value, onRate, disabled }) => {
  const core = criteria.filter(c => !c.discipline_id);
  const own = criteria.filter(c => c.discipline_id);
  return (
    <div className="flex flex-col gap-5">
      {[
        { title: 'Core', items: core },
        { title: 'Discipline', items: own },
      ]
        .filter(group => group.items.length > 0)
        .map(group => (
          <div key={group.title} className="flex flex-col gap-3">
            <h4 className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-gray-400">{group.title}</h4>
            {group.items.map(c => (
              <CriterionRow
                key={c.id}
                criterion={c}
                selected={c.id in value ? value[c.id] : undefined}
                onSelect={level => onRate(c.id, level)}
                disabled={disabled}
              />
            ))}
          </div>
        ))}
    </div>
  );
};

const CriterionRow: React.FC<{
  criterion: RubricCriterion;
  selected: number | null | undefined;
  onSelect: (level: number | null) => void;
  disabled?: boolean;
}> = ({ criterion, selected, onSelect, disabled }) => {
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? (typeof selected === 'number' ? selected : null);
  const text = shown ? criterion.levels.find(l => l.level === shown)?.description : null;

  return (
    <fieldset className={`rounded-xl border p-3 ${selected === undefined ? 'border-gray-100 bg-gray-50/40' : 'border-gray-200 bg-white'}`}>
      <legend className="sr-only">{criterion.name}</legend>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-extrabold text-gray-800">{criterion.name}</p>
          {criterion.description && <p className="text-[11px] font-medium text-gray-400">{criterion.description}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-1" onMouseLeave={() => setHover(null)}>
          {LEVELS.map(level => {
            const active = selected === level;
            return (
              <button
                key={level}
                type="button"
                disabled={disabled}
                aria-pressed={active}
                aria-label={`${criterion.name}: ${level}. ${criterion.levels.find(l => l.level === level)?.description || ''}`}
                onMouseEnter={() => setHover(level)}
                onFocus={() => setHover(level)}
                onBlur={() => setHover(null)}
                onClick={() => onSelect(level)}
                className={`h-8 w-8 rounded-lg text-xs font-extrabold transition-colors ${
                  active ? 'bg-magenta text-white' : 'border border-gray-200 bg-white text-gray-600 hover:border-magenta hover:text-magenta'
                }`}
              >
                {level}
              </button>
            );
          })}
          <button
            type="button"
            disabled={disabled}
            aria-pressed={selected === null}
            onClick={() => onSelect(null)}
            className={`ml-1 h-8 rounded-lg px-2.5 text-[11px] font-bold transition-colors ${
              selected === null ? 'bg-gray-800 text-white' : 'border border-gray-200 bg-white text-gray-500 hover:border-gray-400'
            }`}
          >
            Not observed
          </button>
        </div>
      </div>
      <p className={`mt-2 min-h-[1.25rem] text-[11px] font-medium leading-relaxed ${text ? 'text-gray-600' : 'text-gray-400'}`}>
        {text
          ? <><span className="font-extrabold text-gray-700">{shown}</span> · {text}</>
          : selected === null
            ? 'Not observed: left out of the averages.'
            : 'Point at a level to see what it means.'}
      </p>
    </fieldset>
  );
};
