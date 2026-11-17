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
  onSaveCustomTone: (tone: CustomAudioTone) => Promise<void>;
}

const PRIORITIES: TaskPriority[] = ['High', 'Medium', 'Low'];
const CATEGORIES: TaskCategory[] = ['Personal', 'Work', 'Health', 'Learning', 'Home'];
const RECURRENCES: RecurrencePattern[] = ['Once', 'Daily', 'Weekly', 'Monthly', 'Custom'];

export const TasksView: React.FC<TasksViewProps> = ({
  tasks,
  alarms = [],
  customAudioTones,
  defaultNotificationSoundId,
  onSaveTask,
  onDeleteTask,
  onCreateLinkedAlarm,
  onSaveCustomTone,
}) => {
  const [filterStatus, setFilterStatus] = useState<'active' | 'completed' | 'all'>('active');
  const [categoryFilter, setCategoryFilter] = useState<TaskCategory | 'All'>('All');
  const [showAdd, setShowAdd] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskReminderItem | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('Medium');
  const [category, setCategory] = useState<TaskCategory>('Personal');
  const [dueDate, setDueDate] = useState(getTodayStr());
  const [dueTime, setDueTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [recurrence, setRecurrence] = useState<RecurrencePattern>('Once');
  const [customRecurrenceNote, setCustomRecurrenceNote] = useState('');

  // Smart Reminder-to-Alarm Bridge & Sound state
  const [askAlarmBridge, setAskAlarmBridge] = useState(false);
  const [pendingSavedTask, setPendingSavedTask] = useState<TaskReminderItem | null>(null);
  const [linkAlarmOnCreate, setLinkAlarmOnCreate] = useState(true);
  const [selectedSoundId, setSelectedSoundId] = useState(defaultNotificationSoundId);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const audioUploadRef = useRef<HTMLInputElement | null>(null);

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

  const resetForm = () => {
    setEditingTask(null);
    setTitle('');
    setNotes('');
    setPriority('Medium');
    setCategory('Personal');
    setDueDate(getTodayStr());
    setDueTime('');
    setEndTime('');
    setRecurrence('Once');
    setCustomRecurrenceNote('');
    setSelectedSoundId(defaultNotificationSoundId);
    setLinkAlarmOnCreate(true);
  };

  const openCreateForm = () => {
    resetForm();
    setShowAdd((v) => !v);
  };

  const openEditForm = (task: TaskReminderItem) => {
    setEditingTask(task);
    setTitle(task.title);
    setNotes(task.notes);
    setPriority(task.priority);
    setCategory(task.category);
    setDueDate(task.dueDate || getTodayStr());
    setDueTime(task.dueTime || '');
    setEndTime(task.endTime || '');
    setRecurrence(task.recurrence);
    setCustomRecurrenceNote(task.customRecurrenceNote || '');
    setSelectedSoundId(task.soundId || defaultNotificationSoundId);
    setLinkAlarmOnCreate(!task.linkedAlarmId);
    setShowAdd(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const resolvedSoundName = dueTime
      ? resolveSoundName(customAudioTones, selectedSoundId)
      : undefined;

    const scheduleChanged =
      editingTask &&
      (editingTask.dueDate !== (dueDate || getTodayStr()) || editingTask.dueTime !== dueTime);

    const savedTask: TaskReminderItem = {
      id: editingTask ? editingTask.id : createId('task'),
      title: title.trim(),
      notes: notes.trim(),
      priority,
      category,
      dueDate: dueDate || getTodayStr(),
      dueTime,
      endTime: endTime || undefined,
      recurrence,
      customRecurrenceNote: recurrence === 'Custom' ? customRecurrenceNote.trim() : undefined,
      completed: editingTask ? editingTask.completed : false,
      completedAt: editingTask?.completedAt,
      linkedAlarmId: editingTask?.linkedAlarmId,
      soundId: dueTime ? selectedSoundId : undefined,
      soundName: resolvedSoundName,
      lastNotifiedMinute: scheduleChanged ? undefined : editingTask?.lastNotifiedMinute,
      createdAt: editingTask ? editingTask.createdAt : new Date().toISOString(),
    };

    await onSaveTask(savedTask);

    // Keep linked alarm synchronized when editing a task that already has a linked alarm
    if (editingTask?.linkedAlarmId && dueTime) {
      const existingAlarm = alarms.find((a) => a.id === editingTask.linkedAlarmId);
      if (existingAlarm) {
        const repeatDays =
          savedTask.recurrence === 'Daily' ? [0, 1, 2, 3, 4, 5, 6] : existingAlarm.repeatDays;
        await onCreateLinkedAlarm({
          ...existingAlarm,
          label: savedTask.title,
          time: dueTime,
          repeatDays,
          linkedReminderTitle: savedTask.title,
          linkedReminderNotes: savedTask.notes,
          soundId: savedTask.soundId || existingAlarm.soundId,
          soundName: savedTask.soundName || existingAlarm.soundName,
          lastTriggeredMinute: scheduleChanged ? undefined : existingAlarm.lastTriggeredMinute,
        });
      }
    } else if (dueTime && !savedTask.linkedAlarmId && linkAlarmOnCreate) {
      setPendingSavedTask(savedTask);
      setAskAlarmBridge(true);
    }

    resetForm();
    setShowAdd(false);
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
    setSelectedSoundId(tone.id);
  };

  const confirmLinkAlarm = async () => {
    if (!pendingSavedTask || !pendingSavedTask.dueTime) {
      setAskAlarmBridge(false);
      return;
    }
    const alarmId = createId('alarm');
    const repeatDays =
      pendingSavedTask.recurrence === 'Daily' ? [0, 1, 2, 3, 4, 5, 6] : [];

    const alarm: AlarmItem = {
      id: alarmId,
      label: pendingSavedTask.title,
      time: pendingSavedTask.dueTime,
      enabled: true,
      repeatDays,
      snoozeMinutes: 5,
      linkedReminderId: pendingSavedTask.id,
      linkedReminderTitle: pendingSavedTask.title,
      linkedReminderNotes: pendingSavedTask.notes,
      soundId: pendingSavedTask.soundId || selectedSoundId,
      soundName:
        pendingSavedTask.soundName ||
        resolveSoundName(customAudioTones, pendingSavedTask.soundId || selectedSoundId),
      createdAt: new Date().toISOString(),
    };

    await onCreateLinkedAlarm(alarm);
    await onSaveTask({ ...pendingSavedTask, linkedAlarmId: alarmId });
    setPendingSavedTask(null);
    setAskAlarmBridge(false);
  };

  const priorityTone = (p: TaskPriority) => {
    if (p === 'High') return 'text-[#F2B8A2]';
    if (p === 'Medium') return 'text-[#BEB4DC]';
    return 'text-[#9EC5AB]';
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-xs text-[#9EC5AB]">Tasks & Smart Reminders</p>
          <h1 className="font-display text-2xl sm:text-3xl font-medium text-[#F1F3F6] mt-1">
            To-Do & Scheduled Breaks
          </h1>
        </div>
        <button
          type="button"
          onClick={openCreateForm}
          className="min-h-[44px] px-5 py-2.5 rounded-2xl bg-[#9EC5AB] hover:bg-[#8EB89D] text-[#0F1115] text-sm font-semibold flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          New Task / Reminder
        </button>
      </header>

      {/* Interactive Smart Reminder-to-Alarm Bridge Prompt */}
      {askAlarmBridge && pendingSavedTask && (
        <div
          className="rounded-3xl bg-[#171A21] border border-[#F2B8A2]/40 p-6 space-y-4"
          role="dialog"
          aria-label="Set alarm for reminder"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#F2B8A2]/15 flex items-center justify-center shrink-0">
              <AlarmClock className="w-5 h-5 text-[#F2B8A2]" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[#F1F3F6]">
                Do you want to set an alarm for this?
              </h2>
              <p className="text-sm text-[#98A2B3] mt-1">
                Linking an alarm at{' '}
                <span className="text-[#F1F3F6] font-mono-tabular">
                  {formatTime12h(pendingSavedTask.dueTime)}
                </span>{' '}
                will ring and display “{pendingSavedTask.title}” on screen.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-2.5">
            <button
              type="button"
              onClick={() => {
                setPendingSavedTask(null);
                setAskAlarmBridge(false);
              }}
              className="min-h-[44px] px-4 rounded-2xl bg-white/[0.05] text-sm text-[#D0D5DD]"
            >
              No, reminder only
            </button>
            <button
              type="button"
              onClick={confirmLinkAlarm}
              className="min-h-[44px] px-5 rounded-2xl bg-[#F2B8A2] hover:bg-[#E7A890] text-[#0F1115] text-sm font-semibold"
            >
              Yes, create linked alarm
            </button>
          </div>
        </div>
      )}

      {/* Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 rounded-2xl bg-[#171A21] border border-white/[0.06] self-start">
          {(['active', 'completed', 'all'] as const).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setFilterStatus(status)}
              className={`min-h-[38px] px-3.5 rounded-xl text-xs font-medium capitalize transition-colors whitespace-nowrap ${
                filterStatus === status
                  ? 'bg-[#1D212A] text-[#F1F3F6]'
                  : 'text-[#98A2B3] hover:text-[#F1F3F6]'
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
                  ? 'bg-[#9EC5AB]/20 text-[#9EC5AB] border border-[#9EC5AB]/30'
                  : 'bg-[#171A21] text-[#98A2B3] border border-white/[0.06]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Add / Edit Task Form */}
      {showAdd && (
        <form
          onSubmit={handleSubmit}
          className="rounded-3xl bg-[#171A21] border border-[#9EC5AB]/30 p-5 sm:p-7 space-y-4"
        >
          <h2 className="text-base font-semibold text-[#F1F3F6]">
            {editingTask ? 'Edit Task or Smart Reminder' : 'Create Task or Smart Reminder'}
          </h2>

          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Take a break from 4:00 PM to 5:00 PM while working"
            className="w-full min-h-[44px] px-4 rounded-2xl bg-[#1D212A] border border-white/[0.08] text-sm text-[#F1F3F6]"
          />

          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes shown when your reminder or alarm triggers..."
            className="w-full p-4 rounded-2xl bg-[#1D212A] border border-white/[0.08] text-sm text-[#F1F3F6]"
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-[#98A2B3] mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full min-h-[44px] px-3 rounded-2xl bg-[#1D212A] border border-white/[0.08] text-sm text-[#F1F3F6]"
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p} Priority
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#98A2B3] mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as TaskCategory)}
                className="w-full min-h-[44px] px-3 rounded-2xl bg-[#1D212A] border border-white/[0.08] text-sm text-[#F1F3F6]"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#98A2B3] mb-1">Recurring</label>
              <select
                value={recurrence}
                onChange={(e) => setRecurrence(e.target.value as RecurrencePattern)}
                className="w-full min-h-[44px] px-3 rounded-2xl bg-[#1D212A] border border-white/[0.08] text-sm text-[#F1F3F6]"
              >
                {RECURRENCES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {recurrence === 'Custom' && (
            <input
              type="text"
              value={customRecurrenceNote}
              onChange={(e) => setCustomRecurrenceNote(e.target.value)}
              placeholder="Custom schedule (e.g. Every Tuesday & Thursday)"
              className="w-full min-h-[44px] px-4 rounded-2xl bg-[#1D212A] border border-white/[0.08] text-sm text-[#F1F3F6]"
            />
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-[#98A2B3] mb-1">Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full min-h-[44px] px-3 rounded-2xl bg-[#1D212A] border border-white/[0.08] text-sm text-[#F1F3F6]"
              />
            </div>
            <div>
              <label className="block text-xs text-[#98A2B3] mb-1">Start / Alert Time</label>
              <input
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                className="w-full min-h-[44px] px-3 rounded-2xl bg-[#1D212A] border border-white/[0.08] text-sm text-[#F1F3F6]"
              />
            </div>
            <div>
              <label className="block text-xs text-[#98A2B3] mb-1">End Time (optional)</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full min-h-[44px] px-3 rounded-2xl bg-[#1D212A] border border-white/[0.08] text-sm text-[#F1F3F6]"
              />
            </div>
          </div>

          {dueTime && (
            <div className="space-y-3 pt-1">
              <div>
                <label className="block text-xs text-[#98A2B3] mb-1">
                  Reminder / Alert Sound
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={selectedSoundId}
                    onChange={(e) => setSelectedSoundId(e.target.value)}
                    className="flex-1 min-w-0 min-h-[44px] px-3.5 rounded-2xl bg-[#1D212A] border border-white/[0.08] text-xs text-[#F1F3F6]"
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
                      if (isPreviewing) {
                        stopSoundPreview();
                        setIsPreviewing(false);
                      } else {
                        setIsPreviewing(true);
                        previewSoundTone(customAudioTones, selectedSoundId, () =>
                          setIsPreviewing(false)
                        );
                      }
                    }}
                    aria-label="Preview reminder sound"
                    className="min-w-[44px] min-h-[44px] rounded-2xl bg-[#1D212A] hover:bg-white/[0.08] border border-white/[0.08] text-[#9EC5AB] flex items-center justify-center shrink-0"
                  >
                    {isPreviewing ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => audioUploadRef.current?.click()}
                    className="min-h-[44px] px-3 rounded-2xl bg-[#1D212A] hover:bg-white/[0.08] border border-white/[0.08] text-xs font-medium text-[#9BC4E2] inline-flex items-center gap-1.5 shrink-0"
                  >
                    <Upload className="w-4 h-4" />
                    <span className="hidden sm:inline">Upload</span>
                  </button>
                  <input
                    ref={audioUploadRef}
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

              {!editingTask?.linkedAlarmId && (
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={linkAlarmOnCreate}
                    onChange={(e) => setLinkAlarmOnCreate(e.target.checked)}
                    className="w-4 h-4 accent-[#9EC5AB]"
                  />
                  <span className="text-xs text-[#D0D5DD]">
                    Prompt me to link a dedicated Alarm at {formatTime12h(dueTime)}
                  </span>
                </label>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => {
                resetForm();
                setShowAdd(false);
              }}
              className="min-h-[44px] px-4 rounded-2xl bg-white/[0.05] text-sm text-[#D0D5DD]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="min-h-[44px] px-5 rounded-2xl bg-[#9EC5AB] text-[#0F1115] text-sm font-semibold"
            >
              {editingTask ? 'Update Task' : 'Save Task'}
            </button>
          </div>
        </form>
      )}

      {/* Task List */}
      {filteredTasks.length === 0 ? (
        <div className="rounded-3xl bg-[#171A21] border border-white/[0.07] p-10 text-center">
          <p className="text-sm text-[#98A2B3]">
            Nothing in this view. Enjoy the breathing room or add a scheduled task.
          </p>
        </div>
      ) : (
        <div className="rounded-3xl bg-[#171A21] border border-white/[0.07] divide-y divide-white/[0.06]">
          {filteredTasks.map((task) => (
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
                  className="min-w-[44px] min-h-[44px] -ml-2 -mt-1.5 flex items-center justify-center text-[#98A2B3] hover:text-[#9EC5AB] shrink-0"
                >
                  {task.completed ? (
                    <CheckCircle2 className="w-5 h-5 text-[#9EC5AB]" />
                  ) : (
                    <Circle className="w-5 h-5" />
                  )}
                </button>

                <div className="min-w-0 flex-1">
                  <p
                    className={`text-sm font-medium ${
                      task.completed ? 'line-through text-[#98A2B3]' : 'text-[#F1F3F6]'
                    }`}
                  >
                    {task.title}
                  </p>
                  {task.notes && (
                    <p className="text-xs text-[#98A2B3] mt-1 leading-relaxed">{task.notes}</p>
                  )}
                  <p className="text-xs text-[#98A2B3] mt-2 flex flex-wrap items-center gap-1.5">
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
                        <span className="text-[#F2B8A2] inline-flex items-center gap-1">
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
                  onClick={() => openEditForm(task)}
                  aria-label={`Edit ${task.title}`}
                  title="Edit task"
                  className="min-w-[40px] min-h-[40px] rounded-xl hover:bg-white/[0.06] text-[#98A2B3] hover:text-[#9BC4E2] flex items-center justify-center"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                {task.dueTime && !task.linkedAlarmId && !task.completed && (
                  <button
                    type="button"
                    onClick={() => {
                      setPendingSavedTask(task);
                      setAskAlarmBridge(true);
                    }}
                    title="Link an Alarm"
                    className="min-w-[40px] min-h-[40px] rounded-xl hover:bg-white/[0.06] text-[#98A2B3] hover:text-[#F2B8A2] flex items-center justify-center"
                  >
                    <AlarmClock className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onDeleteTask(task.id)}
                  aria-label="Delete task"
                  className="min-w-[40px] min-h-[40px] rounded-xl hover:bg-white/[0.06] text-[#98A2B3] hover:text-[#F2B8A2] flex items-center justify-center"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
