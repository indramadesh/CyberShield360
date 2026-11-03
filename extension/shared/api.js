// Backend API client. Reuses the existing CyberShield 360 scan engine — the
// extension does NOT implement its own risk scoring.
import { getSettings, cacheGet, cacheSet } from "./storage.js";
import { normalizeUrl } from "./url.js";

async function base() {
  const s = await getSettings();
  return (s.apiBase || "http://localhost:8000").replace(/\/+$/, "");
}

// A scan that hangs is worse than "unknown": give up after this long.
// (A sleeping free-tier server can take ~1 minute to wake; see wakeBackend.)
const TIMEOUT_MS = 15_000;

async function getJson(path, init = {}, timeoutMs = TIMEOUT_MS) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  let res;
  try {
    res = await fetch((await base()) + path, { ...init, signal: ctl.signal });
  } catch (e) {
    throw new Error(e && e.name === "AbortError" ? "The CyberShield360 server didn't answer in time." : "Couldn't reach the CyberShield360 server.");
  } finally {
    clearTimeout(timer);
  }
  let body = {};
  try { body = await res.json(); } catch { /* non-JSON */ }
  if (!res.ok || body.success === false) {
    const msg = (body.error && body.error.message) || `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return body.data;
}

export async function getHealth() {
  return getJson("/api/v1/extension/health");
}

/** Wakes a sleeping server (free hosting) so the first real scan is fast. Never throws. */
export async function wakeBackend() {
  try { await getJson("/health", {}, 90_000); return true; } catch { return false; }
}

/** True when `apiBase` answers /health within `ms`. */
export async function reachable(apiBase, ms = 3000) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try { return (await fetch(apiBase.replace(/\/+$/, "") + "/health", { signal: ctl.signal })).ok; }
  catch { return false; }
  finally { clearTimeout(timer); }
}

export async function getBlocklist() {
  const d = await getJson("/api/v1/extension/blocklist");
  return (d && d.domains) || [];
}

// Text-based scans: URL | MESSAGE | EMAIL | QR (decoded text).
export async function analyzeScan(type, payload) {
  return getJson("/api/v1/scans", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, payload }),
  });
}

// Website analysis (sandboxed on the backend; SSRF-guarded there).
export async function analyzeWebsite(url) {
  return getJson("/api/v1/scans/website", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
}

// File uploads: IMAGE (OCR) or QR (image decoded server-side).
export async function analyzeUpload(file, scanType) {
  const form = new FormData();
  form.append("file", file);
  form.append("scan_type", scanType);
  const res = await fetch((await base()) + "/api/v1/scans/upload", { method: "POST", body: form });
  let body = {};
  try { body = await res.json(); } catch { /* */ }
  if (!res.ok || body.success === false) {
    throw new Error((body.error && body.error.message) || `Upload failed (${res.status})`);
  }
  return body.data;
}

// Analyze a URL through the platform's scan engine (anonymous is allowed).
export async function analyzeUrl(url, { useCache = true } = {}) {
  const norm = normalizeUrl(url);
  const s = await getSettings();
  const key = "u:" + norm;
  if (useCache) {
    const hit = await cacheGet(key, s.cacheTtlMin);
    if (hit) return { ...hit, _cached: true };
  }
  const data = await getJson("/api/v1/scans", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "URL", payload: norm }),
  });
  await cacheSet(key, data);
  return data;
}

// ---------------------------------------------------------------------------
// Message Protection: "Check with CyberShield360" on selected text.
// Paired -> saved to the user's Message Protection history via a revocable device
// token (kept in chrome.storage.local, never in a web page). Not paired -> the
// anonymous scan endpoint, exactly like the scanner page.
// ---------------------------------------------------------------------------
const MAX_SELECTION = 8000;

export function getDeviceToken() {
  return new Promise((resolve) => chrome.storage.local.get("deviceToken", (d) => resolve((d && d.deviceToken) || "")));
}

export async function pairDevice(code) {
  const data = await getJson("/api/v1/msgintel/devices/pair", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: String(code || "").trim(), device_name: "Browser extension", platform: "chrome" }),
  });
  await new Promise((r) => chrome.storage.local.set({ deviceToken: data.device_token }, r));
  return data.source;
}

export function unpairDevice() {
  return new Promise((r) => chrome.storage.local.remove("deviceToken", r));
}

export async function checkSelection(text) {
  const clipped = String(text || "").slice(0, MAX_SELECTION);
  const token = await getDeviceToken();
  if (token) {
    const d = await getJson("/api/v1/msgintel/device/events", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Device-Token": token },
      body: JSON.stringify({ items: [{ source_type: "shared_text", app: "browser", text: clipped, complete: true }] }),
    });
    const r = (d.results || [])[0] || {};
    if (!r.accepted) throw new Error(r.message || "The check wasn't accepted.");
    return { saved: true, classification: r.classification, risk_level: r.risk_level, risk_score: r.risk_score,
             headline: r.headline, path: r.report_path };
  }
  const s = await analyzeScan("MESSAGE", clipped);
  const top = (s.evidence || []).find((e) => (e.weight || 0) > 0);
  return { saved: false, risk_level: s.risk_level, risk_score: s.risk_score,
           headline: top ? top.summary : null, path: `/app/scans/${s.scan_id}` };
}
