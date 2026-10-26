# UI Redesign — Status

Last updated: 2026-10-26. Companion docs: [UI_UX_AUDIT.md](UI_UX_AUDIT.md) ·
[PAGE_INVENTORY.md](PAGE_INVENTORY.md) · [UI_IMPLEMENTATION_PLAN.md](UI_IMPLEMENTATION_PLAN.md) ·
[DESIGN_SYSTEM.md](DESIGN_SYSTEM.md)

## Pass 2 — strict match to the reference sheet (2026-10-26)

The first pass used the right theme but reinterpreted the layouts. Pass 2 rebuilt
each screen panel-by-panel against the 11-panel reference sheet:

| Panel | Now |
|---|---|
| 1 Landing hero | Rebuilt scene (aurora, HUD-ring shield portal, rim-lit ranges, lake, explorer on ledge), vertical tagline, Get Started / Watch Demo / Download Extension, pillars in one glass strip |
| 2 Sign in / up | Centered glass card over the scene, Sign In / Sign Up tabs, "Forgot password?" in the field, Google / Apple / Microsoft shown **disabled — "coming soon"** (no OAuth backend; user's choice) |
| 3 Dashboard | Greeting, "checks today" sparkline card, 4 metric cards (week-over-week change computed from real history), Quick Scan pills + inline Scan (auto-runs), Recent Scans tiles, Today's Tip card |
| 4 Scan & Analyze | Header illustration, pill tabs, inline Analyze, "Try these examples", Advanced Options (sandboxed website analysis lives here) |
| 5 Scan result | Target + scan time header, risk banner (level, score, confidence, indicator chips), Overview / Technical Details / Domain Info / Similar Websites tabs, Visit Anyway (confirm) / Report / Share |
| 6 Extension popup | Status shield + headline (shows the automatic check result on open), Analyze This Site, 4 tiles, Protection + Manual switches |
| 7 Block page | Red scene, warning triangle, URL pill, Risk Level / Category / Confidence, Go Back / View Details, "I understand the risk, continue anyway" |
| 8 Learning Hub | Topic chips (only topics that have lessons), illustrated cards, real read time and quiz count, completion badges |
| 9 News | Filter chips, rows with thumbnails, severity badge, Read More dialog with source link |
| 10 Reports | All Types / date-range dropdowns, list rows with type tile, risk badge, date, delete, chevron |
| 11 Settings | Toggle rows (Notifications, Sync Scan History, Dark Mode, Reduce Motion — all functional; Real-time Protection links to the extension), link rows (Account, Privacy & Data, Help, About) |

Also added in pass 2:
- **Light theme is the default**; a light/dark switch sits in the top-right of the hero and the app bar. The hero/auth artwork has a matching dawn palette.
- **Landing gate**: until a visitor signs up, signs in or picks "Continue as guest", every control on the public pages except Get Started, Watch Demo, Download Extension and the theme switch opens **Sign Up**, remembering the destination (`?next=`).
- Live Alerts page (`/app/alerts`) and an alert bell with a real count.
- Deviations from the mockup, all to avoid fake data/features: no "Free Plan" label (no plans exist — shows the role); "Threats found" instead of "Threats blocked" (the web app doesn't block); no "Scan on link hover" toggle (the extension has no such feature); "Domain Info" instead of "Whois Info" (no WHOIS lookup); lesson difficulty isn't shown (not in the data).

Verification for pass 2: `npx tsc` clean · `vitest` 15/15 · `npm run build` clean ·
backend `pytest` 100/100 · extension validate + 6/6 tests + packaged v1.4.0 ·
`node tools/ui-check.mjs` 59/59 (now starts from a clean visitor every run).

## Phases (pass 1)

| Phase | Scope | Status |
|---|---|---|
| 0 | Audit, route/feature inventory, reference review | Done |
| 1 | Emerald design system: tokens, fonts, primitives, new components | Done |
| 2 | App shell: sidebar, top-bar scan search, mobile drawer, account menu | Done |
| 3 | Cinematic landing, split-screen auth, About, Contact, Forgot password, 404 | Done |
| 4 | Dashboard with real metrics, 7-day activity, Quick scan, alerts | Done |
| 5 | Scanner: type grid, samples, FileDrop, QR camera/upload/paste, `?q=` auto-detect | Done |
| 6 | Forensic result (gauge, findings, actions, feedback, copy link, JSON export) + `/app/scans/:id` | Done |
| 7 | Browser Protection page + extension reskin (v1.4.0, SVG icons, new toolbar icon, changelog) | Done |
| 8 | News & updates (featured, search, filters, cyber law) and Learning hub (topics, search, lesson dialog) | Done |
| 9 | My reports (search/filter/sort/paginate/CSV/delete) and Settings | Done |
| 10 | States, responsive, accessibility pass | Done (see checks below) |
| 11 | Docs | Done |

## Routes

| Route | Page | Notes |
|---|---|---|
| `/` | New cinematic landing | |
| `/classic`, `/v2` | Previous landings | Kept, lazy-loaded |
| `/login`, `/register` | Split-screen auth | `/register` and `?mode=register` open Sign up |
| `/forgot-password` | Honest "not available" page | No email service exists |
| `/about`, `/contact` | Info pages | Contact lists only real channels (1930, cybercrime.gov.in, GitHub) |
| `/browser-protection` | Extension page | Reads `/downloads/release-manifest.json` |
| `/app` | Dashboard | |
| `/app/scan` | Scanner | Lazy-loaded (QR decoder) |
| `/app/scans/:scanId` | Saved report | Same access rules as the API (anti-IDOR) |
| `/app/reports` | My reports | Guests see a sign-in prompt |
| `/app/news` | News & updates | `/app/intel` redirects here |
| `/app/learn`, `/app/incident`, `/app/settings`, `/app/admin` | | Admin is role-gated |
| `*` | 404 | Separate in-shell 404 under `/app/*` |

## Backend changes (additive only)

- `GET /scans/{id}` adds `indicators`, `target`, `created_at`; `GET /scans` adds `target`.
  `target` is the already-redacted input with query string and fragment removed.
- `GET /config` adds `privacy` (retention days, raw-upload storage, PII redaction, max file size).
- Tests: `backend/tests/integration/test_ui_fields_api.py`.

## Verification (run 2026-10-26)

| Check | Result |
|---|---|
| `npm run build` (frontend) | Pass, no chunk-size warnings (vendor + route splitting) |
| `npx tsc --noEmit` | Pass |
| `npx vitest run` | 14/14 pass |
| Backend `pytest` | 100/100 pass |
| Extension `npm run validate` / unit tests / `npm run package` | Pass / 6/6 / v1.4.0 packaged with release notes |
| API end-to-end script (all scan types, auth, RBAC, content) | All OK |
| `node tools/ui-check.mjs` — real browser interactions | 52/52 pass on 5 of 6 runs; one run had a single timing-related failure that didn't recur (the checks use fixed waits) |

`tools/ui-check.mjs` covers: every public route; register validation and
register via the form; wrong-password error (no fake success); login; URL scan
from a sample; top-bar search auto-detecting a message; result feedback;
dashboard metrics matching real history; query strings stripped from targets;
reports filter, detail page, confirm-and-delete; news, learn, settings,
incident; `/app/intel` redirect; lesson dialog and quiz availability;
reduce-motion persistence; no horizontal scroll at 390px on 9 pages; mobile
nav drawer; guest gating on quizzes and reports; extension popup, warning and
options rendering; no uncaught console errors.

## Fixed during verification

- Timestamps: the API returns naive UTC strings; the UI now parses them as UTC
  (`parseApiDate`). Before, fresh scans showed "5 h ago" in IST and were left out of the chart.
- Activity chart bars had no height (percentage heights inside an auto-height column).
- Risk badges wrapped onto two lines in narrow rows.

## Known limitations / follow-ups

- Chrome Web Store listing is not published; the page says "pending publication".
- History metrics cover the most recent 100 scans (API cap); the UI labels this.
- News and law entries in the dev seed are `[DEMO]` items. They render as-is.
- Light theme is supported but was reviewed less thoroughly than dark (the default).
- The extension popup's live states (toggles, current-site result) need a real
  install to test. Static rendering was checked headless.
