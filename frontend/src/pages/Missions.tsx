import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../utils/api';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Plus, Filter, ShieldAlert, ArrowUpDown, Search } from 'lucide-react';
import { QuickStatusSelect } from '../components/QuickStatusSelect';
import {
  avatarColor,
  getDifficultyMeta,
  getInitials,
  getStatusMeta,
  stripMarkdown,
  TERMINAL_MISSION_STATUSES
} from '../utils/missionMeta';

type SortKey = 'updated' | 'created' | 'title';

interface AssignedCube {
  id: string;
  name: string;
}

/**
 * Overlapping initials, capped so the row height never shifts.
 *
 * Deliberately initials-only: uploaded avatars live on the container's local
 * disk, which is wiped on every deploy, so half of them render as broken
 * images. A coloured monogram is always correct and needs no object storage.
 */
const CubeAvatarStack: React.FC<{ cubes: AssignedCube[] }> = ({ cubes }) => {
  const visible = cubes.slice(0, 4);
  const overflow = cubes.length - visible.length;

  return (
    <div className="flex -space-x-2">
      {visible.map((cube) => (
        <span
          key={cube.id}
          title={cube.name}
          className={`w-7 h-7 rounded-full ring-2 ring-white flex items-center justify-center text-[10px] font-bold text-white ${avatarColor(cube.id)}`}
        >
          {getInitials(cube.name)}
        </span>
      ))}
      {overflow > 0 && (
        <span
          title={cubes.slice(4).map((c) => c.name).join(', ')}
          className="w-7 h-7 rounded-full ring-2 ring-white bg-gray-200 text-gray-600 flex items-center justify-center text-[10px] font-bold"
        >
          +{overflow}
        </span>
      )}
    </div>
  );
};

export const Missions: React.FC = () => {
  const { user } = useAuth();
  const [missions, setMissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & sorting
  const [statusFilter, setStatusFilter] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('updated');
  const [query, setQuery] = useState('');
  const [unassignedOnly, setUnassignedOnly] = useState(false);

  const fetchMissions = async () => {
    try {
      const res = await api.get('/missions');
      setMissions(res);
    } catch (err: any) {
      setError(err.message || 'Failed to load missions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMissions();
  }, []);

  const visibleMissions = useMemo(() => {
    const filtered = missions.filter((m) => {
      // This page lists missions still in flight; finished ones live in the Vault
      if (TERMINAL_MISSION_STATUSES.includes(m.status)) return false;

      const matchesStatus = statusFilter ? m.status === statusFilter : true;
      const matchesDiff = difficultyFilter ? m.difficulty_level === difficultyFilter : true;
      const people = (m.teams || []).flatMap((t: any) => (t.members || []).map((mem: any) => mem.cube?.user?.name));
      const hasCubes = people.length > 0;
      const q = query.trim().toLowerCase();
      const matchesQuery = !q || [m.title, m.category, m.mentor?.name, ...(m.teams || []).map((t: any) => t.name), ...people]
        .some((v) => (v || '').toLowerCase().includes(q));
      return matchesStatus && matchesDiff && matchesQuery && (!unassignedOnly || !hasCubes);
    });

    const byDate = (value?: string) => (value ? new Date(value).getTime() : 0);

    return [...filtered].sort((a, b) => {
      if (sortKey === 'title') return (a.title || '').localeCompare(b.title || '', 'tr');
      if (sortKey === 'created') return byDate(b.created_at) - byDate(a.created_at);
      return byDate(b.updated_at) - byDate(a.updated_at);
    });
  }, [missions, statusFilter, difficultyFilter, sortKey, query, unassignedOnly]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-magenta border-t-transparent"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 text-red-600 border border-red-100 p-4 rounded-2xl flex items-center gap-2">
        <ShieldAlert className="w-5 h-5" />
        <span>{error}</span>
      </div>
    );
  }

  const isMentorOrAdmin = user?.role === 'ADMIN' || user?.role === 'MENTOR';

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div className="min-w-0">
          <h1 className="text-3xl font-extrabold tracking-tight">R&amp;D Missions</h1>
          <p className="text-gray-500 mt-1">Explore, prototype, and deliver active commercial-grade challenges.</p>
        </div>
        {isMentorOrAdmin && (
          <Link
            to="/missions/new"
            className="flex items-center gap-2 px-4 py-2.5 bg-magenta text-white font-bold text-xs rounded-xl hover:bg-magenta-hover transition-colors shadow-sm shadow-magenta/15 shrink-0 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>New Mission</span>
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-100 p-4 rounded-2xl shadow-subtle flex flex-wrap gap-4 items-center">
        <div className="relative flex-[2] min-w-[240px]">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search missions, cubes, teams, mentors…"
            className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl outline-none font-semibold text-xs focus:border-magenta/40"
          />
        </div>

        <div className="relative flex-1 min-w-[200px]">
          <Filter className="absolute left-3.5 top-3 w-4 h-4 text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-gray-50 hover:bg-gray-100/50 border border-gray-100 rounded-xl outline-none font-bold text-xs appearance-none cursor-pointer"
          >
            <option value="">All Active Statuses</option>
            <option value="idea_pool">Idea Pool</option>
            <option value="selected">Selected</option>
            <option value="researching">Researching</option>
            <option value="building_demo">Building Demo</option>
            <option value="preparing_handover">Preparing Handover</option>
            <option value="demo_ready">Demo Ready</option>
            <option value="pending_approval">Pending Approval</option>
          </select>
        </div>

        <div className="relative flex-1 min-w-[200px]">
          <Filter className="absolute left-3.5 top-3 w-4 h-4 text-gray-400" />
          <select
            value={difficultyFilter}
            onChange={(e) => setDifficultyFilter(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-gray-50 hover:bg-gray-100/50 border border-gray-100 rounded-xl outline-none font-bold text-xs appearance-none cursor-pointer"
          >
            <option value="">All Difficulties</option>
            <option value="Level_1_Research_Only">Level 1 - Research Only</option>
            <option value="Level_2_Research_Mock">Level 2 - Research + Mock</option>
            <option value="Level_3_Working_POC">Level 3 - Working POC</option>
            <option value="Level_4_Integration_Candidate">Level 4 - Integration Candidate</option>
            <option value="Level_5_Main_Team_Assist">Level 5 - Main Team Assist</option>
          </select>
        </div>

        <label className="flex items-center gap-2 text-xs font-bold text-gray-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={unassignedOnly}
            onChange={(e) => setUnassignedOnly(e.target.checked)}
            className="accent-magenta"
          />
          No cubes yet
        </label>
      </div>

      {/* Result count & sorting */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <p className="text-sm text-gray-500 font-semibold">
          {visibleMissions.length} active mission{visibleMissions.length === 1 ? '' : 's'}
        </p>
        <label className="flex items-center gap-2 text-xs font-bold text-gray-400">
          <ArrowUpDown className="w-3.5 h-3.5" />
          <span className="uppercase tracking-wider">Sorted by</span>
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="bg-transparent text-gray-700 font-bold outline-none cursor-pointer"
          >
            <option value="updated">Recently updated</option>
            <option value="created">Recently created</option>
            <option value="title">Title A–Z</option>
          </select>
        </label>
      </div>

      {/* Grid */}
      {visibleMissions.length > 0 ? (
        // Default `stretch` alignment: every card in a row shares the tallest
        // height, and the footer is pinned to the bottom by mt-auto above it.
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {visibleMissions.map((m) => {
            const difficulty = getDifficultyMeta(m.difficulty_level);
            const status = getStatusMeta(m.status);

            const assignedCubes: AssignedCube[] = (m.teams || [])
              .flatMap((t: any) => t.members || [])
              .map((mem: any) => ({
                id: mem.cube?.id || mem.cube_id,
                name: mem.cube?.user?.name
              }))
              .filter((c: AssignedCube) => c.id && c.name);

            const excerpt = stripMarkdown(m.description);

            return (
              <Link
                key={m.id}
                to={`/missions/${m.id}`}
                className="group flex flex-col bg-white border border-gray-100 rounded-2xl shadow-subtle overflow-hidden transition-all duration-300 hover:border-magenta/20 hover:shadow-premium"
              >
                {/* Difficulty accent */}
                <span className={`h-1 w-full shrink-0 ${difficulty.accent}`} aria-hidden="true" />

                <div className="flex-1 flex flex-col gap-3 p-5">
                  {/* Level + status */}
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md tracking-wide ${difficulty.chip}`}>
                      {difficulty.short}
                    </span>
                    <span className="text-xs font-semibold text-gray-500 truncate">
                      {difficulty.label}
                    </span>
                    <span className="ml-auto shrink-0">
                      {isMentorOrAdmin ? (
                        <QuickStatusSelect
                          missionId={m.id}
                          status={m.status}
                          allowed={m.allowed_next_statuses || []}
                          onChanged={(u) =>
                            setMissions((prev) =>
                              prev.map((x) =>
                                x.id === m.id ? { ...x, status: u.status, allowed_next_statuses: u.allowed_next_statuses } : x
                              )
                            )
                          }
                        />
                      ) : (
                        <span className={`flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full ${status.pill}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                          {status.label}
                        </span>
                      )}
                    </span>
                  </div>

                  {/* Title & excerpt: fixed heights keep every card aligned */}
                  <h3 className="font-extrabold text-gray-900 text-base leading-snug line-clamp-2 min-h-[2.75rem] transition-colors group-hover:text-magenta">
                    {m.title}
                  </h3>
                  <p className="text-xs text-gray-500 leading-relaxed line-clamp-3 min-h-[3.4rem]">
                    {excerpt || 'No description provided.'}
                  </p>

                  {/* Assigned Cubes */}
                  <div className="mt-auto pt-1 flex items-center gap-2.5 h-8">
                    {assignedCubes.length > 0 ? (
                      <>
                        <CubeAvatarStack cubes={assignedCubes} />
                        <span className="text-xs font-semibold text-gray-500">
                          {assignedCubes.length} cube{assignedCubes.length === 1 ? '' : 's'} assigned
                        </span>
                      </>
                    ) : (
                      <span className="text-xs font-semibold text-gray-400 italic">
                        No cubes assigned yet
                      </span>
                    )}
                  </div>
                </div>

                {/* Footer */}
                <div className="border-t border-gray-100 px-5 py-3.5 flex items-end justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-baseline gap-2 min-w-0">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider shrink-0">Mentor</span>
                      <span className="text-xs font-bold text-gray-700 truncate">
                        {m.mentor ? m.mentor.name : 'Unassigned'}
                      </span>
                    </p>
                    <p className="text-[10px] font-semibold text-gray-400 truncate mt-0.5">{m.category}</p>
                  </div>
                  <span className="text-xs font-bold text-magenta shrink-0 transition-transform group-hover:translate-x-1">
                    Details →
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <p className="text-gray-400 text-sm py-12 text-center bg-white border border-gray-100 rounded-2xl shadow-subtle">
          No R&amp;D missions found.
        </p>
      )}
    </div>
  );
};
