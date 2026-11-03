// Publishes the signed release APK to the website (frontend/public/apps/) with a
// manifest the Download center reads. Run after `gradlew assembleRelease`:
//   node android/publish.mjs
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const OUT = join(ROOT, "app", "build", "outputs", "apk", "release");
const meta = JSON.parse(readFileSync(join(OUT, "output-metadata.json"), "utf8")).elements[0];
const apk = join(OUT, meta.outputFile);
if (!existsSync(apk)) throw new Error(`No release APK at ${apk}. Run gradlew assembleRelease first.`);

const pub = join(ROOT, "..", "frontend", "public", "apps");
mkdirSync(pub, { recursive: true });
for (const f of readdirSync(pub)) if (f.endsWith(".apk")) rmSync(join(pub, f)); // keep only the latest
const file = `cybershield360-protect-v${meta.versionName}.apk`;
copyFileSync(apk, join(pub, file));
const bytes = readFileSync(join(pub, file));

const manifest = {
  name: "CyberShield360 Protect",
  platform: "android",
  version: meta.versionName,
  version_code: meta.versionCode,
  file,
  size_bytes: bytes.length,
  sha256: createHash("sha256").update(bytes).digest("hex"),
  build_timestamp: new Date().toISOString(),
  min_android: "8.1 (API 27)",
  // Release notes for the Download center: one line each.
  release_notes: [
    "Checks notifications only from the apps you choose, and alerts you about scams and phishing",
    "Check a link or message yourself, or share text to CyberShield360 from any app",
    "One-time codes, passwords and card numbers are removed on the phone before anything is sent",
    "Not on Google Play yet: install the APK directly (see the steps)",
  ],
};
writeFileSync(join(pub, "android-release.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(`published ${file} (${bytes.length} bytes) sha256=${manifest.sha256}`);
