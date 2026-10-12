import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { Link } from 'react-router-dom';
import { Users, Rocket, Clock, MessageSquare, AlertCircle, Sparkles, BookOpen, Radar as RadarIcon, ArrowRight } from 'lucide-react';
import { CustomMarkdown } from '../components/CustomMarkdown';

export const MentorDashboard: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMentorData = async () => {
      try {
        const res = await api.get('/mentor/dashboard');
        setData(res);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch mentor dashboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchMentorData();
  }, []);

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
        <AlertCircle className="w-5 h-5" />
        <span>{error || 'Error loading dashboard'}</span>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      
      {/* Main Content (Left/Middle 2 Columns) */}
      <div className="lg:col-span-2 flex flex-col gap-8">
        
        {/* Header */}
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Mentor Workspace</h1>
          <p className="text-gray-500 mt-1">Review prototypes, submit feedback, and guide your assigned Cubes.</p>
        </div>

        {/* Radar entry: who the programme sees, and who it might be missing */}
        <Link
          to="/radar"
          className="peer-aurora group relative flex items-center justify-between gap-4 overflow-hidden rounded-2xl p-5 text-white transition hover:-translate-y-0.5 hover:shadow-premium"
        >
          <div className="flex items-center gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 backdrop-blur">
              <RadarIcon className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-extrabold">Radar</p>
              <p className="text-xs font-medium leading-relaxed text-white/70">
                Find quiet high performers and growth signals from peer feedback. Anonymous aggregates only.
              </p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 transition group-hover:translate-x-1" />
        </Link>

        {/* Assigned Missions */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-subtle flex flex-col gap-4">
          <h3 className="font-extrabold text-lg flex items-center gap-2">
            <Rocket className="w-5 h-5 text-magenta" />
            <span>Assigned Missions</span>
          </h3>

          {data.assignedMissions && data.assignedMissions.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.assignedMissions.map((m: any) => (
                <div key={m.id} className="border border-gray-100 rounded-xl p-4 hover:border-magenta/35 transition-all flex flex-col justify-between gap-3">
                  <div>
                    <h4 className="font-bold text-sm text-gray-900 leading-snug">{m.title}</h4>
                    <p className="text-xs text-magenta bg-magenta/5 border border-magenta/10 px-2 py-0.5 rounded w-max mt-1.5 uppercase font-bold tracking-wider">
                      {m.status.replace(/_/g, ' ')}
                    </p>
                    <div className="markdown-body text-xs text-gray-400 mt-2 line-clamp-2 leading-relaxed">
                      <CustomMarkdown>{m.description}</CustomMarkdown>
                    </div>
                  </div>
                  <Link to={`/missions/${m.id}`} className="text-xs font-bold text-magenta hover:underline mt-2 self-start flex items-center gap-1">
                    <span>Configure & Review</span>
                    <Sparkles className="w-3.5 h-3.5 text-magenta" />
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-sm py-4 text-center">No missions currently assigned to you.</p>
          )}
        </div>

        {/* Pending Reviews (Demo submissions) */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-subtle flex flex-col gap-4">
          <h3 className="font-extrabold text-lg flex items-center gap-2">
            <Clock className="w-5 h-5 text-magenta" />
            <span>Pending Demo Reviews</span>
          </h3>

          {data.pendingReviews && data.pendingReviews.length > 0 ? (
            <div className="flex flex-col divide-y divide-gray-50">
              {data.pendingReviews.map((review: any) => (
                <div key={review.id} className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                  <div>
                    <h4 className="font-bold text-sm text-gray-900">{review.title}</h4>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Mission: <span className="font-semibold">{review.mission.title}</span> · Submitted by <span className="font-semibold text-gray-600">{review.submitted_by.name}</span>
                    </p>
                    <p className="text-xs text-gray-500 mt-2 line-clamp-2 italic">"{review.summary}"</p>
                  </div>
                  <Link
                    to={`/missions/${review.mission_id}/review?cube=${review.submitted_by.id}`}
                    className="self-start sm:self-center px-4 py-2 bg-magenta text-white font-bold text-xs rounded-xl hover:bg-magenta-hover transition-colors shadow-sm shadow-magenta/15 whitespace-nowrap"
                  >
                    Submit Scorecard
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-sm py-4 text-center">All demo submissions have been reviewed.</p>
          )}
        </div>

        {/* Recent Updates timeline */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-subtle flex flex-col gap-4">
          <h3 className="font-extrabold text-lg flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-magenta" />
            <span>Updates Feed</span>
          </h3>

          {data.recentUpdates && data.recentUpdates.length > 0 ? (
            <div className="flex flex-col gap-4">
              {data.recentUpdates.map((update: any) => (
                <div key={update.id} className="border-l-2 border-magenta/20 pl-4 py-1 flex flex-col gap-1 hover:border-magenta transition-all">
                  <div className="flex justify-between items-center">
                    <p className="text-xs font-bold text-gray-700">
                      {update.cube.name} · <span className="text-gray-400 font-medium">{update.mission.title}</span>
                    </p>
                    <span className="text-[10px] font-bold text-magenta bg-magenta/5 border border-magenta/10 px-2 py-0.5 rounded-full uppercase tracking-wider">
                      {update.type}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mt-0.5">{update.content}</p>
                  {update.blockers && (
                    <p className="text-xs text-red-500 font-semibold mt-1">
                      ⚠️ Blockers: {update.blockers}
                    </p>
                  )}
                  <span className="text-[10px] text-gray-400 mt-1">{new Date(update.created_at).toLocaleString()}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-sm py-4 text-center">No updates submitted recently.</p>
          )}
        </div>

      </div>

      {/* Sidebar (Right Column) */}
      <div className="flex flex-col gap-8">
        
        {/* Assigned Cubes */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-subtle flex flex-col gap-4">
          <h3 className="font-extrabold text-lg border-b border-gray-50 pb-3 flex items-center gap-2">
            <Users className="w-5 h-5 text-magenta" />
            <span>My Cubes</span>
          </h3>

          {data.assignedCubes && data.assignedCubes.length > 0 ? (
            <div className="flex flex-col gap-3">
              {data.assignedCubes.map((c: any) => (
                <Link
                  key={c.id}
                  to={`/cubes/${c.id}`}
                  className="flex items-center justify-between p-3 border border-gray-100 hover:border-magenta/20 hover:bg-gray-50 rounded-xl transition-all"
                >
                  <div>
                    <h4 className="font-bold text-sm">{c.user.name}</h4>
                    <p className="text-xs text-gray-400 mt-0.5">{c.cohort}</p>
                  </div>
                  <span className="bg-magenta/5 text-magenta text-xs font-bold px-2 py-0.5 rounded-full">
                    #{c.cube_number}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-sm py-4 text-center">No Cubes assigned to you.</p>
          )}
        </div>

        {/* Cubes Needing Feedback */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-subtle flex flex-col gap-4">
          <h3 className="font-extrabold text-lg border-b border-gray-50 pb-3 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-magenta" />
            <span>Pending Feedback</span>
          </h3>

          {data.cubesNeedingFeedback && data.cubesNeedingFeedback.length > 0 ? (
            <div className="flex flex-col gap-4">
              {data.cubesNeedingFeedback.map((cube: any) => (
                <div key={cube.cubeProfileId} className="border border-dashed border-gray-200 rounded-xl p-3.5 bg-gray-50/50 flex flex-col gap-2">
                  <div>
                    <p className="text-xs font-extrabold text-gray-400">CUBE #{cube.cubeNumber}</p>
                    <h4 className="font-bold text-sm text-gray-900 mt-0.5">{cube.name}</h4>
                  </div>
                  <div className="flex flex-col gap-1.5 mt-1">
                    {cube.missions.map((m: any) => (
                      <Link
                        key={m.id}
                        to={`/missions/${m.id}/review?cube=${cube.cubeProfileId}`}
                        className="text-xs font-bold text-magenta hover:underline flex items-center gap-1"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>Score: {m.title}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-sm py-4 text-center">All assigned Cubes have feedback.</p>
          )}
        </div>

      </div>

    </div>
  );
};
