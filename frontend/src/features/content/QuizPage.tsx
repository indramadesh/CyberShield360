import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CalendarCheck, CalendarRange, Dumbbell, Undo2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { useAuth } from "@/features/auth/useAuth";
import { apiFetch } from "@/services/api";
import { cn } from "@/lib/utils";
import { categoryLabel, useQuizSet, useSubmitQuiz, type QuizQuestion, type QuizResult } from "./api";
import { QuizResults, QuizRunner } from "./QuizRunner";

type Tab = "daily" | "weekly" | "practice" | "review";

function ScheduledQuiz({ kind }: { kind: "daily" | "weekly" }) {
  const set = useQuizSet(kind);
  const submit = useSubmitQuiz(`/quiz/${kind}`);
  if (set.isLoading) return <div className="h-48 animate-pulse rounded-xl bg-muted" />;
  if (set.isError) return <ErrorState message="Couldn't load the quiz." onRetry={() => set.refetch()} />;
  const d = set.data!;
  if (!d.available) return <EmptyState title="No quiz available" description="The question bank is empty." />;
  const done = submit.data ?? d.attempt ?? null;
  return (
    <div>
      <p className="mb-4 text-sm text-muted-foreground">
        {kind === "daily" ? `Today's ${d.questions.length} questions (${d.period}) — the same for everyone today.` : `This week's ${d.questions.length}-question assessment (${d.period}).`}
        {" "}Your answers are checked on the server.
      </p>
      <QuizRunner questions={d.questions} result={done} submitting={submit.isPending}
        onSubmit={(answers) => submit.mutate({ answers })} />
    </div>
  );
}

function Practice() {
  const [category, setCategory] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [round, setRound] = useState(0);
  const [result, setResult] = useState<QuizResult | null>(null);
  const cats = useQuery({ queryKey: ["quiz", "categories"], queryFn: () => apiFetch<{ category: string; total: number }[]>("/quiz/categories") });
  const set = useQuery({
    queryKey: ["quiz", "practice", category, difficulty, round],
    queryFn: () => {
      const p = new URLSearchParams({ limit: "5" });
      if (category) p.set("category", category);
      if (difficulty) p.set("difficulty", difficulty);
      return apiFetch<{ questions: QuizQuestion[]; available: number; note: string | null }>(`/quiz/practice?${p}`);
    },
    staleTime: Infinity,
  });
  const submit = useSubmitQuiz("/quiz/practice");
  const sel = "h-10 appearance-none rounded-lg border bg-card pl-3 pr-9 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  const next = () => { setResult(null); submit.reset(); setRound((r) => r + 1); };

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        <span className="relative">
          <select aria-label="Topic" className={sel} value={category} onChange={(e) => { setCategory(e.target.value); setResult(null); }}>
            <option value="">All topics</option>
            {(cats.data ?? []).map((c) => <option key={c.category} value={c.category}>{categoryLabel(c.category)} ({c.total})</option>)}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
        </span>
        <span className="relative">
          <select aria-label="Difficulty" className={sel} value={difficulty} onChange={(e) => { setDifficulty(e.target.value); setResult(null); }}>
            <option value="">Any level</option><option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option><option value="advanced">Advanced</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
        </span>
      </div>
      {set.data?.note && <p className="mb-3 text-sm text-warning">{set.data.note}</p>}
      {set.isLoading ? <div className="h-48 animate-pulse rounded-xl bg-muted" /> : set.data && set.data.questions.length > 0 ? (
        <QuizRunner key={`${category}-${difficulty}-${round}`} questions={set.data.questions} result={result} submitting={submit.isPending}
          onSubmit={(answers) => submit.mutate({ answers, ids: set.data!.questions.map((q) => q.id) }, { onSuccess: setResult })}
          onReset={next} submitLabel="Check answers" />
      ) : <EmptyState title="No questions match" description="Choose another topic or level." />}
    </div>
  );
}

function Review() {
  const { user } = useAuth();
  const review = useQuery({
    queryKey: ["quiz", "review", user?.id],
    queryFn: () => apiFetch<(QuizQuestion & { answer_index: number; explanation: string })[]>("/quiz/review"),
    enabled: Boolean(user),
  });
  if (!user) return <EmptyState title="Sign in to review your mistakes" description="We keep track of questions you got wrong so you can revisit them."
    action={<Button asChild><Link to="/login">Sign in</Link></Button>} />;
  if (review.isLoading) return <div className="h-32 animate-pulse rounded-xl bg-muted" />;
  const items = review.data ?? [];
  if (!items.length) return <EmptyState title="Nothing to review" description="Questions you answer incorrectly will appear here." />;
  return (
    <QuizResults questions={items} result={{
      score: 0, total: items.length, already_submitted: false, recorded: true, submitted_at: "",
      results: items.map((q) => ({ id: q.id, choice: null, correct: false, answer_index: q.answer_index, explanation: q.explanation, lesson: q.lesson })),
    }} />
  );
}

const TABS: { key: Tab; label: string; icon: typeof CalendarCheck }[] = [
  { key: "daily", label: "Today's Quiz", icon: CalendarCheck },
  { key: "weekly", label: "Weekly Assessment", icon: CalendarRange },
  { key: "practice", label: "Practice", icon: Dumbbell },
  { key: "review", label: "Review Mistakes", icon: Undo2 },
];

export function QuizPage() {
  const [tab, setTab] = useState<Tab>("daily");
  return (
    <div className="max-w-4xl">
      <div className="mb-5">
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Daily Cybersecurity Quiz</h1>
        <p className="mt-1 text-muted-foreground">Five fresh questions every day from a reviewed question bank, plus a weekly assessment and topic practice.</p>
      </div>
      <div role="tablist" aria-label="Quiz type" className="flex flex-wrap gap-2">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
              className={cn("inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors",
                tab === t.key ? "border-primary bg-primary text-primary-foreground shadow-glow" : "bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground")}>
              <Icon className="size-4" /> {t.label}
            </button>
          );
        })}
      </div>
      <div className="mt-5 rounded-2xl border bg-card p-5 shadow-elev sm:p-6">
        {tab === "daily" && <ScheduledQuiz kind="daily" />}
        {tab === "weekly" && <ScheduledQuiz kind="weekly" />}
        {tab === "practice" && <Practice />}
        {tab === "review" && <Review />}
      </div>
    </div>
  );
}
