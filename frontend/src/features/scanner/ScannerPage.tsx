import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload, Loader2, ShieldCheck, Camera, Keyboard, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/PageHeader";
import { ErrorState } from "@/components/ui/states";
import { apiFetch, apiUpload, ApiClientError } from "@/services/api";
import { useConfig } from "@/config/useConfig";
import type { FeatureKey } from "@/types";
import { ScanResult } from "./ScanResult";
import { QrScanner } from "./QrScanner";
import type { ScanResult as Result, ScanType } from "./types";

interface Tab {
  type: ScanType; label: string; feature: FeatureKey;
  mode: "text" | "image" | "website" | "qr"; placeholder?: string; hint?: string;
}

const TABS: Tab[] = [
  { type: "URL", label: "URL", feature: "url_scanner", mode: "text", placeholder: "https://example.com/login", hint: "Paste a suspicious link." },
  { type: "MESSAGE", label: "Message", feature: "message_scanner", mode: "text", placeholder: "Paste a suspicious SMS or chat message…", hint: "SMS, WhatsApp, or chat text." },
  { type: "EMAIL", label: "Email", feature: "email_scanner", mode: "text", placeholder: "Paste the full email, including headers if you have them…", hint: "Headers help detect sender spoofing." },
  { type: "QR", label: "QR", feature: "qr_scanner", mode: "qr" },
  { type: "IMAGE", label: "Image", feature: "image_scanner", mode: "image" },
  { type: "WEBSITE", label: "Website", feature: "website_scanner", mode: "website", placeholder: "https://example.com", hint: "Opened safely in an isolated sandbox." },
];

export function ScannerPage() {
  const { data: config } = useConfig();
  const [params, setParams] = useSearchParams();
  const available = TABS.filter((t) => config?.features?.[t.feature] ?? true);

  const requested = (params.get("type") ?? "").toUpperCase() as ScanType;
  const initial = available.find((t) => t.type === requested)?.type ?? available[0]?.type ?? "URL";
  const [type, setType] = useState<ScanType>(initial);
  const [payload, setPayload] = useState("");
  const [fileObj, setFileObj] = useState<File | null>(null);
  const [qrMode, setQrMode] = useState<"camera" | "paste">("camera");
  const qc = useQueryClient();

  useEffect(() => {
    if (requested && available.some((t) => t.type === requested) && requested !== type) {
      setType(requested); setPayload(""); setFileObj(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requested]);

  const active = available.find((t) => t.type === type) ?? available[0];

  const scan = useMutation({
    mutationFn: (vars?: { payloadOverride?: string }) => {
      const p = vars?.payloadOverride ?? payload;
      if (active?.mode === "image") {
        if (!fileObj) throw new Error("Choose an image first.");
        const form = new FormData();
        form.append("file", fileObj);
        form.append("scan_type", "IMAGE");
        return apiUpload<Result>("/scans/upload", form);
      }
      if (active?.mode === "website") {
        return apiFetch<Result>("/scans/website", { method: "POST", body: JSON.stringify({ url: p }) });
      }
      return apiFetch<Result>("/scans", { method: "POST", body: JSON.stringify({ type, payload: p }) });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["scan-history"] }),
  });

  function changeTab(next: string) {
    const t = next as ScanType;
    setType(t); setPayload(""); setFileObj(null); scan.reset();
    setParams({ type: t }, { replace: true });
  }

  function resetScan() {
    scan.reset(); setPayload("");
  }

  const canSubmit = active?.mode === "image" ? Boolean(fileObj) : Boolean(payload.trim());

  return (
    <div>
      <PageHeader
        title="Threat analysis"
        description="Submit content to get a risk assessment with the evidence behind it. Results are an assessment, not a guarantee."
      />

      <Card>
        <CardContent className="p-5">
          <Tabs value={type} onValueChange={changeTab}>
            <TabsList>
              {available.map((t) => <TabsTrigger key={t.type} value={t.type}>{t.label}</TabsTrigger>)}
            </TabsList>
          </Tabs>

          <div className="mt-4">
            {active?.mode === "qr" ? (
              <QrPanel
                mode={qrMode}
                setMode={setQrMode}
                payload={payload}
                setPayload={setPayload}
                isPending={scan.isPending}
                hasResult={scan.isSuccess}
                onDecoded={(value) => { setPayload(value); scan.mutate({ payloadOverride: value }); }}
                onAnalyzePaste={() => scan.mutate({})}
              />
            ) : active?.mode === "image" ? (
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-input bg-background px-4 py-8 text-center transition-colors hover:border-primary">
                <Upload className="size-6 text-muted-foreground" />
                <span className="text-sm font-medium">{fileObj ? fileObj.name : "Choose a screenshot to analyze"}</span>
                <span className="text-xs text-muted-foreground">PNG, JPEG or WebP. Analyzed for text &amp; links; not stored by default.</span>
                <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only"
                  onChange={(e) => setFileObj(e.target.files?.[0] ?? null)} aria-label="Choose an image to analyze" />
              </label>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="scan-input">Content to analyze</Label>
                <Textarea id="scan-input" placeholder={active?.placeholder}
                  value={payload} onChange={(e) => setPayload(e.target.value)} />
                {active?.hint && <p className="text-xs text-muted-foreground">{active.hint}</p>}
              </div>
            )}
          </div>

          {/* QR camera auto-submits; other modes use the Analyze button. */}
          {active?.mode !== "qr" && (
            <div className="mt-4 flex items-center gap-3">
              <Button onClick={() => scan.mutate({})} disabled={!canSubmit} loading={scan.isPending}>
                <ShieldCheck className="size-4" />
                {scan.isPending ? "Analyzing…" : "Analyze"}
              </Button>
              {scan.isPending && <span className="text-sm text-muted-foreground">Checking reputation and content…</span>}
            </div>
          )}
        </CardContent>
      </Card>

      {scan.isPending && (
        <Card className="mt-4">
          <CardContent className="flex items-center gap-3 p-5 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin text-primary" />
            Running detectors, threat-intelligence lookups and the risk engine…
          </CardContent>
        </Card>
      )}

      {scan.isError && (
        <div className="mt-4">
          <ErrorState title="Analysis could not be completed"
            message={(scan.error as ApiClientError)?.message ?? "Something went wrong."}
            onRetry={() => scan.mutate({})} />
        </div>
      )}

      {scan.isSuccess && (
        <div className="mt-6 space-y-4">
          <ScanResult result={scan.data} />
          {active?.mode === "qr" && (
            <Button variant="outline" onClick={resetScan}>
              <ScanLine className="size-4" /> Scan another QR
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function QrPanel({
  mode, setMode, payload, setPayload, isPending, hasResult, onDecoded, onAnalyzePaste,
}: {
  mode: "camera" | "paste";
  setMode: (m: "camera" | "paste") => void;
  payload: string;
  setPayload: (v: string) => void;
  isPending: boolean;
  hasResult: boolean;
  onDecoded: (value: string) => void;
  onAnalyzePaste: () => void;
}) {
  return (
    <div>
      {/* Camera vs Paste sub-mode */}
      <div className="mb-4 inline-flex gap-1 rounded-lg bg-muted p-1">
        <button onClick={() => setMode("camera")}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${mode === "camera" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}>
          <Camera className="size-4" /> Camera
        </button>
        <button onClick={() => setMode("paste")}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${mode === "paste" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}>
          <Keyboard className="size-4" /> Paste
        </button>
      </div>

      {mode === "camera" ? (
        // Mount the camera only while actively scanning (not during analysis or
        // once a result is shown) so the camera is released promptly.
        isPending || hasResult ? (
          <div className="rounded-lg border bg-muted/40 p-6 text-center text-sm text-muted-foreground">
            {isPending ? "Decoded — analyzing the QR content…" : "QR analyzed. Use “Scan another QR” below to scan again."}
          </div>
        ) : (
          <QrScanner onDecoded={onDecoded} />
        )
      ) : (
        <div className="space-y-1.5">
          <Label htmlFor="qr-input">Decoded QR text</Label>
          <Textarea id="qr-input" placeholder="upi://pay?pa=…  or a decoded link"
            value={payload} onChange={(e) => setPayload(e.target.value)} />
          <p className="text-xs text-muted-foreground">Paste the text a QR code contains, if you already have it.</p>
          <div className="pt-2">
            <Button onClick={onAnalyzePaste} disabled={!payload.trim() || isPending} loading={isPending}>
              <ShieldCheck className="size-4" /> Analyze
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
