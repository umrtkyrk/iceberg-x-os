import {
  Children,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  Award,
  Calendar,
  CheckCircle2,
  FileCheck,
  FileText,
  MessageSquare,
  Plus,
  Radar,
  RefreshCw,
  Rocket,
  Sparkles,
  Users,
} from 'lucide-react';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { PageHeader } from '../components/PageHeader';

interface Action {
  id: string;
  title: string;
  detail: string;
  href: string;
  priority: 'high' | 'medium' | 'low';
  count: number;
}
interface Recommendation {
  cubeId: string;
  name: string;
  by: string;
  recommended?: string;
}
interface DashboardData {
  generatedAt: string;
  activeCubes: number;
  activeMissions: number;
  pendingApplicationsCount: number;
  pendingDocumentsCount: number;
  pendingTestimonialsCount: number;
  actions: Action[];
  progressionCubes: Recommendation[];
  inactiveRiskCubes: Recommendation[];
  quietMissions: { id: string; title: string; status: string }[];
  unassignedMentors: {
    id: string;
    cube_number: string;
    user?: { name: string };
  }[];
  missionsByStatus: { status: string; _count: number }[];
  upcomingDemoDays: { id: string; title: string; date: string }[];
  upcomingMeetings: { id: string; title: string; date: string }[];
  recentDemos: {
    id: string;
    title: string;
    mission_id: string;
    submitted_at: string;
    mission?: { title: string };
    submitted_by?: { name: string };
  }[];
  recentBadges: {
    id: string;
    badge?: { name: string };
    cube?: { user?: { name: string } };
    awarded_at: string;
  }[];
  recentUpdates: {
    id: string;
    content: string;
    blockers?: string;
    created_at: string;
    mission_id: string;
    mission?: { title: string };
    cube?: { name: string };
  }[];
}
interface Briefing {
  overview: string;
  priorities: { actionId: string; reason: string }[];
  source: 'ai' | 'snapshot';
  generatedAt: string;
}
const humanize = (value?: string) => (value || 'Unknown').replace(/_/g, ' ');
const dateLabel = (date: string) =>
  new Date(date).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  });

export function AdminDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [briefError, setBriefError] = useState('');

  const loadBrief = useCallback(async () => {
    setBriefLoading(true);
    setBriefError('');
    try {
      setBriefing(await api.post<Briefing>('/admin/dashboard/briefing', {}));
    } catch {
      setBriefError(
        'The brief is unavailable. Your action queues are shown below.'
      );
    } finally {
      setBriefLoading(false);
    }
  }, []);
  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      setData(await api.get<DashboardData>('/admin/dashboard'));
      setError('');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not load operations.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);
  useEffect(() => {
    void load();
    void loadBrief();
  }, [load, loadBrief]);

  if (loading)
    return (
      <div role="status" className="flex h-64 items-center justify-center">
        <RefreshCw className="h-6 w-6 animate-spin text-magenta" />
        <span className="sr-only">Loading operations</span>
      </div>
    );
  if (!data)
    return (
      <div
        role="alert"
        className="flex flex-wrap items-center gap-3 rounded-2xl border border-red-100 bg-red-50 p-5 text-sm text-red-700"
      >
        <AlertCircle className="h-5 w-5" />
        {error}
        <button onClick={() => void load()} className="font-bold underline">
          Try again
        </button>
      </div>
    );
  const actions = data.actions || [];
  const events = [
    ...(data.upcomingDemoDays || []).map((day) => ({
      ...day,
      kind: 'Demo day',
      to: '/demodays',
    })),
    ...(data.upcomingMeetings || []).map((day) => ({
      ...day,
      kind: 'Meeting',
      to: '/meetings',
    })),
  ]
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 5);
  const actionHref = (action: Action) => {
    const destinations: Record<string, string | undefined> = {
      support:
        data.inactiveRiskCubes?.[0]?.cubeId &&
        '/cubes/' + data.inactiveRiskCubes[0].cubeId,
      quiet:
        data.quietMissions?.[0]?.id && '/missions/' + data.quietMissions[0].id,
      mentors:
        data.unassignedMentors?.[0]?.id &&
        '/cubes/' + data.unassignedMentors[0].id,
      progression:
        data.progressionCubes?.[0]?.cubeId &&
        '/cubes/' + data.progressionCubes[0].cubeId,
    };
    return destinations[action.id] || action.href;
  };

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Admin workspace"
        title={'Welcome back, ' + (user?.name?.split(' ')[0] || 'Admin')}
        description={
          actions.length
            ? actions.length +
              ' queues need attention. Start with the priorities below.'
            : 'All monitored queues are clear.'
        }
      >
        <button
          type="button"
          title="Refresh operations"
          aria-label="Refresh operations"
          disabled={refreshing || briefLoading}
          onClick={() => {
            void load();
            void loadBrief();
          }}
          className="workspace-icon-button"
        >
          <RefreshCw
            className={'h-4 w-4 ' + (refreshing ? 'animate-spin' : '')}
          />
        </button>
        <Link to="/missions/new" className="workspace-primary-action">
          <Plus className="h-4 w-4" /> New mission
        </Link>
        <Link to="/admin/users" className="workspace-secondary-action">
          <Users className="h-4 w-4" /> Manage users
        </Link>
      </PageHeader>
      {error && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 p-3 text-sm text-red-700"
        >
          {error} The previous snapshot is still shown.
        </p>
      )}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          {
            label: 'In-programme Cubes',
            value: data.activeCubes,
            icon: Users,
            tint: 'bg-cyan-50 text-cyan-700',
            to: '/directory',
          },
          {
            label: 'Active missions',
            value: data.activeMissions,
            icon: Rocket,
            tint: 'bg-magenta/5 text-magenta',
            to: '/missions',
          },
          {
            label: 'Applications pending',
            value: data.pendingApplicationsCount,
            icon: FileText,
            tint: 'bg-amber-50 text-amber-700',
            to: '/admin/applications',
          },
          {
            label: 'Documents to review',
            value: data.pendingDocumentsCount,
            icon: FileCheck,
            tint: 'bg-emerald-50 text-emerald-700',
            to: '/admin/nda',
          },
        ].map((stat) => (
          <Link
            key={stat.label}
            to={stat.to}
            className="flex min-w-0 items-start gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-subtle transition hover:border-magenta/30 sm:p-5"
          >
            <span
              className={
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ' +
                stat.tint
              }
            >
              <stat.icon className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-2xl font-black tabular-nums text-gray-900">
                {stat.value || 0}
              </p>
              <p className="mt-1 text-[11px] font-semibold text-gray-500">
                {stat.label}
              </p>
            </div>
          </Link>
        ))}
      </div>
      <section className="grid items-start gap-6 xl:grid-cols-[1.2fr_1fr]">
        <div className="min-w-0">
          <SectionTitle
            icon={AlertCircle}
            title="Needs your attention"
            count={actions.length}
          />
          {!actions.length ? (
            <div className="mt-4 flex items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              <p className="text-sm font-semibold text-emerald-900">
                No outstanding items in the monitored queues.
              </p>
            </div>
          ) : (
            <ul className="mt-4 divide-y divide-gray-100 rounded-2xl border border-gray-100 bg-white shadow-subtle">
              {actions.map((action) => (
                <li key={action.id}>
                  <Link
                    to={actionHref(action)}
                    className="group flex items-start gap-3 p-4 transition hover:bg-gray-50"
                  >
                    <span
                      className={
                        'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ' +
                        (action.priority === 'high'
                          ? 'bg-rose-50 text-rose-600'
                          : 'bg-gray-50 text-gray-500')
                      }
                    >
                      <AlertCircle className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-extrabold text-gray-900">
                          {action.title}
                        </p>
                        {action.priority === 'high' && (
                          <span className="text-[10px] font-bold uppercase text-rose-600">
                            High priority
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-gray-500">
                        {action.detail}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-black tabular-nums text-gray-700">
                      {action.count}
                    </span>
                    <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-gray-400 group-hover:text-magenta" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
        <aside
          className="min-w-0 rounded-2xl border border-cyan-100 bg-white p-5 shadow-subtle sm:p-6"
          aria-live="polite"
          aria-busy={briefLoading}
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-base font-extrabold">
              <Sparkles className="h-5 w-5 text-cyan-600" /> Programme brief
            </h2>
            <span className="text-[10px] font-bold uppercase text-gray-400">
              {briefing?.source === 'ai' ? 'AI summary' : 'Snapshot'}
            </span>
          </div>
          {briefLoading ? (
            <div
              role="status"
              className="flex items-center gap-2 py-8 text-sm text-gray-500"
            >
              <RefreshCw className="h-4 w-4 animate-spin" /> Preparing your
              brief…
            </div>
          ) : briefing ? (
            <>
              <p className="mt-4 text-sm leading-relaxed text-gray-600">
                {briefing.overview}
              </p>
              <ol className="mt-5 space-y-4">
                {briefing.priorities.map((priority, index) => {
                  const action = actions.find(
                    (item) => item.id === priority.actionId
                  );
                  return action ? (
                    <li key={priority.actionId} className="flex gap-3">
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-cyan-50 text-xs font-black text-cyan-700">
                        {index + 1}
                      </span>
                      <div>
                        <Link
                          to={actionHref(action)}
                          className="text-xs font-extrabold text-gray-900 hover:text-magenta"
                        >
                          {action.title}
                        </Link>
                        <p className="mt-1 text-xs leading-relaxed text-gray-500">
                          {priority.reason}
                        </p>
                      </div>
                    </li>
                  ) : null;
                })}
              </ol>
              <p className="mt-5 border-t border-gray-100 pt-3 text-[10px] text-gray-400">
                Updated{' '}
                {new Date(briefing.generatedAt).toLocaleTimeString('en-GB', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
                {briefing.source === 'snapshot' && ' · Live programme data'}
              </p>
            </>
          ) : (
            <p className="mt-4 text-sm text-gray-500">
              {briefError || 'The programme brief is not available yet.'}
            </p>
          )}
          {briefError && briefing && (
            <p role="alert" className="mt-3 text-xs text-amber-700">
              {briefError}
            </p>
          )}
          {briefError && (
            <button
              onClick={() => void loadBrief()}
              disabled={briefLoading}
              className="mt-3 flex items-center gap-2 text-xs font-bold text-cyan-700"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Retry brief
            </button>
          )}
        </aside>
      </section>
      <div className="grid items-start gap-8 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-8 lg:col-span-2">
          <section>
            <SectionTitle icon={Rocket} title="Mission pipeline" />
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {(data.missionsByStatus || []).map((stage) => (
                <Link
                  to="/missions"
                  key={stage.status}
                  className="rounded-2xl border border-gray-100 bg-white p-4 shadow-subtle hover:border-magenta/30"
                >
                  <p className="text-xl font-black tabular-nums">
                    {stage._count}
                  </p>
                  <p className="mt-1 text-xs font-semibold capitalize text-gray-500">
                    {humanize(stage.status)}
                  </p>
                </Link>
              ))}
            </div>
            {!data.missionsByStatus?.length && (
              <Empty>No missions have been created yet.</Empty>
            )}
          </section>
          {!!data.quietMissions?.length && (
            <section>
              <SectionTitle
                icon={AlertCircle}
                title="Quiet missions"
                count={data.quietMissions.length}
              />
              <Rows>
                {data.quietMissions.map((mission) => (
                  <LinkedRow
                    key={mission.id}
                    to={'/missions/' + mission.id}
                    title={mission.title}
                    detail="No updates or demos in the last 7 days"
                  />
                ))}
              </Rows>
            </section>
          )}
          <section>
            <SectionTitle
              icon={Award}
              title="Progression decisions"
              count={data.progressionCubes?.length || 0}
            />
            <Rows>
              {data.progressionCubes?.map((cube) => (
                <LinkedRow
                  key={cube.cubeId}
                  to={'/cubes/' + cube.cubeId}
                  title={cube.name}
                  detail={
                    humanize(cube.recommended) +
                    ' · Recommended by ' +
                    (cube.by || 'Mentor')
                  }
                />
              ))}
            </Rows>
            {!data.progressionCubes?.length && (
              <Empty>No progression decisions are waiting.</Empty>
            )}
          </section>
          {!!data.inactiveRiskCubes?.length && (
            <section>
              <SectionTitle
                icon={Users}
                title="Support check-ins"
                count={data.inactiveRiskCubes.length}
              />
              <Rows>
                {data.inactiveRiskCubes.map((cube) => (
                  <LinkedRow
                    key={cube.cubeId}
                    to={'/cubes/' + cube.cubeId}
                    title={cube.name}
                    detail={'Follow up with ' + (cube.by || 'their mentor')}
                  />
                ))}
              </Rows>
            </section>
          )}
          {!!data.unassignedMentors?.length && (
            <section>
              <SectionTitle
                icon={Users}
                title="Mentor assignments"
                count={data.unassignedMentors.length}
              />
              <Rows>
                {data.unassignedMentors.map((cube) => (
                  <LinkedRow
                    key={cube.id}
                    to={'/cubes/' + cube.id}
                    title={
                      '#' +
                      cube.cube_number +
                      ' · ' +
                      (cube.user?.name || 'Unknown')
                    }
                    detail="No mentor assigned"
                  />
                ))}
              </Rows>
            </section>
          )}
          <section>
            <SectionTitle icon={MessageSquare} title="Latest activity" />
            <Rows>
              {data.recentUpdates?.map((update) => (
                <Link
                  to={'/missions/' + update.mission_id}
                  key={update.id}
                  className="block p-4 hover:bg-gray-50"
                >
                  <div className="flex flex-wrap justify-between gap-2 text-xs">
                    <p className="font-extrabold">
                      {update.cube?.name || 'Unknown'}{' '}
                      <span className="font-medium text-gray-400">
                        · {update.mission?.title || 'Mission'}
                      </span>
                    </p>
                    <span className="text-gray-400">
                      {dateLabel(update.created_at)}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-gray-500">
                    {update.content}
                  </p>
                  {update.blockers && (
                    <p className="mt-2 line-clamp-2 text-xs font-semibold text-rose-600">
                      Blocker: {update.blockers}
                    </p>
                  )}
                </Link>
              ))}
            </Rows>
            {!data.recentUpdates?.length && (
              <Empty>No activity recorded yet.</Empty>
            )}
          </section>
          <section>
            <SectionTitle icon={FileText} title="Recent demo submissions" />
            <Rows>
              {data.recentDemos?.map((demo) => (
                <LinkedRow
                  key={demo.id}
                  to={'/missions/' + demo.mission_id}
                  title={demo.title}
                  detail={
                    (demo.submitted_by?.name || 'Unknown') +
                    ' · ' +
                    (demo.mission?.title || 'Mission') +
                    ' · ' +
                    dateLabel(demo.submitted_at)
                  }
                />
              ))}
            </Rows>
            {!data.recentDemos?.length && (
              <Empty>No demo submissions yet.</Empty>
            )}
          </section>
        </div>
        <aside className="flex min-w-0 flex-col gap-8">
          <section>
            <SectionTitle icon={Calendar} title="Coming up" />
            <Rows>
              {events.map((event) => (
                <LinkedRow
                  key={event.kind + event.id}
                  to={event.to}
                  title={event.title}
                  detail={event.kind + ' · ' + dateLabel(event.date)}
                />
              ))}
            </Rows>
            {!events.length && (
              <Empty>No upcoming meetings or demo days.</Empty>
            )}
          </section>
          <section>
            <SectionTitle icon={Award} title="Recent recognition" />
            <Rows>
              {data.recentBadges?.map((badge) => (
                <LinkedRow
                  key={badge.id}
                  to="/badges"
                  title={badge.badge?.name || 'Badge'}
                  detail={
                    (badge.cube?.user?.name || 'Unknown') +
                    ' · ' +
                    dateLabel(badge.awarded_at)
                  }
                />
              ))}
            </Rows>
            {!data.recentBadges?.length && (
              <Empty>No badges awarded yet.</Empty>
            )}
          </section>
          <section>
            <SectionTitle icon={Radar} title="Administration" />
            <Rows>
              {[
                {
                  to: '/radar',
                  title: 'Peer Radar',
                  detail: 'Growth signals and hidden gems',
                },
                {
                  to: '/admin/quests',
                  title: 'Quest administration',
                  detail: 'Assignments and rewards',
                },
                {
                  to: '/notifications',
                  title: 'Announcements',
                  detail: 'Send a programme update',
                },
                {
                  to: '/offboarding',
                  title: 'Offboarding',
                  detail: 'Graduation and certificates',
                },
                {
                  to: '/admin/testimonials',
                  title: 'Testimonials',
                  detail:
                    (data.pendingTestimonialsCount || 0) + ' pending approval',
                },
              ].map((item) => (
                <LinkedRow key={item.to} {...item} />
              ))}
            </Rows>
          </section>
        </aside>
      </div>
    </div>
  );
}

function SectionTitle({
  icon: Icon,
  title,
  count,
}: {
  icon: typeof Users;
  title: string;
  count?: number;
}) {
  return (
    <h2 className="flex items-center gap-2 text-lg font-extrabold text-gray-900">
      <Icon className="h-4 w-4 shrink-0 text-magenta" />
      {title}
      {count !== undefined && (
        <span className="ml-auto rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500">
          {count}
        </span>
      )}
    </h2>
  );
}
function LinkedRow({
  to,
  title,
  detail,
}: {
  to: string;
  title: string;
  detail: string;
}) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-3 p-4 hover:bg-gray-50"
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-extrabold text-gray-800">{title}</p>
        <p className="mt-1 text-xs leading-relaxed text-gray-500">{detail}</p>
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 text-gray-300 group-hover:text-magenta" />
    </Link>
  );
}
function Rows({ children }: { children: ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  const rows = Children.toArray(children);
  if (!rows.length) return null;
  return (
    <div className="mt-4 divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-100 bg-white">
      {expanded ? rows : rows.slice(0, 5)}
      {rows.length > 5 && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          className="w-full p-3 text-xs font-extrabold text-gray-500 hover:text-magenta"
        >
          {expanded ? 'Show fewer' : 'Show all ' + rows.length}
        </button>
      )}
    </div>
  );
}
function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="mt-4 rounded-2xl border border-dashed border-gray-200 p-5 text-sm text-gray-500">
      {children}
    </p>
  );
}
