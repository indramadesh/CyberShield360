import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import {
  AlertTriangle, Clock, XCircle, CheckCircle2, ExternalLink, Flag, Share2, Download,
  ThumbsUp, ThumbsDown, LifeBuoy, Link2, MessageSquare, Mail, QrCode, Image as ImageIcon, Globe,
  ShieldCheck, ShieldAlert, OctagonAlert,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ConfirmDialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/features/auth/useAuth";
import { useConfig } from "@/config/useConfig";
import { apiFetch, ApiClientError } from "@/services/api";
import { cn } from "@/lib/utils";
import { ThreatArt } from "./art";
import { parseApiDate } from "./history";
import type { ScanResult as Result } from "./types";

const LEVEL: Record<string, { label: string; icon: typeof AlertTriangle; box: string; text: string; chip: string; art: string }> = {
  LOW: { label: "Low Risk", icon: ShieldCheck, box: "border-primary/40 bg-primary/[0.07]", text: "text-primary", chip: "border-primary/40 text-primary", art: "#19E6A0" },
  SUSPICIOUS: { label: "Suspicious", icon: AlertTriangle, box: "border-warning/40 bg-warning-soft/60", text: "text-warning", chip: "border-warning/40 text-warning", art: "#FFBD59" },
  HIGH: { label: "High Risk", icon: ShieldAlert, box: "border-high/45 bg-high-soft/60", text: "text-high", chip: "border-high/45 text-high", art: "#FF8B4D" },
  CRITICAL: { label: "Critical Risk", icon: OctagonAlert, box: "border-danger/45 bg-danger-soft/60", text: "text-danger", chip: "border-danger/45 text-danger", art: "#FF5D65" },
};

const NOUN: Record<string, string> = {
  URL: "link", WEBSITE: "website", MESSAGE: "message", EMAIL: "email", QR: "QR code", IMAGE: "image",
};
const TYPE_ICON: Record<string, typeof Link2> = {
  URL: Link2, WEBSITE: Globe, MESSAGE: MessageSquare, EMAIL: Mail, QR: QrCode, IMAGE: ImageIcon,
};
const REPORT_TYPE: Record<string, string> = {
  URL: "url", WEBSITE: "url", MESSAGE: "message", EMAIL: "email", QR: "url", IMAGE: "message",
};

const humanize = (s: string) => s.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

function headline(r: Result) {
  const noun = NOUN[r.scan_type] ?? "content";
  const cat = (r.category || "").replace(/_/g, " ").toLowerCase();
  if (r.risk_level === "LOW") return `No strong warning signs were found in this ${noun}.`;
  if (r.risk_level === "SUSPICIOUS") return `This ${noun} shows some warning signs${cat ? ` of ${cat}` : ""}. Be careful.`;
  return `This ${noun} is likely ${cat ? `${/^[aeiou]/.test(cat) ? "an" : "a"} ${cat} attempt` : "malicious"}.`;
}

function asUrl(target?: string): URL | null {
  if (!target) return null;
  const t = target.trim();
  if (/\s/.test(t)) return null;
  try { return new URL(/^[a-z]+:\/\//i.test(t) ? t : `http://${t}`); } catch { return null; }
}

function Feedback({ scanId }: { scanId: string }) {
  const push = useToast();
  const [sent, setSent] = useState(false);
  const send = useMutation({
    mutationFn: (kind: "useful" | "wrong") =>
      apiFetch(`/scans/${scanId}/feedback`, {
        method: "POST",
        body: JSON.stringify(kind === "useful" ? { useful: true } : { marked_wrong: true }),
      }),
    onSuccess: () => { setSent(true); push({ title: "Thanks for the feedback", tone: "success" }); },
    onError: () => push({ title: "Couldn't send feedback", description: "Please try again.", tone: "error" }),
  });
  if (sent) return <p className="text-sm text-muted-foreground">Feedback recorded — it helps improve detection.</p>;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted-foreground">Was this assessment right?</span>
      <Button size="sm" variant="ghost" disabled={send.isPending} onClick={() => send.mutate("useful")}><ThumbsUp /> Helpful</Button>
      <Button size="sm" variant="ghost" disabled={send.isPending} onClick={() => send.mutate("wrong")}><ThumbsDown /> Looks wrong</Button>
    </div>
  );
}

type Tab = "overview" | "technical" | "domain" | "similar";

/** The ONE result component every scanner uses. Answers, in order:
 *  what happened → why → evidence → technical detail (separate tab) → what to do. */
export function ScanResult({ result, target, scannedAt }: { result: Result; target?: string; scannedAt?: string }) {
  const [tab, setTab] = useState<Tab>("overview");
  const [confirmVisit, setConfirmVisit] = useState(false);
  const push = useToast();
  const { user } = useAuth();
  const { data: config } = useConfig();
  const confidencePct = Math.round(result.confidence * 100);

  const report = useMutation({
    mutationFn: (value: string) => apiFetch("/reports", {
      method: "POST",
      body: JSON.stringify({ indicator_type: REPORT_TYPE[result.scan_type] ?? "url", value: value.slice(0, 512), note: `From scan ${result.scan_id}` }),
    }),
    onSuccess: () => push({ title: "Reported for review", description: "Moderators check reports before they affect anyone's results.", tone: "success" }),
    onError: (e) => push({ title: "Couldn't send the report", description: (e as ApiClientError).message, tone: "error" }),
  });

  // Non-complete scans (website SSRF-blocked / timed out / queued) get an honest
  // status, not a risk badge — analysis failure ≠ a negative security finding.
  if (result.status !== "COMPLETE") {
    const failed = result.status === "FAILED";
    return (
      <Alert variant={failed ? "destructive" : "info"}>
        {failed ? <AlertTriangle /> : <Clock />}
        <AlertTitle>{failed ? "Analysis could not be completed" : "Analysis in progress"}</AlertTitle>
        <AlertDescription>
          {result.explanation || (failed ? "The analysis failed." : "Please check back shortly.")}
          <div className="mt-2"><Badge variant={failed ? "danger" : "info"}>{result.status}</Badge></div>
        </AlertDescription>
      </Alert>
    );
  }

  const lv = LEVEL[result.risk_level] ?? LEVEL.SUSPICIOUS;
  const LvIcon = lv.icon;
  const TypeIcon = TYPE_ICON[result.scan_type] ?? Link2;
  const shownTarget = target ?? result.target ?? "";
  const when = scannedAt ?? result.created_at;
  const url = ["URL", "WEBSITE", "QR"].includes(result.scan_type) ? asUrl(shownTarget) : null;
  const webUrl = url && /^https?:$/.test(url.protocol) ? url : null;
  const risky = result.evidence.filter((e) => e.weight > 0);
  const reassuring = result.evidence.filter((e) => e.weight <= 0);
  const official = result.evidence
    .map((e) => e.detail as { brand?: string; official?: string } | undefined)
    .filter((d): d is { brand: string; official: string } => Boolean(d?.official && d?.brand));

  const TABS: { key: Tab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "technical", label: "Technical Details" },
    ...(webUrl ? [{ key: "domain" as Tab, label: "Domain Info" }] : []),
    ...(official.length ? [{ key: "similar" as Tab, label: "Similar Websites" }] : []),
  ];

  async function share() {
    const link = `${window.location.origin}/app/scans/${result.scan_id}`;
    try {
      if (navigator.share) { await navigator.share({ title: "CyberShield360 scan result", url: link }); return; }
      await navigator.clipboard.writeText(link);
      push({ title: "Result link copied", tone: "success" });
    } catch (e) {
      if ((e as DOMException)?.name !== "AbortError") push({ title: "Couldn't share", description: link, tone: "error" });
    }
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `cybershield360-scan-${result.scan_id}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function doReport() {
    if (!user) { push({ title: "Sign in to report", description: "Reports are tied to an account to prevent abuse.", tone: "info" }); return; }
    if (!shownTarget || shownTarget.length < 2) { push({ title: "Nothing to report", tone: "info" }); return; }
    report.mutate(shownTarget);
  }

  const reportsOn = config?.features?.community_reports ?? true;

  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-elev">
      {/* Header: what was scanned, when */}
      <div className="relative flex items-start gap-4 border-b p-5 sm:p-6">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-background-2 text-muted-foreground ring-1 ring-border">
          <TypeIcon className="size-5" />
        </span>
        <div className="min-w-0 flex-1 pr-24">
          <h2 className="break-all font-display text-lg font-semibold leading-snug sm:text-xl">{shownTarget || `${humanize(NOUN[result.scan_type] ?? "Content")} scan`}</h2>
          {when && <p className="mt-0.5 text-sm text-subtle">Scanned on {parseApiDate(when).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</p>}
        </div>
        <ThreatArt className="absolute right-4 top-3 h-20 w-auto opacity-90" tone={lv.art} />
      </div>

      <div className="space-y-5 p-5 sm:p-6">
        {/* Risk banner: risk and confidence shown separately (risk ≠ certainty). */}
        <div className={cn("flex flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-center", lv.box)}>
          <div className="flex items-center gap-3 sm:min-w-[11rem]">
            <LvIcon className={cn("size-9 shrink-0", lv.text)} aria-hidden />
            <div>
              <div role="status" aria-label={lv.label} className={cn("font-display text-xl font-bold", lv.text)}>{lv.label}</div>
              <div className="text-xs text-muted-foreground">Risk Score {result.risk_score}/100</div>
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <p className={cn("font-medium", lv.text)}>{headline(result)}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className={cn("rounded-md border px-2 py-0.5 font-mono text-xs", lv.chip)}>{result.category}</span>
              {result.indicators.map((i) => (
                <span key={i} className={cn("inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs", lv.chip)}>
                  <AlertTriangle className="size-3" aria-hidden /> {humanize(i)}
                </span>
              ))}
            </div>
          </div>
          <div className="shrink-0 text-right sm:border-l sm:border-border/60 sm:pl-4">
            <div className="text-xs text-muted-foreground">Confidence</div>
            <div className="font-display text-xl font-semibold">{confidencePct}%</div>
          </div>
        </div>

        {/* Tabs */}
        <div>
          <div role="tablist" aria-label="Result details" className="grid grid-flow-col rounded-xl border bg-background-2 p-1 [grid-auto-columns:1fr]">
            {TABS.map((t) => (
              <button key={t.key} role="tab" aria-selected={tab === t.key} aria-controls={`tab-${t.key}`} onClick={() => setTab(t.key)}
                className={cn("rounded-lg px-2 py-2 text-sm font-medium transition-colors",
                  tab === t.key ? "bg-primary/15 text-primary shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.35)]" : "text-muted-foreground hover:text-foreground")}>
                {t.label}
              </button>
            ))}
          </div>

          <div id={`tab-${tab}`} role="tabpanel" className="mt-4">
            {tab === "overview" && (
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl border bg-background-2 p-4">
                  <h3 className="font-semibold">What we found</h3>
                  {result.evidence.length === 0 ? (
                    <p className="mt-3 text-sm text-muted-foreground">No indicators were triggered.</p>
                  ) : (
                    <ul className="mt-3 space-y-2.5">
                      {[...risky, ...reassuring].map((e, i) => {
                        const bad = e.weight > 0;
                        const Icon = bad ? XCircle : CheckCircle2;
                        return (
                          <li key={`${e.indicator}-${i}`} className="flex items-start gap-2.5 text-sm">
                            <Icon className={cn("mt-0.5 size-4 shrink-0", bad ? "text-danger" : "text-primary")}
                              aria-label={bad ? "Risk indicator" : "Reassuring signal"} />
                            <span className="leading-relaxed">{e.summary}</span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  {result.explanation && <p className="mt-4 border-t pt-3 text-xs leading-relaxed text-muted-foreground">{result.explanation}</p>}
                </div>
                <div className="rounded-xl border bg-background-2 p-4">
                  <h3 className="font-semibold">Recommendations</h3>
                  <ul className="mt-3 space-y-2.5">
                    {result.recommendations.map((r) => (
                      <li key={r} className="flex items-start gap-2.5 text-sm">
                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                        <span className="leading-relaxed">{r}</span>
                      </li>
                    ))}
                  </ul>
                  {(result.risk_level === "HIGH" || result.risk_level === "CRITICAL") && (
                    <Link to="/app/incident" className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
                      <LifeBuoy className="size-4" /> Already clicked or paid? Get help now
                    </Link>
                  )}
                </div>
              </div>
            )}

            {tab === "technical" && (
              <div className="space-y-2 rounded-xl border bg-background-2 p-4 text-xs text-muted-foreground">
                <div>Scan ID: <span className="font-mono text-foreground">{result.scan_id}</span></div>
                <div>Type: {result.scan_type} · Risk score: {result.risk_score}/100 · Confidence: {result.confidence.toFixed(2)} · Category: {result.category}</div>
                {result.notes.map((n) => <div key={n}>{n}</div>)}
                {result.pii_found && Object.keys(result.pii_found).length > 0 && (
                  <div>PII detected (redacted before storage): {Object.entries(result.pii_found).map(([k, v]) => `${k}×${v}`).join(", ")}</div>
                )}
                <pre className="max-w-full overflow-x-auto rounded-md border bg-card p-3 text-[11px] leading-relaxed">
{JSON.stringify(result.evidence.map((e) => ({ indicator: e.indicator, source: e.source, weight: e.weight, ...e.detail })), null, 2)}
                </pre>
              </div>
            )}

            {tab === "domain" && webUrl && <DomainInfo url={webUrl} />}

            {tab === "similar" && (
              <div className="rounded-xl border bg-background-2 p-4">
                <p className="text-sm text-muted-foreground">This {NOUN[result.scan_type]} mentions a brand but isn't on its official domain. The genuine site is:</p>
                <ul className="mt-3 space-y-2">
                  {official.map((o) => (
                    <li key={o.official} className="flex items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2.5 text-sm">
                      <span><span className="font-medium capitalize">{o.brand}</span> <span className="text-muted-foreground">— official</span></span>
                      <a href={`https://${o.official}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-mono text-primary hover:underline">
                        {o.official} <ExternalLink className="size-3.5" />
                      </a>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-xs text-subtle">Type the official address yourself rather than following links in messages.</p>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3 border-t pt-5 sm:flex-row sm:flex-wrap">
          {webUrl && result.risk_level !== "LOW" && (
            <Button variant="outline" className="border-danger/50 text-danger hover:bg-danger/10 hover:text-danger sm:flex-1" onClick={() => setConfirmVisit(true)}>
              <ExternalLink /> Visit Anyway (Not Recommended)
            </Button>
          )}
          {reportsOn && (
            <Button variant="outline" className="sm:flex-1" onClick={doReport} loading={report.isPending} disabled={report.isSuccess}>
              {!report.isPending && <Flag />} {report.isSuccess ? "Reported" : "Report"}
            </Button>
          )}
          <Button variant="outline" className="sm:flex-1" onClick={share}><Share2 /> Share Result</Button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Feedback scanId={result.scan_id} />
          <Button size="sm" variant="ghost" onClick={exportJson}><Download /> Export JSON</Button>
        </div>
        <p className="text-xs text-subtle">
          This is an automated assessment, not a guarantee. When in doubt, verify through the organization's official website or phone number.
        </p>
      </div>

      {webUrl && (
        <ConfirmDialog open={confirmVisit} onOpenChange={setConfirmVisit}
          title="Open this site anyway?"
          description={`${webUrl.host} was rated ${lv.label.toLowerCase()}. Don't enter passwords, OTPs or payment details there. It opens in a new tab.`}
          confirmLabel="Open site" destructive
          onConfirm={() => { window.open(webUrl.href, "_blank", "noopener,noreferrer"); setConfirmVisit(false); }} />
      )}
    </div>
  );
}

/** Facts derived from the address itself (no WHOIS lookup is performed). */
function DomainInfo({ url }: { url: URL }) {
  const host = url.hostname;
  const labels = host.split(".");
  const registrable = labels.slice(-2).join(".");
  const rows: [string, string][] = [
    ["Host", host],
    ["Registrable domain (approx.)", registrable],
    ["Top-level domain", `.${labels[labels.length - 1]}`],
    ["Subdomains", String(Math.max(0, labels.length - 2))],
    ["Connection", url.protocol === "https:" ? "HTTPS (encrypted)" : "HTTP (not encrypted)"],
    ["Punycode (look-alike characters)", host.includes("xn--") ? "Yes" : "No"],
    ["Raw IP address", /^\d{1,3}(\.\d{1,3}){3}$/.test(host) ? "Yes" : "No"],
  ];
  return (
    <div className="rounded-xl border bg-background-2 p-4">
      <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3 border-b border-border/60 pb-2">
            <dt className="text-muted-foreground">{k}</dt><dd className="break-all text-right font-mono text-xs">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-xs text-subtle">Derived from the address. Registration (WHOIS) data isn't looked up.</p>
    </div>
  );
}
