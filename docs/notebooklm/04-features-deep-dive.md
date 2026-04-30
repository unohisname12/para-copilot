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
- **Today's topic in the header** — the most relevant Topics-for-Next-Check-in surfaces at the top of the view, so a para glancing at Simple Mode at the start of class sees the one thing worth keeping in mind today without having to dig.
- **Quick-views shortcut** — a small toolbar jumps straight to Recent logs / Goals / Topics views. The use case: a para mid-class who wants to verify what was logged five minutes ago without leaving Simple Mode and losing their place.

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

**Persistence on reload:** The Dashboard remembers your last-used view (Dashboard / Simple Mode / Vault / etc.), period selector, and Simple Mode on/off state. A para who flips to Simple Mode for a tough period, closes the laptop, then opens it again next class doesn't have to re-pick everything. The settings ride along across the reload.

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

**Two-slot bundle picker:** A sped teacher who exported a bundle previously may have it as two files — a `.md` with the IEP data and a `.csv` with the name list. If they drop only one of those into the picker, the modal doesn't fail; it tells them which slot is filled and which is missing, then waits for the second drop. Same effect as the original "drop both at once" path, just with an obvious recovery when the para is matching files mentally on the fly.

**Bundle imports replace, don't merge:** When a para re-imports a bundle for the same period, the previous students for that period are purged before the new set lands. This stops half-stale rosters from accumulating across re-imports. Cross-period kids (one student in Period 1 and Period 3) are protected — see "Cross-period roster handling" below.

**Code:**
- `src/features/import/SmartImport.jsx` — UI
- `src/features/import/iepExtractor.js` — pure extraction: `splitByStudents`, `extractAllStudents`, `buildBundleFromExtraction`, `buildMatchReport`, `stripNameFromSection`
- `src/engine/cloudAI.js` — Gemini adapter with `geminiParseIEP`
- `src/engine/ollama.js` — Ollama adapter with `ollamaParseIEP`
- `src/engine/aiProvider.js` — router; returns `'local'` or `'cloud'`
- `src/utils/localBackup.js` — File System Access API picker + downloads fallback

## 5. Legacy CSV Import (years of past logs into the Vault)

**What para problem does this solve?** Most paras don't start fresh. They have years of notes already living somewhere — a Google Sheet they kept on the side, a district behavior-tracking program, paper notebooks they typed up at home. When they switch to SupaPara, that history shouldn't have to be abandoned. Without it, "the patterns view" is empty for months until enough new logs accrue, and the "what worked before" history card has nothing to show. Legacy Import is the bridge: pull all of it in once, and the Vault, the patterns view, and the second-brain history cards immediately have something to work with.

**Where to find it:** Settings → Advanced → **Legacy Import**. Three-step modal.

**Step 1 — Upload + parse + match.** The para drops in a CSV. The parser is RFC 4180-compliant: handles BOM, quoted fields, embedded commas, unterminated quotes (it surfaces the error rather than silently truncating), and column-count mismatches. Once parsed, every row's name is normalized (whitespace, casing, smart-quotes, "Last, First" flipped to "First Last") and matched against the current roster:
- **Exact match** — same normalized name → auto-link.
- **Fuzzy match** — Jaro-Winkler similarity above the threshold → flagged for review.
- **Ambiguous** — multiple plausible candidates → flagged for review.
- **Unmatched** — no candidate.

**Step 2 — Review table.** Anything that wasn't a clean exact match shows up in a review table. Per row, the para sees the legacy name from the file, the suggested current-roster match (with similarity score for fuzzies), and a dropdown to pick a different student or skip the row entirely. Ambiguous rows force a confirm; nothing fuzzy gets ingested without a human nod.

**Step 3 — Confirm + ingest.** Confirmed rows ingest through the same `addLog` path that normal logs use, so they land in the Vault as first-class entries with timestamps preserved from the CSV. Before writing, a dedupe pass compares against existing Vault entries on (studentId, timestamp, note text) — re-running the import doesn't double-log. A para who pulls from their Google Sheet today and again next week (after adding more rows there) gets only the new rows on the second run.

**Privacy:** Same as everything else — real names live in the legacy CSV on the para's computer. The match step uses the local Vault. Cloud writes use the studentId/paraAppNumber, never the real name.

**Code:**
- `src/features/import/LegacyImportModal.jsx` — three-step modal
- `src/features/import/legacyImport.js` — `parseLegacyCsv`, `matchRowsToVault`, `dedupeAgainstLogs`
- `src/features/import/fuzzyMatch.js` — `normalizeName` + Jaro-Winkler

## 6. paraAppNumber as the FERPA-safe stable bridge

**What para problem does this solve?** A para's local `studentId` values aren't stable forever. A school re-import regenerates them. A fresh device starts from scratch. A `Reset data on this computer` wipes them. Without a stable bridge, every log written under the old `studentId` becomes orphaned data — visible in a flat Vault export but not connected to a student card, a profile modal, or a patterns view. The whole point of two years of history evaporates.

The fix: every student carries a **paraAppNumber** — the para-app-internal stable identifier (the same 6-digit Para App Number a para sees in the UI). It survives roster regeneration. The student-registry layer was already using it as the cloud-safe key. Now the log layer and the export layer do too:

- **Profile modal** — the per-student logs filter (`stuLogs`) merges by `studentId` *and* `paraAppNumber`. A log written under an old `studentId` still appears under the right kid's profile after a re-import.
- **CSV / xlsx export** — the `external_key` column carries paraAppNumber, so an export from before the regen lines up with an export from after on a stable column.
- **Cloud sync (`teamSync.toLogRow`)** — surfaces paraAppNumber alongside the row so cloud peers can re-resolve too.

This is invisible when it's working. The visible win is "I re-imported and didn't lose anything."

**Code:**
- `src/features/roster/rosterUtils.js` — `resolveStudentByParaAppNumber`
- `src/components/modals/StudentProfileModal.jsx` — the merged `stuLogs` filter
- `src/services/teamSync.js` — `toLogRow` surfaces `external_key`
- `src/utils/exportCSV.js` — exports include the stable column

## 7. Second Brain (pattern memory)

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

## 8. Student Profile Modal

**What it does:** Deep student view opened from Dashboard, Analytics, and Data Vault.

**Tabs:**
- Overview — strengths, triggers, para notes, quick log, identity label editor
- Goals — IEP goals with one-click goal progress logging
- Accommodations — support list
- Strategies — strategy list
- Support Info — watch-fors, do-this-actions, health notes, cross-period notes when imported data includes them
- **Tools & Supports** — per-student fact base. The para can record whether the kid has a break-card setup, what the BIP status is, what their reinforcement system looks like, and similar setup-level facts. The training-gap rules engine reads this fact base to tailor coaching tips. (For example: if "break card available" is logged here, a Rule-1 topic about break overuse can phrase its tip differently than for a kid who has no replacement skill yet.)
- Logs — per-student log history (uses the merged paraAppNumber-aware filter — see feature 6)
- Parent Notes — admin-only tab for Owner / Sped Teacher roles

**Guided behavior detail flow:** When the note text looks help-worthy/significant, the modal offers "Add Help Details." The guided flow captures what happened before, what the para tried, the result, the aftermath, and an optional staff note. Saving creates normal logs plus structured case-memory records. The guided save no longer creates duplicate incident records — it correctly upserts on the open incident for the student instead of inserting a fresh one each time.

**Identity editor:** Admin/para can customize the local identity label emoji/codename for a student; the real-name display still goes through `resolveLabel`.

**Code:**
- `src/components/modals/StudentProfileModal.jsx`
- `src/components/ParentNotesSection.jsx`
- `src/components/modals/ClarifierModal.jsx` — the per-action clarifier the Tools & Supports flow shares
- `src/models/index.js` for incident/intervention/outcome shapes

## 9. Help Button / Case Memory Logging

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

## 10. Priority Signaling

**What it does:** Students with **>3 logs in the last 24 hours** get marked "needs attention":
- In the Vault By Student dropdown, their name is prefixed with ⚠
- Their log rows get a subtle red tint (rgba(239,68,68,0.06)) — visible on scan but not shouty
- The Vault metric cards still show health-based counts (red/yellow/green) as a separate signal

**Code:**
- `logsInLastHours()` in `getStudentPatterns.js`
- Wired in `src/App.jsx` Vault renderer

## 11. Team mode (Supabase realtime + assigned rosters)

**What it does:** When a sped teacher creates a team and shares a join code, paras join. Logs marked "shared" + handoffs sync in real time across the team's open browsers.

Admins can assign students to paras/subs. Paras and subs load only:
- students assigned to them through `para_assignments`
- student rows they personally created

Admins load the full team roster. Paras can still add students to their active team; the access boundary is about preventing unnecessary access to unassigned students, not blocking para workflow.

**Realtime mechanism:** Supabase Realtime subscriptions filtered by `team_id`. When a teammate inserts a shared log, every other open browser gets a websocket event and updates their UI within ~1 second.

**Cloud sync errors:** Local actions still save locally first. If a cloud write fails for logs, imports, handoffs, incidents, interventions, or outcomes, the app shows a visible "Cloud sync issue" toast.

### Three ways to join a team

The team-onboarding modal auto-detects which kind of code the user pasted and routes accordingly.

1. **Para invite code** — 6 letters. The classic flow: a sped teacher copies the code from the team settings, drops it in a Slack/text/email to a para, the para pastes it and lands as a `para`. Multi-use, regeneratable.

2. **Owner code** — `OWN-XXXXXXXX` (12 chars total, with a distinct prefix so the client recognizes it as an owner code, not an invite code). Joining via owner code grants `sped_teacher` role with full admin rights — manage roster, members, settings, parent notes — without making the joiner the team's *owner* (the original creator stays the owner unless ownership is transferred). The use case: a school has two sped teachers, or one sped teacher already created the team and needs to bring a co-teacher in with admin rights from the start. Multi-use, regeneratable by existing owners. The Supabase function `create_team` generates the owner code at insert time so it's always present.

3. **Request to join** — when a para tries to join a team they're not invited to, they can submit a "request to join" with their display name, role they want (para or sub), and an optional message. The request lands in the team owner's admin inbox. The owner reviews it and approves or denies. Approval auto-creates the team_members row at the requested role, so the para gets in with one click on the owner's side. This is the path for "I know the team exists but nobody sent me a code."

**Code:**
- `src/services/teamSync.js` — subscribe/publish helpers
- `src/context/TeamProvider.jsx` — current team + role + members
- `src/services/paraAssignments.js` — assignment RPC helpers + assigned-students view
- `src/components/TeamOnboardingModal.jsx` — create/join UI; auto-detects code format

### Similar-name detection on team create + type-to-confirm gate

**Para problem:** Without a check, two paras at the same school each "create the team" the same week, end up with two SupaPara teams that should have been one, and student rows fragment across both. Cleanup is painful. So the team-create form pre-flights for existing teams whose normalized name looks similar (case, whitespace, punctuation collapsed) and nudges the para toward "request to join the existing team" instead.

But there's a real case where two teams *should* have the same name — two schools in different districts with the same name, separate orgs, separate paras. The override flow handles this with a **type-to-confirm gate**: to override the duplicate warning, the para has to type the existing team name exactly. This prevents one-click duplicates while still allowing legitimate separate teams. (No "I'm sure, click again" button — that's too easy to bypass.)

## 12. Admin Dashboard

**What it does:** Owner/sped-teacher panel for the actual team-management work that happens before paras can use the app well.

**Visibility:** Only `owner` and `sped_teacher` roles see the Admin Dashboard nav item. Non-admin users who reach the component see "You don't have admin access to this team."

**Tabs:**

1. **Get paras started**
   - Plain-English guide for sped teachers.
   - Explains the two keys each para needs: real name + 6-digit Para App Number.
   - Walks admins through loading students, assigning caseloads, sharing the para's file, and checking that the para can see names.
   - Includes CTA to open Assign Students.

2. **🔖 Coaching** (sped-teacher triage list — see feature 25 below for full detail)
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

4. **Inbox** (pending join requests)
   - When a para submits a "request to join" (see Three ways to join in feature 11), the request shows up here with the para's display name, the role they asked for (para or sub), the optional message they sent, and a relative timestamp.
   - One click to approve (auto-creates the team_members row at the requested role) or deny.
   - Once handled, the request disappears from the list.

5. **Assign Students**
   - Admin chooses an existing para/sub OR pre-registers a future para by school email.
   - Admin checks the students assigned to that person and saves.
   - Existing assignments pre-fill when a para is selected.
   - Saves only cloud-safe IDs/emails to Supabase.
   - Can export a CSV or a full assignment manifest for the para to load through Find My Students.
   - Real names used in exports come from the admin's local vault and are downloaded, not uploaded.

6. **Access**
   - One master switch: "Allow subs to use the app."
   - When off, `sub` users see the locked screen and backend RLS denies access too.

7. **Settings**
   - Shows team name and invite codes.
   - Admin can regenerate invite code (the 6-letter para code) and the owner code (`OWN-...`). Old codes become invalid for people who have not joined.

**Parent notes:** Parent notes are not a tab in Admin Dashboard; they appear inside the Student Profile Modal. Only Owner / Sped Teacher roles can read/write/delete them, and RLS enforces that server-side.

**RPCs:** Role/member/assignment/join-request mutations go through Supabase RPC functions that double-check role server-side. RLS also blocks paused members and disabled subs at the database layer.

**Code:**
- `src/components/AdminDashboard.jsx` (also defines `CoachingTopicsSection` + `ShareTipModal` inline)
- `src/components/ParaAssignmentPanel.jsx`
- `src/components/ParentNotesSection.jsx`
- `supabase/migrations/20260423100600_roles_and_admin.sql` — RPC definitions
- `supabase/migrations/20260425100800_para_assignments.sql` — assignment table + RPCs
- `supabase/migrations/20260426120000_access_control_hardening.sql` — current active/sub/assignment RLS hardening

## 13. AI Copilot (chat panel)

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

## 14. Handoffs

**What it does:** End of a para's shift — they compose a handoff for the next person.

**Form fields:** Audience (Next Para / Teacher / End of Day / Urgent), Urgency (Normal / Important / Urgent), Student or "all this period", Summary, Action Needed.

**Sharing:** Checkbox to share with team. Shared handoffs appear in teammates' Handoff Inbox in real time.

**AI Draft button:** When local AI is online, drafts a handoff based on today's logs.

**Code:**
- `src/components/panels/HandoffBuilder.jsx`
- `src/components/HandoffInbox.jsx`

## 15. Find My Students

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

## 16. Verify Roster + Roster Health Check

**What para problem does this solve?** "Did my import actually work? Did the right kids land in the right periods? Are there ghost rows in the cloud that I forgot about?" Without an answer, the para refreshes, eyeballs the cards, hopes nothing's missing — and silent mismatches between what's loaded locally and what the cloud team table thinks exists are exactly the kind of bug that quietly poisons everything downstream.

**Where to find it:** Settings → **Verify Roster**.

**What it does:** Drop in the same roster CSV (or open it without a file to use the current local roster), and the tool runs a side-by-side audit:
- **Per kid** — confirms each row landed in the right period(s).
- **Local orphans** — rows that exist locally but not in the file you just dropped (helpful when checking "is the local state stale?").
- **Cloud orphans** — rows in the cloud `team_students` table that have no local match. These are the dangerous ones; they're the residue of past imports or ex-paras' uploads.

The report classifies every row and admins get a one-click cleanup for cloud orphans (with a confirm dialog, since cloud writes affect every para on the team). Non-admins see the cloud-orphan count but are nudged to ask their owner to clean up — they don't have the permission to do it themselves.

**Code:**
- `src/features/import/VerifyRoster.jsx` — UI + report rendering
- `src/features/import/verifyRoster.js` — pure audit logic

## 17. Stealth Mode

**What it does:** Panic-hide. The app instantly disguises itself as a calculator, timer, or breathing-exercise tool when an observer enters unexpectedly. Tap a hidden corner to come back.

**Code:** `src/features/stealth/`

## 18. Demo / Showcase Mode

**What it does:** "Load Demo" button on the Dashboard seeds the app with realistic IEP students, incidents, interventions, and outcomes so paras and admins can try the app without real data. Banner indicates demo mode is on.

**Code:**
- `src/data/demoSeedData.js` — seed data
- `src/features/showcase/` — banner + state

## 19. Data Vault (interactive log browser)

**What it does:** Search/filter/sort/expand every log ever recorded.

- Tabs: All Logs / By Student / By Period / Flagged / Handoffs / Goals / Notes
- Search across notes, types, students, tags
- Sortable columns
- Click ▶ to expand any row to see full text + edit/delete
- Three exports: filtered (CSV pseudonyms only) / everything / with real names (yellow warning)
- Priority signal: ⚠ + red tint for students with >3 logs in 24h

**Code:** `src/App.jsx` `renderVault()` (currently part of App.jsx, candidate for extraction)

## 20. Analytics Dashboard

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

## 21. Settings Modal

**What it does:** Flat settings screen from the sidebar.

**Sections:**
- **Display** — show/hide Find My Students banner, show real names, remember names on this device
- **Writing** — auto-polish notes on save, auto-grammar fix while typing (one toggle gates both — see feature 22)
- **Advanced** — Verify Roster (feature 16), Legacy Import (feature 5), Reset data on this computer
- **Help** — replay onboarding
- **Account** — sign out

**Privacy note:** Settings delegates real-name persistence to `VaultProvider`; it does not create another storage path.

**Code:** `src/components/SettingsModal.jsx`

## 22. Writing helpers — drafts, auto-polish, auto-grammar fix, spellcheck

**What para problem does this solve?** Logging notes during a real classroom day means typos, half-finished sentences, and "I had to close the laptop because the kid bolted and now my draft is gone." The writing-helper layer is four small fixes that together make logging feel less fragile.

### Drafts persist across clicks, closes, and reloads

Every logging textarea now uses a `useDraft` hook that auto-saves to localStorage as the para types, hydrates on mount, and clears explicitly when the para hits Save. Per-key (per-student, per-action), so switching from one kid to another and back preserves both drafts independently.

The use cases this fixes are all "the laptop interrupted the para mid-sentence" — accidental modal-backdrop clicks (the modal stayed open before; now even if it didn't, the draft would survive), Chromebook randomly going to sleep, flaky cafeteria-period wifi forcing a refresh, the para closing the modal to check something on a student card and reopening. None of those should lose three sentences of context. They don't.

The hook re-hydrates when the per-key changes (so swapping students mid-session pulls in the right draft, not the wrong one).

### Auto-polish on save (Phase G)

When the para hits Save, common typos get cleaned up before the note is written:
- `beucase` / `becase` / `bcause` / `becuase` → `because`
- smart-quotes (curly `’` `“` `”`) normalized to straight quotes for stable search/export
- multiple-space collapse, leading/trailing whitespace trim
- a small list of other high-frequency swaps

Subtle by design: paras shouldn't have to proofread their own real-time logs to look like they care about spelling. The polish runs once at save time, not every keystroke.

### Auto-grammar fix while typing (Phase D)

A lighter touch than auto-polish — while the para is *typing* in a logging textarea, common scrambles get nudged inline. Same Settings toggle as auto-polish; the para can turn both off if their typing style fights the suggestions.

### Native spellcheck

Every logging textarea gets `spellCheck="true"` so the browser's own red-underline flagging shows up. Free, no app code.

**Code:**
- `src/hooks/useDraft.js` — per-key autosave + hydrate + clear
- `src/hooks/useAutoGrammarFix.js` — while-typing fix
- `src/utils/autoPolish.js` — save-time polish
- Tests: `src/__tests__/useDraft.test.js`

## 23. Cross-period roster handling

**What para problem does this solve?** A real student is in two periods — say Mr. Smith's Period 1 and Ms. Jones's Period 3. Before the schema change, `team_students.period_ids` was a single value, so importing the Period 3 roster overwrote the Period 1 row's period membership, and the kid disappeared from Period 1. The para opened Period 1 next morning to find a missing student. Worse, removing a student from one period also wiped them from the other.

The fix is in two parts:

- **`team_students.period_ids` is now `text[]` (array)** instead of a singular value. A student carries the set of periods they're in. Cloud sync preserves the set across import operations.
- **Per-period purge** — when a student is removed from one period, the system checks whether they appear in any *other* period and only deletes the row if they don't. The kid stays alive in the periods they still belong to.

The roster CSV picked up an optional **Period** column to support this end-to-end (one row per period appearance), and `pushStudents` strips only the *uploader's* previous-but-now-orphaned cloud rows when re-uploading — other paras' rows are untouched. So a sub re-uploading their roster won't accidentally wipe what the regular para set up.

**Code:**
- `src/services/teamSync.js` — `pushStudents` selective cleanup
- `src/features/import/rosterParsers.js` — Period column
- `supabase/migrations/2026042*_period_ids_text_array.sql`

## 24. CSV + Sheets-ready xlsx exports

Three flavors:
- `exportCSV(logs)` — pseudonyms only. Default. Public-safe.
- `exportCSVPrivate(logs)` — names included. Bright yellow button. For the para's private gradebook.
- **Sheets-ready `.xlsx`** — opens cleanly in Google Sheets without manual formatting. Bold headers, zebra rows, frozen header row. The use case: a para drops their export into a shared Google Sheet for their sped teacher and doesn't have to spend ten minutes making it look like a real spreadsheet first.

All three include the `external_key` (paraAppNumber) column so exports stay correlatable across roster regenerations (see feature 6).

**Code:**
- `src/utils/exportCSV.js`
- `src/utils/exportXlsx.js`

## 25. Training-Gap Agenda — "Topics for Next Check-in" + Coaching tab

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

**Tailored tips via the per-student fact base:** When a topic fires for a student, the rules engine reads the student's Tools & Supports tab (feature 8) — break-card setup, BIP status, reinforcement system — and tailors the "another approach to try" text accordingly. A break-overuse topic for a kid with a working break card phrases the tip as "great that the card exists; how can we make sure they request it instead of waiting until you offer?" rather than the generic "consider a break card." This is the clarifier loop closing on its own — paras log setup-level facts once, and the coaching surface reads them every time.

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

**Two `QUICK_ACTIONS`** support the rules' counter side:
- `qa_break_requested` — **"Student Asked for a Break"** 🙋 — `tags: ['break','fct','replacement_skill','regulation','positive']`. Suppresses Rule 1 when a student properly requests breaks.
- `qa_skill_taught` — **"Showed a Better Way"** 🌱 — `tags: ['skill_teaching','replacement','positive']`. Suppresses Rule 3 when a para logs teaching a replacement skill.

Both labels are positive-framed so adding them gives the para *more* credit-taking surface, not more burden.

**Code:**
- `src/engine/trainingGapPredicates.js` — predicate library
- `src/engine/trainingGapRules.js` — 3 rule descriptors + `NEW_STUDENT_MIN_LOGS`
- `src/engine/index.js` — `runTrainingGapRules` orchestrator
- `src/components/panels/TrainingGapPanel.jsx` — para's toolbox panel with audit panels
- `src/components/AdminDashboard.jsx` — defines `CoachingTopicsSection` + `ShareTipModal` inline
- Tests: `src/__tests__/trainingGapPredicates.test.js` + `src/__tests__/trainingGapEngine.test.js`
- Spec: `docs/superpowers/specs/2026-04-26-training-gap-agenda-design.md`

## 26. Toolbox panels (rest of the inventory)

The sidebar Toolbox renders panels inline. Most have their own deep-dive sections in this doc; the rest are listed here for completeness.

| Panel | What it does | File |
|---|---|---|
| Situations | Pick a classroom situation → recommended moves, support cards, tools | `panels/SituationPicker.jsx` |
| Quick Actions | One-tap logging — pick action, then tap student | `panels/QuickActionPanel.jsx` |
| Support Cards | Searchable card library with category chips and color-coded sections (post-`798ac7f` redesign) | `panels/SupportCardPanel.jsx` |
| ABC Builder | Behavior record builder — what happened before, the behavior itself, what happened after | `panels/ABCBuilder.jsx` |
| Goal Tracker | Quick goal-progress logging | `panels/GoalTracker.jsx` |
| Handoff Notes | Inter-para handoff drafting (with optional Ollama draft) | `panels/HandoffBuilder.jsx` |
| 🔖 Topics for Next Check-in | Training-Gap Agenda (see feature 25) | `panels/TrainingGapPanel.jsx` |
| Checklist | Before/during/after class checklist | `panels/ParaChecklist.jsx` |
| Strategies | Searchable strategy library | `panels/StrategyLibrary.jsx` |

## 27. Student-facing Tools (the "For your student" group)

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

## 28. Modals not covered above

- `EmailModal.jsx` — case-manager email draft flow (Ollama-backed). Used by the per-student "draft email to case manager" action (`useOllamaInsights`).
- `OllamaInsightModal.jsx` — local-AI summary of patterns for one student.
- `SituationResponseModal.jsx` — situation-detail response with recommended moves, support cards, and tools, opened from the Situations panel.
- `ClarifierModal.jsx` — per-action clarifier the Tools & Supports tab uses to capture setup-level facts (break-card status, BIP, reinforcement system) that the training-gap engine reads to tailor coaching tips.
- `StudentProfileModal.jsx` — full profile view with parent notes (sped-teacher only).
- `LegacyImportModal.jsx` — three-step legacy CSV import (see feature 5).

## 29. Bug Report / Feedback

**What it does:** Sidebar button opens a modal for bugs, ideas, or help requests.

**Flow:**
- user picks Bug / Idea / Need help
- writes a quick title and what happened
- clicking Send opens the user's email client to `Sampletutoring@gmail.com`
- email body includes page URL, timestamp, and browser user-agent
- no student names are included automatically

**Code:** `src/components/BugReportButton.jsx`

## 30. Onboarding Modal

**What it does:** 5-slide welcome tour shown to every new user (and re-openable from the sidebar "?" button):
1. **Welcome** — what SupaPara does
2. **Privacy** — the rule, the Para App Number system
3. **Para App Number** — what it is, how the admin assigns it
4. **Team mode** — how it works, when to skip it
5. **How to start** — Smart Import / Load Demo / Sign in with Google

**Code:** `src/components/OnboardingModal.jsx`

## 31. Local AI start/stop scripts

**What it does:** Desktop shortcuts on the user's Linux Mint computer that start/stop Ollama via systemd. Show up in the Start menu.

**Files:**
- `~/Desktop/start-supapara-ai.sh`
- `~/Desktop/stop-supapara-ai.sh`
- `~/.local/share/applications/SupaPara-AI-Start.desktop` (and stop)
