package com.cybershield360.protect

/**
 * Pure logic for turning a notification into something worth checking. No android.*
 * types here, so it is covered by plain JVM unit tests.
 *
 * Detection is NOT done on the phone: CyberShield360 has one analysis engine (the
 * backend). The phone only selects, minimises and redacts.
 */
data class NotificationFields(
    val packageName: String,
    val title: String?,
    val text: String?,
    val bigText: String?,
    val lines: List<String>,
    val isGroupSummary: Boolean,
    val isOngoing: Boolean,
    val postedAtMillis: Long,
)

data class Candidate(val app: String, val title: String, val text: String, val complete: Boolean, val postedAtMillis: Long)

enum class Skip { NOT_SELECTED, OWN_APP, GROUP_SUMMARY, ONGOING, NO_TEXT, PAUSED }

object NotificationText {
    private const val MAX_TEXT = 4000

    /** Returns the item to send, or why it was skipped. */
    fun extract(
        f: NotificationFields,
        selectedApps: Set<String>,
        ownPackage: String,
        paused: Boolean,
    ): Pair<Candidate?, Skip?> {
        if (paused) return null to Skip.PAUSED
        if (f.packageName == ownPackage) return null to Skip.OWN_APP
        if (f.packageName !in selectedApps) return null to Skip.NOT_SELECTED
        // Group summaries repeat the child notifications ("3 new messages").
        if (f.isGroupSummary) return null to Skip.GROUP_SUMMARY
        // Music players, downloads, navigation: not messages.
        if (f.isOngoing) return null to Skip.ONGOING

        val body = listOf(f.bigText, f.text).firstOrNull { !it.isNullOrBlank() }?.trim()
            ?: f.lines.filter { it.isNotBlank() }.joinToString("\n").trim()
        if (body.isEmpty()) {
            // Preview hidden by the user or the app ("New message"): nothing to analyse.
            return null to Skip.NO_TEXT
        }
        val clipped = body.take(MAX_TEXT)
        return Candidate(
            app = f.packageName,
            title = Redactor.redact(f.title.orEmpty().take(200)),
            text = Redactor.redact(clipped),
            // Notification text is never the whole message; bigText is at best "most of it".
            complete = false,
            postedAtMillis = f.postedAtMillis,
        ) to null
    }
}

/** Validation for the pairing link and the server field. */
object PairingLink {
    private val local = Regex("""^http://(10\.0\.2\.2|localhost)(:\d+)?$""")
    private val secure = Regex("""^https://[A-Za-z0-9.-]+(:\d+)?$""")

    /** https:// anywhere, or http:// only to the emulator's host / localhost (development). */
    fun server(raw: String?): String? {
        val s = raw?.trim()?.trimEnd('/') ?: return null
        return when {
            secure.matches(s) -> s
            local.matches(s) -> s
            else -> null
        }
    }

    /** Pairing codes are 8 letters/digits, shown as XXXX-XXXX. */
    fun code(raw: String?): String {
        val c = raw.orEmpty().uppercase().filter { it in 'A'..'Z' || it in '0'..'9' }.take(8)
        return if (c.length > 4) c.substring(0, 4) + "-" + c.substring(4) else c
    }
}

/** Removes secret values before anything leaves the phone (the words stay; they're evidence). */
object Redactor {
    private val otpWithLabel = Regex(
        "(?i)\\b(otp|one[- ]time (?:password|code)|verification code|security code|code|pin)(\\s*(?:is|:|-|=)?\\s*)(\\d[\\d\\s-]{2,9}\\d)\\b",
    )
    private val bareOtp = Regex("(?i)\\b(\\d{4,8})\\b(?=[^.\\n]{0,40}\\b(otp|one[- ]time|verification code|do not share)\\b)")
    private val password = Regex("(?i)\\b(password|passcode|pwd)(\\s*(?:is|:|=)\\s*)(\\S+)")
    private val card = Regex("\\b(?:\\d[ -]?){13,19}\\b")

    fun redact(s: String): String = s
        .replace(otpWithLabel) { "${it.groupValues[1]}${it.groupValues[2]}[REDACTED_OTP]" }
        .replace(bareOtp, "[REDACTED_OTP]")
        .replace(password) { "${it.groupValues[1]}${it.groupValues[2]}[REDACTED_PASSWORD]" }
        .replace(card, "[REDACTED_CARD]")
}

/**
 * Drops repeats: apps re-post the same notification when it's updated, when the
 * phone restarts, or when a group is expanded. Same app + same text within the
 * window = one item.
 */
class DedupeCache(private val windowMillis: Long = 10 * 60 * 1000L, private val capacity: Int = 300) {
    private val seen = LinkedHashMap<String, Long>(capacity, 0.75f, true)

    @Synchronized
    fun firstTime(c: Candidate, now: Long): Boolean {
        val key = "${c.app}\u0000${c.title}\u0000${c.text}"
        val last = seen[key]
        seen[key] = now
        while (seen.size > capacity) seen.remove(seen.keys.first())
        return last == null || now - last > windowMillis
    }
}
