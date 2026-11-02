import { createContext, forwardRef, useContext } from "react";
import type { ReactNode } from "react";
import { Link, type LinkProps } from "react-router-dom";
import { useAuth } from "./useAuth";

/**
 * Public-site gate.
 * - Normal public pages: until a visitor signs up, signs in or chooses
 *   "continue as guest", links open the Sign Up page first.
 * - The landing page is STRICT: every control except Get Started, Watch Demo
 *   and Download Extension always goes to the sign-in / sign-up page, whatever
 *   the visitor's state (guest or signed in). From there they continue.
 * The original destination travels in `?next=` and is restored afterwards.
 */
const StrictGate = createContext(false);

export function GateProvider({ strict, children }: { strict: boolean; children: ReactNode }) {
  return <StrictGate.Provider value={strict}>{children}</StrictGate.Provider>;
}

export function useGate() {
  const { user, isGuest } = useAuth();
  const strict = useContext(StrictGate);
  const open = !strict && (Boolean(user) || isGuest);
  return {
    open,
    strict,
    to: (dest: string) => (open ? dest : `/login?mode=register&next=${encodeURIComponent(dest)}`),
  };
}

/** Only same-site paths are allowed as a post-login destination. */
export function safeNext(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/login")) return "/app";
  return next;
}

export const GatedLink = forwardRef<HTMLAnchorElement, Omit<LinkProps, "to"> & { to: string }>(
  ({ to, ...props }, ref) => {
    const gate = useGate();
    return <Link ref={ref} to={gate.to(to)} {...props} />;
  },
);
GatedLink.displayName = "GatedLink";

/** External link that, while the gate is closed, goes to Sign Up instead. */
export function GatedExternal({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  const gate = useGate();
  if (!gate.open) return <Link to={gate.to("/app")} className={className}>{children}</Link>;
  return <a href={href} target="_blank" rel="noreferrer" className={className}>{children}</a>;
}
