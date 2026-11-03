import { AlertTriangle, CheckCircle2, CircleHelp, Megaphone, OctagonAlert, ShieldAlert, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { CLASS_LABEL, STATE_LABEL, type Classification, type MsgRisk } from "./api";

const CLASS_CLS: Record<Classification, string> = {
  SCAM: "bg-danger-soft text-danger", PHISHING: "bg-danger-soft text-danger",
  SUSPICIOUS: "bg-warning-soft text-warning", SPAM: "bg-secondary text-muted-foreground",
  PROMOTIONAL: "bg-info-soft text-info", LIKELY_LEGITIMATE: "bg-success-soft text-success",
  UNKNOWN: "bg-secondary text-muted-foreground",
};
const CLASS_ICON: Record<Classification, typeof CheckCircle2> = {
  SCAM: OctagonAlert, PHISHING: OctagonAlert, SUSPICIOUS: AlertTriangle, SPAM: Trash2,
  PROMOTIONAL: Megaphone, LIKELY_LEGITIMATE: CheckCircle2, UNKNOWN: CircleHelp,
};

/** Classification is shown with icon + text, never colour alone. */
export function ClassBadge({ c, size = "md" }: { c: Classification; size?: "sm" | "md" }) {
  const Icon = CLASS_ICON[c];
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md font-semibold",
      size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm", CLASS_CLS[c])}>
      <Icon className={size === "sm" ? "size-3.5" : "size-4"} aria-hidden /> {CLASS_LABEL[c]}
    </span>
  );
}

const RISK: Record<MsgRisk, { label: string; cls: string; Icon: typeof CheckCircle2 }> = {
  CRITICAL: { label: "Critical risk", cls: "text-danger", Icon: OctagonAlert },
  HIGH: { label: "High risk", cls: "text-high", Icon: ShieldAlert },
  MEDIUM: { label: "Medium risk", cls: "text-warning", Icon: AlertTriangle },
  LOW: { label: "Low risk", cls: "text-success", Icon: CheckCircle2 },
  UNKNOWN: { label: "Risk unknown", cls: "text-muted-foreground", Icon: CircleHelp },
};

export function RiskText({ level, score }: { level: MsgRisk; score?: number }) {
  const r = RISK[level];
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-semibold", r.cls)}>
      <r.Icon className="size-3.5" aria-hidden /> {r.label}{score !== undefined && level !== "UNKNOWN" ? ` · ${score}/100` : ""}
    </span>
  );
}

export function StateDot({ state }: { state: string }) {
  const good = state === "connected";
  const warn = ["paused", "never_reported", "never_synced", "not_reporting"].includes(state);
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium",
      good ? "text-success" : warn ? "text-warning" : "text-danger")}>
      <span className={cn("size-2 rounded-full", good ? "bg-success" : warn ? "bg-warning" : "bg-danger")} aria-hidden />
      {STATE_LABEL[state] ?? state}
    </span>
  );
}

export function sureLabel(c: number) {
  return c >= 0.8 ? "Very sure" : c >= 0.5 ? "Fairly sure" : "Not very sure";
}

export function when(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}
