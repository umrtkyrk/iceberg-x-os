import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { Mail, GraduationCap, Github, Linkedin, CheckCircle2, XCircle, Trash2, Calendar, Search, FileText, ExternalLink, ShieldAlert, Award } from 'lucide-react';
import { InviteLinkPanel } from '../components/InviteLinkPanel';

export const AdminApplications: React.FC = () => {
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filtering & Search
  const [statusFilter, setStatusFilter] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State for Approval
  const [selectedApp, setSelectedApp] = useState<any | null>(null);
  const [cohort, setCohort] = useState('Summer 2026');
  const [approving, setApproving] = useState(false);

  // One-time invite link returned by an approval; shown until dismissed
  const [issuedInvite, setIssuedInvite] = useState<{ url: string; expiresAt?: string; name?: string } | null>(null);

  const fetchApplications = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/applications');
      setApplications(res);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch applications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, []);

  const handleStatusUpdate = async (id: string, status: 'approved' | 'rejected') => {
    if (status === 'approved') {
      // Open approval modal
      const app = applications.find(a => a.id === id);
      setSelectedApp(app);
      return;
    }

    if (!confirm('Are you sure you want to reject this application?')) return;

    try {
      await api.patch(`/admin/applications/${id}`, { status: 'rejected' });
      setApplications(prev => prev.map(a => a.id === id ? { ...a, status: 'rejected' } : a));
    } catch (err: any) {
      alert(err.message || 'Failed to reject application');
    }
  };

  const handleConfirmApproval = async () => {
    if (!selectedApp) return;
    setApproving(true);

    try {
      const res = await api.patch(`/admin/applications/${selectedApp.id}`, {
        status: 'approved',
        cohort
      });

      setApplications(prev => prev.map(a => a.id === selectedApp.id ? { ...a, status: 'approved' } : a));
      setSelectedApp(null);

      // The invite link is returned exactly once, so it is shown in a panel the
      // admin can copy from rather than an alert they might dismiss.
      if (res.inviteUrl) {
        setIssuedInvite({
          url: res.inviteUrl,
          expiresAt: res.expiresAt,
          name: res.user?.name
        });
      } else {
        alert(res.message || 'Application approved.');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to approve application');
    } finally {
      setApproving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to permanently delete this application from history?')) return;

    try {
      await api.delete(`/admin/applications/${id}`);
      setApplications(prev => prev.filter(a => a.id !== id));
    } catch (err: any) {
      alert(err.message || 'Failed to delete application');
    }
  };

  const filteredApps = applications.filter(app => {
    const matchesStatus = app.status === statusFilter;
    const matchesSearch = 
      app.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.university.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.degree.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="flex flex-col gap-8">
      
      {/* Header */}
      <div className="workspace-header">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Recruitment Applications</h1>
          <p className="text-gray-400 text-sm font-semibold mt-1">Review applications and welcome the next Cubes.</p>
        </div>
      </div>

      {issuedInvite && (
        <InviteLinkPanel
          url={issuedInvite.url}
          expiresAt={issuedInvite.expiresAt}
          name={issuedInvite.name}
          onDismiss={() => setIssuedInvite(null)}
        />
      )}

      {/* Controls: Tabs & Search */}
      <div className="flex flex-col sm:flex-row justify-between gap-4 bg-white border border-gray-100 p-4 rounded-2xl shadow-subtle">
        
        {/* Status Tabs */}
        <div className="flex bg-gray-50 border border-gray-100 p-1.5 rounded-xl self-start">
          {(['pending', 'approved', 'rejected'] as const).map((tab) => {
            const count = applications.filter(a => a.status === tab).length;
            return (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 capitalize ${statusFilter === tab ? 'bg-white text-magenta shadow-sm border border-black/5' : 'text-gray-400 hover:text-gray-700'}`}
              >
                <span>{tab}</span>
                <span className={`px-1.5 py-0.5 text-[9px] rounded-full font-black ${statusFilter === tab ? 'bg-magenta/10 text-magenta' : 'bg-gray-200 text-gray-500'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search applicants..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs font-semibold outline-none focus:border-magenta focus:bg-white transition-all"
          />
        </div>
      </div>

      {/* Loading state */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-magenta border-t-transparent"></div>
        </div>
      ) : error ? (
        <div className="bg-red-50 text-red-600 border border-red-100 p-4 rounded-2xl flex items-center gap-2">
          <ShieldAlert className="w-5 h-5" />
          <span>{error}</span>
        </div>
      ) : filteredApps.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-2xl p-16 text-center text-gray-400 flex flex-col items-center gap-3 shadow-subtle">
          <FileText className="w-12 h-12 text-gray-300" />
          <p className="text-sm font-semibold">No {statusFilter} applications found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {filteredApps.map((app) => (
            <div key={app.id} className="bg-white border border-gray-100 rounded-2xl p-6 sm:p-8 shadow-subtle flex flex-col gap-5 relative overflow-hidden group hover:border-magenta/25 transition-all">
              
              {/* Card Top / Header */}
              <div className="flex justify-between items-start gap-4">
                <div className="flex flex-col gap-1">
                  <h3 className="text-xl font-extrabold text-gray-900">{app.name}</h3>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-gray-500 font-semibold mt-1">
                    <span className="flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5 text-gray-400" />
                      {app.email}
                    </span>
                    <span className="flex items-center gap-1">
                      <GraduationCap className="w-3.5 h-3.5 text-gray-400" />
                      {app.university} ({app.degree}) — {app.year_of_study}
                    </span>
                  </div>
                </div>
                
                {/* Date */}
                <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-gray-300" />
                  {new Date(app.created_at).toLocaleDateString()}
                </div>
              </div>

              {/* Cover Letter / Why Join */}
              <div className="bg-gray-50 border border-gray-100 p-4 sm:p-5 rounded-xl text-xs text-gray-700 font-medium leading-relaxed">
                <p className="font-extrabold text-[10px] uppercase text-gray-400 tracking-wider mb-2">Why they want to become a Cube:</p>
                <div className="italic">"{app.why_join}"</div>
              </div>

              {/* Social Links & Action Buttons */}
              <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 border-t border-gray-50 pt-5 mt-1">
                
                {/* Links */}
                <div className="flex flex-wrap gap-2">
                  {app.linkedin_url && (
                    <a href={app.linkedin_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 px-3 py-1.5 bg-gray-50 hover:bg-magenta/5 border border-gray-100 text-[10px] font-bold text-gray-500 hover:text-magenta rounded-lg transition-colors">
                      <Linkedin className="w-3.5 h-3.5" />
                      <span>LinkedIn</span>
                      <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                    </a>
                  )}
                  {app.github_url && (
                    <a href={app.github_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 px-3 py-1.5 bg-gray-50 hover:bg-magenta/5 border border-gray-100 text-[10px] font-bold text-gray-500 hover:text-magenta rounded-lg transition-colors">
                      <Github className="w-3.5 h-3.5" />
                      <span>GitHub / Portfolio</span>
                      <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                    </a>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 justify-end">
                  {app.status === 'pending' && (
                    <>
                      <button
                        onClick={() => handleStatusUpdate(app.id, 'rejected')}
                        className="flex items-center gap-1.5 px-4 py-2 border border-red-100 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-xs rounded-xl transition-all"
                      >
                        <XCircle className="w-4 h-4" />
                        <span>Reject</span>
                      </button>
                      <button
                        onClick={() => handleStatusUpdate(app.id, 'approved')}
                        className="flex items-center gap-1.5 px-4 py-2 bg-magenta hover:bg-magenta-hover text-white font-bold text-xs rounded-xl shadow-md shadow-magenta/15 hover:shadow-lg transition-all"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Approve Applicant</span>
                      </button>
                    </>
                  )}
                  {app.status !== 'pending' && (
                    <button
                      onClick={() => handleDelete(app.id)}
                      className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 hover:border-red-200 text-gray-400 hover:text-red-500 font-bold text-xs rounded-xl hover:bg-red-50/50 transition-all"
                      title="Purge Application from History"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Delete</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Approval Details Modal */}
      {selectedApp && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="w-full max-w-md bg-white border border-gray-100 p-6 sm:p-8 rounded-[2rem] shadow-premium flex flex-col gap-5 animate-scaleUp">
            <div className="text-center flex flex-col gap-2">
              <div className="mx-auto w-12 h-12 rounded-2xl bg-magenta/10 text-magenta flex items-center justify-center font-extrabold text-xl">
                <Award className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-extrabold text-slate-900 mt-2">Approve Cube Fellowship</h2>
              <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Confirming details for account creation</p>
            </div>

            <div className="flex flex-col gap-3 border border-gray-50 bg-gray-50/40 p-4 rounded-2xl text-xs font-semibold text-gray-600">
              <p><span className="text-gray-400">Applicant:</span> {selectedApp.name}</p>
              <p><span className="text-gray-400">Email:</span> {selectedApp.email}</p>
              <p><span className="text-gray-400">University:</span> {selectedApp.university}</p>
              <p><span className="text-gray-400">Degree:</span> {selectedApp.degree}</p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider pl-1" htmlFor="cohort">
                Assigned Cohort
              </label>
              <input
                id="cohort"
                type="text"
                placeholder="e.g. Summer 2026"
                value={cohort}
                onChange={(e) => setCohort(e.target.value)}
                required
                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 hover:border-gray-200 focus:border-magenta focus:bg-white rounded-2xl outline-none font-semibold text-sm transition-all"
              />
              <p className="text-[10px] text-gray-400 font-medium pl-1 mt-0.5">
                Note: This will automatically assign them the next sequential Cube number.
              </p>
            </div>

            <div className="flex gap-2 mt-2">
              <button
                type="button"
                onClick={() => setSelectedApp(null)}
                disabled={approving}
                className="w-1/2 py-3 border border-gray-200 text-gray-500 font-bold text-xs rounded-2xl hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmApproval}
                disabled={approving || !cohort.trim()}
                className="w-1/2 py-3 bg-magenta text-white font-bold text-xs rounded-2xl hover:bg-magenta-hover disabled:opacity-70 flex items-center justify-center gap-1.5"
              >
                {approving ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirm Approval</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
