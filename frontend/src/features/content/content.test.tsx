import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ArticleRow, FreshnessBanner, SeverityBadge } from "./components";
import { QuizRunner, QuizResults } from "./QuizRunner";
import type { Article, Freshness, QuizQuestion } from "./api";

const base: Article = {
  id: "1", title: "Use-after-free in curl", summary: "Patch now.", source: "CERT-In", source_key: "certin-home",
  source_url: "https://www.cert-in.org.in/x", category: "vulnerability", category_label: "Vulnerabilities",
  category_origin: "system", kind: "vulnerability", region: "IN", severity: "info", severity_origin: "none",
  published_at: "2026-10-26T00:00:00+00:00", source_updated_at: null, ingested_at: "2026-10-26T08:00:00+00:00",
  last_verified_at: null, tags: [],
};

const fresh = (state: Freshness["state"], extra: Partial<Freshness> = {}): Freshness => ({
  section: "news", state, stale: state === "stale", last_refresh_at: state === "never_refreshed" ? null : "2026-10-26T08:00:00Z",
  newest_item_published_at: null, sources_enabled: 7, sources_failing: 0, sources_paused: 0, unavailable_sources: [],
  stale_after_hours: 12, ...extra,
});

describe("freshness", () => {
  it("labels stale and failing content explicitly", () => {
    const { rerender } = render(<FreshnessBanner f={fresh("stale")} />);
    expect(screen.getByText(/May be out of date/)).toBeTruthy();
    rerender(<FreshnessBanner f={fresh("partial", { sources_failing: 1, unavailable_sources: ["CISA News"] })} />);
    expect(screen.getByText(/Some sources unavailable/)).toBeTruthy();
    expect(screen.getByText(/CISA News/)).toBeTruthy();
    rerender(<FreshnessBanner f={fresh("never_refreshed")} />);
    expect(screen.getByText(/Last refreshed never/)).toBeTruthy();
  });
});

describe("articles", () => {
  it("never presents a missing source date as a real date", () => {
    render(<ArticleRow a={{ ...base, published_at: null }} thumb={false} />);
    expect(screen.getByText(/Date not given by the source/)).toBeTruthy();
    expect(screen.getByRole("link", { name: /Read source/ }).getAttribute("href")).toBe(base.source_url);
  });

  it("shows severity only when someone rated it, and says who", () => {
    const { container, rerender } = render(<SeverityBadge a={base} />);
    expect(container.textContent).toBe("");
    rerender(<SeverityBadge a={{ ...base, severity: "high", severity_origin: "source" }} />);
    expect(screen.getByText(/Rated by the source/)).toBeTruthy();
    rerender(<SeverityBadge a={{ ...base, severity: "high", severity_origin: "system" }} />);
    expect(screen.getByText(/known exploited/)).toBeTruthy();
  });
});

const qs: QuizQuestion[] = [
  { id: "q1", type: "true_false", prompt: "PIN to receive money?", options: ["True", "False"], difficulty: "beginner", category: "upi", lesson: null },
  { id: "q2", type: "single", prompt: "Who gets your OTP?", options: ["Bank", "Nobody"], difficulty: "beginner", category: "upi", lesson: null },
];

describe("quiz runner", () => {
  it("collects answers and submits only answers (no score)", () => {
    const onSubmit = vi.fn();
    render(<QuizRunner questions={qs} onSubmit={onSubmit} />);
    expect(screen.getByText(/Question 1 of 2/)).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: "False" }));
    fireEvent.click(screen.getByRole("button", { name: /Next/ }));
    fireEvent.click(screen.getByRole("radio", { name: "Nobody" }));
    fireEvent.click(screen.getByRole("button", { name: /Submit answers/ }));
    expect(onSubmit).toHaveBeenCalledWith({ q1: 1, q2: 1 });
  });

  it("shows server-graded results with explanations", () => {
    render(<QuizResults questions={qs} result={{
      score: 1, total: 2, already_submitted: false, recorded: false, submitted_at: "",
      results: [
        { id: "q1", choice: 1, correct: true, answer_index: 1, explanation: "Never needed.", lesson: null },
        { id: "q2", choice: 0, correct: false, answer_index: 1, explanation: "No one asks.", lesson: null },
      ],
    }} />);
    expect(screen.getByText(/1 \/ 2/)).toBeTruthy();
    expect(screen.getByText("No one asks.")).toBeTruthy();
    expect(screen.getByText(/Sign in to save your results/)).toBeTruthy();
  });
});
