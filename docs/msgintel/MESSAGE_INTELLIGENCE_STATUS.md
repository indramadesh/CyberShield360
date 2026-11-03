# Message Intelligence — status

Last updated 2026-11-03. "Tested" means actually run, with the result shown; nothing
here is estimated.

## Phases

| Phase | Status |
|---|---|
| 0 Audit | Done — [AUDIT](MESSAGE_INTELLIGENCE_AUDIT.md) |
| 1 Capability matrix + architecture | Done — [MATRIX](PLATFORM_CAPABILITY_MATRIX.md), [ARCHITECTURE](MESSAGE_INTELLIGENCE_ARCHITECTURE.md) |
| 2 Data contracts | Done (`app/messaging/schema.py`, 10 tables, migration `eb364a033866`) |
| 3 Privacy gateway + consent | Done (`gateway.py`) — [PRIVACY](MESSAGE_INTELLIGENCE_PRIVACY.md) |
| 4 Unified analysis | Done (`analysis.py`, `email_signals.py`, reuses all existing detectors + risk engine) |
| 5 Android notifications | **Built and tested on an Android 16 (API 36) emulator** |
| 6 Gmail | Implemented; tested against a fake Google server. **Not tested with a real Google account** (needs your OAuth app) |
| 7 Outlook | Implemented; tested against a fake Graph server. **Not tested with a real Microsoft account** (needs your Azure app) |
| 8 Desktop browser | Done: right-click "Check with CyberShield360" + pairing in the existing extension (v1.5.0). Not loaded into a real Chrome in this session |
| 9 iOS | **Code written, not built or tested** (no Mac/Xcode here). Backend endpoint for the SMS filter is tested |
| 10 Alerts | Done (levels, quiet hours, hourly cap, one alert per item; Android shows its own alert) |
| 11 Dashboard | Done (`/app/protection`: overview, sources, detected messages with filters, alerts & privacy) |
| 12 Reports | Done (`/app/protection/items/:id`: observed evidence vs classification, auth results, links, attachments, limitations, feedback) |
| 13 Incident response | Done: reuses `/app/incident`; two scenarios added (account compromised, opened attachment) |
| 14 Hardening | Done: see PRIVACY. Production refuses mail connectors without `TOKEN_ENCRYPTION_KEY` |
| 15 Tests | See below |
| 16 Deployment + docs | Done: env templates, `render.yaml`, GitHub Actions secrets, this folder |

## Test results (run 2026-11-03)

| Suite | Result |
|---|---|
| Backend `pytest` (all) | **204 passed, 0 failed** (incl. new `test_msgintel_engine.py`, `test_msgintel_api.py`, `test_msgintel_connectors.py`) |
| Alembic | upgrade → downgrade → upgrade OK; `alembic check`: no drift |
| Frontend `tsc`, `vitest` (22), `vite build` | Pass |
| Extension `npm test` (6), package build | Pass |
| Android unit tests (JUnit, 12) | Pass |
| Android APK build (`assembleDebug`) | Pass |

### Android emulator end-to-end (Pixel-class AVD, Android 16 / API 36, Google Play image)

Real app, real NotificationListenerService, isolated test backend:

| Case | Observed |
|---|---|
| Disclosure → pairing link → Pair | Paired; status screen shown |
| Notification access granted / revoked / re-granted | Dashboard showed connected → permission_revoked → connected |
| Scam notification from a selected app | PHISHING · CRITICAL 80, completeness "partial"; CyberShield360 alert shown on the phone |
| Normal notification | UNKNOWN · LOW (not called safe) |
| Same notification twice | Stored once |
| Notification with no text (hidden preview) | Nothing sent |
| OTP in the notification | Not stored anywhere (checked in the database) |
| Monitoring paused on the website | Server refused the item |
| Network off → item → network on | Queued, then sent automatically |
| Item queued → phone restarted | Delivered after restart (persisted job) |
| App selection changed on the website | Phone adopted it |

Not covered by the emulator run: OEM battery savers (Samsung/Xiaomi kill background apps more
aggressively than stock Android), Android 15+ OTP redaction (needs a real OTP-bearing notification
from a messaging app), grouped notifications from a real messaging app.

### Detection quality

No labelled dataset exists in the repo, so **precision, recall, F1 and false-positive rates have
not been measured**. The tests check specific known cases only. Two false positives found during
this work were fixed in the shared scanners: `amazon.in` links flagged as fake Amazon, and genuine
OTP messages ("do not share it") flagged as credential requests.

## Remaining external setup / approvals

| Item | Who | Notes |
|---|---|---|
| Google Cloud OAuth client (Web), Gmail API enabled, consent screen with `gmail.readonly` | You | Testing mode works for up to 100 listed test users. Public release needs Google verification + an annual third-party security assessment for this restricted scope |
| Azure app registration (Web), `Mail.Read`, `User.Read`, `offline_access`, client secret | You | Personal accounts: user consent. Some work tenants require admin consent |
| `TOKEN_ENCRYPTION_KEY`, `PUBLIC_BASE_URL` on Render and in GitHub secrets | You | Required before mail connectors appear in production |
| Google Play listing for the Android app | You | Notification-listener use must be declared and justified; signing key; privacy policy |
| Apple Developer account, Xcode build, App Store review | You | Plus `apple-app-site-association` for the SMS filter domain |
| Chrome Web Store update (1.5.0 adds `contextMenus`) | You | Store review |
