import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  HeartHandshake,
  Info,
  Lock,
  MessageSquareQuote,
  Users
} from 'lucide-react';
import { api } from '../../utils/api';
import { UserAvatar } from '../UserAvatar';

/**
 * Mentors and admins can read what was written about a Cube: the kind, the
 * tags, the note and which mission it was about. They can never see who wrote
 * it, and nothing on this page can identify the writer.
 */

export interface StaffFeedbackItem {
  id: string;
  kind: 'KUDOS' | 'OBSERVATION' | 'CONCERN';
  tags: { key: string; label: string }[];
  note: string | null;
  context: { type: string; label: string | null };
  strength: 'shared_work' | 'shared_meeting' | 'none';
  dismissed: boolean;
  counts_toward_score: boolean;
  created_at: string;
  receiver?: { id: string; name: string; cube_number: string; avatar_url: string | null };
}

const KIND = {
  KUDOS: {
    label: 'Kudos',
    icon: HeartHandshake,
    bar: 'bg-gradient-to-b from-magenta to-amber-400',
    pill: 'bg-magenta/10 text-magenta'
  },
  OBSERVATION: {
    label: "Couldn't see their work",
    icon: Eye,
    bar: 'bg-gradient-to-b from-sky-400 to-indigo-500',
    pill: 'bg-sky-50 text-sky-700'
  },
  CONCERN: {
    label: 'Concern',
    icon: AlertTriangle,
    bar: 'bg-gradient-to-b from-amber-400 to-rose-500',
    pill: 'bg-amber-50 text-amber-700'
  }
} as const;

const STRENGTH: Record<StaffFeedbackItem['strength'], string> = {
  shared_work: 'Worked together',
  shared_meeting: 'Met in a meeting',
  none: 'No shared work'
};

export const StaffFeedbackCard: React.FC<{ item: StaffFeedbackItem }> = ({ item }) => {
  const kind = KIND[item.kind];
  const Icon = kind.icon;
  const date = new Date(item.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <article className="relative flex gap-4 overflow-hidden rounded-2xl border border-gray-100 bg-white p-5 pl-6 shadow-subtle">
      <span className={`absolute inset-y-0 left-0 w-1.5 ${kind.bar}`} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${kind.pill}`}>
              <Icon className="h-3 w-3" /> {kind.label}
            </span>
            {item.receiver && (
              <Link
                to={`/cubes/${item.receiver.id}`}
                className="flex items-center gap-2 rounded-full bg-gray-50 py-0.5 pl-0.5 pr-3 text-xs font-extrabold text-gray-800 transition hover:text-magenta"
              >
                <UserAvatar name={item.receiver.name} avatarUrl={item.receiver.avatar_url} size="xs" />
                {item.receiver.name}
                <span className="font-bold text-gray-400">#{item.receiver.cube_number}</span>
              </Link>
            )}
          </div>
          <span className="text-[11px] font-bold text-gray-400">{date}</span>
        </div>

        {item.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {item.tags.map(t => (
              <span key={t.key} className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-extrabold text-gray-700">
                {t.label}
              </span>
            ))}
          </div>
        )}

        {item.note ? (
          <blockquote className="mt-3 flex gap-2.5 text-sm font-medium leading-relaxed text-gray-700">
            <MessageSquareQuote className="mt-0.5 h-4 w-4 shrink-0 text-gray-300" />
            <span className="whitespace-pre-wrap">{item.note}</span>
          </blockquote>
        ) : (
          <p className="mt-3 text-xs font-semibold italic text-gray-400">No written note, tags only.</p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-gray-50 pt-3 text-[11px] font-bold text-gray-500">
          <span className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-gray-300" />
            {item.context.label ? `${item.context.label} · ` : ''}
            {STRENGTH[item.strength]}
          </span>
          {item.dismissed ? (
            <span className="flex items-center gap-1.5 text-amber-600">
              <Info className="h-3.5 w-3.5" /> Reviewed: not confirmed
            </span>
          ) : item.counts_toward_score ? (
            <span className="flex items-center gap-1.5 text-emerald-600">
              <CheckCircle2 className="h-3.5 w-3.5" /> Counts toward the score
            </span>
          ) : item.kind === 'KUDOS' ? null : (
            <span className="flex items-center gap-1.5 text-gray-400">
              <Info className="h-3.5 w-3.5" />
              {item.kind === 'OBSERVATION'
                ? 'A signal, never part of the score'
                : item.strength === 'none'
                ? 'Not counted: no shared work'
                : 'Not counted yet: needs 3 independent people'}
            </span>
          )}
        </div>
      </div>
    </article>
  );
};

const AnonymityNote: React.FC = () => (
  <p className="flex items-start gap-2 rounded-xl bg-slate-50 px-3.5 py-2.5 text-[11px] font-semibold leading-relaxed text-slate-500">
    <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
    You can read what was written, never who wrote it. Please treat it that way: do not try to work out the writer, and
    do not quote a note back to the Cubes who might have written it.
  </p>
);

/** Everything written about one Cube, for their profile (staff only). */
export const CubeFeedbackPanel: React.FC<{ cubeId: string; name: string }> = ({ cubeId, name }) => {
  const [data, setData] = useState<{ summary: any; items: StaffFeedbackItem[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    api
      .get(`/radar/cubes/${cubeId}/feedback`)
      .then(setData)
      .catch((err: any) => setError(err.message || 'Could not load peer feedback.'));
  }, [cubeId]);

  if (error) return null;
  if (!data) return <div className="h-24 animate-pulse rounded-2xl border border-gray-100 bg-white" />;

  const { summary, items } = data;
  const shown = showAll ? items : items.slice(0, 4);

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-gray-100 bg-white p-6 shadow-subtle">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-lg font-extrabold">
          <MessageSquareQuote className="h-5 w-5 text-magenta" />
          <span>Peer feedback about {name.split(' ')[0]}</span>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-gray-500">
            mentors only
          </span>
        </h3>
        <p className="text-xs font-bold text-gray-500">
          {summary.kudos} kudos · {summary.observations} observations · {summary.concerns} concerns
        </p>
      </header>

      <AnonymityNote />

      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-200 p-5 text-center text-xs font-semibold text-gray-400">
          Nobody has written anything about {name.split(' ')[0]} yet.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {shown.map(item => (
            <StaffFeedbackCard key={item.id} item={item} />
          ))}
        </div>
      )}

      {items.length > 4 && (
        <button
          onClick={() => setShowAll(v => !v)}
          className="self-start text-xs font-extrabold text-magenta hover:underline"
        >
          {showAll ? 'Show fewer' : `Show all ${items.length}`}
        </button>
      )}
    </section>
  );
};

const FILTERS = [
  { key: '', label: 'All' },
  { key: 'KUDOS', label: 'Kudos' },
  { key: 'OBSERVATION', label: "Couldn't see their work" },
  { key: 'CONCERN', label: 'Concerns' }
] as const;

/** A feed of everything written, newest first, for the Radar. */
export const FeedbackFeed: React.FC = () => {
  const [kind, setKind] = useState<string>('');
  const [items, setItems] = useState<StaffFeedbackItem[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (reset: boolean, before?: string | null) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ take: '20' });
        if (kind) params.set('kind', kind);
        if (!reset && before) params.set('before', before);
        const res = await api.get(`/radar/feedback?${params.toString()}`);
        setItems(prev => (reset ? res.items : [...prev, ...res.items]));
        setNext(res.next);
        setError(null);
      } catch (err: any) {
        setError(err.message || 'Could not load feedback.');
      } finally {
        setLoading(false);
      }
    },
    [kind]
  );

  useEffect(() => {
    load(true);
  }, [load]);

  return (
    <section className="flex flex-col gap-5">
      <AnonymityNote />

      <div className="flex flex-wrap gap-2">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setKind(f.key)}
            className={`rounded-xl px-3.5 py-2 text-xs font-extrabold transition ${
              kind === f.key ? 'bg-slate-900 text-white shadow-subtle' : 'bg-white text-slate-500 ring-1 ring-gray-100 hover:text-slate-900'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <p className="flex items-center gap-2 rounded-xl bg-rose-50 px-4 py-3 text-xs font-bold text-rose-700">
          <Info className="h-4 w-4" /> {error}
        </p>
      )}

      {items.length === 0 && !loading ? (
        <p className="rounded-2xl border border-dashed border-gray-200 bg-white p-10 text-center text-sm font-semibold text-gray-400">
          Nothing has been written yet.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {items.map(item => (
            <StaffFeedbackCard key={item.id} item={item} />
          ))}
        </div>
      )}

      {loading && <div className="h-10 animate-pulse rounded-xl bg-white" />}

      {next && !loading && (
        <button
          onClick={() => load(false, next)}
          className="self-center rounded-xl bg-white px-5 py-2.5 text-xs font-extrabold text-slate-700 ring-1 ring-gray-200 transition hover:text-magenta"
        >
          Load older feedback
        </button>
      )}
    </section>
  );
};
