package com.myworld.sanctuary;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class SanctuaryBootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        SanctuaryNotificationHelper.ensureChannels(context);
        SanctuaryNotificationHelper.rescheduleAllFromStore(context);
    }
}
