import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { Trophy, Plus, Check, Clock, User, Sparkles, Calendar, RefreshCw, Send, CheckSquare, Trash, Search, Filter, CheckCircle } from 'lucide-react';
import { getBadgeIcon } from '../utils/badgeIcons';
import { PEER_CRITERIA_OPTIONS, PEER_RATE_CRITERIA, isPeerCriteria, peerQuestProgressText } from '../utils/peer';

// Criteria types that express a rate (a score average, an attendance
// percentage) rather than a raw count. Only these can specify a minimum
// sample size — for a count-based criteria the target value already IS the
// count, so there's nothing separate to floor.
const RATE_CRITERIA_TYPES = ['average_score', 'meeting_attendance', ...PEER_RATE_CRITERIA];

// Mirrors DEFAULT_MIN_SAMPLE_SIZE in backend/src/services/quest.service.ts.
// Shown as a placeholder so an admin sees what happens if they leave the
// field blank, rather than guessing.
const DEFAULT_MIN_SAMPLE_SIZE: Record<string, number> = { Common: 3, Rare: 5, Epic: 10 };

export const AdminQuests: React.FC = () => {
  const [quests, setQuests] = useState<any[]>([]);
  const [badges, setBadges] = useState<any[]>([]);
  const [cubes, setCubes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [difficulty, setDifficulty] = useState('Common');
  const [criteriaType, setCriteriaType] = useState('missions_completed');
  const [criteriaValue, setCriteriaValue] = useState('');
  const [minSampleSize, setMinSampleSize] = useState('');
  const [isTimed, setIsTimed] = useState(false);
  const [expiresAt, setExpiresAt] = useState('');
  const [selectedBadgeIds, setSelectedBadgeIds] = useState<string[]>([]);
  const [dependencyQuestId, setDependencyQuestId] = useState('');
  const [autoAssign, setAutoAssign] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formMessage, setFormMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Assign state
  const [assigningQuestId, setAssigningQuestId] = useState<string | null>(null);
  const [assignTarget, setAssignTarget] = useState<'all' | 'specific'>('all');
  const [assignCubeIds, setAssignCubeIds] = useState<string[]>([]);
  const [assignSubmitting, setAssignSubmitting] = useState(false);

  // Manual Custom progress state
  const [editingQuestId, setEditingQuestId] = useState<string | null>(null);
  const [selectedCubeId, setSelectedCubeId] = useState('');
  const [customProgressValue, setCustomProgressValue] = useState('');
  const [customSubmitting, setCustomSubmitting] = useState(false);

  // Tab state
  const [activeTab, setActiveTab] = useState<'definitions' | 'progress'>('definitions');

  // Search & Filter state for progress tracking
  const [progressSearch, setProgressSearch] = useState('');
  const [progressQuestId, setProgressQuestId] = useState('all');
  const [progressStatus, setProgressStatus] = useState('all');

  const fetchData = async () => {
    try {
      const [questsRes, badgesRes, cubesRes] = await Promise.all([
        api.get('/quests'),
        api.get('/badges'),
        api.get('/cubes')
      ]);
      setQuests(questsRes);
      setBadges(badgesRes);
      setCubes(cubesRes);
    } catch (err: any) {
      console.error('Failed to load admin quests data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateQuest = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitting(true);
    setFormMessage(null);

    try {
      const res = await api.post('/admin/quests', {
        title,
        description,
        difficulty,
        criteria_type: criteriaType,
        criteria_value: (criteriaType === 'nda_signed' || criteriaType === 'profile_picture' || criteriaType === 'avatar_upload')
          ? 1
          : Number(criteriaValue),
        min_sample_size: RATE_CRITERIA_TYPES.includes(criteriaType) && minSampleSize
          ? Number(minSampleSize)
          : null,
        is_timed: isTimed,
        expires_at: isTimed && expiresAt ? expiresAt : null,
        reward_badge_ids: selectedBadgeIds,
        dependency_quest_id: dependencyQuestId || null,
        auto_assign: autoAssign
      });

      setFormMessage({ type: 'success', text: `Quest "${res.title}" successfully created!` });
      // Reset form
      setTitle('');
      setDescription('');
      setDifficulty('Common');
      setCriteriaType('missions_completed');
      setCriteriaValue('');
      setMinSampleSize('');
      setIsTimed(false);
      setExpiresAt('');
      setSelectedBadgeIds([]);
      setDependencyQuestId('');
      setAutoAssign(false);
      
      // Refresh list
      fetchData();
    } catch (err: any) {
      setFormMessage({ type: 'error', text: err.message || 'Failed to create quest.' });
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleToggleAutoAssign = async (quest: any) => {
    const next = !quest.auto_assign;
    if (
      next &&
      !window.confirm(
        `Turn on auto-assign for "${quest.title}"? It will be assigned right now to every Cube currently in the programme that is eligible.`
      )
    ) {
      return;
    }
    try {
      const res = await api.patch(`/admin/quests/${quest.id}/auto-assign`, { auto_assign: next });
      if (next && res.auto_assigned) {
        alert(`Auto-assign is on. ${res.auto_assigned.newlyAssigned} Cube(s) assigned now.`);
      }
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Could not change auto-assign.');
    }
  };

  const handleQuestOverride = async (cubeProfileId: string, questId: string, action: 'complete' | 'revert') => {
    const confirmMessage = action === 'complete' 
      ? 'Are you sure you want to force-complete this quest and award its badges?' 
      : 'Are you sure you want to revert/take back this quest? This will reset progress and delete any awarded badges for this quest.';
    
    if (!window.confirm(confirmMessage)) return;

    try {
      await api.post('/admin/quests/override', { cubeProfileId, questId, action });
      alert(action === 'complete' ? 'Quest manually completed!' : 'Quest reverted successfully.');
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Override failed');
    }
  };

  const handleAssignQuest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assigningQuestId) return;
    setAssignSubmitting(true);

    try {
      const res = await api.post('/admin/quests/assign', {
        questId: assigningQuestId,
        target: assignTarget,
        cubeProfileIds: assignTarget === 'specific' ? assignCubeIds : undefined
      });

      // Assigning evaluates progress immediately, so a Cube whose profile /
      // missions / scorecards already satisfy the quest completes right away
      // — surface that breakdown instead of a flat "assigned successfully",
      // so it's clear no separate verify step is needed for that case.
      alert(res.message || 'Quest assigned successfully!');
      setAssigningQuestId(null);
      setAssignCubeIds([]);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to assign quest.');
    } finally {
      setAssignSubmitting(false);
    }
  };

  const handleForceVerify = async (questId: string) => {
    try {
      const res = await api.post(`/admin/quests/${questId}/verify`);
      alert(res.message || `Recalculation complete! Evaluated: ${res.evaluated}, Newly completed: ${res.newlyCompleted}`);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to trigger recalculation.');
    }
  };

  const handleUpdateCustomProgress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingQuestId || !selectedCubeId || !customProgressValue) return;
    setCustomSubmitting(true);

    try {
      await api.post('/admin/quests/custom-progress', {
        cubeProfileId: selectedCubeId,
        questId: editingQuestId,
        value: Number(customProgressValue)
      });

      alert('Manual progress updated!');
      setCustomProgressValue('');
      setSelectedCubeId('');
      setEditingQuestId(null);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to update custom progress.');
    } finally {
      setCustomSubmitting(false);
    }
  };

  const toggleBadgeSelection = (id: string) => {
    setSelectedBadgeIds(prev => 
      prev.includes(id) ? prev.filter(bid => bid !== id) : [...prev, id]
    );
  };

  const toggleCubeSelection = (id: string) => {
    setAssignCubeIds(prev => 
      prev.includes(id) ? prev.filter(cid => cid !== id) : [...prev, id]
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-magenta"></div>
      </div>
    );
  }

  // Compute flat assigned quest progress list
  const allCubeQuests = quests.flatMap((q: any) => 
    (q.cube_quests || []).map((cq: any) => ({
      ...cq,
      quest: q
    }))
  );

  const filteredCubeQuests = allCubeQuests.filter((cq: any) => {
    const matchesSearch = (cq.cube?.user?.name || '').toLowerCase().includes(progressSearch.toLowerCase()) || 
                          (cq.cube?.cube_number || '').toLowerCase().includes(progressSearch.toLowerCase()) || 
                          (cq.quest?.title || '').toLowerCase().includes(progressSearch.toLowerCase());
    const matchesQuest = progressQuestId === 'all' ? true : cq.quest_id === progressQuestId;
    const matchesStatus = progressStatus === 'all' ? true :
                          progressStatus === 'completed' ? cq.is_completed : !cq.is_completed;

    return matchesSearch && matchesQuest && matchesStatus;
  });

  return (
    <div className="max-w-[1200px] mx-auto px-4 py-8 flex flex-col gap-8 font-sans">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
          <Trophy className="w-8 h-8 text-magenta" />
          <span>Quest Administration</span>
        </h1>
        <p className="text-slate-500 font-semibold text-sm leading-relaxed">
          Design, assign, and verify gamified quests to reward Cubes with badges upon meeting criteria.
        </p>
      </div>

      {/* Tab Switcher */}
      <div className="flex border-b border-gray-250 gap-2">
        <button
          onClick={() => setActiveTab('definitions')}
          className={`px-6 py-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all ${
            activeTab === 'definitions'
              ? 'border-magenta text-magenta'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Quest Definitions & Creation
        </button>
        <button
          onClick={() => setActiveTab('progress')}
          className={`px-6 py-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all ${
            activeTab === 'progress'
              ? 'border-magenta text-magenta'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Cube Progress Tracker Matrix
        </button>
      </div>

      {activeTab === 'definitions' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Side: Create Quest Form */}
          <div className="lg:col-span-1 bg-white border border-gray-150 rounded-3xl p-6 shadow-sm flex flex-col gap-5">
            <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Plus className="w-5 h-5 text-magenta" />
              <span>Create New Quest</span>
            </h2>

            <form onSubmit={handleCreateQuest} className="flex flex-col gap-4">
              {formMessage && (
                <div className={`p-3 rounded-xl border text-xs font-semibold ${
                  formMessage.type === 'success' 
                    ? 'bg-green-50 border-green-100 text-green-700' 
                    : 'bg-red-50 border-red-100 text-red-700'
                }`}>
                  {formMessage.text}
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">Quest Title</label>
                <input 
                  type="text"
                  required
                  placeholder="e.g. Code Machine"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  disabled={formSubmitting}
                  className="w-full px-3 py-2.5 border border-gray-150 bg-gray-50 focus:bg-white focus:border-magenta rounded-xl text-xs font-semibold outline-none transition"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">Description</label>
                <textarea 
                  required
                  rows={3}
                  placeholder="Explain the quest and goals..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  disabled={formSubmitting}
                  className="w-full px-3 py-2.5 border border-gray-150 bg-gray-50 focus:bg-white focus:border-magenta rounded-xl text-xs font-semibold outline-none transition resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">Difficulty</label>
                  <select
                    value={difficulty}
                    onChange={e => setDifficulty(e.target.value)}
                    disabled={formSubmitting}
                    className="w-full px-3 py-2.5 border border-gray-150 bg-gray-50 focus:bg-white focus:border-magenta rounded-xl text-xs font-semibold outline-none transition"
                  >
                    <option value="Common">Common</option>
                    <option value="Rare">Rare</option>
                    <option value="Epic">Epic</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">Criteria Type</label>
                  <select
                    value={criteriaType}
                    onChange={e => {
                      const val = e.target.value;
                      setCriteriaType(val);
                      if (val === 'nda_signed' || val === 'profile_picture' || val === 'avatar_upload' || val === 'quiz_completed') {
                        setCriteriaValue('1');
                      }
                    }}
                    disabled={formSubmitting}
                    className="w-full px-3 py-2.5 border border-gray-150 bg-gray-50 focus:bg-white focus:border-magenta rounded-xl text-xs font-semibold outline-none transition"
                  >
                    <option value="missions_completed">Missions Completed</option>
                    <option value="missions_assigned">Missions Assigned (Joined Teams)</option>
                    <option value="average_score">Scorecard Average (1-5)</option>
                    <option value="login_streak">Login Streak (Days)</option>
                    <option value="meeting_attendance">Meeting Attendance (%)</option>
                    <option value="profile_completion">Profile Completion (GitHub, LinkedIn, 3+ Skills)</option>
                    <option value="write_testimonial">Write Testimonial(s)</option>
                    <option value="mission_updates_count">Mission Updates Count (Total Updates)</option>
                    <option value="daily_update_streak">Daily Update Streak (Consecutive Days)</option>
                    <option value="weekly_update_streak">Weekly Update Streak (Consecutive Weeks)</option>
                    <option value="nda_signed">Sign NDA (Non-Disclosure Agreement)</option>
                    <option value="profile_picture">Upload Profile Picture (Avatar Required)</option>
                    <option value="quiz_score">Web Fundamentals Quiz Score (Target Score: e.g. 50, 75, 90)</option>
                    <option value="quiz_completed">Web Fundamentals Quiz Completed (Target: 1)</option>
                    <optgroup label="Peer feedback & MVCubes">
                      {PEER_CRITERIA_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </optgroup>
                    <option value="custom">Custom (Manual Update)</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">Goal Target Value</label>
                  {(criteriaType === 'nda_signed' || criteriaType === 'profile_picture' || criteriaType === 'avatar_upload' || criteriaType === 'quiz_completed') && (
                    <span className="text-[9px] font-extrabold text-magenta bg-magenta/10 px-2 py-0.5 rounded-full">
                      Fixed: 1 (Completion Required)
                    </span>
                  )}
                </div>
                <input
                  type="number"
                  step="any"
                  required
                  readOnly={criteriaType === 'nda_signed' || criteriaType === 'profile_picture' || criteriaType === 'avatar_upload' || criteriaType === 'quiz_completed'}
                  placeholder={
                    criteriaType === 'nda_signed' || criteriaType === 'profile_picture' ? '1 (Required)' :
                    criteriaType === 'daily_update_streak' ? 'e.g. 30 or 90 (consecutive days)' :
                    criteriaType === 'weekly_update_streak' ? 'e.g. 8 or 30 (consecutive weeks)' :
                    criteriaType === 'mission_updates_count' ? 'e.g. 1 (updates count)' :
                    'e.g. 3, 4.5, 7, or 90'
                  }
                  value={criteriaType === 'nda_signed' || criteriaType === 'profile_picture' || criteriaType === 'avatar_upload' ? '1' : criteriaValue}
                  onChange={e => setCriteriaValue(e.target.value)}
                  disabled={formSubmitting}
                  className="w-full px-3 py-2.5 border border-gray-150 bg-gray-50 focus:bg-white focus:border-magenta rounded-xl text-xs font-semibold outline-none transition read-only:opacity-75 read-only:cursor-not-allowed"
                />
              </div>

              {isPeerCriteria(criteriaType) && (
                <p className="rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 text-[10px] font-semibold leading-relaxed text-sky-800">
                  {PEER_CRITERIA_OPTIONS.find(o => o.value === criteriaType)?.help}{' '}
                  Peer quests are never taken back once completed.
                </p>
              )}

              {RATE_CRITERIA_TYPES.includes(criteriaType) && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">
                    Minimum Sample Size
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    placeholder={`Default for ${difficulty}: ${DEFAULT_MIN_SAMPLE_SIZE[difficulty] ?? 3}`}
                    value={minSampleSize}
                    onChange={e => setMinSampleSize(e.target.value)}
                    disabled={formSubmitting}
                    className="w-full px-3 py-2.5 border border-gray-150 bg-gray-50 focus:bg-white focus:border-magenta rounded-xl text-xs font-semibold outline-none transition"
                  />
                  <p className="text-[10px] text-slate-400 font-semibold leading-relaxed">
                    {criteriaType === 'meeting_attendance'
                      ? 'How many logged meetings the attendance rate must be computed over. Without a floor, a Cube\'s very first meeting is trivially 100%.'
                      : 'How many completed missions the scorecard average must be computed over. Without a floor, one great scorecard "is" the average.'}
                    {' '}Leave blank to use the difficulty default shown above.
                  </p>
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">Prerequisite Quest (To Unlock This)</label>
                <select
                  value={dependencyQuestId}
                  onChange={e => setDependencyQuestId(e.target.value)}
                  disabled={formSubmitting}
                  className="w-full px-3 py-2.5 border border-gray-150 bg-gray-50 focus:bg-white focus:border-magenta rounded-xl text-xs font-semibold outline-none transition"
                >
                  <option value="">None (Starts unlocked)</option>
                  {quests.map(q => (
                    <option key={q.id} value={q.id}>{q.title} ({q.difficulty})</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1 rounded-xl border border-gray-150 bg-gray-50 p-3">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="auto-assign"
                    checked={autoAssign}
                    onChange={e => setAutoAssign(e.target.checked)}
                    disabled={formSubmitting}
                    className="rounded text-magenta focus:ring-magenta"
                  />
                  <label htmlFor="auto-assign" className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wide cursor-pointer">
                    Auto-assign to all Cubes
                  </label>
                </div>
                <p className="pl-6 text-[10px] font-semibold leading-relaxed text-slate-400">
                  Every Cube still in the programme gets this quest automatically, now and when they join or sign in.
                  Some peer quests only assign once the Cube is eligible (for example after their first kudos).
                  Leave off to assign by hand.
                </p>
              </div>

              <div className="flex items-center gap-2 py-1">
                <input 
                  type="checkbox"
                  id="is-timed"
                  checked={isTimed}
                  onChange={e => setIsTimed(e.target.checked)}
                  disabled={formSubmitting}
                  className="rounded text-magenta focus:ring-magenta"
                />
                <label htmlFor="is-timed" className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wide cursor-pointer">Timed / Expiry Quest</label>
              </div>

              {isTimed && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">Expiry Date</label>
                  <input 
                    type="date"
                    required={isTimed}
                    value={expiresAt}
                    onChange={e => setExpiresAt(e.target.value)}
                    disabled={formSubmitting}
                    className="w-full px-3 py-2.5 border border-gray-150 bg-gray-50 focus:bg-white focus:border-magenta rounded-xl text-xs font-semibold outline-none transition"
                  />
                </div>
              )}

              {/* Badges Checklist */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">Reward Badges</label>
                <div className="max-h-[140px] overflow-y-auto border border-gray-100 rounded-xl p-3 flex flex-col gap-2 bg-slate-50">
                  {badges.map(b => (
                    <label key={b.id} className="flex items-start gap-2 cursor-pointer py-1">
                      <input 
                        type="checkbox"
                        checked={selectedBadgeIds.includes(b.id)}
                        onChange={() => toggleBadgeSelection(b.id)}
                        disabled={formSubmitting}
                        className="mt-0.5 rounded text-magenta focus:ring-magenta"
                      />
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                        <span>{b.name}</span>
                        <span className="text-[9px] text-slate-400 font-semibold uppercase">({b.rarity})</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={formSubmitting || selectedBadgeIds.length === 0}
                className="w-full py-2.5 bg-magenta text-white font-black text-xs rounded-xl hover:bg-magenta/90 shadow-md shadow-magenta/15 transition disabled:opacity-50"
              >
                {formSubmitting ? 'Creating...' : 'Create Quest'}
              </button>
            </form>
          </div>

          {/* Right Side: Quest Definitions & Actions */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Trophy className="w-5 h-5 text-magenta" />
              <span>Active Quest Definitions</span>
            </h2>

            <div className="flex flex-col gap-4">
              {quests.length === 0 ? (
                <div className="text-center py-16 bg-white border border-gray-150 rounded-3xl p-6 text-slate-400 font-bold text-sm">
                  No quests defined. Use the form on the left to create your first quest!
                </div>
              ) : (
                quests.map(q => {
                  const assignedCount = q.cube_quests?.length || 0;
                  const completedCount = q.cube_quests?.filter((cq: any) => cq.is_completed).length || 0;

                  return (
                    <div key={q.id} className="bg-white border border-gray-150 hover:border-gray-250 rounded-3xl p-6 shadow-sm flex flex-col gap-5 transition duration-300">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="flex flex-col gap-1.5 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${
                              q.difficulty === 'Epic' ? 'bg-magenta text-white' : q.difficulty === 'Rare' ? 'bg-sky-50 text-sky-700' : 'bg-slate-100 text-slate-600'
                            }`}>
                              {q.difficulty}
                            </span>
                            <span className="text-[10px] font-extrabold bg-slate-50 border border-slate-200 text-slate-500 px-2 py-0.5 rounded-md uppercase tracking-wide">
                              {q.criteria_type.replace(/_/g, ' ')} ({q.criteria_value})
                            </span>
                            {q.auto_assign && (
                              <span
                                className="text-[10px] font-extrabold bg-emerald-50 border border-emerald-200 text-emerald-700 px-2 py-0.5 rounded-md uppercase tracking-wide"
                                title="Assigned automatically to every eligible Cube"
                              >
                                auto-assign
                              </span>
                            )}
                            {RATE_CRITERIA_TYPES.includes(q.criteria_type) && (
                              <span
                                className="text-[10px] font-extrabold bg-amber-50 border border-amber-200 text-amber-700 px-2 py-0.5 rounded-md uppercase tracking-wide"
                                title="Minimum meetings/missions the rate must be computed over before this quest can complete"
                              >
                                min sample: {q.min_sample_size ?? `${DEFAULT_MIN_SAMPLE_SIZE[q.difficulty] ?? 3} (default)`}
                              </span>
                            )}
                            {q.is_timed && q.expires_at && (
                              <span className="text-[9px] font-bold bg-red-50 border border-red-200 text-red-600 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                <span>Expires {new Date(q.expires_at).toLocaleDateString()}</span>
                              </span>
                            )}
                          </div>
                          <h3 className="text-base font-extrabold text-slate-900 tracking-tight">{q.title}</h3>
                          <p className="text-xs font-semibold text-slate-500 leading-relaxed">{q.description}</p>
                        </div>

                        {/* Controls Buttons */}
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setAssigningQuestId(q.id)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-slate-900 hover:bg-black text-white text-[10px] font-black uppercase rounded-xl transition"
                            title="Assign Quest to Cubes"
                          >
                            <Send className="w-3 h-3" />
                            <span>Assign</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleAutoAssign(q)}
                            className={`flex items-center gap-1 px-3 py-1.5 border text-[10px] font-black uppercase rounded-xl transition ${
                              q.auto_assign
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                                : 'bg-slate-50 border-gray-200 text-slate-600 hover:bg-slate-100'
                            }`}
                            title={q.auto_assign ? 'Stop auto-assigning (existing assignments stay)' : 'Assign automatically to every eligible Cube'}
                          >
                            <Sparkles className="w-3 h-3" />
                            <span>{q.auto_assign ? 'Auto: on' : 'Auto: off'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleForceVerify(q.id)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-gray-200 text-[10px] font-black uppercase text-slate-600 rounded-xl transition"
                            title="Recalculate progress for everyone"
                          >
                            <RefreshCw className="w-3 h-3" />
                            <span>Verify</span>
                          </button>
                          {q.criteria_type === 'custom' && (
                            <button
                              type="button"
                              onClick={() => setEditingQuestId(q.id)}
                              className="flex items-center gap-1 px-3 py-1.5 bg-magenta/5 hover:bg-magenta/10 border border-magenta/15 text-[10px] font-black uppercase text-magenta rounded-xl transition"
                              title="Update manual progress values"
                            >
                              <Sparkles className="w-3 h-3" />
                              <span>Edit Progress</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Stats Row */}
                      <div className="flex flex-wrap items-center gap-6 text-[11px] font-bold text-slate-500 pt-3 border-t border-slate-50">
                        <div>Assigned Cubes: <span className="text-slate-800 font-black">{assignedCount}</span></div>
                        <div>Completions: <span className="text-green-600 font-black">{completedCount}</span></div>
                        
                        {/* Badge Rewards list */}
                        <div className="ml-auto flex items-center gap-1.5 flex-wrap">
                          <span className="text-[9px] font-extrabold uppercase text-slate-400 tracking-wider">Rewards:</span>
                          {q.rewards?.map((r: any) => {
                            const Icon = getBadgeIcon(r.icon);
                            return (
                              <div key={r.id} className="flex items-center gap-1 px-2.5 py-0.5 bg-slate-50 border border-gray-150 rounded-xl text-[10px] font-bold text-slate-700">
                                <Icon className="w-3 h-3 text-magenta" />
                                <span>{r.name}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* ASSIGN DRAWER/BOX */}
                      {assigningQuestId === q.id && (
                        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 mt-2 animate-fade-in">
                          <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-3">
                            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wide">Assign Quest: {q.title}</h4>
                            <button 
                              onClick={() => setAssigningQuestId(null)}
                              className="text-xs text-slate-400 hover:text-slate-600 font-bold"
                            >
                              Cancel
                            </button>
                          </div>

                          <form onSubmit={handleAssignQuest} className="flex flex-col gap-3">
                            <div className="flex gap-4">
                              <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-slate-700">
                                <input 
                                  type="radio"
                                  name="assign-target"
                                  checked={assignTarget === 'all'}
                                  onChange={() => setAssignTarget('all')}
                                  className="text-magenta focus:ring-magenta"
                                />
                                <span>All Active Cubes</span>
                              </label>
                              <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-slate-700">
                                <input 
                                  type="radio"
                                  name="assign-target"
                                  checked={assignTarget === 'specific'}
                                  onChange={() => setAssignTarget('specific')}
                                  className="text-magenta focus:ring-magenta"
                                />
                                <span>Select Specific Cubes</span>
                              </label>
                            </div>

                            {assignTarget === 'specific' && (
                              <div className="flex flex-col gap-1.5">
                                <label className="text-[9px] font-extrabold uppercase text-slate-500 tracking-wider">Select Cubes ({assignCubeIds.length} selected)</label>
                                <div className="max-h-[140px] overflow-y-auto border border-slate-200 rounded-xl p-3 bg-white flex flex-col gap-1.5">
                                  {cubes.map(c => (
                                    <label key={c.id} className="flex items-center gap-2 cursor-pointer py-0.5">
                                      <input 
                                        type="checkbox"
                                        checked={assignCubeIds.includes(c.id)}
                                        onChange={() => toggleCubeSelection(c.id)}
                                        className="rounded text-magenta focus:ring-magenta"
                                      />
                                      <span className="text-xs font-bold text-slate-700">
                                        {c.user.name} (#{c.cube_number})
                                      </span>
                                    </label>
                                  ))}
                                </div>
                              </div>
                            )}

                            <button
                              type="submit"
                              disabled={assignSubmitting || (assignTarget === 'specific' && assignCubeIds.length === 0)}
                              className="px-4 py-2 bg-magenta text-white font-black text-xs uppercase rounded-xl hover:bg-magenta/90 shadow-md shadow-magenta/15 transition disabled:opacity-50 self-start"
                            >
                              {assignSubmitting ? 'Assigning...' : 'Confirm Assignment'}
                            </button>
                          </form>
                        </div>
                      )}

                      {/* EDIT CUSTOM PROGRESS DRAWER/BOX */}
                      {editingQuestId === q.id && (
                        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 mt-2 animate-fade-in">
                          <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-3">
                            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wide">Manual Progress: {q.title}</h4>
                            <button 
                              onClick={() => setEditingQuestId(null)}
                              className="text-xs text-slate-400 hover:text-slate-600 font-bold"
                            >
                              Cancel
                            </button>
                          </div>

                          <form onSubmit={handleUpdateCustomProgress} className="flex flex-col gap-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="flex flex-col gap-1.5">
                                <label className="text-[9px] font-extrabold uppercase text-slate-500 tracking-wider">Select Assigned Cube</label>
                                <select
                                  required
                                  value={selectedCubeId}
                                  onChange={e => setSelectedCubeId(e.target.value)}
                                  className="w-full px-3 py-2 border border-slate-200 bg-white rounded-xl text-xs font-semibold outline-none transition"
                                >
                                  <option value="">Select cube...</option>
                                  {q.cube_quests?.map((cq: any) => (
                                    <option key={cq.cube.id} value={cq.cube.id}>
                                      {cq.cube.user.name} (#{cq.cube.cube_number}) - current: {cq.current_value}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div className="flex flex-col gap-1.5">
                                <label className="text-[9px] font-extrabold uppercase text-slate-500 tracking-wider">Set Current Value (Goal Target: {q.criteria_value})</label>
                                <input 
                                  type="number"
                                  step="any"
                                  required
                                  placeholder="New progress value..."
                                  value={customProgressValue}
                                  onChange={e => setCustomProgressValue(e.target.value)}
                                  className="w-full px-3 py-2 border border-slate-200 bg-white rounded-xl text-xs font-semibold outline-none transition"
                                />
                              </div>
                            </div>

                            <button
                              type="submit"
                              disabled={customSubmitting || !selectedCubeId || !customProgressValue}
                              className="px-4 py-2 bg-magenta text-white font-black text-xs uppercase rounded-xl hover:bg-magenta/90 shadow-md shadow-magenta/15 transition disabled:opacity-50 self-start"
                            >
                              {customSubmitting ? 'Saving...' : 'Update Progress'}
                            </button>
                          </form>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      ) : (
        // Tab 2: Progress Tracker Matrix
        <div className="bg-white border border-gray-150 rounded-3xl p-6 shadow-sm flex flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Trophy className="w-5 h-5 text-magenta" />
              <span>Cube Quest Progress Tracker Matrix</span>
            </h2>
            <div className="text-[10px] text-slate-400 font-extrabold uppercase">
              Total Trackers: {filteredCubeQuests.length} / {allCubeQuests.length}
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-wrap items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <div className="flex-1 min-w-[240px] relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search Cube name, number, or quest..."
                value={progressSearch}
                onChange={e => setProgressSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 focus:border-magenta bg-white rounded-xl text-xs font-semibold outline-none transition"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={progressQuestId}
                onChange={e => setProgressQuestId(e.target.value)}
                className="px-3 py-2 border border-gray-200 bg-white rounded-xl text-xs font-semibold outline-none transition"
              >
                <option value="all">All Quests</option>
                {quests.map(q => (
                  <option key={q.id} value={q.id}>{q.title}</option>
                ))}
              </select>
            </div>

            <div>
              <select
                value={progressStatus}
                onChange={e => setProgressStatus(e.target.value)}
                className="px-3 py-2 border border-gray-200 bg-white rounded-xl text-xs font-semibold outline-none transition"
              >
                <option value="all">All Statuses</option>
                <option value="completed">Completed Only</option>
                <option value="in_progress">In Progress Only</option>
              </select>
            </div>
          </div>

          {/* Progress List Table */}
          <div className="overflow-x-auto border border-gray-150 rounded-2xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-gray-150 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                  <th className="p-4">Cube</th>
                  <th className="p-4">Quest</th>
                  <th className="p-4">Criteria Objective</th>
                  <th className="p-4">Current Progress</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-semibold text-slate-700">
                {filteredCubeQuests.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400 font-bold">
                      No matching progress trackers found.
                    </td>
                  </tr>
                ) : (
                  filteredCubeQuests.map((cq: any) => {
                    const progressPercentage = Math.min(100, (cq.current_value / cq.quest.criteria_value) * 100);
                    return (
                      <tr key={cq.id} className="hover:bg-slate-50/50 transition">
                        <td className="p-4">
                          <div className="flex flex-col">
                            <span className="font-extrabold text-slate-900">{cq.cube?.user?.name}</span>
                            <span className="text-[10px] text-slate-400 mt-0.5">Cube #{cq.cube?.cube_number}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex flex-col gap-1">
                            <span className="font-bold text-slate-800">{cq.quest?.title}</span>
                            <span className={`text-[9px] uppercase font-extrabold px-1.5 py-0.5 rounded w-fit ${
                              cq.quest?.difficulty === 'Epic' ? 'bg-magenta text-white' : cq.quest?.difficulty === 'Rare' ? 'bg-sky-50 text-sky-700' : 'bg-slate-100 text-slate-600'
                            }`}>
                              {cq.quest?.difficulty}
                            </span>
                          </div>
                        </td>
                        <td className="p-4 text-slate-500 leading-relaxed max-w-[280px]">
                          {cq.quest?.description}
                        </td>
                        <td className="p-4">
                          <div className="flex flex-col gap-1.5 min-w-[120px]">
                            <div className="flex justify-between items-center text-[10px]">
                              <span className="font-extrabold text-slate-800">
                                {cq.quest?.criteria_type === 'profile_completion'
                                  ? (cq.current_value >= 1 ? 'Completed' : 'Incomplete')
                                  : cq.quest?.criteria_type === 'nda_signed'
                                  ? (cq.current_value >= 1 ? 'Signed' : 'Not Signed')
                                  : cq.quest?.criteria_type === 'profile_picture' || cq.quest?.criteria_type === 'avatar_upload'
                                  ? (cq.current_value >= 1 ? 'Uploaded' : 'Missing')
                                  : cq.quest?.criteria_type === 'average_score'
                                  ? `${cq.current_value.toFixed(2)} / ${cq.quest?.criteria_value}`
                                  : cq.quest?.criteria_type === 'meeting_attendance'
                                  ? `${cq.current_value.toFixed(1)}% / ${cq.quest?.criteria_value}%`
                                  : cq.quest?.criteria_type === 'daily_update_streak'
                                  ? `${cq.current_value} / ${cq.quest?.criteria_value} days`
                                  : cq.quest?.criteria_type === 'weekly_update_streak'
                                  ? `${cq.current_value} / ${cq.quest?.criteria_value} wks`
                                  : cq.quest?.criteria_type === 'mission_updates_count' || cq.quest?.criteria_type === 'mission_updates'
                                  ? `${cq.current_value} / ${cq.quest?.criteria_value} updates`
                                  : peerQuestProgressText(cq.quest?.criteria_type, cq.current_value, cq.quest?.criteria_value) ??
                                    `${cq.current_value} / ${cq.quest?.criteria_value}`}
                              </span>
                              <span className="text-slate-400 font-bold text-[9px]">{progressPercentage.toFixed(0)}%</span>
                            </div>
                            <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                              <div 
                                className={`h-full rounded-full ${cq.is_completed ? 'bg-green-500' : 'bg-magenta'}`}
                                style={{ width: `${progressPercentage}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          {cq.is_completed ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-black text-green-600 bg-green-50 border border-green-150 px-2 py-0.5 rounded-md">
                              <CheckCircle className="w-3.5 h-3.5" />
                              <span>Completed</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-black text-amber-500 bg-amber-50 border border-amber-150 px-2 py-0.5 rounded-md">
                              <Clock className="w-3.5 h-3.5" />
                              <span>In Progress</span>
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  const res = await api.post(`/admin/quests/${cq.quest_id}/verify`);
                                  alert(res.message || 'Progress verified!');
                                  fetchData();
                                } catch (err: any) {
                                  alert(err.message || 'Verification failed');
                                }
                              }}
                              className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-lg text-[10px] font-black uppercase transition"
                            >
                              Verify
                            </button>
                            {cq.is_completed ? (
                              <button
                                type="button"
                                onClick={() => handleQuestOverride(cq.cube_id, cq.quest_id, 'revert')}
                                className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 border border-amber-250 text-amber-700 rounded-lg text-[10px] font-black uppercase transition"
                              >
                                Revert
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleQuestOverride(cq.cube_id, cq.quest_id, 'complete')}
                                className="px-2.5 py-1 bg-green-50 hover:bg-green-100 border border-green-250 text-green-700 rounded-lg text-[10px] font-black uppercase transition"
                              >
                                Complete
                              </button>
                            )}
                            {cq.quest?.criteria_type === 'custom' && (
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveTab('definitions');
                                  setEditingQuestId(cq.quest_id);
                                  setSelectedCubeId(cq.cube_id);
                                  setCustomProgressValue(String(cq.current_value));
                                }}
                                className="px-2.5 py-1 bg-magenta/5 hover:bg-magenta/10 border border-magenta/15 text-magenta rounded-lg text-[10px] font-black uppercase transition"
                              >
                                Edit
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
