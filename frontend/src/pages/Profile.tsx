import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { ShieldAlert, ShieldCheck, Award, Calendar, Sparkles, AlertCircle, Edit, Star, GitBranch, Video, CheckCircle, Camera, GraduationCap, Trash, X, ExternalLink, Clock, Mail, XCircle, FileText } from 'lucide-react';
import { BadgeDisc, RarityPill } from '../components/BadgeMedal';
import { compareByRarity, getRarityMeta } from '../utils/badgeRarity';
import ReactMarkdown from 'react-markdown';
import { RadarChart } from '../components/RadarChart';
import { getAssetUrl } from '../utils/assets';
import { CubeDocumentsManager } from '../components/CubeDocumentsManager';
import { QuizScoreBadge } from '../components/QuizScoreBadge';
import { PeerRecognition } from '../components/peer/PeerRecognition';

const formatExternalUrl = (url: string | null | undefined): string => {
  if (!url) return '';
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
};


export const Profile: React.FC = () => {
  const { id } = useParams<{ id: string }>(); // CubeProfile ID
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarLoadError, setAvatarLoadError] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const getInitials = (name: string) => {
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      setAvatarUploading(true);
      try {
        const res = await api.post(`/cubes/${id}/avatar`, { avatar_base64: base64 });
        setData((prev: any) => ({
          ...prev,
          profile: {
            ...prev.profile,
            avatar_url: res.avatar_url
          }
        }));
        setAvatarLoadError(false);
        await refreshUser();
      } catch (err: any) {
        alert(err.message || 'Failed to upload avatar');
      } finally {
        setAvatarUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // Edit profile states
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editCubeNumber, setEditCubeNumber] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editUni, setEditUni] = useState('');
  const [editDept, setEditDept] = useState('');
  const [editGithub, setEditGithub] = useState('');
  const [editGitlab, setEditGitlab] = useState('');
  const [editLinkedin, setEditLinkedin] = useState('');
  const [editSlack, setEditSlack] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editSkills, setEditSkills] = useState('');
  const [editInterests, setEditInterests] = useState('');
  const [editInternshipStatus, setEditInternshipStatus] = useState('');
  const [editNdaStatus, setEditNdaStatus] = useState<'not_sent' | 'pending' | 'signed' | 'not_signed'>('not_sent');
  const [ndaUpdating, setNdaUpdating] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [parsedAiSummary, setParsedAiSummary] = useState<any>(null);

  // Admin progression states
  const [adminLevel, setAdminLevel] = useState('');
  const [adminMentorId, setAdminMentorId] = useState('');
  const [mentorsList, setMentorsList] = useState<any[]>([]);
  const [mentorSearch, setMentorSearch] = useState('');
  const [adminSubmitting, setAdminSubmitting] = useState(false);
  const [adminSuccess, setAdminSuccess] = useState(false);

  // AI Summary states
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  // Private notes states
  const [privateNotes, setPrivateNotes] = useState<any[]>([]);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteSubject, setNoteSubject] = useState('');
  const [noteText, setNoteText] = useState('');
  const [noteScore, setNoteScore] = useState<string>('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteSubmitting, setNoteSubmitting] = useState(false);

  const fetchProfileData = async () => {
    try {
      const res = await api.get(`/cubes/${id}`);
      setData(res);
      setAvatarLoadError(false);
      
      // Seed edit fields
      setEditName(res.profile.user.name);
      setEditCubeNumber(res.profile.cube_number);
      setEditEmail(res.profile.user.email);
      setEditUni(res.profile.university || '');
      setEditDept(res.profile.department || '');
      setEditGithub(res.profile.github_url || '');
      setEditGitlab(res.profile.gitlab_url || '');
      setEditLinkedin(res.profile.linkedin_url || '');
      setEditSlack(res.profile.slack_handle || '');
      setEditPhone(res.profile.phone_number || '');
      setEditSkills(res.profile.skills?.join(', ') || '');
      setEditInterests(res.profile.interests?.join(', ') || '');
      setEditInternshipStatus(res.profile.internship_status || '');
      setEditNdaStatus(res.profile.nda_status || (res.profile.nda_signed ? 'signed' : 'not_sent'));

      // Seed admin fields
      setAdminLevel(res.profile.current_level);
      setAdminMentorId(res.profile.assigned_mentor_id || '');
    } catch (err: any) {
      setError(err.message || 'Failed to fetch profile data');
    } finally {
      setLoading(false);
    }
  };

  const fetchMentors = async () => {
    try {
      const res = await api.get('/mentors');
      setMentorsList(res);
    } catch (e) {
      console.error('Failed to fetch mentors', e);
    }
  };

  const fetchNotes = async () => {
    try {
      const res = await api.get(`/cubes/${id}/notes`);
      setPrivateNotes(res);
    } catch (err) {
      console.error('Failed to fetch private notes:', err);
    }
  };

  useEffect(() => {
    fetchProfileData();
    if (user?.role === 'ADMIN') {
      fetchMentors();
    }
    if (user?.role === 'ADMIN' || user?.role === 'MENTOR') {
      fetchNotes();
    }
  }, [id, user]);

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditSubmitting(true);

    try {
      const payload: any = {
        name: editName,
        university: editUni,
        department: editDept,
        github_url: editGithub,
        gitlab_url: editGitlab,
        linkedin_url: editLinkedin,
        slack_handle: editSlack,
        phone_number: editPhone,
        skills: editSkills.split(',').map(s => s.trim()).filter(Boolean),
        interests: editInterests.split(',').map(s => s.trim()).filter(Boolean),
        internship_status: editInternshipStatus
      };

      if (user?.role === 'ADMIN') {
        payload.cube_number = editCubeNumber;
        payload.email = editEmail;
      }

      if (user?.role === 'ADMIN' || user?.role === 'MENTOR') {
        payload.nda_status = editNdaStatus;
        payload.nda_signed = editNdaStatus === 'signed';
      }

      const updated = await api.put(`/cubes/${id}`, payload);
      setData((prev: any) => ({
        ...prev,
        profile: {
          ...prev.profile,
          ...updated,
          nda_status: updated.nda_status ?? editNdaStatus,
          nda_signed: updated.nda_signed ?? (editNdaStatus === 'signed'),
          cube_number: user?.role === 'ADMIN' ? editCubeNumber : prev.profile.cube_number,
          user: { 
            ...prev.profile.user, 
            name: editName,
            email: user?.role === 'ADMIN' ? editEmail : prev.profile.user.email
          }
        }
      }));
      setIsEditing(false);
    } catch (err: any) {
      alert(err.message || 'Failed to update profile');
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleUpdateNdaStatus = async (newStatus: 'not_sent' | 'pending' | 'signed' | 'not_signed') => {
    if (!data?.profile) return;
    setNdaUpdating(true);
    try {
      const res = await api.patch(`/cubes/${data.profile.id}/nda`, { nda_status: newStatus });
      const updatedStatus = res.cube?.nda_status ?? newStatus;
      const isSigned = updatedStatus === 'signed';
      setData((prev: any) => ({
        ...prev,
        profile: {
          ...prev.profile,
          nda_status: updatedStatus,
          nda_signed: isSigned,
          nda_signed_at: isSigned ? (res.cube?.nda_signed_at || new Date().toISOString()) : null
        }
      }));
      setEditNdaStatus(updatedStatus);
    } catch (err: any) {
      alert(err.message || 'Failed to update NDA status');
    } finally {
      setNdaUpdating(false);
    }
  };

  const handleDeleteCube = async () => {
    if (!data?.profile?.user_id) return;
    const cubeName = data?.profile?.user?.name || 'this Cube';
    const confirmation = prompt(
      `To permanently delete this Cube (${cubeName}), please type "delete":`
    );
    if (confirmation === null) return;
    if (confirmation.trim().toLowerCase() !== 'delete') {
      alert("Confirmation text mismatch. Deletion cancelled.");
      return;
    }

    try {
      await api.delete(`/admin/users/${data.profile.user_id}`);
      alert("Cube deleted successfully.");
      navigate("/directory");
    } catch (err: any) {
      alert(err.message || "Failed to delete Cube");
    }
  };

  const handleAddNoteClick = () => {
    setNoteSubject('');
    setNoteText('');
    setNoteScore('');
    setEditingNoteId(null);
    setShowNoteModal(true);
  };

  const handleEditNoteClick = (noteObj: any) => {
    setNoteSubject(noteObj.subject);
    setNoteText(noteObj.note);
    setNoteScore(noteObj.score !== null ? noteObj.score.toString() : '');
    setEditingNoteId(noteObj.id);
    setShowNoteModal(true);
  };

  const handleNoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteSubject.trim() || !noteText.trim()) return;
    setNoteSubmitting(true);
    try {
      const payload = {
        subject: noteSubject.trim(),
        note: noteText.trim(),
        score: noteScore ? parseInt(noteScore) : null
      };

      if (editingNoteId) {
        // Edit existing note
        const updated = await api.put(`/cubes/${id}/notes/${editingNoteId}`, payload);
        setPrivateNotes((prev) =>
          prev.map((n) => (n.id === editingNoteId ? updated : n))
        );
      } else {
        // Create new note
        const created = await api.post(`/cubes/${id}/notes`, payload);
        setPrivateNotes((prev) => [created, ...prev]);
      }
      setShowNoteModal(false);
    } catch (err: any) {
      alert(err.message || 'Failed to save note');
    } finally {
      setNoteSubmitting(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!confirm('Are you sure you want to delete this note?')) return;
    try {
      await api.delete(`/cubes/${id}/notes/${noteId}`);
      setPrivateNotes((prev) => prev.filter((n) => n.id !== noteId));
    } catch (err: any) {
      alert(err.message || 'Failed to delete note');
    }
  };

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminSubmitting(true);
    setAdminSuccess(false);

    try {
      const updated = await api.post(`/cubes/${id}/progression`, {
        current_level: adminLevel,
        assigned_mentor_id: adminMentorId || null
      });
      setData((prev: any) => ({
        ...prev,
        profile: {
          ...prev.profile,
          ...updated
        }
      }));
      setAdminSuccess(true);
      setTimeout(() => setAdminSuccess(false), 2000);
    } catch (err: any) {
      alert(err.message || 'Failed to update progression');
    } finally {
      setAdminSubmitting(false);
    }
  };

  const handleFetchAISummary = async () => {
    setAiLoading(true);
    setAiSummary(null);
    setParsedAiSummary(null);
    try {
      const res = await api.get(`/ai/cube-summary/${id}`);
      setAiSummary(res.summary);
      try {
        const parsed = JSON.parse(res.summary);
        setParsedAiSummary(parsed);
      } catch (e) {
        setParsedAiSummary({
          overview: res.summary,
          strengths: [],
          improvements: [],
          nextSteps: ""
        });
      }
    } catch (err: any) {
      alert(err.message || 'Failed to generate AI summary');
    } finally {
      setAiLoading(false);
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
        <span>{error || 'Profile not found'}</span>
      </div>
    );
  }

  const { profile, updates, demoSubmissions, mentorFeedback } = data;
  const isOwner = user?.cubeProfileId === id;
  const isMentorOrAdmin = user?.role === 'ADMIN' || user?.role === 'MENTOR';
  const canEditProfile = isOwner || user?.role === 'ADMIN';
  const canViewDocuments = isOwner || isMentorOrAdmin;

  // Compute meeting attendance stats
  const attendanceList = profile.meeting_attendance || [];
  const totalMeetings = attendanceList.length;
  const attendedMeetings = attendanceList.filter((a: any) => a.attended).length;
  const missedMeetings = totalMeetings - attendedMeetings;
  // null when there is no meeting history yet — showing 100% would be misleading
  const attendanceRate = totalMeetings > 0 ? Math.round((attendedMeetings / totalMeetings) * 100) : null;

  // Calculate average scores for radar chart
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

  if (mentorFeedback && mentorFeedback.length > 0) {
    mentorFeedback.forEach((fb: any) => {
      skillKeys.forEach(k => {
        averageScores[k] += fb[k] || 0;
      });
    });
    skillKeys.forEach(k => {
      averageScores[k] = parseFloat((averageScores[k] / mentorFeedback.length).toFixed(1));
    });
  }

  // Compute category strengths from completed missions
  const completedMissions = profile.team_memberships
    ? profile.team_memberships
        .filter((m: any) => m.team?.mission?.status === 'completed')
        .map((m: any) => m.team.mission)
        .filter(Boolean)
    : [];

  const categoryCounts: { [key: string]: number } = {};
  completedMissions.forEach((m: any) => {
    const cat = m.category || 'General';
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
  });

  const sortedCategories = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]);
  const maxCount = sortedCategories.length > 0 ? sortedCategories[0][1] : 1;


  const isOriginalCube = parseInt(profile.cube_number, 10) === 0;

  if (isOriginalCube) {
    return (
      <div className="max-w-2xl mx-auto p-8 rounded-3xl bg-[#111113] border border-white/10 shadow-[0_30px_70px_rgba(0,0,0,0.25)] text-center relative overflow-hidden flex flex-col items-center gap-6">
        <div className="absolute -right-24 -top-24 w-72 h-72 rounded-full border border-white/5 opacity-40"></div>
        <div className="absolute left-6 bottom-6 text-[12rem] font-black leading-none text-white/[0.02] select-none">X</div>
        
        <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-center text-magenta">
          <ShieldAlert className="w-8 h-8" />
        </div>
        
        <div className="space-y-2">
          <span className="text-magenta text-xs uppercase font-extrabold tracking-[0.25em]">Classified Record</span>
          <h1 className="text-4xl font-black text-white tracking-tight">Cube #{profile.cube_number}</h1>
        </div>
        
        <div className="w-full max-w-md border border-white/10 bg-white/[0.03] p-6 rounded-2xl text-left space-y-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/35">Classification</p>
            <p className="mt-1 text-sm font-extrabold text-white">The Original Cube</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/35">Status</p>
            <span className="mt-1 inline-block rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[10px] font-extrabold uppercase tracking-wide text-emerald-200">
              Active
            </span>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/35">Access Level</p>
            <p className="mt-1 text-xs font-semibold leading-relaxed text-white/60">
              No further information available in this directory.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 1. Calculate Scorecard (Evaluations) Average
  let feedbackScoresSum = 0;
  let feedbackScoresCount = 0;
  if (mentorFeedback && mentorFeedback.length > 0) {
    mentorFeedback.forEach((fb: any) => {
      skillKeys.forEach(k => {
        if (fb[k] !== undefined && fb[k] !== null) {
          feedbackScoresSum += fb[k];
          feedbackScoresCount++;
        }
      });
    });
  }
  const feedbackAverage = feedbackScoresCount > 0 ? (feedbackScoresSum / feedbackScoresCount) : 0;
  const feedbackPercentage = (feedbackAverage / 5) * 100;

  // 2. Calculate Private Notes Average
  let privateScoresSum = 0;
  let privateScoresCount = 0;
  privateNotes.forEach((n: any) => {
    if (n.score !== undefined && n.score !== null) {
      privateScoresSum += n.score;
      privateScoresCount++;
    }
  });
  const privateAverage = privateScoresCount > 0 ? (privateScoresSum / privateScoresCount) : 0;
  const privatePercentage = (privateAverage / 10) * 100;

  // 3. Combined Overall Score
  let combinedPercentage = 0;
  if (feedbackScoresCount > 0 && privateScoresCount > 0) {
    combinedPercentage = (feedbackPercentage + privatePercentage) / 2;
  } else if (feedbackScoresCount > 0) {
    combinedPercentage = feedbackPercentage;
  } else if (privateScoresCount > 0) {
    combinedPercentage = privatePercentage;
  } else {
    combinedPercentage = 0;
  }

  // The overall score is computed on the server (peer feedback included, capped
  // and confidence-weighted). Fall back to the local formula only if absent.
  const serverScore = data?.score;
  const overallPercentage: number =
    serverScore && serverScore.overall !== null && serverScore.overall !== undefined
      ? serverScore.overall
      : combinedPercentage;
  const peerDelta: number = serverScore?.peer?.applied ? serverScore.peer.delta : 0;

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      
      {/* Left Column: Core Info & Admin Controls */}
      <div className="flex flex-col gap-6">
        
        {/* Core Info Card */}
        <div className={`rounded-2xl p-6 flex flex-col gap-5 relative overflow-hidden ${
          profile.is_founding_cube
            ? 'bg-gradient-to-br from-amber-50/20 via-white to-white border-2 border-amber-400/80 shadow-[0_0_15px_rgba(245,158,11,0.08)]'
            : 'bg-white border border-gray-100 shadow-subtle'
        }`}>
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-2">
              {profile.is_founding_cube && (
                <span className="bg-amber-400/10 border border-amber-400/30 text-amber-700 font-extrabold text-xs px-2.5 py-1 rounded-full flex items-center gap-1">
                  <Award className="w-3.5 h-3.5 text-amber-500" />
                  Founding Cube
                </span>
              )}
              <span className={`font-extrabold text-xs px-2.5 py-1 rounded ${
                profile.is_founding_cube
                  ? 'bg-amber-400/10 border border-amber-400/20 text-amber-700'
                  : 'bg-magenta/5 border border-magenta/10 text-magenta'
              }`}>
                Cube #{profile.cube_number}
              </span>
            </div>
            {canEditProfile && (
              <button
                onClick={() => setIsEditing(!isEditing)}
                className="p-1.5 hover:bg-gray-50 border border-gray-100 rounded-lg text-gray-500 hover:text-magenta transition-colors"
                title="Edit profile"
              >
                <Edit className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Avatar Section */}
          <div className="flex justify-center mt-2 relative">
            <div 
              onClick={() => isOwner && fileInputRef.current?.click()}
              className={`w-24 h-24 rounded-full overflow-hidden relative group border-2 ${
                profile.is_founding_cube ? 'border-amber-400' : 'border-magenta/25'
              } shadow-sm ${isOwner ? 'cursor-pointer' : ''}`}
            >
              {profile.avatar_url && !avatarLoadError ? (
                <img 
                  src={getAssetUrl(profile.avatar_url) || ''} 
                  alt={profile.user.name} 
                  className="w-full h-full object-cover"
                  onError={() => setAvatarLoadError(true)}
                />
              ) : (
                <div className={`w-full h-full flex items-center justify-center font-black text-xl ${
                  profile.is_founding_cube 
                    ? 'bg-gradient-to-tr from-amber-400 to-amber-500 text-white' 
                    : 'bg-gradient-to-tr from-magenta to-pink-600 text-white'
                }`}>
                  {getInitials(profile.user.name)}
                </div>
              )}

              {/* Upload Overlay */}
              {isOwner && (
                <div className="absolute inset-0 bg-black/45 rounded-full flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 gap-1 select-none">
                  <Camera className="w-5 h-5 text-white" />
                  <span className="text-[9px] text-white/90 font-bold uppercase tracking-wider">Upload</span>
                </div>
              )}

              {/* Uploading indicator */}
              {avatarUploading && (
                <div className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
            
            {/* Hidden Input */}
            {isOwner && (
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleAvatarChange} 
                accept="image/png, image/jpeg, image/webp" 
                className="hidden" 
              />
            )}
          </div>

          <div>
            <h2 className="text-2xl font-extrabold text-gray-900 leading-snug flex items-center gap-2">
              <span>{profile.user.name}</span>
              {profile.is_founding_cube && <Sparkles className="w-5 h-5 text-amber-500 animate-pulse flex-shrink-0" />}
            </h2>
            <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mt-1">
              {profile.current_level.replace('_', ' ')}
            </p>
            <div className="flex flex-col gap-2 mt-3 w-full">
              {profile.offboarding_record && (
                <Link
                  to={`/offboarding/certificate/${profile.id}`}
                  target="_blank"
                  className="w-full py-2 bg-gradient-to-r from-magenta to-pink-600 text-white font-bold text-[11px] rounded-xl flex items-center justify-center gap-1.5 shadow-md shadow-magenta/15 hover:opacity-95 transition-opacity"
                >
                  <GraduationCap className="w-4 h-4" />
                  <span>View Offboarding Certificate</span>
                </Link>
              )}
              <Link
                to={`/x/${profile.cube_number}`}
                target="_blank"
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-gray-700 font-bold text-[11px] rounded-xl flex items-center justify-center gap-1.5 border border-gray-200 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>View Public Profile ↗</span>
              </Link>
            </div>
          </div>

          <div className="flex flex-col gap-2.5 border-t border-gray-50 pt-4 text-xs text-gray-500 font-medium">
            <p><span className="font-bold text-gray-700">Cohort:</span> {profile.cohort}</p>
            <p><span className="font-bold text-gray-700">University:</span> {profile.university}</p>
            <p><span className="font-bold text-gray-700">Department:</span> {profile.department}</p>
            <p><span className="font-bold text-gray-700">Slack:</span> {profile.slack_handle || 'N/A'}</p>
            <p><span className="font-bold text-gray-700">Phone:</span> {profile.phone_number || 'N/A'}</p>
            {profile.internship_status && (
              <p><span className="font-bold text-gray-700">Current Role:</span> <span className="text-magenta font-semibold">{profile.internship_status}</span></p>
            )}
            <p><span className="font-bold text-gray-700">Current Status:</span> <span className="uppercase text-[10px] font-extrabold bg-gray-100 border border-gray-200/50 px-2 py-0.5 rounded-full text-gray-500">{profile.current_level.replace(/_/g, ' ')}</span></p>
            {profile.assigned_mentor && (
              <p><span className="font-bold text-gray-700">Mentor:</span> {profile.assigned_mentor.name}</p>
            )}
            {canViewDocuments && (
              <div className="flex flex-col gap-1.5 pt-2 border-t border-gray-100/60">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-gray-700 text-xs">NDA Agreement:</span>
                  {(() => {
                    const status = profile.nda_status || (profile.nda_signed ? 'signed' : 'not_sent');
                    if (status === 'signed') {
                      return (
                        <span
                          title={`Signed${profile.nda_signed_at ? ' · ' + new Date(profile.nda_signed_at).toLocaleDateString('en-GB') : ''}`}
                          className="inline-flex items-center gap-1 text-[10px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full"
                        >
                          <ShieldCheck className="w-3 h-3 text-emerald-600 shrink-0" />
                          <span>Signed {profile.nda_signed_at && `· ${new Date(profile.nda_signed_at).toLocaleDateString('en-GB')}`}</span>
                        </span>
                      );
                    }
                    if (status === 'pending') {
                      return (
                        <span
                          title="Sent, pending signature"
                          className="inline-flex items-center gap-1 text-[10px] font-extrabold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full"
                        >
                          <Clock className="w-3 h-3 text-amber-600 shrink-0" />
                          <span>Pending</span>
                        </span>
                      );
                    }
                    if (status === 'not_signed') {
                      return (
                        <span
                          title="Declined / Not signed"
                          className="inline-flex items-center gap-1 text-[10px] font-extrabold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full"
                        >
                          <XCircle className="w-3 h-3 text-rose-600 shrink-0" />
                          <span>Not Signed</span>
                        </span>
                      );
                    }
                    return (
                      <span
                        title="Not sent yet"
                        className="inline-flex items-center gap-1 text-[10px] font-extrabold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full"
                      >
                        <Mail className="w-3 h-3 text-slate-500 shrink-0" />
                        <span>Not Sent</span>
                      </span>
                    );
                  })()}
                </div>

                {isMentorOrAdmin && (
                  <div className="flex items-center justify-between mt-1 pt-1.5 border-t border-dashed border-gray-100">
                    <span className="text-[10.5px] font-bold text-gray-400">Change NDA:</span>
                    <select
                      value={profile.nda_status || (profile.nda_signed ? 'signed' : 'not_sent')}
                      onChange={(e) => handleUpdateNdaStatus(e.target.value as any)}
                      disabled={ndaUpdating}
                      className="text-[11px] font-bold py-1 px-2 bg-gray-50 hover:bg-gray-100/60 border border-gray-200 rounded-lg text-gray-700 outline-none hover:border-magenta cursor-pointer disabled:opacity-50 transition-colors"
                    >
                      <option value="not_sent">✉ Not Sent</option>
                      <option value="pending">⏳ Pending</option>
                      <option value="signed">✓ Signed</option>
                      <option value="not_signed">✕ Not Signed</option>
                    </select>
                  </div>
                )}

                <div className="flex items-center justify-between pt-1.5 border-t border-gray-100/60">
                  <span className="font-bold text-gray-700 text-xs">Documents:</span>
                  <button
                    type="button"
                    onClick={() => {
                      document.getElementById('documents-section')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="inline-flex items-center gap-1 text-[10px] font-extrabold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2 py-0.5 rounded-full transition-colors cursor-pointer"
                    title="View all uploaded documents"
                  >
                    <FileText className="w-3 h-3 text-blue-600 shrink-0" />
                    <span>{profile.documents?.length || 0} files</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2 border-t border-gray-50 pt-4">
            {profile.github_url && (
              <a href={formatExternalUrl(profile.github_url)} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 bg-gray-50 border border-gray-100 text-xs font-semibold rounded-lg hover:text-magenta hover:bg-magenta/5 transition-all">
                GitHub
              </a>
            )}
            {profile.gitlab_url && (
              <a href={formatExternalUrl(profile.gitlab_url)} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 bg-gray-50 border border-gray-100 text-xs font-semibold rounded-lg hover:text-magenta hover:bg-magenta/5 transition-all">
                GitLab
              </a>
            )}
            {profile.linkedin_url && (
              <a href={formatExternalUrl(profile.linkedin_url)} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 bg-gray-50 border border-gray-100 text-xs font-semibold rounded-lg hover:text-magenta hover:bg-magenta/5 transition-all">
                LinkedIn
              </a>
            )}
          </div>

          {/* Evaluate Cube Action for Mentors/Admins */}
          {isMentorOrAdmin && (
            <Link
              to={`/review?cube=${profile.user.id}`}
              className="mt-2 w-full bg-magenta text-white font-bold text-xs py-2.5 px-4 rounded-xl hover:bg-magenta-hover transition text-center flex items-center justify-center gap-1.5 shadow-sm"
            >
              <Star className="w-3.5 h-3.5 fill-current" />
              Evaluate Cube (Scorecard)
            </Link>
          )}

          {/* Meeting Attendance Stats */}
          <div className="border-t border-gray-50 pt-4 flex flex-col gap-2.5">
            <h3 className="font-extrabold text-xs text-gray-700 uppercase tracking-wider">Meeting Attendance</h3>
            <div className="flex justify-between items-center text-xs mt-1">
              <span className="text-gray-500 font-semibold">Attendance Rate:</span>
              <span className={`font-bold px-2 py-0.5 rounded-lg ${
                attendanceRate === null ? 'bg-gray-100 text-gray-500' :
                attendanceRate >= 90 ? 'bg-emerald-50 text-emerald-700' :
                attendanceRate >= 75 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'
              }`}>{attendanceRate === null ? 'No data' : `${attendanceRate}%`}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-gray-500 font-semibold">Attended:</span>
              <span className="font-bold text-gray-800">{attendedMeetings} / {totalMeetings}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-gray-500 font-semibold">Missed Meetings:</span>
              <span className={`font-bold ${missedMeetings > 0 ? 'text-red-600' : 'text-gray-800'}`}>{missedMeetings}</span>
            </div>
            {missedMeetings > 0 && (
              <div className="bg-red-50 border border-red-100 rounded-xl p-3 mt-1.5 flex gap-2 items-start">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div className="flex flex-col gap-0.5">
                  <span className="text-[11px] text-red-800 font-extrabold">Negative Mark Warning</span>
                  <p className="text-[10px] text-red-600 leading-snug font-medium">Has missed {missedMeetings} meeting(s). This is evaluated as negative points on the scorecard.</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Performance Overview (visible ONLY to Mentors/Admins) */}
        {isMentorOrAdmin && (
          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-subtle flex flex-col gap-4">
            <h3 className="font-extrabold text-xs text-gray-700 uppercase tracking-wider">Overall Performance Score</h3>
            
            {/* Combined Circular/Progress Score */}
            <div className="flex items-center gap-4 py-2 border-b border-gray-50 pb-4">
              <div className="relative flex items-center justify-center">
                <div className="w-16 h-16 rounded-full border-4 border-slate-100 flex items-center justify-center bg-slate-50/50">
                  <span className="text-sm font-black text-slate-800">
                    {overallPercentage > 0 ? `${overallPercentage.toFixed(1)}%` : 'N/A'}
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Performance Index</span>
                <p className="text-xs text-gray-600 font-semibold leading-relaxed">
                  Calculated from scorecard reviews and internal private scores
                  {serverScore?.peer?.applied ? ', adjusted by peer recognition.' : '.'}
                </p>
                {serverScore?.peer?.applied && (
                  <p className="text-[10px] font-extrabold text-slate-400">
                    Peers: {peerDelta >= 0 ? '+' : ''}{peerDelta.toFixed(1)} pts · weight {(serverScore.peer.weight * 100).toFixed(0)}%
                  </p>
                )}
              </div>
            </div>

            {/* Sub Averages */}
            <div className="flex flex-col gap-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-500 font-semibold">Scorecard Avg (5 max):</span>
                <span className="font-bold text-gray-800">
                  {feedbackScoresCount > 0 ? `${feedbackAverage.toFixed(2)} / 5 (${feedbackPercentage.toFixed(1)}%)` : 'No reviews'}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-500 font-semibold">Private Notes Avg (10 max):</span>
                <span className="font-bold text-gray-800">
                  {privateScoresCount > 0 ? `${privateAverage.toFixed(2)} / 10 (${privatePercentage.toFixed(1)}%)` : 'No scores'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Edit Form Drawer */}
        {isEditing && (
          <form onSubmit={handleEditSubmit} className="bg-white border border-gray-100 rounded-2xl p-6 shadow-premium flex flex-col gap-4 animate-fadeIn">
            <h3 className="font-extrabold text-sm border-b border-gray-50 pb-2">Edit Public Profile</h3>
            
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase">Name</label>
              <input type="text" value={editName} onChange={e => setEditName(e.target.value)} required className="p-2 border border-gray-100 bg-gray-50 rounded-lg text-xs outline-none focus:border-magenta font-semibold" />
            </div>

            {user?.role === 'ADMIN' && (
              <>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase">Cube Number</label>
                  <input type="text" value={editCubeNumber} onChange={e => setEditCubeNumber(e.target.value)} required className="p-2 border border-gray-100 bg-gray-50 rounded-lg text-xs outline-none focus:border-magenta font-semibold" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase">Login Email Address</label>
                  <input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} required className="p-2 border border-gray-100 bg-gray-50 rounded-lg text-xs outline-none focus:border-magenta font-semibold" />
                </div>
              </>
            )}

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase">University</label>
              <input type="text" value={editUni} onChange={e => setEditUni(e.target.value)} className="p-2 border border-gray-100 bg-gray-50 rounded-lg text-xs outline-none focus:border-magenta font-semibold" />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase">Department</label>
              <input type="text" value={editDept} onChange={e => setEditDept(e.target.value)} className="p-2 border border-gray-100 bg-gray-50 rounded-lg text-xs outline-none focus:border-magenta font-semibold" />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase">GitHub Link</label>
              <input type="url" value={editGithub} onChange={e => setEditGithub(e.target.value)} className="p-2 border border-gray-100 bg-gray-50 rounded-lg text-xs outline-none focus:border-magenta font-semibold" />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase">LinkedIn Link</label>
              <input type="url" value={editLinkedin} onChange={e => setEditLinkedin(e.target.value)} className="p-2 border border-gray-100 bg-gray-50 rounded-lg text-xs outline-none focus:border-magenta font-semibold" />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase">Slack Handle</label>
              <input type="text" value={editSlack} onChange={e => setEditSlack(e.target.value)} className="p-2 border border-gray-100 bg-gray-50 rounded-lg text-xs outline-none focus:border-magenta font-semibold" />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase">Phone Number</label>
              <input type="text" value={editPhone} onChange={e => setEditPhone(e.target.value)} className="p-2 border border-gray-100 bg-gray-50 rounded-lg text-xs outline-none focus:border-magenta font-semibold" />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase">Current Role (e.g., Podcast Editor, Iceberg Consultant)</label>
              <input type="text" value={editInternshipStatus} onChange={e => setEditInternshipStatus(e.target.value)} className="p-2 border border-gray-100 bg-gray-50 rounded-lg text-xs outline-none focus:border-magenta font-semibold" />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase">Skills (comma-separated)</label>
              <textarea value={editSkills} onChange={e => setEditSkills(e.target.value)} rows={2} className="p-2 border border-gray-100 bg-gray-50 rounded-lg text-xs outline-none focus:border-magenta font-semibold resize-none" />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase">Interests (comma-separated)</label>
              <textarea value={editInterests} onChange={e => setEditInterests(e.target.value)} rows={2} className="p-2 border border-gray-100 bg-gray-50 rounded-lg text-xs outline-none focus:border-magenta font-semibold resize-none" />
            </div>

            {isMentorOrAdmin && (
              <div className="flex flex-col gap-1.5 p-3 bg-gray-50 rounded-xl border border-gray-100">
                <label className="text-[10px] font-bold text-gray-500 uppercase">
                  Non-Disclosure Agreement (NDA) Status
                </label>
                <select
                  value={editNdaStatus}
                  onChange={e => setEditNdaStatus(e.target.value as any)}
                  className="p-2 border border-gray-200 bg-white rounded-lg text-xs font-bold text-gray-800 outline-none focus:border-magenta"
                >
                  <option value="not_sent">✉ Not Sent (Henüz gönderilmedi)</option>
                  <option value="pending">⏳ Pending Signature (Gönderildi, imza bekleniyor)</option>
                  <option value="signed">✓ Signed (İmzalandı)</option>
                  <option value="not_signed">✕ Not Signed (İmzalamadı / Reddedildi)</option>
                </select>
              </div>
            )}

            <div className="flex gap-2 justify-end mt-2">
              <button type="button" onClick={() => setIsEditing(false)} className="px-3.5 py-1.5 bg-white border border-gray-200 text-gray-500 font-bold text-xs rounded-lg hover:bg-gray-50">
                Cancel
              </button>
              <button type="submit" disabled={editSubmitting} className="px-4 py-1.5 bg-magenta text-white font-bold text-xs rounded-lg hover:bg-magenta-hover disabled:opacity-70">
                {editSubmitting ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        )}

        {/* Admin progression controls panel */}
        {user?.role === 'ADMIN' && (
          <>
            <form onSubmit={handleAdminSubmit} className="bg-white border border-gray-100 rounded-2xl p-6 shadow-subtle flex flex-col gap-4">
            <h3 className="font-extrabold text-sm border-b border-gray-50 pb-2">Program Administration</h3>

            {adminSuccess && (
              <div className="bg-green-50 text-green-700 text-xs font-semibold p-2.5 rounded-lg border border-green-100">
                Progression levels updated.
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-gray-500 uppercase">Progression Level (Status)</label>
              <select value={adminLevel} onChange={e => setAdminLevel(e.target.value)} className="p-2 bg-gray-50 border border-gray-100 rounded-lg text-xs font-semibold outline-none">
                <option value="Cube">Cube</option>
                <option value="Senior_Cube">Senior Cube</option>
                <option value="Former_Cube">Former Cube</option>
                <option value="Iceberger">Iceberger</option>
                <option value="Alumni">Alumni</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-gray-500 uppercase">Assigned Mentor</label>
              <input
                type="text"
                placeholder="Filter mentors by name..."
                value={mentorSearch}
                onChange={e => setMentorSearch(e.target.value)}
                className="p-1.5 px-2 bg-gray-50 border border-gray-100 rounded-lg text-[10px] outline-none placeholder:text-gray-400 font-semibold"
              />
              <select
                value={adminMentorId}
                onChange={e => setAdminMentorId(e.target.value)}
                className="p-2 bg-gray-50 border border-gray-100 rounded-lg text-xs font-semibold outline-none"
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

            <button type="submit" disabled={adminSubmitting} className="w-full mt-2 py-2 bg-gray-900 text-white font-bold text-xs rounded-xl hover:bg-black transition-colors disabled:opacity-70">
              {adminSubmitting ? 'Updating...' : 'Update Progression'}
            </button>
          </form>

          <div className="bg-red-50/40 border border-red-100 rounded-2xl p-6 flex flex-col gap-4">
            <h3 className="font-extrabold text-sm text-red-700 border-b border-red-100 pb-2">Danger Zone</h3>
            <p className="text-xs text-red-600 leading-relaxed font-semibold">
              Are you sure you want to delete this Cube completely? The Cube's account, profile data, badges, demo submissions, and all other records will be permanently deleted. This action cannot be undone!
            </p>
            <button 
              type="button" 
              onClick={handleDeleteCube}
              className="w-full py-2 bg-red-600 text-white font-bold text-xs rounded-xl hover:bg-red-700 transition flex items-center justify-center gap-1.5 shadow-md shadow-red-600/10"
            >
              <span>Permanently Delete Cube</span>
            </button>
          </div>
        </>
      )}

        {/* AI Progress Summary helper */}
        {isMentorOrAdmin && (
          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-subtle flex flex-col gap-4">
            <h3 className="font-extrabold text-sm border-b border-gray-50 pb-2 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-magenta" />
              <span>AI Progress Helper</span>
            </h3>
            
            <p className="text-xs text-gray-400">Generate a professional progress summary for this Cube based on their profile, scores, and updates history.</p>

            {parsedAiSummary ? (
              <div className="flex flex-col gap-4 animate-fadeIn">
                {parsedAiSummary.noData ? (
                  <div className="bg-slate-50 border border-dashed border-gray-200 p-4 rounded-xl text-xs text-gray-500 font-medium flex flex-col gap-1.5 leading-relaxed">
                    <p className="font-bold text-gray-700 flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 text-amber-500" />
                      <span>Insufficient Activity</span>
                    </p>
                    <p className="text-[11px] text-gray-400 font-semibold">{parsedAiSummary.message}</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    {/* Overview Paragraph */}
                    <div className="markdown-body bg-slate-50/50 border border-gray-100 p-3.5 rounded-xl text-xs text-gray-600 font-semibold leading-relaxed italic">
                      <ReactMarkdown>{parsedAiSummary.overview}</ReactMarkdown>
                    </div>

                    {/* Strengths & Improvements Lists */}
                    <div className="flex flex-col gap-3.5">
                      {parsedAiSummary.strengths && parsedAiSummary.strengths.length > 0 && (
                        <div className="flex flex-col gap-1.5">
                          <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-green-600 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                            <span>Core Strengths</span>
                          </h4>
                          <ul className="flex flex-col gap-1 text-[11px] text-gray-600 font-semibold pl-1">
                            {parsedAiSummary.strengths.map((s: string, idx: number) => (
                              <li key={idx} className="flex items-start gap-1.5 leading-tight">
                                <span className="text-green-500">✓</span>
                                <div className="markdown-body inline-block text-[11px] text-gray-600 font-semibold">
                                  <ReactMarkdown components={{ p: 'span' }}>{s}</ReactMarkdown>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {parsedAiSummary.improvements && parsedAiSummary.improvements.length > 0 && (
                        <div className="flex flex-col gap-1.5 border-t border-gray-50 pt-3">
                          <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-amber-600 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                            <span>Development Areas</span>
                          </h4>
                          <ul className="flex flex-col gap-1 text-[11px] text-gray-600 font-semibold pl-1">
                            {parsedAiSummary.improvements.map((imp: string, idx: number) => (
                              <li key={idx} className="flex items-start gap-1.5 leading-tight">
                                <span className="text-amber-500">•</span>
                                <div className="markdown-body inline-block text-[11px] text-gray-600 font-semibold">
                                  <ReactMarkdown components={{ p: 'span' }}>{imp}</ReactMarkdown>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    {/* Next Steps Progression Target */}
                    {parsedAiSummary.nextSteps && (
                      <div className="border-t border-gray-50 pt-3">
                        <div className="bg-magenta/5 border border-magenta/10 p-3 rounded-xl flex flex-col gap-1">
                          <p className="text-[9px] font-extrabold uppercase tracking-wider text-magenta">Suggested Progression Path</p>
                          <div className="markdown-body text-xs font-bold text-slate-800 leading-tight">
                            <ReactMarkdown>{parsedAiSummary.nextSteps}</ReactMarkdown>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <button
                  onClick={handleFetchAISummary}
                  disabled={aiLoading}
                  className="w-full mt-1 py-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-100 text-gray-500 hover:text-magenta rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{aiLoading ? 'Regenerating...' : 'Regenerate Summary'}</span>
                </button>
              </div>
            ) : (
              <button
                onClick={handleFetchAISummary}
                disabled={aiLoading}
                className="w-full py-2 bg-magenta text-white font-bold text-xs rounded-xl hover:bg-magenta-hover transition-colors shadow-sm flex items-center justify-center gap-2"
              >
                {aiLoading ? (
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Generate Progress Summary</span>
                  </>
                )}
              </button>
            )}
          </div>
        )}

      </div>

      {/* Right 2 Columns: Tabs, Timelines, Badges & Feedback */}
      <div className="lg:col-span-2 flex flex-col gap-8">
        
        {/* Internal Private Notes Section (visible ONLY to Mentors/Admins) */}
        {isMentorOrAdmin && (
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 shadow-subtle flex flex-col gap-4">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-slate-700" />
                <div>
                  <h3 className="font-extrabold text-slate-800 text-sm">Internal Private Notes & Scores</h3>
                  <p className="text-[10px] text-gray-400 font-semibold uppercase mt-0.5">Strictly Confidential (Hidden from Cube)</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleAddNoteClick()}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl transition-colors shadow-sm flex items-center gap-1"
              >
                <span>+ Add Note</span>
              </button>
            </div>

            {/* Notes List */}
            {privateNotes.length === 0 ? (
              <p className="text-xs text-gray-400 font-semibold py-2">No internal notes recorded yet for this Cube.</p>
            ) : (
              <div className="flex flex-col gap-4">
                {privateNotes.map((n) => (
                  <div key={n.id} className="bg-white border border-slate-100 rounded-xl p-4 flex flex-col gap-2 relative shadow-sm group">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-extrabold text-xs text-slate-800 uppercase tracking-wider">{n.subject}</span>
                        {n.score !== null && (
                          <span className="ml-2 bg-slate-100 text-slate-700 text-[10px] font-extrabold px-2 py-0.5 rounded border border-slate-200">
                            Score: {n.score}/10
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-400 font-semibold">
                          By {n.created_by.name} • {new Date(n.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                        {(user?.role === 'ADMIN' || n.created_by_id === user?.id) && (
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={() => handleEditNoteClick(n)}
                              className="text-gray-400 hover:text-slate-700 p-0.5"
                              title="Edit note"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteNote(n.id)}
                              className="text-gray-400 hover:text-red-600 p-0.5"
                              title="Delete note"
                            >
                              <Trash className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-gray-600 font-medium whitespace-pre-wrap leading-relaxed">
                      {n.note}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        
        {/* Documents & Confidential Agreements (NDA, Internship docs) */}
        {canViewDocuments && (
          <div id="documents-section" className="scroll-mt-24">
            <CubeDocumentsManager
              cubeId={profile.id}
              isOwner={isOwner}
              onDocumentsChange={fetchProfileData}
            />
          </div>
        )}

        {/* Web Fundamentals Quiz Spotlight */}
        {profile.quiz_attempts && profile.quiz_attempts.length > 0 && profile.quiz_attempts[0].score !== undefined && (
          <div className="flex flex-col gap-2">
            <QuizScoreBadge
              score={profile.quiz_attempts[0].score}
              badgeName={profile.quiz_attempts[0].badge_awarded?.name}
              rarity={profile.quiz_attempts[0].badge_awarded?.rarity}
              completedAt={profile.quiz_attempts[0].completed_at}
              variant="spotlight"
            />
          </div>
        )}

        {/* Peer Recognition: titles, pinned quotes, MVCubes; private inbox for the Cube */}
        {profile.id && (
          <PeerRecognition
            cubeId={profile.id}
            isSelf={user?.cubeProfileId === profile.id}
            name={profile.user?.name || 'this Cube'}
            avatarUrl={profile.avatar_url || profile.user?.avatar_url}
          />
        )}

        {/* Badges Earned Section */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-subtle flex flex-col gap-4">
          <h3 className="font-extrabold text-lg flex items-center gap-2">
            <Award className="w-5 h-5 text-magenta" />
            <span>Badges & Accomplishments</span>
          </h3>

          {profile.cube_badges && profile.cube_badges.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {/* Rarest first, and each in its own rarity treatment */}
              {[...profile.cube_badges]
                .sort((a: any, b: any) => compareByRarity(a.badge?.rarity, b.badge?.rarity))
                .map((award: any) => {
                  const meta = getRarityMeta(award.badge?.rarity);
                  const isEpic = meta.key === 'Epic';

                  return (
                    <div
                      key={award.id}
                      className={`group relative ${meta.frame} transition-transform duration-300 hover:scale-[1.02]`}
                      title={award.reason}
                    >
                      {isEpic && <span className="badge-sheen" />}
                      <div className={`relative ${meta.surface} p-4 flex flex-col items-center text-center gap-2 h-full`}>
                        <BadgeDisc icon={award.badge?.icon} rarity={award.badge?.rarity} size="md" />
                        <div>
                          <h4 className={`font-bold text-xs leading-tight ${meta.title}`}>{award.badge.name}</h4>
                          <p className={`text-[9px] mt-1 uppercase tracking-wider ${meta.muted}`}>
                            {award.mission ? award.mission.title : 'General Award'}
                          </p>
                        </div>
                        <RarityPill rarity={award.badge?.rarity} />
                        <p className={`text-[10px] font-semibold line-clamp-2 mt-1 italic ${meta.body}`}>
                          "{award.reason}"
                        </p>
                      </div>
                    </div>
                  );
                })}
            </div>
          ) : (
            <p className="text-gray-400 text-sm py-4 text-center">No badges awarded yet.</p>
          )}
        </div>

        {/* Quests Completed Section */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-subtle flex flex-col gap-4">
          <h3 className="font-extrabold text-lg flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            <span>Completed Quests</span>
          </h3>

          {profile.cube_quests && profile.cube_quests.filter((cq: any) => cq.is_completed).length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {profile.cube_quests
                .filter((cq: any) => cq.is_completed)
                .map((cq: any) => {
                  const isEpic = cq.quest?.difficulty === 'Epic';
                  const isRare = cq.quest?.difficulty === 'Rare';
                  const borderClass = isEpic 
                    ? 'border-magenta/40 shadow-sm shadow-magenta/5 bg-slate-950 text-white' 
                    : isRare 
                    ? 'border-sky-200 bg-sky-50/10' 
                    : 'border-slate-100';

                  const badgeMeta = isEpic 
                    ? 'bg-magenta text-white' 
                    : isRare 
                    ? 'bg-sky-50 text-sky-700 border border-sky-100' 
                    : 'bg-slate-50 text-slate-600 border border-slate-200';

                  return (
                    <div
                      key={cq.id}
                      className={`border rounded-2xl p-4 flex flex-col justify-between gap-3 ${borderClass}`}
                    >
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="font-extrabold text-sm leading-snug">
                            {cq.quest?.title}
                          </h4>
                          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${badgeMeta}`}>
                            {cq.quest?.difficulty}
                          </span>
                        </div>
                        <p className={`text-xs ${isEpic ? 'text-slate-300' : 'text-slate-500'} leading-relaxed mt-0.5`}>
                          {cq.quest?.description}
                        </p>
                      </div>

                      <div className="flex items-center justify-between gap-2 border-t pt-2.5 border-slate-100/10">
                        <div className="flex flex-wrap gap-1">
                          {cq.quest?.rewards?.map((b: any) => (
                            <span
                              key={b.id}
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-extrabold ${
                                isEpic ? 'bg-slate-900 border border-slate-800 text-magenta' : 'bg-slate-50 border border-slate-200 text-slate-700'
                              }`}
                            >
                              🏆 {b.name}
                            </span>
                          ))}
                        </div>
                        {cq.completed_at && (
                          <span className="text-[9px] font-bold text-slate-400">
                            Unlocked: {new Date(cq.completed_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          ) : (
            <p className="text-gray-400 text-sm py-4 text-center">No quests completed yet.</p>
          )}
        </div>

        {/* Technical Skills & Interests */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-subtle flex flex-col gap-5">
          <div>
            <h3 className="font-extrabold text-sm text-gray-400 uppercase tracking-wider">Technical Skills</h3>
            <div className="flex flex-wrap gap-2 mt-2">
              {profile.skills && profile.skills.length > 0 ? (
                profile.skills.map((skill: string) => (
                  <span key={skill} className="bg-magenta/5 border border-magenta/10 text-magenta font-semibold text-xs px-3 py-1 rounded-xl">
                    {skill}
                  </span>
                ))
              ) : (
                <span className="text-xs text-gray-400">No skills added.</span>
              )}
            </div>
          </div>

          <div>
            <h3 className="font-extrabold text-sm text-gray-400 uppercase tracking-wider">Interests</h3>
            <div className="flex flex-wrap gap-2 mt-2">
              {profile.interests && profile.interests.length > 0 ? (
                profile.interests.map((interest: string) => (
                  <span key={interest} className="bg-gray-100 border border-gray-200 text-gray-600 font-semibold text-xs px-3 py-1 rounded-xl">
                    {interest}
                  </span>
                ))
              ) : (
                <span className="text-xs text-gray-400">No interests added.</span>
              )}
            </div>
          </div>
        </div>

        {/* Mission Category Strengths */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-subtle flex flex-col gap-4">
          <h3 className="font-extrabold text-lg flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-magenta" />
            <span>Category Strengths</span>
          </h3>
          <p className="text-xs text-gray-400 -mt-2">Breakdown of competency areas based on completed missions.</p>

          {sortedCategories.length > 0 ? (
            <div className="flex flex-col gap-4 mt-2">
              {sortedCategories.map(([category, count]) => {
                const percentage = Math.round((count / maxCount) * 100);
                return (
                  <div key={category} className="flex flex-col gap-1.5 animate-fadeIn">
                    <div className="flex justify-between items-center text-xs font-semibold text-gray-700">
                      <span className="bg-magenta/5 border border-magenta/10 px-2 py-0.5 rounded text-[11px] font-bold text-magenta">
                        {category}
                      </span>
                      <span className="text-gray-500 font-extrabold">
                        {count} {count === 1 ? 'Mission' : 'Missions'}
                      </span>
                    </div>
                    <div className="w-full bg-gray-50 border border-gray-100 h-2.5 rounded-full overflow-hidden">
                      <div 
                        className="bg-gradient-to-r from-magenta to-magenta/70 h-full rounded-full transition-all duration-500" 
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-gray-400 text-xs py-2 italic">No completed missions recorded yet to build category strengths.</p>
          )}
        </div>

        {/* Radar Chart Section */}
        <RadarChart
          scores={averageScores}
          feedbackCount={mentorFeedback ? mentorFeedback.length : 0}
        />

        {/* Demo Submissions list */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-subtle flex flex-col gap-4">
          <h3 className="font-extrabold text-lg">Demo Showcase</h3>
          
          {demoSubmissions && demoSubmissions.length > 0 ? (
            <div className="flex flex-col gap-4">
              {demoSubmissions.map((demo: any) => (
                <div key={demo.id} className="border border-gray-100 rounded-xl p-4 flex flex-col gap-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-sm text-gray-900 leading-tight">{demo.title}</h4>
                      <p className="text-xs text-magenta font-semibold mt-1">Mission: {demo.mission.title}</p>
                    </div>
                    <span className="text-[10px] text-gray-400 font-semibold">
                      {new Date(demo.submitted_at).toLocaleDateString()}
                    </span>
                  </div>

                  <p className="text-xs text-gray-500 leading-relaxed italic">"{demo.summary}"</p>

                  <div className="flex flex-col gap-1 text-[11px] text-gray-500 font-medium">
                    <p><span className="font-bold text-gray-700">What they built:</span> {demo.what_we_built}</p>
                    <p><span className="font-bold text-red-500">What could have been done better:</span> {demo.what_could_we_have_done_better}</p>
                  </div>

                  {/* Resource URLs */}
                  <div className="flex flex-wrap gap-2.5 border-t border-gray-50 pt-3.5 mt-1">
                    {demo.repository_url && (
                      <a href={formatExternalUrl(demo.repository_url)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[10px] font-bold text-gray-500 hover:text-magenta">
                        <GitBranch className="w-3.5 h-3.5" />
                        <span>Repo</span>
                      </a>
                    )}
                    {demo.video_url && (
                      <a href={formatExternalUrl(demo.video_url)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[10px] font-bold text-gray-500 hover:text-magenta">
                        <Video className="w-3.5 h-3.5" />
                        <span>Demo Video</span>
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-sm py-4 text-center">No demo day submissions recorded.</p>
          )}
        </div>

        {/* Feedback Reports */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-subtle flex flex-col gap-4">
          <h3 className="font-extrabold text-lg">Mentor Evaluation Feedback</h3>

          {mentorFeedback && mentorFeedback.length > 0 ? (
            <div className="flex flex-col gap-6 divide-y divide-gray-50">
              {mentorFeedback.map((fb: any, idx: number) => (
                <div key={fb.id} className={`flex flex-col gap-4 ${idx > 0 ? 'pt-6' : ''}`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-sm text-gray-900">
                        {fb.mission ? fb.mission.title : 'General Evaluation'}
                      </h4>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Evaluated by <span className="font-semibold">{fb.mentor.name}</span> on {new Date(fb.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <span className="text-xs font-bold text-magenta bg-magenta/5 border border-magenta/10 px-3 py-0.5 rounded-full uppercase tracking-wider">
                      {fb.recommended_next_step.replace(/_/g, ' ')}
                    </span>
                  </div>

                  {/* Scores Grid */}
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 border border-gray-50 bg-gray-50/30 p-3 rounded-xl">
                    {[
                      { label: 'Technical', val: fb.technical_ability_score },
                      { label: 'Research', val: fb.research_ability_score },
                      { label: 'Demo Output', val: fb.demo_output_score },
                      { label: 'Ownership', val: fb.ownership_score },
                      { label: 'Comm', val: fb.communication_score },
                      { label: 'Leadership', val: fb.leadership_score },
                      { label: 'Product', val: fb.product_thinking_score },
                      { label: 'Reliability', val: fb.reliability_score },
                      { label: 'Reflection', val: fb.self_reflection_score },
                    ].map((score) => (
                      <div key={score.label} className="text-center p-1 border border-gray-50 bg-white rounded-lg">
                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tight">{score.label}</p>
                        <p className="text-sm font-extrabold mt-0.5 text-magenta flex items-center justify-center gap-0.5">
                          <span>{score.val}</span>
                          <Star className="w-3 h-3 fill-magenta text-magenta" />
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Written comments */}
                  <div className="flex flex-col gap-2 text-xs text-gray-600 font-medium">
                    <p><span className="font-bold text-gray-800">Strengths:</span> {fb.strengths}</p>
                    <p><span className="font-bold text-gray-800">Development Areas:</span> {fb.areas_to_improve}</p>
                    {isMentorOrAdmin && fb.private_notes && (
                      <div className="bg-red-50/50 border border-dashed border-red-100 p-3 rounded-xl mt-1 text-[11px]">
                        <p className="font-bold text-red-600 uppercase tracking-wider flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>Private Mentor Notes (Hidden from Cube)</span>
                        </p>
                        <p className="text-red-700 italic mt-1">"{fb.private_notes}"</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-sm py-4 text-center">No evaluations or feedbacks recorded yet.</p>
          )}
        </div>

        {/* Timeline of Updates */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-subtle flex flex-col gap-4">
          <h3 className="font-extrabold text-lg">Timeline Updates</h3>

          {updates && updates.length > 0 ? (
            <div className="flex flex-col gap-4">
              {updates.map((update: any) => (
                <div key={update.id} className="border-l-2 border-magenta/20 pl-4 py-1 flex flex-col gap-1 hover:border-magenta transition-all">
                  <div className="flex justify-between items-center">
                    <p className="text-xs font-bold text-gray-700">
                      {update.mission.title}
                    </p>
                    <span className="text-[9px] font-bold text-magenta bg-magenta/5 border border-magenta/10 px-2 py-0.5 rounded-full uppercase tracking-wider">
                      {update.type}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mt-0.5 font-medium">{update.content}</p>
                  {update.blockers && (
                    <p className="text-xs text-red-500 font-semibold mt-1">
                      ⚠️ Blocker: {update.blockers}
                    </p>
                  )}
                  <span className="text-[10px] text-gray-400 mt-1">{new Date(update.created_at).toLocaleString()}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-sm py-4 text-center">No progress updates submitted yet.</p>
          )}
        </div>

      </div>
    </div>

      {/* Modal: Add/Edit Private Note */}
      {showNoteModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <form onSubmit={handleNoteSubmit} className="bg-white rounded-2xl w-full max-w-md shadow-xl border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between bg-gray-50 px-6 py-4 border-b border-gray-100">
              <div>
                <h3 className="font-extrabold text-gray-900 text-sm">
                  {editingNoteId ? 'Edit Private Note' : 'Add Private Note'}
                </h3>
                <p className="text-[10px] text-gray-400 font-semibold uppercase mt-0.5">Strictly Confidential</p>
              </div>
              <button 
                type="button"
                onClick={() => setShowNoteModal(false)} 
                className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded-lg transition"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider pl-1">Subject *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Communication, Technical Skill, Initiative..."
                  value={noteSubject}
                  onChange={(e) => setNoteSubject(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-xs font-bold text-gray-800 bg-white outline-none focus:border-magenta"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider pl-1">Note Text *</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Enter private observations here..."
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-xs font-semibold text-gray-700 bg-white outline-none focus:border-magenta resize-none"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider pl-1">Score (Optional, 1-10)</label>
                <select
                  value={noteScore}
                  onChange={(e) => setNoteScore(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-xs font-bold text-gray-800 bg-white outline-none focus:border-magenta cursor-pointer"
                >
                  <option value="">No Score</option>
                  {[1,2,3,4,5,6,7,8,9,10].map(s => (
                    <option key={s} value={s}>{s} / 10</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="bg-gray-50 px-6 py-3.5 border-t border-gray-100 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowNoteModal(false)}
                disabled={noteSubmitting}
                className="px-4 py-2 border border-gray-200 rounded-xl text-xs font-bold hover:bg-gray-100 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={noteSubmitting}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 shadow-md"
              >
                {noteSubmitting ? (
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                ) : (
                  <span>Save Note</span>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
};
