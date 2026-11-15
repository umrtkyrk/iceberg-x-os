import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { api } from '../utils/api';
import { RubricRatings, type RatingState, type RubricCriterion } from './RubricRatings';

/**
 * Scoring v2 check-in (mentor, counts at half the weight of a scorecard) or
 * self-assessment (the Cube, never counts towards the score). Same rubric as
 * the scorecard.
 */
export const CheckInModal: React.FC<{
  kind: 'checkin' | 'self';
  cubeProfileId: string;
  cubeName: string;
  disciplineId: string | null;
  onClose: () => void;
  onSaved: () => void;
}> = ({ kind, cubeProfileId, cubeName, disciplineId, onClose, onSaved }) => {
  const [criteria, setCriteria] = useState<RubricCriterion[]>([]);
  const [ratings, setRatings] = useState<RatingState>({});
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get<RubricCriterion[]>(`/scoring/criteria${disciplineId ? `?discipline_id=${disciplineId}` : ''}`)
      .then(setCriteria)
      .catch((err: any) => setError(err.message || 'Could not load the criteria.'));
  }, [disciplineId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const unanswered = criteria.filter(c => !(c.id in ratings));
  const title = kind === 'self' ? 'Rate yourself' : `Check in on ${cubeName}`;

  const save = async () => {
    if (unanswered.length > 0) {
      setError(`Rate or mark as not observed: ${unanswered.map(c => c.name).join(', ')}.`);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.post('/check-ins', {
        kind,
        cube_profile_id: cubeProfileId,
        note: note.trim() || undefined,
        ratings: criteria.map(c => ({ criterion_id: c.id, value: ratings[c.id] })),
      });
      onSaved();
    } catch (err: any) {
      setError(err.message || 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:p-8" role="dialog" aria-modal="true" aria-label={title}>
      <div className="w-full max-w-2xl rounded-3xl border border-gray-100 bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold text-gray-900">{title}</h2>
            <p className="text-xs font-medium text-gray-500">
              {kind === 'self'
                ? 'How do you see yourself on the same rubric your mentor uses? This never changes your score; it is shown next to your mentor’s view.'
                : 'A short rating between scorecards. It counts at half the weight of a scorecard.'}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
            <X className="h-4 w-4" />
          </button>
        </div>

        <RubricRatings
          criteria={criteria}
          value={ratings}
          onRate={(criterionId, level) => setRatings(prev => ({ ...prev, [criterionId]: level }))}
          disabled={saving}
        />

        <label className="mt-4 flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase text-gray-500">{kind === 'self' ? 'Anything to add (optional)' : 'Note (optional)'}</span>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={3}
            maxLength={2000}
            className="rounded-xl border border-gray-200 bg-white p-2.5 text-xs font-medium outline-none focus:border-magenta"
          />
        </label>

        {error && <p className="mt-3 rounded-xl border border-red-100 bg-red-50 p-3 text-xs font-semibold text-red-600">{error}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-extrabold text-gray-600 hover:border-gray-300">
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving || criteria.length === 0}
            className="rounded-xl bg-magenta px-4 py-2 text-xs font-extrabold text-white hover:bg-magenta-hover disabled:opacity-40"
          >
            {saving ? 'Saving…' : kind === 'self' ? 'Save my ratings' : 'Save check-in'}
          </button>
        </div>
      </div>
    </div>
  );
};
