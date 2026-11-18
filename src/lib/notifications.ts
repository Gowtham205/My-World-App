import { Capacitor } from '@capacitor/core';
import { LocalNotifications, type Channel } from '@capacitor/local-notifications';
import type {
  AlarmItem,
  AppNotificationItem,
  AppNotificationKind,
  AppRoute,
  BirthdayEntry,
  EventCalmSession,
  TaskReminderItem,
} from '../types/sanctuary';
import { createId } from './storage';

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

function getCurrentMinuteKey(d = new Date()): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${mo}-${da}T${hh}:${mm}`;
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

        await LocalNotifications.registerActionTypes({
          types: [
            {
              id: ALARM_ACTION_TYPE_ID,
              actions: [
                { id: 'snooze', title: 'Snooze 5m', foreground: false },
                { id: 'dismiss', title: 'Dismiss', foreground: false, destructive: true },
              ],
            },
            {
              id: REMINDER_ACTION_TYPE_ID,
              actions: [
                { id: 'snooze', title: 'Snooze 5m', foreground: false },
                { id: 'dismiss', title: 'Dismiss', foreground: false, destructive: true },
              ],
            },
          ],
        }).catch(() => {});

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

  const displayTitle = isPlaying ? `▶ Playing · ${title}` : title;
  const effectiveSummary =
    summaryText ||
    (isPlaying
      ? `▶ ${soundLabel || 'Alarm Ringtone'} · Stops in 1m`
      : soundLabel
        ? `Sound: ${soundLabel}`
        : undefined);
  const fullBody = isPlaying
    ? `${body ? `${body} · ` : ''}Playing: ${soundLabel || 'Default Chime'} (auto-snoozes ${snoozeMinutes}m after 1m)`
    : body;

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

      const actionTypeId =
        channel === 'alarm'
          ? ALARM_ACTION_TYPE_ID
          : channel === 'reminder'
            ? REMINDER_ACTION_TYPE_ID
            : undefined;

      const isOngoing = Boolean(ongoing ?? (isPlaying && channel === 'alarm'));

      // Use the SAME deterministic notification ID as syncScheduledNativeNotifications so
      // Android updates any matching slot in place rather than stacking duplicate cards.
      const id = hashToNotificationId(slotSeed);
      await LocalNotifications.schedule({
        notifications: [
          {
            id,
            title: displayTitle,
            body: fullBody,
            largeBody: fullBody,
            summaryText: effectiveSummary,
            channelId,
            group: slotSeed,
            actionTypeId,
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
              at: new Date(Date.now() + 100),
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
      new Notification(displayTitle, { body: fullBody, tag: slotSeed });
    } catch {
      // ignore browser notification restrictions
    }
  }
}

function getNextDateForTime(hhmm: string): Date | null {
  const [hStr, mStr] = hhmm.split(':');
  const hour = Number(hStr);
  const minute = Number(mStr);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;

  const target = new Date();
  target.setHours(hour, minute, 0, 0);
  if (target.getTime() <= Date.now() + 65000) {
    target.setDate(target.getDate() + 1);
  }
  return target;
}

function getDateForDueTask(dueDate: string, dueTime: string): Date | null {
  if (!dueDate || !dueTime) return null;
  const [y, m, d] = dueDate.split('-').map(Number);
  const [hh, mm] = dueTime.split(':').map(Number);
  if ([y, m, d, hh, mm].some((n) => Number.isNaN(n))) return null;
  const dt = new Date(y, m - 1, d, hh, mm, 0, 0);
  return dt.getTime() > Date.now() + 15000 ? dt : null;
}

function buildScheduleFingerprint(params: {
  alarms: AlarmItem[];
  tasks: TaskReminderItem[];
  eventSessions: EventCalmSession[];
}): string {
  const compactAlarms = params.alarms.map((a) => ({
    id: a.id,
    label: a.linkedReminderTitle || a.label,
    notes: a.linkedReminderNotes || '',
    time: a.time,
    enabled: a.enabled,
    repeatDays: a.repeatDays,
    snoozeMinutes: a.snoozeMinutes || 5,
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
      category: t.category,
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
  return JSON.stringify({ compactAlarms, compactTasks, compactEvents });
}

export function syncScheduledNativeNotifications(params: {
  alarms: AlarmItem[];
  tasks: TaskReminderItem[];
  eventSessions: EventCalmSession[];
}): Promise<void> {
  if (!Capacitor.isNativePlatform()) return Promise.resolve();

  const fingerprint = buildScheduleFingerprint(params);
  if (fingerprint === lastScheduleFingerprint) {
    return Promise.resolve();
  }
  lastScheduleFingerprint = fingerprint;

  syncChain = syncChain.then(async () => {
    try {
      const granted = await ensureNotificationSetup();
      if (!granted) return;

      const exactCheck = await LocalNotifications.checkExactNotificationSetting().catch(() => ({
        exact_alarm: 'denied' as const,
      }));
      const useExact = exactCheck.exact_alarm === 'granted';

      const pending = await LocalNotifications.getPending().catch(() => ({ notifications: [] }));
      const toCancel = pending.notifications
        .filter((n) => n.id >= 10000)
        .map((n) => ({ id: n.id }));
      if (toCancel.length > 0) {
        await LocalNotifications.cancel({ notifications: toCancel }).catch(() => {});
      }

      const notifications: Parameters<typeof LocalNotifications.schedule>[0]['notifications'] = [];
      const seenIds = new Set<number>();

      const pushUnique = (
        item: Parameters<typeof LocalNotifications.schedule>[0]['notifications'][number]
      ) => {
        if (seenIds.has(item.id)) return;
        seenIds.add(item.id);
        notifications.push(item);
      };

      const now = new Date();
      const nowHH = now.getHours();
      const nowMM = now.getMinutes();

      // 1. Enabled Alarms
      for (const alarm of params.alarms) {
        if (!alarm.enabled || !alarm.time) continue;
        const [hStr, mStr] = alarm.time.split(':');
        const hour = Number(hStr);
        const minute = Number(mStr);
        if (Number.isNaN(hour) || Number.isNaN(minute)) continue;

        const baseTitle = alarm.linkedReminderTitle || alarm.label || 'My World Alarm';
        const title = `▶ ${baseTitle}`;
        const snoozeMins = alarm.snoozeMinutes || 5;
        const soundLabel = alarm.soundName || 'Sanctuary Chime';
        const body = alarm.linkedReminderNotes
          ? `${alarm.linkedReminderNotes} · Sound: ${soundLabel}`
          : `Scheduled alarm (${alarm.time}) · Sound: ${soundLabel}`;
        const slotSeed = `alarm:${alarm.id}`;

        // Schedule active snooze wake-up if present
        if (alarm.snoozedUntilDate && alarm.snoozedUntilTime) {
          const snoozeAt = getDateForDueTask(alarm.snoozedUntilDate, alarm.snoozedUntilTime);
          if (snoozeAt) {
            pushUnique({
              id: hashToNotificationId(slotSeed),
              title,
              body,
              largeBody: body,
              summaryText: `▶ Snoozed alarm · ${soundLabel}`,
              channelId: ALARM_CHANNEL_ID,
              group: slotSeed,
              actionTypeId: ALARM_ACTION_TYPE_ID,
              foreground: true,
              autoCancel: false,
              isExactNotification: useExact,
              extra: {
                route: 'alarms' satisfies AppRoute,
                kind: 'alarm',
                entityId: alarm.id,
                snoozeMinutes: snoozeMins,
                soundName: soundLabel,
                slotSeed,
              },
              schedule: { at: snoozeAt, allowWhileIdle: true },
            });
          }
        }

        if (alarm.repeatDays.length === 0) {
          const at = alarm.snoozedUntilDate ? null : getNextDateForTime(alarm.time);
          if (at) {
            pushUnique({
              id: hashToNotificationId(slotSeed),
              title,
              body,
              largeBody: body,
              summaryText: `▶ ${soundLabel} · Snooze ${snoozeMins}m`,
              channelId: ALARM_CHANNEL_ID,
              group: slotSeed,
              actionTypeId: ALARM_ACTION_TYPE_ID,
              foreground: true,
              autoCancel: false,
              isExactNotification: useExact,
              extra: {
                route: 'alarms' satisfies AppRoute,
                kind: 'alarm',
                entityId: alarm.id,
                snoozeMinutes: snoozeMins,
                soundName: soundLabel,
                slotSeed,
              },
              schedule: { at, allowWhileIdle: true },
            });
          }
        } else if (alarm.repeatDays.length === 7) {
          // If repeating right at this exact current minute, avoid immediate duplicate re-triggering
          if (nowHH === hour && nowMM === minute) continue;
          pushUnique({
            id: hashToNotificationId(slotSeed),
            title,
            body,
            largeBody: body,
            summaryText: `▶ ${soundLabel} · Snooze ${snoozeMins}m`,
            channelId: ALARM_CHANNEL_ID,
            group: slotSeed,
            actionTypeId: ALARM_ACTION_TYPE_ID,
            foreground: true,
            autoCancel: false,
            isExactNotification: useExact,
            extra: {
              route: 'alarms' satisfies AppRoute,
              kind: 'alarm',
              entityId: alarm.id,
              snoozeMinutes: snoozeMins,
              soundName: soundLabel,
              slotSeed,
            },
            schedule: {
              on: { hour, minute },
              repeats: true,
              allowWhileIdle: true,
            },
          });
        } else {
          for (const dayIdx of alarm.repeatDays) {
            if (now.getDay() === dayIdx && nowHH === hour && nowMM === minute) continue;
            const weekday = (dayIdx + 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7;
            const daySlotSeed = `alarm:${alarm.id}:w:${dayIdx}`;
            pushUnique({
              id: hashToNotificationId(daySlotSeed),
              title,
              body,
              largeBody: body,
              summaryText: `▶ ${soundLabel} · Snooze ${snoozeMins}m`,
              channelId: ALARM_CHANNEL_ID,
              group: slotSeed,
              actionTypeId: ALARM_ACTION_TYPE_ID,
              foreground: true,
              autoCancel: false,
              isExactNotification: useExact,
              extra: {
                route: 'alarms' satisfies AppRoute,
                kind: 'alarm',
                entityId: alarm.id,
                snoozeMinutes: snoozeMins,
                soundName: soundLabel,
                slotSeed: daySlotSeed,
              },
              schedule: {
                on: { weekday, hour, minute },
                repeats: true,
                allowWhileIdle: true,
              },
            });
          }
        }
      }

      // 2. Unlinked Task Reminders with future due time
      for (const task of params.tasks) {
        if (task.completed || task.linkedAlarmId || !task.dueTime) continue;
        const at = getDateForDueTask(task.dueDate, task.dueTime);
        if (!at) continue;

        const slotSeed = `task:${task.id}`;
        pushUnique({
          id: hashToNotificationId(slotSeed),
          title: `▶ ${task.title}`,
          body: task.notes || `Reminder · ${task.category}`,
          largeBody: task.notes || `Reminder · ${task.category}`,
          summaryText: task.soundName ? `Sound: ${task.soundName}` : `Reminder · ${task.category}`,
          channelId: REMINDER_CHANNEL_ID,
          group: slotSeed,
          actionTypeId: REMINDER_ACTION_TYPE_ID,
          foreground: true,
          autoCancel: true,
          isExactNotification: useExact,
          extra: {
            route: 'tasks' satisfies AppRoute,
            kind: 'reminder',
            entityId: task.id,
            snoozeMinutes: 5,
            soundName: task.soundName,
            slotSeed,
          },
          schedule: { at, allowWhileIdle: true },
        });
      }

      // 3. Active Event Calm Mode upcoming check-in notifications (uses one shared slotSeed per session so it never piles up)
      for (const session of params.eventSessions) {
        if (!session.active) continue;
        const [y, m, d] = session.date.split('-').map(Number);
        const [sh, sm] = session.startTime.split(':').map(Number);
        const [eh, em] = session.endTime.split(':').map(Number);
        if ([y, m, d, sh, sm, eh, em].some((n) => Number.isNaN(n))) continue;

        const startDt = new Date(y, m - 1, d, sh, sm, 0, 0);
        const endDt = new Date(y, m - 1, d, eh, em, 0, 0);
        if (endDt.getTime() <= Date.now()) continue;

        const checkTimes: Date[] = [];
        if (session.isMidpointOnly) {
          checkTimes.push(new Date((startDt.getTime() + endDt.getTime()) / 2));
        } else if (session.intervalMinutes > 0) {
          const stepMs = session.intervalMinutes * 60 * 1000;
          for (
            let t = startDt.getTime() + stepMs;
            t <= endDt.getTime() && checkTimes.length < 6;
            t += stepMs
          ) {
            checkTimes.push(new Date(t));
          }
        }

        const pool = [...session.selectedPrompts, ...session.customPrompts];
        const message =
          pool[0] || "It's okay. Take 3 slow breaths and return to the present moment.";
        const slotSeed = `calm:${session.id}`;

        checkTimes.forEach((at, idx) => {
          if (at.getTime() <= Date.now() + 15000) return;
          pushUnique({
            id: hashToNotificationId(`${slotSeed}:${idx}`),
            title: `${session.eventName} · Event Calm`,
            body: message,
            largeBody: message,
            channelId: CALM_CHANNEL_ID,
            group: slotSeed,
            foreground: true,
            autoCancel: true,
            isExactNotification: useExact,
            extra: { route: 'event-calm' satisfies AppRoute, kind: 'calm', entityId: session.id, slotSeed },
            schedule: { at, allowWhileIdle: true },
          });
        });
      }

      if (notifications.length > 0) {
        await LocalNotifications.schedule({ notifications }).catch(() => {});
      }
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
}): AppNotificationItem[] {
  const existingKeys = new Set(params.existingHistory.map((item) => item.dedupeKey));
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
    if (!session.active || session.date !== todayStr) continue;
    const [sh, sm] = session.startTime.split(':').map(Number);
    const [eh, em] = session.endTime.split(':').map(Number);
    if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) continue;

    const startDt = new Date(now.getFullYear(), now.getMonth(), now.getDate(), sh, sm, 0, 0);
    const endDt = new Date(now.getFullYear(), now.getMonth(), now.getDate(), eh, em, 0, 0);

    let latestMissedSlot: Date | null = null;
    if (session.isMidpointOnly) {
      const midDt = new Date((startDt.getTime() + endDt.getTime()) / 2);
      if (midDt.getTime() < oneMinuteAgoMs) {
        latestMissedSlot = midDt;
      }
    } else if (session.intervalMinutes > 0) {
      const stepMs = session.intervalMinutes * 60 * 1000;
      for (let t = startDt.getTime() + stepMs; t <= Math.min(oneMinuteAgoMs, endDt.getTime()); t += stepMs) {
        latestMissedSlot = new Date(t);
      }
    }

    if (latestMissedSlot) {
      const slotHH = String(latestMissedSlot.getHours()).padStart(2, '0');
      const slotMM = String(latestMissedSlot.getMinutes()).padStart(2, '0');
      const minuteKey = `${todayStr}T${slotHH}:${slotMM}`;
      if (session.lastCheckInMinute === minuteKey) continue;

      const pool = [...session.selectedPrompts, ...session.customPrompts];
      const prompt =
        pool[0] || "It's okay. Take 3 slow breaths and return to the present moment.";

      pushIfNew({
        dedupeKey: `calm:${session.id}:${minuteKey}`,
        kind: 'calm',
        status: 'missed',
        title: `${session.eventName} · Event Calm`,
        body: prompt,
        scheduledAt: latestMissedSlot.toISOString(),
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
