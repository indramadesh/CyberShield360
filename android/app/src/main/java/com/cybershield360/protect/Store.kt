package com.cybershield360.protect

import android.content.Context
import android.content.SharedPreferences
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import org.json.JSONArray
import org.json.JSONObject
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/** App settings + the offline queue. The device token is encrypted with a key that
 *  never leaves the Android Keystore. */
class Store(context: Context) {
    private val prefs: SharedPreferences = context.getSharedPreferences("cs360", Context.MODE_PRIVATE)

    var serverUrl: String
        get() = prefs.getString("server", DEFAULT_SERVER) ?: DEFAULT_SERVER
        set(v) = prefs.edit().putString("server", v.trim().trimEnd('/')).apply()

    var consentGiven: Boolean
        get() = prefs.getBoolean("consent", false)
        set(v) = prefs.edit().putBoolean("consent", v).apply()

    var paused: Boolean
        get() = prefs.getBoolean("paused", false)
        set(v) = prefs.edit().putBoolean("paused", v).apply()

    var selectedApps: Set<String>
        get() = prefs.getStringSet("apps", emptySet())?.toSet() ?: emptySet()
        set(v) = prefs.edit().putStringSet("apps", v).apply()

    /** True after the user changed the app list on the phone and it hasn't been reported yet. */
    var appsChangedLocally: Boolean
        get() = prefs.getBoolean("apps_dirty", false)
        set(v) = prefs.edit().putBoolean("apps_dirty", v).apply()

    var lastResult: String
        get() = prefs.getString("last", "") ?: ""
        set(v) = prefs.edit().putString("last", v).apply()

    var deviceToken: String?
        get() = prefs.getString("token", null)?.let { decrypt(it) }
        set(v) {
            if (v == null) prefs.edit().remove("token").apply() else prefs.edit().putString("token", encrypt(v)).apply()
        }

    // ---- offline queue (bounded: oldest dropped first) ----

    @Synchronized
    fun enqueue(c: Candidate) {
        val arr = JSONArray(prefs.getString("queue", "[]"))
        arr.put(JSONObject().put("app", c.app).put("title", c.title).put("text", c.text)
            .put("complete", c.complete).put("posted", c.postedAtMillis))
        val trimmed = JSONArray()
        val start = maxOf(0, arr.length() - MAX_QUEUE)
        for (i in start until arr.length()) trimmed.put(arr.get(i))
        prefs.edit().putString("queue", trimmed.toString()).apply()
    }

    @Synchronized
    fun peek(max: Int): List<JSONObject> {
        val arr = JSONArray(prefs.getString("queue", "[]"))
        return (0 until minOf(max, arr.length())).map { arr.getJSONObject(it) }
    }

    @Synchronized
    fun drop(n: Int) {
        val arr = JSONArray(prefs.getString("queue", "[]"))
        val rest = JSONArray()
        for (i in n until arr.length()) rest.put(arr.get(i))
        prefs.edit().putString("queue", rest.toString()).apply()
    }

    fun queueSize(): Int = JSONArray(prefs.getString("queue", "[]")).length()

    fun clearQueue() = prefs.edit().putString("queue", "[]").apply()

    // ---- Keystore encryption ----

    private fun key(): SecretKey {
        val ks = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (ks.getEntry(KEY_ALIAS, null) as? KeyStore.SecretKeyEntry)?.let { return it.secretKey }
        val gen = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
        gen.init(KeyGenParameterSpec.Builder(KEY_ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .build())
        return gen.generateKey()
    }

    private fun encrypt(plain: String): String {
        val c = Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.ENCRYPT_MODE, key()) }
        val out = c.iv + c.doFinal(plain.toByteArray())
        return Base64.encodeToString(out, Base64.NO_WRAP)
    }

    private fun decrypt(enc: String): String? = try {
        val raw = Base64.decode(enc, Base64.NO_WRAP)
        val c = Cipher.getInstance("AES/GCM/NoPadding")
        c.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, raw, 0, 12))
        String(c.doFinal(raw, 12, raw.size - 12))
    } catch (e: Exception) {
        null // key lost (e.g. app data restored elsewhere): pair again
    }

    companion object {
        const val DEFAULT_SERVER = "https://cybershield360-ae6b.onrender.com"
        private const val KEY_ALIAS = "cs360-device-token"
        private const val MAX_QUEUE = 100
    }
}
