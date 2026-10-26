import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Loader2, Camera, Keyboard, ScanLine, Upload, Link2, MessageSquare, Mail, QrCode,
  Image as ImageIcon, RotateCcw, ChevronDown, Settings2, ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FileDrop } from "@/components/ui/FileDrop";
import { ErrorState } from "@/components/ui/states";
import { apiFetch, apiUpload, ApiClientError } from "@/services/api";
import { useConfig } from "@/config/useConfig";
import { cn } from "@/lib/utils";
import type { FeatureKey } from "@/types";
import { ScanResult } from "./ScanResult";
import { QrScanner } from "./QrScanner";
import { ScanHeroArt } from "./art";
import { PREFS, readPref } from "@/features/settings/prefs";
import type { ScanResult as Result } from "./types";

type TabType = "URL" | "MESSAGE" | "EMAIL" | "IMAGE" | "QR";
type QrMode = "camera" | "upload" | "paste";

const TABS: { type: TabType; label: string; feature: FeatureKey; icon: typeof Link2; placeholder?: string; hint?: string }[] = [
  { type: "URL", label: "URL", feature: "url_scanner", icon: Link2, placeholder: "https://example.com", hint: "Paste a suspicious link." },
  { type: "MESSAGE", label: "Message", feature: "message_scanner", icon: MessageSquare, placeholder: "Paste a suspicious SMS or chat message…", hint: "SMS, WhatsApp, or chat text." },
  { type: "EMAIL", label: "Email", feature: "email_scanner", icon: Mail, placeholder: "Paste the full email, including headers if you have them…", hint: "Headers help detect sender spoofing." },
  { type: "IMAGE", label: "File / Image", feature: "image_scanner", icon: ImageIcon },
  { type: "QR", label: "QR Code", feature: "qr_scanner", icon: QrCode },
];

/** Synthetic samples (reserved .example domains) for trying the scanner. */
const EXAMPLES: { label: string; type: TabType; value: string; qr?: boolean }[] = [
  { label: "Phishing URL", type: "URL", value: "http://secure-sbi-kyc-update.example/login?verify=account" },
  { label: "Suspicious Message", type: "MESSAGE", value: "Dear customer, your account will be BLOCKED today. Update KYC immediately: http://kyc-update.example and share the OTP sent to you." },
  { label: "Fake Offer", type: "MESSAGE", value: "Congratulations! You won a free iPhone 15. Pay Rs 99 delivery charge now to claim: http://free-gift-claim.example/pay" },
  { label: "QR Code", type: "QR", value: "upi://pay?pa=refund.desk@ybl.example&pn=Refund%20Desk&am=4999&cu=INR", qr: true },
  { label: "Email Scam", type: "EMAIL", value: "From: IT Support <helpdesk@micros0ft-support.example>\nReply-To: recover@mail.example\nSubject: Your password expires in 24 hours\n\nClick here to keep your password: http://micros0ft-support.example/keep" },
];

/** Decide what a pasted value most likely is (from the top-bar search). */
function detectType(q: string): TabType {
  const v = q.trim();
  if (/^(https?:\/\/)?[\w-]+(\.[\w-]+)+(\/\S*)?$/i.test(v) && !/\s/.test(v)) return "URL";
  if (/^(from|subject|to|reply-to):/im.test(v)) return "EMAIL";
  return "MESSAGE";
}

export function ScannerPage() {
  const { data: config } = useConfig();
  const [params, setParams] = useSearchParams();
  const available = TABS.filter((t) => config?.features?.[t.feature] ?? true);
  const websiteOn = config?.features?.website_scanner ?? true;

  const q = params.get("q") ?? "";
  const rawType = (params.get("type") ?? "").toUpperCase();
  // WEBSITE is the URL tab with the sandbox option switched on.
  const requested = (rawType === "WEBSITE" ? "URL" : rawType || (q ? detectType(q) : "")) as TabType;
  const initial = available.find((t) => t.type === requested)?.type ?? available[0]?.type ?? "URL";
  const [type, setType] = useState<TabType>(initial);
  const [payload, setPayload] = useState(q);
  const [fileObj, setFileObj] = useState<File | null>(null);
  const [qrMode, setQrMode] = useState<QrMode>("camera");
  const [sandbox, setSandbox] = useState(rawType === "WEBSITE");
  const [advanced, setAdvanced] = useState(rawType === "WEBSITE");
  const [submitted, setSubmitted] = useState<{ target: string; at: string } | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const autoRan = useRef(false);
  const qc = useQueryClient();

  useEffect(() => {
    if (requested && available.some((t) => t.type === requested) && requested !== type) {
      setType(requested); setFileObj(null);
    }
    if (q) setPayload(q);
    if (rawType === "WEBSITE") { setSandbox(true); setAdvanced(true); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requested, q, rawType]);

  const active = available.find((t) => t.type === type) ?? available[0];
  const useSandbox = type === "URL" && sandbox && websiteOn;

  const scan = useMutation({
    mutationFn: (vars?: { payloadOverride?: string }) => {
      const p = (vars?.payloadOverride ?? payload).trim();
      // Settings > "Sync scan history" off: scan without attaching it to the account.
      const opts = { anonymous: !readPref(PREFS.saveHistory) };
      const isUpload = type === "IMAGE" || (type === "QR" && qrMode === "upload" && !vars?.payloadOverride);
      setSubmitted({ target: isUpload ? fileObj?.name ?? "Uploaded image" : p, at: new Date().toISOString() });
      if (isUpload) {
        if (!fileObj) throw new Error("Choose an image first.");
        const form = new FormData();
        form.append("file", fileObj);
        form.append("scan_type", type === "QR" ? "QR" : "IMAGE");
        return apiUpload<Result>("/scans/upload", form, opts);
      }
      if (useSandbox) {
        return apiFetch<Result>("/scans/website", { method: "POST", body: JSON.stringify({ url: p }) }, opts);
      }
      return apiFetch<Result>("/scans", { method: "POST", body: JSON.stringify({ type, payload: p }) }, opts);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["scan-history"] });
      requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    },
  });

  // Quick Scan on the dashboard links here with run=1: analyze straight away.
  useEffect(() => {
    if (!autoRan.current && params.get("run") === "1" && q.trim() && type !== "IMAGE") {
      autoRan.current = true;
      if (type === "QR") setQrMode("paste");
      scan.mutate({ payloadOverride: q });
      const next = new URLSearchParams(params); next.delete("run");
      setParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, type]);

  function changeTab(t: TabType) {
    setType(t); setPayload(""); setFileObj(null); scan.reset();
    setParams({ type: t }, { replace: true });
  }

  function applyExample(ex: (typeof EXAMPLES)[number]) {
    if (!available.some((t) => t.type === ex.type)) return;
    setType(ex.type); setFileObj(null); scan.reset(); setPayload(ex.value);
    if (ex.qr) setQrMode("paste");
    setParams({ type: ex.type }, { replace: true });
  }

  function resetScan() {
    scan.reset(); setPayload(""); setFileObj(null);
  }

  const canSubmit = type === "IMAGE" ? Boolean(fileObj) : Boolean(payload.trim());
  const maxMb = config?.privacy?.max_file_size_mb ?? 10;
  const examples = EXAMPLES.filter((e) => available.some((t) => t.type === e.type));

  return (
    <div>
      <div className="relative mb-6 overflow-hidden rounded-2xl border bg-card px-5 py-6 shadow-elev sm:px-7">
        <div aria-hidden className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(ellipse_at_right,hsl(var(--primary)/0.14),transparent_70%)]" />
        <ScanHeroArt className="absolute -bottom-3 right-4 hidden h-36 w-auto sm:block" />
        <div className="relative max-w-xl">
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Scan &amp; Analyze</h1>
          <p className="mt-1 text-muted-foreground">Check any suspicious content and get a detailed, explainable analysis.</p>
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-5 shadow-elev sm:p-6">
        <div role="tablist" aria-label="Scan type" className="flex flex-wrap gap-2">
          {available.map((t) => {
            const Icon = t.icon;
            const on = t.type === type;
            return (
              <button key={t.type} role="tab" aria-selected={on} onClick={() => changeTab(t.type)}
                className={cn("inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors",
                  on ? "border-primary bg-primary text-primary-foreground shadow-glow"
                     : "bg-background-2 text-muted-foreground hover:border-primary/40 hover:text-foreground")}>
                <Icon className="size-4" /> {t.label}
              </button>
            );
          })}
        </div>

        <div className="mt-5">
          {type === "QR" ? (
            <QrPanel mode={qrMode} setMode={(m) => { setQrMode(m); scan.reset(); }}
              payload={payload} setPayload={setPayload} file={fileObj} setFile={setFileObj} maxMb={maxMb}
              isPending={scan.isPending} hasResult={scan.isSuccess}
              onDecoded={(value) => { setPayload(value); scan.mutate({ payloadOverride: value }); }}
              onAnalyze={() => scan.mutate({})} />
          ) : type === "IMAGE" ? (
            <div className="space-y-4">
              <FileDrop file={fileObj} onFile={setFileObj} maxMb={maxMb} title="Upload a screenshot or photo to analyze" />
              <AnalyzeButton disabled={!canSubmit} pending={scan.isPending} onClick={() => scan.mutate({})} />
            </div>
          ) : type === "URL" ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <label htmlFor="scan-input" className="sr-only">Content to analyze</label>
              <input id="scan-input" inputMode="url" placeholder={active?.placeholder}
                value={payload} onChange={(e) => setPayload(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && canSubmit) scan.mutate({}); }}
                className="h-12 flex-1 rounded-xl border bg-background-2 px-4 text-sm placeholder:text-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
              <AnalyzeButton disabled={!canSubmit} pending={scan.isPending} onClick={() => scan.mutate({})} />
            </div>
          ) : (
            <div>
              <label htmlFor="scan-input" className="sr-only">Content to analyze</label>
              <Textarea id="scan-input" rows={5} placeholder={active?.placeholder} className="rounded-xl"
                value={payload} onChange={(e) => setPayload(e.target.value)} />
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="text-xs text-subtle">{active?.hint}</span>
                <AnalyzeButton disabled={!canSubmit} pending={scan.isPending} onClick={() => scan.mutate({})} />
              </div>
            </div>
          )}
        </div>

        {examples.length > 0 && (
          <div className="mt-6 rounded-xl border bg-background-2 p-4">
            <div className="text-sm font-medium">Try these examples</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {examples.map((ex) => (
                <button key={ex.label} type="button" onClick={() => applyExample(ex)}
                  className="rounded-lg border bg-card px-3.5 py-2 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary">
                  {ex.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-subtle">Samples use made-up data on reserved .example domains.</p>
          </div>
        )}

        <div className="mt-4 rounded-xl border bg-background-2">
          <button type="button" onClick={() => setAdvanced((a) => !a)} aria-expanded={advanced} aria-controls="adv-opts"
            className="flex w-full items-center justify-between px-4 py-3 text-sm">
            <span className="inline-flex items-center gap-2 text-muted-foreground"><Settings2 className="size-4" /> Advanced Options</span>
            <ChevronDown className={cn("size-4 text-subtle transition-transform", advanced && "rotate-180")} />
          </button>
          {advanced && (
            <div id="adv-opts" className="space-y-3 border-t px-4 py-4 text-sm">
              <label className={cn("flex items-start gap-3", (!websiteOn || type !== "URL") && "opacity-50")}>
                <input type="checkbox" className="mt-0.5 size-4 accent-primary" checked={useSandbox}
                  disabled={!websiteOn || type !== "URL"} onChange={(e) => setSandbox(e.target.checked)} />
                <span>
                  <span className="block font-medium">Deep website analysis</span>
                  <span className="text-muted-foreground">
                    Opens the page in an isolated sandbox to inspect forms, redirects and the final destination. Slower.
                    {type !== "URL" && " Available for URLs."}
                  </span>
                </span>
              </label>
              <p className="text-xs text-subtle">Personal data (phone numbers, emails, OTPs, card numbers) is redacted before anything is stored.</p>
            </div>
          )}
        </div>
      </div>

      <div ref={resultRef} className="scroll-mt-24" aria-live="polite">
        {scan.isPending && (
          <div className="mt-4 flex items-center gap-3 rounded-2xl border bg-card p-5 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin text-primary" />
            Running detectors, threat-intelligence lookups and the risk engine…
          </div>
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
            <ScanResult result={scan.data} target={submitted?.target} scannedAt={submitted?.at} />
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={resetScan}>
                <ScanLine className="size-4" /> {type === "QR" ? "Scan another QR" : "Scan something else"}
              </Button>
              {(payload || fileObj) && <Button variant="ghost" onClick={resetScan}><RotateCcw /> Clear</Button>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AnalyzeButton({ disabled, pending, onClick }: { disabled: boolean; pending: boolean; onClick: () => void }) {
  return (
    <Button size="lg" className="h-12 px-7" onClick={onClick} disabled={disabled} loading={pending}>
      {pending ? "Analyzing…" : <>Analyze <ArrowRight /></>}
    </Button>
  );
}

function QrPanel({
  mode, setMode, payload, setPayload, file, setFile, maxMb, isPending, hasResult, onDecoded, onAnalyze,
}: {
  mode: QrMode;
  setMode: (m: QrMode) => void;
  payload: string;
  setPayload: (v: string) => void;
  file: File | null;
  setFile: (f: File | null) => void;
  maxMb: number;
  isPending: boolean;
  hasResult: boolean;
  onDecoded: (value: string) => void;
  onAnalyze: () => void;
}) {
  const MODES = [
    { key: "camera" as const, label: "Camera", icon: Camera },
    { key: "upload" as const, label: "Upload photo", icon: Upload },
    { key: "paste" as const, label: "Paste text", icon: Keyboard },
  ];
  return (
    <div>
      <div role="radiogroup" aria-label="How to provide the QR code" className="mb-4 inline-flex flex-wrap gap-1 rounded-lg border bg-background-2 p-1">
        {MODES.map((m) => {
          const Icon = m.icon;
          return (
            <button key={m.key} role="radio" aria-checked={mode === m.key} onClick={() => setMode(m.key)}
              className={cn("inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                mode === m.key ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground")}>
              <Icon className="size-4" /> {m.label}
            </button>
          );
        })}
      </div>

      {mode === "camera" ? (
        // Mount the camera only while actively scanning (not during analysis or
        // once a result is shown) so the camera is released promptly.
        isPending || hasResult ? (
          <div className="rounded-xl border bg-background-2 p-6 text-center text-sm text-muted-foreground">
            {isPending ? "Decoded — analyzing the QR content…" : "QR analyzed. Use “Scan another QR” below to scan again."}
            {payload && <div className="mt-3 break-all rounded-md border bg-card px-3 py-2 text-left font-mono text-xs text-foreground">Decoded: {payload}</div>}
          </div>
        ) : (
          <QrScanner onDecoded={onDecoded} />
        )
      ) : mode === "upload" ? (
        <div className="space-y-4">
          <FileDrop file={file} onFile={setFile} maxMb={maxMb} title="Upload a photo or screenshot of the QR code" />
          <AnalyzeButton disabled={!file || isPending} pending={isPending} onClick={onAnalyze} />
        </div>
      ) : (
        <div className="space-y-2">
          <label htmlFor="qr-input" className="text-sm font-medium">Decoded QR text</label>
          <Textarea id="qr-input" placeholder="upi://pay?pa=…  or a decoded link" className="rounded-xl"
            value={payload} onChange={(e) => setPayload(e.target.value)} />
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-subtle">Paste the text a QR code contains, if you already have it.</p>
            <AnalyzeButton disabled={!payload.trim() || isPending} pending={isPending} onClick={onAnalyze} />
          </div>
        </div>
      )}
    </div>
  );
}
