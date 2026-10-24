import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/ui/PageHeader";
import { SkeletonCard } from "@/components/ui/states";
import { apiFetch } from "@/services/api";

interface NewsItem { id: string; title: string; summary: string; source: string; severity: string }
interface Law { id: string; authority: string; title: string; status: string; official_source: string; plain_summary: string }

const SEVERITY: Record<string, BadgeProps["variant"]> = {
  info: "info", warning: "warning", high: "high", critical: "danger",
};

export function IntelPage() {
  const [tab, setTab] = useState<"news" | "laws">("news");
  const news = useQuery({ queryKey: ["news"], queryFn: () => apiFetch<NewsItem[]>("/news"), enabled: tab === "news" });
  const laws = useQuery({ queryKey: ["laws"], queryFn: () => apiFetch<Law[]>("/laws"), enabled: tab === "laws" });

  return (
    <div>
      <PageHeader title="Intelligence"
        description="Security news and a cyber-law tracker. Summaries are informational, not legal advice." />

      <Tabs value={tab} onValueChange={(v) => setTab(v as "news" | "laws")}>
        <TabsList>
          <TabsTrigger value="news">Security news</TabsTrigger>
          <TabsTrigger value="laws">Cyber law</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="mt-6 space-y-3">
        {tab === "news" && (news.isLoading
          ? [0, 1].map((i) => <SkeletonCard key={i} />)
          : news.data?.map((n) => (
            <Card key={n.id}>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Badge variant={SEVERITY[n.severity] ?? "secondary"}>{n.severity}</Badge>
                  <span className="text-xs text-muted-foreground">{n.source}</span>
                </div>
                <CardTitle className="text-base">{n.title}</CardTitle>
                <CardDescription>{n.summary}</CardDescription>
              </CardHeader>
            </Card>
          )))}

        {tab === "laws" && (laws.isLoading
          ? [0, 1].map((i) => <SkeletonCard key={i} />)
          : laws.data?.map((law) => (
            <Card key={law.id}>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{law.authority}</Badge>
                  <span className="text-xs uppercase text-muted-foreground">{law.status}</span>
                </div>
                <CardTitle className="text-base">{law.title}</CardTitle>
                <CardDescription>{law.plain_summary}</CardDescription>
              </CardHeader>
              {law.official_source && (
                <CardContent>
                  <a className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                     href={law.official_source} target="_blank" rel="noreferrer">
                    Official source <ExternalLink className="size-3.5" />
                  </a>
                </CardContent>
              )}
            </Card>
          )))}
      </div>
    </div>
  );
}
