import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Camera, Edit3, Linkedin, Plus, Trash2, X } from 'lucide-react';
import { api } from '../utils/api';
import { PageHeader } from '../components/PageHeader';
import { MarkdownEditor } from '../components/MarkdownEditor';
import { UserAvatar } from '../components/UserAvatar';
import { CareerEntry, Speaker, speakerLine } from '../utils/webinars';

const inputClass =
  'border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-gray-900 focus:outline-none w-full';
const labelClass = 'text-xs font-bold text-gray-700 uppercase';

const emptyCareer = (): CareerEntry => ({ title: '', company: '', period: '', description: '' });

const readAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read the image'));
    reader.readAsDataURL(file);
  });

const SpeakerForm: React.FC<{
  speaker: Speaker | null;
  onClose: () => void;
  onSaved: () => void;
}> = ({ speaker, onClose, onSaved }) => {
  const [name, setName] = useState(speaker?.name || '');
  const [headline, setHeadline] = useState(speaker?.headline || '');
  const [company, setCompany] = useState(speaker?.company || '');
  const [linkedin, setLinkedin] = useState(speaker?.linkedin_url || '');
  const [website, setWebsite] = useState(speaker?.website_url || '');
  const [bio, setBio] = useState(speaker?.bio || '');
  const [expertise, setExpertise] = useState((speaker?.expertise || []).join(', '));
  const [career, setCareer] = useState<CareerEntry[]>(
    Array.isArray(speaker?.career) && speaker!.career!.length > 0 ? speaker!.career! : [emptyCareer()]
  );
  const [photo, setPhoto] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const updateCareer = (index: number, field: keyof CareerEntry, value: string) =>
    setCareer(prev => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));

  const pickPhoto = async (file?: File | null) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('The image must be smaller than 5 MB.');
      return;
    }
    setPhoto(await readAsDataUrl(file));
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const payload = {
      name,
      headline,
      company,
      linkedin_url: linkedin,
      website_url: website,
      bio,
      expertise,
      career
    };
    try {
      const saved = speaker
        ? await api.put<Speaker>(`/webinar-speakers/${speaker.id}`, payload)
        : await api.post<Speaker>('/webinar-speakers', payload);
      if (photo) {
        await api.post(`/webinar-speakers/${saved.id}/photo`, { photo_base64: photo });
      }
      onSaved();
    } catch (err: any) {
      setError(err.message || 'Could not save the speaker');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl shadow-xl border border-gray-100 max-h-[92vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between bg-gray-50 px-6 py-4 border-b border-gray-100">
          <h3 className="font-extrabold text-gray-900 text-lg">{speaker ? 'Edit speaker' : 'New speaker'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <form onSubmit={save} className="p-6 flex flex-col gap-4 overflow-y-auto">
          {error && (
            <div className="bg-red-50 text-red-700 p-3 rounded-xl border border-red-100 text-sm flex items-center gap-2">
              <AlertTriangle size={16} className="shrink-0" /> {error}
            </div>
          )}

          <div className="flex items-center gap-4">
            {photo ? (
              <img src={photo} alt="" className="w-24 h-24 rounded-full object-cover" />
            ) : (
              <UserAvatar name={name || '?'} avatarUrl={speaker?.photo_url} size="xl" />
            )}
            <div className="flex flex-col gap-1">
              <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1.5 text-xs font-bold bg-gray-100 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-200">
                <Camera size={14} /> {speaker?.photo_url || photo ? 'Change photo' : 'Upload photo'}
              </button>
              <span className="text-[11px] text-gray-400">PNG, JPEG or WEBP, up to 5 MB.</span>
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={e => pickPhoto(e.target.files?.[0])} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className={labelClass}>Name *</label>
              <input required value={name} onChange={e => setName(e.target.value)} className={inputClass} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelClass}>Current role</label>
              <input value={headline} onChange={e => setHeadline(e.target.value)} className={inputClass} placeholder="VP of Engineering" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelClass}>Company</label>
              <input value={company} onChange={e => setCompany(e.target.value)} className={inputClass} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className={labelClass}>LinkedIn</label>
              <input value={linkedin} onChange={e => setLinkedin(e.target.value)} className={inputClass} placeholder="https://www.linkedin.com/in/..." />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelClass}>Website</label>
              <input value={website} onChange={e => setWebsite(e.target.value)} className={inputClass} placeholder="https://" />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className={labelClass}>Expertise (comma separated)</label>
            <input value={expertise} onChange={e => setExpertise(e.target.value)} className={inputClass} placeholder="Product, Leadership, Fintech" />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className={labelClass}>Biography</label>
            <MarkdownEditor value={bio} onChange={setBio} rows={6} placeholder="Who they are, what they have built, why Cubes should listen." />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className={labelClass}>Career (most recent first)</label>
              <button type="button" onClick={() => setCareer(prev => [...prev, emptyCareer()])} className="text-xs font-bold text-[#e6007e] flex items-center gap-1">
                <Plus size={14} /> Add role
              </button>
            </div>
            {career.map((row, i) => (
              <div key={i} className="bg-gray-50 rounded-xl p-3 grid grid-cols-1 md:grid-cols-[1fr_1fr_10rem_auto] gap-2 items-start">
                <input value={row.title} onChange={e => updateCareer(i, 'title', e.target.value)} className={inputClass} placeholder="Role" />
                <input value={row.company} onChange={e => updateCareer(i, 'company', e.target.value)} className={inputClass} placeholder="Company" />
                <input value={row.period} onChange={e => updateCareer(i, 'period', e.target.value)} className={inputClass} placeholder="2019 – 2023" />
                <button type="button" onClick={() => setCareer(prev => prev.filter((_, j) => j !== i))} className="p-2 text-gray-400 hover:text-red-600" title="Remove">
                  <Trash2 size={15} />
                </button>
                <input value={row.description} onChange={e => updateCareer(i, 'description', e.target.value)} className={`${inputClass} md:col-span-4`} placeholder="One line on what they did there (optional)" />
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="text-sm font-bold text-gray-500 px-4 py-2 rounded-xl hover:bg-gray-100">Cancel</button>
            <button type="submit" disabled={saving} className="text-sm font-bold bg-[#e6007e] text-white px-5 py-2 rounded-xl hover:bg-[#c9006e] disabled:opacity-50">
              {saving ? 'Saving…' : 'Save speaker'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const WebinarSpeakers: React.FC = () => {
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Speaker | null | undefined>(undefined);

  const load = async () => {
    try {
      setSpeakers(await api.get<Speaker[]>('/webinar-speakers'));
    } catch (err: any) {
      setError(err.message || 'Failed to load speakers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const remove = async (s: Speaker) => {
    if (!window.confirm(`Delete ${s.name}?`)) return;
    try {
      await api.delete(`/webinar-speakers/${s.id}`);
      load();
    } catch (err: any) {
      alert(err.message || 'Could not delete the speaker');
    }
  };

  return (
    <div className="w-full flex flex-col gap-6">
      <Link to="/webinars" className="text-sm font-bold text-gray-500 hover:text-gray-800 flex items-center gap-1 w-fit">
        <ArrowLeft size={16} /> Webinars
      </Link>
      <PageHeader
        eyebrow="Webinars"
        title="Speakers"
        description="Guest speakers are entered once and can be added to any number of webinars."
      >
        <button onClick={() => setEditing(null)} className="workspace-primary-action">
          <Plus size={16} /> New speaker
        </button>
      </PageHeader>

      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-xl border border-red-100 text-sm font-medium">{error}</div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-10 h-10 border-4 border-gray-900 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : speakers.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-2xl p-8 text-center text-gray-500 shadow-sm text-sm">
          No speakers yet. Add the first one to plan a webinar.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {speakers.map(s => (
            <div key={s.id} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm flex gap-4">
              <UserAvatar name={s?.name || '?'} avatarUrl={s?.photo_url} size="lg" className="shrink-0" />
              <div className="min-w-0 flex-1 flex flex-col gap-1">
                <p className="font-extrabold text-gray-900 truncate">{s.name}</p>
                <p className="text-xs text-gray-500 line-clamp-2 min-h-[2rem]">{speakerLine(s)}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[11px] font-bold bg-gray-50 text-gray-600 px-2 py-0.5 rounded">
                    {s._count?.webinars || 0} webinar(s)
                  </span>
                  {s.linkedin_url && (
                    <a href={s.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-[#0a66c2]" title="LinkedIn">
                      <Linkedin size={14} />
                    </a>
                  )}
                  <div className="ml-auto flex gap-1">
                    <button onClick={() => setEditing(s)} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg" title="Edit"><Edit3 size={14} /></button>
                    <button onClick={() => remove(s)} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg" title="Delete"><Trash2 size={14} /></button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing !== undefined && (
        <SpeakerForm
          speaker={editing}
          onClose={() => setEditing(undefined)}
          onSaved={() => {
            setEditing(undefined);
            load();
          }}
        />
      )}
    </div>
  );
};
