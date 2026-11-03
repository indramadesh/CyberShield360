package com.cybershield360.protect

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.job.JobInfo
import android.app.job.JobParameters
import android.app.job.JobScheduler
import android.app.job.JobService
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import java.util.concurrent.Executors

/**
 * Background work, run by the system's JobScheduler only when there is a network
 * connection (so it respects Doze and battery savers). Sends queued items in
 * batches, raises CyberShield360's own alert for high-risk results, and reports
 * whether Notification access is still granted.
 */
class SendJobService : JobService() {

    override fun onStartJob(params: JobParameters): Boolean {
        executor.execute {
            var retry = false
            try {
                when (params.jobId) {
                    JOB_SEND -> retry = sendQueue(this)
                    JOB_STATUS -> reportStatus(this)
                }
            } catch (e: Exception) {
                retry = params.jobId == JOB_SEND
            }
            jobFinished(params, retry)
        }
        return true
    }

    override fun onStopJob(params: JobParameters): Boolean = params.jobId == JOB_SEND

    companion object {
        private const val JOB_SEND = 1
        private const val JOB_STATUS = 2
        private const val CHANNEL = "threat_alerts"
        private val executor = Executors.newSingleThreadExecutor()

        fun scheduleSend(context: Context) = schedule(context, JOB_SEND, periodic = false)

        fun scheduleStatus(context: Context) = schedule(context, JOB_STATUS, periodic = true)

        private fun schedule(context: Context, id: Int, periodic: Boolean) {
            val js = context.getSystemService(JobScheduler::class.java)
            if (!periodic && js.getPendingJob(id) != null) return // a send is already waiting
            val b = JobInfo.Builder(id, ComponentName(context, SendJobService::class.java))
                .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
                .setPersisted(true) // survives a restart
            if (periodic) b.setPeriodic(6 * 60 * 60 * 1000L) else b.setBackoffCriteria(30_000L, JobInfo.BACKOFF_POLICY_EXPONENTIAL)
            js.schedule(b.build())
        }

        fun accessGranted(context: Context): Boolean =
            context.getSystemService(NotificationManager::class.java)
                .isNotificationListenerAccessGranted(ComponentName(context, CsNotificationListener::class.java))

        fun reportStatus(context: Context) {
            val store = Store(context)
            if (store.deviceToken == null) return
            val api = Api(store)
            api.reportStatus(accessGranted(context))
            // The web dashboard can remove apps; adopt the server's list.
            val cfg = api.config()
            val apps = cfg.optJSONArray("apps")
            if (apps != null) store.selectedApps = (0 until apps.length()).map { apps.getString(it) }.toSet()
        }

        /** Returns true when the job should be retried later (network or server problem). */
        fun sendQueue(context: Context): Boolean {
            val store = Store(context)
            if (store.deviceToken == null) return false
            val api = Api(store)
            while (true) {
                val batch = store.peek(25)
                if (batch.isEmpty()) return false
                val results = try {
                    api.send(batch)
                } catch (e: Api.ApiException) {
                    if (e.status == 401) { store.deviceToken = null; store.clearQueue(); return false } // unpaired on the web
                    return e.status >= 500 || e.status == 429
                }
                store.drop(batch.size)
                for (i in 0 until results.length()) {
                    val r = results.getJSONObject(i)
                    if (!r.optBoolean("accepted")) continue
                    store.lastResult = "${r.optString("classification")} · ${r.optString("risk_level")} (${batch.getOrNull(i)?.optString("app")})"
                    if (r.optBoolean("alert")) alert(context, store, r, batch.getOrNull(i)?.optString("app") ?: "")
                }
            }
        }

        private fun alert(context: Context, store: Store, r: org.json.JSONObject, app: String) {
            val nm = context.getSystemService(NotificationManager::class.java)
            if (Build.VERSION.SDK_INT >= 26) {
                nm.createNotificationChannel(NotificationChannel(CHANNEL, context.getString(R.string.channel_alerts),
                    NotificationManager.IMPORTANCE_HIGH).apply { description = context.getString(R.string.channel_alerts_desc) })
            }
            val report = Uri.parse(store.serverUrl + r.optString("report_path"))
            val open = PendingIntent.getActivity(context, r.optString("event_id").hashCode(),
                Intent(Intent.ACTION_VIEW, report), PendingIntent.FLAG_IMMUTABLE)
            val label = when (r.optString("classification")) {
                "SCAM" -> "Possible scam"; "PHISHING" -> "Possible phishing"; else -> "Suspicious message"
            }
            val n = android.app.Notification.Builder(context, CHANNEL)
                .setSmallIcon(R.drawable.ic_stat_alert)
                .setContentTitle("$label in ${appLabel(context, app)}")
                .setContentText(r.optString("headline").ifBlank { "Tap to see why. Don't reply, pay or share codes." })
                .setStyle(android.app.Notification.BigTextStyle().bigText(
                    r.optString("headline").ifBlank { "Tap to see why." } + "\nDon't reply, pay, or share codes until you've checked."))
                .setContentIntent(open)
                .setAutoCancel(true)
                .build()
            try { nm.notify(r.optString("event_id").hashCode(), n) } catch (e: SecurityException) { /* alerts not allowed */ }
        }

        private fun appLabel(context: Context, pkg: String): String = try {
            val pm = context.packageManager
            pm.getApplicationLabel(pm.getApplicationInfo(pkg, 0)).toString()
        } catch (e: Exception) { pkg }
    }
}
