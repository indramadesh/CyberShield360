import { Suspense, useState } from "react";
import type { FormEvent } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Menu, LogOut, Search, Settings as SettingsIcon, FileText, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { useConfig } from "@/config/useConfig";
import { useAuth } from "@/features/auth/useAuth";
import { parseDate, useTodayUpdates } from "@/features/content/api";
import { PREFS, usePref } from "@/features/settings/prefs";
import { NAV_MAIN, NAV_BOTTOM, sectionTitle, type NavItem } from "./nav";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { RouteFallback } from "@/components/ui/states";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

function useVisible(items: NavItem[]) {
  const { data } = useConfig();
  const { user } = useAuth();
  return items.filter(
    (it) => (!it.feature || (data?.features?.[it.feature] ?? true)) && (!it.adminOnly || user?.role === "ADMIN"),
  );
}

function NavList({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const { pathname } = useLocation();
  const visible = useVisible(items);
  const isActive = (it: NavItem) =>
    it.end ? pathname === it.to
      : pathname === it.to || pathname.startsWith(it.to + "/") || (it.match ?? []).some((m) => pathname.startsWith(m));
  return (
    <ul className="space-y-1">
      {visible.map((it) => {
        const active = isActive(it);
        const Icon = it.icon;
        return (
          <li key={it.to}>
            <NavLink
              to={it.to}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                active
                  ? "bg-primary/15 font-semibold text-primary ring-1 ring-inset ring-primary/25 shadow-[0_0_24px_-8px_hsl(var(--primary)/0.6)]"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              <Icon className="size-[1.1rem] shrink-0" />
              <span className="truncate">{it.label}</span>
            </NavLink>
          </li>
        );
      })}
    </ul>
  );
}

function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-[4.5rem] items-center px-5">
        <Link to="/" onClick={onNavigate} aria-label="CyberShield360 home"><Logo /></Link>
      </div>
      <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 py-2">
        <NavList items={NAV_MAIN} onNavigate={onNavigate} />
      </nav>
      <div className="border-t px-3 py-3">
        <NavList items={NAV_BOTTOM} onNavigate={onNavigate} />
      </div>
    </div>
  );
}

/** Top-bar search: paste anything to scan it (URL auto-detected). */
function ScanSearchBar() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  function submit(e: FormEvent) {
    e.preventDefault();
    const v = q.trim();
    if (!v) return;
    navigate(`/app/scan?q=${encodeURIComponent(v)}`);
    setQ("");
  }
  return (
    <form onSubmit={submit} role="search" className="relative hidden w-full max-w-xl md:block">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-subtle" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search or paste URL, message, email…"
        aria-label="Paste content to scan"
        className="h-11 w-full rounded-xl border bg-background-2 pl-10 pr-4 text-sm placeholder:text-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
    </form>
  );
}

function AlertsBell() {
  const today = useTodayUpdates();
  const { data: config } = useConfig();
  const [badge] = usePref(PREFS.alertBadge);
  // High/critical items the sources published in the last 72 hours.
  const recent = (today.data?.critical ?? []).filter((a) => a.published_at && Date.now() - parseDate(a.published_at).getTime() < 72 * 3600_000);
  const count = badge ? recent.length : 0;
  if (!(config?.features?.cyber_news ?? false)) return null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link to="/app/updates" aria-label={count ? `Today's updates, ${count} high-severity in the last 3 days` : "Today's updates"}
          className="relative flex size-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground">
          <Bell className="size-[1.15rem]" />
          {count > 0 && (
            <span className="absolute right-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-danger text-[0.6rem] font-bold text-white">{count > 9 ? "9+" : count}</span>
          )}
        </Link>
      </TooltipTrigger>
      <TooltipContent>Today's updates</TooltipContent>
    </Tooltip>
  );
}

export function AppLayout() {
  const { user, isGuest, logout } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const name = user?.email.split("@")[0];

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-header hidden w-64 border-r bg-background-2/80 backdrop-blur lg:block">
        <SidebarBody />
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 bg-background-2 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarBody onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-header flex h-[4.5rem] items-center gap-3 border-b bg-background/85 px-4 backdrop-blur sm:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation" onClick={() => setMobileOpen(true)}>
            <Menu className="size-5" />
          </Button>
          <div className="min-w-0 lg:hidden"><span className="truncate text-sm font-medium">{sectionTitle(pathname)}</span></div>
          <ScanSearchBar />
          <div className="ml-auto flex items-center gap-1.5">
            <Button variant="ghost" size="icon" className="md:hidden" aria-label="Scan something" onClick={() => navigate("/app/scan")}>
              <Search className="size-4" />
            </Button>
            <ThemeToggle className="hidden sm:inline-flex" />
            <AlertsBell />
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="ml-1 flex items-center gap-2.5 rounded-xl py-1 pl-1 pr-2 hover:bg-secondary" aria-label="Account menu">
                    <span className="flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-primary/40 to-primary-2/20 font-display text-sm font-semibold text-primary ring-2 ring-primary/40">
                      {user.email.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="hidden text-left sm:block">
                      <span className="block max-w-[9rem] truncate text-sm font-semibold leading-tight">{name}</span>
                      <span className="block text-xs leading-tight text-subtle">{user.role === "ADMIN" ? "Administrator" : "Member"}</span>
                    </span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>{user.email}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate("/app/settings")}><SettingsIcon /> Settings</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/app/reports")}><FileText /> My reports</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => { logout(); navigate("/"); }}><LogOut /> Sign out</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex items-center gap-2">
                {isGuest && <span className="hidden rounded-md border px-2 py-1 text-xs text-muted-foreground sm:inline">Guest</span>}
                <Button size="sm" asChild><Link to="/login">Sign in</Link></Button>
              </div>
            )}
          </div>
        </header>

        <main id="main" className="mx-auto w-full max-w-[90rem] px-4 py-6 sm:px-6 sm:py-8">
          <Suspense fallback={<RouteFallback />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
