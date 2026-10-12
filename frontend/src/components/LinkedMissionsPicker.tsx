import React, { useEffect, useMemo, useState } from 'react';
import { Link2, Search, X } from 'lucide-react';
import { api } from '../utils/api';
import { getStatusMeta, TERMINAL_MISSION_STATUSES } from '../utils/missionMeta';

export interface LinkedMissionRef {
  id: string;
  title: string;
  status?: string;
}

interface Props {
  value: LinkedMissionRef[];
  onChange: (next: LinkedMissionRef[]) => void;
  /** Mission being edited; it cannot link to itself. */
  excludeId?: string;
  disabled?: boolean;
  max?: number;
}

/** Picks the earlier missions this one continues. Finished (Vault) missions are listed first. */
export const LinkedMissionsPicker: React.FC<Props> = ({ value, onChange, excludeId, disabled, max = 5 }) => {
  const [all, setAll] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    api.get('/missions').then((res) => setAll(Array.isArray(res) ? res : [])).catch(() => setAll([]));
  }, []);

  const options = useMemo(() => {
    const picked = new Set(value.map((v) => v.id));
    const q = query.trim().toLowerCase();
    return all
      .filter((m) => m.id !== excludeId && !picked.has(m.id))
      .filter((m) => !q || (m.title || '').toLowerCase().includes(q) || (m.category || '').toLowerCase().includes(q))
      .sort((a, b) => {
        const av = TERMINAL_MISSION_STATUSES.includes(a.status) ? 0 : 1;
        const bv = TERMINAL_MISSION_STATUSES.includes(b.status) ? 0 : 1;
        return av - bv || (a.title || '').localeCompare(b.title || '');
      })
      .slice(0, 30);
  }, [all, value, query, excludeId]);

  const full = value.length >= max;

  return (
    <div className="flex flex-col gap-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((m) => (
            <span
              key={m.id}
              className="inline-flex items-center gap-1.5 max-w-full bg-magenta/5 border border-magenta/15 text-magenta rounded-full pl-3 pr-1.5 py-1 text-xs font-bold"
            >
              <Link2 className="w-3 h-3 shrink-0" />
              <span className="truncate">{m.title}</span>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(value.filter((v) => v.id !== m.id))}
                aria-label={`Remove link to ${m.title}`}
                className="p-0.5 rounded-full hover:bg-magenta/10 shrink-0"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3.5 top-3 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={query}
          disabled={disabled || full}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          placeholder={full ? `Up to ${max} linked missions` : 'Search earlier missions to link…'}
          className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:border-magenta focus:bg-white text-xs font-semibold"
        />
        {open && !full && (
          <div className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto bg-white border border-gray-100 rounded-xl shadow-premium">
            {options.length === 0 ? (
              <p className="p-3 text-xs text-gray-400 font-semibold">No missions found.</p>
            ) : (
              options.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onChange([...value, { id: m.id, title: m.title, status: m.status }]);
                    setQuery('');
                  }}
                  className="w-full text-left flex items-center justify-between gap-3 px-3 py-2 hover:bg-gray-50 text-xs"
                >
                  <span className="font-bold text-gray-800 truncate">{m.title}</span>
                  <span
                    className={`shrink-0 text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full ${getStatusMeta(m.status).pill}`}
                  >
                    {getStatusMeta(m.status).label}
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};
