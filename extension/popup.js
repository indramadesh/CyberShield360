import { analyzeUrl, analyzeScan, analyzeWebsite, analyzeUpload, getHealth } from "./shared/api.js";
import { getSettings, setSettings } from "./shared/storage.js";
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

function renderResult(el, data) {
  if (data && data.status && data.status !== "COMPLETE") {
    el.innerHTML = `<div class="small">${esc(data.explanation || "Analysis could not be completed.")}</div>`;
    return;
  }
  const conf = Math.round((data.confidence ?? 0) * 100);
  const ev = (data.evidence || []).filter((e) => (e.weight || 0) > 0).slice(0, 3);
  const recs = (data.recommendations || []).slice(0, 2);
  el.innerHTML = `
    <div class="row between">${badge(data.risk_level)}<span class="small muted">${esc(data.category || "")} · ${conf}%</span></div>
    ${ev.length ? `<ul class="evidence small">${ev.map((e) => `<li>${esc(e.summary)}</li>`).join("")}</ul>` : ""}
    ${recs.length ? `<div class="small mt"><b>Do:</b> ${esc(recs[0])}</div>` : ""}
    <div class="small muted mt">${esc(safetyCaveat(data.risk_level))}</div>`;
}

async function run(el, url) {
  if (!isAnalyzable(url)) {
    el.innerHTML = `<div class="small muted">This page can't be analyzed (not an http/https address).</div>`;
    return;
  }
  el.innerHTML = `<div class="row small muted"><span class="spin"></span> Analyzing…</div>`;
  try {
    renderResult(el, await analyzeUrl(url));
  } catch (e) {
    el.innerHTML = `<div class="small" style="color:#f87171">Could not analyze: ${esc(e.message)}.
      <br/>Check the backend URL in Settings.</div>`;
  }
}

function setPill(text, color, bg) {
  const p = $("statusPill");
  p.textContent = text; p.style.color = color; p.style.background = bg;
}

function renderStatus(s) {
  const auto = !!s.protectionEnabled;
  const manual = !!s.manualEnabled;

  // Show/hide the manual tools.
  $("currentCard").classList.toggle("hidden", !manual);
  $("scanCard").classList.toggle("hidden", !manual);

  if (auto && manual) setPill("● Auto + Manual", "#34d399", "rgba(52,211,153,0.14)");
  else if (auto) setPill("● Auto on", "#34d399", "rgba(52,211,153,0.14)");
  else if (manual) setPill("● Manual", "#fbbf24", "rgba(251,191,36,0.14)");
  else setPill("● Off", "#f87171", "rgba(248,113,113,0.14)");

  const line = [];
  line.push(auto
    ? `Automatic: every page checked; blocked at ${s.riskThreshold ?? 50}%+.`
    : "Automatic: off.");
  line.push(manual ? "Manual: tools available below." : "Manual: off.");
  $("statusLine").textContent = line.join(" ");
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
    el.innerHTML = `<div class="small" style="color:#f87171">Could not analyze: ${esc(e.message)}.</div>`;
  }
}

function setupScanner() {
  renderScanInput($("scanType").value);
  $("scanType").addEventListener("change", (e) => renderScanInput(e.target.value));
  $("scanBtn").addEventListener("click", doScan);
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
    .then(() => { $("conn").textContent = "● Connected"; $("conn").style.color = "#34d399"; })
    .catch(() => { $("conn").textContent = "● Backend offline"; $("conn").style.color = "#fb923c"; });
}

init();
