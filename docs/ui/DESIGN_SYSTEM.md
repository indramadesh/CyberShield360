# CyberShield360 Design System

One emerald/teal identity across the web app and the browser extension. Every
colour, radius and font comes from tokens — pages never hard-code hex values
(the only exception is the cinematic artwork, which keeps its own dark palette
in both themes because it is an illustration).

Source of truth: `frontend/src/styles/index.css` (CSS variables) and
`frontend/tailwind.config.js` (Tailwind mapping). The extension mirrors the
same values in `extension/styles.css`.

## Colour tokens (dark — default)

| Token | Hex | Tailwind | Use |
|---|---|---|---|
| `--background` | `#06110F` | `bg-background` | Page |
| `--background-2` | `#0A1916` | `bg-background-2` | Sidebar, inputs, insets |
| `--card` | `#10231F` | `bg-card` | Cards, panels |
| `--secondary` | `#15302A` | `bg-secondary` | Hover rows, secondary buttons |
| `--primary` | `#19E6A0` | `bg-primary` / `text-primary` | Primary actions, active nav, focus ring |
| `--primary-2` | `#42F5C5` | `text-primary-2` | Gradient partner (`.text-brand-gradient`) |
| `--foreground` | `#E8F5EF` | `text-foreground` | Body text |
| `--muted-foreground` | `#9BB8AD` | `text-muted-foreground` | Secondary text |
| `--subtle-foreground` | `#708C81` | `text-subtle` | Captions, metadata |
| `--border` | `#203B33` | `border` | All borders |
| `--danger` | `#FF5D65` | `text-danger` / `bg-danger-soft` | Critical risk, errors, destructive |
| `--high` | `#FF8B4D` | `text-high` | High risk |
| `--warning` | `#FFBD59` | `text-warning` | Suspicious, warnings |
| `--info` | `#63B8FF` | `text-info` | Informational |
| `--success` | = primary | `text-success` | Low risk, success |

Every status colour has a `-soft` background variant (≈14% alpha) for badges.
A light theme exists (`:root` without `.dark`) and is reachable from the top
bar or Settings; dark is the default.

### Risk is never colour alone
`RiskBadge` always pairs colour with an icon and a text label (Low Risk /
Suspicious / High Risk / Critical Risk). `RiskGauge` shows the 0–100 score as
a number. Confidence is shown separately ("Confidence in this assessment").
The extension's `shared/risk.js` follows the same rule with SVG icons.

## Typography

- **Inter** — body/UI text.
- **Space Grotesk** — display: page titles, headings, metric numbers (`font-display`).
- No other fonts. Loaded from Google Fonts in `index.html`.

Scale used: page title `text-2xl sm:text-3xl` · section `text-3xl sm:text-4xl`
(landing) · card title `text-base font-semibold` · body `text-sm`/`text-base` ·
caption `text-xs`. Eyebrows use the `.eyebrow` class (uppercase, tracked, primary).

## Shape, depth, motion

- Radius: `--radius` 0.75rem → `rounded-lg` controls, `rounded-xl` cards, `rounded-2xl` hero panels.
- Shadows: `shadow-elev` (cards), `shadow-glow` (primary button only).
- Surfaces: `.surface-glass` (auth card), `.grid-texture` (decorative backgrounds, always masked).
- Motion: `--dur-fast` 120ms, `--dur` 180ms, `--dur-slow` 600ms (gauge fill).
  `prefers-reduced-motion` **and** the Settings "Reduce motion" switch
  (`html.reduce-motion`, stored as `cs360-reduce-motion`) disable animation.

## Layering
`z-header` 30 (sticky bars, sidebar) · `z-drawer` 50 (sheets, dialogs) · `z-toast` 60.

## Components

| Component | File | Notes |
|---|---|---|
| Button | `components/ui/button.tsx` | `default`, `outline`, `ghost`, `destructive`…; `loading`; `asChild` passes exactly one child to Radix Slot |
| Card | `components/ui/card.tsx` | `rounded-xl border bg-card shadow-elev` |
| Input / Textarea / PasswordInput | `components/ui/*` | `bg-background-2`; PasswordInput has an accessible show/hide toggle |
| Tabs | `components/ui/tabs.tsx` | Active = tinted primary with inset ring |
| Badge | `components/ui/badge.tsx` | Status variants map to soft tokens |
| RiskBadge / RiskGauge | `components/ui/` | Risk with icon + label; gauge = risk only |
| MetricCard | `components/ui/MetricCard.tsx` | `value={null}` → skeleton. Only real numbers |
| ActivityChart | `components/ui/ActivityChart.tsx` | Bar chart with an accessible text summary |
| FileDrop | `components/ui/FileDrop.tsx` | Drag/drop + keyboard, type/size validation, preview |
| Dialog / ConfirmDialog | `components/ui/dialog.tsx` | Confirm required for destructive actions |
| Toast | `components/ui/toast.tsx` | `useToast()` returns `push`; `aria-live` region |
| EmptyState / ErrorState / LoadingRows / SkeletonCard / RouteFallback | `components/ui/states.tsx` | Every data view uses these |
| Logo / LogoMark | `components/brand/Logo.tsx` | SVG shield + check; wordmark "CyberShield**360**" |
| CinematicScene | `components/art/CinematicScene.tsx` | Inline-SVG hero/auth art; no raster, no embedded text |
| PublicHeader / PublicFooter | `components/layout/` | Public pages; `overlay` header for the hero |

## Content rules (enforced in review and `ui_check.mjs`)

- No fabricated metrics, testimonials, scan results or contact details. Demo
  data is labelled (`[DEMO]`, "synthetic sample", "Demo mode" badge).
- Never "100% safe" or "guaranteed". A low result says "No strong warning signs
  found" and the footer caveat appears on every result.
- No social sign-in, no password-reset flow (there is no email service) — the
  forgot-password page says so.
- No emoji as icons, anywhere (web or extension). Icons are lucide or inline SVG.
- All text is real HTML; images never contain text.
- Scan targets in history are shown redacted and without query strings.

## Accessibility baseline

Visible focus ring (`ring-ring` = primary) · labelled icon buttons · `role=tab`/`radio`/`switch`
with `aria-selected`/`aria-checked` · `aria-live` on scan results and toasts ·
form errors linked with `aria-describedby` · body text meets WCAG AA on all surfaces ·
layouts tested at 390px with no horizontal scroll.
