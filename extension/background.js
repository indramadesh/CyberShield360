// Service worker:
//   1) keeps declarativeNetRequest rules in sync with the backend known-bad list
//      (synchronous, pre-emptive block of listed domains), and
//   2) AUTO-SCANS each page you open via the backend: risk >= threshold -> block
//      (redirect to warning page), below threshold -> badge + optional notification.
// No page content is ever read — only the navigated URL is analyzed.
import { analyzeUrl, checkSelection, getBlocklist, reachable, wakeBackend } from "./shared/api.js";
import { DEFAULTS, getSettings, setSettings, allowOnce, isAllowed } from "./shared/storage.js";
import { hostOf, isAnalyzable } from "./shared/url.js";

const ALARM = "cs360-refresh-blocklist";
const MAX_RULES = 500;
const WARNING = "/warning.html";
const MENU = "cs360-check-selection";
const OLD_DEFAULT_API = "http://localhost:8000";

chrome.runtime.onInstalled.addListener(async (info) => {
  chrome.alarms.create(ALARM, { periodInMinutes: 60 });
  chrome.contextMenus.create({ id: MENU, title: "Check with CyberShield360", contexts: ["selection"] }, () => void chrome.runtime.lastError);
  if (info.reason === "update") await repairStaleBackend();
  refreshRules("installed");
  wakeBackend();
});
chrome.runtime.onStartup.addListener(() => { refreshRules("startup"); wakeBackend(); });

// Before 1.5.0 the default server was localhost, and saving any setting stored it.
// After an update, if that saved localhost server isn't actually running, switch to
// the live site so protection keeps working. A running local server is left alone.
async function repairStaleBackend() {
  const s = await getSettings();
  if ((s.apiBase || "").replace(/\/+$/, "") !== OLD_DEFAULT_API) return;
  if (await reachable(OLD_DEFAULT_API)) return;
  await setSettings({ apiBase: DEFAULTS.apiBase, appUrl: DEFAULTS.appUrl });
  console.info("[CyberShield] switched from unreachable localhost to", DEFAULTS.apiBase);
}
chrome.alarms.onAlarm.addListener((a) => { if (a.name === ALARM) refreshRules("alarm"); });
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.settings) refreshRules("settings-change");
});

// ----------------------------------------------------------------------------
// (1) declarativeNetRequest known-bad domain rules
// ----------------------------------------------------------------------------
async function clearAllRules() {
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  if (existing.length) {
    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: existing.map((r) => r.id) });
  }
}

async function refreshRules(reason) {
  try {
    const s = await getSettings();
    if (!s.protectionEnabled) { await clearAllRules(); return; }
    let domains = [];
    try { domains = await getBlocklist(); }
    catch (e) { console.warn("[CyberShield] blocklist refresh failed:", e.message); return; }
    const trusted = new Set((s.trustedSites || []).map((d) => d.toLowerCase()));
    const rules = [];
    let id = 1;
    for (const item of domains) {
      const domain = (item.domain || "").toLowerCase();
      if (!domain || trusted.has(domain) || id > MAX_RULES) continue;
      rules.push({
        id: id++, priority: 1,
        action: { type: "redirect", redirect: {
          extensionPath: `${WARNING}?d=${encodeURIComponent(domain)}&t=${encodeURIComponent(item.threat_type || "KNOWN_THREAT")}&m=block`,
        } },
        condition: { urlFilter: `||${domain}^`, resourceTypes: ["main_frame"] },
      });
    }
    await clearAllRules();
    if (rules.length) await chrome.declarativeNetRequest.updateDynamicRules({ addRules: rules });
    console.info(`[CyberShield] block rules: ${rules.length} (${reason})`);
  } catch (e) { console.error("[CyberShield] refreshRules error:", e); }
}

// ----------------------------------------------------------------------------
// (2) Automatic per-navigation analysis
// ----------------------------------------------------------------------------
const inFlight = new Map();   // tabId -> url currently being scanned (dedupe)

function scoreOf(data) {
  if (typeof data.risk_score === "number") return data.risk_score;
  return { LOW: 10, SUSPICIOUS: 35, HIGH: 70, CRITICAL: 90 }[(data.risk_level || "").toUpperCase()] ?? 0;
}

const BADGE = {
  CRITICAL: ["⛔", "#b91c1c"], HIGH: ["⚠", "#c2410c"],
  SUSPICIOUS: ["!", "#a66412"], LOW: ["✓", "#1a7f4b"], UNKNOWN: ["", "#64748b"],
};
function setBadge(tabId, level) {
  const [text, color] = BADGE[(level || "UNKNOWN").toUpperCase()] || BADGE.UNKNOWN;
  try {
    chrome.action.setBadgeBackgroundColor({ tabId, color });
    chrome.action.setBadgeText({ tabId, text });
  } catch { /* tab may be gone */ }
}

function notify(host, data) {
  const conf = Math.round((data.confidence || 0) * 100);
  const ev = (data.evidence || []).filter((e) => (e.weight || 0) > 0)[0];
  chrome.notifications.create(`cs360:${host}:${Date.now()}`, {
    type: "basic",
    iconUrl: "icons/icon128.png",
    title: `CyberShield 360 — ${data.risk_level} (${host})`,
    message:
      `${data.category || "No category"} · ${data.risk_score ?? 0}/100 · ${conf}% sure` +
      (ev ? `\n${ev.summary}` : "") +
      `\nClick the icon for full details.`,
    priority: 1,
  });
}

// The same tab+URL is scanned once even though both navigation events fire for it.
const recent = new Map();     // tabId -> { url, at }
const RECENT_MS = 30_000;

async function onNavigate(details) {
  try {
    if (details.frameId !== 0) return;            // top frame only
    const url = details.url;
    if (!isAnalyzable(url)) return;               // skip chrome://, about:, etc.
    const host = hostOf(url);
    if (!host) return;

    const s = await getSettings();
    if (!s.protectionEnabled || !s.autoScan) return;

    const trusted = new Set((s.trustedSites || []).map((d) => d.toLowerCase()));
    if (trusted.has(host)) { setBadge(details.tabId, "LOW"); return; }
    if (await isAllowed(host)) return;            // user chose to proceed recently

    if (inFlight.get(details.tabId) === url) return;
    const last = recent.get(details.tabId);
    if (last && last.url === url && Date.now() - last.at < RECENT_MS) return;
    recent.set(details.tabId, { url, at: Date.now() });
    inFlight.set(details.tabId, url);

    let data;
    try {
      data = await analyzeUrl(url);
    } catch {
      setBadge(details.tabId, "UNKNOWN");         // backend unavailable -> unknown, never "safe"
      return;
    } finally {
      inFlight.delete(details.tabId);
    }

    const score = scoreOf(data);
    setBadge(details.tabId, data.risk_level);

    if (score >= (s.riskThreshold ?? 50)) {
      // BLOCK: redirect the tab to the warning page (post-response; the page may
      // have begun loading — true pre-load block only applies to the DNR list).
      const w = `${WARNING}?d=${encodeURIComponent(host)}` +
        `&t=${encodeURIComponent(data.category || "HIGH_RISK")}` +
        `&score=${score}&conf=${Math.round((data.confidence || 0) * 100)}` +
        `&u=${encodeURIComponent(url)}&m=auto`;
      try { await chrome.tabs.update(details.tabId, { url: chrome.runtime.getURL(w) }); } catch { /* */ }
    } else if (s.notifyBelowThreshold) {
      notify(host, data);
    }
  } catch (e) { console.error("[CyberShield] onNavigate error:", e); }
}

// onBeforeNavigate fires before the request is sent, so the scan starts at once and
// still runs when the site never loads (unknown domains, connection errors) — those
// never reach onCommitted. onCommitted stays as a fallback (e.g. pages restored from
// the back/forward cache); `recent` stops the second event from scanning again.
chrome.webNavigation.onBeforeNavigate.addListener(onNavigate);
chrome.webNavigation.onCommitted.addListener(onNavigate);

chrome.tabs.onRemoved.addListener((tabId) => { inFlight.delete(tabId); recent.delete(tabId); });

// ----------------------------------------------------------------------------
// Messages from popup / options / warning
// ----------------------------------------------------------------------------
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg) return;
  if (msg.type === "REFRESH_RULES") {
    refreshRules("manual").then(() => sendResponse({ ok: true }));
    return true;
  }
  if (msg.type === "TRUST_HOST" && msg.host) {
    getSettings().then((s) => {
      const set = new Set(s.trustedSites || []);
      set.add(msg.host.toLowerCase());
      chrome.storage.local.set({ settings: { ...s, trustedSites: [...set] } }, () => {
        refreshRules("trust");
        sendResponse({ ok: true });
      });
    });
    return true;
  }
  if (msg.type === "ALLOW_ONCE" && msg.host) {
    allowOnce(msg.host).then(() => sendResponse({ ok: true }));
    return true;
  }
});

// ----------------------------------------------------------------------------
// Right-click -> "Check with CyberShield360" on selected text (user-initiated
// only; uses the activeTab grant of that click, nothing else is read).
// ----------------------------------------------------------------------------
const LEVEL_TEXT = { CRITICAL: "Critical risk", HIGH: "High risk", MEDIUM: "Medium risk", SUSPICIOUS: "Suspicious",
                     LOW: "No warning signs found", UNKNOWN: "Couldn't tell" };

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId !== MENU || !info.selectionText) return;
  const id = `cs360-sel:${Date.now()}`;
  try {
    const r = await checkSelection(info.selectionText);
    const s = await getSettings();
    await chrome.storage.session.set({ [id]: (s.appUrl || "").replace(/\/+$/, "") + r.path });
    const level = LEVEL_TEXT[r.risk_level] || r.risk_level;
    chrome.notifications.create(id, {
      type: "basic", iconUrl: "icons/icon128.png",
      title: `CyberShield360: ${level}${r.risk_level !== "UNKNOWN" ? ` (${r.risk_score}/100)` : ""}`,
      message: (r.headline || (r.risk_level === "LOW" ? "That doesn't prove it's safe. Stay careful." : "Open the report for details.")) +
        (r.saved ? "" : " (Not saved: pair the extension in Settings to keep a history.)"),
      priority: ["CRITICAL", "HIGH"].includes(r.risk_level) ? 2 : 0,
    });
  } catch (e) {
    chrome.notifications.create(id, { type: "basic", iconUrl: "icons/icon128.png",
      title: "CyberShield360 couldn't check that", message: String((e && e.message) || e) });
  }
});

chrome.notifications.onClicked.addListener(async (id) => {
  if (!id.startsWith("cs360-sel:")) return;
  const d = await chrome.storage.session.get(id);
  if (d[id]) chrome.tabs.create({ url: d[id] });
  chrome.notifications.clear(id);
});
