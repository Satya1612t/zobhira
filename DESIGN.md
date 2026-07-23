# Job Portal Design System

> **Note (2026-07-23):** the product is now branded **Zobhira** (see
> `apps/web/public/brand/zobhira-logo-*.png` and the redesigned `/login` page).
> The palette/component notes below predate that rename and describe an earlier
> design pass — current colors/tokens live in `apps/web/src/app/globals.css`,
> which is the source of truth.

> Adapted from Linear's design system (see https://github.com/nexu-io/open-design,
> `design-systems/linear-app/DESIGN.md`) — a **light** adaptation, not Linear's own
> dark-mode-native canvas. Applies to both `apps/web` (public site) and `apps/admin`
> (management app); both read these values from CSS custom properties defined in
> their own `src/app/globals.css`.

## 1. Visual Theme

Cool, near-achromatic neutrals (not the site's old warm-orange "Ember" palette) with
a single chromatic accent: Linear's signature indigo-violet. Light canvas, not dark —
we kept Linear's restraint and precision but not its dark-mode identity.

## 2. Color Tokens

| Token | Value | Role |
|---|---|---|
| `--bg` | `#f7f8f8` | Page background |
| `--surface` | `#ffffff` | Card / panel / sidebar backgrounds |
| `--surface-hover` | `#f3f4f5` | Hover state on surfaces |
| `--ink` | `#14151a` | Primary text |
| `--ink-muted` | `#62666d` | Secondary text, descriptions |
| `--ink-faint` | `#9499a1` | Placeholders, metadata, disabled |
| `--accent` | `#5e6ad2` | Brand indigo — primary CTAs, active states, links |
| `--accent-ink` | `#ffffff` | Text/icon color on top of `--accent` |
| `--accent-soft` | `#eef0fc` | Light indigo tint — pill/badge backgrounds paired with `--accent` text |
| `--warn` | `#cc3340` | Errors, delete actions, unauth warnings |
| `--warn-soft` | `#fbe9ea` | Light red tint — banners/badges paired with `--warn` text (admin app only) |
| `--line` | `#e3e5ea` | Borders, dividers |

**Rule**: `--accent-soft` is only ever paired with `--accent` text, never `--warn` —
use `--warn-soft` for warning/error tints instead (this exact mismatch was the one
bug caught when adapting the admin app's unauthenticated-access banner).

## 3. Typography

- **Display/body font**: Inter Variable (`apps/web` via `next/font/google`; `apps/admin`
  uses a system-font stack that falls back to Inter only if already installed locally,
  to avoid a Google Fonts fetch dependency at Docker build time — see
  `apps/admin/src/app/globals.css`).
- **Monospace**: JetBrains Mono. Linear's own system uses Berkeley Mono, which isn't
  available via Google Fonts or open licensing, so JetBrains Mono is the practical
  substitute — already in use across both apps for source badges, timestamps, etc.
- **OpenType features**: `font-feature-settings: "cv01", "ss03";` set globally on
  `apps/web`'s `<body>` — Linear's alternate lowercase 'a' and geometric letterform
  tweaks are what make Inter read as "Linear" rather than generic Inter. Not applied
  in `apps/admin` since it isn't guaranteed to be rendering true Inter there.
- Reuse Linear's weight logic where convenient: 400 for body copy, ~500–600 for
  emphasis/headings — the existing component styles already lean this way and don't
  need a wholesale rewrite for this token swap.

## 4. Spacing & Radius

Unchanged from the existing system — `--radius: 12px` (panels, featured cards),
`--radius-sm: 8px` (standard cards, inputs, buttons) — these already sit close to
Linear's own 8px/12px card and panel scale, so no numeric change was needed, only the
color/type tokens above.

## 5. Shadows

`--shadow-card` / `--shadow-raised` kept the same two-layer structure as before, just
recolored from a warm brown-black tint to a cool neutral one (`rgba(20, 21, 26, ...)`
instead of `rgba(32, 26, 20, ...)`), consistent with the new `--ink` value.

## 6. What did *not* change

- Layout, spacing scale, component structure, and interaction patterns — this was a
  token-level palette/type swap, not a rebuild.
- `apps/admin` intentionally keeps its non-webfont font stack (see Typography above);
  don't "fix" this to use `next/font/google` without re-checking the Docker build
  network constraint that motivated it in the first place.
