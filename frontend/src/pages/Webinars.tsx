import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Calendar, CheckCircle2, Mic, MessageSquare, Plus, UserRound } from 'lucide-react';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { PageHeader } from '../components/PageHeader';
import { UserAvatar } from '../components/UserAvatar';
import {
  Webinar,
  formatWebinarDate,
  isUpcoming,
  speakerLine,
  statusStyle,
  timeUntil
} from '../utils/webinars';

const QuestionChip: React.FC<{ webinar: Webinar }> = ({ webinar }) => {
  const mine = webinar.my_question_count || 0;
  if (mine > 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-emerald-50 text-emerald-700 px-2 py-1 rounded-lg">
        <CheckCircle2 size={12} /> {mine} question{mine === 1 ? '' : 's'} sent
      </span>
    );
  }
  if (webinar.question_window === 'open' || webinar.question_window === 'late') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-amber-50 text-amber-700 px-2 py-1 rounded-lg">
        <AlertTriangle size={12} /> Question required
      </span>
    );
  }
  if (webinar.status !== 'Cancelled') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-red-50 text-red-600 px-2 py-1 rounded-lg">
        No question sent
      </span>
    );
  }
  return null;
};

const WebinarCard: React.FC<{ webinar: Webinar; isStaff: boolean }> = ({ webinar, isStaff }) => {
  const lead = webinar.speakers?.[0];
  const deadline = timeUntil(webinar.questions_close_at);
  return (
    <Link
      to={`/webinars/${webinar.id}`}
      className="group bg-white border border-gray-100 rounded-2xl p-5 shadow-sm hover:border-gray-300 hover:shadow-md transition flex flex-col gap-4"
    >
      <div className="min-h-[1.75rem] flex flex-wrap gap-1.5 items-center">
        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg uppercase tracking-wider ${statusStyle[webinar.status]}`}>
          {webinar.status}
        </span>
        {!isStaff && <QuestionChip webinar={webinar} />}
        {isStaff && (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-gray-50 text-gray-600 px-2 py-1 rounded-lg">
            <MessageSquare size={12} /> {webinar.question_count || 0}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="flex -space-x-3 shrink-0">
          {(webinar.speakers || []).slice(0, 3).map(s => (
            <UserAvatar key={s.id} name={s?.name || '?'} avatarUrl={s?.photo_url} size="lg" className="ring-2 ring-white" />
          ))}
          {(webinar.speakers || []).length === 0 && (
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
              <UserRound size={24} />
            </div>
          )}
        </div>
        <div className="min-w-0">
          <p className="font-extrabold text-gray-900 truncate">{lead?.name || 'Speaker to be announced'}</p>
          <p className="text-xs text-gray-500 line-clamp-2">{lead ? speakerLine(lead) : ''}</p>
        </div>
      </div>

      <h3 className="font-extrabold text-gray-800 text-base leading-tight line-clamp-2 min-h-[2.75rem] flex items-center group-hover:text-[#e6007e] transition-colors">
        {webinar.title}
      </h3>

      <div className="min-h-[3.25rem] flex flex-col gap-1 text-xs text-gray-500 bg-gray-50 p-2.5 rounded-xl mt-auto">
        <span className="flex items-center gap-1.5 font-medium">
          <Calendar size={13} className="text-gray-400" /> {formatWebinarDate(webinar.date)}
        </span>
        {webinar.question_window === 'open' && deadline && (
          <span className="font-semibold text-amber-700">Questions close {deadline}</span>
        )}
        {webinar.question_window === 'late' && (
          <span className="font-semibold text-red-600">Deadline passed: new questions are marked late</span>
        )}
      </div>
    </Link>
  );
};

export const Webinars: React.FC = () => {
  const { user } = useAuth();
  const isStaff = user?.role === 'ADMIN' || user?.role === 'MENTOR';
  const [webinars, setWebinars] = useState<Webinar[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Webinar[]>('/webinars')
      .then(setWebinars)
      .catch(err => setError(err.message || 'Failed to load webinars'))
      .finally(() => setLoading(false));
  }, []);

  const { upcoming, past } = useMemo(() => {
    const now = Date.now();
    const up = webinars.filter(w => isUpcoming(w, now)).sort((a, b) => +new Date(a.date) - +new Date(b.date));
    const done = webinars.filter(w => !isUpcoming(w, now));
    return { upcoming: up, past: done };
  }, [webinars]);

  return (
    <div className="w-full flex flex-col gap-8">
      <PageHeader
        eyebrow="Growth"
        title="Webinars"
        description="Career talks with people who have done it. Read about the speaker, send at least one question before the deadline, and join on the day."
      >
        {isStaff && (
          <>
            <Link to="/webinars/speakers" className="workspace-secondary-action">
              <Mic size={16} /> Speakers
            </Link>
            <Link to="/webinars/new" className="workspace-primary-action">
              <Plus size={16} /> New webinar
            </Link>
          </>
        )}
      </PageHeader>

      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-xl border border-red-100 flex items-center gap-3">
          <AlertTriangle className="shrink-0" />
          <p className="font-medium text-sm">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-10 h-10 border-4 border-gray-900 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <section className="flex flex-col gap-4">
            <h2 className="text-lg font-bold text-gray-800">Upcoming</h2>
            {upcoming.length === 0 ? (
              <div className="bg-white border border-gray-100 rounded-2xl p-8 text-center text-gray-500 shadow-sm">
                <Mic size={32} className="mx-auto text-gray-300 mb-2" />
                <p className="text-sm font-medium">No upcoming webinars yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {upcoming.map(w => (
                  <WebinarCard key={w.id} webinar={w} isStaff={isStaff} />
                ))}
              </div>
            )}
          </section>

          {past.length > 0 && (
            <section className="flex flex-col gap-4">
              <h2 className="text-lg font-bold text-gray-800">Past webinars</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {past.map(w => (
                  <WebinarCard key={w.id} webinar={w} isStaff={isStaff} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
};
