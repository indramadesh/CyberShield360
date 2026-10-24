// Settings + a small expiring cache, stored in chrome.storage.local.
// Only minimal, non-sensitive data is kept (no tokens, no full browsing history).

export const DEFAULTS = {
  apiBase: "http://localhost:8000", // CyberShield 360 backend
  appUrl: "http://localhost:5173",  // CyberShield 360 website
  protectionEnabled: true,          // master for AUTOMATIC protection (scan + block as you browse)
  protectionLevel: "standard",      // standard | enhanced
  autoScan: true,                   // automatically check each page you open
  manualEnabled: true,              // show the on-demand manual scan tools
  riskThreshold: 50,                // >= this risk score (0-100) => block
  notifyBelowThreshold: true,       // show a details notification for lower-risk pages
  trustedSites: [],                 // domains the user explicitly trusts
  cacheTtlMin: 30,
};

export function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get("settings", (d) =>
      resolve({ ...DEFAULTS, ...((d && d.settings) || {}) }),
    );
  });
}

export async function setSettings(patch) {
  const next = { ...(await getSettings()), ...patch };
  return new Promise((resolve) => chrome.storage.local.set({ settings: next }, () => resolve(next)));
}

// ---- tiny expiring cache ----
function readCache() {
  return new Promise((resolve) => chrome.storage.local.get("cache", (d) => resolve((d && d.cache) || {})));
}
function writeCache(obj) {
  return new Promise((resolve) => chrome.storage.local.set({ cache: obj }, () => resolve()));
}

export async function cacheGet(key, ttlMin) {
  const cache = await readCache();
  const entry = cache[key];
  if (!entry) return null;
  if (Date.now() - entry.ts > ttlMin * 60_000) return null;
  return entry.val;
}

export async function cacheSet(key, val) {
  const cache = await readCache();
  cache[key] = { val, ts: Date.now() };
  // Bound the cache to ~200 entries (drop oldest).
  const keys = Object.keys(cache);
  if (keys.length > 200) {
    keys.sort((a, b) => cache[a].ts - cache[b].ts).slice(0, keys.length - 200)
      .forEach((k) => delete cache[k]);
  }
  await writeCache(cache);
}

export async function clearCache() {
  await writeCache({});
}

// ---- "allow once" list: hosts the user chose to proceed to past an auto-block.
// Prevents an immediate re-block loop. Entries expire.
function readAllow() {
  return new Promise((resolve) => chrome.storage.local.get("allowOnce", (d) => resolve((d && d.allowOnce) || {})));
}
export async function allowOnce(host, minutes = 15) {
  const a = await readAllow();
  a[host.toLowerCase()] = Date.now() + minutes * 60_000;
  return new Promise((resolve) => chrome.storage.local.set({ allowOnce: a }, () => resolve()));
}
export async function isAllowed(host) {
  const a = await readAllow();
  const exp = a[host.toLowerCase()];
  if (!exp) return false;
  if (Date.now() > exp) { delete a[host.toLowerCase()]; chrome.storage.local.set({ allowOnce: a }); return false; }
  return true;
}
