# Message Intelligence — API

All paths are under `/api/v1/msgintel` and return the standard envelope
`{"success": true, "data": …, "request_id": …}`. The whole module is behind the
`message_protection` feature flag (404 when disabled).

## Session (signed-in user)

| Method & path | Purpose |
|---|---|
| `GET /capabilities` | Which connectors this server offers, and what isn't possible (public) |
| `GET /overview` | Counts, sources, last activity, recent alerts, paused flag |
| `GET /sources` | Connected sources with real state (`display_state`: connected, paused, permission_revoked, error, not_reporting, never_reported, never_synced) |
| `PATCH /sources/{id}` | `{status: "connected"\|"paused", apps: [...]}` |
| `DELETE /sources/{id}?delete_history=bool` | Disconnect: revoke consent, device tokens, OAuth tokens (Google revoke call); optional history deletion. Returns a `note` for anything the user must do themselves (Microsoft) |
| `POST /pairing` | `{kind: "android_notifications"\|"browser_extension", consent: true}` → one-time code (10 min) |
| `POST /analyze` | `{kind: "message"\|"email", content}` → full report; runs even while monitoring is paused |
| `GET /events` | Filters: `classification`, `source_id`, `source_type`, `since`, `until` (dates), `page`, `page_size` (≤100) |
| `GET /events/{id}` | Detailed report: evidence, URLs, attachments, authentication, limitations, recommendations, engine version, feedback |
| `POST /events/{id}/feedback` | `{verdict: "correct"\|"incorrect", suggested_classification?, note?}` |
| `DELETE /events/{id}` · `DELETE /events?source_id=` | Delete one item / all history (or one source's) |
| `GET /alerts?status=` · `PATCH /alerts/{id}` | List alerts; `{status: "seen"\|"dismissed"}` |
| `GET /settings` · `PUT /settings` | `paused, store_previews, retention_days (1–365), alert_critical/high/medium, quiet_start/end ("HH:MM"), clear_quiet_hours, timezone (IANA), max_alerts_per_hour (1–60)` |
| `POST /connect/{gmail\|outlook}` | → `{authorize_url}` (409 `NOT_CONFIGURED` when the OAuth app isn't set) |
| `GET /oauth/{provider}/callback` | Provider redirect target; redirects to `/app/protection?connected=…` or `?connect_error=…` |
| `POST /sources/{id}/sync` | Sync a mail account now |

## Device (header `X-Device-Token`)

| Method & path | Purpose |
|---|---|
| `POST /devices/pair` (no auth) | `{code, device_name, platform}` → `{device_token, source}`. Code is single-use; endpoint is in the strict (auth) rate-limit tier |
| `GET /device/config` | `{status, paused, apps}`; the phone adopts the server's app list |
| `POST /device/status` | `{notification_access, selected_apps, paused, app_version}`; revoked access → `permission_revoked` |
| `POST /device/events` | `{items: [{source_type: "notification"\|"shared_text", app, title, text, posted_at, external_id, complete}]}` (1–25) → per-item `{accepted, duplicate, event_id, classification, risk_level, risk_score, confidence, alert, headline, report_path}` or `{accepted: false, reason}` with reason `source_inactive \| no_consent \| paused \| app_not_selected` |

## Apple relay (no auth, stateless)

`POST /ios/message-filter` — Apple's network-deferral body
`{"_version":1,"query":{"sender":…,"message":{"text":…}},"app":{"version":…}}` →
`{"action": "junk"|"promotion"|"none", "classification", "risk_level", "engine_version"}`. Nothing is stored.
