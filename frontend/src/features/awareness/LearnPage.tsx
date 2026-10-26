import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Sparkles, Lock, Clock, CheckCircle2, BookOpen, Lightbulb, Flame, Target, ArrowRight, AlertTriangle,
  ShieldCheck, ExternalLink, ListChecks, ChevronDown, History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { TopicArt, topicFor } from "@/components/art/TopicArt";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/services/api";
import { useAuth } from "@/features/auth/useAuth";
import {
  categoryLabel, fmtDate, useLearnDaily, useMarkLesson, usePreviousTips, useProgress,
  type Lesson, type LessonSummary, type QuizResult,
} from "@/features/content/api";
import { QuizRunner } from "@/features/content/QuizRunner";

/** Topic groups (reference chips). Only groups that have lessons are shown. */
const GROUPS: { key: string; label: string; cats: string[] }[] = [
  { key: "basics", label: "Basics", cats: ["passwords", "authentication", "web_security", "network_security"] },
  { key: "phishing", label: "Phishing", cats: ["phishing"] },
  { key: "privacy", label: "Privacy", cats: ["privacy", "cloud"] },
  { key: "scams", label: "Scam Awareness", cats: ["upi", "qr", "jobs", "investment", "social_engineering", "ai_security"] },
  { key: "threats", label: "Malware & Ransomware", cats: ["malware", "ransomware", "mobile"] },
  { key: "laws", label: "Cyber Laws", cats: ["cyber_law"] },
  { key: "response", label: "If It Happens", cats: ["incident_response"] },
];

interface Challenge { id: string; question: string; options: string[]; kind: string; category: string; date: string; attempt: QuizResult | null }

function QuizGate() {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-dashed bg-background-2 p-4">
      <Lock className="size-4 text-muted-foreground" />
      <span className="text-sm text-muted-foreground">Sign in to take this quiz.</span>
      <div className="flex gap-2">
        <Button size="sm" asChild><Link to="/login?mode=register">Create account</Link></Button>
        <Button size="sm" variant="outline" asChild><Link to="/login">Sign in</Link></Button>
      </div>
    </div>
  );
}

export function LearnPage() {
  const { user } = useAuth();
  const locked = !user;
  const lessons = useQuery({ queryKey: ["lessons"], queryFn: () => apiFetch<LessonSummary[]>("/awareness") });
  const daily = useLearnDaily();
  const progress = useProgress();
  const [slug, setSlug] = useState<string | null>(null);
  const [group, setGroup] = useState("all");
  const [level, setLevel] = useState("");
  const done = new Set(progress.data?.completed_slugs ?? []);

  const groups = useMemo(() => GROUPS.filter((g) => (lessons.data ?? []).some((l) => g.cats.includes(l.category))), [lessons.data]);
  const filtered = (lessons.data ?? []).filter((l) =>
    (group === "all" || GROUPS.find((g) => g.key === group)?.cats.includes(l.category)) && (!level || l.difficulty === level));
  const featured = daily.data?.lesson;
  const tip = daily.data?.tip;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Learning Hub</h1>
        <p className="mt-1 text-muted-foreground">Improve your cybersecurity knowledge with easy guides and interactive content.</p>
      </div>

      {/* Today's lesson + tip */}
      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        {featured ? (
          <button onClick={() => setSlug(featured.slug)}
            className="group grid overflow-hidden rounded-2xl border bg-card text-left shadow-elev transition-colors hover:border-primary/50 sm:grid-cols-[1fr_1.1fr]">
            <div className="aspect-[16/9] sm:aspect-auto"><TopicArt topic={topicFor(featured.category)} /></div>
            <div className="flex flex-col p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="default"><Sparkles className="size-3" /> Today's lesson</Badge>
                {daily.data?.revision && <Badge variant="secondary">Revision</Badge>}
                {done.has(featured.slug) && <Badge variant="success"><CheckCircle2 className="size-3" /> Completed</Badge>}
              </div>
              <h2 className="mt-3 font-display text-xl font-semibold">{featured.title}</h2>
              <p className="mt-1 flex-1 text-sm text-muted-foreground">{featured.objective ?? featured.summary}</p>
              <div className="mt-3 flex items-center gap-3 text-xs text-subtle">
                <span>{categoryLabel(featured.category)}</span><span className="capitalize">{featured.difficulty}</span>
                <span className="inline-flex items-center gap-1"><Clock className="size-3.5" />{featured.read_minutes} min</span>
              </div>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">Start lesson <ArrowRight className="size-4" /></span>
            </div>
          </button>
        ) : <div className="h-52 animate-pulse rounded-2xl bg-muted" />}

        <aside className="relative overflow-hidden rounded-2xl border bg-card p-5 shadow-elev">
          <div aria-hidden className="absolute -right-10 -top-10 size-40 rounded-full bg-warning/10 blur-3xl" />
          <h2 className="relative flex items-center gap-2 font-display text-lg font-semibold"><Lightbulb className="size-5 text-warning" /> Today's tip</h2>
          {tip ? (
            <div className="relative">
              <p className="mt-3 font-medium">{tip.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{tip.description}</p>
              <p className="mt-3 rounded-lg border bg-background-2 p-3 text-sm"><span className="font-medium text-primary">Do this: </span>{tip.recommendation}</p>
              {tip.related_lesson && (
                <button onClick={() => setSlug(tip.related_lesson!)} className="mt-3 text-sm font-medium text-primary hover:underline">Related lesson →</button>
              )}
            </div>
          ) : <div className="mt-3 h-24 animate-pulse rounded-lg bg-muted" />}
        </aside>
      </div>

      {/* Progress */}
      {user ? (
        progress.data && (
          <section aria-labelledby="prog-title" className="rounded-2xl border bg-card p-5 shadow-elev">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="prog-title" className="font-display text-lg font-semibold">Your progress</h2>
              <Button size="sm" asChild><Link to="/app/quiz"><ListChecks /> Today's quiz</Link></Button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              <Stat icon={<BookOpen />} value={`${progress.data.lessons_completed}/${progress.data.lessons_total}`} label="Lessons completed" />
              <Stat icon={<Flame />} value={String(progress.data.streak_days)} label={`Day streak`} />
              <Stat icon={<Target />} value={progress.data.questions_answered ? `${Math.round(progress.data.correct_answers / progress.data.questions_answered * 100)}%` : "—"} label="Quiz accuracy" />
              <Stat icon={<ListChecks />} value={String(progress.data.quiz_attempts)} label="Quizzes taken" />
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary" aria-label={`${progress.data.lessons_completed} of ${progress.data.lessons_total} lessons completed`}>
              <div className="h-full rounded-full bg-primary" style={{ width: `${progress.data.lessons_total ? progress.data.lessons_completed / progress.data.lessons_total * 100 : 0}%` }} />
            </div>
            {progress.data.recommendations.lessons.length > 0 && (
              <p className="mt-3 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Recommended: </span>
                {progress.data.recommendations.lessons.map((s, n) => (
                  <span key={s}>{n > 0 && ", "}<button className="text-primary hover:underline" onClick={() => setSlug(s)}>{(lessons.data ?? []).find((l) => l.slug === s)?.title ?? s}</button></span>
                ))}
                {" — "}{progress.data.recommendations.reason}
              </p>
            )}
          </section>
        )
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/25 bg-primary/[0.06] px-4 py-3">
          <div className="flex items-center gap-2 text-sm"><Lock className="size-4 text-primary" /> Read every lesson as a guest. Sign in to take quizzes and track progress.</div>
          <div className="flex gap-2">
            <Button size="sm" asChild><Link to="/login?mode=register">Create account</Link></Button>
            <Button size="sm" variant="outline" asChild><Link to="/login">Sign in</Link></Button>
          </div>
        </div>
      )}

      {/* Library */}
      <section aria-labelledby="lib-title">
        <h2 id="lib-title" className="sr-only">All lessons</h2>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by topic">
          {[{ key: "all", label: "All" }, ...groups].map((g) => (
            <button key={g.key} onClick={() => setGroup(g.key)} aria-pressed={group === g.key}
              className={cn("rounded-lg border px-4 py-1.5 text-sm font-medium transition-colors",
                group === g.key ? "border-primary bg-primary text-primary-foreground shadow-glow" : "bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground")}>
              {g.label}
            </button>
          ))}
          <span className="relative ml-auto">
            <select aria-label="Difficulty" value={level} onChange={(e) => setLevel(e.target.value)}
              className="h-9 appearance-none rounded-lg border bg-card pl-3 pr-9 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <option value="">Any level</option><option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option><option value="advanced">Advanced</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
          </span>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {lessons.isLoading && [0, 1, 2].map((i) => <div key={i} className="h-72 animate-pulse rounded-2xl bg-muted" />)}
          {lessons.isError && <div className="sm:col-span-2 xl:col-span-3"><ErrorState message="Couldn't load lessons." onRetry={() => lessons.refetch()} /></div>}
          {filtered.map((l) => (
            <button key={l.slug} onClick={() => setSlug(l.slug)}
              className="group overflow-hidden rounded-2xl border bg-card text-left shadow-elev transition-all hover:-translate-y-0.5 hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <div className="relative aspect-[16/9] overflow-hidden">
                <TopicArt topic={topicFor(l.category)} className="transition-transform duration-500 group-hover:scale-105" />
                {done.has(l.slug) && (
                  <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-md bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
                    <CheckCircle2 className="size-3.5" /> Completed
                  </span>
                )}
              </div>
              <div className="p-4">
                <h3 className="font-display text-lg font-semibold">{l.title}</h3>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{l.summary}</p>
                <div className="mt-3 flex items-center gap-3 text-xs text-subtle">
                  <span className="inline-flex items-center gap-1"><Clock className="size-3.5" />{l.read_minutes} min</span>
                  <span className="capitalize">{l.difficulty}</span>
                  <span>{categoryLabel(l.category)}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
        {lessons.data && filtered.length === 0 && <EmptyState icon={<BookOpen className="size-8" />} title="No lessons match these filters" />}
      </section>

      <DailyChallenge locked={locked} />
      <PreviousTips />

      <Dialog open={Boolean(slug)} onOpenChange={(o) => { if (!o) setSlug(null); }}>
        <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto p-0">
          {slug && <LessonView slug={slug} locked={locked} onOpen={setSlug} completed={done.has(slug)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-background-2 p-3">
      <span className="flex size-9 items-center justify-center rounded-lg bg-primary/12 text-primary [&_svg]:size-4">{icon}</span>
      <div><div className="font-display text-lg font-bold leading-none">{value}</div><div className="mt-0.5 text-xs text-muted-foreground">{label}</div></div>
    </div>
  );
}

function DailyChallenge({ locked }: { locked: boolean }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const c = useQuery({ queryKey: ["challenge", user?.id], queryFn: () => apiFetch<Challenge>("/challenges/daily"), retry: false });
  const answer = useMutation({
    mutationFn: (choice: number) => apiFetch<QuizResult>("/challenges/daily", { method: "POST", body: JSON.stringify({ choice }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["learn", "progress"] }),
  });
  if (!c.data) return null;
  const result = answer.data ?? c.data.attempt;
  const r = result?.results[0];
  return (
    <section className="relative overflow-hidden rounded-2xl border border-primary/30 bg-card p-5 shadow-elev sm:p-6">
      <div aria-hidden className="absolute -right-16 -top-16 size-48 rounded-full bg-primary/10 blur-3xl" />
      <div className="relative">
        <Badge variant="default"><Sparkles className="size-3" /> Daily security challenge</Badge>
        <p className="mt-3 font-medium">{c.data.question}</p>
        {locked ? <QuizGate /> : (
          <>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {c.data.options.map((o, i) => {
                const correct = r && i === r.answer_index;
                const wrong = r && i === r.choice && !r.correct;
                return (
                  <button key={o} disabled={Boolean(r) || answer.isPending} onClick={() => answer.mutate(i)}
                    className={cn("flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                      !r && "hover:border-primary/50 hover:bg-primary/5", correct && "border-success bg-success-soft text-success",
                      wrong && "border-danger bg-danger-soft text-danger")}>
                    {o}{correct && <CheckCircle2 className="size-4 shrink-0" aria-label="Correct answer" />}
                  </button>
                );
              })}
            </div>
            {r && (
              <p role="status" className="mt-3 text-sm text-muted-foreground">
                <span className={r.correct ? "font-medium text-success" : "font-medium text-danger"}>{r.correct ? "Correct. " : "Not quite. "}</span>{r.explanation}
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function PreviousTips() {
  const [open, setOpen] = useState(false);
  const tips = usePreviousTips();
  if (!tips.data || tips.data.length < 2) return null;
  return (
    <section className="rounded-2xl border bg-card shadow-elev">
      <button onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center justify-between px-5 py-4 text-left">
        <span className="flex items-center gap-2 font-display text-lg font-semibold"><History className="size-5 text-primary" /> Previous tips</span>
        <ChevronDown className={cn("size-4 text-subtle transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <ul className="divide-y border-t">
          {tips.data.map((t) => (
            <li key={t.date} className="px-5 py-3">
              <div className="text-xs text-subtle">{fmtDate(`${t.date}T12:00:00`)}</div>
              <div className="font-medium">{t.title}</div>
              <div className="text-sm text-muted-foreground">{t.recommendation}</div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function LessonView({ slug, locked, onOpen, completed }: { slug: string; locked: boolean; onOpen: (s: string) => void; completed: boolean }) {
  const { data, isLoading, isError } = useQuery({ queryKey: ["lesson", slug], queryFn: () => apiFetch<Lesson>(`/awareness/${slug}`) });
  const mark = useMarkLesson();
  const qc = useQueryClient();
  const submit = useMutation({
    mutationFn: (answers: Record<string, number>) => apiFetch<QuizResult>(`/awareness/${slug}/quiz`, { method: "POST", body: JSON.stringify({ answers }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["learn", "progress"] }),
  });

  // Record the view for signed-in learners.
  useEffect(() => {
    if (data && !locked) mark.mutate({ slug: data.slug, completed: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.slug, locked]);

  if (isError) return <div className="p-6"><DialogTitle>Lesson unavailable</DialogTitle><DialogDescription>Couldn't load this lesson.</DialogDescription></div>;
  if (isLoading || !data) return <div className="p-6"><DialogTitle className="sr-only">Loading lesson</DialogTitle><div className="h-40 animate-pulse rounded-xl bg-muted" /></div>;
  const quiz = data.quiz ?? [];
  return (
    <div>
      <div className="aspect-[16/7] overflow-hidden"><TopicArt topic={topicFor(data.category)} /></div>
      <div className="space-y-5 p-6">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge variant="default">{categoryLabel(data.category)}</Badge>
            <span className="capitalize text-subtle">{data.difficulty}</span>
            {completed && <Badge variant="success"><CheckCircle2 className="size-3" /> Completed</Badge>}
          </div>
          <DialogTitle className="mt-2 font-display text-2xl">{data.title}</DialogTitle>
          <DialogDescription className="mt-1 flex items-center gap-1.5 text-xs">
            <Clock className="size-3.5" /> {data.read_minutes} min read{quiz.length > 0 && <> · {quiz.length} quiz question{quiz.length > 1 ? "s" : ""}</>}
          </DialogDescription>
        </div>
        {data.objective && <p className="rounded-lg border-l-4 border-primary bg-primary/[0.06] px-4 py-2 text-sm"><span className="font-semibold">Goal: </span>{data.objective}</p>}
        <div className="space-y-3 leading-relaxed">{data.body_md.split(/\n\n+/).map((p, i) => <p key={i}>{p}</p>)}</div>
        {data.example && (
          <div className="rounded-xl border bg-background-2 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-subtle">Realistic example</div>
            <p className="mt-1 text-sm">{data.example}</p>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          {data.warning_signs.length > 0 && (
            <div>
              <h3 className="flex items-center gap-1.5 font-semibold"><AlertTriangle className="size-4 text-warning" /> Warning signs</h3>
              <ul className="mt-2 space-y-1.5 text-sm">{data.warning_signs.map((w) => <li key={w} className="flex gap-2"><span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-warning" />{w}</li>)}</ul>
            </div>
          )}
          {data.prevention.length > 0 && (
            <div>
              <h3 className="flex items-center gap-1.5 font-semibold"><ShieldCheck className="size-4 text-primary" /> How to stay safe</h3>
              <ul className="mt-2 space-y-1.5 text-sm">{data.prevention.map((w) => <li key={w} className="flex gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />{w}</li>)}</ul>
            </div>
          )}
        </div>
        {(data.sources.length > 0 || data.related.length > 0) && (
          <div className="flex flex-wrap gap-x-6 gap-y-2 border-t pt-4 text-sm">
            {data.sources.map((s) => <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">{s.label} <ExternalLink className="size-3.5" /></a>)}
            {data.related.length > 0 && <span className="text-muted-foreground">Related: {data.related.map((r, n) => <span key={r}>{n > 0 && ", "}<button className="text-primary hover:underline" onClick={() => onOpen(r)}>{r.replace(/-/g, " ")}</button></span>)}</span>}
          </div>
        )}
        <div className="border-t pt-5">
          <h3 className="font-display text-lg font-semibold">Check your understanding</h3>
          {quiz.length === 0 ? (
            !locked && <Button className="mt-3" variant="outline" onClick={() => mark.mutate({ slug: data.slug, completed: true })} disabled={completed}>
              <CheckCircle2 /> {completed ? "Completed" : "Mark as completed"}
            </Button>
          ) : locked ? <QuizGate /> : (
            <div className="mt-3">
              <QuizRunner questions={quiz} result={submit.data} submitting={submit.isPending} onSubmit={(a) => submit.mutate(a)}
                onReset={() => submit.reset()} submitLabel="Check answers" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
