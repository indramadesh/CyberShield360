import { getSettings, setSettings, clearCache } from "./shared/storage.js";
import { getHealth } from "./shared/api.js";
import { originOf } from "./shared/url.js";

const $ = (id) => document.getElementById(id);

async function load() {
  const s = await getSettings();
  $("apiBase").value = s.apiBase;
  $("appUrl").value = s.appUrl;
  $("protectionEnabled").checked = !!s.protectionEnabled;
  $("protectionLevel").value = s.protectionLevel;
  $("autoScan").checked = !!s.autoScan;
  $("riskThreshold").value = String(s.riskThreshold ?? 50);
  $("notifyBelowThreshold").checked = !!s.notifyBelowThreshold;
  $("trustedSites").value = (s.trustedSites || []).join("\n");
  $("docs").href = (s.appUrl || "") + "/browser-protection";
  const mf = chrome.runtime.getManifest();
  $("version").textContent = mf.version;
}

async function save() {
  const trusted = $("trustedSites").value.split(/\r?\n/).map((x) => x.trim().toLowerCase()).filter(Boolean);
  let threshold = parseInt($("riskThreshold").value, 10);
  if (!Number.isFinite(threshold)) threshold = 50;
  threshold = Math.min(100, Math.max(1, threshold));
  await setSettings({
    apiBase: $("apiBase").value.trim().replace(/\/+$/, ""),
    appUrl: $("appUrl").value.trim().replace(/\/+$/, ""),
    protectionEnabled: $("protectionEnabled").checked,
    protectionLevel: $("protectionLevel").value,
    autoScan: $("autoScan").checked,
    riskThreshold: threshold,
    notifyBelowThreshold: $("notifyBelowThreshold").checked,
    trustedSites: trusted,
  });
  chrome.runtime.sendMessage({ type: "REFRESH_RULES" });
  $("saveResult").textContent = "Saved ✓";
  $("saveResult").style.color = "#34d399";
  setTimeout(() => ($("saveResult").textContent = ""), 2500);
}

async function test() {
  $("testResult").textContent = "Testing…";
  $("testResult").style.color = "";
  try {
    const h = await getHealth();
    $("testResult").textContent = `Connected ✓ (engine ${h.engine_version})`;
    $("testResult").style.color = "#34d399";
  } catch (e) {
    $("testResult").textContent = `Not reachable: ${e.message}`;
    $("testResult").style.color = "#fb923c";
  }
}

// Request host permission for the configured backend (needed for non-localhost).
async function grant() {
  const origin = originOf($("apiBase").value.trim());
  if (!origin) { $("testResult").textContent = "Enter a valid backend URL first."; return; }
  try {
    const granted = await chrome.permissions.request({ origins: [origin + "/*"] });
    $("testResult").textContent = granted ? "Access granted ✓" : "Access not granted.";
    $("testResult").style.color = granted ? "#34d399" : "#fb923c";
  } catch (e) {
    $("testResult").textContent = "Could not request access: " + e.message;
  }
}

$("saveBtn").addEventListener("click", save);
$("testBtn").addEventListener("click", test);
$("grantBtn").addEventListener("click", grant);
$("clearCacheBtn").addEventListener("click", async () => {
  await clearCache();
  $("saveResult").textContent = "Cache cleared ✓";
  $("saveResult").style.color = "#34d399";
  setTimeout(() => ($("saveResult").textContent = ""), 2500);
});

load();
