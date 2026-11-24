package com.myworld.sanctuary;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.media.AudioManager;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final String UI_PREFS_NAME = "sanctuary_ui_prefs";
    private static final String KEY_IS_DARK = "is_dark";
    private static final int LIGHT_BAR_BG = Color.parseColor("#F2F6F3");
    private static final int DARK_BAR_BG = Color.parseColor("#10131C");

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SanctuaryAudioPlugin.class);
        registerPlugin(SanctuaryStepsPlugin.class);
        super.onCreate(savedInstanceState);

        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);

        SharedPreferences prefs = getSharedPreferences(UI_PREFS_NAME, Context.MODE_PRIVATE);
        boolean isDark = prefs.getBoolean(KEY_IS_DARK, true);
        applySystemBarTheme(this, isDark);

        View contentRoot = findViewById(android.R.id.content);
        if (contentRoot != null) {
            ViewCompat.setOnApplyWindowInsetsListener(contentRoot, (v, windowInsets) -> {
                Insets systemBars = windowInsets.getInsets(
                    WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout()
                );
                Insets ime = windowInsets.getInsets(WindowInsetsCompat.Type.ime());
                int bottomInset = Math.max(systemBars.bottom, ime.bottom);
                v.setPadding(systemBars.left, systemBars.top, systemBars.right, bottomInset);
                return WindowInsetsCompat.CONSUMED;
            });
            ViewCompat.requestApplyInsets(contentRoot);
        }

        // Align hardware Volume Up/Down rocker with media playback stream
        setVolumeControlStream(AudioManager.STREAM_MUSIC);

        if (getBridge() != null && getBridge().getWebView() != null) {
            WebView webView = getBridge().getWebView();
            webView.setVerticalScrollBarEnabled(false);
            webView.setHorizontalScrollBarEnabled(false);
            WebSettings settings = webView.getSettings();
            settings.setMediaPlaybackRequiresUserGesture(false);
        }

        handleRouteIntent(getIntent());
    }

    @Override
    public void onResume() {
        super.onResume();
        View contentRoot = findViewById(android.R.id.content);
        if (contentRoot != null) {
            ViewCompat.requestApplyInsets(contentRoot);
        }
    }

    @SuppressWarnings("deprecation")
    public static void applySystemBarTheme(Activity activity, boolean isDark) {
        if (activity == null) return;
        SharedPreferences prefs = activity.getSharedPreferences(UI_PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().putBoolean(KEY_IS_DARK, isDark).apply();

        int bgColor = isDark ? DARK_BAR_BG : LIGHT_BAR_BG;
        Window window = activity.getWindow();
        if (window != null) {
            View decor = window.getDecorView();
            decor.setBackgroundColor(bgColor);
            View contentRoot = activity.findViewById(android.R.id.content);
            if (contentRoot != null) {
                contentRoot.setBackgroundColor(bgColor);
            }
            window.setStatusBarColor(bgColor);
            window.setNavigationBarColor(bgColor);

            WindowInsetsControllerCompat controller =
                WindowCompat.getInsetsController(window, decor);
            if (controller != null) {
                controller.setAppearanceLightStatusBars(!isDark);
                controller.setAppearanceLightNavigationBars(!isDark);
            }
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleRouteIntent(intent);
    }

    private void handleRouteIntent(Intent intent) {
        if (intent == null) return;
        String route = intent.getStringExtra(SanctuaryNotificationHelper.EXTRA_ROUTE);
        if (route != null && !route.isEmpty()) {
            SanctuaryAudioPlugin.emitRouteToJs(route);
        }
    }
}
