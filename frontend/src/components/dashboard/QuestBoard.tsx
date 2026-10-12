import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ChevronDown, Flame, Lock, Target, Trophy } from 'lucide-react';
import { BadgeDisc } from '../BadgeMedal';
import { compareByRarity, getRarityMeta } from '../../utils/badgeRarity';
import {
  questGoalLabel,
  questPercent,
  questRemainingText,
  questValueText
} from '../../utils/questLabels';

interface Props {
  /** The Cube's quest assignments from GET /quests (CubeQuest + quest + rewards). */
  quests: any[];
}

const VISIBLE_STEP = 6;

const FILL: Record<string, string> = {
  Common: 'bg-gradient-to-r from-slate-400 to-slate-600',
  Rare: 'bg-gradient-to-r from-sky-400 to-blue-600',
  Epic: 'bg-gradient-to-r from-magenta via-fuchsia-500 to-violet-500',
  Legendary: 'bg-gradient-to-r from-yellow-200 via-amber-400 to-amber-500'
};

/** Circular progress ring. */
const Ring: React.FC<{ percent: number; size?: number; stroke?: number; light?: boolean; children?: React.ReactNode }> = ({
  percent,
  size = 84,
  stroke = 8,
  light,
  children
}) => {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className={light ? 'stroke-white/15' : 'stroke-slate-100'} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (c * Math.min(100, percent)) / 100}
          className="transition-[stroke-dashoffset] duration-700"
          style={{ stroke: light ? '#fbbf24' : '#e6007e' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
};

export const QuestBoard: React.FC<Props> = ({ quests }) => {
  const [tab, setTab] = useState<'active' | 'done'>('active');
  const [showAll, setShowAll] = useState(false);

  const prepared = useMemo(
    () =>
      quests
        .filter(cq => cq.quest)
        .map(cq => ({
          cq,
          q: cq.quest,
          percent: questPercent(cq.quest, cq.current_value, cq.is_completed)
        })),
    [quests]
  );

  const active = useMemo(
    () =>
      prepared
        .filter(x => !x.cq.is_completed)
        // Closest to done first, then rarer quests ahead of common ones.
        .sort((a, b) => b.percent - a.percent || compareByRarity(a.q.difficulty, b.q.difficulty)),
    [prepared]
  );
  const done = useMemo(
    () =>
      prepared
        .filter(x => x.cq.is_completed)
        .sort((a, b) => compareByRarity(a.q.difficulty, b.q.difficulty)),
    [prepared]
  );

  const total = prepared.length;
  const completion = total > 0 ? Math.round((done.length / total) * 100) : 0;

  // The quest worth finishing next: highest progress that is not yet done.
  const spotlight = active.find(x => x.percent > 0 && x.q.criteria_type !== 'custom') || null;
  const list = (tab === 'active' ? active : done).filter(x => x !== spotlight || tab === 'done');
  const shown = showAll ? list : list.slice(0, VISIBLE_STEP);

  if (total === 0) {
    return (
      <section className="rounded-3xl border border-dashed border-gray-200 bg-white p-10 text-center shadow-subtle">
        <Trophy className="mx-auto h-8 w-8 text-gray-300" />
        <h3 className="mt-3 text-base font-extrabold text-gray-800">No quests yet</h3>
        <p className="mx-auto mt-1 max-w-sm text-xs font-medium text-gray-400">
          Quests appear here as they are assigned to you. Check back soon.
        </p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Ring percent={completion} size={72} stroke={7}>
            <span className="text-sm font-black text-gray-900">{completion}%</span>
          </Ring>
          <div>
            <h2 className="flex items-center gap-2 text-xl font-extrabold tracking-tight text-gray-900">
              <Trophy className="h-5 w-5 text-magenta" /> Quest board
            </h2>
            <p className="text-xs font-semibold text-gray-500">
              <b className="text-gray-900">{done.length}</b> of {total} complete
              {active.length > 0 && <> · {active.length} in progress</>}
            </p>
          </div>
        </div>
        <Link to="/quests" className="text-xs font-extrabold text-magenta hover:underline">
          Open the full Quest board
        </Link>
      </header>

      {/* Closest to finishing */}
      {spotlight && tab === 'active' && (
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#16050f] via-[#10060c] to-[#0a0a10] p-6 text-white shadow-premium sm:p-7">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-magenta/25 blur-3xl" />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
            <Ring percent={spotlight.percent} size={104} stroke={9} light>
              <div className="text-center">
                <p className="text-xl font-black leading-none">{Math.round(spotlight.percent)}%</p>
                <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-white/50">done</p>
              </div>
            </Ring>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-amber-300">
                <Flame className="h-3.5 w-3.5" /> Closest to finishing
              </p>
              <h3 className="mt-1.5 text-xl font-extrabold leading-tight">{spotlight.q.title}</h3>
              <p className="mt-1 text-sm font-medium text-white/70">{questGoalLabel(spotlight.q)}</p>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-bold">
                <span className="rounded-full bg-white/10 px-3 py-1 text-white">
                  {questValueText(spotlight.q, spotlight.cq.current_value)}
                </span>
                {questRemainingText(spotlight.q, spotlight.cq.current_value) && (
                  <span className="text-amber-300">{questRemainingText(spotlight.q, spotlight.cq.current_value)}</span>
                )}
                {spotlight.q.rewards?.length > 0 && (
                  <span className="flex items-center gap-2 text-white/70">
                    Reward
                    {spotlight.q.rewards.map((r: any) => (
                      <span key={r.id} className="flex items-center gap-1.5 rounded-full bg-white/10 py-0.5 pl-0.5 pr-2.5 text-white">
                        <BadgeDisc icon={r.icon} rarity={r.rarity} size="sm" className="!h-6 !w-6" />
                        {r.name}
                      </span>
                    ))}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2">
        {([
          ['active', 'In progress', active.length],
          ['done', 'Completed', done.length]
        ] as const).map(([key, label, n]) => (
          <button
            key={key}
            onClick={() => {
              setTab(key);
              setShowAll(false);
            }}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-extrabold transition ${
              tab === key ? 'bg-gray-900 text-white shadow-subtle' : 'bg-white text-gray-500 ring-1 ring-gray-100 hover:text-gray-900'
            }`}
          >
            {label}
            <span className={`rounded-full px-1.5 text-[10px] font-black ${tab === key ? 'bg-white/20' : 'bg-gray-100'}`}>{n}</span>
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-gray-200 bg-white p-6 text-center text-xs font-semibold text-gray-400">
          {tab === 'active'
            ? spotlight
              ? 'Everything else is shown above. Keep going!'
              : 'Nothing in progress right now.'
            : 'No completed quests yet. Your first one is closer than you think.'}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {shown.map(({ cq, q, percent }) => {
            const meta = getRarityMeta(q.difficulty);
            const remaining = questRemainingText(q, cq.current_value);
            const fill = FILL[meta.key] || FILL.Common;
            return (
              <article key={cq.id} className={`group relative ${meta.frame}`}>
                {meta.animated && <span className="badge-sheen" />}
                <div className={`relative flex h-full flex-col gap-4 p-5 ${meta.surface}`}>
                  <div className="flex items-start justify-between gap-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] ${meta.pill}`}>
                      {meta.label}
                    </span>
                    {cq.is_completed ? (
                      <span className="flex items-center gap-1 text-[11px] font-extrabold text-emerald-500">
                        <CheckCircle2 className="h-4 w-4" /> Completed
                      </span>
                    ) : q.criteria_type === 'custom' ? (
                      <span className={`flex items-center gap-1 text-[11px] font-extrabold ${meta.muted}`}>
                        <Lock className="h-3.5 w-3.5" /> Awarded by the team
                      </span>
                    ) : (
                      <span className={`flex items-center gap-1 text-[11px] font-extrabold ${meta.muted}`}>
                        <Target className="h-3.5 w-3.5" /> {Math.round(percent)}%
                      </span>
                    )}
                  </div>

                  <div className="min-w-0">
                    <h4 className={`text-sm font-extrabold leading-snug ${meta.title}`}>{q.title}</h4>
                    <p className={`mt-1 text-xs font-semibold ${meta.key === 'Common' ? 'text-gray-700' : meta.body}`}>
                      {questGoalLabel(q)}
                    </p>
                    {q.description && (
                      <p className={`mt-1.5 line-clamp-2 text-[11px] font-medium leading-relaxed ${meta.muted}`}>{q.description}</p>
                    )}
                  </div>

                  {q.criteria_type !== 'custom' && (
                    <div className="mt-auto flex flex-col gap-1.5">
                      <div className={`h-2 overflow-hidden rounded-full ${meta.dark ? 'bg-white/10' : 'bg-slate-100'}`}>
                        <div className={`h-full rounded-full transition-all duration-700 ${fill}`} style={{ width: `${percent}%` }} />
                      </div>
                      <div className={`flex items-center justify-between text-[11px] font-extrabold ${meta.dark ? 'text-white/80' : 'text-gray-700'}`}>
                        <span>{questValueText(q, cq.current_value)}</span>
                        {!cq.is_completed && remaining && <span className={meta.muted}>{remaining}</span>}
                      </div>
                    </div>
                  )}

                  {q.rewards?.length > 0 && (
                    <div className={`flex flex-wrap items-center gap-2 border-t pt-3 ${meta.divider}`}>
                      <span className={`text-[9px] font-black uppercase tracking-wider ${meta.muted}`}>Reward</span>
                      {q.rewards.map((r: any) => (
                        <span
                          key={r.id}
                          className={`flex items-center gap-1.5 rounded-full py-0.5 pl-0.5 pr-2.5 text-[10px] font-extrabold ${meta.earnerChip}`}
                        >
                          <BadgeDisc icon={r.icon} rarity={r.rarity} size="sm" className="!h-6 !w-6" />
                          {r.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {list.length > VISIBLE_STEP && (
        <button
          onClick={() => setShowAll(v => !v)}
          className="mx-auto flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-extrabold text-gray-500 hover:text-magenta"
        >
          {showAll ? 'Show fewer' : `Show all ${list.length}`}
          <ChevronDown className={`h-3.5 w-3.5 transition ${showAll ? 'rotate-180' : ''}`} />
        </button>
      )}
    </section>
  );
};
