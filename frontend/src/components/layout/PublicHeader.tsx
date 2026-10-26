import { useState } from "react";
import type { FormEvent } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { Menu, Search, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/features/auth/useAuth";
import { useGate } from "@/features/auth/gate";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

export const PUBLIC_LINKS = [
  { to: "/", label: "Home", end: true },
  { to: "/app/scan", label: "Tools" },
  { to: "/app/news", label: "News" },
  { to: "/app/learn", label: "Learn" },
  { to: "/browser-protection", label: "Extension" },
  { to: "/about", label: "About" },
];

/** Header search: paste anything and jump straight to the scanner. */
function SearchDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  function submit(e: FormEvent) {
    e.preventDefault();
    const v = q.trim();
    onOpenChange(false);
    navigate(v ? `/app/scan?q=${encodeURIComponent(v)}` : "/app/scan");
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogTitle className="font-display">Check something</DialogTitle>
        <DialogDescription>Paste a link, message or email. We'll open the scanner with it.</DialogDescription>
        <form onSubmit={submit} className="mt-4 flex gap-2" role="search">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} aria-label="Content to scan"
              placeholder="Search or paste URL, message, email…"
              className="h-11 w-full rounded-lg border bg-background-2 pl-9 pr-3 text-sm placeholder:text-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          </div>
          <Button type="submit" size="lg">Scan <ArrowRight /></Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Public site navigation. `overlay` = transparent, for use on top of artwork.
 * While the visitor hasn't signed up, signed in or chosen guest, every control
 * here except Get Started and the theme toggle opens the Sign Up page.
 */
export function PublicHeader({ overlay = false }: { overlay?: boolean }) {
  const { user } = useAuth();
  const gate = useGate();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState(false);
  const signUp = () => navigate(gate.to("/app"));
  const linkCls = ({ isActive }: { isActive: boolean }) =>
    cn("rounded-md px-3 py-2 text-sm transition-colors",
      isActive && gate.open ? "text-primary" : overlay ? "text-foreground/80 hover:text-foreground" : "text-muted-foreground hover:text-foreground");

  return (
    <header className={cn("z-header w-full", overlay ? "absolute inset-x-0 top-0" : "sticky top-0 border-b bg-background/85 backdrop-blur")}>
      <div className="mx-auto flex h-[4.5rem] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link to={gate.to("/")} aria-label="CyberShield360 home"><Logo /></Link>
        <nav aria-label="Primary" className="hidden items-center gap-1 lg:flex">
          {PUBLIC_LINKS.map((l) => <NavLink key={l.to} to={gate.to(l.to)} end={l.end} className={linkCls}>{l.label}</NavLink>)}
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button variant="ghost" size="icon" aria-label="Search or scan" onClick={() => (gate.open ? setSearch(true) : signUp())}>
            <Search className="size-[1.1rem]" />
          </Button>
          {user ? (
            <Button size="sm" asChild><Link to="/app">Dashboard</Link></Button>
          ) : (
            <Button size="sm" asChild><Link to="/login?mode=register">Get Started</Link></Button>
          )}
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu" onClick={() => (gate.open ? setOpen(true) : signUp())}>
            <Menu className="size-5" />
          </Button>
        </div>
      </div>

      <SearchDialog open={search} onOpenChange={setSearch} />
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-72 bg-background-2">
          <SheetTitle><Logo /></SheetTitle>
          <nav aria-label="Mobile" className="mt-6 flex flex-col">
            {PUBLIC_LINKS.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end} onClick={() => setOpen(false)}
                className={({ isActive }) => cn("rounded-md px-3 py-3 text-sm", isActive ? "bg-primary/10 text-primary" : "text-muted-foreground")}>
                {l.label}
              </NavLink>
            ))}
            {!user && (
              <Link to="/login" onClick={() => setOpen(false)} className="mt-2 rounded-md px-3 py-3 text-sm text-muted-foreground">Sign in</Link>
            )}
          </nav>
        </SheetContent>
      </Sheet>
    </header>
  );
}
