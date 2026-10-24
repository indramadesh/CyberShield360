import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Link2, MessageSquare, Image, QrCode, Globe, ArrowRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { RiskBadge } from "@/components/ui/RiskBadge";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState, LoadingRows } from "@/components/ui/states";
import { useConfig } from "@/config/useConfig";
import { useAuth } from "@/features/auth/useAuth";
import { apiFetch } from "@/services/api";
import type { FeatureKey, RiskLevel } from "@/types";

const ACTIONS: { key: FeatureKey; label: string; hint: string; to: string; icon: typeof Link2 }[] = [
  { key: "url_scanner", label: "Scan a URL", hint: "Check a suspicious link", to: "/app/scan?type=URL", icon: Link2 },
  { key: "message_scanner", label: "Scan a message", hint: "SMS, chat or email text", to: "/app/scan?type=MESSAGE", icon: MessageSquare },
  { key: "image_scanner", label: "Scan an image", hint: "Screenshots & posters", to: "/app/scan?type=IMAGE", icon: Image },
  { key: "qr_scanner", label: "Scan a QR", hint: "UPI, links and more", to: "/app/scan?type=QR", icon: QrCode },
  { key: "website_scanner", label: "Scan a website", hint: "Sandboxed analysis", to: "/app/scan?type=WEBSITE", icon: Globe },
];

interface ScanSummary {
  scan_id: string; scan_type: string; risk_level: RiskLevel | null;
  category: string | null; created_at: string;
}

export function DashboardPage() {
  const { data: config } = useConfig();
  const { user } = useAuth();
  const features = config?.features;

  const history = useQuery({
    queryKey: ["scan-history"],
    queryFn: () => apiFetch<ScanSummary[]>("/scans?limit=8"),
    enabled: Boolean(user),
  });

  return (
    <div>
      <PageHeader title={user ? "Welcome back" : "Dashboard"} description="What would you like to check?" />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ACTIONS.filter((a) => features?.[a.key] ?? false).map((a) => {
          const Icon = a.icon;
          return (
            <Link key={a.key} to={a.to}>
              <Card className="h-full transition-colors hover:border-primary">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <span className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <Icon className="size-4" />
                    </span>
                    <CardTitle className="text-base">{a.label}</CardTitle>
                  </div>
                  <CardDescription>{a.hint}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Recent scans</CardTitle></CardHeader>
          <CardContent>
            {!user ? (
              <EmptyState
                title="Sign in to keep your history"
                description="Your scans are saved to your account so you can revisit results."
                action={<Button size="sm" asChild><Link to="/login">Sign in</Link></Button>}
              />
            ) : history.isLoading ? (
              <LoadingRows />
            ) : (history.data?.length ?? 0) === 0 ? (
              <EmptyState
                title="No scans yet"
                description="Submit your first suspicious URL, message, image or QR code to begin."
                action={<Button size="sm" asChild><Link to="/app/scan">Analyze something</Link></Button>}
              />
            ) : (
              <ul>
                {history.data!.map((s, i) => (
                  <li key={s.scan_id}>
                    {i > 0 && <Separator />}
                    <div className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{s.scan_type}</Badge>
                          <span className="truncate text-sm text-muted-foreground">{s.category ?? "—"}</span>
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {s.created_at ? new Date(s.created_at).toLocaleString() : ""}
                        </div>
                      </div>
                      {s.risk_level && <RiskBadge level={s.risk_level} size="sm" />}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Cyber safety tip</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Never share an OTP or UPI PIN. Legitimate organizations will not ask for
              them over calls, SMS, or chat.
            </p>
            <Link to="/app/learn" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
              Explore the Learn module <ArrowRight className="size-4" />
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
