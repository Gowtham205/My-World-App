import { Capacitor } from '@capacitor/core';
import { LocalNotifications, type Channel } from '@capacitor/local-notifications';
import type {
  AlarmItem,
  AppNotificationItem,
  AppNotificationKind,
  AppRoute,
  BirthdayEntry,
  CustomAudioTone,
  EventCalmSession,
  TaskReminderItem,
} from '../types/sanctuary';
import { createId, getDismissedNotificationKeys } from './storage';
import { getDaysUntilBirthday } from './dateUtils';
import { getNextTaskOccurrenceDateTime } from './taskRecurrence';
import {
  stopNativeRingtone,
  syncAllCustomTonesToNative,
  syncNativeSchedules,
  type NativeScheduleItem,
} from './nativeAudio';

const ALARM_CHANNEL_ID = 'my-world-alarms';
const REMINDER_CHANNEL_ID = 'my-world-reminders';
const CALM_CHANNEL_ID = 'my-world-calm';

export const ALARM_ACTION_TYPE_ID = 'MY_WORLD_ALARM_ACTIONS';
export const REMINDER_ACTION_TYPE_ID = 'MY_WORLD_REMINDER_ACTIONS';

// Deterministic positive 32-bit int >= 10000 for scheduled OS notifications
export function hashToNotificationId(seed: string, min = 10000): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return min + (Math.abs(hash) % 2000000000);
}

let initialized = false;
let lastScheduleFingerprint = '';
let syncChain: Promise<void> = Promise.resolve();

// Occurrence-level deduplication so a single minute/event never posts two cards in Android's drawer
const DISPATCHED_KEYS_STORAGE = 'my_world_dispatched_drawer_keys_v1';
const dispatchedOccurrences = new Map<string, number>();

function loadDispatchedFromSession(): void {
  if (typeof window === 'undefined' || dispatchedOccurrences.size > 0) return;
  try {
    const raw = sessionStorage.getItem(DISPATCHED_KEYS_STORAGE);
    if (!raw) return;
    const entries = JSON.parse(raw) as [string, number][];
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    for (const [k, ts] of entries) {
      if (typeof k === 'string' && typeof ts === 'number' && ts > cutoff) {
        dispatchedOccurrences.set(k, ts);
      }
    }
  } catch {
    // ignore storage limits
  }
}

function persistDispatchedToSession(): void {
  if (typeof window === 'undefined') return;
  try {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const pruned = Array.from(dispatchedOccurrences.entries())
      .filter(([, ts]) => ts > cutoff)
      .slice(-120);
    sessionStorage.setItem(DISPATCHED_KEYS_STORAGE, JSON.stringify(pruned));
  } catch {
    // ignore storage limits
  }
}

export function markOccurrenceDispatched(dedupeKey: string): void {
  loadDispatchedFromSession();
  dispatchedOccurrences.set(dedupeKey, Date.now());
  persistDispatchedToSession();
}

export function wasOccurrenceDispatched(dedupeKey: string): boolean {
  loadDispatchedFromSession();
  return dispatchedOccurrences.has(dedupeKey);
}

const BDAY_OS_SENT_STORAGE = 'my_world_bday_os_sent_v1';

export function hasBirthdayDrawerSent(key: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = localStorage.getItem(BDAY_OS_SENT_STORAGE);
    if (!raw) return false;
    const map = JSON.parse(raw) as Record<string, number>;
    return Boolean(map && map[key]);
  } catch {
    return false;
  }
}

export function markBirthdayDrawerSent(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(BDAY_OS_SENT_STORAGE);
    const parsed = raw ? (JSON.parse(raw) as Record<string, number>) : {};
    const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
    const pruned: Record<string, number> = {};
    for (const [k, ts] of Object.entries(parsed)) {
      if (typeof ts === 'number' && ts > cutoff) {
        pruned[k] = ts;
      }
    }
    pruned[key] = Date.now();
    localStorage.setItem(BDAY_OS_SENT_STORAGE, JSON.stringify(pruned));
  } catch {
    // ignore storage errors
  }
}

function getCurrentMinuteKey(d = new Date()): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${mo}-${da}T${hh}:${mm}`;
}

export function formatEventCalmPrompts(session: EventCalmSession): string {
  const allPrompts = [...session.selectedPrompts, ...session.customPrompts]
    .map((p) => p.trim())
    .filter(Boolean);

  if (allPrompts.length === 0) {
    return "It's okay. Take 3 slow breaths and return to the present moment.";
  }
  if (allPrompts.length === 1) {
    return allPrompts[0];
  }
  return allPrompts.map((p, idx) => `${idx + 1}. ${p}`).join('\n');
}

export function getEventCalmCheckInTimes(session: EventCalmSession): Date[] {
  const [y, m, d] = session.date.split('-').map(Number);
  const [sh, sm] = session.startTime.split(':').map(Number);
  const [eh, em] = session.endTime.split(':').map(Number);
  if ([y, m, d, sh, sm, eh, em].some((n) => Number.isNaN(n))) return [];

  const startDt = new Date(y, m - 1, d, sh, sm, 0, 0);
  const endDt = new Date(y, m - 1, d, eh, em, 0, 0);
  if (endDt.getTime() < startDt.getTime()) {
    endDt.setDate(endDt.getDate() + 1);
  }

  if (session.isMidpointOnly) {
    return [new Date((startDt.getTime() + endDt.getTime()) / 2)];
  }

  if (session.intervalMinutes <= 0) return [];

  const stepMs = session.intervalMinutes * 60 * 1000;
  const checkTimes: Date[] = [];
  for (
    let t = startDt.getTime();
    t <= endDt.getTime() && checkTimes.length < 48;
    t += stepMs
  ) {
    checkTimes.push(new Date(t));
  }
  return checkTimes;
}

export async function ensureNotificationSetup(): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  if (Capacitor.isNativePlatform()) {
    try {
      let perm = await LocalNotifications.checkPermissions();
      if (perm.display !== 'granted') {
        perm = await LocalNotifications.requestPermissions();
      }

      if (!initialized) {
        const channels: Channel[] = [
          {
            id: ALARM_CHANNEL_ID,
            name: 'Alarms & Linked Reminders',
            description: 'High-priority alerts for scheduled alarms and linked reminders.',
            importance: 5,
            visibility: 1,
            vibration: true,
            lights: true,
            lightColor: '#F2B8A2',
          },
          {
            id: REMINDER_CHANNEL_ID,
            name: 'Smart Task Reminders',
            description: 'Heads-up alerts when a scheduled task or reminder is due.',
            importance: 5,
            visibility: 1,
            vibration: true,
            lights: true,
            lightColor: '#9EC5AB',
          },
          {
            id: CALM_CHANNEL_ID,
            name: 'Event Calm Check-Ins',
            description: 'Gentle grounding prompts during Event Calm Mode sessions.',
            importance: 4,
            visibility: 1,
            vibration: true,
            lights: true,
            lightColor: '#9BC4E2',
          },
        ];

        for (const ch of channels) {
          await LocalNotifications.createChannel(ch).catch(() => {});
        }

        initialized = true;
      }

      return perm.display === 'granted';
    } catch {
      return false;
    }
  }

  if ('Notification' in window) {
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'default') {
      try {
        const res = await Notification.requestPermission();
        return res === 'granted';
      } catch {
        return false;
      }
    }
  }
  return false;
}

export async function removeNotificationBySlotSeed(slotSeed: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  const id = hashToNotificationId(slotSeed);
  try {
    await stopNativeRingtone(id);
    await LocalNotifications.removeDeliveredNotificationsById({ ids: [id] }).catch(() => {});
    await LocalNotifications.cancel({ notifications: [{ id }] }).catch(() => {});
  } catch {
    // ignore cleanup failures
  }
}

export async function sendSystemNotification(params: {
  dedupeKey: string;
  slotSeed: string;
  title: string;
  body: string;
  channel: AppNotificationKind;
  route: AppRoute;
  entityId?: string;
  isPlaying?: boolean;
  soundLabel?: string;
  snoozeMinutes?: number;
  ongoing?: boolean;
  replaceInPlace?: boolean;
  summaryText?: string;
}): Promise<void> {
  const {
    dedupeKey,
    slotSeed,
    title,
    body,
    channel,
    route,
    entityId,
    isPlaying,
    soundLabel,
    snoozeMinutes = 5,
    ongoing,
    replaceInPlace,
    summaryText,
  } = params;

  // Never post a duplicate notification unless intentionally updating the slot in place
  if (!replaceInPlace && wasOccurrenceDispatched(dedupeKey)) {
    return;
  }
  markOccurrenceDispatched(dedupeKey);

  const displayTitle = isPlaying ? `▶ ${title}` : title;
  const cleanBody = body.trim();

  if (Capacitor.isNativePlatform()) {
    try {
      const granted = await ensureNotificationSetup();
      if (!granted) return;

      const channelId =
        channel === 'alarm'
          ? ALARM_CHANNEL_ID
          : channel === 'calm'
            ? CALM_CHANNEL_ID
            : REMINDER_CHANNEL_ID;

      const isOngoing = Boolean(ongoing ?? (isPlaying && channel === 'alarm'));
      const id = hashToNotificationId(slotSeed);
      await LocalNotifications.schedule({
        notifications: [
          {
            id,
            title: displayTitle,
            body: cleanBody,
            ...(cleanBody ? { largeBody: cleanBody } : {}),
            ...(summaryText ? { summaryText } : {}),
            channelId,
            group: slotSeed,
            ongoing: isOngoing,
            foreground: true,
            autoCancel: !isOngoing,
            isExactNotification: false,
            extra: {
              route,
              dedupeKey,
              kind: channel,
              entityId,
              snoozeMinutes,
              soundName: soundLabel,
              slotSeed,
            },
            schedule: {
              at: new Date(Date.now() + 15),
              allowWhileIdle: true,
            },
          },
        ],
      });
    } catch {
      // ignore notification delivery errors
    }
    return;
  }

  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(displayTitle, {
        ...(cleanBody ? { body: cleanBody } : {}),
        tag: slotSeed,
      });
    } catch {
      // ignore browser notification restrictions
    }
  }
}

function getNextDateForTime(hhmm: string, minLeadMs = 2000): Date | null {
  const [hStr, mStr] = hhmm.split(':');
  const hour = Number(hStr);
  const minute = Number(mStr);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;

  const target = new Date();
  target.setHours(hour, minute, 0, 0);
  if (target.getTime() <= Date.now() + minLeadMs) {
    target.setDate(target.getDate() + 1);
  }
  return target;
}

function getNextDateForRepeatingAlarm(
  hhmm: string,
  repeatDays: number[],
  minLeadMs = 2000
): Date | null {
  const [hStr, mStr] = hhmm.split(':');
  const hour = Number(hStr);
  const minute = Number(mStr);
  if (Number.isNaN(hour) || Number.isNaN(minute) || repeatDays.length === 0) return null;

  const candidate = new Date();
  candidate.setHours(hour, minute, 0, 0);
  if (candidate.getTime() <= Date.now() + minLeadMs) {
    candidate.setDate(candidate.getDate() + 1);
  }

  for (let offset = 0; offset < 8; offset++) {
    if (repeatDays.includes(candidate.getDay())) {
      return candidate;
    }
    candidate.setDate(candidate.getDate() + 1);
  }
  return null;
}

function getDateForDueTask(dueDate: string, dueTime: string, minLeadMs = 2000): Date | null {
  if (!dueDate || !dueTime) return null;
  const [y, m, d] = dueDate.split('-').map(Number);
  const [hh, mm] = dueTime.split(':').map(Number);
  if ([y, m, d, hh, mm].some((n) => Number.isNaN(n))) return null;
  const dt = new Date(y, m - 1, d, hh, mm, 0, 0);
  return dt.getTime() > Date.now() + minLeadMs ? dt : null;
}

function parseLocalDateTime(dateStr: string, timeStr: string): Date | null {
  if (!dateStr || !timeStr) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = timeStr.split(':').map(Number);
  if ([y, m, d, hh, mm].some((n) => Number.isNaN(n))) return null;
  return new Date(y, m - 1, d, hh, mm, 0, 0);
}

function buildScheduleFingerprint(params: {
  alarms: AlarmItem[];
  tasks: TaskReminderItem[];
  eventSessions: EventCalmSession[];
  birthdays?: BirthdayEntry[];
  customAudioTones?: CustomAudioTone[];
  defaultNotificationSoundId?: string;
}): string {
  const compactAlarms = params.alarms.map((a) => ({
    id: a.id,
    label: a.linkedReminderTitle || a.label,
    notes: a.linkedReminderNotes || '',
    date: a.date || '',
    time: a.time,
    enabled: a.enabled,
    repeatDays: a.repeatDays,
    snoozeMinutes: a.snoozeMinutes || 5,
    soundId: a.soundId || '',
    soundName: a.soundName || '',
    snoozedUntilDate: a.snoozedUntilDate || '',
    snoozedUntilTime: a.snoozedUntilTime || '',
  }));
  const compactTasks = params.tasks
    .filter((t) => !t.completed && !t.linkedAlarmId && t.dueTime)
    .map((t) => ({
      id: t.id,
      title: t.title,
      notes: t.notes,
      dueDate: t.dueDate,
      dueTime: t.dueTime,
      recurrence: t.recurrence,
      customRecurrenceUnit: t.customRecurrenceUnit || '',
      customRecurrenceDays: t.customRecurrenceDays || [],
      customRecurrenceMonthDays: t.customRecurrenceMonthDays || [],
      category: t.category,
      soundId: t.soundId || '',
      soundName: t.soundName || '',
    }));
  const compactEvents = params.eventSessions
    .filter((s) => s.active)
    .map((s) => ({
      id: s.id,
      eventName: s.eventName,
      date: s.date,
      startTime: s.startTime,
      endTime: s.endTime,
      intervalMinutes: s.intervalMinutes,
      isMidpointOnly: s.isMidpointOnly,
      selectedPrompts: s.selectedPrompts,
      customPrompts: s.customPrompts,
    }));
  const compactBirthdays = (params.birthdays || []).map((b) => ({
    id: b.id,
    name: b.name,
    birthDate: b.birthDate,
    wishTemplate: b.wishTemplate,
    offsets: b.offsets,
  }));
  const compactToneIds = (params.customAudioTones || []).map((t) => `${t.id}:${t.sizeBytes}`);
  return JSON.stringify({
    compactAlarms,
    compactTasks,
    compactEvents,
    compactBirthdays,
    compactToneIds,
    defaultNotificationSoundId: params.defaultNotificationSoundId || '',
  });
}

export function resetScheduleSyncFingerprint(): void {
  lastScheduleFingerprint = '';
}

export function syncScheduledNativeNotifications(params: {
  alarms: AlarmItem[];
  tasks: TaskReminderItem[];
  eventSessions: EventCalmSession[];
  birthdays?: BirthdayEntry[];
  customAudioTones?: CustomAudioTone[];
  defaultNotificationSoundId?: string;
}): Promise<void> {
  if (!Capacitor.isNativePlatform()) return Promise.resolve();

  const fingerprint = buildScheduleFingerprint(params);
  if (fingerprint === lastScheduleFingerprint) {
    return Promise.resolve();
  }
  lastScheduleFingerprint = fingerprint;

  syncChain = syncChain.then(async () => {
    try {
      await ensureNotificationSetup();

      // Clear legacy @capacitor/local-notifications schedules so our native AlarmManager +
      // SanctuaryRingtoneService BroadcastReceiver handles all triggers without duplicates
      const pending = await LocalNotifications.getPending().catch(() => ({ notifications: [] }));
      const toCancel = pending.notifications
        .filter((n) => n.id >= 10000)
        .map((n) => ({ id: n.id }));
      if (toCancel.length > 0) {
        await LocalNotifications.cancel({ notifications: toCancel }).catch(() => {});
      }

      const tones = params.customAudioTones || [];
      const tonePathMap = await syncAllCustomTonesToNative(tones);
      const defaultSoundId = params.defaultNotificationSoundId || 'builtin:calm-chime';
      const defaultSoundPath = tonePathMap.get(defaultSoundId) || '';

      const schedules: NativeScheduleItem[] = [];

      // 1. Enabled Alarms (both dedicated & linked task alarms)
      for (const alarm of params.alarms) {
        if (!alarm.enabled || !alarm.time) continue;
        const baseTitle = alarm.linkedReminderTitle || alarm.label || 'My World Alarm';
        const snoozeMins = alarm.snoozeMinutes || 5;
        const soundId = alarm.soundId || 'builtin:sanctuary-chime';
        const soundPath = tonePathMap.get(soundId) || '';
        const soundName = alarm.soundName || 'Sanctuary Chime';
        const body = (alarm.linkedReminderNotes || '').trim();
        const slotSeed = `alarm:${alarm.id}`;

        // Active snooze trigger if user tapped Snooze
        if (alarm.snoozedUntilDate && alarm.snoozedUntilTime) {
          const snoozeAt = getDateForDueTask(alarm.snoozedUntilDate, alarm.snoozedUntilTime, 1000);
          if (snoozeAt) {
            schedules.push({
              id: `${slotSeed}:snooze`,
              notifId: hashToNotificationId(slotSeed),
              kind: 'alarm',
              entityId: alarm.id,
              title: baseTitle,
              body,
              soundId,
              soundPath,
              soundName,
              route: 'alarms',
              snoozeMinutes: snoozeMins,
              repeating: false,
              triggerAtMs: snoozeAt.getTime(),
            });
          }
        }

        if (alarm.repeatDays.length === 0) {
          const at = alarm.snoozedUntilDate
            ? null
            : alarm.date
              ? getDateForDueTask(alarm.date, alarm.time, 2000)
              : getNextDateForTime(alarm.time, 2000);
          if (at) {
            schedules.push({
              id: slotSeed,
              notifId: hashToNotificationId(slotSeed),
              kind: 'alarm',
              entityId: alarm.id,
              title: baseTitle,
              body,
              soundId,
              soundPath,
              soundName,
              route: 'alarms',
              snoozeMinutes: snoozeMins,
              repeating: false,
              triggerAtMs: at.getTime(),
            });
          }
        } else {
          const nextRepeat = getNextDateForRepeatingAlarm(alarm.time, alarm.repeatDays, 2000);
          if (nextRepeat) {
            schedules.push({
              id: slotSeed,
              notifId: hashToNotificationId(slotSeed),
              kind: 'alarm',
              entityId: alarm.id,
              title: baseTitle,
              body,
              soundId,
              soundPath,
              soundName,
              route: 'alarms',
              snoozeMinutes: snoozeMins,
              repeating: true,
              repeatDays: alarm.repeatDays,
              hhmm: alarm.time,
              triggerAtMs: nextRepeat.getTime(),
            });
          }
        }
      }

      // 2. Unlinked Task Reminders (supports Once, Daily, Weekly, Monthly, and Custom repeat schedules)
      for (const task of params.tasks) {
        if (task.completed || task.linkedAlarmId || !task.dueTime) continue;
        const at = getNextTaskOccurrenceDateTime(task, 2000);
        if (!at) continue;

        let repeating = false;
        let repeatDays: number[] = [];
        if (task.recurrence === 'Daily') {
          repeating = true;
          repeatDays = [0, 1, 2, 3, 4, 5, 6];
        } else if (task.recurrence === 'Weekly' && task.dueDate) {
          const parsed = new Date(`${task.dueDate}T12:00:00`);
          if (!Number.isNaN(parsed.getTime())) {
            repeating = true;
            repeatDays = [parsed.getDay()];
          }
        } else if (
          task.recurrence === 'Custom' &&
          task.customRecurrenceUnit !== 'monthly' &&
          task.customRecurrenceDays &&
          task.customRecurrenceDays.length > 0
        ) {
          repeating = true;
          repeatDays = [...task.customRecurrenceDays].sort((a, b) => a - b);
        }

        const slotSeed = `task:${task.id}`;
        const soundId = task.soundId || defaultSoundId;
        const soundPath = tonePathMap.get(soundId) || defaultSoundPath;
        schedules.push({
          id: slotSeed,
          notifId: hashToNotificationId(slotSeed),
          kind: 'reminder',
          entityId: task.id,
          title: task.title,
          body: (task.notes || '').trim(),
          soundId,
          soundPath,
          soundName: task.soundName || 'Reminder Chime',
          route: 'tasks',
          snoozeMinutes: 5,
          repeating,
          ...(repeating ? { repeatDays, hhmm: task.dueTime } : {}),
          triggerAtMs: at.getTime(),
        });
      }

      // 3. Active Event Calm Mode upcoming check-in notifications
      for (const session of params.eventSessions) {
        if (!session.active) continue;
        const checkTimes = getEventCalmCheckInTimes(session);
        if (checkTimes.length === 0) continue;

        const message = formatEventCalmPrompts(session);
        for (const at of checkTimes) {
          if (at.getTime() <= Date.now() + 2000) continue;
          const slotMinuteKey = getCurrentMinuteKey(at);
          const slotSeed = `calm:${session.id}:${slotMinuteKey}`;
          schedules.push({
            id: slotSeed,
            notifId: hashToNotificationId(slotSeed),
            kind: 'calm',
            entityId: session.id,
            title: `${session.eventName} · Event Calm`,
            body: message,
            soundId: defaultSoundId,
            soundPath: defaultSoundPath,
            soundName: 'Calm Bell',
            route: 'event-calm',
            snoozeMinutes: 5,
            repeating: false,
            triggerAtMs: at.getTime(),
          });
        }
      }

      // 4. Birthdays (on-the-day morning alert at 09:00 + advance offset reminders in OS drawer)
      for (const b of params.birthdays || []) {
        const info = getDaysUntilBirthday(b.birthDate);
        if (!info.nextOccurrenceDate) continue;
        const dayTarget = parseLocalDateTime(info.nextOccurrenceDate, '09:00');
        if (!dayTarget) continue;

        const dayTargetMs = dayTarget.getTime();
        if (dayTargetMs > Date.now() + 2000) {
          const daySeed = `bday:${b.id}:day:${info.nextOccurrenceDate}`;
          schedules.push({
            id: daySeed,
            notifId: hashToNotificationId(daySeed),
            kind: 'calm',
            entityId: b.id,
            title: `🎂 ${b.name}’s Birthday Today`,
            body:
              b.wishTemplate ||
              `Remember to send a warm birthday wish to ${b.name} (${b.relationship}).`,
            soundId: defaultSoundId,
            soundPath: defaultSoundPath,
            soundName: 'Birthday Reminder',
            route: 'birthdays',
            snoozeMinutes: 5,
            repeating: false,
            triggerAtMs: dayTargetMs,
          });
        }

        for (const off of b.offsets || []) {
          if (!off || off.value <= 0) continue;
          const unitMs =
            off.unit === 'minutes'
              ? 60_000
              : off.unit === 'hours'
                ? 3_600_000
                : 86_400_000;
          const offsetTriggerMs = dayTargetMs - off.value * unitMs;
          if (offsetTriggerMs <= Date.now() + 2000) continue;

          const offSeed = `bday:${b.id}:off:${off.id}:${info.nextOccurrenceDate}`;
          schedules.push({
            id: offSeed,
            notifId: hashToNotificationId(offSeed),
            kind: 'calm',
            entityId: b.id,
            title: `🎂 Upcoming Birthday: ${b.name}`,
            body: `${off.value} ${off.unit} until ${b.name}’s birthday (${b.relationship}). ${
              b.wishTemplate ? 'Pre-written wish is ready in Birthdays.' : ''
            }`.trim(),
            soundId: defaultSoundId,
            soundPath: defaultSoundPath,
            soundName: 'Birthday Reminder',
            route: 'birthdays',
            snoozeMinutes: 5,
            repeating: false,
            triggerAtMs: offsetTriggerMs,
          });
        }
      }

      await syncNativeSchedules(schedules);
    } catch {
      // ignore background schedule failures
    }
  });

  return syncChain;
}

export interface NotificationActionPayload {
  actionId: 'snooze' | 'dismiss';
  kind: AppNotificationKind;
  entityId?: string;
  slotSeed?: string;
  snoozeMinutes: number;
  notificationId: number;
  title?: string;
}

export function attachNotificationListeners(callbacks: {
  onNavigate: (route: AppRoute) => void;
  onNativeReceived?: (item: AppNotificationItem) => void;
  onActionPerformed?: (payload: NotificationActionPayload) => void;
}): () => void {
  if (!Capacitor.isNativePlatform()) return () => {};

  let removed = false;

  const actionHandlePromise = LocalNotifications.addListener(
    'localNotificationActionPerformed',
    (event) => {
      if (removed) return;
      const extra = (event.notification.extra || {}) as {
        route?: AppRoute;
        kind?: AppNotificationKind;
        entityId?: string;
        slotSeed?: string;
        snoozeMinutes?: number;
      };

      if (event.actionId === 'snooze' || event.actionId === 'dismiss') {
        void LocalNotifications.removeDeliveredNotificationsById({
          ids: [event.notification.id],
        }).catch(() => {});

        callbacks.onActionPerformed?.({
          actionId: event.actionId,
          kind: extra.kind || 'alarm',
          entityId: extra.entityId,
          slotSeed: extra.slotSeed,
          snoozeMinutes: Number(extra.snoozeMinutes) || 5,
          notificationId: event.notification.id,
          title: event.notification.title,
        });
        return;
      }

      if (extra.route) {
        callbacks.onNavigate(extra.route);
      }
    }
  );

  const receivedHandlePromise = LocalNotifications.addListener(
    'localNotificationReceived',
    (notification) => {
      if (removed) return;
      const extra = (notification.extra || {}) as {
        route?: AppRoute;
        dedupeKey?: string;
        kind?: AppNotificationKind;
        entityId?: string;
      };
      const minuteKey = getCurrentMinuteKey();
      const kind: AppNotificationKind = extra.kind || 'reminder';
      const dedupeKey =
        extra.dedupeKey ||
        (extra.entityId ? `${kind}:${extra.entityId}:${minuteKey}` : `native:${notification.id}:${minuteKey}`);

      // Mark dispatched right away so our foreground tick won't duplicate the OS drawer alert
      markOccurrenceDispatched(dedupeKey);

      if (callbacks.onNativeReceived) {
        callbacks.onNativeReceived({
          id: createId('notif'),
          dedupeKey,
          kind,
          status: 'delivered',
          title: notification.title || 'My World Notification',
          body: notification.body || '',
          scheduledAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          read: false,
          route: extra.route || 'home',
        });
      }
    }
  );

  return () => {
    removed = true;
    void actionHandlePromise.then((h) => h.remove()).catch(() => {});
    void receivedHandlePromise.then((h) => h.remove()).catch(() => {});
  };
}

/**
 * Reconciles alarms, task reminders, Event Calm check-ins, and today's birthdays
 * that passed while the app was closed or missed, returning new deduplicated items
 * to add to the in-app Notification Bell inbox.
 */
export function collectMissedAndTodayInboxItems(params: {
  alarms: AlarmItem[];
  tasks: TaskReminderItem[];
  eventSessions: EventCalmSession[];
  birthdays: BirthdayEntry[];
  existingHistory: AppNotificationItem[];
  dismissedKeys?: Set<string>;
}): AppNotificationItem[] {
  const existingKeys = new Set(params.existingHistory.map((item) => item.dedupeKey));
  const dismissed = params.dismissedKeys ?? getDismissedNotificationKeys();
  dismissed.forEach((k) => existingKeys.add(k));
  const additions: AppNotificationItem[] = [];

  const now = new Date();
  const nowMs = now.getTime();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`;
  const todayWeekday = now.getDay();
  const oneMinuteAgoMs = nowMs - 60 * 1000;
  const sevenDaysAgoMs = nowMs - 7 * 24 * 60 * 60 * 1000;

  const pushIfNew = (item: Omit<AppNotificationItem, 'id'>) => {
    if (existingKeys.has(item.dedupeKey)) return;
    existingKeys.add(item.dedupeKey);
    additions.push({ ...item, id: createId('notif') });
  };

  // 1. Alarms scheduled earlier today that did not fire in-app
  for (const alarm of params.alarms) {
    if (!alarm.enabled || !alarm.time) continue;
    if (alarm.snoozedUntilDate === todayStr && alarm.snoozedUntilTime) continue;
    if (alarm.date && alarm.repeatDays.length === 0 && alarm.date !== todayStr) continue;
    if (alarm.repeatDays.length > 0 && !alarm.repeatDays.includes(todayWeekday)) continue;

    const [hh, mm] = alarm.time.split(':').map(Number);
    if (Number.isNaN(hh) || Number.isNaN(mm)) continue;

    const scheduledDt = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm, 0, 0);
    const createdMs = new Date(alarm.createdAt).getTime();

    if (
      scheduledDt.getTime() < oneMinuteAgoMs &&
      (!Number.isNaN(createdMs) ? createdMs <= scheduledDt.getTime() : true)
    ) {
      const minuteKey = `${todayStr}T${alarm.time}`;
      if (alarm.lastTriggeredMinute === minuteKey) continue;

      const dedupeKey = `alarm:${alarm.id}:${minuteKey}`;
      pushIfNew({
        dedupeKey,
        kind: 'alarm',
        status: 'missed',
        title: alarm.linkedReminderTitle || alarm.label || 'Sanctuary Alarm',
        body: alarm.linkedReminderNotes || `Alarm scheduled for ${alarm.time} while away`,
        scheduledAt: scheduledDt.toISOString(),
        createdAt: new Date().toISOString(),
        read: false,
        route: 'alarms',
      });
    }
  }

  // 2. Unlinked Task Reminders due in the past 7 days that haven't been completed or logged
  for (const task of params.tasks) {
    if (task.completed || task.linkedAlarmId || !task.dueDate || !task.dueTime) continue;
    const [y, m, d] = task.dueDate.split('-').map(Number);
    const [hh, mm] = task.dueTime.split(':').map(Number);
    if ([y, m, d, hh, mm].some((n) => Number.isNaN(n))) continue;

    const dueDt = new Date(y, m - 1, d, hh, mm, 0, 0);
    const dueMs = dueDt.getTime();
    if (dueMs < oneMinuteAgoMs && dueMs >= sevenDaysAgoMs) {
      const minuteKey = `${task.dueDate}T${task.dueTime}`;
      if (task.lastNotifiedMinute === minuteKey) continue;

      pushIfNew({
        dedupeKey: `task:${task.id}:${minuteKey}`,
        kind: 'reminder',
        status: 'missed',
        title: task.title,
        body: task.notes || `Scheduled reminder (${task.dueDate} ${task.dueTime})`,
        scheduledAt: dueDt.toISOString(),
        createdAt: new Date().toISOString(),
        read: false,
        route: 'tasks',
      });
    }
  }

  // 3. Active Event Calm check-ins from earlier today that passed while app was closed
  for (const session of params.eventSessions) {
    if (!session.active) continue;
    const checkTimes = getEventCalmCheckInTimes(session);
    if (checkTimes.length === 0) continue;

    const missedSlots = checkTimes
      .filter((dt) => {
        const ms = dt.getTime();
        return ms < oneMinuteAgoMs && ms >= sevenDaysAgoMs;
      })
      .slice(-8);

    if (missedSlots.length === 0) continue;

    const fullPromptList = formatEventCalmPrompts(session);

    for (const slotDt of missedSlots) {
      const minuteKey = getCurrentMinuteKey(slotDt);
      if (session.lastCheckInMinute === minuteKey) continue;

      pushIfNew({
        dedupeKey: `calm:${session.id}:${minuteKey}`,
        kind: 'calm',
        status: 'missed',
        title: `${session.eventName} · Event Calm`,
        body: fullPromptList,
        scheduledAt: slotDt.toISOString(),
        createdAt: new Date().toISOString(),
        read: false,
        route: 'event-calm',
      });
    }
  }

  // 4. Today's Birthdays
  const todayMonthDay = todayStr.slice(5);
  for (const b of params.birthdays) {
    if (!b.birthDate || b.birthDate.slice(5) !== todayMonthDay) continue;
    pushIfNew({
      dedupeKey: `birthday:${b.id}:${todayStr}`,
      kind: 'birthday',
      status: 'delivered',
      title: `${b.name}’s Birthday Today`,
      body: b.wishTemplate || `Send a warm wish to ${b.name}.`,
      scheduledAt: `${todayStr}T09:00:00`,
      createdAt: new Date().toISOString(),
      read: false,
      route: 'birthdays',
    });
  }

  return additions;
}
