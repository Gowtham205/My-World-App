import { Capacitor } from '@capacitor/core';
import { LocalNotifications, type Channel } from '@capacitor/local-notifications';
import type { AlarmItem, AppRoute, EventCalmSession, TaskReminderItem } from '../types/sanctuary';

const ALARM_CHANNEL_ID = 'my-world-alarms';
const REMINDER_CHANNEL_ID = 'my-world-reminders';
const CALM_CHANNEL_ID = 'my-world-calm';

// Deterministic positive 32-bit int >= 10000 for scheduled items; < 10000 reserved for immediate alerts
function hashToNotificationId(seed: string, min = 10000): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return min + (Math.abs(hash) % 2000000000);
}

let initialized = false;

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

export async function sendSystemNotification(params: {
  key: string;
  title: string;
  body: string;
  channel: 'alarm' | 'reminder' | 'calm';
  route: AppRoute;
}): Promise<void> {
  const { key, title, body, channel, route } = params;

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

      const id = 100 + (hashToNotificationId(key, 0) % 9000);
      await LocalNotifications.schedule({
        notifications: [
          {
            id,
            title,
            body,
            largeBody: body,
            channelId,
            foreground: true,
            autoCancel: true,
            isExactNotification: false,
            extra: { route },
            schedule: {
              at: new Date(Date.now() + 150),
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
      new Notification(title, { body });
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
  if (target.getTime() <= Date.now() + 5000) {
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
  return dt.getTime() > Date.now() + 5000 ? dt : null;
}

export async function syncScheduledNativeNotifications(params: {
  alarms: AlarmItem[];
  tasks: TaskReminderItem[];
  eventSessions: EventCalmSession[];
}): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    const granted = await ensureNotificationSetup();
    if (!granted) return;

    const exactCheck = await LocalNotifications.checkExactNotificationSetting().catch(() => ({
      exact_alarm: 'denied' as const,
    }));
    const useExact = exactCheck.exact_alarm === 'granted';

    // Cancel previously scheduled background items (ids >= 10000) without wiping immediate alerts
    const pending = await LocalNotifications.getPending().catch(() => ({ notifications: [] }));
    const toCancel = pending.notifications
      .filter((n) => n.id >= 10000)
      .map((n) => ({ id: n.id }));
    if (toCancel.length > 0) {
      await LocalNotifications.cancel({ notifications: toCancel }).catch(() => {});
    }

    const notifications: Parameters<typeof LocalNotifications.schedule>[0]['notifications'] = [];

    // 1. Enabled Alarms
    for (const alarm of params.alarms) {
      if (!alarm.enabled || !alarm.time) continue;
      const [hStr, mStr] = alarm.time.split(':');
      const hour = Number(hStr);
      const minute = Number(mStr);
      if (Number.isNaN(hour) || Number.isNaN(minute)) continue;

      const title = alarm.linkedReminderTitle || alarm.label || 'My World Alarm';
      const body = alarm.linkedReminderNotes || `Scheduled alarm for ${alarm.time}`;

      if (alarm.repeatDays.length === 0) {
        const at = getNextDateForTime(alarm.time);
        if (at) {
          notifications.push({
            id: hashToNotificationId(`alarm:${alarm.id}`),
            title,
            body,
            largeBody: body,
            channelId: ALARM_CHANNEL_ID,
            foreground: true,
            autoCancel: true,
            isExactNotification: useExact,
            extra: { route: 'alarms' satisfies AppRoute },
            schedule: { at, allowWhileIdle: true },
          });
        }
      } else if (alarm.repeatDays.length === 7) {
        notifications.push({
          id: hashToNotificationId(`alarm:${alarm.id}:daily`),
          title,
          body,
          largeBody: body,
          channelId: ALARM_CHANNEL_ID,
          foreground: true,
          autoCancel: true,
          isExactNotification: useExact,
          extra: { route: 'alarms' satisfies AppRoute },
          schedule: {
            on: { hour, minute },
            repeats: true,
            allowWhileIdle: true,
          },
        });
      } else {
        for (const dayIdx of alarm.repeatDays) {
          // JS 0..6 (Sun..Sat) -> Capacitor Weekday 1..7 (Sun..Sat)
          const weekday = (dayIdx + 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7;
          notifications.push({
            id: hashToNotificationId(`alarm:${alarm.id}:w:${dayIdx}`),
            title,
            body,
            largeBody: body,
            channelId: ALARM_CHANNEL_ID,
            foreground: true,
            autoCancel: true,
            isExactNotification: useExact,
            extra: { route: 'alarms' satisfies AppRoute },
            schedule: {
              on: { weekday, hour, minute },
              repeats: true,
              allowWhileIdle: true,
            },
          });
        }
      }
    }

    // 2. Unlinked Smart Task Reminders with future due time
    for (const task of params.tasks) {
      if (task.completed || task.linkedAlarmId || !task.dueTime) continue;
      const at = getDateForDueTask(task.dueDate, task.dueTime);
      if (!at) continue;

      notifications.push({
        id: hashToNotificationId(`task:${task.id}`),
        title: task.title,
        body: task.notes || `Reminder · ${task.category}`,
        largeBody: task.notes || `Reminder · ${task.category}`,
        channelId: REMINDER_CHANNEL_ID,
        foreground: true,
        autoCancel: true,
        isExactNotification: useExact,
        extra: { route: 'tasks' satisfies AppRoute },
        schedule: { at, allowWhileIdle: true },
      });
    }

    // 3. Active Event Calm Mode upcoming check-in notifications (next few intervals)
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
        for (let t = startDt.getTime() + stepMs; t <= endDt.getTime() && checkTimes.length < 6; t += stepMs) {
          checkTimes.push(new Date(t));
        }
      }

      const pool = [...session.selectedPrompts, ...session.customPrompts];
      const message =
        pool[0] || "It's okay. Take 3 slow breaths and return to the present moment.";

      checkTimes.forEach((at, idx) => {
        if (at.getTime() <= Date.now() + 5000) return;
        notifications.push({
          id: hashToNotificationId(`calm:${session.id}:${idx}`),
          title: `Event Calm · ${session.eventName}`,
          body: message,
          largeBody: message,
          channelId: CALM_CHANNEL_ID,
          foreground: true,
          autoCancel: true,
          isExactNotification: useExact,
          extra: { route: 'event-calm' satisfies AppRoute },
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
}

export function attachNotificationTapListener(
  onNavigate: (route: AppRoute) => void
): () => void {
  if (!Capacitor.isNativePlatform()) return () => {};

  let removed = false;
  const handlePromise = LocalNotifications.addListener(
    'localNotificationActionPerformed',
    (event) => {
      if (removed) return;
      const targetRoute = event.notification.extra?.route as AppRoute | undefined;
      if (targetRoute) {
        onNavigate(targetRoute);
      }
    }
  );

  return () => {
    removed = true;
    void handlePromise.then((h) => h.remove()).catch(() => {});
  };
}
