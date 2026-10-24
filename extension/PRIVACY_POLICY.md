# CyberShield 360 Browser Protection — Privacy Policy

_Last updated: 2026-10-24_

This policy describes what the extension actually does (not aspirational behavior).

## What we DON'T do
- We do **not** collect passwords, OTPs, session cookies, or payment-card data.
- We do **not** read the content of the pages you visit.
- We do **not** upload your browsing history.
- We do **not** embed or transmit any third-party API keys.
- We do **not** send data to anyone except the CyberShield 360 backend **you configure**.

## What we DO
- **Automatic page checks (on by default):** when protection + automatic checks are
  enabled, the **URL of each page you open** is sent to your configured backend for
  analysis. Pages at/above your block threshold are blocked (warning page); lower-risk
  pages may show a details notification. Page **content is never read** — only the URL.
  You can turn automatic checks off in Settings (manual "Analyze" still works).
- When you click **Analyze**, the current tab's URL is sent to your configured backend
  for analysis. When you paste a link and click **Check**, that URL is sent.
- A small, bounded list of **known-bad domains** is fetched from your backend to power
  local blocking rules. No browsing data is sent to obtain it.
- We store your **settings** and a small **cache of recent results** locally in the
  browser (`chrome.storage.local`). The cache is size-bounded and expires.

## Data sharing
The extension talks only to the backend URL you set in Settings. That backend may, per
its own configuration, consult threat-intelligence providers — see the platform's
privacy and security docs. The extension itself contacts no other services.

## Your controls
- Turn protection on/off, choose Standard/Enhanced, and manage trusted sites in Settings.
- Clear the local cache at any time in Settings.
- Uninstalling the extension removes all locally stored settings and cache.

## Contact
This is an educational/defensive project. Report issues through the CyberShield 360
website's Browser Protection page.
