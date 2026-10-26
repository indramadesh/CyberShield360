import { useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ScanSearch, ShieldCheck, Bell, ArrowRight, Link2, MessageSquare, Mail,
  Image as ImageIcon, QrCode, Globe, Eye, Lock, FileSearch, Scale, CheckCircle2, Monitor, PlayCircle,
} from "lucide-react";
import { CinematicScene } from "@/components/art/CinematicScene";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RiskGauge } from "@/components/ui/RiskGauge";
import { LogoMark } from "@/components/brand/Logo";
import { DemoDialog } from "./DemoDialog";
import { GatedLink } from "@/features/auth/gate";
import { DownloadExtensionButton } from "@/features/extension/release";
import { useConfig } from "@/config/useConfig";
import { useAuth } from "@/features/auth/useAuth";
import { apiFetch } from "@/services/api";
import type { FeatureKey } from "@/types";

const PILLARS = [
  { icon: ScanSearch, title: "Scan & Detect", text: "URLs, messages, files & more", to: "/app/scan" },
  { icon: Monitor, title: "Real-Time Protection", text: "Browser extension", to: "/browser-protection" },
  { icon: ShieldCheck, title: "Learn & Stay Safe", text: "Guides, updates, best practices", to: "/app/learn" },
  { icon: Bell, title: "Latest Threat Alerts", text: "News, scams & cyber laws", to: "/app/news" },
];

const STEPS = [
  { n: "01", title: "Submit", text: "Paste a link or message, upload a screenshot, or scan a QR code." },
  { n: "02", title: "Analyze", text: "Rules, machine-learning signals and threat intelligence run together." },
  { n: "03", title: "Understand", text: "See the risk, the confidence and every piece of evidence." },
  { n: "04", title: "Respond", text: "Get specific next steps — and help if something already happened." },
];

const METHODS: { key: FeatureKey; type: string; icon: typeof Link2; title: string; text: string }[] = [
  { key: "url_scanner", type: "URL", icon: Link2, title: "Links", text: "Lookalike domains, risky redirects, known-bad infrastructure." },
  { key: "message_scanner", type: "MESSAGE", icon: MessageSquare, title: "Messages", text: "Urgency, OTP / UPI requests and impersonation in SMS & chat." },
  { key: "email_scanner", type: "EMAIL", icon: Mail, title: "Emails", text: "Sender spoofing, reply-to mismatches and dangerous links." },
  { key: "image_scanner", type: "IMAGE", icon: ImageIcon, title: "Screenshots", text: "Reads text and links in images and posters (OCR)." },
  { key: "qr_scanner", type: "QR", icon: QrCode, title: "QR codes", text: "Decode first, check the destination, then decide." },
  { key: "website_scanner", type: "WEBSITE", icon: Globe, title: "Websites", text: "Opened in an isolated sandbox to inspect forms and redirects." },
];

const PRINCIPLES = [
  { icon: Eye, title: "Evidence, not verdicts", text: "Every result lists the indicators behind it." },
  { icon: Scale, title: "Risk ≠ confidence", text: "We show how risky and how sure — separately." },
  { icon: Lock, title: "Privacy by default", text: "Personal data is redacted before it is stored." },
  { icon: FileSearch, title: "Honest about limits", text: "“No known threats” never means guaranteed safe." },
];

function Section({ id, eyebrow, title, intro, children, className = "" }: {
  id?: string; eyebrow: string; title: string; intro?: string; children: ReactNode; className?: string;
}) {
  return (
    <section id={id} className={`mx-auto max-w-7xl px-4 py-20 sm:px-6 ${className}`}>
      <div className="max-w-2xl">
        <div className="eyebrow">{eyebrow}</div>
        <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h2>
        {intro && <p className="mt-3 text-muted-foreground">{intro}</p>}
      </div>
      <div className="mt-10">{children}</div>
    </section>
  );
}

export function HomePage() {
  const { data } = useConfig();
  const { user } = useAuth();
  const lessons = useQuery({
    queryKey: ["lessons"],
    queryFn: () => apiFetch<{ slug: string; title: string; summary: string; category: string }[]>("/awareness"),
  });
  const [demo, setDemo] = useState(false);
  const methods = METHODS.filter((m) => data?.features?.[m.key] ?? true);


  return (
    <div className="min-h-screen bg-background">
      {/* ================= HERO ================= */}
      <section className="relative isolate overflow-hidden bg-background text-foreground">
        <CinematicScene variant="hero" className="-z-10" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-background/90 via-background/35 to-transparent max-lg:via-background/70" />
        <div className="absolute inset-x-0 bottom-0 -z-10 h-40 bg-gradient-to-t from-background to-transparent" />
        <PublicHeader overlay />

        {/* vertical tagline (reference: right edge) */}
        <p aria-hidden className="absolute right-[7%] top-36 hidden font-display text-xs font-medium uppercase leading-6 tracking-[0.45em] text-muted-foreground xl:block">
          A safer<br />internet<br />starts<br />with you
        </p>

        <div className="mx-auto flex min-h-[100svh] max-w-7xl flex-col px-4 pt-28 sm:px-6">
          <div className="flex flex-1 flex-col justify-center pb-10">
            {data?.demo_mode && (
              <Badge variant="warning" className="mb-5 w-fit border border-warning/30">Demo mode · synthetic data</Badge>
            )}
            <h1 className="max-w-xl font-display text-5xl font-bold leading-[1.02] tracking-tight sm:text-6xl lg:text-[4.6rem]">
              Stay One<br />Step Ahead<br /><span className="text-primary">Online</span>
            </h1>
            <p className="mt-6 text-lg font-semibold">
              Detect. <span className="text-primary">Prevent.</span> Learn. <span className="text-primary">Stay Informed.</span>
            </p>
            <p className="mt-3 max-w-md text-[0.95rem] leading-relaxed text-muted-foreground">
              CyberShield360 helps you identify and avoid online threats with smart scanning,
              real-time protection and cybersecurity awareness — all in one place.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button size="lg" asChild>
                <Link to={user ? "/app" : "/login?mode=register"}>Get Started <ArrowRight /></Link>
              </Button>
              <Button size="lg" variant="outline" onClick={() => setDemo(true)}
                className="bg-background/40 backdrop-blur hover:bg-background/70">
                <PlayCircle /> Watch Demo
              </Button>
              <DownloadExtensionButton size="lg" variant="ghost" className="hover:bg-primary/10" />
            </div>
          </div>

          {/* Pillars: one glass strip with dividers */}
          <div className="mb-10 grid divide-y divide-border/70 overflow-hidden rounded-2xl border border-border/70 bg-background/60 backdrop-blur-md sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x">
            {PILLARS.map((p) => {
              const Icon = p.icon;
              return (
                <GatedLink key={p.title} to={p.to}
                  className="group flex flex-col gap-3 p-5 transition-colors hover:bg-primary/[0.06]">
                  <span className="flex size-11 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary shadow-[0_0_24px_hsl(var(--primary)/0.18)]">
                    <Icon className="size-5" />
                  </span>
                  <span>
                    <span className="block font-semibold">{p.title}</span>
                    <span className="mt-0.5 block text-sm text-muted-foreground">{p.text}</span>
                  </span>
                </GatedLink>
              );
            })}
          </div>
        </div>
      </section>
      <DemoDialog open={demo} onOpenChange={setDemo} />

      {/* ================= HOW IT WORKS ================= */}
      <Section id="how" eyebrow="How it works" title="From “is this safe?” to a clear next step"
               intro="Four steps, the same for every kind of content you check.">
        <ol className="grid gap-6 md:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.n} className="relative">
              {i < STEPS.length - 1 && <span aria-hidden className="absolute left-12 right-0 top-5 hidden h-px bg-gradient-to-r from-primary/50 to-transparent md:block" />}
              <span className="flex size-10 items-center justify-center rounded-full border border-primary/40 bg-primary/10 font-display text-sm font-semibold text-primary">{s.n}</span>
              <h3 className="mt-4 font-display text-lg font-semibold">{s.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{s.text}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* ================= METHODS ================= */}
      <div className="border-y bg-background-2/50">
        <Section eyebrow="Supported scanning" title="One place to check what looks suspicious">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {methods.map((m) => {
              const Icon = m.icon;
              return (
                <GatedLink key={m.key} to={`/app/scan?type=${m.type}`}
                  className="group rounded-xl border bg-card p-5 transition-colors hover:border-primary/50">
                  <Icon className="size-6 text-primary" />
                  <h3 className="mt-4 font-display text-lg font-semibold">{m.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{m.text}</p>
                  <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
                    Scan now <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </GatedLink>
              );
            })}
          </div>
        </Section>
      </div>

      {/* ================= EXPLAINABLE RESULTS ================= */}
      <Section eyebrow="Explainable analysis" title="See exactly why something was flagged"
               intro="Every report separates risk from confidence and lists the evidence — no black-box verdicts.">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <ul className="space-y-4">
            {["Risk score and severity band, with an honest confidence level",
              "Each indicator explained: what it is and why it matters",
              "Recommendations matched to what was actually found",
              "Technical details for analysts, collapsed for everyone else"].map((t) => (
              <li key={t} className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" /><span className="text-muted-foreground">{t}</span></li>
            ))}
          </ul>
          <figure className="rounded-2xl border bg-card p-6 shadow-elev">
            <figcaption className="mb-4 flex items-center justify-between text-xs text-subtle">
              <span>Example report</span><span>synthetic sample</span>
            </figcaption>
            <div className="flex items-center gap-5">
              <RiskGauge score={92} level="CRITICAL" size={112} />
              <div>
                <div className="font-display text-xl font-semibold text-danger">High risk · Phishing</div>
                <div className="mt-1 break-all text-sm text-muted-foreground">http://secure-login-verify.example/login</div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Badge variant="danger">Threat intel match</Badge>
                  <Badge variant="high">Credential form</Badge>
                  <Badge variant="warning">Redirect</Badge>
                </div>
              </div>
            </div>
            <div className="mt-5 grid gap-3 border-t pt-4 text-sm sm:grid-cols-2">
              <div><div className="font-medium">What we found</div><p className="mt-1 text-muted-foreground">Domain on a known phishing list; page asks for a password.</p></div>
              <div><div className="font-medium">What to do</div><p className="mt-1 text-muted-foreground">Don't enter credentials. Open the official site yourself.</p></div>
            </div>
          </figure>
        </div>
      </Section>

      {/* ================= EXTENSION ================= */}
      <div className="border-y bg-background-2/50">
        <Section eyebrow="Browser protection" title="Protection that travels with you"
                 intro="The CyberShield360 extension checks pages as you browse and warns you about known-malicious sites — using the same engine as this platform.">
          <div className="grid items-center gap-10 lg:grid-cols-[1.2fr_1fr]">
            <div className="flex flex-wrap gap-3">
              <DownloadExtensionButton />
              <Button variant="outline" asChild><GatedLink to="/browser-protection#how-to-install">How to install</GatedLink></Button>
            </div>
            <div aria-hidden className="mx-auto w-full max-w-xs rounded-2xl border bg-card p-5 text-center shadow-elev">
              <div className="flex items-center justify-between text-xs text-subtle"><span className="inline-flex items-center gap-1.5"><LogoMark className="size-4" /> CyberShield360</span><span>Preview</span></div>
              <div className="mx-auto mt-5 flex size-16 items-center justify-center rounded-2xl bg-primary/12 ring-1 ring-primary/30"><ShieldCheck className="size-8 text-primary" /></div>
              <div className="mt-3 font-display text-lg font-semibold">No known threats found</div>
              <div className="text-xs text-muted-foreground">www.example.com</div>
              <div className="mt-4 rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground">Analyze this site</div>
              <div className="mt-3 flex items-center justify-between rounded-lg border px-3 py-2 text-xs"><span>Automatic protection</span><span className="h-4 w-7 rounded-full bg-primary/80" /></div>
            </div>
          </div>
        </Section>
      </div>

      {/* ================= LEARNING (real lessons) ================= */}
      {lessons.data && lessons.data.length > 0 && (
        <Section eyebrow="Learning hub" title="Build instincts, not just alerts"
                 intro="Bite-size lessons on the scams people actually face.">
          <div className="grid gap-4 md:grid-cols-3">
            {lessons.data.slice(0, 3).map((l) => (
              <GatedLink key={l.slug} to="/app/learn" className="rounded-xl border bg-card p-5 transition-colors hover:border-primary/50">
                <Badge variant="default" className="capitalize">{l.category.replace(/_/g, " ")}</Badge>
                <h3 className="mt-3 font-display text-lg font-semibold">{l.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{l.summary}</p>
              </GatedLink>
            ))}
          </div>
        </Section>
      )}

      {/* ================= TRUST ================= */}
      <div className="border-y bg-background-2/50">
        <Section eyebrow="Trust & privacy" title="Built to be honest about what it knows">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {PRINCIPLES.map((p) => {
              const Icon = p.icon;
              return (
                <div key={p.title}>
                  <Icon className="size-6 text-primary" />
                  <h3 className="mt-3 font-semibold">{p.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{p.text}</p>
                </div>
              );
            })}
          </div>
        </Section>
      </div>

      {/* ================= FINAL CTA ================= */}
      <section className="relative isolate overflow-hidden">
        <div aria-hidden className="absolute inset-0 -z-10 grid-texture opacity-40 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
        <div className="mx-auto max-w-3xl px-4 py-24 text-center sm:px-6">
          <LogoMark className="mx-auto size-12" />
          <h2 className="mt-5 font-display text-3xl font-semibold tracking-tight sm:text-4xl">Check something suspicious right now</h2>
          <p className="mt-3 text-muted-foreground">Free to use. No account needed to scan — create one to keep your history.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button size="lg" asChild><GatedLink to="/app/scan">Start a scan <ArrowRight /></GatedLink></Button>
            {!user && <Button size="lg" variant="outline" asChild><Link to="/login?mode=register">Create free account</Link></Button>}
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
