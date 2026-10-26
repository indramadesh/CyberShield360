import { useState } from "react";
import { ExternalLink, Scale, BadgeCheck, CircleHelp, History, FileText } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { cn } from "@/lib/utils";
import { fmtDate, useLegal, useLegalDetail, type LegalRecord } from "./api";
import { FreshnessBanner } from "./components";

const STATUS_CLS: Record<string, string> = {
  effective: "border-primary/40 bg-primary/10 text-primary",
  enacted: "border-info/40 bg-info-soft text-info",
  amendment: "border-info/40 bg-info-soft text-info",
  published_notification: "border-info/40 bg-info-soft text-info",
  commencement_notification: "border-primary/40 bg-primary/10 text-primary",
  draft: "border-warning/40 bg-warning-soft text-warning",
  consultation: "border-warning/40 bg-warning-soft text-warning",
  guidance: "border-border bg-secondary text-muted-foreground",
  repealed: "border-danger/40 bg-danger-soft text-danger",
  superseded: "border-danger/40 bg-danger-soft text-danger",
  status_not_established: "border-border bg-background-2 text-muted-foreground",
};

function StatusBadge({ r }: { r: LegalRecord }) {
  return (
    <span className={cn("inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold", STATUS_CLS[r.legal_status ?? "status_not_established"])}>
      {r.legal_status_label}
    </span>
  );
}

function LawCard({ r, onOpen }: { r: LegalRecord; onOpen: () => void }) {
  const verified = r.verification_status === "verified";
  return (
    <article className="rounded-2xl border bg-card p-5 shadow-elev">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge r={r} />
        {r.document_ref && <span className="text-xs text-subtle">{r.document_ref}</span>}
        <span className={cn("ml-auto inline-flex items-center gap-1 text-xs", verified ? "text-primary" : "text-muted-foreground")}>
          {verified ? <><BadgeCheck className="size-3.5" /> Verified record</> : <><CircleHelp className="size-3.5" /> Found automatically — status not established</>}
        </span>
      </div>
      <h3 className="mt-3 font-display text-lg font-semibold leading-snug">{r.title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{r.authority}</p>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        <div><dt className="text-xs text-subtle">Published</dt><dd>{r.publication_date ? fmtDate(r.publication_date) : "Not stated"}</dd></div>
        <div><dt className="text-xs text-subtle">In force from</dt><dd>{r.effective_date ? fmtDate(r.effective_date) : <span className="text-muted-foreground">Not confirmed in our records</span>}</dd></div>
        {r.amends && <div><dt className="text-xs text-subtle">Amends</dt><dd>{r.amends}</dd></div>}
      </dl>
      <p className="mt-3 text-sm leading-relaxed">{r.plain_summary}</p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" asChild>
          <a href={r.official_source} target="_blank" rel="noopener noreferrer"><FileText /> Official source <ExternalLink /></a>
        </Button>
        <Button size="sm" variant="ghost" onClick={onOpen}><History /> Details &amp; history</Button>
        {r.last_checked_at && <span className="text-xs text-subtle">Official file last checked {fmtDate(r.last_checked_at)}</span>}
      </div>
    </article>
  );
}

export function LawPage() {
  const legal = useLegal();
  const [slug, setSlug] = useState<string | null>(null);
  const detail = useLegalDetail(slug);
  const items = legal.data?.items ?? [];
  const verified = items.filter((r) => r.verification_status === "verified");
  const auto = items.filter((r) => r.verification_status !== "verified");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-semibold tracking-tight sm:text-3xl"><Scale className="size-7 text-primary" /> Indian Cyber Law Tracker</h1>
        <p className="mt-1 max-w-3xl text-muted-foreground">
          Key laws, rules and directions on cybersecurity and data protection, with their status as established from official records.
        </p>
      </div>
      <p className="rounded-xl border border-warning/30 bg-warning-soft/40 px-4 py-2.5 text-sm">
        {legal.data?.notice ?? "Summaries are informational and are not legal advice. Always rely on the official text."}
      </p>
      <FreshnessBanner f={legal.data?.freshness} />

      {legal.isLoading ? (
        <div className="space-y-3">{[0, 1].map((i) => <div key={i} className="h-48 animate-pulse rounded-2xl bg-muted" />)}</div>
      ) : legal.isError ? (
        <ErrorState message="Couldn't load the law tracker." onRetry={() => legal.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState icon={<Scale className="size-8" />} title="No legal records yet" />
      ) : (
        <>
          <section className="space-y-3">{verified.map((r) => <LawCard key={r.id} r={r} onOpen={() => setSlug(r.slug)} />)}</section>
          {auto.length > 0 && (
            <section>
              <h2 className="mb-1 font-display text-lg font-semibold">Official publications found automatically</h2>
              <p className="mb-3 text-sm text-muted-foreground">Detected in official feeds. Their legal effect has not been assessed — open the official document.</p>
              <div className="space-y-3">{auto.map((r) => <LawCard key={r.id} r={r} onOpen={() => setSlug(r.slug)} />)}</div>
            </section>
          )}
        </>
      )}

      <Dialog open={Boolean(slug)} onOpenChange={(o) => { if (!o) setSlug(null); }}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          {detail.data ? (
            <>
              <DialogTitle className="font-display text-xl leading-snug">{detail.data.title}</DialogTitle>
              <DialogDescription>{detail.data.authority} · {detail.data.legal_status_label}</DialogDescription>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div><dt className="text-xs text-subtle">Document type</dt><dd className="capitalize">{(detail.data.document_type ?? "—").replace(/_/g, " ")}</dd></div>
                <div><dt className="text-xs text-subtle">Jurisdiction</dt><dd>{detail.data.jurisdiction ?? "—"}</dd></div>
                <div><dt className="text-xs text-subtle">Commencement</dt><dd className="capitalize">{(detail.data.commencement_status ?? "not established").replace(/_/g, " ")}</dd></div>
                <div><dt className="text-xs text-subtle">Summary source</dt><dd className="capitalize">{detail.data.summary_provenance ?? "—"}</dd></div>
              </dl>
              <h3 className="mt-5 font-semibold">Official file history</h3>
              {detail.data.versions && detail.data.versions.length > 0 ? (
                <ul className="mt-2 space-y-1.5 text-sm">
                  {detail.data.versions.map((v) => (
                    <li key={v.version} className="flex justify-between gap-3 rounded-lg border bg-background-2 px-3 py-2">
                      <span>Version {v.version} · captured {fmtDate(v.captured_at)}</span>
                      <span className="text-xs text-subtle">{v.last_modified ? `server date ${v.last_modified}` : ""}{v.size_bytes ? ` · ${Math.round(v.size_bytes / 1024)} KB` : ""}</span>
                    </li>
                  ))}
                </ul>
              ) : <p className="mt-2 text-sm text-muted-foreground">This record's official file isn't watched automatically.</p>}
              <p className="mt-4 text-xs text-subtle">A new version means the official file changed. CyberShield360 doesn't interpret what changed legally.</p>
            </>
          ) : <><DialogTitle className="sr-only">Loading</DialogTitle><div className="h-40 animate-pulse rounded-xl bg-muted" /></>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
