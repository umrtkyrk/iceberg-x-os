import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { api } from '../utils/api';
import { getStatusMeta } from '../utils/missionMeta';

interface QuickStatusSelectProps {
  missionId: string;
  status: string;
  /** Legal next statuses as reported by the backend. */
  allowed: string[];
  onChanged: (updated: { status: string; allowed_next_statuses: string[] }) => void;
}

/**
 * Status pill that doubles as a dropdown, so a mentor can move a mission along
 * without opening the edit form. Safe to render inside a <Link>: clicks never
 * bubble into the navigation.
 */
export const QuickStatusSelect: React.FC<QuickStatusSelectProps> = ({ missionId, status, allowed, onChanged }) => {
  const [saving, setSaving] = useState(false);
  const meta = getStatusMeta(status);

  const stop = (e: React.SyntheticEvent) => {
    e.stopPropagation();
  };

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value;
    if (!next || next === status) return;
    setSaving(true);
    try {
      const updated = await api.patch(`/missions/${missionId}/status`, { status: next });
      onChanged(updated);
    } catch (err: any) {
      alert(err.message || 'Failed to change status');
    } finally {
      setSaving(false);
    }
  };

  // Closed missions have nowhere to go: show a plain pill
  if (!allowed || allowed.length === 0) {
    return (
      <span className={`flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full ${meta.pill}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
        {meta.label}
      </span>
    );
  }

  return (
    <span
      className={`relative inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider pl-2.5 pr-6 py-1 rounded-full ${meta.pill} ${saving ? 'opacity-60' : ''}`}
      onClick={(e) => {
        e.preventDefault();
        stop(e);
      }}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
      <span>{meta.label}</span>
      <ChevronDown className="w-3 h-3 absolute right-2 pointer-events-none" />
      <select
        aria-label="Change mission status"
        value={status}
        disabled={saving}
        onChange={handleChange}
        onClick={stop}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      >
        <option value={status}>{meta.label} (current)</option>
        {allowed.map((s) => (
          <option key={s} value={s}>
            {getStatusMeta(s).label}
          </option>
        ))}
      </select>
    </span>
  );
};
