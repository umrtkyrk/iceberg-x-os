import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../utils/api';
import { getAssetUrl } from '../../utils/assets';
import ForumPreview, { type ForumBadge, type ForumViewer } from './ForumPreview';
import './forum.css';

interface PortalProfile {
  current_level?: string | null;
  is_senior_candidate?: boolean;
  avatar_url?: string | null;
  cube_badges?: ({ badge?: { id?: string; name?: string; description?: string; icon?: string; rarity?: string } | null } | null)[];
}

export default function Forum() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<PortalProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError('');
    setProfile(null);
    if (!user?.cubeProfileId) { setLoading(false); return; }
    api.get<{ profile?: PortalProfile }>(`/cubes/${encodeURIComponent(user.cubeProfileId)}`)
      .then(data => { if (current) setProfile(data?.profile || null); })
      .catch(() => { if (current) setError('Portal profilin yüklenemedi. Yeniden deneyebilirsin.'); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [user?.id, user?.cubeProfileId, attempt]);

  if (!user) return null;
  if (loading) return <div role="status" className="rounded-2xl border border-gray-100 bg-white p-8 text-gray-500">Cube Forum hazırlanıyor…</div>;
  if (error) return <div role="alert" className="rounded-2xl border border-rose-100 bg-white p-8"><p>{error}</p><button type="button" className="mt-4 rounded-xl bg-magenta px-4 py-2 font-bold text-white" onClick={() => setAttempt(n => n + 1)}>Yeniden dene</button></div>;
  const role = user.role === 'ADMIN' ? 'Admin' : user.role === 'MENTOR' ? 'Mentor'
    : profile?.current_level === 'Cube' && profile?.is_senior_candidate ? 'Senior Cube Candidate'
      : (profile?.current_level || 'Cube').replace(/_/g, ' ');
  const viewer: ForumViewer = {
    id: user.id,
    name: user.name || 'Bilinmeyen Cube',
    username: user.cubeNumber ? `cube-${user.cubeNumber}` : user.role.toLowerCase(),
    role,
    portalRole: user.role,
    initials: (user.name || 'Cube').split(' ').filter(Boolean).slice(0, 2).map(part => part[0]).join(''),
    avatar: getAssetUrl(user.avatarUrl || user.avatar_url || profile?.avatar_url),
    color: '#fce7f3',
  };
  const seen = new Set<string>();
  const earnedBadges: ForumBadge[] = (profile?.cube_badges || []).flatMap(award => {
    const badge = award?.badge;
    if (!badge?.id || seen.has(badge.id)) return [];
    seen.add(badge.id);
    return [{ id: badge.id, name: badge.name || 'Rozet', description: badge.description || '', icon: badge.icon || 'Sparkles', color: badge.rarity === 'Legendary' ? '#d97706' : badge.rarity === 'Epic' ? '#e6007e' : badge.rarity === 'Rare' ? '#0284c7' : '#64748b' }];
  });
  return <ForumPreview key={viewer.id} viewer={viewer} earnedBadges={earnedBadges} />;
}
