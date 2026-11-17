import React from 'react';
import { BellRing, Clock, Check } from 'lucide-react';
import type { AlarmItem } from '../types/sanctuary';
import { formatTime12h } from '../lib/dateUtils';

interface ActiveAlarmOverlayProps {
  alarm: AlarmItem;
  onDismiss: () => void;
  onSnooze: (minutes: number) => void;
}

export const ActiveAlarmOverlay: React.FC<ActiveAlarmOverlayProps> = ({
  alarm,
  onDismiss,
  onSnooze,
}) => {
  return (
    <div
      className="fixed inset-0 z-50 bg-[#0F1115]/95 backdrop-blur-xl flex items-center justify-center p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Active Alarm"
    >
      <div className="max-w-md w-full bg-[#171A21] border border-white/[0.1] rounded-3xl p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-[#F2B8A2]/15 border border-[#F2B8A2]/30 flex items-center justify-center mx-auto mb-5">
          <BellRing className="w-7 h-7 text-[#F2B8A2]" />
        </div>

        <p className="text-xs text-[#98A2B3] tracking-wide mb-2">
          {alarm.linkedReminderId ? 'Smart Reminder Alarm' : 'Scheduled Alarm'}
        </p>

        <div className="font-mono-tabular text-4xl font-semibold text-[#F1F3F6] tracking-tight mb-3">
          {formatTime12h(alarm.time)}
        </div>

        <h2 className="font-display text-2xl text-[#F1F3F6] font-medium text-balance">
          {alarm.linkedReminderTitle || alarm.label}
        </h2>

        {alarm.soundName && (
          <p className="text-xs text-[#9EC5AB] mt-2">
            Sound · {alarm.soundName}
          </p>
        )}

        {alarm.linkedReminderNotes && (
          <div className="mt-4 p-4 rounded-2xl bg-[#1D212A] border border-white/[0.06] text-left">
            <p className="text-xs text-[#98A2B3] mb-1">Reminder Notes</p>
            <p className="text-sm text-[#F1F3F6] leading-relaxed">{alarm.linkedReminderNotes}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 mt-8">
          <button
            type="button"
            onClick={() => onSnooze(alarm.snoozeMinutes || 5)}
            className="min-h-[48px] px-4 py-3 rounded-2xl bg-[#1D212A] hover:bg-white/[0.08] border border-white/[0.08] text-sm font-medium text-[#F1F3F6] flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
          >
            <Clock className="w-4 h-4 text-[#BEB4DC]" />
            Snooze {alarm.snoozeMinutes || 5}m
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
