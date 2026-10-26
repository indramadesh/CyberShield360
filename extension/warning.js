import { getSettings } from "./shared/storage.js";

const params = new URLSearchParams(location.search);
const domain = (params.get("d") || "").toLowerCase();
const threat = params.get("t") || "KNOWN_THREAT";
const mode = params.get("m") || "block"; // block = known-bad (DNR); auto = per-page analysis
const score = params.get("score");
const conf = params.get("conf");
const original = params.get("u"); // full original URL (auto mode)

const $ = (id) => document.getElementById(id);
const pretty = (s) => s.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

$("domain").textContent = domain || "(unknown)";
$("threat").textContent = pretty(threat);

if (mode === "auto") {
  $("sub").textContent = "Automatic analysis rated this page as high risk. It may try to steal your personal information.";
  const n = Number(score);
  $("level").textContent = n >= 80 ? "Critical" : "High";
  $("conf").textContent = conf ? `${conf}%` : "—";
  $("meta").textContent = score ? `Risk score ${score}/100` : "";
} else {
  // Known-bad list entries are high-confidence by definition of the list.
  $("level").textContent = "High";
  $("conf").textContent = "High";
  $("meta").textContent = "Matched CyberShield360's known-bad list.";
}

getSettings().then((s) => {
  const target = original ? decodeURIComponent(original) : domain ? `https://${domain}/` : "";
  $("details").href = target
    ? `${s.appUrl}/app/scan?type=URL&q=${encodeURIComponent(target)}&run=1`
    : `${s.appUrl}/app/scan`;
  $("report").href = `${s.appUrl}/contact`;
});

function leave() {
  if (history.length > 1) history.back();
  else chrome.tabs?.getCurrent?.((t) => t && chrome.tabs.remove(t.id));
}
$("back").addEventListener("click", leave);
$("close").addEventListener("click", () => chrome.tabs?.getCurrent?.((t) => (t ? chrome.tabs.remove(t.id) : leave())));

// Proceed is an explicit, informed override.
//  - auto block  -> allow this host once (no permanent trust), then continue.
//  - known-bad   -> add to trusted sites (needed to drop the DNR rule).
$("proceed").addEventListener("click", () => {
  if (!domain) return;
  const dest = original ? decodeURIComponent(original) : "https://" + domain + "/";
  const msg = mode === "auto"
    ? { type: "ALLOW_ONCE", host: domain }
    : { type: "TRUST_HOST", host: domain };
  chrome.runtime.sendMessage(msg, () => {
    setTimeout(() => { location.href = dest; }, 400);
  });
});
