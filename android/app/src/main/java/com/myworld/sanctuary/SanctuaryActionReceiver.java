package com.myworld.sanctuary;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import org.json.JSONObject;

/**
 * Handles Snooze & Dismiss notification drawer action buttons strictly via Broadcast,
 * applying the effect immediately in the background WITHOUT opening the app.
 */
public class SanctuaryActionReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;

        String actionType = intent.getStringExtra(SanctuaryNotificationHelper.EXTRA_ACTION_TYPE);
        if (actionType == null) {
            actionType = SanctuaryNotificationHelper.ACTION_SNOOZE.equals(intent.getAction())
                ? "snooze"
                : "dismiss";
        }
        String scheduleId = nonNull(intent.getStringExtra(SanctuaryNotificationHelper.EXTRA_SCHEDULE_ID), "");
        int notifId = intent.getIntExtra(SanctuaryNotificationHelper.EXTRA_NOTIF_ID, 88001);
        String kind = nonNull(intent.getStringExtra(SanctuaryNotificationHelper.EXTRA_KIND), "alarm");
        String entityId = nonNull(intent.getStringExtra(SanctuaryNotificationHelper.EXTRA_ENTITY_ID), "");
        String title = nonNull(intent.getStringExtra(SanctuaryNotificationHelper.EXTRA_TITLE), "My World");
        String body = nonNull(intent.getStringExtra(SanctuaryNotificationHelper.EXTRA_BODY), "");
        String route = nonNull(intent.getStringExtra(SanctuaryNotificationHelper.EXTRA_ROUTE), "alarms");
        int snoozeMinutes = intent.getIntExtra(SanctuaryNotificationHelper.EXTRA_SNOOZE_MINUTES, 5);
        if (snoozeMinutes <= 0) snoozeMinutes = 5;

        if ("snooze".equals(actionType)) {
            performSnooze(
                context,
                scheduleId,
                notifId,
                kind,
                entityId,
                title,
                body,
                route,
                snoozeMinutes,
                false,
                0
            );
        } else {
            performDismiss(
                context,
                scheduleId,
                notifId,
                kind,
                entityId,
                title,
                body,
                route
            );
        }
    }

    public static void performSnooze(
        Context context,
        String scheduleId,
        int notifId,
        String kind,
        String entityId,
        String title,
        String body,
        String route,
        int snoozeMinutes,
        boolean autoSnoozed,
        int autoSnoozeCount
    ) {
        stopServiceAndClearNotif(context, notifId);

        long snoozeTargetMs = System.currentTimeMillis() + (snoozeMinutes * 60_000L);
        JSONObject stored = SanctuaryScheduleStore.findScheduleById(context, scheduleId);
        JSONObject snoozeSchedule = new JSONObject();
        try {
            String snoozeId = !scheduleId.isEmpty() ? (scheduleId + ":snooze") : ("snooze:" + notifId);
            snoozeSchedule.put("id", snoozeId);
            snoozeSchedule.put("notifId", notifId);
            snoozeSchedule.put("kind", kind);
            snoozeSchedule.put("entityId", entityId);
            snoozeSchedule.put("title", title);
            snoozeSchedule.put("body", body);
            snoozeSchedule.put("soundId", stored != null ? stored.optString("soundId", "builtin:sanctuary-chime") : "builtin:sanctuary-chime");
            snoozeSchedule.put("soundPath", stored != null ? stored.optString("soundPath", "") : "");
            snoozeSchedule.put("soundName", stored != null ? stored.optString("soundName", "Sanctuary Chime") : "Sanctuary Chime");
            snoozeSchedule.put("route", route);
            snoozeSchedule.put("snoozeMinutes", snoozeMinutes);
            snoozeSchedule.put("autoSnoozeCount", autoSnoozed ? Math.max(0, autoSnoozeCount) : 0);
            snoozeSchedule.put("repeating", false);
            snoozeSchedule.put("triggerAtMs", snoozeTargetMs);

            SanctuaryScheduleStore.upsertSchedule(context, snoozeSchedule);
            SanctuaryNotificationHelper.scheduleTrigger(context, snoozeSchedule);

            JSONObject ev = new JSONObject();
            ev.put("type", autoSnoozed ? "auto_snoozed" : "snooze");
            ev.put("scheduleId", scheduleId);
            ev.put("notifId", notifId);
            ev.put("kind", kind);
            ev.put("entityId", entityId);
            ev.put("title", title);
            ev.put("body", body);
            ev.put("route", route);
            ev.put("snoozeMinutes", snoozeMinutes);
            ev.put("autoSnoozeCount", autoSnoozed ? Math.max(0, autoSnoozeCount) : 0);
            ev.put("snoozeTargetMs", snoozeTargetMs);
            if (!SanctuaryAudioPlugin.emitEventToJs("nativeAlertEvent", ev)) {
                SanctuaryScheduleStore.queuePendingEvent(context, ev);
            }
        } catch (Exception ignored) {}
    }

    public static void performAutoStopExhausted(
        Context context,
        String scheduleId,
        int notifId,
        String kind,
        String entityId,
        String title,
        String body,
        String route
    ) {
        stopServiceAndClearNotif(context, notifId);
        if (!scheduleId.isEmpty()) {
            String snoozeId = scheduleId + ":snooze";
            SanctuaryScheduleStore.removeScheduleById(context, snoozeId);
        }

        String missedSummary = "Missed · Auto-stopped after "
            + SanctuaryNotificationHelper.MAX_AUTO_SNOOZES
            + " snoozes"
            + (body != null && !body.trim().isEmpty() ? (" · " + body.trim()) : "");

        try {
            androidx.core.app.NotificationManagerCompat.from(context).notify(
                notifId,
                SanctuaryNotificationHelper.buildPlaybackNotification(
                    context,
                    notifId,
                    scheduleId,
                    kind,
                    entityId,
                    title,
                    missedSummary,
                    route,
                    5,
                    false,
                    false
                )
            );
        } catch (Exception ignored) {}

        try {
            JSONObject ev = new JSONObject();
            ev.put("type", "auto_stopped");
            ev.put("scheduleId", scheduleId);
            ev.put("notifId", notifId);
            ev.put("kind", kind);
            ev.put("entityId", entityId);
            ev.put("title", title);
            ev.put("body", body);
            ev.put("route", route);
            ev.put("autoSnoozeCount", SanctuaryNotificationHelper.MAX_AUTO_SNOOZES);
            if (!SanctuaryAudioPlugin.emitEventToJs("nativeAlertEvent", ev)) {
                SanctuaryScheduleStore.queuePendingEvent(context, ev);
            }
        } catch (Exception ignored) {}
    }

    public static void performDismiss(
        Context context,
        String scheduleId,
        int notifId,
        String kind,
        String entityId,
        String title,
        String body,
        String route
    ) {
        stopServiceAndClearNotif(context, notifId);
        if (!scheduleId.isEmpty()) {
            String snoozeId = scheduleId + ":snooze";
            SanctuaryScheduleStore.removeScheduleById(context, snoozeId);
        }

        try {
            JSONObject ev = new JSONObject();
            ev.put("type", "dismiss");
            ev.put("scheduleId", scheduleId);
            ev.put("notifId", notifId);
            ev.put("kind", kind);
            ev.put("entityId", entityId);
            ev.put("title", title);
            ev.put("body", body);
            ev.put("route", route);
            if (!SanctuaryAudioPlugin.emitEventToJs("nativeAlertEvent", ev)) {
                SanctuaryScheduleStore.queuePendingEvent(context, ev);
            }
        } catch (Exception ignored) {}
    }

    private static void stopServiceAndClearNotif(Context context, int notifId) {
        try {
            Intent stopIntent = new Intent(context, SanctuaryRingtoneService.class);
            stopIntent.setAction(SanctuaryRingtoneService.ACTION_STOP);
            context.stopService(stopIntent);
        } catch (Exception ignored) {}
        SanctuaryNotificationHelper.cancelNotification(context, notifId);
    }

    private static String nonNull(String val, String fallback) {
        return val != null ? val : fallback;
    }
}
