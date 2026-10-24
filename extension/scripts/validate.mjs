// Validates the extension before packaging. Exits non-zero on any failure so
// the release gate can rely on it. No dependencies.
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const warn = [];

function fail(m) { errors.push(m); }

// 1) manifest.json valid + required fields
let manifest;
try {
  manifest = JSON.parse(readFileSync(join(ROOT, "manifest.json"), "utf8"));
} catch (e) {
  fail("manifest.json is not valid JSON: " + e.message);
}
if (manifest) {
  if (manifest.manifest_version !== 3) fail("manifest_version must be 3");
  for (const f of ["name", "version", "description", "icons", "action", "background"]) {
    if (!manifest[f]) fail(`manifest missing required field: ${f}`);
  }
  // Referenced files must exist
  const refs = [
    manifest.action?.default_popup,
    manifest.options_page,
    manifest.background?.service_worker,
    ...Object.values(manifest.icons || {}),
    ...(manifest.web_accessible_resources || []).flatMap((w) => w.resources || []),
  ].filter(Boolean);
  for (const r of refs) {
    if (!existsSync(join(ROOT, r))) fail(`manifest references missing file: ${r}`);
  }
  // Least-privilege sanity: warn on broad permissions
  for (const p of manifest.permissions || []) {
    if (["tabs", "webNavigation", "<all_urls>"].includes(p)) warn.push(`broad permission present: ${p}`);
  }
  if ((manifest.host_permissions || []).includes("<all_urls>")) warn.push("host_permissions includes <all_urls>");
}

// 2) basic secret scan across source files
const SECRET = /(api[_-]?key|secret|password|authorization:\s*bearer|-----BEGIN)/i;
const sources = ["background.js", "popup.js", "options.js", "warning.js",
  "shared/api.js", "shared/storage.js", "shared/url.js", "shared/risk.js"];
for (const s of sources) {
  const p = join(ROOT, s);
  if (!existsSync(p)) { fail(`source file missing: ${s}`); continue; }
  const txt = readFileSync(p, "utf8");
  if (SECRET.test(txt)) warn.push(`possible secret-like string in ${s} (review)`);
}

if (warn.length) {
  console.log("Warnings:");
  warn.forEach((w) => console.log("  ! " + w));
}
if (errors.length) {
  console.error("VALIDATION FAILED:");
  errors.forEach((e) => console.error("  x " + e));
  process.exit(1);
}
console.log(`OK: manifest + ${sources.length} sources valid (v${manifest.version}).`);
