/**
 * Typed client for the content-intelligence API. All dynamic content comes from
 * the backend (which does the fetching); the browser never contacts third-party sites.
 */
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/services/api";
import { useAuth } from "@/features/auth/useAuth";
import { useConfig } from "@/config/useConfig";

// ---------------- Types ----------------

export type ArticleKind = "news" | "advisory" | "vulnerability" | "alert";

export interface Article {
  id: string; title: string; summary: string; source: string; source_key: string | null;
  source_url: string; category: string; category_label: string; category_origin: string | null;
  kind: ArticleKind; region: string; severity: string; severity_origin: "source" | "system" | "none";
  /** The SOURCE's own publication date; null when the source gives none. */
  published_at: string | null; source_updated_at: string | null; ingested_at: string | null;
  last_verified_at: string | null; tags: string[];
}

export interface Freshness {
  section: string; state: "fresh" | "partial" | "stale" | "never_refreshed" | "no_sources";
  stale: boolean; last_refresh_at: string | null; newest_item_published_at: string | null;
  sources_enabled: number; sources_failing: number; sources_paused: number;
  unavailable_sources: string[]; stale_after_hours: number;
}

export interface UpdatesPage { items: Article[]; total: number; page: number; page_size: number; has_more: boolean; freshness: Freshness }

export interface LegalRecord {
  id: string; slug: string; title: string; authority: string; jurisdiction: string | null;
  document_type: string | null; legal_status: string | null; legal_status_label: string;
  commencement_status: string | null; document_ref: string | null; amends: string | null;
  related_legislation: string[]; publication_date: string | null; effective_date: string | null;
  official_source: string; plain_summary: string; summary_provenance: string | null;
  verification_status: string | null; last_checked_at: string | null;
  versions?: { version: number; captured_at: string; legal_status: string; etag: string | null; last_modified: string | null; size_bytes: number | null }[];
}

export interface LessonSummary { slug: string; category: string; title: string; summary: string; difficulty: string; read_minutes: number }
export interface Lesson extends LessonSummary {
  objective: string | null; body_md: string; example: string | null; warning_signs: string[]; prevention: string[];
  related: string[]; sources: { label: string; url: string }[]; review_status: string | null; updated_at: string | null;
  quiz?: QuizQuestion[];
}
export interface Tip { slug: string; title: string; description: string; recommendation: string; category: string; related_lesson: string | null; date?: string }

export interface QuizQuestion { id: string; type: string; prompt: string; options: string[]; difficulty: string; category: string; lesson: string | null }
export interface QuizResultItem { id: string; choice: number | null; correct: boolean; answer_index: number; explanation: string; lesson: string | null }
export interface QuizResult { score: number; total: number; already_submitted: boolean; recorded?: boolean; submitted_at: string; results: QuizResultItem[] }
export interface QuizSet { available: boolean; period?: string; questions: QuizQuestion[]; attempt?: QuizResult | null }

export interface Progress {
  lessons_total: number; lessons_viewed: number; lessons_completed: number; completed_slugs: string[];
  quiz_attempts: number; questions_answered: number; correct_answers: number;
  proficiency: { category: string; correct: number; answered: number; accuracy: number }[];
  streak_days: number; last_activity: string | null;
  recommendations: { weak_categories: string[]; lessons: string[]; reason: string };
  recent_attempts: { kind: string; period: string; score: number; total: number; submitted_at: string }[];
}

// ---------------- Helpers ----------------

/** API timestamps: aware ISO strings, or naive UTC — treat naive as UTC. */
export const parseDate = (iso: string) => new Date(/(Z|[+-]\d\d:?\d\d)$/i.test(iso) ? iso : `${iso}Z`);

export function fmtDate(iso: string | null | undefined, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) {
  return iso ? parseDate(iso).toLocaleDateString(undefined, opts) : "";
}

export function fmtDateTime(iso: string | null | undefined) {
  return iso ? parseDate(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "";
}

export function fmtRelative(iso: string | null | undefined) {
  if (!iso) return "never";
  const diff = (Date.now() - parseDate(iso).getTime()) / 1000;
  if (diff < 90) return "just now";
  if (diff < 3600) return `${Math.round(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)} h ago`;
  return `${Math.round(diff / 86400)} d ago`;
}

export const CATEGORY_LABELS: Record<string, string> = {
  phishing: "Phishing", passwords: "Passwords", authentication: "Authentication", social_engineering: "Social engineering",
  malware: "Malware", ransomware: "Ransomware", web_security: "Web security", network_security: "Network security",
  mobile: "Mobile security", upi: "Online payments", qr: "QR codes", privacy: "Privacy", cloud: "Cloud security",
  ai_security: "AI security", cyber_law: "Cyber law", incident_response: "Incident response", jobs: "Job scams",
  investment: "Investment scams",
};
export const categoryLabel = (c: string) => CATEGORY_LABELS[c] ?? c.replace(/[_-]/g, " ").replace(/^\w/, (x) => x.toUpperCase());

// ---------------- Hooks ----------------

export interface UpdatesFilter { kind?: ArticleKind; category?: string; region?: string; source?: string; q?: string; days?: number }

export function useUpdates(filter: UpdatesFilter, pageSize = 20) {
  const { data: config } = useConfig();
  return useInfiniteQuery({
    queryKey: ["updates", filter, pageSize],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => {
      const p = new URLSearchParams({ page: String(pageParam), page_size: String(pageSize) });
      Object.entries(filter).forEach(([k, v]) => { if (v !== undefined && v !== "") p.set(k, String(v)); });
      return apiFetch<UpdatesPage>(`/updates?${p}`);
    },
    getNextPageParam: (last) => (last.has_more ? last.page + 1 : undefined),
    enabled: config?.features?.cyber_news ?? false,
    refetchInterval: 5 * 60_000, // new items appear without a reload
    staleTime: 60_000,
  });
}

export function useTodayUpdates() {
  const { data: config } = useConfig();
  return useQuery({
    queryKey: ["updates", "today"],
    queryFn: () => apiFetch<{ date: string; timezone: string; fallback: boolean; items: Article[]; critical: Article[]; freshness: Freshness }>("/updates/today"),
    enabled: config?.features?.cyber_news ?? false,
    refetchInterval: 5 * 60_000,
  });
}

export function useSources() {
  return useQuery({
    queryKey: ["updates", "sources"],
    queryFn: () => apiFetch<{ key: string; name: string; category: string; jurisdiction: string; trust: string; url: string; attribution: string; state: string; last_success_at: string | null; items: number }[]>("/updates/sources"),
    staleTime: 5 * 60_000,
  });
}

export function useLegal() {
  return useQuery({ queryKey: ["legal"], queryFn: () => apiFetch<{ items: LegalRecord[]; statuses: Record<string, string>; freshness: Freshness; notice: string }>("/legal") });
}

export function useLegalDetail(slug: string | null) {
  return useQuery({ queryKey: ["legal", slug], queryFn: () => apiFetch<LegalRecord>(`/legal/${slug}`), enabled: Boolean(slug) });
}

export function useLearnDaily() {
  const { data: config } = useConfig();
  return useQuery({
    queryKey: ["learn", "daily"],
    queryFn: () => apiFetch<{ date: string; timezone: string; lesson: Lesson | null; revision: boolean; tip: Tip | null }>("/learn/daily"),
    enabled: config?.features?.awareness ?? false,
    staleTime: 10 * 60_000,
  });
}

export function usePreviousTips() {
  return useQuery({ queryKey: ["learn", "tips"], queryFn: () => apiFetch<Tip[]>("/learn/tips?limit=14") });
}

export function useProgress() {
  const { user } = useAuth();
  return useQuery({ queryKey: ["learn", "progress", user?.id], queryFn: () => apiFetch<Progress>("/learn/progress"), enabled: Boolean(user) });
}

export function useMarkLesson() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ slug, completed }: { slug: string; completed: boolean }) =>
      apiFetch(`/learn/progress/${slug}`, { method: "POST", body: JSON.stringify({ completed }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["learn", "progress"] }),
  });
}

export function useQuizSet(kind: "daily" | "weekly") {
  const { user } = useAuth();
  return useQuery({ queryKey: ["quiz", kind, user?.id], queryFn: () => apiFetch<QuizSet>(`/quiz/${kind}`) });
}

export function useSubmitQuiz(path: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { answers: Record<string, number>; ids?: string[] }) =>
      apiFetch<QuizResult>(path, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quiz"] });
      qc.invalidateQueries({ queryKey: ["learn", "progress"] });
    },
  });
}

export function useContentStatus() {
  return useQuery({
    queryKey: ["content", "status"],
    queryFn: () => apiFetch<{ sections: Freshness[]; learning: { today: string; timezone: string; selected: string[] }; scheduler: { last_ingest_finished_at: string | null; last_ingest_status: string | null; ingestion_enabled: boolean } }>("/content/status"),
    refetchInterval: 5 * 60_000,
  });
}
