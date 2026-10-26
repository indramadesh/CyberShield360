import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ShieldCheck, Bell, RefreshCw, Moon, Activity, UserRound, Lock, LifeBuoy, Info, ChevronRight,
  LogOut, ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "@/hooks/useTheme";
import { useConfig } from "@/config/useConfig";
import { useAuth } from "@/features/auth/useAuth";
import { cn } from "@/lib/utils";
import { PREFS, usePref } from "./prefs";

const REDUCE = "cs360-reduce-motion";
const readReduce = () => { try { return localStorage.getItem(REDUCE) === "1"; } catch { return false; } };

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
      className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        checked ? "bg-primary shadow-glow" : "bg-secondary ring-1 ring-border")}>
      <span className={cn("absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow transition-transform", checked ? "translate-x-5" : "translate-x-0")} />
    </button>
  );
}

function Row({ icon, title, hint, children }: { icon: ReactNode; title: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-4 px-5 py-4">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20 [&_svg]:size-5">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{title}</div>
        {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      </div>
      {children}
    </div>
  );
}

/** Link row that expands in place (or navigates when `to` is set). */
function LinkRow({ icon, title, to, open, onToggle, children }: {
  icon: ReactNode; title: string; to?: string; open?: boolean; onToggle?: () => void; children?: ReactNode;
}) {
  const inner = (
    <>
      <span className="text-muted-foreground [&_svg]:size-[1.1rem]">{icon}</span>
      <span className="flex-1 text-sm font-medium">{title}</span>
      <ChevronRight className={cn("size-4 text-subtle transition-transform", open && "rotate-90")} aria-hidden />
    </>
  );
  return (
    <div>
      {to ? (
        <Link to={to} className="flex items-center gap-3 px-5 py-3.5 hover:bg-secondary/50">{inner}</Link>
      ) : (
        <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-3 px-5 py-3.5 text-left hover:bg-secondary/50">{inner}</button>
      )}
      {open && children && <div className="border-t bg-background-2/60 px-5 py-4 text-sm">{children}</div>}
    </div>
  );
}

function KV({ k, v }: { k: string; v: ReactNode }) {
  return <div className="flex items-center justify-between gap-3 py-1.5"><span className="text-muted-foreground">{k}</span><span className="text-right">{v}</span></div>;
}

export function SettingsPage() {
  const { user, isGuest, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const { data: config } = useConfig();
  const navigate = useNavigate();
  const [reduce, setReduce] = useState(readReduce);
  const [saveHistory, setSaveHistory] = usePref(PREFS.saveHistory);
  const [alertBadge, setAlertBadge] = usePref(PREFS.alertBadge);
  const [open, setOpen] = useState<string | null>(null);
  const toggle = (k: string) => setOpen((o) => (o === k ? null : k));

  useEffect(() => {
    document.documentElement.classList.toggle("reduce-motion", reduce);
    try { localStorage.setItem(REDUCE, reduce ? "1" : "0"); } catch { /* ignore */ }
  }, [reduce]);

  const privacy = config?.privacy;

  return (
    <div className="max-w-3xl">
      <div className="mb-5">
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Settings</h1>
        <p className="mt-1 text-muted-foreground">Manage your preferences and privacy.</p>
      </div>

      <div className="divide-y rounded-2xl border bg-card shadow-elev">
        <Row icon={<ShieldCheck />} title="Real-time Protection" hint="Block malicious websites automatically — switched on and off in the browser extension.">
          <Button variant="outline" size="sm" asChild><Link to="/browser-protection">Extension <ChevronRight /></Link></Button>
        </Row>
        <Row icon={<Bell />} title="Show Notifications" hint="Show the alert count for new threats and updates on the bell.">
          <Switch checked={alertBadge} onChange={setAlertBadge} label="Show notifications" />
        </Row>
        <Row icon={<RefreshCw />} title="Sync Scan History"
          hint={user ? "Save scans to your account so they're available on any device. When off, new scans aren't saved." : "Sign in to keep your scan history across devices."}>
          <Switch checked={Boolean(user) && saveHistory} onChange={(v) => user && setSaveHistory(v)} label="Sync scan history" />
        </Row>
        <Row icon={<Moon />} title="Dark Mode" hint="Use the dark theme. Light is the default.">
          <Switch checked={theme === "dark"} onChange={(v) => setTheme(v ? "dark" : "light")} label="Dark mode" />
        </Row>
        <Row icon={<Activity />} title="Reduce Motion" hint="Turn off animations. Your system setting is always respected.">
          <Switch checked={reduce} onChange={setReduce} label="Reduce motion" />
        </Row>
      </div>

      <div className="mt-5 divide-y overflow-hidden rounded-2xl border bg-card shadow-elev">
        <LinkRow icon={<UserRound />} title="Account Settings" open={open === "account"} onToggle={() => toggle("account")}>
          {user ? (
            <>
              <KV k="Email" v={user.email} />
              <KV k="Role" v={<Badge variant="secondary" className="capitalize">{user.role.toLowerCase()}</Badge>} />
              <Button variant="outline" size="sm" className="mt-3" onClick={() => { logout(); navigate("/"); }}><LogOut /> Sign out</Button>
            </>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-muted-foreground">{isGuest ? "You're using CyberShield360 as a guest." : "You're not signed in."}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" asChild><Link to="/login">Sign in</Link></Button>
                <Button size="sm" asChild><Link to="/login?mode=register">Create account</Link></Button>
              </div>
            </div>
          )}
        </LinkRow>
        <LinkRow icon={<Lock />} title="Privacy & Data" open={open === "privacy"} onToggle={() => toggle("privacy")}>
          {privacy ? (
            <>
              <KV k="Personal-data redaction" v={<Badge variant={privacy.pii_redaction ? "success" : "warning"}>{privacy.pii_redaction ? "On" : "Off"}</Badge>} />
              <KV k="Uploaded images" v={privacy.store_raw_uploads ? "Stored" : "Not stored"} />
              <KV k="Scan history retention" v={`${privacy.data_retention_days} days`} />
              <KV k="Maximum upload size" v={`${privacy.max_file_size_mb} MB`} />
            </>
          ) : <p className="text-muted-foreground">Couldn't load the server's privacy configuration.</p>}
          {user && <Button variant="outline" size="sm" className="mt-3" asChild><Link to="/app/reports">Manage my reports</Link></Button>}
        </LinkRow>
        <LinkRow icon={<LifeBuoy />} title="Help & Support" to="/contact" />
        <LinkRow icon={<Info />} title="About CyberShield360" open={open === "about"} onToggle={() => toggle("about")}>
          <KV k="Version" v={<span className="font-mono">{__APP_VERSION__}</span>} />
          {config && <KV k="Environment" v={`${config.env}${config.demo_mode ? " · demo mode" : ""}`} />}
          <KV k="Source code" v={<a href="https://github.com/indramadesh/CyberShield360" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">GitHub <ExternalLink className="size-3.5" /></a>} />
          <Button variant="ghost" size="sm" className="mt-2 -ml-2" asChild><Link to="/about">More about CyberShield360</Link></Button>
        </LinkRow>
      </div>
    </div>
  );
}
