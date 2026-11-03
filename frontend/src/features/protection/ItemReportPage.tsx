import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Info, LifeBuoy, Link2, Paperclip, ShieldCheck, ThumbsDown, ThumbsUp, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorState, LoadingRows } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { CLASS_LABEL, SOURCE_LABEL, useDeleteItem, useFeedback, useItem, type Classification } from "./api";
import { ClassBadge, RiskText, sureLabel, when } from "./components";

const COMPLETENESS: Record<string, string> = {
  full: "Full message", partial: "Notification text only", preview: "Preview only", metadata: "No text available",
};

/** Detailed analysis report for one message: what was observed, what we infer from
 *  it, and what we couldn't check. */
export function ItemReportPage() {
  const { itemId } = useParams();
  const item = useItem(itemId);
  const feedback = useFeedback();
  const del = useDeleteItem();
  const navigate = useNavigate();
  const push = useToast();
  const [suggest, setSuggest] = useState<Classification | "">("");

  if (item.isLoading) return <LoadingRows rows={5} />;
  if (item.isError || !item.data) return <ErrorState message="This item doesn't exist or was deleted." />;
  const r = item.data;
  const authRows = Object.entries(r.authentication).filter(([k]) => k !== "source");

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Link to="/app/protection?tab=items" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Detected messages
      </Link>

      <section className="rounded-2xl border bg-card p-5 shadow-elev">
        <div className="flex flex-wrap items-center gap-3">
          <ClassBadge c={r.classification} />
          {r.categories.filter((c) => c !== r.classification).map((c) => <ClassBadge key={c} c={c} size="sm" />)}
          <RiskText level={r.risk_level} score={r.risk_score} />
          <span className="ml-auto text-right text-sm">
            <span className="block text-xs text-muted-foreground">How sure we are</span>
            <span className="font-semibold">{sureLabel(r.confidence)}</span> <span className="text-xs text-muted-foreground">({Math.round(r.confidence * 100)}%)</span>
          </span>
        </div>
        <h1 className="mt-3 font-display text-xl font-semibold">{r.subject || r.sender || "Message"}</h1>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div><dt className="text-xs text-subtle">Source</dt><dd>{r.source ? SOURCE_LABEL[r.source.kind] : r.source_provider}{r.source_application ? ` · ${r.source_application}` : ""}</dd></div>
          <div><dt className="text-xs text-subtle">Sender</dt><dd className="break-all">{r.sender || "Not available"}{r.sender_domain ? ` (${r.sender_domain})` : ""}</dd></div>
          <div><dt className="text-xs text-subtle">Received</dt><dd>{when(r.received_at)}</dd></div>
          <div><dt className="text-xs text-subtle">What we had</dt><dd>{COMPLETENESS[r.completeness] ?? r.completeness}</dd></div>
        </dl>
        {r.preview && <p className="mt-3 rounded-lg bg-background-2 p-3 text-sm text-muted-foreground">{r.preview}</p>}
      </section>

      <section className="rounded-2xl border bg-card p-5 shadow-elev">
        <h2 className="font-display text-lg font-semibold">What we observed</h2>
        <p className="text-xs text-muted-foreground">Facts found in the message. The classification above is our conclusion from them.</p>
        {r.evidence.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No warning signs were found. That doesn't prove the message is safe.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {r.evidence.map((e) => (
              <li key={e.indicator} className="rounded-xl border px-3 py-2.5 text-sm">
                <div className="font-medium">{e.summary}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{why(e.indicator)}</div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-5 md:grid-cols-2">
        <section className="rounded-2xl border bg-card p-5 shadow-elev">
          <h2 className="flex items-center gap-2 font-semibold"><ShieldCheck className="size-4 text-primary" /> Sender authentication</h2>
          {authRows.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">Not available. {r.source_type === "email" ? "We only use results added by Gmail or Outlook themselves, never headers in pasted text." : "Notifications and shared text carry no sender authentication."}</p>
          ) : (
            <>
              <ul className="mt-2 space-y-1 text-sm">{authRows.map(([k, v]) => <li key={k}><span className="uppercase">{k}</span>: <b className={v === "pass" ? "text-success" : v === "fail" ? "text-danger" : ""}>{v}</b></li>)}</ul>
              <p className="mt-2 text-xs text-muted-foreground">Source: {r.authentication.source}</p>
            </>
          )}
        </section>
        <section className="rounded-2xl border bg-card p-5 shadow-elev">
          <h2 className="flex items-center gap-2 font-semibold"><Link2 className="size-4 text-primary" /> Links ({r.urls.length})</h2>
          {r.urls.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">No links found.</p> : (
            <ul className="mt-2 space-y-1 text-sm">{r.urls.map((u) => <li key={u.url} className="break-all font-mono text-xs">{u.url}</li>)}</ul>
          )}
          <p className="mt-2 text-xs text-muted-foreground">Checked by address and threat lists only — never opened. Don't open them to “test”.</p>
          {r.attachments.length > 0 && (
            <>
              <h3 className="mt-4 flex items-center gap-2 font-semibold"><Paperclip className="size-4 text-primary" /> Attachments</h3>
              <ul className="mt-1 space-y-1 text-sm">{r.attachments.map((a) => <li key={a.filename}>{a.filename}{a.size ? ` · ${Math.round(a.size / 1024)} KB` : ""}</li>)}</ul>
            </>
          )}
        </section>
      </div>

      <section className="rounded-2xl border bg-card p-5 shadow-elev">
        <h2 className="font-display text-lg font-semibold">What to do</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{r.recommendations.map((x) => <li key={x}>{x}</li>)}</ul>
        <Button className="mt-4" variant="outline" asChild><Link to="/app/incident"><LifeBuoy /> I clicked, replied or paid — help me</Link></Button>
      </section>

      <section className="rounded-2xl border bg-background-2 p-5 text-sm">
        <h2 className="flex items-center gap-2 font-semibold"><Info className="size-4" /> Limits of this analysis</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">{r.limitations.map((x) => <li key={x}>{x}</li>)}</ul>
        <p className="mt-3 text-xs text-subtle">Analysed {when(r.analyzed_at)} · engine {r.engine_version} · deleted automatically after {when(r.expires_at)}</p>
      </section>

      <section className="flex flex-wrap items-center gap-2 rounded-2xl border bg-card p-4 shadow-elev text-sm">
        <span className="font-medium">Was this right?</span>
        {r.feedback ? <span className="text-muted-foreground">Thanks — you marked it {r.feedback.verdict}.</span> : (
          <>
            <Button size="sm" variant="outline" onClick={() => feedback.mutate({ id: r.id, verdict: "correct" })}><ThumbsUp /> Yes</Button>
            <select aria-label="What should it be?" className="h-8 rounded-md border bg-background px-2" value={suggest} onChange={(e) => setSuggest(e.target.value as Classification)}>
              <option value="">It's actually…</option>
              {(Object.keys(CLASS_LABEL) as Classification[]).filter((c) => c !== r.classification).map((c) => <option key={c} value={c}>{CLASS_LABEL[c]}</option>)}
            </select>
            <Button size="sm" variant="outline" onClick={() => feedback.mutate({ id: r.id, verdict: "incorrect", suggested_classification: suggest || undefined })}><ThumbsDown /> Report as wrong</Button>
          </>
        )}
        <Button size="sm" variant="ghost" className="ml-auto text-danger"
          onClick={() => del.mutate(r.id, { onSuccess: () => { push({ title: "Deleted", tone: "success" }); navigate("/app/protection?tab=items"); } })}>
          <Trash2 /> Delete
        </Button>
      </section>
    </div>
  );
}

/** Why an indicator matters, in plain words. */
function why(indicator: string): string {
  const map: Record<string, string> = {
    dmarc_fail: "Gmail/Outlook couldn't confirm the email really came from that domain; attackers fake sender addresses this way.",
    spf_fail: "The sending server isn't on the domain's approved list, a common sign of a spoofed sender.",
    display_name_impersonation: "Scammers put a trusted name in the From line because most apps show the name, not the address.",
    display_name_address_mismatch: "Showing one address while sending from another is a deliberate disguise.",
    freemail_role_sender: "Real support teams rarely write from free personal mailboxes.",
    replyto_mismatch: "Your reply would go somewhere other than the sender — a way to capture your answers.",
    attachment_double_extension: "A fake '.pdf' that is really a program runs code as soon as it's opened.",
    attachment_executable: "Programs and scripts can install malware when opened.",
    attachment_macro: "Macros in Office files are a common way to install malware.",
    msg_credential_request: "Legitimate organisations never ask you to share OTPs, PINs or passwords.",
    urgency_plus_credential: "Pressure plus a request for secrets is the classic phishing pattern.",
    brand_impersonation: "A brand name on a domain the brand doesn't own is a typical fake login page.",
    no_https: "The link isn't encrypted; real banks and services always use HTTPS.",
    url_shortener: "Short links hide where they really go.",
    intel_match: "This address is on a threat-intelligence list.",
    reward_plus_payment: "Real prizes never require you to pay first.",
  };
  return map[indicator] ?? "This pattern is common in scams and phishing.";
}
