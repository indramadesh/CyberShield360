import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Shield, Sun, Moon, ArrowRight, Link2, MessageSquare, Mail, Image, QrCode, Globe,
  UserPlus, LogIn, UserRound,
} from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { useConfig } from "@/config/useConfig";
import { useAuth } from "@/features/auth/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { FeatureKey } from "@/types";

const ANALYSIS: { key: FeatureKey; label: string; desc: string; icon: typeof Link2 }[] = [
  { key: "url_scanner", label: "URL", desc: "Check suspicious links for phishing & scams", icon: Link2 },
  { key: "message_scanner", label: "Message", desc: "Analyze SMS & chat for social engineering", icon: MessageSquare },
  { key: "email_scanner", label: "Email", desc: "Spot sender spoofing & malicious links", icon: Mail },
  { key: "image_scanner", label: "Image", desc: "Read text from screenshots & posters", icon: Image },
  { key: "qr_scanner", label: "QR code", desc: "Scan with your camera before you act", icon: QrCode },
  { key: "website_scanner", label: "Website", desc: "Open pages safely in a sandbox", icon: Globe },
];

const STEPS = [
  { n: 1, label: "Submit", text: "Paste a link, message, email, or scan a QR / screenshot." },
  { n: 2, label: "Analyze", text: "Rules, ML signals and threat intel run together." },
  { n: 3, label: "Understand", text: "See the risk, confidence and the evidence behind it." },
  { n: 4, label: "Respond", text: "Get clear, safe next steps — not just a verdict." },
];

export function LandingPage() {
  const { theme, toggle } = useTheme();
  const { data } = useConfig();
  const { continueAsGuest } = useAuth();
  const navigate = useNavigate();
  const features = data?.features;
  const enabled = ANALYSIS.filter((a) => features?.[a.key] ?? true);

  function guest() {
    continueAsGuest();
    navigate("/app");
  }

  return (
    <div className="min-h-full">
      {/* Top bar */}
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-2 font-semibold">
            <span className="flex size-7 items-center justify-center rounded-md bg-primary/15 text-primary">
              <Shield className="size-4" />
            </span>
            CyberShield 360
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/v2" title="Preview the alternative design">✨ New design</Link>
            </Button>
            <Button variant="ghost" size="icon" aria-label="Toggle theme" onClick={toggle}>
              {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </Button>
            <Button variant="ghost" size="sm" asChild><Link to="/login">Sign in</Link></Button>
            <Button size="sm" asChild><Link to="/login?mode=register">Sign up</Link></Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4">
        {/* Hero */}
        <section className="py-14 text-center sm:py-20">
          {data?.demo_mode && <Badge variant="warning">Demo mode · synthetic data</Badge>}
          <h1 className="mx-auto mt-4 max-w-3xl text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
            Understand, detect and respond to digital threats
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground sm:text-lg">
            Analyze suspicious links, messages, QR codes, emails and images before they
            become a bigger problem — with the risk, confidence and evidence shown clearly.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" asChild>
              <Link to="/login?mode=register"><UserPlus className="size-4" /> Create free account</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/login"><LogIn className="size-4" /> Sign in</Link>
            </Button>
            <Button size="lg" variant="ghost" onClick={guest}>
              <UserRound className="size-4" /> Continue as guest
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Guest mode works fully — we just won't save your scan history. An account is
            needed to take quizzes and track progress.
          </p>
        </section>

        {/* Features */}
        <Section title="What you can analyze">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {enabled.map((a) => {
              const Icon = a.icon;
              return (
                <Card key={a.key}>
                  <CardHeader>
                    <div className="flex items-center gap-2.5">
                      <span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <Icon className="size-5" />
                      </span>
                      <CardTitle className="text-base">{a.label}</CardTitle>
                    </div>
                    <CardDescription>{a.desc}</CardDescription>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
        </Section>

        {/* How it works */}
        <Section title="How it works">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <Card key={s.n}>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <span className="flex size-6 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">{s.n}</span>
                    <CardTitle className="text-base">{s.label}</CardTitle>
                  </div>
                  <CardDescription>{s.text}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </Section>

        {/* Threat categories */}
        <Section title="Threats it helps with">
          <div className="flex flex-wrap gap-2">
            {(data?.threat_categories ?? []).map((c) => (
              <Badge key={c.code} variant="secondary">{c.label}</Badge>
            ))}
          </div>
        </Section>

        {/* Closing CTA */}
        <Card className="my-10">
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <CardTitle className="text-lg">Ready to check something?</CardTitle>
            <CardDescription className="max-w-xl">
              CyberShield 360 reports risk and confidence separately and always shows the
              evidence. "No known malicious indicators" doesn't guarantee safety.
            </CardDescription>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button asChild><Link to="/login?mode=register">Create free account <ArrowRight className="size-4" /></Link></Button>
              <Button variant="ghost" onClick={guest}>Continue as guest</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="py-6">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
      {children}
    </section>
  );
}
