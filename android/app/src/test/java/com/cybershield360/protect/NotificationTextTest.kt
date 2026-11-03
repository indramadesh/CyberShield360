package com.cybershield360.protect

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class NotificationTextTest {
    private val own = "com.cybershield360.protect"
    private val selected = setOf("com.whatsapp")

    private fun fields(
        pkg: String = "com.whatsapp", title: String? = "Unknown", text: String? = "Hello",
        big: String? = null, lines: List<String> = emptyList(), summary: Boolean = false, ongoing: Boolean = false,
    ) = NotificationFields(pkg, title, text, big, lines, summary, ongoing, 1_000L)

    private fun extract(f: NotificationFields, paused: Boolean = false) = NotificationText.extract(f, selected, own, paused)

    @Test fun unselectedAppIsSkipped() = assertEquals(Skip.NOT_SELECTED, extract(fields(pkg = "com.android.chrome")).second)

    @Test fun ownAppIsSkipped() = assertEquals(Skip.OWN_APP, NotificationText.extract(fields(pkg = own), selected + own, own, false).second)

    @Test fun pausedSkipsEverything() = assertEquals(Skip.PAUSED, extract(fields(), paused = true).second)

    @Test fun groupSummaryIsSkipped() = assertEquals(Skip.GROUP_SUMMARY, extract(fields(summary = true)).second)

    @Test fun ongoingIsSkipped() = assertEquals(Skip.ONGOING, extract(fields(ongoing = true)).second)

    @Test fun hiddenPreviewHasNothingToSend() {
        val (c, skip) = extract(fields(text = null, big = "  "))
        assertNull(c)
        assertEquals(Skip.NO_TEXT, skip)
    }

    @Test fun bigTextPreferredAndNeverMarkedComplete() {
        val c = extract(fields(text = "You won…", big = "You won a prize! Pay Rs 99 to claim")).first!!
        assertEquals("You won a prize! Pay Rs 99 to claim", c.text)
        assertFalse(c.complete)
    }

    @Test fun inboxStyleLinesAreJoined() {
        val c = extract(fields(text = null, lines = listOf("Hi", "", "Click http://x.example"))).first!!
        assertEquals("Hi\nClick http://x.example", c.text)
    }

    @Test fun secretsAreRedactedBeforeSending() {
        val c = extract(fields(text = "Your OTP is 482913. Password: hunter2. Card 4111 1111 1111 1111")).first!!
        assertFalse(c.text.contains("482913"))
        assertFalse(c.text.contains("hunter2"))
        assertFalse(c.text.contains("4111"))
        assertTrue(c.text.contains("OTP"))
    }

    @Test fun duplicatesWithinWindowAreDropped() {
        val cache = DedupeCache(windowMillis = 600_000)
        val c = extract(fields()).first!!
        assertTrue(cache.firstTime(c, 0))
        assertFalse(cache.firstTime(c, 60_000))
        assertTrue(cache.firstTime(c, 60_000 + 600_001))
        assertTrue(cache.firstTime(c.copy(text = "different"), 60_000))
    }

    @Test fun pairingLinkOnlyAcceptsSafeServers() {
        assertEquals("https://cs.example.com", PairingLink.server(" https://cs.example.com/ "))
        assertEquals("http://10.0.2.2:8010", PairingLink.server("http://10.0.2.2:8010"))
        assertNull(PairingLink.server("http://evil.example.com"))
        assertNull(PairingLink.server("javascript:alert(1)"))
        assertNull(PairingLink.server("https://x.example/path?q=1"))
        assertEquals("AB12-CD34", PairingLink.code("ab12-cd34<script>"))
    }

    @Test fun dedupeCacheIsBounded() {
        val cache = DedupeCache(capacity = 3)
        val base = extract(fields()).first!!
        for (i in 0 until 10) cache.firstTime(base.copy(text = "m$i"), 0)
        assertTrue(cache.firstTime(base.copy(text = "m0"), 0)) // evicted, so seen as new
    }
}
