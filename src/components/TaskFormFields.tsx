import React, { useEffect, useRef, useState } from 'react';
import { Play, Square, Upload } from 'lucide-react';
import type {
  AlarmItem,
  CustomAudioTone,
  RecurrencePattern,
  TaskCategory,
  TaskPriority,
  TaskReminderItem,
} from '../types/sanctuary';
import { formatTime12h, getTodayStr, validateFutureDateTime } from '../lib/dateUtils';
import { createId } from '../lib/storage';
import {
  BUILTIN_TONES,
  previewSoundTone,
  resolveSoundName,
  stopSoundPreview,
} from '../lib/sound';
import {
  SHORT_WEEKDAYS,
  deriveAlarmScheduleFromTask,
  formatCustomRecurrenceSummary,
  parseLocalDate,
} from '../lib/taskRecurrence';
import { ModernSelect } from './ModernSelect';
import { ModernDatePicker } from './ModernDatePicker';
import { ModernTimePicker } from './ModernTimePicker';

export const TASK_PRIORITIES: TaskPriority[] = ['High', 'Medium', 'Low'];
export const TASK_CATEGORIES: TaskCategory[] = ['Personal', 'Work', 'Health', 'Learning', 'Home'];
export const TASK_RECURRENCES: RecurrencePattern[] = ['Once', 'Daily', 'Weekly', 'Monthly', 'Custom'];

export interface TaskFormDraft {
  title: string;
  notes: string;
  priority: TaskPriority;
  category: TaskCategory;
  dueDate: string;
  dueTime: string;
  endTime: string;
  recurrence: RecurrencePattern;
  customRecurrenceUnit: 'weekly' | 'monthly';
  customRecurrenceDays: number[];
  customRecurrenceMonthDays: number[];
  selectedSoundId: string;
  linkAlarm: boolean;
}

export function makeEmptyTaskDraft(
  defaultSoundId: string,
  initialDate = getTodayStr()
): TaskFormDraft {
  const parsed = parseLocalDate(initialDate);
  const weekday = parsed ? parsed.getDay() : new Date().getDay();
  const monthDay = parsed ? parsed.getDate() : new Date().getDate();
  return {
    title: '',
    notes: '',
    priority: 'Medium',
    category: 'Personal',
    dueDate: initialDate,
    dueTime: '',
    endTime: '',
    recurrence: 'Once',
    customRecurrenceUnit: 'weekly',
    customRecurrenceDays: [weekday],
    customRecurrenceMonthDays: [monthDay],
    selectedSoundId: defaultSoundId || BUILTIN_TONES[0].id,
    linkAlarm: true,
  };
}

export function taskToFormDraft(
  task: TaskReminderItem,
  defaultSoundId: string
): TaskFormDraft {
  const dueDate = task.dueDate || getTodayStr();
  const parsed = parseLocalDate(dueDate);
  const fallbackWeekday = parsed ? parsed.getDay() : new Date().getDay();
  const fallbackMonthDay = parsed ? parsed.getDate() : new Date().getDate();

  return {
    title: task.title,
    notes: task.notes,
    priority: task.priority,
    category: task.category,
    dueDate,
    dueTime: task.dueTime || '',
    endTime: task.endTime || '',
    recurrence: task.recurrence,
    customRecurrenceUnit: task.customRecurrenceUnit || 'weekly',
    customRecurrenceDays:
      task.customRecurrenceDays && task.customRecurrenceDays.length > 0
        ? [...task.customRecurrenceDays]
        : [fallbackWeekday],
    customRecurrenceMonthDays:
      task.customRecurrenceMonthDays && task.customRecurrenceMonthDays.length > 0
        ? [...task.customRecurrenceMonthDays]
        : [fallbackMonthDay],
    selectedSoundId: task.soundId || defaultSoundId || BUILTIN_TONES[0].id,
    linkAlarm: Boolean(task.linkedAlarmId),
  };
}

export function validateTaskDraft(
  draft: TaskFormDraft,
  options?: { skipPastValidation?: boolean }
): string | null {
  if (!draft.title.trim()) {
    return 'Please enter a task or reminder title.';
  }
  if (!options?.skipPastValidation) {
    const dateErr = validateFutureDateTime({
      date: draft.dueDate,
      time: draft.dueTime || undefined,
      dateLabel: 'Due Date',
      timeLabel: 'Alert Time',
    });
    if (dateErr) return dateErr;
  } else if (!draft.dueDate) {
    return 'Due Date is required.';
  }

  if (draft.recurrence === 'Custom') {
    if (draft.customRecurrenceUnit === 'weekly' && draft.customRecurrenceDays.length === 0) {
      return 'Select at least one weekday for your custom repeat schedule.';
    }
    if (
      draft.customRecurrenceUnit === 'monthly' &&
      draft.customRecurrenceMonthDays.length === 0
    ) {
      return 'Select at least one date of the month for your monthly repeat schedule.';
    }
  }
  return null;
}

export async function persistTaskDraft(params: {
  draft: TaskFormDraft;
  existingTask?: TaskReminderItem | null;
  alarms: AlarmItem[];
  customAudioTones: CustomAudioTone[];
  defaultNotificationSoundId: string;
  onSaveTask: (task: TaskReminderItem) => Promise<void>;
  onCreateLinkedAlarm: (alarm: AlarmItem) => Promise<void>;
  onDeleteLinkedAlarm?: (alarmId: string) => Promise<void>;
}): Promise<TaskReminderItem | null> {
  const {
    draft,
    existingTask,
    alarms,
    customAudioTones,
    defaultNotificationSoundId,
    onSaveTask,
    onCreateLinkedAlarm,
    onDeleteLinkedAlarm,
  } = params;

  const cleanTitle = draft.title.trim();
  if (!cleanTitle) return null;

  const cleanDate = draft.dueDate || getTodayStr();
  const hasTime = Boolean(draft.dueTime);
  const shouldLinkAlarm = hasTime && draft.linkAlarm;
  const resolvedSoundId = hasTime
    ? draft.selectedSoundId || defaultNotificationSoundId || BUILTIN_TONES[0].id
    : undefined;
  const resolvedSoundName = hasTime
    ? resolveSoundName(customAudioTones, resolvedSoundId)
    : undefined;

  const customUnit = draft.recurrence === 'Custom' ? draft.customRecurrenceUnit : undefined;
  const customDays =
    draft.recurrence === 'Custom' && draft.customRecurrenceUnit === 'weekly'
      ? [...draft.customRecurrenceDays].sort((a, b) => a - b)
      : undefined;
  const customMonthDays =
    draft.recurrence === 'Custom' && draft.customRecurrenceUnit === 'monthly'
      ? [...draft.customRecurrenceMonthDays].sort((a, b) => a - b)
      : undefined;
  const customNote =
    draft.recurrence === 'Custom'
      ? formatCustomRecurrenceSummary({
          unit: customUnit,
          days: customDays,
          monthDays: customMonthDays,
        })
      : undefined;

  const scheduleChanged =
    !existingTask ||
    existingTask.dueDate !== cleanDate ||
    existingTask.dueTime !== draft.dueTime ||
    existingTask.recurrence !== draft.recurrence ||
    existingTask.customRecurrenceUnit !== customUnit ||
    (existingTask.customRecurrenceDays || []).join(',') !== (customDays || []).join(',') ||
    (existingTask.customRecurrenceMonthDays || []).join(',') !== (customMonthDays || []).join(',') ||
    existingTask.soundId !== resolvedSoundId;

  const taskId = existingTask ? existingTask.id : createId('task');

  if (shouldLinkAlarm) {
    const existingAlarm = existingTask?.linkedAlarmId
      ? alarms.find((a) => a.id === existingTask.linkedAlarmId)
      : undefined;
    const alarmId = existingAlarm?.id || existingTask?.linkedAlarmId || createId('alarm');
    const { repeatDays, date } = deriveAlarmScheduleFromTask({
      recurrence: draft.recurrence,
      dueDate: cleanDate,
      customRecurrenceUnit: customUnit,
      customRecurrenceDays: customDays,
      customRecurrenceMonthDays: customMonthDays,
    });

    const alarmPayload: AlarmItem = {
      id: alarmId,
      label: cleanTitle,
      time: draft.dueTime,
      date,
      enabled: true,
      repeatDays,
      snoozeMinutes: existingAlarm?.snoozeMinutes || 5,
      linkedReminderId: taskId,
      linkedReminderTitle: cleanTitle,
      linkedReminderNotes: draft.notes.trim(),
      soundId: resolvedSoundId || BUILTIN_TONES[0].id,
      soundName: resolvedSoundName || BUILTIN_TONES[0].label,
      lastTriggeredMinute: scheduleChanged ? undefined : existingAlarm?.lastTriggeredMinute,
      snoozedUntilDate: scheduleChanged ? undefined : existingAlarm?.snoozedUntilDate,
      snoozedUntilTime: scheduleChanged ? undefined : existingAlarm?.snoozedUntilTime,
      createdAt: existingAlarm?.createdAt || new Date().toISOString(),
    };

    const savedTask: TaskReminderItem = {
      id: taskId,
      title: cleanTitle,
      notes: draft.notes.trim(),
      priority: draft.priority,
      category: draft.category,
      dueDate: cleanDate,
      dueTime: draft.dueTime,
      endTime: draft.endTime || undefined,
      recurrence: draft.recurrence,
      customRecurrenceNote: customNote,
      customRecurrenceUnit: customUnit,
      customRecurrenceDays: customDays,
      customRecurrenceMonthDays: customMonthDays,
      completed: existingTask ? existingTask.completed : false,
      completedAt: existingTask?.completedAt,
      linkedAlarmId: alarmId,
      soundId: resolvedSoundId,
      soundName: resolvedSoundName,
      lastNotifiedMinute: scheduleChanged ? undefined : existingTask?.lastNotifiedMinute,
      createdAt: existingTask ? existingTask.createdAt : new Date().toISOString(),
    };

    await onCreateLinkedAlarm(alarmPayload);
    await onSaveTask(savedTask);
    return savedTask;
  }

  if (existingTask?.linkedAlarmId && onDeleteLinkedAlarm) {
    await onDeleteLinkedAlarm(existingTask.linkedAlarmId);
  }

  const savedTask: TaskReminderItem = {
    id: taskId,
    title: cleanTitle,
    notes: draft.notes.trim(),
    priority: draft.priority,
    category: draft.category,
    dueDate: cleanDate,
    dueTime: draft.dueTime,
    endTime: draft.endTime || undefined,
    recurrence: draft.recurrence,
    customRecurrenceNote: customNote,
    customRecurrenceUnit: customUnit,
    customRecurrenceDays: customDays,
    customRecurrenceMonthDays: customMonthDays,
    completed: existingTask ? existingTask.completed : false,
    completedAt: existingTask?.completedAt,
    linkedAlarmId: undefined,
    soundId: resolvedSoundId,
    soundName: resolvedSoundName,
    lastNotifiedMinute: scheduleChanged ? undefined : existingTask?.lastNotifiedMinute,
    createdAt: existingTask ? existingTask.createdAt : new Date().toISOString(),
  };

  await onSaveTask(savedTask);
  return savedTask;
}

interface TaskFormFieldsProps {
  draft: TaskFormDraft;
  onChange: React.Dispatch<React.SetStateAction<TaskFormDraft>>;
  customAudioTones: CustomAudioTone[];
  onSaveCustomTone: (tone: CustomAudioTone) => Promise<void>;
  validationError?: string | null;
  allowPastDates?: boolean;
}

export const TaskFormFields: React.FC<TaskFormFieldsProps> = ({
  draft,
  onChange,
  customAudioTones,
  onSaveCustomTone,
  validationError,
  allowPastDates = false,
}) => {
  const [previewing, setPreviewing] = useState(false);
  const uploadRef = useRef<HTMLInputElement | null>(null);
  const todayStr = getTodayStr();

  useEffect(() => {
    return () => stopSoundPreview();
  }, []);

  const toggleWeekday = (dayIdx: number) => {
    onChange((prev) => {
      const exists = prev.customRecurrenceDays.includes(dayIdx);
      const next = exists
        ? prev.customRecurrenceDays.filter((d) => d !== dayIdx)
        : [...prev.customRecurrenceDays, dayIdx].sort((a, b) => a - b);
      return { ...prev, customRecurrenceDays: next };
    });
  };

  const toggleMonthDay = (dayNum: number) => {
    onChange((prev) => {
      const exists = prev.customRecurrenceMonthDays.includes(dayNum);
      const next = exists
        ? prev.customRecurrenceMonthDays.filter((d) => d !== dayNum)
        : [...prev.customRecurrenceMonthDays, dayNum].sort((a, b) => a - b);
      return { ...prev, customRecurrenceMonthDays: next };
    });
  };

  const handleUploadReminderAudio = async (file: File | undefined) => {
    if (!file) return;
    const tone: CustomAudioTone = {
      id: createId('tone'),
      name: file.name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ').trim() || 'Reminder Audio',
      mimeType: file.type || 'audio/mpeg',
      sizeBytes: file.size,
      blob: file,
      category: 'reminder',
      createdAt: new Date().toISOString(),
    };
    await onSaveCustomTone(tone);
    onChange((prev) => ({ ...prev, selectedSoundId: tone.id }));
  };

  return (
    <div className="space-y-4">
      <input
        type="text"
        required
        value={draft.title}
        onChange={(e) => onChange((prev) => ({ ...prev, title: e.target.value }))}
        placeholder="e.g. Take a break from 4:00 PM to 5:00 PM while working"
        className="w-full min-h-[44px] px-4 rounded-2xl bg-[#ECEFF3] dark:bg-[#1D212A] border border-slate-900/[0.10] dark:border-white/[0.08] text-sm text-[#111827] dark:text-[#F1F3F6]"
      />

      <textarea
        rows={2}
        value={draft.notes}
        onChange={(e) => onChange((prev) => ({ ...prev, notes: e.target.value }))}
        placeholder="Notes shown when your reminder or alarm triggers..."
        className="w-full p-4 rounded-2xl bg-[#ECEFF3] dark:bg-[#1D212A] border border-slate-900/[0.10] dark:border-white/[0.08] text-sm text-[#111827] dark:text-[#F1F3F6]"
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-[#5B6472] dark:text-[#98A2B3] mb-1">Priority</label>
          <ModernSelect
            ariaLabel="Task priority"
            title="Choose Priority"
            accent="lavender"
            value={draft.priority}
            onChange={(val) =>
              onChange((prev) => ({ ...prev, priority: val as TaskPriority }))
            }
            options={TASK_PRIORITIES.map((p) => ({
              value: p,
              label: `${p} Priority`,
              colorDot: p === 'High' ? '#F2B8A2' : p === 'Medium' ? '#BEB4DC' : '#9EC5AB',
            }))}
          />
        </div>
        <div>
          <label className="block text-xs text-[#5B6472] dark:text-[#98A2B3] mb-1">Category</label>
          <ModernSelect
            ariaLabel="Task category"
            title="Choose Category"
            accent="lavender"
            value={draft.category}
            onChange={(val) =>
              onChange((prev) => ({ ...prev, category: val as TaskCategory }))
            }
            options={TASK_CATEGORIES.map((c) => ({ value: c, label: c }))}
          />
        </div>
        <div>
          <label className="block text-xs text-[#5B6472] dark:text-[#98A2B3] mb-1">Recurring</label>
          <ModernSelect
            ariaLabel="Task recurrence"
            title="Repeat Schedule"
            accent="lavender"
            value={draft.recurrence}
            onChange={(val) => {
              const nextRec = val as RecurrencePattern;
              onChange((prev) => {
                if (nextRec === 'Custom') {
                  const parsed = parseLocalDate(prev.dueDate || todayStr);
                  const d = parsed ? parsed.getDay() : new Date().getDay();
                  const md = parsed ? parsed.getDate() : new Date().getDate();
                  return {
                    ...prev,
                    recurrence: nextRec,
                    customRecurrenceDays:
                      prev.customRecurrenceDays.length > 0 ? prev.customRecurrenceDays : [d],
                    customRecurrenceMonthDays:
                      prev.customRecurrenceMonthDays.length > 0
                        ? prev.customRecurrenceMonthDays
                        : [md],
                  };
                }
                return { ...prev, recurrence: nextRec };
              });
            }}
            options={TASK_RECURRENCES.map((r) => ({ value: r, label: r }))}
          />
        </div>
      </div>

      {draft.recurrence === 'Custom' && (
        <div className="rounded-2xl bg-[#ECEFF3]/70 dark:bg-[#1D212A]/85 border border-[#BEB4DC]/30 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-medium text-[#5B4D8A] dark:text-[#CEC3F0]">
              Custom Repeat Schedule (repeats until deleted)
            </span>
            <div className="flex items-center gap-1 p-1 rounded-xl bg-white/80 dark:bg-[#151822] border border-slate-900/[0.08] dark:border-white/[0.08]">
              <button
                type="button"
                onClick={() =>
                  onChange((prev) => ({ ...prev, customRecurrenceUnit: 'weekly' }))
                }
                className={`min-h-[34px] px-3 rounded-lg text-xs font-medium transition-colors ${
                  draft.customRecurrenceUnit === 'weekly'
                    ? 'bg-[#BEB4DC] text-[#0F1115] font-semibold'
                    : 'text-[#5B6472] dark:text-[#98A2B3]'
                }`}
              >
                Specific Days
              </button>
              <button
                type="button"
                onClick={() =>
                  onChange((prev) => ({ ...prev, customRecurrenceUnit: 'monthly' }))
                }
                className={`min-h-[34px] px-3 rounded-lg text-xs font-medium transition-colors ${
                  draft.customRecurrenceUnit === 'monthly'
                    ? 'bg-[#BEB4DC] text-[#0F1115] font-semibold'
                    : 'text-[#5B6472] dark:text-[#98A2B3]'
                }`}
              >
                Monthly Dates
              </button>
            </div>
          </div>

          {draft.customRecurrenceUnit === 'weekly' ? (
            <div className="space-y-1.5">
              <p className="text-[11px] text-[#5B6472] dark:text-[#98A2B3]">
                Tap weekdays to repeat every week:
              </p>
              <div className="flex flex-wrap gap-2">
                {SHORT_WEEKDAYS.map((dayLabel, idx) => {
                  const active = draft.customRecurrenceDays.includes(idx);
                  return (
                    <button
                      key={dayLabel}
                      type="button"
                      onClick={() => toggleWeekday(idx)}
                      className={`min-w-[42px] min-h-[42px] rounded-2xl text-xs font-medium transition-colors ${
                        active
                          ? 'bg-[#BEB4DC] text-[#0F1115] font-semibold shadow-2xs'
                          : 'bg-white dark:bg-[#141720] text-[#5B6472] dark:text-[#98A2B3] border border-slate-900/[0.08] dark:border-white/[0.08]'
                      }`}
                    >
                      {dayLabel}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <p className="text-[11px] text-[#5B6472] dark:text-[#98A2B3]">
                Tap specific dates of the month to repeat every month:
              </p>
              <div className="grid grid-cols-7 gap-1.5">
                {Array.from({ length: 31 }, (_, i) => i + 1).map((dayNum) => {
                  const active = draft.customRecurrenceMonthDays.includes(dayNum);
                  return (
                    <button
                      key={dayNum}
                      type="button"
                      onClick={() => toggleMonthDay(dayNum)}
                      className={`min-h-[38px] rounded-xl text-xs font-mono-tabular transition-colors ${
                        active
                          ? 'bg-[#BEB4DC] text-[#0F1115] font-semibold shadow-2xs'
                          : 'bg-white dark:bg-[#141720] text-[#5B6472] dark:text-[#98A2B3] border border-slate-900/[0.08] dark:border-white/[0.08]'
                      }`}
                    >
                      {dayNum}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <p className="text-xs font-medium text-[#2E6B48] dark:text-[#9EC5AB]">
            Selected:{' '}
            {formatCustomRecurrenceSummary({
              unit: draft.customRecurrenceUnit,
              days: draft.customRecurrenceDays,
              monthDays: draft.customRecurrenceMonthDays,
            })}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-[#5B6472] dark:text-[#98A2B3] mb-1">
            {draft.recurrence === 'Once' ? 'Due Date' : 'Start Date'}
          </label>
          <ModernDatePicker
            ariaLabel={draft.recurrence === 'Once' ? 'Due Date' : 'Start Date'}
            title={draft.recurrence === 'Once' ? 'Due Date' : 'Start Date'}
            accent="lavender"
            minDate={allowPastDates ? undefined : todayStr}
            value={draft.dueDate}
            onChange={(nextDate) => onChange((prev) => ({ ...prev, dueDate: nextDate }))}
          />
        </div>
        <div>
          <label className="block text-xs text-[#5B6472] dark:text-[#98A2B3] mb-1">
            Start / Alert Time
          </label>
          <ModernTimePicker
            ariaLabel="Start or Alert Time"
            title="Start / Alert Time"
            accent="lavender"
            allowClear
            placeholder="No alert time"
            value={draft.dueTime}
            onChange={(nextTime) => onChange((prev) => ({ ...prev, dueTime: nextTime }))}
          />
        </div>
        <div>
          <label className="block text-xs text-[#5B6472] dark:text-[#98A2B3] mb-1">
            End Time (optional)
          </label>
          <ModernTimePicker
            ariaLabel="End Time"
            title="End Time"
            accent="lavender"
            allowClear
            placeholder="Optional"
            value={draft.endTime}
            onChange={(nextTime) => onChange((prev) => ({ ...prev, endTime: nextTime }))}
          />
        </div>
      </div>

      {draft.dueTime && (
        <div className="space-y-3 pt-1">
          <div>
            <label className="block text-xs text-[#5B6472] dark:text-[#98A2B3] mb-1">
              Alarm / Reminder Sound
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <ModernSelect
                  ariaLabel="Alarm or reminder sound"
                  title="Choose Reminder Sound"
                  accent="lavender"
                  value={draft.selectedSoundId}
                  onChange={(val) => onChange((prev) => ({ ...prev, selectedSoundId: val }))}
                  options={[
                    ...BUILTIN_TONES.map((tone) => ({
                      value: tone.id,
                      label: tone.label,
                      group: 'Built-In Tones',
                    })),
                    ...customAudioTones.map((tone) => ({
                      value: tone.id,
                      label: tone.name,
                      group: 'Your Uploaded Audio',
                    })),
                  ]}
                />
              </div>

              <button
                type="button"
                onClick={() => {
                  if (previewing) {
                    stopSoundPreview();
                    setPreviewing(false);
                  } else {
                    setPreviewing(true);
                    previewSoundTone(customAudioTones, draft.selectedSoundId, () =>
                      setPreviewing(false)
                    );
                  }
                }}
                aria-label="Preview reminder sound"
                className="min-w-[44px] min-h-[44px] rounded-2xl bg-[#ECEFF3] dark:bg-[#1D212A] hover:bg-slate-900/[0.08] dark:hover:bg-white/[0.08] border border-slate-900/[0.10] dark:border-white/[0.08] text-[#2E6B48] dark:text-[#9EC5AB] flex items-center justify-center shrink-0"
              >
                {previewing ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </button>

              <button
                type="button"
                onClick={() => uploadRef.current?.click()}
                className="min-h-[44px] px-3 rounded-2xl bg-[#ECEFF3] dark:bg-[#1D212A] hover:bg-slate-900/[0.08] dark:hover:bg-white/[0.08] border border-slate-900/[0.10] dark:border-white/[0.08] text-xs font-medium text-[#255F8A] dark:text-[#9BC4E2] inline-flex items-center gap-1.5 shrink-0"
              >
                <Upload className="w-4 h-4" />
                <span className="hidden sm:inline">Upload</span>
              </button>
              <input
                ref={uploadRef}
                type="file"
                accept="audio/*,.mp3,.wav,.m4a,.ogg,.aac,.flac"
                onChange={(e) => {
                  void handleUploadReminderAudio(e.target.files?.[0]);
                  e.target.value = '';
                }}
                className="hidden"
              />
            </div>
          </div>

          <label className="flex items-start gap-3 cursor-pointer p-3.5 rounded-2xl bg-[#ECEFF3]/70 dark:bg-[#1D212A]/80 border border-slate-900/[0.07] dark:border-white/[0.06]">
            <input
              type="checkbox"
              checked={draft.linkAlarm}
              onChange={(e) => onChange((prev) => ({ ...prev, linkAlarm: e.target.checked }))}
              className="w-4 h-4 mt-0.5 accent-[#9EC5AB] shrink-0"
            />
            <span className="text-xs text-[#334155] dark:text-[#D0D5DD] leading-relaxed">
              <strong className="font-semibold text-[#111827] dark:text-[#F1F3F6] block">
                {draft.linkAlarm
                  ? `Full Ringing Alarm at ${formatTime12h(draft.dueTime)}`
                  : `Smart Reminder Sound Alert at ${formatTime12h(draft.dueTime)}`}
              </strong>
              {draft.linkAlarm
                ? 'Loops loudly for 1 minute on Media volume, pauses active music, and includes Snooze & Dismiss in your notification drawer.'
                : 'Plays your selected reminder sound for up to 10 seconds with Snooze 5m & Dismiss directly in your notification drawer.'}
            </span>
          </label>
        </div>
      )}

      {validationError && (
        <div
          role="alert"
          className="rounded-2xl bg-[#FDF1EB] dark:bg-[#2B1C19] border border-[#F2B8A2]/50 px-4 py-3 text-xs font-medium text-[#A6482D] dark:text-[#F2B8A2]"
        >
          {validationError}
        </div>
      )}
    </div>
  );
};
