// End-to-end UI check: drives headless Chrome over CDP (no deps; Node 22+).
// Needs the dev servers running (backend :8000, frontend :5173). Creates a
// throwaway test user and two scans in the dev database.
// Usage: node tools/ui-check.mjs [outDir=artifacts/ui-check] [extensionDir=extension]
// Env: CHROME_PATH to override the Chrome binary.
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const OUT = resolve(process.argv[2] ?? "artifacts/ui-check");
const EXT = process.argv[3] ?? "extension";
const APP = "http://127.0.0.1:5173";
const API = "http://127.0.0.1:8000/api/v1";
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const PORT = 9333;
mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, pass, info = "") => { results.push({ name, pass, info }); console.log(`${pass ? "PASS" : "FAIL"}  ${name}${info ? "  — " + info : ""}`); };

const chrome = spawn(CHROME, [
  "--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${join(OUT, "profile")}`,
  "--no-first-run", "--no-default-browser-check", "--disable-gpu", "--hide-scrollbars", "about:blank",
], { stdio: "ignore" });

let ws, id = 0;
const pending = new Map();
const consoleErrors = [];
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const i = ++id;
    pending.set(i, { resolve, reject });
    ws.send(JSON.stringify({ id: i, method, params }));
  });
}

async function connect() {
  for (let t = 0; t < 40; t++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find((x) => x.type === "page");
      if (page) {
        ws = new WebSocket(page.webSocketDebuggerUrl);
        await new Promise((r) => ws.addEventListener("open", r));
        ws.addEventListener("message", (ev) => {
          const m = JSON.parse(ev.data);
          if (m.id && pending.has(m.id)) {
            const p = pending.get(m.id); pending.delete(m.id);
            m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result);
          } else if (m.method === "Runtime.exceptionThrown") {
            consoleErrors.push(m.params.exceptionDetails?.exception?.description ?? m.params.exceptionDetails?.text);
          } else if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") {
            consoleErrors.push(m.params.args.map((a) => a.value ?? a.description).join(" "));
          }
        });
        return;
      }
    } catch { /* not up yet */ }
    await sleep(250);
  }
  throw new Error("Chrome did not start");
}

async function viewport(width, height, mobile = false) {
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile });
}
async function go(url, wait = 1800) {
  await send("Page.navigate", { url });
  await sleep(wait);
}
async function evaluate(expr) {
  const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? "eval error");
  return r.result.value;
}
async function shot(name, full = true) {
  const r = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: full });
  writeFileSync(join(OUT, `${name}.png`), Buffer.from(r.data, "base64"));
}
const text = () => evaluate("document.body.innerText");
// Poll the page text (up to `ms`) until it matches `re`.
async function waitText(re, ms = 10000) {
  const end = Date.now() + ms;
  let t = "";
  while (Date.now() < end) { t = await text(); if (re.test(t)) return true; await sleep(300); }
  return false;
}
// Wait (up to `ms`) until location.pathname equals `path`; returns the final pathname.
async function waitPath(path, ms = 12000) {
  const end = Date.now() + ms;
  let p = "";
  while (Date.now() < end) { p = await evaluate("location.pathname"); if (p === path) return p; await sleep(250); }
  return p;
}
const noHScroll = () => evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1");

// Fill a React-controlled input/textarea.
const fill = (selector, value) => evaluate(`(() => {
  const el = document.querySelector(${JSON.stringify(selector)});
  if (!el) return false;
  const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value").set.call(el, ${JSON.stringify(value)});
  el.dispatchEvent(new Event("input", { bubbles: true }));
  return true;
})()`);
const clickText = (tag, re) => evaluate(`(() => {
  const el = [...document.querySelectorAll(${JSON.stringify(tag)})].find((b) => ${re}.test(b.textContent));
  if (!el) return false; el.click(); return true;
})()`);

try {
  await connect();
  await send("Page.enable");
  await send("Runtime.enable");

  // ---------- Public pages, desktop ----------
  await viewport(1440, 900);
  await go(APP + "/about", 800);
  await evaluate("localStorage.clear(); true");
  await go(APP + "/", 2500);
  let t = await text();
  check("Landing: hero headline", /Stay One\s+Step Ahead/i.test(t));
  check("Landing: no social sign-in", !/Sign in with (Google|Facebook|Apple)/i.test(t));
  check("Landing: no '100% safe' claims", !/100% safe|guaranteed safe/i.test(t.replace(/never means guaranteed safe/i, "")));
  { const lessons = (await (await fetch(API + "/awareness")).json()).data;
    check("Landing: real lessons rendered", lessons.length > 0 && t.includes(lessons[0].title), lessons[0]?.title); }
  await shot("01-landing-desktop");
  check("Landing: light theme by default", !(await evaluate("document.documentElement.classList.contains('dark')")));
  await evaluate(`document.querySelector('button[aria-label="Dark mode"]').click()`);
  await sleep(300);
  check("Landing: theme toggle switches to dark + persists",
    await evaluate("document.documentElement.classList.contains('dark') && localStorage.getItem('cs360-theme') === 'dark'"));
  await shot("01b-landing-dark", false);
  await evaluate(`document.querySelector('button[aria-label="Dark mode"]').click()`);
  { const href = await evaluate(`[...document.querySelectorAll('nav[aria-label=Primary] a')].find(a => a.textContent === 'Tools')?.getAttribute('href')`);
    check("Landing: Tools link goes to Sign Up first", href === "/login?mode=register&next=%2Fapp%2Fscan", `href=${href} storage=${await evaluate("Object.keys(localStorage).join(',')")}`); }
  await evaluate(`[...document.querySelectorAll('nav[aria-label=Primary] a')].find(a => a.textContent === 'Learn').click()`);
  await sleep(1200);
  check("Gate: clicking Learn opens Sign Up with next", (await evaluate("location.pathname + location.search")) === "/login?mode=register&next=%2Fapp%2Flearn"
    && (await evaluate(`document.querySelector('[role=tab][aria-selected=true]')?.textContent`)) === "Sign Up");
  await clickText("button", /Continue as guest/);
  await sleep(1500);
  check("Gate: continue as guest lands on the requested page", (await evaluate("location.pathname")) === "/app/learn");
  await evaluate("localStorage.clear()");
  await go(APP + "/");
  await evaluate(`document.querySelector('button[aria-label="Search or scan"]').click()`);
  await sleep(800);
  check("Gate: header search opens Sign Up", (await evaluate("location.pathname + location.search")).startsWith("/login?mode=register"));
  await go(APP + "/");

  for (const [path, name, re] of [
    ["/login", "02-login", /Welcome to/],
    ["/register", "03-register", /Create Account/],
    ["/forgot-password", "04-forgot", /isn't available yet/],
    ["/about", "05-about", /What we believe/],
    ["/contact", "06-contact", /1930/],
    ["/browser-protection", "07-browser-protection", /Protection that/i],
    ["/no-such-page", "08-404", /404/],
    ["/classic", "09-classic", /CyberShield/],
    ["/v2", "10-v2", /CyberShield/],
  ]) {
    await go(APP + path);
    check(`Route ${path}`, await waitText(re));
    await shot(name, path !== "/classic" && path !== "/v2");
  }
  await go(APP + "/browser-protection");
  check("Browser protection: v1.4.0 release notes", await waitText(/What's new in v1\.4\.0/));

  // ---------- Auth validation (real form) ----------
  await go(APP + "/register");
  await clickText("button[type=submit]", /Create account/i);
  await sleep(300);
  t = await text();
  check("Register: client validation shown", /valid email/i.test(t) && /at least 10/i.test(t));

  // Register a fresh user through the UI
  const email = `ui${Date.now()}@example.com`;
  await fill("#email", email);
  await fill("#password", "Str0ng!passw0rd");
  await fill("#confirm", "Str0ng!passw0rd");
  await clickText("button[type=submit]", /Create account/i);
  const afterRegister = await waitPath("/app");
  check("Register via UI lands on dashboard", afterRegister === "/app", afterRegister);

  // Wrong password shows server error, no fake success
  await evaluate("localStorage.clear()");
  await go(APP + "/login");
  await fill("#email", email);
  await fill("#password", "wrong-password-123");
  await clickText("button[type=submit]", /Sign in/i);
  for (let i = 0; i < 40 && !(await evaluate("!!document.querySelector('[role=alert]')")); i++) await sleep(250);
  check("Login: wrong password stays on /login with error",
    (await evaluate("location.pathname")) === "/login" && !!(await evaluate("document.querySelector('[role=alert]')?.textContent")));

  await fill("#password", "Str0ng!passw0rd");
  await clickText("button[type=submit]", /Sign in/i);
  check("Login: correct password → dashboard", (await waitPath("/app")) === "/app");

  // ---------- Scan flow via the real UI ----------
  await go(APP + "/app/scan?type=URL");
  await clickText("button", /Phishing URL/);
  await sleep(200);
  await clickText("button", /^\s*Analyze\s*$/);
  await sleep(4000);
  t = await text();
  check("Scanner: URL result with risk banner", /Risk Score \d+\/100/.test(t) && /What we found/.test(t), (t.match(/(Low Risk|Suspicious|High Risk|Critical Risk)/) || [])[0]);
  check("Scanner: confidence shown separately", /Confidence\s*\d+%/.test(t));
  await shot("11-scan-result");

  // Dashboard Quick Scan runs immediately on the scanner page
  await go(APP + "/app");
  await fill('input[aria-label="URL to scan"]', "http://paypa1-account-security.example/signin");
  await clickText("button[type=submit]", /Scan/);
  await sleep(4500);
  check("Dashboard Quick Scan auto-runs the analysis", /Risk Score \d+\/100/.test(await text()));

  // Top-bar search → auto-detect MESSAGE
  await go(APP + "/app");
  await fill('input[aria-label="Paste content to scan"]', "Your account is blocked. Share OTP now to unblock.");
  await evaluate(`document.querySelector('form[role=search]').requestSubmit()`);
  await sleep(1500);
  check("Top-bar search routes to scanner with message type",
    (await evaluate("location.pathname + location.search")).startsWith("/app/scan?q=") &&
    (await evaluate(`document.querySelector('[role=tab][aria-selected=true]')?.textContent`))?.includes("Message"));

  await go(APP + "/app/scan?type=MESSAGE");
  await clickText("button", /Suspicious Message/);
  await sleep(200);
  await clickText("button", /^\s*Analyze\s*$/);
  await sleep(4000);
  // Feedback
  const fb = await clickText("button", /Helpful/);
  await sleep(1200);
  check("Result feedback posts and confirms", fb && /Feedback recorded/.test(await text()));

  // ---------- Dashboard (real metrics) ----------
  await go(APP + "/app", 2500);
  t = await text();
  const scansMetric = await evaluate(`[...document.querySelectorAll('div')].find(d => d.textContent === 'Scans this week')?.previousElementSibling?.textContent`);
  check("Dashboard: scans metric reflects real history", scansMetric === "3", `value=${scansMetric}`);
  check("Dashboard: recent scans list targets", /secure-sbi-kyc-update\.example/.test(t));
  check("Dashboard: query string stripped from target", !/verify=account/.test(t));
  await shot("12-dashboard");

  // ---------- Reports ----------
  await go(APP + "/app/reports", 2000);
  t = await text();
  check("Reports: 3 reports listed", /3 reports/.test(t));
  await evaluate(`(() => { const s = document.querySelector('select[aria-label="Filter by type"]'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(s,'URL'); s.dispatchEvent(new Event('change',{bubbles:true})); })()`);
  await sleep(300);
  { const tt = await text(); check("Reports: type filter works", /\b2 reports/.test(tt), (tt.match(/\d+ reports?/) || [""])[0]); }
  await shot("13-reports");
  // open a report
  await evaluate(`document.querySelector('main a[href^="/app/scans/"]').click()`);
  await sleep(2000);
  check("Report detail page loads", /Scan report/.test(await text()) && /Risk Score/.test(await text()));
  await shot("14-report-detail");
  // delete via confirm dialog
  await go(APP + "/app/reports", 2000);
  await evaluate(`document.querySelector('button[aria-label^="Delete report"]').click()`);
  await sleep(500);
  check("Delete asks for confirmation", /Delete this report\?/.test(await text()));
  await clickText("[role=dialog] button", /^\s*Delete\s*$/);
  await sleep(1500);
  { const tt = await text(); check("Delete removes the report", /\b2 reports/.test(tt), (tt.match(/\d+ reports?/) || [""])[0]); }

  // ---------- Other app pages ----------
  for (const [path, name, re] of [
    ["/app/news", "15-news", /Latest Cybersecurity News/],
    ["/app/learn", "16-learn", /Learning Hub/],
    ["/app/settings", "17-settings", /Sync Scan History/],
    ["/app/incident", "18-incident", /Call 1930/],
    ["/app/intel", "19-intel-redirect", /Latest Cybersecurity News/],
  ]) {
    await go(APP + path, 2000);
    check(`App route ${path}`, await waitText(re));
    await shot(name);
  }
  for (const [path, name, re] of [
    ["/app/updates", "21-updates", /Read source/],
    ["/app/law", "22-law", /Verified record/],
    ["/app/quiz", "23-quiz", /Question 1 of 5/],
  ]) {
    await go(APP + path, 2000);
    check(`Content route ${path}`, await waitText(re));
    await shot(name);
  }
  // Daily quiz end to end: answer every question, submit, server returns a score.
  await go(APP + "/app/quiz", 2000);
  await waitText(/Question 1 of 5/);
  for (let i = 0; i < 5; i++) {
    await evaluate(`document.querySelector('[role=radiogroup] [role=radio]').click()`);
    await sleep(150);
    if (i < 4) await clickText("button", /^\s*Next/);
    await sleep(150);
  }
  await clickText("button", /Submit answers/);
  check("Daily quiz graded by the server with explanations", await waitText(/\d \/ 5/) && /Correct answer:/.test(await text()));
  check("Daily quiz result is saved for signed-in users", /Saved to your progress|already completed/.test(await text()));
  await go(APP + "/app/intel", 1500);
  check("/app/intel redirects to /app/news", (await evaluate("location.pathname")) === "/app/news");

  // Learn: open lesson + quiz (signed in → not gated)
  await go(APP + "/app/learn", 2000);
  await clickText("button", /Spotting Phishing/);
  await sleep(1500);
  t = await text();
  check("Lesson dialog opens with read time", /min read/.test(t) && /Check your understanding/.test(t));
  check("Quiz is available when signed in", !/Sign in to take this quiz/.test(t));
  await shot("20-lesson", false);

  // Settings: reduce motion toggle persists
  await go(APP + "/app/settings", 1500);
  await evaluate(`document.querySelector('[aria-label="Reduce motion"]').click()`);
  await sleep(300);
  check("Reduce-motion toggle applies + persists",
    (await evaluate("document.documentElement.classList.contains('reduce-motion') && localStorage.getItem('cs360-reduce-motion') === '1'")));
  await evaluate(`document.querySelector('[aria-label="Reduce motion"]').click()`);

  // ---------- Responsive: phone width ----------
  await viewport(390, 844, true);
  for (const [path, name] of [
    ["/", "m01-landing"], ["/login", "m02-login"], ["/app", "m03-dashboard"], ["/app/scan", "m04-scan"],
    ["/app/reports", "m05-reports"], ["/app/news", "m06-news"], ["/app/learn", "m07-learn"],
    ["/app/settings", "m08-settings"], ["/browser-protection", "m09-browser"],
  ]) {
    await go(APP + path, 1800);
    check(`No horizontal scroll at 390px: ${path}`, await noHScroll());
    await shot(name);
  }
  // Mobile nav drawer
  await go(APP + "/app", 1500);
  await evaluate(`document.querySelector('button[aria-label="Open navigation"]').click()`);
  await sleep(600);
  check("Mobile nav drawer opens", await evaluate(`!!document.querySelector('[role=dialog] nav[aria-label=Main]')`));
  await shot("m10-drawer", false);

  // Guest experience
  await evaluate("localStorage.clear()");
  await go(APP + "/app/learn", 1800);
  check("Guest: quiz gated on Learn", /Sign in to take this quiz/.test(await text()));
  await go(APP + "/app/reports", 1500);
  check("Guest: reports ask to sign in", /Sign in to see your reports/.test(await text()));

  // ---------- Extension pages (static render) ----------
  await viewport(360, 640);
  await go(pathToFileURL(join(resolve(EXT), "popup.html")).href, 1200);
  await shot("x01-ext-popup");
  await viewport(1000, 700);
  await go(pathToFileURL(join(resolve(EXT), "warning.html")).href, 1200);
  await shot("x02-ext-warning");
  await go(pathToFileURL(join(resolve(EXT), "options.html")).href, 1200);
  await shot("x03-ext-options");

  const appErrors = consoleErrors.filter((e) => !/chrome\.|Cannot read properties of undefined \(reading '(local|sync|runtime|tabs|storage|permissions)'\)|ERR_FILE|favicon/.test(String(e)));
  check("No uncaught app errors in console", appErrors.length === 0, appErrors.slice(0, 3).join(" | "));
} catch (e) {
  check("script", false, e.stack);
} finally {
  writeFileSync(join(OUT, "results.json"), JSON.stringify(results, null, 2));
  const failed = results.filter((r) => !r.pass).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  try { ws?.close(); } catch { /* */ }
  chrome.kill();
  process.exit(failed ? 1 : 0);
}
