import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

/** Light/dark switch: sun and moon in a pill, the active mode highlighted. */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const dark = theme === "dark";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" role="switch" aria-checked={dark} aria-label="Dark mode" onClick={toggle}
          className={cn("relative inline-flex h-9 w-[4.25rem] items-center rounded-full border bg-background-2/80 p-1 backdrop-blur transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", className)}>
          <span aria-hidden className={cn("absolute top-1 size-7 rounded-full bg-primary shadow-glow transition-transform duration-200", dark ? "translate-x-8" : "translate-x-0")} />
          <Sun aria-hidden className={cn("relative z-10 ml-1.5 size-4 transition-colors", dark ? "text-muted-foreground" : "text-primary-foreground")} />
          <Moon aria-hidden className={cn("relative z-10 ml-auto mr-1.5 size-4 transition-colors", dark ? "text-primary-foreground" : "text-muted-foreground")} />
        </button>
      </TooltipTrigger>
      <TooltipContent>{dark ? "Switch to light mode" : "Switch to dark mode"}</TooltipContent>
    </Tooltip>
  );
}
