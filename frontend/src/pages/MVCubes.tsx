import React, { useCallback, useEffect, useState } from 'react';
import { Crown, Info, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { peerApi } from '../utils/peer';
import { MVCubesCard } from '../components/peer/MVCubesShelf';

const currentPeriod = () => {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};

export const MVCubes: React.FC = () => {
  const { user } = useAuth();
  const [period, setPeriod] = useState(currentPeriod());
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (p: string) => {
    setLoading(true);
    try {
      setData(await peerApi.mvcubes(p));
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Could not load MVCubes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(period);
  }, [period, load]);

  const compute = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await peerApi.computeMvcubes(period);
      setMessage(res.created > 0 ? `${res.created} award(s) announced.` : 'Nothing new to announce for this month.');
      await load(period);
    } catch (err: any) {
      setError(err.message || 'Could not compute MVCubes.');
    } finally {
      setBusy(false);
    }
  };

  // Month options: every month with awards, plus the current one.
  const options: { period: string; label: string }[] = [
    ...(data?.periods || [])
  ];
  if (!options.some(o => o.period === currentPeriod())) {
    options.unshift({ period: currentPeriod(), label: 'This month' });
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="peer-aurora relative overflow-hidden rounded-3xl p-8 text-white sm:p-10">
        <div className="relative max-w-2xl">
          <p className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.2em] text-white/60">
            <Crown className="h-3.5 w-3.5" /> MVCubes
          </p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">Most Valued Cubes</h1>
          <p className="mt-3 text-sm leading-relaxed text-white/75">
            Chosen by the people who work alongside them. There is no leaderboard and no bottom: every month a
            handful of Cubes are recognised for something specific, and anyone can win, including those who
            are new or quiet.
          </p>
        </div>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-slate-500">
          Month
          <select
            value={period}
            onChange={e => setPeriod(e.target.value)}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold normal-case tracking-normal text-slate-800 outline-none focus:border-magenta"
          >
            {options.map(o => (
              <option key={o.period} value={o.period}>{o.label}</option>
            ))}
          </select>
        </label>

        {user?.role === 'ADMIN' && (
          <button
            onClick={compute}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-extrabold text-white transition hover:bg-slate-700 disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`} />
            Announce {period}
          </button>
        )}
      </div>

      {message && <p className="rounded-xl bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-700">{message}</p>}
      {error && (
        <p className="flex items-center gap-2 rounded-xl bg-rose-50 px-4 py-3 text-xs font-bold text-rose-700">
          <Info className="h-4 w-4" /> {error}
        </p>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map(i => <div key={i} className="h-72 animate-pulse rounded-3xl border border-gray-100 bg-white" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {data?.categories.map((c: any) => <MVCubesCard key={c.category} category={c} large />)}
        </div>
      )}

      <p className="flex items-start gap-2 text-xs font-medium leading-relaxed text-slate-400">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Awards are based on how many different teammates recognised someone that month, not on a score. A
        category needs recognition from at least three people before anyone can win it.
      </p>
    </div>
  );
};
