// Backend API client. Reuses the existing CyberShield 360 scan engine — the
// extension does NOT implement its own risk scoring.
import { getSettings, cacheGet, cacheSet } from "./storage.js";
import { normalizeUrl } from "./url.js";

async function base() {
  const s = await getSettings();
  return (s.apiBase || "http://localhost:8000").replace(/\/+$/, "");
}

async function getJson(path, init) {
  const res = await fetch((await base()) + path, init);
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
