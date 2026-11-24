package com.myworld.sanctuary;

import android.app.AlarmManager;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.media.MediaScannerConnection;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.provider.MediaStore;
import android.provider.Settings;
import android.util.Base64;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.lang.ref.WeakReference;
import java.nio.charset.StandardCharsets;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

@CapacitorPlugin(name = "SanctuaryAudio")
public class SanctuaryAudioPlugin extends Plugin {
    private static WeakReference<SanctuaryAudioPlugin> activeInstance = new WeakReference<>(null);
    private static volatile String pendingRouteIntent = null;

    private MediaPlayer chimePlayer;
    private AudioFocusRequest chimeFocusRequest;
    private final Handler chimeHandler = new Handler(Looper.getMainLooper());
    private Runnable chimeStopRunnable;

    @Override
    public void load() {
        super.load();
        activeInstance = new WeakReference<>(this);
        SanctuaryNotificationHelper.ensureChannels(getContext());
        if (pendingRouteIntent != null && !pendingRouteIntent.isEmpty()) {
            String route = pendingRouteIntent;
            pendingRouteIntent = null;
            JSObject payload = new JSObject();
            payload.put("route", route);
            notifyListeners("routeIntent", payload, true);
        }
    }

    @Override
    protected void handleOnDestroy() {
        stopChimeInternal();
        SanctuaryAudioPlugin current = activeInstance.get();
        if (current == this) {
            activeInstance = new WeakReference<>(null);
        }
        super.handleOnDestroy();
    }

    public static boolean emitEventToJs(String eventName, JSONObject data) {
        SanctuaryAudioPlugin instance = activeInstance.get();
        if (instance == null || !instance.hasListeners(eventName)) {
            return false;
        }
        try {
            JSObject jsObj = JSObject.fromJSONObject(data);
            instance.notifyListeners(eventName, jsObj, false);
            return true;
        } catch (JSONException e) {
            return false;
        }
    }

    public static void emitRouteToJs(String route) {
        if (route == null || route.isEmpty()) return;
        SanctuaryAudioPlugin instance = activeInstance.get();
        if (instance == null) {
            pendingRouteIntent = route;
            return;
        }
        JSObject payload = new JSObject();
        payload.put("route", route);
        instance.notifyListeners("routeIntent", payload, true);
    }

    @PluginMethod
    public void syncSchedules(PluginCall call) {
        Context context = getContext();
        SanctuaryNotificationHelper.ensureChannels(context);
        SanctuaryNotificationHelper.cancelAllRegisteredTriggers(context);

        JSArray input = call.getArray("schedules");
        JSONArray stored = new JSONArray();
        long now = System.currentTimeMillis();

        if (input != null) {
            for (int i = 0; i < input.length(); i++) {
                JSONObject item = input.optJSONObject(i);
                if (item == null) continue;
                stored.put(item);
                if (item.optLong("triggerAtMs", 0L) > now + 500L) {
                    SanctuaryNotificationHelper.scheduleTrigger(context, item);
                }
            }
        }

        SanctuaryScheduleStore.saveSchedules(context, stored);
        JSObject res = new JSObject();
        res.put("scheduledCount", stored.length());
        call.resolve(res);
    }

    @PluginMethod
    public void startRingtone(PluginCall call) {
        Context context = getContext();
        String scheduleId = call.getString("scheduleId", "manual");
        int notifId = call.getInt("notifId", 88001);
        String kind = call.getString("kind", "alarm");
        String entityId = call.getString("entityId", "");
        String title = call.getString("title", "My World");
        String body = call.getString("body", "");
        String soundId = call.getString("soundId", "builtin:sanctuary-chime");
        String soundPath = call.getString("soundPath", "");
        String soundName = call.getString("soundName", "Sanctuary Chime");
        String route = call.getString("route", "alarms");
        int snoozeMinutes = call.getInt("snoozeMinutes", 5);
        int autoSnoozeCount = call.getInt("autoSnoozeCount", 0);
        boolean isTest = Boolean.TRUE.equals(call.getBoolean("isTest", false));
        String slotKey = call.getString("slotKey", "");

        if (!isTest && slotKey != null && !slotKey.isEmpty()) {
            if (!SanctuaryScheduleStore.tryClaimSlot(context, slotKey)) {
                JSObject skipped = new JSObject();
                skipped.put("started", false);
                skipped.put("reason", "already_claimed");
                call.resolve(skipped);
                return;
            }
        }

        stopChimeInternal();

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
        serviceIntent.putExtra(SanctuaryNotificationHelper.EXTRA_AUTO_SNOOZE_COUNT, autoSnoozeCount);

        boolean isAlarmLike = "alarm".equals(kind) || "calm".equals(kind);

        try {
            ContextCompat.startForegroundService(context, serviceIntent);
        } catch (Exception e) {
            NotificationManagerCompat.from(context).notify(
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
                    isAlarmLike,
                    true
                )
            );
        }

        JSObject res = new JSObject();
        res.put("started", true);
        call.resolve(res);
    }

    @PluginMethod
    public void stopRingtone(PluginCall call) {
        Context context = getContext();
        Integer notifId = call.getInt("notifId");
        try {
            Intent stopIntent = new Intent(context, SanctuaryRingtoneService.class);
            stopIntent.setAction(SanctuaryRingtoneService.ACTION_STOP);
            context.stopService(stopIntent);
        } catch (Exception ignored) {}

        if (notifId != null) {
            SanctuaryNotificationHelper.cancelNotification(context, notifId);
        }
        call.resolve();
    }

    @PluginMethod
    public void playChime(PluginCall call) {
        String soundId = call.getString("soundId", "builtin:calm-chime");
        String soundPath = call.getString("soundPath", "");
        int maxMs = call.getInt("maxMs", 9500);
        if (maxMs <= 0) maxMs = 9500;

        final int safeMaxMs = Math.min(maxMs, 30000);
        final Context context = getContext();

        chimeHandler.post(() -> {
            stopChimeInternal();

            AudioManager audioManager = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
            AudioAttributes attrs = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_MEDIA)
                .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                .build();

            if (audioManager != null) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    chimeFocusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
                        .setAudioAttributes(attrs)
                        .build();
                    audioManager.requestAudioFocus(chimeFocusRequest);
                } else {
                    @SuppressWarnings("deprecation")
                    int ignored = audioManager.requestAudioFocus(null, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK);
                }
            }

            try {
                chimePlayer = new MediaPlayer();
                chimePlayer.setAudioAttributes(attrs);
                File audioFile = SanctuaryNotificationHelper.resolveOrBuildAudioFile(context, soundId, soundPath);
                if (audioFile != null && audioFile.exists()) {
                    chimePlayer.setDataSource(audioFile.getAbsolutePath());
                } else {
                    Uri fallback = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
                    if (fallback != null) {
                        chimePlayer.setDataSource(context, fallback);
                    }
                }
                chimePlayer.setLooping(false);
                chimePlayer.setVolume(1.0f, 1.0f);
                chimePlayer.setOnCompletionListener(mp -> stopChimeInternal());
                chimePlayer.prepare();
                chimePlayer.start();

                chimeStopRunnable = this::stopChimeInternal;
                chimeHandler.postDelayed(chimeStopRunnable, safeMaxMs);
            } catch (Exception e) {
                stopChimeInternal();
            }
        });

        call.resolve();
    }

    @PluginMethod
    public void stopChime(PluginCall call) {
        chimeHandler.post(this::stopChimeInternal);
        call.resolve();
    }

    private void stopChimeInternal() {
        if (chimeStopRunnable != null) {
            chimeHandler.removeCallbacks(chimeStopRunnable);
            chimeStopRunnable = null;
        }
        if (chimePlayer != null) {
            try {
                if (chimePlayer.isPlaying()) {
                    chimePlayer.stop();
                }
            } catch (Exception ignored) {}
            try {
                chimePlayer.release();
            } catch (Exception ignored) {}
            chimePlayer = null;
        }
        AudioManager audioManager = getContext() != null
            ? (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE)
            : null;
        if (audioManager != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && chimeFocusRequest != null) {
            try {
                audioManager.abandonAudioFocusRequest(chimeFocusRequest);
            } catch (Exception ignored) {}
            chimeFocusRequest = null;
        }
    }

    @PluginMethod
    public void tryClaimSlot(PluginCall call) {
        String slotKey = call.getString("slotKey", "");
        boolean claimed = SanctuaryScheduleStore.tryClaimSlot(getContext(), slotKey);
        JSObject res = new JSObject();
        res.put("claimed", claimed);
        call.resolve(res);
    }

    @PluginMethod
    public void drainPendingEvents(PluginCall call) {
        JSONArray events = SanctuaryScheduleStore.drainPendingEvents(getContext());
        JSObject res = new JSObject();
        try {
            res.put("events", new JSArray(events.toString()));
        } catch (Exception e) {
            res.put("events", new JSArray());
        }
        if (pendingRouteIntent != null && !pendingRouteIntent.isEmpty()) {
            res.put("pendingRoute", pendingRouteIntent);
            pendingRouteIntent = null;
        }
        call.resolve(res);
    }

    @PluginMethod
    public void getAudioDiagnostics(PluginCall call) {
        Context context = getContext();
        AudioManager am = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);

        int mediaVolume = am != null ? am.getStreamVolume(AudioManager.STREAM_MUSIC) : 0;
        int mediaMaxVolume = am != null ? am.getStreamMaxVolume(AudioManager.STREAM_MUSIC) : 15;
        boolean canExactAlarms = Build.VERSION.SDK_INT < Build.VERSION_CODES.S
            || (alarmManager != null && alarmManager.canScheduleExactAlarms());
        boolean notificationsEnabled = NotificationManagerCompat.from(context).areNotificationsEnabled();

        JSObject res = new JSObject();
        res.put("mediaVolume", mediaVolume);
        res.put("mediaMaxVolume", mediaMaxVolume);
        res.put("canExactAlarms", canExactAlarms);
        res.put("notificationsEnabled", notificationsEnabled);
        call.resolve(res);
    }

    @PluginMethod
    public void openExactAlarmSettings(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            try {
                Intent intent = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM);
                intent.setData(Uri.parse("package:" + getContext().getPackageName()));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent);
            } catch (Exception ignored) {}
        }
        call.resolve();
    }

    @PluginMethod
    public void exportToDeviceStorage(PluginCall call) {
        Context context = getContext();
        String filename = sanitizeFilename(call.getString("filename", "my-world-file"));
        String mimeType = call.getString("mimeType", "application/octet-stream");
        String folderType = call.getString("folderType", "document");
        String sourcePath = call.getString("sourcePath", "");
        String base64Data = call.getString("base64Data", "");
        String textContent = call.getString("textContent", null);

        try {
            byte[] directBytes = null;
            File sourceFile = null;

            if (sourcePath != null && !sourcePath.isEmpty()) {
                File filesRoot = context.getFilesDir().getCanonicalFile();
                File candidate = new File(filesRoot, sourcePath).getCanonicalFile();
                if (!candidate.getPath().startsWith(filesRoot.getPath() + File.separator)) {
                    call.reject("Invalid internal source path.");
                    return;
                }
                if (!candidate.exists() || !candidate.isFile()) {
                    call.reject("Source file not found in app storage.");
                    return;
                }
                sourceFile = candidate;
            } else if (textContent != null) {
                directBytes = textContent.getBytes(StandardCharsets.UTF_8);
            } else if (base64Data != null && !base64Data.isEmpty()) {
                String cleanB64 = base64Data.contains(",") ? base64Data.substring(base64Data.indexOf(',') + 1) : base64Data;
                directBytes = Base64.decode(cleanB64, Base64.DEFAULT);
            } else {
                call.reject("No file content provided to export.");
                return;
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                String relativeDir;
                Uri collection;
                if ("image".equals(folderType)) {
                    relativeDir = Environment.DIRECTORY_PICTURES + "/MyWorld";
                    collection = MediaStore.Images.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY);
                } else if ("video".equals(folderType)) {
                    relativeDir = Environment.DIRECTORY_MOVIES + "/MyWorld";
                    collection = MediaStore.Video.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY);
                } else if ("backup".equals(folderType)) {
                    relativeDir = Environment.DIRECTORY_DOWNLOADS + "/MyWorld";
                    collection = MediaStore.Downloads.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY);
                } else {
                    relativeDir = Environment.DIRECTORY_DOCUMENTS + "/MyWorld";
                    collection = MediaStore.Files.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY);
                }

                ContentValues values = new ContentValues();
                values.put(MediaStore.MediaColumns.DISPLAY_NAME, filename);
                values.put(MediaStore.MediaColumns.MIME_TYPE, mimeType);
                values.put(MediaStore.MediaColumns.RELATIVE_PATH, relativeDir);
                values.put(MediaStore.MediaColumns.IS_PENDING, 1);

                ContentResolver resolver = context.getContentResolver();
                Uri insertedUri = resolver.insert(collection, values);
                if (insertedUri == null) {
                    call.reject("Android MediaStore refused to create destination file.");
                    return;
                }

                try (OutputStream out = resolver.openOutputStream(insertedUri)) {
                    if (out == null) {
                        resolver.delete(insertedUri, null, null);
                        call.reject("Could not open output stream for export.");
                        return;
                    }
                    if (sourceFile != null) {
                        copyFileToStream(sourceFile, out);
                    } else {
                        out.write(directBytes);
                        out.flush();
                    }
                } catch (Exception writeEx) {
                    resolver.delete(insertedUri, null, null);
                    throw writeEx;
                }

                ContentValues publishValues = new ContentValues();
                publishValues.put(MediaStore.MediaColumns.IS_PENDING, 0);
                resolver.update(insertedUri, publishValues, null, null);

                JSObject res = new JSObject();
                res.put("ok", true);
                res.put("uri", insertedUri.toString());
                res.put("displayPath", "Internal Storage/" + relativeDir + "/" + filename);
                call.resolve(res);
                return;
            }

            // Legacy Android (API 24-28)
            String envDir = Environment.DIRECTORY_DOWNLOADS;
            if ("image".equals(folderType)) envDir = Environment.DIRECTORY_PICTURES;
            else if ("video".equals(folderType)) envDir = Environment.DIRECTORY_MOVIES;
            else if ("document".equals(folderType)) envDir = Environment.DIRECTORY_DOCUMENTS;

            File root = Environment.getExternalStoragePublicDirectory(envDir);
            File targetDir = new File(root, "MyWorld");
            if (!targetDir.exists()) {
                //noinspection ResultOfMethodCallIgnored
                targetDir.mkdirs();
            }
            File dest = makeUniqueFile(targetDir, filename);
            try (FileOutputStream fos = new FileOutputStream(dest)) {
                if (sourceFile != null) {
                    copyFileToStream(sourceFile, fos);
                } else {
                    fos.write(directBytes);
                    fos.flush();
                }
            }

            MediaScannerConnection.scanFile(
                context,
                new String[] { dest.getAbsolutePath() },
                new String[] { mimeType },
                null
            );

            JSObject res = new JSObject();
            res.put("ok", true);
            res.put("uri", Uri.fromFile(dest).toString());
            res.put("displayPath", dest.getAbsolutePath());
            call.resolve(res);
        } catch (Exception e) {
            call.reject("Export failed: " + e.getMessage());
        }
    }

    private static void copyFileToStream(File sourceFile, OutputStream out) throws Exception {
        byte[] buffer = new byte[64 * 1024];
        try (InputStream in = new FileInputStream(sourceFile)) {
            int read;
            while ((read = in.read(buffer)) != -1) {
                out.write(buffer, 0, read);
            }
            out.flush();
        }
    }

    private static String sanitizeFilename(String raw) {
        if (raw == null || raw.trim().isEmpty()) return "my-world-file";
        return raw.trim().replaceAll("[\\\\/:*?\"<>|]", "_");
    }

    private static File makeUniqueFile(File dir, String filename) {
        File candidate = new File(dir, filename);
        if (!candidate.exists()) return candidate;
        int dot = filename.lastIndexOf('.');
        String base = dot > 0 ? filename.substring(0, dot) : filename;
        String ext = dot > 0 ? filename.substring(dot) : "";
        for (int i = 1; i < 1000; i++) {
            File alt = new File(dir, base + " (" + i + ")" + ext);
            if (!alt.exists()) return alt;
        }
        return new File(dir, System.currentTimeMillis() + "_" + filename);
    }
}
