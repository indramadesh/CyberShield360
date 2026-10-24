# Extension Architecture

```
  Popup / Options / Warning (extension pages, ES modules)
        │  import ../shared/*
        ▼
  shared/  api.js ─ storage.js ─ url.js ─ risk.js
        │                    │
        │ fetch (host perms) │ chrome.storage.local
        ▼                    ▼
  CyberShield 360 backend     settings + bounded cache
  /api/v1/scans  (reused)
  /api/v1/extension/health
  /api/v1/extension/blocklist
        ▲
        │ hourly alarm / settings change
  background.js (service worker)
        │ declarativeNetRequest dynamic rules
        ▼
  main-frame navigations to known-bad domains → redirect → warning.html
```

**Principles**
- **Reuse, don't duplicate:** all risk scoring happens in the platform backend via
  `/scans`. The extension only presents results and manages block rules.
- **Least privilege:** `activeTab` + `storage` + `declarativeNetRequest` + `alarms`,
  backend host only (others requested at runtime). No content scripts, no page reading.
- **Two protection modes:**
  1. *On-demand* — popup analyzes the current tab / a pasted link.
  2. *Automatic blocking* — background keeps DNR rules from the backend blocklist,
     redirecting known-bad main-frame loads to the warning page.
- **Graceful degradation:** if the backend is unreachable, analysis shows an
  "unavailable" state and existing block rules are retained (not wiped).
- **Untrusted content:** the extension never injects page content into privileged
  pages and never executes site code; scanned URLs are data, not instructions.

**Contexts & messaging**
- Popup/options call the backend directly (extension pages inherit host permissions).
- `background.js` owns DNR rules and listens for `storage.onChanged`, an hourly
  `alarms` tick, and two messages: `REFRESH_RULES` and `TRUST_HOST`.

**Config** is stored in `chrome.storage.local` under `settings` (apiBase, appUrl,
protectionEnabled, protectionLevel, trustedSites, cacheTtlMin) with safe defaults.
