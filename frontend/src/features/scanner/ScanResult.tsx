import { useState } from "react";
import { ChevronRight, AlertTriangle, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { RiskBadge } from "@/components/ui/RiskBadge";
import type { ScanResult as Result } from "./types";

const BAR: Record<string, string> = {
  LOW: "bg-success", SUSPICIOUS: "bg-warning", HIGH: "bg-high", CRITICAL: "bg-danger",
};

/** The ONE result component every scanner uses. Answers, in order:
 *  what happened → why → evidence → technical detail (collapsed) → what to do. */
export function ScanResult({ result }: { result: Result }) {
  const [showTech, setShowTech] = useState(false);
  const confidencePct = Math.round(result.confidence * 100);

  // Non-complete scans (website SSRF-blocked / timed out / queued) get an honest
  // status, not a risk badge — analysis failure ≠ a negative security finding.
  if (result.status !== "COMPLETE") {
    const failed = result.status === "FAILED";
    return (
      <Alert variant={failed ? "destructive" : "info"}>
        {failed ? <AlertTriangle /> : <Clock />}
        <AlertTitle>{failed ? "Analysis could not be completed" : "Analysis in progress"}</AlertTitle>
        <AlertDescription>
          {result.explanation || (failed ? "The analysis failed." : "Please check back shortly.")}
          <div className="mt-2"><Badge variant={failed ? "danger" : "info"}>{result.status}</Badge></div>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {/* Risk header: risk and confidence are shown separately (risk ≠ certainty). */}
      <Card>
        <CardContent className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <RiskBadge level={result.risk_level} />
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              Category <Badge variant="default">{result.category}</Badge>
            </div>
          </div>

          <div className="mt-4">
            <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
              <span>Confidence</span>
              <span className="font-semibold text-foreground">{confidencePct}%</span>
            </div>
            <Progress value={confidencePct} indicatorClassName={BAR[result.risk_level] ?? "bg-primary"} />
          </div>

          {result.explanation && <p className="mt-4 text-sm leading-relaxed">{result.explanation}</p>}
          {result.notes.map((n) => <p key={n} className="mt-2 text-xs text-muted-foreground">{n}</p>)}
        </CardContent>
      </Card>

      {result.evidence.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Why this was flagged</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-2.5">
              {result.evidence.map((e, i) => (
                <li key={`${e.indicator}-${i}`} className="flex items-start gap-2.5 text-sm">
                  <Badge variant="secondary" className="mt-0.5 shrink-0">{e.source}</Badge>
                  <span className="leading-relaxed">{e.summary}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {result.recommendations.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Recommended actions</CardTitle></CardHeader>
          <CardContent>
            <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed">
              {result.recommendations.map((r) => <li key={r}>{r}</li>)}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Technical details — collapsed by default (beginners vs. students). */}
      <Card>
        <CardContent className="p-5">
          <button className="flex items-center gap-1.5 text-sm font-medium text-primary"
            onClick={() => setShowTech((s) => !s)} aria-expanded={showTech}>
            <ChevronRight className={`size-4 transition-transform ${showTech ? "rotate-90" : ""}`} />
            {showTech ? "Hide" : "Show"} technical details
          </button>
          {showTech && (
            <div className="mt-3 space-y-2 text-xs text-muted-foreground">
              <div>Scan ID: {result.scan_id}</div>
              <div className="break-words">Indicators: {result.indicators.join(", ") || "none"}</div>
              {result.pii_found && Object.keys(result.pii_found).length > 0 && (
                <div>PII detected (redacted before storage): {Object.entries(result.pii_found).map(([k, v]) => `${k}×${v}`).join(", ")}</div>
              )}
              <pre className="max-w-full overflow-x-auto rounded-md bg-muted p-3 text-[11px] leading-relaxed">
{JSON.stringify(result.evidence.map((e) => ({ ...e.detail, indicator: e.indicator })), null, 2)}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
