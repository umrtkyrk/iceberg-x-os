import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle, ArrowLeft, Bell, Briefcase, Calendar, Check, CheckCircle2, Clipboard, Clock,
  Edit3, ExternalLink, Globe, Linkedin, Lock, Mic, PlayCircle, Presentation, Send, Star,
  Trash2, Video, X, XCircle
} from 'lucide-react';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { PageHeader } from '../components/PageHeader';
import { UserAvatar } from '../components/UserAvatar';
import { CustomMarkdown } from '../components/CustomMarkdown';
import {
  MAX_QUESTIONS_PER_CUBE,
  QUESTION_MAX_LENGTH,
  QUESTION_MIN_LENGTH,
  Speaker,
  Webinar,
  WebinarQuestion,
  formatWebinarDate,
  speakerLine,
  statusStyle,
  timeUntil
} from '../utils/webinars';

const SpeakerProfile: React.FC<{ speaker: Speaker }> = ({ speaker }) => {
  const career = Array.isArray(speaker?.career) ? speaker.career : [];
  return (
    <article className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
      <div className="p-6 flex flex-col sm:flex-row gap-5 sm:items-center border-b border-gray-50">
        <UserAvatar name={speaker?.name || '?'} avatarUrl={speaker?.photo_url} size="xl" className="shrink-0" />
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-extrabold text-gray-900">{speaker?.name || 'Unknown'}</h2>
          {speakerLine(speaker) && <p className="text-sm text-gray-600 mt-1">{speakerLine(speaker)}</p>}
          <div className="flex flex-wrap gap-2 mt-3">
            {speaker?.linkedin_url && (
              <a
                href={speaker.linkedin_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-bold bg-[#0a66c2] text-white px-3 py-1.5 rounded-lg hover:opacity-90"
              >
                <Linkedin size={14} /> LinkedIn
              </a>
            )}
            {speaker?.website_url && (
              <a
                href={speaker.website_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-bold bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-200"
              >
                <Globe size={14} /> Website
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="p-6 grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 flex flex-col gap-4">
          {(speaker?.expertise || []).length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {(speaker.expertise || []).map(tag => (
                <span key={tag} className="text-[11px] font-bold bg-[#e6007e]/10 text-[#b0005f] px-2 py-1 rounded-lg">
                  {tag}
                </span>
              ))}
            </div>
          )}
          {speaker?.bio ? (
            <CustomMarkdown className="prose prose-sm max-w-none text-gray-700">{speaker.bio}</CustomMarkdown>
          ) : (
            <p className="text-sm text-gray-400 italic">No biography yet.</p>
          )}
        </div>

        <div className="lg:col-span-2">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Briefcase size={13} /> Career
          </h3>
          {career.length === 0 ? (
            <p className="text-sm text-gray-400 italic">No career history added.</p>
          ) : (
            <ol className="relative border-l-2 border-gray-100 ml-1.5 flex flex-col gap-4">
              {career.map((item, i) => (
                <li key={i} className="pl-4 relative">
                  <span className={`absolute -left-[7px] top-1.5 w-3 h-3 rounded-full ring-2 ring-white ${i === 0 ? 'bg-[#e6007e]' : 'bg-gray-300'}`} />
                  <p className="text-sm font-bold text-gray-900">{item?.title || ''}</p>
                  <p className="text-xs text-gray-600">
                    {[item?.company, item?.period].filter(Boolean).join(' · ')}
                  </p>
                  {item?.description && <p className="text-xs text-gray-500 mt-1">{item.description}</p>}
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </article>
  );
};

const QuestionForm: React.FC<{
  initial?: string;
  submitLabel: string;
  onSubmit: (body: string) => Promise<void>;
  onCancel?: () => void;
}> = ({ initial = '', submitLabel, onSubmit, onCancel }) => {
  const [body, setBody] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const length = body.trim().length;
  const valid = length >= QUESTION_MIN_LENGTH && length <= QUESTION_MAX_LENGTH;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit(body.trim());
      setBody('');
    } catch (err: any) {
      setError(err.message || 'Could not save the question');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <textarea
        value={body}
        onChange={e => setBody(e.target.value)}
        rows={4}
        maxLength={QUESTION_MAX_LENGTH}
        placeholder="Ask something only this speaker can answer. Add a sentence of context: what you are working on, what you are trying to decide."
        className="border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-gray-900 focus:outline-none"
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={`text-xs font-medium ${length > 0 && length < QUESTION_MIN_LENGTH ? 'text-amber-600' : 'text-gray-400'}`}>
          {length < QUESTION_MIN_LENGTH
            ? `${QUESTION_MIN_LENGTH - length} more character${QUESTION_MIN_LENGTH - length === 1 ? '' : 's'} needed`
            : `${length} / ${QUESTION_MAX_LENGTH}`}
        </span>
        <div className="flex gap-2">
          {onCancel && (
            <button type="button" onClick={onCancel} className="text-xs font-bold text-gray-500 px-3 py-2 rounded-lg hover:bg-gray-100">
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={!valid || busy}
            className="inline-flex items-center gap-1.5 text-xs font-bold bg-gray-900 text-white px-4 py-2 rounded-lg disabled:opacity-40"
          >
            <Send size={13} /> {busy ? 'Saving…' : submitLabel}
          </button>
        </div>
      </div>
      {error && <p className="text-xs font-semibold text-red-600">{error}</p>}
    </form>
  );
};

const CubeQuestions: React.FC<{ webinar: Webinar; reload: () => Promise<void> }> = ({ webinar, reload }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const mine = webinar.my_questions || [];
  const others = webinar.other_questions || [];
  const win = webinar.question_window;
  const canAdd = (win === 'open' || win === 'late') && mine.length < MAX_QUESTIONS_PER_CUBE;
  const canEdit = win === 'open';
  const deadline = timeUntil(webinar.questions_close_at);

  const remove = async (q: WebinarQuestion) => {
    if (!window.confirm('Delete this question?')) return;
    try {
      await api.delete(`/webinar-questions/${q.id}`);
      await reload();
    } catch (err: any) {
      alert(err.message || 'Could not delete the question');
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {win === 'open' && (
        <div className={`rounded-xl p-4 text-sm flex items-start gap-3 ${mine.length === 0 ? 'bg-amber-50 text-amber-800 border border-amber-100' : 'bg-emerald-50 text-emerald-800 border border-emerald-100'}`}>
          {mine.length === 0 ? <AlertTriangle size={18} className="shrink-0 mt-0.5" /> : <CheckCircle2 size={18} className="shrink-0 mt-0.5" />}
          <p>
            {mine.length === 0
              ? <>Every Cube sends <b>at least one question</b>. The deadline is <b>{formatWebinarDate(webinar.questions_close_at)}</b>{deadline ? ` (${deadline})` : ''}.</>
              : <>You are set. You can edit your questions or add more until <b>{formatWebinarDate(webinar.questions_close_at)}</b>.</>}
          </p>
        </div>
      )}
      {win === 'late' && (
        <div className="rounded-xl p-4 text-sm flex items-start gap-3 bg-red-50 text-red-700 border border-red-100">
          <Clock size={18} className="shrink-0 mt-0.5" />
          <p>The question deadline has passed. You can still send a question until the webinar starts, but it is marked late.</p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-bold text-gray-800">Your questions ({mine.length})</h3>
        {mine.length === 0 && win === 'closed' && (
          <p className="text-sm text-red-600 font-medium">You did not send a question for this webinar.</p>
        )}
        {mine.map(q =>
          editingId === q.id ? (
            <QuestionForm
              key={q.id}
              initial={q.body}
              submitLabel="Save"
              onCancel={() => setEditingId(null)}
              onSubmit={async body => {
                await api.put(`/webinar-questions/${q.id}`, { body });
                setEditingId(null);
                await reload();
              }}
            />
          ) : (
            <div key={q.id} className="bg-gray-50 border border-gray-100 rounded-xl p-4 flex gap-3">
              <p className="text-sm text-gray-800 whitespace-pre-wrap flex-1">{q.body}</p>
              <div className="flex flex-col items-end gap-1 shrink-0">
                {q.is_late && <span className="text-[10px] font-bold bg-red-50 text-red-600 px-1.5 py-0.5 rounded">LATE</span>}
                {canEdit && (
                  <div className="flex gap-1">
                    <button onClick={() => setEditingId(q.id)} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg" title="Edit">
                      <Edit3 size={14} />
                    </button>
                    <button onClick={() => remove(q)} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg" title="Delete">
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        )}
        {canAdd && editingId === null && (
          <QuestionForm
            submitLabel={mine.length === 0 ? 'Send question' : 'Add another question'}
            onSubmit={async body => {
              await api.post(`/webinars/${webinar.id}/questions`, { body });
              await reload();
            }}
          />
        )}
      </div>

      <div className="flex flex-col gap-3 pt-4 border-t border-gray-100">
        <h3 className="text-sm font-bold text-gray-800">Questions from other Cubes</h3>
        {webinar.others_locked ? (
          <div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl p-5 text-sm text-gray-500 flex items-center gap-3">
            <Lock size={18} className="shrink-0" />
            Send your own question first to see what others are asking. Questions are shown without names.
          </div>
        ) : others.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No other questions yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {others.map(q => (
              <li key={q.id} className="text-sm text-gray-700 bg-white border border-gray-100 rounded-xl p-3 whitespace-pre-wrap">
                {q.body}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

const StaffQuestions: React.FC<{ webinar: Webinar; reload: () => Promise<void> }> = ({ webinar, reload }) => {
  const [copied, setCopied] = useState(false);
  const questions = webinar.questions || [];
  const participation = webinar.participation || [];
  const answered = participation.filter(p => p.question_count > 0).length;
  const missing = participation.filter(p => p.question_count === 0);
  const canRemind = webinar.question_window === 'open' || webinar.question_window === 'late';

  const copyForSpeaker = async () => {
    try {
      const { text } = await api.get<{ text: string }>(`/webinars/${webinar.id}/speaker-export`);
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err: any) {
      alert(err.message || 'Could not copy the list');
    }
  };

  const remind = async () => {
    if (!window.confirm(`Send a reminder to the ${missing.length} Cube(s) without a question?`)) return;
    try {
      const res = await api.post<{ reminded: number }>(`/webinars/${webinar.id}/remind`, {});
      alert(`Reminder sent to ${res.reminded} Cube(s).`);
    } catch (err: any) {
      alert(err.message || 'Could not send reminders');
    }
  };

  const toggleFlag = async (q: WebinarQuestion, flag: 'asked_live' | 'is_strong') => {
    try {
      await api.patch(`/webinar-questions/${q.id}/flags`, { [flag]: !q[flag] });
      await reload();
    } catch (err: any) {
      alert(err.message || 'Could not update the question');
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-gray-50 rounded-xl p-4">
          <p className="text-xs font-bold text-gray-500 uppercase">Cubes with a question</p>
          <p className="text-2xl font-extrabold text-gray-900 mt-1">
            {answered} <span className="text-base text-gray-400">/ {participation.length}</span>
          </p>
        </div>
        <div className="bg-gray-50 rounded-xl p-4">
          <p className="text-xs font-bold text-gray-500 uppercase">Questions</p>
          <p className="text-2xl font-extrabold text-gray-900 mt-1">{questions.length}</p>
        </div>
        <div className="flex flex-col gap-2 justify-center">
          <button onClick={copyForSpeaker} className="inline-flex items-center justify-center gap-1.5 text-xs font-bold bg-gray-900 text-white px-3 py-2 rounded-lg">
            {copied ? <Check size={14} /> : <Clipboard size={14} />} {copied ? 'Copied' : 'Copy anonymous list for speaker'}
          </button>
          <button
            onClick={remind}
            disabled={!canRemind || missing.length === 0}
            className="inline-flex items-center justify-center gap-1.5 text-xs font-bold bg-amber-500 text-white px-3 py-2 rounded-lg disabled:opacity-40"
          >
            <Bell size={14} /> Remind Cubes without a question
          </button>
        </div>
      </div>

      {missing.length > 0 && (
        <div>
          <h3 className="text-xs font-bold text-red-700 uppercase tracking-wider mb-2 flex items-center gap-1">
            <XCircle size={13} /> No question yet ({missing.length})
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {missing.map(p => (
              <Link key={p.cube_id} to={`/cubes/${p.cube_id}`} className="text-xs font-semibold bg-red-50 text-red-700 px-2.5 py-1 rounded-lg hover:bg-red-100">
                {p.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">All questions</h3>
        {questions.length === 0 && <p className="text-sm text-gray-400 italic">No questions yet.</p>}
        {questions.map(q => (
          <div key={q.id} className="bg-white border border-gray-100 rounded-xl p-4 flex flex-col sm:flex-row gap-3">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <UserAvatar name={q.cube?.user?.name || '?'} avatarUrl={q.cube?.avatar_url} size="sm" className="shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-bold text-gray-700">
                  {q.cube?.user?.name || 'Unknown'}
                  {q.is_late && <span className="ml-2 text-[10px] font-bold bg-red-50 text-red-600 px-1.5 py-0.5 rounded">LATE</span>}
                </p>
                <p className="text-sm text-gray-800 whitespace-pre-wrap mt-1">{q.body}</p>
              </div>
            </div>
            <div className="flex sm:flex-col gap-1.5 shrink-0">
              <button
                onClick={() => toggleFlag(q, 'asked_live')}
                className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-lg ${q.asked_live ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                <Mic size={12} /> Asked live
              </button>
              <button
                onClick={() => toggleFlag(q, 'is_strong')}
                className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-lg ${q.is_strong ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                <Star size={12} /> Strong question
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const WebinarDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isStaff = user?.role === 'ADMIN' || user?.role === 'MENTOR';
  const [webinar, setWebinar] = useState<Webinar | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setWebinar(await api.get<Webinar>(`/webinars/${id}`));
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load the webinar');
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (fn: () => Promise<any>) => {
    setBusy(true);
    try {
      await fn();
      await load();
    } catch (err: any) {
      alert(err.message || 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  const publish = () => {
    if (!window.confirm('Publish this webinar? Invited Cubes will be notified and can start sending questions.')) return;
    act(() => api.post(`/webinars/${id}/publish`, { notify: true }));
  };

  const setStatus = (status: string, message: string) => {
    if (!window.confirm(message)) return;
    act(() => api.patch(`/webinars/${id}/status`, { status }));
  };

  const remove = async () => {
    if (!webinar) return;
    const count = webinar.questions?.length || 0;
    const message = count > 0
      ? `Delete this webinar and its ${count} question(s) from Cubes? This cannot be undone.`
      : 'Delete this webinar?';
    if (!window.confirm(message)) return;
    try {
      await api.delete(`/webinars/${id}${count > 0 ? '?force=true' : ''}`);
      navigate('/webinars');
    } catch (err: any) {
      alert(err.message || 'Could not delete the webinar');
    }
  };

  if (error) {
    return (
      <div className="flex flex-col gap-4">
        <Link to="/webinars" className="text-sm font-bold text-gray-500 flex items-center gap-1"><ArrowLeft size={16} /> Webinars</Link>
        <div className="bg-red-50 text-red-700 p-4 rounded-xl border border-red-100 flex items-center gap-3">
          <AlertTriangle className="shrink-0" /> <p className="font-medium text-sm">{error}</p>
        </div>
      </div>
    );
  }
  if (!webinar) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-10 h-10 border-4 border-gray-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const speakers = webinar.speakers || [];

  return (
    <div className="w-full flex flex-col gap-6">
      <Link to="/webinars" className="text-sm font-bold text-gray-500 hover:text-gray-800 flex items-center gap-1 w-fit">
        <ArrowLeft size={16} /> Webinars
      </Link>

      <PageHeader
        eyebrow={`Webinar · ${webinar.status}`}
        title={webinar.title}
        description={`${formatWebinarDate(webinar.date)} · ${webinar.duration_minutes} min`}
      >
        {isStaff && (
          <>
            <Link to={`/webinars/${webinar.id}/edit`} className="workspace-secondary-action">
              <Edit3 size={16} /> Edit
            </Link>
            {webinar.status === 'Draft' && (
              <button onClick={publish} disabled={busy} className="workspace-primary-action">
                <Send size={16} /> Publish
              </button>
            )}
            {webinar.status === 'Published' && (
              <>
                <button onClick={() => setStatus('Completed', 'Mark this webinar as completed? New questions will be closed.')} disabled={busy} className="workspace-secondary-action">
                  <CheckCircle2 size={16} /> Mark completed
                </button>
                <button onClick={() => setStatus('Cancelled', 'Cancel this webinar?')} disabled={busy} className="workspace-secondary-action">
                  <X size={16} /> Cancel
                </button>
              </>
            )}
            {webinar.status === 'Cancelled' && (
              <button onClick={() => setStatus('Draft', 'Move this webinar back to draft?')} disabled={busy} className="workspace-secondary-action">
                Back to draft
              </button>
            )}
            <button onClick={remove} className="workspace-icon-button" title="Delete">
              <Trash2 size={16} />
            </button>
          </>
        )}
      </PageHeader>

      {webinar.status === 'Draft' && isStaff && (
        <div className="bg-gray-50 border border-dashed border-gray-300 rounded-xl p-4 text-sm text-gray-600">
          This is a draft. Cubes cannot see it until you publish it.
        </div>
      )}
      {webinar.status === 'Cancelled' && (
        <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-sm text-red-700 font-medium">This webinar was cancelled.</div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 flex flex-col gap-6">
          {speakers.length === 0 ? (
            <div className="bg-white border border-gray-100 rounded-2xl p-8 text-center text-gray-500 shadow-sm">
              <Mic size={32} className="mx-auto text-gray-300 mb-2" />
              <p className="text-sm font-medium">The speaker will be announced soon.</p>
            </div>
          ) : (
            speakers.map(s => <SpeakerProfile key={s.id} speaker={s} />)
          )}

          <section className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
            <h2 className="text-lg font-extrabold text-gray-900 mb-4">Questions for the speaker</h2>
            {isStaff ? <StaffQuestions webinar={webinar} reload={load} /> : <CubeQuestions webinar={webinar} reload={load} />}
          </section>
        </div>

        <aside className="flex flex-col gap-4">
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5 flex flex-col gap-3 text-sm">
            <span className={`w-fit text-[11px] font-bold px-2.5 py-1 rounded-lg uppercase tracking-wider ${statusStyle[webinar.status]}`}>
              {webinar.status}
            </span>
            <p className="flex items-center gap-2 text-gray-700"><Calendar size={15} className="text-gray-400" /> {formatWebinarDate(webinar.date)}</p>
            <p className="flex items-center gap-2 text-gray-700"><Clock size={15} className="text-gray-400" /> {webinar.duration_minutes} minutes</p>
            <p className="flex items-center gap-2 text-gray-700"><Send size={15} className="text-gray-400" /> Questions close {formatWebinarDate(webinar.questions_close_at)}</p>
            {webinar.meeting_url && (
              <a href={webinar.meeting_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-1.5 font-bold bg-[#e6007e] text-white px-4 py-2.5 rounded-xl hover:bg-[#c9006e]">
                <Video size={16} /> Join the webinar <ExternalLink size={13} />
              </a>
            )}
            {webinar.recording_url && (
              <a href={webinar.recording_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-bold text-gray-700 hover:text-[#e6007e]">
                <PlayCircle size={16} /> Watch the recording
              </a>
            )}
            {webinar.slides_url && (
              <a href={webinar.slides_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-bold text-gray-700 hover:text-[#e6007e]">
                <Presentation size={16} /> Slides
              </a>
            )}
          </div>

          {webinar.description && (
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">About this webinar</h3>
              <CustomMarkdown className="prose prose-sm max-w-none text-gray-700">{webinar.description}</CustomMarkdown>
            </div>
          )}

          {webinar.summary && (
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Summary</h3>
              <CustomMarkdown className="prose prose-sm max-w-none text-gray-700">{webinar.summary}</CustomMarkdown>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};
