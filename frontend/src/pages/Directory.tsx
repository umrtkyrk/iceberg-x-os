import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Search, Filter, ShieldAlert, ShieldCheck, Award, Sparkles, Trash, Rocket, AlertCircle, GraduationCap, Clock, Mail, XCircle } from 'lucide-react';
import { getLevelMeta, isInProgramme } from '../utils/cubeStatus';
import { UserAvatar } from '../components/UserAvatar';
import { QuizScoreBadge } from '../components/QuizScoreBadge';
import { GiveFeedbackButton } from '../components/peer/GiveFeedbackButton';

export const Directory: React.FC = () => {
  const { user } = useAuth();
  const [cubes, setCubes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  const [assignmentFilter, setAssignmentFilter] = useState('all'); // 'all', 'assigned', 'unassigned'
  const [ndaFilter, setNdaFilter] = useState<'all' | 'signed' | 'pending' | 'not_sent' | 'not_signed'>('all');
  const [showAlumni, setShowAlumni] = useState(false);

  // Former Cubes and Alumni are hidden by default (Alumni are not even fetched),
  // so the directory shows the people currently around: Cubes, Senior Cubes and
  // Icebergers. The toggle brings the rest back.
  const fetchCubes = async (withAlumni: boolean) => {
    try {
      setLoading(true);
      const res = await api.get(withAlumni ? '/cubes?includeAlumni=true' : '/cubes');
      setCubes(res);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch Cube directory');
    } finally {
      setLoading(false);
    }
  };

  const getActiveMissions = (cube: any) => {
    if (!cube.team_memberships || cube.team_memberships.length === 0) return [];
    const activeMems = cube.team_memberships.filter((m: any) => {
      const mission = m.team?.mission;
      if (!mission) return false;
      return !['completed', 'reviewed', 'promoted_to_product_backlog', 'archived', 'cancelled'].includes(mission.status);
    });
    const map = new Map<string, any>();
    for (const m of activeMems) {
      if (m.team?.mission && !map.has(m.team.mission.id)) {
        map.set(m.team.mission.id, m.team.mission);
      }
    }
    return Array.from(map.values());
  };

  const getActiveMission = (cube: any) => {
    const list = getActiveMissions(cube);
    return list[0] || null;
  };

  useEffect(() => {
    fetchCubes(showAlumni);
  }, [showAlumni]);

  const handleDeleteClick = async (e: React.MouseEvent, cube: any) => {
    e.stopPropagation();
    e.preventDefault();
    const cubeName = cube?.user?.name || 'this Cube';
    const confirmation = prompt(
      `To permanently delete this Cube (${cubeName}), please type "delete":`
    );
    if (confirmation === null) return;
    if (confirmation.trim().toLowerCase() !== 'delete') {
      alert("Confirmation text mismatch. Deletion cancelled.");
      return;
    }

    try {
      await api.delete(`/admin/users/${cube.user_id}`);
      alert("Cube deleted successfully.");
      fetchCubes(showAlumni);
    } catch (err: any) {
      alert(err.message || "Failed to delete Cube");
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-magenta border-t-transparent"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 text-red-600 border border-red-100 p-4 rounded-2xl flex items-center gap-2">
        <ShieldAlert className="w-5 h-5" />
        <span>{error}</span>
      </div>
    );
  }

  // Filter cubes
  const filteredCubes = cubes.filter((cube) => {
    const isOriginalCube = parseInt(cube.cube_number, 10) === 0;
    const normalizedSearch = searchQuery.toLowerCase();
    const matchesSearch =
      cube.user.name.toLowerCase().includes(normalizedSearch) ||
      cube.cube_number.toLowerCase().includes(normalizedSearch) ||
      (isOriginalCube && 'the original cube no further information available classified'.includes(normalizedSearch)) ||
      (cube.university || '').toLowerCase().includes(normalizedSearch) ||
      (cube.skills || []).some((s: string) => s.toLowerCase().includes(normalizedSearch));

    const isArchived = cube.current_level === 'Former_Cube' || cube.current_level === 'Alumni';
    if (isArchived && !showAlumni) return false;

    const matchesLevel = levelFilter ? cube.current_level === levelFilter : true;

    const activeMission = getActiveMission(cube);
    // Only people doing the programme can meaningfully be "unassigned";
    // Icebergers, Former Cubes and Alumni are not waiting for a mission.
    const isUnassigned = !activeMission && isInProgramme(cube.current_level);
    const matchesAssignment =
      assignmentFilter === 'all'
        ? true
        : assignmentFilter === 'unassigned'
          ? isUnassigned
          : !!activeMission;

    const effectiveNdaStatus = cube.nda_status || (cube.nda_signed ? 'signed' : 'not_sent');
    const matchesNda =
      ndaFilter === 'all'
        ? true
        : effectiveNdaStatus === ndaFilter;

    return matchesSearch && matchesLevel && matchesAssignment && matchesNda;
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <PageHeader eyebrow="Community" title="Cube Directory" description="Meet the Cubes building the programme, past and present." />

      {/* Search & Filter Controls */}
      <div className="bg-white border border-gray-100 p-4 rounded-2xl shadow-subtle flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-3 w-4.5 h-4.5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, university, or skills..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 hover:bg-gray-100/50 border border-gray-100 rounded-xl outline-none font-semibold text-xs transition-all"
          />
        </div>

        <div className="flex gap-3 w-full md:w-auto flex-wrap">
          <div className="relative flex-1 md:w-48">
            <Filter className="absolute left-3.5 top-3 w-4.5 h-4.5 text-gray-400" />
            <select
              value={levelFilter}
              onChange={(e) => {
                setLevelFilter(e.target.value);
                // Picking Former Cube or Alumni explicitly brings them back
                if (e.target.value === 'Alumni' || e.target.value === 'Former_Cube') setShowAlumni(true);
              }}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 hover:bg-gray-100/50 border border-gray-100 rounded-xl outline-none font-bold text-xs appearance-none cursor-pointer"
            >
              <option value="">All Statuses (Levels)</option>
              <option value="Cube">Cube</option>
              <option value="Senior_Cube">Senior Cube</option>
              <option value="Iceberger">Iceberger</option>
              <option value="Former_Cube">Former Cube</option>
              <option value="Alumni">Alumni</option>
            </select>
          </div>

          <label
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl border cursor-pointer transition-colors select-none ${
              showAlumni
                ? 'bg-amber-50 border-amber-200 text-amber-800'
                : 'bg-gray-50 border-gray-100 text-gray-500 hover:bg-gray-100/50'
            }`}
            title="Former Cubes and Alumni have left the programme and are hidden by default"
          >
            <input
              type="checkbox"
              checked={showAlumni}
              onChange={(e) => {
                setShowAlumni(e.target.checked);
                if (!e.target.checked && (levelFilter === 'Alumni' || levelFilter === 'Former_Cube')) setLevelFilter('');
              }}
              className="w-3.5 h-3.5 rounded text-amber-600 border-gray-300 focus:ring-amber-500 cursor-pointer"
            />
            <GraduationCap className="w-4 h-4" />
            <span className="text-xs font-bold whitespace-nowrap">Show former &amp; alumni</span>
          </label>
          {(user?.role === 'ADMIN' || user?.role === 'MENTOR') && (
            <div className="relative flex-1 md:w-48">
              <Filter className="absolute left-3.5 top-3 w-4.5 h-4.5 text-gray-400" />
              <select
                value={assignmentFilter}
                onChange={(e) => setAssignmentFilter(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 hover:bg-gray-100/50 border border-gray-100 rounded-xl outline-none font-bold text-xs appearance-none cursor-pointer text-slate-800"
              >
                <option value="all">All Assignments</option>
                <option value="unassigned">Unassigned</option>
                <option value="assigned">Assigned</option>
              </select>
            </div>
          )}

          <div className="relative flex-1 md:w-44">
            <ShieldCheck className="absolute left-3.5 top-3 w-4.5 h-4.5 text-gray-400 pointer-events-none" />
            <select
              value={ndaFilter}
              onChange={(e) => setNdaFilter(e.target.value as any)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 hover:bg-gray-100/50 border border-gray-100 rounded-xl outline-none font-bold text-xs appearance-none cursor-pointer text-slate-800"
            >
              <option value="all">All NDA Statuses</option>
              <option value="signed">✓ NDA Signed</option>
              <option value="pending">⏳ NDA Pending</option>
              <option value="not_sent">✉ NDA Not Sent</option>
              <option value="not_signed">✕ NDA Not Signed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Grid */}
      {filteredCubes.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCubes.map((cube) => {
            const isOriginalCube = parseInt(cube.cube_number, 10) === 0;
            const isFounding = cube.is_founding_cube;
            const isIceberger = cube.current_level === 'Iceberger';

            if (isOriginalCube) {
              return (
                <div
                  key={cube.id}
                  className="p-6 rounded-2xl transition-all duration-300 flex flex-col justify-between gap-6 relative overflow-hidden bg-[#111113] border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.18)]"
                >
                  <div className="absolute -right-12 -top-12 w-44 h-44 rounded-full border border-white/10 opacity-60"></div>
                  <div className="absolute right-6 bottom-6 text-[8rem] font-black leading-none text-white/[0.03] select-none">X</div>
                  <div className="relative z-10 flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-magenta">Classified Record</p>
                      <h3 className="mt-3 text-2xl font-black tracking-tight text-white">Cube #{cube.cube_number}</h3>
                    </div>
                    <span className="rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-[10px] font-extrabold uppercase tracking-wide text-red-400">
                      Classified
                    </span>
                  </div>

                  <div className="relative z-10 space-y-3 text-sm">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-white/35">Classification</p>
                      <p className="mt-1 font-extrabold text-white">The Original Cube</p>
                    </div>
                    <p className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs font-semibold text-white/55">
                      No further information available.
                    </p>
                  </div>
                </div>
              );
            }

            let cardClassName = "p-6 rounded-3xl transition-all duration-300 flex flex-col justify-between group relative ";
            const activeMissions = getActiveMissions(cube);
            const activeMission = activeMissions[0] || null;
            const isUnassigned = activeMissions.length === 0;
            const isAlumni = cube.current_level === 'Alumni';
            const isFormer = cube.current_level === 'Former_Cube';
            // Icebergers, Former Cubes and Alumni are not doing the programme,
            // so "no active mission" is expected, not something to flag.
            const hasLeftProgramme = isAlumni || isFormer || isIceberger;

            if (isAlumni) {
              // Deliberately unlike every other card: muted, sepia, no hover
              // lift. Graduates are a record, not part of the working roster.
              cardClassName += "bg-gradient-to-br from-amber-50/60 via-stone-50 to-stone-100 border border-dashed border-amber-300/70 opacity-90 hover:opacity-100";
            } else if (isIceberger) {
              cardClassName += "bg-gradient-to-br from-[#0c1b33] via-[#090f1d] to-[#04060c] border-2 border-cyan-500/70 shadow-[0_0_20px_rgba(6,182,212,0.15)] hover:shadow-[0_0_30px_rgba(6,182,212,0.35)] hover:-translate-y-1 text-white";
            } else if (isFormer) {
              cardClassName += "bg-slate-50 border border-slate-200 border-dashed hover:border-slate-300 shadow-none";
            } else if (isFounding) {
              cardClassName += "bg-white border-2 border-amber-400 hover:border-amber-500 shadow-[0_4px_20px_rgba(245,158,11,0.08)] hover:shadow-[0_8px_30px_rgba(245,158,11,0.18)] hover:-translate-y-1";
            } else {
              const alertUnassigned = (user?.role === 'ADMIN' || user?.role === 'MENTOR') && isUnassigned;
              if (alertUnassigned) {
                cardClassName += "bg-red-50/30 border-2 border-red-200 hover:border-red-300 hover:-translate-y-1 shadow-subtle hover:shadow-premium";
              } else {
                cardClassName += "bg-white border border-gray-100 hover:border-magenta/20 hover:-translate-y-1 shadow-subtle hover:shadow-premium";
              }
            }

            return (
              <div
                key={cube.id}
                className={cardClassName}
              >
                <div className="flex flex-col">
                  {/* Row 1: Identity (Avatar + Name & Cohort + Delete Button) */}
                  <div className="flex items-center justify-between gap-3">
                    <Link
                      to={`/cubes/${cube.id}`}
                      className="flex items-center gap-3.5 group/link hover:opacity-95 transition-opacity min-w-0 flex-1"
                    >
                      <UserAvatar
                        name={cube.user.name}
                        avatarUrl={cube.avatar_url || cube.user.avatar_url}
                        size="card"
                        className={`shrink-0 transition-transform duration-200 group-hover/link:scale-105 ${
                          isIceberger ? 'ring-2 ring-cyan-400/40' : isFounding ? 'ring-2 ring-amber-400/50' : 'ring-2 ring-gray-100'
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <h3 className={`font-black text-lg tracking-tight leading-snug flex items-center gap-2 ${
                          isIceberger
                            ? 'text-white group-hover/link:text-cyan-400'
                            : isFounding
                              ? 'text-gray-900 group-hover/link:text-amber-600'
                              : 'text-gray-900 group-hover/link:text-magenta'
                        }`}>
                          <span className="truncate">{cube.user.name}</span>
                          {isFounding && <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0" />}
                          {isIceberger && <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />}
                        </h3>
                        <p className={`text-sm font-medium mt-0.5 truncate ${isIceberger ? 'text-cyan-300/70' : 'text-gray-400'}`}>
                          {cube.cohort || 'Iceberg Fellows'}
                        </p>
                      </div>
                    </Link>
                    {user?.role === 'ADMIN' && (
                      <button
                        type="button"
                        onClick={(e) => handleDeleteClick(e, cube)}
                        className={`shrink-0 p-1.5 rounded-lg border text-red-600 transition ${
                          isIceberger
                            ? 'bg-red-500/10 border-red-500/20 hover:bg-red-500/20 text-red-300'
                            : 'bg-red-50 border-red-100 hover:bg-red-100'
                        }`}
                        title="Delete Cube"
                      >
                        <Trash className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Row 2: Badges Row (#008, Level, Founding, NDA) */}
                  <div className="flex flex-wrap items-center gap-2 mt-4">
                    {/* Number Pill */}
                    <span className={`font-mono font-bold text-xs px-3 py-1 rounded-full border ${
                      isIceberger
                        ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300'
                        : isFounding
                          ? 'bg-amber-50/70 border-amber-300/80 text-amber-800'
                          : 'bg-magenta/5 border-magenta/20 text-magenta'
                    }`}>
                      #{cube.cube_number}
                    </span>

                    {/* Level Pill */}
                    <span
                      title={getLevelMeta(cube.current_level).hint}
                      className={`text-xs font-extrabold px-3.5 py-1 rounded-full uppercase tracking-wider border ${
                        isFounding && !hasLeftProgramme
                          ? 'text-amber-800 bg-amber-50/70 border-amber-300/80'
                          : getLevelMeta(cube.current_level).badge
                      }`}
                    >
                      {getLevelMeta(cube.current_level).label}
                    </span>

                    {/* Founding Pill */}
                    {isFounding && (
                      <span className="bg-amber-50/70 border border-amber-300/80 text-amber-800 font-extrabold text-xs px-3.5 py-1 rounded-full uppercase tracking-wider">
                        Founding
                      </span>
                    )}

                    {/* Left Programme Status */}
                    {hasLeftProgramme && !isFounding && (
                      <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider border ${
                        isIceberger
                          ? 'text-cyan-300/80 bg-white/5 border-white/10'
                          : 'text-gray-500 bg-white border-gray-200'
                      }`}>
                        {getLevelMeta(cube.current_level).hint}
                      </span>
                    )}

                    {/* NDA Status Pill */}
                    {(() => {
                      const status = cube.nda_status || (cube.nda_signed ? 'signed' : 'not_sent');
                      if (status === 'signed') {
                        return (
                          <span
                            title={`NDA Signed${cube.nda_signed_at ? ' · ' + new Date(cube.nda_signed_at).toLocaleDateString('en-GB') : ''}`}
                            className="inline-flex items-center gap-1 font-extrabold text-xs px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700"
                          >
                            <ShieldCheck className="w-3 h-3 text-emerald-600 shrink-0" />
                            <span>NDA</span>
                          </span>
                        );
                      }
                      if (status === 'pending') {
                        return (
                          <span
                            title="NDA Pending Signature"
                            className="inline-flex items-center gap-1 font-extrabold text-xs px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700"
                          >
                            <Clock className="w-3 h-3 text-amber-600 shrink-0" />
                            <span>Pending</span>
                          </span>
                        );
                      }
                      if (status === 'not_signed') {
                        return (
                          <span
                            title="NDA Not Signed"
                            className="inline-flex items-center gap-1 font-extrabold text-xs px-3 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700"
                          >
                            <XCircle className="w-3 h-3 text-rose-600 shrink-0" />
                            <span>Not Signed</span>
                          </span>
                        );
                      }
                      return (
                        <span
                          title="NDA Not Sent"
                          className="inline-flex items-center gap-1 font-extrabold text-xs px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-600"
                        >
                          <Mail className="w-3 h-3 text-slate-500 shrink-0" />
                          <span>Not Sent</span>
                        </span>
                      );
                    })()}

                    {/* Web Fundamentals Quiz Certification Score Pill */}
                    {cube.quiz_attempts && cube.quiz_attempts.length > 0 && cube.quiz_attempts[0].score !== undefined && (
                      <QuizScoreBadge
                        score={cube.quiz_attempts[0].score}
                        badgeName={cube.quiz_attempts[0].badge_awarded?.name}
                        rarity={cube.quiz_attempts[0].badge_awarded?.rarity}
                        variant="pill"
                      />
                    )}
                  </div>

                  {/* Row 3: Academic & Program details */}
                  <div className={`flex flex-col gap-2.5 text-[13px] pt-4 mt-4 border-t ${
                    isIceberger ? 'border-cyan-500/15 text-slate-300' : 'border-gray-100 text-gray-600'
                  }`}>
                    <div className="flex items-baseline gap-2">
                      <span className={`font-extrabold shrink-0 ${isIceberger ? 'text-cyan-400' : 'text-gray-900'}`}>Uni:</span>
                      <span className="truncate" title={cube.university || 'N/A'}>
                        {cube.university || 'N/A'}
                      </span>
                    </div>
                    {cube.internship_status && (
                      <div className="flex items-baseline gap-2">
                        <span className={`font-extrabold shrink-0 ${isIceberger ? 'text-cyan-400' : 'text-gray-900'}`}>Current Role:</span>
                        <span className={`font-bold truncate ${isIceberger ? 'text-cyan-300' : 'text-magenta'}`} title={cube.internship_status}>
                          {cube.internship_status}
                        </span>
                      </div>
                    )}
                    {cube.assigned_mentor && (
                      <div className="flex items-baseline gap-2">
                        <span className={`font-extrabold shrink-0 ${isIceberger ? 'text-cyan-400' : 'text-gray-900'}`}>Mentor:</span>
                        <span className={`font-medium truncate ${isIceberger ? 'text-slate-200' : 'text-gray-700'}`}>
                          {cube.assigned_mentor.name}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Row 4: Active Mission Section */}
                  {!hasLeftProgramme && (
                    <div className={`pt-4 mt-4 border-t text-xs flex flex-col gap-1.5 ${
                      isIceberger ? 'border-cyan-500/15' : 'border-gray-100'
                    }`}>
                      <span className="font-extrabold text-[11px] uppercase tracking-wider text-gray-400">
                        {activeMissions.length > 1 ? `ACTIVE MISSIONS (${activeMissions.length})` : 'ACTIVE MISSION'}
                      </span>
                      {activeMissions.length > 0 ? (
                        <div className="flex flex-col gap-1">
                          {activeMissions.map((m: any) => (
                            <Link
                              key={m.id}
                              to={`/missions/${m.id}`}
                              className="text-magenta hover:text-magenta-hover font-bold text-sm sm:text-[15px] leading-snug line-clamp-1 hover:underline transition-colors"
                              title={m.title}
                            >
                              {m.title}
                            </Link>
                          ))}
                        </div>
                      ) : (
                        <span className="text-red-500 font-bold text-xs flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>Unassigned</span>
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Row 5: Skills Tags */}
                {cube.skills && cube.skills.length > 0 && (
                  <div className={`border-t pt-4 mt-auto flex flex-wrap items-center gap-2 ${
                    isIceberger ? 'border-slate-800' : 'border-gray-100'
                  }`}>
                    {cube.skills.slice(0, 3).map((skill: string) => (
                      <span
                        key={skill}
                        className={`text-xs font-semibold px-3.5 py-1 rounded-full border ${
                          isIceberger
                            ? 'bg-slate-800/60 border-slate-700 text-slate-300'
                            : 'bg-slate-50 border-slate-200/80 text-slate-700'
                        }`}
                      >
                        {skill}
                      </span>
                    ))}
                    {cube.skills.length > 3 && (
                      <span
                        className={`text-xs font-semibold px-3 py-1 rounded-full border border-dashed ${
                          isIceberger
                            ? 'bg-slate-800/40 border-slate-700 text-slate-400'
                            : 'bg-white border-gray-300 text-gray-500'
                        }`}
                      >
                        +{cube.skills.length - 3} more
                      </span>
                    )}
                  </div>
                )}

                {/* Peer feedback: Cubes can recognise anyone still in the programme */}
                {user?.role === 'CUBE' && !hasLeftProgramme && cube.id !== user.cubeProfileId && (
                  <div className={`pt-3 mt-3 border-t flex ${isIceberger ? 'border-slate-800' : 'border-gray-100'}`}>
                    <GiveFeedbackButton
                      receiver={{
                        id: cube.id,
                        name: cube.user?.name || 'Unknown',
                        avatarUrl: cube.avatar_url || cube.user?.avatar_url
                      }}
                      variant="soft"
                      label="Give feedback"
                      className="w-full"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-gray-400 text-sm py-12 text-center bg-white border border-gray-100 rounded-2xl shadow-subtle">
          No Cubes match the selected filters.
        </p>
      )}
    </div>
  );
};
import { PageHeader } from '../components/PageHeader';
