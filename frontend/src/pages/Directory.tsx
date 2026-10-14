import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  Award,
  CheckCircle2,
  GraduationCap,
  LayoutGrid,
  List,
  RefreshCw,
  Rocket,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { PageHeader } from '../components/PageHeader';
import { UserAvatar } from '../components/UserAvatar';
import { QuizScoreBadge } from '../components/QuizScoreBadge';
import { GiveFeedbackButton } from '../components/peer/GiveFeedbackButton';
import { getLevelMeta, isInProgramme } from '../utils/cubeStatus';
import {
  activeDirectoryMissions,
  directoryOptions,
  directoryStats,
  effectiveNdaStatus,
  isArchivedCube,
  isOriginalCube,
  matchesDirectorySearch,
  type DirectoryCube,
} from '../utils/directory';

const selectClass =
  'w-full min-w-0 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-xs font-semibold text-gray-600';
type QuickFilter =
  | 'all'
  | 'programme'
  | 'senior'
  | 'noMission'
  | 'noMentor'
  | 'nda';
const ndaLabels: Record<string, string> = {
  signed: 'Signed',
  pending: 'Pending signature',
  not_sent: 'Not sent',
  not_signed: 'Not signed',
};

export function Directory() {
  const { user } = useAuth();
  const staff = user?.role === 'ADMIN' || user?.role === 'MENTOR';
  const [cubes, setCubes] = useState<DirectoryCube[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [quick, setQuick] = useState<QuickFilter>('all');
  const [level, setLevel] = useState('');
  const [skill, setSkill] = useState('');
  const [mentor, setMentor] = useState('');
  const [mission, setMission] = useState('');
  const [nda, setNda] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [sort, setSort] = useState('number');
  const [view, setView] = useState<'cards' | 'list'>('cards');
  const [limit, setLimit] = useState(24);

  const load = async () => {
    setLoading(true);
    try {
      setCubes(await api.get<DirectoryCube[]>('/cubes?includeAlumni=true'));
      setError('');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not load the directory.'
      );
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);
  useEffect(() => {
    setLimit(24);
  }, [query, quick, level, skill, mentor, mission, nda, showArchived, sort]);
  const stats = useMemo(
    () => directoryStats(cubes, user?.cubeProfileId),
    [cubes, user?.cubeProfileId]
  );
  const skills = directoryOptions(
    cubes
      .filter((cube) => !isOriginalCube(cube) && !isArchivedCube(cube))
      .flatMap((cube) => cube.skills || [])
  );
  const mentors = [
    ...new Map(
      cubes
        .filter((cube) => cube.assigned_mentor?.id)
        .map((cube) => [cube.assigned_mentor!.id, cube.assigned_mentor!])
    ).values(),
  ].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  const missions = [
    ...new Map(
      cubes
        .flatMap((cube) => activeDirectoryMissions(cube))
        .map((item) => [item.id, item])
    ).values(),
  ].sort((a, b) => a.title.localeCompare(b.title));
  const reset = () => {
    setQuery('');
    setQuick('all');
    setLevel('');
    setSkill('');
    setMentor('');
    setMission('');
    setNda('');
    setShowArchived(false);
  };
  const applyQuick = (value: QuickFilter) => {
    reset();
    setQuick(value);
  };
  const filtered = cubes
    .filter((cube) => {
      if (!showArchived && isArchivedCube(cube)) return false;
      if (level && cube.current_level !== level) return false;
      if (
        skill &&
        !(cube.skills || []).some(
          (item) => item.toLocaleLowerCase() === skill.toLocaleLowerCase()
        )
      )
        return false;
      if (
        mentor === 'none' &&
        (!isInProgramme(cube.current_level) ||
          isOriginalCube(cube) ||
          cube.assigned_mentor?.id)
      )
        return false;
      if (mentor && mentor !== 'none' && cube.assigned_mentor?.id !== mentor)
        return false;
      if (
        mission &&
        !activeDirectoryMissions(cube).some((item) => item.id === mission)
      )
        return false;
      if (nda && (isOriginalCube(cube) || effectiveNdaStatus(cube) !== nda))
        return false;
      if (
        quick !== 'all' &&
        (isOriginalCube(cube) || !isInProgramme(cube.current_level))
      )
        return false;
      if (!staff && quick === 'programme' && cube.id === user?.cubeProfileId)
        return false;
      if (quick === 'senior' && cube.current_level !== 'Senior_Cube')
        return false;
      if (quick === 'noMission' && activeDirectoryMissions(cube).length)
        return false;
      if (quick === 'noMentor' && cube.assigned_mentor?.id) return false;
      if (quick === 'nda' && effectiveNdaStatus(cube) === 'signed')
        return false;
      return matchesDirectorySearch(cube, query);
    })
    .sort((a, b) => {
      if (isOriginalCube(a) !== isOriginalCube(b))
        return isOriginalCube(a) ? -1 : 1;
      if (sort === 'name')
        return (a.user?.name || '').localeCompare(b.user?.name || '');
      if (sort === 'missions')
        return (
          activeDirectoryMissions(b).length -
            activeDirectoryMissions(a).length ||
          Number(a.cube_number) - Number(b.cube_number)
        );
      if (sort === 'badges')
        return (
          (b._count?.cube_badges || 0) - (a._count?.cube_badges || 0) ||
          Number(a.cube_number) - Number(b.cube_number)
        );
      return Number(a.cube_number || 0) - Number(b.cube_number || 0);
    });
  const statItems: {
    label: string;
    count: number;
    filter: QuickFilter;
    icon: typeof Users;
    tint: string;
  }[] = staff
    ? [
        {
          label: 'In programme',
          count: stats.programme,
          filter: 'programme',
          icon: Users,
          tint: 'text-cyan-700',
        },
        {
          label: 'Senior Cubes',
          count: stats.senior,
          filter: 'senior',
          icon: Sparkles,
          tint: 'text-magenta',
        },
        {
          label: 'Without mission',
          count: stats.noMission,
          filter: 'noMission',
          icon: Rocket,
          tint: 'text-amber-700',
        },
        {
          label: 'Without mentor',
          count: stats.noMentor,
          filter: 'noMentor',
          icon: GraduationCap,
          tint: 'text-amber-700',
        },
        {
          label: 'NDA outstanding',
          count: stats.ndaOutstanding,
          filter: 'nda',
          icon: ShieldCheck,
          tint: 'text-rose-600',
        },
      ]
    : [
        {
          label: 'Potential teammates',
          count: stats.teammates,
          filter: 'programme',
          icon: Users,
          tint: 'text-cyan-700',
        },
        {
          label: 'Senior Cubes',
          count: stats.senior,
          filter: 'senior',
          icon: Sparkles,
          tint: 'text-magenta',
        },
        {
          label: 'Without a mission',
          count: stats.noMission,
          filter: 'noMission',
          icon: Rocket,
          tint: 'text-amber-700',
        },
      ];
  const hasFilters = Boolean(
    query ||
      quick !== 'all' ||
      level ||
      skill ||
      mentor ||
      mission ||
      nda ||
      showArchived
  );
  const visiblePeopleCount = cubes.filter(
    (cube) => !isOriginalCube(cube) && (showArchived || !isArchivedCube(cube))
  ).length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={staff ? 'Programme overview' : 'Find your team'}
        title="Cube Directory"
        description={
          staff
            ? 'People, assignments, and programme readiness at a glance.'
            : 'Find Cubes by their skills, interests, and the missions they are building.'
        }
      >
        <button
          type="button"
          title="Refresh directory"
          aria-label="Refresh directory"
          disabled={loading}
          onClick={() => void load()}
          className="workspace-icon-button"
        >
          <RefreshCw className={'h-4 w-4 ' + (loading ? 'animate-spin' : '')} />
        </button>
      </PageHeader>
      <div
        className={
          'grid grid-cols-2 gap-3 ' +
          (staff ? 'lg:grid-cols-5' : 'sm:grid-cols-3')
        }
      >
        {statItems.map((item) => (
          <button
            type="button"
            key={item.label}
            onClick={() => applyQuick(item.filter)}
            disabled={loading}
            aria-pressed={quick === item.filter}
            className={
              'flex min-w-0 items-start gap-3 rounded-xl border bg-white p-4 text-left transition hover:border-magenta/30 ' +
              (quick === item.filter
                ? 'border-magenta ring-1 ring-magenta/10'
                : 'border-gray-200')
            }
          >
            <item.icon className={'mt-1 h-4 w-4 shrink-0 ' + item.tint} />
            <div className="min-w-0">
              <p className="text-2xl font-extrabold tabular-nums text-gray-900">
                {loading ? '–' : item.count}
              </p>
              <p className="mt-1 text-xs font-medium text-gray-500">
                {item.label}
              </p>
            </div>
          </button>
        ))}
      </div>
      {!loading && (
        <p className="text-xs text-gray-500">
          {stats.total} people · {stats.missions} current missions ·{' '}
          {stats.skills} skills · {stats.alumni} alumni
        </p>
      )}
      <section
        aria-label="Directory filters"
        className="flex flex-col gap-3 border-y border-gray-200 py-4"
      >
        <div className="flex flex-wrap items-center gap-3">
          <label className="relative min-w-[200px] flex-1">
            <span className="sr-only">Search Cubes</span>
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-gray-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={
                staff
                  ? 'Search name, number, skill, mentor, or mission...'
                  : 'Search name, skill, interest, or mission...'
              }
              className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-3 text-sm"
            />
          </label>
          <label>
            <span className="sr-only">Sort Cubes</span>
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value)}
              className={selectClass}
            >
              <option value="number">Cube number</option>
              <option value="name">Name A–Z</option>
              <option value="missions">Most missions</option>
              <option value="badges">Most badges</option>
            </select>
          </label>
          <div
            role="group"
            aria-label="Directory view"
            className="flex shrink-0 rounded-xl border border-gray-200 bg-white p-1"
          >
            {[
              { mode: 'cards' as const, Icon: LayoutGrid, label: 'Card view' },
              { mode: 'list' as const, Icon: List, label: 'List view' },
            ].map((item) => (
              <button
                key={item.mode}
                type="button"
                title={item.label}
                aria-label={item.label}
                aria-pressed={view === item.mode}
                onClick={() => setView(item.mode)}
                className={
                  'flex h-8 w-8 items-center justify-center rounded-lg ' +
                  (view === item.mode
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-400 hover:text-magenta')
                }
              >
                <item.Icon className="h-4 w-4" />
              </button>
            ))}
          </div>
        </div>
        <div
          className={
            'grid grid-cols-2 gap-3 ' +
            (staff ? 'lg:grid-cols-5' : 'sm:grid-cols-3')
          }
        >
          <Filter label="Level">
            <select
              aria-label="Filter by level"
              value={level}
              onChange={(event) => {
                setLevel(event.target.value);
                if (['Alumni', 'Former_Cube'].includes(event.target.value))
                  setShowArchived(true);
              }}
              className={selectClass}
            >
              <option value="">All levels</option>
              {[
                'Cube',
                'Senior_Cube',
                'Iceberger',
                'Former_Cube',
                'Alumni',
              ].map((value) => (
                <option key={value} value={value}>
                  {getLevelMeta(value).label}
                </option>
              ))}
            </select>
          </Filter>
          <Filter label="Skill">
            <select
              aria-label="Filter by skill"
              value={skill}
              onChange={(event) => setSkill(event.target.value)}
              className={selectClass}
            >
              <option value="">All skills</option>
              {skills.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </Filter>
          <Filter label="Mission">
            <select
              aria-label="Filter by mission"
              value={mission}
              onChange={(event) => setMission(event.target.value)}
              className={selectClass}
            >
              <option value="">All missions</option>
              {missions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
          </Filter>
          {staff && (
            <>
              <Filter label="Mentor">
                <select
                  aria-label="Filter by mentor"
                  value={mentor}
                  onChange={(event) => setMentor(event.target.value)}
                  className={selectClass}
                >
                  <option value="">All mentors</option>
                  <option value="none">No mentor assigned</option>
                  {mentors.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name || 'Unknown'}
                    </option>
                  ))}
                </select>
              </Filter>
              <Filter label="NDA">
                <select
                  aria-label="Filter by NDA status"
                  value={nda}
                  onChange={(event) => setNda(event.target.value)}
                  className={selectClass}
                >
                  <option value="">All NDA statuses</option>
                  {Object.entries(ndaLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Filter>
            </>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="font-semibold text-gray-500" aria-live="polite">
              {filtered.filter((cube) => !isOriginalCube(cube)).length} of{' '}
              {visiblePeopleCount} people
              {quick !== 'all' &&
                ' · ' + statItems.find((item) => item.filter === quick)?.label}
            </span>
            {hasFilters && (
              <button
                type="button"
                onClick={reset}
                className="flex items-center gap-1 font-bold text-magenta"
              >
                <X className="h-3 w-3" /> Clear filters
              </button>
            )}
          </div>
          <label className="flex items-center gap-2 text-xs font-medium text-gray-500">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(event) => {
                setShowArchived(event.target.checked);
                if (
                  !event.target.checked &&
                  ['Alumni', 'Former_Cube'].includes(level)
                )
                  setLevel('');
              }}
            />{' '}
            Show former Cubes & alumni
          </label>
        </div>
      </section>
      {error && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      {loading ? (
        <div role="status" className="flex h-48 items-center justify-center">
          <RefreshCw className="h-6 w-6 animate-spin text-magenta" />
          <span className="sr-only">Loading directory</span>
        </div>
      ) : !filtered.length ? (
        <div className="rounded-2xl border border-dashed border-gray-200 py-12 text-center">
          <p className="text-sm font-semibold text-gray-500">
            No Cubes match these filters.
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-3 text-xs font-bold text-magenta"
          >
            Clear filters
          </button>
        </div>
      ) : view === 'cards' ? (
        <div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered
            .slice(0, limit)
            .map((cube) =>
              isOriginalCube(cube) ? (
                <OriginalCube key={cube.id} />
              ) : (
                <CubeCard
                  key={cube.id}
                  cube={cube}
                  staff={staff}
                  selfId={user?.cubeProfileId}
                />
              )
            )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full min-w-[750px] text-left">
            <thead>
              <tr>
                <th>Cube</th>
                <th>Level</th>
                <th>{staff ? 'Mentor' : 'Skills'}</th>
                <th>Missions</th>
                <th>Badges</th>
                {staff && <th>NDA</th>}
                <th>
                  <span className="sr-only">Profile</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.slice(0, limit).map((cube) =>
                isOriginalCube(cube) ? (
                  <tr key={cube.id} className="bg-gray-900 text-white">
                    <td className="font-bold">Cube #000</td>
                    <td
                      colSpan={staff ? 6 : 5}
                      className="text-xs text-gray-300"
                    >
                      The Original Cube · Active · No further information
                      available.
                    </td>
                  </tr>
                ) : (
                  <tr key={cube.id} className="hover:bg-gray-50">
                    <td>
                      <Link
                        to={'/cubes/' + cube.id}
                        className="flex items-center gap-3"
                      >
                        <UserAvatar
                          name={cube.user?.name || 'Unknown'}
                          avatarUrl={cube.avatar_url || cube.user?.avatar_url}
                          size="md"
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-gray-800">
                            {cube.user?.name || 'Unknown'}
                          </p>
                          <p className="text-[11px] text-gray-400">
                            #{cube.cube_number}
                          </p>
                        </div>
                      </Link>
                    </td>
                    <td>
                      <Level cube={cube} />
                    </td>
                    <td className="max-w-[200px] text-xs text-gray-500">
                      {staff
                        ? cube.assigned_mentor?.name ||
                          (isInProgramme(cube.current_level)
                            ? 'Not assigned'
                            : '—')
                        : (cube.skills || []).slice(0, 3).join(', ') ||
                          'Not added'}
                    </td>
                    <td className="text-sm tabular-nums">
                      {activeDirectoryMissions(cube).length}
                    </td>
                    <td className="text-sm tabular-nums">
                      {cube._count?.cube_badges || 0}
                    </td>
                    {staff && (
                      <td>
                        <Nda cube={cube} />
                      </td>
                    )}
                    <td>
                      <Link
                        to={'/cubes/' + cube.id}
                        title="View profile"
                        aria-label={
                          'View ' + (cube.user?.name || 'Cube') + ' profile'
                        }
                        className="text-magenta"
                      >
                        <ArrowUpRight className="h-4 w-4" />
                      </Link>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      )}
      {!loading && filtered.length > limit && (
        <button
          type="button"
          onClick={() => setLimit((value) => value + 24)}
          className="self-center rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-xs font-bold text-gray-600"
        >
          Show more ({filtered.length - limit} remaining)
        </button>
      )}
    </div>
  );
}

function CubeCard({
  cube,
  staff,
  selfId,
}: {
  cube: DirectoryCube;
  staff: boolean;
  selfId?: string;
}) {
  const missions = activeDirectoryMissions(cube);
  const programme = isInProgramme(cube.current_level);
  return (
    <article
      className={
        'flex min-w-0 flex-col overflow-hidden rounded-xl border bg-white transition hover:border-gray-300 ' +
        (cube.is_founding_cube ? 'border-amber-200' : 'border-gray-200')
      }
    >
      <div className="flex flex-col gap-4 p-5">
        <div className="flex min-h-[4rem] items-start gap-3">
          <UserAvatar
            name={cube.user?.name || 'Unknown'}
            avatarUrl={cube.avatar_url || cube.user?.avatar_url}
            size="card"
          />
          <div className="min-w-0 flex-1">
            <Link
              to={'/cubes/' + cube.id}
              className="line-clamp-2 min-h-[2.75rem] text-base font-extrabold leading-snug text-gray-900 hover:text-magenta"
            >
              {cube.user?.name || 'Unknown'}
            </Link>
            <p className="mt-1 text-[11px] text-gray-400">
              #{cube.cube_number} · {cube.cohort || 'Cohort not set'}
            </p>
          </div>
          {cube.is_founding_cube && (
            <span title="Founding Cube" aria-label="Founding Cube">
              <Award className="h-4 w-4 shrink-0 text-amber-500" />
            </span>
          )}
        </div>
        <div className="flex min-h-[1.75rem] flex-wrap items-center gap-2">
          <Level cube={cube} />
          {staff && <Nda cube={cube} />}
        </div>
        <div className="h-[4.5rem] overflow-hidden">
          <p className="mb-2 text-[10px] font-bold uppercase text-gray-400">
            Skills
          </p>
          <div className="flex flex-wrap gap-1.5">
            {(cube.skills || []).slice(0, 3).map((item, index) => (
              <span
                key={item + index}
                title={item}
                className="max-w-full truncate rounded-md bg-gray-100 px-2 py-1 text-[11px] font-semibold text-gray-600"
              >
                {item}
              </span>
            ))}
            {(cube.skills?.length || 0) > 3 && (
              <span
                title={(cube.skills || []).slice(3).join(', ')}
                className="py-1 text-[11px] text-gray-400"
              >
                +{(cube.skills?.length || 0) - 3}
              </span>
            )}
            {!cube.skills?.length && (
              <span className="text-xs text-gray-400">
                Skills not added yet
              </span>
            )}
          </div>
        </div>
        <div className="min-h-[3.75rem] border-t border-gray-100 pt-3 text-xs">
          {staff ? (
            <>
              <p className="font-semibold text-gray-600">
                Mentor:{' '}
                <span
                  className={
                    !cube.assigned_mentor?.name && programme
                      ? 'text-amber-700'
                      : 'text-gray-500'
                  }
                >
                  {cube.assigned_mentor?.name ||
                    (programme ? 'Not assigned' : 'Not in programme')}
                </span>
              </p>
              <p
                title={cube.university}
                className="mt-1 truncate text-gray-400"
              >
                {cube.university || 'University not added'}
              </p>
            </>
          ) : (
            <>
              <p className="text-[10px] font-bold uppercase text-gray-400">
                Interests
              </p>
              <p className="mt-1 line-clamp-2 text-gray-500">
                {(cube.interests || []).join(', ') || 'Not added yet'}
              </p>
            </>
          )}
        </div>
        <div className="min-h-[5.75rem] border-t border-gray-100 pt-3">
          <p className="mb-2 text-[10px] font-bold uppercase text-gray-400">
            {programme
              ? 'Current missions'
              : getLevelMeta(cube.current_level).hint}
          </p>
          {missions.length ? (
            <div className="space-y-1">
              {missions.slice(0, 2).map((item) => (
                <Link
                  key={item.id}
                  to={'/missions/' + item.id}
                  title={item.title}
                  className="block truncate text-xs font-semibold text-magenta hover:underline"
                >
                  {item.title}
                </Link>
              ))}
              {missions.length > 2 && (
                <Link
                  to={'/cubes/' + cube.id}
                  className="text-[11px] text-gray-400"
                >
                  +{missions.length - 2} more
                </Link>
              )}
            </div>
          ) : (
            <p
              className={
                'text-xs ' + (programme ? 'text-amber-700' : 'text-gray-400')
              }
            >
              {programme ? 'No active mission yet' : 'Outside the programme'}
            </p>
          )}
        </div>
      </div>
      <div className="mt-auto flex min-h-[2.75rem] flex-wrap items-center justify-between gap-2 border-t border-gray-100 px-5 py-3 text-[11px] text-gray-500">
        <span className="flex items-center gap-1.5">
          <Rocket className="h-3.5 w-3.5" /> {missions.length} missions
        </span>
        <span className="flex items-center gap-1.5">
          <Award className="h-3.5 w-3.5" /> {cube._count?.cube_badges || 0}{' '}
          badges
        </span>
        {staff && cube.quiz_attempts?.[0] && (
          <QuizScoreBadge
            score={cube.quiz_attempts[0].score}
            badgeName={cube.quiz_attempts[0].badge_awarded?.name}
            rarity={cube.quiz_attempts[0].badge_awarded?.rarity}
            variant="pill"
          />
        )}
      </div>
      <div className="flex min-h-[3.5rem] flex-wrap items-center justify-between gap-2 border-t border-gray-100 px-5 py-3">
        <Link
          to={'/cubes/' + cube.id}
          className="flex items-center gap-1 text-xs font-bold text-gray-700 hover:text-magenta"
        >
          View profile <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
        {!staff && programme && cube.id !== selfId && (
          <GiveFeedbackButton
            receiver={{
              id: cube.id,
              name: cube.user?.name || 'Unknown',
              avatarUrl: cube.avatar_url || cube.user?.avatar_url,
            }}
            variant="soft"
            label="Give feedback"
          />
        )}
      </div>
    </article>
  );
}
function Level({ cube }: { cube: DirectoryCube }) {
  const colors: Record<string, string> = {
    Cube: 'bg-gray-100 text-gray-600',
    Senior_Cube: 'bg-magenta/5 text-magenta',
    Iceberger: 'bg-cyan-50 text-cyan-700',
    Former_Cube: 'bg-gray-100 text-gray-400',
    Alumni: 'bg-amber-50 text-amber-700',
  };
  return (
    <span
      className={
        'inline-flex rounded-md px-2 py-1 text-[10px] font-bold ' +
        (colors[cube.current_level || ''] || colors.Cube)
      }
    >
      {getLevelMeta(cube.current_level).label}
    </span>
  );
}
function Nda({ cube }: { cube: DirectoryCube }) {
  const status = effectiveNdaStatus(cube);
  return (
    <span
      className={
        'inline-flex items-center gap-1 text-[10px] font-semibold ' +
        (status === 'signed' ? 'text-emerald-700' : 'text-amber-700')
      }
    >
      <ShieldCheck className="h-3 w-3" /> NDA {ndaLabels[status] || 'Unknown'}
    </span>
  );
}
function Filter({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="min-w-0">
      <span className="mb-1.5 block text-[10px] font-bold uppercase text-gray-400">
        {label}
      </span>
      {children}
    </label>
  );
}
function OriginalCube() {
  return (
    <article className="flex min-h-[360px] flex-col rounded-xl border border-gray-800 bg-[#14141c] p-6 text-white">
      <p className="text-[10px] font-bold uppercase text-magenta">
        Classified record
      </p>
      <h2 className="mt-4 text-3xl font-black">Cube #000</h2>
      <p className="mt-3 flex items-center gap-2 text-xs text-emerald-300">
        <CheckCircle2 className="h-3.5 w-3.5" /> Active
      </p>
      <div className="mt-auto pt-8">
        <p className="text-[10px] uppercase text-white/40">Classification</p>
        <p className="mt-2 text-lg font-bold">The Original Cube</p>
        <p className="mt-4 text-sm leading-relaxed text-white/50">
          No further information available.
        </p>
      </div>
    </article>
  );
}
