import type { RecurrencePattern, TaskReminderItem } from '../types/sanctuary';
import { getTodayStr } from './dateUtils';

export const SHORT_WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'] as const;
const MEDIUM_WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export function formatOrdinalDay(day: number): string {
  const mod100 = day % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${day}th`;
  switch (day % 10) {
    case 1:
      return `${day}st`;
    case 2:
      return `${day}nd`;
    case 3:
      return `${day}rd`;
    default:
      return `${day}th`;
  }
}

export function parseLocalDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
  const [y, m, d] = parts;
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

export function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatCustomRecurrenceSummary(params: {
  unit?: 'weekly' | 'monthly';
  days?: number[];
  monthDays?: number[];
  fallbackNote?: string;
}): string {
  const { unit, days, monthDays, fallbackNote } = params;
  if (unit === 'monthly' && monthDays && monthDays.length > 0) {
    const sorted = [...monthDays].sort((a, b) => a - b);
    if (sorted.length <= 4) {
      return `Monthly on ${sorted.map(formatOrdinalDay).join(', ')}`;
    }
    return `Monthly on ${sorted.slice(0, 3).map(formatOrdinalDay).join(', ')} +${sorted.length - 3}`;
  }
  if (days && days.length > 0) {
    const sorted = [...days].sort((a, b) => a - b);
    if (sorted.length === 7) return 'Every day';
    return `Every ${sorted.map((d) => MEDIUM_WEEKDAYS[d] ?? '').filter(Boolean).join(', ')}`;
  }
  return fallbackNote?.trim() || 'Custom';
}

export function formatTaskRecurrenceLabel(task: TaskReminderItem): string {
  if (task.recurrence === 'Once') return '';
  if (task.recurrence !== 'Custom') return task.recurrence;
  return formatCustomRecurrenceSummary({
    unit: task.customRecurrenceUnit,
    days: task.customRecurrenceDays,
    monthDays: task.customRecurrenceMonthDays,
    fallbackNote: task.customRecurrenceNote,
  });
}

export function doesTaskMatchDate(task: TaskReminderItem, targetDateStr: string): boolean {
  if (!targetDateStr) return false;
  if (task.dueDate && targetDateStr < task.dueDate) return false;

  if (task.recurrence === 'Once') {
    return task.dueDate === targetDateStr;
  }

  const target = parseLocalDate(targetDateStr);
  const start = parseLocalDate(task.dueDate || targetDateStr);
  if (!target || !start) return task.dueDate === targetDateStr;

  if (task.recurrence === 'Daily') {
    return true;
  }

  if (task.recurrence === 'Weekly') {
    return target.getDay() === start.getDay();
  }

  if (task.recurrence === 'Monthly') {
    return target.getDate() === start.getDate();
  }

  // Custom
  if (
    task.customRecurrenceUnit === 'monthly' &&
    task.customRecurrenceMonthDays &&
    task.customRecurrenceMonthDays.length > 0
  ) {
    return task.customRecurrenceMonthDays.includes(target.getDate());
  }

  if (task.customRecurrenceDays && task.customRecurrenceDays.length > 0) {
    return task.customRecurrenceDays.includes(target.getDay());
  }

  return task.dueDate === targetDateStr;
}

export function deriveAlarmScheduleFromTask(params: {
  recurrence: RecurrencePattern;
  dueDate: string;
  customRecurrenceUnit?: 'weekly' | 'monthly';
  customRecurrenceDays?: number[];
  customRecurrenceMonthDays?: number[];
}): { repeatDays: number[]; date?: string } {
  const {
    recurrence,
    dueDate,
    customRecurrenceUnit,
    customRecurrenceDays,
    customRecurrenceMonthDays,
  } = params;

  if (recurrence === 'Daily') {
    return { repeatDays: [0, 1, 2, 3, 4, 5, 6], date: undefined };
  }

  if (recurrence === 'Weekly' && dueDate) {
    const parsed = parseLocalDate(dueDate);
    const day = parsed ? parsed.getDay() : new Date().getDay();
    return { repeatDays: [day], date: undefined };
  }

  if (recurrence === 'Custom') {
    if (customRecurrenceUnit !== 'monthly' && customRecurrenceDays && customRecurrenceDays.length > 0) {
      return { repeatDays: [...customRecurrenceDays].sort((a, b) => a - b), date: undefined };
    }
    if (customRecurrenceUnit === 'monthly' && customRecurrenceMonthDays?.length) {
      const nextDate = getNextMatchingDateFromToday({
        startDate: dueDate || getTodayStr(),
        recurrence: 'Custom',
        customRecurrenceUnit: 'monthly',
        customRecurrenceMonthDays,
      });
      return { repeatDays: [], date: nextDate || dueDate || getTodayStr() };
    }
  }

  if (recurrence === 'Monthly') {
    const nextDate = getNextMatchingDateFromToday({
      startDate: dueDate || getTodayStr(),
      recurrence: 'Monthly',
    });
    return { repeatDays: [], date: nextDate || dueDate || getTodayStr() };
  }

  return { repeatDays: [], date: dueDate || getTodayStr() };
}

export function getNextMatchingDateFromToday(params: {
  startDate: string;
  recurrence: RecurrencePattern;
  customRecurrenceUnit?: 'weekly' | 'monthly';
  customRecurrenceDays?: number[];
  customRecurrenceMonthDays?: number[];
  afterDateStr?: string;
}): string | null {
  const {
    startDate,
    recurrence,
    customRecurrenceUnit,
    customRecurrenceDays,
    customRecurrenceMonthDays,
    afterDateStr,
  } = params;

  const baseToday = getTodayStr();
  const minStr = afterDateStr && afterDateStr > baseToday ? afterDateStr : baseToday;
  const cursor = parseLocalDate(minStr);
  const start = parseLocalDate(startDate || minStr);
  if (!cursor || !start) return startDate || null;

  if (afterDateStr && minStr === afterDateStr) {
    cursor.setDate(cursor.getDate() + 1);
  }

  const pseudoTask: TaskReminderItem = {
    id: 'lookup',
    title: '',
    notes: '',
    priority: 'Medium',
    category: 'Personal',
    dueDate: startDate || minStr,
    dueTime: '09:00',
    recurrence,
    customRecurrenceUnit,
    customRecurrenceDays,
    customRecurrenceMonthDays,
    completed: false,
    createdAt: '',
  };

  for (let i = 0; i < 400; i++) {
    const candidateStr = toDateStr(cursor);
    if (doesTaskMatchDate(pseudoTask, candidateStr)) {
      return candidateStr;
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return null;
}

export function getNextTaskOccurrenceDateTime(
  task: TaskReminderItem,
  minLeadMs = 2000
): Date | null {
  if (!task.dueTime) return null;
  const [hh, mm] = task.dueTime.split(':').map(Number);
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null;

  const now = new Date();
  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0);

  for (let i = 0; i < 400; i++) {
    const candidateStr = toDateStr(cursor);
    if (doesTaskMatchDate(task, candidateStr)) {
      const candidateDt = new Date(
        cursor.getFullYear(),
        cursor.getMonth(),
        cursor.getDate(),
        hh,
        mm,
        0,
        0
      );
      if (candidateDt.getTime() > Date.now() + minLeadMs) {
        return candidateDt;
      }
      if (task.recurrence === 'Once') {
        return null;
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return null;
}
