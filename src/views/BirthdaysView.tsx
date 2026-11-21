import React, { useMemo, useRef, useState } from 'react';
import { Bell, Cake, Copy, Pencil, Plus, Share2, Trash2 } from 'lucide-react';
import type { BirthdayEntry, BirthdayOffset, OffsetUnit } from '../types/sanctuary';
import { createId } from '../lib/storage';
import { formatShortDate, getDaysUntilBirthday } from '../lib/dateUtils';
import { copyText, shareText } from '../lib/share';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ModernDatePicker } from '../components/ModernDatePicker';
import { ModernSelect } from '../components/ModernSelect';

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
  const [editingEntry, setEditingEntry] = useState<BirthdayEntry | null>(null);

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
  const [sharedId, setSharedId] = useState<string | null>(null);
  const [pendingDeleteBirthday, setPendingDeleteBirthday] = useState<BirthdayEntry | null>(null);

  const inlineEditFormRef = useRef<HTMLFormElement | null>(null);

  const sortedBirthdays = useMemo(() => {
    return [...birthdays]
      .map((entry) => ({ entry, info: getDaysUntilBirthday(entry.birthDate) }))
      .sort((a, b) => a.info.daysUntil - b.info.daysUntil);
  }, [birthdays]);

  const resetForm = () => {
    setEditingEntry(null);
    setName('');
    setBirthDate('');
    setRelationship('Friend');
    setWishTemplate('');
    setOffsets([{ id: createId('off'), value: 1, unit: 'days' }]);
  };

  const openCreateForm = () => {
    resetForm();
    setShowAdd((v) => !v);
  };

  const openEditForm = (entry: BirthdayEntry) => {
    setShowAdd(false);
    setEditingEntry(entry);
    setName(entry.name);
    setBirthDate(entry.birthDate);
    setRelationship(entry.relationship);
    setWishTemplate(entry.wishTemplate);
    setOffsets(entry.offsets.length > 0 ? entry.offsets.map((o) => ({ ...o })) : []);
    window.setTimeout(() => {
      inlineEditFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 50);
  };

  const addOffset = () => {
    if (offsetVal <= 0) return;
    setOffsets((prev) => [
      ...prev,
      { id: createId('off'), value: offsetVal, unit: offsetUnit },
    ]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !birthDate) return;

    await onSaveBirthday({
      id: editingEntry ? editingEntry.id : createId('bday'),
      name: name.trim(),
      birthDate,
      relationship: relationship.trim() || 'Friend',
      wishTemplate:
        wishTemplate.trim() ||
        `Happy Birthday, ${name.trim()}! Wishing you joy, calm, and wonderful memories ahead.`,
      offsets,
      createdAt: editingEntry ? editingEntry.createdAt : new Date().toISOString(),
    });

    resetForm();
    setShowAdd(false);
  };

  const handleCopyWish = async (entry: BirthdayEntry) => {
    const ok = await copyText(entry.wishTemplate);
    if (ok) {
      setCopiedId(entry.id);
      setTimeout(() => setCopiedId(null), 1600);
    }
  };

  const handleShareWish = async (entry: BirthdayEntry) => {
    const outcome = await shareText({
      title: `Birthday Wish for ${entry.name}`,
      text: entry.wishTemplate,
      dialogTitle: `Share wish for ${entry.name}`,
    });
    if (outcome === 'shared') {
      setSharedId(entry.id);
      setTimeout(() => setSharedId(null), 1800);
    } else if (outcome === 'copied') {
      setCopiedId(entry.id);
      setTimeout(() => setCopiedId(null), 1800);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-xs text-[#A6482D] dark:text-[#F2B8A2]">Birthday Tracker & Wishes</p>
          <h1 className="font-display text-2xl sm:text-3xl font-medium text-[#111827] dark:text-[#F1F3F6] mt-1">
            People Who Matter
          </h1>
        </div>
        <button
          type="button"
          onClick={openCreateForm}
          className="min-h-[44px] px-5 py-2.5 rounded-2xl bg-[#F2B8A2] hover:bg-[#E7A890] text-[#0F1115] text-sm font-semibold flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          Add Birthday
        </button>
      </header>

      {(() => {
        const renderForm = (isInlineEdit: boolean) => (
          <form
            ref={isInlineEdit ? inlineEditFormRef : undefined}
            onSubmit={handleSubmit}
            className={`rounded-3xl bg-white dark:bg-[#171A21] border border-[#F2B8A2]/35 p-5 sm:p-7 space-y-4 ${
              isInlineEdit ? 'md:col-span-2' : ''
            }`}
          >
            <h2 className="text-base font-semibold text-[#111827] dark:text-[#F1F3F6]">
              {editingEntry ? 'Edit Birthday & Alert Offsets' : 'Track Birthday & Alert Offsets'}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Person's name"
                className="min-h-[44px] px-4 rounded-2xl bg-[#ECEFF3] dark:bg-[#1D212A] border border-slate-900/[0.10] dark:border-white/[0.08] text-sm text-[#111827] dark:text-[#F1F3F6]"
              />
              <ModernDatePicker
                ariaLabel="Birth date"
                title="Birth Date"
                placeholder="Choose birth date"
                accent="peach"
                enableYearPicker
                value={birthDate}
                onChange={setBirthDate}
              />
              <input
                type="text"
                value={relationship}
                onChange={(e) => setRelationship(e.target.value)}
                placeholder="Relationship (e.g. Family, Friend)"
                className="min-h-[44px] px-4 rounded-2xl bg-[#ECEFF3] dark:bg-[#1D212A] border border-slate-900/[0.10] dark:border-white/[0.08] text-sm text-[#111827] dark:text-[#F1F3F6]"
              />
            </div>

            <textarea
              rows={3}
              value={wishTemplate}
              onChange={(e) => setWishTemplate(e.target.value)}
              placeholder="Pre-write a thoughtful birthday wish for one-tap copy or sharing..."
              className="w-full p-4 rounded-2xl bg-[#ECEFF3] dark:bg-[#1D212A] border border-slate-900/[0.10] dark:border-white/[0.08] text-sm text-[#111827] dark:text-[#F1F3F6]"
            />

            {/* Customizable Notification Engine Offsets */}
            <div className="space-y-2.5">
              <p className="text-xs text-[#5B6472] dark:text-[#98A2B3]">
                Linked Notification Engine (notify before birthday)
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="number"
                  min={1}
                  value={offsetVal}
                  onChange={(e) => setOffsetVal(Number(e.target.value))}
                  className="w-20 min-h-[40px] px-3 rounded-xl bg-[#ECEFF3] dark:bg-[#1D212A] border border-slate-900/[0.10] dark:border-white/[0.08] text-xs text-[#111827] dark:text-[#F1F3F6] font-mono-tabular"
                />
                <div className="min-w-[165px]">
                  <ModernSelect
                    ariaLabel="Offset unit"
                    title="Alert Unit"
                    accent="peach"
                    triggerClassName="min-h-[40px] rounded-xl text-xs"
                    value={offsetUnit}
                    onChange={(val) => setOffsetUnit(val as OffsetUnit)}
                    options={[
                      { value: 'minutes', label: 'minutes before' },
                      { value: 'hours', label: 'hours before' },
                      { value: 'days', label: 'days before' },
                    ]}
                  />
                </div>
                <button
                  type="button"
                  onClick={addOffset}
                  className="min-h-[40px] px-3.5 rounded-xl bg-slate-900/[0.06] dark:bg-white/[0.06] text-xs font-medium text-[#A6482D] dark:text-[#F2B8A2]"
                >
                  Add Alert Offset
                </button>
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-[#5B6472] dark:text-[#98A2B3]">
                {offsets.map((off) => (
                  <button
                    key={off.id}
                    type="button"
                    onClick={() => setOffsets((prev) => prev.filter((o) => o.id !== off.id))}
                    className="hover:text-[#A6482D] dark:hover:text-[#F2B8A2]"
                  >
                    {off.value} {off.unit} before ×
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setShowAdd(false);
                }}
                className="min-h-[44px] px-4 rounded-2xl bg-slate-900/[0.05] dark:bg-white/[0.05] text-sm text-[#334155] dark:text-[#D0D5DD]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="min-h-[44px] px-5 rounded-2xl bg-[#F2B8A2] text-[#0F1115] text-sm font-semibold"
              >
                {editingEntry ? 'Update Birthday' : 'Save Birthday'}
              </button>
            </div>
          </form>
        );

        return (
          <>
            {showAdd && !editingEntry && renderForm(false)}

            {sortedBirthdays.length === 0 ? (
              <div className="rounded-3xl bg-white dark:bg-[#171A21] border border-slate-900/[0.08] dark:border-white/[0.07] p-10 text-center">
                <p className="text-sm text-[#5B6472] dark:text-[#98A2B3]">
                  No birthdays added yet. Save dates, custom wishes, and advance reminders.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {sortedBirthdays.map(({ entry, info }) => {
                  if (editingEntry && editingEntry.id === entry.id) {
                    return <React.Fragment key={entry.id}>{renderForm(true)}</React.Fragment>;
                  }
                  return (
                    <article
                      key={entry.id}
                      className="rounded-3xl bg-white dark:bg-[#171A21] border border-slate-900/[0.08] dark:border-white/[0.07] p-5 sm:p-6 flex flex-col justify-between gap-4"
                    >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-[#5B6472] dark:text-[#98A2B3]">
                      {entry.relationship} · {formatShortDate(entry.birthDate)}
                      {info.turningAge ? ` · Turning ${info.turningAge}` : ''}
                    </p>
                    <h2 className="text-lg font-semibold text-[#111827] dark:text-[#F1F3F6] mt-1 flex items-center gap-2">
                      <Cake className="w-4 h-4 text-[#A6482D] dark:text-[#F2B8A2]" />
                      {entry.name}
                    </h2>
                  </div>
                  <span
                    className={`text-sm font-semibold tabular-nums whitespace-nowrap ${
                      info.daysUntil <= 7 ? 'text-[#A6482D] dark:text-[#F2B8A2]' : 'text-[#2E6B48] dark:text-[#9EC5AB]'
                    }`}
                  >
                    {info.label}
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-[#ECEFF3] dark:bg-[#1D212A] border border-slate-900/[0.06] dark:border-white/[0.05]">
                  <p className="text-xs text-[#5B6472] dark:text-[#98A2B3] mb-1">Pre-Written Wish</p>
                  <p className="text-sm text-[#334155] dark:text-[#D0D5DD] leading-relaxed">{entry.wishTemplate}</p>
                </div>

                <p className="text-xs text-[#5B6472] dark:text-[#98A2B3] flex items-center gap-1.5 flex-wrap">
                  <Bell className="w-3.5 h-3.5 text-[#A6482D] dark:text-[#F2B8A2]" />
                  <span>
                    Alerts:{' '}
                    {entry.offsets.length > 0
                      ? entry.offsets.map((o) => `${o.value} ${o.unit} before`).join(' · ')
                      : 'On the day'}
                  </span>
                </p>
              </div>

              <div className="pt-3 border-t border-slate-900/[0.08] dark:border-white/[0.06] flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleCopyWish(entry)}
                    className="min-h-[40px] px-3.5 rounded-xl bg-slate-900/[0.05] dark:bg-white/[0.05] hover:bg-slate-900/[0.09] dark:hover:bg-white/[0.09] text-xs font-medium text-[#111827] dark:text-[#F1F3F6] flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <Copy className="w-3.5 h-3.5 text-[#A6482D] dark:text-[#F2B8A2]" />
                    {copiedId === entry.id ? 'Copied Wish' : 'Copy Wish'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleShareWish(entry)}
                    className="min-h-[40px] px-3.5 rounded-xl bg-slate-900/[0.05] dark:bg-white/[0.05] hover:bg-slate-900/[0.09] dark:hover:bg-white/[0.09] text-xs font-medium text-[#111827] dark:text-[#F1F3F6] flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <Share2 className="w-3.5 h-3.5 text-[#255F8A] dark:text-[#9BC4E2]" />
                    {sharedId === entry.id ? 'Shared' : 'Share'}
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => openEditForm(entry)}
                    aria-label={`Edit ${entry.name}`}
                    title="Edit birthday"
                    className="min-w-[40px] min-h-[40px] rounded-xl hover:bg-slate-900/[0.06] dark:hover:bg-white/[0.06] text-[#5B6472] dark:text-[#98A2B3] hover:text-[#255F8A] dark:hover:text-[#9BC4E2] flex items-center justify-center"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingDeleteBirthday(entry)}
                    aria-label="Delete birthday"
                    className="min-w-[40px] min-h-[40px] rounded-xl hover:bg-slate-900/[0.06] dark:hover:bg-white/[0.06] text-[#5B6472] dark:text-[#98A2B3] hover:text-[#A6482D] dark:hover:text-[#F2B8A2] flex items-center justify-center"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
                  </article>
                  );
                })}
              </div>
            )}
          </>
        );
      })()}

      <ConfirmDialog
        open={Boolean(pendingDeleteBirthday)}
        title="Delete Birthday?"
        message={
          pendingDeleteBirthday
            ? `Are you sure you want to remove ${pendingDeleteBirthday.name}'s birthday and its reminders?`
            : ''
        }
        confirmLabel="Delete"
        onConfirm={async () => {
          if (!pendingDeleteBirthday) return;
          const id = pendingDeleteBirthday.id;
          setPendingDeleteBirthday(null);
          await onDeleteBirthday(id);
        }}
        onCancel={() => setPendingDeleteBirthday(null)}
      />
    </div>
  );
};
