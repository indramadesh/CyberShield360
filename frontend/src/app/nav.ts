import {
  LayoutDashboard, Link2, MessageSquare, Mail, Image, QrCode, Globe,
  LifeBuoy, GraduationCap, Newspaper, ShieldCheck, Puzzle,
} from "lucide-react";
import type { FeatureKey } from "@/types";

export interface NavItem {
  label: string;
  to: string;
  icon: typeof LayoutDashboard;
  feature?: FeatureKey;
  adminOnly?: boolean;
  end?: boolean;
}

export interface NavGroup {
  heading: string;
  items: NavItem[];
}

/** Every link points to a route that actually exists — no dead links.
 *  Scanner links deep-link to the unified /app/scan page with a preselected tab. */
export const NAV_GROUPS: NavGroup[] = [
  {
    heading: "Overview",
    items: [
      { label: "Dashboard", to: "/app", icon: LayoutDashboard, end: true },
      { label: "Browser extension", to: "/browser-protection", icon: Puzzle },
    ],
  },
  {
    heading: "Threat analysis",
    items: [
      { label: "URL", to: "/app/scan?type=URL", icon: Link2, feature: "url_scanner" },
      { label: "Message", to: "/app/scan?type=MESSAGE", icon: MessageSquare, feature: "message_scanner" },
      { label: "Email", to: "/app/scan?type=EMAIL", icon: Mail, feature: "email_scanner" },
      { label: "Image", to: "/app/scan?type=IMAGE", icon: Image, feature: "image_scanner" },
      { label: "QR code", to: "/app/scan?type=QR", icon: QrCode, feature: "qr_scanner" },
      { label: "Website", to: "/app/scan?type=WEBSITE", icon: Globe, feature: "website_scanner" },
    ],
  },
  {
    heading: "Guidance",
    items: [
      { label: "I was scammed", to: "/app/incident", icon: LifeBuoy, feature: "incident_response" },
    ],
  },
  {
    heading: "Learning",
    items: [
      { label: "Learn", to: "/app/learn", icon: GraduationCap, feature: "awareness" },
      { label: "Intelligence", to: "/app/intel", icon: Newspaper, feature: "cyber_news" },
    ],
  },
  {
    heading: "Administration",
    items: [{ label: "Admin", to: "/app/admin", icon: ShieldCheck, adminOnly: true }],
  },
];
