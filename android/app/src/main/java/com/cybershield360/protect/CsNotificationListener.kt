package com.cybershield360.protect

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification

/**
 * Receives notifications only after the user grants Notification access in system
 * settings. Everything here is quick and local: filter to the user's selected apps,
 * extract + redact the text, drop repeats, queue it. Network work happens later in
 * [SendJobService], never on this callback thread.
 */
class CsNotificationListener : NotificationListenerService() {

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        val store = Store(this)
        if (store.deviceToken == null || !store.consentGiven) return
        val n = sbn.notification ?: return
        val extras = n.extras
        val lines = extras?.getCharSequenceArray(Notification.EXTRA_TEXT_LINES)?.map { it.toString() } ?: emptyList()
        val fields = NotificationFields(
            packageName = sbn.packageName,
            title = extras?.getCharSequence(Notification.EXTRA_TITLE)?.toString(),
            text = extras?.getCharSequence(Notification.EXTRA_TEXT)?.toString(),
            bigText = extras?.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString(),
            lines = lines,
            isGroupSummary = (n.flags and Notification.FLAG_GROUP_SUMMARY) != 0,
            isOngoing = (n.flags and Notification.FLAG_ONGOING_EVENT) != 0 ||
                (n.flags and Notification.FLAG_FOREGROUND_SERVICE) != 0,
            postedAtMillis = sbn.postTime,
        )
        val (candidate, _) = NotificationText.extract(fields, store.selectedApps, packageName, store.paused)
        if (candidate == null || !dedupe.firstTime(candidate, System.currentTimeMillis())) return
        store.enqueue(candidate)
        SendJobService.scheduleSend(this)
    }

    override fun onListenerConnected() {
        SendJobService.scheduleStatus(this)
    }

    override fun onListenerDisconnected() {
        // Access revoked or the system unbound us: report it so the dashboard is honest.
        SendJobService.scheduleStatus(this)
    }

    companion object {
        private val dedupe = DedupeCache()
    }
}
