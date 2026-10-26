import { Link } from "react-router-dom";
import { Siren, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RiskBadge } from "@/components/ui/RiskBadge";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { useAuth } from "@/features/auth/useAuth";
import { formatWhen, isThreat, useScanHistory } from "@/features/scanner/history";
import { useUpdates } from "@/features/content/api";
import { ArticleRow, FreshnessBanner } from "@/features/content/components";

const ORDER: Record<string, number> = { critical: 0, high: 1, warning: 2, info: 3 };

/** Active scam alerts and advisories, plus high-risk results from your own scans. */
export function AlertsPage() {
  const { user } = useAuth();
  const news = useUpdates({ kind: "alert", days: 60 }, 15);
  const history = useScanHistory();
  const alerts = (news.data?.pages ?? []).flatMap((p) => p.items).sort((a, b) => (ORDER[a.severity] ?? 9) - (ORDER[b.severity] ?? 9));
  const mine = (history.data ?? []).filter((s) => isThreat(s.risk_level)).slice(0, 5);

  return (
    <div>
      <div className="mb-6">
        <h1 className="flex items-center gap-2 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          <Siren className="size-7 text-danger" aria-hidden /> Live Alerts
        </h1>
        <p className="mt-1 text-muted-foreground">Active scam alerts and advisories, and the high-risk items from your own scans.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section aria-labelledby="alerts-title" className="rounded-2xl border bg-card p-5 shadow-elev">
          <h2 id="alerts-title" className="font-display text-lg font-semibold">Threat alerts</h2>
          <FreshnessBanner f={news.data?.pages[0]?.freshness} className="mt-3" />
          <div className="mt-4">
            {news.isLoading ? <div className="h-24 animate-pulse rounded-xl bg-muted" /> : news.isError ? (
              <ErrorState message="Couldn't load alerts." onRetry={() => news.refetch()} />
            ) : alerts.length === 0 ? (
              <EmptyState title="No active alerts" description="We'll list new scam alerts here as they're published." />
            ) : (
              <ul className="space-y-3">
                {alerts.map((a) => <li key={a.id}><ArticleRow a={a} thumb={false} /></li>)}
              </ul>
            )}
          </div>
          <Button variant="ghost" className="mt-3" asChild><Link to="/app/news">All news &amp; updates <ArrowRight /></Link></Button>
        </section>

        <section aria-labelledby="mine-title" className="rounded-2xl border bg-card p-5 shadow-elev">
          <h2 id="mine-title" className="font-display text-lg font-semibold">From your scans</h2>
          <div className="mt-4">
            {!user ? (
              <EmptyState title="Sign in to see your alerts" description="High-risk results from your saved scans appear here."
                action={<Button size="sm" asChild><Link to="/login">Sign in</Link></Button>} />
            ) : history.isLoading ? <div className="h-24 animate-pulse rounded-xl bg-muted" /> : mine.length === 0 ? (
              <EmptyState title="Nothing high-risk" description="None of your recent scans were rated high or critical." />
            ) : (
              <ul className="divide-y">
                {mine.map((s) => (
                  <li key={s.scan_id}>
                    <Link to={`/app/scans/${s.scan_id}`} className="-mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-3 hover:bg-secondary/60">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{s.target}</span>
                        <span className="text-xs text-subtle">{formatWhen(s.created_at)}</span>
                      </span>
                      {s.risk_level && <RiskBadge level={s.risk_level} size="sm" />}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
