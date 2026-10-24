import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, ShieldAlert, X, CalendarClock, ArrowRight, Copy, Check, Sparkles, Link2 } from 'lucide-react';
import { api } from '../utils/api';
import { PageHeader } from '../components/PageHeader';

const RUBRIC = [
  { key: 'commitment', label: 'Commitment & Reliability', max: 25 },
  { key: 'time', label: 'Time Management', max: 20 },
  { key: 'learning', label: 'Learning & Growth Mindset', max: 20 },
  { key: 'communication', label: 'Communication', max: 15 },
  { key: 'teamfit', label: 'Team Fit', max: 10 },
  { key: 'expectation', label: 'Expectation Alignment', max: 10 }
] as const;
type RubricKey = (typeof RUBRIC)[number]['key'];
type Scores = Record<RubricKey, number>;

type Stage = 'Applied' | 'CaseSent' | 'CaseSubmitted' | 'Evaluated' | 'Interview' | 'Offer' | 'Evaluation';
type Decision = 'StrongYes' | 'Yes' | 'Maybe' | 'No';

const PIPELINE: Stage[] = ['Applied', 'CaseSent', 'CaseSubmitted', 'Evaluated', 'Interview', 'Offer'];
const STAGE_LABEL: Record<Stage, string> = {
  Applied: 'Applied',
  CaseSent: 'Case sent',
  CaseSubmitted: 'Case received',
  Evaluated: 'Evaluated',
  Interview: 'Interview',
  Offer: 'Offer',
  Evaluation: 'Evaluation'
};
const DECISION_LABEL: Record<Decision, string> = {
  StrongYes: 'Strong yes – interview',
  Yes: 'Yes – interview',
  Maybe: 'Maybe – clarify',
  No: 'No'
};
const DECISIONS: Decision[] = ['StrongYes', 'Yes', 'Maybe', 'No'];

interface CaseInfo {
  expires_at: string;
  consent_at: string | null;
  submitted_at: string | null;
  answers?: Record<string, string> | null;
  ai_scores: Scores | null;
  ai_scored_at: string | null;
  ai_reduction: string | null;
  ai_interview_focus: string | null;
  final_scores: Scores | null;
  decision: Decision | null;
  reviewer_note: string | null;
}

interface Candidate {
  id: string;
  name: string;
  email: string;
  university: string;
  degree: string;
  year_of_study: string;
  why_join: string;
  created_at: string;
  stage: Stage;
  interview_at: string | null;
  interview_note: string | null;
  case: CaseInfo | null;
}

const total = (s: Scores | null | undefined) => (s ? RUBRIC.reduce((sum, r) => sum + (s[r.key] || 0), 0) : null);
/** What the team sees: the reviewer's scores when set, otherwise the AI suggestion. */
const effectiveScores = (c: Candidate) => c.case?.final_scores || c.case?.ai_scores || null;
// Mirrors suggestDecision in backend/src/services/caseEvaluation.ts.
const suggest = (t: number): Decision => (t >= 90 ? 'StrongYes' : t >= 80 ? 'Yes' : t >= 65 ? 'Maybe' : 'No');

const toLocalInput = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const tone: Record<string, string> = {
  Applied: 'bg-amber-50 text-amber-700 border-amber-100',
  CaseSent: 'bg-sky-50 text-sky-700 border-sky-100',
  CaseSubmitted: 'bg-indigo-50 text-indigo-700 border-indigo-100',
  Evaluated: 'bg-violet-50 text-violet-700 border-violet-100',
  Interview: 'bg-magenta/10 text-magenta border-magenta/20',
  Offer: 'bg-emerald-50 text-emerald-700 border-emerald-100'
};

const StagePill: React.FC<{ stage: Stage }> = ({ stage }) => (
  <span className={`px-2.5 py-1 rounded-full border text-[10px] font-extrabold uppercase tracking-wider whitespace-nowrap ${tone[stage] || tone.Applied}`}>
    {STAGE_LABEL[stage] || stage}
  </span>
);

type Tab = 'overview' | 'candidates' | 'decision';

export const Recruitment: React.FC = () => {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [query, setQuery] = useState('');
  const [stageFilter, setStageFilter] = useState<'All' | Stage>('All');
  const [openId, setOpenId] = useState<string | null>(null);

  const load = async () => {
    try {
      setCandidates(await api.get('/admin/recruitment/candidates'));
    } catch (err: any) {
      setError(err.message || 'Failed to load candidates');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = (query || '').toLowerCase();
    return candidates.filter(c => {
      const hay = `${c.name || ''} ${c.email || ''} ${c.university || ''} ${c.degree || ''}`.toLowerCase();
      return hay.includes(q) && (stageFilter === 'All' || c.stage === stageFilter);
    });
  }, [candidates, query, stageFilter]);

  const ranked = useMemo(
    () => candidates.filter(c => total(effectiveScores(c)) !== null).sort((a, b) => (total(effectiveScores(b)) ?? 0) - (total(effectiveScores(a)) ?? 0)),
    [candidates]
  );

  const counts = PIPELINE.map(s => candidates.filter(c => c.stage === s).length);
  const maxCount = Math.max(1, ...counts);
  const open = candidates.find(c => c.id === openId) || null;
  const waiting = candidates.filter(c => c.stage === 'CaseSubmitted' || (c.stage === 'Evaluated' && !c.case?.decision)).length;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Manage"
        title="Recruitment"
        description="Send the case, review the AI suggestion, then decide who moves to an interview."
      >
        <Link to="/admin/applications" className="text-xs font-bold px-4 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50">
          Final decisions
        </Link>
      </PageHeader>

      <div className="flex bg-gray-50 border border-gray-100 p-1.5 rounded-xl self-start">
        {([['overview', 'Overview'], ['candidates', 'Candidates'], ['decision', 'Decision Support']] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${tab === key ? 'bg-white text-magenta shadow-sm border border-black/5' : 'text-gray-400 hover:text-gray-700'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-magenta border-t-transparent"></div>
        </div>
      ) : error ? (
        <div className="bg-red-50 text-red-600 border border-red-100 p-4 rounded-2xl flex items-center gap-2">
          <ShieldAlert className="w-5 h-5" />
          <span>{error}</span>
        </div>
      ) : tab === 'overview' ? (
        <div className="flex flex-col gap-6">
          {waiting > 0 && (
            <div className="bg-magenta/5 border border-magenta/20 rounded-2xl p-4 text-sm font-semibold text-slate-800">
              {waiting} candidate{waiting === 1 ? '' : 's'} waiting for your review.
            </div>
          )}
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
            {PIPELINE.map((s, i) => (
              <div key={s} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-subtle">
                <p className="text-xs font-semibold text-gray-400">{STAGE_LABEL[s]}</p>
                <p className="text-3xl font-extrabold text-slate-900 mt-2">{counts[i]}</p>
              </div>
            ))}
          </div>
          <section className="bg-white border border-gray-100 rounded-2xl p-6 shadow-subtle">
            <h2 className="text-base font-extrabold text-slate-900 mb-5">Pipeline distribution</h2>
            <div className="flex items-end gap-4 h-44 border-b border-gray-100">
              {PIPELINE.map((s, i) => (
                <div key={s} className="flex-1 flex flex-col items-center justify-end gap-2 h-full">
                  <span className="text-xs font-bold text-gray-600">{counts[i]}</span>
                  <div className="w-1/2 min-w-[18px] rounded-t-lg bg-magenta/80" style={{ height: `${Math.max(6, (counts[i] / maxCount) * 100)}%` }} />
                </div>
              ))}
            </div>
            <div className="flex gap-4 mt-3">
              {PIPELINE.map(s => (
                <span key={s} className="flex-1 text-center text-[11px] text-gray-400 font-semibold">{STAGE_LABEL[s]}</span>
              ))}
            </div>
          </section>
        </div>
      ) : tab === 'candidates' ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row gap-3 bg-white border border-gray-100 p-4 rounded-2xl shadow-subtle">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-3 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name, email or university..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs font-semibold outline-none focus:border-magenta focus:bg-white transition-all"
              />
            </div>
            <select
              value={stageFilter}
              onChange={e => setStageFilter(e.target.value as 'All' | Stage)}
              className="px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold outline-none focus:border-magenta"
            >
              <option value="All">All stages</option>
              {PIPELINE.map(s => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
            </select>
          </div>

          {filtered.length === 0 ? (
            <div className="bg-white border border-gray-100 rounded-2xl p-12 text-center text-gray-400 text-sm font-semibold shadow-subtle">
              No candidates match.
            </div>
          ) : (
            <div className="bg-white border border-gray-100 rounded-2xl shadow-subtle overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-gray-400 bg-gray-50/70">
                    <th className="px-5 py-3">Candidate</th>
                    <th className="px-5 py-3">Stage</th>
                    <th className="px-5 py-3">Score</th>
                    <th className="px-5 py-3">Decision</th>
                    <th className="px-5 py-3">Interview</th>
                    <th className="px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(c => {
                    const t = total(effectiveScores(c));
                    return (
                      <tr key={c.id} className="border-t border-gray-50 hover:bg-gray-50/50">
                        <td className="px-5 py-4">
                          <p className="text-sm font-extrabold text-gray-900">{c.name || 'Unknown'}</p>
                          <p className="text-xs text-gray-400">{c.university}</p>
                        </td>
                        <td className="px-5 py-4"><StagePill stage={c.stage} /></td>
                        <td className="px-5 py-4 text-sm font-extrabold text-gray-900">
                          {t === null ? '—' : t}
                          {t !== null && !c.case?.final_scores && <span className="ml-1 text-[10px] text-gray-400 font-bold">AI</span>}
                        </td>
                        <td className="px-5 py-4 text-xs font-bold text-gray-600">
                          {c.case?.decision ? DECISION_LABEL[c.case.decision] : t !== null ? <span className="text-gray-400">Suggested: {DECISION_LABEL[suggest(t)]}</span> : '—'}
                        </td>
                        <td className="px-5 py-4 text-xs text-gray-600 font-semibold">{c.interview_at ? new Date(c.interview_at).toLocaleString() : '—'}</td>
                        <td className="px-5 py-4 text-right">
                          <button onClick={() => setOpenId(c.id)} className="text-xs font-bold text-magenta hover:underline">Open</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <section className="bg-white border border-gray-100 rounded-2xl p-6 shadow-subtle">
          <h2 className="text-base font-extrabold text-slate-900 mb-1">Score comparison</h2>
          <p className="text-xs text-gray-400 font-semibold mb-5">Total out of 100 across the six criteria. Decision support only; nobody is advanced or declined automatically.</p>
          {ranked.length === 0 ? (
            <p className="text-sm text-gray-400 font-semibold py-8 text-center">No case has been scored yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-gray-400">
                    <th className="py-2 pr-3">#</th>
                    <th className="py-2 pr-3">Candidate</th>
                    {RUBRIC.map(r => <th key={r.key} className="py-2 px-2 text-center" title={r.label}>{r.label.split(' ')[0]} ({r.max})</th>)}
                    <th className="py-2 px-2 text-center">Total</th>
                    <th className="py-2 pl-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {ranked.map((c, i) => {
                    const s = effectiveScores(c)!;
                    return (
                      <tr key={c.id} className="border-t border-gray-50">
                        <td className="py-3 pr-3 text-xs font-bold text-gray-400">{i + 1}</td>
                        <td className="py-3 pr-3">
                          <p className="text-sm font-extrabold text-gray-900">{c.name || 'Unknown'}</p>
                          <StagePill stage={c.stage} />
                        </td>
                        {RUBRIC.map(r => <td key={r.key} className="py-3 px-2 text-center text-sm font-semibold text-gray-700">{s[r.key]}</td>)}
                        <td className="py-3 px-2 text-center text-lg font-extrabold text-magenta">{total(s)}</td>
                        <td className="py-3 pl-3 text-right">
                          <button onClick={() => setOpenId(c.id)} className="text-xs font-bold text-magenta hover:underline inline-flex items-center gap-1">Review <ArrowRight className="w-3 h-3" /></button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {open && <CandidateModal key={open.id} summary={open} onClose={() => setOpenId(null)} onChanged={load} />}
    </div>
  );
};

const CandidateModal: React.FC<{ summary: Candidate; onClose: () => void; onChanged: () => Promise<void> }> = ({ summary, onClose, onChanged }) => {
  const [candidate, setCandidate] = useState<Candidate>(summary);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(7);
  const [issued, setIssued] = useState<{ url: string; expiresAt: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [showAnswers, setShowAnswers] = useState(false);

  const c = candidate.case;
  const base = effectiveScores(candidate);
  const [scores, setScores] = useState<Scores>(
    base || ({ commitment: 0, time: 0, learning: 0, communication: 0, teamfit: 0, expectation: 0 } as Scores)
  );
  const [decision, setDecision] = useState<Decision | ''>(c?.decision || '');
  const [note, setNote] = useState(c?.reviewer_note || '');
  const [interviewAt, setInterviewAt] = useState(toLocalInput(candidate.interview_at));
  const [interviewNote, setInterviewNote] = useState(candidate.interview_note || '');

  // The list omits the raw answers; fetch the full record for the detail view.
  const reload = async () => {
    const full = await api.get(`/admin/recruitment/candidates/${summary.id}`);
    setCandidate(full);
    await onChanged();
    return full as Candidate;
  };
  useEffect(() => {
    reload().catch(() => setError('Failed to load candidate details'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const sendCase = () =>
    run(async () => {
      const res = await api.post(`/admin/recruitment/candidates/${summary.id}/case`, { days });
      setIssued({ url: res.url, expiresAt: res.expiresAt });
      await reload();
    });

  const copy = async () => {
    if (!issued) return;
    try {
      await navigator.clipboard.writeText(issued.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard may be blocked; the field below stays selectable.
    }
  };

  const rerunAi = () =>
    run(async () => {
      await api.post(`/admin/recruitment/candidates/${summary.id}/case/evaluate`, {});
      const full = await reload();
      const next = effectiveScores(full);
      if (next) setScores(next);
    });

  const saveReview = () =>
    run(async () => {
      await api.patch(`/admin/recruitment/candidates/${summary.id}/review`, { scores, decision: decision || null, note });
      await reload();
    });

  const moveStage = (stage: 'Interview' | 'Offer') =>
    run(async () => {
      await api.patch(`/admin/recruitment/candidates/${summary.id}/stage`, {
        stage,
        interview_at: interviewAt ? new Date(interviewAt).toISOString() : null,
        interview_note: interviewNote
      });
      await reload();
    });

  const decline = () => {
    if (!window.confirm(`Decline ${candidate.name}? They move to the rejected list. Remember to send the rejection email yourself.`)) return;
    run(async () => {
      await api.patch(`/admin/applications/${summary.id}`, { status: 'rejected' });
      await onChanged();
      onClose();
    });
  };

  const liveTotal = total(scores) ?? 0;
  const scoreEdited = !!base && RUBRIC.some(r => base[r.key] !== scores[r.key]);

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4 py-6">
      <div className="w-full max-w-3xl max-h-full overflow-y-auto bg-white border border-gray-100 p-6 sm:p-8 rounded-[2rem] shadow-premium flex flex-col gap-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900">{candidate.name || 'Unknown'}</h2>
            <p className="text-xs text-gray-400 font-semibold mt-1">{candidate.email} · {candidate.university} ({candidate.degree}), {candidate.year_of_study}</p>
            <div className="mt-2"><StagePill stage={candidate.stage} /></div>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
        </div>

        <div className="bg-gray-50 border border-gray-100 p-4 rounded-xl text-xs text-gray-700 leading-relaxed">
          <p className="font-extrabold text-[10px] uppercase text-gray-400 tracking-wider mb-2">Why they want to become a Cube</p>
          <p className="italic whitespace-pre-wrap">"{candidate.why_join}"</p>
        </div>

        {/* Case link */}
        {!c?.submitted_at && (
          <div className="flex flex-col gap-3 border border-gray-100 rounded-2xl p-4">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5"><Link2 className="w-4 h-4" /> Case</p>
            {c ? (
              <p className="text-xs text-gray-500 font-semibold">
                Case link issued, waiting for the candidate. Link {new Date(c.expires_at).getTime() < Date.now() ? 'expired' : 'expires'} {new Date(c.expires_at).toLocaleString()}. Sending again replaces the old link.
              </p>
            ) : (
              <p className="text-xs text-gray-500 font-semibold">Generate a single-use link and send it to the candidate yourself. Nothing is emailed from the portal.</p>
            )}
            <div className="flex items-center gap-2">
              <label htmlFor="days" className="text-xs font-bold text-gray-500">Valid for</label>
              <input id="days" type="number" min={1} max={30} value={days} onChange={e => setDays(Number(e.target.value))} className="w-20 px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm font-semibold outline-none focus:border-magenta" />
              <span className="text-xs text-gray-500 font-semibold">days</span>
              <button onClick={sendCase} disabled={busy} className="ml-auto px-4 py-2 bg-magenta text-white font-bold text-xs rounded-xl hover:bg-magenta-hover disabled:opacity-70">
                {c ? 'Issue new link' : 'Create case link'}
              </button>
            </div>
            {issued && (
              <div className="bg-magenta/5 border border-magenta/20 rounded-xl p-3 flex flex-col gap-2">
                <p className="text-[11px] text-gray-600 font-semibold">Copy it now; it is shown only once. Valid until {new Date(issued.expiresAt).toLocaleString()}.</p>
                <div className="flex gap-2">
                  <input readOnly value={issued.url} onFocus={e => e.currentTarget.select()} className="flex-1 min-w-0 px-3 py-2 bg-white border border-gray-100 rounded-lg text-xs font-mono" />
                  <button onClick={copy} className="px-3 py-2 border border-gray-200 rounded-lg text-xs font-bold text-gray-600 flex items-center gap-1">
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}{copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Submitted case */}
        {c?.submitted_at && (
          <>
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Case answers · submitted {new Date(c.submitted_at).toLocaleString()}</p>
                <button onClick={() => setShowAnswers(v => !v)} className="text-xs font-bold text-magenta hover:underline">{showAnswers ? 'Hide' : 'Show'}</button>
              </div>
              {showAnswers && (
                <div className="flex flex-col gap-3 max-h-80 overflow-y-auto border border-gray-100 rounded-2xl p-4">
                  {Object.entries(c.answers || {}).map(([id, text]) => (
                    <div key={id}>
                      <p className="text-[10px] font-extrabold uppercase text-gray-400">{id}</p>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{text || <em className="text-gray-400">Left blank</em>}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5"><Sparkles className="w-4 h-4" /> Evaluation</p>
                <button onClick={rerunAi} disabled={busy} className="text-xs font-bold text-magenta hover:underline disabled:opacity-60">
                  {c.ai_scores ? 'Re-run AI' : 'Run AI'}
                </button>
              </div>
              {!c.ai_scores && <p className="text-xs text-gray-500 font-semibold">No AI suggestion yet. You can score manually below or run the AI.</p>}
              {c.ai_reduction && (
                <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs text-gray-700 leading-relaxed flex flex-col gap-2">
                  <p><span className="font-extrabold text-gray-500">Main reasons points were lost: </span>{c.ai_reduction}</p>
                  {c.ai_interview_focus && <p><span className="font-extrabold text-gray-500">Interview focus: </span>{c.ai_interview_focus}</p>}
                  <p className="text-[10px] text-gray-400 font-semibold">AI suggestion. You decide.</p>
                </div>
              )}
              {RUBRIC.map(r => (
                <div key={r.key} className="grid grid-cols-[1fr_90px_44px] items-center gap-3">
                  <label htmlFor={r.key} className="text-sm font-semibold text-gray-800">{r.label}</label>
                  <input id={r.key} type="range" min={0} max={r.max} value={scores[r.key]} onChange={e => setScores(prev => ({ ...prev, [r.key]: Number(e.target.value) }))} className="accent-magenta" />
                  <span className="text-sm font-extrabold text-magenta text-right">{scores[r.key]}/{r.max}</span>
                </div>
              ))}
              <div className="flex justify-between bg-magenta/5 rounded-xl px-4 py-3 text-sm font-extrabold text-slate-900">
                <span>Total {scoreEdited && <span className="text-[10px] text-gray-400 font-bold">(edited)</span>}</span>
                <span>{liveTotal}/100 · suggested: {DECISION_LABEL[suggest(liveTotal)]}</span>
              </div>
              <select value={decision} onChange={e => setDecision(e.target.value as Decision | '')} className="px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-semibold outline-none focus:border-magenta">
                <option value="">No decision yet</option>
                {DECISIONS.map(d => <option key={d} value={d}>{DECISION_LABEL[d]}</option>)}
              </select>
              <textarea value={note} onChange={e => setNote(e.target.value)} maxLength={2000} rows={2} placeholder="Reviewer note..." className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm outline-none focus:border-magenta" />
              <button onClick={saveReview} disabled={busy} className="self-end px-5 py-2.5 bg-magenta text-white font-bold text-xs rounded-2xl hover:bg-magenta-hover disabled:opacity-70">Save review</button>
            </div>
          </>
        )}

        {/* Interview */}
        <div className="flex flex-col gap-3 border-t border-gray-100 pt-5">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5"><CalendarClock className="w-4 h-4" /> Interview</p>
          <input type="datetime-local" value={interviewAt} onChange={e => setInterviewAt(e.target.value)} className="px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-semibold outline-none focus:border-magenta" />
          <textarea value={interviewNote} onChange={e => setInterviewNote(e.target.value)} maxLength={2000} rows={2} placeholder="Meeting place, agenda or notes..." className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm outline-none focus:border-magenta" />
          <div className="flex flex-wrap gap-2 justify-end">
            <button onClick={decline} disabled={busy} className="px-4 py-2.5 border border-red-100 bg-red-50 text-red-600 font-bold text-xs rounded-2xl hover:bg-red-100 disabled:opacity-70">Decline</button>
            <button onClick={() => moveStage('Interview')} disabled={busy} className="px-4 py-2.5 border border-gray-200 text-gray-700 font-bold text-xs rounded-2xl hover:bg-gray-50 disabled:opacity-70">
              {candidate.stage === 'Interview' ? 'Update interview' : 'Move to interview'}
            </button>
            <button onClick={() => moveStage('Offer')} disabled={busy} className="px-4 py-2.5 bg-emerald-600 text-white font-bold text-xs rounded-2xl hover:bg-emerald-700 disabled:opacity-70">Mark as offer</button>
          </div>
        </div>

        {error && <p className="text-xs font-semibold text-red-600">{error}</p>}
      </div>
    </div>
  );
};
