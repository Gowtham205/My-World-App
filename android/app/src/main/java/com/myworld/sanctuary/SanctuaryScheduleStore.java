package com.myworld.sanctuary;

import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

public final class SanctuaryScheduleStore {
    private static final String PREFS_NAME = "my_world_sanctuary_native_v1";
    private static final String KEY_SCHEDULES = "schedules_json";
    private static final String KEY_PENDING_EVENTS = "pending_events_json";
    private static final String KEY_CLAIMED_SLOTS = "claimed_slots_json";

    private SanctuaryScheduleStore() {}

    private static SharedPreferences prefs(Context context) {
        return context.getApplicationContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    public static synchronized JSONArray getSchedules(Context context) {
        String raw = prefs(context).getString(KEY_SCHEDULES, "[]");
        try {
            return new JSONArray(raw);
        } catch (JSONException e) {
            return new JSONArray();
        }
    }

    public static synchronized void saveSchedules(Context context, JSONArray schedules) {
        prefs(context).edit().putString(KEY_SCHEDULES, schedules.toString()).apply();
    }

    public static synchronized JSONObject findScheduleById(Context context, String id) {
        if (id == null) return null;
        JSONArray arr = getSchedules(context);
        for (int i = 0; i < arr.length(); i++) {
            JSONObject obj = arr.optJSONObject(i);
            if (obj != null && id.equals(obj.optString("id"))) {
                return obj;
            }
        }
        return null;
    }

    public static synchronized void upsertSchedule(Context context, JSONObject item) {
        String id = item.optString("id", "");
        if (id.isEmpty()) return;
        JSONArray current = getSchedules(context);
        JSONArray next = new JSONArray();
        boolean replaced = false;
        for (int i = 0; i < current.length(); i++) {
            JSONObject obj = current.optJSONObject(i);
            if (obj == null) continue;
            if (id.equals(obj.optString("id"))) {
                next.put(item);
                replaced = true;
            } else {
                next.put(obj);
            }
        }
        if (!replaced) {
            next.put(item);
        }
        saveSchedules(context, next);
    }

    public static synchronized void removeScheduleById(Context context, String id) {
        if (id == null || id.isEmpty()) return;
        JSONArray current = getSchedules(context);
        JSONArray next = new JSONArray();
        for (int i = 0; i < current.length(); i++) {
            JSONObject obj = current.optJSONObject(i);
            if (obj != null && !id.equals(obj.optString("id"))) {
                next.put(obj);
            }
        }
        saveSchedules(context, next);
    }

    public static synchronized void queuePendingEvent(Context context, JSONObject eventObj) {
        String raw = prefs(context).getString(KEY_PENDING_EVENTS, "[]");
        JSONArray arr;
        try {
            arr = new JSONArray(raw);
        } catch (JSONException e) {
            arr = new JSONArray();
        }
        arr.put(eventObj);
        // Keep last 60 events
        if (arr.length() > 60) {
            JSONArray trimmed = new JSONArray();
            for (int i = arr.length() - 60; i < arr.length(); i++) {
                trimmed.put(arr.opt(i));
            }
            arr = trimmed;
        }
        prefs(context).edit().putString(KEY_PENDING_EVENTS, arr.toString()).apply();
    }

    public static synchronized JSONArray drainPendingEvents(Context context) {
        String raw = prefs(context).getString(KEY_PENDING_EVENTS, "[]");
        prefs(context).edit().putString(KEY_PENDING_EVENTS, "[]").apply();
        try {
            return new JSONArray(raw);
        } catch (JSONException e) {
            return new JSONArray();
        }
    }

    /**
     * Atomically claims a minute-slot key so foreground JS scheduler and background
     * AlarmManager never double-fire the same occurrence.
     */
    public static synchronized boolean tryClaimSlot(Context context, String slotKey) {
        if (slotKey == null || slotKey.isEmpty()) return true;
        long now = System.currentTimeMillis();
        long cutoff = now - 24L * 60L * 60L * 1000L;
        String raw = prefs(context).getString(KEY_CLAIMED_SLOTS, "{}");
        JSONObject map;
        try {
            map = new JSONObject(raw);
        } catch (JSONException e) {
            map = new JSONObject();
        }

        if (map.has(slotKey)) {
            long ts = map.optLong(slotKey, 0L);
            if (ts > cutoff) {
                return false;
            }
        }

        // Prune stale keys and keep map bounded
        JSONObject next = new JSONObject();
        try {
            java.util.Iterator<String> keys = map.keys();
            while (keys.hasNext()) {
                String k = keys.next();
                long ts = map.optLong(k, 0L);
                if (ts > cutoff) {
                    next.put(k, ts);
                }
            }
            next.put(slotKey, now);
        } catch (JSONException ignored) {}

        prefs(context).edit().putString(KEY_CLAIMED_SLOTS, next.toString()).apply();
        return true;
    }
}
