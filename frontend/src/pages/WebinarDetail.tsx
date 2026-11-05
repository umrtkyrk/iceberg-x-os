import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle, ArrowLeft, Bell, BookOpen, Briefcase, Calendar, Check, CheckCircle2, ChevronUp,
  Clipboard, ClipboardCheck, Clock, Edit3, ExternalLink, Globe, Layers, Linkedin, Lock, Mic,
  PlayCircle, Presentation, RotateCcw, Send, Sparkles, Star, Trash2, Trophy, Video, X, XCircle
} from 'lucide-react';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { PageHeader } from '../components/PageHeader';
import { UserAvatar } from '../components/UserAvatar';
import { CustomMarkdown } from '../components/CustomMarkdown';
import {
  ATTENDANCE_STATUSES,
  AttendanceStatus,
  MAX_QUESTIONS_PER_CUBE,
  Participant,
  QUESTION_MAX_LENGTH,
  QUESTION_MIN_LENGTH,
  RECOVERY_NOTE_MAX_LENGTH,
  RECOVERY_NOTE_MIN_LENGTH,
  Speaker,
  Webinar,
  WebinarQuestion,
  WebinarScore,
  attendanceStyle,
  formatWebinarDate,
  questionLevelLabel,
  scoreTone,
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
  const canVote = win === 'open' || win === 'late';

  const vote = async (q: WebinarQuestion) => {
    try {
      await api.post(`/webinar-questions/${q.id}/vote`, {});
      await reload();
    } catch (err: any) {
      alert(err.message || 'Could not save your vote');
    }
  };

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
                {(q.vote_count || 0) > 0 && (
                  <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded inline-flex items-center gap-0.5" title="Upvotes from other Cubes">
                    <ChevronUp size={11} /> {q.vote_count}
                  </span>
                )}
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
          <>
            <p className="text-xs text-gray-500 -mt-1">
              Upvote the questions you also want answered. The most upvoted ones go to the top of the speaker's list.
            </p>
            <ul className="flex flex-col gap-2">
              {[...others]
                .sort((a, b) => (b.vote_count || 0) - (a.vote_count || 0))
                .map(q => (
                  <li key={q.id} className="text-sm text-gray-700 bg-white border border-gray-100 rounded-xl p-3 flex gap-3 items-start">
                    <button
                      onClick={() => vote(q)}
                      disabled={!canVote}
                      title={canVote ? (q.voted ? 'Remove your upvote' : 'Upvote') : 'Voting has closed'}
                      className={`shrink-0 flex flex-col items-center min-w-[2.5rem] rounded-lg px-1.5 py-1 text-xs font-bold border transition ${
                        q.voted ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-indigo-300'
                      } disabled:opacity-60 disabled:cursor-default`}
                    >
                      <ChevronUp size={14} />
                      {q.vote_count || 0}
                    </button>
                    <p className="whitespace-pre-wrap flex-1 pt-0.5">{q.body}</p>
                  </li>
                ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
};

const QuestionThemes: React.FC<{ webinar: Webinar; reload: () => Promise<void> }> = ({ webinar, reload }) => {
  const [busy, setBusy] = useState(false);
  const questions = webinar.questions || [];
  const groups = webinar.question_groups || [];
  const byId = new Map(questions.map(q => [q.id, q]));

  const generate = async () => {
    setBusy(true);
    try {
      await api.post(`/webinars/${webinar.id}/question-groups`, {});
      await reload();
    } catch (err: any) {
      alert(err.message || 'Could not group the questions');
    } finally {
      setBusy(false);
    }
  };

  const clear = async () => {
    if (!window.confirm('Remove the themes? The speaker list goes back to a single list.')) return;
    try {
      await api.delete(`/webinars/${webinar.id}/question-groups`);
      await reload();
    } catch (err: any) {
      alert(err.message || 'Could not remove the themes');
    }
  };

  if (questions.length < 4) return null;

  return (
    <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-4 flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
          <Layers size={13} /> Themes for the speaker
        </h3>
        <div className="flex gap-2">
          {groups.length > 0 && (
            <button onClick={clear} className="text-[11px] font-bold text-gray-500 px-2 py-1 rounded-lg hover:bg-white">
              Remove
            </button>
          )}
          <button
            onClick={generate}
            disabled={busy}
            className="inline-flex items-center gap-1 text-[11px] font-bold bg-indigo-600 text-white px-2.5 py-1.5 rounded-lg disabled:opacity-50"
          >
            <Sparkles size={12} /> {busy ? 'Grouping…' : groups.length > 0 ? 'Regroup with AI' : 'Group with AI'}
          </button>
        </div>
      </div>
      {groups.length === 0 ? (
        <p className="text-xs text-indigo-900/70">
          Group similar questions into themes so the speaker can answer them one by one. Only the question text is sent to the AI, never names.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {groups.map(g => (
            <div key={g.title} className="bg-white rounded-lg border border-indigo-100 p-3">
              <p className="text-xs font-extrabold text-gray-900">
                {g.title} <span className="text-gray-400 font-bold">· {g.question_ids.length}</span>
              </p>
              <ul className="mt-1.5 flex flex-col gap-1">
                {g.question_ids.map(id => byId.get(id)).filter(Boolean).map(q => (
                  <li key={q!.id} className="text-[11px] text-gray-600 line-clamp-2">• {q!.body}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
      {groups.length > 0 && (
        <p className="text-[11px] text-indigo-900/60">The copied speaker list follows these themes. Questions added later go under "Other questions".</p>
      )}
    </div>
  );
};

const StaffQuestions: React.FC<{ webinar: Webinar; reload: () => Promise<void> }> = ({ webinar, reload }) => {
  const [copied, setCopied] = useState(false);
  const [sort, setSort] = useState<'time' | 'votes'>('time');
  const allQuestions = webinar.questions || [];
  const questions = sort === 'votes'
    ? [...allQuestions].sort((a, b) => (b.vote_count || 0) - (a.vote_count || 0))
    : allQuestions;
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

      <QuestionThemes webinar={webinar} reload={reload} />

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">All questions</h3>
          {questions.length > 1 && (
            <div className="flex bg-gray-100 rounded-lg p-0.5 text-[11px] font-bold">
              {(['time', 'votes'] as const).map(key => (
                <button
                  key={key}
                  onClick={() => setSort(key)}
                  className={`px-2 py-1 rounded-md ${sort === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
                >
                  {key === 'time' ? 'Oldest first' : 'Most upvoted'}
                </button>
              ))}
            </div>
          )}
        </div>
        {questions.length === 0 && <p className="text-sm text-gray-400 italic">No questions yet.</p>}
        {questions.map(q => (
          <div key={q.id} className="bg-white border border-gray-100 rounded-xl p-4 flex flex-col sm:flex-row gap-3">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <UserAvatar name={q.cube?.user?.name || '?'} avatarUrl={q.cube?.avatar_url} size="sm" className="shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-bold text-gray-700">
                  {q.cube?.user?.name || 'Unknown'}
                  {q.is_late && <span className="ml-2 text-[10px] font-bold bg-red-50 text-red-600 px-1.5 py-0.5 rounded">LATE</span>}
                  {(q.vote_count || 0) > 0 && (
                    <span className="ml-2 text-[10px] font-bold bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded inline-flex items-center gap-0.5">
                      <ChevronUp size={11} /> {q.vote_count}
                    </span>
                  )}
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

const ScoreBreakdown: React.FC<{ result: WebinarScore }> = ({ result }) => (
  <div className="grid grid-cols-3 gap-2 text-center">
    <div className={`rounded-xl p-3 ${scoreTone(result.score)}`}>
      <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">Webinar score</p>
      <p className="text-2xl font-extrabold">{result.score}</p>
    </div>
    <div className="rounded-xl p-3 bg-gray-50">
      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Questions</p>
      <p className="text-lg font-extrabold text-gray-900">{result.question_points}</p>
      <p className="text-[10px] text-gray-500">{questionLevelLabel[result.question_level]}</p>
    </div>
    <div className="rounded-xl p-3 bg-gray-50">
      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Attendance</p>
      <p className="text-lg font-extrabold text-gray-900">{result.attendance_points ?? '—'}</p>
      <p className="text-[10px] text-gray-500">
        {result.recovered ? 'Recovered with the recording' : result.attendance_status === 'Excused' ? 'Excused, not counted' : result.attendance_status}
      </p>
    </div>
  </div>
);

/** The Cube's own result after the webinar, and the recovery note for an absence. */
const CubeResult: React.FC<{ webinar: Webinar; reload: () => Promise<void> }> = ({ webinar, reload }) => {
  const attendance = webinar.my_attendance;
  const result = webinar.my_result;
  const [note, setNote] = useState(attendance?.recovery_note || '');
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const length = note.trim().length;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post(`/webinars/${webinar.id}/recovery`, { note: note.trim() });
      setEditing(false);
      await reload();
    } catch (err: any) {
      setError(err.message || 'Could not send the note');
    } finally {
      setBusy(false);
    }
  };

  if (!attendance || !result) {
    return (
      <section className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 text-sm text-gray-500">
        Attendance was not recorded for you, so this webinar does not count towards your webinar score.
      </section>
    );
  }

  const status = attendance.recovery_status;
  const showForm = webinar.can_recover && (status !== 'Pending' || editing);

  return (
    <section className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 flex flex-col gap-4">
      <h2 className="text-lg font-extrabold text-gray-900 flex items-center gap-2">
        <Trophy size={18} className="text-amber-500" /> Your result
      </h2>
      <ScoreBreakdown result={result} />
      <p className="text-xs text-gray-500">
        Half of the score comes from your questions (strong 100, on time 70, late 40, none 0), half from attendance
        (present 100, late 70, absent 0). The webinar score is shown separately and is not part of your overall score.
      </p>

      {attendance.status === 'Absent' && (
        <div className="border-t border-gray-100 pt-4 flex flex-col gap-3">
          <h3 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
            <BookOpen size={15} /> Recover with the recording
          </h3>
          {status === 'Approved' && (
            <div className="rounded-xl p-3 bg-emerald-50 text-emerald-800 text-sm border border-emerald-100">
              Your note was approved: you earned 50 attendance points back.
              {attendance.recovery_feedback && <p className="text-xs mt-1">Feedback: {attendance.recovery_feedback}</p>}
            </div>
          )}
          {status === 'Pending' && !editing && (
            <div className="rounded-xl p-3 bg-indigo-50 text-indigo-800 text-sm border border-indigo-100 flex flex-col gap-2">
              <p>Your note is waiting for review.</p>
              {webinar.can_recover && (
                <button onClick={() => setEditing(true)} className="w-fit text-xs font-bold underline">Edit the note</button>
              )}
            </div>
          )}
          {status === 'Rejected' && (
            <div className="rounded-xl p-3 bg-red-50 text-red-700 text-sm border border-red-100">
              Your note needs more work.{attendance.recovery_feedback ? ` Feedback: ${attendance.recovery_feedback}` : ''}
            </div>
          )}
          {!status && !webinar.recording_url && (
            <p className="text-sm text-gray-500">
              The recording is not available yet. You will get a notification when it is, and then you can write what you learned to recover 50 attendance points.
            </p>
          )}
          {!webinar.can_recover && status !== 'Approved' && webinar.recording_url && (
            <p className="text-sm text-gray-500">The recovery window has closed.</p>
          )}
          {showForm && (
            <form onSubmit={submit} className="flex flex-col gap-2">
              <p className="text-sm text-gray-600">
                Watch the recording, then write what you learned and how you will use it. An approved note brings back 50 attendance points.
                {webinar.recovery_deadline && <> Deadline: <b>{formatWebinarDate(webinar.recovery_deadline)}</b>.</>}
              </p>
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                rows={7}
                maxLength={RECOVERY_NOTE_MAX_LENGTH}
                placeholder="The three ideas that stayed with me were… In my current mission I will…"
                className="border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-gray-900 focus:outline-none"
              />
              <div className="flex items-center justify-between gap-2">
                <span className={`text-xs font-medium ${length < RECOVERY_NOTE_MIN_LENGTH ? 'text-amber-600' : 'text-gray-400'}`}>
                  {length < RECOVERY_NOTE_MIN_LENGTH
                    ? `${RECOVERY_NOTE_MIN_LENGTH - length} more characters needed`
                    : `${length} / ${RECOVERY_NOTE_MAX_LENGTH}`}
                </span>
                <div className="flex gap-2">
                  {editing && (
                    <button type="button" onClick={() => setEditing(false)} className="text-xs font-bold text-gray-500 px-3 py-2 rounded-lg hover:bg-gray-100">
                      Cancel
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={busy || length < RECOVERY_NOTE_MIN_LENGTH}
                    className="inline-flex items-center gap-1.5 text-xs font-bold bg-gray-900 text-white px-4 py-2 rounded-lg disabled:opacity-40"
                  >
                    <Send size={13} /> {busy ? 'Sending…' : 'Send for review'}
                  </button>
                </div>
              </div>
              {error && <p className="text-xs font-semibold text-red-600">{error}</p>}
            </form>
          )}
        </div>
      )}
    </section>
  );
};

const RecoveryReview: React.FC<{ participant: Participant; reload: () => Promise<void> }> = ({ participant, reload }) => {
  const att = participant.attendance;
  const [open, setOpen] = useState(att?.recovery_status === 'Pending');
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);
  if (!att?.recovery_note) return null;

  const decide = async (decision: 'Approved' | 'Rejected') => {
    setBusy(true);
    try {
      await api.patch(`/webinar-attendance/${att.id}/recovery`, { decision, feedback: feedback.trim() || null });
      await reload();
    } catch (err: any) {
      alert(err.message || 'Could not save the review');
    } finally {
      setBusy(false);
    }
  };

  const tone = att.recovery_status === 'Approved'
    ? 'bg-emerald-50 text-emerald-700'
    : att.recovery_status === 'Rejected'
      ? 'bg-red-50 text-red-600'
      : 'bg-indigo-50 text-indigo-700';

  return (
    <div className="col-span-full bg-gray-50 rounded-lg p-3 flex flex-col gap-2">
      <button onClick={() => setOpen(o => !o)} className="flex items-center gap-2 text-xs font-bold text-gray-700 w-fit">
        <BookOpen size={13} /> Recovery note
        <span className={`text-[10px] px-1.5 py-0.5 rounded ${tone}`}>{att.recovery_status}</span>
      </button>
      {open && (
        <>
          <p className="text-sm text-gray-700 whitespace-pre-wrap bg-white rounded-lg border border-gray-100 p-3">{att.recovery_note}</p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              value={feedback}
              onChange={e => setFeedback(e.target.value)}
              placeholder="Feedback for the Cube (optional)"
              className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-xs"
            />
            <button onClick={() => decide('Approved')} disabled={busy} className="text-xs font-bold bg-emerald-600 text-white px-3 py-1.5 rounded-lg disabled:opacity-50">
              Approve
            </button>
            <button onClick={() => decide('Rejected')} disabled={busy} className="text-xs font-bold bg-white border border-red-200 text-red-600 px-3 py-1.5 rounded-lg disabled:opacity-50">
              Needs more work
            </button>
          </div>
        </>
      )}
    </div>
  );
};

/** Staff: take attendance after the start, then close the webinar to score it. */
const StaffAttendance: React.FC<{ webinar: Webinar; reload: () => Promise<void> }> = ({ webinar, reload }) => {
  const participants = webinar.participation || [];
  const completed = webinar.status === 'Completed';
  const initial = () =>
    Object.fromEntries(participants.map(p => [p.cube_id, { status: p.attendance?.status || null, note: p.attendance?.note || '' }]));
  const [rows, setRows] = useState<Record<string, { status: AttendanceStatus | null; note: string }>>(initial);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!dirty) setRows(initial());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [webinar]);

  const set = (cubeId: string, patch: Partial<{ status: AttendanceStatus | null; note: string }>) => {
    setDirty(true);
    setRows(r => ({ ...r, [cubeId]: { ...r[cubeId], ...patch } }));
  };
  const unmarked = participants.filter(p => !rows[p.cube_id]?.status).length;
  const pendingReviews = participants.filter(p => p.attendance?.recovery_status === 'Pending').length;

  const save = async (complete: boolean) => {
    const attendance = participants
      .filter(p => rows[p.cube_id]?.status)
      .map(p => ({ cube_id: p.cube_id, status: rows[p.cube_id].status, note: rows[p.cube_id].note.trim() || null }));
    if (attendance.length === 0) {
      alert('Mark at least one Cube first.');
      return;
    }
    if (complete && !window.confirm('Close the webinar? Scores become final and every Cube is told their result.')) return;
    setBusy(true);
    try {
      await api.put(`/webinars/${webinar.id}/attendance`, { attendance, complete });
      setDirty(false);
      await reload();
    } catch (err: any) {
      alert(err.message || 'Could not save attendance');
    } finally {
      setBusy(false);
    }
  };

  const markAllPresent = () => {
    setDirty(true);
    setRows(r => Object.fromEntries(participants.map(p => [p.cube_id, { ...r[p.cube_id], status: r[p.cube_id]?.status || 'Present' }])));
  };

  return (
    <section id="attendance" className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-extrabold text-gray-900 flex items-center gap-2">
          <ClipboardCheck size={18} /> Attendance {completed ? '& scores' : ''}
        </h2>
        {!completed && unmarked > 0 && (
          <button onClick={markAllPresent} className="text-xs font-bold text-gray-600 bg-gray-100 px-3 py-1.5 rounded-lg hover:bg-gray-200">
            Mark the rest present
          </button>
        )}
      </div>

      {completed && webinar.engagement && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className={`rounded-xl p-3 ${scoreTone(webinar.engagement.average)}`}>
            <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">Average score</p>
            <p className="text-xl font-extrabold">{webinar.engagement.average ?? '—'}</p>
          </div>
          <div className="rounded-xl p-3 bg-gray-50">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Attendance</p>
            <p className="text-xl font-extrabold text-gray-900">{webinar.engagement.attendance_rate ?? '—'}%</p>
          </div>
          <div className="rounded-xl p-3 bg-gray-50">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">No question</p>
            <p className="text-xl font-extrabold text-gray-900">{webinar.engagement.missed_questions}</p>
          </div>
          <div className="rounded-xl p-3 bg-gray-50">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Recovery to review</p>
            <p className={`text-xl font-extrabold ${pendingReviews > 0 ? 'text-indigo-600' : 'text-gray-900'}`}>{pendingReviews}</p>
          </div>
        </div>
      )}

      <div className="flex flex-col divide-y divide-gray-50">
        {participants.map(p => {
          const row = rows[p.cube_id] || { status: null, note: '' };
          return (
            <div key={p.cube_id} className="py-3 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto_auto] gap-2 items-center">
              <div className="flex items-center gap-3 min-w-0">
                <UserAvatar name={p.name} avatarUrl={p.avatar_url} size="sm" className="shrink-0" />
                <div className="min-w-0">
                  <Link to={`/cubes/${p.cube_id}`} className="text-sm font-bold text-gray-900 hover:underline truncate block">{p.name}</Link>
                  <p className={`text-[11px] font-semibold ${p.question_count > 0 ? 'text-gray-500' : 'text-red-600'}`}>
                    {p.question_count > 0 ? `${p.question_count} question${p.question_count === 1 ? '' : 's'}` : 'No question'}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                {ATTENDANCE_STATUSES.map(status => (
                  <button
                    key={status}
                    onClick={() => set(p.cube_id, { status })}
                    className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border ${
                      row.status === status ? attendanceStyle[status] : 'bg-white border-gray-200 text-gray-400 hover:text-gray-700'
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 lg:justify-end">
                {(row.status === 'Excused' || row.status === 'Late' || row.note) && (
                  <input
                    value={row.note}
                    onChange={e => set(p.cube_id, { note: e.target.value })}
                    placeholder={row.status === 'Excused' ? 'Reason' : 'Note'}
                    className="border border-gray-200 rounded-lg px-2 py-1 text-xs w-36"
                  />
                )}
                {completed && p.score && (
                  <span className={`text-xs font-extrabold px-2 py-1 rounded-lg ${scoreTone(p.score.score)}`} title={questionLevelLabel[p.score.question_level]}>
                    {p.score.score}
                  </span>
                )}
              </div>
              <RecoveryReview participant={p} reload={reload} />
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-gray-100">
        {!completed && unmarked > 0 && <span className="text-xs text-gray-500 mr-auto">{unmarked} Cube(s) not marked yet</span>}
        <button onClick={() => save(false)} disabled={busy || !dirty} className="text-xs font-bold bg-gray-100 text-gray-800 px-4 py-2 rounded-lg disabled:opacity-40">
          {completed ? 'Save changes' : 'Save attendance'}
        </button>
        {!completed && (
          <button
            onClick={() => save(true)}
            disabled={busy || unmarked > 0}
            title={unmarked > 0 ? 'Mark every Cube first' : undefined}
            className="inline-flex items-center gap-1.5 text-xs font-bold bg-[#e6007e] text-white px-4 py-2 rounded-lg disabled:opacity-40"
          >
            <CheckCircle2 size={14} /> Save & close webinar
          </button>
        )}
      </div>
    </section>
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
  const started = new Date(webinar.date).getTime() <= Date.now();
  const showAttendance = isStaff && (webinar.status === 'Completed' || (webinar.status === 'Published' && started));

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
                {started && (
                  <a href="#attendance" className="workspace-primary-action">
                    <ClipboardCheck size={16} /> Take attendance
                  </a>
                )}
                <button onClick={() => setStatus('Cancelled', 'Cancel this webinar?')} disabled={busy} className="workspace-secondary-action">
                  <X size={16} /> Cancel
                </button>
              </>
            )}
            {webinar.status === 'Completed' && (
              <button
                onClick={() => setStatus('Published', 'Reopen this webinar? Its scores stop counting until you close it again.')}
                disabled={busy}
                className="workspace-secondary-action"
              >
                <RotateCcw size={16} /> Reopen
              </button>
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
          {!isStaff && webinar.status === 'Completed' && <CubeResult webinar={webinar} reload={load} />}
          {showAttendance && <StaffAttendance webinar={webinar} reload={load} />}

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
