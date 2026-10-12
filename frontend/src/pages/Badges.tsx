import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { ShieldAlert, Plus, Award, Check, Trash2, X, Pencil, Lock, Crown } from 'lucide-react';
import { BadgeMedal, BadgeDisc, BadgeEmbers, BadgeSparks } from '../components/BadgeMedal';
import { BadgeDesigner, type BadgeDraft } from '../components/BadgeDesigner';
import { RARITIES, getRarityMeta, compareByRarity } from '../utils/badgeRarity';

export const Badges: React.FC = () => {
  const { user } = useAuth();
  const [badges, setBadges] = useState<any[]>([]);
  const [cubes, setCubes] = useState<any[]>([]);
  const [missions, setMissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Award Form States
  const [showAwardForm, setShowAwardForm] = useState(false);
  const [selectedCubeId, setSelectedCubeId] = useState('');
  const [selectedBadgeId, setSelectedBadgeId] = useState('');
  const [selectedMissionId, setSelectedMissionId] = useState('');
  const [awardReason, setAwardReason] = useState('');
  const [awardSubmitting, setAwardSubmitting] = useState(false);
  const [awardSuccess, setAwardSuccess] = useState(false);

  // Badge designer: null = closed, {} = creating, {id,...} = editing
  const [designerDraft, setDesignerDraft] = useState<Partial<BadgeDraft> | null>(null);
  const [designerSubmitting, setDesignerSubmitting] = useState(false);

  // Rarity filter for the showcase
  const [rarityFilter, setRarityFilter] = useState('');

  const fetchBadgeData = async () => {
    try {
      const [badgesRes, cubesRes, missionsRes] = await Promise.all([
        api.get('/badges'),
        api.get('/cubes?active=true'),
        api.get('/missions')
      ]);
      setBadges(badgesRes);
      setCubes(cubesRes);
      setMissions(missionsRes);
      
      if (cubesRes.length > 0) setSelectedCubeId(cubesRes[0].id);
      if (badgesRes.length > 0) setSelectedBadgeId(badgesRes[0].id);
      if (missionsRes.length > 0) setSelectedMissionId(missionsRes[0].id);
    } catch (err: any) {
      setError(err.message || 'Failed to load badges');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBadgeData();
  }, []);

  const handleAwardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCubeId || !selectedBadgeId || !awardReason) return;

    setAwardSubmitting(true);
    try {
      await api.post('/badges/award', {
        cubeProfileId: selectedCubeId,
        badgeId: selectedBadgeId,
        missionId: selectedMissionId || undefined,
        reason: awardReason
      });
      setAwardSuccess(true);
      setAwardReason('');
      fetchBadgeData();
      setTimeout(() => {
        setShowAwardForm(false);
        setAwardSuccess(false);
      }, 1500);
    } catch (err: any) {
      alert(err.message || 'Failed to award badge');
    } finally {
      setAwardSubmitting(false);
    }
  };

  /** Creates a new badge, or saves edits when the draft carries an id. */
  const handleDesignerSubmit = async (draft: BadgeDraft) => {
    setDesignerSubmitting(true);
    try {
      const payload = {
        name: draft.name,
        description: draft.description,
        icon: draft.icon,
        rarity: draft.rarity
      };
      if (draft.id) {
        await api.put(`/badges/${draft.id}`, payload);
      } else {
        await api.post('/badges', payload);
      }
      setDesignerDraft(null);
      fetchBadgeData();
    } catch (err: any) {
      alert(err.message || 'Failed to save badge');
    } finally {
      setDesignerSubmitting(false);
    }
  };

  const handleDeleteBadge = async (badge: any) => {
    const awarded = badge.cube_badges?.length || 0;
    if (awarded > 0) {
      // Editing keeps the awards; deleting takes them off every profile.
      const proceed = window.confirm(
        `"${badge.name}" has been awarded to ${awarded} Cube(s).\n\n` +
        `Deleting it removes the badge from their profiles permanently. ` +
        `If you only want to change how it looks, close this and use Edit instead.\n\n` +
        `Delete anyway?`
      );
      if (!proceed) return;
    } else if (!window.confirm(`Delete the "${badge.name}" badge definition?`)) {
      return;
    }

    try {
      await api.delete(`/badges/${badge.id}${awarded > 0 ? '?force=true' : ''}`);
      setBadges((prev) => prev.filter((b) => b.id !== badge.id));
    } catch (err: any) {
      alert(err.message || 'Failed to delete badge');
    }
  };

  const handleRevokeAward = async (awardId: string) => {
    if (!window.confirm("Are you sure you want to revoke this badge award?")) return;
    try {
      await api.delete(`/badges/award/${awardId}`);
      fetchBadgeData();
    } catch (err: any) {
      alert(err.message || 'Failed to revoke badge award');
    }
  };

  // Rarest first so the showcase leads with what is hardest to earn
  // Legendary badges get their own spotlight above the grid; the grid lists
  // them only when the Legendary filter is chosen.
  const legendaryBadges = useMemo(
    () => badges.filter(b => b.rarity === 'Legendary'),
    [badges]
  );

  const visibleBadges = useMemo(
    () =>
      badges
        .filter(b => (rarityFilter ? (b.rarity || 'Common') === rarityFilter : b.rarity !== 'Legendary'))
        .sort((a, b) => compareByRarity(a.rarity, b.rarity) || a.name.localeCompare(b.name)),
    [badges, rarityFilter]
  );

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-magenta border-t-transparent"></div>
      </div>
    );
  }

  const isMentorOrAdmin = user?.role === 'ADMIN' || user?.role === 'MENTOR';
  const isAdmin = user?.role === 'ADMIN';

  return (
    <div className="flex flex-col gap-6">
      
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Badges & Recognition</h1>
          <p className="text-gray-500 mt-1">Recognize milestones, original concepts, and excellent collaboration.</p>
        </div>
        
        <div className="flex gap-3">
          {isMentorOrAdmin && (
            <button
              onClick={() => { setShowAwardForm(!showAwardForm); setDesignerDraft(null); }}
              className="flex items-center gap-2 px-4 py-2.5 bg-magenta text-white font-bold text-xs rounded-xl hover:bg-magenta-hover transition-colors shadow-sm"
            >
              <Award className="w-4 h-4" />
              <span>Award Badge</span>
            </button>
          )}

          {isAdmin && (
            <button
              onClick={() => { setDesignerDraft(designerDraft ? null : {}); setShowAwardForm(false); }}
              className="flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white font-bold text-xs rounded-xl hover:bg-black transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Design Badge</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 border border-red-100 p-4 rounded-2xl flex items-center gap-2 text-sm font-semibold">
          <ShieldAlert className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Badge designer — full width so the live preview sits beside the controls */}
      {designerDraft && (
        <BadgeDesigner
          key={designerDraft.id || 'new'}
          initial={designerDraft}
          submitting={designerSubmitting}
          onSubmit={handleDesignerSubmit}
          onCancel={() => setDesignerDraft(null)}
        />
      )}

      {/* Forms Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* Award Badge Form */}
        {showAwardForm && (
          <form onSubmit={handleAwardSubmit} className="bg-white border border-gray-100 rounded-3xl p-6 shadow-premium flex flex-col gap-4 animate-fadeIn">
            <h3 className="font-extrabold text-sm border-b border-gray-50 pb-2">Award Badge to a Cube</h3>

            {awardSuccess && (
              <div className="bg-green-50 text-green-700 text-xs font-semibold p-2.5 rounded-lg border border-green-100 flex items-center gap-1.5">
                <Check className="w-4 h-4" />
                <span>Badge successfully awarded.</span>
              </div>
            )}

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase">Select Cube</label>
              <select value={selectedCubeId} onChange={e => setSelectedCubeId(e.target.value)} className="p-2 border border-gray-100 bg-gray-50 rounded-lg text-xs font-semibold">
                {cubes.map(c => (
                  <option key={c.id} value={c.id}>Cube #{c.cube_number} - {c.user.name}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase">Select Badge</label>
              <select value={selectedBadgeId} onChange={e => setSelectedBadgeId(e.target.value)} className="p-2 border border-gray-100 bg-gray-50 rounded-lg text-xs font-semibold">
                {visibleBadges.map(b => (
                  <option key={b.id} value={b.id}>
                    {getRarityMeta(b.rarity).label.toUpperCase()} · {b.name}
                  </option>
                ))}
              </select>
              {selectedBadgeId && (
                <div className="flex items-center gap-2 mt-1.5">
                  <BadgeDisc
                    icon={badges.find(b => b.id === selectedBadgeId)?.icon}
                    rarity={badges.find(b => b.id === selectedBadgeId)?.rarity}
                    size="sm"
                  />
                  <span className="text-[11px] text-gray-500 font-semibold leading-snug">
                    {badges.find(b => b.id === selectedBadgeId)?.description}
                  </span>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase">Associated Mission (Optional)</label>
              <select value={selectedMissionId} onChange={e => setSelectedMissionId(e.target.value)} className="p-2 border border-gray-100 bg-gray-50 rounded-lg text-xs font-semibold">
                <option value="">None / General Fellowship Achievement</option>
                {missions.map(m => (
                  <option key={m.id} value={m.id}>{m.title}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase">Award Reason <span className="text-red-500">*</span></label>
              <textarea
                required
                rows={2}
                placeholder="Why is this Cube receiving this badge? Provide specific examples..."
                value={awardReason}
                onChange={e => setAwardReason(e.target.value)}
                className="p-2.5 border border-gray-100 bg-gray-50 rounded-lg text-xs outline-none focus:border-magenta resize-none font-semibold"
              />
            </div>

            <button type="submit" disabled={awardSubmitting} className="w-full py-2 bg-magenta text-white font-bold text-xs rounded-xl hover:bg-magenta-hover transition-colors">
              {awardSubmitting ? 'Awarding...' : 'Award Badge'}
            </button>
          </form>
        )}

      </div>

      {/* Legendary spotlight */}
      {rarityFilter === '' && legendaryBadges.map(badge => {
        const meta = getRarityMeta('Legendary');
        const holders: any[] = badge.cube_badges || [];
        return (
          <section key={badge.id} className={`group relative ${meta.frame}`}>
            <span className="badge-sheen" />
            <BadgeSparks />
            <BadgeEmbers />
            <div className="relative flex flex-col items-center gap-6 p-8 text-center sm:flex-row sm:p-10 sm:text-left">
              <div className="relative shrink-0">
                <div className="absolute -inset-6 rounded-full bg-amber-400/20 blur-2xl" />
                <div className="relative scale-[1.9] origin-center my-6 mx-6">
                  <BadgeDisc icon={badge.icon} rarity="Legendary" size="lg" />
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <p className="flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-[0.28em] text-amber-300/80 sm:justify-start">
                  <Crown className="h-3.5 w-3.5" /> Legendary
                </p>
                <h2 className="badge-title-legendary mt-2 text-3xl font-black leading-[1.1] tracking-tight sm:text-5xl sm:leading-[1.1]">{badge.name}</h2>
                <p className={`mt-3 max-w-2xl text-sm font-medium leading-relaxed ${meta.body}`}>{badge.description}</p>

                {holders.length === 0 ? (
                  <div className="badge-unclaimed mt-5 inline-flex items-center gap-2.5 rounded-2xl border border-amber-300/30 px-4 py-2.5 text-xs font-extrabold text-amber-100">
                    <Lock className="h-4 w-4 text-amber-300" />
                    Unclaimed. No Cube has earned this yet. Will it be you?
                  </div>
                ) : (
                  <div className="mt-5 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-300/70">
                      Held by {holders.length}
                    </span>
                    {holders.map((award: any) => (
                      <span key={award.id} className={`flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-extrabold ${meta.earnerChip}`}>
                        <Crown className="h-3 w-3 text-amber-300" /> {award.cube?.user?.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
        );
      })}

      {/* Rarity filter + counts */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setRarityFilter('')}
          className={`px-3 py-1.5 rounded-xl text-[11px] font-extrabold uppercase tracking-wider border transition-colors ${
            rarityFilter === ''
              ? 'bg-gray-900 text-white border-gray-900'
              : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
          }`}
        >
          All {badges.length}
        </button>
        {RARITIES.map(r => {
          const meta = getRarityMeta(r);
          const count = badges.filter(b => (b.rarity || 'Common') === r).length;
          return (
            <button
              key={r}
              onClick={() => setRarityFilter(rarityFilter === r ? '' : r)}
              title={meta.hint}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-extrabold uppercase tracking-wider border transition-colors ${
                rarityFilter === r
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {meta.label} {count}
            </button>
          );
        })}
      </div>

      {/* Grid listing Badges, rarest first */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {visibleBadges.map((badge) => {
          const meta = getRarityMeta(badge.rarity);

          return (
            <BadgeMedal
              key={badge.id}
              badge={badge}
              actions={
                isAdmin && (
                  <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => { setDesignerDraft(badge); setShowAwardForm(false); }}
                      className={`p-1.5 rounded-lg border border-transparent transition-all ${
                        meta.dark
                          ? 'text-slate-300 hover:text-white hover:bg-white/10'
                          : 'text-gray-400 hover:text-magenta hover:bg-magenta/5 hover:border-magenta/10'
                      }`}
                      title="Edit this badge"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteBadge(badge)}
                      className={`p-1.5 rounded-lg border border-transparent transition-all ${
                        meta.dark
                          ? 'text-slate-300 hover:text-red-300 hover:bg-red-500/15'
                          : 'text-gray-400 hover:text-red-500 hover:bg-red-50 hover:border-red-100'
                      }`}
                      title="Delete badge definition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )
              }
            >
              {/* List of earners */}
              <div className={`border-t ${meta.divider} pt-4 mt-auto flex flex-col gap-2`}>
                <p className={`text-[10px] font-bold uppercase tracking-wider ${meta.muted}`}>
                  Earned by ({badge.cube_badges?.length || 0})
                </p>
                {badge.cube_badges && badge.cube_badges.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {badge.cube_badges.map((award: any) => (
                      <span
                        key={award.id}
                        className={`text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 ${meta.earnerChip}`}
                        title={award.reason}
                      >
                        <span>{award.cube.user.name}</span>
                        {isAdmin && (
                          <button
                            onClick={() => handleRevokeAward(award.id)}
                            className="hover:bg-black/10 rounded-full p-0.5 flex items-center justify-center"
                            title="Revoke award"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                ) : (
                  meta.key === 'Legendary' ? (
                    <p className="badge-unclaimed flex items-center gap-2 rounded-xl px-3 py-2 text-[11px] font-extrabold text-amber-100">
                      <Lock className="h-3.5 w-3.5 text-amber-300" /> Unclaimed. Will it be you?
                    </p>
                  ) : (
                    <p className={`text-[11px] italic ${meta.muted}`}>
                      No Cubes have earned this badge yet.
                    </p>
                  )
                )}
              </div>
            </BadgeMedal>
          );
        })}
      </div>

    </div>
  );
};
