import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  BellRing, Globe as Chrome, Inbox, Loader2, Mail, MailCheck, MessageSquareWarning, PauseCircle, PlayCircle, RefreshCw,
  ShieldAlert, Smartphone, Unplug,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { MetricCard } from "@/components/ui/MetricCard";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, ErrorState, LoadingRows } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/features/auth/useAuth";
import { cn } from "@/lib/utils";
import {
  CLASS_LABEL, SOURCE_LABEL, useAlertStatus, useAnalyze, useCapabilities, useConnectMail, useDeleteHistory,
  useDisconnect, useItems, useOverview, usePairing, usePatchSource, usePrefs, usePutPrefs, useSources, useSyncNow,
  type Classification, type Prefs, type Source,
} from "./api";
import { ClassBadge, RiskText, StateDot, when } from "./components";

const TABS = ["overview", "sources", "items", "privacy"] as const;
type Tab = (typeof TABS)[number];

export function ProtectionPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const push = useToast();
  const tab = (TABS as readonly string[]).includes(params.get("tab") ?? "") ? (params.get("tab") as Tab) : "overview";
  const setTab = (t: string) => setParams((p) => { p.set("tab", t); return p; }, { replace: true });

  // Result of the Gmail / Outlook OAuth round trip.
  useEffect(() => {
    const ok = params.get("connected");
    const err = params.get("connect_error");
    if (!ok && !err) return;
    push(ok ? { title: `${ok === "gmail" ? "Gmail" : "Outlook"} connected`, description: "New mail will be checked automatically.", tone: "success" }
      : { title: "Couldn't connect the account", description: err === "denied" ? "Access wasn't granted." : "Please try again.", tone: "error" });
    setParams((p) => { p.delete("connected"); p.delete("connect_error"); p.set("tab", "sources"); return p; }, { replace: true });
  }, [params, push, setParams]);

  if (!user) {
    return (
      <>
        <PageHeader title="Message Protection" description="Automatic checks for the messages and emails you choose to connect." />
        <EmptyState icon={<MailCheck className="size-8" />} title="Sign in to use Message Protection"
          description="Connected sources and your analysis history belong to your account, so this needs a signed-in account."
          action={<Button asChild><Link to="/login?next=/app/protection">Sign in</Link></Button>} />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Message Protection"
        description="Checks emails and notifications from the sources you connect, using the same engine as the scanner. Nothing is monitored until you connect it." />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-5 flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="sources">Connected sources</TabsTrigger>
          <TabsTrigger value="items">Detected messages</TabsTrigger>
          <TabsTrigger value="privacy">Alerts &amp; privacy</TabsTrigger>
        </TabsList>
        <TabsContent value="overview"><OverviewTab goTo={setTab} /></TabsContent>
        <TabsContent value="sources"><SourcesTab /></TabsContent>
        <TabsContent value="items"><ItemsTab /></TabsContent>
        <TabsContent value="privacy"><PrivacyTab /></TabsContent>
      </Tabs>
    </>
  );
}

/* ------------------------------------------------------------------ overview */

function OverviewTab({ goTo }: { goTo: (t: string) => void }) {
  const ov = useOverview();
  const alertStatus = useAlertStatus();
  if (ov.isError) return <ErrorState message="Couldn't load Message Protection." onRetry={() => ov.refetch()} />;
  const d = ov.data;
  const active = d?.sources.filter((s) => s.kind !== "manual") ?? [];
  return (
    <div className="space-y-5">
      {d?.paused && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-warning/40 bg-warning-soft/50 px-4 py-3 text-sm">
          <PauseCircle className="size-4 text-warning" /> Automatic monitoring is paused. Checks you run yourself still work.
          <Button size="sm" variant="outline" className="ml-auto" onClick={() => goTo("privacy")}>Change</Button>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard icon={<Mail />} label="Emails analysed" value={d ? d.counts.emails_analyzed : null} />
        <MetricCard icon={<MessageSquareWarning />} label="Messages analysed" value={d ? d.counts.messages_analyzed : null} tone="info" />
        <MetricCard icon={<ShieldAlert />} label="Scams & phishing" value={d ? d.counts.threats : null} tone="danger" />
        <MetricCard icon={<BellRing />} label="Suspicious" value={d ? d.counts.suspicious : null} tone="warning" />
      </div>

      <section className="rounded-2xl border bg-card p-5 shadow-elev">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-display text-lg font-semibold">Monitoring status</h2>
          <span className="ml-auto text-xs text-muted-foreground">Last activity: {when(d?.last_sync_at)}</span>
        </div>
        {ov.isLoading ? <LoadingRows rows={2} /> : active.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            No sources are connected, so nothing is being monitored automatically.{" "}
            <button className="font-medium text-primary underline-offset-2 hover:underline" onClick={() => goTo("sources")}>Connect a source</button>
          </p>
        ) : (
          <ul className="mt-3 divide-y">
            {active.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                <SourceIcon kind={s.kind} />
                <span className="font-medium">{SOURCE_LABEL[s.kind]}</span>
                <span className="text-muted-foreground">{s.label}</span>
                <span className="ml-auto"><StateDot state={s.display_state} /></span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border bg-card p-5 shadow-elev">
        <h2 className="font-display text-lg font-semibold">Recent alerts</h2>
        {!d ? <LoadingRows rows={2} /> : d.recent_alerts.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No alerts yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {d.recent_alerts.map((a) => (
              <li key={a.id} className={cn("flex flex-wrap items-center gap-3 rounded-xl border px-3 py-2.5 text-sm", a.status === "new" && "border-danger/40 bg-danger-soft/30")}>
                <RiskText level={a.level} />
                <Link to={`/app/protection/items/${a.event_id}`} className="font-medium hover:underline">{a.title}</Link>
                {a.suppressed_reason && <span className="text-xs text-muted-foreground">({a.suppressed_reason === "quiet_hours" ? "held during quiet hours" : "not pushed: hourly limit"})</span>}
                <span className="ml-auto text-xs text-muted-foreground">{when(a.created_at)}</span>
                {a.status !== "dismissed" && (
                  <Button size="sm" variant="ghost" onClick={() => alertStatus.mutate({ id: a.id, status: "dismissed" })}>Dismiss</Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <CheckBox />
    </div>
  );
}

function CheckBox() {
  const [kind, setKind] = useState<"message" | "email">("message");
  const [text, setText] = useState("");
  const analyze = useAnalyze();
  const r = analyze.data;
  return (
    <section className="rounded-2xl border bg-card p-5 shadow-elev">
      <h2 className="font-display text-lg font-semibold">Check a message or email yourself</h2>
      <p className="mt-1 text-sm text-muted-foreground">Paste a message, or a full email with its headers. It's saved to your history (redacted) so you can find it later.</p>
      <div role="radiogroup" aria-label="Type" className="mt-3 inline-flex rounded-lg border bg-background-2 p-1">
        {(["message", "email"] as const).map((k) => (
          <button key={k} role="radio" aria-checked={kind === k} onClick={() => setKind(k)}
            className={cn("rounded-md px-3 py-1.5 text-sm", kind === k ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
            {k === "message" ? "Message" : "Email"}
          </button>
        ))}
      </div>
      <Textarea className="mt-3 min-h-28 rounded-xl" value={text} onChange={(e) => setText(e.target.value)}
        aria-label="Content to check" placeholder={kind === "email" ? "From: …\nSubject: …\n\nBody…" : "Paste the message text"} />
      <div className="mt-3 flex items-center gap-3">
        <Button disabled={!text.trim() || analyze.isPending} onClick={() => analyze.mutate({ kind, content: text })}>
          {analyze.isPending && <Loader2 className="animate-spin" />} Check
        </Button>
        {analyze.isError && <span className="text-sm text-danger">{(analyze.error as Error).message}</span>}
      </div>
      {r && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border bg-background-2 p-3 text-sm">
          <ClassBadge c={r.classification} /> <RiskText level={r.risk_level} score={r.risk_score} />
          <span className="text-muted-foreground">{r.evidence[0]?.summary ?? "No warning signs were found. That doesn't prove it's safe."}</span>
          <Button size="sm" variant="outline" className="ml-auto" asChild><Link to={`/app/protection/items/${r.id}`}>Full report</Link></Button>
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ sources */

function SourceIcon({ kind }: { kind: string }) {
  const Icon = kind === "android_notifications" ? Smartphone : kind === "browser_extension" ? Chrome : kind === "manual" ? MessageSquareWarning : Inbox;
  return <Icon className="size-4 text-primary" aria-hidden />;
}

function SourcesTab() {
  const caps = useCapabilities();
  const sources = useSources();
  const connect = useConnectMail();
  const pairing = usePairing();
  const [pairKind, setPairKind] = useState<"android_notifications" | "browser_extension" | null>(null);
  const live = sources.data?.filter((s) => s.status !== "disconnected" && s.kind !== "manual") ?? [];
  const c = caps.data?.connectors;

  const mailButton = (p: "gmail" | "outlook") => (
    <div className="rounded-2xl border bg-card p-4 shadow-elev">
      <div className="flex items-center gap-2 font-semibold"><Inbox className="size-4 text-primary" /> {p === "gmail" ? "Gmail" : "Outlook / Microsoft 365"}</div>
      <p className="mt-1 text-sm text-muted-foreground">Read-only access to your inbox. New mail is checked about every 5 minutes. We never send, delete or move email.</p>
      {c && !c[p]?.available ? (
        <p className="mt-3 rounded-lg bg-secondary px-3 py-2 text-xs text-muted-foreground">{c[p]?.note}</p>
      ) : (
        <Button className="mt-3" size="sm" disabled={!c || connect.isPending}
          onClick={() => connect.mutate(p, { onSuccess: (d) => { window.location.href = d.authorize_url; } })}>
          Connect {p === "gmail" ? "Gmail" : "Outlook"}
        </Button>
      )}
    </div>
  );

  return (
    <div className="space-y-5">
      <section>
        <h2 className="mb-3 font-display text-lg font-semibold">Your sources</h2>
        {sources.isLoading ? <LoadingRows rows={2} /> : live.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing is connected yet.</p>
        ) : <div className="space-y-3">{live.map((s) => <SourceCard key={s.id} s={s} />)}</div>}
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg font-semibold">Add a source</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {mailButton("gmail")}
          {mailButton("outlook")}
          <div className="rounded-2xl border bg-card p-4 shadow-elev">
            <div className="flex items-center gap-2 font-semibold"><Smartphone className="size-4 text-primary" /> Android notifications</div>
            <p className="mt-1 text-sm text-muted-foreground">The Android app checks notifications from apps <b>you choose</b>. It sees only what the notification shows, not whole conversations, and Android 15+ hides one-time codes from it.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => { setPairKind("android_notifications"); pairing.reset(); }}>Pair an Android phone</Button>
              <Button size="sm" variant="ghost" asChild><Link to="/android">Get the Android app</Link></Button>
            </div>
          </div>
          <div className="rounded-2xl border bg-card p-4 shadow-elev">
            <div className="flex items-center gap-2 font-semibold"><Chrome className="size-4 text-primary" /> Browser extension</div>
            <p className="mt-1 text-sm text-muted-foreground">Right-click any selected text → “Check with CyberShield360”. Pairing saves those checks to your history. It doesn't read your inbox.</p>
            <Button className="mt-3" size="sm" variant="outline" onClick={() => { setPairKind("browser_extension"); pairing.reset(); }}>Pair the extension</Button>
          </div>
        </div>
      </section>

      {caps.data && (
        <section className="rounded-2xl border bg-background-2 p-4 text-sm">
          <h3 className="font-semibold">Not possible on any platform</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
            {caps.data.not_possible.map((x) => <li key={x}>{x}</li>)}
            <li>{caps.data.connectors.ios?.note}</li>
          </ul>
        </section>
      )}

      <Dialog open={pairKind !== null} onOpenChange={(o) => { if (!o) setPairKind(null); }}>
        <DialogContent className="max-w-md">
          <DialogTitle className="font-display">{pairKind === "android_notifications" ? "Pair an Android phone" : "Pair the browser extension"}</DialogTitle>
          <DialogDescription>
            {pairKind === "android_notifications"
              ? "Notifications can include private messages. Only apps you select are checked; one-time codes, passwords and card numbers are removed before anything is stored, and message text isn't kept unless you turn on previews."
              : "Text you choose to check is sent for analysis and saved (redacted) to your history."}
          </DialogDescription>
          {pairing.data ? (
            <div className="mt-4 text-center">
              <div className="font-mono text-3xl font-bold tracking-widest">{pairing.data.code}</div>
              <p className="mt-2 text-sm text-muted-foreground">
                Enter this code in the {pairKind === "android_notifications" ? "Android app" : "extension's Settings"}. It works once and expires in {Math.round(pairing.data.expires_in_seconds / 60)} minutes.
              </p>
              {pairKind === "android_notifications" && (
                <>
                  {/* On the phone itself, this opens the app with the server and code filled in.
                      The app still asks the user to tap Pair. */}
                  <Button className="mt-4" variant="outline" asChild>
                    <a href={`cs360protect://pair?server=${encodeURIComponent(window.location.origin)}&code=${encodeURIComponent(pairing.data.code)}`}>
                      On this phone? Open the app
                    </a>
                  </Button>
                  <p className="mt-1 text-xs text-muted-foreground">Needs the CyberShield360 Protect app installed on this phone.</p>
                </>
              )}
            </div>
          ) : (
            <Button className="mt-4" disabled={pairing.isPending} onClick={() => pairKind && pairing.mutate(pairKind)}>
              I understand — create a pairing code
            </Button>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SourceCard({ s }: { s: Source }) {
  const patch = usePatchSource();
  const disconnect = useDisconnect();
  const sync = useSyncNow();
  const push = useToast();
  const [confirm, setConfirm] = useState(false);
  const [del, setDel] = useState(false);
  const apps = s.scope.apps ?? [];
  const isMail = s.kind === "gmail" || s.kind === "outlook";
  return (
    <article className="rounded-2xl border bg-card p-4 shadow-elev">
      <div className="flex flex-wrap items-center gap-2">
        <SourceIcon kind={s.kind} />
        <span className="font-semibold">{SOURCE_LABEL[s.kind]}</span>
        <span className="text-sm text-muted-foreground">{s.label}</span>
        <span className="ml-auto"><StateDot state={s.display_state} /></span>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <div><dt className="text-xs text-subtle">Permission</dt><dd className="capitalize">{s.permission_state}</dd></div>
        <div><dt className="text-xs text-subtle">{isMail ? "Last sync" : "Last report"}</dt><dd>{when(isMail ? s.last_sync_at : s.last_seen_at)}</dd></div>
        <div><dt className="text-xs text-subtle">Items analysed</dt><dd>{s.events_analyzed}</dd></div>
        <div><dt className="text-xs text-subtle">Scope</dt><dd>{isMail ? "Inbox, read-only" : s.kind === "android_notifications" ? `${apps.length} app${apps.length === 1 ? "" : "s"}` : "Text you select"}</dd></div>
      </dl>
      {s.last_error && <p className="mt-2 text-sm text-danger">{s.last_error}</p>}
      {s.kind === "android_notifications" && (
        <div className="mt-3">
          <div className="text-xs text-subtle">Apps checked (only these). Choose apps in the phone app; you can remove them here.</div>
          {apps.length === 0 ? (
            <p className="mt-1 text-sm text-muted-foreground">No apps selected yet, so nothing is checked.</p>
          ) : (
            <div className="mt-1 flex flex-wrap gap-1.5">
              {apps.map((a) => (
                <span key={a} className="inline-flex items-center gap-1 rounded-md border border-primary bg-primary/10 px-2 py-1 font-mono text-xs text-primary">
                  {a}
                  <button aria-label={`Stop checking ${a}`} className="text-muted-foreground hover:text-danger"
                    onClick={() => patch.mutate({ id: s.id, apps: apps.filter((x) => x !== a) })}>×</button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        {s.status === "paused" ? (
          <Button size="sm" variant="outline" onClick={() => patch.mutate({ id: s.id, status: "connected" })}><PlayCircle /> Resume</Button>
        ) : s.status === "connected" ? (
          <Button size="sm" variant="outline" onClick={() => patch.mutate({ id: s.id, status: "paused" })}><PauseCircle /> Pause</Button>
        ) : null}
        {isMail && s.status === "connected" && (
          <Button size="sm" variant="outline" disabled={sync.isPending} onClick={() => sync.mutate(s.id)}>
            <RefreshCw className={cn(sync.isPending && "animate-spin")} /> Sync now
          </Button>
        )}
        <Button size="sm" variant="ghost" className="text-danger" onClick={() => setConfirm(true)}><Unplug /> Disconnect</Button>
      </div>
      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent className="max-w-md">
          <DialogTitle>Disconnect {SOURCE_LABEL[s.kind]}?</DialogTitle>
          <DialogDescription>{isMail ? "We'll revoke access where the provider allows it and delete our copy of the access tokens." : "The device will stop being able to send items."}</DialogDescription>
          <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={del} onChange={(e) => setDel(e.target.checked)} /> Also delete this source's analysis history</label>
          <Button className="mt-4" variant="destructive" disabled={disconnect.isPending}
            onClick={() => disconnect.mutate({ id: s.id, deleteHistory: del }, {
              onSuccess: (r) => { setConfirm(false); push({ title: "Disconnected", description: r.note || undefined, tone: "success" }); },
            })}>Disconnect</Button>
        </DialogContent>
      </Dialog>
    </article>
  );
}

/* ------------------------------------------------------------------ detected messages */

const FILTERS: ("" | Classification)[] = ["", "SCAM", "PHISHING", "SUSPICIOUS", "SPAM", "PROMOTIONAL", "LIKELY_LEGITIMATE", "UNKNOWN"];

function ItemsTab() {
  const [cls, setCls] = useState<"" | Classification>("");
  const [sourceId, setSourceId] = useState("");
  const [since, setSince] = useState("");
  const [until, setUntil] = useState("");
  const [page, setPage] = useState(1);
  const sources = useSources();
  const items = useItems({ classification: cls || undefined, source_id: sourceId || undefined, since: since || undefined, until: until || undefined, page });
  useEffect(() => setPage(1), [cls, sourceId, since, until]);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Filter by classification">
        {FILTERS.map((f) => (
          <button key={f || "all"} role="radio" aria-checked={cls === f} onClick={() => setCls(f)}
            className={cn("rounded-full border px-3 py-1 text-sm", cls === f ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground")}>
            {f ? CLASS_LABEL[f] : "All"}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-3 text-sm">
        <label className="grid gap-1"><span className="text-xs text-subtle">Source</span>
          <select className="h-9 rounded-md border bg-background px-2" value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
            <option value="">All sources</option>
            {sources.data?.map((s) => <option key={s.id} value={s.id}>{SOURCE_LABEL[s.kind]} — {s.label}</option>)}
          </select>
        </label>
        <label className="grid gap-1"><span className="text-xs text-subtle">From</span><input type="date" className="h-9 rounded-md border bg-background px-2" value={since} onChange={(e) => setSince(e.target.value)} /></label>
        <label className="grid gap-1"><span className="text-xs text-subtle">To</span><input type="date" className="h-9 rounded-md border bg-background px-2" value={until} onChange={(e) => setUntil(e.target.value)} /></label>
      </div>
      {items.isError ? <ErrorState message="Couldn't load your messages." onRetry={() => items.refetch()} />
        : items.isLoading ? <LoadingRows rows={4} />
        : items.data!.items.length === 0 ? <EmptyState icon={<Inbox className="size-8" />} title="Nothing here yet" description="Analysed messages and emails appear here." />
        : (
          <>
            <ul className="divide-y rounded-2xl border bg-card shadow-elev">
              {items.data!.items.map((it) => (
                <li key={it.id}>
                  <Link to={`/app/protection/items/${it.id}`} className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-accent/40">
                    <ClassBadge c={it.classification} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{it.subject || it.sender || it.source_application || "Message"}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {SOURCE_LABEL[it.source_provider === "android" ? "android_notifications" : it.source_provider] ?? it.source_provider}
                        {it.sender ? ` · ${it.sender}` : ""}{it.preview ? ` · ${it.preview}` : ""}
                      </div>
                    </div>
                    <RiskText level={it.risk_level} score={it.risk_score} />
                    <span className="w-36 text-right text-xs text-muted-foreground">{when(it.received_at ?? it.analyzed_at)}</span>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{items.data!.total} item{items.data!.total === 1 ? "" : "s"}</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                <Button size="sm" variant="outline" disabled={!items.data!.has_more} onClick={() => setPage((p) => p + 1)}>Next</Button>
              </div>
            </div>
          </>
        )}
    </div>
  );
}

/* ------------------------------------------------------------------ alerts & privacy */

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start justify-between gap-4 py-3">
      <span><span className="text-sm font-medium">{label}</span>{hint && <span className="block text-xs text-muted-foreground">{hint}</span>}</span>
      <input type="checkbox" className="mt-1 size-4 accent-[hsl(var(--primary))]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

function PrivacyTab() {
  const prefs = usePrefs();
  const put = usePutPrefs();
  const delAll = useDeleteHistory();
  const push = useToast();
  const [confirm, setConfirm] = useState(false);
  if (prefs.isLoading) return <LoadingRows rows={4} />;
  if (prefs.isError || !prefs.data) return <ErrorState message="Couldn't load your settings." onRetry={() => prefs.refetch()} />;
  const p = prefs.data;
  const set = (v: Partial<Prefs> & { clear_quiet_hours?: boolean }) => put.mutate(v);
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="rounded-2xl border bg-card p-5 shadow-elev">
        <h2 className="font-display text-lg font-semibold">Monitoring</h2>
        <div className="divide-y">
          <Toggle label="Pause all automatic monitoring" hint="Connected sources stop sending items until you resume." checked={p.paused} onChange={(v) => set({ paused: v })} />
          <Toggle label="Keep short message previews" hint="Off by default. When on, a redacted preview (up to 300 characters) is stored to help you recognise items." checked={p.store_previews} onChange={(v) => set({ store_previews: v })} />
          <label className="flex items-center justify-between gap-4 py-3 text-sm">
            <span><span className="font-medium">Keep analysis history for</span><span className="block text-xs text-muted-foreground">Older items are deleted automatically.</span></span>
            <select className="h-9 rounded-md border bg-background px-2" value={p.retention_days} onChange={(e) => set({ retention_days: Number(e.target.value) })}>
              {[7, 30, 90, 180, 365].map((d) => <option key={d} value={d}>{d} days</option>)}
            </select>
          </label>
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-5 shadow-elev">
        <h2 className="font-display text-lg font-semibold">Alerts</h2>
        <div className="divide-y">
          <Toggle label="Critical risk" checked={p.alert_critical} onChange={(v) => set({ alert_critical: v })} />
          <Toggle label="High risk" checked={p.alert_high} onChange={(v) => set({ alert_high: v })} />
          <Toggle label="Medium risk" hint="Off by default to avoid alert fatigue." checked={p.alert_medium} onChange={(v) => set({ alert_medium: v })} />
          <div className="flex flex-wrap items-center gap-3 py-3 text-sm">
            <span className="font-medium">Quiet hours</span>
            <input type="time" aria-label="Quiet hours start" className="h-9 rounded-md border bg-background px-2" defaultValue={p.quiet_start ?? ""} onBlur={(e) => e.target.value && set({ quiet_start: e.target.value })} />
            <span>to</span>
            <input type="time" aria-label="Quiet hours end" className="h-9 rounded-md border bg-background px-2" defaultValue={p.quiet_end ?? ""} onBlur={(e) => e.target.value && set({ quiet_end: e.target.value })} />
            {p.quiet_start && <Button size="sm" variant="ghost" onClick={() => set({ clear_quiet_hours: true })}>Clear</Button>}
            <span className="w-full text-xs text-muted-foreground">Critical alerts are always shown. Times are in {p.timezone}.</span>
          </div>
          <label className="flex items-center justify-between gap-4 py-3 text-sm">
            <span className="font-medium">At most this many alerts per hour</span>
            <input type="number" min={1} max={60} className="h-9 w-20 rounded-md border bg-background px-2" defaultValue={p.max_alerts_per_hour}
              onBlur={(e) => { const n = Number(e.target.value); if (n >= 1 && n <= 60) set({ max_alerts_per_hour: n }); }} />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-5 shadow-elev lg:col-span-2">
        <h2 className="font-display text-lg font-semibold">Your data</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Only sources you connect are checked, and only the apps or mailbox folder you allow.</li>
          <li>One-time codes, passwords and card numbers are removed before analysis; full message bodies aren't stored.</li>
          <li>Mail access is read-only. CyberShield360 never sends, deletes, moves or replies to email, and never blocks senders.</li>
          <li>Notifications can contain private conversations. Disconnect a source at any time from Connected sources.</li>
        </ul>
        <Button className="mt-4" variant="destructive" onClick={() => setConfirm(true)}>Delete all analysis history</Button>
        <Dialog open={confirm} onOpenChange={setConfirm}>
          <DialogContent className="max-w-md">
            <DialogTitle>Delete all analysis history?</DialogTitle>
            <DialogDescription>Every analysed message, its report and its alerts will be deleted. Connected sources stay connected.</DialogDescription>
            <Button className="mt-4" variant="destructive" disabled={delAll.isPending}
              onClick={() => delAll.mutate(undefined, { onSuccess: (r) => { setConfirm(false); push({ title: `Deleted ${r.deleted} item${r.deleted === 1 ? "" : "s"}`, tone: "success" }); } })}>
              Delete everything
            </Button>
          </DialogContent>
        </Dialog>
      </section>
    </div>
  );
}
