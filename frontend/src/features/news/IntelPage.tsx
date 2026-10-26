import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Search, Newspaper, Scale, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { cn } from "@/lib/utils";
import { useUpdates, type ArticleKind } from "@/features/content/api";
import { ArticleRow, FreshnessBanner } from "@/features/content/components";

const KINDS: { key: ArticleKind | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "advisory", label: "Security Advisories" },
  { key: "vulnerability", label: "Vulnerabilities" },
  { key: "alert", label: "Threat Alerts" },
  { key: "news", label: "News" },
];
const TOPICS = [
  ["", "All topics"], ["vulnerability", "Vulnerabilities"], ["malware", "Malware"], ["ransomware", "Ransomware"],
  ["phishing", "Phishing"], ["scams", "Online scams"], ["data-breach", "Data breaches"], ["privacy", "Privacy"],
  ["cloud", "Cloud security"], ["network", "Network security"], ["application", "Application security"],
  ["cyber-law", "Cyber law"], ["awareness", "General awareness"],
];

/** Cybersecurity News & Security Advisories — real collected items, paginated. */
export function IntelPage() {
  const [params, setParams] = useSearchParams();
  const kind = (params.get("kind") ?? "all") as ArticleKind | "all";
  const [category, setCategory] = useState(params.get("category") ?? "");
  const [india, setIndia] = useState(params.get("region") === "IN");
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => { const t = setTimeout(() => setDebounced(q.trim()), 300); return () => clearTimeout(t); }, [q]);

  const feed = useUpdates({ kind: kind === "all" ? undefined : kind, category: category || undefined, region: india ? "IN" : undefined, q: debounced || undefined });
  const pages = feed.data?.pages ?? [];
  const items = pages.flatMap((p) => p.items);
  const total = pages[0]?.total ?? 0;

  function setKind(k: string) {
    const next = new URLSearchParams(params);
    if (k === "all") next.delete("kind"); else next.set("kind", k);
    setParams(next, { replace: true });
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Latest Cybersecurity News</h1>
          <p className="mt-1 text-muted-foreground">Advisories, vulnerabilities and alerts collected from official and research sources.</p>
        </div>
        <Button variant="outline" asChild><Link to="/app/law"><Scale /> Cyber Law Tracker</Link></Button>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by type">
        {KINDS.map((c) => (
          <button key={c.key} onClick={() => setKind(c.key)} aria-pressed={kind === c.key}
            className={cn("rounded-lg border px-4 py-1.5 text-sm font-medium transition-colors",
              kind === c.key ? "border-primary bg-primary text-primary-foreground shadow-glow" : "bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground")}>
            {c.label}
          </button>
        ))}
        <button onClick={() => setIndia((v) => !v)} aria-pressed={india}
          className={cn("rounded-lg border px-4 py-1.5 text-sm font-medium transition-colors",
            india ? "border-primary bg-primary/15 text-primary" : "bg-card text-muted-foreground hover:border-primary/40")}>
          India only
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <div className="relative min-w-[14rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search titles and summaries" aria-label="Search news"
            className="h-10 w-full rounded-lg border bg-card pl-9 pr-3 text-sm placeholder:text-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        </div>
        <span className="relative">
          <select aria-label="Filter by topic" value={category} onChange={(e) => setCategory(e.target.value)}
            className="h-10 appearance-none rounded-lg border bg-card pl-3 pr-9 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {TOPICS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
        </span>
      </div>

      <FreshnessBanner f={pages[0]?.freshness} className="mt-4" />

      <div className="mt-4">
        {feed.isLoading ? (
          <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted" />)}</div>
        ) : feed.isError ? (
          <ErrorState message="Couldn't load news." onRetry={() => feed.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState icon={<Newspaper className="size-8" />} title={debounced || category || india || kind !== "all" ? "No matching items" : "No news collected yet"}
            description={debounced || category || india || kind !== "all" ? "Try a different filter or search." : "Items appear once the content worker has run."} />
        ) : (
          <>
            <p className="mb-3 text-sm text-muted-foreground">{total} item{total === 1 ? "" : "s"}</p>
            <ul className="space-y-3">{items.map((a) => <li key={a.id}><ArticleRow a={a} /></li>)}</ul>
            {feed.hasNextPage && (
              <div className="mt-4 text-center">
                <Button variant="outline" onClick={() => feed.fetchNextPage()} loading={feed.isFetchingNextPage}>Load more</Button>
              </div>
            )}
          </>
        )}
        <p className="mt-4 text-xs text-subtle">Severity is shown only when the source rates it (or for CISA's known-exploited list). Summaries are short excerpts — read the source for full details.</p>
      </div>
    </div>
  );
}
