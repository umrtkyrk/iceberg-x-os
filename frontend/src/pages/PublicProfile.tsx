import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../utils/api';
import { ShieldCheck, ShieldAlert, Award, Calendar, Clock, ExternalLink, Check, Copy, Share2, CheckCircle, GraduationCap, Code2, Sparkles, HeartHandshake } from 'lucide-react';
import { ScaledCertificatePreview } from '../components/CertificateSheet';
import { BadgeDisc, RarityPill, BadgeSparks } from '../components/BadgeMedal';
import { compareByRarity, getRarityMeta } from '../utils/badgeRarity';
import { getAssetUrl } from '../utils/assets';
import { QuizScoreBadge } from '../components/QuizScoreBadge';
import { PeerTitleCard } from '../components/peer/PeerTitleCard';

export const PublicProfile: React.FC = () => {
  const { cubeNumber, certNo } = useParams<{ cubeNumber?: string; certNo?: string }>();
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [avatarError, setAvatarError] = useState(false);

  useEffect(() => {
    const fetchPublicData = async () => {
      setLoading(true);
      setError(null);
      try {
        if (certNo) {
          // Accessed via /verify/:certNo
          const verifyRes = await api.get(`/offboarding/verify/${certNo}`);
          // Load public profile using cube_number or cube_id
          const pubRes = await api.get(`/cubes/public/${verifyRes.cube_number || verifyRes.cube_id}`);
          setData(pubRes);
        } else if (cubeNumber) {
          // Accessed via /x/:cubeNumber
          const pubRes = await api.get(`/cubes/public/${cubeNumber}`);
          setData(pubRes);
        } else {
          setError('No Cube identifier provided.');
        }
      } catch (err: any) {
        setError(err.message || 'Profile or Certificate not found');
      } finally {
        setLoading(false);
      }
    };
    fetchPublicData();
  }, [cubeNumber, certNo]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F4F5F7]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#E5007D] border-t-transparent"></div>
      </div>
    );
  }

  if (error || !data || !data.profile) {
    return (
      <div className="min-h-screen bg-[#F4F5F7] flex flex-col justify-between py-12 px-4 font-sans">
        <div className="max-w-md w-full mx-auto flex flex-col gap-6">
          <div className="text-center">
            <Link to="/" className="inline-block hover:opacity-90 transition-opacity">
              <img src="/images/iceberg-x-lockup.png" alt="Iceberg X" className="h-7 mx-auto block" />
            </Link>
          </div>

          <div className="bg-white rounded-3xl p-8 shadow-xl border border-red-100 flex flex-col gap-5 text-center">
            <ShieldAlert className="w-12 h-12 text-red-500 mx-auto" />
            <div>
              <h3 className="font-extrabold text-gray-900 text-lg">Profile Not Found</h3>
              <p className="text-xs text-red-500 font-bold uppercase tracking-wider mt-1">Verification Failed</p>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              {error || 'The requested profile or certificate record could not be found.'}
            </p>
            <Link
              to="/"
              className="mt-2 w-full py-3 bg-[#11151C] hover:bg-black text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 shadow-md shadow-black/10"
            >
              <span>Iceberg X Portal</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { profile, stats, missions = [], peer_titles: peerTitles = [] } = data;
  const offboarding = profile.offboarding_record;
  const isAlumni = !!offboarding;
  const isAchievement = offboarding?.type === 'success' || offboarding?.type === 'achievement';

  const profileUrl = window.location.href;
  const name = profile.user?.name || `Cube #${profile.cube_number}`;
  const avatarUrl = getAssetUrl(profile.avatar_url || profile.user?.avatar_url);
  const mentorName = profile.assigned_mentor?.name || offboarding?.mentor_name || 'Iceberg Engineering Mentor';
  const questsCount = stats?.questsCompleted ?? (profile.cube_quests?.length || 0);
  const badgesCount = stats?.badgesEarned ?? (profile.cube_badges?.length || 0);
  const missionContributionsCount = stats?.missionContributions ?? missions.length;
  const attendanceRateVal = stats?.attendanceRate !== null && stats?.attendanceRate !== undefined
    ? `${stats.attendanceRate}%`
    : '100%';

  const rareBadgesCount = (profile.cube_badges || []).filter(
    (b: any) => (b.badge?.rarity || '').toUpperCase() === 'RARE' || (b.badge?.rarity || '').toUpperCase() === 'EPIC'
  ).length;

  // Social sharing
  const shareText = `${name} — Iceberg X Fellowship ${isAlumni ? 'Alumni' : 'Fellow'} · ${questsCount} quests, ${badgesCount} badges.`;

  const handleShareLinkedIn = () => {
    const url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(profileUrl)}`;
    window.open(url, '_blank', 'noopener,noreferrer,width=680,height=620');
  };

  const handleShareX = () => {
    const url = `https://twitter.com/intent/tweet?url=${encodeURIComponent(profileUrl)}&text=${encodeURIComponent(shareText)}`;
    window.open(url, '_blank', 'noopener,noreferrer,width=680,height=620');
  };

  const handleCopyLink = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(profileUrl).catch(() => {});
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getInitials = (str: string) => {
    return str
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0])
      .join('')
      .toUpperCase();
  };

  return (
    <div className="min-h-screen bg-[#F4F5F7] text-[#11151C] font-sans pb-16">
      {/* Top Navigation */}
      <header className="flex items-center justify-between gap-5 px-6 py-3.5 bg-white border-b border-[#E7E9EE] sticky top-0 z-20">
        <Link to="/" className="flex items-center">
          <img src="/images/iceberg-x-lockup.png" alt="Iceberg X" className="h-6 w-auto block" />
        </Link>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full bg-[#E6F6F7] text-[#0E7C86] text-xs font-bold">
            <i className="w-1.5 h-1.5 rounded-full bg-[#12A150] block"></i>
            Verified Profile
          </span>
          <a
            href="https://x.iceberg-digital.co.uk/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-bold text-[#6B7480] hover:text-[#11151C] transition-colors"
          >
            About Fellowship ↗
          </a>
        </div>
      </header>

      <main className="max-w-[1020px] mx-auto px-6">
        {/* Hero Section */}
        <section className="relative mt-6 rounded-[20px] overflow-hidden bg-[radial-gradient(110%_120%_at_8%_0%,_#1E2129_0%,_#0E1116_60%)] text-[#F2F4F7]">
          <img
            src="/images/iceberg-x-mark-light.png"
            alt=""
            className="absolute -right-14 -top-16 w-[340px] h-[340px] opacity-[0.06] pointer-events-none"
          />

          <div className="relative flex flex-wrap items-end gap-6 p-8 pb-6">
            {/* Styled Avatar or Initials */}
            {avatarUrl && !avatarError ? (
              <img
                src={avatarUrl}
                alt={name}
                onError={() => setAvatarError(true)}
                className="w-24 h-24 flex-none rounded-[26px] object-cover border-2 border-white/20 shadow-xl shadow-[#E5007D]/25"
              />
            ) : (
              <div className="w-24 h-24 flex-none rounded-[26px] bg-gradient-to-br from-[#E5007D] to-[#7A0B58] flex items-center justify-center text-3xl font-extrabold tracking-tight shadow-xl shadow-[#E5007D]/25">
                {getInitials(name)}
              </div>
            )}

            {/* Candidate Info */}
            <div className="flex-1 min-w-[260px]">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span
                  className="inline-flex items-center h-6 px-2.5 rounded-full text-[10.5px] font-extrabold tracking-wider"
                  style={{
                    border: isAlumni ? '1px solid rgba(229,0,125,0.5)' : '1px solid rgba(14,124,134,0.5)',
                    background: isAlumni ? 'rgba(229,0,125,0.14)' : 'rgba(14,124,134,0.14)',
                    color: isAlumni ? '#FF7CC0' : '#4DD4E0',
                  }}
                >
                  {isAlumni ? 'ALUMNI' : (profile.current_level || 'CUBE').toUpperCase()}
                </span>
                <span className="font-mono text-xs text-[#9AA2AE]">
                  CUBE #{profile.cube_number} · {(profile.cohort || 'FELLOWSHIP COHORT').toUpperCase()}
                </span>
              </div>

              <h1 className="text-[38px] font-extrabold tracking-tight leading-tight mt-2.5 mb-0">
                {name}
              </h1>

              <p className="text-sm leading-relaxed text-[#B7BDC7] max-w-[580px] mt-2 mb-0">
                Iceberg X Technology Fellowship {isAlumni ? 'graduate' : 'fellow'}. Working on R&amp;D missions
                across software engineering and innovation, mentored by{' '}
                <strong className="text-white font-bold">{mentorName}</strong>.
              </p>

              {(profile.university || profile.department || profile.github_url || profile.linkedin_url) && (
                <div className="flex flex-wrap items-center gap-3 mt-3">
                  {(profile.university || profile.department) && (
                    <span className="inline-flex items-center gap-1.5 text-xs text-[#B7BDC7] font-medium">
                      <GraduationCap className="w-4 h-4 text-[#FF7CC0]" />
                      <span>{[profile.department, profile.university].filter(Boolean).join(' · ')}</span>
                    </span>
                  )}
                  {profile.github_url && (
                    <a
                      href={profile.github_url.startsWith('http') ? profile.github_url : `https://${profile.github_url}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-[#B7BDC7] hover:text-white transition-colors"
                    >
                      <span>GitHub ↗</span>
                    </a>
                  )}
                  {profile.linkedin_url && (
                    <a
                      href={profile.linkedin_url.startsWith('http') ? profile.linkedin_url : `https://${profile.linkedin_url}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-[#B7BDC7] hover:text-white transition-colors"
                    >
                      <span>LinkedIn ↗</span>
                    </a>
                  )}
                </div>
              )}
            </div>

            {/* Social Sharing Actions */}
            <div className="flex flex-wrap gap-2 items-center">
              <button
                onClick={handleShareLinkedIn}
                className="flex items-center gap-2 h-11 px-4 border-none rounded-xl bg-[#E5007D] hover:bg-[#C90070] text-white font-bold text-[13px] cursor-pointer transition-all shadow-md shadow-[#E5007D]/20"
              >
                Share on LinkedIn
              </button>
              <button
                onClick={handleShareX}
                className="flex items-center gap-2 h-11 px-4 border border-white/20 rounded-xl bg-white/5 hover:bg-white/10 text-[#F2F4F7] font-bold text-[13px] cursor-pointer transition-all"
              >
                Post on X
              </button>
              <button
                onClick={handleCopyLink}
                className="flex items-center gap-2 h-11 px-4 border border-white/20 rounded-xl bg-white/5 hover:bg-white/10 text-[#F2F4F7] font-bold text-[13px] cursor-pointer transition-all"
              >
                {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Link Copied ✓' : 'Copy Link'}</span>
              </button>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="relative grid grid-cols-2 sm:grid-cols-4 border-t border-white/10">
            {[
              { value: questsCount, label: 'QUESTS COMPLETED' },
              { value: badgesCount, label: 'BADGES EARNED' },
              { value: missionContributionsCount, label: 'MISSION CONTRIBUTIONS' },
              { value: attendanceRateVal, label: 'MEETING ATTENDANCE' },
            ].map((st, idx) => (
              <div
                key={idx}
                className="py-4 px-6 border-b sm:border-b-0 border-white/10 sm:border-r last:border-r-0"
              >
                <div className="font-mono text-2xl font-semibold text-white leading-tight">
                  {st.value}
                </div>
                <div className="text-[10px] font-bold tracking-wider text-[#8A93A0] mt-1">
                  {st.label}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Web Fundamentals Certification Score */}
        {profile.quiz_attempts && profile.quiz_attempts.length > 0 && profile.quiz_attempts[0].score !== undefined && (
          <section className="mt-7">
            <QuizScoreBadge
              score={profile.quiz_attempts[0].score}
              badgeName={profile.quiz_attempts[0].badge_awarded?.name}
              rarity={profile.quiz_attempts[0].badge_awarded?.rarity}
              completedAt={profile.quiz_attempts[0].completed_at}
              variant="spotlight"
            />
          </section>
        )}

        {/* Peer titles: earned from teammates. Tier only, never who or why. */}
        {peerTitles.length > 0 && (
          <section className="mt-7">
            <div className="flex items-baseline justify-between gap-4 mb-4">
              <h2 className="text-xl font-extrabold tracking-tight m-0 flex items-center gap-2">
                <HeartHandshake className="w-5 h-5 text-[#E5007D]" />
                <span>Recognised by teammates</span>
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {[...peerTitles]
                .sort((a: any, b: any) => compareByRarity(a.rarity, b.rarity))
                .map((t: any) => (
                  <PeerTitleCard key={t.category} title={t} />
                ))}
            </div>
          </section>
        )}

        {/* Badges Earned Section */}
        <section className="mt-7">
          <div className="flex items-baseline justify-between gap-4 mb-4">
            <h2 className="text-xl font-extrabold tracking-tight m-0 flex items-center gap-2">
              <Award className="w-5 h-5 text-[#E5007D]" />
              <span>Badges & Accomplishments</span>
            </h2>
            <span className="text-xs font-semibold text-[#8A93A0]">
              {badgesCount} badge{badgesCount === 1 ? '' : 's'} {rareBadgesCount > 0 && `· ${rareBadgesCount} rare / epic`}
            </span>
          </div>

          {profile.cube_badges && profile.cube_badges.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {[...profile.cube_badges]
                .sort((a: any, b: any) => compareByRarity(a.badge?.rarity, b.badge?.rarity))
                .map((award: any) => {
                  const meta = getRarityMeta(award.badge?.rarity);
                  const isEpic = meta.key === 'Epic';

                  return (
                    <div
                      key={award.id}
                      className={`group relative ${meta.frame} transition-transform duration-300 hover:scale-[1.02]`}
                      title={award.reason || award.badge?.name}
                    >
                      {isEpic && <span className="badge-sheen" />}
                      {isEpic && <BadgeSparks />}
                      <div className={`relative ${meta.surface} p-4 flex flex-col items-center text-center gap-2.5 h-full justify-between`}>
                        <div className="flex flex-col items-center text-center gap-2 w-full">
                          <BadgeDisc icon={award.badge?.icon} rarity={award.badge?.rarity} size="md" />
                          <div className="w-full">
                            <h4 className={`font-bold text-xs leading-tight line-clamp-1 ${meta.title}`}>
                              {award.badge?.name}
                            </h4>
                            <p className={`text-[9px] mt-1 uppercase tracking-wider line-clamp-1 ${meta.muted}`}>
                              {award.mission ? award.mission.title : 'General Award'}
                            </p>
                          </div>
                          <RarityPill rarity={award.badge?.rarity} />
                        </div>
                        {award.reason ? (
                          <p className={`text-[10px] font-semibold line-clamp-2 italic ${meta.body}`}>
                            "{award.reason}"
                          </p>
                        ) : (
                          <p className={`text-[10px] font-medium line-clamp-2 ${meta.body}`}>
                            {award.badge?.description || 'Fellowship achievement'}
                          </p>
                        )}
                        <div className={`w-full pt-2 border-t text-[9.5px] font-mono ${meta.divider} ${meta.muted}`}>
                          {new Date(award.awarded_at || award.created_at).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          ) : (
            <div className="p-8 text-center bg-white rounded-2xl border border-dashed border-gray-200 text-gray-400 text-xs font-semibold">
              No badges awarded yet.
            </div>
          )}
        </section>

        {/* Dual Grid: Completed Quests & Certificate Showcase */}
        <section className="mt-7 grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
          {/* Completed Quests Column */}
          <div>
            <div className="flex items-baseline justify-between gap-4 mb-3.5">
              <h2 className="text-xl font-extrabold tracking-tight m-0 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-500" />
                <span>Completed Quests</span>
              </h2>
              <span className="text-xs font-semibold text-[#8A93A0]">
                {questsCount} quest{questsCount === 1 ? '' : 's'}
              </span>
            </div>

            {profile.cube_quests && profile.cube_quests.length > 0 ? (
              <div className="flex flex-col gap-3.5">
                {profile.cube_quests.map((cq: any) => {
                  const isEpic = cq.quest?.difficulty === 'Epic';
                  const isRare = cq.quest?.difficulty === 'Rare';
                  const borderClass = isEpic
                    ? 'border-[#E5007D]/40 shadow-sm shadow-[#E5007D]/5 bg-slate-950 text-white'
                    : isRare
                    ? 'border-sky-200 bg-sky-50/20'
                    : 'border-slate-200/80 bg-white';

                  const badgeMeta = isEpic
                    ? 'bg-[#E5007D] text-white'
                    : isRare
                    ? 'bg-sky-50 text-sky-700 border border-sky-200'
                    : 'bg-slate-100 text-slate-600 border border-slate-200';

                  return (
                    <div
                      key={cq.id}
                      className={`border rounded-2xl p-4 flex flex-col justify-between gap-3 transition-transform duration-200 hover:scale-[1.01] ${borderClass}`}
                    >
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className={`font-extrabold text-sm leading-snug ${isEpic ? 'text-white' : 'text-[#11151C]'}`}>
                            {cq.quest?.title}
                          </h4>
                          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${badgeMeta}`}>
                            {cq.quest?.difficulty}
                          </span>
                        </div>
                        <p className={`text-xs ${isEpic ? 'text-slate-300' : 'text-slate-500'} leading-relaxed`}>
                          {cq.quest?.description}
                        </p>
                      </div>

                      <div className={`flex items-center justify-between gap-2 border-t pt-2.5 ${isEpic ? 'border-white/10' : 'border-slate-100'}`}>
                        <div className="flex flex-wrap gap-1.5">
                          {cq.quest?.rewards?.map((b: any) => (
                            <span
                              key={b.id}
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[9.5px] font-extrabold ${
                                isEpic ? 'bg-slate-900 border border-slate-800 text-[#FF7CC0]' : 'bg-slate-50 border border-slate-200 text-slate-700'
                              }`}
                            >
                              🏆 {b.name}
                            </span>
                          ))}
                        </div>
                        {(cq.completed_at || cq.created_at) && (
                          <span className="text-[10px] font-mono font-medium text-slate-400">
                            Unlocked: {new Date(cq.completed_at || cq.created_at).toLocaleDateString('en-GB', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 text-center bg-white rounded-2xl border border-dashed border-gray-200 text-gray-400 text-xs font-semibold">
                No completed quests recorded yet.
              </div>
            )}
          </div>

          {/* Certificate Column */}
          <div>
            <h2 className="text-xl font-extrabold tracking-tight mb-3.5">Certificate</h2>
            <div className="bg-white border border-[#E7E9EE] rounded-2xl overflow-hidden">
              {isAlumni ? (
                <>
                  {/* Real Certificate Preview */}
                  <div className="p-4 pb-0">
                    <ScaledCertificatePreview
                      name={name}
                      cubeNumber={profile.cube_number}
                      mentorName={mentorName}
                      type={offboarding.type}
                      certificateNo={offboarding.certificate_no}
                      issueDate={offboarding.issue_date}
                      stats={{
                        questsCount,
                        badgesCount,
                        missionContributionsCount,
                        attendanceRate: stats?.attendanceRate,
                      }}
                      badges={(profile.cube_badges || []).map((b: any) => ({
                        id: b.id,
                        name: b.badge?.name || 'Badge',
                      }))}
                    />
                  </div>

                  {/* Certificate Meta & Actions */}
                  <div className="p-4">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-[#6B7480]">Certificate No</span>
                      <span className="font-mono font-bold text-[#11151C]">{offboarding.certificate_no}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-xs mt-1.5">
                      <span className="text-[#6B7480]">Issued</span>
                      <span className="font-bold">
                        {new Date(offboarding.issue_date).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })}
                      </span>
                    </div>

                    <div className="flex gap-2.5 mt-3.5">
                      <Link
                        to={`/offboarding/certificate/${profile.id}?download=true`}
                        target="_blank"
                        className="flex-1 flex items-center justify-center h-10 rounded-xl bg-[#11151C] hover:bg-black text-white text-xs font-bold transition-colors"
                      >
                        Download PDF
                      </Link>
                      <Link
                        to={`/verify/${offboarding.certificate_no}`}
                        className="flex-1 flex items-center justify-center h-10 rounded-xl border border-[#E1E4EA] hover:border-gray-400 text-[#4A5361] text-xs font-bold transition-colors"
                      >
                        Verify ↗
                      </Link>
                    </div>
                  </div>
                </>
              ) : (
                /* Ongoing Fellowship Journey (Active Cube) */
                <div className="p-6 text-center flex flex-col items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto">
                    <Award className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-[#11151C]">Fellowship Journey in Progress</h3>
                    <p className="text-xs text-[#6B7480] max-w-xs mx-auto mt-1 leading-relaxed">
                      Currently active in the Iceberg X Fellowship programme. Offboarding certificate and verified achievement appendix will be awarded upon graduation.
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 text-[#4A5361] text-[11px] font-bold">
                    <span>Level: {profile.current_level}</span>
                    <span>·</span>
                    <span>Mentor: {mentorName}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Mission Contributions list */}
            {missions.length > 0 && (
              <div className="mt-4 p-4 bg-white border border-[#E7E9EE] rounded-2xl">
                <div className="text-[11px] font-extrabold tracking-wider text-[#8A93A0] mb-2">
                  MISSION CONTRIBUTIONS
                </div>
                <div className="divide-y divide-[#F1F3F6]">
                  {missions.map((m: any, idx: number) => (
                    <div key={idx} className="flex items-baseline justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                      <span className="text-xs font-bold text-[#11151C] truncate">{m.title}</span>
                      <span className="text-[10.5px] font-bold text-[#8A93A0] flex-none uppercase">
                        {m.role || 'Contributor'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Technical Skills & Areas of Interest */}
        <section className="mt-7 bg-white border border-[#E7E9EE] rounded-2xl p-6 shadow-subtle">
          <div className="flex items-center gap-2 mb-5">
            <Sparkles className="w-5 h-5 text-[#E5007D]" />
            <h2 className="text-xl font-extrabold tracking-tight m-0 text-[#11151C]">
              Skills &amp; Interests
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Technical Skills */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Code2 className="w-4 h-4 text-[#E5007D]" />
                <h3 className="font-extrabold text-xs text-[#8A93A0] uppercase tracking-wider">
                  Technical Skills
                </h3>
                {profile.skills && profile.skills.length > 0 && (
                  <span className="text-[11px] font-mono font-bold text-[#8A93A0]">
                    ({profile.skills.length})
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {profile.skills && profile.skills.length > 0 ? (
                  profile.skills.map((skill: string) => (
                    <span
                      key={skill}
                      className="bg-[#E5007D]/5 border border-[#E5007D]/15 text-[#E5007D] font-bold text-xs px-3 py-1.5 rounded-xl hover:bg-[#E5007D]/10 transition-colors"
                    >
                      {skill}
                    </span>
                  ))
                ) : (
                  <p className="text-xs text-[#8A93A0] italic m-0">No technical skills listed.</p>
                )}
              </div>
            </div>

            {/* Areas of Interest */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-[#0E7C86]" />
                <h3 className="font-extrabold text-xs text-[#8A93A0] uppercase tracking-wider">
                  Areas of Interest
                </h3>
                {profile.interests && profile.interests.length > 0 && (
                  <span className="text-[11px] font-mono font-bold text-[#8A93A0]">
                    ({profile.interests.length})
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {profile.interests && profile.interests.length > 0 ? (
                  profile.interests.map((interest: string) => (
                    <span
                      key={interest}
                      className="bg-slate-100 border border-slate-200 text-slate-700 font-semibold text-xs px-3 py-1.5 rounded-xl hover:bg-slate-200 transition-colors"
                    >
                      {interest}
                    </span>
                  ))
                ) : (
                  <p className="text-xs text-[#8A93A0] italic m-0">No areas of interest listed.</p>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="flex flex-wrap items-center justify-between gap-3.5 mt-8 pt-5 border-t border-[#E1E4EA]">
          <span className="text-xs font-bold tracking-wider text-[#8A93A0]">
            ONCE A CUBE, ALWAYS A CUBE
          </span>
          <span className="font-mono text-xs text-[#9AA2AE]">
            iceberg.digital/x/{profile.cube_number} · verified by the Iceberg X Fellowship portal
          </span>
        </footer>
      </main>
    </div>
  );
};
