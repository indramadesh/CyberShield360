# UI/UX Audit (Phase 0)

## Reference analysis (2 boards)
- **Palette:** near-black green background, emerald/teal primary (`#19E6A0`), cool
  green-grey text, thin dark-green borders; red/amber only for threat semantics.
- **Type:** confident display headings (geometric sans), compact Inter-like UI text,
  large numeric scores (`92/100`) and metric figures.
- **Composition:** cinematic hero (aurora sky, mountains, glowing shield portal, lone
  explorer) → 4 feature tiles; glass auth card over art; sidebar app shell with search
  top bar; metric cards row; segmented Quick Scan; recent-scan tiles; tip card.
- **Results:** forensic layout — status header with severity tags, circular score
  gauge, "What we found" vs "Recommendations" columns, tabs for technical detail.
- **Extension:** compact popup with big status + one primary action + 4 quick actions
  + protection toggle; full-red block page with risk/category/confidence trio.
- **Content pages:** chip filters, illustrated cards (learn), editorial list with
  thumbnails (news), dense list with filters (reports), toggle rows (settings).

## Current state — problems found
1. **Theme mismatch:** indigo/slate tokens; nothing of the emerald identity.
2. **Landing** is a plain text hero with no art direction; previous variants scattered.
3. **Auth** is a bare centered card; no visual panel, no password visibility toggle.
4. **Dashboard** metrics absent; no quick scan; recent scans lack a target summary
   (API didn't return one); no activity visualization.
5. **No scan-result route** — results exist only transiently after a scan; history
   rows can't be opened.
6. **Missing pages:** Reports/history, Settings, About, Contact, 404 (unknown routes
   rendered blank).
7. **Scanner:** image upload has no preview/validation; no example inputs; QR upload
   not available (only camera/paste).
8. **Extension UI** uses the old indigo palette; popup doesn't surface the
   already-cached auto-scan status for the current site.
9. **Icons:** some emoji used as icons in the extension (🛡 ⛔) — replace with SVG.

## Constraints honored
- No fabricated metrics, news, testimonials, credentials, social sign-in, or
  password-reset flow (backend lacks one → honest state page).
- All interface text stays real HTML; art is original inline SVG (no images with
  embedded UI text, no hoodie-hacker imagery).
- Existing routes kept (`/v2`, classic moved to `/classic`, `/app/intel` kept).
