# Simple Mode → Para Entry Point: Audit & Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform Simple Mode from a buried toggle into the primary, situation-first, clutter-free entry point for para educators.

**Architecture:** Additive/reuse-based — no new logging systems, no new data models, no roster architecture changes. Changes are display/UX layer only in Phase 1–2, with optional deeper wiring in Phase 3.

**Tech Stack:** React (state/hooks), existing `SimpleMode.jsx`, `App.jsx`, `identity.js` (`getStudentLabel`), `models` (`getHealth`, `hdot`), `engine` (`runLocalEngine`), `data.js` (`SUPPORT_CARDS`, `SITUATIONS`, `DASH_ACTIONS` pattern)

---

## AUDIT

---

### 1. Current Simple Mode Findings

**Location:** `src/components/SimpleMode.jsx` (237 lines), activated via `simpleMode` boolean in `App.jsx:48`

**Entry Point:** A small button buried at the bottom of the sidebar (`App.jsx:574`) labeled "📝 Para Notes Mode" — below Stealth Mode, below 8 toolbox items, below 4 nav items, after scrolling the full sidebar. There is no default-on state, no onboarding prompt, no prominence.

**What the toggle actually does:**
- `simpleMode=true` replaces `<main>` content with `<SimpleMode>` (`App.jsx:587–595`)
- **The sidebar still renders fully.** The para sees: Date picker, Active Period selector, 4 nav links (Dashboard, Vault, Import, Analytics), 8 toolbox buttons (Situations, Quick Actions, Cards, ABC Builder, Goal Tracker, Handoff, Checklist, Strategies, Timer, Breathing), Stealth Mode, Para Notes Mode toggle, Private Roster. That is ~15–18 interactive sidebar items visible while Simple Mode is supposedly "on."

**SimpleMode component — 3-step flow:**
1. **Step: "students"** — list of all students in current period, showing color dot, label (`getStudentLabel` compact), eligibility, today's note count
2. **Step: "note"** — back button, student header, 6 category buttons in 2-col grid, free textarea, IEP quick-ref strip, Save button
3. **Tool overlay** — replaces entire view with VisualTimer or BreathingExercise (no back to student list without full replace)

**Critical data bug:** `SimpleMode` reads directly from `DB.periods[activePeriod].students` and `DB.students[id]` (lines 30, 135, 163). It does **not** use `effectivePeriodStudents` or `allStudents` from App. This means any student imported via IEPImport will be invisible in Simple Mode.

**Props received:** `{ activePeriod, setActivePeriod, logs, addLog, currentDate }` — `allStudents` is not passed, imported student data is absent.

**CATEGORIES in Simple Mode (6):**
- Behavior 🔴, Work Refusal ✋, Transition 🔔, Positive! ⭐, Needed Break 🚶, Academic Help 📚

**DASH_ACTIONS in Dashboard (8):** Observed ✓, Participated 🙋, Behavior ⚠, Goal Check ★, Break ☕, Accommodation ♿, Escalation 🔴, Add Note 📝

**Verdict on Simple Mode today:**
- It is "less stuff" not "para-first"
- The first click is NOT obvious — the toggle is at the bottom of the sidebar under ~15 other things
- A stressed para could NOT use it in under 3 seconds on first encounter
- Once inside, the 3-step flow is reasonable but the full sidebar sitting next to it creates cognitive load
- The category buttons are somewhat situation-first (Transition, Work Refusal, Needed Break) but they're small, equal-weight, presented as a grid of 6 with no visual hierarchy
- Health/alert signals are absent on the note entry screen
- No 1-tap action from the student list — you always must go through the category/note step

---

### 2. What Already Exists That We Should Reuse

| Asset | Location | What it gives us |
|---|---|---|
| `getStudentLabel(s, "compact")` | `identity.js` | FERPA-safe display: "🔥 Ember 1" |
| `getHealth(id, logs, currentDate)` | `models/index.js` | green/yellow/red health signal per student |
| `hdot(health)` | `models/index.js` | colored dot emoji for quick health display |
| `addLog(studentId, note, type, extras)` | `App.jsx:163` | The one canonical logging path — already used by SimpleMode |
| `runLocalEngine(...)` | `engine/index.js` | Already wired in SimpleMode's `handleSave` — tags, situationId, topic detection all happen automatically |
| `CATEGORIES` array | `SimpleMode.jsx:13` | 6 situation-style categories already defined |
| `DASH_ACTIONS` array | `Dashboard.jsx:16` | 8 action types — richer set, same log-type mapping pattern |
| `SUPPORT_CARDS` | `data.js` | 7 cards with `whenToUse`, `steps`, `whatToSay` — perfect situation tooltips |
| `SITUATIONS` | `data.js` | Situation engine data — already powers SituationPicker |
| `VisualTimer`, `BreathingExercise` | `tools.jsx` | Already in SimpleMode tool overlay |
| `effectivePeriodStudents` | `App.jsx:103` | Merged DB + imported students — not yet passed to SimpleMode |
| `allStudents` | `App.jsx:99–102` | Identity-patched merged student map — not yet passed to SimpleMode |
| Period picker | `SimpleMode.jsx:118–126` | Already exists inside SimpleMode — just needs to be styled as primary |
| IEP quick-ref strip | `SimpleMode.jsx:208–218` | Already shows student accommodations on note screen |
| `s.alertText` / `s.flags?.alert` | `Dashboard.jsx:302–306` | Alert banner pattern — can be reused in SimpleMode student cards |

---

### 3. Main UX Problems Blocking Para Adoption

**Problem 1: The sidebar kills the mode** (severity: critical)
The sidebar is fully visible when Simple Mode is active. The para is looking at Dashboard, Vault, IEP Import, Analytics, 8 toolbox tools, Stealth Mode, and Private Roster while supposedly in Simple Mode. The "simplified" experience exists only in the center column. A para in a stressful moment will see the sidebar as noise and/or accidentally leave Simple Mode by clicking a nav item.

**Problem 2: The toggle is impossible to find** (severity: critical)
The "Para Notes Mode" button is the 3rd item from the bottom of the sidebar, below many other controls. A new para has no reason to scroll there. There is no onboarding prompt, no feature highlight, no default state.

**Problem 3: No 1-tap action from student list** (severity: high)
Tapping a student always takes you to the note step. For the most common para actions (positive note, break taken, participated), a second screen adds friction. Dashboard allows 1-click from the student card — SimpleMode doesn't.

**Problem 4: Imported students don't appear** (severity: high, data correctness)
`SimpleMode` reads `DB.students` directly, not `allStudents`. Any student added via IEP Import is invisible. This is a silent data gap — the para won't know they're missing someone.

**Problem 5: Category buttons have no visual hierarchy** (severity: medium)
All 6 categories are the same size, weight, and prominence. In a moment of stress, there's no way for the eye to jump to "behavior" or "escalation" faster. The Dashboard's `DASH_ACTIONS` renders action buttons with distinct colors; SimpleMode categories look uniform.

**Problem 6: Health/alert state is invisible on note entry** (severity: medium)
On step 1 (student list) you can see today's note count, but once you're on the note step you can't see the student's health signal or any alert flags. A para writing a note about Pink Student (BIP active) doesn't see the BIP warning.

**Problem 7: No period context on note screen** (severity: low)
The note entry step shows the student but not which period/class you're currently in. Easy to lose context if interrupted.

---

### 4. Recommended Direction for Simple Mode

**Core principle:** Simple Mode should feel like a walkie-talkie, not a control panel. One question per screen. Maximum 3 taps to log anything.

**Mode activation:** Make it the default for a para session, or at least front-and-center. Move the toggle to the top of the app (BrandHeader region) as a tab or mode switcher — not buried in the sidebar.

**Sidebar in Simple Mode:** Hide it entirely, or reduce to a thin icon strip with only period switcher and an exit button. The current sidebar is the biggest source of cognitive load.

**Student list improvements:**
- Show health signal prominently (color, hdot)
- Show alert badge for BIP students
- Add 2–3 quick-tap action buttons directly on the student card (no second screen needed for common actions like ✓ Positive or ☕ Break)
- Pass `allStudents` and `effectivePeriodStudents` so imported students appear

**Note entry improvements:**
- Show BIP/alert warning on the note screen header
- Show student's top 2 accommodations at a glance
- Maintain the category buttons but increase the most-urgent ones visually
- Keep the free textarea as optional

**What NOT to add to Simple Mode:**
- AI chat / Copilot
- Analytics, KB upload, handoff builder
- Google Doc integration
- Multi-period master chat

---

### 5. Proposed Implementation Plan

---

#### Phase 1 — Fix the Invisible and the Broken (Safe, Additive, No Architecture Risk)

**Files that will change:**
- `src/App.jsx` — pass `allStudents` + `effectivePeriodStudents` to SimpleMode; move mode toggle higher in the layout
- `src/components/SimpleMode.jsx` — accept and use `allStudents`/`effectivePeriodStudents` props; show health + alert on student cards

**Files that will NOT change:** `data.js`, `engine/index.js`, `models/index.js`, `identity.js`, any roster/import components

---

**Task 1: Pass correct student data to SimpleMode**

Files:
- Modify: `src/App.jsx:589–595`
- Modify: `src/components/SimpleMode.jsx:22,30,135,163`

- [ ] In `App.jsx`, add `allStudents={allStudents}` and `effectivePeriodStudents={effectivePeriodStudents}` to the `<SimpleMode>` prop list
- [ ] In `SimpleMode.jsx`, add `allStudents` and `effectivePeriodStudents` to the destructured props on line 22
- [ ] Replace `DB.periods[activePeriod].students` (line 30 reference via `period.students`) with `effectivePeriodStudents` in the student list render (line 135)
- [ ] Replace `DB.students[id]` (line 163) with `allStudents[id]` in the note step
- [ ] Replace `DB.students[id]` on line 137 in the health call with `allStudents[id]`
- [ ] Verify: imported students now appear in the list
- [ ] Commit: `fix: pass allStudents + effectivePeriodStudents to SimpleMode`

---

**Task 2: Add health signal + alert badge to student cards**

Files:
- Modify: `src/components/SimpleMode.jsx:135–158` (student list render)

- [ ] Import `hdot` from `../models` (already imports `getHealth`)
- [ ] In student card render, add `hdot(health)` next to the student name — same pattern as `Dashboard.jsx:321`
- [ ] Add alert badge if `s.alertText || s.flags?.alert` — same pattern as `Dashboard.jsx:302–306`
  - Show a small `⚠ BIP` tag in red on the student card
- [ ] On the note entry step header (`SimpleMode.jsx:173–179`), show the alert text if present
- [ ] Commit: `feat: show health dot and alert badge on SimpleMode student cards`

---

**Task 3: Promote the Simple Mode toggle to a visible location**

Files:
- Modify: `src/App.jsx:533–585` (main render, sidebar)

- [ ] Move the "Para Notes Mode" button from the bottom of the sidebar to the top — above the Date and Active Period controls, or into the BrandHeader region
- [ ] Change label to "Simple Mode" (consistent with `SimpleMode` component name and intent)
- [ ] Make it visually prominent: larger button, contrasting background when active
- [ ] Keep the existing toggle logic (`setSimpleMode(!simpleMode)`) — no state changes needed
- [ ] Commit: `feat: promote Simple Mode toggle to top of sidebar`

---

#### Phase 2 — Reduce Clutter in Simple Mode (Medium Risk — Display Only)

**Goal:** When `simpleMode=true`, hide sidebar sections that add cognitive load without benefiting paras in the moment.

**Files that will change:**
- `src/App.jsx` — conditional rendering of sidebar sections based on `simpleMode`

**Files that will NOT change:** Component files, data layer, engine, identity

---

**Task 4: Simplify the sidebar when Simple Mode is active**

Files:
- Modify: `src/App.jsx:550–585` (aside/sidebar)

- [ ] Wrap the Navigation section (`App.jsx:554–558`) in `{!simpleMode && (...)}` — paras don't need Vault/Import/Analytics while in Simple Mode
- [ ] Wrap the Toolbox section (`App.jsx:560–568`) in `{!simpleMode && (...)}` — tools are accessible from inside SimpleMode already (timer, breathing)
- [ ] Keep visible in simple mode: Date control, Active Period selector, Simple Mode toggle (to exit), FERPA label
- [ ] Keep Private Roster button visible (roster lookup should still be accessible)
- [ ] Keep Stealth Mode button visible (safety feature)
- [ ] Commit: `feat: hide nav and toolbox in sidebar when Simple Mode is active`

---

**Task 5: Add 1-tap quick actions on the student list**

Files:
- Modify: `src/components/SimpleMode.jsx:128–158` (student list step)

- [ ] On each student card in the list step, add 2 icon buttons for the highest-frequency actions: `⭐ Positive` and `☕ Break`
- [ ] These buttons call `addLog` directly (same args as `handleSave`) without navigating to the note step
- [ ] Use the existing `CATEGORIES` entries for `logType` and `tag` — no new data needed
- [ ] Keep the full card tap → note entry flow for anything needing a note
- [ ] Commit: `feat: add 1-tap positive and break buttons to SimpleMode student list`

---

#### Phase 3 — Situation-First Prompting (Optional, Higher Value, Slightly More Effort)

**Goal:** Replace "What's happening? (tap one or skip)" with a situation-first prompt that surfaces the most relevant support card inline.

**Files that will change:**
- `src/components/SimpleMode.jsx` — note step UI
- No data or engine changes needed — `SUPPORT_CARDS` and `SITUATIONS` already exist in `data.js`

**Files that will NOT change:** Logging system, identity, roster, engine

---

**Task 6: Surface support card hint on category select**

Files:
- Modify: `src/components/SimpleMode.jsx:183–218` (note step, category section)

- [ ] When a category is selected, find the matching `SUPPORT_CARDS` entry by tag (e.g., `selectedCat === "behavior"` → `sc_escal`, `selectedCat === "refusal"` → `sc_refusal`)
- [ ] Show the card's `whenToUse` text and first 2 `whatToSay` items inline below the category buttons
- [ ] No modal, no toolbox — just a small inline hint box
- [ ] Keep the textarea and Save button unchanged
- [ ] Import `SUPPORT_CARDS` from `../data`
- [ ] Commit: `feat: show inline support card hint when SimpleMode category selected`

---

### 3 Things NOT to Change Yet

1. **The logging system** — `addLog`, `createLog`, `runLocalEngine` are all already wired correctly into SimpleMode. Do not touch them.
2. **The roster/identity architecture** — `allStudents`, `effectivePeriodStudents`, `identityOverrides`, `patchIdentity` — these are working correctly in Dashboard; just pass them through to SimpleMode.
3. **The period picker inside SimpleMode** — it works fine as-is. Don't replace or re-style it until Phase 2 layout work is done.

---

### 3 Highest-Value Changes for Paras

1. **Hide the sidebar nav/toolbox in Simple Mode** (Task 4) — single biggest cognitive load reduction. The para will finally see only what they need.
2. **Pass `allStudents` + `effectivePeriodStudents`** (Task 1) — silent correctness fix. Without this, imported students are invisible.
3. **Promote the toggle to top of sidebar** (Task 3) — without discovery, nothing else matters.

---

### 1 Recommended First Milestone

**"A para can open the app, find Simple Mode in under 3 seconds, and see all their students (including any imported ones) with health signals."**

This requires only Tasks 1, 2, and 3 — all low-risk, display/prop changes only, no architecture risk, no data layer changes. Completable in one session.

---

### Risk Register

| Risk | Severity | Mitigation |
|---|---|---|
| `DB.students` direct reads in SimpleMode miss imported students | High (silent data gap) | Task 1 fixes this |
| Hiding sidebar nav may confuse if para needs Vault during Simple Mode | Low | Keep a small "Exit Simple Mode" affordance; para can always toggle back |
| `effectivePeriodStudents` includes period-mapped imported students — SimpleMode period switcher would need to also call `setActivePeriod` to re-derive the list | Low | Already handled: `setActivePeriod` is passed as a prop and used in the period picker at line 120 — the parent re-derives `effectivePeriodStudents` on each render |
| Adding quick-tap actions to student list increases list card height — may cause scroll issues on small screens | Low | Use compact icon buttons with small padding, not full labels |
| Inline support card hints (Phase 3) may clutter the note step if card content is long | Medium | Limit to `whenToUse` + 2 `whatToSay` items, no steps |
| Touching the BrandHeader area for toggle promotion risks layout regressions | Low | Safer to place toggle at top of sidebar controls rather than inside BrandHeader |

---

### Files Summary

| File | Phase | Type of change |
|---|---|---|
| `src/App.jsx` | 1, 2 | Prop pass-through, toggle relocation, conditional sidebar |
| `src/components/SimpleMode.jsx` | 1, 2, 3 | Use allStudents, health signal, quick-tap actions, card hints |

No new files. No changes to: `data.js`, `engine/`, `models/`, `identity.js`, `components/panels.jsx`, `components/windows.jsx`, `components/modals.jsx`, `components/Dashboard.jsx`, `components/AnalyticsDashboard.jsx`, `components/IEPImport.jsx`
