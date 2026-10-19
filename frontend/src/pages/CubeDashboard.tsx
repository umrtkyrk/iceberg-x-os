import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import {
  Award,
  Rocket,
  MessageSquare,
  ShieldAlert,
  Sparkles,
  Send,
  PlayCircle,
  ExternalLink,
  MessageCircle,
  Trophy,
  CalendarDays,
  UserRound,
  HeartHandshake,
  ChevronDown,
  Users
} from 'lucide-react';
import { CustomMarkdown } from '../components/CustomMarkdown';
import { BadgeDisc } from '../components/BadgeMedal';
import { UserAvatar } from '../components/UserAvatar';
import { compareByRarity, getRarityMeta } from '../utils/badgeRarity';
import { MVCubesShelf } from '../components/peer/MVCubesShelf';
import { GiveFeedbackButton } from '../components/peer/GiveFeedbackButton';
import { QuestBoard } from '../components/dashboard/QuestBoard';
import { peerApi } from '../utils/peer';
import { MissionStepper } from '../components/dashboard/MissionStepper';

export const CubeDashboard: React.FC = () => {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Submit Update modal/form states
  const [activeUpdateMissionId, setActiveUpdateMissionId] = useState<string | null>(null);
  const [updateType, setUpdateType] = useState('daily');
  const [updateContent, setUpdateContent] = useState('');
  const [updateBlockers, setUpdateBlockers] = useState('');
  const [updateSuccess, setUpdateSuccess] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updateSubmitting, setUpdateSubmitting] = useState(false);

  // Testimonial States
  const [testimonialContent, setTestimonialContent] = useState('');
  const [testimonialSubmitting, setTestimonialSubmitting] = useState(false);
  const [testimonialSuccess, setTestimonialSuccess] = useState(false);
  const [testimonialError, setTestimonialError] = useState<string | null>(null);
  const [testimonialOpen, setTestimonialOpen] = useState(false);

  const [showAllFeedback, setShowAllFeedback] = useState(false);

  const [quests, setQuests] = useState<any[]>([]);
  const [kudos, setKudos] = useState<any[]>([]);

  const fetchDashboardData = async () => {
    try {
      const [res, questsRes] = await Promise.all([
        api.get('/cube/dashboard'),
        api.get('/quests')
      ]);
      setData(res);
      setQuests(questsRes);
      // Kudos received are a nice-to-have on this page; never block the dashboard on them.
      peerApi.received().then(setKudos).catch(() => setKudos([]));
    } catch (err: any) {
      setError(err.message || 'Failed to fetch dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // A quest can complete from something that happens entirely off this page —
  // a mentor completing the mission, logging a scorecard, or closing a
  // meeting the Cube attended. Those now trigger a server-side recalculation
  // (see backend/src/services/quest.service.ts), but if this tab was already
  // open when it happened, its in-memory state doesn't know. Refetch when the
  // tab regains focus so "completed elsewhere" shows up without a manual F5.
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchDashboardData();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  const handleUpdateSubmit = async (e: React.FormEvent, missionId: string) => {
    e.preventDefault();
    if (!updateContent.trim()) return;

    setUpdateSubmitting(true);
    setUpdateError(null);
    setUpdateSuccess(false);

    try {
      await api.post('/updates', {
        mission_id: missionId,
        type: updateType,
        content: updateContent.trim(),
        blockers: updateBlockers.trim() || undefined
      });
      setUpdateSuccess(true);
      setUpdateContent('');
      setUpdateBlockers('');
      setTimeout(() => {
        setActiveUpdateMissionId(null);
        setUpdateSuccess(false);
      }, 2000);
      fetchDashboardData();
    } catch (err: any) {
      setUpdateError(err.message || 'Failed to submit update');
    } finally {
      setUpdateSubmitting(false);
    }
  };

  const handleTestimonialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testimonialContent.trim()) return;

    setTestimonialSubmitting(true);
    setTestimonialSuccess(false);
    setTestimonialError(null);

    try {
      await api.post('/testimonials', { content: testimonialContent });
      setTestimonialSuccess(true);
      setTestimonialContent('');
      setTimeout(() => {
        setTestimonialSuccess(false);
      }, 3000);

      // Submitting a testimonial can complete a "write_testimonial" quest and
      // award its badge server-side, in the same request. Without this, the
      // Cube stays on this page and sees the pre-submit quest/badge state
      // until they manually refresh — the badge exists in the database, the
      // screen just hasn't asked for it yet.
      fetchDashboardData();
    } catch (err: any) {
      setTestimonialError(err.message || 'Failed to submit testimonial');
    } finally {
      setTestimonialSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-magenta border-t-transparent"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-red-50 text-red-600 border border-red-100 p-4 rounded-2xl flex items-center gap-2">
        <ShieldAlert className="w-5 h-5" />
        <span>{error || 'Error loading dashboard'}</span>
      </div>
    );
  }

  const { profile, activeMission, activeTeam, activeMissions, upcomingDemoDay, recentFeedback } = data;

  const missionsList: Array<{ mission: any; team: any; role?: string }> =
    (activeMissions && activeMissions.length > 0)
      ? activeMissions
      : (activeMission ? [{ mission: activeMission, team: activeTeam }] : []);

  const questsDone = quests.filter((cq: any) => cq.is_completed).length;
  const badges: any[] = [...(profile.cube_badges || [])].sort((a: any, b: any) =>
    compareByRarity(a.badge?.rarity, b.badge?.rarity)
  );
  const feedbackList: any[] = recentFeedback || [];
  const visibleFeedback = showAllFeedback ? feedbackList : feedbackList.slice(0, 1);

  const demoDate = upcomingDemoDay ? new Date(upcomingDemoDay.date) : null;
  const daysToDemo = demoDate
    ? Math.max(0, Math.ceil((demoDate.getTime() - Date.now()) / 86400000))
    : null;

  const openUpdate = (missionId: string) => {
    setActiveUpdateMissionId(missionId);
    setUpdateSuccess(false);
    setUpdateError(null);
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Hero */}
      <header
        className={`relative overflow-hidden rounded-[2rem] p-7 text-white sm:p-8 ${
          profile.is_founding_cube
            ? 'border-2 border-amber-500/50 bg-gradient-to-br from-[#1a1103] to-[#0a0701] shadow-[0_0_30px_rgba(245,158,11,0.15)]'
            : 'bg-gradient-to-br from-[#120009] to-[#0a0006] shadow-premium'
        }`}
      >
        <div
          className={`pointer-events-none absolute -right-10 -top-10 h-72 w-72 rounded-full blur-[80px] ${
            profile.is_founding_cube ? 'bg-amber-500/15' : 'bg-magenta/20'
          }`}
        />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-5">
            <UserAvatar
              name={user?.name || 'Cube'}
              avatarUrl={profile.avatar_url || user?.avatarUrl || user?.avatar_url}
              size="xl"
              className="ring-4 ring-white/10"
            />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-white ${
                    profile.is_founding_cube ? 'bg-gradient-to-r from-amber-500 to-yellow-600' : 'bg-magenta'
                  }`}
                >
                  {profile.current_level.replace(/_/g, ' ')}
                </span>
                {profile.is_founding_cube && (
                  <span className="flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-[10px] font-extrabold text-amber-300">
                    <Award className="h-3.5 w-3.5 text-amber-400" /> Founding Cube
                  </span>
                )}
                <span className="text-sm font-bold text-gray-400">Cube #{profile.cube_number}</span>
              </div>
              <h1 className="mt-1.5 flex items-center gap-2 truncate text-2xl font-extrabold tracking-tight sm:text-3xl">
                <span className="truncate">{user?.name}</span>
                {profile.is_founding_cube && <Sparkles className="h-6 w-6 shrink-0 animate-pulse text-amber-400" />}
              </h1>
              <p className="mt-0.5 truncate text-sm font-medium text-gray-400">
                {profile.cohort} · {profile.university}
              </p>
            </div>
          </div>

          <dl className="grid grid-cols-3 gap-3 sm:gap-4">
            <Stat label="Badges" value={profile.cube_badges?.length || 0} accent={profile.is_founding_cube} />
            <Stat label="Quests done" value={`${questsDone}/${quests.length}`} accent={profile.is_founding_cube} />
            <Stat label="Missions" value={missionsList.length} accent={profile.is_founding_cube} />
          </dl>
        </div>

        <div className="relative mt-6 flex flex-wrap items-center gap-2.5 border-t border-white/10 pt-5">
          {missionsList.length > 0 && (
            <button
              onClick={() => openUpdate(missionsList[0].mission.id)}
              className="flex items-center gap-2 rounded-xl bg-magenta px-4 py-2 text-xs font-extrabold text-white shadow-sm transition hover:bg-magenta-hover"
            >
              <Send className="h-3.5 w-3.5" /> Post an update
            </button>
          )}
          <GiveFeedbackButton variant="solid" label="Recognise a teammate" />
          <Link
            to={`/cubes/${profile.id}`}
            className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-xs font-extrabold text-white transition hover:bg-white/20"
          >
            <UserRound className="h-3.5 w-3.5" /> My profile
          </Link>
          <Link
            to="/quests"
            className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-xs font-extrabold text-white transition hover:bg-white/20"
          >
            <Trophy className="h-3.5 w-3.5" /> All quests
          </Link>
        </div>
      </header>

      {/* The star of the page: where every quest stands */}
      <QuestBoard quests={quests} />

      <MVCubesShelf />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Missions */}
        <section className="flex flex-col gap-6 lg:col-span-2">
          <h2 className="flex items-center gap-2 text-xl font-extrabold tracking-tight text-gray-900">
            <Rocket className="h-5 w-5 text-magenta" />
            {missionsList.length > 1 ? 'Your missions' : 'Your mission'}
          </h2>

          {missionsList.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-gray-200 bg-white p-10 text-center">
              <Rocket className="h-8 w-8 text-gray-300" />
              <h3 className="text-base font-extrabold text-gray-700">No active mission</h3>
              <p className="max-w-sm text-xs font-medium text-gray-400">
                You are not on a mission right now. Ask your mentor about your next assignment.
              </p>
            </div>
          ) : (
            missionsList.map((item: any) => {
              const m = item.mission;
              const t = item.team;
              const isUpdateOpen = activeUpdateMissionId === m.id;

              return (
                <article key={m.id} className="flex flex-col gap-5 rounded-3xl border border-gray-100 bg-white p-6 shadow-subtle">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="mb-1.5 flex flex-wrap items-center gap-2">
                        {m.status && (
                          <span className="rounded-full border border-magenta/10 bg-magenta/5 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-magenta">
                            {m.status.replace(/_/g, ' ')}
                          </span>
                        )}
                        {item.role && (
                          <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-gray-500">
                            {item.role.replace(/_/g, ' ')}
                          </span>
                        )}
                      </div>
                      <Link to={`/missions/${m.id}`} className="text-xl font-extrabold leading-tight text-gray-900 transition-colors hover:text-magenta">
                        {m.title}
                      </Link>
                    </div>
                    <Link
                      to={`/missions/${m.id}`}
                      className="flex items-center gap-1 text-xs font-extrabold text-magenta hover:underline"
                    >
                      Open mission <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>

                  <MissionStepper status={m.status} />

                  <div className="markdown-body max-h-24 overflow-hidden text-xs leading-relaxed text-gray-500 [mask-image:linear-gradient(to_bottom,black_60%,transparent)]">
                    <CustomMarkdown>{m.description}</CustomMarkdown>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      onClick={() => (isUpdateOpen ? setActiveUpdateMissionId(null) : openUpdate(m.id))}
                      className="flex items-center gap-2 rounded-xl bg-magenta px-4 py-2.5 text-xs font-extrabold text-white shadow-sm shadow-magenta/10 transition-colors hover:bg-magenta-hover"
                    >
                      <Send className="h-3.5 w-3.5" />
                      {isUpdateOpen ? 'Cancel update' : 'Post an update'}
                    </button>
                    <Link
                      to={`/submit-demo?missionId=${m.id}`}
                      className="flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-xs font-extrabold text-white transition-colors hover:bg-black"
                    >
                      <PlayCircle className="h-3.5 w-3.5" /> Submit Demo Day material
                    </Link>
                    {m.slack_channel_url && (
                      <a
                        href={m.slack_channel_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 rounded-xl border border-gray-100 bg-gray-50 px-3.5 py-2.5 text-xs font-bold text-gray-600 transition hover:text-magenta"
                      >
                        <MessageCircle className="h-3.5 w-3.5 text-magenta" /> Slack
                      </a>
                    )}
                    {m.repository_url && (
                      <a
                        href={m.repository_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 rounded-xl border border-gray-100 bg-gray-50 px-3.5 py-2.5 text-xs font-bold text-gray-600 transition hover:text-magenta"
                      >
                        <PlayCircle className="h-3.5 w-3.5 text-magenta" /> Repository
                      </a>
                    )}
                  </div>

                  {/* Submit Update Inline Card */}
                  {isUpdateOpen && (
                    <form onSubmit={(e) => handleUpdateSubmit(e, m.id)} className="flex animate-fadeIn flex-col gap-3.5 rounded-2xl border border-magenta/10 bg-magenta/5 p-4">
                      <h4 className="text-xs font-extrabold uppercase tracking-wider text-magenta">
                        New progress update: {m.title}
                      </h4>

                      {updateSuccess && (
                        <div className="rounded-lg border border-green-100 bg-green-50 p-2.5 text-xs font-semibold text-green-700">
                          Update submitted successfully!
                        </div>
                      )}
                      {updateError && (
                        <div className="rounded-lg border border-red-100 bg-red-50 p-2.5 text-xs font-semibold text-red-700">
                          {updateError}
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-4">
                        <label className="text-xs font-bold text-gray-600">Type:</label>
                        <div className="flex flex-wrap gap-3">
                          {['daily', 'weekly', 'mission_progress'].map((type) => (
                            <label key={type} className="flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-gray-700">
                              <input
                                type="radio"
                                name={`updateType-${m.id}`}
                                value={type}
                                checked={updateType === type}
                                onChange={() => setUpdateType(type)}
                                className="text-magenta focus:ring-magenta"
                              />
                              <span className="capitalize">{type.replace('_', ' ')}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold text-gray-600">What did you build or discover?</label>
                        <textarea
                          required
                          placeholder="Detail your milestones and findings..."
                          value={updateContent}
                          onChange={(e) => setUpdateContent(e.target.value)}
                          disabled={updateSubmitting}
                          className="w-full resize-none rounded-lg border border-gray-200 bg-white p-2.5 text-xs font-semibold outline-none transition-colors focus:border-magenta"
                          rows={3}
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold text-gray-600">Blockers (optional)</label>
                        <input
                          type="text"
                          placeholder="Any engineering bottlenecks or support needed?"
                          value={updateBlockers}
                          onChange={(e) => setUpdateBlockers(e.target.value)}
                          disabled={updateSubmitting}
                          className="w-full rounded-lg border border-gray-200 bg-white p-2.5 text-xs font-semibold outline-none transition-colors focus:border-magenta"
                        />
                      </div>

                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setActiveUpdateMissionId(null)}
                          disabled={updateSubmitting}
                          className="rounded-lg border border-gray-200 bg-white px-3.5 py-1.5 text-xs font-bold text-gray-500 transition-colors hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={updateSubmitting || !updateContent.trim()}
                          className="rounded-lg bg-magenta px-4 py-1.5 text-xs font-bold text-white transition-colors hover:bg-magenta-hover disabled:opacity-75"
                        >
                          {updateSubmitting ? 'Submitting...' : 'Send update'}
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Team */}
                  {t && t.members && t.members.length > 0 && (
                    <div className="flex flex-col gap-3 border-t border-gray-50 pt-4">
                      <p className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.16em] text-gray-400">
                        <Users className="h-3.5 w-3.5" /> Team · {t.name}
                      </p>
                      <ul className="flex flex-wrap gap-2.5">
                        {t.members.map((member: any) => (
                          <li
                            key={member.id}
                            className="flex items-center gap-2.5 rounded-2xl border border-gray-100 bg-gray-50/60 py-1.5 pl-1.5 pr-3.5"
                          >
                            <UserAvatar
                              name={member.cube?.user?.name || '?'}
                              avatarUrl={member.cube?.avatar_url}
                              size="sm"
                            />
                            <div className="min-w-0">
                              <p className="truncate text-xs font-extrabold text-gray-900">
                                {member.cube?.user?.name || 'Unknown'}
                              </p>
                              <p className="truncate text-[10px] font-bold uppercase tracking-wide text-magenta">
                                {(member.role || 'Member').replace(/_/g, ' ')}
                              </p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </article>
              );
            })
          )}
        </section>

        {/* Sidebar */}
        <aside className="flex flex-col gap-6">
          {/* People & dates */}
          {(profile.assigned_mentor || upcomingDemoDay) && (
            <div className="flex flex-col gap-4 rounded-3xl border border-gray-100 bg-white p-6 shadow-subtle">
              {profile.assigned_mentor && (
                <div className="flex items-center gap-3">
                  <UserAvatar name={profile.assigned_mentor.name} size="md" />
                  <div className="min-w-0">
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-gray-400">Your mentor</p>
                    <p className="truncate text-sm font-extrabold text-gray-900">{profile.assigned_mentor.name}</p>
                    <p className="truncate text-xs font-medium text-gray-500">{profile.assigned_mentor.email}</p>
                  </div>
                </div>
              )}
              {profile.assigned_mentor && upcomingDemoDay && <div className="h-px bg-gray-50" />}
              {upcomingDemoDay && (
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-magenta/10 text-magenta">
                    <CalendarDays className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-gray-400">Next Demo Day</p>
                    <p className="truncate text-sm font-extrabold text-gray-900">{upcomingDemoDay.title}</p>
                    <p className="text-xs font-bold text-magenta">
                      {demoDate?.toLocaleDateString(undefined, { dateStyle: 'medium' })}
                      {daysToDemo !== null && (
                        <span className="text-gray-400">
                          {' '}· {daysToDemo === 0 ? 'today' : daysToDemo === 1 ? 'tomorrow' : `in ${daysToDemo} days`}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Kudos received: the reward for being useful to teammates */}
          <div className="flex flex-col gap-4 rounded-3xl border border-gray-100 bg-white p-6 shadow-subtle">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-base font-extrabold">
                <HeartHandshake className="h-5 w-5 text-magenta" /> Kudos for you
              </h3>
              <span className="rounded-full bg-magenta/10 px-2.5 py-0.5 text-[11px] font-black text-magenta">{kudos.length}</span>
            </div>

            {kudos.length > 0 ? (
              <>
                <ul className="flex flex-col gap-3">
                  {kudos.slice(0, 2).map((k: any) => (
                    <li key={k.id} className="rounded-2xl bg-gradient-to-br from-slate-50 to-white p-3.5 ring-1 ring-gray-100">
                      <p className="line-clamp-3 text-xs font-medium italic leading-relaxed text-gray-700">
                        {k.note ? `“${k.note}”` : 'Recognised without a note.'}
                      </p>
                      <p className="mt-2 text-[10px] font-extrabold uppercase tracking-wide text-magenta">
                        {(k.tags || []).join(' · ').replace(/_/g, ' ')}
                      </p>
                    </li>
                  ))}
                </ul>
                <Link to={`/cubes/${profile.id}`} className="text-xs font-extrabold text-magenta hover:underline">
                  Read them all and choose what to show publicly
                </Link>
              </>
            ) : (
              <p className="text-xs font-semibold leading-relaxed text-gray-400">
                Nobody has recognised you yet. Recognising a teammate is the quickest way to start: people who give
                kudos tend to get them.
              </p>
            )}
          </div>

          {/* Badges */}
          <div className="flex flex-col gap-4 rounded-3xl border border-gray-100 bg-white p-6 shadow-subtle">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-base font-extrabold">
                <Award className="h-5 w-5 text-magenta" /> Badges
              </h3>
              <Link to="/badges" className="text-[11px] font-extrabold text-magenta hover:underline">
                All badges
              </Link>
            </div>

            {badges.length > 0 ? (
              <div className="grid grid-cols-3 gap-3">
                {badges.slice(0, 9).map((award: any) => {
                  const meta = getRarityMeta(award.badge?.rarity);
                  return (
                    <div
                      key={award.id}
                      className={`group relative ${meta.frame} transition-transform duration-300 hover:scale-105`}
                      title={`${award.badge?.name}${award.reason ? ` · ${award.reason}` : ''}`}
                    >
                      {meta.animated && <span className="badge-sheen" />}
                      <div className={`relative ${meta.surface} flex flex-col items-center p-2.5 text-center`}>
                        <BadgeDisc icon={award.badge?.icon} rarity={award.badge?.rarity} size="sm" />
                        <span className={`mt-2 max-w-full truncate text-[10px] font-bold ${meta.title}`}>
                          {award.badge?.name}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="py-3 text-center text-xs font-semibold leading-relaxed text-gray-400">
                No badges yet. Finish a quest above to earn your first one.
              </p>
            )}
            {badges.length > 9 && (
              <p className="text-center text-[11px] font-bold text-gray-400">+{badges.length - 9} more on your profile</p>
            )}
          </div>

          {/* Recent feedback */}
          <div className="flex flex-col gap-4 rounded-3xl border border-gray-100 bg-white p-6 shadow-subtle">
            <h3 className="flex items-center gap-2 text-base font-extrabold">
              <MessageSquare className="h-5 w-5 text-magenta" /> Mentor feedback
            </h3>

            {feedbackList.length > 0 ? (
              <>
                <div className="flex flex-col gap-4">
                  {visibleFeedback.map((feedback: any) => (
                    <div key={feedback.id} className="border-l-2 border-magenta py-0.5 pl-3.5">
                      {/* A scorecard can be general rather than tied to a mission
                          (MentorFeedback.mission_id is nullable), in which case
                          `mission` comes back null. */}
                      <p className="text-xs font-extrabold text-gray-500">
                        {feedback.mission ? feedback.mission.title : 'General evaluation'}
                      </p>
                      <p className="mt-2 text-[10px] font-extrabold uppercase tracking-wide text-emerald-600">Strengths</p>
                      <p className="text-xs italic leading-relaxed text-gray-600">"{feedback.strengths}"</p>
                      <p className="mt-2 text-[10px] font-extrabold uppercase tracking-wide text-amber-600">To improve</p>
                      <p className="text-xs italic leading-relaxed text-gray-600">"{feedback.areas_to_improve}"</p>
                      <p className="mt-2 text-[10px] font-bold text-gray-400">
                        {feedback.mentor.name} · {new Date(feedback.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
                {feedbackList.length > 1 && (
                  <button
                    onClick={() => setShowAllFeedback(v => !v)}
                    className="flex items-center gap-1 self-start text-[11px] font-extrabold text-magenta hover:underline"
                  >
                    {showAllFeedback ? 'Show less' : `Show ${feedbackList.length - 1} more`}
                    <ChevronDown className={`h-3 w-3 transition ${showAllFeedback ? 'rotate-180' : ''}`} />
                  </button>
                )}
              </>
            ) : (
              <p className="py-3 text-center text-xs font-semibold text-gray-400">No feedback shared with you yet.</p>
            )}
          </div>

          {/* Testimonial, tucked away until wanted */}
          <div className="rounded-3xl border border-gray-100 bg-white shadow-subtle">
            <button
              onClick={() => setTestimonialOpen(v => !v)}
              className="flex w-full items-center justify-between gap-3 p-6 text-left"
              aria-expanded={testimonialOpen}
            >
              <span className="flex items-center gap-2 text-base font-extrabold">
                <Sparkles className="h-5 w-5 text-magenta" /> Share a testimonial
              </span>
              <ChevronDown className={`h-4 w-4 text-gray-400 transition ${testimonialOpen ? 'rotate-180' : ''}`} />
            </button>

            {testimonialOpen && (
              <div className="flex animate-fadeIn flex-col gap-3 px-6 pb-6">
                <p className="text-xs font-semibold leading-relaxed text-gray-500">
                  Loved your journey with Iceberg X? Once an Admin approves it, your testimonial is showcased on the
                  main landing page.
                </p>
                <form onSubmit={handleTestimonialSubmit} className="flex flex-col gap-3">
                  {testimonialSuccess && (
                    <div className="rounded-lg border border-green-100 bg-green-50 p-2.5 text-xs font-semibold text-green-700">
                      Testimonial submitted for approval!
                    </div>
                  )}
                  {testimonialError && (
                    <div className="rounded-lg border border-red-100 bg-red-50 p-2.5 text-xs font-semibold text-red-700">
                      {testimonialError}
                    </div>
                  )}

                  <textarea
                    required
                    rows={3}
                    maxLength={300}
                    placeholder="Share your R&D projects experience, skills learned, and mentorship highlight..."
                    value={testimonialContent}
                    onChange={e => setTestimonialContent(e.target.value)}
                    className="w-full resize-none rounded-lg border border-gray-100 bg-gray-50 p-2.5 text-xs font-semibold outline-none transition focus:border-magenta focus:bg-white"
                  />

                  <div className="flex items-center justify-between px-1 text-[10px] font-extrabold">
                    <span className={testimonialContent.length >= 300 ? 'text-magenta' : 'text-gray-400'}>
                      {testimonialContent.length} / 300 characters
                    </span>
                    {testimonialContent.length >= 300 && <span className="text-magenta">Max limit reached</span>}
                  </div>

                  <button
                    type="submit"
                    disabled={testimonialSubmitting || !testimonialContent.trim()}
                    className="w-full rounded-xl bg-gray-900 py-2 text-xs font-bold text-white transition-colors hover:bg-black disabled:opacity-50"
                  >
                    {testimonialSubmitting ? 'Submitting...' : 'Submit testimonial'}
                  </button>
                </form>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};

const Stat: React.FC<{ label: string; value: React.ReactNode; accent?: boolean }> = ({ label, value, accent }) => (
  <div className="rounded-2xl bg-white/5 px-4 py-3 text-center ring-1 ring-white/10 backdrop-blur">
    <dd className={`text-2xl font-black leading-none sm:text-3xl ${accent ? 'text-amber-400' : 'text-magenta'}`}>{value}</dd>
    <dt className="mt-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">{label}</dt>
  </div>
);
