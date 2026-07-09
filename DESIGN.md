# Design

Visual system for BaliDoc Project Hub. Register: **product** (app UI — design serves the task). Stack: Next.js 14 + Tailwind CSS, no component library. This file is the contract: match what's here; when current code contradicts it, converge toward this file.

## Theme

Light, warm-neutral workspace with a single red brand accent. No dark mode (clinic desktops/phones, daytime use). Calm > flashy: color signals state, never decorates.

## Colors

Brand + semantic roles (Tailwind utilities in use today):

| Role | Value | Usage |
|---|---|---|
| Brand / primary action | `red-600` (#dc2626), hover `red-700` | Primary buttons, active tab/filter, selection, unread |
| Brand focus ring | `red-400` ring / `red-100` soft ring | `focus-visible:ring-2` on all interactives |
| Brand tint | `red-50` | Selected/unread row wash, active-suggestion highlight |
| Ink | `gray-900` | Headings, primary text |
| Body | `gray-700` / `gray-800` | Prose, labels |
| Muted | `gray-500` | Metadata, timestamps (never for body prose) |
| Faint | `gray-400` | Placeholder-level hints, quiet icons |
| Hairline | `gray-200` (`gray-100` for internal dividers) | Borders |
| Surface | white; page ground `#f8f9fa`; inset panels `gray-50` | Cards on ground, comments on white |
| Success | `green-600`/`green-700` (+ `green-50` tint) | Done, confirmations |
| Warning | `amber-600` (+ `amber-50`) | Medium priority, due-soon |
| Danger | `red-600` (+ `red-50`) | Overdue, destructive, Blocked column |
| Info/status accents | column dots: To Do `gray-400`, In Progress `blue-500`, Blocked `red-500`, In Review `amber-500`, Done `green-500` | Status dots/chips only |

Rules:
- **The `primary: #2563eb` token in `tailwind.config.ts` is stale scaffolding — never use `primary`/`secondary` classes or ad-hoc blue for chrome.** Blue appears ONLY as the In Progress status dot and conventional link color on file links.
- Accent budget: red carries actions/selection/alerts. Inactive chrome is never saturated.
- Body text ≥4.5:1 — don't set prose lighter than `gray-700` on white.

## Typography

- One family: the existing system-ui stack (set in `globals.css`). No display faces, no webfonts.
- Fixed rem scale, ratio ~1.2: page title `text-2xl font-bold` (dashboard hero only) · section/panel title `text-xl font-bold` · card/subsection heading `text-sm font-semibold` · body `text-sm` · meta `text-xs` · micro-labels `text-[11px]` (chips, uppercase group headers).
- Group headers (e.g. "OVERDUE (3)"): `text-[11px] uppercase tracking-wide text-gray-500`, count in `text-gray-400`.
- Numbers that align in columns (counts, dates): `tabular-nums`.
- Use `…` not `...`; loading states end with `…` ("Posting…").

## Spacing & Layout

- Tailwind 4px grid. Card/panel padding `p-3`–`p-4`; page gutters `px-6`.
- Radii: `rounded-md` for buttons/inputs/chips-in-context, `rounded-lg` for cards/composers, `rounded-xl` for floating panels (dropdowns, bell), `rounded-full` only for pills/avatars/dots. Nothing beyond `rounded-xl`.
- Shadows: `shadow-sm` on raised cards, `shadow-lg` only on floating layers (menus, dialogs). Never border + big shadow together.
- Density: list rows and board cards stay compact — one idea per line, no dead vertical space. Tables/boards may run wide; prose column ≤ ~70ch.
- Sidebars/toolbars sit on the second neutral (`gray-50`/ground) so the white content surface reads as the working area.

## Components

Use the shared vocabulary — don't hand-roll variants of these:

- **Button** (`src/components/ui/Button.tsx`): variants `primary` (red solid) · `secondary` (white bordered) · `ghost` · `subtle` (gray fill) · `danger` (white/red border, fills red on hover). Sizes sm/md/lg. All new buttons go through it (or copy its exact classes when a raw element is unavoidable).
- **Icons** (`src/components/ui/icons.tsx`): inline SVG, `size` prop, `stroke="currentColor"`. **Icons are SVG, not emoji.** Emoji are allowed only as *content* (reactions, release notes, friendly copy like the 👋), never as control glyphs. If an icon is missing, add it to icons.tsx (16px grid, 1.5–2 stroke).
- **Toast** (`src/components/ui/Toast.tsx`) for transient feedback; inline `text-xs text-red-600` for field errors, `text-green-700` for inline success notes.
- **Chips/pills**: status/priority = dot + label `text-xs rounded-full px-2 py-0.5` tinted bg; filter chips = `text-[11px] rounded-full`, active = red solid white text.
- **Form controls**: `text-sm border-gray-300 rounded-md`, focus = red ring (`focus:border-red-400` + soft ring). Native `<select>` gets the same border/height so controls line up; every input has a `<label>` or `aria-label`.
- **Composer pattern** (comments): one bordered `rounded-lg` box — textarea + hairline-divided action bar (quiet ghost actions left, small solid Post right). Reuse for any write-then-submit surface.
- **Floating panels** (bell, pickers, mention list): white, `border-gray-200 rounded-xl shadow-lg`, close on outside click and Escape.
- **Interactive states**: every control ships default/hover/focus-visible/active/disabled (+ loading where async). Hover on quiet controls = `bg-gray-100` + darker ink, not color changes.

## Motion

- 150–250ms, ease-out; `transition` on specific properties (colors, opacity, transform) — no `transition: all`, no page-load choreography, no decorative motion.
- Motion conveys state: panel slide-in, dropdown fade, drag feedback. Honor `prefers-reduced-motion`.

## Voice & copy

Sentence case everywhere (buttons, labels, headings — "Post comment", not "Post Comment"). Specific verbs over generic ("Attach file", "Mark all read"). Errors = what happened + how to fix. Empty states invite action ("Nothing yet — task updates and mentions will show up here."). Keep vocabulary stable across screens: a task is a *task*, a board a *board*; the same action keeps the same name everywhere.

## Bans (this app)

- No emoji as control icons (see Components), no gradient text, no glassmorphism, no side-stripe accent borders, no display fonts, no custom scrollbars/reinvented controls.
- No new blues/purples/teals in chrome. No saturated color on inactive elements.
- No `alert()`/bare `confirm()` in new work — use styled dialogs/toasts (legacy `confirm()` calls are being phased out).
- Destructive actions never fire without confirm or undo.
