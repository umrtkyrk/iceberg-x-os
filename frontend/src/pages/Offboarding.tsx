import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { Link, useNavigate } from 'react-router-dom';
import {
  GraduationCap,
  Award,
  FileText,
  ArrowRight,
  Check,
  X,
  ShieldAlert,
  Search,
  Printer,
  RotateCcw,
  Mail,
  Copy,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { certificateTypesFor } from '../utils/cubeStatus';
import { ScaledCertificatePreview } from '../components/CertificateSheet';

export const Offboarding: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [cubes, setCubes] = useState<any[]>([]);
  const [alumni, setAlumni] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');

  // Selection & Configuration
  const [selectedCube, setSelectedCube] = useState<any | null>(null);
  const [targetLevel, setTargetLevel] = useState<string>('Alumni');
  const [certType, setCertType] = useState<'success' | 'participation'>('success');
  const [mentorName, setMentorName] = useState(user?.name || '');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [stats, setStats] = useState<{
    completedMissions: number;
    badgesEarned: number;
    attendanceRate: number | null;
  } | null>(null);

  // Email Drafts
  const [emailTr, setEmailTr] = useState('');
  const [emailEn, setEmailEn] = useState('');
  const [activeLangTab, setActiveLangTab] = useState<'en' | 'tr'>('en');
  const [submitting, setSubmitting] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);

  // Modals
  const [showLargePreview, setShowLargePreview] = useState(false);
  const [viewingAlumni, setViewingAlumni] = useState<any | null>(null);
  const [revertingAlumni, setRevertingAlumni] = useState<any | null>(null);
  const [revertLevel, setRevertLevel] = useState<string>('Cube');
  const [revertSubmitting, setRevertSubmitting] = useState(false);
  const [selectedCubeBadges, setSelectedCubeBadges] = useState<any[]>([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [eligible, offboarded] = await Promise.all([
        api.get('/offboarding/eligible'),
        api.get('/offboarding/alumni'),
      ]);
      setCubes(eligible);
      setAlumni(offboarded);
      if (eligible.length > 0 && !selectedCube) {
        setSelectedCube(eligible[0]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch offboarding data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Sync available cert types with target level
  const availableCertTypes = certificateTypesFor(targetLevel);
  useEffect(() => {
    if (!availableCertTypes.includes(certType)) {
      setCertType(availableCertTypes[0] || 'participation');
    }
  }, [targetLevel]);

  // Sync mentor name when Cube selected
  useEffect(() => {
    if (selectedCube) {
      if (selectedCube.assigned_mentor?.name) {
        setMentorName(selectedCube.assigned_mentor.name);
      } else {
        setMentorName(user?.name || 'Ahmet Onur Solmaz');
      }
    }
  }, [selectedCube, user]);

  // Load stats and generate dynamic email drafts
  useEffect(() => {
    if (!selectedCube) {
      setStats(null);
      setSelectedCubeBadges([]);
      setEmailTr('');
      setEmailEn('');
      return;
    }

    const loadStatsAndDrafts = async () => {
      setPreviewLoading(true);
      try {
        let completedMissions = 0;
        let badgesEarned = 0;
        let attendanceRate: number | null = null;

        const [statsRes, pubRes] = await Promise.all([
          api.get(`/offboarding/stats/${selectedCube.id}`).catch(() => null),
          api.get(`/cubes/public/${selectedCube.id}`).catch(() => null),
        ]);

        if (statsRes) {
          completedMissions = statsRes.completedMissions ?? 0;
          badgesEarned = statsRes.badgesEarned ?? 0;
          attendanceRate = statsRes.attendanceRate ?? null;
          setStats(statsRes);
        }

        if (pubRes?.profile?.cube_badges) {
          setSelectedCubeBadges(
            pubRes.profile.cube_badges.map((b: any) => ({
              id: b.id,
              name: b.badge?.name || 'Badge',
            }))
          );
        } else {
          setSelectedCubeBadges([]);
        }

        const cubeNo = selectedCube.cube_number;
        const studentName = selectedCube.user?.name || 'Cube Fellow';
        const currentYear = new Date().getFullYear();
        const estimatedCertNo = `ICE-${currentYear}-${cubeNo.padStart(6, '0')}`;
        const attendanceLineEn = attendanceRate !== null ? `• Attended ${attendanceRate}% of invited meetings.\n` : '';
        const attendanceLineTr = attendanceRate !== null ? `• Toplantılara katılım oranınız %${attendanceRate} olarak gerçekleşti.\n` : '';

        if (certType === 'success') {
          setEmailEn(
`Dear ${studentName},

You have successfully completed your fellowship journey as Cube #${cubeNo} in the Iceberg Digital Technology Fellowship, and have now transitioned to Alumni status.

Over the course of the programme you:
• Completed ${completedMissions} mission milestones.
• Earned ${badgesEarned} technical and competency badges.
${attendanceLineEn}
Your Certificate of Achievement (${estimatedCertNo}) has been issued and can be shared publicly from your profile.

Once a Cube, always a Cube.

Best regards,
Iceberg Digital Team`
          );

          setEmailTr(
`Sayın ${studentName},

Iceberg Digital Teknoloji Fellowship programındaki Cube #${cubeNo} kodlu staj programınızı başarıyla tamamlayarak Alumni statüsüne geçmiş bulunuyorsunuz.

Programınız boyunca:
• ${completedMissions} görev adımını başarıyla tamamladınız.
• ${badgesEarned} teknik ve yetkinlik rozeti kazandınız.
${attendanceLineTr}
Başarı sertifikanız (${estimatedCertNo}) hazırlanmış olup profilinizden herkese açık olarak paylaşılabilir.

Once a Cube, always a Cube.

Saygılarımızla,
Iceberg Digital Ekibi`
          );
        } else {
          setEmailEn(
`Dear ${studentName},

Thank you for participating in the Iceberg Digital Technology Fellowship programme as Cube #${cubeNo}.

During your time in the fellowship you worked on engineering challenges and contributed to our technology team. Your Certificate of Participation (${estimatedCertNo}) has been issued and can be viewed on your profile.

We wish you all the best in your career.

Once a Cube, always a Cube.

Best regards,
Iceberg Digital Team`
          );

          setEmailTr(
`Sayın ${studentName},

Iceberg Digital Teknoloji Fellowship programımıza Cube #${cubeNo} olarak katılım gösterdiğiniz için teşekkür ederiz.

Program sürecindeki katkılarınız için teşekkür eder, kariyerinizde başarılar dileriz. Katılım sertifikanız (${estimatedCertNo}) profilinize eklenmiştir.

Once a Cube, always a Cube.

Saygılarımızla,
Iceberg Digital Ekibi`
          );
        }
      } catch (err: any) {
        console.error('Failed to load stats for offboarding:', err);
      } finally {
        setPreviewLoading(false);
      }
    };

    loadStatsAndDrafts();
  }, [selectedCube, certType]);

  const handleConfirmOffboarding = async () => {
    if (!selectedCube || !mentorName || !emailTr || !emailEn) {
      alert('Please ensure mentor name and email templates are complete.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/offboarding', {
        cubeProfileId: selectedCube.id,
        type: certType,
        mentorName,
        emailTextTr: emailTr,
        emailTextEn: emailEn,
        targetLevel,
      });
      alert(`Cube #${selectedCube.cube_number} has been successfully offboarded!`);
      setSelectedCube(null);
      await fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to offboard Cube');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmRevert = async () => {
    if (!revertingAlumni) return;
    setRevertSubmitting(true);
    try {
      await api.post('/offboarding/revert', {
        cubeProfileId: revertingAlumni.id,
        targetLevel: revertLevel,
      });
      alert(`Offboarding successfully reverted. Cube restored as ${revertLevel}.`);
      setRevertingAlumni(null);
      await fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to revert offboarding');
    } finally {
      setRevertSubmitting(false);
    }
  };

  const filteredQueue = cubes.filter((c) => {
    const q = searchQuery.toLowerCase();
    const cubeNum = (c.cube_number || '').toLowerCase();
    const name = (c.user?.name || '').toLowerCase();
    const cohort = (c.cohort || '').toLowerCase();
    return cubeNum.includes(q) || name.includes(q) || cohort.includes(q);
  });

  const estimatedCertNo = selectedCube
    ? `ICE-${new Date().getFullYear()}-${selectedCube.cube_number.padStart(6, '0')}`
    : 'ICE-2026-000000';

  if (loading) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#E5007D] border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F5F7] text-[#11151C] font-sans pb-16">
      <main className="w-full">
        {/* Page Header */}
        <div className="workspace-header">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight m-0">
              Offboarding &amp; Alumni
            </h1>
            <p className="text-sm text-[#6B7480] mt-1.5 mb-0 max-w-xl">
              Graduate a Cube, issue its certificate, and send the outreach email — in one pass.
            </p>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <div className="font-mono text-2xl font-semibold text-white">{cubes.length}</div>
              <div className="text-[10px] font-bold tracking-wider text-[#8A93A0]">IN QUEUE</div>
            </div>
            <div className="w-[1px] h-8 bg-[#E1E4EA]" />
            <div className="text-right">
              <div className="font-mono text-2xl font-semibold text-[#E5007D]">{alumni.length}</div>
              <div className="text-[10px] font-bold tracking-wider text-[#8A93A0]">ALUMNI</div>
            </div>
          </div>
        </div>

        {/* 2-Column Split: Queue (Left) & Configuration Workspace (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-[340px_minmax(0,1fr)] gap-6 mt-6 items-start">
          
          {/* Left Column: Offboarding Queue Sidebar */}
          <aside className="bg-white border border-[#E7E9EE] rounded-2xl overflow-hidden sticky top-6">
            <div className="p-4 border-b border-[#EEF0F3]">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-extrabold tracking-wider text-[#8A93A0]">
                  OFFBOARDING QUEUE
                </span>
                <span className="font-mono text-xs text-[#9AA2AE]">{cubes.length}</span>
              </div>
              <div className="flex items-center gap-2 px-3 h-10 bg-[#F4F5F7] rounded-xl">
                <Search className="w-4 h-4 text-[#9AA2AE]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search Cube or name…"
                  className="border-none outline-none bg-transparent text-xs text-[#11151C] w-full font-medium"
                />
              </div>
            </div>

            <div className="max-h-[560px] overflow-y-auto divide-y divide-[#F1F3F6]">
              {filteredQueue.map((c) => {
                const isSelected = selectedCube?.id === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCube(c)}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 border-none text-left cursor-pointer transition-colors ${
                      isSelected ? 'bg-[#FFF5FA]' : 'bg-transparent hover:bg-[#F8F9FB]'
                    }`}
                  >
                    <span
                      className={`w-9 h-9 flex-none rounded-full flex items-center justify-center font-mono text-xs font-semibold ${
                        isSelected ? 'bg-[#E5007D] text-white' : 'bg-[#F4F5F7] text-[#6B7480]'
                      }`}
                    >
                      #{c.cube_number}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-[#11151C] truncate">
                        {c.user?.name || `Cube #${c.cube_number}`}
                      </span>
                      <span className="block text-[10.5px] font-bold tracking-wide text-[#9AA2AE] mt-0.5 uppercase truncate">
                        {c.cohort || 'Fellowship'}
                      </span>
                    </span>
                    <span
                      className={`text-sm font-bold flex-none ${
                        isSelected ? 'text-[#E5007D]' : 'text-[#C9CED8]'
                      }`}
                    >
                      →
                    </span>
                  </button>
                );
              })}
              {filteredQueue.length === 0 && (
                <div className="p-8 text-center text-xs text-gray-400 font-medium">
                  No Cubes match your search.
                </div>
              )}
            </div>
          </aside>

          {/* Right Column: Configuration & Actions */}
          <section className="flex flex-col gap-6 min-w-0">
            {selectedCube ? (
              <div className="bg-white border border-[#E7E9EE] rounded-2xl overflow-hidden shadow-sm">
                
                {/* Selected Candidate Header Banner */}
                <div className="flex items-center gap-4 p-5 bg-[#FCFCFD] border-b border-[#EEF0F3] flex-wrap">
                  <div className="w-11 h-11 rounded-full bg-[#E5007D] text-white flex items-center justify-center font-mono text-sm font-bold flex-none shadow-md shadow-[#E5007D]/20">
                    #{selectedCube.cube_number}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-lg font-extrabold tracking-tight">
                      {selectedCube.user?.name}
                    </div>
                    <div className="text-xs text-[#6B7480] mt-0.5">
                      {selectedCube.cohort || 'Founding Cohort'} · joined {new Date(selectedCube.created_at).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center h-7 px-3 rounded-lg bg-[#F4F5F7] text-xs font-bold text-[#4A5361]">
                      {stats?.completedMissions ?? 0} missions
                    </span>
                    <span className="inline-flex items-center h-7 px-3 rounded-lg bg-[#F4F5F7] text-xs font-bold text-[#4A5361]">
                      {stats?.badgesEarned ?? 0} badges
                    </span>
                    <span className="inline-flex items-center h-7 px-3 rounded-lg bg-[#FDE7F3] text-xs font-bold text-[#B80064]">
                      {stats?.attendanceRate !== null && stats?.attendanceRate !== undefined ? `${stats.attendanceRate}%` : '100%'} attendance
                    </span>
                  </div>
                </div>

                {/* 3-Step Configuration Row */}
                <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6 border-b border-[#EEF0F3]">
                  
                  {/* Step 1: Target Status */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-4 h-4 rounded-full bg-[#11151C] text-white text-[10px] font-bold flex items-center justify-center">
                        1
                      </span>
                      <span className="text-[11px] font-extrabold tracking-wider text-[#4A5361]">
                        TARGET STATUS
                      </span>
                    </div>
                    <div className="relative">
                      <select
                        value={targetLevel}
                        onChange={(e) => setTargetLevel(e.target.value)}
                        className="w-full h-11 px-3.5 pr-8 border border-[#E1E4EA] rounded-xl bg-white text-xs font-bold text-[#11151C] cursor-pointer appearance-none outline-none focus:border-[#E5007D]"
                      >
                        <option value="Alumni">Alumni — completed programme</option>
                        <option value="Iceberger">Iceberger — hired into team</option>
                        <option value="Former_Cube">Former Cube — left early</option>
                      </select>
                      <span className="absolute right-3.5 top-3.5 text-gray-400 pointer-events-none text-xs">
                        ▾
                      </span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-[#8A93A0] mt-2 mb-0">
                      Graduating Cubes receive an achievement or participation certificate.
                    </p>
                  </div>

                  {/* Step 2: Certificate Type */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-4 h-4 rounded-full bg-[#11151C] text-white text-[10px] font-bold flex items-center justify-center">
                        2
                      </span>
                      <span className="text-[11px] font-extrabold tracking-wider text-[#4A5361]">
                        CERTIFICATE TYPE
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => setCertType('success')}
                        disabled={!availableCertTypes.includes('success')}
                        className={`p-2.5 rounded-xl text-left border cursor-pointer transition-all ${
                          certType === 'success'
                            ? 'border-[#E5007D] bg-[#FFF5FA]'
                            : 'border-[#E1E4EA] bg-white hover:border-gray-300'
                        } ${!availableCertTypes.includes('success') ? 'opacity-40 cursor-not-allowed' : ''}`}
                      >
                        <span className="block text-xs font-bold text-[#11151C]">Achievement</span>
                        <span className="block text-[10px] text-[#6B7480] mt-1 leading-snug">
                          Outstanding · gold
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setCertType('participation')}
                        className={`p-2.5 rounded-xl text-left border cursor-pointer transition-all ${
                          certType === 'participation'
                            ? 'border-[#E5007D] bg-[#FFF5FA]'
                            : 'border-[#E1E4EA] bg-white hover:border-gray-300'
                        }`}
                      >
                        <span className="block text-xs font-bold text-[#11151C]">Participation</span>
                        <span className="block text-[10px] text-[#6B7480] mt-1 leading-snug">
                          Programme · light
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Step 3: Programme Mentor */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-4 h-4 rounded-full bg-[#11151C] text-white text-[10px] font-bold flex items-center justify-center">
                        3
                      </span>
                      <span className="text-[11px] font-extrabold tracking-wider text-[#4A5361]">
                        PROGRAMME MENTOR
                      </span>
                    </div>
                    <input
                      type="text"
                      value={mentorName}
                      onChange={(e) => setMentorName(e.target.value)}
                      placeholder="e.g. Ahmet Onur Solmaz"
                      className="w-full h-11 px-3.5 border border-[#E1E4EA] rounded-xl text-xs font-bold text-[#11151C] outline-none focus:border-[#E5007D]"
                    />
                    <p className="text-[11px] leading-relaxed text-[#8A93A0] mt-2 mb-0">
                      Printed under the Cube's name and on the signature row.
                    </p>
                  </div>
                </div>

                {/* Live Preview Dual Section */}
                <div className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-[11px] font-extrabold tracking-wider text-[#4A5361]">
                      LIVE PREVIEW
                    </span>
                    <span className="flex-1 h-[1px] bg-[#EEF0F3]" />
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    
                    {/* Left Sub-card: Live Mini Certificate */}
                    <div className="border border-[#E7E9EE] rounded-2xl overflow-hidden flex flex-col">
                      <div className="flex items-center justify-between px-4 py-2.5 bg-[#FCFCFD] border-b border-[#EEF0F3]">
                        <span className="text-[10.5px] font-extrabold tracking-wider text-[#8A93A0] uppercase">
                          {certType === 'success' ? 'ACHIEVEMENT CERTIFICATE' : 'PARTICIPATION CERTIFICATE'}
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowLargePreview(true)}
                          className="text-xs font-bold text-[#E5007D] hover:underline bg-transparent border-none cursor-pointer"
                        >
                          Enlarge ↗
                        </button>
                      </div>

                      <div className="p-4 bg-[#F7F8FA] flex items-center justify-center">
                        <ScaledCertificatePreview
                          name={selectedCube.user?.name || ''}
                          cubeNumber={selectedCube.cube_number}
                          mentorName={mentorName}
                          type={certType}
                          certificateNo={estimatedCertNo}
                          stats={{
                            questsCount: stats?.questsCompleted ?? 0,
                            badgesCount: stats?.badgesEarned ?? selectedCubeBadges.length,
                            missionContributionsCount: stats?.completedMissions ?? 0,
                            attendanceRate: stats?.attendanceRate,
                          }}
                          badges={selectedCubeBadges}
                        />
                      </div>
                    </div>

                    {/* Right Sub-card: Outreach Email Editor */}
                    <div className="border border-[#E7E9EE] rounded-2xl overflow-hidden flex flex-col">
                      <div className="flex items-center justify-between px-4 py-2 bg-[#FCFCFD] border-b border-[#EEF0F3]">
                        <span className="text-[10.5px] font-extrabold tracking-wider text-[#8A93A0]">
                          OUTREACH EMAIL
                        </span>
                        <div className="flex bg-[#F1F3F6] p-0.5 rounded-lg">
                          <button
                            type="button"
                            onClick={() => setActiveLangTab('en')}
                            className={`h-6 px-3 border-none rounded-md text-xs font-bold cursor-pointer transition-colors ${
                              activeLangTab === 'en'
                                ? 'bg-white text-[#11151C] shadow-sm'
                                : 'bg-transparent text-[#8A93A0]'
                            }`}
                          >
                            EN
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveLangTab('tr')}
                            className={`h-6 px-3 border-none rounded-md text-xs font-bold cursor-pointer transition-colors ${
                              activeLangTab === 'tr'
                                ? 'bg-white text-[#11151C] shadow-sm'
                                : 'bg-transparent text-[#8A93A0]'
                            }`}
                          >
                            TR
                          </button>
                        </div>
                      </div>

                      <div className="p-3 bg-white flex-1 flex flex-col">
                        <textarea
                          rows={9}
                          value={activeLangTab === 'en' ? emailEn : emailTr}
                          onChange={(e) =>
                            activeLangTab === 'en' ? setEmailEn(e.target.value) : setEmailTr(e.target.value)
                          }
                          className="w-full flex-1 p-2.5 border border-[#E1E4EA] rounded-xl text-xs leading-relaxed text-[#3D4652] outline-none font-sans resize-none focus:border-[#E5007D]"
                        />
                      </div>

                      <div className="flex items-center justify-between px-4 py-2.5 bg-[#FCFCFD] border-t border-[#EEF0F3] text-xs">
                        <span className="text-[#9AA2AE] truncate">
                          To: {selectedCube.user?.email || 'candidate@example.com'}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const text = activeLangTab === 'en' ? emailEn : emailTr;
                            navigator.clipboard.writeText(text);
                            setCopiedEmail(true);
                            setTimeout(() => setCopiedEmail(false), 2000);
                          }}
                          className="text-[#E5007D] font-bold hover:underline bg-transparent border-none cursor-pointer flex items-center gap-1"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>{copiedEmail ? 'Copied ✓' : 'Copy Text'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Bar Footer */}
                <div className="flex items-center justify-between gap-4 p-5 bg-[#FCFCFD] border-t border-[#EEF0F3] flex-wrap">
                  <span className="text-xs text-[#6B7480]">
                    Certificate <strong className="font-mono text-[#11151C] font-semibold">{estimatedCertNo}</strong> will be generated.
                  </span>
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => setSelectedCube(null)}
                      className="h-10 px-4 border border-[#E1E4EA] rounded-xl bg-white text-xs font-bold text-[#4A5361] hover:border-gray-400 cursor-pointer transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={handleConfirmOffboarding}
                      className="h-10 px-5 border-none rounded-xl bg-[#E5007D] hover:bg-[#C90070] text-white text-xs font-bold cursor-pointer transition-all shadow-md shadow-[#E5007D]/25 disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {submitting ? 'Offboarding...' : '✓ Accept & Offboard'}
                    </button>
                  </div>
                </div>

              </div>
            ) : (
              <div className="bg-white border border-[#E7E9EE] rounded-2xl p-12 text-center flex flex-col items-center justify-center gap-3 text-gray-400">
                <GraduationCap className="w-10 h-10 text-gray-300" />
                <div className="text-sm font-bold text-gray-600">No Cube Selected</div>
                <p className="text-xs text-gray-400 max-w-sm m-0">
                  Select a candidate from the queue on the left to review their metrics and issue their certificate.
                </p>
              </div>
            )}

            {/* Alumni Records Table */}
            <div className="bg-white border border-[#E7E9EE] rounded-2xl overflow-hidden shadow-sm">
              <div className="flex items-center justify-between p-5 border-b border-[#EEF0F3]">
                <h3 className="text-base font-extrabold tracking-tight m-0">Alumni Records</h3>
                <span className="font-mono text-xs text-[#9AA2AE]">{alumni.length} issued</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#FCFCFD] border-b border-[#EEF0F3] text-[10px] font-extrabold tracking-wider text-[#9AA2AE] uppercase">
                      <th className="py-3 px-5">CUBE</th>
                      <th className="py-3 px-5">NAME</th>
                      <th className="py-3 px-5">LEFT AS</th>
                      <th className="py-3 px-5">CERTIFICATE NO</th>
                      <th className="py-3 px-5">TYPE</th>
                      <th className="py-3 px-5">MENTOR</th>
                      <th className="py-3 px-5">DATE</th>
                      <th className="py-3 px-5 text-right">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F3F6]">
                    {alumni.map((a) => {
                      const rec = a.offboarding_record;
                      const isAch = rec?.type === 'success' || rec?.type === 'achievement';
                      const dateStr = rec?.issue_date
                        ? new Date(rec.issue_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                        : '-';
                      return (
                        <tr key={a.id} className="hover:bg-[#FCFCFD] transition-colors">
                          <td className="py-3.5 px-5 font-mono font-bold text-[#E5007D]">
                            #{a.cube_number}
                          </td>
                          <td className="py-3.5 px-5 font-bold text-[#11151C]">
                            <Link to={`/x/${a.cube_number}`} className="hover:text-[#E5007D] transition-colors">
                              {a.user?.name}
                            </Link>
                          </td>
                          <td className="py-3.5 px-5">
                            <span className="inline-flex items-center h-6 px-2.5 rounded-md text-[10.5px] font-bold bg-[#E6F6F7] text-[#0E7C86]">
                              {a.current_level}
                            </span>
                          </td>
                          <td className="py-3.5 px-5 font-mono text-[#6B7480]">
                            {rec?.certificate_no || '-'}
                          </td>
                          <td className="py-3.5 px-5">
                            <span
                              className={`inline-flex items-center h-6 px-2.5 rounded-md text-[10.5px] font-bold ${
                                isAch ? 'bg-[#FDF1DF] text-[#B26A00]' : 'bg-[#F1F3F6] text-[#4A5361]'
                              }`}
                            >
                              {isAch ? 'Achievement' : 'Participation'}
                            </span>
                          </td>
                          <td className="py-3.5 px-5 text-[#4A5361]">
                            {rec?.mentor_name || '-'}
                          </td>
                          <td className="py-3.5 px-5 text-[#8A93A0]">
                            {dateStr}
                          </td>
                          <td className="py-3.5 px-5 text-right">
                            <div className="inline-flex items-center gap-1.5 justify-end">
                              <button
                                type="button"
                                onClick={() => setViewingAlumni(a)}
                                title="View Outreach Email"
                                className="h-7 px-2.5 border border-[#E1E4EA] rounded-lg bg-white text-[11px] font-bold text-[#4A5361] hover:border-gray-400 cursor-pointer transition-colors"
                              >
                                Email
                              </button>
                              <Link
                                to={`/offboarding/certificate/${a.id}?download=true`}
                                target="_blank"
                                title="Print / Download PDF"
                                className="inline-flex items-center h-7 px-2.5 border border-[#FBD3E7] rounded-lg bg-[#FFF5FA] text-[11px] font-bold text-[#B80064] hover:bg-[#FDE7F3] transition-colors"
                              >
                                Print
                              </Link>
                              <button
                                type="button"
                                onClick={() => setRevertingAlumni(a)}
                                title="Revert Offboarding Status"
                                className="h-7 px-2 border border-[#E1E4EA] rounded-lg bg-white text-[11px] font-bold text-[#8A93A0] hover:text-red-600 hover:border-red-300 cursor-pointer transition-colors"
                              >
                                Revert
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {alumni.length === 0 && (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-gray-400 text-xs font-semibold">
                          No alumni records found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </section>
        </div>
      </main>

      {/* Enlarge Certificate Modal */}
      {showLargePreview && selectedCube && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-stone-900 border border-stone-800 rounded-2xl max-w-4xl w-full p-6 relative flex flex-col gap-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-stone-800 text-stone-300">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                Full Certificate Preview · Cube #{selectedCube.cube_number}
              </span>
              <button
                type="button"
                onClick={() => setShowLargePreview(false)}
                className="text-stone-400 hover:text-white border-none bg-transparent cursor-pointer p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 bg-stone-950 rounded-xl overflow-hidden flex items-center justify-center">
              <ScaledCertificatePreview
                name={selectedCube.user?.name || ''}
                cubeNumber={selectedCube.cube_number}
                mentorName={mentorName}
                type={certType}
                certificateNo={estimatedCertNo}
                stats={{
                  questsCount: stats?.questsCompleted ?? 0,
                  badgesCount: stats?.badgesEarned ?? selectedCubeBadges.length,
                  missionContributionsCount: stats?.completedMissions ?? 0,
                  attendanceRate: stats?.attendanceRate,
                }}
                badges={selectedCubeBadges}
              />
            </div>
          </div>
        </div>
      )}

      {/* View Outreach Email Modal */}
      {viewingAlumni && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 flex flex-col gap-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <span className="text-sm font-bold text-gray-900">
                Outreach Email · {viewingAlumni.user?.name} (#{viewingAlumni.cube_number})
              </span>
              <button
                type="button"
                onClick={() => setViewingAlumni(null)}
                className="text-gray-400 hover:text-gray-900 border-none bg-transparent cursor-pointer p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl text-xs leading-relaxed text-gray-700 whitespace-pre-line max-h-80 overflow-y-auto font-sans">
              {viewingAlumni.offboarding_record?.email_text_en || viewingAlumni.offboarding_record?.email_text_tr || 'No email draft stored.'}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  const text = viewingAlumni.offboarding_record?.email_text_en || viewingAlumni.offboarding_record?.email_text_tr || '';
                  navigator.clipboard.writeText(text);
                  alert('Email copied to clipboard!');
                }}
                className="h-9 px-4 bg-[#11151C] hover:bg-black text-white text-xs font-bold rounded-xl cursor-pointer transition-colors"
              >
                Copy to Clipboard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Revert Offboarding Modal */}
      {revertingAlumni && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 flex flex-col gap-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <span className="text-sm font-bold text-gray-900">
                Revert Offboarding Status
              </span>
              <button
                type="button"
                onClick={() => setRevertingAlumni(null)}
                className="text-gray-400 hover:text-gray-900 border-none bg-transparent cursor-pointer p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed m-0">
              Reverting will delete the certificate for <strong className="text-gray-900">{revertingAlumni.user?.name} (Cube #{revertingAlumni.cube_number})</strong> and restore them to an active programme level.
            </p>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">
                Restore level to:
              </label>
              <select
                value={revertLevel}
                onChange={(e) => setRevertLevel(e.target.value)}
                className="w-full h-10 px-3 border border-gray-200 rounded-xl text-xs font-bold text-gray-900 outline-none"
              >
                <option value="Cube">Cube (Fellow)</option>
                <option value="Senior_Cube">Senior Cube</option>
                <option value="Iceberger">Iceberger</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setRevertingAlumni(null)}
                className="h-9 px-4 border border-gray-200 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={revertSubmitting}
                onClick={handleConfirmRevert}
                className="h-9 px-4 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl cursor-pointer transition-colors disabled:opacity-50"
              >
                {revertSubmitting ? 'Reverting...' : 'Confirm Revert'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
