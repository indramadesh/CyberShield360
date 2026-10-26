import { CheckCircle2, AlertTriangle, ShieldAlert, OctagonAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RiskLevel } from "@/types";

/** Risk is communicated with color + icon + text together — never color alone
 *  (accessibility + the product principle that risk ≠ certainty). Colors come
 *  from semantic design tokens, so they theme automatically. */
const MAP: Record<RiskLevel, { label: string; cls: string; Icon: typeof CheckCircle2 }> = {
  LOW: { label: "Low Risk", cls: "bg-success-soft text-success", Icon: CheckCircle2 },
  SUSPICIOUS: { label: "Suspicious", cls: "bg-warning-soft text-warning", Icon: AlertTriangle },
  HIGH: { label: "High Risk", cls: "bg-high-soft text-high", Icon: ShieldAlert },
  CRITICAL: { label: "Critical Risk", cls: "bg-danger-soft text-danger", Icon: OctagonAlert },
};

export function RiskBadge({ level, size = "md" }: { level: RiskLevel; size?: "sm" | "md" }) {
  const m = MAP[level];
  const { Icon } = m;
  return (
    <span
      role="status"
      aria-label={m.label}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md font-semibold",
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm",
        m.cls,
      )}
    >
      <Icon className={size === "sm" ? "size-3.5" : "size-4"} aria-hidden />
      {m.label}
    </span>
  );
}
