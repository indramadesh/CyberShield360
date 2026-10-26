import type { RiskLevel } from "@/types";

const TONE: Record<RiskLevel, string> = {
  LOW: "hsl(var(--success))",
  SUSPICIOUS: "hsl(var(--warning))",
  HIGH: "hsl(var(--high))",
  CRITICAL: "hsl(var(--danger))",
};

/** Circular risk-score gauge (0–100). Risk only — confidence is shown separately. */
export function RiskGauge({ score, level, size = 132 }: { score: number; level: RiskLevel; size?: number }) {
  const s = Math.max(0, Math.min(100, Math.round(score)));
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}
         role="img" aria-label={`Risk score ${s} out of 100`}>
      <svg viewBox="0 0 120 120" className="size-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="hsl(var(--border))" strokeWidth="10" />
        <circle cx="60" cy="60" r={r} fill="none" stroke={TONE[level]} strokeWidth="10"
                strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - s / 100)}
                style={{ transition: "stroke-dashoffset var(--dur-slow) ease-out" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-3xl font-bold leading-none tabular-nums">{s}</span>
        <span className="mt-1 text-[0.7rem] uppercase tracking-wider text-muted-foreground">risk / 100</span>
      </div>
    </div>
  );
}
