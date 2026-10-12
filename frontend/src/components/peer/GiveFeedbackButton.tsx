import React, { useState } from 'react';
import { HeartHandshake } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { PeerFeedbackComposer } from './PeerFeedbackComposer';

/**
 * Opens the feedback composer. Only Cubes can give peer feedback, so this
 * renders nothing for mentors and admins, and nothing on a Cube's own profile.
 */
export const GiveFeedbackButton: React.FC<{
  receiver?: { id: string; name: string; avatarUrl?: string | null } | null;
  variant?: 'solid' | 'soft' | 'icon';
  label?: string;
  className?: string;
}> = ({ receiver, variant = 'solid', label = 'Give feedback', className = '' }) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  if (user?.role !== 'CUBE') return null;
  if (receiver && receiver.id === user.cubeProfileId) return null;

  const styles =
    variant === 'solid'
      ? 'bg-gradient-to-r from-magenta to-pink-500 text-white shadow-premium hover:-translate-y-0.5'
      : variant === 'soft'
      ? 'bg-magenta-100 text-magenta hover:bg-magenta-200'
      : 'bg-slate-100 text-slate-600 hover:bg-magenta-100 hover:text-magenta';

  return (
    <>
      <button
        type="button"
        onClick={e => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        title="Give anonymous peer feedback"
        className={`inline-flex items-center justify-center gap-2 rounded-xl text-xs font-extrabold transition ${
          variant === 'icon' ? 'h-8 w-8' : 'px-3.5 py-2'
        } ${styles} ${className}`}
      >
        <HeartHandshake className="h-4 w-4" />
        {variant !== 'icon' && <span>{label}</span>}
      </button>
      <PeerFeedbackComposer open={open} onClose={() => setOpen(false)} receiver={receiver} />
    </>
  );
};
