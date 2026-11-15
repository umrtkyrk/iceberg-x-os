import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../utils/api';
import { PageHeader } from '../components/PageHeader';

/**
 * Scoring v2 shadow mode: every Cube's legacy score next to the v2 score,
 * biggest moves first, and the mentor calibration view. Admins only.
 */
interface ShadowRow {
  cube_profile_id: string;
  name: string;
  cube_number: string;
  discipline: string | null;
  legacy: number | null;
  v2: number | null;
  delta: number | null;
  band: string | null;
  provisional: boolean;
  private_effect: number | null;
  basis: { scorecards: number; checkins: number; legacy: number; missions: number; stale: boolean };
  trend: (number | null)[];
}
interface Calibration {
  programme_mean: number | null;
  mentors: { mentor_id: string; name: string; assessments: number; ratings: number; mean: number; offset: number | null; distribution: number[] }[];
}

const MOVED = 10;

export const AdminScoring: React.FC = () => {
  const [tab, setTab] = useState<'shadow' | 'calibration'>('shadow');
  const [shadow, setShadow] = useState<{ formula_version: string; last_backfill_at: string | null; rows: ShadowRow[] } | null>(null);
  const [calibration, setCalibration] = useState<Calibration | null>(null);
  const [onlyMoved, setOnlyMoved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const path = tab === 'shadow' ? '/admin/scoring/shadow' : '/admin/scoring/calibration';
    api
      .get(path)
      .then(res => (tab === 'shadow' ? setShadow(res) : setCalibration(res)))
      .catch((err: any) => setError(err.message || 'Could not load.'));
  }, [tab]);

  const rows = (shadow?.rows || []).filter(r => !onlyMoved || Math.abs(r.delta ?? 0) > MOVED);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Scoring v2 · shadow mode"
        title="Scoring"
        description="The v2 score next to today's score for every Cube in the programme. Cubes do not see v2 until it goes live. Review large moves with the mentors before switching."
      >
        <Link to="/admin/rubrics" className="workspace-secondary-action">Rubrics</Link>
      </PageHeader>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" className="flex gap-2">
          {(['shadow', 'calibration'] as const).map(t => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`rounded-full px-4 py-2 text-xs font-extrabold ${tab === t ? 'bg-gray-900 text-white' : 'border border-gray-200 bg-white text-gray-600'}`}
            >
              {t === 'shadow' ? 'Legacy vs v2' : 'Mentor calibration'}
            </button>
          ))}
        </div>
        {tab === 'shadow' && shadow && (
          <p className="text-[11px] font-semibold text-gray-400">
            Formula {shadow.formula_version} · history {shadow.last_backfill_at ? `rebuilt ${new Date(shadow.last_backfill_at).toLocaleString()}` : 'not built yet'}
          </p>
        )}
      </div>

      {error && <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}

      {tab === 'shadow' ? (
        !shadow ? (
          <div className="h-48 animate-pulse rounded-3xl border border-gray-100 bg-white" />
        ) : (
          <section className="rounded-3xl border border-gray-100 bg-white shadow-subtle">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-50 p-4 text-xs font-semibold text-gray-500">
              <span>
                {shadow.rows.filter(r => Math.abs(r.delta ?? 0) > MOVED).length} of {shadow.rows.length} Cubes move by more than {MOVED} points
              </span>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={onlyMoved} onChange={e => setOnlyMoved(e.target.checked)} /> Only those
              </label>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="uppercase">
                    <th>Cube</th>
                    <th>Legacy</th>
                    <th>v2</th>
                    <th>Change</th>
                    <th>Band</th>
                    <th>Based on</th>
                    <th>Private</th>
                    <th>Trend</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {rows.map(r => (
                    <tr key={r.cube_profile_id} className={Math.abs(r.delta ?? 0) > MOVED ? 'bg-amber-50/50' : ''}>
                      <td>
                        <Link to={`/cubes/${r.cube_profile_id}`} className="font-extrabold text-gray-900 hover:text-magenta">{r.name}</Link>
                        <p className="text-[11px] font-semibold text-gray-400">#{r.cube_number} · {r.discipline || 'No discipline'}</p>
                      </td>
                      <td className="font-bold text-gray-600">{r.legacy ?? '—'}</td>
                      <td className="font-extrabold text-gray-900">{r.v2 ?? '—'}</td>
                      <td className={`font-extrabold ${r.delta === null ? 'text-gray-400' : r.delta >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {r.delta === null ? '—' : `${r.delta > 0 ? '+' : ''}${r.delta}`}
                      </td>
                      <td>
                        {r.band ?? '—'}
                        {r.provisional && r.band && <span className="ml-1 text-gray-400">(prov.)</span>}
                      </td>
                      <td className="text-gray-500">
                        {r.basis.scorecards} sc{r.basis.checkins ? ` · ${r.basis.checkins} ci` : ''} · {r.basis.missions} m{r.basis.legacy ? ` · ${r.basis.legacy} legacy` : ''}
                        {r.basis.stale && <span className="ml-1 font-bold text-amber-600">stale</span>}
                      </td>
                      <td className="text-gray-600">{r.private_effect === null ? '—' : `${r.private_effect > 0 ? '+' : ''}${r.private_effect}`}</td>
                      <td><Sparkline values={r.trend} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )
      ) : !calibration ? (
        <div className="h-48 animate-pulse rounded-3xl border border-gray-100 bg-white" />
      ) : (
        <section className="rounded-3xl border border-gray-100 bg-white shadow-subtle">
          <p className="border-b border-gray-50 p-4 text-xs font-semibold text-gray-500">
            Programme mean rating: <b className="text-gray-900">{calibration.programme_mean ?? '—'}</b> / 5. A large offset is a reason for a calibration chat, not an automatic correction.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="uppercase">
                  <th>Mentor</th>
                  <th>Assessments</th>
                  <th>Mean</th>
                  <th>Offset</th>
                  <th>1 · 2 · 3 · 4 · 5</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {calibration.mentors.map(m => (
                  <tr key={m.mentor_id}>
                    <td className="font-extrabold text-gray-900">{m.name}</td>
                    <td className="text-gray-600">{m.assessments} ({m.ratings} ratings)</td>
                    <td className="font-bold text-gray-900">{m.mean}</td>
                    <td className={`font-extrabold ${Math.abs(m.offset ?? 0) >= 0.5 ? 'text-amber-600' : 'text-gray-500'}`}>
                      {m.offset === null ? '—' : `${m.offset > 0 ? '+' : ''}${m.offset}`}
                    </td>
                    <td><Distribution counts={m.distribution} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
};

const Sparkline: React.FC<{ values: (number | null)[] }> = ({ values }) => {
  const pts = values.map((v, i) => [i, v] as const).filter((p): p is readonly [number, number] => p[1] !== null);
  if (pts.length < 2) return <span className="text-gray-300">—</span>;
  const w = 80;
  const h = 20;
  const min = Math.min(...pts.map(p => p[1]));
  const max = Math.max(...pts.map(p => p[1]));
  const last = values.length - 1 || 1;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-5 w-20" aria-hidden="true">
      <polyline
        points={pts.map(([i, v]) => `${(i / last) * w},${h - ((v - min) / (max - min || 1)) * h}`).join(' ')}
        fill="none"
        className="stroke-magenta"
        strokeWidth={1.5}
      />
    </svg>
  );
};

const Distribution: React.FC<{ counts: number[] }> = ({ counts }) => {
  const max = Math.max(...counts, 1);
  return (
    <div className="flex h-6 items-end gap-1" aria-label={`Ratings 1 to 5: ${counts.join(', ')}`}>
      {counts.map((c, i) => (
        <span key={i} className="w-3 rounded-sm bg-magenta/70" style={{ height: `${Math.max(2, (c / max) * 24)}px` }} title={`${i + 1}: ${c}`} />
      ))}
    </div>
  );
};
