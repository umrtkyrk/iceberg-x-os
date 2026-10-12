import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { Award, Rocket, MessageSquare, ShieldAlert, Sparkles, Send, PlayCircle, ExternalLink, MessageCircle, Trophy, CheckCircle, Clock } from 'lucide-react';
import { CustomMarkdown } from '../components/CustomMarkdown';
import { BadgeDisc } from '../components/BadgeMedal';
import { compareByRarity, getRarityMeta } from '../utils/badgeRarity';
import { MVCubesShelf } from '../components/peer/MVCubesShelf';
import { peerQuestLabel, peerQuestProgressText } from '../utils/peer';

export const CubeDashboard: React.FC = () => {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Submit Update modal/form states
  const [activeUpdateMissionId, setActiveUpdateMissionId] = useState<string | null>(null);
  const [updateType, setUpdateType] = useState('daily');
  const [updateContent, setUpdateContent] = useState('');
  const [updateBlockers, setUpdateBlockers] = useState('');
  const [updateSuccess, setUpdateSuccess] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updateSubmitting, setUpdateSubmitting] = useState(false);

  // Testimonial States
  const [testimonialContent, setTestimonialContent] = useState('');
  const [testimonialSubmitting, setTestimonialSubmitting] = useState(false);
  const [testimonialSuccess, setTestimonialSuccess] = useState(false);
  const [testimonialError, setTestimonialError] = useState<string | null>(null);

  const [quests, setQuests] = useState<any[]>([]);

  const fetchDashboardData = async () => {
    try {
      const [res, questsRes] = await Promise.all([
        api.get('/cube/dashboard'),
        api.get('/quests')
      ]);
      setData(res);
      setQuests(questsRes);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // A quest can complete from something that happens entirely off this page —
  // a mentor completing the mission, logging a scorecard, or closing a
  // meeting the Cube attended. Those now trigger a server-side recalculation
  // (see backend/src/services/quest.service.ts), but if this tab was already
  // open when it happened, its in-memory state doesn't know. Refetch when the
  // tab regains focus so "completed elsewhere" shows up without a manual F5.
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchDashboardData();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  const handleUpdateSubmit = async (e: React.FormEvent, missionId: string) => {
    e.preventDefault();
    if (!updateContent.trim()) return;

    setUpdateSubmitting(true);
    setUpdateError(null);
    setUpdateSuccess(false);

    try {
      await api.post('/updates', {
        mission_id: missionId,
        type: updateType,
        content: updateContent.trim(),
        blockers: updateBlockers.trim() || undefined
      });
      setUpdateSuccess(true);
      setUpdateContent('');
      setUpdateBlockers('');
      setTimeout(() => {
        setActiveUpdateMissionId(null);
        setUpdateSuccess(false);
      }, 2000);
      fetchDashboardData();
    } catch (err: any) {
      setUpdateError(err.message || 'Failed to submit update');
    } finally {
      setUpdateSubmitting(false);
    }
  };

  const handleTestimonialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testimonialContent.trim()) return;

    setTestimonialSubmitting(true);
    setTestimonialSuccess(false);
    setTestimonialError(null);

    try {
      await api.post('/testimonials', { content: testimonialContent });
      setTestimonialSuccess(true);
      setTestimonialContent('');
      setTimeout(() => {
        setTestimonialSuccess(false);
      }, 3000);

      // Submitting a testimonial can complete a "write_testimonial" quest and
      // award its badge server-side, in the same request. Without this, the
      // Cube stays on this page and sees the pre-submit quest/badge state
      // until they manually refresh — the badge exists in the database, the
      // screen just hasn't asked for it yet.
      fetchDashboardData();
    } catch (err: any) {
      setTestimonialError(err.message || 'Failed to submit testimonial');
    } finally {
      setTestimonialSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-magenta border-t-transparent"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-red-50 text-red-600 border border-red-100 p-4 rounded-2xl flex items-center gap-2">
        <ShieldAlert className="w-5 h-5" />
        <span>{error || 'Error loading dashboard'}</span>
      </div>
    );
  }

  const { profile, activeMission, activeTeam, activeMissions, upcomingDemoDay, recentFeedback } = data;

  const missionsList: Array<{ mission: any; team: any; role?: string }> =
    (activeMissions && activeMissions.length > 0)
      ? activeMissions
      : (activeMission ? [{ mission: activeMission, team: activeTeam }] : []);

  return (
    <div className="flex flex-col gap-8">
      {/* Cube Banner */}
      <div className={`p-8 rounded-[2rem] flex flex-col sm:flex-row sm:justify-between sm:items-center gap-6 relative overflow-hidden transition-all ${
        profile.is_founding_cube
          ? 'bg-gradient-to-br from-[#1a1103] to-[#0a0701] text-white border-2 border-amber-500/50 shadow-[0_0_30px_rgba(245,158,11,0.15)]'
          : 'bg-gradient-to-br from-[#120009] to-[#0a0006] text-white shadow-premium'
      }`}>
        {/* Glow */}
        {profile.is_founding_cube ? (
          <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/15 rounded-full filter blur-[80px] pointer-events-none"></div>
        ) : (
          <div className="absolute top-0 right-0 w-80 h-80 bg-magenta/20 rounded-full filter blur-[80px] pointer-events-none"></div>
        )}

        <div className="flex flex-col gap-1.5 relative z-10">
          <div className="flex items-center gap-3">
            <span className={`text-white font-extrabold text-xs px-3 py-1 rounded-full uppercase tracking-wider ${
              profile.is_founding_cube 
                ? 'bg-gradient-to-r from-amber-500 to-yellow-600 shadow-sm shadow-amber-500/20' 
                : 'bg-magenta'
            }`}>
              {profile.current_level.replace('_', ' ')}
            </span>
            {profile.is_founding_cube && (
              <span className="bg-amber-400/10 border border-amber-400/30 text-amber-300 font-extrabold text-[10px] px-3 py-1 rounded-full flex items-center gap-1">
                <Award className="w-3.5 h-3.5 text-amber-400" />
                Founding Cube
              </span>
            )}
            <span className="text-gray-400 font-bold text-sm">Cube #{profile.cube_number}</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight mt-1 flex items-center gap-2">
            <span>{user?.name}</span>
            {profile.is_founding_cube && <Sparkles className="w-6 h-6 text-amber-400 animate-pulse" />}
          </h1>
          <p className="text-gray-400 text-sm font-medium">{profile.cohort} · {profile.university}</p>
          
          {profile.is_founding_cube && (
            <div className="bg-amber-400/10 border border-amber-400/20 text-amber-200 text-xs px-4 py-2.5 rounded-xl font-semibold flex items-center gap-2 mt-2 max-w-lg">
              <Sparkles className="w-4 h-4 text-amber-400 animate-bounce flex-shrink-0" />
              <span>You are recognized as one of the elite <strong>Founding Cubes</strong> of the Iceberg X Portal.</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-8 relative z-10">
          <div className="text-center">
            <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Badges Earned</p>
            <h2 className={`text-4xl font-extrabold mt-1 ${
              profile.is_founding_cube ? 'text-amber-400' : 'text-magenta'
            }`}>{profile.cube_badges?.length || 0}</h2>
          </div>
          <div className="text-center border-l border-white/10 pl-8">
            <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Status</p>
            <h2 className="text-xl font-bold text-gray-100 mt-2 uppercase tracking-wide">
              {profile.current_level.replace(/_/g, ' ')}
            </h2>
          </div>
        </div>
      </div>

      <MVCubesShelf />

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Active Mission & Team (Left 2 Columns) */}
        <div className="lg:col-span-2 flex flex-col gap-8">
          {missionsList.length === 0 ? (
            <div className="bg-white border border-gray-100 rounded-2xl p-8 shadow-subtle text-center flex flex-col items-center justify-center gap-2">
              <Rocket className="w-8 h-8 text-gray-300" />
              <h3 className="font-extrabold text-base text-gray-700">No Active Mission</h3>
              <p className="text-gray-400 text-xs max-w-sm">No active mission currently assigned. Ask your mentor for assignment.</p>
            </div>
          ) : (
            missionsList.map((item: any, index: number) => {
              const m = item.mission;
              const t = item.team;
              const isUpdateOpen = activeUpdateMissionId === m.id;

              return (
                <div key={m.id} className="flex flex-col gap-6">
                  {/* Mission Details Card */}
                  <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-subtle flex flex-col gap-6">
                    <div className="flex justify-between items-center border-b border-gray-50 pb-3 flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <Rocket className="w-5 h-5 text-magenta" />
                        <h3 className="font-extrabold text-lg">
                          {missionsList.length > 1 ? `Active Mission ${index + 1}` : 'My Active Mission'}
                        </h3>
                        {item.role && (
                          <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full uppercase">
                            {item.role.replace(/_/g, ' ')}
                          </span>
                        )}
                      </div>
                      {m.status && (
                        <span className="text-xs font-bold text-magenta bg-magenta/5 border border-magenta/10 px-2.5 py-1 rounded-full uppercase">
                          {m.status.replace(/_/g, ' ')}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col gap-4">
                      <div>
                        <Link to={`/missions/${m.id}`} className="text-xl font-bold hover:text-magenta transition-colors">
                          {m.title}
                        </Link>
                        <div className="markdown-body text-gray-500 text-xs mt-2 leading-relaxed">
                          <CustomMarkdown>{m.description}</CustomMarkdown>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                        {m.slack_channel_url && (
                          <a
                            href={m.slack_channel_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-xs font-bold text-gray-600 hover:text-magenta bg-gray-50 border border-gray-100 p-3 rounded-xl transition-all"
                          >
                            <MessageCircle className="w-4 h-4 text-magenta" />
                            <span>Slack Channel Link</span>
                            <ExternalLink className="w-3.5 h-3.5 ml-auto text-gray-400" />
                          </a>
                        )}
                        {m.repository_url && (
                          <a
                            href={m.repository_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-xs font-bold text-gray-600 hover:text-magenta bg-gray-50 border border-gray-100 p-3 rounded-xl transition-all"
                          >
                            <PlayCircle className="w-4 h-4 text-magenta" />
                            <span>Repository URL</span>
                            <ExternalLink className="w-3.5 h-3.5 ml-auto text-gray-400" />
                          </a>
                        )}
                      </div>

                      {/* Submissions/Updates Quick Buttons */}
                      <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-gray-50">
                        <button
                          onClick={() => {
                            if (activeUpdateMissionId === m.id) {
                              setActiveUpdateMissionId(null);
                            } else {
                              setActiveUpdateMissionId(m.id);
                              setUpdateSuccess(false);
                              setUpdateError(null);
                            }
                          }}
                          className="flex items-center gap-2 px-4 py-2.5 bg-magenta text-white font-bold text-xs rounded-xl hover:bg-magenta-hover transition-colors shadow-sm shadow-magenta/10"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>{isUpdateOpen ? 'Cancel Update' : 'Submit Update'}</span>
                        </button>
                        <Link
                          to={`/submit-demo?missionId=${m.id}`}
                          className="flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white font-bold text-xs rounded-xl hover:bg-black transition-colors"
                        >
                          <PlayCircle className="w-3.5 h-3.5" />
                          <span>Submit Demo Day Material</span>
                        </Link>
                      </div>

                      {/* Submit Update Inline Card */}
                      {isUpdateOpen && (
                        <form onSubmit={(e) => handleUpdateSubmit(e, m.id)} className="mt-4 border border-magenta/10 bg-magenta/5 p-4 rounded-xl flex flex-col gap-3.5 animate-fadeIn">
                          <h4 className="font-bold text-xs text-magenta uppercase tracking-wider">
                            New Progress Update: {m.title}
                          </h4>

                          {updateSuccess && (
                            <div className="bg-green-50 text-green-700 text-xs font-semibold p-2.5 rounded-lg border border-green-100">
                              Update submitted successfully!
                            </div>
                          )}
                          {updateError && (
                            <div className="bg-red-50 text-red-700 text-xs font-semibold p-2.5 rounded-lg border border-red-100">
                              {updateError}
                            </div>
                          )}

                          <div className="flex items-center gap-4 flex-wrap">
                            <label className="text-xs font-bold text-gray-600">Type:</label>
                            <div className="flex gap-3">
                              {['daily', 'weekly', 'mission_progress'].map((type) => (
                                <label key={type} className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 cursor-pointer">
                                  <input
                                    type="radio"
                                    name={`updateType-${m.id}`}
                                    value={type}
                                    checked={updateType === type}
                                    onChange={() => setUpdateType(type)}
                                    className="text-magenta focus:ring-magenta"
                                  />
                                  <span className="capitalize">{type.replace('_', ' ')}</span>
                                </label>
                              ))}
                            </div>
                          </div>

                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-bold text-gray-600">What did you build or discover?</label>
                            <textarea
                              required
                              placeholder="Detail your milestones and findings..."
                              value={updateContent}
                              onChange={(e) => setUpdateContent(e.target.value)}
                              disabled={updateSubmitting}
                              className="w-full p-2.5 bg-white border border-gray-200 focus:border-magenta rounded-lg text-xs outline-none font-semibold transition-colors resize-none"
                              rows={3}
                            />
                          </div>

                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-bold text-gray-600">Blockers (Optional)</label>
                            <input
                              type="text"
                              placeholder="Any engineering bottlenecks or support needed?"
                              value={updateBlockers}
                              onChange={(e) => setUpdateBlockers(e.target.value)}
                              disabled={updateSubmitting}
                              className="w-full p-2.5 bg-white border border-gray-200 focus:border-magenta rounded-lg text-xs outline-none font-semibold transition-colors"
                            />
                          </div>

                          <div className="flex gap-2 justify-end">
                            <button
                              type="button"
                              onClick={() => setActiveUpdateMissionId(null)}
                              disabled={updateSubmitting}
                              className="px-3.5 py-1.5 bg-white border border-gray-200 text-gray-500 font-bold text-xs rounded-lg hover:bg-gray-50 transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              disabled={updateSubmitting || !updateContent.trim()}
                              className="px-4 py-1.5 bg-magenta text-white font-bold text-xs rounded-lg hover:bg-magenta-hover transition-colors disabled:opacity-75"
                            >
                              {updateSubmitting ? 'Submitting...' : 'Send Update'}
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  </div>

                  {/* Team Members Card */}
                  {t && (
                    <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-subtle flex flex-col gap-4">
                      <h3 className="font-extrabold text-lg border-b border-gray-50 pb-3">
                        Team: {t.name}
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {t.members && t.members.map((member: any) => (
                          <div key={member.id} className="border border-gray-100 bg-gray-50/50 p-4 rounded-xl">
                            <h4 className="font-bold text-sm text-gray-900">{member.cube?.user?.name || 'Unknown'}</h4>
                            <p className="text-xs text-magenta font-bold tracking-wider uppercase mt-1">
                              {(member.role || 'Member').replace(/_/g, ' ')}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">Cube #{member.cube?.cube_number || 'N/A'}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Sidebar Achievements & feedback (Right Column) */}
        <div className="flex flex-col gap-8">
          
          {/* Assigned Mentor */}
          {profile.assigned_mentor && (
            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-subtle flex flex-col gap-3">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">My Assigned Mentor</p>
              <div>
                <h4 className="font-bold text-base text-gray-900">{profile.assigned_mentor.name}</h4>
                <p className="text-xs text-gray-500 mt-0.5">{profile.assigned_mentor.email}</p>
              </div>
            </div>
          )}

          {/* Upcoming Demo Day */}
          {upcomingDemoDay && (
            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-subtle flex flex-col gap-3">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Upcoming Demo Day</p>
              <div>
                <h4 className="font-bold text-sm text-gray-900">{upcomingDemoDay.title}</h4>
                <p className="text-xs text-magenta font-bold mt-1">
                  {new Date(upcomingDemoDay.date).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                </p>
              </div>
            </div>
          )}

          {/* Active Quests Dashboard */}
          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-subtle flex flex-col gap-4">
            <h3 className="font-extrabold text-lg border-b border-gray-50 pb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-magenta" />
                <span>My Quests</span>
              </div>
              <Link to="/quests" className="text-[10px] text-magenta font-black uppercase hover:underline">
                View All
              </Link>
            </h3>

            {quests && quests.length > 0 ? (
              <div className="flex flex-col gap-4">
                {quests.slice(0, 3).map((cq: any) => {
                  const q = cq.quest;
                  const progressPercentage = Math.min(100, (cq.current_value / q.criteria_value) * 100);
                  
                  return (
                    <div key={cq.id} className="border border-slate-100 rounded-xl p-4 flex flex-col gap-3 relative overflow-hidden bg-slate-50/50">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-white border border-slate-200 text-slate-500 rounded-md">
                          {q.difficulty}
                        </span>
                        {cq.is_completed ? (
                          <span className="flex items-center gap-0.5 text-[10px] font-bold text-green-600">
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span>Done</span>
                          </span>
                        ) : (
                          <span className="flex items-center gap-0.5 text-[10px] font-bold text-amber-500">
                            <Clock className="w-3.5 h-3.5 animate-pulse" />
                            <span>In Progress</span>
                          </span>
                        )}
                      </div>

                      <div>
                        <h4 className="font-extrabold text-xs text-slate-800 leading-tight">{q.title}</h4>
                        <p className="text-[10px] font-semibold text-slate-400 mt-1 line-clamp-2 leading-relaxed">{q.description}</p>
                      </div>

                      <div className="flex flex-col gap-1.5 mt-1">
                        <div className="flex justify-between items-center text-[9px] font-extrabold text-slate-500">
                          <span className="truncate max-w-[70%]">
                            {q.criteria_type === 'missions_completed' ? `Complete ${q.criteria_value} Missions` :
                             q.criteria_type === 'missions_assigned' ? `Assigned to ${q.criteria_value} Mission(s)` :
                             q.criteria_type === 'average_score' ? `Average Score of ${q.criteria_value}/5` :
                             q.criteria_type === 'login_streak' ? `${q.criteria_value} Day Login Streak` :
                             q.criteria_type === 'meeting_attendance' ? `${q.criteria_value}% Meeting Attendance` :
                             q.criteria_type === 'profile_completion' ? 'Complete your Profile' :
                             q.criteria_type === 'nda_signed' ? 'Sign the Non-Disclosure Agreement (NDA)' :
                             (q.criteria_type === 'profile_picture' || q.criteria_type === 'avatar_upload') ? 'Upload your Profile Picture' :
                             q.criteria_type === 'quiz_score' ? `Score ${q.criteria_value}+ in Web Fundamentals Quiz` :
                             q.criteria_type === 'quiz_completed' ? 'Complete Web Fundamentals Quiz' :
                             q.criteria_type === 'write_testimonial' ? `Submit ${q.criteria_value} Testimonial(s)` :
                             (q.criteria_type === 'mission_updates_count' || q.criteria_type === 'mission_updates') ? (q.criteria_value === 1 ? 'Post 1 Mission Update' : `Post ${q.criteria_value} Updates`) :
                             q.criteria_type === 'daily_update_streak' ? `${q.criteria_value} Day Update Streak` :
                             q.criteria_type === 'weekly_update_streak' ? `${q.criteria_value} Week Update Streak` :
                             peerQuestLabel(q.criteria_type, q.criteria_value, q.min_sample_size) ??
                             `Goal: ${q.criteria_value}`}
                          </span>
                          <span>
                            {q.criteria_type === 'profile_completion' ? (cq.current_value >= 1 ? 'Completed' : 'Incomplete') :
                             q.criteria_type === 'nda_signed' ? (cq.current_value >= 1 ? 'Signed' : 'Not Signed') :
                             (q.criteria_type === 'profile_picture' || q.criteria_type === 'avatar_upload') ? (cq.current_value >= 1 ? 'Uploaded' : 'Missing') :
                             q.criteria_type === 'quiz_completed' ? (cq.current_value >= 1 ? 'Completed' : 'Not Completed') :
                             q.criteria_type === 'quiz_score' ? `${Math.round(cq.current_value)} / ${q.criteria_value} pts` :
                             q.criteria_type === 'average_score' ? `${cq.current_value.toFixed(2)} / ${q.criteria_value.toFixed(1)}` :
                             q.criteria_type === 'meeting_attendance' ? `${cq.current_value.toFixed(1)}% / ${q.criteria_value}%` :
                             q.criteria_type === 'daily_update_streak' ? `${cq.current_value} / ${q.criteria_value}d` :
                             q.criteria_type === 'weekly_update_streak' ? `${cq.current_value} / ${q.criteria_value}w` :
                             peerQuestProgressText(q.criteria_type, cq.current_value, q.criteria_value) ??
                             `${cq.current_value} / ${q.criteria_value}`}
                          </span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div 
                            className="h-full rounded-full bg-magenta transition-all duration-500"
                            style={{ width: `${progressPercentage}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-gray-400 text-xs py-4 text-center">No quests assigned yet.</p>
            )}
          </div>

          {/* Earned Badges */}
          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-subtle flex flex-col gap-4">
            <h3 className="font-extrabold text-lg border-b border-gray-50 pb-3 flex items-center gap-2">
              <Award className="w-5 h-5 text-magenta" />
              <span>Earned Badges</span>
            </h3>

            {profile.cube_badges && profile.cube_badges.length > 0 ? (
              <div className="grid grid-cols-3 gap-3">
                {/* Rarest first, each shown in its own rarity treatment */}
                {[...profile.cube_badges]
                  .sort((a: any, b: any) => compareByRarity(a.badge?.rarity, b.badge?.rarity))
                  .map((award: any) => {
                    const meta = getRarityMeta(award.badge?.rarity);
                    return (
                      <div
                        key={award.id}
                        className={`group relative ${meta.frame} transition-transform duration-300 hover:scale-105`}
                        title={award.reason}
                      >
                        {meta.key === 'Epic' && <span className="badge-sheen" />}
                        <div className={`relative ${meta.surface} flex flex-col items-center text-center p-2.5`}>
                          <BadgeDisc icon={award.badge?.icon} rarity={award.badge?.rarity} size="sm" />
                          <span className={`text-[10px] font-bold mt-2 truncate max-w-full ${meta.title}`}>
                            {award.badge.name}
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            ) : (
              <p className="text-gray-400 text-sm py-4 text-center">No badges awarded yet. Deliver a working prototype to earn badges!</p>
            )}
          </div>

          {/* Recent feedback */}
          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-subtle flex flex-col gap-4">
            <h3 className="font-extrabold text-lg border-b border-gray-50 pb-3 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-magenta" />
              <span>Recent Feedback</span>
            </h3>

            {recentFeedback && recentFeedback.length > 0 ? (
              <div className="flex flex-col gap-4">
                {recentFeedback.map((feedback: any) => (
                  <div key={feedback.id} className="border-l-2 border-magenta pl-3.5 py-1">
                    {/* A scorecard can be general rather than tied to a mission
                        (MentorFeedback.mission_id is nullable), in which case
                        `mission` comes back null. */}
                    <p className="text-xs font-bold text-gray-400">
                      {feedback.mission ? feedback.mission.title : 'General Evaluation'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1 font-semibold">Strengths:</p>
                    <p className="text-xs text-gray-600 italic">"{feedback.strengths}"</p>
                    <p className="text-xs text-gray-500 mt-2 font-semibold">Areas to Improve:</p>
                    <p className="text-xs text-gray-600 italic">"{feedback.areas_to_improve}"</p>
                    <p className="text-[10px] text-gray-400 mt-2.5">
                      By {feedback.mentor.name} on {new Date(feedback.created_at).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 text-sm py-4 text-center">No visible feedback reports yet.</p>
            )}
          </div>

          {/* Share Testimonial */}
          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-subtle flex flex-col gap-4">
            <h3 className="font-extrabold text-lg border-b border-gray-50 pb-3 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-magenta" />
              <span>Share Fellowship Testimonial</span>
            </h3>
            
            <p className="text-xs text-gray-500 leading-relaxed font-semibold">
              Loved your journey with Iceberg X? Write a testimonial! Once approved by an Admin, it will be showcased on our main landing page.
            </p>

            <form onSubmit={handleTestimonialSubmit} className="flex flex-col gap-3">
              {testimonialSuccess && (
                <div className="bg-green-50 text-green-700 text-xs font-semibold p-2.5 rounded-lg border border-green-100">
                  Testimonial submitted for approval!
                </div>
              )}
              {testimonialError && (
                <div className="bg-red-50 text-red-700 text-xs font-semibold p-2.5 rounded-lg border border-red-100">
                  {testimonialError}
                </div>
              )}

              <textarea
                required
                rows={3}
                maxLength={300}
                placeholder="Share your R&D projects experience, skills learned, and mentorship highlight..."
                value={testimonialContent}
                onChange={e => setTestimonialContent(e.target.value)}
                className="w-full p-2.5 border border-gray-100 bg-gray-50 focus:bg-white focus:border-magenta rounded-lg text-xs outline-none resize-none font-semibold transition"
              />

              <div className="flex justify-between items-center text-[10px] font-extrabold px-1">
                <span className={testimonialContent.length >= 300 ? 'text-magenta' : 'text-gray-400'}>
                  {testimonialContent.length} / 300 characters
                </span>
                {testimonialContent.length >= 300 && <span className="text-magenta">Max limit reached</span>}
              </div>

              <button
                type="submit"
                disabled={testimonialSubmitting || !testimonialContent.trim()}
                className="w-full py-2 bg-gray-900 text-white font-bold text-xs rounded-xl hover:bg-black transition-colors disabled:opacity-50"
              >
                {testimonialSubmitting ? 'Submitting...' : 'Submit Testimonial'}
              </button>
            </form>
          </div>

        </div>

      </div>
    </div>
  );
};
