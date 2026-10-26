import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tone = "primary" | "danger" | "warning" | "info";

const TONE: Record<Tone, string> = {
  primary: "bg-primary/12 text-primary ring-primary/30 shadow-[0_0_22px_-6px_hsl(var(--primary)/0.55)]",
  danger: "bg-danger-soft text-danger ring-danger/30 shadow-[0_0_22px_-6px_hsl(var(--danger)/0.55)]",
  warning: "bg-warning-soft text-warning ring-warning/30 shadow-[0_0_22px_-6px_hsl(var(--warning)/0.55)]",
  info: "bg-info-soft text-info ring-info/30 shadow-[0_0_22px_-6px_hsl(var(--info)/0.55)]",
};

/** A single real metric. Pass `value={null}` while loading to show a skeleton. */
export function MetricCard({
  icon, label, value, hint, tone = "primary", hintTone,
}: {
  icon: ReactNode; label: string; value: number | string | null; hint?: string; tone?: Tone;
  /** Colour the hint (e.g. a week-over-week change). */
  hintTone?: "up" | "down" | "muted";
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border bg-card p-4 shadow-elev">
      <span className={cn("flex size-12 shrink-0 items-center justify-center rounded-xl ring-1 [&_svg]:size-[1.35rem]", TONE[tone])}>
        {icon}
      </span>
      <div className="min-w-0">
        {value === null ? (
          <div className="h-8 w-12 animate-pulse rounded bg-muted" />
        ) : (
          <div className="font-display text-[1.75rem] font-bold leading-none tabular-nums">{value}</div>
        )}
        <div className="mt-1 truncate text-sm text-muted-foreground">{label}</div>
        {hint && (
          <div className={cn("truncate text-xs",
            hintTone === "up" ? "text-primary" : hintTone === "down" ? "text-danger" : "text-subtle")}>{hint}</div>
        )}
      </div>
    </div>
  );
}
