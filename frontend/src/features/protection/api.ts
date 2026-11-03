import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/services/api";

export type Classification = "SCAM" | "PHISHING" | "SUSPICIOUS" | "SPAM" | "PROMOTIONAL" | "LIKELY_LEGITIMATE" | "UNKNOWN";
export type MsgRisk = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";
export type SourceKind = "android_notifications" | "gmail" | "outlook" | "browser_extension" | "manual";

export interface Source {
  id: string; kind: SourceKind; label: string; account: string; status: string; display_state: string;
  permission_state: string; scope: { apps?: string[]; folders?: string[] };
  last_sync_at: string | null; last_seen_at: string | null; last_error: string | null;
  events_analyzed: number; connected_at: string | null;
}
export interface Alert { id: string; event_id: string; level: MsgRisk; title: string; status: string; suppressed_reason: string | null; created_at: string }
export interface Item {
  id: string; source_id: string | null; source_type: string; source_provider: string; source_application: string;
  received_at: string | null; analyzed_at: string; sender: string; sender_domain: string; subject: string; preview: string;
  classification: Classification; categories: Classification[]; risk_level: MsgRisk; risk_score: number;
  confidence: number; threat_category: string; completeness: string;
}
export interface Evidence { indicator: string; summary: string; weight: number; source: string; confidence: number; detail?: Record<string, unknown> }
export interface ItemReport extends Item {
  evidence: Evidence[]; urls: { url: string; checked: boolean }[];
  attachments: { filename: string; mime_type?: string; size?: number }[];
  authentication: Record<string, string>; limitations: string[]; recommendations: string[];
  engine_version: string; expires_at: string | null; source: Source | null;
  feedback: { verdict: string; suggested_classification: string | null } | null;
}
export interface Prefs {
  paused: boolean; store_previews: boolean; retention_days: number; alert_critical: boolean; alert_high: boolean;
  alert_medium: boolean; quiet_start: string | null; quiet_end: string | null; timezone: string; max_alerts_per_hour: number;
}
export interface Capabilities {
  connectors: Record<string, { available: boolean; note: string | null; read_only?: boolean; scopes?: string[] }>;
  not_possible: string[]; disclosure_version: string;
}
export interface Overview {
  paused: boolean; sources: Source[]; last_sync_at: string | null; recent_alerts: Alert[];
  counts: { emails_analyzed: number; messages_analyzed: number; threats: number; suspicious: number; unread_alerts: number };
}

const P = "/msgintel";
export const KEYS = { all: ["msgintel"] as const };

export const useCapabilities = () => useQuery({ queryKey: [...KEYS.all, "caps"], queryFn: () => apiFetch<Capabilities>(`${P}/capabilities`), staleTime: 300_000 });
export const useOverview = () => useQuery({ queryKey: [...KEYS.all, "overview"], queryFn: () => apiFetch<Overview>(`${P}/overview`), refetchInterval: 60_000 });
export const useSources = () => useQuery({ queryKey: [...KEYS.all, "sources"], queryFn: () => apiFetch<Source[]>(`${P}/sources`) });
export const usePrefs = () => useQuery({ queryKey: [...KEYS.all, "prefs"], queryFn: () => apiFetch<Prefs>(`${P}/settings`) });
export const useItem = (id: string | undefined) => useQuery({
  queryKey: [...KEYS.all, "item", id], queryFn: () => apiFetch<ItemReport>(`${P}/events/${id}`), enabled: Boolean(id),
});

export interface ItemFilters { classification?: string; source_id?: string; since?: string; until?: string; page: number }
export function useItems(f: ItemFilters) {
  const q = new URLSearchParams();
  Object.entries(f).forEach(([k, v]) => { if (v) q.set(k, String(v)); });
  return useQuery({
    queryKey: [...KEYS.all, "items", f],
    queryFn: () => apiFetch<{ items: Item[]; total: number; has_more: boolean; page: number }>(`${P}/events?${q}`),
    placeholderData: keepPreviousData,
  });
}

/** Mutations invalidate the whole module so every panel shows the same truth. */
function useMsgMutation<V, R>(fn: (v: V) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.all }) });
}
const json = (method: string, body?: unknown): RequestInit => ({ method, body: body === undefined ? undefined : JSON.stringify(body) });

export const usePutPrefs = () => useMsgMutation((p: Partial<Prefs> & { clear_quiet_hours?: boolean }) => apiFetch<Prefs>(`${P}/settings`, json("PUT", p)));
export const usePatchSource = () => useMsgMutation((v: { id: string; status?: "connected" | "paused"; apps?: string[] }) =>
  apiFetch<Source>(`${P}/sources/${v.id}`, json("PATCH", { status: v.status, apps: v.apps })));
export const useDisconnect = () => useMsgMutation((v: { id: string; deleteHistory: boolean }) =>
  apiFetch<{ note: string; events_deleted: number }>(`${P}/sources/${v.id}?delete_history=${v.deleteHistory}`, json("DELETE")));
export const usePairing = () => useMsgMutation((kind: "android_notifications" | "browser_extension") =>
  apiFetch<{ code: string; expires_in_seconds: number }>(`${P}/pairing`, json("POST", { kind, consent: true })));
export const useConnectMail = () => useMutation({ mutationFn: (provider: "gmail" | "outlook") =>
  apiFetch<{ authorize_url: string }>(`${P}/connect/${provider}`, json("POST")) });
export const useSyncNow = () => useMsgMutation((id: string) => apiFetch<{ result: Record<string, unknown> }>(`${P}/sources/${id}/sync`, json("POST")));
export const useAnalyze = () => useMsgMutation((v: { kind: "message" | "email"; content: string }) => apiFetch<ItemReport>(`${P}/analyze`, json("POST", v)));
export const useFeedback = () => useMsgMutation((v: { id: string; verdict: "correct" | "incorrect"; suggested_classification?: string }) =>
  apiFetch(`${P}/events/${v.id}/feedback`, json("POST", { verdict: v.verdict, suggested_classification: v.suggested_classification })));
export const useDeleteItem = () => useMsgMutation((id: string) => apiFetch(`${P}/events/${id}`, json("DELETE")));
export const useDeleteHistory = () => useMsgMutation((sourceId?: string) =>
  apiFetch<{ deleted: number }>(`${P}/events${sourceId ? `?source_id=${sourceId}` : ""}`, json("DELETE")));
export const useAlertStatus = () => useMsgMutation((v: { id: string; status: "seen" | "dismissed" }) =>
  apiFetch(`${P}/alerts/${v.id}`, json("PATCH", { status: v.status })));

export const CLASS_LABEL: Record<Classification, string> = {
  SCAM: "Scam", PHISHING: "Phishing", SUSPICIOUS: "Suspicious", SPAM: "Spam", PROMOTIONAL: "Promotional",
  LIKELY_LEGITIMATE: "Likely legitimate", UNKNOWN: "Unknown",
};
export const SOURCE_LABEL: Record<string, string> = {
  android_notifications: "Android notifications", gmail: "Gmail", outlook: "Outlook",
  browser_extension: "Browser extension", manual: "Checked by you",
};
export const STATE_LABEL: Record<string, string> = {
  connected: "Connected", paused: "Paused", permission_revoked: "Permission revoked", error: "Error",
  disconnected: "Disconnected", not_reporting: "Not reporting", never_reported: "Waiting for device",
  never_synced: "Waiting for first sync",
};
