# UI Implementation Plan

Strategy: the whole app already consumes shadcn CSS-variable tokens, so **retheming
the tokens** gives every page the emerald identity at once; then pages get
layout-level redesigns in priority order.

| Phase | Scope | Acceptance |
|---|---|---|
| 0 | Audit, inventory, plan | docs in `docs/ui/` ✔ |
| 1 | Design system: emerald tokens (dark default + light variant), Inter + Space Grotesk, radius/shadow/motion/focus/chart tokens, `glow`, surfaces; components: RiskGauge, MetricCard, StatusBadge, PasswordInput, FileDrop, SegmentedTabs, EmptyState/ErrorState, CinematicScene (SVG art) | build + tests pass |
| 2 | App shell: sidebar (Dashboard, Scan & Analyze, Browser Protection, News & Updates, Learning Hub, My Reports, Guidance, Settings, Admin), top bar with scan-search, mobile drawer, tooltips on icons | all routes reachable on mobile |
| 3 | Public: cinematic landing, about, contact, auth split-screen, register alias, forgot-password state, 404 | real auth works |
| 4 | Dashboard: metrics from real history, 7-day chart, quick scan, recent scans, tip | no fabricated numbers |
| 5 | Scanning workspace: mode tabs, examples, drag-drop preview, QR upload/camera/paste | each mode hits real API |
| 6 | Result report route + gauge, evidence, recs, tech details, feedback, export | feedback API works |
| 7 | Browser protection page + extension popup/options/warning reskin | extension packages + validates |
| 8 | News & Learn editorial redesign | real data only |
| 9 | Reports (filters/sort/pagination/CSV/delete) + Settings | real data, delete confirm |
| 10 | System states (404, errors, empty) | every page has empty/error |
| 11 | Responsive + a11y review (360→1920) | no horizontal overflow |
| 12 | QA: build, tests, live API checks, commit | recorded in UI_STATUS.md |
