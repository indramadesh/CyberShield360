# Message Intelligence — privacy & consent

Notifications and email can contain very personal content. These are the rules
the code enforces (not just aspirations).

## Consent and control

| Control | Where enforced |
|---|---|
| Nothing is monitored until the user connects a source | Sources exist only after OAuth or device pairing |
| Explicit consent per source (versioned disclosure) | `msg_consents`; pairing requires `consent: true`; the Android app shows a full disclosure before anything else; ingestion fails with `no_consent` without it |
| Per-app selection on Android; none selected by default | Phone-side picker + server-side `app_not_selected` check |
| Pause everything / pause one source | `msg_settings.paused` (gateway rejects with `paused`); source `status: paused` |
| Disconnect | Revokes consent and device tokens; deletes OAuth tokens; calls Google's revoke endpoint; tells the user how to remove Microsoft's grant (Graph has no revoke API for this) |
| Delete history | Per item, per source, or everything (`DELETE /events`) |
| Retention | Default 30 days, user-set 1–365; the `msgintel_retention` job deletes expired items |
| Read-only | Gmail `gmail.readonly`; Microsoft `Mail.Read`. No send/modify/delete scopes are requested; nothing is ever sent, moved, deleted, forwarded or blocked |

## Data minimisation

- **Message bodies are not stored.** An item keeps: sender display (redacted), sender domain, subject (redacted, ≤200 chars), indicators, links, attachment names/types/sizes, the analysis, and **no preview** unless the user turns previews on (then ≤300 redacted chars).
- **Secret values are removed before analysis and storage**: OTP / verification-code values, `password: …` values, card numbers, plus the existing PII redaction (phone, email, PAN, Aadhaar, UPI ID). The Android app strips OTPs, passwords and card numbers before sending.
- The Android app never reports the phone's installed apps, only the apps the user selected. It requests no SMS, call-log, contacts or `QUERY_ALL_PACKAGES` permission.
- The browser extension reads nothing unless the user selects text and chooses "Check with CyberShield360".
- The iOS SMS-filter endpoint is stateless: Apple sends no user identity, and the text is analysed in memory only.
- Audit logs record actions (paired, connected, disconnected, history deleted) and counts, never message content.

## Security

- OAuth tokens: Fernet-encrypted at rest (`TOKEN_ENCRYPTION_KEY`), never returned by the API and never in the browser.
- Device tokens: only their SHA-256 is stored; on Android the token is encrypted with an Android Keystore AES-GCM key.
- Every query is scoped to the authenticated user; ids from other users return 404. Device tokens can't call user endpoints.
- Transport: HTTPS. Android blocks cleartext except to the local development host (`10.0.2.2`).
- No link in a message is ever opened by the backend.

## What users are told

The dashboard, pairing dialog and Android onboarding say that notifications can contain private
conversations; that only selected apps are checked; that one-time codes are hidden by Android 15+;
and that WhatsApp/iMessage conversations can't be read. Each report lists its own limitations.
