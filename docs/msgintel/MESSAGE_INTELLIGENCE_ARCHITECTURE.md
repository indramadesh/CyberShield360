# Message Intelligence — architecture

```
 Platform agents                       Backend (FastAPI)                               Web app
 ───────────────                       ─────────────────                               ───────
 Android app ──(device token)──┐
   NotificationListener         │      /msgintel/device/*  ─┐
   share target                 │                           │
 Browser extension ─────────────┤                           ├─► Privacy gateway ─► Analysis engine ─► Alerts
   right-click "Check…"         │      /msgintel/analyze  ──┤   (gateway.py)       (analysis.py)       (gateway.py)
 Web app "Check it yourself" ───┘                           │       │                   │                  │
 Gmail / Outlook (OAuth) ◄── scheduler job mail_sync ───────┘       ▼                   ▼                  ▼
 iOS SMS filter (Apple relay) ─► /msgintel/ios/message-filter   msg_events          existing detectors   msg_alerts
                                   (stateless, nothing stored)  (redacted)          + threat intel        │
                                                                                    + risk_engine         ▼
                                                                                                Message Protection
                                                                                                dashboard + reports
```

## Components

| Component | Code | Responsibility |
|---|---|---|
| **A. Platform agents** | `android/`, `extension/` (context menu), `ios/` (unbuilt), `app/messaging/connectors/` | Collect only what the user chose; minimise and redact before sending. No detection logic on devices. |
| **B. Privacy gateway** | `app/messaging/gateway.py` | Ownership, connected status, active consent, pause, per-app scope, OTP/password stripping, deduplication, preview policy, retention expiry. Every item passes through `ingest()`. |
| **C. Unified analysis engine** | `app/messaging/analysis.py`, `email_signals.py` + existing `services/detectors/*`, `services/threat_intel.py`, `services/engine/risk_engine.py` | Text, URL, sender, authentication-result and attachment-metadata signals → one risk score / confidence → classification + evidence + limitations. |
| **D. Alerts & response** | `gateway.maybe_alert`, `incident_guidance.py` | One alert per item; level preferences, quiet hours, hourly cap; incident steps for 9 scenarios. |
| **E. Dashboards** | `frontend/src/features/protection/` | Overview, connected sources, detected messages with filters, detailed report, alerts & privacy settings. |

## Normalised message (`app/messaging/schema.py`)

`NormalizedMessage(source_type, source_provider, source_application, external_id, received_at,
sender{display_name,email,domain,raw_from}, subject, text, headers, reply_to, urls, attachments,
completeness, collection_method)`. Adapted from the conceptual schema in the brief:
- `user_id` is never part of the payload; the gateway takes it from the source, which comes from the authenticated session or device token.
- `html_content` isn't kept: collectors convert HTML to text and extract `href`s into `urls`.
- `completeness` (`full | partial | preview | metadata`) distinguishes notification text from full email.

## Classification rules (`analysis.py`)

1. Signals from the existing message + URL detectors, email signals, attachment metadata, threat intel.
2. Correlated signals are merged: the same indicator from several links counts once (strongest kept).
3. The existing risk engine produces score, band and confidence (unchanged; confidence ignores zero-weight info signals).
4. Categories (several allowed): PHISHING (credential / impersonation hints) and SCAM (fraud-family hints), only when risk isn't LOW.
5. Otherwise: SUSPICIOUS (elevated, no family), PROMOTIONAL / SPAM (marketing markers; SPAM when authentication fails or List-Unsubscribe is missing), LIKELY_LEGITIMATE (only a fully read email with a provider DMARC pass, or SPF + DKIM pass, and score < 10), else UNKNOWN. No content at all → risk UNKNOWN.
6. Engine version `msgintel-1.0-rules` is stored on every item.

## Sync & scheduling

Two jobs in the existing DB-leased scheduler (`app/content/scheduler.py`):
- `mail_sync`: every 5 min; a no-op when no OAuth app is configured. Gmail uses the History API; Outlook uses Graph delta on the Inbox.
- `msgintel_retention`: every 6 h; deletes expired items, expired OAuth states and old pairing codes.

Both run in the worker (`python -m app.content.worker`) or the embedded scheduler. On free hosting, the GitHub Actions `content-refresh` workflow runs the worker every 3 hours, so mail sync is that coarse there.

## Security boundaries

- User endpoints use the normal session; device endpoints accept only `X-Device-Token` (SHA-256 stored, revocable) and can act only on their own source.
- OAuth: server-side code flow + PKCE + single-use hashed state (10 min). Tokens are Fernet-encrypted at rest and never returned by any API.
- No link is ever fetched by this module; URL analysis is offline heuristics plus threat lists.
- Pasted email headers are never trusted for SPF/DKIM/DMARC; only the topmost `Authentication-Results` header from Gmail (`mx.google.com`) or Exchange Online counts.
