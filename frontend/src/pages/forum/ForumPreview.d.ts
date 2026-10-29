import type { ComponentType } from 'react';

export interface ForumViewer {
  id: string;
  name: string;
  username: string;
  role: string;
  portalRole: 'ADMIN' | 'MENTOR' | 'CUBE';
  avatar: string | null;
  initials: string;
  color: string;
}
export interface ForumBadge {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
}
declare const ForumPreview: ComponentType<{ viewer: ForumViewer; earnedBadges: ForumBadge[] }>;
export default ForumPreview;
