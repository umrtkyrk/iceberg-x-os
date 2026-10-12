import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { ShieldAlert, ArrowLeft, Save, Sparkles, Link2 } from 'lucide-react';
import { MarkdownEditor } from '../components/MarkdownEditor';
import { LinkedMissionsPicker, LinkedMissionRef } from '../components/LinkedMissionsPicker';

// Heading that marks the AI-written block inside Context, so it can be refreshed without touching the rest
const PREV_HEADING = '### Previous missions';

export const MissionCreateEdit: React.FC = () => {
  const { id } = useParams<{ id: string }>(); // Optional Mission ID
  const isEditMode = !!id;
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [loading, setLoading] = useState(isEditMode);
  const [error, setError] = useState<string | null>(null);

  // Form Fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [context, setContext] = useState('');
  const [problemStatement, setProblemStatement] = useState('');
  const [expectedOutput, setExpectedOutput] = useState('');
  const [difficultyLevel, setDifficultyLevel] = useState('Level_3_Working_POC');
  const [status, setStatus] = useState('idea_pool');
  const [mentorId, setMentorId] = useState('');
  const [mentorsList, setMentorsList] = useState<any[]>([]);
  const [mentorSearch, setMentorSearch] = useState('');
  const [slackChannelUrl, setSlackChannelUrl] = useState('');
  const [repositoryUrl, setRepositoryUrl] = useState('');
  const [demoUrl, setDemoUrl] = useState('');
  const [category, setCategory] = useState('General');
  const [submitting, setSubmitting] = useState(false);
  const [notify, setNotify] = useState(false);
  const [predecessors, setPredecessors] = useState<LinkedMissionRef[]>([]);
  const [embedding, setEmbedding] = useState(false);

  useEffect(() => {
    if (isEditMode) {
      const fetchMission = async () => {
        try {
          const res = await api.get(`/missions/${id}`);
          const m = res.mission;
          setTitle(m.title);
          setDescription(m.description);
          setContext(m.context);
          setProblemStatement(m.problem_statement);
          setExpectedOutput(m.expected_output);
          setDifficultyLevel(m.difficulty_level);
          setStatus(m.status);
          setMentorId(m.mentor_id || '');
          setSlackChannelUrl(m.slack_channel_url || '');
          setRepositoryUrl(m.repository_url || '');
          setDemoUrl(m.demo_url || '');
          setCategory(m.category || 'General');
          setPredecessors((res.predecessors || []).map((p: any) => ({ id: p.id, title: p.title, status: p.status })));
        } catch (err: any) {
          setError(err.message || 'Failed to fetch mission details');
        } finally {
          setLoading(false);
        }
      };
      fetchMission();
    }
  }, [id, isEditMode]);

  // "Create follow-up" from the Vault arrives with ?continues=<mission id>
  const continuesId = searchParams.get('continues');
  useEffect(() => {
    if (isEditMode || !continuesId) return;
    api
      .get(`/missions/${continuesId}`)
      .then((res) => {
        const m = res.mission;
        setPredecessors((prev) => (prev.some((p) => p.id === m.id) ? prev : [...prev, { id: m.id, title: m.title, status: m.status }]));
        setCategory((c) => (c === 'General' && m.category ? m.category : c));
      })
      .catch(() => undefined);
  }, [continuesId, isEditMode]);

  useEffect(() => {
    const fetchMentors = async () => {
      try {
        const res = await api.get('/mentors');
        setMentorsList(res);
      } catch (e) {
        console.error('Failed to fetch mentors', e);
      }
    };
    fetchMentors();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !description || !context || !problemStatement || !expectedOutput) {
      setError('Please fill in all required fields.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const payload = {
      title,
      description,
      context,
      problem_statement: problemStatement,
      expected_output: expectedOutput,
      difficulty_level: difficultyLevel,
      status,
      category,
      mentor_id: mentorId || null,
      slack_channel_url: slackChannelUrl || null,
      repository_url: repositoryUrl || null,
      demo_url: demoUrl || null,
      notify: !isEditMode ? notify : undefined,
      predecessor_ids: predecessors.map((p) => p.id)
    };

    try {
      if (isEditMode) {
        await api.put(`/missions/${id}`, payload);
        navigate(`/missions/${id}`);
      } else {
        const created = await api.post('/missions', payload);
        navigate(`/missions/${created.id}`);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save mission');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEmbedContext = async () => {
    if (predecessors.length === 0) return;
    setEmbedding(true);
    setError(null);
    try {
      const res = await api.post('/ai/mission-context', {
        predecessor_ids: predecessors.map((p) => p.id),
        title,
        description
      });
      const block = `${PREV_HEADING}\n\n${res.context}`;
      setContext((current) => {
        const at = current.indexOf(PREV_HEADING);
        const base = (at >= 0 ? current.slice(0, at) : current).trimEnd();
        return base ? `${base}\n\n${block}` : block;
      });
    } catch (err: any) {
      setError(err.message || 'Failed to build context from linked missions');
    } finally {
      setEmbedding(false);
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
    <div className="max-w-3xl mx-auto flex flex-col gap-6">
      
      {/* Navigation & Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(isEditMode ? `/missions/${id}` : '/missions')}
          className="p-2 bg-white hover:bg-gray-50 border border-gray-100 rounded-xl text-gray-500 hover:text-magenta transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">
            {isEditMode ? 'Edit Mission details' : 'Create New R&D Mission'}
          </h1>
          <p className="text-gray-500 mt-1">Specify parameters, contexts, expected outcomes, and assign mentors.</p>
        </div>
      </div>

      {/* Form Card */}
      <form onSubmit={handleSubmit} className="bg-white border border-gray-100 rounded-3xl p-6 sm:p-8 shadow-subtle flex flex-col gap-5">
        
        {error && (
          <div className="bg-red-50 text-red-600 border border-red-100 p-4 rounded-2xl flex items-center gap-2 text-sm font-semibold">
            <ShieldAlert className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider pl-1">
            Mission Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            placeholder="e.g. LLM-based Email Router"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={submitting}
            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:border-magenta focus:bg-white text-xs font-semibold transition-all"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider pl-1">
            Description <span className="text-red-500">*</span>
          </label>
          <MarkdownEditor
            required
            rows={4}
            placeholder="Provide a general overview of the mission..."
            value={description}
            onChange={setDescription}
            disabled={submitting}
          />
        </div>

        <div className="flex flex-col gap-2 bg-gray-50/60 border border-gray-100 rounded-2xl p-4">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
            <Link2 className="w-3.5 h-3.5" /> Continues earlier missions
          </label>
          <p className="text-[11px] text-gray-400 font-medium -mt-1">
            Link Vault missions this one builds on, so their context is not lost.
          </p>
          <LinkedMissionsPicker value={predecessors} onChange={setPredecessors} excludeId={id} disabled={submitting} />
          {predecessors.length > 0 && (
            <button
              type="button"
              onClick={handleEmbedContext}
              disabled={embedding || submitting}
              className="self-start inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-magenta/20 text-magenta rounded-xl text-xs font-bold hover:bg-magenta/5 disabled:opacity-60 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {embedding ? 'Reading earlier missions…' : 'Embed their context with AI'}
            </button>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider pl-1">
            Context & Background <span className="text-red-500">*</span>
          </label>
          <MarkdownEditor
            required
            rows={4}
            placeholder="Why is this mission valuable? What is the background detail?"
            value={context}
            onChange={setContext}
            disabled={submitting}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider pl-1">
            Problem Statement <span className="text-red-500">*</span>
          </label>
          <MarkdownEditor
            required
            rows={4}
            placeholder="Specify the exact technical challenge to solve..."
            value={problemStatement}
            onChange={setProblemStatement}
            disabled={submitting}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider pl-1">
            Expected Outputs & Deliverables <span className="text-red-500">*</span>
          </label>
          <MarkdownEditor
            required
            rows={3}
            placeholder="e.g. Working API microservice and React UI dashboard skeleton"
            value={expectedOutput}
            onChange={setExpectedOutput}
            disabled={submitting}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider pl-1">Difficulty Level</label>
            <select
              value={difficultyLevel}
              onChange={(e) => setDifficultyLevel(e.target.value)}
              disabled={submitting}
              className="w-full p-2.5 bg-gray-50 border border-gray-100 rounded-xl outline-none text-xs font-bold"
            >
              <option value="Level_1_Research_Only">Level 1 - Research Only</option>
              <option value="Level_2_Research_Mock">Level 2 - Research + Mock</option>
              <option value="Level_3_Working_POC">Level 3 - Working POC</option>
              <option value="Level_4_Integration_Candidate">Level 4 - Integration Candidate</option>
              <option value="Level_5_Main_Team_Assist">Level 5 - Main Team Assist</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider pl-1">Initial Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              disabled={submitting}
              className="w-full p-2.5 bg-gray-50 border border-gray-100 rounded-xl outline-none text-xs font-bold"
            >
              <option value="idea_pool">Idea Pool</option>
              <option value="selected">Selected</option>
              <option value="researching">Researching</option>
              <option value="building_demo">Building Demo</option>
              <option value="preparing_handover">Preparing Handover</option>
              <option value="demo_ready">Demo Ready</option>
              <option value="reviewed">Reviewed</option>
              <option value="promoted_to_product_backlog">Promoted to Backlog</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider pl-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={submitting}
              className="w-full p-2.5 bg-gray-50 border border-gray-100 rounded-xl outline-none text-xs font-bold"
            >
              <option value="AI/ML">AI/ML</option>
              <option value="Frontend">Frontend</option>
              <option value="Backend">Backend</option>
              <option value="DevOps">DevOps</option>
              <option value="Design">Design</option>
              <option value="Data Science">Data Science</option>
              <option value="Research">Research</option>
              <option value="General">General</option>
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider pl-1">Assigned Mentor</label>
          <input
            type="text"
            placeholder="Filter mentors by name..."
            value={mentorSearch}
            onChange={(e) => setMentorSearch(e.target.value)}
            disabled={submitting}
            className="w-full px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:border-magenta focus:bg-white text-xs font-semibold"
          />
          <select
            value={mentorId}
            onChange={(e) => setMentorId(e.target.value)}
            disabled={submitting}
            className="w-full p-2.5 bg-gray-50 border border-gray-100 rounded-xl outline-none text-xs font-bold"
          >
            <option value="">No Mentor Assigned</option>
            {mentorsList
              .filter(m => m.name.toLowerCase().includes(mentorSearch.toLowerCase()))
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.role === 'ADMIN' ? 'Admin' : 'Mentor'})
                </option>
              ))
            }
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider pl-1">Slack Channel URL</label>
            <input
              type="url"
              placeholder="e.g. https://slack.com/..."
              value={slackChannelUrl}
              onChange={(e) => setSlackChannelUrl(e.target.value)}
              disabled={submitting}
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:border-magenta focus:bg-white text-xs font-semibold"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider pl-1">Code Repository URL</label>
            <input
              type="url"
              placeholder="e.g. https://github.com/..."
              value={repositoryUrl}
              onChange={(e) => setRepositoryUrl(e.target.value)}
              disabled={submitting}
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:border-magenta focus:bg-white text-xs font-semibold"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider pl-1">Live Demo URL</label>
            <input
              type="url"
              placeholder="e.g. https://demo.com"
              value={demoUrl}
              onChange={(e) => setDemoUrl(e.target.value)}
              disabled={submitting}
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:border-magenta focus:bg-white text-xs font-semibold"
            />
          </div>
        </div>

        {!isEditMode && (
          <div className="flex items-center gap-2 pl-1 select-none">
            <input
              type="checkbox"
              id="notify-cubes"
              checked={notify}
              onChange={(e) => setNotify(e.target.checked)}
              disabled={submitting}
              className="w-4 h-4 rounded text-magenta border-gray-200 focus:ring-magenta cursor-pointer"
            />
            <label htmlFor="notify-cubes" className="text-xs text-gray-600 font-bold cursor-pointer">
              Send notification to Cubes
            </label>
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full mt-4 py-3.5 bg-magenta text-white font-bold text-xs tracking-wide uppercase rounded-xl hover:bg-magenta-hover active:scale-[0.99] transition-all shadow-md shadow-magenta/15 flex items-center justify-center gap-1.5 disabled:opacity-75"
        >
          <Save className="w-4 h-4" />
          <span>{submitting ? 'Saving changes...' : 'Save R&D Mission'}</span>
        </button>

      </form>
    </div>
  );
};
