// Service worker:
//   1) keeps declarativeNetRequest rules in sync with the backend known-bad list
//      (synchronous, pre-emptive block of listed domains), and
//   2) AUTO-SCANS each page you open via the backend: risk >= threshold -> block
//      (redirect to warning page), below threshold -> badge + optional notification.
// No page content is ever read — only the navigated URL is analyzed.
import { analyzeUrl, getBlocklist } from "./shared/api.js";
import { getSettings, allowOnce, isAllowed } from "./shared/storage.js";
import { hostOf, isAnalyzable } from "./shared/url.js";

const ALARM = "cs360-refresh-blocklist";
const MAX_RULES = 500;
const WARNING = "/warning.html";

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(ALARM, { periodInMinutes: 60 });
  refreshRules("installed");
});
chrome.runtime.onStartup.addListener(() => refreshRules("startup"));
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
      `${data.category || "No category"} · ${data.risk_score ?? 0}/100 · confidence ${conf}%` +
      (ev ? `\n${ev.summary}` : "") +
      `\nClick the icon for full details.`,
    priority: 1,
  });
}

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

// onCommitted fires once the navigation is committed for the tab.
chrome.webNavigation.onCommitted.addListener(onNavigate);

// Clear the badge when a tab finishes a fresh navigation we didn't flag.
chrome.tabs.onRemoved.addListener((tabId) => inFlight.delete(tabId));

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
