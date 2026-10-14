import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { ShieldAlert, Sparkles, Star, Save, Calendar, AlertCircle, CheckCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { RadarChart } from '../components/RadarChart';

export const Review: React.FC = () => {
  const { id } = useParams<{ id: string }>(); // Optional mission ID
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Search params to get prefilled Cube ID
  const queryParams = new URLSearchParams(location.search);
  const prefilledCubeId = queryParams.get('cube') || '';

  const [cubes, setCubes] = useState<any[]>([]);
  const [missions, setMissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form Fields
  const [cubeId, setCubeId] = useState(prefilledCubeId);
  const [missionId, setMissionId] = useState(id || '');
  
  // Scores (1-5)
  const [technical, setTechnical] = useState(5);
  const [research, setResearch] = useState(5);
  const [demoOutput, setDemoOutput] = useState(5);
  const [ownership, setOwnership] = useState(5);
  const [communication, setCommunication] = useState(5);
  const [leadership, setLeadership] = useState(5);
  const [productThinking, setProductThinking] = useState(5);
  const [reliability, setReliability] = useState(5);
  const [selfReflection, setSelfReflection] = useState(5);

  const [strengths, setStrengths] = useState('');
  const [areasToImprove, setAreasToImprove] = useState('');
  const [privateNotes, setPrivateNotes] = useState('');
  const [visibleToCube, setVisibleToCube] = useState(true);
  const [recommendedNextStep, setRecommendedNextStep] = useState('Continue_as_Cube');
  const [submitting, setSubmitting] = useState(false);

  // AI draft states
  const [aiDraft, setAiDraft] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [profileDetails, setProfileDetails] = useState<any | null>(null);
  const [cubeFeedback, setCubeFeedback] = useState<any[]>([]);

  useEffect(() => {
    const fetchProfileDetails = async () => {
      const selectedProfile = cubes.find((c: any) => c.user.id === cubeId);
      if (selectedProfile) {
        try {
          const details = await api.get(`/cubes/${selectedProfile.id}`);
          setProfileDetails(details.profile);
          setCubeFeedback(details.mentorFeedback || []);
        } catch (err) {
          console.error('Failed to fetch detailed profile for attendance', err);
        }
      }
    };

    if (cubeId && cubes.length > 0) {
      fetchProfileDetails();
    } else {
      setProfileDetails(null);
      setCubeFeedback([]);
    }
  }, [cubeId, cubes]);

  // Calculate average scores for selected Cube's radar chart
  const averageScores: { [key: string]: number } = {};
  const skillKeys = [
    'technical_ability_score',
    'research_ability_score',
    'demo_output_score',
    'ownership_score',
    'communication_score',
    'leadership_score',
    'product_thinking_score',
    'reliability_score',
    'self_reflection_score'
  ];
  skillKeys.forEach(k => {
    averageScores[k] = 0;
  });

  if (cubeFeedback && cubeFeedback.length > 0) {
    cubeFeedback.forEach((fb: any) => {
      skillKeys.forEach(k => {
        averageScores[k] += fb[k] || 0;
      });
    });
    skillKeys.forEach(k => {
      averageScores[k] = parseFloat((averageScores[k] / cubeFeedback.length).toFixed(1));
    });
  }

  useEffect(() => {
    const initializePageData = async () => {
      try {
        const [cubesRes, missionsRes] = await Promise.all([
          api.get('/cubes?active=true'),
          api.get('/missions')
        ]);
        setCubes(cubesRes);
        setMissions(missionsRes);
        if (!prefilledCubeId && cubesRes.length > 0) {
          setCubeId(cubesRes[0].user.id); // set user id
        }
        if (!id && missionsRes.length > 0) {
          setMissionId(missionsRes[0].id);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to initialize page data');
      } finally {
        setLoading(false);
      }
    };

    initializePageData();
  }, []);

  const handleFetchAIDraft = async () => {
    if (!cubeId) {
      alert('Please select a Cube first.');
      return;
    }

    setAiLoading(true);
    setAiDraft(null);

    const scores = {
      technical,
      research,
      demoOutput,
      ownership,
      communication,
      leadership,
      productThinking,
      reliability,
      selfReflection
    };

    try {
      const res = await api.post('/ai/feedback-draft', {
        scores,
        notes: privateNotes || '',
        cube_id: cubeId
      });
      setAiDraft(res.draft);
    } catch (err: any) {
      alert(err.message || 'Failed to generate AI feedback draft');
    } finally {
      setAiLoading(false);
    }
  };

  const handleApplyDraft = () => {
    if (!aiDraft) return;

    // Parse draft if it contains specific tags, otherwise append to strengths
    // For simplicity, we append to privateNotes or strengths so the mentor can edit it.
    setStrengths(prev => `${prev}\n\n[AI Draft Strengths]:\n` + aiDraft);
    setAiDraft(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!cubeId || !strengths || !areasToImprove || !recommendedNextStep) {
      setError('Please fill in all required fields and scores.');
      return;
    }

    setSubmitting(true);
    setError(null);

    // Cube ID parameter mapping: in cubes database, cube_id can map to User id.
    // In our backend routes: cube_id refers to User id (User FK).
    // Let's make sure we find the User ID for the selected cube profile if cubeId is profile id.
    // Actually, in the frontend cubes directory, we have cube.user.id. Let's make sure we select the User ID!
    // In the dropdown: `c.user.id` is the value, so cubeId represents the User ID. This aligns perfectly with the backend!

    const payload = {
      cube_id: cubeId,
      mission_id: missionId || null,
      technical_ability_score: technical,
      research_ability_score: research,
      demo_output_score: demoOutput,
      ownership_score: ownership,
      communication_score: communication,
      leadership_score: leadership,
      product_thinking_score: productThinking,
      reliability_score: reliability,
      self_reflection_score: selfReflection,
      strengths,
      areas_to_improve: areasToImprove,
      private_notes: privateNotes || null,
      visible_to_cube: visibleToCube,
      recommended_next_step: recommendedNextStep
    };

    try {
      await api.post('/feedback', payload);
      if (missionId) {
        navigate(`/missions/${missionId}`);
      } else {
        const selectedProfile = cubes.find(c => c.user.id === cubeId);
        if (selectedProfile) {
          navigate(`/cubes/${selectedProfile.id}`);
        } else {
          navigate('/directory');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to submit feedback');
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
    <div className="max-w-5xl mx-auto flex flex-col gap-6">
      
      {/* Header */}
      <PageHeader eyebrow="Mentor workspace" title="Cube Scorecard Evaluation" description="Review the work, record feedback, and decide the next step." />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Scorecard Form (Left 2 Columns) */}
        <form onSubmit={handleSubmit} className="lg:col-span-2 bg-white border border-gray-100 rounded-3xl p-6 sm:p-8 shadow-subtle flex flex-col gap-6">
          
          {error && (
            <div className="bg-red-50 text-red-600 border border-red-100 p-4 rounded-2xl flex items-center gap-2 text-sm font-semibold">
              <ShieldAlert className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Selections */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase">Fellowship Cube</label>
              <select
                value={cubeId}
                onChange={e => setCubeId(e.target.value)}
                className="p-2 border border-gray-100 bg-gray-50 rounded-lg text-xs font-semibold outline-none cursor-pointer"
              >
                {cubes.map(c => (
                  <option key={c.id} value={c.user.id}>
                    Cube #{c.cube_number} - {c.user.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase">Mission Reviewed</label>
              <select
                value={missionId}
                onChange={e => setMissionId(e.target.value)}
                className="p-2 border border-gray-100 bg-gray-50 rounded-lg text-xs font-semibold outline-none cursor-pointer"
              >
                <option value="">General Evaluation (No Mission)</option>
                {missions.map(m => (
                  <option key={m.id} value={m.id}>{m.title}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Scores Panel */}
          <div>
            <h3 className="text-xs font-extrabold text-gray-400 uppercase tracking-wider mb-3.5">Ratings (1 to 5)</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { label: 'Technical Ability', state: technical, set: setTechnical },
                { label: 'Research Ability', state: research, set: setResearch },
                { label: 'Demo Output', state: demoOutput, set: setDemoOutput },
                { label: 'Ownership', state: ownership, set: setOwnership },
                { label: 'Communication', state: communication, set: setCommunication },
                { label: 'Leadership', state: leadership, set: setLeadership },
                { label: 'Product Thinking', state: productThinking, set: setProductThinking },
                { label: 'Reliability', state: reliability, set: setReliability },
                { label: 'Self-Reflection', state: selfReflection, set: setSelfReflection },
              ].map((item) => (
                <div key={item.label} className="flex flex-col gap-1 border border-gray-50 bg-gray-50/20 p-3 rounded-xl">
                  <span className="text-xs font-bold text-gray-600">{item.label}</span>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => item.set(star)}
                        className="p-0.5"
                      >
                        <Star className={`w-5 h-5 ${star <= item.state ? 'fill-magenta text-magenta' : 'text-gray-200'}`} />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Written evaluations */}
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase">Core Strengths</label>
              <textarea
                required
                rows={3}
                placeholder="What did the Cube do exceptionally well during the mission?"
                value={strengths}
                onChange={e => setStrengths(e.target.value)}
                className="p-2.5 border border-gray-100 bg-gray-50 rounded-lg text-xs outline-none focus:border-magenta"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase">Areas to Improve</label>
              <textarea
                required
                rows={3}
                placeholder="What architectural, engineering, or team interactions could be improved?"
                value={areasToImprove}
                onChange={e => setAreasToImprove(e.target.value)}
                className="p-2.5 border border-gray-100 bg-gray-50 rounded-lg text-xs outline-none focus:border-magenta"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-red-500 uppercase">Private Notes (Hidden from Cube)</label>
              <textarea
                rows={2}
                placeholder="Internal comments for admins and mentors only (e.g. progression hiring contracts)..."
                value={privateNotes}
                onChange={e => setPrivateNotes(e.target.value)}
                className="p-2.5 border border-red-100 bg-red-50/20 rounded-lg text-xs outline-none focus:border-red-400 text-red-700"
              />
            </div>
          </div>

          {/* Visibility and Progression */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-gray-50 pt-5 items-center">
            <div className="flex items-center gap-2">
              <input
                id="visible_check"
                type="checkbox"
                checked={visibleToCube}
                onChange={e => setVisibleToCube(e.target.checked)}
                className="rounded text-magenta focus:ring-magenta w-4.5 h-4.5"
              />
              <label htmlFor="visible_check" className="text-xs font-bold text-gray-600 cursor-pointer">
                Publish feedback scorecard directly to Cube
              </label>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase">Recommended Next Step</label>
              <select
                value={recommendedNextStep}
                onChange={e => setRecommendedNextStep(e.target.value)}
                className="p-2 bg-gray-50 border border-gray-100 rounded-lg text-xs font-semibold outline-none cursor-pointer"
              >
                <option value="Continue_as_Cube">Continue as Cube</option>
                <option value="Consider_for_Senior_Cube">Consider for Senior Cube</option>
                <option value="Consider_as_Former_Cube">Consider as Former Cube</option>
                <option value="Consider_as_Iceberger">Consider as Iceberger</option>
                <option value="Consider_as_Alumni">Consider as Alumni</option>
                <option value="Needs_Support">Needs Support</option>
                <option value="Inactive_Risk">Inactive Risk</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full mt-4 py-3.5 bg-magenta text-white font-bold text-xs tracking-wide uppercase rounded-xl hover:bg-magenta-hover active:scale-[0.99] transition-all shadow-md shadow-magenta/15 flex items-center justify-center gap-1.5"
          >
            <Save className="w-4 h-4" />
            <span>{submitting ? 'Submitting review...' : 'Submit Evaluation Scorecard'}</span>
          </button>
        </form>

        {/* Sidebar: AI Review Helper & Attendance */}
        <div className="flex flex-col gap-6">
          {/* Attendance Stats Card */}
          {profileDetails && (
            <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-subtle flex flex-col gap-4 animate-fadeIn">
              <h3 className="font-extrabold text-sm border-b border-gray-50 pb-2 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-magenta" />
                <span>Meeting Attendance</span>
              </h3>

              {(() => {
                const attList = profileDetails.meeting_attendance || [];
                const tot = attList.length;
                const att = attList.filter((a: any) => a.attended).length;
                const miss = tot - att;
                const rate = tot > 0 ? Math.round((att / tot) * 100) : 100;

                return (
                  <div className="flex flex-col gap-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-500 font-semibold">Attendance Rate:</span>
                      <span className={`font-bold px-2 py-0.5 rounded-lg ${
                        rate >= 90 ? 'bg-emerald-50 text-emerald-700' :
                        rate >= 75 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'
                      }`}>{rate}%</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-500 font-semibold">Attended:</span>
                      <span className="font-bold text-gray-800">{att} / {tot}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-500 font-semibold">Missed Meetings:</span>
                      <span className={`font-bold ${miss > 0 ? 'text-red-600' : 'text-gray-800'}`}>{miss}</span>
                    </div>

                    {miss > 0 ? (
                      <div className="bg-red-50 border border-red-100 rounded-xl p-3 mt-1.5 flex gap-2 items-start">
                        <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[11px] text-red-800 font-extrabold">Minus Point Penalty</span>
                          <p className="text-[10px] text-red-600 leading-snug font-medium">This Cube missed {miss} meeting(s). Adjust reliability/grade scores accordingly.</p>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 mt-1.5 flex gap-2 items-start">
                        <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[11px] text-emerald-800 font-extrabold">Perfect Attendance</span>
                          <p className="text-[10px] text-emerald-600 leading-snug font-medium">Attended all scheduled meetings.</p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* Radar Chart Card */}
          {profileDetails && (
            <RadarChart
              scores={averageScores}
              feedbackCount={cubeFeedback ? cubeFeedback.length : 0}
              size={280}
            />
          )}

          {/* Sidebar: AI Review Helper */}
          <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-subtle flex flex-col gap-4">
            <h3 className="font-extrabold text-sm border-b border-gray-50 pb-2 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-magenta" />
              <span>AI Review Drafter</span>
            </h3>

            <p className="text-xs text-gray-400">
              Generate a professional draft feedback based on your ratings and observations before submitting.
            </p>

            {aiDraft ? (
              <div className="flex flex-col gap-3">
                <div className="markdown-body bg-magenta/5 border border-magenta/10 p-4 rounded-xl text-xs text-gray-700 max-h-80 overflow-y-auto font-medium leading-relaxed">
                  <ReactMarkdown>{aiDraft}</ReactMarkdown>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleApplyDraft}
                    className="flex-1 py-1.5 bg-magenta text-white text-xs font-bold rounded-lg hover:bg-magenta-hover transition-colors"
                  >
                    Apply Draft to Strengths
                  </button>
                  <button
                    type="button"
                    onClick={handleFetchAIDraft}
                    className="py-1.5 px-3 bg-gray-100 border border-gray-200 text-gray-600 rounded-lg text-xs font-bold"
                  >
                    Regen
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleFetchAIDraft}
                disabled={aiLoading}
                className="w-full py-2.5 bg-magenta text-white font-bold text-xs rounded-xl hover:bg-magenta-hover transition-colors shadow-sm flex items-center justify-center gap-2"
              >
                {aiLoading ? (
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Draft Review Text</span>
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
