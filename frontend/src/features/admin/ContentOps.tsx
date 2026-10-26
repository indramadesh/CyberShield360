import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Play, PauseCircle, RotateCcw, CheckCircle2, AlertTriangle, Clock, Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/services/api";
import { cn } from "@/lib/utils";
import { fmtRelative } from "@/features/content/api";
import { FreshnessBanner } from "@/features/content/components";
import type { Freshness } from "@/features/content/api";

interface Src {
  key: string; name: string; category: string; fmt: string; feed_url: string; enabled: boolean; paused_reason: string | null;
  interval_minutes: number; last_attempt_at: string | null; last_success_at: string | null; next_attempt_at: string | null;
  consecutive_failures: number; last_error: string | null; last_error_type: string | null; last_status_code: number | null;
  last_response_ms: number | null; total_items: number; total_duplicates: number;
}
interface Job { job: string; every_minutes: number; last_finished_at: string | null; last_status: string | null; last_error: string | null; running: boolean; next_due_at: string; run_count: number }
interface Run { source: string; started_at: string; status: string; trigger: string; http_status: number | null; new: number; updated: number; duplicate: number; rejected: number; error_type: string | null; error: string | null }
interface Candidate { id: string; source: string; title: string; url: string; change_type: string; status: string; reason: string; detected_at: string }

function Health({ s }: { s: Src }) {
  if (!s.enabled) return <span className="inline-flex items-center gap-1 text-xs text-subtle"><Power className="size-3.5" /> Disabled</span>;
  if (s.paused_reason) return <span className="inline-flex items-center gap-1 text-xs text-danger"><PauseCircle className="size-3.5" /> Paused</span>;
  if (s.consecutive_failures) return <span className="inline-flex items-center gap-1 text-xs text-warning"><AlertTriangle className="size-3.5" /> Failing ×{s.consecutive_failures}</span>;
  if (s.last_success_at) return <span className="inline-flex items-center gap-1 text-xs text-primary"><CheckCircle2 className="size-3.5" /> Healthy</span>;
  return <span className="inline-flex items-center gap-1 text-xs text-subtle"><Clock className="size-3.5" /> Not run yet</span>;
}

export function ContentOps() {
  const qc = useQueryClient();
  const push = useToast();
  const sources = useQuery({ queryKey: ["admin", "sources"], queryFn: () => apiFetch<{ sources: Src[]; not_enabled: { name: string; url: string; reason: string }[] }>("/admin/content/sources") });
  const sched = useQuery({ queryKey: ["admin", "scheduler"], queryFn: () => apiFetch<{ jobs: Job[]; freshness: { sections: Freshness[] }; embedded: boolean; ingestion_enabled: boolean }>("/admin/content/scheduler"), refetchInterval: 30_000 });
  const runs = useQuery({ queryKey: ["admin", "runs"], queryFn: () => apiFetch<Run[]>("/admin/content/runs?limit=25") });
  const cands = useQuery({ queryKey: ["admin", "candidates"], queryFn: () => apiFetch<Candidate[]>("/admin/content/legal-candidates") });
  const refresh = () => ["sources", "scheduler", "runs", "candidates"].forEach((k) => qc.invalidateQueries({ queryKey: ["admin", k] }));

  const patch = useMutation({
    mutationFn: ({ key, body }: { key: string; body: { enabled?: boolean; resume?: boolean } }) =>
      apiFetch(`/admin/content/sources/${key}`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: refresh,
  });
  const runNow = useMutation({
    mutationFn: (key: string) => apiFetch<{ status: string; items_new: number; error: string | null }>(`/admin/content/sources/${key}/run`, { method: "POST" }),
    onSuccess: (r) => { push({ title: r.status === "error" ? "Fetch failed" : `Fetched: ${r.items_new} new`, description: r.error ?? undefined, tone: r.status === "error" ? "error" : "success" }); refresh(); },
  });
  const runJob = useMutation({
    mutationFn: (job: string) => apiFetch<{ job: string; status: string }[]>("/admin/content/scheduler/run", { method: "POST", body: JSON.stringify({ job }) }),
    onSuccess: (r) => { push({ title: `Job ${r[0]?.job}: ${r[0]?.status}`, tone: r[0]?.status === "ok" ? "success" : "error" }); refresh(); },
  });
  const setCand = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => apiFetch(`/admin/content/legal-candidates/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: refresh,
  });

  return (
    <section className="mt-8 space-y-5" aria-labelledby="ops-title">
      <div>
        <h2 id="ops-title" className="font-display text-xl font-semibold">Content operations</h2>
        <p className="text-sm text-muted-foreground">
          The worker publishes automatically. Use these controls only for failures and configuration changes.
          {sched.data && !sched.data.ingestion_enabled && <span className="text-warning"> Ingestion is disabled (CONTENT_INGESTION_ENABLED=false).</span>}
        </p>
      </div>

      <div className="grid gap-2 md:grid-cols-3">{(sched.data?.freshness.sections ?? []).map((f) => <FreshnessBanner key={f.section} f={f} className="text-xs" />)}</div>

      <div className="overflow-x-auto rounded-2xl border bg-card shadow-elev">
        <table className="w-full text-sm">
          <thead><tr className="border-b text-left text-xs uppercase tracking-wide text-subtle">
            <th className="px-4 py-2">Scheduled job</th><th className="px-4 py-2">Every</th><th className="px-4 py-2">Last run</th><th className="px-4 py-2">Status</th><th className="px-4 py-2" />
          </tr></thead>
          <tbody className="divide-y">
            {(sched.data?.jobs ?? []).map((j) => (
              <tr key={j.job}>
                <td className="px-4 py-2 font-mono text-xs">{j.job}</td>
                <td className="px-4 py-2 text-muted-foreground">{j.every_minutes >= 60 ? `${j.every_minutes / 60} h` : `${j.every_minutes} min`}</td>
                <td className="px-4 py-2 text-muted-foreground">{fmtRelative(j.last_finished_at)} · {j.run_count} runs</td>
                <td className="px-4 py-2">{j.running ? "running" : j.last_status ?? "—"}{j.last_error && <div className="max-w-xs truncate text-xs text-danger" title={j.last_error}>{j.last_error}</div>}</td>
                <td className="px-4 py-2 text-right"><Button size="sm" variant="ghost" onClick={() => runJob.mutate(j.job)} disabled={runJob.isPending}><Play /> Run</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="overflow-x-auto rounded-2xl border bg-card shadow-elev">
        <table className="w-full text-sm">
          <thead><tr className="border-b text-left text-xs uppercase tracking-wide text-subtle">
            <th className="px-4 py-2">Source</th><th className="px-4 py-2">Health</th><th className="px-4 py-2">Last success</th><th className="px-4 py-2">Items</th><th className="px-4 py-2" />
          </tr></thead>
          <tbody className="divide-y">
            {(sources.data?.sources ?? []).map((s) => (
              <tr key={s.key} className="align-top">
                <td className="px-4 py-2.5">
                  <div className="font-medium">{s.name}</div>
                  <div className="text-xs text-subtle">{s.key} · {s.fmt} · every {s.interval_minutes} min{s.last_response_ms ? ` · ${s.last_response_ms} ms` : ""}</div>
                  {(s.last_error || s.paused_reason) && <div className="mt-1 max-w-md text-xs text-danger">{s.paused_reason ?? `${s.last_error_type}: ${s.last_error}`}</div>}
                </td>
                <td className="px-4 py-2.5"><Health s={s} /></td>
                <td className="px-4 py-2.5 text-muted-foreground">{fmtRelative(s.last_success_at)}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{s.total_items} <span className="text-xs">({s.total_duplicates} dup)</span></td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right">
                  <Button size="sm" variant="ghost" onClick={() => runNow.mutate(s.key)} disabled={runNow.isPending || !s.enabled}><Play /> Run now</Button>
                  {s.paused_reason && <Button size="sm" variant="ghost" onClick={() => patch.mutate({ key: s.key, body: { resume: true } })}><RotateCcw /> Resume</Button>}
                  <Button size="sm" variant="ghost" onClick={() => patch.mutate({ key: s.key, body: { enabled: !s.enabled } })}>
                    <Power /> {s.enabled ? "Disable" : "Enable"}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {sources.data?.not_enabled && (
          <details className="border-t px-4 py-3 text-sm">
            <summary className="cursor-pointer text-muted-foreground">Sources evaluated but not enabled ({sources.data.not_enabled.length})</summary>
            <ul className="mt-2 space-y-1">{sources.data.not_enabled.map((n) => <li key={n.name}><span className="font-medium">{n.name}</span> — <span className="text-muted-foreground">{n.reason}</span></li>)}</ul>
          </details>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border bg-card p-4 shadow-elev">
          <h3 className="font-semibold">Recent fetches</h3>
          <ul className="mt-2 max-h-80 space-y-1 overflow-y-auto text-xs">
            {(runs.data ?? []).map((r, i) => (
              <li key={i} className="flex justify-between gap-3 border-b py-1.5 last:border-0">
                <span><span className="font-mono">{r.source}</span> · {fmtRelative(r.started_at)} · {r.trigger}</span>
                <span className={cn(r.status === "error" ? "text-danger" : "text-muted-foreground")}>
                  {r.status}{r.http_status ? ` ${r.http_status}` : ""} · +{r.new} ~{r.updated} ={r.duplicate}{r.rejected ? ` ✕${r.rejected}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border bg-card p-4 shadow-elev">
          <h3 className="font-semibold">Legal change candidates</h3>
          {(cands.data ?? []).length === 0 ? <p className="mt-2 text-sm text-muted-foreground">No changes detected.</p> : (
            <ul className="mt-2 space-y-2 text-sm">
              {cands.data!.map((c) => (
                <li key={c.id} className="rounded-lg border bg-background-2 p-3">
                  <div className="flex items-center justify-between gap-2 text-xs"><span className="font-mono">{c.change_type}</span><span className="text-subtle">{c.status} · {fmtRelative(c.detected_at)}</span></div>
                  <a href={c.url} target="_blank" rel="noopener noreferrer" className="mt-1 block font-medium hover:text-primary">{c.title}</a>
                  <p className="text-xs text-muted-foreground">{c.reason}</p>
                  {c.status === "open" && (
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => setCand.mutate({ id: c.id, status: "reviewed" })}>Mark reviewed</Button>
                      <Button size="sm" variant="ghost" onClick={() => setCand.mutate({ id: c.id, status: "dismissed" })}>Dismiss</Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
