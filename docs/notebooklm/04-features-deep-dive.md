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

## 6. Priority Signaling

**What it does:** Students with **>3 logs in the last 24 hours** get marked "needs attention":
- In the Vault By Student dropdown, their name is prefixed with ⚠
- Their log rows get a subtle red tint (rgba(239,68,68,0.06)) — visible on scan but not shouty
- The Vault metric cards still show health-based counts (red/yellow/green) as a separate signal

**Code:**
- `logsInLastHours()` in `getStudentPatterns.js`
- Wired in `src/App.jsx` Vault renderer

## 7. Team mode (Supabase realtime)

**What it does:** When a sped teacher creates a team and shares the 6-letter invite code, paras join. Logs marked "shared" + handoffs sync in real time across the team's open browsers.

**Realtime mechanism:** Supabase Realtime subscriptions filtered by `team_id`. When a teammate inserts a shared log, every other open browser gets a websocket event and updates their UI within ~1 second.

**Code:**
- `src/services/teamSync.js` — subscribe/publish helpers
- `src/context/TeamProvider.jsx` — current team + role + members
- `src/components/TeamOnboardingModal.jsx` — create/join UI

## 8. Admin Dashboard

**What it does:** Owner/sped-teacher panel for team management:
- Members table with role + active toggle
- Change role (Owner / Sped Teacher / Para / Sub)
- Multi-owner support; one-click "Transfer Ownership"
- "Allow subs" master switch
- Generate / revoke invite codes
- Add parent notes (sped-teacher only, private)

**RPCs:** All mutations go through Supabase RPC functions that double-check role server-side. Client cannot directly INSERT/UPDATE these tables.

**Code:**
- `src/components/AdminDashboard.jsx`
- `supabase/migrations/20260423_0006_roles_and_admin.sql` — RPC definitions

## 9. AI Copilot (chat panel)

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

## 10. Handoffs

**What it does:** End of a para's shift — they compose a handoff for the next person.

**Form fields:** Audience (Next Para / Teacher / End of Day / Urgent), Urgency (Normal / Important / Urgent), Student or "all this period", Summary, Action Needed.

**Sharing:** Checkbox to share with team. Shared handoffs appear in teammates' Handoff Inbox in real time.

**AI Draft button:** When local AI is online, drafts a handoff based on today's logs.

**Code:**
- `src/components/panels/HandoffBuilder.jsx`
- `src/components/HandoffInbox.jsx`

## 11. Stealth Mode

**What it does:** Panic-hide. The app instantly disguises itself as a calculator, timer, or breathing-exercise tool when an observer enters unexpectedly. Tap a hidden corner to come back.

**Code:** `src/features/stealth/`

## 12. Demo / Showcase Mode

**What it does:** "Load Demo" button on the Dashboard seeds the app with realistic IEP students, incidents, interventions, and outcomes so paras and admins can try the app without real data. Banner indicates demo mode is on.

**Code:**
- `src/data/demoSeedData.js` — seed data
- `src/features/showcase/` — banner + state

## 13. Data Vault (interactive log browser)

**What it does:** Search/filter/sort/expand every log ever recorded.

- Tabs: All Logs / By Student / By Period / Flagged / Handoffs / Goals / Notes
- Search across notes, types, students, tags
- Sortable columns
- Click ▶ to expand any row to see full text + edit/delete
- Three exports: filtered (CSV pseudonyms only) / everything / with real names (yellow warning)
- Priority signal: ⚠ + red tint for students with >3 logs in 24h

**Code:** `src/App.jsx` `renderVault()` (currently part of App.jsx, candidate for extraction)

## 14. Onboarding Modal

**What it does:** 5-slide welcome tour shown to every new user (and re-openable from the sidebar "?" button):
1. **Welcome** — what SupaPara does
2. **Privacy** — the rule, the Para App Number system
3. **Para App Number** — what it is, how the admin assigns it
4. **Team mode** — how it works, when to skip it
5. **How to start** — Smart Import / Load Demo / Sign in with Google

**Code:** `src/components/OnboardingModal.jsx`

## 15. Local AI start/stop scripts

**What it does:** Desktop shortcuts on the user's Linux Mint computer that start/stop Ollama via systemd. Show up in the Start menu.

**Files:**
- `~/Desktop/start-supapara-ai.sh`
- `~/Desktop/stop-supapara-ai.sh`
- `~/.local/share/applications/SupaPara-AI-Start.desktop` (and stop)

## 16. CSV Exports

Two flavors:
- `exportCSV(logs)` — pseudonyms only. Default. Public-safe.
- `exportCSVPrivate(logs)` — names included. Bright yellow button. For the para's private gradebook.

**Code:** `src/utils/exportCSV.js`
