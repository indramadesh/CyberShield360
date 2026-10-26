import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/services/api";
import { useAuth } from "@/features/auth/useAuth";
import type { RiskLevel } from "@/types";

export interface ScanSummary {
  scan_id: string;
  scan_type: string;
  risk_level: RiskLevel | null;
  risk_score: number | null;
  category: string | null;
  /** Redacted, query-stripped summary of what was scanned. */
  target: string;
  created_at: string;
}

export const SCAN_TYPE_LABEL: Record<string, string> = {
  URL: "Link", MESSAGE: "Message", EMAIL: "Email", IMAGE: "Image", QR: "QR code", WEBSITE: "Website",
};

/** The signed-in user's most recent scans (the API caps this at 100). */
export function useScanHistory() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["scan-history", user?.id],
    queryFn: () => apiFetch<ScanSummary[]>("/scans?limit=100"),
    enabled: Boolean(user),
  });
}

/** The API emits naive UTC ISO strings (no offset); treat them as UTC. */
export function parseApiDate(iso: string): Date {
  return new Date(/(Z|[+-]\d\d:?\d\d)$/i.test(iso) ? iso : `${iso}Z`);
}

/** Scans per day for the last `days` days, oldest first, from real history. */
export function dailyCounts(scans: ScanSummary[], days = 7, now = new Date()) {
  const out: { label: string; value: number; key: string }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    out.push({ key: d.toDateString(), label: d.toLocaleDateString(undefined, { weekday: "short" }), value: 0 });
  }
  for (const s of scans) {
    if (!s.created_at) continue;
    const hit = out.find((o) => o.key === parseApiDate(s.created_at).toDateString());
    if (hit) hit.value++;
  }
  return out.map(({ label, value }) => ({ label, value }));
}

export function isThreat(level: RiskLevel | null) {
  return level === "HIGH" || level === "CRITICAL";
}

export function formatWhen(iso: string) {
  if (!iso) return "";
  const d = parseApiDate(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h ago`;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}
