# SupaPara — UI Design Brief

> **What this document is:** A self-contained brief any Claude (Code or chat) can read in one paste to understand SupaPara's UI well enough to help redesign it. Pair with screenshots for visual context. Last updated 2026-04-28.

---

## 1. What SupaPara is

SupaPara is a classroom helper for **paraprofessionals** — teacher aides who support students with IEPs (Individualized Education Plans) in K-12 special education. It runs in the browser on school-issued Chromebooks. Paras log observations during class, hand off notes between shifts, track IEP goals, and chat with an AI copilot that knows each student's plan.

Live: `supapara.vercel.app`. React 19 + Create React App. Plain CSS variables (no Tailwind). Supabase backend.

---

## 2. Who uses it

| Role | Most common job | Sees |
|---|---|---|
| **Para** | Logs during class, reads handoffs from last shift, opens a student card to see what works | Dashboard, Simple Mode, Stealth Mode, sidebar tools |
| **Special-Ed Teacher (admin)** | Imports IEPs, manages parent notes, coaches paras | Everything paras see + Admin Dashboard + Parent Notes |
| **Owner / Team Admin** | Creates the team, invites paras, assigns roles | Admin Dashboard with team management |
| **Sub** | Temporary para — read-only when admin disables | Locked-down view; can be locked out entirely |

**User context** (drives every design decision):
- Stressed, multitasking, short on time. Clarity beats cleverness.
- On a Chromebook. Trackpad + keyboard primary. Touchscreen secondary. **Not mobile.**
- 1366×768 typical resolution. Don't design for ultra-wide.
- Often interrupted mid-task by behavior incidents — UI needs to survive a 5-second context switch and let the para resume.

---

## 3. Hard constraints (NON-NEGOTIABLE)

These come from the project rules in `CLAUDE.md` and `REPO_CONTEXT.md`. Any redesign that violates these breaks the product.

### 3.1 Plain English UI

Banned words in user-visible strings:

`JSON`, `bundle`, `roster`, `pseudonym`, `vault`, `IndexedDB`, `FERPA`, `KB`, `EBP`, `BIP`, `SLD`, `PII`, `purge`, `antecedent`, `extinction`, `FCT`, `DRA`, `ABA`

Use instead:

| Don't say | Say |
|---|---|
| Roster JSON | Name list file |
| App Bundle | Student file |
| Pseudonym | Code name / Para App Number |
| Data Vault | Saved notes |
| Knowledge Base | Saved notes |
| FERPA-safe | Real names stay on this computer |
| PII | Student names |
| Purge | Forget |
| Antecedent | What happened before |
| Behavior | What happened |
| Consequence | What happened after |
| BIP | Behavior plan |
| Local AI / Ollama | Smart helper / on this computer |

### 3.2 Para-first framing

Every feature must benefit the para FIRST, not the admin or sped teacher. If copy reads like "your boss is watching" or "the teacher needs to see this," it kills adoption. Reframe so the para is the subject and the beneficiary.

Example: don't say "Topics here are visible to your sped teacher so they can come ready with tips." Say "Bring this list to your check-in so you walk in prepared."

### 3.3 FERPA / privacy invariant

**Real student names NEVER touch the cloud.** Names stay on the para's Chromebook in IndexedDB (`src/privacy/realNameVault.js`). Anything that syncs uses the **6-digit Para App Number** instead. This is the load-bearing privacy gate.

When designing: assume student names are present in local UI but never visible in any "send to cloud / send to AI" affordance unless the para explicitly opted in.

### 3.4 Chromebook target

- Tap targets ≥ 32px (≥ 40px when handed to a student)
- 1366×768 must work without horizontal scroll
- No mobile-first patterns (don't hide things behind hamburger menus)

---

## 4. Visual design system

All tokens live in `src/styles/styles.css`. **Do not hard-code hex** — always use CSS vars.

### 4.1 Color tokens

```
Backgrounds
  --bg-deep:       #0a0f1c   /* page */
  --bg-dark:       #0f1524   /* sidebar, inputs */
  --bg-surface:    #131a2e   /* subtle cards */
  --panel-bg:      #161e36   /* default panel */
  --panel-raised:  #1f2a4b   /* elevated cards, modals */

Text (soft white, not pure)
  --text-primary:    #e7ecf5
  --text-secondary:  #a7b3cf
  --text-muted:      #6d7b9a
  --text-dim:        #455477

Brand (Academic Blue — chrome, links, active states)
  --accent:         #3b82f6
  --accent-strong:  #2563eb
  --accent-hover:   #60a5fa

CTA (Orange — ONLY .btn-primary uses this)
  --cta:         #f97316
  --cta-hover:   #fb923c
  --cta-active:  #ea580c

State (semantic, single-purpose)
  --green:   #22c55e   /* success */
  --yellow:  #eab308   /* caution */
  --red:     #ef4444   /* alert */
```

### 4.2 Color rules (these are the ones designers break most)

- **Orange = action.** `.btn-primary` is the ONLY orange element. **One per screen, max.**
- **Blue = identity & state.** Brand mark, active nav, links, "has content" indicators.
- **Violet exists only in the brand gradient** (`--grad-brand`). Don't use violet for everyday UI.
- **No new shadows.** Use `--shadow-sm/md/lg` + `--shadow-cta` (orange).

### 4.3 Buttons

```
.btn-primary     Solid orange — the action on the screen
.btn-secondary   Surface bg, bordered — everyday actions
.btn-ghost       Transparent — tertiary, icon buttons
.btn-action      Tinted blue — "do-something" secondary CTA
.btn-sm          Size modifier
```

### 4.4 Typography

System UI font stack. Sizes in pixels (the codebase isn't using rem). Common scale:
- `11px` muted / labels
- `12px` body small (use sparingly — Chromebook resolution)
- `13-14px` body default
- `16-18px` section headings
- `20-24px` modal titles

### 4.5 Layout grid

- Sidebar: ~220px fixed left
- Main content: flex 1
- Right toolbox panel (when open): ~320px
- At 1366px wide: sidebar(220) + main + toolbox(320) = ~826px for main = TIGHT. Don't add a third side panel.

---

## 5. Screen inventory

Five top-level views + two modes + a sidebar + a toolbox.

### 5.1 Top-level views (sidebar nav)

| View | File | What it does |
|---|---|---|
| **Dashboard** | `src/features/dashboard/Dashboard.jsx` | Hero header with student cards, "Today's Plan", quick log entry, AI chat panel. The default landing. Currently 1378 lines, busy. |
| **Saved notes** (currently labeled "Data Vault") | `src/App.jsx` `renderVault()` | Searchable / filterable / sortable table of every log. Inline in App.jsx ~line 345. Currently called "Data Vault" — should be "Saved notes" or "Logbook". |
| **IEP Import** | `src/features/import/IEPImport.jsx` | Three competing import paths + Smart Import banner. Confusing — too many entry points. New paras get paralysis here. |
| **Analytics** | `src/features/analytics/AnalyticsDashboard.jsx` | Bar charts of log volume by day, by type, by student. Groups feature for tracking student cohorts. |
| **Admin Dashboard** | `src/components/AdminDashboard.jsx` | Team owner / sped teacher only. Member management, role changes, parent notes settings, sub access toggle, invite codes. 752 lines. |

### 5.2 Modes (alternate UIs that take over the screen)

| Mode | File | What it does |
|---|---|---|
| **Simple Mode** | `src/features/simple-mode/SimpleMode.jsx` | One-tap-per-category logging. Two-column student grid. Inline note when a student is "focused." For paras who don't want the full dashboard. |
| **Stealth Mode** | `src/features/stealth/StealthScreen.jsx` | Panic-hide screen for observer walk-ins. Currently shows generic "Classroom Tools" with student-safe tools (timer, breathing, etc). Being upgraded to "dad-joke decoy" + PIN-locked exit. |

### 5.3 Sidebar (always visible on the left)

- App brand mark (top)
- Top nav (Dashboard / Saved notes / Import / Analytics / Admin)
- Toolbox section: Situations, Quick Actions, Support Card, ABC Builder, Goal Tracker, Handoff, Para Checklist, Strategies, Training Gap
- Tools section: Timer, Calculator, Mult Chart, CER, Breathing, Grounding (each can be sidebar / floating window / fullscreen)
- Bottom: Real Names controls, Stealth Mode trigger, Settings, Help, Sign out

### 5.4 Sidebar panels (open in the right toolbox column)

| Panel | File | Purpose |
|---|---|---|
| Situation Picker | `src/components/panels/SituationPicker.jsx` | Tap a classroom situation → instant recommended moves / cards / tools |
| Quick Actions | `src/components/panels/QuickActionPanel.jsx` | One-tap actions to log against a student |
| Support Card | `src/components/panels/SupportCardPanel.jsx` | Strategies for the focused student |
| ABC Builder | `src/components/panels/ABCBuilder.jsx` | Structured incident log (currently uses BCBA jargon — needs renaming) |
| Goal Tracker | `src/components/panels/GoalTracker.jsx` | Per-student IEP goal progress with donut charts |
| Handoff | `src/components/panels/HandoffBuilder.jsx` | Compose end-of-shift handoff for next para |
| Checklist | `src/components/panels/ParaChecklist.jsx` | Before/During/End of shift checklist |
| Strategies | `src/components/panels/StrategyLibrary.jsx` | Search/browse all strategies |
| Training Gap | `src/components/panels/TrainingGapPanel.jsx` | Topics to bring to next teacher check-in |

### 5.5 Modals

| Modal | File | Trigger |
|---|---|---|
| Student Profile | `src/components/modals/StudentProfileModal.jsx` | Click any student card |
| Email Draft | `src/components/modals/EmailModal.jsx` | "Draft Email" action — AI drafts, para copies |
| Situation Response | `src/components/modals/SituationResponseModal.jsx` | Auto-triggered when a situation matches recent log keywords |
| AI Insight | `src/components/modals/OllamaInsightModal.jsx` | AI pattern summary or handoff draft |
| Onboarding | `src/components/OnboardingModal.jsx` | First load — 5-slide tour |
| Team Onboarding | `src/components/TeamOnboardingModal.jsx` | Create / join a team |
| Real Names persist confirm | `src/components/RealNamesControls.jsx` | When para clicks "Remember on this computer" |

### 5.6 Tools (six small utilities, each render in 3 contexts)

`src/components/tools/`: VisualTimer, CalculatorTool, MultChart, CEROrganizer, BreathingExercise, GroundingExercise.

Three contexts:
1. Sidebar panel (single-click nav button) — narrow column
2. Floating window (double-click — `src/components/layout/FloatingToolWindow.jsx`)
3. Fullscreen (`src/components/layout/FullscreenTool.jsx`)
4. Stealth mode landing (student-safe tools only)

---

## 6. Common patterns

### 6.1 Modal pattern

- Overlay `<div className="modal-overlay">` with onClick = close
- Inner `<div className="modal-content">` stops propagation
- Close `×` button top-right, `aria-label="Close"`
- `useEscape(onClose)` from `src/hooks/useEscape.js`
- One `.btn-primary` (orange) per modal — usually bottom-right

### 6.2 Panel pattern

- Lives in `src/components/panels/`
- Renders inside a fixed-width sidebar column
- Title row + body
- "One orange per panel" rule

### 6.3 Empty states

Always include: an explanation + a next action. Example:

> No strategies match "transitions". [Clear search]

Bare empty states ("No data") are a project rule violation.

### 6.4 Privacy framing

Every place that touches student data needs a quiet privacy line nearby. Examples:

- "Real names stay on this computer"
- "Only the 6-digit number leaves this device"

---

## 7. Known UX issues (full audit results from 2026-04-27)

These were flagged by a multi-agent UX audit. Many fixed already; remaining ones grouped by severity.

### 7.1 Already fixed in code (don't re-flag)

- `OllamaStatusBadge` model name now displays correctly
- `AnalyticsDashboard` doesn't crash on undefined `groups` or orphan logs
- `AdminDashboard` Pause button hidden when self (was lockout footgun)
- All four content modals support Esc-to-close
- Onboarding backdrop click no longer marks "seen forever"
- Auth loading shows Reload button after 10s of being stuck
- Stealth Mode no longer broadcasts "Student-Safe View" or "Exit Stealth" labels
- `RealNamesControls` got a prominent "Remember on this computer" banner instead of a hidden ghost button
- Various banned-word fixes (roster JSON → name list file, etc.)

### 7.2 Still open — privacy / trust

- **EmailModal has no FERPA disclosure** before AI sends. Para can't tell if real names made it into the prompt.
- **Stealth tool list is hardcoded** instead of a `safeForStudentView` metadata flag — drifts as toolbox grows.
- **`tool.label` rendered raw in stealth chrome** — defense-in-depth gap if a future tool name has identifying text.
- **TeamSwitcher leaks invite code** in plain text to all roles, projector/screenshare risk.

### 7.3 Still open — para-first framing failures

- **ABCBuilder uses "Antecedent / Behavior / Consequence"** — paras don't have BCBA training. Needs plain-English labels.
- **TrainingGapPanel reads as surveillance** — copy literally says "visible to your sped teacher so they can come ready with tips." Needs reframe.

### 7.4 Still open — data loss / footguns

- **CEROrganizer loses student work** when context-switching from sidebar to popout (state isn't lifted).
- **AdminDashboard sub-toggle has no undo** — flipping off mid-shift kicks all subs instantly.

### 7.5 Still open — visual hierarchy

- **Multiple primary (orange) buttons per screen**: Dashboard has 5, Vault has 3, IEPImport has up to 4. Project rule is one. Visual hierarchy collapses.
- **~150 inline hex colors** still scattered across Dashboard, IEPImport, Analytics, Tools, StealthScreen — full token migration outstanding.

### 7.6 Still open — discoverability

- **Tap targets too small** in sidebar (`fontSize: 11` buttons ≈28px tall) — under the 32px floor.
- **Stealth Mode trigger** is a small red button in the bottom corner — easy to miss in panic.
- **Settings modal** isn't visually obvious from the sidebar.

---

## 8. Design files / design system source of truth

- All tokens: `src/styles/styles.css`
- Brand identity: blue + orange + dark navy
- No Figma file currently exists — see Section 10 for how to bootstrap one if needed.

---

## 9. How to give visual context to a Claude design session

This brief is text. For real design help, pair with images.

**Recommended screenshot set** (take these from a logged-in browser):

1. Dashboard with 6+ student cards visible
2. Simple Mode with a focused student + the inline note row
3. Stealth Mode landing
4. Student Profile modal — Overview tab
5. Email Modal mid-AI-draft
6. IEP Import landing (showing the 3 import cards + Smart Import hero)
7. Sidebar with a panel open (e.g., Situation Picker)
8. Admin Dashboard members tab
9. Onboarding modal slide 2 (Privacy)
10. Mobile-ish narrow viewport (resize browser to ~1100px wide) showing how things wrap

Then: paste this brief + the screenshots into a fresh Claude.ai conversation. Say "Here's my app — I want to redesign the Dashboard." Claude will have enough context to give grounded suggestions in the SupaPara voice.

---

## 10. If you want a working Figma file

Skip if you'll use screenshot-paste. If you do want Figma:

1. Free Figma account at figma.com
2. Create blank file
3. Install the `html.to.design` plugin
4. Plugin → Import URL → `https://supapara.vercel.app`
5. Plugin pulls live screens into editable Figma frames
6. Take screenshots of any auth-walled screens, drag the PNGs in
7. Iterate in Figma → screenshot the new design → paste into Claude chat alongside this brief

---

## 11. Fast facts cheatsheet (copy this for one-line context)

> **SupaPara**: React/CRA classroom helper for special-ed paraprofessionals on Chromebooks. Dark navy + academic blue + orange CTA. FERPA-strict (real names local-only, cloud uses 6-digit Para App Numbers). Plain English UI (banned: JSON, bundle, roster, pseudonym, vault, FERPA, BIP, EBP). Chromebook 1366×768 baseline. One orange `.btn-primary` per screen. Para-first framing always.

---

*End of brief. Pair with screenshots when handing to a Claude design conversation.*
