import { forwardRef } from "react";
import { Link, type LinkProps } from "react-router-dom";
import { useAuth } from "./useAuth";

/**
 * Public-site gate: until a visitor signs up, signs in or explicitly chooses
 * "continue as guest", every link on the public pages opens the Sign Up page
 * first. The original destination is carried in `?next=` and restored afterwards.
 */
export function useGate() {
  const { user, isGuest } = useAuth();
  const open = Boolean(user) || isGuest;
  return {
    open,
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
export function GatedExternal({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  const gate = useGate();
  if (!gate.open) return <Link to={gate.to("/app")} className={className}>{children}</Link>;
  return <a href={href} target="_blank" rel="noreferrer" className={className}>{children}</a>;
}
