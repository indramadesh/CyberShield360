import { useState } from "react";
import { CheckCircle2, XCircle, ChevronLeft, ChevronRight, Trophy, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { categoryLabel, type QuizQuestion, type QuizResult } from "./api";

const TYPE_LABEL: Record<string, string> = {
  single: "Multiple choice", true_false: "True or false", scenario: "Scenario", indicator: "Spot the indicator", next_action: "Safest next action",
};

/** Answers are collected locally and graded by the server; keys arrive only with the result. */
export function QuizRunner({ questions, onSubmit, submitting, result, onReset, submitLabel = "Submit answers" }: {
  questions: QuizQuestion[];
  onSubmit: (answers: Record<string, number>) => void;
  submitting?: boolean;
  result?: QuizResult | null;
  onReset?: () => void;
  submitLabel?: string;
}) {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [i, setI] = useState(0);
  if (result) return <QuizResults questions={questions} result={result} onReset={onReset} />;
  if (!questions.length) return null;
  const q = questions[i];
  const answered = Object.keys(answers).length;
  const last = i === questions.length - 1;

  return (
    <div>
      <div className="flex items-center justify-between text-xs text-subtle">
        <span>Question {i + 1} of {questions.length} · {TYPE_LABEL[q.type] ?? q.type} · {categoryLabel(q.category)} · <span className="capitalize">{q.difficulty}</span></span>
        <span>{answered}/{questions.length} answered</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary" aria-hidden>
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(answered / questions.length) * 100}%` }} />
      </div>
      <fieldset className="mt-4">
        <legend className="font-medium leading-relaxed">{q.prompt}</legend>
        <div className="mt-3 grid gap-2 sm:grid-cols-2" role="radiogroup">
          {q.options.map((o, idx) => {
            const on = answers[q.id] === idx;
            return (
              <button key={o} type="button" role="radio" aria-checked={on} onClick={() => setAnswers({ ...answers, [q.id]: idx })}
                className={cn("rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                  on ? "border-primary bg-primary/10 font-medium text-primary" : "hover:border-primary/40 hover:bg-primary/5")}>
                {o}
              </button>
            );
          })}
        </div>
      </fieldset>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" disabled={i === 0} onClick={() => setI(i - 1)}><ChevronLeft /> Previous</Button>
        {last ? (
          <Button onClick={() => onSubmit(answers)} loading={submitting} disabled={answered === 0}>
            {submitLabel}{answered < questions.length ? ` (${questions.length - answered} unanswered)` : ""}
          </Button>
        ) : (
          <Button variant="outline" onClick={() => setI(i + 1)}>Next <ChevronRight /></Button>
        )}
      </div>
    </div>
  );
}

export function QuizResults({ questions, result, onReset }: { questions: QuizQuestion[]; result: QuizResult; onReset?: () => void }) {
  const byId = Object.fromEntries(questions.map((q) => [q.id, q]));
  const pct = result.total ? Math.round((result.score / result.total) * 100) : 0;
  return (
    <div>
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-primary/30 bg-primary/[0.06] p-4">
        <Trophy className="size-8 text-primary" aria-hidden />
        <div>
          <div className="font-display text-2xl font-bold">{result.score} / {result.total} <span className="text-base font-medium text-muted-foreground">({pct}%)</span></div>
          <div className="text-sm text-muted-foreground">
            {result.already_submitted ? "You already completed this — showing your recorded result." : result.recorded ? "Saved to your progress." : "Sign in to save your results and track progress."}
          </div>
        </div>
        {onReset && <Button variant="outline" className="ml-auto" onClick={onReset}><RotateCcw /> Try another set</Button>}
      </div>
      <ol className="mt-4 space-y-3">
        {result.results.map((r, n) => {
          const q = byId[r.id];
          if (!q) return null;
          return (
            <li key={r.id} className="rounded-xl border bg-background-2 p-4">
              <div className="flex items-start gap-2.5">
                {r.correct ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-label="Correct" /> : <XCircle className="mt-0.5 size-5 shrink-0 text-danger" aria-label="Incorrect" />}
                <div className="min-w-0">
                  <p className="font-medium">{n + 1}. {q.prompt}</p>
                  <p className="mt-1 text-sm">
                    <span className="text-muted-foreground">Correct answer: </span><span className="font-medium text-success">{q.options[r.answer_index]}</span>
                    {!r.correct && r.choice !== null && <><span className="text-muted-foreground"> · Your answer: </span><span className="text-danger">{q.options[r.choice]}</span></>}
                    {r.choice === null && <span className="text-muted-foreground"> · Not answered</span>}
                  </p>
                  <p className="mt-1.5 text-sm text-muted-foreground">{r.explanation}</p>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
