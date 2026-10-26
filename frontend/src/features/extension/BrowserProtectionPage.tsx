import { Link } from "react-router-dom";
import {
  Download, Puzzle, ScanSearch, Ban, Lock, CheckCircle2, AlertTriangle, Bell, ToggleRight,
  ShieldCheck, Copy, FileText, Link2, QrCode, Type, SlidersHorizontal, Settings,
} from "lucide-react";
import { useExtensionRelease } from "./release";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { LogoMark } from "@/components/brand/Logo";
import { useToast } from "@/components/ui/toast";


const REPO = "https://github.com/indramadesh/CyberShield360";

const FEATURES = [
  { icon: ToggleRight, title: "Automatic checks", text: "Each page you open is checked by URL. Turn it off any time — manual analysis still works." },
  { icon: Ban, title: "Blocks high-risk pages", text: "Pages at or above your threshold (default 50/100) are stopped with a clear warning page." },
  { icon: Bell, title: "Explains lower risk", text: "Below the threshold you get a notification with the details instead of a block." },
  { icon: ScanSearch, title: "Scan anything", text: "Check a link, message, email, QR image, screenshot or website from the popup." },
];

const PERMISSION_NOTES: Record<string, string> = {
  activeTab: "Read the current tab's URL when you click the extension.",
  webNavigation: "Notice page navigations so pages can be auto-checked (URL only — never page content).",
  notifications: "Show a details notification for lower-risk pages.",
  storage: "Save your settings and a small local cache.",
  declarativeNetRequest: "Block known-malicious domains at the network layer.",
  alarms: "Periodically refresh the known-bad list.",
};

function fmtSize(b?: number) {
  if (!b) return "—";
  return b < 1024 * 1024 ? `${Math.round(b / 1024)} KB` : `${(b / 1024 / 1024).toFixed(2)} MB`;
}

/** HTML/CSS rendition of the extension popup — not a screenshot, nothing clickable. */
function PopupPreview() {
  const tiles = [
    { icon: Link2, label: "Scan Link" }, { icon: QrCode, label: "Scan QR" },
    { icon: Type, label: "Scan Text" }, { icon: SlidersHorizontal, label: "Settings" },
  ];
  return (
    <div aria-hidden className="mx-auto w-full max-w-[20rem] rounded-2xl border border-[#203B33] bg-[#06110F] p-4 text-[#E8F5EF] shadow-elev">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-2 font-display text-sm font-semibold"><LogoMark className="size-5" /> CyberShield<span className="-ml-2 text-[#19E6A0]">360</span></span>
        <span className="flex size-8 items-center justify-center rounded-lg border border-[#203B33] text-[#9BB8AD]"><Settings className="size-4" /></span>
      </div>
      <div className="mt-4 rounded-2xl border border-[#203B33] bg-[radial-gradient(220px_140px_at_50%_0%,rgba(25,230,160,0.16),transparent_70%)] p-4 text-center">
        <ShieldCheck className="mx-auto size-14 text-[#19E6A0] drop-shadow-[0_0_18px_rgba(25,230,160,0.55)]" />
        <div className="mt-2 font-display text-lg font-semibold">This website looks <span className="text-[#19E6A0]">safe</span></div>
        <div className="text-xs text-[#9BB8AD]">www.example.com</div>
        <div className="mt-3 rounded-lg bg-[#19E6A0] py-2 text-sm font-semibold text-[#06110F]">Analyze This Site</div>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2">
        {tiles.map((t) => (
          <span key={t.label} className="flex flex-col items-center gap-1 rounded-xl border border-[#203B33] bg-[#0A1916] py-2 text-[0.6rem]">
            <t.icon className="size-4 text-[#19E6A0]" />{t.label}
          </span>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between rounded-xl border border-[#203B33] bg-[#0A1916] px-3 py-2 text-xs">
        <span><span className="block font-semibold">Protection</span><span className="text-[#9BB8AD]">Real-time protection is <b className="text-[#19E6A0]">ON</b></span></span>
        <span className="relative h-5 w-9 rounded-full bg-[#19E6A0]"><span className="absolute right-0.5 top-0.5 size-4 rounded-full bg-white" /></span>
      </div>
    </div>
  );
}

export function BrowserProtectionPage() {
  const push = useToast();
  const rel = useExtensionRelease();
  const r = rel.data;

  async function copyHash() {
    if (!r) return;
    try { await navigator.clipboard.writeText(r.sha256); push({ title: "SHA-256 copied", tone: "success" }); }
    catch { push({ title: "Couldn't copy", tone: "error" }); }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PublicHeader />
      <main id="main" className="flex-1">
        {/* Hero */}
        <section className="relative isolate overflow-hidden border-b">
          <div aria-hidden className="absolute inset-0 -z-10 grid-texture opacity-30 [mask-image:radial-gradient(ellipse_at_top_right,black,transparent_70%)]" />
          <div aria-hidden className="absolute -right-32 -top-32 -z-10 size-[28rem] rounded-full bg-primary/10 blur-3xl" />
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.2fr_1fr]">
            <div>
              <div className="eyebrow">Browser protection</div>
              <h1 className="mt-3 font-display text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
                Protection that <span className="text-brand-gradient">travels with you.</span>
              </h1>
              <p className="mt-4 max-w-xl text-lg text-muted-foreground">
                A lightweight Chrome extension that checks pages as you browse and warns you about risky
                sites — powered by the same engine as this platform. An assistance tool, not a guarantee.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                {r ? (
                  <Button size="lg" asChild><a href={`/downloads/${r.file}`} download><Download /> Download v{r.version}</a></Button>
                ) : (
                  <Button size="lg" disabled><Download /> Download unavailable</Button>
                )}
                <Button size="lg" variant="outline" asChild><a href="#how-to-install">How to install</a></Button>
              </div>
              <p className="mt-3 text-xs text-subtle">Chrome{r?.chrome_min_version ? ` ${r.chrome_min_version}+` : ""} and Chromium-based browsers · Manual install (Web Store listing pending)</p>
            </div>
            <PopupPreview />
          </div>
        </section>

        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          {/* Features */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="rounded-xl border bg-card p-5">
                  <span className="flex size-10 items-center justify-center rounded-lg bg-primary/12 text-primary ring-1 ring-primary/25"><Icon className="size-5" /></span>
                  <h2 className="mt-4 font-semibold">{f.title}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
                </div>
              );
            })}
          </div>

          {/* Download center */}
          <h2 className="mt-16 font-display text-2xl font-semibold">Download center</h2>
          <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Latest release</CardTitle></CardHeader>
              <CardContent>
                {rel.isLoading ? (
                  <div className="h-24 animate-pulse rounded-lg bg-muted" />
                ) : rel.isError || !r ? (
                  <p className="text-sm text-muted-foreground">
                    No build is available yet. Run <code className="rounded bg-muted px-1">npm run build</code> in the
                    <code className="rounded bg-muted px-1">extension/</code> folder to generate the package.
                  </p>
                ) : (
                  <>
                    <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                      <div><dt className="text-xs text-subtle">Version</dt><dd className="font-medium">v{r.version}</dd></div>
                      <div><dt className="text-xs text-subtle">Size</dt><dd className="font-medium">{fmtSize(r.size_bytes)}</dd></div>
                      <div><dt className="text-xs text-subtle">Built</dt><dd className="font-medium">{new Date(r.build_timestamp).toLocaleDateString()}</dd></div>
                      <div><dt className="text-xs text-subtle">Format</dt><dd className="font-medium">ZIP (MV3)</dd></div>
                    </dl>
                    <Button className="mt-5 w-full" asChild>
                      <a href={`/downloads/${r.file}`} download><Download /> Download extension ZIP</a>
                    </Button>
                    <div className="mt-3 flex items-start gap-2">
                      <p className="min-w-0 flex-1 break-all font-mono text-[11px] text-muted-foreground">SHA-256: {r.sha256}</p>
                      <Button size="icon" variant="ghost" aria-label="Copy SHA-256" onClick={copyHash}><Copy className="size-4" /></Button>
                    </div>
                    {r.release_notes && r.release_notes.length > 0 && (
                      <div className="mt-4 border-t pt-4">
                        <div className="text-sm font-medium">What's new in v{r.version}</div>
                        <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                          {r.release_notes.map((n) => <li key={n} className="flex gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />{n}</li>)}
                        </ul>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Chrome Web Store</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  A one-click Web Store listing is <b className="text-foreground">not published yet</b>. Until Google
                  reviews and approves it, use the manual install.
                </p>
                <Button className="mt-4 w-full" variant="outline" disabled>
                  <Puzzle /> Add to Chrome — pending publication
                </Button>
                <a href={`${REPO}/blob/main/extension/CHANGELOG.md`} target="_blank" rel="noreferrer"
                   className="mt-4 inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
                  <FileText className="size-4" /> Full changelog
                </a>
              </CardContent>
            </Card>
          </div>

          {/* Install steps */}
          <section id="how-to-install" className="mt-16 scroll-mt-20">
            <h2 className="font-display text-2xl font-semibold">How to install</h2>
            <p className="mt-3 flex items-start gap-2 text-sm text-muted-foreground">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
              A downloaded ZIP can't be installed by opening it. Extract it first, then load the folder in Chrome's Developer mode.
            </p>
            <ol className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {[
                <>Download and <b>extract</b> the ZIP to a folder.</>,
                <>Open <code className="rounded bg-muted px-1">chrome://extensions</code>.</>,
                <>Turn on <b>Developer mode</b> (top-right).</>,
                <>Click <b>Load unpacked</b> and pick the folder containing <code className="rounded bg-muted px-1">manifest.json</code>.</>,
                <>Open the extension → <b>Settings</b> and set the backend URL of your CyberShield360 server.</>,
              ].map((step, i) => (
                <li key={i} className="rounded-xl border bg-card p-4 text-sm">
                  <span className="flex size-7 items-center justify-center rounded-full border border-primary/40 bg-primary/10 font-display text-xs font-semibold text-primary">{i + 1}</span>
                  <p className="mt-3 text-muted-foreground">{step}</p>
                </li>
              ))}
            </ol>
          </section>

          {/* Permissions + privacy */}
          <div className="mt-16 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Permissions &amp; why</CardTitle></CardHeader>
              <CardContent>
                <ul className="space-y-2.5 text-sm">
                  {(r?.permissions ?? Object.keys(PERMISSION_NOTES)).map((p) => (
                    <li key={p} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
                      <span><code className="rounded bg-muted px-1 text-xs">{p}</code> — <span className="text-muted-foreground">{PERMISSION_NOTES[p] ?? "Required for extension functionality."}</span></span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-xs text-subtle">Access to your backend's host is requested at runtime, only for the server you configure.</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Lock className="size-4 text-primary" /> Privacy &amp; limitations</CardTitle></CardHeader>
              <CardContent className="space-y-2.5 text-sm text-muted-foreground">
                <p>Never reads page content, and never collects passwords, OTPs, cookies or payment data.</p>
                <p>With automatic checks on, the URL of each page you open is sent to the backend <i>you</i> configure. Turn automatic checks off to send only what you choose to analyze.</p>
                <p>The known-bad blocklist is bounded and not exhaustive. No block is not proof that a site is safe.</p>
                <a href={`${REPO}/blob/main/extension/PRIVACY_POLICY.md`} target="_blank" rel="noreferrer" className="inline-block text-primary hover:underline">Read the full privacy policy</a>
              </CardContent>
            </Card>
          </div>

          <div className="mt-12 flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-background-2 p-5">
            <p className="text-sm text-muted-foreground">Don't want to install anything? Scan from the web app instead.</p>
            <Button variant="outline" asChild><Link to="/app/scan">Open the scanner</Link></Button>
          </div>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
