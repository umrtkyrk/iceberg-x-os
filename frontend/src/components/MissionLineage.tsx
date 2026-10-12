import React from 'react';
import { Link } from 'react-router-dom';
import { CornerDownRight, GitBranchPlus, Plus } from 'lucide-react';
import { getStatusMeta } from '../utils/missionMeta';

interface LinkedMission {
  id: string;
  title: string;
  status: string;
}

interface Props {
  missionId: string;
  predecessors: LinkedMission[];
  followups: LinkedMission[];
  /** Mentors and admins can start a follow-up from here. */
  canCreate?: boolean;
  /** Hide the whole block when there is nothing to show and no action to offer. */
  compact?: boolean;
}

const Row: React.FC<{ m: LinkedMission; onNavigate?: () => void }> = ({ m, onNavigate }) => {
  const meta = getStatusMeta(m.status);
  return (
    <Link
      to={`/missions/${m.id}`}
      onClick={onNavigate}
      className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl border border-gray-100 hover:border-magenta/30 hover:bg-magenta/5 transition-colors"
    >
      <span className="text-xs font-bold text-gray-800 truncate">{m.title}</span>
      <span className={`shrink-0 text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full ${meta.pill}`}>
        {meta.label}
      </span>
    </Link>
  );
};

/** Where a mission came from and what grew out of it. */
export const MissionLineage: React.FC<Props & { onNavigate?: () => void }> = ({
  missionId,
  predecessors,
  followups,
  canCreate,
  compact,
  onNavigate,
}) => {
  const empty = predecessors.length === 0 && followups.length === 0;
  if (empty && !canCreate) return null;
  if (empty && compact && !canCreate) return null;

  return (
    <div className="flex flex-col gap-3">
      {predecessors.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
            <CornerDownRight className="w-3.5 h-3.5" /> Continues from
          </h4>
          {predecessors.map((m) => (
            <Row key={m.id} m={m} onNavigate={onNavigate} />
          ))}
        </div>
      )}

      {followups.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
            <GitBranchPlus className="w-3.5 h-3.5" /> Follow-up missions
          </h4>
          {followups.map((m) => (
            <Row key={m.id} m={m} onNavigate={onNavigate} />
          ))}
        </div>
      )}

      {empty && <p className="text-xs text-gray-400">Not linked to any other mission yet.</p>}

      {canCreate && (
        <Link
          to={`/missions/new?continues=${missionId}`}
          onClick={onNavigate}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-100 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Create a follow-up mission
        </Link>
      )}
    </div>
  );
};
