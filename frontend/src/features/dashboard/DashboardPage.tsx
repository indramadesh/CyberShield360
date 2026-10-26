import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Link2, MessageSquare, Mail, Image as ImageIcon, QrCode, ArrowRight, ScanSearch,
  ShieldAlert, ShieldCheck, GraduationCap, Hand, Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { RiskBadge } from "@/components/ui/RiskBadge";
import { MetricCard } from "@/components/ui/MetricCard";
import { Sparkline } from "@/components/ui/Sparkline";
import { EmptyState } from "@/components/ui/states";
import { useConfig } from "@/config/useConfig";
import { useAuth } from "@/features/auth/useAuth";
import { useLearnDaily, useProgress } from "@/features/content/api";
import { apiFetch } from "@/services/api";
import { cn } from "@/lib/utils";
import {
  SCAN_TYPE_LABEL, dailyCounts, formatWhen, isThreat, parseApiDate, useScanHistory, type ScanSummary,
} from "@/features/scanner/history";
import type { FeatureKey } from "@/types";

const QUICK: { key: FeatureKey; type: string; label: string; icon: typeof Link2; text: boolean }[] = [
  { key: "url_scanner", type: "URL", label: "URL", icon: Link2, text: true },
  { key: "message_scanner", type: "MESSAGE", label: "Message", icon: MessageSquare, text: true },
  { key: "email_scanner", type: "EMAIL", label: "Email", icon: Mail, text: true },
  { key: "image_scanner", type: "IMAGE", label: "File / Image", icon: ImageIcon, text: false },
  { key: "qr_scanner", type: "QR", label: "QR Code", icon: QrCode, text: false },
];

const PLACEHOLDER: Record<string, string> = {
  URL: "Enter a URL to check (e.g. https://example.com)",
  MESSAGE: "Paste the SMS or chat message you received",
  EMAIL: "Paste the email text, including the sender line if you can",
};


const TYPE_ICON: Record<string, typeof Link2> = {
  URL: Link2, MESSAGE: MessageSquare, EMAIL: Mail, IMAGE: ImageIcon, QR: QrCode, WEBSITE: Globe,
};
const RISK_TILE: Record<string, string> = {
  LOW: "bg-primary/12 text-primary ring-primary/30",
  SUSPICIOUS: "bg-warning-soft text-warning ring-warning/30",
  HIGH: "bg-high-soft text-high ring-high/30",
  CRITICAL: "bg-danger-soft text-danger ring-danger/30",
};

function greeting(d = new Date()) {
  const h = d.getHours();
  return h < 12 ? "Good Morning" : h < 17 ? "Good Afternoon" : "Good Evening";
}

/** "+32% vs last week" style change, honest when there's no baseline. */
function change(cur: number, prev: number): { text: string; tone: "up" | "down" | "muted" } {
  if (prev === 0) return { text: cur ? "first activity this period" : "no scans yet", tone: "muted" };
  const pct = Math.round(((cur - prev) / prev) * 100);
  return { text: `${pct >= 0 ? "+" : ""}${pct}% vs last week`, tone: pct >= 0 ? "up" : "down" };
}

function weekCounts(scans: ScanSummary[]) {
  const now = Date.now(), wk = 7 * 86400_000;
  let cur = 0, prev = 0;
  for (const s of scans) {
    const age = now - parseApiDate(s.created_at).getTime();
    if (age < wk) cur++; else if (age < 2 * wk) prev++;
  }
  return { cur, prev };
}

function QuickScan() {
  const { data: config } = useConfig();
  const navigate = useNavigate();
  const options = QUICK.filter((q) => config?.features?.[q.key] ?? true);
  const [type, setType] = useState("URL");
  const [value, setValue] = useState("");
  const current = options.find((o) => o.type === type) ?? options[0];

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!current) return;
    const v = value.trim();
    if (!current.text || !v) { navigate(`/app/scan?type=${current.type}`); return; }
    navigate(`/app/scan?type=${current.type}&q=${encodeURIComponent(v)}&run=1`);
  }

  return (
    <section aria-labelledby="qs-title">
      <h2 id="qs-title" className="font-display text-lg font-semibold text-primary">Quick Scan</h2>
      <div role="radiogroup" aria-label="What to scan" className="mt-3 flex flex-wrap gap-2">
        {options.map((o) => {
          const Icon = o.icon;
          const active = current?.type === o.type;
          return (
            <button key={o.type} type="button" role="radio" aria-checked={active} onClick={() => setType(o.type)}
              className={cn("inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors",
                active ? "border-primary bg-primary text-primary-foreground shadow-glow"
                  : "bg-background-2 text-muted-foreground hover:border-primary/40 hover:text-foreground")}>
              <Icon className="size-4" /> {o.label}
            </button>
          );
        })}
      </div>
      <form onSubmit={submit} className="mt-3 flex flex-col gap-2 sm:flex-row">
        {current?.text ? (
          <input value={value} onChange={(e) => setValue(e.target.value)} aria-label={`${current.label} to scan`}
            placeholder={PLACEHOLDER[current.type]} inputMode={current.type === "URL" ? "url" : "text"}
            className="h-12 flex-1 rounded-xl border bg-background-2 px-4 text-sm placeholder:text-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        ) : (
          <div className="flex h-12 flex-1 items-center rounded-xl border border-dashed bg-background-2 px-4 text-sm text-muted-foreground">
            {current?.type === "QR" ? "Use your camera, upload a photo, or paste the QR content" : "Upload a screenshot or photo (PNG, JPEG or WebP)"}
          </div>
        )}
        <Button type="submit" size="lg" className="h-12 px-6">
          <ScanSearch /> {current?.text ? "Scan" : "Open"} <ArrowRight />
        </Button>
      </form>
    </section>
  );
}

function RecentTiles({ scans }: { scans: ScanSummary[] }) {
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {scans.slice(0, 4).map((s) => {
        const Icon = TYPE_ICON[s.scan_type] ?? ScanSearch;
        return (
          <li key={s.scan_id}>
            <Link to={`/app/scans/${s.scan_id}`}
              className="flex h-full items-start gap-3 rounded-xl border bg-background-2 p-3 transition-colors hover:border-primary/40">
              <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg ring-1", RISK_TILE[s.risk_level ?? "LOW"])}>
                <Icon className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium" title={s.target}>{s.target || SCAN_TYPE_LABEL[s.scan_type]}</span>
                <span className="mt-1 block">{s.risk_level && <RiskBadge level={s.risk_level} size="sm" />}</span>
                <span className="mt-1 block text-xs text-subtle">{formatWhen(s.created_at)}</span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Glowing bulb illustration for the tip card (decorative). */
function BulbArt() {
  return (
    <svg viewBox="0 0 64 64" className="size-14" aria-hidden>
      <defs>
        <radialGradient id="bulbGlow"><stop offset="0" stopColor="#FFD27A" stopOpacity="0.9" /><stop offset="1" stopColor="#FFBD59" stopOpacity="0" /></radialGradient>
      </defs>
      <circle cx="32" cy="28" r="26" fill="url(#bulbGlow)" />
      <path d="M32 12a14 14 0 0 0-8 25.5c1.3 1 2 2.4 2 3.9V44h12v-2.6c0-1.5.7-2.9 2-3.9A14 14 0 0 0 32 12Z" fill="#FFBD59" />
      <path d="M27 48h10M28.5 52h7" stroke="#FFBD59" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M29 30l3 4 3-4" stroke="#8A5A00" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function DashboardPage() {
  const { data: config } = useConfig();
  const { user } = useAuth();
  const history = useScanHistory();
  const progress = useProgress();
  const daily = useLearnDaily();
  const done = progress.data?.completed_slugs ?? [];
  const lessons = useQuery({
    queryKey: ["lessons"],
    queryFn: () => apiFetch<{ slug: string }[]>("/awareness"),
    enabled: config?.features?.awareness ?? false,
  });

  const scans = history.data ?? [];
  const loading = Boolean(user) && history.isLoading;
  const days = dailyCounts(scans);
  const today = days[days.length - 1]?.value ?? 0;
  const yesterday = days[days.length - 2]?.value ?? 0;
  const week = weekCounts(scans);
  const wkChange = change(week.cur, week.prev);
  const threats = scans.filter((s) => isThreat(s.risk_level)).length;
  const low = scans.filter((s) => s.risk_level === "LOW").length;
  const totalLessons = lessons.data?.length ?? 0;
  const completed = (lessons.data ?? []).filter((l) => done.includes(l.slug)).length;
  const pct = totalLessons ? Math.round((completed / totalLessons) * 100) : 0;
  const name = user?.email.split("@")[0];
  const tip = daily.data?.tip;

  return (
    <div className="space-y-6">
      {/* Greeting + today's checks */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            {greeting()}{name ? `, ${name}` : ""} <Hand className="size-7 -rotate-12 text-warning" aria-hidden />
          </h1>
          <p className="mt-1 text-muted-foreground">Stay alert. Stay safe.</p>
          <p className="sr-only">What would you like to check today?</p>
        </div>
        {user && (
          <div className="flex items-center gap-4 rounded-2xl border bg-card px-4 py-3 shadow-elev">
            <div>
              <div className="text-xs text-muted-foreground">Checks today</div>
              <Sparkline values={days.map((d) => d.value)} width={130} height={36} className="mt-1" />
            </div>
            <div className="text-right">
              <div className="font-display text-2xl font-bold text-primary tabular-nums">{loading ? "—" : today}</div>
              <div className="text-[0.7rem] text-subtle">{yesterday ? `${today - yesterday >= 0 ? "+" : ""}${today - yesterday} vs yesterday` : "last 7 days"}</div>
            </div>
          </div>
        )}
      </div>

      {user ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard icon={<ScanSearch />} label="Scans this week" value={loading ? null : week.cur}
            hint={wkChange.text} hintTone={wkChange.tone} />
          <MetricCard icon={<ShieldAlert />} tone="danger" label="Threats found" value={loading ? null : threats} hint="high or critical risk" />
          <MetricCard icon={<ShieldCheck />} tone="primary" label="Low-risk results" value={loading ? null : low} hint="no strong warning signs" />
          <MetricCard icon={<GraduationCap />} tone="warning" label="Learning modules"
            value={lessons.isLoading ? null : totalLessons || "—"} hint={totalLessons ? `${pct}% completed` : undefined} />
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-primary/25 bg-primary/[0.06] p-5">
          <div>
            <div className="font-medium">You're scanning as a guest</div>
            <p className="text-sm text-muted-foreground">Sign in to keep your scan history, see your stats and take quizzes.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild><Link to="/login">Sign in</Link></Button>
            <Button asChild><Link to="/login?mode=register">Create account</Link></Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_17rem]">
        <div className="space-y-6 rounded-2xl border bg-card p-5 shadow-elev sm:p-6">
          <QuickScan />

          <section aria-labelledby="recent-title">
            <div className="flex items-center justify-between">
              <h2 id="recent-title" className="font-display text-lg font-semibold">Recent Scans</h2>
              {user && scans.length > 0 && <Link to="/app/reports" className="text-sm font-medium text-primary hover:underline">View All</Link>}
            </div>
            <div className="mt-3">
              {!user ? (
                <EmptyState title="Sign in to keep your history" description="Your scans are saved to your account so you can revisit results."
                  action={<Button size="sm" asChild><Link to="/login">Sign in</Link></Button>} />
              ) : loading ? (
                <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />)}</div>
              ) : history.isError ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Couldn't load your history. <button className="text-primary hover:underline" onClick={() => history.refetch()}>Try again</button></p>
              ) : scans.length === 0 ? (
                <EmptyState title="No scans yet" description="Submit your first suspicious link, message, image or QR code to begin." />
              ) : (
                <RecentTiles scans={scans} />
              )}
            </div>
          </section>
        </div>

        <aside className="relative flex flex-col overflow-hidden rounded-2xl border bg-card p-5 shadow-elev">
          <div aria-hidden className="absolute -right-10 -top-10 size-40 rounded-full bg-warning/10 blur-3xl" />
          <div className="relative flex items-start justify-between">
            <h2 className="font-display text-lg font-semibold">Today's Tip</h2>
            <BulbArt />
          </div>
          <svg aria-hidden viewBox="0 0 200 50" className="relative -mt-2 h-10 w-full text-primary/60">
            <path d="M0 42 L30 36 L55 40 L80 26 L105 30 L130 16 L160 20 L200 6" fill="none" stroke="currentColor" strokeWidth="1.5" />
          </svg>
          {tip ? (
            <div className="relative mt-3 flex-1">
              <p className="font-medium">{tip.title}</p>
              <p className="mt-1 leading-relaxed text-foreground/90">{tip.recommendation}</p>
            </div>
          ) : daily.isLoading ? <div className="relative mt-3 h-20 flex-1 animate-pulse rounded-lg bg-muted" /> : (
            <p className="relative mt-3 flex-1 text-sm text-muted-foreground">Today's tip isn't available.</p>
          )}
          {config?.features?.awareness && (
            <Button variant="outline" className="relative mt-5 w-full" asChild><Link to="/app/learn">Learn More</Link></Button>
          )}
        </aside>
      </div>
    </div>
  );
}
