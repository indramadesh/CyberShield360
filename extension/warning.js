import { getSettings } from "./shared/storage.js";

const params = new URLSearchParams(location.search);
const domain = (params.get("d") || "").toLowerCase();
const threat = params.get("t") || "KNOWN_THREAT";
const mode = params.get("m") || "block"; // block = known-bad (DNR); auto = per-page analysis
const score = params.get("score");
const conf = params.get("conf");
const original = params.get("u"); // full original URL (auto mode)

const $ = (id) => document.getElementById(id);
$("domain").textContent = domain || "(unknown)";
$("threat").textContent = threat.replace(/_/g, " ").toLowerCase();

if (mode === "auto") {
  $("sub").textContent = "Automatic analysis flagged this page as high risk.";
}
$("meta").textContent = score
  ? `Risk score ${score}/100${conf ? ` · confidence ${conf}%` : ""}`
  : "This domain is on CyberShield 360's known-bad list (high confidence).";

getSettings().then((s) => {
  $("report").href = `${s.appUrl}/app`;
  $("details").href = `${s.appUrl}/browser-protection`;
});

$("back").addEventListener("click", () => {
  if (history.length > 1) history.back();
  else chrome.tabs?.getCurrent?.((t) => t && chrome.tabs.remove(t.id));
});

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
