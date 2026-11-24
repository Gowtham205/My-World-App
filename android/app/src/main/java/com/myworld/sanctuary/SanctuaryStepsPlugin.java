package com.myworld.sanctuary;

import android.Manifest;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.Build;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

@CapacitorPlugin(
    name = "SanctuarySteps",
    permissions = {
        @Permission(
            alias = "activity",
            strings = { Manifest.permission.ACTIVITY_RECOGNITION }
        )
    }
)
public class SanctuaryStepsPlugin extends Plugin implements SensorEventListener {
    private static final String PREFS_NAME = "sanctuary_steps_prefs";
    private static final String KEY_SAVED_DATE = "saved_date";
    private static final String KEY_TODAY_STEPS = "today_steps";
    private static final String KEY_LAST_CUMULATIVE = "last_cumulative";

    private SensorManager sensorManager;
    private Sensor stepCounterSensor;
    private Sensor stepDetectorSensor;
    private boolean listenerRegistered = false;

    @Override
    public void load() {
        super.load();
        sensorManager = (SensorManager) getContext().getSystemService(Context.SENSOR_SERVICE);
        if (sensorManager != null) {
            stepCounterSensor = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER);
            stepDetectorSensor = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_DETECTOR);
        }
        if (hasActivityPermission()) {
            registerStepListeners();
        }
    }

    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        if (hasActivityPermission()) {
            registerStepListeners();
        }
    }

    @Override
    protected void handleOnDestroy() {
        unregisterStepListeners();
        super.handleOnDestroy();
    }

    private boolean hasActivityPermission() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            return true;
        }
        return ContextCompat.checkSelfPermission(
            getContext(),
            Manifest.permission.ACTIVITY_RECOGNITION
        ) == PackageManager.PERMISSION_GRANTED;
    }

    private void registerStepListeners() {
        if (listenerRegistered || sensorManager == null) return;
        boolean anyRegistered = false;
        if (stepCounterSensor != null) {
            anyRegistered |= sensorManager.registerListener(
                this,
                stepCounterSensor,
                SensorManager.SENSOR_DELAY_UI
            );
        }
        if (stepDetectorSensor != null) {
            anyRegistered |= sensorManager.registerListener(
                this,
                stepDetectorSensor,
                SensorManager.SENSOR_DELAY_NORMAL
            );
        }
        listenerRegistered = anyRegistered;
    }

    private void unregisterStepListeners() {
        if (sensorManager != null && listenerRegistered) {
            try {
                sensorManager.unregisterListener(this);
            } catch (Exception ignored) {}
            listenerRegistered = false;
        }
    }

    private String todayKey() {
        return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
    }

    private int readTodayStepsLocked() {
        SharedPreferences prefs = getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String today = todayKey();
        String savedDate = prefs.getString(KEY_SAVED_DATE, "");
        if (!today.equals(savedDate)) {
            prefs.edit()
                .putString(KEY_SAVED_DATE, today)
                .putInt(KEY_TODAY_STEPS, 0)
                .apply();
            return 0;
        }
        return Math.max(0, prefs.getInt(KEY_TODAY_STEPS, 0));
    }

    @Override
    public synchronized void onSensorChanged(SensorEvent event) {
        if (event == null || event.sensor == null) return;
        SharedPreferences prefs = getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String today = todayKey();
        String savedDate = prefs.getString(KEY_SAVED_DATE, "");
        int currentTodaySteps = today.equals(savedDate) ? Math.max(0, prefs.getInt(KEY_TODAY_STEPS, 0)) : 0;

        if (event.sensor.getType() == Sensor.TYPE_STEP_COUNTER && event.values.length > 0) {
            long cumulative = Math.max(0L, Math.round(event.values[0]));
            long lastCumulative = prefs.getLong(KEY_LAST_CUMULATIVE, -1L);
            long delta = 0L;
            if (lastCumulative >= 0L) {
                if (cumulative >= lastCumulative) {
                    delta = cumulative - lastCumulative;
                } else {
                    // Device rebooted so cumulative reset to 0
                    delta = cumulative;
                }
            }
            if (delta > 50000L) {
                delta = 0L;
            }
            int updatedSteps = currentTodaySteps + (int) delta;
            prefs.edit()
                .putString(KEY_SAVED_DATE, today)
                .putInt(KEY_TODAY_STEPS, updatedSteps)
                .putLong(KEY_LAST_CUMULATIVE, cumulative)
                .apply();

            emitStepsUpdate(updatedSteps);
        } else if (event.sensor.getType() == Sensor.TYPE_STEP_DETECTOR && stepCounterSensor == null) {
            int updatedSteps = currentTodaySteps + Math.max(1, event.values.length);
            prefs.edit()
                .putString(KEY_SAVED_DATE, today)
                .putInt(KEY_TODAY_STEPS, updatedSteps)
                .apply();
            emitStepsUpdate(updatedSteps);
        }
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {
        // No action required
    }

    private void emitStepsUpdate(int todaySteps) {
        if (!hasListeners("stepsUpdated")) return;
        JSObject payload = new JSObject();
        payload.put("todaySteps", todaySteps);
        payload.put("date", todayKey());
        payload.put("sensorAvailable", stepCounterSensor != null || stepDetectorSensor != null);
        notifyListeners("stepsUpdated", payload, false);
    }

    @PluginMethod
    public void getStepStatus(PluginCall call) {
        boolean available = stepCounterSensor != null || stepDetectorSensor != null;
        boolean granted = hasActivityPermission();
        if (granted && available) {
            registerStepListeners();
        }
        JSObject res = new JSObject();
        res.put("sensorAvailable", available);
        res.put("permissionGranted", granted);
        res.put("todaySteps", readTodayStepsLocked());
        res.put("date", todayKey());
        call.resolve(res);
    }

    @PluginMethod
    public void requestPermissionAndStart(PluginCall call) {
        if (hasActivityPermission()) {
            registerStepListeners();
            JSObject res = new JSObject();
            res.put("sensorAvailable", stepCounterSensor != null || stepDetectorSensor != null);
            res.put("permissionGranted", true);
            res.put("todaySteps", readTodayStepsLocked());
            res.put("date", todayKey());
            call.resolve(res);
            return;
        }
        requestPermissionForAlias("activity", call, "activityPermissionCallback");
    }

    @PermissionCallback
    private void activityPermissionCallback(PluginCall call) {
        boolean granted = hasActivityPermission()
            || getPermissionState("activity") == PermissionState.GRANTED;
        if (granted) {
            registerStepListeners();
        }
        JSObject res = new JSObject();
        res.put("sensorAvailable", stepCounterSensor != null || stepDetectorSensor != null);
        res.put("permissionGranted", granted);
        res.put("todaySteps", readTodayStepsLocked());
        res.put("date", todayKey());
        call.resolve(res);
    }
}
