import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "success" | "error" | "info";
interface Toast { id: number; title: string; description?: string; tone: Tone }

const Ctx = createContext<((t: Omit<Toast, "id" | "tone"> & { tone?: Tone }) => void) | null>(null);

const ICON = { success: CheckCircle2, error: AlertTriangle, info: Info };
const STYLE: Record<Tone, string> = {
  success: "border-primary/40 [&_svg.tone]:text-primary",
  error: "border-danger/45 [&_svg.tone]:text-danger",
  info: "border-info/40 [&_svg.tone]:text-info",
};

/** Minimal accessible toast system (aria-live), no external dependency. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const dismiss = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), []);
  const push = useCallback((t: Omit<Toast, "id" | "tone"> & { tone?: Tone }) => {
    const id = Date.now() + Math.random();
    setItems((xs) => [...xs.slice(-3), { id, tone: t.tone ?? "success", title: t.title, description: t.description }]);
    setTimeout(() => dismiss(id), 3800);
  }, [dismiss]);
  const value = useMemo(() => push, [push]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-toast flex w-[min(22rem,calc(100%-2rem))] flex-col gap-2">
        {items.map((t) => {
          const Icon = ICON[t.tone];
          return (
            <div key={t.id} role="status"
              className={cn("pointer-events-auto flex items-start gap-3 rounded-xl border bg-popover p-3 shadow-elev animate-in fade-in-0 slide-in-from-bottom-2", STYLE[t.tone])}>
              <Icon className="tone mt-0.5 size-4 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{t.title}</div>
                {t.description && <div className="text-xs text-muted-foreground">{t.description}</div>}
              </div>
              <button onClick={() => dismiss(t.id)} aria-label="Dismiss" className="text-muted-foreground hover:text-foreground">
                <X className="size-4" />
              </button>
            </div>
          );
        })}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(Ctx);
  // Safe no-op outside the provider (e.g. isolated component tests).
  return ctx ?? (() => {});
}
