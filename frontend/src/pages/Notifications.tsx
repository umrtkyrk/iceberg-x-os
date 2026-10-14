import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { Send, Users, Search, CheckCircle, AlertCircle } from 'lucide-react';

export const Notifications: React.FC = () => {
  const [cubes, setCubes] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCubes = async () => {
      try {
        const res = await api.get('/cubes?active=true');
        setCubes(res);
      } catch (err) {
        console.error('Failed to load cubes:', err);
      }
    };
    fetchCubes();
  }, []);

  const filteredCubes = cubes.filter(c =>
    c.user.name.toLowerCase().includes(search.toLowerCase()) ||
    c.cube_number.includes(search)
  );

  const handleSelectToggle = (userId: string) => {
    setSelectedIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === filteredCubes.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredCubes.map(c => c.user.id));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setSubmitting(true);
    setSuccess(null);
    setError(null);

    try {
      // If none selected, default to all filtered/listed cubes
      const payloadUserIds = selectedIds.length > 0 ? selectedIds : [];
      await api.post('/notifications/custom', {
        userIds: payloadUserIds,
        message: message.trim()
      });

      setSuccess(`Successfully sent notification to ${payloadUserIds.length > 0 ? payloadUserIds.length : 'all'} Cubes!`);
      setMessage('');
      setSelectedIds([]);
    } catch (err: any) {
      setError(err.message || 'Failed to dispatch custom notification');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-6">
      <PageHeader eyebrow="Administration" title="Send Announcements" description="Keep Cubes informed with programme updates and targeted announcements." />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column: Form */}
        <div className="lg:col-span-2 bg-white border border-gray-100 p-6 rounded-3xl shadow-subtle flex flex-col gap-4">
          <h3 className="font-extrabold text-sm border-b border-gray-50 pb-2">Custom Broadcast Message</h3>

          {success && (
            <div className="bg-green-50 text-green-700 text-xs font-semibold p-3.5 rounded-xl border border-green-100 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {error && (
            <div className="bg-red-50 text-red-700 text-xs font-semibold p-3.5 rounded-xl border border-red-100 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-gray-700 uppercase tracking-wider pl-1">Message *</label>
              <textarea
                required
                rows={5}
                placeholder="Type the message to send to the cubes..."
                value={message}
                onChange={e => setMessage(e.target.value)}
                disabled={submitting}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:border-magenta focus:bg-white text-xs font-semibold resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={submitting || !message.trim()}
              className="w-full py-3.5 bg-slate-800 text-white font-bold text-xs tracking-wide uppercase rounded-xl hover:bg-slate-900 active:scale-[0.99] transition-all shadow-md flex items-center justify-center gap-1.5 disabled:opacity-70"
            >
              <Send className="w-4 h-4" />
              <span>{submitting ? 'Sending announcement...' : 'Broadcast Notification'}</span>
            </button>
          </form>
        </div>

        {/* Right Column: Recipients list */}
        <div className="bg-white border border-gray-100 p-6 rounded-3xl shadow-subtle flex flex-col gap-4 max-h-[500px]">
          <div className="flex justify-between items-center border-b border-gray-50 pb-2">
            <h3 className="font-extrabold text-sm flex items-center gap-1">
              <Users className="w-4 h-4 text-gray-500" />
              <span>Recipients</span>
            </h3>
            <button
              onClick={handleSelectAll}
              className="text-[10px] text-magenta font-extrabold uppercase hover:underline"
            >
              {selectedIds.length === filteredCubes.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or number..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:border-magenta focus:bg-white text-xs font-semibold"
            />
          </div>

          {/* Scrollable list */}
          <div className="overflow-y-auto flex flex-col gap-1 pr-1 divide-y divide-gray-50">
            {filteredCubes.length === 0 ? (
              <p className="text-center text-xs text-gray-400 font-semibold py-4">No Cubes found.</p>
            ) : (
              filteredCubes.map(c => (
                <div
                  key={c.user.id}
                  onClick={() => handleSelectToggle(c.user.id)}
                  className="flex items-center gap-2.5 py-2.5 px-1.5 cursor-pointer hover:bg-gray-50 rounded-lg transition"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(c.user.id)}
                    onChange={() => {}} // Controlled by outer div click handler
                    className="w-4 h-4 rounded text-magenta border-gray-200 focus:ring-magenta cursor-pointer"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-gray-800 truncate">{c.user.name}</p>
                    <p className="text-[10px] text-gray-400 font-bold uppercase">Cube #{c.cube_number}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
import { PageHeader } from '../components/PageHeader';
