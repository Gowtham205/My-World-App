import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlarmClock,
  Bell,
  CheckCircle2,
  Circle,
  Pencil,
  Play,
  Plus,
  Square,
  Trash2,
  Upload,
} from 'lucide-react';
import type {
  AlarmItem,
  CustomAudioTone,
  RecurrencePattern,
  TaskCategory,
  TaskPriority,
  TaskReminderItem,
} from '../types/sanctuary';
import { createId } from '../lib/storage';
import { formatShortDate, formatTime12h, getTodayStr } from '../lib/dateUtils';
import {
  BUILTIN_TONES,
  previewSoundTone,
  resolveSoundName,
  stopSoundPreview,
} from '../lib/sound';

interface TasksViewProps {
  tasks: TaskReminderItem[];
  alarms?: AlarmItem[];
  customAudioTones: CustomAudioTone[];
  defaultNotificationSoundId: string;
  onSaveTask: (task: TaskReminderItem) => Promise<void>;
  onDeleteTask: (id: string) => Promise<void>;
  onCreateLinkedAlarm: (alarm: AlarmItem) => Promise<void>;
  onDeleteLinkedAlarm?: (alarmId: string) => Promise<void>;
  onSaveCustomTone: (tone: CustomAudioTone) => Promise<void>;
}

const PRIORITIES: TaskPriority[] = ['High', 'Medium', 'Low'];
const CATEGORIES: TaskCategory[] = ['Personal', 'Work', 'Health', 'Learning', 'Home'];
const RECURRENCES: RecurrencePattern[] = ['Once', 'Daily', 'Weekly', 'Monthly', 'Custom'];

interface TaskFormDraft {
  title: string;
  notes: string;
  priority: TaskPriority;
  category: TaskCategory;
  dueDate: string;
  dueTime: string;
  endTime: string;
  recurrence: RecurrencePattern;
  customRecurrenceNote: string;
  selectedSoundId: string;
  linkAlarm: boolean;
}

function deriveAlarmScheduleFromTask(
  recurrence: RecurrencePattern,
  dueDate: string
): { repeatDays: number[]; date?: string } {
  if (recurrence === 'Daily') {
    return { repeatDays: [0, 1, 2, 3, 4, 5, 6], date: undefined };
  }
  if (recurrence === 'Weekly' && dueDate) {
    const parsed = new Date(`${dueDate}T12:00:00`);
    const day = Number.isNaN(parsed.getTime()) ? new Date().getDay() : parsed.getDay();
    return { repeatDays: [day], date: undefined };
  }
  return { repeatDays: [], date: dueDate || getTodayStr() };
}

export const TasksView: React.FC<TasksViewProps> = ({
  tasks,
  alarms = [],
  customAudioTones,
  defaultNotificationSoundId,
  onSaveTask,
  onDeleteTask,
  onCreateLinkedAlarm,
  onDeleteLinkedAlarm,
  onSaveCustomTone,
}) => {
  const [filterStatus, setFilterStatus] = useState<'active' | 'completed' | 'all'>('active');
  const [categoryFilter, setCategoryFilter] = useState<TaskCategory | 'All'>('All');

  // Separate states: top "New Task" form vs inline task-row edit form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [previewTarget, setPreviewTarget] = useState<'create' | 'edit' | null>(null);

  const makeEmptyDraft = (): TaskFormDraft => ({
    title: '',
    notes: '',
    priority: 'Medium',
    category: 'Personal',
    dueDate: getTodayStr(),
    dueTime: '',
    endTime: '',
    recurrence: 'Once',
    customRecurrenceNote: '',
    selectedSoundId: defaultNotificationSoundId || BUILTIN_TONES[0].id,
    linkAlarm: true,
  });

  const [createDraft, setCreateDraft] = useState<TaskFormDraft>(makeEmptyDraft);
  const [editDraft, setEditDraft] = useState<TaskFormDraft>(makeEmptyDraft);

  const createAudioUploadRef = useRef<HTMLInputElement | null>(null);
  const editAudioUploadRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => stopSoundPreview();
  }, []);

  const filteredTasks = useMemo(() => {
    return [...tasks]
      .filter((t) => {
        if (filterStatus === 'active' && t.completed) return false;
        if (filterStatus === 'completed' && !t.completed) return false;
        if (categoryFilter !== 'All' && t.category !== categoryFilter) return false;
        return true;
      })
      .sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        const pOrder = { High: 0, Medium: 1, Low: 2 };
        if (pOrder[a.priority] !== pOrder[b.priority]) {
          return pOrder[a.priority] - pOrder[b.priority];
        }
        return (a.dueDate + a.dueTime).localeCompare(b.dueDate + b.dueTime);
      });
  }, [tasks, filterStatus, categoryFilter]);

  const toggleCreateForm = () => {
    stopSoundPreview();
    setPreviewTarget(null);
    setEditingTaskId(null);
    setCreateDraft(makeEmptyDraft());
    setShowCreateForm((v) => !v);
  };

  const openInlineEdit = (task: TaskReminderItem) => {
    stopSoundPreview();
    setPreviewTarget(null);
    setShowCreateForm(false);
    setEditingTaskId(task.id);
    setEditDraft({
      title: task.title,
      notes: task.notes,
      priority: task.priority,
      category: task.category,
      dueDate: task.dueDate || getTodayStr(),
      dueTime: task.dueTime || '',
      endTime: task.endTime || '',
      recurrence: task.recurrence,
      customRecurrenceNote: task.customRecurrenceNote || '',
      selectedSoundId: task.soundId || defaultNotificationSoundId || BUILTIN_TONES[0].id,
      linkAlarm: Boolean(task.linkedAlarmId),
    });
  };

  const cancelInlineEdit = () => {
    stopSoundPreview();
    setPreviewTarget(null);
    setEditingTaskId(null);
  };

  const persistTaskAndAlarm = async (
    draft: TaskFormDraft,
    existingTask?: TaskReminderItem
  ) => {
    const cleanTitle = draft.title.trim();
    if (!cleanTitle) return;

    const cleanDate = draft.dueDate || getTodayStr();
    const hasTime = Boolean(draft.dueTime);
    const shouldLinkAlarm = hasTime && draft.linkAlarm;
    const resolvedSoundId = hasTime
      ? draft.selectedSoundId || defaultNotificationSoundId || BUILTIN_TONES[0].id
      : undefined;
    const resolvedSoundName = hasTime
      ? resolveSoundName(customAudioTones, resolvedSoundId)
      : undefined;

    const scheduleChanged =
      !existingTask ||
      existingTask.dueDate !== cleanDate ||
      existingTask.dueTime !== draft.dueTime ||
      existingTask.recurrence !== draft.recurrence ||
      existingTask.soundId !== resolvedSoundId;

    let linkedAlarmId: string | undefined = existingTask?.linkedAlarmId;

    if (shouldLinkAlarm) {
      const existingAlarm = linkedAlarmId
        ? alarms.find((a) => a.id === linkedAlarmId)
        : undefined;
      const alarmId = existingAlarm?.id || linkedAlarmId || createId('alarm');
      linkedAlarmId = alarmId;

      const { repeatDays, date } = deriveAlarmScheduleFromTask(draft.recurrence, cleanDate);

      const alarmPayload: AlarmItem = {
        id: alarmId,
        label: cleanTitle,
        time: draft.dueTime,
        date,
        enabled: true,
        repeatDays,
        snoozeMinutes: existingAlarm?.snoozeMinutes || 5,
        linkedReminderId: existingTask ? existingTask.id : undefined,
        linkedReminderTitle: cleanTitle,
        linkedReminderNotes: draft.notes.trim(),
        soundId: resolvedSoundId || BUILTIN_TONES[0].id,
        soundName: resolvedSoundName || BUILTIN_TONES[0].label,
        lastTriggeredMinute: scheduleChanged ? undefined : existingAlarm?.lastTriggeredMinute,
        snoozedUntilDate: scheduleChanged ? undefined : existingAlarm?.snoozedUntilDate,
        snoozedUntilTime: scheduleChanged ? undefined : existingAlarm?.snoozedUntilTime,
        createdAt: existingAlarm?.createdAt || new Date().toISOString(),
      };

      const taskId = existingTask ? existingTask.id : createId('task');
      alarmPayload.linkedReminderId = taskId;

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
        customRecurrenceNote:
          draft.recurrence === 'Custom' ? draft.customRecurrenceNote.trim() : undefined,
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
      return;
    }

    // If task previously had a linked alarm and user turned it off or cleared dueTime, clean it up
    if (existingTask?.linkedAlarmId && onDeleteLinkedAlarm) {
      await onDeleteLinkedAlarm(existingTask.linkedAlarmId);
    }

    const savedTask: TaskReminderItem = {
      id: existingTask ? existingTask.id : createId('task'),
      title: cleanTitle,
      notes: draft.notes.trim(),
      priority: draft.priority,
      category: draft.category,
      dueDate: cleanDate,
      dueTime: draft.dueTime,
      endTime: draft.endTime || undefined,
      recurrence: draft.recurrence,
      customRecurrenceNote:
        draft.recurrence === 'Custom' ? draft.customRecurrenceNote.trim() : undefined,
      completed: existingTask ? existingTask.completed : false,
      completedAt: existingTask?.completedAt,
      linkedAlarmId: undefined,
      soundId: resolvedSoundId,
      soundName: resolvedSoundName,
      lastNotifiedMinute: scheduleChanged ? undefined : existingTask?.lastNotifiedMinute,
      createdAt: existingTask ? existingTask.createdAt : new Date().toISOString(),
    };

    await onSaveTask(savedTask);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await persistTaskAndAlarm(createDraft);
    stopSoundPreview();
    setPreviewTarget(null);
    setCreateDraft(makeEmptyDraft());
    setShowCreateForm(false);
  };

  const handleEditSubmit = async (e: React.FormEvent, existingTask: TaskReminderItem) => {
    e.preventDefault();
    await persistTaskAndAlarm(editDraft, existingTask);
    stopSoundPreview();
    setPreviewTarget(null);
    setEditingTaskId(null);
  };

  const handleQuickLinkAlarm = async (task: TaskReminderItem) => {
    if (!task.dueTime) return;
    const alarmId = createId('alarm');
    const { repeatDays, date } = deriveAlarmScheduleFromTask(
      task.recurrence,
      task.dueDate || getTodayStr()
    );
    const soundId = task.soundId || defaultNotificationSoundId || BUILTIN_TONES[0].id;
    const soundName = task.soundName || resolveSoundName(customAudioTones, soundId);

    const alarm: AlarmItem = {
      id: alarmId,
      label: task.title,
      time: task.dueTime,
      date,
      enabled: true,
      repeatDays,
      snoozeMinutes: 5,
      linkedReminderId: task.id,
      linkedReminderTitle: task.title,
      linkedReminderNotes: task.notes,
      soundId,
      soundName,
      createdAt: new Date().toISOString(),
    };

    await onCreateLinkedAlarm(alarm);
    await onSaveTask({
      ...task,
      linkedAlarmId: alarmId,
      soundId,
      soundName,
    });
  };

  const handleUploadReminderAudio = async (
    file: File | undefined,
    target: 'create' | 'edit'
  ) => {
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
    if (target === 'create') {
      setCreateDraft((prev) => ({ ...prev, selectedSoundId: tone.id }));
    } else {
      setEditDraft((prev) => ({ ...prev, selectedSoundId: tone.id }));
    }
  };

  const priorityTone = (p: TaskPriority) => {
    if (p === 'High') return 'text-[#A6482D] dark:text-[#F2B8A2]';
    if (p === 'Medium') return 'text-[#5B4D8A] dark:text-[#BEB4DC]';
    return 'text-[#2E6B48] dark:text-[#9EC5AB]';
  };

  const renderFormFields = (
    draft: TaskFormDraft,
    setDraft: React.Dispatch<React.SetStateAction<TaskFormDraft>>,
    mode: 'create' | 'edit',
    uploadRef: React.RefObject<HTMLInputElement | null>
  ) => {
    const isPreviewingThis = previewTarget === mode;

    return (
      <>
        <input
          type="text"
          required
          value={draft.title}
          onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))}
          placeholder="e.g. Take a break from 4:00 PM to 5:00 PM while working"
          className="w-full min-h-[44px] px-4 rounded-2xl bg-[#ECEFF3] dark:bg-[#1D212A] border border-slate-900/[0.10] dark:border-white/[0.08] text-sm text-[#111827] dark:text-[#F1F3F6]"
        />

        <textarea
          rows={2}
          value={draft.notes}
          onChange={(e) => setDraft((prev) => ({ ...prev, notes: e.target.value }))}
          placeholder="Notes shown when your reminder or alarm triggers..."
          className="w-full p-4 rounded-2xl bg-[#ECEFF3] dark:bg-[#1D212A] border border-slate-900/[0.10] dark:border-white/[0.08] text-sm text-[#111827] dark:text-[#F1F3F6]"
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-[#5B6472] dark:text-[#98A2B3] mb-1">Priority</label>
            <select
              value={draft.priority}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, priority: e.target.value as TaskPriority }))
              }
              className="w-full min-h-[44px] px-3 rounded-2xl bg-[#ECEFF3] dark:bg-[#1D212A] border border-slate-900/[0.10] dark:border-white/[0.08] text-sm text-[#111827] dark:text-[#F1F3F6]"
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p} Priority
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-[#5B6472] dark:text-[#98A2B3] mb-1">Category</label>
            <select
              value={draft.category}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, category: e.target.value as TaskCategory }))
              }
              className="w-full min-h-[44px] px-3 rounded-2xl bg-[#ECEFF3] dark:bg-[#1D212A] border border-slate-900/[0.10] dark:border-white/[0.08] text-sm text-[#111827] dark:text-[#F1F3F6]"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-[#5B6472] dark:text-[#98A2B3] mb-1">Recurring</label>
            <select
              value={draft.recurrence}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, recurrence: e.target.value as RecurrencePattern }))
              }
              className="w-full min-h-[44px] px-3 rounded-2xl bg-[#ECEFF3] dark:bg-[#1D212A] border border-slate-900/[0.10] dark:border-white/[0.08] text-sm text-[#111827] dark:text-[#F1F3F6]"
            >
              {RECURRENCES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        </div>

        {draft.recurrence === 'Custom' && (
          <input
            type="text"
            value={draft.customRecurrenceNote}
            onChange={(e) =>
              setDraft((prev) => ({ ...prev, customRecurrenceNote: e.target.value }))
            }
            placeholder="Custom schedule (e.g. Every Tuesday & Thursday)"
            className="w-full min-h-[44px] px-4 rounded-2xl bg-[#ECEFF3] dark:bg-[#1D212A] border border-slate-900/[0.10] dark:border-white/[0.08] text-sm text-[#111827] dark:text-[#F1F3F6]"
          />
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-[#5B6472] dark:text-[#98A2B3] mb-1">Due Date</label>
            <input
              type="date"
              value={draft.dueDate}
              onChange={(e) => setDraft((prev) => ({ ...prev, dueDate: e.target.value }))}
              className="w-full min-h-[44px] px-3 rounded-2xl bg-[#ECEFF3] dark:bg-[#1D212A] border border-slate-900/[0.10] dark:border-white/[0.08] text-sm text-[#111827] dark:text-[#F1F3F6]"
            />
          </div>
          <div>
            <label className="block text-xs text-[#5B6472] dark:text-[#98A2B3] mb-1">
              Start / Alert Time
            </label>
            <input
              type="time"
              value={draft.dueTime}
              onChange={(e) => setDraft((prev) => ({ ...prev, dueTime: e.target.value }))}
              className="w-full min-h-[44px] px-3 rounded-2xl bg-[#ECEFF3] dark:bg-[#1D212A] border border-slate-900/[0.10] dark:border-white/[0.08] text-sm text-[#111827] dark:text-[#F1F3F6]"
            />
          </div>
          <div>
            <label className="block text-xs text-[#5B6472] dark:text-[#98A2B3] mb-1">
              End Time (optional)
            </label>
            <input
              type="time"
              value={draft.endTime}
              onChange={(e) => setDraft((prev) => ({ ...prev, endTime: e.target.value }))}
              className="w-full min-h-[44px] px-3 rounded-2xl bg-[#ECEFF3] dark:bg-[#1D212A] border border-slate-900/[0.10] dark:border-white/[0.08] text-sm text-[#111827] dark:text-[#F1F3F6]"
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
                <select
                  value={draft.selectedSoundId}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, selectedSoundId: e.target.value }))
                  }
                  className="flex-1 min-w-0 min-h-[44px] px-3.5 rounded-2xl bg-[#ECEFF3] dark:bg-[#1D212A] border border-slate-900/[0.10] dark:border-white/[0.08] text-xs text-[#111827] dark:text-[#F1F3F6]"
                >
                  <optgroup label="Built-In Tones">
                    {BUILTIN_TONES.map((tone) => (
                      <option key={tone.id} value={tone.id}>
                        {tone.label}
                      </option>
                    ))}
                  </optgroup>
                  {customAudioTones.length > 0 && (
                    <optgroup label="Your Uploaded Audio">
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
                  onClick={() => {
                    if (isPreviewingThis) {
                      stopSoundPreview();
                      setPreviewTarget(null);
                    } else {
                      setPreviewTarget(mode);
                      previewSoundTone(customAudioTones, draft.selectedSoundId, () =>
                        setPreviewTarget((curr) => (curr === mode ? null : curr))
                      );
                    }
                  }}
                  aria-label="Preview reminder sound"
                  className="min-w-[44px] min-h-[44px] rounded-2xl bg-[#ECEFF3] dark:bg-[#1D212A] hover:bg-slate-900/[0.08] dark:hover:bg-white/[0.08] border border-slate-900/[0.10] dark:border-white/[0.08] text-[#2E6B48] dark:text-[#9EC5AB] flex items-center justify-center shrink-0"
                >
                  {isPreviewingThis ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
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
                    void handleUploadReminderAudio(e.target.files?.[0], mode);
                    e.target.value = '';
                  }}
                  className="hidden"
                />
              </div>
            </div>

            <label className="flex items-start gap-3 cursor-pointer p-3 rounded-2xl bg-[#ECEFF3]/70 dark:bg-[#1D212A]/80 border border-slate-900/[0.07] dark:border-white/[0.06]">
              <input
                type="checkbox"
                checked={draft.linkAlarm}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, linkAlarm: e.target.checked }))
                }
                className="w-4 h-4 mt-0.5 accent-[#9EC5AB] shrink-0"
              />
              <span className="text-xs text-[#334155] dark:text-[#D0D5DD] leading-relaxed">
                <strong className="font-semibold text-[#111827] dark:text-[#F1F3F6]">
                  Link Alarm at {formatTime12h(draft.dueTime)}
                </strong>{' '}
                — rings continuously with Snooze &amp; Dismiss and stops active music when
                triggered.
              </span>
            </label>
          </div>
        )}
      </>
    );
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-xs text-[#2E6B48] dark:text-[#9EC5AB]">Tasks & Smart Reminders</p>
          <h1 className="font-display text-2xl sm:text-3xl font-medium text-[#111827] dark:text-[#F1F3F6] mt-1">
            To-Do & Scheduled Breaks
          </h1>
        </div>
        <button
          type="button"
          onClick={toggleCreateForm}
          className="min-h-[44px] px-5 py-2.5 rounded-2xl bg-[#9EC5AB] hover:bg-[#8EB89D] text-[#0F1115] text-sm font-semibold flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          New Task / Reminder
        </button>
      </header>

      {/* Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 rounded-2xl bg-white dark:bg-[#171A21] border border-slate-900/[0.08] dark:border-white/[0.06] self-start">
          {(['active', 'completed', 'all'] as const).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setFilterStatus(status)}
              className={`min-h-[38px] px-3.5 rounded-xl text-xs font-medium capitalize transition-colors whitespace-nowrap ${
                filterStatus === status
                  ? 'bg-[#ECEFF3] dark:bg-[#1D212A] text-[#111827] dark:text-[#F1F3F6]'
                  : 'text-[#5B6472] dark:text-[#98A2B3] hover:text-[#111827] dark:hover:text-[#F1F3F6]'
              }`}
            >
              {status}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {(['All', ...CATEGORIES] as const).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className={`min-h-[40px] px-3.5 rounded-2xl text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                categoryFilter === cat
                  ? 'bg-[#9EC5AB]/20 text-[#2E6B48] dark:text-[#9EC5AB] border border-[#9EC5AB]/30'
                  : 'bg-white dark:bg-[#171A21] text-[#5B6472] dark:text-[#98A2B3] border border-slate-900/[0.08] dark:border-white/[0.06]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Create New Task Form (Top) */}
      {showCreateForm && (
        <form
          onSubmit={(e) => void handleCreateSubmit(e)}
          className="rounded-3xl bg-white dark:bg-[#171A21] border border-[#9EC5AB]/30 p-5 sm:p-7 space-y-4"
        >
          <h2 className="text-base font-semibold text-[#111827] dark:text-[#F1F3F6]">
            Create Task or Smart Reminder
          </h2>

          {renderFormFields(createDraft, setCreateDraft, 'create', createAudioUploadRef)}

          <div className="flex justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => {
                stopSoundPreview();
                setPreviewTarget(null);
                setCreateDraft(makeEmptyDraft());
                setShowCreateForm(false);
              }}
              className="min-h-[44px] px-4 rounded-2xl bg-slate-900/[0.05] dark:bg-white/[0.05] text-sm text-[#334155] dark:text-[#D0D5DD]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="min-h-[44px] px-5 rounded-2xl bg-[#9EC5AB] text-[#0F1115] text-sm font-semibold"
            >
              Save Task
            </button>
          </div>
        </form>
      )}

      {/* Task List */}
      {filteredTasks.length === 0 ? (
        <div className="rounded-3xl bg-white dark:bg-[#171A21] border border-slate-900/[0.08] dark:border-white/[0.07] p-10 text-center">
          <p className="text-sm text-[#5B6472] dark:text-[#98A2B3]">
            Nothing in this view. Enjoy the breathing room or add a scheduled task.
          </p>
        </div>
      ) : (
        <div className="rounded-3xl bg-white dark:bg-[#171A21] border border-slate-900/[0.08] dark:border-white/[0.07] divide-y divide-slate-900/[0.08] dark:divide-white/[0.06]">
          {filteredTasks.map((task) => {
            if (editingTaskId === task.id) {
              return (
                <form
                  key={task.id}
                  onSubmit={(e) => void handleEditSubmit(e, task)}
                  className="p-5 sm:p-6 space-y-4 bg-[#F8FAFC] dark:bg-[#151820] first:rounded-t-3xl last:rounded-b-3xl"
                >
                  <h2 className="text-sm font-semibold text-[#111827] dark:text-[#F1F3F6]">
                    Edit Task or Smart Reminder
                  </h2>

                  {renderFormFields(editDraft, setEditDraft, 'edit', editAudioUploadRef)}

                  <div className="flex justify-end gap-2.5 pt-2">
                    <button
                      type="button"
                      onClick={cancelInlineEdit}
                      className="min-h-[44px] px-4 rounded-2xl bg-slate-900/[0.05] dark:bg-white/[0.05] text-sm text-[#334155] dark:text-[#D0D5DD]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="min-h-[44px] px-5 rounded-2xl bg-[#9EC5AB] text-[#0F1115] text-sm font-semibold"
                    >
                      Update Task
                    </button>
                  </div>
                </form>
              );
            }

            return (
              <div
                key={task.id}
                className="p-4 sm:p-5 flex items-start justify-between gap-3"
              >
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() =>
                      onSaveTask({
                        ...task,
                        completed: !task.completed,
                        completedAt: !task.completed ? new Date().toISOString() : undefined,
                      })
                    }
                    aria-label={task.completed ? 'Mark incomplete' : 'Mark complete'}
                    className="min-w-[44px] min-h-[44px] -ml-2 -mt-1.5 flex items-center justify-center text-[#5B6472] dark:text-[#98A2B3] hover:text-[#2E6B48] dark:hover:text-[#9EC5AB] shrink-0"
                  >
                    {task.completed ? (
                      <CheckCircle2 className="w-5 h-5 text-[#2E6B48] dark:text-[#9EC5AB]" />
                    ) : (
                      <Circle className="w-5 h-5" />
                    )}
                  </button>

                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-sm font-medium ${
                        task.completed
                          ? 'line-through text-[#5B6472] dark:text-[#98A2B3]'
                          : 'text-[#111827] dark:text-[#F1F3F6]'
                      }`}
                    >
                      {task.title}
                    </p>
                    {task.notes && (
                      <p className="text-xs text-[#5B6472] dark:text-[#98A2B3] mt-1 leading-relaxed">
                        {task.notes}
                      </p>
                    )}
                    <p className="text-xs text-[#5B6472] dark:text-[#98A2B3] mt-2 flex flex-wrap items-center gap-1.5">
                      <span className={priorityTone(task.priority)}>{task.priority}</span>
                      <span aria-hidden="true">·</span>
                      <span>{task.category}</span>
                      <span aria-hidden="true">·</span>
                      <span>{formatShortDate(task.dueDate)}</span>
                      {task.dueTime && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono-tabular">
                            {formatTime12h(task.dueTime)}
                            {task.endTime ? ` – ${formatTime12h(task.endTime)}` : ''}
                          </span>
                        </>
                      )}
                      {task.recurrence !== 'Once' && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>
                            {task.recurrence === 'Custom'
                              ? task.customRecurrenceNote || 'Custom'
                              : task.recurrence}
                          </span>
                        </>
                      )}
                      {task.linkedAlarmId && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-[#A6482D] dark:text-[#F2B8A2] inline-flex items-center gap-1">
                            <Bell className="w-3 h-3" />
                            Alarm linked
                          </span>
                        </>
                      )}
                      {task.soundName && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{task.soundName}</span>
                        </>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => openInlineEdit(task)}
                    aria-label={`Edit ${task.title}`}
                    title="Edit task"
                    className="min-w-[40px] min-h-[40px] rounded-xl hover:bg-slate-900/[0.06] dark:hover:bg-white/[0.06] text-[#5B6472] dark:text-[#98A2B3] hover:text-[#255F8A] dark:hover:text-[#9BC4E2] flex items-center justify-center"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  {task.dueTime && !task.linkedAlarmId && !task.completed && (
                    <button
                      type="button"
                      onClick={() => void handleQuickLinkAlarm(task)}
                      title="Link an Alarm"
                      aria-label={`Link alarm to ${task.title}`}
                      className="min-w-[40px] min-h-[40px] rounded-xl hover:bg-slate-900/[0.06] dark:hover:bg-white/[0.06] text-[#5B6472] dark:text-[#98A2B3] hover:text-[#A6482D] dark:hover:text-[#F2B8A2] flex items-center justify-center"
                    >
                      <AlarmClock className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void onDeleteTask(task.id)}
                    aria-label="Delete task"
                    className="min-w-[40px] min-h-[40px] rounded-xl hover:bg-slate-900/[0.06] dark:hover:bg-white/[0.06] text-[#5B6472] dark:text-[#98A2B3] hover:text-[#A6482D] dark:hover:text-[#F2B8A2] flex items-center justify-center"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
