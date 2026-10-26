# Page Inventory & Route Map

Stack (verified): React 18 + Vite 6 + TypeScript + Tailwind 3 + shadcn/ui (Radix) +
lucide-react + TanStack Query + React Router 6. Theme = shadcn HSL CSS variables in
`src/styles/index.css`, mapped in `tailwind.config.js`. Auth = JWT in localStorage via
`useAuth`. API = `services/api.ts` (`/api/v1`, envelope `{success,data,error}`).

| Route (before) | Function | Redesign (after) | Data / API | Status |
|---|---|---|---|---|
| `/` classic landing | features + entry choices | **New cinematic landing** (hero art, features, how-it-works, scanners, extension, explainability, learning, trust, CTA, footer). Old landing moved to `/classic` | `/config` | redesign |
| `/v2` alt landing | prior variant | kept as-is (not deleted) | `/config` | kept |
| `/login` (+`?mode=register`) | sign in / up / guest | **Split-screen glass auth** + `/register` alias; password visibility, validation | `/auth/login`, `/auth/register` | redesign |
| — | — | **`/forgot-password`**: honest "not available yet" state (no backend reset endpoint) | none | new (system state) |
| `/app` dashboard | actions, recent scans, tip | **Greeting, real metrics from history, 7-day activity chart, Quick Scan (5 modes), recent scans, today's tip, alerts** | `/scans`, `/awareness`, `/news` | redesign |
| `/app/scan` | 6 scanners, QR camera | **Analysis workspace**: mode tabs, per-mode inputs, examples, drag-drop + preview image/QR, result | `/scans`, `/scans/upload`, `/scans/website` | redesign |
| — | — | **`/app/scans/:scanId`** forensic report (gauge, evidence, recs, tech details, feedback, export) | `GET /scans/{id}`, `POST /scans/{id}/feedback` | new |
| `/app/learn` | lessons, quiz, challenge | **Learning Hub**: categories, search, illustrated cards, read time, quiz gating kept | `/awareness`, `/challenges/daily` | redesign |
| `/app/intel` | news + laws tabs | **News & Updates** editorial: featured, search, filters, cyber-law section (route kept, `/app/news` alias) | `/news`, `/laws` | redesign |
| — | — | **`/app/reports`**: history table/cards, search, filters, sort, pagination, CSV export, delete | `/scans`, `DELETE /scans/{id}` | new |
| — | — | **`/app/settings`**: account, appearance, privacy (real config), extension, about | `/auth/me`, `/config` | new |
| `/app/incident` | "I was scammed" guidance | restyled via tokens + layout polish | `/incidents` | restyle |
| `/app/admin` | analytics, flags | restyled via tokens | `/admin/*` | restyle |
| `/browser-protection` | download center | **"Protection That Travels With You"** hero, features, HTML popup preview, download center w/ release notes | `/downloads/release-manifest.json` | redesign |
| — | — | **`/about`, `/contact`** (no invented credentials/contacts) | none | new |
| `*` | (none — blank) | **404** page | none | new |
| extension popup / options / warning | MV3 UI | emerald theme, cached current-site status, quick actions, warning redesign | backend via extension | redesign |

Backend changes (additive only, tested): scan list/detail gain redacted `target`
(URL query stripped), detail gains `indicators` + `created_at`; `/config` gains real
`privacy` values. No contracts removed or changed.
