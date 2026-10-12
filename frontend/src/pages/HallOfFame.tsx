import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Award,
  Crown,
  Info,
  Mountain,
  Search,
  ShieldCheck,
  Sparkles,
  Undo2,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UserAvatar } from '../components/UserAvatar';
import { ProgressionRadar } from '../components/halloffame/ProgressionRadar';
import {
  HALL_STAGES,
  STAGE_META,
  hallApi,
  type HallData,
  type HallPerson,
  type HallStage
} from '../utils/hallOfFame';

const formatSince = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : null;

export const HallOfFame: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const isStaff = user?.role === 'ADMIN' || user?.role === 'MENTOR';

  const [data, setData] = useState<HallData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [confirm, setConfirm] = useState<{ ids: string[]; all: boolean; names: string[] } | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [candidateQuery, setCandidateQuery] = useState('');

  const load = useCallback(async () => {
    try {
      setData(await hallApi.get());
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Could not load the Hall of Fame.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (fn: () => Promise<unknown>, success: string) => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await fn();
      setMessage(success);
      setSelected([]);
      setConfirm(null);
      await load();
    } catch (err: any) {
      setError(err.message || 'Something went wrong.');
      setConfirm(null);
    } finally {
      setBusy(false);
    }
  };

  const manageable = useMemo(() => {
    if (!data) return [];
    const q = candidateQuery.trim().toLowerCase();
    return [...data.stages.candidate.map(p => ({ ...p, candidate: true })), ...data.stages.cube.map(p => ({ ...p, candidate: false }))]
      .filter(p => !q || p.name.toLowerCase().includes(q) || p.cube_number.includes(q))
      .slice(0, 40);
  }, [data, candidateQuery]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-magenta border-t-transparent" />
      </div>
    );
  }

  if (!data) {
    return (
      <p className="flex items-center gap-2 rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-600">
        <Info className="h-4 w-4" /> {error || 'Could not load the Hall of Fame.'}
      </p>
    );
  }

  const total = HALL_STAGES.reduce((sum, s) => sum + data.counts[s], 0);
  const icebergers = data.stages.iceberger;
  const mentors = data.stages.mentor;

  return (
    <div className="flex flex-col gap-10">
      {/* Hero */}
      <header className="peer-aurora relative overflow-hidden rounded-3xl p-8 text-white sm:p-10">
        <div className="relative max-w-2xl">
          <p className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.2em] text-white/60">
            <Mountain className="h-3.5 w-3.5" /> Hall of Fame
          </p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">The path to the summit</h1>
          <p className="mt-3 text-sm leading-relaxed text-white/75">
            Every Cube, Senior Cube, Iceberger and Mentor, on one map. Move inward and you climb: Cube, Senior Cube
            candidate, Senior Cube, Iceberger, and at the core, the Icebergers who came back to mentor the next
            generation.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {HALL_STAGES.map(s => (
              <span key={s} className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-extrabold backdrop-blur">
                <span className={`h-2 w-2 rounded-full ${STAGE_META[s].dot}`} />
                {data.counts[s]} {data.counts[s] === 1 ? STAGE_META[s].label : STAGE_META[s].plural}
              </span>
            ))}
          </div>
        </div>
      </header>

      {message && <p className="rounded-xl bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-700">{message}</p>}
      {error && (
        <p className="flex items-center gap-2 rounded-xl bg-rose-50 px-4 py-3 text-xs font-bold text-rose-700">
          <Info className="h-4 w-4" /> {error}
        </p>
      )}

      {/* The radar */}
      <section className="overflow-hidden rounded-3xl bg-[#0a0a10] p-4 shadow-premium sm:p-8">
        {total === 0 ? (
          <p className="py-16 text-center text-sm font-semibold text-white/50">Nobody is on the map yet.</p>
        ) : (
          <ProgressionRadar data={data} />
        )}

        <div className="mx-auto mt-6 grid max-w-4xl grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {HALL_STAGES.map(s => (
            <div key={s} className="rounded-2xl bg-white/5 p-3.5 ring-1 ring-white/10">
              <p className="flex items-center gap-2 text-[11px] font-extrabold text-white">
                <span className={`h-2 w-2 rounded-full ${STAGE_META[s].dot}`} />
                {STAGE_META[s].label}
                <span className="ml-auto text-white/50">{data.counts[s]}</span>
              </p>
              <p className="mt-1.5 text-[11px] font-medium leading-relaxed text-white/50">{STAGE_META[s].blurb}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-center text-[11px] font-semibold text-white/35">
          Hover to pause. Within a ring nobody is ranked: everyone on it is at the same stage.
        </p>
      </section>

      {/* The summit */}
      <section className="flex flex-col gap-5">
        <h2 className="flex items-center gap-2 text-xl font-extrabold tracking-tight">
          <Crown className="h-5 w-5 text-amber-500" /> At the summit
        </h2>

        {icebergers.length === 0 && mentors.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-gray-200 bg-white p-10 text-center">
            <Mountain className="mx-auto h-8 w-8 text-gray-300" />
            <p className="mt-3 text-sm font-extrabold text-gray-700">The summit is still empty</p>
            <p className="mx-auto mt-1 max-w-sm text-xs font-medium text-gray-400">
              Nobody has reached Iceberger yet. Whoever is first will be the first name on this wall.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {mentors.map(p => (
              <SummitCard key={p.id} person={p} stage="mentor" isAdmin={isAdmin} busy={busy} onRevert={() => {
                if (window.confirm(`Return ${p.name} to the Cube role? Their history is untouched.`)) {
                  run(() => hallApi.revert(p.id), `${p.name} is back at the Iceberger level.`);
                }
              }} />
            ))}
            {icebergers.map(p => (
              <SummitCard key={p.id} person={p} stage="iceberger" isAdmin={isAdmin} busy={busy} />
            ))}
          </div>
        )}
      </section>

      {/* Closing in */}
      {(data.stages.candidate.length > 0 || data.stages.senior.length > 0) && (
        <section className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {(['candidate', 'senior'] as HallStage[]).map(stage => (
            <div key={stage} className="rounded-3xl border border-gray-100 bg-white p-6 shadow-subtle">
              <h3 className="flex items-center gap-2 text-base font-extrabold">
                <span className={`h-2.5 w-2.5 rounded-full ${STAGE_META[stage].dot}`} />
                {STAGE_META[stage].plural}
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-black text-gray-500">{data.counts[stage]}</span>
              </h3>
              <p className="mt-1 text-xs font-medium text-gray-400">{STAGE_META[stage].blurb}</p>
              <ul className="mt-4 flex flex-wrap gap-2">
                {data.stages[stage].length === 0 && <li className="text-xs font-semibold text-gray-300">Nobody here yet.</li>}
                {data.stages[stage].map(p => (
                  <li key={p.id}>
                    <Link
                      to={`/cubes/${p.id}`}
                      className={`flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-xs font-extrabold transition hover:-translate-y-0.5 ${STAGE_META[stage].chip}`}
                    >
                      <UserAvatar name={p.name} avatarUrl={p.avatar_url} size="xs" />
                      {p.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      {/* Staff: candidates */}
      {isStaff && (
        <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-subtle">
          <h3 className="flex items-center gap-2 text-base font-extrabold">
            <Sparkles className="h-4 w-4 text-sky-500" /> Senior Cube candidates
          </h3>
          <p className="mt-1 max-w-2xl text-xs font-medium leading-relaxed text-gray-500">
            Marking someone puts them on the candidate ring for everyone to see, so only do it when you mean it.
            It is a deliberate decision, not computed from scorecards. It clears automatically when they become a
            Senior Cube.
          </p>
          <div className="relative mt-4 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={candidateQuery}
              onChange={e => setCandidateQuery(e.target.value)}
              placeholder="Search Cubes"
              className="w-full rounded-xl border border-gray-150 bg-gray-50 py-2.5 pl-9 pr-3 text-sm font-semibold outline-none focus:border-magenta focus:bg-white"
            />
          </div>
          <ul className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
            {manageable.map(p => (
              <li key={p.id} className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 px-3 py-2">
                <span className="flex min-w-0 items-center gap-2.5">
                  <UserAvatar name={p.name} avatarUrl={p.avatar_url} size="sm" />
                  <span className="truncate text-xs font-extrabold text-gray-800">{p.name}</span>
                </span>
                <button
                  disabled={busy}
                  onClick={() =>
                    run(
                      () => hallApi.setCandidate(p.id, !p.candidate),
                      p.candidate ? `${p.name} is no longer a candidate.` : `${p.name} is now a Senior Cube candidate.`
                    )
                  }
                  className={`shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-extrabold transition ${
                    p.candidate
                      ? 'bg-sky-50 text-sky-700 ring-1 ring-sky-200 hover:bg-sky-100'
                      : 'bg-gray-100 text-gray-600 hover:bg-sky-50 hover:text-sky-700'
                  }`}
                >
                  {p.candidate ? 'Candidate ✓' : 'Mark candidate'}
                </button>
              </li>
            ))}
            {manageable.length === 0 && <li className="text-xs font-semibold text-gray-400">No Cubes match.</li>}
          </ul>
        </section>
      )}

      {/* Admin: promote */}
      {isAdmin && (
        <section className="rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-6 shadow-subtle">
          <h3 className="flex items-center gap-2 text-base font-extrabold text-amber-900">
            <ShieldCheck className="h-4 w-4" /> Promote Icebergers to Mentors
          </h3>
          <p className="mt-1 max-w-2xl text-xs font-medium leading-relaxed text-amber-900/70">
            This changes their role from Cube to Mentor. They leave the Cube directory and the Cube-only features
            and gain the mentor workspace (every Cube, scorecards, private notes). Their profile, badges, quests and
            history are kept, and you can reverse it from the summit above.
          </p>

          {icebergers.length === 0 ? (
            <p className="mt-4 text-xs font-bold text-amber-800/60">Nobody at the Iceberger level is waiting for promotion.</p>
          ) : (
            <>
              <ul className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                {icebergers.map(p => {
                  const checked = selected.includes(p.id);
                  return (
                    <li key={p.id}>
                      <label className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition ${checked ? 'border-amber-400 bg-white shadow-sm' : 'border-amber-100 bg-white/70 hover:border-amber-300'}`}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => setSelected(s => (checked ? s.filter(x => x !== p.id) : [...s, p.id]))}
                          className="h-4 w-4 rounded border-amber-300 text-magenta focus:ring-magenta"
                        />
                        <UserAvatar name={p.name} avatarUrl={p.avatar_url} size="sm" />
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-extrabold text-gray-900">{p.name}</span>
                          <span className="block text-[10px] font-bold text-gray-400">
                            #{p.cube_number}
                            {formatSince(p.since) ? ` · Iceberger since ${formatSince(p.since)}` : ''}
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  disabled={busy || selected.length === 0}
                  onClick={() =>
                    setConfirm({
                      ids: selected,
                      all: false,
                      names: icebergers.filter(p => selected.includes(p.id)).map(p => p.name)
                    })
                  }
                  className="rounded-xl bg-gray-900 px-4 py-2.5 text-xs font-extrabold text-white transition hover:bg-black disabled:opacity-40"
                >
                  Promote selected ({selected.length})
                </button>
                <button
                  disabled={busy}
                  onClick={() => setConfirm({ ids: [], all: true, names: icebergers.map(p => p.name) })}
                  className="rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 px-4 py-2.5 text-xs font-extrabold text-amber-950 shadow-sm transition hover:-translate-y-0.5 disabled:opacity-40"
                >
                  Promote all {icebergers.length}
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {/* Confirm */}
      {confirm && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-fadeIn"
          onMouseDown={e => e.target === e.currentTarget && setConfirm(null)}
        >
          <div className="relative w-full max-w-md rounded-3xl bg-white p-7 shadow-premium">
            <button onClick={() => setConfirm(null)} className="absolute right-4 top-4 rounded-full p-2 text-gray-400 hover:bg-gray-100">
              <X className="h-4 w-4" />
            </button>
            <h3 className="text-xl font-extrabold text-gray-900">
              Promote {confirm.names.length} {confirm.names.length === 1 ? 'person' : 'people'} to Mentor?
            </h3>
            <ul className="mt-3 max-h-40 overflow-y-auto rounded-xl bg-gray-50 p-3 text-xs font-bold text-gray-700">
              {confirm.names.map(n => <li key={n}>{n}</li>)}
            </ul>
            <p className="mt-4 text-xs font-medium leading-relaxed text-gray-500">
              They will stop appearing as Cubes and gain mentor access. They need to sign out and back in. Nothing is
              deleted and you can undo each promotion from the summit.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => setConfirm(null)} className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
              <button
                disabled={busy}
                onClick={() =>
                  run(
                    () => hallApi.promote(confirm.all ? { all: true } : { profileIds: confirm.ids }),
                    `${confirm.names.length} promoted to Mentor.`
                  )
                }
                className="rounded-xl bg-magenta px-5 py-2 text-xs font-extrabold text-white transition hover:bg-magenta-hover disabled:opacity-60"
              >
                {busy ? 'Promoting…' : 'Promote'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const SummitCard: React.FC<{
  person: HallPerson;
  stage: 'iceberger' | 'mentor';
  isAdmin: boolean;
  busy: boolean;
  onRevert?: () => void;
}> = ({ person, stage, isAdmin, busy, onRevert }) => {
  const mentor = stage === 'mentor';
  const since = formatSince(person.since);
  return (
    <article
      className={`relative overflow-hidden rounded-3xl p-5 transition hover:-translate-y-1 ${
        mentor
          ? 'bg-gradient-to-br from-[#2a1c05] via-[#150e03] to-[#0b0802] text-white shadow-[0_18px_50px_-18px_rgba(245,158,11,0.7)] ring-1 ring-amber-300/50'
          : 'bg-gradient-to-br from-[#06222a] via-[#07141c] to-[#05090e] text-white shadow-premium ring-1 ring-cyan-300/30'
      }`}
    >
      <div className={`pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full blur-3xl ${mentor ? 'bg-amber-400/25' : 'bg-cyan-300/20'}`} />
      <Link to={`/cubes/${person.id}`} className="relative flex items-center gap-4">
        <span className={`rounded-full p-0.5 ${mentor ? 'bg-gradient-to-br from-amber-200 to-amber-500' : 'bg-gradient-to-br from-cyan-200 to-sky-500'}`}>
          <span className="block rounded-full bg-black p-0.5">
            <UserAvatar name={person.name} avatarUrl={person.avatar_url} size="lg" />
          </span>
        </span>
        <span className="min-w-0">
          <span className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.18em] ${mentor ? 'text-amber-300' : 'text-cyan-300'}`}>
            {mentor ? <Crown className="h-3 w-3" /> : <Award className="h-3 w-3" />}
            {mentor ? 'Now a Mentor' : 'Iceberger'}
          </span>
          <span className="mt-1 block truncate text-base font-extrabold">{person.name}</span>
          <span className="block text-[11px] font-semibold text-white/50">
            #{person.cube_number}
            {since ? ` · since ${since}` : ''}
          </span>
        </span>
      </Link>
      {mentor && isAdmin && onRevert && (
        <button
          disabled={busy}
          onClick={onRevert}
          className="relative mt-4 flex items-center gap-1.5 text-[11px] font-bold text-white/40 transition hover:text-white/80"
        >
          <Undo2 className="h-3 w-3" /> Undo promotion
        </button>
      )}
    </article>
  );
};
