import { useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { Menu, Sun, Moon, LogOut, User, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/useTheme";
import { useConfig } from "@/config/useConfig";
import { useAuth } from "@/features/auth/useAuth";
import { NAV_GROUPS, type NavItem } from "./nav";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

function BrandMark() {
  return (
    <div className="flex items-center gap-2 font-semibold">
      <span className="flex size-7 items-center justify-center rounded-md bg-primary/15 text-primary">
        <Shield className="size-4" />
      </span>
      <span className="truncate">CyberShield 360</span>
    </div>
  );
}

function useVisibleGroups() {
  const { data } = useConfig();
  const { user } = useAuth();
  const features = data?.features;
  return NAV_GROUPS
    .map((g) => ({
      ...g,
      items: g.items.filter(
        (it) =>
          (!it.feature || (features?.[it.feature] ?? true)) &&
          (!it.adminOnly || user?.role === "ADMIN"),
      ),
    }))
    .filter((g) => g.items.length > 0);
}

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { pathname, search } = useLocation();
  const groups = useVisibleGroups();
  const currentHref = pathname + search;

  const isActive = (it: NavItem) => {
    if (it.end) return pathname === "/app";
    if (it.to.includes("?")) return currentHref === it.to; // scanner tab deep-links
    return pathname === it.to || pathname.startsWith(it.to + "/");
  };

  return (
    <nav className="flex flex-col gap-5 py-4">
      {groups.map((g) => (
        <div key={g.heading}>
          <div className="px-3 pb-1.5 text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">
            {g.heading}
          </div>
          <ul className="space-y-0.5 px-2">
            {g.items.map((it) => {
              const active = isActive(it);
              const Icon = it.icon;
              return (
                <li key={it.to}>
                  <NavLink
                    to={it.to}
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                      active
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground",
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    {it.label}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function sectionTitle(pathname: string): string {
  if (pathname === "/app") return "Dashboard";
  if (pathname.startsWith("/app/scan")) return "Threat analysis";
  if (pathname.startsWith("/app/incident")) return "Incident guidance";
  if (pathname.startsWith("/app/learn")) return "Learn";
  if (pathname.startsWith("/app/intel")) return "Intelligence";
  if (pathname.startsWith("/app/admin")) return "Admin";
  return "CyberShield 360";
}

export function AppLayout() {
  const { theme, toggle } = useTheme();
  const { user, isGuest, logout } = useAuth();
  const { pathname } = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-full">
      {/* Fixed desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r bg-card lg:block">
        <div className="flex h-14 items-center border-b px-4">
          <Link to="/"><BrandMark /></Link>
        </div>
        <div className="h-[calc(100%-3.5rem)] overflow-y-auto">
          <SidebarNav />
        </div>
      </aside>

      {/* Mobile drawer */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="p-0">
          <div className="flex h-14 items-center border-b px-4">
            <SheetTitle><BrandMark /></SheetTitle>
          </div>
          <div className="overflow-y-auto">
            <SidebarNav onNavigate={() => setMobileOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>

      <div className="lg:pl-64">
        {/* Header */}
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b bg-background/90 px-4 backdrop-blur">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu"
              onClick={() => setMobileOpen(true)}>
              <Menu className="size-5" />
            </Button>
            <div className="text-sm text-muted-foreground">
              <span className="hidden sm:inline">CyberShield 360 / </span>
              <span className="font-medium text-foreground">{sectionTitle(pathname)}</span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" aria-label="Toggle theme" onClick={toggle}>
              {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </Button>
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Account menu">
                    <span className="flex size-7 items-center justify-center rounded-full bg-primary/15 text-primary text-xs font-semibold">
                      {user.email.slice(0, 1).toUpperCase()}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>{user.email}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem disabled><User className="size-4" /> {user.role}</DropdownMenuItem>
                  <DropdownMenuItem onClick={logout}><LogOut className="size-4" /> Logout</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex items-center gap-2">
                {isGuest && (
                  <span className="hidden rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground sm:inline">Guest</span>
                )}
                <Button variant="outline" size="sm" asChild>
                  <Link to="/login">Sign in</Link>
                </Button>
              </div>
            )}
          </div>
        </header>

        <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
