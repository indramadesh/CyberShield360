import { analyzeUrl, analyzeScan, analyzeWebsite, analyzeUpload, getHealth } from "./shared/api.js";
import { getSettings, setSettings, cacheGet } from "./shared/storage.js";
import { riskMeta, safetyCaveat } from "./shared/risk.js";
import { hostOf, isAnalyzable, normalizeUrl } from "./shared/url.js";

const $ = (id) => document.getElementById(id);
let currentUrl = "";

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function badge(level) {
  const m = riskMeta(level);
  return `<span class="badge" style="color:${m.tone};background:${m.bg}">${m.icon} ${esc(m.label)}</span>`;
}

// Big shield + headline for the current site. Colour is always paired with words.
const HEADLINE = {
  LOW: { tone: "low", html: 'This website looks <span class="t-low">safe</span>', mark: "M22 32l7 7 13-14" },
  SUSPICIOUS: { tone: "warn", html: 'This website looks <span class="t-warn">suspicious</span>', mark: "M32 20v14M32 42v.5" },
  HIGH: { tone: "high", html: 'This website looks <span class="t-high">dangerous</span>', mark: "M32 20v14M32 42v.5" },
  CRITICAL: { tone: "crit", html: 'This website is <span class="t-crit">high risk</span>', mark: "M25 25l14 14M39 25 25 39" },
};
function renderHeadline(level, note) {
  const h = HEADLINE[(level || "").toUpperCase()];
  const shield = $("statusShield");
  shield.className = `shield-badge tone-${h ? h.tone : "unknown"}`;
  $("statusMark").setAttribute("d", h ? h.mark : "M26 26a6 6 0 1 1 8 5.6c-1.4.6-2 1.6-2 3V36M32 42v.5");
  $("headline").innerHTML = h ? h.html : esc(note || "Not checked yet");
}

function renderResult(el, data) {
  if (data && data.status && data.status !== "COMPLETE") {
    el.innerHTML = `<div class="small">${esc(data.explanation || "Analysis could not be completed.")}</div>`;
    return;
  }
  const conf = Math.round((data.confidence ?? 0) * 100);
  const ev = (data.evidence || []).filter((e) => (e.weight || 0) > 0).slice(0, 3);
  const recs = (data.recommendations || []).slice(0, 2);
  el.innerHTML = `
    <div class="row between">${badge(data.risk_level)}<span class="small muted">risk ${esc(data.risk_score)}/100 · ${conf}% sure</span></div>
    ${ev.length ? `<ul class="evidence small">${ev.map((e) => `<li>${esc(e.summary)}</li>`).join("")}</ul>` : ""}
    ${recs.length ? `<div class="small mt"><b>Do:</b> ${esc(recs[0])}</div>` : ""}
    <div class="small muted mt">${esc(safetyCaveat(data.risk_level))}</div>`;
}

async function run(el, url) {
  if (!isAnalyzable(url)) {
    renderHeadline(null, "This page can't be checked");
    el.innerHTML = `<div class="small muted center">Only http/https pages can be analyzed.</div>`;
    return;
  }
  el.innerHTML = `<div class="row small muted" style="justify-content:center"><span class="spin"></span> Analyzing…</div>`;
  try {
    const data = await analyzeUrl(url);
    renderHeadline(data.status === "COMPLETE" ? data.risk_level : null, "Analysis unavailable");
    renderResult(el, data);
  } catch (e) {
    renderHeadline(null, "Analysis unavailable");
    el.innerHTML = `<div class="small" style="color:#FF5D65">Could not analyze: ${esc(e.message)}.
      <br/>Check the backend URL in Settings.</div>`;
  }
}

function renderStatus(s) {
  const auto = !!s.protectionEnabled;
  const manual = !!s.manualEnabled;

  // Show/hide the manual tools.
  $("analyzeBtn").classList.toggle("hidden", !manual);
  $("tools").classList.toggle("hidden", !manual);
  if (!manual) $("scanCard").classList.add("hidden");

  $("protDot").style.color = auto ? "#19E6A0" : "#FF5D65";
  $("statusLine").innerHTML = auto
    ? `Real-time protection is <b style="color:#19E6A0">ON</b> · blocks at ${esc(s.riskThreshold ?? 50)}+`
    : `Real-time protection is <b style="color:#FF5D65">OFF</b>`;
}

const SCAN_META = {
  URL: { input: "url", ph: "https://example.com/login", hint: "Paste a suspicious link." },
  MESSAGE: { input: "textarea", ph: "Paste a suspicious SMS or chat message…", hint: "SMS, WhatsApp, or chat text." },
  EMAIL: { input: "textarea", ph: "Paste the full email, with headers if you have them…", hint: "Headers help detect sender spoofing." },
  QR: { input: "file", hint: "Upload a QR-code image — it's decoded and the destination is checked." },
  IMAGE: { input: "file", hint: "Upload a screenshot or poster — text & links are analyzed." },
  WEBSITE: { input: "url", ph: "https://example.com", hint: "Opened safely in an isolated sandbox." },
};

function renderScanInput(type) {
  const m = SCAN_META[type];
  const area = $("scanInput");
  if (m.input === "file") {
    area.innerHTML = `<input type="file" id="scanFile" accept="image/png,image/jpeg,image/webp" />`;
  } else if (m.input === "textarea") {
    area.innerHTML = `<textarea id="scanField" placeholder="${m.ph || ""}"></textarea>`;
  } else {
    area.innerHTML = `<input type="url" id="scanField" placeholder="${m.ph || ""}" />`;
  }
  $("scanHint").textContent = m.hint || "";
  $("scanResult").innerHTML = "";
}

async function doScan() {
  const type = $("scanType").value;
  const el = $("scanResult");
  el.innerHTML = `<div class="row small muted"><span class="spin"></span> Analyzing…</div>`;
  try {
    let data;
    if (type === "QR" || type === "IMAGE") {
      const file = $("scanFile")?.files?.[0];
      if (!file) { el.innerHTML = `<div class="small muted">Choose an image first.</div>`; return; }
      data = await analyzeUpload(file, type);
    } else {
      const val = ($("scanField")?.value || "").trim();
      if (!val) { el.innerHTML = `<div class="small muted">Enter something to scan.</div>`; return; }
      if (type === "WEBSITE") data = await analyzeWebsite(val);
      else if (type === "URL") data = await analyzeScan("URL", normalizeUrl(val));
      else data = await analyzeScan(type, val);
    }
    renderResult(el, data);
  } catch (e) {
    el.innerHTML = `<div class="small" style="color:#FF5D65">Could not analyze: ${esc(e.message)}.</div>`;
  }
}

function openScanner(type) {
  $("scanType").value = type;
  renderScanInput(type);
  $("scanCard").classList.remove("hidden");
  $("scanField")?.focus();
  $("scanCard").scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function setupScanner() {
  renderScanInput($("scanType").value);
  $("scanType").addEventListener("change", (e) => renderScanInput(e.target.value));
  $("scanBtn").addEventListener("click", doScan);
  $("closeScan").addEventListener("click", () => $("scanCard").classList.add("hidden"));
  document.querySelectorAll("[data-scan]").forEach((b) => b.addEventListener("click", () => {
    const t = b.getAttribute("data-scan");
    if (t === "SETTINGS") chrome.runtime.openOptionsPage();
    else openScanner(t);
  }));
}

async function init() {
  let s = await getSettings();
  $("autoToggle").checked = !!s.protectionEnabled;
  $("manualToggle").checked = !!s.manualEnabled;
  renderStatus(s);

  $("openApp").href = s.appUrl; $("openApp").target = "_blank";
  $("privacy").href = (s.appUrl || "") + "/browser-protection"; $("privacy").target = "_blank";
  $("openOptions").addEventListener("click", (e) => { e.preventDefault(); chrome.runtime.openOptionsPage(); });

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    currentUrl = (tab && tab.url) || "";
    $("domain").textContent = hostOf(currentUrl) || currentUrl || "—";
  } catch { $("domain").textContent = "—"; }

  // Show the result of the automatic check for this page, if there is one.
  if (isAnalyzable(currentUrl)) {
    const cached = await cacheGet("u:" + normalizeUrl(currentUrl), s.cacheTtlMin);
    if (cached && cached.status === "COMPLETE") {
      renderHeadline(cached.risk_level);
      renderResult($("result"), cached);
    }
  } else if (currentUrl) {
    renderHeadline(null, "This page can't be checked");
  }

  $("analyzeBtn").addEventListener("click", () => run($("result"), currentUrl));
  setupScanner();

  // Automatic protection: master for background scanning + known-bad blocking.
  $("autoToggle").addEventListener("change", async (e) => {
    s = await setSettings({ protectionEnabled: e.target.checked });
    chrome.runtime.sendMessage({ type: "REFRESH_RULES" });
    renderStatus(s);
  });
  // Manual scanning: show/hide the on-demand tools.
  $("manualToggle").addEventListener("change", async (e) => {
    s = await setSettings({ manualEnabled: e.target.checked });
    renderStatus(s);
  });

  getHealth()
    .then(() => { $("conn").textContent = "● Connected"; $("conn").style.color = "#19E6A0"; })
    .catch(() => { $("conn").textContent = "● Backend offline"; $("conn").style.color = "#FF8B4D"; });
}

init();
