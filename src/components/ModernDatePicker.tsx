import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { getTodayStr, getTomorrowStr } from '../lib/dateUtils';
import type { SanctuaryAccent } from './ModernSelect';

interface ModernDatePickerProps {
  value: string; // "YYYY-MM-DD" or ""
  onChange: (nextDate: string) => void;
  minDate?: string; // "YYYY-MM-DD"
  maxDate?: string; // "YYYY-MM-DD"
  enableYearPicker?: boolean;
  placeholder?: string;
  title?: string;
  accent?: SanctuaryAccent;
  triggerClassName?: string;
  ariaLabel?: string;
}

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const ACCENT_STYLES: Record<
  SanctuaryAccent,
  {
    selectedCell: string;
    todayRing: string;
    pillText: string;
  }
> = {
  sage: {
    selectedCell: 'bg-[#9EC5AB] text-[#0F1115] font-semibold shadow-xs',
    todayRing: 'border border-[#9EC5AB] text-[#2E6B48] dark:text-[#9EC5AB]',
    pillText: 'text-[#2E6B48] dark:text-[#9EC5AB]',
  },
  lavender: {
    selectedCell: 'bg-[#BEB4DC] text-[#0F1115] font-semibold shadow-xs',
    todayRing: 'border border-[#BEB4DC] text-[#5B4D8A] dark:text-[#BEB4DC]',
    pillText: 'text-[#5B4D8A] dark:text-[#BEB4DC]',
  },
  peach: {
    selectedCell: 'bg-[#F2B8A2] text-[#0F1115] font-semibold shadow-xs',
    todayRing: 'border border-[#F2B8A2] text-[#A6482D] dark:text-[#F2B8A2]',
    pillText: 'text-[#A6482D] dark:text-[#F2B8A2]',
  },
  sky: {
    selectedCell: 'bg-[#9BC4E2] text-[#0F1115] font-semibold shadow-xs',
    todayRing: 'border border-[#9BC4E2] text-[#255F8A] dark:text-[#9BC4E2]',
    pillText: 'text-[#255F8A] dark:text-[#9BC4E2]',
  },
};

function parseYmd(dateStr: string): Date | null {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatTriggerLabel(dateStr: string, todayStr: string, tomorrowStr: string): string {
  const dt = parseYmd(dateStr);
  if (!dt) return '';
  const formatted = dt.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  if (dateStr === todayStr) return `Today · ${formatted}`;
  if (dateStr === tomorrowStr) return `Tomorrow · ${formatted}`;
  return formatted;
}

export const ModernDatePicker: React.FC<ModernDatePickerProps> = ({
  value,
  onChange,
  minDate,
  maxDate,
  enableYearPicker = false,
  placeholder = 'Choose date',
  title = 'Select Date',
  accent = 'sky',
  triggerClassName = '',
  ariaLabel,
}) => {
  const todayStr = getTodayStr();
  const tomorrowStr = getTomorrowStr();
  const styles = ACCENT_STYLES[accent];

  const [open, setOpen] = useState(false);
  const [pickingYearMonth, setPickingYearMonth] = useState(false);
  const [cursor, setCursor] = useState<Date>(() => {
    const dt = parseYmd(value) || new Date();
    return new Date(dt.getFullYear(), dt.getMonth(), 1);
  });

  useEffect(() => {
    if (!open) return;
    const base = parseYmd(value) || parseYmd(minDate || '') || new Date();
    setCursor(new Date(base.getFullYear(), base.getMonth(), 1));
    setPickingYearMonth(false);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, value, minDate]);

  const viewYear = cursor.getFullYear();
  const viewMonth = cursor.getMonth();

  const daysGrid = useMemo(() => {
    const firstDow = new Date(viewYear, viewMonth, 1).getDay();
    const totalDays = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells: (string | null)[] = [];
    for (let i = 0; i < firstDow; i++) cells.push(null);
    for (let d = 1; d <= totalDays; d++) {
      const mStr = String(viewMonth + 1).padStart(2, '0');
      const dStr = String(d).padStart(2, '0');
      cells.push(`${viewYear}-${mStr}-${dStr}`);
    }
    return cells;
  }, [viewYear, viewMonth]);

  const yearsList = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const startYear = enableYearPicker ? 1925 : Math.max(2020, currentYear - 2);
    const endYear = enableYearPicker ? currentYear : currentYear + 8;
    const list: number[] = [];
    for (let y = endYear; y >= startYear; y--) list.push(y);
    return list;
  }, [enableYearPicker]);

  const isDisabled = (dateStr: string) => {
    if (minDate && dateStr < minDate) return true;
    if (maxDate && dateStr > maxDate) return true;
    return false;
  };

  const handlePickDate = (dateStr: string) => {
    if (isDisabled(dateStr)) return;
    onChange(dateStr);
    setOpen(false);
  };

  const displayLabel = value ? formatTriggerLabel(value, todayStr, tomorrowStr) : '';

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={ariaLabel || title}
        className={`w-full min-h-[44px] px-3.5 rounded-2xl bg-[#ECEFF3] dark:bg-[#1D212A] border border-slate-900/[0.10] dark:border-white/[0.08] hover:border-slate-900/[0.20] dark:hover:border-white/[0.16] flex items-center gap-2.5 text-left transition-all ${triggerClassName}`}
      >
        <Calendar className="w-4 h-4 text-[#5B6472] dark:text-[#98A2B3] shrink-0" />
        <span
          className={`text-sm truncate ${
            displayLabel
              ? 'text-[#111827] dark:text-[#F1F3F6] font-medium'
              : 'text-[#5B6472] dark:text-[#98A2B3]'
          }`}
        >
          {displayLabel || placeholder}
        </span>
      </button>

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
              className="w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl bg-white dark:bg-[#181C26] border border-slate-900/[0.10] dark:border-white/[0.10] shadow-2xl overflow-hidden pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-0 animate-sheet-up"
            >
              <div className="pt-2.5 flex justify-center sm:hidden">
                <span className="w-10 h-1.5 rounded-full bg-slate-900/15 dark:bg-white/20" />
              </div>

              {/* Header */}
              <div className="px-5 py-3.5 flex items-center justify-between border-b border-slate-900/[0.07] dark:border-white/[0.07]">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#5B6472] dark:text-[#98A2B3]" />
                  <h3 className="text-sm font-semibold text-[#111827] dark:text-[#F1F3F6]">
                    {title}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close calendar"
                  className="min-w-[36px] min-h-[36px] rounded-xl bg-slate-900/[0.05] dark:bg-white/[0.06] text-[#5B6472] dark:text-[#98A2B3] flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 sm:p-5 space-y-4">
                {/* Month & Year Navigation */}
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setCursor(new Date(viewYear, viewMonth - 1, 1))}
                    aria-label="Previous month"
                    className="min-w-[40px] min-h-[40px] rounded-xl bg-[#ECEFF3] dark:bg-[#1D212A] hover:bg-slate-900/[0.08] dark:hover:bg-white/[0.08] text-[#111827] dark:text-[#F1F3F6] flex items-center justify-center"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setPickingYearMonth((v) => !v)}
                    className="min-h-[40px] px-3.5 rounded-xl bg-[#ECEFF3] dark:bg-[#1D212A] hover:bg-slate-900/[0.08] dark:hover:bg-white/[0.08] text-sm font-semibold text-[#111827] dark:text-[#F1F3F6] transition-colors"
                  >
                    {cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </button>

                  <button
                    type="button"
                    onClick={() => setCursor(new Date(viewYear, viewMonth + 1, 1))}
                    aria-label="Next month"
                    className="min-w-[40px] min-h-[40px] rounded-xl bg-[#ECEFF3] dark:bg-[#1D212A] hover:bg-slate-900/[0.08] dark:hover:bg-white/[0.08] text-[#111827] dark:text-[#F1F3F6] flex items-center justify-center"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                {pickingYearMonth ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-4 gap-1.5">
                      {MONTHS_SHORT.map((mLabel, mIdx) => (
                        <button
                          key={mLabel}
                          type="button"
                          onClick={() => {
                            setCursor(new Date(viewYear, mIdx, 1));
                            setPickingYearMonth(false);
                          }}
                          className={`min-h-[38px] rounded-xl text-xs font-medium transition-colors ${
                            viewMonth === mIdx
                              ? styles.selectedCell
                              : 'bg-[#ECEFF3] dark:bg-[#1D212A] text-[#334155] dark:text-[#D0D5DD]'
                          }`}
                        >
                          {mLabel}
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-4 gap-1.5 max-h-44 overflow-y-auto pt-1 border-t border-slate-900/[0.07] dark:border-white/[0.07]">
                      {yearsList.map((yr) => (
                        <button
                          key={yr}
                          type="button"
                          onClick={() => {
                            setCursor(new Date(yr, viewMonth, 1));
                            setPickingYearMonth(false);
                          }}
                          className={`min-h-[38px] rounded-xl text-xs font-mono-tabular font-medium transition-colors ${
                            viewYear === yr
                              ? styles.selectedCell
                              : 'bg-[#ECEFF3] dark:bg-[#1D212A] text-[#334155] dark:text-[#D0D5DD]'
                          }`}
                        >
                          {yr}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-7 gap-1 text-center">
                      {WEEKDAYS.map((wd) => (
                        <div
                          key={wd}
                          className="text-[11px] font-medium text-[#5B6472] dark:text-[#98A2B3] py-1"
                        >
                          {wd}
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-7 gap-1">
                      {daysGrid.map((dateStr, idx) => {
                        if (!dateStr) return <div key={`empty-${idx}`} className="h-10" />;
                        const dayNum = Number(dateStr.slice(8));
                        const selected = value === dateStr;
                        const isToday = dateStr === todayStr;
                        const disabled = isDisabled(dateStr);

                        return (
                          <button
                            key={dateStr}
                            type="button"
                            disabled={disabled}
                            onClick={() => handlePickDate(dateStr)}
                            className={`h-10 rounded-xl text-xs font-mono-tabular transition-all flex items-center justify-center ${
                              disabled
                                ? 'text-[#5B6472]/35 dark:text-[#98A2B3]/30 cursor-not-allowed'
                                : selected
                                  ? styles.selectedCell
                                  : isToday
                                    ? styles.todayRing
                                    : 'text-[#111827] dark:text-[#F1F3F6] hover:bg-[#ECEFF3] dark:hover:bg-[#1D212A]'
                            }`}
                          >
                            {dayNum}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              {/* Quick Footer */}
              <div className="px-5 py-3 border-t border-slate-900/[0.07] dark:border-white/[0.07] flex items-center justify-between gap-2 bg-[#FAFBFD] dark:bg-[#151923]">
                <div className="flex items-center gap-2">
                  {!isDisabled(todayStr) && (
                    <button
                      type="button"
                      onClick={() => handlePickDate(todayStr)}
                      className={`min-h-[36px] px-3 rounded-xl bg-slate-900/[0.05] dark:bg-white/[0.06] text-xs font-semibold ${styles.pillText}`}
                    >
                      Today
                    </button>
                  )}
                  {!isDisabled(tomorrowStr) && !enableYearPicker && (
                    <button
                      type="button"
                      onClick={() => handlePickDate(tomorrowStr)}
                      className="min-h-[36px] px-3 rounded-xl bg-slate-900/[0.05] dark:bg-white/[0.06] text-xs font-medium text-[#334155] dark:text-[#D0D5DD]"
                    >
                      Tomorrow
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="min-h-[36px] px-3.5 rounded-xl bg-slate-900/[0.05] dark:bg-white/[0.06] text-xs font-medium text-[#334155] dark:text-[#D0D5DD]"
                >
                  Close
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};
