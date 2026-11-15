import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronDown, Mail, Users } from 'lucide-react';
import { api } from '../../utils/api';
import { getStatusMeta } from '../../utils/missionMeta';
import {
  STATUS_COPY,
  describeForMentor,
  relativeDay,
  sortForMentor,
  type CubeSignals,
  type SignalStatus,
} from '../../utils/cubeSignals';
import { UserAvatar } from '../UserAvatar';

interface MentorCubesResponse {
  scope: 'mine' | 'all';
  can_view_all: boolean;
  assigned_count: number;
  cubes: CubeSignals[];
}

type Filter = 'all' | SignalStatus;
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'quiet', label: 'Quiet' },
  { key: 'needs_attention', label: 'Needs attention' },
  { key: 'on_track', label: 'On track' },
];
const COLLAPSED_ROWS = 8;

/**
 * The mentor's Cubes, from the same signals each Cube sees on their focus
 * panel, ordered so the ones that need a nudge come first.
 */
export const MyCubesPanel: React.FC = () => {
  const [data, setData] = useState<MentorCubesResponse | null>(null);
  const [scope, setScope] = useState<'mine' | 'all' | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .get<MentorCubesResponse>(`/mentor/cubes${scope ? `?scope=${scope}` : ''}`)
      .then(res => {
        if (cancelled) return;
        setData(res);
        setFailed(false);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [scope]);

  const sorted = useMemo(() => sortForMentor(data?.cubes || []), [data]);
  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: sorted.length, quiet: 0, needs_attention: 0, on_track: 0 };
    for (const cube of sorted) c[cube.status]++;
    return c;
  }, [sorted]);

  if (failed) {
    return (
      <p className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-600">
        Could not load your Cubes. Refresh to try again.
      </p>
    );
  }
  if (!data) {
    return <div className="h-40 animate-pulse rounded-3xl border border-gray-100 bg-white" />;
  }

  const visible = filter === 'all' ? sorted : sorted.filter(c => c.status === filter);
  const shown = showAll ? visible : visible.slice(0, COLLAPSED_ROWS);

  return (
    <section aria-labelledby="my-cubes-heading" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="my-cubes-heading" className="flex items-center gap-2 text-xl font-extrabold tracking-tight text-gray-900">
          <Users className="h-5 w-5 text-magenta" />
          {data.scope === 'all' ? 'All Cubes' : 'My Cubes'}
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-black text-gray-500">{sorted.length}</span>
        </h2>
        {data.can_view_all && (
          <div role="radiogroup" aria-label="Which Cubes" className="flex rounded-xl bg-gray-100 p-1 text-xs font-bold">
            {(['mine', 'all'] as const).map(option => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={data.scope === option}
                onClick={() => setScope(option)}
                className={`rounded-lg px-3 py-1.5 transition-colors ${
                  data.scope === option ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                {option === 'mine' ? `Mine (${data.assigned_count})` : 'Whole programme'}
              </button>
            ))}
          </div>
        )}
      </div>

      {sorted.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center text-sm font-semibold text-gray-400">
          No Cubes are assigned to you.
        </p>
      ) : (
        <div className="flex flex-col rounded-3xl border border-gray-100 bg-white shadow-subtle">
          <div role="tablist" aria-label="Filter by status" className="flex flex-wrap gap-1.5 border-b border-gray-50 p-3">
            {FILTERS.map(f => {
              const active = filter === f.key;
              const dot = f.key === 'all' ? null : STATUS_COPY[f.key].dot;
              return (
                <button
                  key={f.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    setFilter(f.key);
                    setShowAll(false);
                  }}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
                    active ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  {dot && <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />}
                  {f.label}
                  <span className={active ? 'text-white/70' : 'text-gray-400'}>{counts[f.key]}</span>
                </button>
              );
            })}
          </div>

          {visible.length === 0 ? (
            <p className="p-8 text-center text-sm font-semibold text-gray-400">No Cubes in this group.</p>
          ) : (
            <ul className="divide-y divide-gray-50">
              {shown.map(cube => (
                <CubeRow
                  key={cube.cube_profile_id}
                  cube={cube}
                  open={expanded === cube.cube_profile_id}
                  onToggle={() => setExpanded(current => (current === cube.cube_profile_id ? null : cube.cube_profile_id))}
                />
              ))}
            </ul>
          )}

          {visible.length > COLLAPSED_ROWS && (
            <button
              type="button"
              onClick={() => setShowAll(v => !v)}
              className="flex items-center justify-center gap-1.5 border-t border-gray-50 py-3 text-xs font-extrabold text-gray-500 hover:text-magenta"
            >
              {showAll ? 'Show fewer' : `Show all ${visible.length}`}
              <ChevronDown className={`h-3.5 w-3.5 transition ${showAll ? 'rotate-180' : ''}`} />
            </button>
          )}
        </div>
      )}
    </section>
  );
};

const CubeRow: React.FC<{ cube: CubeSignals; open: boolean; onToggle: () => void }> = ({ cube, open, onToggle }) => {
  const status = STATUS_COPY[cube.status];
  const reasons = cube.items.map(item => describeForMentor(item));
  const mission = cube.missions[0];
  const blocker = cube.items.find(item => item.kind === 'open_blocker');

  return (
    <li className="p-4 sm:px-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-5">
        {/* Who and why */}
        <button type="button" onClick={onToggle} aria-expanded={open} className="flex min-w-0 flex-1 items-start gap-3 text-left">
          <UserAvatar name={cube.name} avatarUrl={cube.avatar_url} size="md" />
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className="truncate text-sm font-extrabold text-gray-900">{cube.name}</span>
              <span className="text-[11px] font-semibold text-gray-400">#{cube.cube_number}</span>
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-extrabold ${status.pill}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
                {status.label}
              </span>
            </span>
            <span className="mt-1 block text-xs font-medium text-gray-500">
              {reasons.length === 0 ? (
                'Nothing waiting.'
              ) : (
                <>
                  {reasons.slice(0, 2).join(' · ')}
                  {reasons.length > 2 && <span className="font-bold text-gray-400"> · +{reasons.length - 2} more</span>}
                </>
              )}
            </span>
          </span>
          <ChevronDown className={`mt-1 h-4 w-4 shrink-0 text-gray-400 transition lg:hidden ${open ? 'rotate-180' : ''}`} />
        </button>

        {/* At a glance */}
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4 lg:w-[30rem] lg:shrink-0">
          <Glance label="Mission" value={mission ? mission.title : 'None'} hint={mission ? getStatusMeta(mission.status).label : undefined} />
          <Glance label="Last update" value={capitalise(relativeDay(cube.last_update?.at))} />
          <Glance label="Active (7d)" value={`${cube.activity.active_days_7} / 7`} hint={`${cube.activity.active_days_30} / 30 days`} />
          <Glance label="Your feedback" value={capitalise(relativeDay(cube.last_feedback_at))} />
        </dl>

        <ChevronDown
          onClick={onToggle}
          className={`hidden h-4 w-4 shrink-0 cursor-pointer text-gray-400 transition lg:block ${open ? 'rotate-180' : ''}`}
        />
      </div>

      {open && (
        <div className="mt-3 flex flex-col gap-3 rounded-2xl bg-gray-50 p-4 lg:ml-12">
          {reasons.length > 0 && (
            <ul className="flex flex-col gap-1.5 text-xs font-semibold text-gray-700">
              {reasons.map(reason => (
                <li key={reason} className="flex items-start gap-2">
                  <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${status.dot}`} />
                  {reason}
                </li>
              ))}
            </ul>
          )}
          {blocker && blocker.kind === 'open_blocker' && (
            <p className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
              “{blocker.blockers}”
            </p>
          )}
          <p className="text-[11px] font-medium text-gray-400">
            Last seen {relativeDay(cube.activity.last_active_at)} · last contribution {relativeDay(cube.activity.last_contribution_at)}
            {cube.next_meeting && ` · next meeting ${relativeDay(cube.next_meeting.date)}`}
          </p>
          <div className="flex flex-wrap gap-2">
            <a
              href={`mailto:${cube.email}`}
              className="inline-flex items-center gap-1.5 rounded-xl bg-magenta px-3 py-2 text-xs font-extrabold text-white hover:bg-magenta-hover"
            >
              <Mail className="h-3.5 w-3.5" /> Email {cube.name.split(' ')[0]}
            </a>
            <Link
              to={`/cubes/${cube.cube_profile_id}`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-extrabold text-gray-700 hover:border-gray-300"
            >
              Profile <ArrowRight className="h-3 w-3" />
            </Link>
            {mission && (
              <Link
                to={`/missions/${mission.id}`}
                className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-extrabold text-gray-700 hover:border-gray-300"
              >
                Mission <ArrowRight className="h-3 w-3" />
              </Link>
            )}
          </div>
        </div>
      )}
    </li>
  );
};

const capitalise = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

const Glance: React.FC<{ label: string; value: string; hint?: string }> = ({ label, value, hint }) => (
  <div className="min-w-0">
    <dt className="font-semibold text-gray-400">{label}</dt>
    <dd className="truncate font-extrabold text-gray-900" title={value}>{value}</dd>
    {hint && <dd className="truncate text-[11px] font-medium text-gray-400">{hint}</dd>}
  </div>
);
