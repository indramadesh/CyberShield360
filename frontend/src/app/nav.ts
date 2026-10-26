import {
  LayoutDashboard, ScanSearch, ShieldCheck, Siren, Newspaper, GraduationCap, FileText,
  LifeBuoy, Settings, ShieldEllipsis, CalendarClock, Scale, ListChecks,
} from "lucide-react";
import type { FeatureKey } from "@/types";

export interface NavItem {
  label: string;
  to: string;
  icon: typeof LayoutDashboard;
  feature?: FeatureKey;
  adminOnly?: boolean;
  end?: boolean;
  /** Extra path prefixes that should mark this item active. */
  match?: string[];
}

/** Every link points to a route that actually exists — no dead links. */
export const NAV_MAIN: NavItem[] = [
  { label: "Dashboard", to: "/app", icon: LayoutDashboard, end: true },
  { label: "Scan & Analyze", to: "/app/scan", icon: ScanSearch, match: ["/app/scans"] },
  { label: "Browser Protection", to: "/browser-protection", icon: ShieldCheck },
  { label: "Today's Updates", to: "/app/updates", icon: CalendarClock, feature: "cyber_news" },
  { label: "Live Alerts", to: "/app/alerts", icon: Siren, feature: "cyber_news" },
  { label: "News & Advisories", to: "/app/news", icon: Newspaper, feature: "cyber_news" },
  { label: "Cyber Law Tracker", to: "/app/law", icon: Scale, feature: "cyber_law" },
  { label: "Learning Hub", to: "/app/learn", icon: GraduationCap, feature: "awareness" },
  { label: "Daily Quiz", to: "/app/quiz", icon: ListChecks, feature: "awareness" },
  { label: "My Reports", to: "/app/reports", icon: FileText },
  { label: "Settings", to: "/app/settings", icon: Settings },
];

export const NAV_BOTTOM: NavItem[] = [
  { label: "I was scammed", to: "/app/incident", icon: LifeBuoy, feature: "incident_response" },
  { label: "Admin", to: "/app/admin", icon: ShieldEllipsis, adminOnly: true },
];

export function sectionTitle(pathname: string): string {
  const all = [...NAV_MAIN, ...NAV_BOTTOM];
  if (pathname === "/app") return "Dashboard";
  if (pathname.startsWith("/app/scans/")) return "Scan report";
  const hit = all.find((n) => n.to !== "/app" && pathname.startsWith(n.to));
  return hit?.label ?? "CyberShield360";
}
