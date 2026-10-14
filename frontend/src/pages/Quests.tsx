import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { Trophy, CheckCircle, Clock, Zap, Star, ShieldAlert, BookOpen, UserCheck, Calendar } from 'lucide-react';
import { getBadgeIcon } from '../utils/badgeIcons';
import { peerQuestLabel, peerQuestProgressText } from '../utils/peer';

export const Quests: React.FC = () => {
  const { user } = useAuth();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchQuests = async () => {
    try {
      const res = await api.get('/quests');
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch quests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuests();
  }, []);

  // A quest can complete from something that happens entirely off this page
  // (a mentor completing the mission, logging a scorecard, closing a meeting).
  // The server recalculates immediately when that happens, but a tab that was
  // already open here doesn't know. Refetch on regaining focus so it shows up
  // without a manual refresh.
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchQuests();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-magenta"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 text-red-700 text-xs font-semibold p-4 rounded-2xl border border-red-100 flex items-center gap-3">
        <ShieldAlert className="w-5 h-5 shrink-0" />
        <span>{error}</span>
      </div>
    );
  }

  const isCube = user?.role === 'CUBE';

  // Mirrors DEFAULT_MIN_SAMPLE_SIZE in backend/src/services/quest.service.ts —
  // shown so a Cube understands why 100% attendance or a 4.9 average isn't
  // enough on its own to finish the quest yet.
  const DEFAULT_MIN_SAMPLE_SIZE: Record<string, number> = { Common: 3, Rare: 5, Epic: 10, Legendary: 15 };

  // Helper for criteria labels
  const getCriteriaLabel = (q: any) => {
    const { criteria_type: type, criteria_value: value } = q;
    switch (type) {
      case 'missions_completed':
        return `Complete ${value} Mission(s)`;
      case 'missions_assigned':
        return `Get assigned to ${value} Mission Team(s)`;
      case 'average_score': {
        const minSample = q.min_sample_size ?? DEFAULT_MIN_SAMPLE_SIZE[q.difficulty] ?? 3;
        return `Maintain a Scorecard Average of ${value}/5 (across at least ${minSample} completed missions)`;
      }
      case 'login_streak':
        return `Achieve a Login Streak of ${value} Days`;
      case 'meeting_attendance': {
        const minSample = q.min_sample_size ?? DEFAULT_MIN_SAMPLE_SIZE[q.difficulty] ?? 3;
        return `Maintain a ${value}% Meeting Attendance Rate (across at least ${minSample} meetings)`;
      }
      case 'profile_completion':
        return 'Complete your Profile (Add GitHub, LinkedIn, and 3+ skills)';
      case 'write_testimonial':
        return `Submit ${value} Fellowship Testimonial(s)`;
      case 'mission_updates_count':
      case 'mission_updates':
        return value === 1 ? 'Post your first Mission Update' : `Post ${value} Mission Updates`;
      case 'daily_update_streak':
        return `Post a Mission Update for ${value} consecutive days`;
      case 'weekly_update_streak':
        return `Post a Mission Update every week for ${value} consecutive weeks`;
      case 'nda_signed':
        return 'Sign the Non-Disclosure Agreement (NDA)';
      case 'profile_picture':
      case 'avatar_upload':
        return 'Upload your Profile Picture';
      case 'quiz_score':
        return `Score ${value}+ points in Web Fundamentals Quiz`;
      case 'quiz_completed':
        return 'Complete the Web Fundamentals Certification Quiz';
      case 'custom':
        return `Admin Sign-off (Goal: ${value})`;
      default:
        return peerQuestLabel(type, value, q.min_sample_size) ?? `Goal: ${value}`;
    }
  };

  const getCriteriaProgressLabel = (type: string, current: number, target: number) => {
    switch (type) {
      case 'missions_completed':
        return `${current} / ${target} missions`;
      case 'missions_assigned':
        return `${current} / ${target} assignments`;
      case 'average_score':
        return `${current.toFixed(2)} / ${target.toFixed(1)} avg`;
      case 'login_streak':
        return `${current} / ${target} consecutive days`;
      case 'meeting_attendance':
        return `${current.toFixed(1)}% / ${target}% attendance`;
      case 'profile_completion':
        return current >= 1 ? 'Completed' : 'Incomplete';
      case 'nda_signed':
        return current >= 1 ? 'Signed' : 'Not Signed';
      case 'profile_picture':
      case 'avatar_upload':
        return current >= 1 ? 'Uploaded' : 'Missing';
      case 'quiz_score':
        return `${Math.round(current)} / ${target} pts`;
      case 'quiz_completed':
        return current >= 1 ? 'Completed' : 'Not Completed';
      case 'write_testimonial':
        return `${current} / ${target} testimonials`;
      case 'mission_updates_count':
      case 'mission_updates':
        return `${current} / ${target} updates`;
      case 'daily_update_streak':
        return `${current} / ${target} consecutive days`;
      case 'weekly_update_streak':
        return `${current} / ${target} consecutive weeks`;
      default:
        return peerQuestProgressText(type, current, target) ?? `${current} / ${target}`;
    }
  };

  const getDifficultyStyles = (difficulty: string) => {
    switch (difficulty) {
      case 'Legendary':
        return {
          card: 'badge-frame-legendary badge-legendary-glow border-transparent text-white',
          badge: 'badge-pill-legendary text-amber-950 border border-amber-100/60',
          progressBg: 'bg-amber-950/60',
          progressFill: 'bg-gradient-to-r from-amber-200 via-amber-400 to-yellow-300',
          textColor: 'text-amber-100/80',
          titleColor: 'text-amber-100'
        };
      case 'Epic':
        return {
          card: 'bg-slate-900 border-magenta/40 text-white shadow-lg shadow-magenta/10 hover:shadow-magenta/20',
          badge: 'bg-magenta text-white border border-magenta/30',
          progressBg: 'bg-slate-800',
          progressFill: 'bg-magenta',
          textColor: 'text-slate-300',
          titleColor: 'text-white'
        };
      case 'Rare':
        return {
          card: 'bg-white border-sky-200 hover:border-sky-300 shadow-md shadow-sky-500/5',
          badge: 'bg-sky-50 text-sky-700 border border-sky-100',
          progressBg: 'bg-slate-100',
          progressFill: 'bg-sky-500',
          textColor: 'text-slate-500',
          titleColor: 'text-slate-950'
        };
      default:
        return {
          card: 'bg-white border-gray-150 hover:border-gray-250 shadow-sm',
          badge: 'bg-slate-150 text-slate-600 border border-slate-200',
          progressBg: 'bg-slate-100',
          progressFill: 'bg-slate-500',
          textColor: 'text-slate-500',
          titleColor: 'text-slate-900'
        };
    }
  };

  return (
    <div className="flex flex-col gap-8 font-sans">
      <div className="workspace-header flex-col items-start">
        <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
          <Trophy className="w-8 h-8 text-magenta" />
          <span>Quest Board</span>
        </h1>
        <p className="text-slate-500 font-semibold text-sm leading-relaxed">
          {isCube 
            ? 'Complete assigned R&D Quests to test your limits and unlock Rare & Epic badges.' 
            : 'Track the list of active Quests and review Cube engagement metrics.'}
        </p>
      </div>

      {isCube ? (
        // CUBE VIEW: Show assigned quests with progress bars
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {data.length === 0 ? (
            <div className="col-span-2 text-center py-16 bg-white border border-gray-100 rounded-3xl p-6 text-slate-400 font-bold text-sm">
              No quests assigned to your profile yet.
            </div>
          ) : (
            data.map((cq: any) => {
              const q = cq.quest;
              const styles = getDifficultyStyles(q.difficulty);
              const progressPercentage = Math.min(100, (cq.current_value / q.criteria_value) * 100);

              return (
                <div 
                  key={cq.id} 
                  className={`border rounded-3xl p-6 flex flex-col justify-between gap-5 transition-all duration-300 ${styles.card}`}
                >
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className={`text-[10px] uppercase font-black px-2.5 py-1 rounded-full ${styles.badge}`}>
                        {q.difficulty} Quest
                      </span>
                      {cq.is_completed ? (
                        <span className="flex items-center gap-1 text-[11px] font-extrabold text-green-600">
                          <CheckCircle className="w-4 h-4" />
                          <span>Completed</span>
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[11px] font-extrabold text-amber-500">
                          <Clock className="w-4 h-4 animate-pulse" />
                          <span>In Progress</span>
                        </span>
                      )}
                    </div>

                    <h3 className={`text-base font-extrabold tracking-tight ${styles.titleColor}`}>{q.title}</h3>
                    <p className={`text-xs font-semibold leading-relaxed ${styles.textColor}`}>{q.description}</p>
                  </div>

                  <div className="flex flex-col gap-2 pt-3 border-t border-black/5">
                    <div className="flex justify-between items-center text-[10px] font-extrabold">
                      <span className="uppercase tracking-wider text-magenta/80">
                        {getCriteriaLabel(q)}
                      </span>
                      <span className={styles.textColor}>
                        {getCriteriaProgressLabel(q.criteria_type, cq.current_value, q.criteria_value)}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className={`w-full h-2 rounded-full overflow-hidden ${styles.progressBg}`}>
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${styles.progressFill}`} 
                        style={{ width: `${progressPercentage}%` }}
                      />
                    </div>
                  </div>

                  {/* Rewards Row */}
                  {q.rewards && q.rewards.length > 0 && (
                    <div className="flex items-center gap-3 pt-3 border-t border-black/5">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Rewards:</span>
                      <div className="flex flex-wrap gap-2">
                        {q.rewards.map((r: any) => {
                          const Icon = getBadgeIcon(r.icon);
                          return (
                            <div 
                              key={r.id} 
                              className="flex items-center gap-1 px-2.5 py-1 bg-white border border-gray-150 rounded-xl text-[10px] font-extrabold text-slate-700 shadow-sm"
                              title={r.description}
                            >
                              <Icon className="w-3.5 h-3.5 text-magenta" />
                              <span>{r.name}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      ) : (
        // ADMIN / MENTOR VIEW: Show all quest definitions with stats
        <div className="flex flex-col gap-6">
          {data.length === 0 ? (
            <div className="text-center py-16 bg-white border border-gray-100 rounded-3xl p-6 text-slate-400 font-bold text-sm">
              No quests configured in the system yet.
            </div>
          ) : (
            data.map((q: any) => {
              const styles = getDifficultyStyles(q.difficulty);
              const assignedCount = q.cube_quests?.length || 0;
              const completedCount = q.cube_quests?.filter((cq: any) => cq.is_completed).length || 0;

              return (
                <div key={q.id} className="bg-white border border-gray-150 rounded-3xl p-6 shadow-sm flex flex-col gap-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex flex-col gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`text-[10px] uppercase font-black px-2.5 py-1 rounded-full ${styles.badge}`}>
                          {q.difficulty} Quest
                        </span>
                        <span className="text-[10px] font-extrabold bg-slate-100 border border-slate-200 text-slate-600 px-2 py-0.5 rounded-md uppercase tracking-wider">
                          Type: {q.criteria_type.replace(/_/g, ' ')}
                        </span>
                        {q.is_timed && (
                          <span className="text-[10px] font-extrabold bg-red-50 border border-red-200 text-red-600 px-2 py-0.5 rounded-md uppercase tracking-wider flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            <span>Expires {new Date(q.expires_at).toLocaleDateString()}</span>
                          </span>
                        )}
                      </div>
                      <h3 className="text-base font-extrabold text-slate-900 tracking-tight">{q.title}</h3>
                      <p className="text-xs font-semibold text-slate-500 leading-relaxed max-w-[800px]">{q.description}</p>
                    </div>

                    <div className="flex items-center gap-4 text-center">
                      <div className="px-4 py-2 bg-slate-50 border border-slate-150 rounded-2xl min-w-[90px]">
                        <h4 className="text-lg font-black text-slate-800 leading-none">{assignedCount}</h4>
                        <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mt-1 block">Assigned</span>
                      </div>
                      <div className="px-4 py-2 bg-green-50 border border-green-150 rounded-2xl min-w-[90px]">
                        <h4 className="text-lg font-black text-green-700 leading-none">{completedCount}</h4>
                        <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mt-1 block">Completed</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-3 border-t border-slate-100 flex-wrap justify-between">
                    {/* Rewards */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Rewards:</span>
                      {q.rewards?.map((r: any) => {
                        const Icon = getBadgeIcon(r.icon);
                        return (
                          <div key={r.id} className="flex items-center gap-1 px-2.5 py-1 bg-slate-50 border border-gray-150 rounded-xl text-[10px] font-extrabold text-slate-700">
                            <Icon className="w-3.5 h-3.5 text-magenta" />
                            <span>{r.name}</span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Criteria Info */}
                    <div className="text-[10px] font-bold text-slate-500">
                      Criteria Requirement: <span className="text-magenta font-black uppercase">{getCriteriaLabel(q)}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
