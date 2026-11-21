import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Clock, Minus, Plus, X } from 'lucide-react';
import { formatTime12h } from '../lib/dateUtils';
import type { SanctuaryAccent } from './ModernSelect';

interface ModernTimePickerProps {
  value: string; // "HH:mm" or ""
  onChange: (nextTime24: string) => void;
  placeholder?: string;
  title?: string;
  accent?: SanctuaryAccent;
  allowClear?: boolean;
  triggerClassName?: string;
  ariaLabel?: string;
}

const HOURS_12 = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const FIVE_MIN_STEPS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

const ACCENT_STYLES: Record<
  SanctuaryAccent,
  {
    pillBg: string;
    pillText: string;
    primaryBtn: string;
    subtleTint: string;
  }
> = {
  sage: {
    pillBg: 'bg-[#9EC5AB]',
    pillText: 'text-[#0F1115]',
    primaryBtn: 'bg-[#9EC5AB] hover:bg-[#8EB89D] text-[#0F1115]',
    subtleTint: 'bg-[#9EC5AB]/16 text-[#1F5636] dark:text-[#A9DFBE] border-[#9EC5AB]/45',
  },
  lavender: {
    pillBg: 'bg-[#BEB4DC]',
    pillText: 'text-[#0F1115]',
    primaryBtn: 'bg-[#BEB4DC] hover:bg-[#AEA2D2] text-[#0F1115]',
    subtleTint: 'bg-[#BEB4DC]/18 text-[#4B3D78] dark:text-[#D5CCF2] border-[#BEB4DC]/45',
  },
  peach: {
    pillBg: 'bg-[#F2B8A2]',
    pillText: 'text-[#0F1115]',
    primaryBtn: 'bg-[#F2B8A2] hover:bg-[#E7A890] text-[#0F1115]',
    subtleTint: 'bg-[#F2B8A2]/18 text-[#9A3E24] dark:text-[#F5C1AD] border-[#F2B8A2]/45',
  },
  sky: {
    pillBg: 'bg-[#9BC4E2]',
    pillText: 'text-[#0F1115]',
    primaryBtn: 'bg-[#9BC4E2] hover:bg-[#8AB6D6] text-[#0F1115]',
    subtleTint: 'bg-[#9BC4E2]/18 text-[#1E567F] dark:text-[#B4D6F0] border-[#9BC4E2]/45',
  },
};

function parseTime24(time24: string): { hour12: number; minute: number; period: 'AM' | 'PM' } {
  if (time24 && /^\d{2}:\d{2}$/.test(time24)) {
    const [h, m] = time24.split(':').map(Number);
    const period: 'AM' | 'PM' = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    return { hour12, minute: Math.min(59, Math.max(0, m)), period };
  }
  const now = new Date();
  now.setMinutes(Math.ceil((now.getMinutes() + 1) / 5) * 5);
  const h = now.getHours();
  return {
    hour12: h % 12 || 12,
    minute: now.getMinutes() % 60,
    period: h >= 12 ? 'PM' : 'AM',
  };
}

function toTime24(hour12: number, minute: number, period: 'AM' | 'PM'): string {
  let h24 = hour12 % 12;
  if (period === 'PM') h24 += 12;
  return `${String(h24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export const ModernTimePicker: React.FC<ModernTimePickerProps> = ({
  value,
  onChange,
  placeholder = 'Select time',
  title = 'Choose Time',
  accent = 'sky',
  allowClear = false,
  triggerClassName = '',
  ariaLabel,
}) => {
  const [open, setOpen] = useState(false);
  const initial = parseTime24(value);
  const [hour12, setHour12] = useState(initial.hour12);
  const [minute, setMinute] = useState(initial.minute);
  const [period, setPeriod] = useState<'AM' | 'PM'>(initial.period);
  const [showAllMinutes, setShowAllMinutes] = useState(false);

  const styles = ACCENT_STYLES[accent];

  useEffect(() => {
    if (!open) return;
    const parsed = parseTime24(value);
    setHour12(parsed.hour12);
    setMinute(parsed.minute);
    setPeriod(parsed.period);
    setShowAllMinutes(parsed.minute % 5 !== 0);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, value]);

  const draft24 = toTime24(hour12, minute, period);
  const formattedDisplay = value ? formatTime12h(value) : '';

  const applyQuickOffset = (minutesAhead: number) => {
    const dt = new Date();
    dt.setMinutes(dt.getMinutes() + minutesAhead);
    const h = dt.getHours();
    setHour12(h % 12 || 12);
    setMinute(dt.getMinutes());
    setPeriod(h >= 12 ? 'PM' : 'AM');
  };

  const applyFixedPreset = (h24: number, m: number) => {
    setHour12(h24 % 12 || 12);
    setMinute(m);
    setPeriod(h24 >= 12 ? 'PM' : 'AM');
  };

  const adjustMinute = (delta: number) => {
    setMinute((prev) => (prev + delta + 60) % 60);
  };

  const handleConfirm = () => {
    onChange(draft24);
    setOpen(false);
  };

  return (
    <>
      <div className="relative flex items-center">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={ariaLabel || title}
          className={`w-full min-h-[44px] px-3.5 ${
            allowClear && value ? 'pr-9' : ''
          } rounded-2xl bg-[#ECEFF3] dark:bg-[#1D212A] border border-slate-900/[0.10] dark:border-white/[0.08] hover:border-slate-900/[0.20] dark:hover:border-white/[0.16] flex items-center gap-2.5 text-left transition-all ${triggerClassName}`}
        >
          <Clock className="w-4 h-4 text-[#5B6472] dark:text-[#98A2B3] shrink-0" />
          <span
            className={`text-sm font-mono-tabular truncate ${
              formattedDisplay
                ? 'text-[#111827] dark:text-[#F1F3F6] font-medium'
                : 'text-[#5B6472] dark:text-[#98A2B3] font-sans'
            }`}
          >
            {formattedDisplay || placeholder}
          </span>
        </button>

        {allowClear && value && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange('');
            }}
            aria-label={`Clear ${title}`}
            className="absolute right-1.5 min-w-[32px] min-h-[32px] rounded-xl hover:bg-slate-900/[0.08] dark:hover:bg-white/[0.08] text-[#5B6472] dark:text-[#98A2B3] flex items-center justify-center"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center sm:p-4 bg-black/50 dark:bg-black/70 backdrop-blur-sm animate-backdrop-in"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl bg-white dark:bg-[#181C26] border border-slate-900/[0.10] dark:border-white/[0.10] shadow-2xl overflow-hidden pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-0 animate-sheet-up"
            >
              <div className="pt-2.5 flex justify-center sm:hidden">
                <span className="w-10 h-1.5 rounded-full bg-slate-900/15 dark:bg-white/20" />
              </div>

              {/* Header */}
              <div className="px-5 py-3.5 flex items-center justify-between border-b border-slate-900/[0.07] dark:border-white/[0.07]">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#5B6472] dark:text-[#98A2B3]" />
                  <h3 className="text-sm font-semibold text-[#111827] dark:text-[#F1F3F6]">
                    {title}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close time picker"
                  className="min-w-[36px] min-h-[36px] rounded-xl bg-slate-900/[0.05] dark:bg-white/[0.06] text-[#5B6472] dark:text-[#98A2B3] flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-5 max-h-[75dvh] overflow-y-auto">
                {/* Live Time Hero Readout + AM/PM Switch */}
                <div className="rounded-2xl bg-[#F4F6F9] dark:bg-[#12161F] border border-slate-900/[0.07] dark:border-white/[0.07] p-4 flex items-center justify-between gap-3">
                  <div className="flex items-baseline gap-1 font-mono-tabular">
                    <span className="text-3xl sm:text-4xl font-semibold text-[#111827] dark:text-[#F1F3F6]">
                      {String(hour12).padStart(2, '0')}
                    </span>
                    <span className="text-2xl text-[#5B6472] dark:text-[#98A2B3]">:</span>
                    <span className="text-3xl sm:text-4xl font-semibold text-[#111827] dark:text-[#F1F3F6]">
                      {String(minute).padStart(2, '0')}
                    </span>
                    <span className="text-sm font-medium text-[#5B6472] dark:text-[#98A2B3] ml-1.5">
                      {period}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 p-1 rounded-xl bg-white dark:bg-[#1D212A] border border-slate-900/[0.08] dark:border-white/[0.08] gap-1 shrink-0">
                    {(['AM', 'PM'] as const).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPeriod(p)}
                        className={`min-w-[44px] min-h-[38px] px-3 rounded-lg text-xs font-semibold transition-colors ${
                          period === p
                            ? `${styles.pillBg} ${styles.pillText} shadow-xs`
                            : 'text-[#5B6472] dark:text-[#98A2B3] hover:text-[#111827] dark:hover:text-[#F1F3F6]'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Quick Time Presets */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                  {[
                    { label: '+5m', onTap: () => applyQuickOffset(5) },
                    { label: '+15m', onTap: () => applyQuickOffset(15) },
                    { label: '+1h', onTap: () => applyQuickOffset(60) },
                    { label: '7:00 AM', onTap: () => applyFixedPreset(7, 0) },
                    { label: '9:00 AM', onTap: () => applyFixedPreset(9, 0) },
                    { label: '6:00 PM', onTap: () => applyFixedPreset(18, 0) },
                    { label: '9:30 PM', onTap: () => applyFixedPreset(21, 30) },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={preset.onTap}
                      className="min-h-[34px] px-3 rounded-xl bg-[#ECEFF3] dark:bg-[#1D212A] hover:bg-slate-900/[0.08] dark:hover:bg-white/[0.10] text-xs font-medium text-[#334155] dark:text-[#D0D5DD] whitespace-nowrap shrink-0 transition-colors"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                {/* Hour Grid (12-11) */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-[#5B6472] dark:text-[#98A2B3]">Hour</p>
                  <div className="grid grid-cols-6 gap-1.5">
                    {HOURS_12.map((h) => {
                      const active = hour12 === h;
                      return (
                        <button
                          key={h}
                          type="button"
                          onClick={() => setHour12(h)}
                          className={`min-h-[42px] rounded-xl text-sm font-mono-tabular font-medium transition-all ${
                            active
                              ? `${styles.pillBg} ${styles.pillText} font-semibold shadow-xs`
                              : 'bg-[#ECEFF3] dark:bg-[#1D212A] text-[#334155] dark:text-[#D0D5DD] hover:bg-slate-900/[0.08] dark:hover:bg-white/[0.08]'
                          }`}
                        >
                          {h}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Minute Grid + Fine -1/+1 Stepper */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-[#5B6472] dark:text-[#98A2B3]">
                      Minute
                    </p>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => adjustMinute(-1)}
                        aria-label="Subtract 1 minute"
                        className="min-w-[34px] min-h-[34px] rounded-lg bg-[#ECEFF3] dark:bg-[#1D212A] hover:bg-slate-900/[0.08] dark:hover:bg-white/[0.08] text-[#111827] dark:text-[#F1F3F6] flex items-center justify-center"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => adjustMinute(1)}
                        aria-label="Add 1 minute"
                        className="min-w-[34px] min-h-[34px] rounded-lg bg-[#ECEFF3] dark:bg-[#1D212A] hover:bg-slate-900/[0.08] dark:hover:bg-white/[0.08] text-[#111827] dark:text-[#F1F3F6] flex items-center justify-center"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowAllMinutes((v) => !v)}
                        className={`min-h-[34px] px-2.5 rounded-lg text-[11px] font-medium border transition-colors ${
                          showAllMinutes
                            ? styles.subtleTint
                            : 'bg-[#ECEFF3] dark:bg-[#1D212A] border-transparent text-[#5B6472] dark:text-[#98A2B3]'
                        }`}
                      >
                        {showAllMinutes ? '5m Steps' : 'All 00–59'}
                      </button>
                    </div>
                  </div>

                  {!showAllMinutes ? (
                    <div className="grid grid-cols-6 gap-1.5">
                      {FIVE_MIN_STEPS.map((m) => {
                        const active = minute === m;
                        return (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setMinute(m)}
                            className={`min-h-[42px] rounded-xl text-sm font-mono-tabular font-medium transition-all ${
                              active
                                ? `${styles.pillBg} ${styles.pillText} font-semibold shadow-xs`
                                : 'bg-[#ECEFF3] dark:bg-[#1D212A] text-[#334155] dark:text-[#D0D5DD] hover:bg-slate-900/[0.08] dark:hover:bg-white/[0.08]'
                            }`}
                          >
                            {String(m).padStart(2, '0')}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="grid grid-cols-6 gap-1 max-h-44 overflow-y-auto pr-1">
                      {Array.from({ length: 60 }, (_, idx) => idx).map((m) => {
                        const active = minute === m;
                        return (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setMinute(m)}
                            className={`min-h-[36px] rounded-xl text-xs font-mono-tabular font-medium transition-all ${
                              active
                                ? `${styles.pillBg} ${styles.pillText} font-semibold shadow-xs`
                                : 'bg-[#ECEFF3] dark:bg-[#1D212A] text-[#334155] dark:text-[#D0D5DD] hover:bg-slate-900/[0.08] dark:hover:bg-white/[0.08]'
                            }`}
                          >
                            {String(m).padStart(2, '0')}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="px-5 py-3.5 border-t border-slate-900/[0.07] dark:border-white/[0.07] flex items-center justify-between gap-2.5 bg-[#FAFBFD] dark:bg-[#151923]">
                {allowClear && value ? (
                  <button
                    type="button"
                    onClick={() => {
                      onChange('');
                      setOpen(false);
                    }}
                    className="min-h-[42px] px-3.5 rounded-xl bg-slate-900/[0.05] dark:bg-white/[0.06] text-xs font-medium text-[#A6482D] dark:text-[#F2B8A2]"
                  >
                    Clear Time
                  </button>
                ) : (
                  <span />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="min-h-[42px] px-4 rounded-xl bg-slate-900/[0.05] dark:bg-white/[0.06] text-xs font-medium text-[#334155] dark:text-[#D0D5DD]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirm}
                    className={`min-h-[42px] px-4 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 ${styles.primaryBtn}`}
                  >
                    <Check className="w-3.5 h-3.5" />
                    Set {formatTime12h(draft24)}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};
