import { useEffect, useState } from "react";
import { GatedLink } from "@/features/auth/gate";
import { ClipboardPaste, ScanSearch, ShieldAlert, ListChecks, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** "Watch Demo": a guided walkthrough of the real flow, drawn in HTML (no video exists). */
const STEPS = [
  {
    icon: ClipboardPaste, title: "Paste what looks suspicious",
    text: "A link, an SMS, an email, a screenshot or a QR code.",
    screen: (
      <div className="space-y-2">
        <div className="flex gap-1.5 text-[0.65rem]">
          {["URL", "Message", "Email", "File / Image", "QR Code"].map((t, i) => (
            <span key={t} className={cn("rounded-md border px-2 py-1", i === 1 ? "border-primary/50 bg-primary/15 text-primary" : "text-muted-foreground")}>{t}</span>
          ))}
        </div>
        <div className="rounded-lg border bg-background-2 p-3 text-xs text-muted-foreground">
          Dear customer, your account will be BLOCKED today. Update KYC: http://kyc-update.example
        </div>
      </div>
    ),
  },
  {
    icon: ScanSearch, title: "We analyze it",
    text: "Rules, machine-learning signals and threat-intelligence lookups run together.",
    screen: (
      <div className="space-y-2 text-xs">
        {["Checking links and domains", "Looking for urgency and OTP requests", "Querying threat intelligence"].map((t, i) => (
          <div key={t} className="flex items-center gap-2 rounded-lg border bg-background-2 px-3 py-2">
            <span className={cn("size-2 rounded-full", i < 2 ? "bg-primary" : "animate-pulse bg-warning")} /> {t}
          </div>
        ))}
      </div>
    ),
  },
  {
    icon: ShieldAlert, title: "See the risk — and why",
    text: "A risk score, a separate confidence level and every indicator found.",
    screen: (
      <div className="rounded-lg border border-danger/40 bg-danger-soft/50 p-3 text-xs">
        <div className="flex items-center gap-2 font-display text-base font-semibold text-danger"><ShieldAlert className="size-4" /> High Risk</div>
        <div className="mt-1 text-muted-foreground">Risk score 82/100 · confidence 90% · synthetic example</div>
        <div className="mt-2 flex flex-wrap gap-1">
          {["Urgency", "Fake KYC", "Suspicious link"].map((t) => <span key={t} className="rounded border border-danger/40 px-1.5 py-0.5 text-danger">{t}</span>)}
        </div>
      </div>
    ),
  },
  {
    icon: ListChecks, title: "Know exactly what to do",
    text: "Clear next steps — and a recovery guide if something already happened.",
    screen: (
      <ol className="space-y-1.5 text-xs">
        {["Don't click the link or share any OTP", "Open your bank's official app yourself", "Already paid? Call 1930 immediately"].map((t, i) => (
          <li key={t} className="flex items-center gap-2 rounded-lg border bg-background-2 px-3 py-2">
            <span className="flex size-5 items-center justify-center rounded-full bg-primary/15 text-[0.65rem] font-semibold text-primary">{i + 1}</span>{t}
          </li>
        ))}
      </ol>
    ),
  },
];

const reduced = () => typeof window !== "undefined" &&
  (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || document.documentElement.classList.contains("reduce-motion"));

export function DemoDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(true);

  useEffect(() => { if (open) { setStep(0); setPlaying(!reduced()); } }, [open]);
  useEffect(() => {
    if (!open || !playing) return;
    const t = setTimeout(() => setStep((s) => (s + 1) % STEPS.length), 4200);
    return () => clearTimeout(t);
  }, [open, playing, step]);

  const s = STEPS[step];
  const Icon = s.icon;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogTitle className="font-display text-xl">How CyberShield360 works</DialogTitle>
        <DialogDescription>A 4-step walkthrough. Examples use synthetic data.</DialogDescription>

        <div className="mt-5 rounded-xl border bg-card p-5" aria-live="polite">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary/12 text-primary ring-1 ring-primary/30"><Icon className="size-5" /></span>
            <div>
              <div className="text-xs text-subtle">Step {step + 1} of {STEPS.length}</div>
              <div className="font-display text-lg font-semibold">{s.title}</div>
            </div>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{s.text}</p>
          <div className="mt-4">{s.screen}</div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex gap-1.5" role="tablist" aria-label="Steps">
            {STEPS.map((x, i) => (
              <button key={x.title} role="tab" aria-selected={i === step} aria-label={`Step ${i + 1}`} onClick={() => setStep(i)}
                className={cn("h-1.5 rounded-full transition-all", i === step ? "w-8 bg-primary" : "w-3 bg-border hover:bg-primary/50")} />
            ))}
          </div>
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" aria-label="Previous step" onClick={() => setStep((step + STEPS.length - 1) % STEPS.length)}><ChevronLeft className="size-4" /></Button>
            <Button size="icon" variant="ghost" aria-label={playing ? "Pause" : "Play"} onClick={() => setPlaying(!playing)}>
              {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
            </Button>
            <Button size="icon" variant="ghost" aria-label="Next step" onClick={() => setStep((step + 1) % STEPS.length)}><ChevronRight className="size-4" /></Button>
            <Button size="sm" className="ml-2" asChild><GatedLink to="/app/scan" onClick={() => onOpenChange(false)}>Try it now</GatedLink></Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
