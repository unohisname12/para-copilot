# SupaPara — Design System v3 ("Operator Blue")

All styling is in `src/styles/styles.css` — no Tailwind, no CSS modules. Components reference design tokens via `var(--token)`.

## Aesthetic principles

1. **Calm beats flashy.** Paras are stressed; the UI should reduce cognitive load.
2. **Clarity over cleverness.** No clever gradients on chrome. Solid colors do the work.
3. **One primary action per screen.** Orange = action. Blue = identity. Don't mix.
4. **Real-world tested.** Built for a busy school day on a Chromebook in fluorescent light.

## Color tokens

### Backgrounds (deep navy, not pure black)
```css
--bg-deep:      #0a0f1c   /* the page */
--bg-dark:      #0f1524   /* sidebar, inputs */
--bg-surface:   #131a2e   /* subtle cards */
--panel-bg:     #161e36   /* default panel */
--panel-hover:  #1c2644
--panel-raised: #1f2a4b   /* elevated cards, modals */
```

### Borders
```css
--border:        #243055
--border-light:  #33416d
--border-accent: rgba(59, 130, 246, 0.32)
```

### Text (soft white, not pure white)
```css
--text-primary:   #e7ecf5
--text-secondary: #a7b3cf
--text-muted:     #6d7b9a
--text-dim:       #455477
```

### Primary brand — Academic Blue
```css
--accent:        #3b82f6  /* blue-500, default */
--accent-strong: #2563eb  /* blue-600, emphasis */
--accent-hover:  #60a5fa  /* blue-400 */
--accent-glow:   rgba(59, 130, 246, 0.12)
--accent-border: rgba(59, 130, 246, 0.35)
```

### CTA — Orange (the ONE rule)
```css
--cta:        #f97316  /* orange-500 */
--cta-hover:  #fb923c
--cta-active: #ea580c
--cta-glow:   rgba(249, 115, 22, 0.28)
```

**Orange is reserved for `.btn-primary` only.** Never use it on chrome, brand marks, active states, or decoration. If two buttons on a screen are orange, one of them is wrong.

### State (semantic, single-purpose)
```css
--green:  #22c55e   /* success */
--green-muted: rgba(34, 197, 94, 0.14)

--yellow: #eab308   /* caution / warning */
--yellow-muted: rgba(234, 179, 8, 0.14)

--red:    #ef4444   /* alert / error / "needs attention" */
--red-muted: rgba(239, 68, 68, 0.14)
```

### Decoration (rare)
```css
--violet: #8b5cf6   /* reserved for brand gradient only */
--cyan:   #22d3ee   /* used in pills/onboarding only */
```

## Gradients

Used for the brand mark and rare hero accents. **Not for everyday UI.**

```css
--grad-primary: linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)
--grad-brand:   linear-gradient(135deg, #2563eb 0%, #8b5cf6 100%)
--grad-cta:     linear-gradient(180deg, #fb923c 0%, #f97316 100%)
```

`.btn-primary` uses solid `--cta` (not a gradient) for the CTA-look-at-me effect.

## Shadows

Three layered, subtle. No heavy glows.

```css
--shadow-sm: 0 1px 2px rgba(0,0,0,0.30)
--shadow-md: 0 4px 14px rgba(0,0,0,0.40), 0 1px 2px rgba(0,0,0,0.30)
--shadow-lg: 0 16px 40px rgba(0,0,0,0.45), 0 2px 4px rgba(0,0,0,0.25)
--shadow-glow: 0 0 0 1px var(--accent-border), 0 4px 16px rgba(59,130,246,0.12)
--shadow-cta:  0 4px 14px rgba(249,115,22,0.28), inset 0 1px 0 rgba(255,255,255,0.15)
```

## Spacing scale (4px base)

```css
--space-1: 4px
--space-2: 8px
--space-3: 12px
--space-4: 16px
--space-5: 20px
--space-6: 24px
--space-7: 32px
--space-8: 48px
--space-9: 64px
```

## Radii

```css
--radius-xs:   6px
--radius-sm:   8px
--radius-md:   12px
--radius-lg:   16px
--radius-xl:   20px
--radius-2xl:  28px
--radius-pill: 999px
```

## Motion

```css
--ease-out: cubic-bezier(0.16, 1, 0.3, 1)
--duration-fast: 120ms
--duration-base: 200ms
--duration-slow: 320ms
```

Plus a `prefers-reduced-motion` media query that flattens all animations to 0.01ms.

## Layout

```css
--sidebar-w:           248px
--sidebar-w-collapsed: 60px
--tap-min:             44px   /* min touch-target size, Apple HIG */
```

## Typography

- **Display / body:** DM Sans (Google Fonts). Weights 300–800.
- **Mono:** JetBrains Mono. For dates, codes, technical data.
- Base size: `15px` desktop, `14px` at 1366px and below, `13.5px` at 1100px and below.

## Buttons

Defined classes:

| Class | Purpose | Style |
|---|---|---|
| `.btn-primary` | The action on the screen | Solid orange (`--cta`), white text, shadow-cta |
| `.btn-secondary` | Everyday actions | Surface bg, bordered |
| `.btn-ghost` | Tertiary, icon buttons | Transparent, hover-tinted |
| `.btn-action` | Secondary "do-something" CTA (rare) | Tinted blue glow |
| `.btn-sm` | Size modifier | Smaller padding + font |

**Rules:**
- One `.btn-primary` per screen (max).
- Min height 44px (touch-friendly).
- All buttons have `:active { transform: scale(0.97) }` for tactile feedback.

## Components

### `.panel` — default container
- `--panel-bg` background, 1px `--border`
- `--radius-lg`
- `:hover` lightens border to `--border-light`
- Subtle `--grad-card-glow` overlay at 0.25 opacity (was 0.6 before v3 — cut by ~60% for calm)

### `.card-elevated` — hero / metric
- `--panel-raised` background
- 1px `--border-light`
- `--shadow-md`, lifts to `--shadow-lg` on hover
- No more radial glow (removed in v3)

### `.metric-card`
- Same as elevated
- 2px solid blue accent bar at top (was gradient + 0.85 opacity → solid + 0.55 opacity)
- Translate -1px on hover (was -2px)

### `.modal-overlay` + `.modal-content`
- Overlay: `rgba(3, 6, 13, 0.82)` + 10px backdrop-blur
- Content: `--panel-raised` solid (was gradient + double border + accent glow → solid + single border in v3)
- Slide-up animation 220ms

### `.nav-btn`
- Sidebar nav item
- Active: `--accent-glow` background + 3px solid `--accent` left bar (was full shadow-glow → no glow in v3)

### `.pill`
- Small inline label
- Variants: `.pill-accent` (blue), `.pill-green`, `.pill-yellow`, `.pill-red`, `.pill-violet`

## What changed in v3 (the polish pass)

The big v3 changes from the previous v2:

1. **Color shift:** soft periwinkle → academic blue (#7a9cff → #3b82f6). More professional.
2. **Backgrounds slightly warmer:** pure black (#03060d) → deep navy (#0a0f1c). Reduces eye strain.
3. **Glow reduction (~45%):** removed `main-content::before` ambient layer, removed glow on `.card-elevated::before` and `.metric-card::after`, halved body vignette to one faint top highlight.
4. **CTA orange introduced:** `.btn-primary` is now solid orange, not blue gradient. One look-at-me color.
5. **Brand mark:** simple solid blue color (was blue→violet gradient text). No longer competes with CTA.
6. **Sidebar:** removed outer shadow + inner glow on active. Just a simple left bar + subtle background tint.

## Plain-English rule (style for user-visible strings)

The codebase enforces a style: **no tech jargon in any string a para sees.**

| Banned word | Replace with |
|---|---|
| JSON | name list / file (depending on context) |
| roster | name list |
| pseudonym | nickname / display name (rarely used in UI) |
| FERPA | "Real names stay on this computer" |
| IndexedDB / localStorage | "this browser's storage on this computer" |
| bundle | student file |
| vault | (avoid; "Data Vault" is OK as a screen name) |
| OAuth / sync / persist / cron | plain English equivalent |
| backend / API / endpoint | "the cloud" / "the server" |

The vocabulary the app actually uses: **name list, student file, real names, saved notes, Para App Number, this computer, the cloud, the team, real names stay on this computer.**

## Accessibility

- Min font size: 11px (used sparingly for metadata — body is 13.5–15px).
- All interactive elements have `:focus-visible` outlines using `--accent`.
- Min touch target: 44px (the `--tap-min` token).
- Reduced motion respected via media query.
- Color contrast: `--text-primary` on `--panel-bg` is ~10:1 (AAA). `--text-muted` on `--panel-bg` is ~5.5:1 (AA).
- Modal close buttons have `aria-label="Close"`.

## File location

All styles in **one file**: `src/styles/styles.css` (~1063 lines). Imported once at the top of `src/App.jsx`. No other CSS files in the codebase.
