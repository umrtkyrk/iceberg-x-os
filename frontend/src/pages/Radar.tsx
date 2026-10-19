import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Radar as RadarIcon,
  Gem,
  AlertTriangle,
  ShieldCheck,
  Clock,
  MessageSquare,
  CheckCircle2,
  Users,
  Lock,
  Info,
  MessageSquareQuote,
  ArrowRight,
  X
} from 'lucide-react';
import { UserAvatar } from '../components/UserAvatar';
import { peerApi, tagStyle } from '../utils/peer';
import { FeedbackFeed } from '../components/peer/StaffFeedback';

type Tab = 'gems' | 'attention' | 'feedback';

const CATEGORY_TINT: Record<string, string> = {
  Contribution: 'bg-amber-50 text-amber-700 border-amber-200',
  Reliability: 'bg-rose-50 text-rose-700 border-rose-200',
  Communication: 'bg-sky-50 text-sky-700 border-sky-200',
  Collaboration: 'bg-violet-50 text-violet-700 border-violet-200'
};

export const Radar: React.FC = () => {
  const [tab, setTab] = useState<Tab>('gems');
  const [gems, setGems] = useState<any>(null);
  const [attention, setAttention] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolving, setResolving] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [g, a] = await Promise.all([peerApi.hiddenGems(), peerApi.needsAttention()]);
      setGems(g);
      setAttention(a);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Could not load Radar.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const move = async (id: string, state: string, outcome?: string) => {
    setBusy(true);
    try {
      await peerApi.setSignalState(id, { state, outcome });
      setResolving(null);
      await load();
    } catch (err: any) {
      setError(err.message || 'Could not update the signal.');
    } finally {
      setBusy(false);
    }
  };

  const attentionCount = (attention?.signals?.length || 0) + (attention?.emerging?.length || 0);

  return (
    <div className="flex flex-col gap-8">
      {/* Hero */}
      <header className="peer-aurora relative overflow-hidden rounded-3xl p-8 sm:p-10 text-white">
        <div className="pointer-events-none absolute -right-10 -top-10 hidden h-64 w-64 sm:block">
          <div className="absolute inset-0 rounded-full border border-white/15" />
          <div className="absolute inset-8 rounded-full border border-white/15" />
          <div className="absolute inset-16 rounded-full border border-white/15" />
          <div className="peer-radar-sweep" />
        </div>

        <div className="relative max-w-2xl">
          <p className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.2em] text-white/60">
            <RadarIcon className="h-3.5 w-3.5" /> Radar
          </p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">See who the programme sees.</h1>
          <p className="mt-3 text-sm leading-relaxed text-white/75">
            Peer signals surface Cubes who are valued by their teammates but rarely seen by mentors, and
            patterns worth a supportive conversation. You can read what was written, in the Feedback tab and on
            each Cube's profile, but never who wrote it.
          </p>
          <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-bold text-white/80 backdrop-blur">
            <Lock className="h-3.5 w-3.5" /> You can read it. The writer stays anonymous, even to admins
          </p>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex gap-2 rounded-2xl bg-white p-1.5 shadow-subtle ring-1 ring-gray-100 self-start">
        <TabButton active={tab === 'gems'} onClick={() => setTab('gems')} icon={Gem}>
          Hidden Gems
          {gems && <Count n={gems.gems.length} />}
        </TabButton>
        <TabButton active={tab === 'attention'} onClick={() => setTab('attention')} icon={AlertTriangle}>
          Needs Attention
          {attention && <Count n={attentionCount} warn />}
        </TabButton>
        <TabButton active={tab === 'feedback'} onClick={() => setTab('feedback')} icon={MessageSquareQuote}>
          Feedback
        </TabButton>
      </div>

      {error && (
        <p className="flex items-center gap-2 rounded-xl bg-rose-50 px-4 py-3 text-xs font-bold text-rose-700">
          <Info className="h-4 w-4" /> {error}
        </p>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="h-56 animate-pulse rounded-3xl border border-gray-100 bg-white" />
          ))}
        </div>
      ) : tab === 'feedback' ? (
        <FeedbackFeed />
      ) : tab === 'gems' ? (
        <section className="flex flex-col gap-5">
          <p className="max-w-3xl text-xs font-semibold leading-relaxed text-slate-500">
            Strong recognition from teammates, with few mentor scorecards, notes or missions on record. A
            conversation with these Cubes is the cheapest way to avoid missing someone good.
          </p>
          {gems?.gems.length === 0 ? (
            <Empty
              icon={Gem}
              title="No hidden gems yet"
              body={`Cubes appear here once at least three teammates have recognised them and mentors have seen little of their work. Cohort size: ${gems?.cohort_size ?? 0}.`}
            />
          ) : (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              {gems.gems.map((g: any) => (
                <GemCard key={g.cube.id} gem={g} />
              ))}
            </div>
          )}
        </section>
      ) : (
        <section className="flex flex-col gap-8">
          <div>
            <h2 className="mb-3 text-sm font-extrabold uppercase tracking-wider text-slate-700">
              Verified growth signals
            </h2>
            {attention.signals.length === 0 ? (
              <Empty
                icon={ShieldCheck}
                title="Nothing waiting"
                body="A signal appears only when several independent people raise the same area and the feedback has reached its weekly delivery."
              />
            ) : (
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                {attention.signals.map((s: any) => (
                  <SignalCard
                    key={s.signal.id}
                    item={s}
                    busy={busy}
                    onStart={() => move(s.signal.id, 'IN_CONVERSATION')}
                    onResolve={() => setResolving(s)}
                  />
                ))}
              </div>
            )}
          </div>

          <div>
            <h2 className="mb-1 text-sm font-extrabold uppercase tracking-wider text-slate-700">Emerging patterns</h2>
            <p className="mb-3 max-w-3xl text-xs font-semibold leading-relaxed text-slate-500">
              Two or more different people raised something about this Cube. Not yet a verified growth signal, but
              repeated enough to look at. Read the feedback on their profile or in the Feedback tab. Often a quiet
              teammate who needs a hand being seen, sometimes a real gap.
            </p>
            {attention.emerging.length === 0 ? (
              <Empty icon={Users} title="No emerging patterns" body="Nothing is building up right now." />
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {attention.emerging.map((e: any) => (
                  <EmergingCard key={e.cube.id} item={e} />
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Resolve dialog */}
      {resolving && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-fadeIn"
          onMouseDown={e => e.target === e.currentTarget && setResolving(null)}
        >
          <div className="relative w-full max-w-lg rounded-3xl bg-white p-7 shadow-premium">
            <button onClick={() => setResolving(null)} className="absolute right-4 top-4 rounded-full p-2 text-slate-400 hover:bg-slate-100">
              <X className="h-4 w-4" />
            </button>
            <h3 className="text-xl font-extrabold text-slate-900">Close this signal</h3>
            <p className="mt-1 text-sm text-slate-500">
              {resolving.cube.name} · {resolving.signal.category}
            </p>
            <p className="mt-4 text-sm leading-relaxed text-slate-600">
              After talking with them, was the area real? Your answer is how peer feedback stays fair.
            </p>
            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                disabled={busy}
                onClick={() => move(resolving.signal.id, 'RESOLVED', 'confirmed')}
                className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-left transition hover:border-emerald-400"
              >
                <p className="flex items-center gap-2 text-sm font-extrabold text-emerald-800">
                  <CheckCircle2 className="h-4 w-4" /> It was real
                </p>
                <p className="mt-1 text-xs leading-relaxed text-emerald-700/80">
                  The concern stands. The people who raised it become slightly more trusted.
                </p>
              </button>
              <button
                disabled={busy}
                onClick={() => move(resolving.signal.id, 'RESOLVED', 'unfounded')}
                className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-left transition hover:border-amber-400"
              >
                <p className="flex items-center gap-2 text-sm font-extrabold text-amber-800">
                  <X className="h-4 w-4" /> It was unfounded
                </p>
                <p className="mt-1 text-xs leading-relaxed text-amber-700/80">
                  The concerns are set aside and no longer count. Their authors' future feedback carries less weight.
                </p>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const TabButton: React.FC<{
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}> = ({ active, onClick, icon: Icon, children }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-extrabold transition ${
      active ? 'bg-slate-900 text-white shadow-subtle' : 'text-slate-500 hover:text-slate-900'
    }`}
  >
    <Icon className="h-4 w-4" />
    {children}
  </button>
);

const Count: React.FC<{ n: number; warn?: boolean }> = ({ n, warn }) => (
  <span
    className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
      n > 0 && warn ? 'bg-amber-400 text-slate-900' : 'bg-white/20 text-current ring-1 ring-current/20'
    }`}
  >
    {n}
  </span>
);

const Empty: React.FC<{ icon: React.ComponentType<{ className?: string }>; title: string; body: string }> = ({
  icon: Icon,
  title,
  body
}) => (
  <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-gray-200 bg-white p-10 text-center">
    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
      <Icon className="h-6 w-6" />
    </span>
    <p className="text-sm font-extrabold text-slate-800">{title}</p>
    <p className="max-w-md text-xs font-medium leading-relaxed text-slate-500">{body}</p>
  </div>
);

const Person: React.FC<{ cube: any }> = ({ cube }) => (
  <Link to={`/cubes/${cube.id}`} className="group flex min-w-0 items-center gap-3">
    <UserAvatar name={cube.name} avatarUrl={cube.avatar_url} size="card" />
    <div className="min-w-0">
      <p className="truncate text-sm font-extrabold text-slate-900 group-hover:text-magenta">{cube.name}</p>
      <p className="truncate text-[11px] font-bold text-slate-400">
        #{cube.cube_number} · {cube.cohort}
        {cube.mentor ? ` · Mentor: ${cube.mentor}` : ''}
      </p>
    </div>
  </Link>
);

const GemCard: React.FC<{ gem: any }> = ({ gem }) => {
  const v = gem.mentor_visibility;
  return (
    <article className="relative overflow-hidden rounded-3xl border border-gray-100 bg-white p-6 shadow-subtle transition hover:-translate-y-0.5 hover:shadow-premium">
      <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-gradient-to-br from-sky-300/30 via-cyan-200/20 to-transparent blur-2xl" />
      <div className="relative flex items-start justify-between gap-3">
        <Person cube={gem.cube} />
        <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-gradient-to-r from-sky-500 to-cyan-400 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-white">
          <Gem className="h-3 w-3" /> Hidden gem
        </span>
      </div>

      <p className="relative mt-5 text-sm font-semibold text-slate-700">
        Recognised by <b className="text-slate-900">{gem.distinct_givers}</b> teammates
      </p>

      <div className="relative mt-3 flex flex-wrap gap-2">
        {gem.top_tags.length === 0 && (
          <span className="text-xs font-semibold text-slate-400">No single theme stands out yet.</span>
        )}
        {gem.top_tags.map((t: any) => {
          const s = tagStyle(t.tag);
          const Icon = s.icon;
          return (
            <span key={t.tag} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-extrabold ${s.tint} ${s.text}`}>
              <Icon className="h-3 w-3" />
              {t.label}
              <span className="rounded-full bg-white/70 px-1.5 text-[10px]">{t.givers}</span>
            </span>
          );
        })}
      </div>

      <div className="relative mt-5 rounded-2xl bg-slate-50 p-4">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-400">What mentors have on record</p>
        <div className="mt-2 grid grid-cols-3 gap-3 text-center">
          <Stat label="Scorecards" value={v.scorecards} />
          <Stat label="Notes" value={v.notes} />
          <Stat label="Missions" value={v.missions} />
        </div>
      </div>
    </article>
  );
};

const Stat: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div>
    <p className={`text-xl font-black ${value === 0 ? 'text-rose-500' : 'text-slate-800'}`}>{value}</p>
    <p className="text-[10px] font-bold text-slate-400">{label}</p>
  </div>
);

const STEPS = ['OPEN', 'IN_CONVERSATION', 'RESOLVED'];

const SignalCard: React.FC<{ item: any; busy: boolean; onStart: () => void; onResolve: () => void }> = ({
  item,
  busy,
  onStart,
  onResolve
}) => {
  const { signal, cube } = item;
  const tint = CATEGORY_TINT[signal.category] || 'bg-slate-50 text-slate-700 border-slate-200';
  const step = STEPS.indexOf(signal.state);
  const due = new Date(signal.due_at);

  return (
    <article className={`relative overflow-hidden rounded-3xl border bg-white p-6 shadow-subtle ${signal.overdue ? 'border-rose-200' : 'border-gray-100'}`}>
      <div className="flex items-start justify-between gap-3">
        <Person cube={cube} />
        <span className={`shrink-0 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-wider ${tint}`}>
          {signal.category}
        </span>
      </div>

      {/* Stepper */}
      <div className="mt-5 flex items-center gap-2">
        {['Open', 'In conversation', 'Resolved'].map((label, i) => (
          <React.Fragment key={label}>
            <div className="flex items-center gap-2">
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-black ${
                  i <= step ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-400'
                }`}
              >
                {i + 1}
              </span>
              <span className={`text-[11px] font-extrabold ${i <= step ? 'text-slate-800' : 'text-slate-400'}`}>{label}</span>
            </div>
            {i < 2 && <span className={`h-px flex-1 ${i < step ? 'bg-slate-900' : 'bg-slate-200'}`} />}
          </React.Fragment>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs font-bold text-slate-500">
        <span className="flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5" /> {item.concern_givers} people
        </span>
        <span className={`flex items-center gap-1.5 ${signal.overdue ? 'text-rose-600' : ''}`}>
          <Clock className="h-3.5 w-3.5" />
          {signal.overdue ? 'Overdue since' : 'Reach out by'} {due.toLocaleDateString('en-GB')}
        </span>
        {item.reciprocal_flag && (
          <span className="flex items-center gap-1.5 text-amber-600" title="Some of the people involved also raised concerns against each other recently. Worth keeping in mind.">
            <AlertTriangle className="h-3.5 w-3.5" /> Mutual concerns noticed
          </span>
        )}
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {signal.state === 'OPEN' && (
          <button
            disabled={busy}
            onClick={onStart}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-extrabold text-white transition hover:bg-slate-700"
          >
            <MessageSquare className="h-3.5 w-3.5" /> I'm talking to them
          </button>
        )}
        {signal.state === 'IN_CONVERSATION' && (
          <button
            disabled={busy}
            onClick={onResolve}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-magenta to-pink-500 px-4 py-2 text-xs font-extrabold text-white shadow-premium transition hover:-translate-y-0.5"
          >
            <CheckCircle2 className="h-3.5 w-3.5" /> Close signal
          </button>
        )}
        {signal.state === 'OPEN' && (
          <button
            disabled={busy}
            onClick={onResolve}
            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-slate-500 hover:text-slate-900"
          >
            Close without a conversation <ArrowRight className="h-3 w-3" />
          </button>
        )}
      </div>

      <p className="mt-4 flex items-start gap-1.5 text-[11px] font-medium leading-relaxed text-slate-400">
        <Lock className="mt-0.5 h-3 w-3 shrink-0" />
        You can read what was written, never who wrote it. {cube.name.split(' ')[0]} sees only a gentle growth area.
      </p>
    </article>
  );
};

const EmergingCard: React.FC<{ item: any }> = ({ item }) => {
  const cats = { ...(item.concern_categories || {}), ...(item.observation_categories || {}) };
  return (
    <article className="rounded-2xl border border-gray-100 bg-white p-5 shadow-subtle">
      <div className="flex items-start justify-between gap-3">
        <Person cube={item.cube} />
        <span className="shrink-0 text-xs font-extrabold text-slate-500">{item.people} people</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {Object.entries(cats).map(([cat]) => (
          <span key={cat} className={`rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold ${CATEGORY_TINT[cat] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>
            {cat}
          </span>
        ))}
        {item.reciprocal_flag && (
          <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[10px] font-extrabold text-amber-700">
            Mutual concerns
          </span>
        )}
      </div>
    </article>
  );
};
