import { Link, useNavigate } from "react-router-dom";
import {
  Shield, ArrowRight, Link2, MessageSquare, Mail, Image, QrCode, Globe,
  ScanSearch, Lock, Eye, WifiOff, ChevronRight,
} from "lucide-react";
import { useConfig } from "@/config/useConfig";
import { useAuth } from "@/features/auth/useAuth";
import type { FeatureKey } from "@/types";

/* ------------------------------------------------------------------ *
 * Alternative landing ("v2") — a bold, dark, agency-style design
 * inspired by the shared cyber template. Fully self-contained styling
 * (its own near-black palette + cyan accent) so it does NOT affect the
 * existing design system. Reachable at /v2; the classic stays at /.
 * ------------------------------------------------------------------ */

const ACCENT = "#22d3ee"; // electric cyan — deliberately different from the app's indigo

const SERVICES: { key: FeatureKey; label: string; desc: string; icon: typeof Link2 }[] = [
  { key: "url_scanner", label: "URL Analysis", desc: "Inspect links for phishing, impersonation and malicious redirects.", icon: Link2 },
  { key: "message_scanner", label: "Message Analysis", desc: "Detect social-engineering patterns in SMS and chat.", icon: MessageSquare },
  { key: "email_scanner", label: "Email Analysis", desc: "Catch sender spoofing and dangerous links.", icon: Mail },
  { key: "image_scanner", label: "Image Analysis", desc: "Extract and assess text from screenshots & posters.", icon: Image },
  { key: "qr_scanner", label: "QR Scanning", desc: "Scan with your camera and check before you act.", icon: QrCode },
  { key: "website_scanner", label: "Website Analysis", desc: "Open suspicious pages safely in an isolated sandbox.", icon: Globe },
];

const TRUST = [
  { icon: ScanSearch, title: "Evidence-based", text: "Every result shows the indicators behind it." },
  { icon: Lock, title: "Privacy-first", text: "Decoding happens locally; history is opt-in." },
  { icon: Eye, title: "No false certainty", text: "Risk and confidence are reported separately." },
  { icon: WifiOff, title: "Offline-friendly", text: "Core analysis runs with no external APIs." },
];

const STEPS = [
  { n: "01", label: "Submit", text: "Paste a link or message, or scan a QR / screenshot." },
  { n: "02", label: "Analyze", text: "Rules, ML signals and threat intelligence run together." },
  { n: "03", label: "Understand", text: "See the risk band, confidence and the evidence." },
  { n: "04", label: "Respond", text: "Get clear, safe next steps — not just a verdict." },
];

export function LandingV2() {
  const { data } = useConfig();
  const { continueAsGuest } = useAuth();
  const navigate = useNavigate();
  const features = data?.features;
  const services = SERVICES.filter((s) => features?.[s.key] ?? true);

  function guest() { continueAsGuest(); navigate("/app"); }

  return (
    <div className="min-h-screen bg-[#0a0e17] text-slate-100 [--accent:#22d3ee]"
         style={{ ["--accent" as string]: ACCENT }}>
      {/* Nav */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0a0e17]/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <div className="flex items-center gap-2 font-semibold">
            <span className="flex size-8 items-center justify-center rounded-md"
                  style={{ background: "rgba(34,211,238,0.15)", color: ACCENT }}>
              <Shield className="size-5" />
            </span>
            CyberShield<span style={{ color: ACCENT }}>360</span>
          </div>
          <nav className="hidden items-center gap-7 text-sm text-slate-300 md:flex">
            <a href="#services" className="hover:text-white">Services</a>
            <a href="#process" className="hover:text-white">How it works</a>
            <a href="#trust" className="hover:text-white">Why us</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/login" className="rounded-md px-3 py-1.5 text-sm text-slate-200 hover:text-white">Sign in</Link>
            <Link to="/app" className="rounded-md px-4 py-1.5 text-sm font-semibold text-[#0a0e17]"
                  style={{ background: ACCENT }}>Launch app</Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0"
             style={{ background: "radial-gradient(60rem 30rem at 70% -10%, rgba(34,211,238,0.12), transparent 60%)" }} />
        <div className="relative mx-auto max-w-6xl px-5 py-24 sm:py-32">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1 text-xs font-medium tracking-wide text-slate-300">
            <span className="size-1.5 rounded-full" style={{ background: ACCENT }} />
            MULTI-MODAL THREAT ANALYSIS
          </div>
          <h1 className="mt-6 max-w-3xl text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
            Stop threats before they
            <span style={{ color: ACCENT }}> reach you</span>.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-slate-300">
            Analyze suspicious links, messages, QR codes, emails and images in seconds —
            with the risk, confidence and evidence laid out clearly.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link to="/login?mode=register"
                  className="inline-flex items-center gap-2 rounded-md px-6 py-3 text-sm font-semibold text-[#0a0e17]"
                  style={{ background: ACCENT }}>
              Create free account <ArrowRight className="size-4" />
            </Link>
            <button onClick={guest}
                    className="inline-flex items-center gap-2 rounded-md border border-white/20 px-6 py-3 text-sm font-semibold text-white hover:bg-white/5">
              Continue as guest
            </button>
          </div>
          <p className="mt-4 text-xs text-slate-400">
            Guest mode works fully — history &amp; quizzes need an account.
          </p>
        </div>
      </section>

      {/* Trust strip */}
      <section id="trust" className="border-y border-white/10 bg-white/[0.02]">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-px px-5 lg:grid-cols-4">
          {TRUST.map((t) => {
            const Icon = t.icon;
            return (
              <div key={t.title} className="px-2 py-8">
                <Icon className="size-5" style={{ color: ACCENT }} />
                <div className="mt-3 font-semibold">{t.title}</div>
                <div className="mt-1 text-sm text-slate-400">{t.text}</div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Services */}
      <section id="services" className="mx-auto max-w-6xl px-5 py-20">
        <div className="max-w-2xl">
          <div className="text-sm font-semibold tracking-wide" style={{ color: ACCENT }}>WHAT WE ANALYZE</div>
          <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Six ways to check what's suspicious</h2>
          <p className="mt-3 text-slate-300">Each scanner explains what it found and what you should do next.</p>
        </div>
        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((s) => {
            const Icon = s.icon;
            return (
              <Link key={s.key} to="/app/scan"
                    className="group rounded-xl border border-white/10 bg-white/[0.02] p-6 transition-colors hover:border-[color:var(--accent)]/50">
                <span className="flex size-11 items-center justify-center rounded-lg"
                      style={{ background: "rgba(34,211,238,0.12)", color: ACCENT }}>
                  <Icon className="size-5" />
                </span>
                <div className="mt-4 text-lg font-semibold">{s.label}</div>
                <p className="mt-1 text-sm text-slate-400">{s.desc}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium" style={{ color: ACCENT }}>
                  Analyze <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Process */}
      <section id="process" className="border-t border-white/10 bg-white/[0.02]">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">How it works</h2>
          <div className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <div key={s.n}>
                <div className="text-4xl font-bold" style={{ color: ACCENT }}>{s.n}</div>
                <div className="mt-2 text-lg font-semibold">{s.label}</div>
                <p className="mt-1 text-sm text-slate-400">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Threats it helps with</h2>
        <div className="mt-6 flex flex-wrap gap-2.5">
          {(data?.threat_categories ?? []).map((c) => (
            <span key={c.code} className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-1.5 text-sm text-slate-200">
              {c.label}
            </span>
          ))}
        </div>
      </section>

      {/* CTA band */}
      <section className="border-t border-white/10">
        <div className="mx-auto max-w-6xl px-5 py-20 text-center">
          <h2 className="mx-auto max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
            Check something suspicious right now
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-slate-300">
            An assessment, not a guarantee — always backed by evidence.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link to="/login?mode=register" className="rounded-md px-6 py-3 text-sm font-semibold text-[#0a0e17]" style={{ background: ACCENT }}>
              Create free account
            </Link>
            <button onClick={guest} className="rounded-md border border-white/20 px-6 py-3 text-sm font-semibold hover:bg-white/5">
              Continue as guest
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-8 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <span>CyberShield 360 — assessments, not guarantees. Not legal advice.</span>
          <Link to="/" className="text-slate-300 underline-offset-4 hover:underline">
            ← Back to classic design
          </Link>
        </div>
      </footer>
    </div>
  );
}
