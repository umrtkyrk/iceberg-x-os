import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Calendar, Clock, Plus, Trash2, Edit3, Check, X, 
  AlertTriangle, CheckCircle, XCircle, FileText, ChevronDown, ChevronUp 
} from 'lucide-react';

export const Meetings: React.FC = () => {
  const { user } = useAuth();
  const isAdminOrMentor = user?.role === 'ADMIN' || user?.role === 'MENTOR';

  const [meetings, setMeetings] = useState<any[]>([]);
  const [cubes, setCubes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<any | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [notify, setNotify] = useState(false);
  const [selectedCubeIds, setSelectedCubeIds] = useState<string[]>([]);
  const [cubeSearch, setCubeSearch] = useState('');

  // Complete meeting states
  const [decisions, setDecisions] = useState('');
  const [summary, setSummary] = useState('');
  const [attendance, setAttendance] = useState<{ [cubeId: string]: { attended: boolean; excuse: string } }>({});

  // Expanded completed meetings details
  const [expandedMeetings, setExpandedMeetings] = useState<{ [id: string]: boolean }>({});

  const fetchData = async () => {
    try {
      setLoading(true);
      const [meetingsRes, cubesRes] = await Promise.all([
        api.get('/meetings'),
        isAdminOrMentor ? api.get('/cubes?active=true') : Promise.resolve([])
      ]);
      setMeetings(meetingsRes);
      if (cubesRes) {
        setCubes(cubesRes);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load meetings data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !date) return;

    try {
      await api.post('/meetings', {
        title,
        description,
        date: date + '+03:00',
        notify,
        invited_cube_ids: selectedCubeIds
      });
      setShowCreateModal(false);
      setTitle('');
      setDescription('');
      setDate('');
      setNotify(false);
      setSelectedCubeIds([]);
      setCubeSearch('');
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to create meeting');
    }
  };

  const handleEditMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMeeting || !title || !date) return;

    try {
      await api.put(`/meetings/${selectedMeeting.id}`, {
        title,
        description,
        date: date + '+03:00',
        invited_cube_ids: selectedCubeIds
      });
      setShowEditModal(false);
      setSelectedMeeting(null);
      setTitle('');
      setDescription('');
      setDate('');
      setSelectedCubeIds([]);
      setCubeSearch('');
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to update meeting');
    }
  };

  const handleDeleteMeeting = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this meeting? This will also delete any attendance records.')) return;

    try {
      await api.delete(`/meetings/${id}`);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete meeting');
    }
  };

  const openCompleteModal = (meeting: any) => {
    setSelectedMeeting(meeting);
    setDecisions('');
    setSummary('');
    
    // Initialize attendance status: default all cubes to attended
    const initialAttendance: any = {};
    const hasInvitedCubes = Array.isArray(meeting.invited_cube_ids) && meeting.invited_cube_ids.length > 0;
    const targetList = hasInvitedCubes
      ? cubes.filter(c => meeting.invited_cube_ids.includes(c.id))
      : cubes;

    targetList.forEach((c) => {
      initialAttendance[c.id] = { attended: true, excuse: '' };
    });
    setAttendance(initialAttendance);
    setShowCompleteModal(true);
  };

  const handleCompleteMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMeeting) return;

    // Convert attendance state to backend array format
    const attendanceArray = Object.keys(attendance).map((cubeId) => ({
      cube_id: cubeId,
      attended: attendance[cubeId].attended,
      excuse: attendance[cubeId].attended ? '' : attendance[cubeId].excuse
    }));

    try {
      await api.post(`/meetings/${selectedMeeting.id}/complete`, {
        decisions,
        summary,
        attendance: attendanceArray
      });
      setShowCompleteModal(false);
      setSelectedMeeting(null);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to complete meeting');
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedMeetings(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const toTurkeyDateTimeString = (dateStr: string) => {
    const d = new Date(dateStr);
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Istanbul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    
    const parts = formatter.formatToParts(d);
    const val = (type: string) => parts.find(p => p.type === type)?.value || '';
    
    // Format: yyyy-MM-ddThh:mm
    return `${val('year')}-${val('month')}-${val('day')}T${val('hour')}:${val('minute')}`;
  };

  const formatDate = (dateString: string) => {
    const d = new Date(dateString);
    return d.toLocaleDateString('tr-TR', {
      timeZone: 'Europe/Istanbul',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }) + ' (TSİ)';
  };

  const upcomingMeetings = meetings.filter(m => {
    if (m.is_completed) return false;
    if (user?.role === 'CUBE') {
      const isInvited = Array.isArray(m.invited_cube_ids) && m.invited_cube_ids.length > 0;
      if (isInvited) {
        return m.invited_cube_ids.includes(user.cubeProfileId);
      }
    }
    return true;
  });
  const completedMeetings = meetings.filter(m => {
    if (!m.is_completed) return false;
    if (user?.role === 'CUBE') {
      const isInvited = Array.isArray(m.invited_cube_ids) && m.invited_cube_ids.length > 0;
      if (isInvited) {
        return m.invited_cube_ids.includes(user.cubeProfileId);
      }
    }
    return true;
  });

  return (
    <div className="w-full">
      {/* Header */}
      <div className="workspace-header mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Meetings Log</h1>
          <p className="text-gray-500 mt-1">Schedule new meetings, log discussion topics, and track attendance.</p>
        </div>
        {isAdminOrMentor && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="workspace-primary-action"
          >
            <Plus size={18} />
            Schedule Meeting
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-xl border border-red-100 flex items-center gap-3 mb-6">
          <AlertTriangle className="shrink-0" />
          <p className="font-medium text-sm">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <div className="w-10 h-10 border-4 border-gray-900 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-500 font-medium">Loading meetings...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Upcoming Meetings Column */}
          <div className="lg:col-span-1 flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <Calendar size={18} className="text-gray-500" />
                Upcoming Meetings
                <span className="bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded-full font-bold">
                  {upcomingMeetings.length}
                </span>
              </h2>
            </div>

            {upcomingMeetings.length === 0 ? (
              <div className="bg-white border border-gray-100 rounded-2xl p-6 text-center text-gray-500 shadow-sm">
                <Clock size={32} className="mx-auto text-gray-300 mb-2" />
                <p className="text-sm font-medium">No upcoming meetings scheduled.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {upcomingMeetings.map((meeting) => (
                  <div key={meeting.id} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm hover:border-gray-200 transition">
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg uppercase tracking-wider">
                        Scheduled
                      </span>
                      {isAdminOrMentor && (
                        <div className="flex gap-1">
                          <button
                            onClick={() => {
                              setSelectedMeeting(meeting);
                              setTitle(meeting.title);
                              setDescription(meeting.description || '');
                              setDate(toTurkeyDateTimeString(meeting.date));
                              setSelectedCubeIds(meeting.invited_cube_ids || []);
                              setShowEditModal(true);
                            }}
                            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-50 rounded-lg transition"
                            title="Edit"
                          >
                            <Edit3 size={15} />
                          </button>
                          <button
                            onClick={() => handleDeleteMeeting(meeting.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                            title="Delete"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      )}
                    </div>
                    <h3 className="font-extrabold text-gray-800 mt-2 text-base leading-tight">{meeting.title}</h3>
                    {meeting.description && (
                      <p className="text-xs text-gray-500 mt-1.5 line-clamp-2">{meeting.description}</p>
                    )}
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-4 bg-gray-50 p-2.5 rounded-xl">
                      <Calendar size={13} className="text-gray-400" />
                      <span className="font-medium">{formatDate(meeting.date)}</span>
                    </div>

                    {isAdminOrMentor && (
                      <button
                        onClick={() => openCompleteModal(meeting)}
                        className="w-full mt-4 bg-emerald-600 text-white font-bold text-xs py-2 px-4 rounded-xl hover:bg-emerald-700 transition flex items-center justify-center gap-1.5"
                      >
                        <Check size={14} />
                        Log Attendance & Complete
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Past/Completed Meetings Column */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <CheckCircle size={18} className="text-emerald-500" />
              Completed Meetings
              <span className="bg-emerald-50 text-emerald-700 text-xs px-2 py-0.5 rounded-full font-bold">
                {completedMeetings.length}
              </span>
            </h2>

            {completedMeetings.length === 0 ? (
              <div className="bg-white border border-gray-100 rounded-2xl p-10 text-center text-gray-500 shadow-sm">
                <FileText size={40} className="mx-auto text-gray-300 mb-3" />
                <p className="text-sm font-medium">No completed meetings logged yet.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {completedMeetings.map((meeting) => {
                  const isExpanded = !!expandedMeetings[meeting.id];
                  const attendees = meeting.attendance?.filter((a: any) => a.attended) || [];
                  const absentees = meeting.attendance?.filter((a: any) => !a.attended) || [];

                  // For Cubes the backend returns only their own attendance row
                  // plus aggregate counts, so the roster totals come from there.
                  const totalAttended = isAdminOrMentor
                    ? attendees.length
                    : (meeting.attendance_summary?.attended ?? attendees.length);
                  const totalLogged = isAdminOrMentor
                    ? (meeting.attendance || []).length
                    : (meeting.attendance_summary?.total ?? (meeting.attendance || []).length);

                  // Check if this cube logged in was absent or attended
                  let ownAttendance: any = null;
                  if (!isAdminOrMentor && user) {
                    ownAttendance = meeting.attendance?.[0] || null;
                  }

                  return (
                    <div key={meeting.id} className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-50 pb-4 mb-4">
                        <div>
                          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg uppercase tracking-wider">
                            Completed
                          </span>
                          <h3 className="font-extrabold text-gray-800 text-lg leading-tight mt-2">{meeting.title}</h3>
                          <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-1">
                            <Clock size={13} className="text-gray-400" />
                            <span>{formatDate(meeting.date)}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-start sm:self-center">
                          {!isAdminOrMentor && ownAttendance && (
                            <span className={`text-xs font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 ${
                              ownAttendance.attended 
                                ? 'bg-emerald-50 text-emerald-700' 
                                : 'bg-red-50 text-red-700'
                            }`}>
                              {ownAttendance.attended ? (
                                <>
                                  <CheckCircle size={12} />
                                  Attended
                                </>
                              ) : (
                                <>
                                  <XCircle size={12} />
                                  Absent (Excuse: {ownAttendance.excuse || 'None'})
                                </>
                              )}
                            </span>
                          )}

                          <span className="text-xs font-semibold text-gray-500 bg-gray-50 px-2.5 py-1 rounded-lg">
                            {totalAttended} / {totalLogged} Attended
                          </span>
                          
                          {isAdminOrMentor && (
                            <button
                              onClick={() => handleDeleteMeeting(meeting.id)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                              title="Delete past log"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </div>

                      {meeting.description && (
                        <p className="text-sm text-gray-600 mb-4 bg-gray-50/50 p-3 rounded-xl border border-gray-100/50">
                          {meeting.description}
                        </p>
                      )}

                      {/* Summary & Decisions */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                          <h4 className="font-bold text-xs text-slate-700 uppercase tracking-wider mb-2">Discussion Summary</h4>
                          <p className="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed">{meeting.summary || 'No summary recorded.'}</p>
                        </div>
                        <div className="bg-amber-50/50 border border-amber-100/50 rounded-xl p-4">
                          <h4 className="font-bold text-xs text-amber-800 uppercase tracking-wider mb-2">Decisions Taken</h4>
                          <p className="text-xs text-amber-900 whitespace-pre-wrap leading-relaxed">{meeting.decisions || 'No decisions logged.'}</p>
                        </div>
                      </div>

                      {/* Expandable Attendance Section — staff only. The roster
                          lists every Cube's absence excuse, which is not a Cube's
                          to read; the backend no longer sends it to them either. */}
                      {isAdminOrMentor && (
                      <div className="mt-4 pt-4 border-t border-gray-50">
                        <button
                          onClick={() => toggleExpand(meeting.id)}
                          className="flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-gray-800 transition"
                        >
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          {isExpanded ? 'Hide Attendance List' : 'View Attendance Details'}
                        </button>

                        {isExpanded && (
                          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                            <div>
                              <h5 className="font-bold text-xs text-emerald-700 flex items-center gap-1 mb-2">
                                <CheckCircle size={13} />
                                Attended ({attendees.length})
                              </h5>
                              {attendees.length === 0 ? (
                                <p className="text-xs text-gray-500 italic">None</p>
                              ) : (
                                <ul className="flex flex-wrap gap-1.5">
                                  {attendees.map((a: any) => (
                                    <li key={a.id} className="text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold px-2.5 py-1 rounded-lg border border-emerald-100/50 transition">
                                      <Link to={`/cubes/${a.cube?.id}`}>
                                        {a.cube?.user?.name || 'Unknown'}
                                      </Link>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>

                            <div>
                              <h5 className="font-bold text-xs text-red-700 flex items-center gap-1 mb-2">
                                <XCircle size={13} />
                                Absent ({absentees.length})
                              </h5>
                              {absentees.length === 0 ? (
                                <p className="text-xs text-gray-500 italic">None</p>
                              ) : (
                                <div className="flex flex-col gap-2">
                                  {absentees.map((a: any) => (
                                    <div key={a.id} className="bg-red-50/50 border border-red-100 p-2 rounded-lg flex flex-col gap-0.5">
                                      <Link to={`/cubes/${a.cube?.id}`} className="text-xs font-bold text-red-800 hover:text-magenta transition-colors">
                                        {a.cube?.user?.name || 'Unknown'}
                                      </Link>
                                      {a.excuse && (
                                        <span className="text-[11px] text-red-600 font-medium">Excuse: {a.excuse}</span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: Create Meeting */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl border border-gray-100 overflow-hidden transform transition duration-300">
            <div className="flex items-center justify-between bg-gray-50 px-6 py-4 border-b border-gray-100">
              <h3 className="font-extrabold text-gray-900 text-lg">Schedule New Meeting</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600 transition">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateMeeting} className="p-6 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-gray-700 uppercase">Meeting Title *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Weekly Sync, Project Alignment"
                  className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-gray-900 focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-gray-700 uppercase">Description / Details</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What is this meeting about?"
                  rows={3}
                  className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-gray-900 focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-gray-700 uppercase">Date & Time *</label>
                <input
                  type="datetime-local"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-gray-900 focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-gray-700 uppercase">Target Cubes (Optional)</label>
                  {selectedCubeIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedCubeIds([])}
                      className="text-[10px] text-magenta font-extrabold uppercase hover:underline"
                    >
                      Clear Selection ({selectedCubeIds.length})
                    </button>
                  )}
                </div>
                <div className="border border-gray-200 rounded-xl p-3 flex flex-col gap-2 bg-gray-50/50">
                  <input
                    type="text"
                    placeholder="Filter cubes by name..."
                    value={cubeSearch}
                    onChange={(e) => setCubeSearch(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs outline-none focus:border-magenta font-semibold"
                  />
                  <div className="max-h-36 overflow-y-auto divide-y divide-gray-100 flex flex-col gap-1 pr-1">
                    {cubes
                      .filter(c => (c.user?.name || '').toLowerCase().includes(cubeSearch.toLowerCase()))
                      .map((c) => {
                        const isSelected = selectedCubeIds.includes(c.id);
                        return (
                          <div
                            key={c.id}
                            onClick={() => {
                              setSelectedCubeIds(prev =>
                                prev.includes(c.id) ? prev.filter(id => id !== c.id) : [...prev, c.id]
                              );
                            }}
                            className="flex items-center gap-2 py-1.5 px-1 cursor-pointer hover:bg-white rounded transition"
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="w-3.5 h-3.5 rounded text-magenta border-gray-200 focus:ring-magenta cursor-pointer"
                            />
                            <span className="text-xs font-semibold text-gray-700">
                              {c.user?.name} <span className="text-[9px] text-gray-400 font-bold uppercase">(#{c.cube_number})</span>
                            </span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pl-1 select-none">
                <input
                  type="checkbox"
                  id="notify-meeting"
                  checked={notify}
                  onChange={(e) => setNotify(e.target.checked)}
                  className="w-4 h-4 rounded text-magenta border-gray-200 focus:ring-magenta cursor-pointer"
                />
                <label htmlFor="notify-meeting" className="text-xs text-gray-600 font-bold cursor-pointer">
                  Send notification to Cubes
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 mt-4 border-t border-gray-50 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-semibold text-sm hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2.5 rounded-xl bg-gray-950 text-white font-semibold text-sm hover:bg-black transition"
                >
                  Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Meeting */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between bg-gray-50 px-6 py-4 border-b border-gray-100">
              <h3 className="font-extrabold text-gray-900 text-lg">Edit Meeting</h3>
              <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-gray-600 transition">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleEditMeeting} className="p-6 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-gray-700 uppercase">Meeting Title *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-gray-900 focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-gray-700 uppercase">Description / Details</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-gray-900 focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-gray-700 uppercase">Date & Time *</label>
                <input
                  type="datetime-local"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-gray-900 focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-gray-700 uppercase">Target Cubes (Optional)</label>
                  {selectedCubeIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedCubeIds([])}
                      className="text-[10px] text-magenta font-extrabold uppercase hover:underline"
                    >
                      Clear Selection ({selectedCubeIds.length})
                    </button>
                  )}
                </div>
                <div className="border border-gray-200 rounded-xl p-3 flex flex-col gap-2 bg-gray-50/50">
                  <input
                    type="text"
                    placeholder="Filter cubes by name..."
                    value={cubeSearch}
                    onChange={(e) => setCubeSearch(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs outline-none focus:border-magenta font-semibold"
                  />
                  <div className="max-h-36 overflow-y-auto divide-y divide-gray-100 flex flex-col gap-1 pr-1">
                    {cubes
                      .filter(c => (c.user?.name || '').toLowerCase().includes(cubeSearch.toLowerCase()))
                      .map((c) => {
                        const isSelected = selectedCubeIds.includes(c.id);
                        return (
                          <div
                            key={c.id}
                            onClick={() => {
                              setSelectedCubeIds(prev =>
                                prev.includes(c.id) ? prev.filter(id => id !== c.id) : [...prev, c.id]
                              );
                            }}
                            className="flex items-center gap-2 py-1.5 px-1 cursor-pointer hover:bg-white rounded transition"
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="w-3.5 h-3.5 rounded text-magenta border-gray-200 focus:ring-magenta cursor-pointer"
                            />
                            <span className="text-xs font-semibold text-gray-700">
                              {c.user?.name} <span className="text-[9px] text-gray-400 font-bold uppercase">(#{c.cube_number})</span>
                            </span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 mt-4 border-t border-gray-50 pt-4">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-semibold text-sm hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2.5 rounded-xl bg-gray-950 text-white font-semibold text-sm hover:bg-black transition"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Complete Meeting & Log Attendance */}
      {showCompleteModal && selectedMeeting && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl border border-gray-100 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between bg-gray-50 px-6 py-4 border-b border-gray-100">
              <div>
                <h3 className="font-extrabold text-gray-900 text-lg">Complete Meeting</h3>
                <p className="text-xs text-gray-500 font-medium">Log meeting discussions and Cube attendance.</p>
              </div>
              <button onClick={() => setShowCompleteModal(false)} className="text-gray-400 hover:text-gray-600 transition">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCompleteMeeting} className="p-6 flex flex-col gap-5 overflow-y-auto">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-gray-700 uppercase">Discussion Summary *</label>
                <textarea
                  required
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="Record a summary of what was discussed..."
                  rows={4}
                  className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-gray-900 focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-gray-700 uppercase">Decisions Taken *</label>
                <textarea
                  required
                  value={decisions}
                  onChange={(e) => setDecisions(e.target.value)}
                  placeholder="Record key decisions, action items, and next steps..."
                  rows={3}
                  className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-gray-900 focus:outline-none"
                />
              </div>

              {/* Attendance checklist */}
              <div className="flex flex-col gap-3">
                <label className="text-xs font-bold text-gray-700 uppercase">Cube Attendance Checklist</label>
                <div className="border border-gray-100 rounded-xl overflow-hidden divide-y divide-gray-50 max-h-56 overflow-y-auto">
                  {Object.keys(attendance).length === 0 ? (
                    <p className="text-xs text-gray-500 italic p-4 text-center">No Cubes registered or assigned to this meeting.</p>
                  ) : (
                    cubes.filter(c => attendance[c.id] !== undefined).map((c) => {
                      const cubeAtt = attendance[c.id];
                      return (
                        <div key={c.id} className="p-3 bg-white hover:bg-slate-50/50 flex flex-col gap-2 transition">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-extrabold text-gray-800">
                              {c.user?.name} <span className="text-[10px] text-gray-400 font-bold ml-1">Cube #{c.cube_number}</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => setAttendance(prev => ({
                                ...prev,
                                [c.id]: { ...cubeAtt, attended: !cubeAtt.attended }
                              }))}
                              className={`text-[11px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 transition ${
                                cubeAtt.attended 
                                  ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100/50' 
                                  : 'bg-red-50 text-red-700 hover:bg-red-100/50'
                              }`}
                            >
                              {cubeAtt.attended ? <Check size={12} /> : <X size={12} />}
                              {cubeAtt.attended ? 'Attended' : 'Absent'}
                            </button>
                          </div>
                          {!cubeAtt.attended && (
                            <input
                              type="text"
                              value={cubeAtt.excuse}
                              onChange={(e) => setAttendance(prev => ({
                                ...prev,
                                [c.id]: { ...cubeAtt, excuse: e.target.value }
                              }))}
                              placeholder="Reason/Excuse for absence (optional)..."
                              className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-gray-900 focus:outline-none w-full"
                            />
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 mt-4 border-t border-gray-50 pt-4 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowCompleteModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-semibold text-sm hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-700 transition"
                >
                  Save Log & Complete
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
