import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Mic } from 'lucide-react';
import { api } from '../utils/api';
import { EngagementSummary, ScoredWebinar, questionLevelLabel, scoreTone } from '../utils/webinars';

interface Props {
  /** `/webinar-engagement/me` for the signed-in Cube, or `/webinar-engagement/cubes/:id`. */
  endpoint: string;
  /** Compact = the Profile sidebar; full = the Webinars page. */
  variant?: 'compact' | 'full';
}

/**
 * The webinar score: half questions, half attendance, averaged over completed
 * webinars. A separate metric; it is not part of the overall performance score.
 */
export const WebinarEngagementCard: React.FC<Props> = ({ endpoint, variant = 'compact' }) => {
  const [data, setData] = useState<{ summary: EngagementSummary; webinars: ScoredWebinar[] } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    api
      .get<{ summary: EngagementSummary; webinars: ScoredWebinar[] }>(endpoint)
      .then(d => alive && setData(d))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [endpoint]);

  if (failed || !data) return null;
  const { summary, webinars } = data;

  if (variant === 'compact') {
    return (
      <div className="border-t border-gray-50 pt-4 flex flex-col gap-2.5">
        <h3 className="font-extrabold text-xs text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
          <Mic className="w-3.5 h-3.5" /> Webinars
        </h3>
        <div className="flex justify-between items-center text-xs mt-1">
          <span className="text-gray-500 font-semibold">Webinar score:</span>
          <span className={`font-bold px-2 py-0.5 rounded-lg ${scoreTone(summary.average)}`}>
            {summary.average === null ? 'No data' : `${summary.average} / 100`}
          </span>
        </div>
        <div className="flex justify-between items-center text-xs">
          <span className="text-gray-500 font-semibold">Attendance:</span>
          <span className="font-bold text-gray-800">
            {summary.attendance_rate === null ? '—' : `${summary.attendance_rate}%`}
            <span className="text-gray-400 font-semibold"> ({summary.scored} webinar{summary.scored === 1 ? '' : 's'})</span>
          </span>
        </div>
        <div className="flex justify-between items-center text-xs">
          <span className="text-gray-500 font-semibold">Without a question:</span>
          <span className={`font-bold ${summary.missed_questions > 0 ? 'text-red-600' : 'text-gray-800'}`}>{summary.missed_questions}</span>
        </div>
        {summary.strong_questions > 0 && (
          <div className="flex justify-between items-center text-xs">
            <span className="text-gray-500 font-semibold">Strong questions:</span>
            <span className="font-bold text-amber-600">{summary.strong_questions}</span>
          </div>
        )}
        <p className="text-[10px] text-gray-400 leading-snug">Shown separately; not part of the overall score.</p>
      </div>
    );
  }

  return (
    <section className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5 flex flex-col md:flex-row gap-5">
      <div className="flex items-center gap-4 shrink-0">
        <div className={`w-20 h-20 rounded-2xl flex flex-col items-center justify-center ${scoreTone(summary.average)}`}>
          <span className="text-2xl font-extrabold">{summary.average ?? '—'}</span>
          <span className="text-[10px] font-bold uppercase opacity-80">/ 100</span>
        </div>
        <div>
          <p className="font-extrabold text-gray-900">Your webinar score</p>
          <p className="text-xs text-gray-500 max-w-[16rem]">
            Half questions, half attendance, averaged over closed webinars. Not part of your overall score.
          </p>
        </div>
      </div>
      <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
        <div className="bg-gray-50 rounded-xl p-2.5">
          <p className="text-lg font-extrabold text-gray-900">{summary.scored}</p>
          <p className="text-[10px] font-bold text-gray-500 uppercase">Scored</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-2.5">
          <p className="text-lg font-extrabold text-gray-900">{summary.attendance_rate === null ? '—' : `${summary.attendance_rate}%`}</p>
          <p className="text-[10px] font-bold text-gray-500 uppercase">Attendance</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-2.5">
          <p className={`text-lg font-extrabold ${summary.missed_questions > 0 ? 'text-red-600' : 'text-gray-900'}`}>{summary.missed_questions}</p>
          <p className="text-[10px] font-bold text-gray-500 uppercase">No question</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-2.5">
          <p className="text-lg font-extrabold text-amber-600">{summary.strong_questions}</p>
          <p className="text-[10px] font-bold text-gray-500 uppercase">Strong</p>
        </div>
        {webinars.length > 0 && (
          <div className="col-span-full flex flex-wrap gap-1.5 justify-start">
            {webinars.slice(0, 6).map(w => (
              <Link
                key={w.webinar_id}
                to={`/webinars/${w.webinar_id}`}
                title={`${questionLevelLabel[w.result.question_level]} · ${w.result.attendance_status}`}
                className={`text-[11px] font-bold px-2 py-1 rounded-lg ${scoreTone(w.result.score)} hover:opacity-80`}
              >
                {w.title.length > 28 ? `${w.title.slice(0, 27)}…` : w.title}: {w.result.score}
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
