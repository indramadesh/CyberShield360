package com.cybershield360.protect

import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/** Minimal client for the CyberShield360 /msgintel device API. Call off the main thread. */
class Api(private val store: Store) {

    class ApiException(val status: Int, message: String) : IOException(message)

    private fun call(method: String, path: String, body: JSONObject? = null, auth: Boolean = true): JSONObject {
        val conn = URL(store.serverUrl + "/api/v1/msgintel" + path).openConnection() as HttpURLConnection
        conn.requestMethod = method
        conn.connectTimeout = 15_000
        conn.readTimeout = 30_000
        conn.setRequestProperty("Accept", "application/json")
        if (auth) store.deviceToken?.let { conn.setRequestProperty("X-Device-Token", it) }
        if (body != null) {
            conn.doOutput = true
            conn.setRequestProperty("Content-Type", "application/json")
            conn.outputStream.use { it.write(body.toString().toByteArray()) }
        }
        val code = conn.responseCode
        val text = (if (code in 200..299) conn.inputStream else conn.errorStream)?.bufferedReader()?.use { it.readText() } ?: ""
        conn.disconnect()
        val json = try { JSONObject(text) } catch (e: Exception) { JSONObject() }
        if (code !in 200..299) {
            val msg = json.optJSONObject("error")?.optString("message") ?: "Server returned HTTP $code"
            throw ApiException(code, msg)
        }
        return json.optJSONObject("data") ?: JSONObject()
    }

    fun pair(code: String, deviceName: String): String {
        val d = call("POST", "/devices/pair", JSONObject().put("code", code.trim())
            .put("device_name", deviceName.take(80)).put("platform", "android"), auth = false)
        return d.getString("device_token")
    }

    fun reportStatus(notificationAccess: Boolean): JSONObject {
        val body = JSONObject().put("notification_access", notificationAccess)
            .put("paused", store.paused).put("app_version", BuildConfigInfo.VERSION)
        // Only send the app list when it changed here; otherwise the website's edits win.
        if (store.appsChangedLocally) body.put("selected_apps", JSONArray(store.selectedApps.sorted()))
        return call("POST", "/device/status", body).also { store.appsChangedLocally = false }
    }

    fun config(): JSONObject = call("GET", "/device/config")

    /** Sends up to 25 items; returns the per-item results in order. */
    fun send(items: List<JSONObject>, sourceType: String = "notification"): JSONArray {
        val arr = JSONArray()
        for (i in items) {
            arr.put(JSONObject().put("source_type", sourceType).put("app", i.optString("app"))
                .put("title", i.optString("title")).put("text", i.optString("text"))
                .put("complete", i.optBoolean("complete")).put("posted_at", iso(i.optLong("posted"))))
        }
        return call("POST", "/device/events", JSONObject().put("items", arr)).optJSONArray("results") ?: JSONArray()
    }

    private fun iso(millis: Long): String {
        val f = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US)
        f.timeZone = TimeZone.getTimeZone("UTC")
        return f.format(Date(if (millis > 0) millis else System.currentTimeMillis()))
    }
}

object BuildConfigInfo {
    const val VERSION = "0.1.0"
}
