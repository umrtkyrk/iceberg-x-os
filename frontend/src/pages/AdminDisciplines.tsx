import React, { useEffect, useMemo, useState } from 'react';
import { Check, Plus, Sparkles } from 'lucide-react';
import { api } from '../utils/api';
import { PageHeader } from '../components/PageHeader';
import { formatEnum } from '../utils/missionMeta';

/**
 * Scoring v2 disciplines: manage the list (add, rename, deactivate) and assign
 * a discipline to every Cube and mission. Suggestions are shown with their
 * reason; nothing is assigned until an admin saves.
 */
interface Discipline {
  id: string;
  key: string;
  name: string;
  description: string | null;
  active: boolean;
  sort_order: number;
  _count: { cubes: number; missions: number };
}
interface Suggestion {
  discipline_id: string;
  reason: string;
}
interface CubeRow {
  id: string;
  name: string;
  cube_number: string;
  department: string;
  current_level: string;
  discipline_id: string | null;
  suggestion: Suggestion | null;
}
interface MissionRow {
  id: string;
  title: string;
  category: string;
  status: string;
  discipline_id: string | null;
  suggestion: Suggestion | null;
}
type Tab = 'disciplines' | 'cubes' | 'missions';

export const AdminDisciplines: React.FC = () => {
  const [tab, setTab] = useState<Tab>('cubes');
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [cubes, setCubes] = useState<CubeRow[]>([]);
  const [missions, setMissions] = useState<MissionRow[]>([]);
  /** Unsaved choices: row id -> discipline id ('' = clear). */
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  const load = async () => {
    try {
      const [list, assignments] = await Promise.all([
        api.get<Discipline[]>('/admin/disciplines'),
        api.get<{ cubes: CubeRow[]; missions: MissionRow[] }>('/admin/disciplines/assignments'),
      ]);
      setDisciplines(list);
      setCubes(assignments.cubes);
      setMissions(assignments.missions);
      setDraft({});
    } catch (err: any) {
      setMessage({ tone: 'error', text: err.message || 'Could not load disciplines.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const nameById = useMemo(() => new Map(disciplines.map(d => [d.id, d.name])), [disciplines]);
  const activeDisciplines = disciplines.filter(d => d.active);
  const rows = tab === 'missions' ? missions : cubes;
  const unassigned = rows.filter(r => !r.discipline_id).length;
  const pendingSuggestions = rows.filter(r => !r.discipline_id && r.suggestion && draft[r.id] === undefined);
  const changes = Object.entries(draft).filter(([id, value]) => {
    const row = rows.find(r => r.id === id);
    return row && (row.discipline_id || '') !== value;
  });

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const payload = changes.map(([id, value]) => ({ id, discipline_id: value || null }));
      await api.post('/admin/disciplines/assignments', tab === 'missions' ? { missions: payload } : { cubes: payload });
      setMessage({ tone: 'ok', text: `Saved ${payload.length} ${payload.length === 1 ? 'change' : 'changes'}.` });
      await load();
    } catch (err: any) {
      setMessage({ tone: 'error', text: err.message || 'Could not save.' });
    } finally {
      setSaving(false);
    }
  };

  const acceptSuggestions = () =>
    setDraft(prev => {
      const next = { ...prev };
      for (const row of pendingSuggestions) next[row.id] = row.suggestion!.discipline_id;
      return next;
    });

  const switchTab = (next: Tab) => {
    if (changes.length > 0 && !window.confirm('Discard unsaved changes on this tab?')) return;
    setDraft({});
    setMessage(null);
    setTab(next);
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Scoring v2"
        title="Disciplines"
        description="Every Cube and mission belongs to a discipline, which decides the scorecard criteria. Suggestions are only applied when you save."
      />

      <div role="tablist" className="flex flex-wrap gap-2">
        {([
          ['cubes', `Cubes (${cubes.filter(c => !c.discipline_id).length} unassigned)`],
          ['missions', `Missions (${missions.filter(m => !m.discipline_id).length} unassigned)`],
          ['disciplines', `Disciplines (${disciplines.length})`],
        ] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => switchTab(key)}
            className={`rounded-full px-4 py-2 text-xs font-extrabold transition-colors ${
              tab === key ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {message && (
        <p
          role="status"
          className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${
            message.tone === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {message.text}
        </p>
      )}

      {loading ? (
        <div className="h-48 animate-pulse rounded-3xl border border-gray-100 bg-white" />
      ) : tab === 'disciplines' ? (
        <DisciplineList disciplines={disciplines} onChanged={load} onError={text => setMessage({ tone: 'error', text })} />
      ) : (
        <section className="flex flex-col rounded-3xl border border-gray-100 bg-white shadow-subtle">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-50 p-4">
            <p className="text-xs font-semibold text-gray-500">
              {unassigned} of {rows.length} without a discipline
              {changes.length > 0 && <span className="font-extrabold text-magenta"> · {changes.length} unsaved</span>}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={acceptSuggestions}
                disabled={pendingSuggestions.length === 0}
                className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-extrabold text-gray-700 hover:border-gray-300 disabled:opacity-40"
              >
                <Sparkles className="h-3.5 w-3.5 text-magenta" /> Use {pendingSuggestions.length} suggestions
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving || changes.length === 0}
                className="inline-flex items-center gap-1.5 rounded-xl bg-magenta px-4 py-2 text-xs font-extrabold text-white hover:bg-magenta-hover disabled:opacity-40"
              >
                <Check className="h-3.5 w-3.5" /> {saving ? 'Saving…' : `Save ${changes.length || ''}`.trim()}
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="uppercase">
                  <th>{tab === 'missions' ? 'Mission' : 'Cube'}</th>
                  <th>{tab === 'missions' ? 'Category' : 'Department'}</th>
                  <th>Suggestion</th>
                  <th className="w-48">Discipline</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.map(row => {
                  const value = draft[row.id] ?? row.discipline_id ?? '';
                  const changed = draft[row.id] !== undefined && draft[row.id] !== (row.discipline_id || '');
                  const isMission = tab === 'missions';
                  const m = row as MissionRow;
                  const c = row as CubeRow;
                  return (
                    <tr key={row.id} className={changed ? 'bg-magenta/5' : ''}>
                      <td>
                        <p className="font-extrabold text-gray-900">{isMission ? m.title : c.name}</p>
                        <p className="text-[11px] font-semibold text-gray-400">
                          {isMission ? formatEnum(m.status) : `#${c.cube_number} · ${formatEnum(c.current_level)}`}
                        </p>
                      </td>
                      <td className="font-semibold text-gray-600">{(isMission ? m.category : c.department) || '—'}</td>
                      <td>
                        {row.suggestion ? (
                          <>
                            <p className="font-extrabold text-gray-800">{nameById.get(row.suggestion.discipline_id)}</p>
                            <p className="text-[11px] font-medium text-gray-400">{row.suggestion.reason}</p>
                          </>
                        ) : (
                          <span className="text-gray-400">No suggestion</span>
                        )}
                      </td>
                      <td>
                        <select
                          value={value}
                          onChange={e => setDraft(prev => ({ ...prev, [row.id]: e.target.value }))}
                          aria-label={`Discipline for ${isMission ? m.title : c.name}`}
                          className="w-full rounded-lg border border-gray-200 bg-white p-2 text-xs font-bold outline-none focus:border-magenta"
                        >
                          <option value="">Not set</option>
                          {activeDisciplines.map(d => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                          ))}
                          {value && !activeDisciplines.some(d => d.id === value) && (
                            <option value={value}>{nameById.get(value)} (inactive)</option>
                          )}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
};

const DisciplineList: React.FC<{ disciplines: Discipline[]; onChanged: () => void; onError: (text: string) => void }> = ({
  disciplines,
  onChanged,
  onError,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await action();
      onChanged();
    } catch (err: any) {
      onError(err.message || 'Could not save.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <ul className="flex flex-col gap-3 lg:col-span-2">
        {disciplines.map(d => (
          <li key={d.id} className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-subtle sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-sm font-extrabold text-gray-900">
                {d.name}
                {!d.active && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-black uppercase text-gray-500">Inactive</span>}
              </p>
              <p className="text-xs font-medium text-gray-500">{d.description || 'No description.'}</p>
              <p className="mt-1 text-[11px] font-semibold text-gray-400">
                {d._count.cubes} Cubes · {d._count.missions} missions · key <code>{d.key}</code>
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  const next = window.prompt('Rename discipline', d.name);
                  if (next && next.trim() && next.trim() !== d.name) run(() => api.patch(`/admin/disciplines/${d.id}`, { name: next.trim() }));
                }}
                className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-extrabold text-gray-700 hover:border-gray-300"
              >
                Rename
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => run(() => api.patch(`/admin/disciplines/${d.id}`, { active: !d.active }))}
                className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-extrabold text-gray-700 hover:border-gray-300"
              >
                {d.active ? 'Deactivate' : 'Activate'}
              </button>
            </div>
          </li>
        ))}
      </ul>

      <form
        onSubmit={e => {
          e.preventDefault();
          if (!name.trim()) return;
          run(async () => {
            await api.post('/admin/disciplines', { name: name.trim(), description: description.trim() || undefined });
            setName('');
            setDescription('');
          });
        }}
        className="flex h-fit flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-5 shadow-subtle"
      >
        <h2 className="text-sm font-extrabold text-gray-900">Add a discipline</h2>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Name, e.g. Design"
          maxLength={60}
          className="rounded-xl border border-gray-200 bg-white p-2.5 text-xs font-semibold outline-none focus:border-magenta"
        />
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="What kind of work belongs here (optional)"
          maxLength={300}
          rows={3}
          className="resize-none rounded-xl border border-gray-200 bg-white p-2.5 text-xs font-semibold outline-none focus:border-magenta"
        />
        <button
          type="submit"
          disabled={busy || !name.trim()}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-magenta px-4 py-2.5 text-xs font-extrabold text-white hover:bg-magenta-hover disabled:opacity-40"
        >
          <Plus className="h-3.5 w-3.5" /> Add discipline
        </button>
        <p className="text-[11px] font-medium leading-relaxed text-gray-400">
          Disciplines are never deleted, only deactivated, so past scorecards keep their meaning.
        </p>
      </form>
    </div>
  );
};
