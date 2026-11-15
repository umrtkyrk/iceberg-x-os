import React, { useCallback, useEffect, useState } from 'react';
import { ClipboardCheck, Gauge, UserCheck } from 'lucide-react';
import { api } from '../utils/api';
import { CheckInModal } from './CheckInModal';

/**
 * Scoring v2 score for one Cube: band and number, what it is based on, the
 * effect (never the content) of private assessments, the three pillars, the
 * skill profile with the Cube's own self-rating, and the growth line.
 */
interface ScoreV2Response {
  live: boolean;
  overall: number | null;
  band: string | null;
  provisional: boolean;
  private_effect: number | null;
  pillars: {
    mentor: number | null;
    delivery: number | null;
    delivery_parts: { rhythm: number | null; delivery: number | null; attendance: number | null; learning: number | null };
    peer_delta: number;
  };
  criteria: { key: string; name: string; core: boolean; level: number; evidence: number; self: number | null }[];
  self_assessed_at: string | null;
  basis: {
    scorecards: number;
    checkins: number;
    legacy: number;
    missions: number;
    private_assessments: number;
    active_weeks: number;
    last_assessed_at: string | null;
    stale: boolean;
  };
  growth: { weekly: { week_start: string; overall: number | null }[]; last_12_weeks: number | null; since_start: number | null };
}

const BAND_STYLE: Record<string, string> = {
  Developing: 'bg-amber-50 text-amber-700 border-amber-200',
  Solid: 'bg-sky-50 text-sky-700 border-sky-200',
  Strong: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Exceptional: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200',
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const signed = (n: number) => `${n > 0 ? '+' : ''}${n}`;

export const ScoreV2Card: React.FC<{
  cubeProfileId: string;
  cubeName: string;
  disciplineId: string | null;
  viewer: 'staff' | 'owner';
  /** Open the check-in form on load (from the mentor's My Cubes panel). */
  openCheckIn?: boolean;
}> = ({ cubeProfileId, cubeName, disciplineId, viewer, openCheckIn }) => {
  const [score, setScore] = useState<ScoreV2Response | null>(null);
  const [failed, setFailed] = useState(false);
  const [modal, setModal] = useState<'checkin' | 'self' | null>(openCheckIn && viewer === 'staff' ? 'checkin' : null);

  const load = useCallback(() => {
    api
      .get<ScoreV2Response>(`/cubes/${cubeProfileId}/score-v2`)
      .then(res => {
        setScore(res);
        setFailed(false);
      })
      .catch(() => setFailed(true));
  }, [cubeProfileId]);
  useEffect(load, [load]);

  if (failed || !score) return null;

  const b = score.basis;
  const basisParts = [
    plural(b.scorecards, 'scorecard'),
    b.checkins ? plural(b.checkins, 'check-in') : null,
    plural(b.missions, 'mission'),
    b.active_weeks ? plural(b.active_weeks, 'active week') : null,
    b.legacy ? `${b.legacy} legacy` : null,
  ].filter(Boolean);
  const weekly = score.growth.weekly.filter(w => w.overall !== null) as { week_start: string; overall: number }[];

  return (
    <section className="flex flex-col gap-5 rounded-3xl border border-gray-100 bg-white p-6 shadow-subtle">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h3 className="flex items-center gap-2 text-base font-extrabold text-gray-900">
          <Gauge className="h-5 w-5 text-magenta" /> {viewer === 'owner' ? 'Your score' : 'Score (v2)'}
          {viewer === 'staff' && !score.live && (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-black uppercase text-gray-500" title="Cubes do not see this yet">
              Shadow
            </span>
          )}
        </h3>
        <div className="flex gap-2">
          {viewer === 'staff' && (
            <button
              type="button"
              onClick={() => setModal('checkin')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-extrabold text-gray-700 hover:border-gray-300"
            >
              <ClipboardCheck className="h-3.5 w-3.5" /> Check in
            </button>
          )}
          {viewer === 'owner' && (
            <button
              type="button"
              onClick={() => setModal('self')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-extrabold text-gray-700 hover:border-gray-300"
            >
              <UserCheck className="h-3.5 w-3.5" /> Rate yourself
            </button>
          )}
        </div>
      </div>

      {score.overall === null ? (
        <p className="rounded-2xl border border-dashed border-gray-200 p-5 text-center text-sm font-semibold text-gray-400">
          No score yet. It starts with the first scorecard.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-4">
            <p className="text-4xl font-black leading-none text-gray-900">{score.overall}</p>
            {score.band && (
              <span className={`rounded-full border px-3 py-1 text-xs font-extrabold ${BAND_STYLE[score.band] || ''}`}>{score.band}</span>
            )}
            {score.provisional && (
              <span className="rounded-full border border-gray-200 px-3 py-1 text-xs font-bold text-gray-500" title="Fewer than two scorecards so far">
                Provisional
              </span>
            )}
            {score.growth.last_12_weeks !== null && (
              <span className={`text-xs font-extrabold ${score.growth.last_12_weeks >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {signed(score.growth.last_12_weeks)} in 12 weeks
              </span>
            )}
          </div>

          <div className="flex flex-col gap-1 text-xs font-medium text-gray-500">
            <p>
              Based on {basisParts.join(', ')}.
              {b.last_assessed_at && ` Last assessed ${new Date(b.last_assessed_at).toLocaleDateString()}${b.stale ? ' (over 10 weeks ago)' : ''}.`}
            </p>
            {score.private_effect !== null && (
              <p>
                Private assessments: <b className="text-gray-800">{signed(score.private_effect)} points</b> ({plural(b.private_assessments, 'assessment')}).
                {viewer === 'owner' && ' Your mentor can talk you through them in your 1:1.'}
              </p>
            )}
          </div>

          <dl className="grid grid-cols-3 gap-3 text-center">
            <Pillar label="Mentor" value={score.pillars.mentor} hint="Scorecards and private assessments" />
            <Pillar label="Delivery" value={score.pillars.delivery} hint="Updates, demos, attendance, quizzes" />
            <Pillar label="Peers" value={score.pillars.peer_delta} signedValue hint="Teammates' recognition, at most ±15%" />
          </dl>

          {weekly.length >= 2 && <GrowthLine points={weekly} />}
        </>
      )}

      {score.criteria.length > 0 && (
        <div className="flex flex-col gap-2">
          <h4 className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-gray-400">
            Skill profile{score.self_assessed_at ? ' · ◆ self-rating' : ''}
          </h4>
          {score.criteria.map(c => (
            <div key={c.key} className="grid grid-cols-[minmax(0,10rem)_1fr_2.5rem] items-center gap-3 text-xs">
              <span className="truncate font-bold text-gray-700" title={`${c.name}${c.core ? ' (core)' : ''} · ${plural(c.evidence, 'rating')}`}>
                {c.name}
              </span>
              <span className="relative h-2 rounded-full bg-gray-100">
                <span className="absolute inset-y-0 left-0 rounded-full bg-magenta" style={{ width: `${(c.level / 5) * 100}%` }} />
                {c.self !== null && (
                  <span
                    className="absolute -top-1 h-4 w-1.5 -translate-x-1/2 rounded-sm bg-gray-900"
                    style={{ left: `${(c.self / 5) * 100}%` }}
                    title={`Self-rating: ${c.self}`}
                  />
                )}
              </span>
              <span className="text-right font-extrabold text-gray-900">{c.level}</span>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <CheckInModal
          kind={modal}
          cubeProfileId={cubeProfileId}
          cubeName={cubeName}
          disciplineId={disciplineId}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            load();
          }}
        />
      )}
    </section>
  );
};

const Pillar: React.FC<{ label: string; value: number | null; hint: string; signedValue?: boolean }> = ({ label, value, hint, signedValue }) => (
  <div className="rounded-2xl bg-gray-50 px-3 py-3" title={hint}>
    <dd className="text-xl font-black text-gray-900">{value === null ? '—' : signedValue ? signed(value) : value}</dd>
    <dt className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">{label}</dt>
  </div>
);

const GrowthLine: React.FC<{ points: { week_start: string; overall: number }[] }> = ({ points }) => {
  const w = 300;
  const h = 60;
  const min = Math.min(...points.map(p => p.overall), 40);
  const max = Math.max(...points.map(p => p.overall), 90);
  const xy = points.map((p, i) => [(i / (points.length - 1)) * w, h - ((p.overall - min) / (max - min || 1)) * h]);
  return (
    <figure className="flex flex-col gap-1">
      <svg viewBox={`0 0 ${w} ${h}`} className="h-16 w-full overflow-visible" role="img" aria-label="Weekly score">
        <polyline points={xy.map(([x, y]) => `${x},${y}`).join(' ')} fill="none" className="stroke-magenta" strokeWidth={2} strokeLinejoin="round" />
        {xy.length > 0 && <circle cx={xy[xy.length - 1][0]} cy={xy[xy.length - 1][1]} r={3} className="fill-magenta" />}
      </svg>
      <figcaption className="flex justify-between text-[10px] font-semibold text-gray-400">
        <span>{new Date(points[0].week_start).toLocaleDateString()}</span>
        <span>Weekly score</span>
        <span>{new Date(points[points.length - 1].week_start).toLocaleDateString()}</span>
      </figcaption>
    </figure>
  );
};
