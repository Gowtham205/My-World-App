import React, { useMemo, useRef, useState } from 'react';
import {
  Bell,
  Cake,
  CalendarPlus,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Download,
  ExternalLink,
  MapPin,
  Pencil,
  Plus,
  Trash2,
  Wind,
} from 'lucide-react';
import type {
  AlarmItem,
  BirthdayEntry,
  CalendarEventColor,
  CalendarEventItem,
  CustomAudioTone,
  EventCalmSession,
  TaskReminderItem,
} from '../types/sanctuary';
import { createId } from '../lib/storage';
import {
  buildGoogleCalendarUrl,
  downloadIcsFile,
  formatShortDate,
  formatTime12h,
  getTodayStr,
  validateFutureDateTime,
} from '../lib/dateUtils';
import { doesTaskMatchDate, formatTaskRecurrenceLabel } from '../lib/taskRecurrence';
import {
  TaskFormFields,
  makeEmptyTaskDraft,
  persistTaskDraft,
  taskToFormDraft,
  validateTaskDraft,
  type TaskFormDraft,
} from '../components/TaskFormFields';
import {
  EventCalmFormFields,
  eventSessionToDraft,
  makeEmptyEventCalmDraft,
  persistEventCalmDraft,
  validateEventCalmDraft,
  type EventCalmFormDraft,
} from '../components/EventCalmFormFields';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { stopSoundPreview } from '../lib/sound';
import { ModernSelect } from '../components/ModernSelect';
import { ModernDatePicker } from '../components/ModernDatePicker';
import { ModernTimePicker } from '../components/ModernTimePicker';

interface CalendarViewProps {
  events: CalendarEventItem[];
  tasks: TaskReminderItem[];
  birthdays: BirthdayEntry[];
  eventSessions: EventCalmSession[];
  alarms: AlarmItem[];
  customAudioTones: CustomAudioTone[];
  defaultNotificationSoundId: string;
  onSaveEvent: (event: CalendarEventItem) => Promise<void>;
  onDeleteEvent: (id: string) => Promise<void>;
  onSaveTask: (task: TaskReminderItem) => Promise<void>;
  onDeleteTask: (id: string) => Promise<void>;
  onCreateLinkedAlarm: (alarm: AlarmItem) => Promise<void>;
  onDeleteLinkedAlarm?: (alarmId: string) => Promise<void>;
  onSaveCustomTone: (tone: CustomAudioTone) => Promise<void>;
  onSaveEventSession: (session: EventCalmSession) => Promise<void>;
  onDeleteEventSession: (id: string) => Promise<void>;
  onOpenBreathing: (session: EventCalmSession) => void;
}

type CalendarEntryType = 'calendar' | 'task' | 'event-calm';

type PendingDeleteTarget =
  | { kind: 'calendar'; item: CalendarEventItem }
  | { kind: 'task'; item: TaskReminderItem }
  | { kind: 'event-calm'; item: EventCalmSession }
  | null;

const WEEKDAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const CalendarView: React.FC<CalendarViewProps> = ({
  events,
  tasks,
  birthdays,
  eventSessions,
  alarms,
  customAudioTones,
  defaultNotificationSoundId,
  onSaveEvent,
  onDeleteEvent,
  onSaveTask,
  onDeleteTask,
  onCreateLinkedAlarm,
  onDeleteLinkedAlarm,
  onSaveCustomTone,
  onSaveEventSession,
  onDeleteEventSession,
  onOpenBreathing,
}) => {
  const todayStr = getTodayStr();
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [viewCursor, setViewCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  // Bottom form state (always rendered BELOW the calendar grid + selected day agenda)
  const [showForm, setShowForm] = useState(false);
  const [entryType, setEntryType] = useState<CalendarEntryType>('calendar');
  const [formError, setFormError] = useState<string | null>(null);
  const formSectionRef = useRef<HTMLFormElement | null>(null);

  // Calendar Event draft & edit target
  const [editingEvent, setEditingEvent] = useState<CalendarEventItem | null>(null);
  const [title, setTitle] = useState('');
  const [eventDate, setEventDate] = useState(todayStr);
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('11:00');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [color, setColor] = useState<CalendarEventColor>('sky');

  // Task / Smart Reminder draft & edit target
  const [editingTask, setEditingTask] = useState<TaskReminderItem | null>(null);
  const [taskDraft, setTaskDraft] = useState<TaskFormDraft>(() =>
    makeEmptyTaskDraft(defaultNotificationSoundId, todayStr)
  );

  // Event Calm draft & edit target
  const [editingSession, setEditingSession] = useState<EventCalmSession | null>(null);
  const [calmDraft, setCalmDraft] = useState<EventCalmFormDraft>(() =>
    makeEmptyEventCalmDraft(todayStr)
  );

  const [pendingDelete, setPendingDelete] = useState<PendingDeleteTarget>(null);

  const year = viewCursor.getFullYear();
  const month = viewCursor.getMonth();

  const monthLabel = viewCursor.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  const calendarDays = useMemo(() => {
    const firstDayOfWeek = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (string | null)[] = [];

    for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const mStr = String(month + 1).padStart(2, '0');
      const dStr = String(d).padStart(2, '0');
      cells.push(`${year}-${mStr}-${dStr}`);
    }
    return cells;
  }, [year, month]);

  const getItemsForDate = (dateStr: string) => {
    const mmdd = dateStr.slice(5);
    const dayEvents = events.filter((e) => e.date === dateStr);
    const dayTasks = tasks.filter((t) => doesTaskMatchDate(t, dateStr));
    const dayCalmSessions = eventSessions.filter((s) => s.date === dateStr);
    const dayBirthdays = birthdays.filter((b) => b.birthDate.slice(5) === mmdd);
    return { dayEvents, dayTasks, dayCalmSessions, dayBirthdays };
  };

  const selectedAgenda = getItemsForDate(selectedDate);

  const scrollFormIntoView = () => {
    window.setTimeout(() => {
      formSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  };

  const resetAllDrafts = (preferredDate = selectedDate) => {
    const safeInitialDate = preferredDate >= todayStr ? preferredDate : todayStr;
    setEditingEvent(null);
    setEditingTask(null);
    setEditingSession(null);
    setFormError(null);
    setTitle('');
    setEventDate(safeInitialDate);
    setStartTime('10:00');
    setEndTime('11:00');
    setLocation('');
    setNotes('');
    setColor('sky');
    setTaskDraft(makeEmptyTaskDraft(defaultNotificationSoundId, safeInitialDate));
    setCalmDraft(makeEmptyEventCalmDraft(safeInitialDate));
  };

  const openCreateForm = (defaultType: CalendarEntryType = 'calendar') => {
    stopSoundPreview();
    resetAllDrafts(selectedDate);
    setEntryType(defaultType);
    setShowForm(true);
    scrollFormIntoView();
  };

  const openEditCalendarEvent = (ev: CalendarEventItem) => {
    stopSoundPreview();
    resetAllDrafts(ev.date);
    setEntryType('calendar');
    setEditingEvent(ev);
    setTitle(ev.title);
    setEventDate(ev.date);
    setStartTime(ev.startTime || '10:00');
    setEndTime(ev.endTime || '11:00');
    setLocation(ev.location || '');
    setNotes(ev.notes || '');
    setColor(ev.color);
    setShowForm(true);
    scrollFormIntoView();
  };

  const openEditTask = (task: TaskReminderItem) => {
    stopSoundPreview();
    resetAllDrafts(task.dueDate || selectedDate);
    setEntryType('task');
    setEditingTask(task);
    setTaskDraft(taskToFormDraft(task, defaultNotificationSoundId));
    setShowForm(true);
    scrollFormIntoView();
  };

  const openEditCalmSession = (session: EventCalmSession) => {
    stopSoundPreview();
    resetAllDrafts(session.date);
    setEntryType('event-calm');
    setEditingSession(session);
    setCalmDraft(eventSessionToDraft(session));
    setShowForm(true);
    scrollFormIntoView();
  };

  const closeForm = () => {
    stopSoundPreview();
    resetAllDrafts(selectedDate);
    setShowForm(false);
  };

  const isEditingAny = Boolean(editingEvent || editingTask || editingSession);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (entryType === 'calendar') {
      if (!title.trim()) {
        setFormError('Please enter an event title.');
        return;
      }
      const targetDate = eventDate || selectedDate;
      if (!editingEvent) {
        const err = validateFutureDateTime({
          date: targetDate,
          time: startTime || undefined,
          dateLabel: 'Event Date',
          timeLabel: 'Start Time',
        });
        if (err) {
          setFormError(err);
          return;
        }
      }
      setFormError(null);

      await onSaveEvent({
        id: editingEvent ? editingEvent.id : createId('cal'),
        title: title.trim(),
        date: targetDate,
        startTime,
        endTime,
        location: location.trim(),
        notes: notes.trim(),
        color,
        syncedToDevice: editingEvent?.syncedToDevice,
        createdAt: editingEvent ? editingEvent.createdAt : new Date().toISOString(),
      });
      setSelectedDate(targetDate);
      const parsed = new Date(`${targetDate}T12:00:00`);
      if (!Number.isNaN(parsed.getTime())) {
        setViewCursor(new Date(parsed.getFullYear(), parsed.getMonth(), 1));
      }
      closeForm();
      return;
    }

    if (entryType === 'task') {
      const err = validateTaskDraft(taskDraft, {
        skipPastValidation: Boolean(editingTask),
      });
      if (err) {
        setFormError(err);
        return;
      }
      setFormError(null);

      const savedTask = await persistTaskDraft({
        draft: taskDraft,
        existingTask: editingTask,
        alarms,
        customAudioTones,
        defaultNotificationSoundId,
        onSaveTask,
        onCreateLinkedAlarm,
        onDeleteLinkedAlarm,
      });
      if (savedTask?.dueDate) {
        setSelectedDate(savedTask.dueDate);
        const parsed = new Date(`${savedTask.dueDate}T12:00:00`);
        if (!Number.isNaN(parsed.getTime())) {
          setViewCursor(new Date(parsed.getFullYear(), parsed.getMonth(), 1));
        }
      }
      closeForm();
      return;
    }

    if (entryType === 'event-calm') {
      const err = validateEventCalmDraft(calmDraft, {
        skipPastValidation: Boolean(editingSession),
      });
      if (err) {
        setFormError(err);
        return;
      }
      setFormError(null);

      const savedSession = await persistEventCalmDraft({
        draft: calmDraft,
        existingSession: editingSession,
        onSaveSession: onSaveEventSession,
      });
      if (savedSession?.date) {
        setSelectedDate(savedSession.date);
        const parsed = new Date(`${savedSession.date}T12:00:00`);
        if (!Number.isNaN(parsed.getTime())) {
          setViewCursor(new Date(parsed.getFullYear(), parsed.getMonth(), 1));
        }
      }
      closeForm();
    }
  };

  const colorHex = (c: CalendarEventColor) => {
    if (c === 'sage') return '#9EC5AB';
    if (c === 'lavender') return '#BEB4DC';
    if (c === 'peach') return '#F2B8A2';
    return '#9BC4E2';
  };

  return (
    <div className="space-y-6">
      <header className="rounded-3xl bg-gradient-to-br from-[#EDF5FC] via-[#F4F9FE] to-[#F3F1FA] dark:from-[#16222E] dark:via-[#171F2A] dark:to-[#1C1B2B] border border-[#9BC4E2]/40 dark:border-[#9BC4E2]/25 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 shadow-xs">
        <div>
          <p className="text-xs font-medium text-[#255F8A] dark:text-[#9BC4E2]">General Calendar</p>
          <h1 className="font-display text-2xl sm:text-3xl font-medium text-[#111827] dark:text-[#F1F3F6] mt-1">
            Plans, Birthdays &amp; Reminders
          </h1>
          <p className="text-xs text-[#5B6472] dark:text-[#98A2B3] mt-1">
            Unified schedule for Calendar Events, Tasks &amp; Smart Reminders, Event Calm sessions,
            and Birthdays.
          </p>
        </div>

        <button
          type="button"
          onClick={() => openCreateForm('calendar')}
          className="min-h-[44px] px-5 py-2.5 rounded-2xl bg-[#9BC4E2] hover:bg-[#8AB6D6] text-[#0F1115] text-sm font-semibold flex items-center justify-center gap-2 whitespace-nowrap shadow-xs"
        >
          <Plus className="w-4 h-4" />
          Add Event
        </button>
      </header>

      {/* Monthly Grid + Selected Day Agenda ALWAYS at top */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Monthly Grid */}
        <section className="lg:col-span-7 rounded-3xl bg-white/85 dark:bg-[#181C26]/90 border border-[#9BC4E2]/30 dark:border-white/[0.08] p-5 sm:p-6 shadow-xs">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-display text-xl font-medium text-[#111827] dark:text-[#F1F3F6]">
              {monthLabel}
            </h2>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setViewCursor(new Date(year, month - 1, 1))}
                aria-label="Previous month"
                className="min-w-[44px] min-h-[44px] rounded-xl hover:bg-slate-900/[0.06] dark:hover:bg-white/[0.06] flex items-center justify-center text-[#5B6472] dark:text-[#98A2B3] hover:text-[#111827] dark:hover:text-[#F1F3F6]"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  const now = new Date();
                  setViewCursor(new Date(now.getFullYear(), now.getMonth(), 1));
                  setSelectedDate(todayStr);
                }}
                className="min-h-[40px] px-3 rounded-xl hover:bg-slate-900/[0.06] dark:hover:bg-white/[0.06] text-xs font-medium text-[#255F8A] dark:text-[#9BC4E2]"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setViewCursor(new Date(year, month + 1, 1))}
                aria-label="Next month"
                className="min-w-[44px] min-h-[44px] rounded-xl hover:bg-slate-900/[0.06] dark:hover:bg-white/[0.06] flex items-center justify-center text-[#5B6472] dark:text-[#98A2B3] hover:text-[#111827] dark:hover:text-[#F1F3F6]"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-2 text-center">
            {WEEKDAY_HEADERS.map((wd) => (
              <div key={wd} className="text-xs text-[#5B6472] dark:text-[#98A2B3] py-1">
                {wd}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((dateStr, idx) => {
              if (!dateStr) return <div key={`empty-${idx}`} className="h-12" />;
              const dayNum = Number(dateStr.slice(8));
              const isSelected = dateStr === selectedDate;
              const isToday = dateStr === todayStr;
              const { dayEvents, dayTasks, dayCalmSessions, dayBirthdays } =
                getItemsForDate(dateStr);

              return (
                <button
                  key={dateStr}
                  type="button"
                  onClick={() => setSelectedDate(dateStr)}
                  className={`h-12 rounded-2xl flex flex-col items-center justify-center gap-1 transition-colors ${
                    isSelected
                      ? 'bg-[#9BC4E2] text-[#0F1115] font-semibold'
                      : isToday
                        ? 'bg-slate-900/[0.07] dark:bg-white/[0.07] text-[#111827] dark:text-[#F1F3F6]'
                        : 'hover:bg-slate-900/[0.04] dark:hover:bg-white/[0.04] text-[#334155] dark:text-[#D0D5DD]'
                  }`}
                >
                  <span className="text-xs font-mono-tabular">{dayNum}</span>
                  <div className="flex items-center gap-1 h-1.5">
                    {dayEvents.slice(0, 2).map((ev) => (
                      <span
                        key={ev.id}
                        className="w-1.5 h-1.5 rounded-full"
                        style={{
                          backgroundColor: isSelected ? '#0F1115' : colorHex(ev.color),
                        }}
                      />
                    ))}
                    {dayTasks.length > 0 && (
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: isSelected ? '#0F1115' : '#BEB4DC' }}
                      />
                    )}
                    {dayCalmSessions.length > 0 && (
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: isSelected ? '#0F1115' : '#9EC5AB' }}
                      />
                    )}
                    {dayBirthdays.length > 0 && (
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: isSelected ? '#0F1115' : '#F2B8A2' }}
                      />
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-900/[0.07] dark:border-white/[0.06] flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-[#5B6472] dark:text-[#98A2B3]">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#9BC4E2]" />
              Event
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#BEB4DC]" />
              Task / Reminder
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#9EC5AB]" />
              Event Calm
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#F2B8A2]" />
              Birthday
            </span>
          </div>
        </section>

        {/* Selected Day Agenda */}
        <section className="lg:col-span-5 rounded-3xl bg-white/85 dark:bg-[#181C26]/90 border border-[#9BC4E2]/30 dark:border-white/[0.08] p-5 sm:p-6 space-y-4 shadow-xs">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs text-[#5B6472] dark:text-[#98A2B3]">Selected Day</p>
              <h2 className="text-lg font-semibold text-[#111827] dark:text-[#F1F3F6]">
                {formatShortDate(selectedDate)}
                {selectedDate === todayStr ? ' · Today' : ''}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => openCreateForm('calendar')}
              className="min-h-[40px] px-3 rounded-xl bg-slate-900/[0.05] dark:bg-white/[0.05] hover:bg-slate-900/[0.09] dark:hover:bg-white/[0.09] text-xs font-medium text-[#255F8A] dark:text-[#9BC4E2] flex items-center gap-1.5"
            >
              <CalendarPlus className="w-3.5 h-3.5" />
              Add
            </button>
          </div>

          {selectedAgenda.dayBirthdays.length === 0 &&
          selectedAgenda.dayEvents.length === 0 &&
          selectedAgenda.dayCalmSessions.length === 0 &&
          selectedAgenda.dayTasks.length === 0 ? (
            <p className="text-sm text-[#5B6472] dark:text-[#98A2B3] py-6 text-center">
              Nothing scheduled for this day.
            </p>
          ) : (
            <div className="space-y-3">
              {/* Birthdays */}
              {selectedAgenda.dayBirthdays.map((b) => (
                <div
                  key={b.id}
                  className="p-4 rounded-2xl bg-[#ECEFF3] dark:bg-[#1D212A] border border-slate-900/[0.08] dark:border-white/[0.06] flex items-center gap-3"
                >
                  <Cake className="w-4 h-4 text-[#A6482D] dark:text-[#F2B8A2] shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-[#111827] dark:text-[#F1F3F6]">
                      {b.name}’s Birthday
                    </p>
                    <p className="text-xs text-[#5B6472] dark:text-[#98A2B3]">{b.relationship}</p>
                  </div>
                </div>
              ))}

              {/* Calendar Events */}
              {selectedAgenda.dayEvents.map((ev) => (
                <div
                  key={ev.id}
                  className="p-4 rounded-2xl bg-[#ECEFF3] dark:bg-[#1D212A] border border-slate-900/[0.08] dark:border-white/[0.06] space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs text-[#255F8A] dark:text-[#9BC4E2] font-mono-tabular">
                        Calendar Event · {ev.startTime ? formatTime12h(ev.startTime) : 'All day'}
                        {ev.endTime ? ` – ${formatTime12h(ev.endTime)}` : ''}
                        {ev.location ? ` · ${ev.location}` : ''}
                      </p>
                      <h3 className="text-sm font-semibold text-[#111827] dark:text-[#F1F3F6] mt-0.5">
                        {ev.title}
                      </h3>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => openEditCalendarEvent(ev)}
                        aria-label={`Edit ${ev.title}`}
                        className="min-w-[36px] min-h-[36px] rounded-xl hover:bg-slate-900/[0.06] dark:hover:bg-white/[0.06] text-[#5B6472] dark:text-[#98A2B3] hover:text-[#255F8A] dark:hover:text-[#9BC4E2] flex items-center justify-center"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingDelete({ kind: 'calendar', item: ev })}
                        aria-label="Delete event"
                        className="min-w-[36px] min-h-[36px] rounded-xl hover:bg-slate-900/[0.06] dark:hover:bg-white/[0.06] text-[#5B6472] dark:text-[#98A2B3] hover:text-[#A6482D] dark:hover:text-[#F2B8A2] flex items-center justify-center"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {ev.notes && (
                    <p className="text-xs text-[#334155] dark:text-[#D0D5DD]">{ev.notes}</p>
                  )}

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => downloadIcsFile(ev)}
                      className="min-h-[36px] px-3 rounded-xl bg-slate-900/[0.05] dark:bg-white/[0.05] hover:bg-slate-900/[0.09] dark:hover:bg-white/[0.09] text-xs text-[#255F8A] dark:text-[#9BC4E2] flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Export .ICS
                    </button>
                    <a
                      href={buildGoogleCalendarUrl(ev)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-h-[36px] px-3 rounded-xl bg-slate-900/[0.05] dark:bg-white/[0.05] hover:bg-slate-900/[0.09] dark:hover:bg-white/[0.09] text-xs text-[#2E6B48] dark:text-[#9EC5AB] flex items-center gap-1.5"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Sync to Google Calendar
                    </a>
                  </div>
                </div>
              ))}

              {/* Event Calm Mode Sessions */}
              {selectedAgenda.dayCalmSessions.map((session) => (
                <div
                  key={session.id}
                  className="p-4 rounded-2xl bg-[#EEF7F1] dark:bg-[#172420] border border-[#9EC5AB]/40 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs text-[#2E6B48] dark:text-[#9EC5AB] font-medium flex items-center gap-1.5 flex-wrap">
                        <Wind className="w-3.5 h-3.5 shrink-0" />
                        <span>Event Calm Mode</span>
                        <span>·</span>
                        <span className="font-mono-tabular">
                          {formatTime12h(session.startTime)} – {formatTime12h(session.endTime)}
                        </span>
                      </p>
                      <h3 className="text-sm font-semibold text-[#111827] dark:text-[#F1F3F6] mt-0.5">
                        {session.eventName}
                      </h3>
                      {session.venue && (
                        <p className="text-xs text-[#5B6472] dark:text-[#98A2B3] mt-0.5 flex items-center gap-1">
                          <MapPin className="w-3 h-3 shrink-0" />
                          <span className="truncate">{session.venue}</span>
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => openEditCalmSession(session)}
                        aria-label={`Edit ${session.eventName}`}
                        className="min-w-[36px] min-h-[36px] rounded-xl hover:bg-slate-900/[0.06] dark:hover:bg-white/[0.06] text-[#5B6472] dark:text-[#98A2B3] hover:text-[#2E6B48] dark:hover:text-[#9EC5AB] flex items-center justify-center"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingDelete({ kind: 'event-calm', item: session })}
                        aria-label={`Delete ${session.eventName}`}
                        className="min-w-[36px] min-h-[36px] rounded-xl hover:bg-slate-900/[0.06] dark:hover:bg-white/[0.06] text-[#5B6472] dark:text-[#98A2B3] hover:text-[#A6482D] dark:hover:text-[#F2B8A2] flex items-center justify-center"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span className="text-[11px] text-[#5B6472] dark:text-[#98A2B3]">
                      {session.isMidpointOnly
                        ? 'Single midpoint check-in'
                        : `Every ${session.intervalMinutes}m check-in`}
                    </span>
                    <button
                      type="button"
                      onClick={() => onOpenBreathing(session)}
                      className="min-h-[34px] px-3 rounded-xl bg-[#9EC5AB] text-[#0F1115] text-xs font-semibold inline-flex items-center gap-1.5"
                    >
                      <Wind className="w-3.5 h-3.5" />
                      Calm &amp; Grounding
                    </button>
                  </div>
                </div>
              ))}

              {/* Tasks & Smart Reminders */}
              {selectedAgenda.dayTasks.map((t) => {
                const recLabel = formatTaskRecurrenceLabel(t);
                return (
                  <div
                    key={t.id}
                    className="p-4 rounded-2xl bg-[#F4F1FA] dark:bg-[#1E1B2B] border border-[#BEB4DC]/35 flex items-start justify-between gap-2"
                  >
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() =>
                          void onSaveTask({
                            ...t,
                            completed: !t.completed,
                            completedAt: !t.completed ? new Date().toISOString() : undefined,
                          })
                        }
                        aria-label={t.completed ? 'Mark incomplete' : 'Mark complete'}
                        className="min-w-[36px] min-h-[36px] -ml-1 -mt-1 flex items-center justify-center text-[#5B4D8A] dark:text-[#BEB4DC] shrink-0"
                      >
                        {t.completed ? (
                          <CheckCircle2 className="w-4 h-4 text-[#2E6B48] dark:text-[#9EC5AB]" />
                        ) : (
                          <Circle className="w-4 h-4" />
                        )}
                      </button>
                      <div className="min-w-0">
                        <p className="text-xs text-[#5B4D8A] dark:text-[#BEB4DC] flex items-center gap-1.5 flex-wrap">
                          <Bell className="w-3 h-3 shrink-0" />
                          <span>Task / Reminder · {t.category}</span>
                          {t.dueTime && (
                            <span className="font-mono-tabular">· {formatTime12h(t.dueTime)}</span>
                          )}
                          {recLabel && <span>· {recLabel}</span>}
                        </p>
                        <p
                          className={`text-sm font-medium mt-0.5 ${
                            t.completed
                              ? 'line-through text-[#5B6472] dark:text-[#98A2B3]'
                              : 'text-[#111827] dark:text-[#F1F3F6]'
                          }`}
                        >
                          {t.title}
                        </p>
                        {t.notes && (
                          <p className="text-xs text-[#5B6472] dark:text-[#98A2B3] mt-0.5">
                            {t.notes}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => openEditTask(t)}
                        aria-label={`Edit ${t.title}`}
                        className="min-w-[36px] min-h-[36px] rounded-xl hover:bg-slate-900/[0.06] dark:hover:bg-white/[0.06] text-[#5B6472] dark:text-[#98A2B3] hover:text-[#255F8A] dark:hover:text-[#9BC4E2] flex items-center justify-center"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingDelete({ kind: 'task', item: t })}
                        aria-label={`Delete ${t.title}`}
                        className="min-w-[36px] min-h-[36px] rounded-xl hover:bg-slate-900/[0.06] dark:hover:bg-white/[0.06] text-[#5B6472] dark:text-[#98A2B3] hover:text-[#A6482D] dark:hover:text-[#F2B8A2] flex items-center justify-center"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Add / Edit Form ALWAYS BELOW the Calendar & Selected Day Agenda */}
      {showForm && (
        <form
          ref={formSectionRef}
          onSubmit={(e) => void handleSubmit(e)}
          className="rounded-3xl bg-white/92 dark:bg-[#181C26]/95 border border-[#9BC4E2]/45 dark:border-[#9BC4E2]/25 p-5 sm:p-7 space-y-5 shadow-xs scroll-mt-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-[#111827] dark:text-[#F1F3F6]">
                {editingEvent
                  ? 'Edit Calendar Event'
                  : editingTask
                    ? 'Edit Task / Smart Reminder'
                    : editingSession
                      ? 'Edit Event Calm Session'
                      : `Schedule New Entry (${formatShortDate(
                          selectedDate >= todayStr ? selectedDate : todayStr
                        )})`}
              </h2>
              <p className="text-xs text-[#5B6472] dark:text-[#98A2B3] mt-0.5">
                {entryType === 'calendar'
                  ? 'Saves directly to your General Calendar.'
                  : entryType === 'task'
                    ? 'Saves to both Tasks & Smart Reminders and shows on your Calendar.'
                    : 'Saves to both Event Mode (Calm) and your Calendar.'}
              </p>
            </div>

            {!isEditingAny && (
              <div className="sm:min-w-[230px]">
                <label
                  htmlFor="calendar-entry-type"
                  className="block text-[11px] font-medium text-[#5B6472] dark:text-[#98A2B3] mb-1"
                >
                  Entry Type
                </label>
                <ModernSelect
                  id="calendar-entry-type"
                  ariaLabel="Entry Type"
                  title="Choose Entry Type"
                  accent="sky"
                  value={entryType}
                  onChange={(val) => {
                    stopSoundPreview();
                    setFormError(null);
                    setEntryType(val as CalendarEntryType);
                  }}
                  options={[
                    { value: 'calendar', label: 'Calendar Event', colorDot: '#9BC4E2' },
                    { value: 'task', label: 'Task / Smart Reminder', colorDot: '#BEB4DC' },
                    { value: 'event-calm', label: 'Event Calm Mode', colorDot: '#9EC5AB' },
                  ]}
                />
              </div>
            )}
          </div>

          {entryType === 'calendar' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => {
                    setFormError(null);
                    setTitle(e.target.value);
                  }}
                  placeholder="Event title"
                  className="sm:col-span-2 min-h-[44px] px-4 rounded-2xl bg-[#ECEFF3] dark:bg-[#1D212A] border border-slate-900/[0.10] dark:border-white/[0.08] text-sm text-[#111827] dark:text-[#F1F3F6]"
                />
                <div className="sm:col-span-2">
                  <label className="block text-xs text-[#5B6472] dark:text-[#98A2B3] mb-1">
                    Event Date
                  </label>
                  <ModernDatePicker
                    ariaLabel="Event Date"
                    title="Event Date"
                    accent="sky"
                    minDate={editingEvent ? undefined : todayStr}
                    value={eventDate}
                    onChange={(nextDate) => {
                      setFormError(null);
                      setEventDate(nextDate);
                    }}
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#5B6472] dark:text-[#98A2B3] mb-1">
                    Start Time
                  </label>
                  <ModernTimePicker
                    ariaLabel="Event Start Time"
                    title="Start Time"
                    accent="sky"
                    value={startTime}
                    onChange={(nextTime) => {
                      setFormError(null);
                      setStartTime(nextTime);
                    }}
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#5B6472] dark:text-[#98A2B3] mb-1">
                    End Time
                  </label>
                  <ModernTimePicker
                    ariaLabel="Event End Time"
                    title="End Time"
                    accent="sky"
                    allowClear
                    value={endTime}
                    onChange={(nextTime) => {
                      setFormError(null);
                      setEndTime(nextTime);
                    }}
                  />
                </div>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Location (optional)"
                  className="min-h-[44px] px-4 rounded-2xl bg-[#ECEFF3] dark:bg-[#1D212A] border border-slate-900/[0.10] dark:border-white/[0.08] text-sm text-[#111827] dark:text-[#F1F3F6]"
                />
                <ModernSelect
                  ariaLabel="Event Color"
                  title="Event Color"
                  accent="sky"
                  value={color}
                  onChange={(val) => setColor(val as CalendarEventColor)}
                  options={[
                    { value: 'sky', label: 'Sky Blue', colorDot: '#9BC4E2' },
                    { value: 'sage', label: 'Sage Green', colorDot: '#9EC5AB' },
                    { value: 'lavender', label: 'Muted Lavender', colorDot: '#BEB4DC' },
                    { value: 'peach', label: 'Warm Peach', colorDot: '#F2B8A2' },
                  ]}
                />
              </div>

              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Event notes..."
                className="w-full p-4 rounded-2xl bg-[#ECEFF3] dark:bg-[#1D212A] border border-slate-900/[0.10] dark:border-white/[0.08] text-sm text-[#111827] dark:text-[#F1F3F6]"
              />

              {formError && (
                <div
                  role="alert"
                  className="rounded-2xl bg-[#FDF1EB] dark:bg-[#2B1C19] border border-[#F2B8A2]/50 px-4 py-3 text-xs font-medium text-[#A6482D] dark:text-[#F2B8A2]"
                >
                  {formError}
                </div>
              )}
            </div>
          )}

          {entryType === 'task' && (
            <TaskFormFields
              draft={taskDraft}
              onChange={(updater) => {
                setFormError(null);
                setTaskDraft(updater);
              }}
              customAudioTones={customAudioTones}
              onSaveCustomTone={onSaveCustomTone}
              validationError={formError}
              allowPastDates={Boolean(editingTask)}
            />
          )}

          {entryType === 'event-calm' && (
            <EventCalmFormFields
              draft={calmDraft}
              onChange={(updater) => {
                setFormError(null);
                setCalmDraft(updater);
              }}
              validationError={formError}
              allowPastDates={Boolean(editingSession)}
            />
          )}

          <div className="flex justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={closeForm}
              className="min-h-[44px] px-4 rounded-2xl bg-slate-900/[0.05] dark:bg-white/[0.05] text-sm text-[#334155] dark:text-[#D0D5DD]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`min-h-[44px] px-5 rounded-2xl text-[#0F1115] text-sm font-semibold ${
                entryType === 'task'
                  ? 'bg-[#BEB4DC] hover:bg-[#AEA2D2]'
                  : entryType === 'event-calm'
                    ? 'bg-[#9EC5AB] hover:bg-[#8EB89D]'
                    : 'bg-[#9BC4E2] hover:bg-[#8AB6D6]'
              }`}
            >
              {isEditingAny
                ? 'Update Entry'
                : entryType === 'task'
                  ? 'Save Task'
                  : entryType === 'event-calm'
                    ? 'Save & Activate'
                    : 'Save Event'}
            </button>
          </div>
        </form>
      )}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={
          pendingDelete?.kind === 'task'
            ? 'Delete Task / Reminder?'
            : pendingDelete?.kind === 'event-calm'
              ? 'Delete Event Mode Session?'
              : 'Delete Calendar Event?'
        }
        message={
          pendingDelete?.kind === 'calendar'
            ? `Are you sure you want to delete "${pendingDelete.item.title}"?`
            : pendingDelete?.kind === 'task'
              ? `Are you sure you want to delete "${pendingDelete.item.title}"${
                  pendingDelete.item.linkedAlarmId ? ' and its linked alarm' : ''
                }?`
              : pendingDelete?.kind === 'event-calm'
                ? `Are you sure you want to delete "${pendingDelete.item.eventName}"?`
                : ''
        }
        confirmLabel="Delete"
        onConfirm={async () => {
          if (!pendingDelete) return;
          const target = pendingDelete;
          setPendingDelete(null);
          if (target.kind === 'calendar') {
            await onDeleteEvent(target.item.id);
          } else if (target.kind === 'task') {
            await onDeleteTask(target.item.id);
          } else {
            await onDeleteEventSession(target.item.id);
          }
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
};
