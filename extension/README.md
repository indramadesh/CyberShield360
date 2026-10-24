# CyberShield 360 Browser Protection (Chrome Extension)

A lightweight **Manifest V3** Chrome extension that checks suspicious links as you
browse and blocks known-malicious sites — powered by the existing CyberShield 360
backend (it does **not** implement its own risk engine).

> Assessments, not guarantees. It does not replace Chrome's built-in protection.

## What it does
- **Automatic protection (default on):** scans each page you open via the platform's
  `/scans` API and, if the risk score ≥ your threshold (default **50**), **blocks** it
  with a warning page; below the threshold it shows a details **notification** + a
  toolbar badge. Page content is never read — only the URL is analyzed.
- **Analyze the current site** on demand, plus a **multi-type scanner** in the popup:
  URL, Message (SMS/chat), Email, QR-code image, Image/screenshot, and Website
  (sandboxed) — all via the platform's existing `/scans`, `/scans/upload` and
  `/scans/website` endpoints.
- **Block known-bad domains** pre-emptively using `declarativeNetRequest`.
- **Settings**: backend URL, website URL, protection on/off + level, **automatic page
  checks**, **block threshold**, **notify below threshold**, trusted sites.
- Works sensibly when the backend is offline (shows an "unavailable" state; existing
  block rules are kept rather than wiped).

## Permissions (least-privilege)
| Permission | Why |
|-----------|-----|
| `activeTab` | Read the current tab's URL when you click the extension (manual analyze). |
| `webNavigation` | Observe page navigations so pages can be **auto-checked** (URL only, no content). |
| `notifications` | Show a details notification for lower-risk pages. |
| `storage` | Save settings + a small bounded local cache. |
| `declarativeNetRequest` | Block known-malicious domains at the network layer. |
| `alarms` | Refresh the known-bad list hourly. |
| host: `localhost:8000` | Reach your CyberShield 360 backend. Other hosts are requested at runtime via the options page (`optional_host_permissions`). |

No `tabs`, no `<all_urls>` content scripts, no page-content reading. It never collects
passwords, OTPs, cookies or payment data, and never uploads browsing history.

## Structure
```
extension/
  manifest.json          MV3 manifest
  background.js          service worker (DNR block rules + refresh)
  popup.html / popup.js  on-demand analysis UI
  options.html / .js     settings
  warning.html / .js     block interstitial
  shared/                api.js, storage.js, url.js, risk.js (ES modules)
  icons/                 16/32/48/128 png
  styles.css
  scripts/               validate.mjs, package.mjs (dependency-free)
  tests/                 node --test unit tests
```

## Build & package
No transpile step — it loads as-is. The scripts validate and zip it.
```bash
cd extension
npm run validate     # manifest + source + secret-scan checks
npm run test         # unit tests (url/risk logic)
npm run package      # -> ../artifacts/cybershield360-extension-v<ver>.zip (+ .sha256, release-manifest.json)
npm run build        # validate + package
```
`package` also writes a **store-ready unpacked dir** at `extension/dist/` and copies the
ZIP + `release-manifest.json` to `frontend/public/downloads/` so the website can serve it.

## Install (manual / developer)
1. `npm run build` (or download the ZIP from the website's **Browser Protection** page) and **extract** it.
2. Open `chrome://extensions` → enable **Developer mode** → **Load unpacked**.
3. Select the folder containing `manifest.json` (the extracted ZIP, or `extension/dist`).
4. Open the extension → **Settings** → set the **Backend URL** (e.g. `http://localhost:8000`,
   or your public URL) and click **Grant access to backend host** if it's not localhost.

See `INSTALLATION.md`, `PRIVACY_POLICY.md`, `EXTENSION_ARCHITECTURE.md`,
`EXTENSION_API_CONTRACT.md`, and `EXTENSION_SECURITY_THREAT_MODEL.md` for details.

## Chrome Web Store
Not published yet. The store-ready ZIP (`npm run build`) can be uploaded to the Chrome
Web Store developer dashboard; publication requires Google's review. The website shows a
"pending publication" state until then — no fabricated listing.
