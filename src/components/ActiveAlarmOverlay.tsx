import React, { useEffect, useState } from 'react';
import { BellRing, Check, Clock, Play, Volume2 } from 'lucide-react';
import type { AlarmItem } from '../types/sanctuary';
import { formatTime12h } from '../lib/dateUtils';
import { ALARM_MAX_RING_MS } from '../lib/sound';

interface ActiveAlarmOverlayProps {
  alarm: AlarmItem;
  startedAtMs?: number;
  onDismiss: () => void;
  onSnooze: (minutes: number) => void;
}

export const ActiveAlarmOverlay: React.FC<ActiveAlarmOverlayProps> = ({
  alarm,
  startedAtMs,
  onDismiss,
  onSnooze,
}) => {
  const snoozeMins = alarm.snoozeMinutes || 5;
  const maxSeconds = Math.round(ALARM_MAX_RING_MS / 1000);
  const [secondsLeft, setSecondsLeft] = useState<number>(maxSeconds);

  useEffect(() => {
    const start = startedAtMs ?? Date.now();
    const update = () => {
      const elapsedSec = Math.floor((Date.now() - start) / 1000);
      setSecondsLeft(Math.max(0, maxSeconds - elapsedSec));
    };
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [startedAtMs, maxSeconds]);

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/70 dark:bg-[#0F1115]/95 backdrop-blur-xl flex items-center justify-center p-4 sm:p-6 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Active Alarm"
    >
      <div className="max-w-md w-full max-h-[92dvh] overflow-y-auto bg-white dark:bg-[#171A21] border border-slate-900/[0.1] dark:border-white/[0.1] rounded-3xl p-6 sm:p-8 text-center shadow-2xl my-auto">
        <div className="w-16 h-16 rounded-full bg-[#FCEEE9] dark:bg-[#F2B8A2]/15 border border-[#A6482D]/25 dark:border-[#F2B8A2]/30 flex items-center justify-center mx-auto mb-5">
          <BellRing className="w-7 h-7 text-[#A6482D] dark:text-[#F2B8A2] animate-pulse" />
        </div>

        <p className="text-xs text-[#5B6472] dark:text-[#98A2B3] tracking-wide mb-2">
          {alarm.linkedReminderId ? 'Smart Reminder Alarm' : 'Scheduled Alarm'}
        </p>

        <div className="font-mono-tabular text-4xl font-semibold text-[#111827] dark:text-[#F1F3F6] tracking-tight mb-3">
          {formatTime12h(alarm.time)}
        </div>

        <h2 className="font-display text-2xl text-[#111827] dark:text-[#F1F3F6] font-medium text-balance">
          {alarm.linkedReminderTitle || alarm.label}
        </h2>

        <div className="mt-3 flex flex-col items-center gap-1">
          <p className="text-xs text-[#2E6B48] dark:text-[#9EC5AB] inline-flex items-center gap-1.5 font-medium">
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Playing · {alarm.soundName || 'Sanctuary Chime (Default)'}</span>
            <Volume2 className="w-3.5 h-3.5 animate-pulse" />
          </p>
          <p className="text-[11px] text-[#5B6472] dark:text-[#98A2B3] tabular-nums">
            {(alarm.autoSnoozeCount || 0) >= 5
              ? `Final ring (5/5 auto-snoozes used) · stops permanently in 0:${String(secondsLeft).padStart(2, '0')}`
              : `Auto-stops & snoozes ${snoozeMins}m in 0:${String(secondsLeft).padStart(2, '0')} · Auto-snooze ${(alarm.autoSnoozeCount || 0) + 1}/5`}
          </p>
        </div>

        {alarm.linkedReminderNotes && (
          <div className="mt-4 p-4 rounded-2xl bg-[#ECEFF3] dark:bg-[#1D212A] border border-slate-900/[0.06] dark:border-white/[0.06] text-left">
            <p className="text-xs text-[#5B6472] dark:text-[#98A2B3] mb-1">Reminder Notes</p>
            <p className="text-sm text-[#111827] dark:text-[#F1F3F6] leading-relaxed">
              {alarm.linkedReminderNotes}
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 mt-8">
          <button
            type="button"
            onClick={() => onSnooze(snoozeMins)}
            className="min-h-[48px] px-4 py-3 rounded-2xl bg-[#ECEFF3] dark:bg-[#1D212A] hover:bg-slate-900/[0.08] dark:hover:bg-white/[0.08] border border-slate-900/[0.08] dark:border-white/[0.08] text-sm font-medium text-[#111827] dark:text-[#F1F3F6] flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
          >
            <Clock className="w-4 h-4 text-[#5B4D8A] dark:text-[#BEB4DC]" />
            Snooze {snoozeMins}m
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="min-h-[48px] px-4 py-3 rounded-2xl bg-[#9EC5AB] hover:bg-[#8EB89D] text-[#0F1115] text-sm font-semibold flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
          >
            <Check className="w-4 h-4" />
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};
