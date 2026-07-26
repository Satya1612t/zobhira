# Job Portal Design System

> **Source of truth**: `apps/web/src/app/globals.css`'s `:root` block. This document describes
> that palette in prose for quick reference — if the two ever disagree, `globals.css` wins.

The product is branded **Zobhira**. The visual language ("HireAuthority" in code comments/mockup
titles — an internal working name from the Stitch design pass, not user-facing) is a cool,
institutional blue/white palette: corporate, trustworthy, data-dense-friendly. Applies to both
`apps/web` (public site) and `apps/admin` (management app); both read the same kind of CSS
custom-property tokens from their own `src/app/globals.css`.

## 1. Visual Theme

Light canvas, near-white surfaces, a single deep-blue accent ("Industry Blue"). No Tailwind at
runtime — Stitch mockups are designed in Tailwind but every screen gets re-implemented against
these hand-maintained CSS custom properties instead of shipping the Tailwind CDN script.

## 2. Color Tokens (`apps/web/src/app/globals.css`)

| Token | Value | Role |
|---|---|---|
| `--color-bg` / `--bg` | `#f7f9fc` | Page background |
| `--color-surface` / `--surface` | `#ffffff` | Card / panel / sidebar backgrounds |
| `--color-surface-muted` / `--surface-hover` | `#eceef1` | Muted fills, hover states, chip backgrounds |
| `--color-text` / `--ink` | `#191c1e` | Primary text |
| `--color-text-muted` / `--ink-muted` | `#4a4a4a` | Secondary text, descriptions |
| `--ink-faint` | `color-mix(text-muted 75%, transparent)` | Placeholders, metadata, faint captions |
| `--color-accent` / `--accent` | `#003366` | "Industry Blue" — primary CTAs, active states, links, headings |
| `--color-accent-dark` | `#001e40` | Darker accent variant (gradients, dark banner fills) |
| `--accent-ink` | `#ffffff` | Text/icon color on top of `--accent` |
| `--color-accent-soft` / `--accent-soft` | `#d5e3ff` | Light blue tint — pill/badge backgrounds paired with accent text |
| `--color-error` / `--warn` | `#ba1a1a` | Errors, delete actions, warnings |
| `--color-divider` / `--line` | `#e0e3e6` | Borders, dividers |

**Rule**: `--accent-soft` is only ever paired with accent-colored text, never `--warn` — keep
warning/error tints visually distinct from the accent-tinted pill style used everywhere else
(job/contest tags, filter chips).

## 3. Typography

- **Display/body font**: Inter, loaded via `next/font/google` in `apps/web/src/app/layout.tsx`
  (`--font-inter` → `--font-heading`/`--font-body`/`--font-display`). `apps/admin` uses a
  system-font stack that only falls back to Inter if already installed locally, to avoid a Google
  Fonts fetch dependency at Docker build time (see `apps/admin/src/app/globals.css`) — don't "fix"
  this to use `next/font/google` without re-checking that constraint.
- **Monospace**: JetBrains Mono (`--font-jetbrains-mono` → `--font-mono`) — used for kicker labels,
  uppercase section headers, timestamps, filter section labels.
- Heading weight defaults to 700 (`--font-heading-weight`); body copy stays at regular weight.

## 4. Spacing & Radius

Radius was deliberately standardized to a single small value across the whole app —
`--radius-sm`/`--radius-md`/`--radius-lg` are all `4px` now (kept as three separate names only
because ~10 places still reference them by name, not because they differ). `--radius-full:
9999px` remains genuinely different — it's for pills/circular buttons/avatar dots, a shape choice,
not a "how rounded are corners" choice. Don't reintroduce a larger corner radius for "featured"
cards; the whole system reads as consistently sharp-cornered now.

## 5. Shadows

`--shadow-sm` / `--shadow-md` / `--shadow-lg` (aliased as `--shadow-card` / `--shadow-raised`) —
a soft, cool-neutral black shadow scale (`rgba(0,0,0,0.05–0.12)`), used for card hover-lift,
sidebar/dropdown elevation, and the mobile off-canvas drawer.

## 6. Layout conventions

- Every page's top-level `<main>` uses the same shape: `maxWidth: 1280, margin: "0 auto"`, 24px
  horizontal padding — matching the footer's own `.footer-inner` container, so content lines up
  edge-to-edge with the footer regardless of the desktop sidebar's collapsed/expanded state.
  Prose-only pages (About/Contact/Privacy) additionally wrap their text in an inner `maxWidth:
  "70ch"` div for readability, without narrowing the outer `<main>` itself.
- Desktop sidebar: icon-only by default (72px), expands to 264px on any nav-item click
  (`.sidebar-expanded` + `.main-content-expanded` classes, driven by `AppShell.tsx`'s
  `desktopExpanded` state). Mobile collapses this distinction entirely — the sidebar is a
  full-width off-canvas drawer regardless (`@media (max-width: 860px)` in `globals.css`).
- No third-party/scraper source branding is ever rendered as visible text (see CLAUDE.md) — when
  building new job/contest UI, don't add a "via {source}" style label.

## 7. Porting Stitch mockups

Stitch screens (project "Dynamic Recruitment Portal") are the design reference for most
pages/components. When implementing one:
- Re-derive Tailwind spacing/color classes into the token table above — never add the Tailwind
  CDN script or Material Symbols font to this app.
- Real trademarked company/employer logos in a mockup (Apple, Google, Amazon, SAP, etc.) get
  swapped for either real scraped data (`CompanyLogo` component, real job rows) or generic
  placeholder text/wordmarks — never shipped as literal brand logos.
- Photographic assets (hero banners, team photos) that don't yet exist get a styled CSS
  placeholder (gradient/pattern block matching the token palette) plus an explicit
  image-generation prompt for the user to fill in later, rather than using Stitch's own ephemeral
  AI-mockup image URLs in real UI.
