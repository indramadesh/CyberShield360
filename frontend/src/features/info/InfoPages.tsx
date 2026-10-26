import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight, GitBranch, Phone, Globe, ShieldAlert, KeyRound, Compass, Eye, Scale, Lock, FileSearch,
} from "lucide-react";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { Button } from "@/components/ui/button";
import { LogoMark } from "@/components/brand/Logo";

const REPO = "https://github.com/indramadesh/CyberShield360";

function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PublicHeader />
      <main id="main" className="flex-1">{children}</main>
      <PublicFooter />
    </div>
  );
}

function PageIntro({ eyebrow, title, intro }: { eyebrow: string; title: string; intro: string }) {
  return (
    <div className="relative isolate overflow-hidden border-b">
      <div aria-hidden className="absolute inset-0 -z-10 grid-texture opacity-30 [mask-image:linear-gradient(to_bottom,black,transparent)]" />
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
        <div className="eyebrow">{eyebrow}</div>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight sm:text-5xl">{title}</h1>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">{intro}</p>
      </div>
    </div>
  );
}

const VALUES = [
  { icon: Eye, title: "Explainable", text: "Every result shows the evidence behind it, so you can judge for yourself." },
  { icon: Scale, title: "Calibrated", text: "Risk and confidence are reported separately. Low risk is never called guaranteed safe." },
  { icon: Lock, title: "Private", text: "Personal data such as phone numbers, emails and OTPs is redacted before storage." },
  { icon: FileSearch, title: "Open", text: "The source code, threat model and extension privacy policy are public." },
];

export function AboutPage() {
  return (
    <PublicShell>
      <PageIntro eyebrow="About" title="Helping people make safer decisions online"
        intro="CyberShield360 combines scanning, browser protection, threat news and short lessons in one place — built for everyday users, not just security teams." />
      <section className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
        <h2 className="font-display text-2xl font-semibold">What we believe</h2>
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          {VALUES.map((v) => {
            const Icon = v.icon;
            return (
              <div key={v.title} className="rounded-xl border bg-card p-5">
                <Icon className="size-6 text-primary" />
                <h3 className="mt-3 font-semibold">{v.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{v.text}</p>
              </div>
            );
          })}
        </div>

        <h2 className="mt-14 font-display text-2xl font-semibold">What it can and can't do</h2>
        <div className="mt-4 space-y-3 text-muted-foreground">
          <p>
            CyberShield360 checks links, messages, emails, screenshots, QR codes and websites using rules,
            machine-learning signals and threat-intelligence lookups. It explains what it found and suggests
            what to do next.
          </p>
          <p>
            No tool catches every scam. A result of “no known threats” means nothing suspicious was found by
            the checks that ran — always verify payment requests and account alerts through official channels.
          </p>
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          <Button asChild><Link to="/app/scan">Try a scan <ArrowRight /></Link></Button>
          <Button variant="outline" asChild><a href={REPO} target="_blank" rel="noreferrer"><GitBranch /> View source</a></Button>
        </div>
      </section>
    </PublicShell>
  );
}

export function ContactPage() {
  return (
    <PublicShell>
      <PageIntro eyebrow="Contact & help" title="Get help"
        intro="If you have lost money or shared sensitive details, contact the official channels first — speed matters." />
      <section className="mx-auto grid max-w-4xl gap-5 px-4 py-14 sm:px-6 md:grid-cols-2">
        <div className="rounded-xl border border-danger/30 bg-danger-soft/40 p-6 md:col-span-2">
          <div className="flex items-center gap-2 font-semibold text-danger"><ShieldAlert className="size-5" /> Lost money to a scam? (India)</div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <a href="tel:1930" className="flex items-center gap-3 rounded-lg border bg-card p-4 hover:border-primary/50">
              <Phone className="size-5 text-primary" />
              <span><span className="block font-display text-xl font-semibold">1930</span><span className="text-sm text-muted-foreground">National cyber-crime helpline</span></span>
            </a>
            <a href="https://cybercrime.gov.in" target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-lg border bg-card p-4 hover:border-primary/50">
              <Globe className="size-5 text-primary" />
              <span><span className="block font-semibold">cybercrime.gov.in</span><span className="text-sm text-muted-foreground">Official complaint portal</span></span>
            </a>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Also call your bank's official number (from the back of your card) to freeze transactions.
          </p>
          <Button className="mt-4" variant="outline" asChild><Link to="/app/incident">Step-by-step recovery guide <ArrowRight /></Link></Button>
        </div>

        <div className="rounded-xl border bg-card p-6">
          <h2 className="font-semibold">Report a bug or request a feature</h2>
          <p className="mt-1 text-sm text-muted-foreground">Open an issue on the project's GitHub repository.</p>
          <Button className="mt-4" variant="outline" asChild>
            <a href={`${REPO}/issues`} target="_blank" rel="noreferrer"><GitBranch /> Open an issue</a>
          </Button>
        </div>
        <div className="rounded-xl border bg-card p-6">
          <h2 className="font-semibold">Security vulnerabilities</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Please report privately through GitHub's security advisory form instead of a public issue.
          </p>
          <Button className="mt-4" variant="outline" asChild>
            <a href={`${REPO}/security`} target="_blank" rel="noreferrer">Security policy</a>
          </Button>
        </div>
      </section>
    </PublicShell>
  );
}

export function ForgotPasswordPage() {
  return (
    <PublicShell>
      <section className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-primary/12 ring-1 ring-primary/30">
          <KeyRound className="size-7 text-primary" />
        </span>
        <h1 className="mt-6 font-display text-3xl font-semibold">Password reset isn't available yet</h1>
        <p className="mt-3 text-muted-foreground">
          This deployment doesn't send emails, so self-service resets aren't possible. Ask the site
          administrator to reset your account, or create a new one.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild><Link to="/login">Back to sign in</Link></Button>
          <Button variant="outline" asChild><Link to="/login?mode=register">Create account</Link></Button>
        </div>
      </section>
    </PublicShell>
  );
}

export function NotFoundPage() {
  return (
    <PublicShell>
      <section className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
        <LogoMark className="size-14 opacity-80" />
        <div className="mt-6 font-display text-6xl font-bold text-brand-gradient">404</div>
        <h1 className="mt-2 font-display text-2xl font-semibold">This page doesn't exist</h1>
        <p className="mt-3 text-muted-foreground">The link may be outdated or mistyped.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild><Link to="/"><Compass /> Go home</Link></Button>
          <Button variant="outline" asChild><Link to="/app">Open dashboard</Link></Button>
        </div>
      </section>
    </PublicShell>
  );
}
