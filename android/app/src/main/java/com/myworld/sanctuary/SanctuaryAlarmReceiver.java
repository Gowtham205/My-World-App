package com.myworld.sanctuary;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import androidx.core.content.ContextCompat;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import org.json.JSONObject;

public class SanctuaryAlarmReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;

        String scheduleId = intent.getStringExtra(SanctuaryNotificationHelper.EXTRA_SCHEDULE_ID);
        if (scheduleId == null) scheduleId = "manual";
        int notifId = intent.getIntExtra(SanctuaryNotificationHelper.EXTRA_NOTIF_ID, 88001);
        String kind = intent.getStringExtra(SanctuaryNotificationHelper.EXTRA_KIND);
        if (kind == null) kind = "alarm";
        String entityId = intent.getStringExtra(SanctuaryNotificationHelper.EXTRA_ENTITY_ID);
        if (entityId == null) entityId = "";
        String title = intent.getStringExtra(SanctuaryNotificationHelper.EXTRA_TITLE);
        if (title == null) title = "My World";
        String body = intent.getStringExtra(SanctuaryNotificationHelper.EXTRA_BODY);
        if (body == null) body = "";
        String soundId = intent.getStringExtra(SanctuaryNotificationHelper.EXTRA_SOUND_ID);
        String soundPath = intent.getStringExtra(SanctuaryNotificationHelper.EXTRA_SOUND_PATH);
        String soundName = intent.getStringExtra(SanctuaryNotificationHelper.EXTRA_SOUND_NAME);
        String route = intent.getStringExtra(SanctuaryNotificationHelper.EXTRA_ROUTE);
        if (route == null) route = "alarms";
        int snoozeMinutes = intent.getIntExtra(SanctuaryNotificationHelper.EXTRA_SNOOZE_MINUTES, 5);

        long nowMs = System.currentTimeMillis();
        String minuteKey = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm", Locale.US).format(new Date(nowMs));
        String slotKey = kind + ":" + (!entityId.isEmpty() ? entityId : scheduleId) + ":" + minuteKey;

        // Deduplicate so background AlarmManager and foreground JS never double-fire
        if (!SanctuaryScheduleStore.tryClaimSlot(context, slotKey)) {
            return;
        }

        // If repeating, immediately schedule next occurrence
        JSONObject stored = SanctuaryScheduleStore.findScheduleById(context, scheduleId);
        if (stored != null && stored.optBoolean("repeating", false)) {
            long nextMs = SanctuaryNotificationHelper.computeNextOccurrenceMs(stored, nowMs);
            if (nextMs > nowMs + 1000L) {
                try {
                    stored.put("triggerAtMs", nextMs);
                    SanctuaryScheduleStore.upsertSchedule(context, stored);
                    SanctuaryNotificationHelper.scheduleTrigger(context, stored);
                } catch (Exception ignored) {}
            }
        }

        Intent serviceIntent = new Intent(context, SanctuaryRingtoneService.class);
        serviceIntent.setAction(SanctuaryRingtoneService.ACTION_START);
        serviceIntent.putExtra(SanctuaryNotificationHelper.EXTRA_SCHEDULE_ID, scheduleId);
        serviceIntent.putExtra(SanctuaryNotificationHelper.EXTRA_NOTIF_ID, notifId);
        serviceIntent.putExtra(SanctuaryNotificationHelper.EXTRA_KIND, kind);
        serviceIntent.putExtra(SanctuaryNotificationHelper.EXTRA_ENTITY_ID, entityId);
        serviceIntent.putExtra(SanctuaryNotificationHelper.EXTRA_TITLE, title);
        serviceIntent.putExtra(SanctuaryNotificationHelper.EXTRA_BODY, body);
        serviceIntent.putExtra(SanctuaryNotificationHelper.EXTRA_SOUND_ID, soundId);
        serviceIntent.putExtra(SanctuaryNotificationHelper.EXTRA_SOUND_PATH, soundPath);
        serviceIntent.putExtra(SanctuaryNotificationHelper.EXTRA_SOUND_NAME, soundName);
        serviceIntent.putExtra(SanctuaryNotificationHelper.EXTRA_ROUTE, route);
        serviceIntent.putExtra(SanctuaryNotificationHelper.EXTRA_SNOOZE_MINUTES, snoozeMinutes);

        try {
            ContextCompat.startForegroundService(context, serviceIntent);
        } catch (Exception e) {
            // Fallback: show notification immediately and trigger system ringtone if FGS start is restricted
            androidx.core.app.NotificationManagerCompat.from(context).notify(
                notifId,
                SanctuaryNotificationHelper.buildPlaybackNotification(
                    context,
                    notifId,
                    scheduleId,
                    kind,
                    entityId,
                    title,
                    body,
                    route,
                    snoozeMinutes,
                    "alarm".equals(kind),
                    true
                )
            );
            try {
                android.net.Uri uri = android.media.RingtoneManager.getDefaultUri(
                    "alarm".equals(kind)
                        ? android.media.RingtoneManager.TYPE_ALARM
                        : android.media.RingtoneManager.TYPE_NOTIFICATION
                );
                if (uri != null) {
                    android.media.Ringtone r = android.media.RingtoneManager.getRingtone(context, uri);
                    if (r != null) {
                        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.P) {
                            r.setAudioAttributes(
                                new android.media.AudioAttributes.Builder()
                                    .setUsage(android.media.AudioAttributes.USAGE_MEDIA)
                                    .setContentType(android.media.AudioAttributes.CONTENT_TYPE_MUSIC)
                                    .build()
                            );
                        }
                        r.play();
                    }
                }
            } catch (Exception ignored) {}
        }

        try {
            JSONObject ev = new JSONObject();
            ev.put("type", "fired");
            ev.put("scheduleId", scheduleId);
            ev.put("notifId", notifId);
            ev.put("kind", kind);
            ev.put("entityId", entityId);
            ev.put("title", title);
            ev.put("body", body);
            ev.put("soundId", soundId != null ? soundId : "");
            ev.put("soundName", soundName != null ? soundName : "");
            ev.put("route", route);
            ev.put("snoozeMinutes", snoozeMinutes);
            ev.put("minuteKey", minuteKey);
            ev.put("timestampMs", nowMs);

            if (!SanctuaryAudioPlugin.emitEventToJs("nativeAlertEvent", ev)) {
                SanctuaryScheduleStore.queuePendingEvent(context, ev);
            }
        } catch (Exception ignored) {}
    }
}
