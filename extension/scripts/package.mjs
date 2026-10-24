// Packages the extension into a store-ready unpacked dir + a ZIP (manifest at
// root), with SHA-256 + release manifest. Dependency-free ZIP writer (store
// method). Also copies the artifact to the website's public downloads folder.
import {
  readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, cpSync, readdirSync, statSync,
} from "node:fs";
import { join, dirname, posix } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPO = join(ROOT, "..");
const manifest = JSON.parse(readFileSync(join(ROOT, "manifest.json"), "utf8"));
const VERSION = manifest.version;

// Files that ship in the production package (store-ready set).
const INCLUDE_FILES = [
  "manifest.json", "popup.html", "popup.js", "options.html", "options.js",
  "warning.html", "warning.js", "styles.css", "background.js",
  "shared/api.js", "shared/storage.js", "shared/url.js", "shared/risk.js",
  "icons/icon16.png", "icons/icon32.png", "icons/icon48.png", "icons/icon128.png",
];

// ---- gather files ----
const files = INCLUDE_FILES.map((rel) => {
  const abs = join(ROOT, rel);
  if (!existsSync(abs)) { console.error("Missing file:", rel); process.exit(1); }
  return { name: rel.split("\\").join("/"), data: readFileSync(abs) };
});

// ---- store-ready unpacked dir ----
const dist = join(ROOT, "dist");
rmSync(dist, { recursive: true, force: true });
for (const f of files) {
  const dest = join(dist, f.name);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, f.data);
}

// ---- minimal ZIP (store / no compression) ----
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function zip(entries) {
  const DOS_DATE = 0x21, DOS_TIME = 0; // 1980-01-01
  const locals = [], centrals = [];
  let offset = 0;
  for (const e of entries) {
    const nameBuf = Buffer.from(e.name, "utf8");
    const crc = crc32(e.data);
    const size = e.data.length;
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0, 6);
    lh.writeUInt16LE(0, 8); lh.writeUInt16LE(DOS_TIME, 10); lh.writeUInt16LE(DOS_DATE, 12);
    lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(size, 18); lh.writeUInt32LE(size, 22);
    lh.writeUInt16LE(nameBuf.length, 26); lh.writeUInt16LE(0, 28);
    locals.push(lh, nameBuf, e.data);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6);
    ch.writeUInt16LE(0, 8); ch.writeUInt16LE(0, 10); ch.writeUInt16LE(DOS_TIME, 12);
    ch.writeUInt16LE(DOS_DATE, 14); ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(size, 20);
    ch.writeUInt32LE(size, 24); ch.writeUInt16LE(nameBuf.length, 28); ch.writeUInt16LE(0, 30);
    ch.writeUInt16LE(0, 32); ch.writeUInt16LE(0, 34); ch.writeUInt16LE(0, 36);
    ch.writeUInt32LE(0, 38); ch.writeUInt32LE(offset, 42);
    centrals.push(ch, nameBuf);
    offset += lh.length + nameBuf.length + e.data.length;
  }
  const centralBuf = Buffer.concat(centrals);
  const localBuf = Buffer.concat(locals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(0, 4); eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8); eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12); eocd.writeUInt32LE(localBuf.length, 16);
  eocd.writeUInt16LE(0, 20);
  return Buffer.concat([localBuf, centralBuf, eocd]);
}

const zipBuf = zip(files);

// ---- artifacts ----
const artifacts = join(REPO, "artifacts");
mkdirSync(artifacts, { recursive: true });
const zipName = `cybershield360-extension-v${VERSION}.zip`;
const zipPath = join(artifacts, zipName);
writeFileSync(zipPath, zipBuf);
const sha = createHash("sha256").update(zipBuf).digest("hex");
writeFileSync(join(artifacts, zipName + ".sha256"), `${sha}  ${zipName}\n`);

let commit = null;
try { commit = execSync("git rev-parse --short HEAD", { cwd: REPO }).toString().trim(); } catch { /* no git */ }

const release = {
  name: manifest.name,
  version: VERSION,
  file: zipName,
  size_bytes: zipBuf.length,
  sha256: sha,
  build_timestamp: new Date().toISOString(),
  git_commit: commit,
  chrome_min_version: "110",
  permissions: manifest.permissions,
  optional_host_permissions: manifest.optional_host_permissions || [],
  file_count: files.length,
};
writeFileSync(join(artifacts, "release-manifest.json"), JSON.stringify(release, null, 2));

// ---- publish to website public downloads (static serving) ----
const pub = join(REPO, "frontend", "public", "downloads");
mkdirSync(pub, { recursive: true });
cpSync(zipPath, join(pub, zipName));
writeFileSync(join(pub, "release-manifest.json"), JSON.stringify(release, null, 2));

console.log(`Packaged ${files.length} files -> ${zipName} (${zipBuf.length} bytes)`);
console.log(`  sha256: ${sha}`);
console.log(`  artifacts: ${artifacts}`);
console.log(`  store-ready dir: ${dist}`);
console.log(`  published to: ${pub}`);
