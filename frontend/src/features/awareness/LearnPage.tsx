import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, Lock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/ui/PageHeader";
import { SkeletonCard } from "@/components/ui/states";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/services/api";
import { useAuth } from "@/features/auth/useAuth";

interface LessonSummary { slug: string; category: string; title: string; summary: string }
interface Lesson extends LessonSummary { body_md: string; quiz: QuizItem[] }
interface QuizItem { question: string; options: string[]; answer_index: number; explanation: string }
interface Challenge { question: string; options: string[]; answer_index: number; explanation: string }

export function LearnPage() {
  const { user } = useAuth();
  const locked = !user;
  const lessons = useQuery({ queryKey: ["lessons"], queryFn: () => apiFetch<LessonSummary[]>("/awareness") });
  const challenge = useQuery({ queryKey: ["challenge"], queryFn: () => apiFetch<Challenge>("/challenges/daily") });
  const [slug, setSlug] = useState<string | null>(null);

  return (
    <div>
      <PageHeader title="Learn" description="Short lessons and a daily challenge to build cyber instincts." />

      {locked && (
        <Card className="mb-6 border-primary/30">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-2 text-sm">
              <Lock className="size-4 text-primary" />
              You can read every lesson as a guest. Sign in to take quizzes and track progress.
            </div>
            <div className="flex gap-2">
              <Button size="sm" asChild><Link to="/login?mode=register">Create account</Link></Button>
              <Button size="sm" variant="outline" asChild><Link to="/login">Sign in</Link></Button>
            </div>
          </CardContent>
        </Card>
      )}

      {challenge.data && <DailyChallenge c={challenge.data} locked={locked} />}

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {lessons.isLoading && [0, 1, 2, 3].map((i) => <SkeletonCard key={i} />)}
        {lessons.data?.map((l) => (
          <button key={l.slug} className="text-left" onClick={() => setSlug(l.slug)}>
            <Card className="h-full transition-colors hover:border-primary">
              <CardHeader>
                <Badge variant="default" className="w-fit">{l.category}</Badge>
                <CardTitle className="text-base">{l.title}</CardTitle>
                <CardDescription>{l.summary}</CardDescription>
              </CardHeader>
            </Card>
          </button>
        ))}
      </div>

      {slug && <LessonView slug={slug} locked={locked} onClose={() => setSlug(null)} />}
    </div>
  );
}

function QuizGate() {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-input bg-muted/40 p-4">
      <Lock className="size-4 text-muted-foreground" />
      <span className="text-sm text-muted-foreground">Sign in to take this quiz.</span>
      <div className="flex gap-2">
        <Button size="sm" asChild><Link to="/login?mode=register">Create account</Link></Button>
        <Button size="sm" variant="outline" asChild><Link to="/login">Sign in</Link></Button>
      </div>
    </div>
  );
}

function Options({ options, answer, picked, onPick }: {
  options: string[]; answer: number; picked: number | null; onPick: (i: number) => void;
}) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {options.map((o, i) => {
        const tone = picked === null ? "border-input hover:border-primary"
          : i === answer ? "border-success bg-success-soft text-success"
          : i === picked ? "border-danger bg-danger-soft text-danger" : "border-input text-muted-foreground";
        return (
          <button key={o} onClick={() => onPick(i)} disabled={picked !== null}
            className={cn("rounded-md border px-3 py-1.5 text-sm transition-colors", tone)}>
            {o}
          </button>
        );
      })}
    </div>
  );
}

function DailyChallenge({ c, locked }: { c: Challenge; locked: boolean }) {
  const [picked, setPicked] = useState<number | null>(null);
  return (
    <Card className="border-primary/30">
      <CardContent className="p-5">
        <Badge variant="default"><Sparkles className="size-3" /> Daily challenge</Badge>
        <p className="mt-2 text-sm font-medium">{c.question}</p>
        {locked ? <QuizGate /> : (
          <>
            <Options options={c.options} answer={c.answer_index} picked={picked} onPick={setPicked} />
            {picked !== null && <p className="mt-2 text-sm text-muted-foreground">{c.explanation}</p>}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function LessonView({ slug, locked, onClose }: { slug: string; locked: boolean; onClose: () => void }) {
  const { data, isLoading } = useQuery({ queryKey: ["lesson", slug], queryFn: () => apiFetch<Lesson>(`/awareness/${slug}`) });
  return (
    <Card className="mt-6">
      <CardContent className="p-5">
        {isLoading || !data ? <SkeletonCard /> : (
          <>
            <div className="flex items-start justify-between gap-3">
              <CardTitle className="text-base">{data.title}</CardTitle>
              <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{data.body_md}</p>
            {data.quiz?.length > 0 && (
              <div className="mt-4 space-y-4">
                {data.quiz.map((q, i) => (
                  <div key={i}>
                    <Separator className="mb-4" />
                    <p className="text-sm font-medium">{q.question}</p>
                    {locked ? <QuizGate /> : <QuizBlock q={q} />}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function QuizBlock({ q }: { q: QuizItem }) {
  const [picked, setPicked] = useState<number | null>(null);
  return (
    <>
      <Options options={q.options} answer={q.answer_index} picked={picked} onPick={setPicked} />
      {picked !== null && <p className="mt-2 text-xs text-muted-foreground">{q.explanation}</p>}
    </>
  );
}
