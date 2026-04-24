# SupaPara — Repo Context for ChatGPT

Paste this whole file into ChatGPT as the first message. Then ask your question.

---

## What this app is

**SupaPara** is a classroom helper for **paraprofessionals** (teacher aides) who support students with IEPs (special-ed plans). It runs in the browser on school-issued Chromebooks. Paras log observations, hand off notes between shifts, track IEP goals, and talk to an AI copilot that knows each student's plan.

The single hardest constraint is **student-privacy law (FERPA)**: real student names must never leave the user's computer. Anything that syncs to the cloud uses a 6-digit "Para App Number" per student instead of a name.

**Live:** `supapara.vercel.app`
**Repo:** `github.com/unohisname12/para-copilot`
**Current branch:** `feat/ui-reskin`

---

## Who uses it

- **Para (most common user)** — logs during class, reads handoffs from the last shift, opens a student card to see what works for that kid.
- **Special-Ed Teacher** — adds/edits IEP summaries, sees parent notes.
- **Owner / Team Admin** — creates the team, invites paras, manages roles.
- **Sub** — temporary para, locked-down read-only view the admin can disable with one switch.

Users are stressed, multitasking, and short on time. Clarity beats cleverness every time.

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | **React 19** + **Create React App** (react-scripts 5) — no Next.js, no Tailwind |
| Styling | Plain **CSS variables** in `src/styles/styles.css` (design-token system v3) |
| Hosting | **Vercel** (static build, auto-deploy from `feat/ui-reskin`) |
| Backend | **Supabase** — Postgres + Auth (Google OAuth) + Realtime + Row Level Security |
| Auth | Google OAuth via Supabase. Users pick a role at join time. |
| AI (local) | **Ollama** running on user's computer (`qwen2.5:7b-instruct`) via `http://localhost:11434` |
| AI (cloud) | **Google Gemini API** (paid fallback, user provides own key, stored in localStorage) |
| PDF parsing | `pdfjs-dist` (used for IEP doc uploads in Smart Import) |
| Testing | `react-scripts test` (Jest) + `playwright` for e2e |

The user is on **Linux Mint**. Ollama runs as a systemd service; their desktop has start/stop shortcuts.

---

## Repo layout

```
src/
  App.jsx                       # shell, routes, auth gate, sidebar, Data Vault screen
  index.tsx                     # entry
  styles/styles.css             # ALL styling — design tokens, components, no Tailwind

  app/providers/                # provider composition root

  components/                   # mostly screens/modals, some are still large single-file
    AdminDashboard.jsx          # team owner/sped-teacher panel (role changes, transfer owner)
    Dashboard.jsx               # small re-export / shell
    IEPImport.jsx               # legacy IEP import page (3 cards + Smart Import banner)
    OnboardingModal.jsx         # 5-slide welcome tour (Intro, Privacy, Para# , Team, Start)
    SignInScreen.jsx            # Google sign-in landing
    RealNamesControls.jsx       # sidebar real-names toggle + persistence modal
    HandoffInbox.jsx            # list of incoming handoffs for this para
    SimpleMode.jsx              # re-export
    SubLockedScreen.jsx         # shown when admin disables subs
    TeamSwitcher.jsx            # nav: change which team you're looking at
    TeamOnboardingModal.jsx     # create/join a team
    OllamaStatusBadge.jsx       # local-AI online/offline chip
    ParentNotesSection.jsx      # sped-teacher-only private parent notes
    modals/StudentProfileModal.jsx  # open a student card — big modal with goals/notes
    panels/HandoffBuilder.jsx   # compose a handoff
    panels/GoalTracker.jsx      # IEP goal progress tracker
    panels.jsx, tools.jsx, windows.jsx   # re-export barrels

  context/
    VaultProvider.jsx           # React context: real-name vault, persistence, toggles
    TeamProvider.jsx            # React context: current user's team, role, members
    buildContext.js             # builds AI prompt context from student data

  engine/
    aiProvider.js               # router — returns 'local' | 'cloud'; unified parseIEP()
    ollama.js                   # local AI client (fetches http://localhost:11434)
    cloudAI.js                  # Gemini client; uses responseMimeType + responseSchema
    index.js                    # doc parser + case-matching keyword engine

  features/
    dashboard/Dashboard.jsx     # REAL dashboard (hero header, Today's Plan, student cards, chat)
    simple-mode/SimpleMode.jsx  # stripped-down fast-logging mode (v3: inline note, 2-col grid)
    import/
      IEPImport.jsx             # same file as components/IEPImport.jsx in some paths
      SmartImport.jsx           # flagship: roster + IEP doc → AI → student objects
      RosterOnlyImport.jsx      # just a name list (JSON/CSV/MD/PDF)
      iepExtractor.js           # PURE logic: split by student, extract, strip names
      rosterParsers.js          # file format parsers
    roster/
      RosterPanel.jsx           # sidebar "Real Names" widget
      rosterUtils.js            # validation + extraction utilities
    vault/                      # Data Vault (search/filter/sort/expand)
    analytics/                  # patterns + weekly reports
    showcase/                   # demo mode banner
    help/                       # ? button + help drawer
    stealth/                    # "Stealth mode" — panic hide for observer walk-ins

  privacy/
    nameResolver.js             # resolveLabel(student, "compact"|"full") — real-name gate
    realNameVault.js            # IndexedDB vault for opt-in name persistence

  services/
    supabaseClient.js           # singleton Supabase client + `supabaseConfigured` flag
    teamSync.js                 # realtime handoff subscribe/publish
    stripUnsafeKeys.js          # defensive key-filter before any cloud write

  utils/
    exportCSV.js                # exportCSV() (no names) + exportCSVPrivate() (with names)
    localBackup.js              # File System Access API — save bundle to picked folder

  data/                         # DB constants, demo seed data, periods/schedule fixtures
  models/                       # health calculation, hdot, etc.
  hooks/                        # useEscape, useLocalStorage, etc.

supabase/migrations/            # 7 SQL migrations — schema + RLS + RPCs
```

---

## Data model (Supabase)

Tables (simplified):

- `teams` — one row per school team. `owner_id`, `allow_subs` bool.
- `team_members` — `(team_id, user_id, role, active, joined_at)`. Roles: `owner | sped_teacher | para | sub`.
- `team_students` — cloud-safe student records. **Never has real names.** Keyed by `student_uid` (6-digit Para App Number).
- `observations` — logs (notes, behavior, goal progress, handoffs). `student_uid` FK. `shared_with_team` bool.
- `parent_notes` — sped-teacher-only. RLS restricts reads to owner + sped_teacher.
- `invites` — 6-letter codes for joining a team.

**RLS helpers** (security-definer functions to avoid policy recursion):
- `is_member_of_team(team_id)` — used by every SELECT/UPDATE policy.
- `is_team_admin(team_id)` — owner OR sped_teacher.

**RPCs** (callable from client): `set_member_role`, `set_member_active`, `remove_member`, `set_team_allow_subs`, `add_parent_note`, `transfer_ownership`, `create_team_with_invite`.

---

## Privacy architecture (the load-bearing invariant)

**Nothing labeled `realName` ever touches Supabase, Ollama, Gemini, exports, or analytics.**

Enforcement layers:

1. **`VaultProvider`** owns `realNameById`. Writes go to IndexedDB (opt-in) or session-only memory. Never props-drilled into cloud calls.
2. **`resolveLabel(student, mode)`** in `privacy/nameResolver.js` is the only function that returns a display string. If `showRealNames === false`, it returns the 6-digit number.
3. **`stripUnsafeKeys.js`** is called on every payload before a Supabase insert.
4. **`iepExtractor.stripNameFromSection()`** replaces the student's real name with `[STUDENT]` before sending IEP text to either AI.
5. **`exportCSV()`** (public) vs **`exportCSVPrivate()`** (names) are separate functions. The private one has a bright yellow button and warns the user.

**The 6-digit "Para App Number"** is how the same student appears consistent across paras without ever syncing a name.

---

## Design system (v3 "Operator Blue")

All tokens are in `src/styles/styles.css`. **Do not add inline colors** — use the variables.

### Core tokens

```css
/* Backgrounds */
--bg-deep:    #0a0f1c   /* page */
--bg-dark:    #0f1524   /* sidebar, inputs */
--bg-surface: #131a2e   /* subtle cards */
--panel-bg:   #161e36   /* default panel */
--panel-raised: #1f2a4b /* elevated cards, modals */

/* Text — soft white, not pure */
--text-primary:   #e7ecf5
--text-secondary: #a7b3cf
--text-muted:     #6d7b9a
--text-dim:       #455477

/* Primary BRAND = Academic Blue (chrome, links, active states) */
--accent:        #3b82f6
--accent-strong: #2563eb
--accent-hover:  #60a5fa

/* CTA = Orange. ONLY used by .btn-primary. Never chrome. */
--cta:        #f97316
--cta-hover:  #fb923c
--cta-active: #ea580c

/* State — semantic, single-purpose */
--green:  #22c55e  /* success */
--yellow: #eab308  /* caution */
--red:    #ef4444  /* alert */
```

### Rules

- **Orange = action.** `.btn-primary` is the ONLY orange element. One per screen max.
- **Blue = identity & state.** Brand mark, active nav, links, "has content" indicators.
- **Violet exists but reserve for brand gradient only** (`--grad-brand`). Not in everyday UI.
- Glow was cut ~45%: `main-content::before` removed, most `::before` glows removed, body has a single faint top highlight (not a two-sided vignette).
- Shadows are `--shadow-sm/md/lg` + `--shadow-cta` (orange). Don't invent new ones.

### Buttons

```
.btn-primary    Solid orange — the action on the screen
.btn-secondary  Surface bg, bordered — everyday actions
.btn-ghost      Transparent — tertiary, icon buttons
.btn-action     Tinted blue — "do-something" secondary CTA
.btn-sm         Size modifier
```

---

## Commands

```bash
npm start              # dev server on http://localhost:3000
npm run build          # prod build into ./build
npm test               # Jest unit tests (327 passing as of last run)
npm run test:e2e       # Playwright e2e tests
```

Deploy happens automatically when you push to `feat/ui-reskin` → Vercel picks it up.

Environment variables needed in `.env.local`:
```
REACT_APP_SUPABASE_URL=...
REACT_APP_SUPABASE_ANON_KEY=...
```
If missing, the app still runs and shows "Cloud features not configured" on the sign-in screen.

---

## Conventions & patterns

- **No comments that explain what code does** — only why (hidden constraints, bug workarounds). Identifiers should do the explaining.
- **No backwards-compat shims.** If something is unused, delete it.
- **No feature flags** unless actually needed — just change the code.
- **Plain English in the UI.** No "JSON", "bundle", "roster", "pseudonym", "FERPA", "vault", "IndexedDB" in user-visible strings. The current vocabulary is: *name list, student file, real names, saved notes, Para App Number, this computer, the cloud, the team*.
- Files that have grown too large (`App.jsx`, `IEPImport.jsx`, `Dashboard.jsx`) are known and can be split as part of the work that touches them — but don't do speculative refactors.
- Tests live in `src/__tests__/` and sit next to the module they test. E2e in `e2e/`.

---

## Known open issues / in-flight work

- `App.jsx` is ~1000+ lines including the Data Vault screen. Candidate for extraction into `features/vault/VaultScreen.jsx`.
- `IEPImport.jsx` is legacy; Smart Import is the primary flow. The 3 advanced-upload cards above the Smart Import banner are kept for admin users who already have files.
- Some inline styles still pass `#hex` literals (especially in `Dashboard.jsx` and `IEPImport.jsx`). Prefer `var(--token)`.
- Sidebar icons use emoji — no plan to replace them, users find them friendly.
- Mobile is explicitly **not a priority** — users are on Chromebooks. Don't design mobile-first.

---

## What the user wants from ChatGPT

The user ("Dre") is a special-ed paraprofessional turned indie app builder. He is **not a full-time software engineer**. Explanations should:

- Skip enterprise jargon — use the same plain-English style the UI uses.
- Show exact file paths + line numbers when recommending changes.
- Prefer one small change over a refactor.
- Be honest about tradeoffs, not just cheerlead.
- Don't suggest Tailwind, Next.js, TypeScript rewrites, or heavy tooling swaps — this is a working CRA app that ships daily.

When ChatGPT is asked "how do I fix X?", the ideal reply is: "Open `src/path/to/file.jsx` at line N. Change `this` to `that`. Here's why it works."

---

## Recent commit history (last 20)

```
22147d9 polish(ui): plain-English pass round 2 + priority hierarchy
d03372b design(ui): hierarchy + color pass — Linear/Vercel/Stripe polish
d6a61e0 polish(ui): plain-English pass — swap tech jargon for simple words
0bdcd80 fix(simple-mode): quick-note bar gives the para time to actually type
2e90b15 feat(simple-mode): v3 — inline note, today summary, double-click, 2-col grid
10560dd feat(vault): interactive Data Vault — search, filters, sort, row expansion
0454055 feat(privacy): strip real names before any AI call + paid-tier warning
8f21944 feat(ui): Smart Import promoted to full-width hero banner below 3 cards
9fab23e feat(ai+backup): Gemini option + local backup files with clear paths
8c42b8b feat(import): flagship Smart Import — roster + IEP doc → AI → JSON
3914872 docs(business): rewrite money plan — focus on HOW to sell
ad27ea1 docs(business): SupaPara money plan — Fairview pilot to WA district rollout
ade1371 feat: finish Phase 2 — Parent Notes, IEP Summary labels, Sub lockout
8b979a1 feat(admin): multi-owner support clarified + one-click Transfer Ownership
bc742f1 feat(auth): explicit Para/Sub role pick at join time; never admin via invite
94f821a feat(simple-mode): one-tap-per-category + undo + search + sort + Chromebook polish
f756d03 fix(db): RLS recursion on team_members — every login forced "Create Team"
a3b1de9 feat(ui): unified "Today's Plan" card + Export Today modal
e7f1209 feat(ui): TeamOnboardingModal — "Switch team" tab
984ae4e chore: gitignore supabase/.temp (CLI cache)
```

---

*End of repo context. Ask your question now.*
