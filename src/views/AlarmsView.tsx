import React, { useState } from 'react';
import { AlarmClock, BellRing, Plus, Trash2 } from 'lucide-react';
import type { AlarmItem } from '../types/sanctuary';
import { createId } from '../lib/storage';
import { formatTime12h } from '../lib/dateUtils';

interface AlarmsViewProps {
  alarms: AlarmItem[];
  onSaveAlarm: (alarm: AlarmItem) => Promise<void>;
  onDeleteAlarm: (id: string) => Promise<void>;
  onTestRingAlarm: (alarm: AlarmItem) => void;
}

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export const AlarmsView: React.FC<AlarmsViewProps> = ({
  alarms,
  onSaveAlarm,
  onDeleteAlarm,
  onTestRingAlarm,
}) => {
  const [showAdd, setShowAdd] = useState(false);
  const [label, setLabel] = useState('');
  const [time, setTime] = useState('07:30');
  const [repeatDays, setRepeatDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [snoozeMinutes, setSnoozeMinutes] = useState(10);

  const toggleDay = (dayIdx: number) => {
    setRepeatDays((prev) =>
      prev.includes(dayIdx) ? prev.filter((d) => d !== dayIdx) : [...prev, dayIdx].sort()
    );
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!time) return;

    await onSaveAlarm({
      id: createId('alarm'),
      label: label.trim() || 'Sanctuary Alarm',
      time,
      enabled: true,
      repeatDays,
      snoozeMinutes,
      createdAt: new Date().toISOString(),
    });

    setLabel('');
    setShowAdd(false);
  };

  const sortedAlarms = [...alarms].sort((a, b) => a.time.localeCompare(b.time));

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-xs text-[#F2B8A2]">Dedicated Alarms</p>
          <h1 className="font-display text-2xl sm:text-3xl font-medium text-[#F1F3F6] mt-1">
            Wake-Up, Medicine & Break Alarms
          </h1>
          <p className="text-xs text-[#98A2B3] mt-1">
            Includes standalone alarms and alarms auto-created from Smart Reminders.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAdd((v) => !v)}
          className="min-h-[44px] px-5 py-2.5 rounded-2xl bg-[#F2B8A2] hover:bg-[#E7A890] text-[#0F1115] text-sm font-semibold flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          New Alarm
        </button>
      </header>

      {showAdd && (
        <form
          onSubmit={handleCreate}
          className="rounded-3xl bg-[#171A21] border border-[#F2B8A2]/30 p-5 sm:p-7 space-y-4"
        >
          <h2 className="text-base font-semibold text-[#F1F3F6]">Configure Alarm</h2>
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

          <div>
            <label className="block text-xs text-[#98A2B3] mb-1">Snooze Duration</label>
            <select
              value={snoozeMinutes}
              onChange={(e) => setSnoozeMinutes(Number(e.target.value))}
              className="min-h-[44px] px-4 rounded-2xl bg-[#1D212A] border border-white/[0.08] text-sm text-[#F1F3F6]"
            >
              <option value={5}>5 minutes</option>
              <option value={10}>10 minutes</option>
              <option value={15}>15 minutes</option>
            </select>
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
              Save Alarm
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
          {sortedAlarms.map((alarm) => (
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
                    onClick={() => onDeleteAlarm(alarm.id)}
                    aria-label="Delete alarm"
                    className="min-w-[40px] min-h-[40px] rounded-xl hover:bg-white/[0.06] text-[#98A2B3] hover:text-[#F2B8A2] flex items-center justify-center"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
};
