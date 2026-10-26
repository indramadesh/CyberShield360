import { ExternalLink, RefreshCw, AlertTriangle, CircleCheck, CircleSlash, Clock, ShieldAlert, Info } from "lucide-react";
import { TopicArt, topicFor } from "@/components/art/TopicArt";
import { cn } from "@/lib/utils";
import { fmtDate, fmtDateTime, fmtRelative, type Article, type Freshness } from "./api";

const STATE: Record<Freshness["state"], { label: string; cls: string; icon: typeof Info }> = {
  fresh: { label: "Up to date", cls: "border-primary/30 bg-primary/[0.06] text-primary", icon: CircleCheck },
  partial: { label: "Some sources unavailable", cls: "border-warning/30 bg-warning-soft/50 text-warning", icon: AlertTriangle },
  stale: { label: "May be out of date", cls: "border-warning/40 bg-warning-soft/60 text-warning", icon: Clock },
  never_refreshed: { label: "Not refreshed yet", cls: "border-border bg-background-2 text-muted-foreground", icon: CircleSlash },
  no_sources: { label: "No sources enabled", cls: "border-border bg-background-2 text-muted-foreground", icon: CircleSlash },
};

/** Always tells the reader how current the section is — old data is never presented as new. */
export function FreshnessBanner({ f, className }: { f?: Freshness | null; className?: string }) {
  if (!f) return null;
  const s = STATE[f.state];
  const Icon = s.icon;
  return (
    <div role="status" className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border px-4 py-2.5 text-sm", s.cls, className)}>
      <span className="inline-flex items-center gap-1.5 font-medium"><Icon className="size-4" /> {s.label}</span>
      <span className="inline-flex items-center gap-1.5 text-muted-foreground"><RefreshCw className="size-3.5" />
        Last refreshed {fmtRelative(f.last_refresh_at)}{f.last_refresh_at ? ` (${fmtDateTime(f.last_refresh_at)})` : ""}
      </span>
      {f.sources_failing > 0 && (
        <span className="text-muted-foreground">
          Unavailable: {f.unavailable_sources.join(", ")}
        </span>
      )}
      {f.state === "stale" && <span className="text-muted-foreground">Content older than {f.stale_after_hours} h — the collector may be down.</span>}
      {f.state === "never_refreshed" && <span className="text-muted-foreground">The content worker hasn't completed a run yet.</span>}
    </div>
  );
}

const SEV: Record<string, { label: string; cls: string }> = {
  critical: { label: "Critical", cls: "border-danger/40 bg-danger-soft text-danger" },
  high: { label: "High", cls: "border-danger/40 bg-danger-soft text-danger" },
  warning: { label: "Medium", cls: "border-warning/40 bg-warning-soft text-warning" },
};

/** Severity only when someone actually rated it, and it always says who. */
export function SeverityBadge({ a }: { a: Article }) {
  const s = SEV[a.severity];
  if (!s || a.severity_origin === "none") return null;
  const who = a.severity_origin === "source" ? "Rated by the source" : "CyberShield360 rule: listed as known exploited";
  return (
    <span title={who} className={cn("inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold", s.cls)}>
      <ShieldAlert className="size-3.5" aria-hidden /> {s.label}
      <span className="sr-only"> — {who}</span>
      {a.severity_origin === "system" && <span aria-hidden className="font-normal opacity-80">· rule</span>}
    </span>
  );
}

const KIND_LABEL: Record<string, string> = { news: "News", advisory: "Advisory", vulnerability: "Vulnerability", alert: "Alert" };

export function DateLine({ a }: { a: Article }) {
  return (
    <span className="text-xs text-subtle">
      {a.published_at ? <time dateTime={a.published_at}>{fmtDate(a.published_at)}</time> : <span>Date not given by the source</span>}
      {" · "}{a.source}
      {a.ingested_at && <span className="hidden sm:inline"> · collected {fmtRelative(a.ingested_at)}</span>}
    </span>
  );
}

export function ArticleRow({ a, thumb = true }: { a: Article; thumb?: boolean }) {
  return (
    <article className="flex flex-col gap-4 rounded-2xl border bg-card p-3 shadow-elev transition-colors hover:border-primary/40 sm:flex-row sm:items-center">
      {thumb && (
        <div className="aspect-[16/9] w-full shrink-0 overflow-hidden rounded-xl sm:aspect-auto sm:h-24 sm:w-40">
          <TopicArt topic={a.kind === "alert" ? "alert" : a.kind === "advisory" ? "advisory" : topicFor(a.category)} person={false} />
        </div>
      )}
      <div className="min-w-0 flex-1 px-1 sm:px-0">
        <div className="mb-1 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="rounded-md bg-secondary px-1.5 py-0.5 font-medium">{KIND_LABEL[a.kind] ?? a.kind}</span>
          <span className="text-muted-foreground">{a.category_label}</span>
          {a.region && a.region !== "global" && <span className="rounded-md border px-1.5 py-0.5 text-muted-foreground">{a.region}</span>}
          {a.tags.map((t) => <span key={t} className="rounded-md border px-1.5 py-0.5 text-muted-foreground">{t}</span>)}
        </div>
        <h3 className="font-display text-base font-semibold leading-snug">{a.title}</h3>
        {a.summary && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{a.summary}</p>}
        <div className="mt-1.5"><DateLine a={a} /></div>
      </div>
      <div className="flex shrink-0 items-center justify-between gap-3 px-1 sm:flex-col sm:items-end sm:px-2">
        <SeverityBadge a={a} />
        <a href={a.source_url} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/5">
          Read source <ExternalLink className="size-3.5" />
        </a>
      </div>
    </article>
  );
}
