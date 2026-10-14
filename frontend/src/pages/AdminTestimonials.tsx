import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { ShieldAlert, Check, Trash2, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export const AdminTestimonials: React.FC = () => {
  const [testimonials, setTestimonials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTestimonials = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/testimonials');
      setTestimonials(res);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch testimonials');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTestimonials();
  }, []);

  const handleApprove = async (id: string) => {
    try {
      await api.put(`/testimonials/${id}/approve`, {});
      setTestimonials(prev =>
        prev.map(t => (t.id === id ? { ...t, is_approved: true } : t))
      );
    } catch (err: any) {
      alert(err.message || 'Failed to approve testimonial');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this testimonial?')) return;
    try {
      await api.delete(`/testimonials/${id}`);
      setTestimonials(prev => prev.filter(t => t.id !== id));
    } catch (err: any) {
      alert(err.message || 'Failed to delete testimonial');
    }
  };

  const pending = testimonials.filter(t => !t.is_approved);
  const approved = testimonials.filter(t => t.is_approved);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-magenta border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      
      {/* Header */}
      <div className="workspace-header">
        <Link
          to="/dashboard"
          title="Back to dashboard"
          aria-label="Back to dashboard"
          className="workspace-icon-button"
        >
          <ArrowLeft size={16} />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-extrabold tracking-tight">Moderate Testimonials</h1>
          <p className="text-gray-500 mt-1">Approve or reject Cube testimonials for the landing page.</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 border border-red-100 p-4 rounded-2xl flex items-center gap-2 text-sm font-semibold">
          <ShieldAlert className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Pending approvals */}
        <div className="flex flex-col gap-4">
          <h3 className="font-extrabold text-lg flex items-center gap-2 text-gray-800">
            <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
            <span>Pending Testimonials ({pending.length})</span>
          </h3>

          {pending.length === 0 ? (
            <p className="text-xs text-gray-400 italic py-8 text-center bg-white border border-gray-100 rounded-2xl shadow-subtle">
              No testimonials pending moderation.
            </p>
          ) : (
            <div className="flex flex-col gap-4 animate-fadeIn">
              {pending.map((t) => (
                <div key={t.id} className="bg-white border border-gray-100 p-5 rounded-2xl shadow-subtle flex flex-col gap-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-sm text-gray-900">{t.cube?.user?.name || 'Unknown Cube'}</h4>
                      <p className="text-[10px] text-gray-400 font-semibold mt-0.5">Cohort {t.cube?.cohort}</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed font-semibold italic">"{t.content}"</p>
                  
                  <div className="flex gap-2 justify-end mt-2 pt-2 border-t border-gray-50">
                    <button
                      onClick={() => handleDelete(t.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 border border-red-100 hover:bg-red-50 text-red-600 font-bold text-[10px] rounded-lg transition"
                    >
                      <Trash2 size={12} />
                      <span>Delete</span>
                    </button>
                    <button
                      onClick={() => handleApprove(t.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-magenta hover:bg-magenta-hover text-white font-bold text-[10px] rounded-lg transition"
                    >
                      <Check size={12} />
                      <span>Approve</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Approved testimonials */}
        <div className="flex flex-col gap-4">
          <h3 className="font-extrabold text-lg flex items-center gap-2 text-gray-800">
            <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
            <span>Approved Testimonials ({approved.length})</span>
          </h3>

          {approved.length === 0 ? (
            <p className="text-xs text-gray-400 italic py-8 text-center bg-white border border-gray-100 rounded-2xl shadow-subtle">
              No approved testimonials showing on landing page.
            </p>
          ) : (
            <div className="flex flex-col gap-4 animate-fadeIn">
              {approved.map((t) => (
                <div key={t.id} className="bg-white border border-gray-100 p-5 rounded-2xl shadow-subtle flex flex-col gap-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-sm text-gray-900">{t.cube?.user?.name || 'Unknown Cube'}</h4>
                      <p className="text-[10px] text-gray-400 font-semibold mt-0.5">Cohort {t.cube?.cohort}</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed font-semibold italic">"{t.content}"</p>
                  
                  <div className="flex gap-2 justify-end mt-2 pt-2 border-t border-gray-50">
                    <button
                      onClick={() => handleDelete(t.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 border border-red-100 hover:bg-red-50 text-red-600 font-bold text-[10px] rounded-lg transition"
                    >
                      <Trash2 size={12} />
                      <span>Remove</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

    </div>
  );
};
