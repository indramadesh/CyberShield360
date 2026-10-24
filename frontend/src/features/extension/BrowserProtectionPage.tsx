import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Shield, Download, Puzzle, ScanSearch, Ban, Lock, CheckCircle2, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface Release {
  name: string; version: string; file: string; size_bytes: number;
  sha256: string; build_timestamp: string; permissions: string[];
}

const FEATURES = [
  { icon: ScanSearch, title: "Analyze any site", text: "Check the page you're on, or any link, against the CyberShield 360 engine." },
  { icon: Ban, title: "Block known threats", text: "Known-malicious domains are blocked and redirected to a clear warning page." },
  { icon: Lock, title: "Privacy-respecting", text: "No passwords, OTPs or history collected. Only URLs you analyze are sent to your backend." },
];

const PERMISSION_NOTES: Record<string, string> = {
  activeTab: "Read the current tab's URL when you click the extension.",
  webNavigation: "Observe page navigations to auto-check pages (URL only — never page content).",
  notifications: "Show a details notification for lower-risk pages.",
  storage: "Save your settings and a small local cache.",
  declarativeNetRequest: "Block known-malicious domains at the network layer.",
  alarms: "Periodically refresh the known-bad list.",
};

function fmtSize(b?: number) {
  if (!b) return "—";
  return b < 1024 * 1024 ? `${Math.round(b / 1024)} KB` : `${(b / 1024 / 1024).toFixed(2)} MB`;
}

export function BrowserProtectionPage() {
  const rel = useQuery({
    queryKey: ["ext-release"],
    queryFn: async () => {
      const r = await fetch("/downloads/release-manifest.json", { cache: "no-store" });
      if (!r.ok) throw new Error("not found");
      return (await r.json()) as Release;
    },
    retry: false,
  });

  const r = rel.data;

  return (
    <div className="min-h-screen">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <span className="flex size-7 items-center justify-center rounded-md bg-primary/15 text-primary"><Shield className="size-4" /></span>
            CyberShield 360
          </Link>
          <Button variant="ghost" size="sm" asChild><Link to="/app">Open app</Link></Button>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-12">
        <div className="max-w-2xl">
          <Badge variant="default">Browser Protection</Badge>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            CyberShield 360 for your browser
          </h1>
          <p className="mt-3 text-muted-foreground">
            A lightweight Chrome extension that checks suspicious links as you browse and
            warns you about known-malicious sites — powered by the same engine as this
            platform. It is an assistance tool, not a guarantee of complete safety.
          </p>
        </div>

        {/* Features */}
        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <Card key={f.title}>
                <CardHeader>
                  <span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary"><Icon className="size-5" /></span>
                  <CardTitle className="text-base">{f.title}</CardTitle>
                  <CardDescription>{f.text}</CardDescription>
                </CardHeader>
              </Card>
            );
          })}
        </div>

        {/* Download + Store */}
        <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-base">Download (manual install)</CardTitle></CardHeader>
            <CardContent>
              {rel.isError || !r ? (
                <p className="text-sm text-muted-foreground">
                  No build is available yet. Run <code>npm run build</code> in the
                  <code> extension/</code> folder to generate the package.
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <Badge variant="secondary">v{r.version}</Badge>
                    <span>{fmtSize(r.size_bytes)}</span>
                    <span>·</span>
                    <span>built {new Date(r.build_timestamp).toLocaleDateString()}</span>
                  </div>
                  <Button className="mt-4 w-full" asChild>
                    <a href={`/downloads/${r.file}`} download><Download className="size-4" /> Download extension ZIP</a>
                  </Button>
                  <p className="mt-2 break-all text-[11px] text-muted-foreground">SHA-256: {r.sha256}</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Chrome Web Store</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                A one-click Web Store listing is <b>not published yet</b>. Until it is
                reviewed and approved by Google, please use the manual install on the left.
              </p>
              <Button className="mt-4 w-full" variant="outline" disabled>
                <Puzzle className="size-4" /> Add to Chrome — pending publication
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Install steps */}
        <Card className="mt-8">
          <CardHeader><CardTitle className="text-base">How to install the ZIP</CardTitle></CardHeader>
          <CardContent>
            <p className="mb-3 flex items-start gap-2 text-sm text-muted-foreground">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
              A downloaded ZIP can't be installed by opening it. Extract it first, then load the folder in Chrome's Developer mode.
            </p>
            <ol className="list-decimal space-y-1.5 pl-5 text-sm">
              <li>Download and <b>extract</b> the ZIP to a folder.</li>
              <li>Open <code>chrome://extensions</code>.</li>
              <li>Turn on <b>Developer mode</b> (top-right).</li>
              <li>Click <b>Load unpacked</b> and select the extracted folder (the one containing <code>manifest.json</code>).</li>
              <li>Open the extension → <b>Settings</b> and set the Backend URL (e.g. your CyberShield 360 server).</li>
            </ol>
          </CardContent>
        </Card>

        {/* Permissions + privacy */}
        <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-base">Permissions &amp; why</CardTitle></CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {(r?.permissions ?? Object.keys(PERMISSION_NOTES)).map((p) => (
                  <li key={p} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
                    <span><b>{p}</b> — {PERMISSION_NOTES[p] ?? "Required for extension functionality."}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Privacy &amp; limitations</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>Never collects passwords, OTPs, cookies or payment data. Does not upload your browsing history.</p>
              <p>Only URLs you choose to analyze (and the current tab when you click Analyze) are sent to the backend you configure.</p>
              <p>The known-bad blocklist is a bounded demo/internal list — it is not exhaustive. Absence of a block is not proof a site is safe.</p>
            </CardContent>
          </Card>
        </div>

        <Separator className="my-8" />
        <p className="text-xs text-muted-foreground">
          CyberShield 360 Browser Protection provides assessments, not guarantees. It does
          not replace Chrome's built-in protections or antivirus software.
        </p>
      </div>
    </div>
  );
}
