import { useId } from "react";
import { cn } from "@/lib/utils";

/** CyberShield360 brand mark: an emerald shield with a check, plus wordmark. */
export function LogoMark({ className = "size-7" }: { className?: string }) {
  const id = useId();
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden fill="none">
      <defs>
        <linearGradient id={`${id}-g`} x1="4" y1="2" x2="28" y2="30" gradientUnits="userSpaceOnUse">
          <stop stopColor="hsl(var(--primary-2))" />
          <stop offset="1" stopColor="hsl(var(--primary))" />
        </linearGradient>
      </defs>
      <path d="M16 2.5 5 6.6v8.1c0 6.9 4.6 12.2 11 14.8 6.4-2.6 11-7.9 11-14.8V6.6L16 2.5Z"
            fill="hsl(var(--primary) / 0.12)" stroke={`url(#${id}-g)`} strokeWidth="1.8" strokeLinejoin="round" />
      <path d="m11 16 3.4 3.4L21.5 12" stroke={`url(#${id}-g)`} strokeWidth="2.2"
            strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ className, showText = true }: { className?: string; showText?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-display font-semibold tracking-tight", className)}>
      <LogoMark />
      {showText && (
        <span className="text-[1.05rem]">
          CyberShield<span className="text-primary">360</span>
        </span>
      )}
    </span>
  );
}
