import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Save } from 'lucide-react';
import { api } from '../utils/api';
import { PageHeader } from '../components/PageHeader';

/**
 * Scoring v2 rubric editor: the criteria for each discipline and what each
 * level 1-5 means. Seeded from docs/scoring-v2.md; admins own the wording.
 */
interface Level {
  level: number;
  description: string;
  updated_at?: string;
}
interface Criterion {
  id: string;
  key: string;
  name: string;
  description: string | null;
  discipline_id: string | null;
  legacy_key: string | null;
  active: boolean;
  levels: Level[];
}
interface Discipline {
  id: string;
  name: string;
  active: boolean;
}

const LEVELS = [1, 2, 3, 4, 5];
const LEVEL_HINT: Record<number, string> = { 1: 'Well below', 2: 'Below', 3: 'Meets', 4: 'Above', 5: 'Exceptional' };
const CORE = 'core';

export const AdminRubrics: React.FC = () => {
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [group, setGroup] = useState<string>(CORE);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  const load = async () => {
    try {
      const [c, d] = await Promise.all([api.get<Criterion[]>('/admin/criteria'), api.get<Discipline[]>('/admin/disciplines')]);
      setCriteria(c);
      setDisciplines(d);
    } catch (err: any) {
      setMessage({ tone: 'error', text: err.message || 'Could not load the rubrics.' });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const groups = useMemo(
    () => [
      { id: CORE, name: 'Core', hint: 'Every discipline', count: criteria.filter(c => !c.discipline_id).length },
      ...disciplines.map(d => ({
        id: d.id,
        name: d.name,
        hint: d.active ? 'Discipline' : 'Inactive discipline',
        count: criteria.filter(c => c.discipline_id === d.id).length,
      })),
    ],
    [criteria, disciplines]
  );
  const shown = criteria.filter(c => (group === CORE ? !c.discipline_id : c.discipline_id === group));
  const replace = (updated: Criterion) => setCriteria(prev => prev.map(c => (c.id === updated.id ? updated : c)));
  const notify = (tone: 'ok' | 'error', text: string) => setMessage({ tone, text });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Scoring v2"
        title="Rubrics"
        description="What each scorecard criterion means at levels 1 to 5. Mentors see this wording when they score. Core criteria apply to everyone; each discipline adds its own."
      >
        <Link to="/admin/disciplines" className="workspace-secondary-action">Disciplines</Link>
      </PageHeader>

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
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[14rem_minmax(0,1fr)]">
          <nav aria-label="Criteria groups" className="flex gap-2 overflow-x-auto lg:flex-col">
            {groups.map(g => (
              <button
                key={g.id}
                type="button"
                onClick={() => {
                  setGroup(g.id);
                  setMessage(null);
                }}
                aria-current={group === g.id}
                className={`shrink-0 rounded-2xl border px-4 py-3 text-left transition-colors ${
                  group === g.id ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-100 bg-white text-gray-700 hover:border-gray-300'
                }`}
              >
                <span className="block text-sm font-extrabold">{g.name}</span>
                <span className={`block text-[11px] font-semibold ${group === g.id ? 'text-white/60' : 'text-gray-400'}`}>
                  {g.hint} · {g.count} {g.count === 1 ? 'criterion' : 'criteria'}
                </span>
              </button>
            ))}
          </nav>

          <div className="flex flex-col gap-4">
            {shown.length === 0 && (
              <p className="rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center text-sm font-semibold text-gray-400">
                No criteria yet. Add the two or three that matter most for this discipline.
              </p>
            )}
            {shown.map(c => (
              <CriterionCard key={c.id} criterion={c} onSaved={replace} notify={notify} />
            ))}
            <NewCriterion
              disciplineId={group === CORE ? null : group}
              groupName={groups.find(g => g.id === group)?.name || ''}
              onCreated={created => {
                setCriteria(prev => [...prev, created]);
                notify('ok', `Added "${created.name}".`);
              }}
              notify={notify}
            />
          </div>
        </div>
      )}
    </div>
  );
};

const LevelInputs: React.FC<{ values: Record<number, string>; onChange: (level: number, text: string) => void; disabled?: boolean }> = ({
  values,
  onChange,
  disabled,
}) => (
  <div className="grid grid-cols-1 gap-2 md:grid-cols-5">
    {LEVELS.map(level => (
      <label key={level} className="flex flex-col gap-1">
        <span className="text-[11px] font-extrabold text-gray-500">
          {level} · <span className="font-semibold text-gray-400">{LEVEL_HINT[level]}</span>
        </span>
        <textarea
          value={values[level] || ''}
          onChange={e => onChange(level, e.target.value)}
          disabled={disabled}
          maxLength={300}
          rows={4}
          className="resize-y rounded-xl border border-gray-200 bg-white p-2.5 text-xs font-medium leading-relaxed text-gray-700 outline-none focus:border-magenta"
        />
      </label>
    ))}
  </div>
);

const toValues = (levels: Level[]) => Object.fromEntries(levels.map(l => [l.level, l.description])) as Record<number, string>;

const CriterionCard: React.FC<{ criterion: Criterion; onSaved: (c: Criterion) => void; notify: (tone: 'ok' | 'error', text: string) => void }> = ({
  criterion,
  onSaved,
  notify,
}) => {
  const [values, setValues] = useState(() => toValues(criterion.levels));
  const [busy, setBusy] = useState(false);
  useEffect(() => setValues(toValues(criterion.levels)), [criterion.levels]);

  const original = toValues(criterion.levels);
  const dirty = LEVELS.some(l => (values[l] || '').trim() !== (original[l] || ''));
  const lastEdit = criterion.levels.map(l => l.updated_at || '').sort().pop();

  const run = async (action: () => Promise<Criterion>, done: string) => {
    setBusy(true);
    try {
      onSaved(await action());
      notify('ok', done);
    } catch (err: any) {
      notify('error', err.message || 'Could not save.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className={`flex flex-col gap-4 rounded-3xl border bg-white p-5 shadow-subtle ${criterion.active ? 'border-gray-100' : 'border-dashed border-gray-200 opacity-70'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex flex-wrap items-center gap-2 text-base font-extrabold text-gray-900">
            {criterion.name}
            {criterion.legacy_key && (
              <span title={`Reads legacy scorecards from ${criterion.legacy_key}`} className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-black uppercase text-gray-500">
                Legacy mapped
              </span>
            )}
            {!criterion.active && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-black uppercase text-gray-500">Inactive</span>}
          </h2>
          {criterion.description && <p className="text-xs font-medium text-gray-500">{criterion.description}</p>}
          {lastEdit && <p className="mt-0.5 text-[11px] font-medium text-gray-400">Last edited {new Date(lastEdit).toLocaleDateString()}</p>}
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              const name = window.prompt('Rename criterion', criterion.name);
              if (name && name.trim() && name.trim() !== criterion.name) {
                run(() => api.patch(`/admin/criteria/${criterion.id}`, { name: name.trim() }), 'Renamed.');
              }
            }}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-extrabold text-gray-700 hover:border-gray-300"
          >
            Rename
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              run(
                () => api.patch(`/admin/criteria/${criterion.id}`, { active: !criterion.active }),
                criterion.active ? 'Deactivated; new scorecards will not show it.' : 'Activated.'
              )
            }
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-extrabold text-gray-700 hover:border-gray-300"
          >
            {criterion.active ? 'Deactivate' : 'Activate'}
          </button>
        </div>
      </div>

      <LevelInputs values={values} onChange={(level, text) => setValues(prev => ({ ...prev, [level]: text }))} disabled={busy} />

      {dirty && (
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={() => setValues(original)}
            disabled={busy}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-extrabold text-gray-600 hover:border-gray-300"
          >
            Discard
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              run(
                () => api.put(`/admin/criteria/${criterion.id}/levels`, { levels: LEVELS.map(level => ({ level, description: values[level] || '' })) }),
                `Saved the rubric for ${criterion.name}.`
              )
            }
            className="inline-flex items-center gap-1.5 rounded-xl bg-magenta px-4 py-2 text-xs font-extrabold text-white hover:bg-magenta-hover"
          >
            <Save className="h-3.5 w-3.5" /> Save rubric
          </button>
        </div>
      )}
    </article>
  );
};

const NewCriterion: React.FC<{
  disciplineId: string | null;
  groupName: string;
  onCreated: (c: Criterion) => void;
  notify: (tone: 'ok' | 'error', text: string) => void;
}> = ({ disciplineId, groupName, onCreated, notify }) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [values, setValues] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center gap-1.5 rounded-2xl border border-dashed border-gray-300 bg-white px-4 py-3 text-xs font-extrabold text-gray-600 hover:border-magenta hover:text-magenta"
      >
        <Plus className="h-3.5 w-3.5" /> Add a criterion to {groupName}
      </button>
    );
  }

  return (
    <form
      onSubmit={async e => {
        e.preventDefault();
        setBusy(true);
        try {
          const created = await api.post<Criterion>('/admin/criteria', {
            name: name.trim(),
            description: description.trim() || undefined,
            discipline_id: disciplineId,
            levels: LEVELS.map(level => ({ level, description: values[level] || '' })),
          });
          onCreated(created);
          setOpen(false);
          setName('');
          setDescription('');
          setValues({});
        } catch (err: any) {
          notify('error', err.message || 'Could not add the criterion.');
        } finally {
          setBusy(false);
        }
      }}
      className="flex flex-col gap-3 rounded-3xl border border-magenta/30 bg-white p-5 shadow-subtle"
    >
      <h2 className="text-sm font-extrabold text-gray-900">New criterion for {groupName}</h2>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Name, e.g. Customer empathy"
          maxLength={60}
          required
          className="rounded-xl border border-gray-200 bg-white p-2.5 text-xs font-semibold outline-none focus:border-magenta"
        />
        <input
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="One line on what it covers (optional)"
          maxLength={300}
          className="rounded-xl border border-gray-200 bg-white p-2.5 text-xs font-semibold outline-none focus:border-magenta"
        />
      </div>
      <LevelInputs values={values} onChange={(level, text) => setValues(prev => ({ ...prev, [level]: text }))} disabled={busy} />
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={busy}
          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-extrabold text-gray-600 hover:border-gray-300"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={busy || !name.trim() || LEVELS.some(l => !(values[l] || '').trim())}
          className="inline-flex items-center gap-1.5 rounded-xl bg-magenta px-4 py-2 text-xs font-extrabold text-white hover:bg-magenta-hover disabled:opacity-40"
        >
          <Plus className="h-3.5 w-3.5" /> Add criterion
        </button>
      </div>
    </form>
  );
};
