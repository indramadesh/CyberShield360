import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorState, SkeletonCard } from "@/components/ui/states";
import { apiFetch, ApiClientError } from "@/services/api";
import { ScanResult } from "./ScanResult";
import { parseApiDate } from "./history";
import type { ScanResult as Result } from "./types";

/** A saved scan, opened from history or a copied link. */
export function ScanReportPage() {
  const { scanId = "" } = useParams();
  const scan = useQuery({
    queryKey: ["scan", scanId],
    queryFn: () => apiFetch<Result>(`/scans/${encodeURIComponent(scanId)}`),
    retry: false,
  });

  return (
    <div>
      <Button variant="ghost" size="sm" className="-ml-2 mb-4" asChild>
        <Link to="/app/reports"><ArrowLeft /> My reports</Link>
      </Button>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Scan report</h1>
        {scan.data?.created_at && (
          <p className="mt-1 text-sm text-muted-foreground">
            Scanned {parseApiDate(scan.data.created_at).toLocaleString()}
          </p>
        )}
      </div>

      {scan.isLoading ? (
        <div className="space-y-4"><SkeletonCard /><SkeletonCard /></div>
      ) : scan.isError ? (
        <ErrorState
          title={(scan.error as ApiClientError)?.code === "NOT_FOUND" ? "Report not found" : "Couldn't load this report"}
          message="It may have been deleted, or it belongs to another account. Sign in with the account that ran the scan."
          onRetry={() => scan.refetch()}
        />
      ) : scan.data ? (
        <ScanResult result={{ ...scan.data, recommendations: scan.data.recommendations ?? [], notes: scan.data.notes ?? [] }} />
      ) : null}
    </div>
  );
}
