export function getTodayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getTomorrowStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getNowTimeStr(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function validateFutureDateTime(params: {
  date: string;
  time?: string;
  requireTime?: boolean;
  dateLabel?: string;
  timeLabel?: string;
}): string | null {
  const { date, time, requireTime, dateLabel = 'Date', timeLabel = 'Time' } = params;
  if (!date) {
    return `${dateLabel} is required.`;
  }
  const today = getTodayStr();
  if (date < today) {
    return `${dateLabel} cannot be in the past. Please choose today or a future date.`;
  }
  if (requireTime && !time) {
    return `${timeLabel} is required.`;
  }
  if (date === today && time) {
    const nowTime = getNowTimeStr();
    if (time < nowTime) {
      return `${timeLabel} cannot be in the past for today. Please choose an upcoming time or a future date.`;
    }
  }
  return null;
}

export function getGreetingByHour(hour = new Date().getHours()): {
  greeting: string;
  subMessage: string;
} {
  if (hour >= 5 && hour < 12) {
    return {
      greeting: 'Good Morning',
      subMessage: 'Have a calm, unhurried morning. Take today one gentle step at a time.',
    };
  }
  if (hour >= 12 && hour < 17) {
    return {
      greeting: 'Good Afternoon',
      subMessage: 'Have a good day. Pause for a breath whenever the pace feels loud.',
    };
  }
  return {
    greeting: 'Good Evening',
    subMessage: 'Have a peaceful evening. Let today settle softly behind you.',
  };
}

export function formatFullDate(date = new Date()): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatShortDate(dateStr: string): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return dateStr;
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatTime12h(time24: string): string {
  if (!time24 || !time24.includes(':')) return '';
  const [hStr, mStr] = time24.split(':');
  let h = parseInt(hStr, 10);
  const suffix = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${mStr} ${suffix}`;
}

export function getDaysUntilBirthday(birthDateStr: string): {
  daysUntil: number;
  label: string;
  nextOccurrenceDate: string;
  turningAge: number | null;
} {
  const parts = birthDateStr.split('-').map(Number);
  if (parts.length !== 3) {
    return { daysUntil: 999, label: 'Unknown', nextOccurrenceDate: '', turningAge: null };
  }
  const [birthYear, birthMonth, birthDay] = parts;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  let next = new Date(today.getFullYear(), birthMonth - 1, birthDay);
  if (next < today) {
    next = new Date(today.getFullYear() + 1, birthMonth - 1, birthDay);
  }

  const diffMs = next.getTime() - today.getTime();
  const daysUntil = Math.round(diffMs / (1000 * 60 * 60 * 24));
  const nextOccurrenceDate = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(
    2,
    '0'
  )}-${String(next.getDate()).padStart(2, '0')}`;
  const turningAge = birthYear > 1900 ? next.getFullYear() - birthYear : null;

  let label = `In ${daysUntil} days`;
  if (daysUntil === 0) label = 'Today!';
  else if (daysUntil === 1) label = 'Tomorrow';

  return { daysUntil, label, nextOccurrenceDate, turningAge };
}

export function buildGoogleMapsDirectionsUrl(venue: string): string {
  const trimmed = venue.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(trimmed)}`;
}

export function buildGoogleCalendarUrl(event: {
  title: string;
  date: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  notes?: string;
}): string {
  const compactDate = event.date.replace(/-/g, '');
  const start = event.startTime
    ? `${compactDate}T${event.startTime.replace(':', '')}00`
    : compactDate;
  const end = event.endTime
    ? `${compactDate}T${event.endTime.replace(':', '')}00`
    : event.startTime
      ? `${compactDate}T${event.startTime.replace(':', '')}00`
      : compactDate;

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${start}/${end}`,
    details: event.notes || 'Created in My World Sanctuary',
    location: event.location || '',
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function downloadIcsFile(event: {
  id: string;
  title: string;
  date: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  notes?: string;
}) {
  const compactDate = event.date.replace(/-/g, '');
  const dtStart = event.startTime
    ? `${compactDate}T${event.startTime.replace(':', '')}00`
    : compactDate;
  const dtEnd = event.endTime
    ? `${compactDate}T${event.endTime.replace(':', '')}00`
    : dtStart;

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//My World Sanctuary//Local Calendar//EN',
    'BEGIN:VEVENT',
    `UID:${event.id}@myworld.local`,
    `DTSTAMP:${compactDate}T000000Z`,
    event.startTime ? `DTSTART:${dtStart}` : `DTSTART;VALUE=DATE:${compactDate}`,
    event.startTime ? `DTEND:${dtEnd}` : `DTEND;VALUE=DATE:${compactDate}`,
    `SUMMARY:${event.title.replace(/\n/g, ' ')}`,
    event.location ? `LOCATION:${event.location.replace(/\n/g, ' ')}` : '',
    event.notes ? `DESCRIPTION:${event.notes.replace(/\n/g, '\\n')}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .join('\r\n');

  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${event.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'event'}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
