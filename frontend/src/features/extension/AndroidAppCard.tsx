import { CheckCircle2, Download, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAndroidRelease } from "./release";

const fmtSize = (b: number) => `${(b / 1024 / 1024).toFixed(1)} MB`;

/** Download + install steps for the Android app (signed APK; not on Google Play yet). */
export function AndroidAppCard() {
  const rel = useAndroidRelease();
  const r = rel.data;
  return (
    <section id="android" className="mt-16 scroll-mt-20">
      <h2 className="flex items-center gap-2 font-display text-2xl font-semibold"><Smartphone className="size-6 text-primary" /> Android app</h2>
      <p className="mt-2 max-w-3xl text-muted-foreground">
        CyberShield360 Protect checks notifications from the apps you choose (WhatsApp, Messages, Gmail…) and warns you about
        scams and phishing. You can also paste a link or message to check it, or share text to it from any app.
      </p>
      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Latest Android release</CardTitle></CardHeader>
          <CardContent>
            {rel.isLoading ? <div className="h-24 animate-pulse rounded-lg bg-muted" /> : !r ? (
              <p className="text-sm text-muted-foreground">No Android build is published yet.</p>
            ) : (
              <>
                <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                  <div><dt className="text-xs text-subtle">Version</dt><dd className="font-medium">v{r.version}</dd></div>
                  <div><dt className="text-xs text-subtle">Size</dt><dd className="font-medium">{fmtSize(r.size_bytes)}</dd></div>
                  <div><dt className="text-xs text-subtle">Needs</dt><dd className="font-medium">Android {r.min_android.split(" ")[0]}+</dd></div>
                  <div><dt className="text-xs text-subtle">Format</dt><dd className="font-medium">APK</dd></div>
                </dl>
                <Button className="mt-5 w-full" asChild>
                  <a href={`/apps/${r.file}`} download><Download /> Download Android app (APK)</a>
                </Button>
                <p className="mt-3 break-all font-mono text-[11px] text-muted-foreground">SHA-256: {r.sha256}</p>
                {r.release_notes && (
                  <ul className="mt-4 space-y-1 border-t pt-4 text-sm text-muted-foreground">
                    {r.release_notes.map((n) => <li key={n} className="flex gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />{n}</li>)}
                  </ul>
                )}
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">How to install</CardTitle></CardHeader>
          <CardContent>
            <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
              <li>Open this page <b className="text-foreground">on your Android phone</b> and tap <b className="text-foreground">Download</b>.</li>
              <li>Open the downloaded file. Android asks to allow installs from your browser — allow it for this install.</li>
              <li>Tap <b className="text-foreground">Install</b>. Google Play Protect may warn that the app is unknown because it isn't on the Play Store yet.</li>
              <li>Open the app, read what it does, and pair it from <b className="text-foreground">Message Protection → Connected sources</b> on this site.</li>
              <li>Turn on Notification access and choose which apps to check.</li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
