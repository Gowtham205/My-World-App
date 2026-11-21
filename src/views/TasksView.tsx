import React, { useMemo, useRef, useState } from 'react';
import {
  AlarmClock,
  Bell,
  Check,
  CheckCircle2,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import type {
  AlarmItem,
  CustomAudioTone,
  TaskCategory,
  TaskPriority,
  TaskReminderItem,
} from '../types/sanctuary';
import { createId } from '../lib/storage';
import { formatShortDate, formatTime12h, getTodayStr } from '../lib/dateUtils';
import { BUILTIN_TONES, resolveSoundName, stopSoundPreview } from '../lib/sound';
import {
  TASK_CATEGORIES,
  TaskFormFields,
  makeEmptyTaskDraft,
  persistTaskDraft,
  taskToFormDraft,
  validateTaskDraft,
  type TaskFormDraft,
} from '../components/TaskFormFields';
import {
  deriveAlarmScheduleFromTask,
  formatTaskRecurrenceLabel,
} from '../lib/taskRecurrence';
import { ConfirmDialog } from '../components/ConfirmDialog';

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

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [pendingDeleteTask, setPendingDeleteTask] = useState<TaskReminderItem | null>(null);
  const [completionFeedback, setCompletionFeedback] = useState<{
    task: TaskReminderItem;
    markedCompleted: boolean;
  } | null>(null);

  const inlineEditFormRef = useRef<HTMLFormElement | null>(null);

  const [createDraft, setCreateDraft] = useState<TaskFormDraft>(() =>
    makeEmptyTaskDraft(defaultNotificationSoundId)
  );
  const [editDraft, setEditDraft] = useState<TaskFormDraft>(() =>
    makeEmptyTaskDraft(defaultNotificationSoundId)
  );

  const statusCounts = useMemo(() => {
    const active = tasks.filter((t) => !t.completed).length;
    const completed = tasks.filter((t) => t.completed).length;
    return { active, completed, all: tasks.length };
  }, [tasks]);

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
    setEditingTaskId(null);
    setCreateError(null);
    setCreateDraft(makeEmptyTaskDraft(defaultNotificationSoundId));
    setShowCreateForm((v) => !v);
  };

  const openInlineEdit = (task: TaskReminderItem) => {
    stopSoundPreview();
    setShowCreateForm(false);
    setEditError(null);
    setEditingTaskId(task.id);
    setEditDraft(taskToFormDraft(task, defaultNotificationSoundId));
    window.setTimeout(() => {
      inlineEditFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 50);
  };

  const cancelInlineEdit = () => {
    stopSoundPreview();
    setEditError(null);
    setEditingTaskId(null);
  };

  const handleToggleCompleted = async (task: TaskReminderItem) => {
    const nextCompleted = !task.completed;
    await onSaveTask({
      ...task,
      completed: nextCompleted,
      completedAt: nextCompleted ? new Date().toISOString() : undefined,
    });
    setCompletionFeedback({ task, markedCompleted: nextCompleted });
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateTaskDraft(createDraft);
    if (err) {
      setCreateError(err);
      return;
    }
    setCreateError(null);
    await persistTaskDraft({
      draft: createDraft,
      alarms,
      customAudioTones,
      defaultNotificationSoundId,
      onSaveTask,
      onCreateLinkedAlarm,
      onDeleteLinkedAlarm,
    });
    stopSoundPreview();
    setCreateDraft(makeEmptyTaskDraft(defaultNotificationSoundId));
    setShowCreateForm(false);
  };

  const handleEditSubmit = async (e: React.FormEvent, existingTask: TaskReminderItem) => {
    e.preventDefault();
    const err = validateTaskDraft(editDraft);
    if (err) {
      setEditError(err);
      return;
    }
    setEditError(null);
    await persistTaskDraft({
      draft: editDraft,
      existingTask,
      alarms,
      customAudioTones,
      defaultNotificationSoundId,
      onSaveTask,
      onCreateLinkedAlarm,
      onDeleteLinkedAlarm,
    });
    stopSoundPreview();
    setEditingTaskId(null);
  };

  const handleQuickLinkAlarm = async (task: TaskReminderItem) => {
    if (!task.dueTime) return;
    const alarmId = createId('alarm');
    const { repeatDays, date } = deriveAlarmScheduleFromTask({
      recurrence: task.recurrence,
      dueDate: task.dueDate || getTodayStr(),
      customRecurrenceUnit: task.customRecurrenceUnit,
      customRecurrenceDays: task.customRecurrenceDays,
      customRecurrenceMonthDays: task.customRecurrenceMonthDays,
    });
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

  const priorityTone = (p: TaskPriority) => {
    if (p === 'High') return 'text-[#A6482D] dark:text-[#F2B8A2]';
    if (p === 'Medium') return 'text-[#5B4D8A] dark:text-[#BEB4DC]';
    return 'text-[#2E6B48] dark:text-[#9EC5AB]';
  };

  return (
    <div className="space-y-6">
      <header className="rounded-3xl bg-gradient-to-br from-[#F4F1FA] via-[#FAF7FE] to-[#EEF5F0] dark:from-[#1D1A2B] dark:via-[#191826] dark:to-[#17211F] border border-[#BEB4DC]/40 dark:border-[#BEB4DC]/25 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 shadow-xs">
        <div>
          <p className="text-xs font-medium text-[#5B4D8A] dark:text-[#D1C6F0]">
            Tasks & Smart Reminders
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-medium text-[#111827] dark:text-[#F1F3F6] mt-1">
            To-Do & Scheduled Breaks
          </h1>
        </div>
        <button
          type="button"
          onClick={toggleCreateForm}
          className="min-h-[44px] px-5 py-2.5 rounded-2xl bg-[#BEB4DC] hover:bg-[#AEA2D2] text-[#0F1115] text-sm font-semibold flex items-center justify-center gap-2 transition-colors whitespace-nowrap shadow-xs"
        >
          <Plus className="w-4 h-4" />
          New Task / Reminder
        </button>
      </header>

      {/* Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 rounded-2xl bg-white/80 dark:bg-[#181C26]/90 border border-[#BEB4DC]/30 dark:border-white/[0.08] self-start">
          {(['active', 'completed', 'all'] as const).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setFilterStatus(status)}
              className={`min-h-[38px] px-3.5 rounded-xl text-xs font-medium capitalize transition-colors whitespace-nowrap ${
                filterStatus === status
                  ? 'bg-[#EFEAFB] dark:bg-[#2A233D] text-[#5B4D8A] dark:text-[#D1C6F0]'
                  : 'text-[#5B6472] dark:text-[#98A2B3] hover:text-[#111827] dark:hover:text-[#F1F3F6]'
              }`}
            >
              {status} ({statusCounts[status]})
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {(['All', ...TASK_CATEGORIES] as const).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className={`min-h-[40px] px-3.5 rounded-2xl text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                categoryFilter === cat
                  ? 'bg-[#EFEAFB] dark:bg-[#2A233D] text-[#5B4D8A] dark:text-[#D1C6F0] border border-[#BEB4DC]/45'
                  : 'bg-white/80 dark:bg-[#181C26]/90 text-[#5B6472] dark:text-[#98A2B3] border border-slate-900/[0.08] dark:border-white/[0.08]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Create New Task Form */}
      {showCreateForm && (
        <form
          onSubmit={(e) => void handleCreateSubmit(e)}
          className="rounded-3xl bg-white/90 dark:bg-[#191D28]/95 border border-[#BEB4DC]/40 dark:border-[#BEB4DC]/25 p-5 sm:p-7 space-y-4 shadow-xs"
        >
          <h2 className="text-base font-semibold text-[#111827] dark:text-[#F1F3F6]">
            Create Task or Smart Reminder
          </h2>

          <TaskFormFields
            draft={createDraft}
            onChange={(updater) => {
              setCreateError(null);
              setCreateDraft(updater);
            }}
            customAudioTones={customAudioTones}
            onSaveCustomTone={onSaveCustomTone}
            validationError={createError}
          />

          <div className="flex justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => {
                stopSoundPreview();
                setCreateError(null);
                setCreateDraft(makeEmptyTaskDraft(defaultNotificationSoundId));
                setShowCreateForm(false);
              }}
              className="min-h-[44px] px-4 rounded-2xl bg-slate-900/[0.05] dark:bg-white/[0.05] text-sm text-[#334155] dark:text-[#D0D5DD]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="min-h-[44px] px-5 rounded-2xl bg-[#BEB4DC] hover:bg-[#AEA2D2] text-[#0F1115] text-sm font-semibold"
            >
              Save Task
            </button>
          </div>
        </form>
      )}

      {completionFeedback && (
        <div
          role="status"
          className="rounded-2xl bg-[#EAF5EE] dark:bg-[#17251F] border border-[#9EC5AB]/45 px-4 py-3 flex flex-wrap items-center justify-between gap-2.5 text-xs text-[#1F5636] dark:text-[#A9DFBE]"
        >
          <span>
            {completionFeedback.markedCompleted
              ? `Completed "${completionFeedback.task.title}" — moved to the Completed tab (not deleted).`
              : `Reopened "${completionFeedback.task.title}" — moved back to Active.`}
          </span>
          <div className="flex items-center gap-2 shrink-0">
            {completionFeedback.markedCompleted && filterStatus === 'active' && (
              <button
                type="button"
                onClick={() => {
                  setFilterStatus('completed');
                  setCompletionFeedback(null);
                }}
                className="min-h-[32px] px-3 rounded-xl bg-white/85 dark:bg-[#1D2B24] border border-[#9EC5AB]/40 font-semibold text-[#1F5636] dark:text-[#A9DFBE]"
              >
                View Completed
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                const target = completionFeedback.task;
                const undoToCompleted = !completionFeedback.markedCompleted;
                setCompletionFeedback(null);
                void onSaveTask({
                  ...target,
                  completed: undoToCompleted,
                  completedAt: undoToCompleted ? new Date().toISOString() : undefined,
                });
              }}
              className="min-h-[32px] px-3 rounded-xl bg-[#9EC5AB] text-[#0F1115] font-semibold"
            >
              Undo
            </button>
          </div>
        </div>
      )}

      {/* Task List */}
      {filteredTasks.length === 0 ? (
        <div className="rounded-3xl bg-white/85 dark:bg-[#181C26]/90 border border-[#BEB4DC]/30 dark:border-white/[0.08] p-10 text-center">
          <p className="text-sm text-[#5B6472] dark:text-[#98A2B3]">
            Nothing in this view. Enjoy the breathing room or add a scheduled task.
          </p>
        </div>
      ) : (
        <div className="rounded-3xl bg-white/85 dark:bg-[#181C26]/90 border border-[#BEB4DC]/30 dark:border-white/[0.08] divide-y divide-slate-900/[0.08] dark:divide-white/[0.06] shadow-xs">
          {filteredTasks.map((task) => {
            if (editingTaskId === task.id) {
              return (
                <form
                  key={task.id}
                  ref={inlineEditFormRef}
                  onSubmit={(e) => void handleEditSubmit(e, task)}
                  className="p-5 sm:p-6 space-y-4 bg-[#F8FAFC] dark:bg-[#151820] first:rounded-t-3xl last:rounded-b-3xl"
                >
                  <h2 className="text-sm font-semibold text-[#111827] dark:text-[#F1F3F6]">
                    Edit Task or Smart Reminder
                  </h2>

                  <TaskFormFields
                    draft={editDraft}
                    onChange={(updater) => {
                      setEditError(null);
                      setEditDraft(updater);
                    }}
                    customAudioTones={customAudioTones}
                    onSaveCustomTone={onSaveCustomTone}
                    validationError={editError}
                  />

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

            const recurrenceLabel = formatTaskRecurrenceLabel(task);

            return (
              <div
                key={task.id}
                className="p-4 sm:p-5 flex items-start justify-between gap-3"
              >
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => void handleToggleCompleted(task)}
                    title={task.completed ? 'Mark as active' : 'Mark as completed'}
                    aria-label={task.completed ? `Mark ${task.title} active` : `Mark ${task.title} completed`}
                    className="group min-w-[44px] min-h-[44px] -ml-2 -mt-1.5 flex items-center justify-center shrink-0"
                  >
                    {task.completed ? (
                      <CheckCircle2 className="w-6 h-6 text-[#2E6B48] dark:text-[#9EC5AB]" />
                    ) : (
                      <span className="w-5 h-5 rounded-md border-2 border-[#8E7EC4] dark:border-[#BEB4DC]/70 group-hover:border-[#2E6B48] dark:group-hover:border-[#9EC5AB] group-hover:bg-[#9EC5AB]/15 flex items-center justify-center transition-colors">
                        <Check className="w-3 h-3 text-transparent group-hover:text-[#2E6B48] dark:group-hover:text-[#9EC5AB] transition-colors" />
                      </span>
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
                      {recurrenceLabel && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-[#5B4D8A] dark:text-[#BEB4DC] font-medium">
                            {recurrenceLabel}
                          </span>
                        </>
                      )}
                      {task.linkedAlarmId ? (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-[#A6482D] dark:text-[#F2B8A2] inline-flex items-center gap-1">
                            <Bell className="w-3 h-3" />
                            Full Alarm
                          </span>
                        </>
                      ) : task.dueTime ? (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-[#2E6B48] dark:text-[#9EC5AB] inline-flex items-center gap-1">
                            <Bell className="w-3 h-3" />
                            Sound Reminder
                          </span>
                        </>
                      ) : null}
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
                    onClick={() => setPendingDeleteTask(task)}
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

      <ConfirmDialog
        open={Boolean(pendingDeleteTask)}
        title="Delete Task / Reminder?"
        message={
          pendingDeleteTask
            ? `Are you sure you want to delete "${pendingDeleteTask.title}"${
                pendingDeleteTask.linkedAlarmId ? ' and its linked alarm' : ''
              }?`
            : ''
        }
        confirmLabel="Delete"
        onConfirm={async () => {
          if (!pendingDeleteTask) return;
          const targetId = pendingDeleteTask.id;
          setPendingDeleteTask(null);
          await onDeleteTask(targetId);
        }}
        onCancel={() => setPendingDeleteTask(null)}
      />
    </div>
  );
};
