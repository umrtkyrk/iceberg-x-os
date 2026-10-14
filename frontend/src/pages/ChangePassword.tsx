import React, { useState } from 'react';
import { api } from '../utils/api';
import { AlertCircle, CheckCircle, KeyRound, Lock } from 'lucide-react';

export const ChangePassword: React.FC = () => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/auth/change-password', {
        currentPassword,
        newPassword
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Failed to change password');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto flex flex-col gap-6">
      <PageHeader eyebrow="Account" title="Change Password" description="Update your Iceberg X OS login password." />

      <form onSubmit={handleSubmit} className="bg-white border border-gray-100 rounded-2xl p-6 sm:p-8 shadow-subtle flex flex-col gap-5">
        {error && (
          <div className="bg-red-50 text-red-600 border border-red-100 p-4 rounded-2xl flex items-center gap-2 text-sm font-semibold">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="bg-green-50 text-green-700 border border-green-100 p-4 rounded-2xl flex items-center gap-2 text-sm font-semibold">
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
            <span>Password changed successfully.</span>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider pl-1" htmlFor="currentPassword">
            Current Password
          </label>
          <div className="relative">
            <Lock className="absolute left-4 top-3.5 w-4 h-4 text-gray-400" />
            <input
              id="currentPassword"
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              disabled={submitting}
              className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-100 hover:border-gray-200 focus:border-magenta focus:bg-white rounded-2xl outline-none font-semibold text-sm transition-all duration-200"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider pl-1" htmlFor="newPassword">
            New Password
          </label>
          <div className="relative">
            <KeyRound className="absolute left-4 top-3.5 w-4 h-4 text-gray-400" />
            <input
              id="newPassword"
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={submitting}
              className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-100 hover:border-gray-200 focus:border-magenta focus:bg-white rounded-2xl outline-none font-semibold text-sm transition-all duration-200"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider pl-1" htmlFor="confirmPassword">
            Confirm New Password
          </label>
          <div className="relative">
            <KeyRound className="absolute left-4 top-3.5 w-4 h-4 text-gray-400" />
            <input
              id="confirmPassword"
              type="password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={submitting}
              className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-100 hover:border-gray-200 focus:border-magenta focus:bg-white rounded-2xl outline-none font-semibold text-sm transition-all duration-200"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3 bg-magenta text-white font-bold text-sm rounded-2xl hover:bg-magenta-hover active:scale-[0.99] transition-all shadow-md shadow-magenta/15 disabled:opacity-75"
        >
          {submitting ? 'Changing Password...' : 'Change Password'}
        </button>
      </form>
    </div>
  );
};
import { PageHeader } from '../components/PageHeader';
