import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AlertCircle, CheckCircle, ShieldCheck } from 'lucide-react';
import { api } from '../utils/api';

interface Question {
  id: string;
  group: 'scenario' | 'reflection';
  title: string;
  prompt: string;
}

const MAX_LENGTH = 3000;

/**
 * Public page where a candidate fills in the recruitment case. Reached through
 * a single-use link the team sends manually; no account is involved.
 */
export const CaseForm: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [scenario, setScenario] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get(`/case/${token}`);
        setName(res.name || '');
        setScenario(res.scenario || '');
        setQuestions(res.questions || []);
        setExpiresAt(res.expiresAt || null);
      } catch (err: any) {
        setLoadError(err.message || 'This link is invalid or has expired.');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const answeredCount = questions.filter(q => (answers[q.id] || '').trim().length > 0).length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!consent) {
      setError('Please agree to AI-assisted evaluation to submit your case.');
      return;
    }
    if (answeredCount === 0) {
      setError('Please answer at least one question.');
      return;
    }
    if (!window.confirm('Once submitted you cannot change your answers. Submit now?')) return;
    setSubmitting(true);
    try {
      await api.post(`/case/${token}/submit`, { consent: true, answers });
      setDone(true);
      window.scrollTo(0, 0);
    } catch (err: any) {
      setError(err.message || 'Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const shell = (children: React.ReactNode) => (
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto w-full max-w-2xl">{children}</div>
    </div>
  );

  if (loading) {
    return shell(
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-magenta border-t-transparent"></div>
      </div>
    );
  }

  if (loadError) {
    return shell(
      <div className="bg-white border border-gray-100 rounded-3xl p-10 text-center shadow-subtle flex flex-col items-center gap-3">
        <AlertCircle className="w-10 h-10 text-red-400" />
        <h1 className="text-xl font-extrabold text-slate-900">Link not available</h1>
        <p className="text-sm text-gray-500 font-medium">{loadError} If you think this is a mistake, contact the Iceberg X team.</p>
      </div>
    );
  }

  if (done) {
    return shell(
      <div className="bg-white border border-gray-100 rounded-3xl p-10 text-center shadow-subtle flex flex-col items-center gap-3">
        <CheckCircle className="w-10 h-10 text-emerald-500" />
        <h1 className="text-xl font-extrabold text-slate-900">Thank you, {name.split(' ')[0] || 'there'}!</h1>
        <p className="text-sm text-gray-500 font-medium">Your case has been submitted. The Iceberg X team will get back to you.</p>
      </div>
    );
  }

  const renderGroup = (group: Question['group'], heading: string) => (
    <section className="flex flex-col gap-5">
      <h2 className="text-sm font-extrabold uppercase tracking-wider text-gray-400">{heading}</h2>
      {questions.filter(q => q.group === group).map((q, i) => (
        <div key={q.id} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-subtle flex flex-col gap-2">
          <label htmlFor={q.id} className="text-sm font-extrabold text-slate-900">
            {group === 'scenario' ? `${i + 1}. ` : ''}{q.title}
          </label>
          <p className="text-xs text-gray-500 font-medium leading-relaxed">{q.prompt}</p>
          <textarea
            id={q.id}
            rows={5}
            maxLength={MAX_LENGTH}
            value={answers[q.id] || ''}
            onChange={e => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
            className="w-full px-4 py-3 bg-gray-50 border border-gray-100 focus:border-magenta focus:bg-white rounded-xl outline-none text-sm"
          />
          <p className="text-[10px] text-gray-400 font-semibold text-right">{(answers[q.id] || '').length}/{MAX_LENGTH}</p>
        </div>
      ))}
    </section>
  );

  return shell(
    <form onSubmit={handleSubmit} className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-magenta">Iceberg X</p>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Candidate Case</h1>
        <p className="text-sm text-gray-500 font-medium">
          Hi {name || 'there'}. This is not a test with one right answer. We want to understand how you approach situations, decide and work. It should take about 30–45 minutes; short, honest answers are enough.
        </p>
        {expiresAt && <p className="text-xs text-gray-400 font-semibold">Please submit by {new Date(expiresAt).toLocaleString()}.</p>}
      </header>

      <section className="bg-white border border-gray-100 rounded-2xl p-5 shadow-subtle">
        <h2 className="text-sm font-extrabold uppercase tracking-wider text-gray-400 mb-2">Scenario</h2>
        <p className="text-sm text-gray-700 leading-relaxed">{scenario}</p>
      </section>

      {renderGroup('scenario', 'How would you proceed?')}
      {renderGroup('reflection', 'Short reflection')}

      <section className="bg-white border border-gray-100 rounded-2xl p-5 shadow-subtle flex flex-col gap-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-1 accent-magenta" />
          <span className="text-xs text-gray-600 font-medium leading-relaxed">
            <ShieldCheck className="inline w-3.5 h-3.5 mr-1 text-magenta" />
            I understand that my answers will be evaluated with the help of artificial intelligence, and that the Iceberg X team reviews the result and makes the final decision.
          </span>
        </label>
        {error && <p className="text-xs font-semibold text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="py-3 bg-magenta text-white font-bold text-sm rounded-2xl hover:bg-magenta-hover disabled:opacity-70"
        >
          {submitting ? 'Submitting...' : `Submit case (${answeredCount}/${questions.length} answered)`}
        </button>
      </section>
    </form>
  );
};
