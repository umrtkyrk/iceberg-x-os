import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { ShieldAlert, Plus, Calendar, Clock, Check } from 'lucide-react';

export const DemoDays: React.FC = () => {
  const { user } = useAuth();
  const [demoDays, setDemoDays] = useState<any[]>([]);
  const [missions, setMissions] = useState<any[]>([]);
  const [cubes, setCubes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Schedule Event Form
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [scheduleTitle, setScheduleTitle] = useState('');
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleDesc, setScheduleDesc] = useState('');
  const [scheduleSubmitting, setScheduleSubmitting] = useState(false);
  const [scheduleNotify, setScheduleNotify] = useState(false);

  // Log Presentation Form
  const [showPresForm, setShowPresForm] = useState(false);
  const [targetDayId, setTargetDayId] = useState('');
  const [presMissionId, setPresMissionId] = useState('');
  const [presPresenterId, setPresPresenterId] = useState('');
  const [presDecision, setPresDecision] = useState('Approved');
  const [presSummary, setPresSummary] = useState('');
  const [presSubmitting, setPresSubmitting] = useState(false);

  const fetchData = async () => {
    try {
      const [daysRes, missionsRes, cubesRes] = await Promise.all([
        api.get('/demodays'),
        api.get('/missions'),
        api.get('/cubes?active=true')
      ]);
      setDemoDays(daysRes);
      setMissions(missionsRes);
      setCubes(cubesRes);
      
      if (missionsRes.length > 0) setPresMissionId(missionsRes[0].id);
      if (cubesRes.length > 0) setPresPresenterId(cubesRes[0].user.id);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch demo days data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduleTitle || !scheduleDate) return;

    setScheduleSubmitting(true);
    try {
      await api.post('/demodays', {
        title: scheduleTitle,
        date: scheduleDate + '+03:00',
        description: scheduleDesc || undefined,
        notify: scheduleNotify
      });
      setScheduleTitle('');
      setScheduleDate('');
      setScheduleDesc('');
      setScheduleNotify(false);
      setShowScheduleForm(false);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to schedule demo day');
    } finally {
      setScheduleSubmitting(false);
    }
  };

  const handleOpenPres = (dayId: string) => {
    setTargetDayId(dayId);
    setPresSummary('');
    setPresDecision('Approved');
    setShowPresForm(true);
    setShowScheduleForm(false);
  };

  const handlePresSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetDayId || !presMissionId || !presPresenterId) return;

    setPresSubmitting(true);
    try {
      await api.post(`/demodays/${targetDayId}/presentations`, {
        mission_id: presMissionId,
        presenter_id: presPresenterId,
        decision: presDecision,
        mentor_summary: presSummary || undefined
      });
      setShowPresForm(false);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to record presentation');
    } finally {
      setPresSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-magenta border-t-transparent"></div>
      </div>
    );
  }

  const isMentorOrAdmin = user?.role === 'ADMIN' || user?.role === 'MENTOR';

  return (
    <div className="flex flex-col gap-6">
      
      {/* Header */}
      <div className="workspace-header">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Demo Days</h1>
          <p className="text-gray-500 mt-1">Scheduled R&D reviews, live product showcase details, and mentor summaries.</p>
        </div>
        {isMentorOrAdmin && (
          <button
            onClick={() => { setShowScheduleForm(!showScheduleForm); setShowPresForm(false); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-magenta text-white font-bold text-xs rounded-xl hover:bg-magenta-hover transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Schedule Event</span>
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 border border-red-100 p-4 rounded-2xl flex items-center gap-2 text-sm font-semibold">
          <ShieldAlert className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Forms Drawer */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* Schedule Demo Day form */}
        {showScheduleForm && (
          <form onSubmit={handleScheduleSubmit} className="bg-white border border-gray-100 p-6 rounded-3xl shadow-premium flex flex-col gap-4 animate-fadeIn">
            <h3 className="font-extrabold text-sm border-b border-gray-50 pb-2">Schedule Demo Day Event</h3>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase">Event Title</label>
              <input type="text" required placeholder="e.g. Summer 2026 Showcase" value={scheduleTitle} onChange={e => setScheduleTitle(e.target.value)} className="p-2 border border-gray-100 bg-gray-50 rounded-lg text-xs outline-none focus:border-magenta font-semibold" />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase">Event Date/Time</label>
              <input type="datetime-local" required value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} className="p-2 border border-gray-100 bg-gray-50 rounded-lg text-xs font-semibold outline-none focus:border-magenta" />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase">Description (Optional)</label>
              <textarea rows={2} placeholder="Write brief notes about goals or focus of the day..." value={scheduleDesc} onChange={e => setScheduleDesc(e.target.value)} className="p-2.5 border border-gray-100 bg-gray-50 rounded-lg text-xs outline-none focus:border-magenta resize-none font-semibold" />
            </div>
            <div className="flex items-center gap-2 pl-1 select-none">
              <input
                type="checkbox"
                id="notify-demoday"
                checked={scheduleNotify}
                onChange={(e) => setScheduleNotify(e.target.checked)}
                className="w-4 h-4 rounded text-magenta border-gray-200 focus:ring-magenta cursor-pointer"
              />
              <label htmlFor="notify-demoday" className="text-xs text-gray-600 font-bold cursor-pointer">
                Send notification to Cubes
              </label>
            </div>

            <button type="submit" disabled={scheduleSubmitting} className="w-full py-2 bg-magenta text-white font-bold text-xs rounded-xl hover:bg-magenta-hover transition-colors">
              {scheduleSubmitting ? 'Scheduling...' : 'Schedule Event'}
            </button>
          </form>
        )}

        {/* Log Presentation form */}
        {showPresForm && (
          <form onSubmit={handlePresSubmit} className="bg-white border border-gray-100 p-6 rounded-3xl shadow-premium flex flex-col gap-4 animate-fadeIn">
            <h3 className="font-extrabold text-sm border-b border-gray-50 pb-2">Log Demo Day Presentation</h3>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase">Presented Mission</label>
              <select value={presMissionId} onChange={e => setPresMissionId(e.target.value)} className="p-2 border border-gray-100 bg-gray-50 rounded-lg text-xs font-semibold outline-none">
                {missions.map(m => (
                  <option key={m.id} value={m.id}>{m.title}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase">Presenter Cube</label>
              <select value={presPresenterId} onChange={e => setPresPresenterId(e.target.value)} className="p-2 border border-gray-100 bg-gray-50 rounded-lg text-xs font-semibold outline-none">
                {cubes.map(c => (
                  <option key={c.id} value={c.user.id}>Cube #{c.cube_number} - {c.user.name}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase">Committee Decision</label>
              <select value={presDecision} onChange={e => setPresDecision(e.target.value)} className="p-2 border border-gray-100 bg-gray-50 rounded-lg text-xs font-semibold outline-none">
                <option value="Approved">Approved for backlog</option>
                <option value="Needs Revision">Needs Revision</option>
                <option value="Deferred">Deferred</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase">Mentor Summary Comments</label>
              <textarea required rows={2} placeholder="Summarize presentation outcomes, feedback, and key highlights..." value={presSummary} onChange={e => setPresSummary(e.target.value)} className="p-2.5 border border-gray-100 bg-gray-50 rounded-lg text-xs outline-none focus:border-magenta resize-none font-semibold" />
            </div>

            <button type="submit" disabled={presSubmitting} className="w-full py-2 bg-gray-900 text-white font-bold text-xs rounded-xl hover:bg-black transition-colors">
              {presSubmitting ? 'Logging...' : 'Log Presentation Details'}
            </button>
          </form>
        )}
      </div>

      {/* Grid of Scheduled events */}
      <div className="flex flex-col gap-6">
        {demoDays.map((day) => {
          const isUpcoming = new Date(day.date) >= new Date();

          return (
            <div key={day.id} className="bg-white border border-gray-100 rounded-3xl p-6 sm:p-8 shadow-subtle flex flex-col gap-5">
              
              {/* Day Header */}
              <div className="flex justify-between items-start border-b border-gray-50 pb-3">
                <div>
                  <h3 className="font-extrabold text-base text-gray-900 leading-snug">{day.title}</h3>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-magenta mt-1">
                    <Calendar className="w-4 h-4" />
                    <span>{new Date(day.date).toLocaleString()}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase ${isUpcoming ? 'bg-magenta/5 border border-magenta/10 text-magenta' : 'bg-gray-100 border border-gray-200 text-gray-400'}`}>
                    {isUpcoming ? 'Upcoming' : 'Completed'}
                  </span>
                  {isMentorOrAdmin && (
                    <button
                      onClick={() => handleOpenPres(day.id)}
                      className="text-xs font-bold text-magenta hover:underline bg-magenta/5 border border-magenta/10 px-2 py-0.5 rounded-full"
                    >
                      + Log Presentation
                    </button>
                  )}
                </div>
              </div>

              {day.description && <p className="text-xs text-gray-500 font-medium leading-relaxed italic">"{day.description}"</p>}

              {/* Presentations list */}
              <div className="flex flex-col gap-3 pt-2">
                <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">
                  Presentations logged ({day.presentations?.length || 0})
                </p>

                {day.presentations && day.presentations.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {day.presentations.map((pres: any) => (
                      <div key={pres.id} className="border border-gray-100 bg-gray-50/30 p-4 rounded-xl flex flex-col gap-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-bold text-xs text-gray-900 leading-snug">{pres.mission.title}</h4>
                            <p className="text-[10px] text-gray-400 mt-0.5">
                              Presenter:{' '}
                              {pres.presenter.cube_profile?.id ? (
                                <Link to={`/cubes/${pres.presenter.cube_profile.id}`} className="font-bold text-gray-600 hover:text-magenta transition-colors">
                                  {pres.presenter.name}
                                </Link>
                              ) : (
                                <span className="font-bold text-gray-600">{pres.presenter.name}</span>
                              )}
                            </p>
                          </div>
                          <span className="text-[9px] font-extrabold bg-green-50 border border-green-100 text-green-700 px-2 py-0.5 rounded-full uppercase">
                            {pres.decision}
                          </span>
                        </div>
                        {pres.mentor_summary && (
                          <p className="text-xs text-gray-500 italic mt-1 leading-relaxed">
                            "{pres.mentor_summary}"
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic">No presentations logged for this demo day.</p>
                )}
              </div>

            </div>
          );
        })}
      </div>

    </div>
  );
};
