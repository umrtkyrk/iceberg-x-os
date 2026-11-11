import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowDown, ArrowLeft, ArrowUp, Mic, Plus, Save, X } from 'lucide-react';
import { api } from '../utils/api';
import { PageHeader } from '../components/PageHeader';
import { MarkdownEditor } from '../components/MarkdownEditor';
import { UserAvatar } from '../components/UserAvatar';
import {
  Speaker,
  Webinar,
  fromIstanbulInput,
  speakerLine,
  toIstanbulInput
} from '../utils/webinars';

const inputClass =
  'border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-gray-900 focus:outline-none w-full';
const labelClass = 'text-xs font-bold text-gray-700 uppercase';

/** The default deadline: 24 hours before the start. */
const dayBefore = (local: string) => {
  if (!local) return '';
  const d = new Date(fromIstanbulInput(local));
  return toIstanbulInput(new Date(d.getTime() - 24 * 3600 * 1000).toISOString());
};

export const WebinarEdit: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const isNew = !id;
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [allSpeakers, setAllSpeakers] = useState<Speaker[]>([]);
  const [cubes, setCubes] = useState<any[]>([]);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [closeAt, setCloseAt] = useState('');
  const [closeTouched, setCloseTouched] = useState(false);
  const [duration, setDuration] = useState(60);
  const [meetingUrl, setMeetingUrl] = useState('');
  const [recordingUrl, setRecordingUrl] = useState('');
  const [slidesUrl, setSlidesUrl] = useState('');
  const [summary, setSummary] = useState('');
  const [speakerIds, setSpeakerIds] = useState<string[]>([]);
  const [invited, setInvited] = useState<string[]>([]);
  const [cubeSearch, setCubeSearch] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const [speakers, cubeList, webinar] = await Promise.all([
          api.get<Speaker[]>('/webinar-speakers'),
          api.get<any[]>('/cubes?active=true'),
          isNew ? Promise.resolve(null) : api.get<Webinar>(`/webinars/${id}`)
        ]);
        setAllSpeakers(speakers);
        setCubes(cubeList);
        if (webinar) {
          setTitle(webinar.title);
          setDescription(webinar.description || '');
          setDate(toIstanbulInput(webinar.date));
          setCloseAt(toIstanbulInput(webinar.questions_close_at));
          setCloseTouched(true);
          setDuration(webinar.duration_minutes || 60);
          setMeetingUrl(webinar.meeting_url || '');
          setRecordingUrl(webinar.recording_url || '');
          setSlidesUrl(webinar.slides_url || '');
          setSummary(webinar.summary || '');
          setSpeakerIds((webinar.speakers || []).map(s => s.id));
          setInvited(webinar.invited_cube_ids || []);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, isNew]);

  const speakerById = useMemo(() => new Map(allSpeakers.map(s => [s.id, s])), [allSpeakers]);
  const availableSpeakers = allSpeakers.filter(s => !speakerIds.includes(s.id));
  const filteredCubes = cubes.filter(c =>
    (c?.user?.name || '').toLowerCase().includes(cubeSearch.toLowerCase()) ||
    (c?.cube_number || '').includes(cubeSearch)
  );

  const moveSpeaker = (index: number, delta: number) => {
    setSpeakerIds(prev => {
      const next = [...prev];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const onDateChange = (value: string) => {
    setDate(value);
    if (!closeTouched) setCloseAt(dayBefore(value));
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const payload = {
      title,
      description,
      date: fromIstanbulInput(date),
      questions_close_at: closeAt ? fromIstanbulInput(closeAt) : null,
      duration_minutes: duration,
      meeting_url: meetingUrl,
      recording_url: recordingUrl,
      slides_url: slidesUrl,
      summary,
      speaker_ids: speakerIds,
      invited_cube_ids: invited
    };
    try {
      const saved = isNew
        ? await api.post<Webinar>('/webinars', payload)
        : await api.put<Webinar>(`/webinars/${id}`, payload);
      navigate(`/webinars/${saved.id}`);
    } catch (err: any) {
      setError(err.message || 'Could not save the webinar');
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-10 h-10 border-4 border-gray-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-6">
      <Link to={isNew ? '/webinars' : `/webinars/${id}`} className="text-sm font-bold text-gray-500 hover:text-gray-800 flex items-center gap-1 w-fit">
        <ArrowLeft size={16} /> Back
      </Link>
      <PageHeader
        eyebrow="Webinars"
        title={isNew ? 'New webinar' : 'Edit webinar'}
        description="New webinars start as drafts. Cubes see them, and get notified, only when you publish."
      />

      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-xl border border-red-100 flex items-center gap-3">
          <AlertTriangle className="shrink-0" /> <p className="font-medium text-sm">{error}</p>
        </div>
      )}

      <form onSubmit={save} className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 flex flex-col gap-6">
          <section className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className={labelClass}>Title *</label>
              <input required value={title} onChange={e => setTitle(e.target.value)} className={inputClass} placeholder="e.g. From engineer to CTO: what nobody tells you" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelClass}>About this webinar</label>
              <MarkdownEditor value={description} onChange={setDescription} rows={5} placeholder="What will the talk cover? Why this speaker?" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className={labelClass}>Date & time (TSİ) *</label>
                <input type="datetime-local" required value={date} onChange={e => onDateChange(e.target.value)} className={inputClass} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelClass}>Question deadline</label>
                <input
                  type="datetime-local"
                  value={closeAt}
                  onChange={e => { setCloseAt(e.target.value); setCloseTouched(true); }}
                  className={inputClass}
                />
                <span className="text-[11px] text-gray-400">Defaults to 24 hours before the start.</span>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelClass}>Duration (min)</label>
                <input type="number" min={15} max={600} value={duration} onChange={e => setDuration(Number(e.target.value))} className={inputClass} />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelClass}>Meeting link</label>
              <input value={meetingUrl} onChange={e => setMeetingUrl(e.target.value)} className={inputClass} placeholder="https://zoom.us/j/..." />
              <span className="text-[11px] text-gray-400">Shown to invited Cubes once the webinar is published.</span>
            </div>
          </section>

          <section className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="font-extrabold text-gray-900 flex items-center gap-2"><Mic size={18} /> Speakers</h2>
              <Link to="/webinars/speakers" className="text-xs font-bold text-[#e6007e] flex items-center gap-1">
                <Plus size={14} /> Add or edit speakers
              </Link>
            </div>
            {speakerIds.length === 0 && <p className="text-sm text-gray-400 italic">No speaker selected. A webinar needs at least one to be published.</p>}
            <ul className="flex flex-col gap-2">
              {speakerIds.map((sid, index) => {
                const s = speakerById.get(sid);
                return (
                  <li key={sid} className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
                    <UserAvatar name={s?.name || '?'} avatarUrl={s?.photo_url} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-gray-900">{s?.name || 'Unknown speaker'}</p>
                      <p className="text-xs text-gray-500 truncate">{s ? speakerLine(s) : ''}</p>
                    </div>
                    <button type="button" onClick={() => moveSpeaker(index, -1)} className="p-1.5 text-gray-400 hover:text-gray-700" title="Move up"><ArrowUp size={14} /></button>
                    <button type="button" onClick={() => moveSpeaker(index, 1)} className="p-1.5 text-gray-400 hover:text-gray-700" title="Move down"><ArrowDown size={14} /></button>
                    <button type="button" onClick={() => setSpeakerIds(prev => prev.filter(x => x !== sid))} className="p-1.5 text-gray-400 hover:text-red-600" title="Remove"><X size={14} /></button>
                  </li>
                );
              })}
            </ul>
            {availableSpeakers.length > 0 && (
              <select
                value=""
                onChange={e => e.target.value && setSpeakerIds(prev => [...prev, e.target.value])}
                className={inputClass}
              >
                <option value="">+ Add a speaker…</option>
                {availableSpeakers.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name}{speakerLine(s) ? ` · ${speakerLine(s)}` : ''}
                  </option>
                ))}
              </select>
            )}
          </section>

          <section className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 flex flex-col gap-4">
            <h2 className="font-extrabold text-gray-900">After the webinar</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className={labelClass}>Recording link</label>
                <input value={recordingUrl} onChange={e => setRecordingUrl(e.target.value)} className={inputClass} placeholder="https://" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelClass}>Slides link</label>
                <input value={slidesUrl} onChange={e => setSlidesUrl(e.target.value)} className={inputClass} placeholder="https://" />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelClass}>Summary / key takeaways</label>
              <MarkdownEditor value={summary} onChange={setSummary} rows={4} />
            </div>
          </section>
        </div>

        <aside className="flex flex-col gap-4">
          <section className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="font-extrabold text-gray-900 text-sm">Invited Cubes</h2>
              {invited.length > 0 && (
                <button type="button" onClick={() => setInvited([])} className="text-xs font-bold text-gray-500 hover:text-gray-800">Clear</button>
              )}
            </div>
            <p className="text-xs text-gray-500">
              {invited.length === 0
                ? 'Nobody selected: every Cube in the programme is invited and must send a question.'
                : `${invited.length} Cube(s) invited.`}
            </p>
            <input value={cubeSearch} onChange={e => setCubeSearch(e.target.value)} placeholder="Search by name or number" className={inputClass} />
            <div className="max-h-80 overflow-y-auto flex flex-col gap-1">
              {filteredCubes.map(c => (
                <label key={c.id} className="flex items-center gap-2 text-sm px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={invited.includes(c.id)}
                    onChange={e =>
                      setInvited(prev => (e.target.checked ? [...prev, c.id] : prev.filter(x => x !== c.id)))
                    }
                  />
                  <span className="truncate">{c?.user?.name || 'Unknown'}</span>
                  <span className="text-xs text-gray-400 ml-auto">#{c?.cube_number || ''}</span>
                </label>
              ))}
            </div>
          </section>

          <button type="submit" disabled={saving} className="inline-flex items-center justify-center gap-2 font-bold bg-[#e6007e] text-white px-4 py-3 rounded-xl hover:bg-[#c9006e] disabled:opacity-50">
            <Save size={16} /> {saving ? 'Saving…' : isNew ? 'Create draft' : 'Save changes'}
          </button>
        </aside>
      </form>
    </div>
  );
};
