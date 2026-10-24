import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { RiskBadge } from "@/components/ui/RiskBadge";
import { PageHeader } from "@/components/ui/PageHeader";
import { apiFetch } from "@/services/api";
import type { RiskLevel } from "@/types";

const QUESTIONS: { key: string; label: string }[] = [
  { key: "clicked_link", label: "Did you click a suspicious link?" },
  { key: "entered_password", label: "Did you enter a password?" },
  { key: "shared_otp", label: "Did you share an OTP?" },
  { key: "shared_upi_pin", label: "Did you share a UPI PIN?" },
  { key: "transferred_money", label: "Did you transfer money?" },
  { key: "installed_app", label: "Did you install an application?" },
  { key: "shared_personal_info", label: "Did you share personal information?" },
];

interface Guidance {
  incident_id: string;
  severity: RiskLevel;
  steps: string[];
  reporting: { channels: { name: string; url?: string; phone?: string }[]; note: string };
  disclaimer: string;
}

export function IncidentPage() {
  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  const submit = useMutation({
    mutationFn: () => apiFetch<Guidance>("/incidents", { method: "POST", body: JSON.stringify(answers) }),
  });

  return (
    <div>
      <PageHeader title="I think I was scammed"
        description="Answer a few questions to get tailored next steps. We never file a report for you." />

      <Card>
        <CardHeader><CardTitle className="text-base">What happened?</CardTitle></CardHeader>
        <CardContent>
          <div>
            {QUESTIONS.map((q, i) => {
              const checked = !!answers[q.key];
              return (
                <div key={q.key}>
                  {i > 0 && <Separator />}
                  <label className="flex cursor-pointer select-none items-center gap-3 py-3 text-sm">
                    <input type="checkbox" checked={checked} className="size-4 accent-primary"
                      onChange={(e) => setAnswers({ ...answers, [q.key]: e.target.checked })} />
                    <span className={checked ? "text-foreground" : "text-muted-foreground"}>{q.label}</span>
                  </label>
                </div>
              );
            })}
          </div>
          <div className="pt-4">
            <Button onClick={() => submit.mutate()} loading={submit.isPending}>
              {submit.isPending ? "Preparing guidance…" : "Get guidance"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {submit.isSuccess && (
        <div className="mt-6 space-y-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Your guidance</CardTitle>
              <RiskBadge level={submit.data.severity} />
            </CardHeader>
            <CardContent>
              <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed">
                {submit.data.steps.map((s) => <li key={s}>{s}</li>)}
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Official reporting (India)</CardTitle></CardHeader>
            <CardContent>
              <ul className="space-y-1 text-sm">
                {submit.data.reporting.channels.map((c) => (
                  <li key={c.name}>
                    {c.name}:{" "}
                    {c.url
                      ? <a className="text-primary hover:underline" href={c.url} target="_blank" rel="noreferrer">{c.url}</a>
                      : <span className="font-medium">{c.phone}</span>}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">{submit.data.reporting.note}</p>
              <p className="mt-1 text-xs text-muted-foreground">{submit.data.disclaimer}</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
