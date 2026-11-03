package com.cybershield360.protect

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Typeface
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.text.InputType
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.Switch
import android.widget.TextView
import android.widget.Toast

/** Onboarding, pairing and status. Plain platform views: no extra libraries. */
class MainActivity : Activity() {
    private lateinit var store: Store
    private lateinit var root: LinearLayout
    private var pendingCode = ""

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        store = Store(this)
        root = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(dp(20), dp(20), dp(20), dp(20)) }
        setContentView(ScrollView(this).apply { addView(root) })
        readPairingLink(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        readPairingLink(intent)
        render()
    }

    /** cs360protect://pair?server=https://…&code=XXXX-XXXX (shown by the website).
     *  It only fills the form; pairing still needs the user to tap "Pair". */
    private fun readPairingLink(intent: Intent?) {
        val data = intent?.data ?: return
        if (data.scheme != "cs360protect" || data.host != "pair") return
        PairingLink.server(data.getQueryParameter("server"))?.let { store.serverUrl = it }
        pendingCode = PairingLink.code(data.getQueryParameter("code"))
    }

    override fun onResume() {
        super.onResume()
        render()
        if (store.deviceToken != null) SendJobService.scheduleStatus(this)
    }

    private fun render() {
        root.removeAllViews()
        heading("CyberShield360 Protect")
        when {
            !store.consentGiven -> renderDisclosure()
            store.deviceToken == null -> renderPairing()
            else -> renderStatus()
        }
    }

    private fun renderDisclosure() {
        para("Before you start, here is exactly what this app does:")
        bullet("It reads notifications ONLY from apps you choose, and only after you turn on Notification access in Android settings.")
        bullet("It sees what the notification shows, not your whole conversations. If an app hides previews, there's nothing to check.")
        bullet("One-time codes, passwords and card numbers are removed on this phone before anything is sent. Android 15 and later hide one-time codes from apps like this one anyway.")
        bullet("Selected notification text is sent over HTTPS to your CyberShield360 account for analysis. Message text isn't stored unless you turn on previews on the website.")
        bullet("It never reads SMS, call logs or contacts, and never replies, deletes or blocks anything.")
        bullet("You can pause, choose different apps, or disconnect at any time.")
        button("I understand and agree") { store.consentGiven = true; render() }
    }

    private fun renderPairing() {
        para("Connect this phone to your CyberShield360 account. On the website, open Message Protection → Connected sources → Pair an Android phone, then enter the code shown there.")
        label("Server")
        val server = input(store.serverUrl, InputType.TYPE_TEXT_VARIATION_URI)
        label("Pairing code")
        val code = input(pendingCode, InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_CAP_CHARACTERS).apply { hint = "XXXX-XXXX" }
        val status = para("")
        button("Pair this phone") {
            val url = PairingLink.server(server.text.toString())
            if (url == null) { status.text = "Enter the server address starting with https://"; return@button }
            store.serverUrl = url
            status.text = "Pairing…"
            Thread {
                val msg = try {
                    store.deviceToken = Api(store).pair(code.text.toString(), "${Build.MANUFACTURER} ${Build.MODEL}")
                    null
                } catch (e: Exception) {
                    e.message ?: "Couldn't reach the server."
                }
                runOnUiThread { if (msg == null) render() else status.text = msg }
            }.start()
        }
    }

    private fun renderStatus() {
        val granted = SendJobService.accessGranted(this)
        section("Notification access")
        para(if (granted) "✅ Granted." else "❌ Not granted, so nothing is being checked.")
        if (!granted) {
            para("Android will show a warning that this app can read notifications. That's how notification access works; we only use it for the apps you select below.")
            button("Open Notification access settings") {
                startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
            }
        }
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            para("Allow CyberShield360 to show its own alerts when a risky message arrives:")
            button("Allow alerts") { requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 1) }
        }

        section("Apps to check")
        val apps = store.selectedApps
        para(if (apps.isEmpty()) "None selected: nothing is checked yet." else "${apps.size} selected.")
        button("Choose apps") { startActivity(Intent(this, AppPickerActivity::class.java)) }

        section("Check a link or message")
        para("Paste a suspicious link, SMS, WhatsApp or email text. It's checked by the same engine and saved (redacted) to your history.")
        val manual = input("", InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_MULTI_LINE).apply {
            hint = "https://… or the message text"; minLines = 3
        }
        button("Check now") {
            val text = manual.text.toString().trim()
            if (text.isEmpty()) {
                Toast.makeText(this, "Paste something to check first.", Toast.LENGTH_SHORT).show()
            } else {
                startActivity(Intent(this, ShareActivity::class.java).putExtra(Intent.EXTRA_TEXT, text))
                manual.setText("")
            }
        }

        section("Monitoring")
        root.addView(Switch(this).apply {
            text = "Pause checking"
            isChecked = store.paused
            setOnCheckedChangeListener { _, on -> store.paused = on; SendJobService.scheduleStatus(this@MainActivity) }
        })
        para("Waiting to send: ${store.queueSize()} (sent automatically when you're online).")
        if (store.lastResult.isNotBlank()) para("Last result: ${store.lastResult}")
        para("Server: ${store.serverUrl}")

        section("Disconnect")
        button("Unpair this phone") {
            store.deviceToken = null
            store.clearQueue()
            Toast.makeText(this, "Unpaired. Also disconnect it on the website to revoke it there.", Toast.LENGTH_LONG).show()
            render()
        }
    }

    // ---- tiny view helpers ----
    private fun dp(v: Int) = (v * resources.displayMetrics.density).toInt()
    private fun heading(t: String) = root.addView(TextView(this).apply { text = t; textSize = 22f; setTypeface(typeface, Typeface.BOLD) })
    private fun section(t: String) = root.addView(TextView(this).apply {
        text = t; textSize = 17f; setTypeface(typeface, Typeface.BOLD); setPadding(0, dp(18), 0, dp(4))
    })
    private fun label(t: String) = root.addView(TextView(this).apply { text = t; setPadding(0, dp(10), 0, 0) })
    private fun para(t: String): TextView = TextView(this).apply { text = t; textSize = 15f; setPadding(0, dp(6), 0, 0) }.also { root.addView(it) }
    private fun bullet(t: String) = para("•  $t")
    private fun input(value: String, type: Int): EditText = EditText(this).apply { setText(value); inputType = type }.also { root.addView(it) }
    private fun button(t: String, onClick: (View) -> Unit) = root.addView(Button(this).apply { text = t; setOnClickListener(onClick) })
}
