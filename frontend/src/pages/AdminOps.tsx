import React, { useEffect, useState } from 'react';
import { Play } from 'lucide-react';
import { api } from '../utils/api';
import { PageHeader } from '../components/PageHeader';

/**
 * Admin operations (/admin/ops). Not in the menu: reached by URL only.
 * Operations are defined on the server (services/ops.service.ts); every run
 * is recorded with who ran it and what it returned.
 */
interface Operation {
  key: string;
  title: string;
  description: string;
  confirm: string | null;
}
interface Run {
  id: string;
  operation: string;
  started_by: string;
  status: 'running' | 'succeeded' | 'failed';
  result: unknown;
  error: string | null;
  started_at: string;
  finished_at: string | null;
}

export const AdminOps: React.FC = () => {
  const [operations, setOperations] = useState<Operation[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [running, setRunning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () =>
    api
      .get<{ operations: Operation[]; runs: Run[] }>('/admin/ops')
      .then(res => {
        setOperations(res.operations);
        setRuns(res.runs);
      })
      .catch((err: any) => setError(err.message || 'Could not load operations.'));
  useEffect(() => {
    load();
  }, []);

  const run = async (op: Operation) => {
    if (op.confirm && !window.confirm(op.confirm)) return;
    setRunning(op.key);
    setError(null);
    try {
      await api.post(`/admin/ops/${op.key}/run`, {});
    } catch (err: any) {
      setError(err.message || 'The operation failed.');
    } finally {
      setRunning(null);
      load();
    }
  };

  const titleOf = (key: string) => operations.find(o => o.key === key)?.title || key;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Admin" title="Operations" description="One-off and maintenance jobs. Each run is recorded below with its result." />

      {error && <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}

      <ul className="flex flex-col gap-3">
        {operations.map(op => (
          <li key={op.key} className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-5 shadow-subtle sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-extrabold text-gray-900">{op.title}</p>
              <p className="text-xs font-medium leading-relaxed text-gray-500">{op.description}</p>
            </div>
            <button
              type="button"
              onClick={() => run(op)}
              disabled={running !== null}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-gray-900 px-4 py-2 text-xs font-extrabold text-white hover:bg-black disabled:opacity-40"
            >
              <Play className="h-3.5 w-3.5" /> {running === op.key ? 'Running…' : 'Run'}
            </button>
          </li>
        ))}
      </ul>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-extrabold text-gray-900">Recent runs</h2>
        {runs.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-gray-200 bg-white p-6 text-center text-sm font-semibold text-gray-400">Nothing has run yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {runs.map(r => (
              <li key={r.id} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-subtle">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-extrabold text-gray-900">{titleOf(r.operation)}</span>
                  <span className="flex items-center gap-2 font-semibold text-gray-400">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${
                        r.status === 'succeeded' ? 'bg-emerald-50 text-emerald-700' : r.status === 'failed' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {r.status}
                    </span>
                    {new Date(r.started_at).toLocaleString()}
                    {r.finished_at && ` · ${Math.max(0, Math.round((new Date(r.finished_at).getTime() - new Date(r.started_at).getTime()) / 100) / 10)}s`}
                  </span>
                </div>
                {(r.result !== null || r.error) && (
                  <pre className="mt-2 max-h-48 overflow-auto rounded-xl bg-gray-50 p-3 text-[11px] text-gray-700">
                    {r.error ? r.error : JSON.stringify(r.result, null, 2)}
                  </pre>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};
