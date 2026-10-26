import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Download, Trash2, FileText, ChevronLeft, ChevronRight, ChevronDown,
  Link2, MessageSquare, Mail, Image as ImageIcon, QrCode, Globe, ScanSearch,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { RiskBadge } from "@/components/ui/RiskBadge";
import { ConfirmDialog } from "@/components/ui/dialog";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/features/auth/useAuth";
import { apiFetch } from "@/services/api";
import { cn } from "@/lib/utils";
import { SCAN_TYPE_LABEL, parseApiDate, useScanHistory, type ScanSummary } from "@/features/scanner/history";

const PAGE = 10;
const RANGES = [
  { key: "7", label: "Last 7 Days", days: 7 },
  { key: "30", label: "Last 30 Days", days: 30 },
  { key: "90", label: "Last 90 Days", days: 90 },
  { key: "all", label: "All Time", days: 0 },
];
const TYPE_ICON: Record<string, typeof Link2> = {
  URL: Link2, MESSAGE: MessageSquare, EMAIL: Mail, IMAGE: ImageIcon, QR: QrCode, WEBSITE: Globe,
};
const RISK_TILE: Record<string, string> = {
  LOW: "bg-primary/12 text-primary ring-primary/30",
  SUSPICIOUS: "bg-warning-soft text-warning ring-warning/30",
  HIGH: "bg-high-soft text-high ring-high/30",
  CRITICAL: "bg-danger-soft text-danger ring-danger/30",
};

function toCsv(rows: ScanSummary[]) {
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const head = ["scan_id", "date", "type", "target", "risk_level", "risk_score", "category"];
  const body = rows.map((r) => [r.scan_id, r.created_at, r.scan_type, r.target, r.risk_level, r.risk_score, r.category].map(esc).join(","));
  return [head.join(","), ...body].join("\n");
}

function Select({ label, value, onChange, children }: { label: string; value: string; onChange: (v: string) => void; children: ReactNode }) {
  return (
    <span className="relative">
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}
        className="h-10 min-w-[10rem] appearance-none rounded-lg border bg-card pl-3 pr-9 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
    </span>
  );
}

export function ReportsPage() {
  const { user } = useAuth();
  const history = useScanHistory();
  const qc = useQueryClient();
  const push = useToast();
  const [type, setType] = useState("all");
  const [range, setRange] = useState("30");
  const [page, setPage] = useState(0);
  const [pendingDelete, setPendingDelete] = useState<ScanSummary | null>(null);

  const del = useMutation({
    mutationFn: (id: string) => apiFetch(`/scans/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["scan-history"] });
      push({ title: "Report deleted", tone: "success" });
      setPendingDelete(null);
    },
    onError: () => push({ title: "Couldn't delete the report", tone: "error" }),
  });

  const rows = useMemo(() => {
    const days = RANGES.find((r) => r.key === range)?.days ?? 0;
    const since = days ? Date.now() - days * 86400_000 : 0;
    return (history.data ?? [])
      .filter((s) => (type === "all" || s.scan_type === type) && (!since || parseApiDate(s.created_at).getTime() >= since))
      .sort((a, b) => parseApiDate(b.created_at).getTime() - parseApiDate(a.created_at).getTime());
  }, [history.data, type, range]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const current = Math.min(page, pages - 1);
  const visible = rows.slice(current * PAGE, current * PAGE + PAGE);
  const types = Array.from(new Set((history.data ?? []).map((s) => s.scan_type)));

  function exportCsv() {
    const blob = new Blob([toCsv(rows)], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `cybershield360-reports-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const header = (
    <div className="mb-5">
      <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">My Scan Reports</h1>
      <p className="mt-1 text-muted-foreground">View your past scans and results.</p>
    </div>
  );

  if (!user) {
    return (
      <div>
        {header}
        <div className="rounded-2xl border bg-card shadow-elev">
          <EmptyState icon={<FileText className="size-8" />} title="Sign in to see your reports"
            description="Scans you run as a guest aren't saved to a history. Create a free account to keep them."
            action={<div className="flex gap-2"><Button variant="outline" asChild><Link to="/login">Sign in</Link></Button><Button asChild><Link to="/login?mode=register">Create account</Link></Button></div>} />
        </div>
      </div>
    );
  }

  return (
    <div>
      {header}
      <div className="flex flex-wrap items-center gap-2">
        <Select label="Filter by type" value={type} onChange={(v) => { setType(v); setPage(0); }}>
          <option value="all">All Types</option>
          {types.map((t) => <option key={t} value={t}>{SCAN_TYPE_LABEL[t] ?? t}</option>)}
        </Select>
        <Select label="Filter by date" value={range} onChange={(v) => { setRange(v); setPage(0); }}>
          {RANGES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
        </Select>
        {rows.length > 0 && <Button variant="ghost" className="ml-auto" onClick={exportCsv}><Download /> Export CSV</Button>}
      </div>

      <div className="mt-4">
        {history.isLoading ? (
          <div className="space-y-2">{[0, 1, 2, 3].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />)}</div>
        ) : history.isError ? (
          <ErrorState message="Couldn't load your reports." onRetry={() => history.refetch()} />
        ) : (history.data?.length ?? 0) === 0 ? (
          <div className="rounded-2xl border bg-card"><EmptyState icon={<FileText className="size-8" />} title="No reports yet"
            description="Run a scan and it will appear here." action={<Button asChild><Link to="/app/scan">Start a scan</Link></Button>} /></div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border bg-card"><EmptyState title="No matching reports" description="Try a different type or date range."
            action={<Button variant="outline" onClick={() => { setType("all"); setRange("all"); }}>Show all</Button>} /></div>
        ) : (
          <>
            <ul className="divide-y overflow-hidden rounded-2xl border bg-card shadow-elev">
              {visible.map((s) => {
                const Icon = TYPE_ICON[s.scan_type] ?? ScanSearch;
                return (
                  <li key={s.scan_id} className="group relative flex items-center gap-3 px-4 py-3 hover:bg-secondary/40">
                    <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg ring-1", RISK_TILE[s.risk_level ?? "LOW"])}>
                      <Icon className="size-5" />
                    </span>
                    <Link to={`/app/scans/${s.scan_id}`} className="min-w-0 flex-1 after:absolute after:inset-0">
                      <span className="block truncate text-sm font-medium">{s.target || "—"}</span>
                      <span className="block truncate text-xs text-subtle">
                        {SCAN_TYPE_LABEL[s.scan_type] ?? s.scan_type}{s.category ? ` · ${s.category.replace(/_/g, " ").toLowerCase()}` : ""}
                      </span>
                    </Link>
                    {s.risk_level && <span className="hidden sm:block"><RiskBadge level={s.risk_level} size="sm" /></span>}
                    <span className="hidden w-28 text-right text-sm text-muted-foreground md:block">
                      {parseApiDate(s.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                    <Button variant="ghost" size="icon" className="relative z-10 opacity-60 group-hover:opacity-100"
                      aria-label={`Delete report for ${s.target || s.scan_id}`} onClick={() => setPendingDelete(s)}>
                      <Trash2 className="size-4" />
                    </Button>
                    <ChevronRight className="size-4 shrink-0 text-subtle" aria-hidden />
                  </li>
                );
              })}
            </ul>
            <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
              <span>{rows.length} report{rows.length === 1 ? "" : "s"}{(history.data?.length ?? 0) >= 100 && " (most recent 100)"}</span>
              {pages > 1 && (
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" aria-label="Previous page" disabled={current === 0} onClick={() => setPage(current - 1)}><ChevronLeft className="size-4" /></Button>
                  <span>Page {current + 1} of {pages}</span>
                  <Button variant="outline" size="icon" aria-label="Next page" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}><ChevronRight className="size-4" /></Button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(o) => { if (!o) setPendingDelete(null); }}
        title="Delete this report?"
        description="The scan result will be permanently removed from your history. This can't be undone."
        confirmLabel="Delete"
        destructive
        busy={del.isPending}
        onConfirm={() => pendingDelete && del.mutate(pendingDelete.scan_id)}
      />
    </div>
  );
}
