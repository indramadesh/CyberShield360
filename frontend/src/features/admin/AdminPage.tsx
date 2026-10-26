import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/states";
import { Skeleton } from "@/components/ui/skeleton";
import { MetricCard } from "@/components/ui/MetricCard";
import { ScanSearch, ShieldAlert, OctagonAlert } from "lucide-react";
import { apiFetch } from "@/services/api";
import { useAuth } from "@/features/auth/useAuth";
import { ContentOps } from "./ContentOps";

interface Analytics { total_scans: number; by_risk_level: Record<string, number>; by_category: Record<string, number>; by_type: Record<string, number> }
interface AdminConfig { features: Record<string, boolean>; thresholds: Record<string, number> }

export function AdminPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const isAdmin = user?.role === "ADMIN";
  const analytics = useQuery({ queryKey: ["admin-analytics"], queryFn: () => apiFetch<Analytics>("/admin/analytics"), enabled: isAdmin });
  const config = useQuery({ queryKey: ["admin-config"], queryFn: () => apiFetch<AdminConfig>("/admin/config"), enabled: isAdmin });

  const toggle = useMutation({
    mutationFn: (features: Record<string, boolean>) =>
      apiFetch<AdminConfig>("/admin/config", { method: "PUT", body: JSON.stringify({ features }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-config"] }); qc.invalidateQueries({ queryKey: ["config"] }); },
  });

  if (!isAdmin) {
    return <EmptyState title="Admin access required" description="Sign in with an administrator account to view this page." />;
  }

  return (
    <div>
      <PageHeader title="Admin" description="Operational overview and runtime configuration." />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <MetricCard icon={<ScanSearch />} label="Total scans" value={analytics.isLoading ? null : analytics.data?.total_scans ?? 0} />
        <MetricCard icon={<ShieldAlert />} tone="warning" label="High-risk" value={analytics.isLoading ? null : analytics.data?.by_risk_level?.HIGH ?? 0} />
        <MetricCard icon={<OctagonAlert />} tone="danger" label="Critical" value={analytics.isLoading ? null : analytics.data?.by_risk_level?.CRITICAL ?? 0} />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Feature flags</CardTitle>
          <p className="text-xs text-muted-foreground">Changes apply immediately — no redeploy.</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
            {config.isLoading && [0, 1, 2, 3].map((i) => <Skeleton key={i} className="my-1 h-6 w-full" />)}
            {config.data && Object.entries(config.data.features).map(([k, v]) => (
              <label key={k} className="flex cursor-pointer items-center gap-2.5 py-1.5 text-sm">
                <input type="checkbox" checked={v} className="size-4 accent-primary"
                  onChange={(e) => toggle.mutate({ [k]: e.target.checked })} />
                <span className={v ? "text-foreground" : "text-muted-foreground"}>{k}</span>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader><CardTitle className="text-base">Scans by category</CardTitle></CardHeader>
        <CardContent className="text-sm">
          {analytics.isLoading && <Skeleton className="h-16 w-full" />}
          {analytics.data && Object.keys(analytics.data.by_category).length === 0 && (
            <p className="text-muted-foreground">No scans recorded yet.</p>
          )}
          {analytics.data && Object.entries(analytics.data.by_category).map(([k, v], i) => (
            <div key={k}>
              {i > 0 && <Separator />}
              <div className="flex items-center justify-between py-1.5">
                <Badge variant="secondary">{k}</Badge><span className="text-muted-foreground">{v}</span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
      <ContentOps />
    </div>
  );
}
