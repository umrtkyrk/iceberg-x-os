import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import {
  Users,
  Rocket,
  MessageSquare,
  AlertCircle,
  AlertTriangle,
  Radar as RadarIcon,
  ArrowRight,
  PlayCircle,
  ClipboardCheck,
  CheckCircle2,
  Gem,
  Plus,
  ChevronDown,
  ShieldAlert
} from 'lucide-react';
import { UserAvatar } from '../components/UserAvatar';
import { MissionStepper } from '../components/dashboard/MissionStepper';
import { peerApi } from '../utils/peer';

const MAX_CUBES = 8;
const MAX_UPDATES = 5;
const MAX_ATTENTION = 5;

const LEVEL_CHIP: Record<string, string> = {
  Cube: 'bg-slate-100 text-slate-600',
  Senior_Cube: 'bg-violet-50 text-violet-700'
};

const relativeTime = (iso: string) => {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

export const MentorDashboard: React.FC = () => {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signals, setSignals] = useState<{ growth: number; gems: number } | null>(null);
  const [showAllCubes, setShowAllCubes] = useState(false);
  const [showAllUpdates, setShowAllUpdates] = useState(false);
  const [showAllAttention, setShowAllAttention] = useState(false);

  useEffect(() => {
    const fetchMentorData = async () => {
      try {
        const res = await api.get('/mentor/dashboard');
        setData(res);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch mentor dashboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchMentorData();

    // Radar counts are a nice-to-have; the dashboard works without them.
    Promise.all([peerApi.needsAttention(), peerApi.hiddenGems()])
      .then(([attention, gems]) =>
        setSignals({
          growth: (attention?.signals?.length || 0) + (attention?.emerging?.length || 0),
          gems: gems?.gems?.length || 0
        })
      )
      .catch(() => setSignals(null));
  }, []);

  const needsFeedbackIds = useMemo(
    () => new Set<string>((data?.cubesNeedingFeedback || []).map((c: any) => c.cubeProfileId)),
    [data]
  );

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-magenta border-t-transparent"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-red-100 bg-red-50 p-4 text-red-600">
        <ShieldAlert className="h-5 w-5" />
        <span>{error || 'Error loading dashboard'}</span>
      </div>
    );
  }

  const cubes: any[] = data.assignedCubes || [];
  const missions: any[] = data.assignedMissions || [];
  const reviews: any[] = data.pendingReviews || [];
  const feedbackDue: any[] = data.cubesNeedingFeedback || [];
  const updates: any[] = data.recentUpdates || [];

  const attentionCount =
    reviews.length + feedbackDue.length + (signals && signals.growth > 0 ? 1 : 0);

  // One ordered list: demos to score first, then scorecards, then peer signals.
  const attentionItems: { key: string; node: React.ReactNode }[] = [
    ...reviews.map((review: any) => ({
      key: `review-${review.id}`,
      node: (
        <Row
          icon={PlayCircle}
          tint="bg-magenta/10 text-magenta"
          title={review.title}
          detail={
            <>
              <b className="text-gray-700">{review.submitted_by.name}</b> submitted a demo for{' '}
              <b className="text-gray-700">{review.mission.title}</b>
            </>
          }
          to={`/missions/${review.mission_id}/review?cube=${review.submitted_by.id}`}
          cta="Score demo"
        />
      )
    })),
    ...feedbackDue.map((cube: any) => ({
      key: `fb-${cube.cubeProfileId}`,
      node: (
        <Row
          icon={ClipboardCheck}
          tint="bg-amber-50 text-amber-600"
          title={`${cube.name} is waiting for a scorecard`}
          detail={cube.missions.map((m: any) => m.title).join(', ')}
          to={`/missions/${cube.missions[0]?.id}/review?cube=${cube.cubeProfileId}`}
          cta="Write scorecard"
        />
      )
    })),
    ...(signals && signals.growth > 0
      ? [{
          key: 'signals',
          node: (
            <Row
              icon={AlertTriangle}
              tint="bg-sky-50 text-sky-600"
              title={`${signals.growth} peer ${signals.growth === 1 ? 'signal' : 'signals'} to look at`}
              detail="Growth areas teammates agree on. Anonymous aggregates only."
              to="/radar"
              cta="Open Radar"
            />
          )
        }]
      : [])
  ];

  const shownCubes = showAllCubes ? cubes : cubes.slice(0, MAX_CUBES);
  const shownUpdates = showAllUpdates ? updates : updates.slice(0, MAX_UPDATES);

  return (
    <div className="flex flex-col gap-8">
      {/* Hero */}
      <header className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#0b1020] via-[#0a0a14] to-[#150816] p-7 text-white shadow-premium sm:p-8">
        <div className="pointer-events-none absolute -right-10 -top-12 h-72 w-72 rounded-full bg-cyan-400/15 blur-[80px]" />
        <div className="pointer-events-none absolute -bottom-16 left-10 h-56 w-56 rounded-full bg-magenta/15 blur-[80px]" />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-white/50">Mentor workspace</p>
            <h1 className="mt-1.5 truncate text-2xl font-extrabold tracking-tight sm:text-3xl">
              Welcome back, {user?.name?.split(' ')[0] || 'Mentor'}
            </h1>
            <p className="mt-1 text-sm font-medium text-white/60">
              {attentionCount > 0
                ? `${attentionCount} ${attentionCount === 1 ? 'thing needs' : 'things need'} your attention.`
                : 'You are all caught up. Nothing is waiting on you.'}
            </p>
          </div>

          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="My Cubes" value={cubes.length} />
            <Stat label="Missions" value={missions.length} />
            <Stat label="Demos to score" value={reviews.length} hot={reviews.length > 0} />
            <Stat label="Feedback due" value={feedbackDue.length} hot={feedbackDue.length > 0} />
          </dl>
        </div>

        <div className="relative mt-6 flex flex-wrap gap-2.5 border-t border-white/10 pt-5">
          <HeroLink to="/review" icon={ClipboardCheck} primary>Review queue</HeroLink>
          <HeroLink to="/missions/new" icon={Plus}>New mission</HeroLink>
          <HeroLink to="/radar" icon={RadarIcon}>Radar</HeroLink>
        </div>
      </header>

      {/* Needs your attention */}
      <section className="flex flex-col gap-4">
        <h2 className="flex items-center gap-2 text-xl font-extrabold tracking-tight text-gray-900">
          <AlertCircle className="h-5 w-5 text-magenta" /> Needs your attention
          {attentionCount > 0 && (
            <span className="rounded-full bg-magenta px-2 py-0.5 text-[11px] font-black text-white">{attentionCount}</span>
          )}
        </h2>

        {attentionCount === 0 ? (
          <div className="flex items-center gap-4 rounded-3xl border border-emerald-100 bg-emerald-50/60 p-6">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
              <CheckCircle2 className="h-6 w-6" />
            </span>
            <div>
              <p className="text-sm font-extrabold text-emerald-900">All caught up</p>
              <p className="text-xs font-medium text-emerald-800/70">
                Every demo is scored and every assigned Cube has feedback.
              </p>
            </div>
          </div>
        ) : (
          <>
            <ul className="flex flex-col gap-3">
              {attentionItems.slice(0, showAllAttention ? attentionItems.length : MAX_ATTENTION).map(item => (
                <li key={item.key}>{item.node}</li>
              ))}
            </ul>
            {attentionItems.length > MAX_ATTENTION && (
              <button
                onClick={() => setShowAllAttention(v => !v)}
                className="flex items-center gap-1.5 self-start text-xs font-extrabold text-gray-500 hover:text-magenta"
              >
                {showAllAttention ? 'Show fewer' : `Show ${attentionItems.length - MAX_ATTENTION} more`}
                <ChevronDown className={`h-3.5 w-3.5 transition ${showAllAttention ? 'rotate-180' : ''}`} />
              </button>
            )}
          </>
        )}

        {signals && signals.gems > 0 && (
          <Link
            to="/radar"
            className="group flex items-center gap-3 rounded-2xl border border-cyan-100 bg-gradient-to-r from-cyan-50 to-white px-5 py-3.5 transition hover:border-cyan-300"
          >
            <Gem className="h-5 w-5 shrink-0 text-cyan-500" />
            <span className="flex-1 text-xs font-bold text-cyan-900">
              {signals.gems} hidden {signals.gems === 1 ? 'gem' : 'gems'}: teammates value them, mentors rarely see them.
            </span>
            <ArrowRight className="h-4 w-4 text-cyan-500 transition group-hover:translate-x-1" />
          </Link>
        )}
      </section>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Missions + updates */}
        <div className="flex flex-col gap-8 lg:col-span-2">
          <section className="flex flex-col gap-4">
            <h2 className="flex items-center gap-2 text-xl font-extrabold tracking-tight text-gray-900">
              <Rocket className="h-5 w-5 text-magenta" /> Your missions
            </h2>

            {missions.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center text-sm font-semibold text-gray-400">
                No missions are assigned to you right now.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {missions.map((m: any) => {
                  const members: any[] = (m.teams || []).flatMap((t: any) => t.members || []);
                  const seen = new Set<string>();
                  const people = members.filter(mem => {
                    const key = mem.cube?.id || mem.id;
                    if (seen.has(key)) return false;
                    seen.add(key);
                    return true;
                  });
                  return (
                    <article key={m.id} className="flex flex-col gap-4 rounded-3xl border border-gray-100 bg-white p-5 shadow-subtle transition hover:border-magenta/30">
                      <div className="min-w-0">
                        <span className="rounded-full border border-magenta/10 bg-magenta/5 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-magenta">
                          {m.status.replace(/_/g, ' ')}
                        </span>
                        <h3 className="mt-2 line-clamp-2 text-sm font-extrabold leading-snug text-gray-900">{m.title}</h3>
                      </div>

                      <MissionStepper status={m.status} />

                      <div className="mt-auto flex items-center justify-between gap-3">
                        <div className="flex -space-x-2">
                          {people.slice(0, 5).map((mem: any) => (
                            <span key={mem.id} className="rounded-full ring-2 ring-white" title={mem.cube?.user?.name}>
                              <UserAvatar name={mem.cube?.user?.name || '?'} avatarUrl={mem.cube?.avatar_url} size="xs" />
                            </span>
                          ))}
                          {people.length > 5 && (
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-[10px] font-black text-gray-500 ring-2 ring-white">
                              +{people.length - 5}
                            </span>
                          )}
                          {people.length === 0 && <span className="text-[11px] font-semibold text-gray-300">No team yet</span>}
                        </div>
                        <Link to={`/missions/${m.id}`} className="flex items-center gap-1 text-xs font-extrabold text-magenta hover:underline">
                          Configure & review <ArrowRight className="h-3 w-3" />
                        </Link>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <section className="flex flex-col gap-4">
            <h2 className="flex items-center gap-2 text-xl font-extrabold tracking-tight text-gray-900">
              <MessageSquare className="h-5 w-5 text-magenta" /> Updates feed
            </h2>

            {updates.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center text-sm font-semibold text-gray-400">
                No updates have been posted recently.
              </p>
            ) : (
              <div className="flex flex-col rounded-3xl border border-gray-100 bg-white shadow-subtle">
                <ul className="divide-y divide-gray-50">
                  {shownUpdates.map((update: any) => (
                    <li key={update.id} className="flex flex-col gap-1.5 p-5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-extrabold text-gray-800">
                          {update.cube.name}
                          <span className="font-semibold text-gray-400"> · {update.mission.title}</span>
                        </p>
                        <span className="flex items-center gap-2 text-[10px] font-bold text-gray-400">
                          <span className="rounded-full bg-magenta/5 px-2 py-0.5 uppercase tracking-wider text-magenta">
                            {update.type.replace(/_/g, ' ')}
                          </span>
                          {relativeTime(update.created_at)}
                        </span>
                      </div>
                      <p className="line-clamp-3 text-sm leading-relaxed text-gray-600">{update.content}</p>
                      {update.blockers && (
                        <p className="flex items-start gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">
                          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          <span>Blocked: {update.blockers}</span>
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
                {updates.length > MAX_UPDATES && (
                  <button
                    onClick={() => setShowAllUpdates(v => !v)}
                    className="flex items-center justify-center gap-1.5 border-t border-gray-50 py-3 text-xs font-extrabold text-gray-500 hover:text-magenta"
                  >
                    {showAllUpdates ? 'Show fewer' : `Show ${updates.length - MAX_UPDATES} more`}
                    <ChevronDown className={`h-3.5 w-3.5 transition ${showAllUpdates ? 'rotate-180' : ''}`} />
                  </button>
                )}
              </div>
            )}
          </section>
        </div>

        {/* My Cubes */}
        <aside className="flex flex-col gap-4">
          <h2 className="flex items-center gap-2 text-xl font-extrabold tracking-tight text-gray-900">
            <Users className="h-5 w-5 text-magenta" /> My Cubes
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-black text-gray-500">{cubes.length}</span>
          </h2>

          {cubes.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center text-sm font-semibold text-gray-400">
              No Cubes are assigned to you.
            </p>
          ) : (
            <div className="flex flex-col gap-2.5 rounded-3xl border border-gray-100 bg-white p-4 shadow-subtle">
              {shownCubes.map((c: any) => (
                <Link
                  key={c.id}
                  to={`/cubes/${c.id}`}
                  className="flex items-center gap-3 rounded-2xl border border-transparent p-2 transition hover:border-magenta/20 hover:bg-gray-50"
                >
                  <UserAvatar name={c.user.name} avatarUrl={c.avatar_url} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-extrabold text-gray-900">{c.user.name}</p>
                    <p className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-400">
                      #{c.cube_number}
                      <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide ${LEVEL_CHIP[c.current_level] || 'bg-gray-100 text-gray-500'}`}>
                        {c.current_level.replace(/_/g, ' ')}
                      </span>
                    </p>
                  </div>
                  {needsFeedbackIds.has(c.id) && (
                    <span title="Waiting for a scorecard" className="h-2.5 w-2.5 shrink-0 rounded-full bg-amber-400 ring-4 ring-amber-100" />
                  )}
                </Link>
              ))}
              {cubes.length > MAX_CUBES && (
                <button
                  onClick={() => setShowAllCubes(v => !v)}
                  className="flex items-center justify-center gap-1.5 pt-1 text-xs font-extrabold text-gray-500 hover:text-magenta"
                >
                  {showAllCubes ? 'Show fewer' : `Show all ${cubes.length}`}
                  <ChevronDown className={`h-3.5 w-3.5 transition ${showAllCubes ? 'rotate-180' : ''}`} />
                </button>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};

const Stat: React.FC<{ label: string; value: React.ReactNode; hot?: boolean }> = ({ label, value, hot }) => (
  <div className="rounded-2xl bg-white/5 px-4 py-3 text-center ring-1 ring-white/10 backdrop-blur">
    <dd className={`text-2xl font-black leading-none sm:text-3xl ${hot ? 'text-amber-300' : 'text-white'}`}>{value}</dd>
    <dt className="mt-1.5 text-[10px] font-bold uppercase tracking-wider text-white/45">{label}</dt>
  </div>
);

const HeroLink: React.FC<{
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  primary?: boolean;
  children: React.ReactNode;
}> = ({ to, icon: Icon, primary, children }) => (
  <Link
    to={to}
    className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-extrabold transition ${
      primary ? 'bg-magenta text-white shadow-sm hover:bg-magenta-hover' : 'bg-white/10 text-white hover:bg-white/20'
    }`}
  >
    <Icon className="h-3.5 w-3.5" /> {children}
  </Link>
);

const Row: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  tint: string;
  title: string;
  detail: React.ReactNode;
  to: string;
  cta: string;
}> = ({ icon: Icon, tint, title, detail, to, cta }) => (
  <div className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-subtle sm:flex-row sm:items-center sm:justify-between">
    <div className="flex min-w-0 items-start gap-3.5">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tint}`}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-extrabold text-gray-900">{title}</p>
        <p className="line-clamp-2 text-xs font-medium leading-relaxed text-gray-500">{detail}</p>
      </div>
    </div>
    <Link
      to={to}
      className="flex shrink-0 items-center justify-center gap-1.5 self-start rounded-xl bg-gray-900 px-4 py-2 text-xs font-extrabold text-white transition hover:bg-black sm:self-center"
    >
      {cta} <ArrowRight className="h-3 w-3" />
    </Link>
  </div>
);
