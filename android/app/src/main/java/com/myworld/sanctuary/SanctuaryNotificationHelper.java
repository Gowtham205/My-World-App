package com.myworld.sanctuary;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.Calendar;
import org.json.JSONArray;
import org.json.JSONObject;

public final class SanctuaryNotificationHelper {
    public static final String CHANNEL_ALARMS = "sanctuary_alarms_v2";
    public static final String CHANNEL_REMINDERS = "sanctuary_reminders_v2";
    public static final String CHANNEL_CALM = "sanctuary_calm_v2";

    public static final String EXTRA_SCHEDULE_ID = "sanctuary_schedule_id";
    public static final String EXTRA_NOTIF_ID = "sanctuary_notif_id";
    public static final String EXTRA_KIND = "sanctuary_kind";
    public static final String EXTRA_ENTITY_ID = "sanctuary_entity_id";
    public static final String EXTRA_TITLE = "sanctuary_title";
    public static final String EXTRA_BODY = "sanctuary_body";
    public static final String EXTRA_SOUND_ID = "sanctuary_sound_id";
    public static final String EXTRA_SOUND_PATH = "sanctuary_sound_path";
    public static final String EXTRA_SOUND_NAME = "sanctuary_sound_name";
    public static final String EXTRA_ROUTE = "sanctuary_route";
    public static final String EXTRA_SNOOZE_MINUTES = "sanctuary_snooze_minutes";
    public static final String EXTRA_ACTION_TYPE = "sanctuary_action_type";
    public static final String EXTRA_IS_REPEATING = "sanctuary_is_repeating";
    public static final String EXTRA_AUTO_SNOOZE_COUNT = "sanctuary_auto_snooze_count";

    public static final int MAX_AUTO_SNOOZES = 5;

    public static final String ACTION_SNOOZE = "com.myworld.sanctuary.ACTION_SNOOZE";
    public static final String ACTION_DISMISS = "com.myworld.sanctuary.ACTION_DISMISS";

    private SanctuaryNotificationHelper() {}

    public static void ensureChannels(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = context.getSystemService(NotificationManager.class);
        if (nm == null) return;

        // Channels have silent system sound because SanctuaryRingtoneService plays audio
        // via MediaPlayer on USAGE_MEDIA so volume aligns with hardware volume buttons.
        NotificationChannel alarms = new NotificationChannel(
            CHANNEL_ALARMS,
            "My World Alarms",
            NotificationManager.IMPORTANCE_HIGH
        );
        alarms.setDescription("High-priority alarms and task-linked alarms.");
        alarms.enableVibration(true);
        alarms.setSound(null, null);
        alarms.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        nm.createNotificationChannel(alarms);

        NotificationChannel reminders = new NotificationChannel(
            CHANNEL_REMINDERS,
            "My World Smart Reminders",
            NotificationManager.IMPORTANCE_HIGH
        );
        reminders.setDescription("Scheduled task reminder alerts.");
        reminders.enableVibration(true);
        reminders.setSound(null, null);
        reminders.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        nm.createNotificationChannel(reminders);

        NotificationChannel calm = new NotificationChannel(
            CHANNEL_CALM,
            "Event Calm Check-Ins",
            NotificationManager.IMPORTANCE_HIGH
        );
        calm.setDescription("Scheduled Event Calm grounding prompt notifications.");
        calm.enableVibration(true);
        calm.setSound(null, null);
        calm.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        nm.createNotificationChannel(calm);
    }

    public static Notification buildPlaybackNotification(
        Context context,
        int notifId,
        String scheduleId,
        String kind,
        String entityId,
        String title,
        String body,
        String route,
        int snoozeMinutes,
        boolean ongoing,
        boolean showPlayingSymbol
    ) {
        ensureChannels(context);

        String channelId = CHANNEL_REMINDERS;
        if ("alarm".equals(kind)) {
            channelId = CHANNEL_ALARMS;
        } else if ("calm".equals(kind)) {
            channelId = CHANNEL_CALM;
        }

        String displayTitle = showPlayingSymbol ? ("\u25B6 " + title) : title;
        String cleanBody = body != null ? body.trim() : "";

        // Tapping notification body opens the app at the target route
        Intent tapIntent = new Intent(context, MainActivity.class);
        tapIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        tapIntent.putExtra(EXTRA_ROUTE, route != null ? route : "home");
        int contentFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            contentFlags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent contentPi = PendingIntent.getActivity(context, notifId, tapIntent, contentFlags);

        boolean isAlarmCategory = "alarm".equals(kind) || "calm".equals(kind);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, channelId)
            .setSmallIcon(R.drawable.ic_stat_sanctuary)
            .setColor(Color.parseColor("#9EC5AB"))
            .setContentTitle(displayTitle)
            .setContentText(cleanBody.isEmpty() ? "My World" : cleanBody)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(isAlarmCategory ? NotificationCompat.CATEGORY_ALARM : NotificationCompat.CATEGORY_REMINDER)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(ongoing)
            .setAutoCancel(!ongoing)
            .setOnlyAlertOnce(true)
            .setContentIntent(contentPi);

        if (!cleanBody.isEmpty()) {
            builder.setStyle(new NotificationCompat.BigTextStyle().bigText(cleanBody));
        }

        // Action buttons use PendingIntent.getBroadcast so tapping Snooze/Dismiss works
        // directly from the notification drawer WITHOUT opening the app!
        int broadcastFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            broadcastFlags |= PendingIntent.FLAG_IMMUTABLE;
        }

        if ("alarm".equals(kind) || "reminder".equals(kind) || "calm".equals(kind)) {
            int safeSnooze = snoozeMinutes > 0 ? snoozeMinutes : 5;
            Intent snoozeIntent = new Intent(context, SanctuaryActionReceiver.class);
            snoozeIntent.setAction(ACTION_SNOOZE);
            snoozeIntent.putExtra(EXTRA_ACTION_TYPE, "snooze");
            snoozeIntent.putExtra(EXTRA_SCHEDULE_ID, scheduleId);
            snoozeIntent.putExtra(EXTRA_NOTIF_ID, notifId);
            snoozeIntent.putExtra(EXTRA_KIND, kind);
            snoozeIntent.putExtra(EXTRA_ENTITY_ID, entityId);
            snoozeIntent.putExtra(EXTRA_TITLE, title);
            snoozeIntent.putExtra(EXTRA_BODY, cleanBody);
            snoozeIntent.putExtra(EXTRA_ROUTE, route);
            snoozeIntent.putExtra(EXTRA_SNOOZE_MINUTES, safeSnooze);
            PendingIntent snoozePi = PendingIntent.getBroadcast(
                context,
                notifId * 31 + 1,
                snoozeIntent,
                broadcastFlags
            );
            builder.addAction(0, "Snooze " + safeSnooze + "m", snoozePi);

            Intent dismissIntent = new Intent(context, SanctuaryActionReceiver.class);
            dismissIntent.setAction(ACTION_DISMISS);
            dismissIntent.putExtra(EXTRA_ACTION_TYPE, "dismiss");
            dismissIntent.putExtra(EXTRA_SCHEDULE_ID, scheduleId);
            dismissIntent.putExtra(EXTRA_NOTIF_ID, notifId);
            dismissIntent.putExtra(EXTRA_KIND, kind);
            dismissIntent.putExtra(EXTRA_ENTITY_ID, entityId);
            dismissIntent.putExtra(EXTRA_TITLE, title);
            dismissIntent.putExtra(EXTRA_BODY, cleanBody);
            dismissIntent.putExtra(EXTRA_ROUTE, route);
            PendingIntent dismissPi = PendingIntent.getBroadcast(
                context,
                notifId * 31 + 2,
                dismissIntent,
                broadcastFlags
            );
            builder.addAction(0, "Dismiss", dismissPi);
        } else {
            Intent dismissIntent = new Intent(context, SanctuaryActionReceiver.class);
            dismissIntent.setAction(ACTION_DISMISS);
            dismissIntent.putExtra(EXTRA_ACTION_TYPE, "dismiss");
            dismissIntent.putExtra(EXTRA_SCHEDULE_ID, scheduleId);
            dismissIntent.putExtra(EXTRA_NOTIF_ID, notifId);
            dismissIntent.putExtra(EXTRA_KIND, kind);
            dismissIntent.putExtra(EXTRA_ENTITY_ID, entityId);
            dismissIntent.putExtra(EXTRA_TITLE, title);
            dismissIntent.putExtra(EXTRA_BODY, cleanBody);
            dismissIntent.putExtra(EXTRA_ROUTE, route);
            PendingIntent dismissPi = PendingIntent.getBroadcast(
                context,
                notifId * 31 + 2,
                dismissIntent,
                broadcastFlags
            );
            builder.addAction(0, "Got it", dismissPi);
        }

        return builder.build();
    }

    public static void cancelNotification(Context context, int notifId) {
        NotificationManagerCompat.from(context).cancel(notifId);
    }

    public static PendingIntent buildAlarmTriggerPendingIntent(Context context, JSONObject schedule) {
        int notifId = schedule.optInt("notifId", schedule.optString("id").hashCode());
        Intent intent = new Intent(context, SanctuaryAlarmReceiver.class);
        intent.putExtra(EXTRA_SCHEDULE_ID, schedule.optString("id"));
        intent.putExtra(EXTRA_NOTIF_ID, notifId);
        intent.putExtra(EXTRA_KIND, schedule.optString("kind", "alarm"));
        intent.putExtra(EXTRA_ENTITY_ID, schedule.optString("entityId", ""));
        intent.putExtra(EXTRA_TITLE, schedule.optString("title", "My World"));
        intent.putExtra(EXTRA_BODY, schedule.optString("body", ""));
        intent.putExtra(EXTRA_SOUND_ID, schedule.optString("soundId", "builtin:sanctuary-chime"));
        intent.putExtra(EXTRA_SOUND_PATH, schedule.optString("soundPath", ""));
        intent.putExtra(EXTRA_SOUND_NAME, schedule.optString("soundName", "Sanctuary Chime"));
        intent.putExtra(EXTRA_ROUTE, schedule.optString("route", "alarms"));
        intent.putExtra(EXTRA_SNOOZE_MINUTES, schedule.optInt("snoozeMinutes", 5));
        intent.putExtra(EXTRA_IS_REPEATING, schedule.optBoolean("repeating", false));
        intent.putExtra(EXTRA_AUTO_SNOOZE_COUNT, schedule.optInt("autoSnoozeCount", 0));

        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        return PendingIntent.getBroadcast(context, notifId, intent, flags);
    }

    public static void scheduleTrigger(Context context, JSONObject schedule) {
        long triggerAtMs = schedule.optLong("triggerAtMs", 0L);
        if (triggerAtMs <= System.currentTimeMillis() + 500L) return;

        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;

        PendingIntent pi = buildAlarmTriggerPendingIntent(context, schedule);
        String kind = schedule.optString("kind", "alarm");
        boolean canExact = Build.VERSION.SDK_INT < Build.VERSION_CODES.S || am.canScheduleExactAlarms();

        try {
            if (("alarm".equals(kind) || "calm".equals(kind)) && canExact) {
                Intent showIntent = new Intent(context, MainActivity.class);
                showIntent.putExtra(EXTRA_ROUTE, schedule.optString("route", "calm".equals(kind) ? "events" : "alarms"));
                int showFlags = PendingIntent.FLAG_UPDATE_CURRENT;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    showFlags |= PendingIntent.FLAG_IMMUTABLE;
                }
                PendingIntent showPi = PendingIntent.getActivity(
                    context,
                    schedule.optInt("notifId", 9001),
                    showIntent,
                    showFlags
                );
                AlarmManager.AlarmClockInfo info = new AlarmManager.AlarmClockInfo(triggerAtMs, showPi);
                am.setAlarmClock(info, pi);
                return;
            }
            if (canExact) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMs, pi);
                } else {
                    am.setExact(AlarmManager.RTC_WAKEUP, triggerAtMs, pi);
                }
                return;
            }
        } catch (SecurityException ignored) {
            // Fall back to inexact allowWhileIdle below
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMs, pi);
        } else {
            am.set(AlarmManager.RTC_WAKEUP, triggerAtMs, pi);
        }
    }

    public static void cancelTriggerByNotifId(Context context, int notifId) {
        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        Intent intent = new Intent(context, SanctuaryAlarmReceiver.class);
        int flags = PendingIntent.FLAG_NO_CREATE;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent pi = PendingIntent.getBroadcast(context, notifId, intent, flags);
        if (pi != null) {
            am.cancel(pi);
            pi.cancel();
        }
    }

    public static void cancelAllRegisteredTriggers(Context context) {
        JSONArray current = SanctuaryScheduleStore.getSchedules(context);
        for (int i = 0; i < current.length(); i++) {
            JSONObject item = current.optJSONObject(i);
            if (item == null) continue;
            int notifId = item.optInt("notifId", item.optString("id").hashCode());
            cancelTriggerByNotifId(context, notifId);
        }
    }

    public static void rescheduleAllFromStore(Context context) {
        JSONArray schedules = SanctuaryScheduleStore.getSchedules(context);
        long now = System.currentTimeMillis();
        for (int i = 0; i < schedules.length(); i++) {
            JSONObject item = schedules.optJSONObject(i);
            if (item == null) continue;
            long triggerAt = item.optLong("triggerAtMs", 0L);
            if (triggerAt > now + 1000L) {
                scheduleTrigger(context, item);
            } else if (item.optBoolean("repeating", false)) {
                long next = computeNextOccurrenceMs(item, now);
                if (next > now + 1000L) {
                    try {
                        item.put("triggerAtMs", next);
                        SanctuaryScheduleStore.upsertSchedule(context, item);
                        scheduleTrigger(context, item);
                    } catch (Exception ignored) {}
                }
            }
        }
    }

    public static long computeNextOccurrenceMs(JSONObject schedule, long afterMs) {
        String hhmm = schedule.optString("hhmm", "");
        JSONArray repeatDays = schedule.optJSONArray("repeatDays");
        if (hhmm.isEmpty() || repeatDays == null || repeatDays.length() == 0) return -1L;
        String[] parts = hhmm.split(":");
        if (parts.length != 2) return -1L;
        int hour;
        int minute;
        try {
            hour = Integer.parseInt(parts[0]);
            minute = Integer.parseInt(parts[1]);
        } catch (NumberFormatException e) {
            return -1L;
        }

        Calendar cal = Calendar.getInstance();
        cal.setTimeInMillis(afterMs + 60_000L);
        cal.set(Calendar.SECOND, 0);
        cal.set(Calendar.MILLISECOND, 0);
        cal.set(Calendar.HOUR_OF_DAY, hour);
        cal.set(Calendar.MINUTE, minute);
        if (cal.getTimeInMillis() <= afterMs + 30_000L) {
            cal.add(Calendar.DAY_OF_MONTH, 1);
        }

        for (int offset = 0; offset < 8; offset++) {
            int jsDay = cal.get(Calendar.DAY_OF_WEEK) - 1; // 0=Sun..6=Sat
            for (int i = 0; i < repeatDays.length(); i++) {
                if (repeatDays.optInt(i, -1) == jsDay) {
                    return cal.getTimeInMillis();
                }
            }
            cal.add(Calendar.DAY_OF_MONTH, 1);
        }
        return -1L;
    }

    /**
     * Resolves an audio file on disk inside context.getFilesDir():
     * uses uploaded custom file if available, otherwise synthesizes a rich,
     * loud built-in WAV tone (0.88 peak amplitude) once and caches it.
     */
    public static File resolveOrBuildAudioFile(Context context, String soundId, String soundPath) {
        if (soundPath != null && !soundPath.isEmpty()) {
            File custom = new File(context.getFilesDir(), soundPath);
            if (custom.exists() && custom.length() > 0) {
                return custom;
            }
        }

        String normalizedId = (soundId != null && !soundId.isEmpty())
            ? soundId
            : "builtin:sanctuary-chime";

        File tonesDir = new File(context.getFilesDir(), "sanctuary_tones");
        if (!tonesDir.exists()) {
            //noinspection ResultOfMethodCallIgnored
            tonesDir.mkdirs();
        }

        String safeName = normalizedId.replaceAll("[^a-zA-Z0-9_-]", "_") + "_v2.wav";
        File wavFile = new File(tonesDir, safeName);
        if (wavFile.exists() && wavFile.length() > 1024) {
            return wavFile;
        }

        try {
            writeLoudBuiltinWav(wavFile, normalizedId);
            return wavFile;
        } catch (Exception e) {
            return null;
        }
    }

    private static void writeLoudBuiltinWav(File target, String soundId) throws Exception {
        final int sampleRate = 22050;
        final double durationSec = 2.6;
        final int numSamples = (int) (sampleRate * durationSec);
        final int dataBytes = numSamples * 2;
        byte[] wav = new byte[44 + dataBytes];
        ByteBuffer buf = ByteBuffer.wrap(wav).order(ByteOrder.LITTLE_ENDIAN);

        buf.put(new byte[] { 'R', 'I', 'F', 'F' });
        buf.putInt(36 + dataBytes);
        buf.put(new byte[] { 'W', 'A', 'V', 'E' });
        buf.put(new byte[] { 'f', 'm', 't', ' ' });
        buf.putInt(16);
        buf.putShort((short) 1);
        buf.putShort((short) 1);
        buf.putInt(sampleRate);
        buf.putInt(sampleRate * 2);
        buf.putShort((short) 2);
        buf.putShort((short) 16);
        buf.put(new byte[] { 'd', 'a', 't', 'a' });
        buf.putInt(dataBytes);

        final double[] notes;
        final boolean triangle;
        final double peakAmp;
        if ("builtin:calm-chime".equals(soundId)) {
            notes = new double[] { 432.0, 540.0, 648.0 };
            triangle = false;
            peakAmp = 0.78;
        } else if ("builtin:sunrise-harp".equals(soundId)) {
            notes = new double[] { 392.0, 493.88, 587.33, 783.99 };
            triangle = true;
            peakAmp = 0.86;
        } else {
            notes = new double[] { 523.25, 659.25, 783.99, 1046.5 };
            triangle = false;
            peakAmp = 0.88;
        }

        for (int i = 0; i < numSamples; i++) {
            double t = (double) i / sampleRate;
            double sample = 0.0;
            for (int n = 0; n < notes.length; n++) {
                double localT = t - (n * 0.19);
                if (localT >= 0.0 && localT <= 1.65) {
                    double attack = Math.min(1.0, localT / 0.035);
                    double decay = Math.exp(-localT * 2.1);
                    double phase = notes[n] * localT;
                    double fundamental = triangle
                        ? (2.0 * Math.abs(2.0 * (phase - Math.floor(phase + 0.5))) - 1.0)
                        : Math.sin(2.0 * Math.PI * phase);
                    double overtone = 0.28 * Math.sin(2.0 * Math.PI * (notes[n] * 2.0) * localT);
                    sample += (fundamental + overtone) * attack * decay * (peakAmp * 0.52);
                }
            }
            double clamped = Math.max(-0.96, Math.min(0.96, sample));
            buf.putShort((short) Math.round(clamped * 32767.0));
        }

        try (FileOutputStream fos = new FileOutputStream(target)) {
            fos.write(wav);
            fos.flush();
        }
    }
}
