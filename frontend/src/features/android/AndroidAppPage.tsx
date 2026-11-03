import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  BellRing, CheckCircle2, Copy, Download, EyeOff, Info, Link2, ListChecks, Lock, Share2, ShieldCheck, Smartphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { useToast } from "@/components/ui/toast";

export interface AndroidRelease {
  name: string; version: string; version_code: number; file: string; size_bytes: number;
  sha256: string; build_timestamp: string; min_android: string; release_notes?: string[];
}

/** The signed APK published by `android/publish.mjs`. */
export function useAndroidRelease() {
  return useQuery({
    queryKey: ["android-release"],
    queryFn: async () => {
      const r = await fetch("/apps/android-release.json", { cache: "no-store" });
      if (!r.ok) throw new Error("not found");
      return (await r.json()) as AndroidRelease;
    },
    retry: false,
    staleTime: 5 * 60_000,
  });
}

const FEATURES = [
  { icon: BellRing, title: "Automatic alerts", text: "Checks new notifications from the apps you pick and warns you about scams and phishing." },
  { icon: Link2, title: "Check a link or message", text: "Paste any suspicious link, SMS or WhatsApp text and get a verdict in seconds." },
  { icon: Share2, title: "Share to check", text: "In any app, tap Share → Check with CyberShield360." },
  { icon: Lock, title: "Private by design", text: "One-time codes, passwords and card numbers are removed on your phone before anything is sent." },
];

const STEPS = [
  <>Open this page <b className="text-foreground">on your Android phone</b> and tap <b className="text-foreground">Download</b>.</>,
  <>Open the downloaded file. Android asks to allow installs from your browser — allow it for this install.</>,
  <>Tap <b className="text-foreground">Install</b>. Google Play Protect may say the app is unknown, because it isn't on the Play Store yet.</>,
  <>Open the app and read what it does. On this site, go to <b className="text-foreground">Message Protection → Connected sources → Pair an Android phone</b> and enter the code in the app.</>,
  <>Turn on <b className="text-foreground">Notification access</b> when the app asks, allow alerts, and choose which apps to check.</>,
];

const fmtSize = (b: number) => `${(b / 1024 / 1024).toFixed(1)} MB`;

function PhonePreview() {
  return (
    <div aria-hidden className="mx-auto w-64 rounded-[2.2rem] border-4 border-foreground/80 bg-card p-3 shadow-elev">
      <div className="mx-auto mb-3 h-1.5 w-16 rounded-full bg-foreground/30" />
      <div className="rounded-xl border border-danger/40 bg-danger-soft/60 p-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-danger"><ShieldCheck className="size-4" /> Possible scam in WhatsApp</div>
        <p className="mt-1 text-[11px] text-muted-foreground">A prize is offered but you must pay first — a classic advance-fee scam. Don't reply, pay or share codes.</p>
      </div>
      <div className="mt-3 space-y-2 rounded-xl bg-background-2 p-3">
        <div className="text-[11px] font-semibold">Apps to check</div>
        {["WhatsApp", "Messages", "Gmail"].map((a) => (
          <div key={a} className="flex items-center justify-between text-[11px]"><span>{a}</span><CheckCircle2 className="size-3.5 text-primary" /></div>
        ))}
      </div>
      <div className="mt-3 rounded-xl bg-background-2 p-3 text-[11px] text-muted-foreground">Notification access: <b className="text-success">granted</b></div>
    </div>
  );
}

export function AndroidAppPage() {
  const rel = useAndroidRelease();
  const r = rel.data;
  const push = useToast();

  async function copyHash() {
    if (!r) return;
    try { await navigator.clipboard.writeText(r.sha256); push({ title: "SHA-256 copied", tone: "success" }); }
    catch { push({ title: "Couldn't copy", tone: "error" }); }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PublicHeader />
      <main id="main" className="flex-1">
        <section className="relative isolate overflow-hidden border-b">
          <div aria-hidden className="absolute inset-0 -z-10 grid-texture opacity-30 [mask-image:radial-gradient(ellipse_at_top_right,black,transparent_70%)]" />
          <div aria-hidden className="absolute -right-32 -top-32 -z-10 size-[28rem] rounded-full bg-primary/10 blur-3xl" />
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.2fr_1fr]">
            <div>
              <div className="eyebrow flex items-center gap-1.5"><Smartphone className="size-4" /> Android app</div>
              <h1 className="mt-3 font-display text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
                Scam warnings <span className="text-brand-gradient">on your phone.</span>
              </h1>
              <p className="mt-4 max-w-xl text-lg text-muted-foreground">
                CyberShield360 Protect checks notifications from the apps you choose and warns you before you reply,
                pay or share a code. It uses the same checking engine as this site. It helps, but it can't guarantee a
                message is safe.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                {r ? (
                  <Button size="lg" asChild><a href={`/apps/${r.file}`} download><Download /> Download v{r.version} (APK)</a></Button>
                ) : (
                  <Button size="lg" disabled><Download /> {rel.isLoading ? "Checking…" : "Download unavailable"}</Button>
                )}
                <Button size="lg" variant="outline" asChild><a href="#install">How to install</a></Button>
              </div>
              <p className="mt-3 text-xs text-subtle">Android {r?.min_android.split(" ")[0] ?? "8.1"} or newer · Direct install (Google Play listing pending)</p>
            </div>
            <PhonePreview />
          </div>
        </section>

        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-xl border bg-card p-5">
                <span className="flex size-10 items-center justify-center rounded-lg bg-primary/12 text-primary ring-1 ring-primary/25"><f.icon className="size-5" /></span>
                <h2 className="mt-4 font-semibold">{f.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
              </div>
            ))}
          </div>

          <h2 className="mt-16 font-display text-2xl font-semibold">Download</h2>
          <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Latest release</CardTitle></CardHeader>
              <CardContent>
                {rel.isLoading ? <div className="h-24 animate-pulse rounded-lg bg-muted" /> : !r ? (
                  <p className="text-sm text-muted-foreground">No Android build is published yet.</p>
                ) : (
                  <>
                    <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                      <div><dt className="text-xs text-subtle">Version</dt><dd className="font-medium">v{r.version}</dd></div>
                      <div><dt className="text-xs text-subtle">Size</dt><dd className="font-medium">{fmtSize(r.size_bytes)}</dd></div>
                      <div><dt className="text-xs text-subtle">Built</dt><dd className="font-medium">{new Date(r.build_timestamp).toLocaleDateString()}</dd></div>
                      <div><dt className="text-xs text-subtle">Needs</dt><dd className="font-medium">Android {r.min_android.split(" ")[0]}+</dd></div>
                    </dl>
                    <Button className="mt-5 w-full" asChild>
                      <a href={`/apps/${r.file}`} download><Download /> Download Android app (APK)</a>
                    </Button>
                    <div className="mt-3 flex items-start gap-2">
                      <p className="min-w-0 flex-1 break-all font-mono text-[11px] text-muted-foreground">SHA-256: {r.sha256}</p>
                      <Button size="icon" variant="ghost" aria-label="Copy SHA-256" onClick={copyHash}><Copy className="size-4" /></Button>
                    </div>
                    {r.release_notes && (
                      <div className="mt-4 border-t pt-4">
                        <div className="text-sm font-medium">What's in v{r.version}</div>
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
              <CardHeader className="pb-3"><CardTitle className="text-base">Google Play</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  A Play Store listing is <b className="text-foreground">not published yet</b>. Until Google reviews it, install the
                  APK directly. Check the SHA-256 above matches the file you downloaded.
                </p>
                <Button className="mt-4 w-full" variant="outline" disabled><Smartphone /> Get it on Google Play — pending</Button>
                <p className="mt-4 text-sm text-muted-foreground">
                  Want protection on your computer instead? <Link to="/browser-protection" className="text-primary hover:underline">Get the browser extension</Link>.
                </p>
              </CardContent>
            </Card>
          </div>

          <section id="install" className="mt-16 scroll-mt-20">
            <h2 className="font-display text-2xl font-semibold">How to install</h2>
            <ol className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {STEPS.map((s, i) => (
                <li key={i} className="flex gap-3 rounded-xl border bg-card p-4 text-sm text-muted-foreground">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/12 font-semibold text-primary">{i + 1}</span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
          </section>

          <section className="mt-16 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border bg-card p-5">
              <h2 className="flex items-center gap-2 font-semibold"><ListChecks className="size-5 text-primary" /> What it reads — and doesn't</h2>
              <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
                <li>Only notifications from apps <b className="text-foreground">you select</b>; nothing is checked until you pick apps.</li>
                <li>Only what the notification shows — not your whole conversations.</li>
                <li>Never your SMS inbox, call log, contacts or list of installed apps.</li>
                <li>It never replies, deletes or blocks anything. Pause or disconnect any time.</li>
              </ul>
            </div>
            <div className="rounded-2xl border bg-card p-5">
              <h2 className="flex items-center gap-2 font-semibold"><Info className="size-5 text-primary" /> Good to know</h2>
              <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
                <li className="flex-none"><EyeOff className="mr-1 inline size-3.5" />If an app hides notification previews, there's nothing to check.</li>
                <li>Android 15 and later hide one-time codes from apps like this one.</li>
                <li>Some phone brands stop background apps to save battery; if alerts stop, allow CyberShield360 to run in the background.</li>
                <li>Not available for iPhone yet.</li>
              </ul>
            </div>
          </section>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
