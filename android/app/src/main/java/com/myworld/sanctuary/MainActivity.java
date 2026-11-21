package com.myworld.sanctuary;

import android.content.Intent;
import android.media.AudioManager;
import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SanctuaryAudioPlugin.class);
        super.onCreate(savedInstanceState);

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
