package com.myworld.sanctuary;

import android.app.Notification;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import androidx.core.app.NotificationManagerCompat;
import java.io.File;
import org.json.JSONObject;

public class SanctuaryRingtoneService extends Service {
    public static final String ACTION_START = "com.myworld.sanctuary.RINGTONE_START";
    public static final String ACTION_STOP = "com.myworld.sanctuary.RINGTONE_STOP";

    private static final long ALARM_MAX_MS = 60_000L;
    private static final long REMINDER_MAX_MS = 10_000L;
    private static final long CALM_MAX_MS = 5_500L;

    private MediaPlayer mediaPlayer;
    private AudioManager audioManager;
    private AudioFocusRequest audioFocusRequest;
    private PowerManager.WakeLock wakeLock;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private Runnable autoStopRunnable;

    private String currentScheduleId = "";
    private int currentNotifId = 88001;
    private String currentKind = "alarm";
    private String currentEntityId = "";
    private String currentTitle = "My World";
    private String currentBody = "";
    private String currentRoute = "alarms";
    private int currentSnoozeMinutes = 5;

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) {
            stopSelf();
            return START_NOT_STICKY;
        }

        String action = intent.getAction();
        if (ACTION_STOP.equals(action)) {
            stopPlaybackAndRelease();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                stopForeground(STOP_FOREGROUND_REMOVE);
            } else {
                stopForeground(true);
            }
            stopSelf();
            return START_NOT_STICKY;
        }

        currentScheduleId = nonNull(intent.getStringExtra(SanctuaryNotificationHelper.EXTRA_SCHEDULE_ID), "manual");
        currentNotifId = intent.getIntExtra(SanctuaryNotificationHelper.EXTRA_NOTIF_ID, 88001);
        currentKind = nonNull(intent.getStringExtra(SanctuaryNotificationHelper.EXTRA_KIND), "alarm");
        currentEntityId = nonNull(intent.getStringExtra(SanctuaryNotificationHelper.EXTRA_ENTITY_ID), "");
        currentTitle = nonNull(intent.getStringExtra(SanctuaryNotificationHelper.EXTRA_TITLE), "My World");
        currentBody = nonNull(intent.getStringExtra(SanctuaryNotificationHelper.EXTRA_BODY), "");
        currentRoute = nonNull(intent.getStringExtra(SanctuaryNotificationHelper.EXTRA_ROUTE), "alarms");
        currentSnoozeMinutes = intent.getIntExtra(SanctuaryNotificationHelper.EXTRA_SNOOZE_MINUTES, 5);
        if (currentSnoozeMinutes <= 0) currentSnoozeMinutes = 5;

        String soundId = nonNull(intent.getStringExtra(SanctuaryNotificationHelper.EXTRA_SOUND_ID), "builtin:sanctuary-chime");
        String soundPath = nonNull(intent.getStringExtra(SanctuaryNotificationHelper.EXTRA_SOUND_PATH), "");

        boolean isAlarm = "alarm".equals(currentKind);
        boolean isReminder = "reminder".equals(currentKind);
        Notification notification = SanctuaryNotificationHelper.buildPlaybackNotification(
            this,
            currentNotifId,
            currentScheduleId,
            currentKind,
            currentEntityId,
            currentTitle,
            currentBody,
            currentRoute,
            currentSnoozeMinutes,
            isAlarm,
            isAlarm || isReminder
        );

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(
                    currentNotifId,
                    notification,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
                );
            } else {
                startForeground(currentNotifId, notification);
            }
        } catch (Exception e) {
            NotificationManagerCompat.from(this).notify(currentNotifId, notification);
        }

        acquireWakeLock();
        startAudio(soundId, soundPath, currentKind);
        return START_NOT_STICKY;
    }

    private void acquireWakeLock() {
        releaseWakeLock();
        try {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "MyWorld:AlarmRingLock");
                wakeLock.acquire(70_000L);
            }
        } catch (Exception ignored) {}
    }

    private void releaseWakeLock() {
        try {
            if (wakeLock != null && wakeLock.isHeld()) {
                wakeLock.release();
            }
        } catch (Exception ignored) {}
        wakeLock = null;
    }

    private void startAudio(String soundId, String soundPath, String kind) {
        stopPlaybackAndRelease();

        audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
        // Use USAGE_MEDIA so Android's side Volume Up/Down rocker directly controls playback loudness!
        AudioAttributes attrs = new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_MEDIA)
            .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
            .build();

        if (audioManager != null) {
            int focusGain = "alarm".equals(kind)
                ? AudioManager.AUDIOFOCUS_GAIN_TRANSIENT
                : AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                audioFocusRequest = new AudioFocusRequest.Builder(focusGain)
                    .setAudioAttributes(attrs)
                    .setOnAudioFocusChangeListener(focusChange -> {
                        // Keep ringing through transient ducks; stop on permanent focus loss
                        if (focusChange == AudioManager.AUDIOFOCUS_LOSS) {
                            stopPlaybackAndRelease();
                        }
                    })
                    .build();
                audioManager.requestAudioFocus(audioFocusRequest);
            } else {
                @SuppressWarnings("deprecation")
                int ignored = audioManager.requestAudioFocus(null, AudioManager.STREAM_MUSIC, focusGain);
            }
        }

        boolean shouldLoop = "alarm".equals(kind) || "reminder".equals(kind);

        try {
            mediaPlayer = new MediaPlayer();
            mediaPlayer.setAudioAttributes(attrs);
            File audioFile = SanctuaryNotificationHelper.resolveOrBuildAudioFile(this, soundId, soundPath);
            if (audioFile != null && audioFile.exists()) {
                mediaPlayer.setDataSource(audioFile.getAbsolutePath());
            } else {
                Uri fallbackUri = RingtoneManager.getDefaultUri(
                    "alarm".equals(kind) ? RingtoneManager.TYPE_ALARM : RingtoneManager.TYPE_NOTIFICATION
                );
                if (fallbackUri == null) {
                    fallbackUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
                }
                mediaPlayer.setDataSource(this, fallbackUri);
            }
            mediaPlayer.setLooping(shouldLoop);
            mediaPlayer.setVolume(1.0f, 1.0f);
            mediaPlayer.prepare();
            mediaPlayer.start();
        } catch (Exception e) {
            // Ultimate fallback to default alarm URI
            try {
                if (mediaPlayer != null) {
                    mediaPlayer.release();
                }
                mediaPlayer = new MediaPlayer();
                mediaPlayer.setAudioAttributes(attrs);
                Uri alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
                if (alarmUri == null) {
                    alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
                }
                mediaPlayer.setDataSource(this, alarmUri);
                mediaPlayer.setLooping(shouldLoop);
                mediaPlayer.setVolume(1.0f, 1.0f);
                mediaPlayer.prepare();
                mediaPlayer.start();
            } catch (Exception ignored) {
                stopPlaybackAndRelease();
            }
        }

        long maxMs = "alarm".equals(kind)
            ? ALARM_MAX_MS
            : "reminder".equals(kind)
                ? REMINDER_MAX_MS
                : CALM_MAX_MS;

        autoStopRunnable = () -> {
            if ("alarm".equals(currentKind)) {
                // Auto-snooze after 1 minute of ringing without action
                SanctuaryActionReceiver.performSnooze(
                    SanctuaryRingtoneService.this,
                    currentScheduleId,
                    currentNotifId,
                    currentKind,
                    currentEntityId,
                    currentTitle,
                    currentBody,
                    currentRoute,
                    currentSnoozeMinutes,
                    true
                );
            } else {
                // Keep reminder / Event Calm notification visible in tray while stopping audio
                stopPlaybackAndRelease();
                Notification quietCard = SanctuaryNotificationHelper.buildPlaybackNotification(
                    SanctuaryRingtoneService.this,
                    currentNotifId,
                    currentScheduleId,
                    currentKind,
                    currentEntityId,
                    currentTitle,
                    currentBody,
                    currentRoute,
                    currentSnoozeMinutes,
                    false,
                    false
                );
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                    stopForeground(STOP_FOREGROUND_DETACH);
                } else {
                    stopForeground(false);
                }
                NotificationManagerCompat.from(SanctuaryRingtoneService.this)
                    .notify(currentNotifId, quietCard);
                stopSelf();
            }
        };
        handler.postDelayed(autoStopRunnable, maxMs);
    }

    private void stopPlaybackAndRelease() {
        if (autoStopRunnable != null) {
            handler.removeCallbacks(autoStopRunnable);
            autoStopRunnable = null;
        }
        if (mediaPlayer != null) {
            try {
                if (mediaPlayer.isPlaying()) {
                    mediaPlayer.stop();
                }
            } catch (Exception ignored) {}
            try {
                mediaPlayer.release();
            } catch (Exception ignored) {}
            mediaPlayer = null;
        }
        if (audioManager != null) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && audioFocusRequest != null) {
                audioManager.abandonAudioFocusRequest(audioFocusRequest);
                audioFocusRequest = null;
            }
        }
        releaseWakeLock();
    }

    @Override
    public void onDestroy() {
        stopPlaybackAndRelease();
        super.onDestroy();
    }

    private static String nonNull(String val, String fallback) {
        return val != null ? val : fallback;
    }
}
