# SupaPara — Features Deep Dive

Each feature explained: what it does for the user, how it's built under the hood, and where the relevant code lives.

## 1. Simple Mode (fast 1-tap logging)

**What it does:** A para mid-classroom-chaos opens Simple Mode, sees a grid of student rows, and taps a category icon next to a student's name. The log saves instantly. A 5-second undo toast appears. An inline detail bar lets them type more if they want — or ignore it.

**Categories:** Positive ⭐ / Academic 📚 / Break ☕ / Transition 🔔 / Refusal ✋ / Behavior 🔴.

**v3 features:**
- **Inline quick-note bar** — opens below the student row after a tap. 12-second timer that freezes when the user focuses the input. Saves on Enter, dismissable with Escape.
- **Today's summary strip** — pills at the top showing how many of each category logged today. Click a pill to filter to "students who haven't gotten this yet today."
- **Double-tap a category** — jumps to the full note screen with that student + category pre-selected. For paras who DO want to write.
- **Responsive grid** — 1 column on narrow, 2 columns on wide (>520px).
- **PatternsCard inline** — when the quick-note bar opens, the "What worked before" card appears below the input.

**Code:**
- `src/features/simple-mode/SimpleMode.jsx` — main component
- `buildQuickLogParams(categoryId)` — pure helper that returns the log shape for a 1-tap action
- `buildStudentRows(...)` — pure helper for student row data
- Tests: `src/__tests__/simpleMode.test.js`, `quickLog.test.js`

## 2. Normal Mode (Dashboard) with Apple-style note sheet

**What it does:** The thoughtful logging mode. A para taps a quick-action icon on a student card → an Apple-style sheet opens with:
- Action icon tile + title + student chip with color dot
- Big textarea (140px+ tall) labeled "What happened?"
- "What worked before" history card
- "Similar past situations" if Case Memory has matches
- Two save buttons: **"Save note"** (orange primary, requires text) and **"Save without note"** (secondary, only when textarea empty)

**Keyboard:** Esc closes. Cmd/Ctrl+Enter saves with note.

**Class-wide rapid mode** is preserved: pick an action at the top, then tap students for 1-click rapid logging. Per-card taps go through the sheet.

**Code:**
- `src/features/dashboard/Dashboard.jsx` — main file (~900 lines)
- The sheet is rendered conditionally on `noteTarget` state
- Uses `getStudentPatterns` + `PatternsCard` for the history section
- Uses `matchCaseKeywords` for the "Similar past situations" panel

## 3. Real Names Vault (the privacy core)

**What it does:** Lets a para load a saved name list file so the app shows real names instead of "Red Student 1" or 6-digit numbers. The file stays on the computer — never uploads.

**UI:** Sidebar widget called "Real Names" with:
- Toggle: "Show real names"
- "Load name list file" button (file picker accepts JSON)
- Status pill when loaded
- Optional "Remember on this device" checkbox (opens a privacy explanation modal)
- "Purge" button when remembered

**Inactivity wipe:** After 14 days without app activity, IndexedDB auto-wipes and shows an "Stored names expired" banner.

**Code:**
- `src/context/VaultProvider.jsx` — owns the state
- `src/components/RealNamesControls.jsx` — sidebar UI + persistence modal
- `src/features/roster/RosterPanel.jsx` — file load + extract identity entries
- `src/features/roster/rosterUtils.js` — JSON validation
- `src/privacy/realNameVault.js` — IndexedDB layer

## 4. Smart Import (flagship import flow)

**What it does:** An admin uploads (1) a name list with Para App Numbers and (2) an IEP document (PDF, DOCX, or pasted text). The app:
1. Strips real names from the IEP text using `[STUDENT]` placeholders.
2. Sends the scrubbed text to AI (Ollama or Gemini).
3. AI returns structured JSON: per student, extracts goals, accommodations, eligibility, strategies, triggers, watch-fors, do-this-actions, health notes.
4. The app builds a "bundle" file containing the IEP data + a `privateRosterMap` linking real names to Para App Numbers.
5. Match report shows which students matched cleanly + any conflicts.
6. Offers local backup via File System Access API — picks a folder, saves bundle + private name list + a README explaining each file.

**Privacy:** Names are stripped before any AI call. Gemini's privacy warning is shown explicitly when the user provides an API key.

**Cloud AI uses `responseMimeType: "application/json"` + `responseSchema`** so Gemini returns guaranteed-valid JSON, not free-form text.

**PDF handling:** PDF text extraction uses `pdfjs-dist` with a local bundled worker (`src/utils/pdfWorker.js`). The app no longer loads the PDF worker from a CDN, so import does not depend on cdnjs during document handling.

**Code:**
- `src/features/import/SmartImport.jsx` — UI
- `src/features/import/iepExtractor.js` — pure extraction: `splitByStudents`, `extractAllStudents`, `buildBundleFromExtraction`, `buildMatchReport`, `stripNameFromSection`
- `src/engine/cloudAI.js` — Gemini adapter with `geminiParseIEP`
- `src/engine/ollama.js` — Ollama adapter with `ollamaParseIEP`
- `src/engine/aiProvider.js` — router; returns `'local'` or `'cloud'`
- `src/utils/localBackup.js` — File System Access API picker + downloads fallback

## 5. Second Brain (pattern memory)

**What it does:** When a para opens the note sheet for a student, they see "What worked before" — a small card showing:
- Top 2 supports that have worked for this student (chips)
- Top 2 supports that didn't work (chips)
- Most common behavior tag
- A "Try: [support]" suggestion with a "Use this" button that drafts a line into the textarea

**Keyword classification** (no AI required):
- Success keywords: worked, calmed, improved, helped, settled, engaged, focused, completed, etc.
- Fail keywords: didn't work, escalated, refused, walked out, eloped, melted down, etc.

**Code:**
- `src/features/analytics/getStudentPatterns.js` — pure function. Takes (studentId, logs) → returns `{commonBehaviors, successfulSupports, failedSupports, recentPatterns}`. Also exports `logsInLastHours(studentId, logs, hours)` used by the Vault priority signal.
- `src/features/analytics/PatternsCard.jsx` — compact component
- Wired into both Simple Mode (quick-note bar) and Dashboard (Apple sheet)

## 6. Student Profile Modal

**What it does:** Deep student view opened from Dashboard, Analytics, and Data Vault.

**Tabs:**
- Overview — strengths, triggers, para notes, quick log, identity label editor
- Goals — IEP goals with one-click goal progress logging
- Accommodations — support list
- Strategies — strategy list
- Support Info — watch-fors, do-this-actions, health notes, cross-period notes when imported data includes them
- Logs — per-student log history
- Parent Notes — admin-only tab for Owner / Sped Teacher roles

**Guided behavior detail flow:** When the note text looks help-worthy/significant, the modal offers "Add Help Details." The guided flow captures antecedent, intervention, result, aftermath, and optional staff note. Saving creates normal logs plus structured case-memory records.

**Identity editor:** Admin/para can customize the local identity label emoji/codename for a student; the real-name display still goes through `resolveLabel`.

**Code:**
- `src/components/modals/StudentProfileModal.jsx`
- `src/components/ParentNotesSection.jsx`
- `src/models/index.js` for incident/intervention/outcome shapes

## 7. Help Button / Case Memory Logging

**What it does:** Bottom-sheet support workflow for a current student. Para types what is happening, searches similar past cases for that student, and can log a new intervention/outcome.

**Flow:**
1. Search current situation text.
2. System tags context like escalation, sensory, refusal, academic, transition, shutdown.
3. Past case-memory results appear as `CaseMemoryCard`s.
4. Para can reuse a past intervention or log a new one.
5. After intervention logging, the panel prompts for outcome.
6. Companion logs are saved with `[Help]` prefix and tags such as `help_intervention` / `help_outcome`.

**Code:**
- `src/features/help/HelpButton.jsx`
- `src/features/help/HelpPanel.jsx`
- `src/features/help/CaseMemoryCard.jsx`
- `src/features/help/InterventionLogger.jsx`
- `src/features/help/OutcomeLogger.jsx`
- `src/hooks/useCaseMemory.js`
- `src/engine/index.js` for `searchCaseMemory` / `isHelpWorthy`

## 8. Priority Signaling

**What it does:** Students with **>3 logs in the last 24 hours** get marked "needs attention":
- In the Vault By Student dropdown, their name is prefixed with ⚠
- Their log rows get a subtle red tint (rgba(239,68,68,0.06)) — visible on scan but not shouty
- The Vault metric cards still show health-based counts (red/yellow/green) as a separate signal

**Code:**
- `logsInLastHours()` in `getStudentPatterns.js`
- Wired in `src/App.jsx` Vault renderer

## 9. Team mode (Supabase realtime + assigned rosters)

**What it does:** When a sped teacher creates a team and shares the 6-letter invite code, paras join. Logs marked "shared" + handoffs sync in real time across the team's open browsers.

Admins can assign students to paras/subs. Paras and subs load only:
- students assigned to them through `para_assignments`
- student rows they personally created

Admins load the full team roster. Paras can still add students to their active team; the access boundary is about preventing unnecessary access to unassigned students, not blocking para workflow.

**Realtime mechanism:** Supabase Realtime subscriptions filtered by `team_id`. When a teammate inserts a shared log, every other open browser gets a websocket event and updates their UI within ~1 second.

**Cloud sync errors:** Local actions still save locally first. If a cloud write fails for logs, imports, handoffs, incidents, interventions, or outcomes, the app shows a visible "Cloud sync issue" toast.

**Code:**
- `src/services/teamSync.js` — subscribe/publish helpers
- `src/context/TeamProvider.jsx` — current team + role + members
- `src/services/paraAssignments.js` — assignment RPC helpers + assigned-students view
- `src/components/TeamOnboardingModal.jsx` — create/join UI

## 10. Admin Dashboard

**What it does:** Owner/sped-teacher panel for the actual team-management work that happens before paras can use the app well.

**Visibility:** Only `owner` and `sped_teacher` roles see the Admin Dashboard nav item. Non-admin users who reach the component see "You don't have admin access to this team."

**Tabs:** (six)

1. **Get paras started**
   - Plain-English guide for sped teachers.
   - Explains the two keys each para needs: real name + 6-digit Para App Number.
   - Walks admins through loading students, assigning caseloads, sharing the para's file, and checking that the para can see names.
   - Includes CTA to open Assign Students.

2. **🔖 Coaching** (sped-teacher triage list — see feature 23 below for full detail)
   - Auto-detected training-gap topics across the team's shared logs.
   - Each row: topic title + para name + student pseudonym + relative age + "Share a tip with [Para]" button.
   - The button opens `ShareTipModal` (defined in the same file as `AdminDashboard.jsx`) — a copy-to-clipboard composer pre-filled with a friendly coaching message.
   - Empty state: *"Nothing to discuss right now — your team's logs look good."*
   - Deliberately minimal: no charts, no per-para counts, no "flag for follow-up," no "mark as addressed."
   - Backed by `runTrainingGapRules` in `src/engine/index.js`.

3. **Members**
   - Lists every team member with display name, role, joined date, and active/paused status.
   - Admin can change role, pause/resume, remove, or transfer ownership.
   - Roles: Owner, Sped Teacher, Para, Sub, legacy Member.
   - Owner promotions and demotions trigger a confirmation explaining the access impact.
   - Ownership transfer promotes the target to Owner first, then demotes the current user to Sped Teacher so there is no moment with zero admins.

4. **Assign Students**
   - Admin chooses an existing para/sub OR pre-registers a future para by school email.
   - Admin checks the students assigned to that person and saves.
   - Existing assignments pre-fill when a para is selected.
   - Saves only cloud-safe IDs/emails to Supabase.
   - Can export a CSV or a full assignment manifest for the para to load through Find My Students.
   - Real names used in exports come from the admin's local vault and are downloaded, not uploaded.

5. **Access**
   - One master switch: "Allow subs to use the app."
   - When off, `sub` users see the locked screen and backend RLS denies access too.

6. **Settings**
   - Shows team name and invite code.
   - Admin can regenerate invite code. Old code becomes invalid for people who have not joined.

**Parent notes:** Parent notes are not a tab in Admin Dashboard; they appear inside the Student Profile Modal. Only Owner / Sped Teacher roles can read/write/delete them, and RLS enforces that server-side.

**RPCs:** Role/member/assignment mutations go through Supabase RPC functions that double-check role server-side. RLS also blocks paused members and disabled subs at the database layer.

**Code:**
- `src/components/AdminDashboard.jsx` (also defines `CoachingTopicsSection` + `ShareTipModal` inline)
- `src/components/ParaAssignmentPanel.jsx`
- `src/components/ParentNotesSection.jsx`
- `supabase/migrations/20260423100600_roles_and_admin.sql` — RPC definitions
- `supabase/migrations/20260425100800_para_assignments.sql` — assignment table + RPCs
- `supabase/migrations/20260426120000_access_control_hardening.sql` — current active/sub/assignment RLS hardening

## 11. AI Copilot (chat panel)

**What it does:** Right-side resizable chat panel on the Dashboard. Para asks anything: "What can I do for [student] when they refuse work?" / "Draft a handoff for next period" / "Summarize this week."

**Provider router** (`aiProvider.js`):
- If Gemini API key is set in localStorage → cloud
- Else if Ollama is online at `localhost:11434` → local
- Else → "AI offline" badge, chat input disabled

**Local AI:** Ollama with `qwen2.5:7b-instruct`. ~5GB model. Free. Requires user to have Ollama running.

**Cloud AI:** Google Gemini. User provides their own API key (stored only in localStorage). Pricing is on the user.

**Privacy:** All prompts go through `buildContext.js` which uses `resolveLabel`. Real names never reach either AI.

**Code:**
- `src/engine/aiProvider.js` — router
- `src/engine/ollama.js` — local client
- `src/engine/cloudAI.js` — Gemini client (uses responseSchema for JSON tasks)
- `src/context/buildContext.js` — prompt builders for: general AI, pattern summary, handoff draft, teaching suggestions, email draft, case memory, and one-shot support suggestion
- `src/hooks/useChat.js` — chat state + send/receive

## 12. Handoffs

**What it does:** End of a para's shift — they compose a handoff for the next person.

**Form fields:** Audience (Next Para / Teacher / End of Day / Urgent), Urgency (Normal / Important / Urgent), Student or "all this period", Summary, Action Needed.

**Sharing:** Checkbox to share with team. Shared handoffs appear in teammates' Handoff Inbox in real time.

**AI Draft button:** When local AI is online, drafts a handoff based on today's logs.

**Code:**
- `src/components/panels/HandoffBuilder.jsx`
- `src/components/HandoffInbox.jsx`

## 13. Find My Students

**What it does:** One modal for paras to match their real student names to the team records they are allowed to see.

**Inputs supported:**
- paste names + Para App Numbers
- CSV / JSON / Markdown / TXT / PDF name-list files
- Admin-exported assignment manifest files

**Flow:**
1. Para opens the Dashboard banner or sidebar path to Find My Students.
2. They paste/upload a file.
3. Parser extracts name + Para App Number pairs.
4. `onIdentityLoad()` loads those names into the local vault/identity registry.
5. `claimPendingAssignments()` runs so pending email assignments bind to the current user.
6. If names loaded successfully, the modal offers "Remember on this device."

**Privacy:** This is local identity matching. Real names go into the local vault. Supabase sees assignments and student IDs, not the uploaded names.

**Code:**
- `src/components/FindMyStudentsModal.jsx`
- `src/features/import/rosterParsers.js`
- `src/utils/assignmentManifest.js`
- `src/services/paraAssignments.js`

## 14. Stealth Mode

**What it does:** Panic-hide. The app instantly disguises itself as a calculator, timer, or breathing-exercise tool when an observer enters unexpectedly. Tap a hidden corner to come back.

**Code:** `src/features/stealth/`

## 15. Demo / Showcase Mode

**What it does:** "Load Demo" button on the Dashboard seeds the app with realistic IEP students, incidents, interventions, and outcomes so paras and admins can try the app without real data. Banner indicates demo mode is on.

**Code:**
- `src/data/demoSeedData.js` — seed data
- `src/features/showcase/` — banner + state

## 16. Data Vault (interactive log browser)

**What it does:** Search/filter/sort/expand every log ever recorded.

- Tabs: All Logs / By Student / By Period / Flagged / Handoffs / Goals / Notes
- Search across notes, types, students, tags
- Sortable columns
- Click ▶ to expand any row to see full text + edit/delete
- Three exports: filtered (CSV pseudonyms only) / everything / with real names (yellow warning)
- Priority signal: ⚠ + red tint for students with >3 logs in 24h

**Code:** `src/App.jsx` `renderVault()` (currently part of App.jsx, candidate for extraction)

## 17. Analytics Dashboard

**What it does:** Visual summary screen for logs and patterns.

**Current surface:**
- custom date range
- student-level cards
- group analytics
- opens student profile from analytics
- optional local AI pattern summary when Ollama is online

**Code:**
- `src/features/analytics/AnalyticsDashboard.jsx`
- `src/features/analytics/getStudentPatterns.js`
- `src/App.jsx` holds the `groups` state passed into analytics

## 18. Settings Modal

**What it does:** Flat settings screen from the sidebar.

**Sections:**
- Display: show/hide Find My Students banner, show real names, remember names on this device
- Help: replay onboarding
- Account: sign out

**Privacy note:** Settings delegates real-name persistence to `VaultProvider`; it does not create another storage path.

**Code:** `src/components/SettingsModal.jsx`

## 19. Bug Report / Feedback

**What it does:** Sidebar button opens a modal for bugs, ideas, or help requests.

**Flow:**
- user picks Bug / Idea / Need help
- writes a quick title and what happened
- clicking Send opens the user's email client to `Sampletutoring@gmail.com`
- email body includes page URL, timestamp, and browser user-agent
- no student names are included automatically

**Code:** `src/components/BugReportButton.jsx`

## 20. Onboarding Modal

**What it does:** 5-slide welcome tour shown to every new user (and re-openable from the sidebar "?" button):
1. **Welcome** — what SupaPara does
2. **Privacy** — the rule, the Para App Number system
3. **Para App Number** — what it is, how the admin assigns it
4. **Team mode** — how it works, when to skip it
5. **How to start** — Smart Import / Load Demo / Sign in with Google

**Code:** `src/components/OnboardingModal.jsx`

## 21. Local AI start/stop scripts

**What it does:** Desktop shortcuts on the user's Linux Mint computer that start/stop Ollama via systemd. Show up in the Start menu.

**Files:**
- `~/Desktop/start-supapara-ai.sh`
- `~/Desktop/stop-supapara-ai.sh`
- `~/.local/share/applications/SupaPara-AI-Start.desktop` (and stop)

## 22. CSV Exports

Two flavors:
- `exportCSV(logs)` — pseudonyms only. Default. Public-safe.
- `exportCSVPrivate(logs)` — names included. Bright yellow button. For the para's private gradebook.

**Code:** `src/utils/exportCSV.js`

## 23. Training-Gap Agenda — "Topics for Next Check-in" + Coaching tab

**What it does:** A two-sided feature designed around one product principle: paras don't always know when something they're doing isn't best practice. Without a structural way to surface those gaps, sped teachers either review every log (impractical) or guess. The Training-Gap Agenda surfaces specific patterns from the team's logs as **coaching topics** — *not* records, *not* flags, *not* per-para performance reports.

**Para's side — `🔖 Topics for Next Check-in` toolbox panel:**
- Para presses **Generate Topics for Next Check-in** when prepping for a meeting with their sped teacher.
- App runs the rules engine over the para's local logs and shows 0–N fired topics.
- Each topic shows the title, a plain-English explainer, and "another approach to try." A `Why is this topic on our agenda?` button reveals the audit panel: the rule that fired, the threshold, the window, and every matching log with timestamps + pseudonyms.
- A small `?` button next to the Generate button reveals a one-line description plus the disclosure: *"Topics here are also visible to your sped teacher so they can come ready with tips."*
- No para name appears anywhere on the para's view. (See Hard Rule #3 in the spec.)

**Sped teacher's side — `🔖 Coaching` tab in Admin Dashboard:**
- Auto-detected. Runs the same rules engine over `team.sharedLogs`, attributed per-para.
- Each row: topic title + para name + student pseudonym + relative age + one button **Share a tip with [Para's first name]**.
- The button opens `ShareTipModal` — a copy-to-clipboard textarea pre-filled with a friendly coaching message (greeting, the topic, the explainer, "a few things to try," "want to talk through it at our next check-in?"). The sped teacher edits, copies, sends from their normal email/Slack/text. No auto-send, no in-app notification to the para.
- Empty state: *"Nothing to discuss right now — your team's logs look good."*

**Why auto-detect (not opt-in by the para):** the whole reason this feature exists is paras don't always know when something is a gap. Requiring the para to share gaps they don't recognize as gaps filters out the most valuable cases. Logs are already cloud-synced — sped teachers already have read access via RLS. The training-gap rules are a **new lens on data the sped teacher already has access to**, not new data exposure.

**Hard rules baked into the design** (from the spec):
1. Only patterns trigger topics — single log = no topic, ever (threshold ≥3 in window).
2. No per-incident "this log is wrong" callouts.
3. No para name on topics in the para's own view (sped-teacher view does include para names — actionability requires it).
4. Para and sped teacher see identical topic content; only the para-name attribution differs.
5. Markers only appear in the export view, never interrupt the live logging UI.
6. Sped teacher's only action is "share a tip" — no flag, no follow-up record, no performance note.
7. Language audit: never "flagged," "non-compliant," "audit," "review required" — always "topic," "tip," "another approach to try."
8. Visually neutral markers (small bookmark icon, no red, no warning glyphs).
9. Every topic is auditable — para can ask "why is this on our agenda?" and see the rule + the matching logs.

**Architecture — hybrid rule format:**
- Rules are JSON-style descriptors (in `src/engine/trainingGapRules.js`) that reference named JS predicates by string. v1 ships **3 rules** using **1 predicate** (`countWithoutCounter`).
- Predicate library is in `src/engine/trainingGapPredicates.js`. Each predicate is a single named function, testable in isolation.
- Orchestrator: `runTrainingGapRules(logs, studentIds)` in `src/engine/index.js`. Iterates rules per (student, rule), suppresses any rule from firing on a student with fewer than `NEW_STUDENT_MIN_LOGS` (10) total logs.

**v1 rules (all use `countWithoutCounter`):**

| Rule | Topic title | What fires it |
|---|---|---|
| Escape-Reinforcement | *When breaks help vs. when they backfire* | Same student, 3+ logs in 7 days tagged `break`/`regulation`, with 0 logs tagged `fct` or `replacement_skill`. |
| Attention-Loop | *Catching them being good — when the redirect is the reward* | Same student, 3+ logs in 7 days tagged `redirect`/`behavior`, with ≤1 log tagged `positive`/`praise`. |
| Reactive-Without-Skill-Building | *What we want them to do instead* | Same student, 3+ logs in 14 days tagged `redirect`/`deescalation`/`break`, with 0 logs tagged `skill_teaching`/`replacement`. |

**v2 deferred (in spec, not shipped):** Missing-Antecedent Pattern (would require an antecedent field on every log) and Prompt-Dependency Pattern (would require prompt-level tracking on intervention logs). Both warrant their own brainstorms.

**Two new `QUICK_ACTIONS`** were added to support the rules' counter side:
- `qa_break_requested` — **"Student Asked for a Break"** 🙋 — `tags: ['break','fct','replacement_skill','regulation','positive']`. Suppresses Rule 1 when a student properly requests breaks.
- `qa_skill_taught` — **"Showed a Better Way"** 🌱 — `tags: ['skill_teaching','replacement','positive']`. Suppresses Rule 3 when a para logs teaching a replacement skill.

Both labels are positive-framed so adding them gives the para *more* credit-taking surface, not more burden.

**Code:**
- `src/engine/trainingGapPredicates.js` — predicate library (currently 1 predicate)
- `src/engine/trainingGapRules.js` — 3 rule descriptors + `NEW_STUDENT_MIN_LOGS`
- `src/engine/index.js` — `runTrainingGapRules` orchestrator
- `src/components/panels/TrainingGapPanel.jsx` — para's toolbox panel with audit panels
- `src/components/AdminDashboard.jsx` — defines `CoachingTopicsSection` + `ShareTipModal` inline
- Tests: `src/__tests__/trainingGapPredicates.test.js` (8) + `src/__tests__/trainingGapEngine.test.js` (9)
- Spec: `docs/superpowers/specs/2026-04-26-training-gap-agenda-design.md`

## 24. Toolbox panels (rest of the inventory)

The sidebar Toolbox renders panels inline. Most have their own deep-dive sections in this doc; the rest are listed here for completeness.

| Panel | What it does | File |
|---|---|---|
| Situations | Pick a classroom situation → recommended moves, support cards, tools | `panels/SituationPicker.jsx` |
| Quick Actions | One-tap logging — pick action, then tap student | `panels/QuickActionPanel.jsx` |
| Support Cards | Searchable card library with category chips and color-coded sections (post-`798ac7f` redesign) | `panels/SupportCardPanel.jsx` |
| ABC Builder | Antecedent/Behavior/Consequence record builder | `panels/ABCBuilder.jsx` |
| Goal Tracker | Quick goal-progress logging | `panels/GoalTracker.jsx` |
| Handoff Notes | Inter-para handoff drafting (with optional Ollama draft) | `panels/HandoffBuilder.jsx` |
| 🔖 Topics for Next Check-in | Training-Gap Agenda (see feature 23) | `panels/TrainingGapPanel.jsx` |
| Checklist | Before/during/after class checklist | `panels/ParaChecklist.jsx` |
| Strategies | Searchable strategy library | `panels/StrategyLibrary.jsx` |

## 25. Student-facing Tools (the "For your student" group)

Six tools in the toolbox group `For your student`. They're flagged `studentSafe: true` so a para can pop them into a floating window and turn the screen toward the kid. They live in `src/components/tools/` and use `FloatingToolWindow.jsx` for drag/resize popout behavior.

| Tool | Purpose | File |
|---|---|---|
| **Visual Timer** | Countdown with shrinking ring; for timed work or breaks | `tools/VisualTimer.jsx` |
| **Breathing Exercise** | Guided 4-4-6 breathing visual | `tools/BreathingExercise.jsx` |
| **Grounding (5-4-3-2-1)** | Sensory grounding walkthrough for anxiety/dissociation | `tools/GroundingExercise.jsx` |
| **Calculator** | Calculator with fraction conversion | `tools/CalculatorTool.jsx` |
| **Multiplication Chart** | Interactive 12×12 chart | `tools/MultChart.jsx` |
| **CER Organizer** | Claim / Evidence / Reasoning writing scaffold | `tools/CEROrganizer.jsx` |

Some tools also exist as `REG_TOOLS` data entries in `src/data.js` (Calming Screen, First/Then Board, Visual Countdown, Break Choices) but those are listed as references in support cards and don't have their own UI components yet.

## 26. Modals not covered above

- `EmailModal.jsx` — case-manager email draft flow (Ollama-backed). Used by the per-student "draft email to case manager" action (`useOllamaInsights`).
- `OllamaInsightModal.jsx` — local-AI summary of patterns for one student.
- `SituationResponseModal.jsx` — situation-detail response with recommended moves, support cards, and tools, opened from the Situations panel.
- `StudentProfileModal.jsx` — full profile view with parent notes (sped-teacher only).
