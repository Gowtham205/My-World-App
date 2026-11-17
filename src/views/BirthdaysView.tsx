import React, { useMemo, useState } from 'react';
import { Bell, Cake, Copy, Plus, Share2, Trash2 } from 'lucide-react';
import type { BirthdayEntry, BirthdayOffset, OffsetUnit } from '../types/sanctuary';
import { createId } from '../lib/storage';
import { formatShortDate, getDaysUntilBirthday } from '../lib/dateUtils';

interface BirthdaysViewProps {
  birthdays: BirthdayEntry[];
  onSaveBirthday: (entry: BirthdayEntry) => Promise<void>;
  onDeleteBirthday: (id: string) => Promise<void>;
}

export const BirthdaysView: React.FC<BirthdaysViewProps> = ({
  birthdays,
  onSaveBirthday,
  onDeleteBirthday,
}) => {
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [relationship, setRelationship] = useState('Friend');
  const [wishTemplate, setWishTemplate] = useState('');
  const [offsets, setOffsets] = useState<BirthdayOffset[]>([
    { id: createId('off'), value: 1, unit: 'days' },
  ]);
  const [offsetVal, setOffsetVal] = useState(2);
  const [offsetUnit, setOffsetUnit] = useState<OffsetUnit>('hours');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const sortedBirthdays = useMemo(() => {
    return [...birthdays]
      .map((entry) => ({ entry, info: getDaysUntilBirthday(entry.birthDate) }))
      .sort((a, b) => a.info.daysUntil - b.info.daysUntil);
  }, [birthdays]);

  const addOffset = () => {
    if (offsetVal <= 0) return;
    setOffsets((prev) => [
      ...prev,
      { id: createId('off'), value: offsetVal, unit: offsetUnit },
    ]);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !birthDate) return;

    await onSaveBirthday({
      id: createId('bday'),
      name: name.trim(),
      birthDate,
      relationship: relationship.trim() || 'Friend',
      wishTemplate:
        wishTemplate.trim() ||
        `Happy Birthday, ${name.trim()}! Wishing you joy, calm, and wonderful memories ahead.`,
      offsets,
      createdAt: new Date().toISOString(),
    });

    setName('');
    setBirthDate('');
    setWishTemplate('');
    setOffsets([{ id: createId('off'), value: 1, unit: 'days' }]);
    setShowAdd(false);
  };

  const handleCopyWish = async (entry: BirthdayEntry) => {
    try {
      await navigator.clipboard.writeText(entry.wishTemplate);
      setCopiedId(entry.id);
      setTimeout(() => setCopiedId(null), 1600);
    } catch {
      // ignore clipboard restriction
    }
  };

  const handleShareWish = async (entry: BirthdayEntry) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Birthday Wish for ${entry.name}`,
          text: entry.wishTemplate,
        });
        return;
      } catch {
        // fallback to copy
      }
    }
    await handleCopyWish(entry);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-xs text-[#F2B8A2]">Birthday Tracker & Wishes</p>
          <h1 className="font-display text-2xl sm:text-3xl font-medium text-[#F1F3F6] mt-1">
            People Who Matter
          </h1>
        </div>
        <button
          type="button"
          onClick={() => setShowAdd((v) => !v)}
          className="min-h-[44px] px-5 py-2.5 rounded-2xl bg-[#F2B8A2] hover:bg-[#E7A890] text-[#0F1115] text-sm font-semibold flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          Add Birthday
        </button>
      </header>

      {showAdd && (
        <form
          onSubmit={handleCreate}
          className="rounded-3xl bg-[#171A21] border border-[#F2B8A2]/30 p-5 sm:p-7 space-y-4"
        >
          <h2 className="text-base font-semibold text-[#F1F3F6]">Track Birthday & Alert Offsets</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Person's name"
              className="min-h-[44px] px-4 rounded-2xl bg-[#1D212A] border border-white/[0.08] text-sm text-[#F1F3F6]"
            />
            <input
              type="date"
              required
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              className="min-h-[44px] px-4 rounded-2xl bg-[#1D212A] border border-white/[0.08] text-sm text-[#F1F3F6]"
            />
            <input
              type="text"
              value={relationship}
              onChange={(e) => setRelationship(e.target.value)}
              placeholder="Relationship (e.g. Family, Friend)"
              className="min-h-[44px] px-4 rounded-2xl bg-[#1D212A] border border-white/[0.08] text-sm text-[#F1F3F6]"
            />
          </div>

          <textarea
            rows={3}
            value={wishTemplate}
            onChange={(e) => setWishTemplate(e.target.value)}
            placeholder="Pre-write a thoughtful birthday wish for one-tap copy or sharing..."
            className="w-full p-4 rounded-2xl bg-[#1D212A] border border-white/[0.08] text-sm text-[#F1F3F6]"
          />

          {/* Customizable Notification Engine Offsets */}
          <div className="space-y-2.5">
            <p className="text-xs text-[#98A2B3]">
              Linked Notification Engine (notify before birthday)
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="number"
                min={1}
                value={offsetVal}
                onChange={(e) => setOffsetVal(Number(e.target.value))}
                className="w-20 min-h-[40px] px-3 rounded-xl bg-[#1D212A] border border-white/[0.08] text-xs text-[#F1F3F6] font-mono-tabular"
              />
              <select
                value={offsetUnit}
                onChange={(e) => setOffsetUnit(e.target.value as OffsetUnit)}
                className="min-h-[40px] px-3 rounded-xl bg-[#1D212A] border border-white/[0.08] text-xs text-[#F1F3F6]"
              >
                <option value="minutes">minutes before</option>
                <option value="hours">hours before</option>
                <option value="days">days before</option>
              </select>
              <button
                type="button"
                onClick={addOffset}
                className="min-h-[40px] px-3.5 rounded-xl bg-white/[0.06] text-xs font-medium text-[#F2B8A2]"
              >
                Add Alert Offset
              </button>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-[#98A2B3]">
              {offsets.map((off) => (
                <button
                  key={off.id}
                  type="button"
                  onClick={() => setOffsets((prev) => prev.filter((o) => o.id !== off.id))}
                  className="hover:text-[#F2B8A2]"
                >
                  {off.value} {off.unit} before ×
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="min-h-[44px] px-4 rounded-2xl bg-white/[0.05] text-sm text-[#D0D5DD]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="min-h-[44px] px-5 rounded-2xl bg-[#F2B8A2] text-[#0F1115] text-sm font-semibold"
            >
              Save Birthday
            </button>
          </div>
        </form>
      )}

      {sortedBirthdays.length === 0 ? (
        <div className="rounded-3xl bg-[#171A21] border border-white/[0.07] p-10 text-center">
          <p className="text-sm text-[#98A2B3]">
            No birthdays added yet. Save dates, custom wishes, and advance reminders.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sortedBirthdays.map(({ entry, info }) => (
            <article
              key={entry.id}
              className="rounded-3xl bg-[#171A21] border border-white/[0.07] p-5 sm:p-6 flex flex-col justify-between gap-4"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-[#98A2B3]">
                      {entry.relationship} · {formatShortDate(entry.birthDate)}
                      {info.turningAge ? ` · Turning ${info.turningAge}` : ''}
                    </p>
                    <h2 className="text-lg font-semibold text-[#F1F3F6] mt-1 flex items-center gap-2">
                      <Cake className="w-4 h-4 text-[#F2B8A2]" />
                      {entry.name}
                    </h2>
                  </div>
                  <span
                    className={`text-sm font-semibold tabular-nums whitespace-nowrap ${
                      info.daysUntil <= 7 ? 'text-[#F2B8A2]' : 'text-[#9EC5AB]'
                    }`}
                  >
                    {info.label}
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-[#1D212A] border border-white/[0.05]">
                  <p className="text-xs text-[#98A2B3] mb-1">Pre-Written Wish</p>
                  <p className="text-sm text-[#D0D5DD] leading-relaxed">{entry.wishTemplate}</p>
                </div>

                <p className="text-xs text-[#98A2B3] flex items-center gap-1.5 flex-wrap">
                  <Bell className="w-3.5 h-3.5 text-[#F2B8A2]" />
                  <span>
                    Alerts:{' '}
                    {entry.offsets.length > 0
                      ? entry.offsets.map((o) => `${o.value} ${o.unit} before`).join(' · ')
                      : 'On the day'}
                  </span>
                </p>
              </div>

              <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopyWish(entry)}
                    className="min-h-[40px] px-3.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.09] text-xs font-medium text-[#F1F3F6] flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <Copy className="w-3.5 h-3.5 text-[#F2B8A2]" />
                    {copiedId === entry.id ? 'Copied Wish' : 'Copy Wish'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleShareWish(entry)}
                    className="min-h-[40px] px-3.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.09] text-xs font-medium text-[#F1F3F6] flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <Share2 className="w-3.5 h-3.5 text-[#9BC4E2]" />
                    Share
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => onDeleteBirthday(entry.id)}
                  aria-label="Delete birthday"
                  className="min-w-[40px] min-h-[40px] rounded-xl hover:bg-white/[0.06] text-[#98A2B3] hover:text-[#F2B8A2] flex items-center justify-center"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
};
