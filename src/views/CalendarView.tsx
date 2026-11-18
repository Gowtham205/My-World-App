import React, { useMemo, useState } from 'react';
import {
  Cake,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import type {
  BirthdayEntry,
  CalendarEventColor,
  CalendarEventItem,
  TaskReminderItem,
} from '../types/sanctuary';
import { createId } from '../lib/storage';
import {
  buildGoogleCalendarUrl,
  downloadIcsFile,
  formatShortDate,
  formatTime12h,
  getTodayStr,
} from '../lib/dateUtils';

interface CalendarViewProps {
  events: CalendarEventItem[];
  tasks: TaskReminderItem[];
  birthdays: BirthdayEntry[];
  onSaveEvent: (event: CalendarEventItem) => Promise<void>;
  onDeleteEvent: (id: string) => Promise<void>;
}

const WEEKDAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const CalendarView: React.FC<CalendarViewProps> = ({
  events,
  tasks,
  birthdays,
  onSaveEvent,
  onDeleteEvent,
}) => {
  const todayStr = getTodayStr();
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [viewCursor, setViewCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [showAdd, setShowAdd] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEventItem | null>(null);

  // Event form
  const [title, setTitle] = useState('');
  const [eventDate, setEventDate] = useState(todayStr);
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('11:00');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [color, setColor] = useState<CalendarEventColor>('sky');

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
    const dayTasks = tasks.filter((t) => t.dueDate === dateStr);
    const dayBirthdays = birthdays.filter((b) => b.birthDate.slice(5) === mmdd);
    return { dayEvents, dayTasks, dayBirthdays };
  };

  const selectedAgenda = getItemsForDate(selectedDate);

  const resetForm = (targetDate = selectedDate) => {
    setEditingEvent(null);
    setTitle('');
    setEventDate(targetDate);
    setStartTime('10:00');
    setEndTime('11:00');
    setLocation('');
    setNotes('');
    setColor('sky');
  };

  const openCreateForm = () => {
    resetForm(selectedDate);
    setShowAdd((v) => !v);
  };

  const openEditForm = (ev: CalendarEventItem) => {
    setEditingEvent(ev);
    setTitle(ev.title);
    setEventDate(ev.date);
    setStartTime(ev.startTime || '10:00');
    setEndTime(ev.endTime || '11:00');
    setLocation(ev.location || '');
    setNotes(ev.notes || '');
    setColor(ev.color);
    setShowAdd(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const savedDate = eventDate || selectedDate;
    await onSaveEvent({
      id: editingEvent ? editingEvent.id : createId('cal'),
      title: title.trim(),
      date: savedDate,
      startTime,
      endTime,
      location: location.trim(),
      notes: notes.trim(),
      color,
      syncedToDevice: editingEvent?.syncedToDevice,
      createdAt: editingEvent ? editingEvent.createdAt : new Date().toISOString(),
    });
    setSelectedDate(savedDate);
    resetForm(savedDate);
    setShowAdd(false);
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
            Plans, Birthdays & Reminders
          </h1>
          <p className="text-xs text-[#5B6472] dark:text-[#98A2B3] mt-1">
            Local-first monthly schedule with optional .ICS & Google Calendar export.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateForm}
          className="min-h-[44px] px-5 py-2.5 rounded-2xl bg-[#9BC4E2] hover:bg-[#8AB6D6] text-[#0F1115] text-sm font-semibold flex items-center justify-center gap-2 whitespace-nowrap shadow-xs"
        >
          <Plus className="w-4 h-4" />
          Add Event
        </button>
      </header>

      {showAdd && (
        <form
          onSubmit={handleSubmit}
          className="rounded-3xl bg-white/90 dark:bg-[#181C26]/95 border border-[#9BC4E2]/40 dark:border-[#9BC4E2]/25 p-5 sm:p-7 space-y-4 shadow-xs"
        >
          <h2 className="text-base font-semibold text-[#111827] dark:text-[#F1F3F6]">
            {editingEvent ? 'Edit Event' : `New Event on ${formatShortDate(eventDate || selectedDate)}`}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Event title"
              className="sm:col-span-2 min-h-[44px] px-4 rounded-2xl bg-[#ECEFF3] dark:bg-[#1D212A] border border-slate-900/[0.10] dark:border-white/[0.08] text-sm text-[#111827] dark:text-[#F1F3F6]"
            />
            <input
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              className="sm:col-span-2 min-h-[44px] px-4 rounded-2xl bg-[#ECEFF3] dark:bg-[#1D212A] border border-slate-900/[0.10] dark:border-white/[0.08] text-sm text-[#111827] dark:text-[#F1F3F6]"
            />
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="min-h-[44px] px-4 rounded-2xl bg-[#ECEFF3] dark:bg-[#1D212A] border border-slate-900/[0.10] dark:border-white/[0.08] text-sm text-[#111827] dark:text-[#F1F3F6] font-mono-tabular"
            />
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="min-h-[44px] px-4 rounded-2xl bg-[#ECEFF3] dark:bg-[#1D212A] border border-slate-900/[0.10] dark:border-white/[0.08] text-sm text-[#111827] dark:text-[#F1F3F6] font-mono-tabular"
            />
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Location (optional)"
              className="min-h-[44px] px-4 rounded-2xl bg-[#ECEFF3] dark:bg-[#1D212A] border border-slate-900/[0.10] dark:border-white/[0.08] text-sm text-[#111827] dark:text-[#F1F3F6]"
            />
            <select
              value={color}
              onChange={(e) => setColor(e.target.value as CalendarEventColor)}
              className="min-h-[44px] px-4 rounded-2xl bg-[#ECEFF3] dark:bg-[#1D212A] border border-slate-900/[0.10] dark:border-white/[0.08] text-sm text-[#111827] dark:text-[#F1F3F6]"
            >
              <option value="sky">Sky Blue</option>
              <option value="sage">Sage Green</option>
              <option value="lavender">Muted Lavender</option>
              <option value="peach">Warm Peach</option>
            </select>
          </div>

          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Event notes..."
            className="w-full p-4 rounded-2xl bg-[#ECEFF3] dark:bg-[#1D212A] border border-slate-900/[0.10] dark:border-white/[0.08] text-sm text-[#111827] dark:text-[#F1F3F6]"
          />

          <div className="flex justify-end gap-2.5">
            <button
              type="button"
              onClick={() => {
                resetForm(selectedDate);
                setShowAdd(false);
              }}
              className="min-h-[44px] px-4 rounded-2xl bg-slate-900/[0.05] dark:bg-white/[0.05] text-sm text-[#334155] dark:text-[#D0D5DD]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="min-h-[44px] px-5 rounded-2xl bg-[#9BC4E2] text-[#0F1115] text-sm font-semibold"
            >
              {editingEvent ? 'Update Event' : 'Save Event'}
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Monthly Grid */}
        <section className="lg:col-span-7 rounded-3xl bg-white/85 dark:bg-[#181C26]/90 border border-[#9BC4E2]/30 dark:border-white/[0.08] p-5 sm:p-6 shadow-xs">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-display text-xl font-medium text-[#111827] dark:text-[#F1F3F6]">{monthLabel}</h2>
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
              const { dayEvents, dayTasks, dayBirthdays } = getItemsForDate(dateStr);

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
              onClick={() => {
                resetForm(selectedDate);
                setShowAdd(true);
              }}
              className="min-h-[40px] px-3 rounded-xl bg-slate-900/[0.05] dark:bg-white/[0.05] hover:bg-slate-900/[0.09] dark:hover:bg-white/[0.09] text-xs font-medium text-[#255F8A] dark:text-[#9BC4E2] flex items-center gap-1.5"
            >
              <CalendarPlus className="w-3.5 h-3.5" />
              Add
            </button>
          </div>

          {selectedAgenda.dayBirthdays.length === 0 &&
          selectedAgenda.dayEvents.length === 0 &&
          selectedAgenda.dayTasks.length === 0 ? (
            <p className="text-sm text-[#5B6472] dark:text-[#98A2B3] py-6 text-center">
              Nothing scheduled for this day.
            </p>
          ) : (
            <div className="space-y-3">
              {selectedAgenda.dayBirthdays.map((b) => (
                <div
                  key={b.id}
                  className="p-4 rounded-2xl bg-[#ECEFF3] dark:bg-[#1D212A] border border-slate-900/[0.08] dark:border-white/[0.06] flex items-center gap-3"
                >
                  <Cake className="w-4 h-4 text-[#A6482D] dark:text-[#F2B8A2] shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-[#111827] dark:text-[#F1F3F6]">{b.name}’s Birthday</p>
                    <p className="text-xs text-[#5B6472] dark:text-[#98A2B3]">{b.relationship}</p>
                  </div>
                </div>
              ))}

              {selectedAgenda.dayEvents.map((ev) => (
                <div
                  key={ev.id}
                  className="p-4 rounded-2xl bg-[#ECEFF3] dark:bg-[#1D212A] border border-slate-900/[0.08] dark:border-white/[0.06] space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs text-[#5B6472] dark:text-[#98A2B3] font-mono-tabular">
                        {ev.startTime ? formatTime12h(ev.startTime) : 'All day'}
                        {ev.endTime ? ` – ${formatTime12h(ev.endTime)}` : ''}
                        {ev.location ? ` · ${ev.location}` : ''}
                      </p>
                      <h3 className="text-sm font-semibold text-[#111827] dark:text-[#F1F3F6] mt-0.5">{ev.title}</h3>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => openEditForm(ev)}
                        aria-label={`Edit ${ev.title}`}
                        className="min-w-[36px] min-h-[36px] rounded-xl hover:bg-slate-900/[0.06] dark:hover:bg-white/[0.06] text-[#5B6472] dark:text-[#98A2B3] hover:text-[#255F8A] dark:hover:text-[#9BC4E2] flex items-center justify-center"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteEvent(ev.id)}
                        aria-label="Delete event"
                        className="min-w-[36px] min-h-[36px] rounded-xl hover:bg-slate-900/[0.06] dark:hover:bg-white/[0.06] text-[#5B6472] dark:text-[#98A2B3] hover:text-[#A6482D] dark:hover:text-[#F2B8A2] flex items-center justify-center"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {ev.notes && <p className="text-xs text-[#334155] dark:text-[#D0D5DD]">{ev.notes}</p>}

                  {/* Optional Device / Google Calendar Export Bridge */}
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

              {selectedAgenda.dayTasks.map((t) => (
                <div
                  key={t.id}
                  className="p-4 rounded-2xl bg-[#ECEFF3] dark:bg-[#1D212A] border border-slate-900/[0.08] dark:border-white/[0.06]"
                >
                  <p className="text-xs text-[#2E6B48] dark:text-[#9EC5AB]">
                    Reminder · {t.category}
                    {t.dueTime ? ` · ${formatTime12h(t.dueTime)}` : ''}
                  </p>
                  <p
                    className={`text-sm font-medium mt-0.5 ${
                      t.completed ? 'line-through text-[#5B6472] dark:text-[#98A2B3]' : 'text-[#111827] dark:text-[#F1F3F6]'
                    }`}
                  >
                    {t.title}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
