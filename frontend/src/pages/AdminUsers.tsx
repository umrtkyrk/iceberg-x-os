import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { ShieldAlert, Trash2, UserPlus, ArrowLeft, Mail, User, Shield, BookOpen, Key, Link2, Activity } from 'lucide-react';
import { Link } from 'react-router-dom';
import { InviteLinkPanel } from '../components/InviteLinkPanel';
import {
  activityState,
  countByStatus,
  formatDaysAgo,
  sortActivityRows,
  STATUS_LABELS,
  ACTIVE_WITHIN_DAYS,
  SLOWING_WITHIN_DAYS,
  type ActivitySortKey,
  type ActivityStatus
} from '../utils/activityStatus';

const STATUS_STYLES: Record<ActivityStatus, string> = {
  active: 'bg-emerald-50 border-emerald-100 text-emerald-700',
  slowing: 'bg-amber-50 border-amber-100 text-amber-700',
  inactive: 'bg-red-50 border-red-100 text-red-600',
  never: 'bg-gray-100 border-gray-200/60 text-gray-500'
};

export const AdminUsers: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Usage tracking view
  const [trackingStartedAt, setTrackingStartedAt] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<ActivityStatus | 'all'>('all');
  const [sortKey, setSortKey] = useState<ActivitySortKey>('last_seen');

  // Form states
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // Default onboarding path: no shared or admin-chosen password at all
  const [useInvite, setUseInvite] = useState(true);
  const [issuedInvite, setIssuedInvite] = useState<{ url: string; expiresAt?: string; name?: string } | null>(null);
  const [invitingUserId, setInvitingUserId] = useState<string | null>(null);
  const [role, setRole] = useState<'CUBE' | 'MENTOR'>('CUBE');
  
  // Cube Profile fields
  const [cubeNumber, setCubeNumber] = useState('');
  const [cohort, setCohort] = useState('Summer 2026');
  const [university, setUniversity] = useState('');
  const [department, setDepartment] = useState('');
  const [slackHandle, setSlackHandle] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [gitlabUrl, setGitlabUrl] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [skills, setSkills] = useState('');
  const [interests, setInterests] = useState('');
  const [assignedMentorId, setAssignedMentorId] = useState('');

  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState(false);

  // Deletion confirm state
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const fetchUsers = async () => {
    try {
      const [res, overview] = await Promise.all([
        api.get('/admin/users'),
        // Non-fatal: without it the page just treats tracking as brand new.
        api.get('/admin/activity/overview').catch(() => null)
      ]);
      setUsers(res);
      setTrackingStartedAt(overview?.tracking_started_at ?? null);
    } catch (err: any) {
      setError(err.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Filter list of mentors for the assign mentor dropdown (includes both mentors and admins)
  const mentors = users.filter((u) => u.role === 'MENTOR' || u.role === 'ADMIN');

  // Usage status per account, filtered and sorted for the table.
  const now = new Date();
  const allRows = users.map((item) => ({
    item,
    name: item?.name || '',
    activeDays: item?.activity?.active_days ?? 0,
    state: activityState(item, now, trackingStartedAt)
  }));
  const statusCounts = countByStatus(allRows.map((row) => row.state));
  const visibleRows = sortActivityRows(
    allRows.filter((row) => statusFilter === 'all' || row.state.status === statusFilter),
    sortKey
  );
  const trackingIsNew =
    !trackingStartedAt || now.getTime() - new Date(trackingStartedAt).getTime() < 7 * 86_400_000;

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitting(true);
    setFormError(null);
    setFormSuccess(false);

    const payload: any = {
      name,
      email,
      role,
    };

    // Omitting the password makes the backend issue a one-time invite link
    if (useInvite) {
      payload.invite = true;
    } else {
      payload.password = password;
    }

    if (role === 'CUBE') {
      payload.cube_number = cubeNumber;
      payload.cohort = cohort;
      payload.university = university;
      payload.department = department;
      payload.slack_handle = slackHandle;
      payload.github_url = githubUrl || null;
      payload.gitlab_url = gitlabUrl || null;
      payload.linkedin_url = linkedinUrl || null;
      payload.skills = skills.split(',').map((s) => s.trim()).filter(Boolean);
      payload.interests = interests.split(',').map((s) => s.trim()).filter(Boolean);
      payload.assigned_mentor_id = assignedMentorId || null;
    }

    try {
      const res = await api.post('/admin/users/create', payload);
      setFormSuccess(true);
      if (res.inviteUrl) {
        setIssuedInvite({ url: res.inviteUrl, expiresAt: res.expiresAt, name });
      }
      
      // Reset form
      setName('');
      setEmail('');
      setPassword('');
      setCubeNumber('');
      setUniversity('');
      setDepartment('');
      setSlackHandle('');
      setGithubUrl('');
      setGitlabUrl('');
      setLinkedinUrl('');
      setSkills('');
      setInterests('');
      setAssignedMentorId('');
      
      // Reload lists
      await fetchUsers();
      setTimeout(() => {
        setShowAddForm(false);
        setFormSuccess(false);
      }, 1500);
    } catch (err: any) {
      setFormError(err.message || 'Failed to create user');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    setDeleteSubmitting(true);
    try {
      await api.delete(`/admin/users/${userId}`);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      setConfirmDeleteId(null);
    } catch (err: any) {
      alert(err.message || 'Failed to delete user');
    } finally {
      setDeleteSubmitting(false);
    }
  };

  /**
   * Issues a fresh single-use invite link. The account's current password stays
   * valid until the person actually accepts, so this is safe to use on an
   * existing user who simply lost their link.
   */
  const handleIssueInvite = async (item: any) => {
    if (!confirm(
      `Generate a new invite link for ${item.name}?\n\n` +
      `Nothing is emailed — you copy the link and send it yourself. ` +
      `Any previous unused link stops working. Their current password stays valid until they accept.`
    )) return;
    setInvitingUserId(item.id);
    try {
      const res = await api.post(`/admin/users/${item.id}/invite`, {});
      setIssuedInvite({ url: res.inviteUrl, expiresAt: res.expiresAt, name: item.name });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      alert(err.message || 'Failed to issue invite link');
    } finally {
      setInvitingUserId(null);
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

  return (
    <div className="flex flex-col gap-6">
      
      {/* Header */}
      <div className="workspace-header">
        <div className="flex min-w-0 items-center gap-3">
          <Link to="/dashboard" title="Back to dashboard" aria-label="Back to dashboard" className="workspace-icon-button">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">User Administration</h1>
            <p className="text-gray-500 mt-1">Manage Cubes, Mentors, and Administrators in the platform.</p>
          </div>
        </div>

        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-2 bg-magenta text-white px-4 py-2.5 font-bold text-xs rounded-xl hover:bg-magenta-hover transition-colors shadow-sm"
        >
          <UserPlus className="w-4 h-4" />
          <span>{showAddForm ? 'Hide Form' : 'Add New User'}</span>
        </button>
      </div>

      {/* Add User Form Drawer */}
      {showAddForm && (
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-premium animate-fadeIn max-w-3xl">
          <h2 className="font-extrabold text-base border-b border-gray-50 pb-2 mb-4 flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-magenta" />
            <span>Create New Program User</span>
          </h2>

          {formSuccess && (
            <div className="bg-green-50 text-green-700 text-xs font-semibold p-3.5 rounded-xl border border-green-100 mb-4">
              ✓ User successfully created and profile generated!
            </div>
          )}

          {formError && (
            <div className="bg-red-50 text-red-600 text-xs font-semibold p-3.5 rounded-xl border border-red-100 mb-4 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4" />
              <span>{formError}</span>
            </div>
          )}

          <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Core credentials */}
            <div className="flex flex-col gap-4">
              <h3 className="font-extrabold text-xs text-gray-400 uppercase tracking-wider">Account Credentials</h3>
              
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-1">
                  <User className="w-3.5 h-3.5" /> Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Full name (e.g. John Doe)"
                  className="p-2.5 border border-gray-100 bg-gray-50 rounded-lg text-xs outline-none focus:border-magenta font-semibold"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5" /> Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@example.com"
                  className="p-2.5 border border-gray-100 bg-gray-50 rounded-lg text-xs outline-none focus:border-magenta font-semibold"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-1">
                  <Key className="w-3.5 h-3.5" /> Password
                </label>
                <label className="flex items-center gap-2 py-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useInvite}
                    onChange={(e) => setUseInvite(e.target.checked)}
                    className="w-3.5 h-3.5 rounded text-magenta border-gray-200 focus:ring-magenta cursor-pointer"
                  />
                  <span className="text-[11px] font-bold text-gray-600">
                    Send an invite link instead (they choose their own password)
                  </span>
                </label>
                {!useInvite && (
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    minLength={8}
                    className="p-2.5 border border-gray-100 bg-gray-50 rounded-lg text-xs outline-none focus:border-magenta font-semibold"
                  />
                )}
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-1">
                  <Shield className="w-3.5 h-3.5" /> System Role
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  className="p-2.5 bg-gray-50 border border-gray-100 rounded-lg text-xs font-semibold outline-none focus:border-magenta"
                >
                  <option value="CUBE">Cube</option>
                  <option value="MENTOR">Mentor (Advisor)</option>
                </select>
              </div>
            </div>

            {/* Cube Profile section */}
            {role === 'CUBE' ? (
              <div className="flex flex-col gap-4 border-t md:border-t-0 md:border-l border-gray-100 pt-4 md:pt-0 md:pl-4">
                <h3 className="font-extrabold text-xs text-gray-400 uppercase tracking-wider">Cube Profile Details</h3>
                
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase">Cube Number</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 006"
                      value={cubeNumber}
                      onChange={(e) => setCubeNumber(e.target.value)}
                      className="p-2 border border-gray-100 bg-gray-50 rounded-lg text-xs outline-none focus:border-magenta font-semibold"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase">Cohort</label>
                    <input
                      type="text"
                      required
                      value={cohort}
                      onChange={(e) => setCohort(e.target.value)}
                      className="p-2 border border-gray-100 bg-gray-50 rounded-lg text-xs outline-none focus:border-magenta font-semibold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase">University</label>
                    <input
                      type="text"
                      placeholder="e.g. UCL"
                      value={university}
                      onChange={(e) => setUniversity(e.target.value)}
                      className="p-2 border border-gray-100 bg-gray-50 rounded-lg text-xs outline-none focus:border-magenta font-semibold"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase">Department</label>
                    <input
                      type="text"
                      placeholder="e.g. CS"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      className="p-2 border border-gray-100 bg-gray-50 rounded-lg text-xs outline-none focus:border-magenta font-semibold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase">Slack Handle</label>
                    <input
                      type="text"
                      placeholder="e.g. @john"
                      value={slackHandle}
                      onChange={(e) => setSlackHandle(e.target.value)}
                      className="p-2 border border-gray-100 bg-gray-50 rounded-lg text-xs outline-none focus:border-magenta font-semibold"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase">Assign Mentor</label>
                    <select
                      value={assignedMentorId}
                      onChange={(e) => setAssignedMentorId(e.target.value)}
                      className="p-2.5 bg-gray-50 border border-gray-100 rounded-lg text-xs font-semibold outline-none focus:border-magenta"
                    >
                      <option value="">Unassigned</option>
                      {mentors.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.role === 'ADMIN' ? 'Admin' : 'Mentor'})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase">GitHub / GitLab / LinkedIn URLs</label>
                  <div className="flex flex-col gap-1.5">
                    <input type="url" placeholder="https://github.com/..." value={githubUrl} onChange={(e) => setGithubUrl(e.target.value)} className="p-2 border border-gray-100 bg-gray-50 rounded-lg text-xs outline-none focus:border-magenta font-medium" />
                    <input type="url" placeholder="https://linkedin.com/in/..." value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)} className="p-2 border border-gray-100 bg-gray-50 rounded-lg text-xs outline-none focus:border-magenta font-medium" />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase">Skills (comma-separated)</label>
                  <input type="text" placeholder="React, PyTorch, SQL" value={skills} onChange={(e) => setSkills(e.target.value)} className="p-2 border border-gray-100 bg-gray-50 rounded-lg text-xs outline-none focus:border-magenta font-semibold" />
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 rounded-2xl p-6 flex flex-col justify-center items-center border border-gray-100/50 text-center gap-2">
                <Shield className="w-8 h-8 text-gray-400" />
                <h4 className="font-extrabold text-sm text-gray-700">Mentor Account Mode</h4>
                <p className="text-xs text-gray-400 max-w-xs leading-relaxed">Mentors do not require Cube profiles. They can view, review, and evaluate Cube assignments across all teams.</p>
              </div>
            )}

            {/* Actions */}
            <div className="md:col-span-2 flex justify-end gap-2.5 border-t border-gray-50 pt-4 mt-2">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 bg-white border border-gray-200 text-gray-500 font-bold text-xs rounded-xl hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={formSubmitting}
                className="px-5 py-2 bg-magenta text-white font-bold text-xs rounded-xl hover:bg-magenta-hover transition-colors shadow-sm disabled:opacity-75"
              >
                {formSubmitting ? 'Creating User...' : 'Create Account'}
              </button>
            </div>

          </form>
        </div>
      )}

      {issuedInvite && (
        <InviteLinkPanel
          url={issuedInvite.url}
          expiresAt={issuedInvite.expiresAt}
          name={issuedInvite.name}
          onDismiss={() => setIssuedInvite(null)}
        />
      )}

      {/* Users List Card */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-subtle overflow-hidden">
        <div className="p-6 border-b border-gray-50 flex justify-between items-center bg-white">
          <h2 className="font-extrabold text-lg text-gray-900">Registered Accounts</h2>
          <span className="bg-gray-100 text-gray-600 border border-gray-200/50 text-xs font-extrabold px-3 py-0.5 rounded-full">
            {users.length} Users Total
          </span>
        </div>

        {/* Usage overview: who is actually using the portal */}
        <div className="px-6 py-4 border-b border-gray-50 bg-gray-50/40 flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Activity className="w-4 h-4 text-gray-400" />
            {(['all', 'active', 'slowing', 'inactive', 'never'] as const).map((key) => {
              const selected = statusFilter === key;
              const count = key === 'all' ? users.length : statusCounts[key];
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setStatusFilter(key)}
                  aria-pressed={selected}
                  className={`text-xs font-bold px-3 py-1 rounded-full border transition-colors ${
                    selected
                      ? 'bg-gray-900 border-gray-900 text-white'
                      : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {key === 'all' ? 'All' : STATUS_LABELS[key]} · {count}
                </button>
              );
            })}
            <label className="ml-auto flex items-center gap-2 text-xs font-bold text-gray-500">
              Sort by
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as ActivitySortKey)}
                className="border border-gray-200 rounded-lg px-2 py-1 text-xs font-semibold text-gray-700 bg-white"
              >
                <option value="last_seen">Least recently seen</option>
                <option value="active_days">Fewest active days (30d)</option>
                <option value="name">Name</option>
              </select>
            </label>
          </div>
          <p className="text-xs text-gray-500 leading-relaxed">
            Active: seen within {ACTIVE_WITHIN_DAYS} days. Slowing: up to {SLOWING_WITHIN_DAYS} days. Inactive: longer.
            “Seen” means opening portal pages and using them, or signing in, whichever is later.
            {trackingIsNew && (
              <span className="text-amber-700 font-semibold">
                {' '}
                {trackingStartedAt
                  ? `Usage tracking started ${new Date(trackingStartedAt).toLocaleDateString()}. Until it has run for a week, “Slowing”, “Inactive” and “Never” may just mean the person has not opened the portal yet (marked with ?).`
                  : 'Usage tracking has not recorded anything yet, so only sign-in dates are shown (marked with ?).'}
              </span>
            )}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-gray-100 text-gray-400 font-bold text-xs uppercase bg-gray-50/50">
                <th className="px-6 py-4">User Details</th>
                <th className="px-6 py-4">System Role</th>
                <th className="px-6 py-4">Cube Info</th>
                <th className="px-6 py-4">Activity</th>
                <th className="px-6 py-4">Last 30 Days</th>
                <th className="px-6 py-4">Assigned Mentor</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {visibleRows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-sm text-gray-400">
                    No accounts match this filter.
                  </td>
                </tr>
              )}
              {visibleRows.map(({ item, state }) => {
                const isCubeUser = item.role === 'CUBE';
                const isCurrent = currentUser?.id === item.id;

                return (
                  <tr key={item.id} className="hover:bg-gray-50/30 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-gray-900 group-hover:text-magenta transition-colors">
                          {item.name} {isCurrent && '(You)'}
                        </span>
                        <span className="text-xs text-gray-400 mt-0.5 font-medium">{item.email}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase border ${
                        item.role === 'ADMIN'
                          ? 'bg-purple-50 border-purple-100 text-purple-700'
                          : item.role === 'MENTOR'
                          ? 'bg-blue-50 border-blue-100 text-blue-700'
                          : 'bg-magenta/5 border-magenta/10 text-magenta'
                      }`}>
                        {item.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-500 font-medium">
                      {isCubeUser && item.cube_profile ? (
                        <div className="flex items-center gap-2">
                          <span className="bg-gray-100 border border-gray-200/50 text-gray-600 font-bold text-xs px-2 py-0.5 rounded">
                            #{item.cube_profile.cube_number}
                          </span>
                          <span className="text-xs text-gray-400">{item.cube_profile.cohort}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 italic">Not Applicable</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1 items-start">
                        <span
                          className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase border ${STATUS_STYLES[state.status]}`}
                          title={
                            state.provisional
                              ? 'Usage tracking is new, so this may just mean they have not opened the portal yet.'
                              : undefined
                          }
                        >
                          {STATUS_LABELS[state.status]}
                          {state.provisional && ' ?'}
                        </span>
                        <span
                          className="text-xs text-gray-400 font-medium"
                          title={state.lastSeenAt ? state.lastSeenAt.toLocaleString() : undefined}
                        >
                          {formatDaysAgo(state.daysAgo)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-500 font-medium">
                      {item.activity && item.activity.active_days > 0 ? (
                        <div className="flex flex-col">
                          <span className="font-bold text-gray-700">
                            {item.activity.active_days} active {item.activity.active_days === 1 ? 'day' : 'days'}
                          </span>
                          <span className="text-gray-400">
                            {item.activity.page_views} views · {item.activity.active_minutes} min
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-400 italic">No activity</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-gray-600 font-semibold text-xs">
                      {isCubeUser && item.cube_profile ? (
                        item.cube_profile.assigned_mentor_id ? (
                          mentors.find((m) => m.id === item.cube_profile.assigned_mentor_id)?.name || 'Assigned Mentor'
                        ) : (
                          <span className="text-gray-400 font-normal italic">Unassigned</span>
                        )
                      ) : (
                        <span className="text-gray-400 font-normal italic">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right relative">
                      {confirmDeleteId === item.id ? (
                        <div className="flex justify-end gap-1.5 animate-fadeIn">
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="bg-gray-100 text-gray-600 hover:bg-gray-200 font-bold text-[10px] px-2 py-1 rounded"
                            disabled={deleteSubmitting}
                          >
                            No
                          </button>
                          <button
                            onClick={() => handleDeleteUser(item.id)}
                            className="bg-red-500 text-white hover:bg-red-600 font-bold text-[10px] px-2 py-1 rounded"
                            disabled={deleteSubmitting}
                          >
                            {deleteSubmitting ? 'Deleting...' : 'Confirm'}
                          </button>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => handleIssueInvite(item)}
                            disabled={invitingUserId === item.id}
                            className="p-2 hover:bg-magenta/5 border border-transparent rounded-lg text-gray-400 hover:text-magenta hover:border-magenta/10 transition-all opacity-0 group-hover:opacity-100 disabled:opacity-50"
                            title="Generate a one-time invite link to copy and share (no email is sent)"
                          >
                            <Link2 className="w-4 h-4" />
                          </button>
                          {!isCurrent && (
                            <button
                              onClick={() => setConfirmDeleteId(item.id)}
                              className="p-2 hover:bg-red-50 border border-transparent rounded-lg text-gray-400 hover:text-red-500 hover:border-red-100 transition-all opacity-0 group-hover:opacity-100"
                              title="Delete user and all associated records"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
