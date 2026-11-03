package com.cybershield360.protect

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import org.json.JSONObject

/** "Share → Check with CyberShield360": checks text the user chose to share. */
class ShareActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val store = Store(this)
        val pad = (20 * resources.displayMetrics.density).toInt()
        val box = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(pad, pad, pad, pad) }
        val status = TextView(this).apply { textSize = 16f }
        box.addView(status)
        setContentView(box)

        val shared = intent?.getStringExtra(Intent.EXTRA_TEXT)?.take(8000).orEmpty()
        if (shared.isBlank()) { status.text = "Nothing to check."; return }
        if (store.deviceToken == null) { status.text = "Open CyberShield360 Protect and pair this phone first."; return }
        status.text = "Checking…"
        Thread {
            val text = try {
                val item = JSONObject().put("app", "shared").put("title", "").put("text", Redactor.redact(shared))
                    .put("complete", true).put("posted", System.currentTimeMillis())
                val r = Api(store).send(listOf(item), sourceType = "shared_text").getJSONObject(0)
                if (!r.optBoolean("accepted")) r.optString("message", "Not accepted.")
                else {
                    runOnUiThread {
                        box.addView(Button(this).apply {
                            this.text = "Open full report"
                            setOnClickListener { startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(store.serverUrl + r.optString("report_path")))) }
                        })
                    }
                    val level = r.optString("risk_level")
                    "${r.optString("classification")} · $level" + (if (level != "UNKNOWN") " (${r.optInt("risk_score")}/100)" else "") +
                        "\n\n" + r.optString("headline").ifBlank { "No warning signs found. That doesn't prove it's safe." }
                }
            } catch (e: Exception) {
                e.message ?: "Couldn't reach the server."
            }
            runOnUiThread { status.text = text }
        }.start()
    }
}
