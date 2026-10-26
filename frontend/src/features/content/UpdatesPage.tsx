import { Link } from "react-router-dom";
import { CalendarClock, ShieldAlert, Radio, ArrowRight, CheckCircle2, AlertTriangle, PauseCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { cn } from "@/lib/utils";
import { fmtDate, fmtRelative, useSources, useTodayUpdates } from "./api";
import { ArticleRow, FreshnessBanner } from "./components";

const SRC_STATE: Record<string, { label: string; cls: string; icon: typeof CheckCircle2 }> = {
  ok: { label: "Working", cls: "text-primary", icon: CheckCircle2 },
  failing: { label: "Unavailable", cls: "text-warning", icon: AlertTriangle },
  paused: { label: "Paused", cls: "text-danger", icon: PauseCircle },
  pending: { label: "Not checked yet", cls: "text-subtle", icon: Clock },
  disabled: { label: "Disabled", cls: "text-subtle", icon: PauseCircle },
};

/** Today's Updates: items the sources dated today, critical alerts, and source health. */
export function UpdatesPage() {
  const today = useTodayUpdates();
  const sources = useSources();
  const d = today.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Today's Cybersecurity Updates</h1>
          <p className="mt-1 text-muted-foreground">
            Collected automatically from official agencies and research sources{d ? ` · ${fmtDate(d.date + "T12:00:00", { dateStyle: "full" } as Intl.DateTimeFormatOptions)} (${d.timezone})` : ""}.
          </p>
        </div>
        <Button variant="outline" asChild><Link to="/app/news">All news &amp; advisories <ArrowRight /></Link></Button>
      </div>

      <FreshnessBanner f={d?.freshness} />

      {today.isLoading ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted" />)}</div>
      ) : today.isError ? (
        <ErrorState message="Couldn't load today's updates." onRetry={() => today.refetch()} />
      ) : d && (
        <>
          {d.critical.length > 0 && (
            <section aria-labelledby="crit-title">
              <h2 id="crit-title" className="mb-3 flex items-center gap-2 font-display text-lg font-semibold">
                <ShieldAlert className="size-5 text-danger" /> Critical &amp; high-severity
              </h2>
              <div className="space-y-3">{d.critical.slice(0, 3).map((a) => <ArticleRow key={a.id} a={a} />)}</div>
            </section>
          )}

          <section aria-labelledby="today-title">
            <h2 id="today-title" className="mb-3 flex items-center gap-2 font-display text-lg font-semibold">
              <CalendarClock className="size-5 text-primary" /> {d.fallback ? "Most recent updates" : "Published today"}
            </h2>
            {d.fallback && (
              <p className="mb-3 rounded-xl border bg-background-2 px-4 py-2.5 text-sm text-muted-foreground">
                No source has published anything dated today yet. These are the most recent items, shown with their real publication dates.
              </p>
            )}
            {d.items.length === 0 ? (
              <EmptyState title="No updates collected yet" description="Items appear here once the content worker has run." />
            ) : (
              <div className="space-y-3">{d.items.map((a) => <ArticleRow key={a.id} a={a} />)}</div>
            )}
          </section>
        </>
      )}

      <section aria-labelledby="src-title" className="rounded-2xl border bg-card p-5 shadow-elev">
        <h2 id="src-title" className="flex items-center gap-2 font-display text-lg font-semibold"><Radio className="size-5 text-primary" /> Sources</h2>
        <p className="mt-1 text-sm text-muted-foreground">Every item links to its original publisher. Summaries are short excerpts; the source is authoritative.</p>
        <ul className="mt-4 grid gap-2 md:grid-cols-2">
          {(sources.data ?? []).map((s) => {
            const st = SRC_STATE[s.state] ?? SRC_STATE.pending;
            const Icon = st.icon;
            return (
              <li key={s.key} className="flex items-start justify-between gap-3 rounded-xl border bg-background-2 px-3 py-2.5">
                <span className="min-w-0">
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="block truncate text-sm font-medium hover:text-primary">{s.name}</a>
                  <span className="text-xs text-subtle">{s.jurisdiction} · {s.trust} · {s.items} items · last success {fmtRelative(s.last_success_at)}</span>
                </span>
                <span className={cn("inline-flex shrink-0 items-center gap-1 text-xs font-medium", st.cls)}><Icon className="size-3.5" />{st.label}</span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
