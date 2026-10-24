# Installing CyberShield 360 Browser Protection

> A downloaded ZIP cannot be installed by double-clicking it. Chrome only installs
> extensions from the Web Store, or from an **extracted folder** via Developer mode.

## A. Manual install (developer mode) — works today

1. **Get the extension folder**, either:
   - Download the ZIP from the website's **Browser Protection** page and **extract** it; or
   - Build it: `cd extension && npm run build` → use `extension/dist/`.
2. Open **`chrome://extensions`** in Chrome (or any Chromium browser: Edge, Brave).
3. Toggle **Developer mode** on (top-right).
4. Click **Load unpacked**.
5. Select the folder that contains **`manifest.json`** (the extracted ZIP folder, or
   `extension/dist`). The CyberShield 360 shield icon appears in your toolbar.
6. Click the icon → the gear/**Settings** → set:
   - **Backend URL** — where CyberShield 360 runs (e.g. `http://localhost:8000`, or your
     public URL). Click **Test connection** to confirm.
   - If the backend is **not** `localhost`, click **Grant access to backend host**.

## B. Build from source

```bash
cd extension
npm run validate   # structure + secret scan
npm run test       # unit tests
npm run package    # creates ../artifacts/cybershield360-extension-v<ver>.zip + store-ready dist/
```

Outputs:
- `artifacts/cybershield360-extension-v<ver>.zip` — manual-install / store-upload ZIP
- `artifacts/cybershield360-extension-v<ver>.zip.sha256` — checksum
- `artifacts/release-manifest.json` — version/size/checksum/permissions
- `extension/dist/` — store-ready **unpacked** directory (manifest at root)
- copies published to `frontend/public/downloads/` for the website

## C. Chrome Web Store (not yet published)

The `artifacts/…zip` (or `extension/dist`) is store-ready. To publish:
1. Go to the Chrome Web Store **Developer Dashboard** and pay the one-time fee if needed.
2. Upload the ZIP, fill in description, screenshots, and **permission justifications**
   (see README), and a privacy policy (`PRIVACY_POLICY.md`).
3. Submit for review. Google approval is required before the "Add to Chrome" button on
   the website becomes real — it currently shows "pending publication".

## Troubleshooting
- **Popup says "Backend offline":** start the backend and/or fix the Backend URL in Settings; for non-localhost, click *Grant access*.
- **Blocking doesn't trigger:** ensure Protection is on; the demo blocklist only contains a few synthetic domains (e.g. `account-verify-login.example`).
- **"This page can't be analyzed":** the tab is a browser-internal page (`chrome://`, etc.), which extensions cannot inspect.
