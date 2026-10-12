import React, { useState } from 'react';
import { X, Check, Wand2 } from 'lucide-react';
import { BadgeIconPicker } from './BadgeIconPicker';
import { BadgeMedal } from './BadgeMedal';
import { RARITIES, getRarityMeta } from '../utils/badgeRarity';
import { resolveIconKey } from '../utils/badgeIcons';

export interface BadgeDraft {
  id?: string;
  name: string;
  description: string;
  icon: string;
  rarity: string;
}

/**
 * Create-or-edit form for a badge definition, with a live preview beside the
 * controls so the frame, icon and rarity are judged as the finished object.
 */
export const BadgeDesigner: React.FC<{
  initial?: Partial<BadgeDraft>;
  submitting?: boolean;
  onSubmit: (draft: BadgeDraft) => void;
  onCancel: () => void;
}> = ({ initial, submitting, onSubmit, onCancel }) => {
  const isEditing = !!initial?.id;

  const [name, setName] = useState(initial?.name || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [icon, setIcon] = useState(resolveIconKey(initial?.icon));
  const [rarity, setRarity] = useState(initial?.rarity || 'Common');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !description.trim()) return;
    onSubmit({ id: initial?.id, name: name.trim(), description: description.trim(), icon, rarity });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white border border-gray-100 rounded-3xl p-6 shadow-premium flex flex-col gap-5 animate-fadeIn"
    >
      <div className="flex items-center justify-between border-b border-gray-50 pb-3">
        <h3 className="font-extrabold text-sm flex items-center gap-2">
          <Wand2 className="w-4 h-4 text-magenta" />
          {isEditing ? `Edit “${initial?.name}”` : 'Design a New Badge'}
        </h3>
        <button
          type="button"
          onClick={onCancel}
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_260px] gap-6">
        {/* Controls */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Badge Name</label>
            <input
              type="text"
              required
              maxLength={60}
              placeholder="e.g. Architect"
              value={name}
              onChange={e => setName(e.target.value)}
              className="p-2.5 border border-gray-100 bg-gray-50 rounded-lg text-xs outline-none focus:border-magenta font-semibold"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Description</label>
            <textarea
              required
              rows={2}
              placeholder="What does a Cube have to do to earn this?"
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="p-2.5 border border-gray-100 bg-gray-50 rounded-lg text-xs outline-none focus:border-magenta resize-none font-semibold"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Rarity</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {RARITIES.map(r => {
                const meta = getRarityMeta(r);
                const isSelected = rarity === r;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRarity(r)}
                    title={meta.hint}
                    className={`py-2 px-2 rounded-xl border text-[11px] font-extrabold uppercase tracking-wider transition-all ${
                      isSelected
                        ? 'border-magenta bg-magenta/5 text-magenta ring-1 ring-magenta/20'
                        : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    {meta.label}
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-gray-400 font-semibold leading-relaxed">
              {getRarityMeta(rarity).hint}
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Icon</label>
            <BadgeIconPicker value={icon} rarity={rarity} onChange={setIcon} />
          </div>
        </div>

        {/* Live preview */}
        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Live Preview</label>
          <BadgeMedal
            badge={{
              name: name.trim() || 'Badge Name',
              description: description.trim() || 'What a Cube has to do to earn this badge.',
              icon,
              rarity
            }}
          />
          <p className="text-[10px] text-gray-400 font-semibold leading-relaxed">
            The frame, glow and motion all come from the rarity — this is exactly how
            it will appear on a Cube's profile.
          </p>
        </div>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full py-2.5 bg-gray-900 text-white font-bold text-xs rounded-xl hover:bg-black transition-colors disabled:opacity-70 flex items-center justify-center gap-1.5"
      >
        <Check className="w-4 h-4" />
        {submitting
          ? 'Saving…'
          : isEditing
            ? 'Save Changes'
            : 'Create Badge Definition'}
      </button>
    </form>
  );
};
