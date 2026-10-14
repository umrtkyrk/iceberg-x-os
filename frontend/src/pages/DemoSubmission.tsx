import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Rocket, ShieldAlert, Sparkles, Send } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

export const DemoSubmission: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryMissionId = searchParams.get('missionId');

  const [missions, setMissions] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form Fields
  const [missionId, setMissionId] = useState('');
  const [teamId, setTeamId] = useState('');
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [whatWeBuilt, setWhatWeBuilt] = useState('');
  const [whatWeLearned, setWhatWeLearned] = useState('');
  const [whatWorkedWell, setWhatWorkedWell] = useState('');
  const [whatCouldWeHaveDoneBetter, setWhatCouldWeHaveDoneBetter] = useState('');
  const [recommendation, setRecommendation] = useState('');
  const [repositoryUrl, setRepositoryUrl] = useState('');
  const [pullRequestUrl, setPullRequestUrl] = useState('');
  const [demoUrl, setDemoUrl] = useState('');
  const [documentUrl, setDocumentUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // AI assistant states
  const [aiRefResult, setAiRefResult] = useState<string | null>(null);
  const [aiRefLoading, setAiRefLoading] = useState(false);

  useEffect(() => {
    const fetchMissionsAndTeams = async () => {
      try {
        const [missionsRes, teamsRes] = await Promise.all([
          api.get('/missions'),
          api.get('/teams')
        ]);

        // Filter teams where logged-in user is a member
        const userTeams = teamsRes.filter((t: any) =>
          t.members && t.members.some((m: any) => 
            m.cube?.user?.id === user?.id || 
            m.cube?.user_id === user?.id || 
            (user?.cubeProfileId && (m.cube_id === user.cubeProfileId || m.cube?.id === user.cubeProfileId))
          )
        );
        // Extract missions from these teams
        const userMissions = userTeams.map((t: any) => t.mission).filter(Boolean);
        const uniqueMissions = Array.from(new Map(userMissions.map((m: any) => [m.id, m])).values());

        setTeams(userTeams);
        setMissions(uniqueMissions);

        if (uniqueMissions.length > 0) {
          const matched = queryMissionId && uniqueMissions.find((m: any) => m.id === queryMissionId);
          const initialMissionId = matched ? queryMissionId : uniqueMissions[0].id;
          setMissionId(initialMissionId);

          const matchingTeam = userTeams.find((t: any) => t.mission_id === initialMissionId);
          if (matchingTeam) {
            setTeamId(matchingTeam.id);
          } else if (userTeams.length > 0) {
            setTeamId(userTeams[0].id);
          }
        }
      } catch (err: any) {
        setError(err.message || 'Failed to initialize page data');
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchMissionsAndTeams();
    }
  }, [user]);

  const handleFetchAIReflection = async () => {
    if (!title || !whatCouldWeHaveDoneBetter) {
      alert('Demo Title and "What could we have done better?" are required to draft reflection assistance.');
      return;
    }

    setAiRefLoading(true);
    setAiRefResult(null);

    try {
      const res = await api.post('/ai/demo-reflection', {
        title,
        summary,
        what_we_built: whatWeBuilt,
        what_we_learned: whatWeLearned,
        what_worked_well: whatWorkedWell,
        what_could_we_have_done_better: whatCouldWeHaveDoneBetter
      });
      setAiRefResult(res.reflection);
    } catch (err: any) {
      alert(err.message || 'Failed to draft AI reflection');
    } finally {
      setAiRefLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!missionId || !title || !summary || !whatWeBuilt || !whatWeLearned || !whatWorkedWell || !whatCouldWeHaveDoneBetter) {
      setError('Please fill in all required fields. "What could we have done better?" is mandatory.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const payload = {
      mission_id: missionId,
      team_id: teamId || null,
      title,
      summary,
      what_we_built: whatWeBuilt,
      what_we_learned: whatWeLearned,
      what_worked_well: whatWorkedWell,
      what_could_we_have_done_better: whatCouldWeHaveDoneBetter,
      recommendation: recommendation || null,
      repository_url: repositoryUrl || null,
      pull_request_url: pullRequestUrl || null,
      demo_url: demoUrl || null,
      document_url: documentUrl || null,
      video_url: videoUrl || null
    };

    try {
      await api.post('/demos', payload);
      navigate(`/missions/${missionId}`);
    } catch (err: any) {
      setError(err.message || 'Failed to save demo submission');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-magenta border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-6">
      
      {/* Header */}
      <PageHeader eyebrow="Mission delivery" title="Demo Day Submission" description="Share what you built, what you learned, and what comes next." />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Main Form (Left 2 Columns) */}
        {missions.length === 0 ? (
          <div className="lg:col-span-2 bg-white border border-gray-100 rounded-3xl p-8 shadow-subtle text-center flex flex-col items-center justify-center gap-4 py-16">
            <ShieldAlert className="w-12 h-12 text-magenta" />
            <h3 className="font-extrabold text-gray-900 text-lg">No Active Mission Assignments</h3>
            <p className="text-xs text-gray-500 max-w-sm leading-relaxed font-semibold">
              You are not currently assigned to any active mission teams. Demo submissions are restricted to assigned Cubes.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="lg:col-span-2 bg-white border border-gray-100 rounded-3xl p-6 sm:p-8 shadow-subtle flex flex-col gap-5">
          
          {error && (
            <div className="bg-red-50 text-red-600 border border-red-100 p-4 rounded-2xl flex items-center gap-2 text-sm font-semibold">
              <ShieldAlert className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase">Mission <span className="text-red-500">*</span></label>
              <select
                value={missionId}
                onChange={e => setMissionId(e.target.value)}
                className="p-2 border border-gray-100 bg-gray-50 rounded-lg text-xs font-semibold outline-none cursor-pointer"
              >
                {missions.map(m => (
                  <option key={m.id} value={m.id}>{m.title}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase">Mission Team (Optional)</label>
              <select
                value={teamId}
                onChange={e => setTeamId(e.target.value)}
                className="p-2 border border-gray-100 bg-gray-50 rounded-lg text-xs font-semibold outline-none cursor-pointer"
              >
                <option value="">No team assignment</option>
                {/* A team can sit without a mission (MissionTeam.mission_id is
                    nullable, and detaching a mission leaves the team intact). */}
                {teams.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name} (Mission: {t.mission ? t.mission.title : 'unassigned'})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-gray-500 uppercase">Demo Title <span className="text-red-500">*</span></label>
            <input
              type="text"
              required
              placeholder="e.g. LLM routing engine v1.0"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="p-2.5 border border-gray-100 bg-gray-50 hover:bg-gray-100/50 focus:border-magenta focus:bg-white rounded-lg text-xs outline-none font-semibold transition-all"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-gray-500 uppercase">Summary <span className="text-red-500">*</span></label>
            <textarea
              required
              rows={2}
              placeholder="Briefly summarize the prototype in 2-3 sentences..."
              value={summary}
              onChange={e => setSummary(e.target.value)}
              className="p-2.5 border border-gray-100 bg-gray-50 hover:bg-gray-100/50 focus:border-magenta focus:bg-white rounded-lg text-xs outline-none font-semibold transition-all resize-none"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-gray-500 uppercase">What We Built <span className="text-red-500">*</span></label>
            <textarea
              required
              rows={3}
              placeholder="Detail the technical components, API endpoints, microservices created..."
              value={whatWeBuilt}
              onChange={e => setWhatWeBuilt(e.target.value)}
              className="p-2.5 border border-gray-100 bg-gray-50 hover:bg-gray-100/50 focus:border-magenta focus:bg-white rounded-lg text-xs outline-none font-semibold transition-all resize-none"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-gray-500 uppercase">What We Learned <span className="text-red-500">*</span></label>
            <textarea
              required
              rows={2}
              placeholder="What did this mission teach you about engineering or R&D?"
              value={whatWeLearned}
              onChange={e => setWhatWeLearned(e.target.value)}
              className="p-2.5 border border-gray-100 bg-gray-50 hover:bg-gray-100/50 focus:border-magenta focus:bg-white rounded-lg text-xs outline-none font-semibold transition-all resize-none"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-gray-500 uppercase">What Worked Well <span className="text-red-500">*</span></label>
            <textarea
              required
              rows={2}
              placeholder="What succeeded? What went exceptionally well?"
              value={whatWorkedWell}
              onChange={e => setWhatWorkedWell(e.target.value)}
              className="p-2.5 border border-gray-100 bg-gray-50 hover:bg-gray-100/50 focus:border-magenta focus:bg-white rounded-lg text-xs outline-none font-semibold transition-all resize-none"
            />
          </div>

          {/* MANDATORY FIELD */}
          <div className="flex flex-col gap-1 border-l-2 border-magenta pl-3.5">
            <label className="text-[10px] font-extrabold text-magenta uppercase">
              What Could We Have Done Better? (Mandatory) <span className="text-magenta">*</span>
            </label>
            <textarea
              required
              rows={3}
              placeholder="Self-reflection on bottlenecks, delays, bad architectural decisions, or bugs. This is a core part of Iceberg culture."
              value={whatCouldWeHaveDoneBetter}
              onChange={e => setWhatCouldWeHaveDoneBetter(e.target.value)}
              className="p-2.5 border border-magenta/20 bg-magenta/5 hover:border-magenta/40 focus:border-magenta focus:bg-white rounded-lg text-xs outline-none font-semibold transition-all resize-none"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-gray-500 uppercase">Recommendations for Next Phase</label>
            <textarea
              rows={2}
              placeholder="Should we integrate this code? Put it on product backlog? Archive?"
              value={recommendation}
              onChange={e => setRecommendation(e.target.value)}
              className="p-2.5 border border-gray-100 bg-gray-50 hover:bg-gray-100/50 focus:border-magenta focus:bg-white rounded-lg text-xs outline-none font-semibold transition-all resize-none"
            />
          </div>

          {/* Links Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-gray-50 pt-5 mt-2">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase">Code Repository Link</label>
              <input type="url" placeholder="GitHub/GitLab repository URL" value={repositoryUrl} onChange={e => setRepositoryUrl(e.target.value)} className="p-2 border border-gray-100 bg-gray-50 rounded-lg text-xs outline-none" />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase">Pull Request URL</label>
              <input type="url" placeholder="Merge request or PR URL" value={pullRequestUrl} onChange={e => setPullRequestUrl(e.target.value)} className="p-2 border border-gray-100 bg-gray-50 rounded-lg text-xs outline-none" />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase">Live Demo URL</label>
              <input type="url" placeholder="Live web prototype link" value={demoUrl} onChange={e => setDemoUrl(e.target.value)} className="p-2 border border-gray-100 bg-gray-50 rounded-lg text-xs outline-none" />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase">Loom / Explainer Video URL</label>
              <input type="url" placeholder="Explainer walkthrough video" value={videoUrl} onChange={e => setVideoUrl(e.target.value)} className="p-2 border border-gray-100 bg-gray-50 rounded-lg text-xs outline-none" />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full mt-4 py-3.5 bg-magenta text-white font-bold text-xs tracking-wide uppercase rounded-xl hover:bg-magenta-hover active:scale-[0.99] transition-all shadow-md shadow-magenta/15 flex items-center justify-center gap-1.5"
          >
            <Send className="w-4 h-4" />
            <span>{submitting ? 'Submitting material...' : 'Submit Demo Material'}</span>
          </button>
          </form>
        )}

        {/* Sidebar: AI reflection assistant */}
        <div className="flex flex-col gap-6">
          <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-subtle flex flex-col gap-4">
            <h3 className="font-extrabold text-sm border-b border-gray-50 pb-2 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-magenta" />
              <span>AI Reflection Helper</span>
            </h3>

            <p className="text-xs text-gray-400">
              Stuck on documenting what could have been done better? Submit your draft, and the AI helper will write a professional synthesis of lessons and Improvement actions.
            </p>

            {aiRefResult ? (
              <div className="flex flex-col gap-3">
                <div className="markdown-body bg-magenta/5 border border-magenta/10 p-4 rounded-xl text-xs text-gray-700 max-h-80 overflow-y-auto font-medium leading-relaxed">
                  <ReactMarkdown>{aiRefResult}</ReactMarkdown>
                </div>
                <button
                  onClick={handleFetchAIReflection}
                  className="py-1.5 bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-600 rounded-lg text-xs font-bold transition-all"
                >
                  Regenerate reflection
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleFetchAIReflection}
                disabled={aiRefLoading}
                className="w-full py-2.5 bg-magenta text-white font-bold text-xs rounded-xl hover:bg-magenta-hover transition-colors shadow-sm flex items-center justify-center gap-2"
              >
                {aiRefLoading ? (
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Help Me Reflect</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

      </div>

    </div>
  );
};
import { PageHeader } from '../components/PageHeader';
