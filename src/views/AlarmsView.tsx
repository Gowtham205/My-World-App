import React, { useEffect, useRef, useState } from 'react';
import {
  AlarmClock,
  BellRing,
  Music2,
  Pencil,
  Play,
  Plus,
  Square,
  Trash2,
  Upload,
  Volume2,
} from 'lucide-react';
import type {
  AlarmItem,
  AudioToneCategory,
  CustomAudioTone,
} from '../types/sanctuary';
import { createId } from '../lib/storage';
import { formatTime12h } from '../lib/dateUtils';
import {
  BUILTIN_TONES,
  previewSoundTone,
  resolveSoundName,
  stopSoundPreview,
} from '../lib/sound';

interface AlarmsViewProps {
  alarms: AlarmItem[];
  customAudioTones: CustomAudioTone[];
  defaultNotificationSoundId: string;
  onSaveAlarm: (alarm: AlarmItem) => Promise<void>;
  onDeleteAlarm: (id: string) => Promise<void>;
  onTestRingAlarm: (alarm: AlarmItem) => void;
  onSaveCustomTone: (tone: CustomAudioTone) => Promise<void>;
  onDeleteCustomTone: (id: string) => Promise<void>;
  onChangeDefaultNotificationSound: (soundId: string) => void;
}

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const TONE_CATEGORIES: { id: AudioToneCategory; label: string }[] = [
  { id: 'alarm', label: 'Alarm Ringtone' },
  { id: 'reminder', label: 'Reminder Sound' },
  { id: 'notification', label: 'Notification Chime' },
];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function cleanAudioFilename(filename: string): string {
  return filename.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ').trim() || 'Custom Audio';
}

export const AlarmsView: React.FC<AlarmsViewProps> = ({
  alarms,
  customAudioTones,
  defaultNotificationSoundId,
  onSaveAlarm,
  onDeleteAlarm,
  onTestRingAlarm,
  onSaveCustomTone,
  onDeleteCustomTone,
  onChangeDefaultNotificationSound,
}) => {
  const [showAdd, setShowAdd] = useState(false);
  const [editingAlarm, setEditingAlarm] = useState<AlarmItem | null>(null);
  const [label, setLabel] = useState('');
  const [time, setTime] = useState('07:30');
  const [repeatDays, setRepeatDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [snoozeMinutes, setSnoozeMinutes] = useState(10);
  const [selectedSoundId, setSelectedSoundId] = useState<string>(BUILTIN_TONES[0].id);

  // Audio upload state
  const [uploadCategory, setUploadCategory] = useState<AudioToneCategory>('alarm');
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const inlineFileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => {
      stopSoundPreview();
    };
  }, []);

  const toggleDay = (dayIdx: number) => {
    setRepeatDays((prev) =>
      prev.includes(dayIdx) ? prev.filter((d) => d !== dayIdx) : [...prev, dayIdx].sort()
    );
  };

  const handleTogglePreview = (soundId: string) => {
    if (previewingId === soundId) {
      stopSoundPreview();
      setPreviewingId(null);
      return;
    }
    setPreviewingId(soundId);
    previewSoundTone(customAudioTones, soundId, () => {
      setPreviewingId((curr) => (curr === soundId ? null : curr));
    });
  };

  const handleAudioFilesUpload = async (
    files: FileList | null,
    category: AudioToneCategory,
    autoSelectInForm = false
  ) => {
    if (!files || files.length === 0) return;
    setUploadError(null);
    setUploadNotice(null);

    let addedCount = 0;
    let lastAddedId: string | null = null;

    for (const file of Array.from(files)) {
      if (!file.type.startsWith('audio/') && !/\.(mp3|wav|m4a|ogg|aac|flac|opus)$/i.test(file.name)) {
        setUploadError(`"${file.name}" is not a supported audio file.`);
        continue;
      }
      if (file.size > 25 * 1024 * 1024) {
        setUploadError(`"${file.name}" exceeds 25 MB. Choose a shorter audio clip.`);
        continue;
      }

      const tone: CustomAudioTone = {
        id: createId('tone'),
        name: cleanAudioFilename(file.name),
        mimeType: file.type || 'audio/mpeg',
        sizeBytes: file.size,
        blob: file,
        category,
        createdAt: new Date().toISOString(),
      };

      await onSaveCustomTone(tone);
      addedCount += 1;
      lastAddedId = tone.id;
    }

    if (addedCount > 0) {
      setUploadNotice(
        addedCount === 1
          ? 'Added custom audio to your local sanctuary library.'
          : `Added ${addedCount} custom audio files to your library.`
      );
      if (autoSelectInForm && lastAddedId) {
        setSelectedSoundId(lastAddedId);
      }
    }
  };

  const openAddForm = () => {
    setEditingAlarm(null);
    setLabel('');
    setTime('07:30');
    setRepeatDays([1, 2, 3, 4, 5]);
    setSnoozeMinutes(10);
    setSelectedSoundId(BUILTIN_TONES[0].id);
    setShowAdd((v) => !v);
  };

  const openEditForm = (alarm: AlarmItem) => {
    setEditingAlarm(alarm);
    setLabel(alarm.label);
    setTime(alarm.time);
    setRepeatDays([...alarm.repeatDays]);
    setSnoozeMinutes(alarm.snoozeMinutes);
    setSelectedSoundId(alarm.soundId || BUILTIN_TONES[0].id);
    setShowAdd(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!time) return;

    const scheduleChanged =
      !editingAlarm ||
      editingAlarm.time !== time ||
      editingAlarm.repeatDays.join(',') !== repeatDays.join(',');

    await onSaveAlarm({
      ...(editingAlarm || {}),
      id: editingAlarm ? editingAlarm.id : createId('alarm'),
      label: label.trim() || 'Sanctuary Alarm',
      time,
      enabled: editingAlarm ? editingAlarm.enabled : true,
      repeatDays,
      snoozeMinutes,
      soundId: selectedSoundId,
      soundName: resolveSoundName(customAudioTones, selectedSoundId),
      lastTriggeredMinute: scheduleChanged ? undefined : editingAlarm?.lastTriggeredMinute,
      createdAt: editingAlarm ? editingAlarm.createdAt : new Date().toISOString(),
    });

    setEditingAlarm(null);
    setLabel('');
    setShowAdd(false);
  };

  const handleUpdateAlarmSound = async (alarm: AlarmItem, soundId: string) => {
    await onSaveAlarm({
      ...alarm,
      soundId,
      soundName: resolveSoundName(customAudioTones, soundId),
    });
  };

  const handleDeleteTone = async (toneId: string) => {
    if (previewingId === toneId) {
      stopSoundPreview();
      setPreviewingId(null);
    }
    if (selectedSoundId === toneId) {
      setSelectedSoundId(BUILTIN_TONES[0].id);
    }
    if (defaultNotificationSoundId === toneId) {
      onChangeDefaultNotificationSound(BUILTIN_TONES[1].id);
    }
    await onDeleteCustomTone(toneId);
  };

  const sortedAlarms = [...alarms].sort((a, b) => a.time.localeCompare(b.time));

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-xs text-[#F2B8A2]">Dedicated Alarms & Custom Audio</p>
          <h1 className="font-display text-2xl sm:text-3xl font-medium text-[#F1F3F6] mt-1">
            Wake-Up, Medicine & Break Alarms
          </h1>
          <p className="text-xs text-[#98A2B3] mt-1">
            Upload your own music or audio clips for alarm ringtones, reminder alerts, and
            notification chimes.
          </p>
        </div>
        <button
          type="button"
          onClick={openAddForm}
          className="min-h-[44px] px-5 py-2.5 rounded-2xl bg-[#F2B8A2] hover:bg-[#E7A890] text-[#0F1115] text-sm font-semibold flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          New Alarm
        </button>
      </header>

      {showAdd && (
        <form
          onSubmit={handleSaveForm}
          className="rounded-3xl bg-[#171A21] border border-[#F2B8A2]/30 p-5 sm:p-7 space-y-4"
        >
          <h2 className="text-base font-semibold text-[#F1F3F6]">
            {editingAlarm ? 'Edit Alarm' : 'Configure Alarm'}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Label (e.g. Take medicine, Morning routine)"
              className="sm:col-span-2 min-h-[44px] px-4 rounded-2xl bg-[#1D212A] border border-white/[0.08] text-sm text-[#F1F3F6]"
            />
            <input
              type="time"
              required
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="min-h-[44px] px-4 rounded-2xl bg-[#1D212A] border border-white/[0.08] text-sm text-[#F1F3F6] font-mono-tabular"
            />
          </div>

          <div className="space-y-2">
            <p className="text-xs text-[#98A2B3]">Repeat Days (leave all off for one-time)</p>
            <div className="flex flex-wrap gap-2">
              {WEEKDAYS.map((day, idx) => {
                const active = repeatDays.includes(idx);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(idx)}
                    className={`min-w-[44px] min-h-[44px] rounded-2xl text-xs font-medium transition-colors ${
                      active
                        ? 'bg-[#F2B8A2] text-[#0F1115] font-semibold'
                        : 'bg-[#1D212A] text-[#98A2B3] border border-white/[0.06]'
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-[#98A2B3] mb-1">Snooze Duration</label>
              <select
                value={snoozeMinutes}
                onChange={(e) => setSnoozeMinutes(Number(e.target.value))}
                className="w-full min-h-[44px] px-4 rounded-2xl bg-[#1D212A] border border-white/[0.08] text-sm text-[#F1F3F6]"
              >
                <option value={5}>5 minutes</option>
                <option value={10}>10 minutes</option>
                <option value={15}>15 minutes</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-[#98A2B3] mb-1">Alarm Ringtone</label>
              <div className="flex items-center gap-2">
                <select
                  value={selectedSoundId}
                  onChange={(e) => setSelectedSoundId(e.target.value)}
                  className="flex-1 min-w-0 min-h-[44px] px-4 rounded-2xl bg-[#1D212A] border border-white/[0.08] text-sm text-[#F1F3F6]"
                >
                  <optgroup label="Built-In Sanctuary Tones">
                    {BUILTIN_TONES.map((tone) => (
                      <option key={tone.id} value={tone.id}>
                        {tone.label}
                      </option>
                    ))}
                  </optgroup>
                  {customAudioTones.length > 0 && (
                    <optgroup label="Your Uploaded Audio Files">
                      {customAudioTones.map((tone) => (
                        <option key={tone.id} value={tone.id}>
                          {tone.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>

                <button
                  type="button"
                  onClick={() => handleTogglePreview(selectedSoundId)}
                  title={previewingId === selectedSoundId ? 'Stop preview' : 'Preview sound'}
                  aria-label="Preview alarm sound"
                  className="min-w-[44px] min-h-[44px] rounded-2xl bg-[#1D212A] hover:bg-white/[0.08] border border-white/[0.08] text-[#9EC5AB] flex items-center justify-center shrink-0"
                >
                  {previewingId === selectedSoundId ? (
                    <Square className="w-4 h-4" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => inlineFileInputRef.current?.click()}
                  title="Upload custom audio file"
                  aria-label="Upload custom audio file"
                  className="min-w-[44px] min-h-[44px] px-3 rounded-2xl bg-[#1D212A] hover:bg-white/[0.08] border border-white/[0.08] text-xs font-medium text-[#9BC4E2] flex items-center gap-1.5 shrink-0"
                >
                  <Upload className="w-4 h-4" />
                  <span className="hidden md:inline">Upload</span>
                </button>
                <input
                  ref={inlineFileInputRef}
                  type="file"
                  accept="audio/*,.mp3,.wav,.m4a,.ogg,.aac,.flac"
                  onChange={(e) => {
                    void handleAudioFilesUpload(e.target.files, 'alarm', true);
                    e.target.value = '';
                  }}
                  className="hidden"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => {
                setShowAdd(false);
                setEditingAlarm(null);
              }}
              className="min-h-[44px] px-4 rounded-2xl bg-white/[0.05] text-sm text-[#D0D5DD]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="min-h-[44px] px-5 rounded-2xl bg-[#F2B8A2] text-[#0F1115] text-sm font-semibold"
            >
              {editingAlarm ? 'Update Alarm' : 'Save Alarm'}
            </button>
          </div>
        </form>
      )}

      {sortedAlarms.length === 0 ? (
        <div className="rounded-3xl bg-[#171A21] border border-white/[0.07] p-10 text-center">
          <p className="text-sm text-[#98A2B3]">
            No alarms configured. Add a wake-up alarm or link one from Tasks & Reminders.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sortedAlarms.map((alarm) => {
            const currentSoundId = alarm.soundId || BUILTIN_TONES[0].id;
            return (
              <article
                key={alarm.id}
                className={`rounded-3xl bg-[#171A21] border p-5 sm:p-6 flex flex-col justify-between gap-4 transition-opacity ${
                  alarm.enabled ? 'border-white/[0.08]' : 'border-white/[0.04] opacity-60'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs text-[#98A2B3] flex items-center gap-1.5">
                      <AlarmClock className="w-3.5 h-3.5 text-[#F2B8A2]" />
                      <span>
                        {alarm.linkedReminderId ? 'Linked Reminder Alarm' : 'Dedicated Alarm'} ·
                        Snooze {alarm.snoozeMinutes}m
                      </span>
                    </p>
                    <div className="font-mono-tabular text-3xl font-semibold text-[#F1F3F6] mt-1.5">
                      {formatTime12h(alarm.time)}
                    </div>
                    <h2 className="text-sm font-medium text-[#D0D5DD] mt-1 truncate">
                      {alarm.label}
                    </h2>
                    {alarm.linkedReminderNotes && (
                      <p className="text-xs text-[#98A2B3] mt-1 line-clamp-2">
                        {alarm.linkedReminderNotes}
                      </p>
                    )}
                  </div>

                  {/* Toggle Switch */}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={alarm.enabled}
                    aria-label={`Toggle ${alarm.label}`}
                    onClick={() => onSaveAlarm({ ...alarm, enabled: !alarm.enabled })}
                    className={`w-14 h-8 rounded-full p-1 transition-colors shrink-0 ${
                      alarm.enabled ? 'bg-[#9EC5AB]' : 'bg-white/[0.12]'
                    }`}
                  >
                    <span
                      className={`block w-6 h-6 rounded-full bg-[#0F1115] transition-transform ${
                        alarm.enabled ? 'translate-x-6' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Per-Alarm Sound Picker */}
                <div className="flex items-center gap-2">
                  <Music2 className="w-3.5 h-3.5 text-[#9BC4E2] shrink-0" />
                  <select
                    aria-label={`Ringtone for ${alarm.label}`}
                    value={currentSoundId}
                    onChange={(e) => void handleUpdateAlarmSound(alarm, e.target.value)}
                    className="flex-1 min-w-0 min-h-[38px] px-3 rounded-xl bg-[#1D212A] border border-white/[0.06] text-xs text-[#D0D5DD]"
                  >
                    <optgroup label="Built-In Tones">
                      {BUILTIN_TONES.map((tone) => (
                        <option key={tone.id} value={tone.id}>
                          {tone.label}
                        </option>
                      ))}
                    </optgroup>
                    {customAudioTones.length > 0 && (
                      <optgroup label="Uploaded Audio">
                        {customAudioTones.map((tone) => (
                          <option key={tone.id} value={tone.id}>
                            {tone.name}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </div>

                <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between gap-3">
                  <p className="text-xs text-[#98A2B3]">
                    {alarm.repeatDays.length === 7
                      ? 'Every day'
                      : alarm.repeatDays.length === 0
                        ? 'Once'
                        : alarm.repeatDays.map((d) => WEEKDAYS[d]).join(' · ')}
                  </p>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onTestRingAlarm(alarm)}
                      className="min-h-[40px] px-3 rounded-xl hover:bg-white/[0.06] text-xs font-medium text-[#F2B8A2] flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <BellRing className="w-3.5 h-3.5" />
                      Test Ring
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditForm(alarm)}
                      aria-label={`Edit ${alarm.label}`}
                      className="min-w-[40px] min-h-[40px] rounded-xl hover:bg-white/[0.06] text-[#98A2B3] hover:text-[#F1F3F6] flex items-center justify-center"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteAlarm(alarm.id)}
                      aria-label="Delete alarm"
                      className="min-w-[40px] min-h-[40px] rounded-xl hover:bg-white/[0.06] text-[#98A2B3] hover:text-[#F2B8A2] flex items-center justify-center"
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

      {/* Custom Audio & Ringtones Library + Default Notification Sound */}
      <section className="rounded-3xl bg-[#171A21] border border-white/[0.07] p-5 sm:p-7 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-xs text-[#9BC4E2]">Local Audio Library · IndexedDB</p>
            <h2 className="font-display text-xl font-medium text-[#F1F3F6] mt-0.5">
              Custom Ringtones, Reminder & Notification Sounds
            </h2>
            <p className="text-xs text-[#98A2B3] mt-1">
              Upload MP3, WAV, M4A, OGG, or AAC files from your device. Everything stays stored
              locally in your sanctuary.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <select
              aria-label="Category for uploaded audio"
              value={uploadCategory}
              onChange={(e) => setUploadCategory(e.target.value as AudioToneCategory)}
              className="min-h-[44px] px-3.5 rounded-2xl bg-[#1D212A] border border-white/[0.08] text-xs text-[#F1F3F6]"
            >
              {TONE_CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="min-h-[44px] px-4 rounded-2xl bg-[#9BC4E2] hover:bg-[#89B7DA] text-[#0F1115] text-xs font-semibold inline-flex items-center gap-2 whitespace-nowrap"
            >
              <Upload className="w-4 h-4" />
              Upload Audio File
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="audio/*,.mp3,.wav,.m4a,.ogg,.aac,.flac"
              onChange={(e) => {
                void handleAudioFilesUpload(e.target.files, uploadCategory);
                e.target.value = '';
              }}
              className="hidden"
            />
          </div>
        </div>

        {uploadError && (
          <div
            role="alert"
            className="rounded-2xl bg-[#F2B8A2]/10 border border-[#F2B8A2]/30 px-4 py-3 text-xs text-[#F2B8A2]"
          >
            {uploadError}
          </div>
        )}

        {uploadNotice && (
          <p className="text-xs text-[#9EC5AB]" role="status">
            {uploadNotice}
          </p>
        )}

        {/* Default Notification & Event Calm Chime Selector */}
        <div className="rounded-2xl bg-[#1D212A] border border-white/[0.06] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <Volume2 className="w-4 h-4 text-[#9EC5AB] mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-medium text-[#F1F3F6]">
                Default Notification & Event Calm Sound
              </p>
              <p className="text-xs text-[#98A2B3] mt-0.5">
                Plays for Event Calm Mode check-ins and scheduled reminder notifications.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <select
              aria-label="Default notification sound"
              value={defaultNotificationSoundId}
              onChange={(e) => onChangeDefaultNotificationSound(e.target.value)}
              className="min-h-[42px] px-3.5 rounded-xl bg-[#13161C] border border-white/[0.08] text-xs text-[#F1F3F6] max-w-[220px]"
            >
              <optgroup label="Built-In Chimes">
                {BUILTIN_TONES.map((tone) => (
                  <option key={tone.id} value={tone.id}>
                    {tone.label}
                  </option>
                ))}
              </optgroup>
              {customAudioTones.length > 0 && (
                <optgroup label="Uploaded Audio">
                  {customAudioTones.map((tone) => (
                    <option key={tone.id} value={tone.id}>
                      {tone.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            <button
              type="button"
              onClick={() => handleTogglePreview(defaultNotificationSoundId)}
              aria-label="Preview default notification sound"
              className="min-w-[42px] min-h-[42px] rounded-xl bg-[#13161C] hover:bg-white/[0.08] border border-white/[0.08] text-[#9EC5AB] flex items-center justify-center"
            >
              {previewingId === defaultNotificationSoundId ? (
                <Square className="w-4 h-4" />
              ) : (
                <Play className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Uploaded Custom Sounds List */}
        {customAudioTones.length === 0 ? (
          <p className="text-xs text-[#98A2B3] py-2">
            No custom audio files uploaded yet. Upload your favorite song snippet, calming chime, or
            voice reminder above to assign it to any alarm or reminder.
          </p>
        ) : (
          <div className="divide-y divide-white/[0.06] rounded-2xl bg-[#1D212A] border border-white/[0.06]">
            {customAudioTones.map((tone) => {
              const isPlaying = previewingId === tone.id;
              return (
                <div
                  key={tone.id}
                  className="px-4 py-3 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      type="button"
                      onClick={() => handleTogglePreview(tone.id)}
                      aria-label={isPlaying ? `Stop ${tone.name}` : `Play ${tone.name}`}
                      className={`min-w-[40px] min-h-[40px] rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                        isPlaying
                          ? 'bg-[#9EC5AB] text-[#0F1115]'
                          : 'bg-[#13161C] text-[#9BC4E2] hover:bg-white/[0.08]'
                      }`}
                    >
                      {isPlaying ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </button>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#F1F3F6] truncate">{tone.name}</p>
                      <p className="text-xs text-[#98A2B3]">
                        {TONE_CATEGORIES.find((c) => c.id === tone.category)?.label || tone.category}{' '}
                        · {formatFileSize(tone.sizeBytes)}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => void handleDeleteTone(tone.id)}
                    aria-label={`Delete ${tone.name}`}
                    className="min-w-[40px] min-h-[40px] rounded-xl hover:bg-white/[0.06] text-[#98A2B3] hover:text-[#F2B8A2] flex items-center justify-center shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
