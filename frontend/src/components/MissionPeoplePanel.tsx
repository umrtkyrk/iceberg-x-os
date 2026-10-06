import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { UserPlus, X, History } from 'lucide-react';
import { api } from '../utils/api';
import { UserAvatar } from './UserAvatar';

const ROLES = [
  ['Mission_Lead', 'Mission Lead'],
  ['Technical_Explorer', 'Technical Explorer'],
  ['Demo_Builder', 'Demo Builder'],
  ['Documenter', 'Documenter'],
  ['Presenter', 'Presenter'],
  ['Contributor', 'Contributor'],
];

const roleLabel = (role?: string) => (role || '').replace(/_/g, ' ');
const dateLabel = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' }) : '';

interface Props {
  mission: any;
  contributors: any[];
  canManage: boolean;
  /** Called after any change so the page can refetch the mission. */
  onChanged: () => void;
}

/**
 * Who is on a mission: current members, direct (team-less) assignment, and the
 * history of everyone who was on it before.
 */
export const MissionPeoplePanel: React.FC<Props> = ({ mission, contributors, canManage, onChanged }) => {
  const [cubes, setCubes] = useState<any[]>([]);
  const [cubeId, setCubeId] = useState('');
  const [role, setRole] = useState('Contributor');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canManage) return;
    api.get('/cubes?active=true').then(setCubes).catch(() => setCubes([]));
  }, [canManage]);

  const teams: any[] = mission.teams || [];
  const memberCubeIds = new Set(teams.flatMap((t) => (t.members || []).map((m: any) => m.cube_id)));
  const available = cubes.filter((c) => !memberCubeIds.has(c.id));
  const former = (contributors || []).filter((c) => !c.active);
  const closed = ['archived', 'cancelled'].includes(mission.status);

  const assign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cubeId) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/missions/${mission.id}/assignees`, { cubeProfileId: cubeId, role });
      setCubeId('');
      setRole('Contributor');
      onChanged();
    } catch (err: any) {
      setError(err.message || 'Failed to assign Cube');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (member: any) => {
    const name = member.cube?.user?.name || 'this Cube';
    if (!window.confirm(`Take ${name} off this mission? They stay in the mission history as a former contributor.`)) return;
    setError(null);
    try {
      try {
        await api.delete(`/missions/${mission.id}/assignees/${member.cube_id}`);
      } catch (err: any) {
        if (err.status === 409 && window.confirm(`${err.message}\n\nRemove anyway and delete their reflection?`)) {
          await api.delete(`/missions/${mission.id}/assignees/${member.cube_id}?force=true`);
        } else {
          throw err;
        }
      }
      onChanged();
    } catch (err: any) {
      setError(err.message || 'Failed to remove Cube');
    }
  };

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-subtle flex flex-col gap-4">
      <h3 className="font-extrabold text-lg border-b border-gray-50 pb-3 flex items-center justify-between">
        <span>People</span>
        <span className="text-xs font-bold text-gray-400">{memberCubeIds.size} on mission</span>
      </h3>

      {teams.length > 0 ? (
        <div className="flex flex-col gap-4">
          {teams.map((team) => (
            <div key={team.id} className="flex flex-col gap-2.5">
              <h4 className="font-extrabold text-xs uppercase tracking-wider text-magenta">{team.name}</h4>
              <div className="flex flex-col gap-2">
                {(team.members || []).map((m: any) => (
                  <div key={m.id} className="flex items-center gap-2.5 text-xs">
                    <UserAvatar name={m.cube?.user?.name || '?'} avatarUrl={m.cube?.user?.avatar_url} size="xs" />
                    <Link to={`/cubes/${m.cube?.id}`} className="font-bold hover:text-magenta transition-colors truncate">
                      {m.cube?.user?.name || 'Unknown'}
                    </Link>
                    <span className="ml-auto text-[10px] font-semibold text-gray-400 uppercase shrink-0">
                      {roleLabel(m.role)}
                    </span>
                    {canManage && !closed && (
                      <button
                        onClick={() => remove(m)}
                        title="Take off mission"
                        className="p-1 rounded-md text-gray-300 hover:text-red-500 hover:bg-red-50 shrink-0"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-400 text-sm py-2 text-center">No one is assigned yet.</p>
      )}

      {canManage && !closed && (
        <form onSubmit={assign} className="flex flex-col gap-2 border-t border-gray-50 pt-4">
          <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-1.5">
            <UserPlus className="w-3.5 h-3.5" /> Assign a Cube directly
          </label>
          <select
            value={cubeId}
            onChange={(e) => setCubeId(e.target.value)}
            className="p-2 bg-gray-50 border border-gray-100 rounded-lg text-xs font-semibold outline-none cursor-pointer"
          >
            <option value="">Select a Cube…</option>
            {available.map((c) => (
              <option key={c.id} value={c.id}>
                #{c.cube_number} · {c.user?.name}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="flex-1 p-2 bg-gray-50 border border-gray-100 rounded-lg text-xs font-semibold outline-none cursor-pointer"
            >
              {ROLES.map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
            <button
              type="submit"
              disabled={!cubeId || busy}
              className="px-4 py-2 bg-magenta text-white font-bold text-xs rounded-lg hover:bg-magenta-hover disabled:opacity-50"
            >
              {busy ? 'Assigning…' : 'Assign'}
            </button>
          </div>
          <p className="text-[10px] text-gray-400 font-medium">
            No team needed. If the mission has none, one is created automatically.
          </p>
        </form>
      )}

      {error && <p className="text-xs font-semibold text-red-600 bg-red-50 border border-red-100 rounded-lg p-2">{error}</p>}

      {former.length > 0 && (
        <div className="border-t border-gray-50 pt-4 flex flex-col gap-2">
          <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
            <History className="w-3.5 h-3.5" /> Previously on this mission
          </h4>
          {former.map((c) => (
            <div key={c.cube_id} className="flex items-center gap-2.5 text-xs text-gray-500">
              <UserAvatar name={c.name} avatarUrl={c.avatar_url} size="xs" className="opacity-60" />
              <Link to={`/cubes/${c.cube_id}`} className="font-semibold hover:text-magenta truncate">{c.name}</Link>
              <span className="ml-auto text-[10px] font-semibold uppercase shrink-0">
                {roleLabel(c.role)}
                {c.team_name ? ` · ${c.team_name}` : ''}
                {c.released_at ? ` · left ${dateLabel(c.released_at)}` : ''}
              </span>
            </div>
          ))}
        </div>
      )}

      {canManage && (
        <Link to="/teams" className="w-full text-center py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold hover:bg-gray-100 transition-colors">
          Manage Teams
        </Link>
      )}
    </div>
  );
};
