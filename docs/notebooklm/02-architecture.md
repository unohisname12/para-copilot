# SupaPara — Architecture & Tech Stack

## Stack at a glance

| Layer | Tech | Notes |
|---|---|---|
| Frontend | **React 19** + Create React App (react-scripts 5) | No Next.js, no Tailwind |
| Styling | **Plain CSS variables** in `src/styles/styles.css` | Design system v3 ("Operator Blue") — Academic Blue + Orange CTA |
| Backend | **Supabase** | Postgres + Auth + Realtime + Row Level Security |
| Auth | Google OAuth via Supabase | Users pick a role at join time |
| Hosting | **Vercel** | Auto-deploy on push to `main` |
| Local AI | **Ollama** (`qwen2.5:7b-instruct`) | Runs on user's computer at `http://localhost:11434` |
| Cloud AI (paid) | **Google Gemini API** | Uses `responseMimeType: application/json` + `responseSchema` for guaranteed-valid JSON output |
| PDF parsing | `pdfjs-dist` | Used in Smart Import and roster import to read PDFs; worker is bundled locally, not loaded from a CDN |
| XLSX export | `xlsx` (SheetJS) | Used by `exportWorkbook.js` for Sheets-ready output |
| Tests | Jest (unit) + Playwright (e2e) | 616 unit tests passing across 48 suites |

## Repository layout

```
SuperPara/
├── src/
│   ├── App.jsx                       — shell, auth gate, sidebar, Data Vault screen
│   ├── index.tsx                     — React entry
│   ├── styles/styles.css             — ALL styling (no Tailwind, no CSS modules)
│   │
│   ├── app/providers/                — provider composition root
│   │
│   ├── components/                   — screens & modals
│   │   ├── AdminDashboard.jsx        — team management panel (owner/sped teacher only). Tabs: Get paras started, Coaching, Members, Assign Students, Access, Settings, plus the Phase C join-request inbox. Hosts CoachingTopicsSection + ShareTipModal helpers (defined in same file).
│   │   ├── ParaAssignmentPanel.jsx   — admin assigns students to paras/subs
│   │   ├── BrandHeader.jsx           — top-of-page brand strip
│   │   ├── Dashboard.jsx             — re-export shell
│   │   ├── IEPImport.jsx             — legacy IEP import page (3 cards above Smart Import)
│   │   ├── OnboardingModal.jsx       — multi-slide welcome tour
│   │   ├── SignInScreen.jsx          — Google sign-in landing
│   │   ├── RealNamesControls.jsx     — sidebar real-names toggle + persistence modal
│   │   ├── FindMyStudentsModal.jsx   — para loads names/assignment files for their students
│   │   ├── SettingsModal.jsx         — Display/Help/Account/Advanced/Danger zone tabs; opened via sidebar ⚙️ button. Hosts the auto-grammar-fix toggle and the Legacy CSV Import entry point.
│   │   ├── BugReportButton.jsx       — mailto support/idea/bug modal
│   │   ├── HandoffInbox.jsx          — incoming handoffs from teammates
│   │   ├── SimpleMode.jsx            — re-export
│   │   ├── SubLockedScreen.jsx       — shown when admin disables subs
│   │   ├── TeamSwitcher.jsx          — change which team you're viewing
│   │   ├── TeamOnboardingModal.jsx   — create/join a team. Auto-detects 6-char invite codes, OWN- owner codes, and offers "request to join" when neither matches an existing team.
│   │   ├── OllamaStatusBadge.jsx     — local-AI online/offline chip
│   │   ├── ParentNotesSection.jsx    — sped-teacher-only private parent notes
│   │   ├── modals/
│   │   │   ├── StudentProfileModal.jsx     — full profile + parent notes (sped teacher only). `stuLogs` filter is paraAppNumber-aware: when a kid's local id has rotated since a log was written, the log still resolves via paraAppNumber.
│   │   │   ├── EmailModal.jsx              — case-manager email draft (Ollama-backed)
│   │   │   ├── OllamaInsightModal.jsx      — local-AI student-pattern summary
│   │   │   └── SituationResponseModal.jsx  — situation-detail response modal
│   │   ├── panels/                   — toolbox panels rendered inline in the sidebar
│   │   │   ├── HandoffBuilder.jsx          — inter-para handoff note builder
│   │   │   ├── GoalTracker.jsx             — quick goal-progress logger
│   │   │   ├── QuickActionPanel.jsx        — pick action → tap student → log
│   │   │   ├── SituationPicker.jsx         — pick a classroom situation → recommendations
│   │   │   ├── SupportCardPanel.jsx        — searchable support card library with category chips
│   │   │   ├── StrategyLibrary.jsx         — searchable evidence-based strategy library
│   │   │   ├── ABCBuilder.jsx              — Antecedent / Behavior / Consequence builder
│   │   │   ├── ParaChecklist.jsx           — before/during/after class checklist
│   │   │   ├── TrainingGapPanel.jsx        — "🔖 Topics for Next Check-in" training-gap agenda
│   │   │   └── Section.jsx                 — shared collapsible section wrapper
│   │   ├── tools/                    — student-facing tools (`studentSafe: true`)
│   │   │   ├── VisualTimer.jsx, BreathingExercise.jsx, GroundingExercise.jsx
│   │   │   ├── CalculatorTool.jsx, MultChart.jsx, CEROrganizer.jsx
│   │   ├── layout/                   — FloatingToolWindow.jsx (drag/resize popouts), FullscreenTool.jsx
│   │   └── windows.jsx, panels.jsx, tools.jsx — re-export barrels
│   │
│   ├── context/
│   │   ├── VaultProvider.jsx         — React context: real-name vault, persistence, toggles
│   │   ├── TeamProvider.jsx          — React context: current team, role, members, cloud roster, sync warnings, join-request inbox + outbox
│   │   └── buildContext.js           — builds AI prompts from student data + patterns
│   │
│   ├── engine/
│   │   ├── aiProvider.js             — router: local vs cloud AI
│   │   ├── ollama.js                 — local AI client
│   │   ├── cloudAI.js                — Gemini client
│   │   ├── trainingGapPredicates.js  — named JS pattern-matching predicates (v1: `countWithoutCounter`)
│   │   ├── trainingGapRules.js       — JSON-style rule descriptors for the 3 v1 training-gap rules + `NEW_STUDENT_MIN_LOGS`
│   │   └── index.js                  — keyword engine, doc parser, situation matching, `runTrainingGapRules(logs, studentIds)` orchestrator
│   │
│   ├── features/
│   │   ├── dashboard/Dashboard.jsx   — REAL Dashboard (not the shell)
│   │   ├── simple-mode/SimpleMode.jsx — fast-logging screen
│   │   ├── import/
│   │   │   ├── IEPImport.jsx         — same-name file (history)
│   │   │   ├── SmartImport.jsx       — flagship: roster + IEP doc → AI → student objects
│   │   │   ├── RosterOnlyImport.jsx  — just a name list
│   │   │   ├── iepExtractor.js       — pure: stripNameFromSection, extractAllStudents
│   │   │   ├── rosterParsers.js      — JSON/CSV/MD/PDF parsers
│   │   │   ├── verifyRoster.js + VerifyRoster.jsx — Roster Health Check + cloud-orphan cleanup
│   │   │   ├── legacyImport.js       — RFC 4180 CSV parser, fuzzy-match-to-Vault, dedupe vs existing logs
│   │   │   └── LegacyImportModal.jsx — three-step modal (upload+parse → review fuzzy/ambiguous → confirm + ingest via addLog)
│   │   ├── roster/
│   │   │   ├── RosterPanel.jsx       — sidebar "Real Names" widget
│   │   │   └── rosterUtils.js        — validation, normalization, paraAppNumber resolver (`resolveStudentByParaAppNumber`)
│   │   ├── analytics/
│   │   │   ├── getStudentPatterns.js — pure: classifies logs into worked/didn't work
│   │   │   ├── PatternsCard.jsx      — "What worked before" component
│   │   │   └── AnalyticsDashboard.jsx
│   │   ├── export/
│   │   │   └── exportWorkbook.js     — Sheets-ready .xlsx export with bold headers + zebra rows (SheetJS)
│   │   ├── help/                     — ? button + help drawer
│   │   ├── showcase/                 — demo mode banner
│   │   └── stealth/                  — panic-hide screen
│   │
│   ├── privacy/
│   │   ├── nameResolver.js           — resolveLabel(student, mode) — THE name display gate
│   │   └── realNameVault.js          — IndexedDB vault for opt-in name persistence
│   │
│   ├── services/
│   │   ├── supabaseClient.js         — singleton client + supabaseConfigured flag
│   │   ├── teamSync.js               — Supabase auth/team/roster/log/handoff/case-memory helpers. Includes `joinTeamAsOwner`, `requestToJoinTeam`, `findSimilarTeam`, `regenerateOwnerCode`. `toLogRow` surfaces `external_key` (paraAppNumber) on every cloud log row.
│   │   ├── paraAssignments.js        — student assignment RPC helpers + assigned-students view
│   │   └── stripUnsafeKeys.js        — defensive key-filter before any cloud write
│   │
│   ├── utils/
│   │   ├── exportCSV.js              — exportCSV (no names) + exportCSVPrivate (with names). Columns now include Period ID and Para App Number; falls back to `log.paraAppNumber` when the student record is missing.
│   │   ├── localBackup.js            — File System Access API for picking save folder
│   │   ├── pdfWorker.js              — local pdfjs worker configuration
│   │   ├── fuzzyMatch.js             — `normalizeName` + Jaro-Winkler (used by Legacy CSV Import to match free-text names against the Vault)
│   │   ├── grammarFix.js + spellPolish.js — pure helpers for the auto-polish flow
│   │   └── assignmentManifest.js, sidebarVisibility.js
│   │
│   ├── data/                         — DB constants, demo seed data, periods/schedule
│   ├── models/                       — health calc, hdot, identity, case-memory shapes
│   ├── hooks/
│   │   ├── useEscape, useLocalStorage, useChat, useStudents, useLogs, useOllama, useOllamaInsights, useDocuments, useKnowledgeBase, useCaseMemory
│   │   ├── useDraft.js               — textarea draft persistence; re-hydrates when the key changes (Apr 30 fix)
│   │   └── useAutoGrammarFix.js      — exports `useAutoGrammarFix` (auto-polish on type) + `useGrammarFixSetting` (Settings toggle hook). Auto-polish-on-save also wired in via the same hook family.
│   └── __tests__/                    — Jest unit tests
│
├── e2e/                              — Playwright tests (runner: `@playwright/test`)
├── supabase/migrations/              — SQL migrations for teams, RLS, roles, assignments, access hardening, owner codes, join requests, period_ids, external_key bridge
├── docs/                             — architecture notes, business plan, this folder
├── public/
├── package.json
├── vercel.json
└── .env.local.example
```

## Provider tree (context)

```
<App>
  <TeamProvider>         ← auth, current team, role, cloud roster, handoffs, sync warnings, join-request inbox/outbox
    <OllamaProvider>     ← local AI status
      <StudentsProvider> ← local/offline students OR cloud roster rows
        <VaultProvider>  ← real names, persistence, showRealNames toggle
          <LogsProvider> ← local logs + best-effort cloud sync
            <App content>
```

## Critical files

| File | What it does |
|---|---|
| `src/App.jsx` | The shell. Routes between Dashboard / Simple Mode / Vault / Import / Admin. Holds top-level UI state, hosts the sidebar (Find My Students button, period/date controls, toolbox panels grouped by audience, Real Names widget, Handoff Inbox, Settings, etc.), and renders the Data Vault screen via `renderVault()`. |
| `src/features/dashboard/Dashboard.jsx` | The Normal-Mode screen with hero, Today's Plan card, action picker, student cards, AI Copilot, and the Apple-style note sheet that opens on action tap. |
| `src/features/simple-mode/SimpleMode.jsx` | Fast logging — student grid, 6 category buttons per row, undo timer, inline quick-note. |
| `src/privacy/nameResolver.js` | `resolveLabel(student, mode)` — the only function in the codebase that returns a display string. Honors `showRealNames` flag. Everything else routes through this. |
| `src/services/supabaseClient.js` | Singleton Supabase client + `supabaseConfigured` flag (false when env vars missing — app still runs in local/offline mode). |
| `src/services/teamSync.js` | All Supabase-facing team, roster, logs, handoffs, parent notes, and case-memory calls. Student imports upsert by `(team_id, external_key)` when a Para App Number exists. Owns the Phase B (`joinTeamAsOwner`, `regenerateOwnerCode`) and Phase C (`requestToJoinTeam`, `approveJoinRequest`, `denyJoinRequest`, `findSimilarTeam`) flows. `toLogRow` and the analogous handoff/case-memory mappers stamp `external_key` on every cloud row. |
| `src/services/paraAssignments.js` | Admin assignment RPC wrappers plus `my_assigned_students` fetch helper. |
| `src/components/AdminDashboard.jsx` | Owner/sped-teacher dashboard with **six tabs**: Get paras started, **🔖 Coaching** (auto-detected training-gap topics with "share a tip" actions), Members, Assign Students, Access, Settings. The `CoachingTopicsSection` and `ShareTipModal` helpers are defined in the same file. The Members tab also exposes the OWN- owner code (with a "rotate" button) and the join-request inbox. |
| `src/engine/trainingGapRules.js` + `trainingGapPredicates.js` | The Training-Gap Agenda's hybrid rule format — JSON descriptors (one per rule) reference named JS predicates by string. v1 ships 3 rules using one predicate (`countWithoutCounter`). |
| `src/components/ParaAssignmentPanel.jsx` | Admin assignment workflow: pick existing para/sub or pre-register by email, check students, save, export CSV/full assignment file. |
| `src/components/FindMyStudentsModal.jsx` | Para-facing name/assignment loader. Accepts paste, CSV/JSON/MD/TXT/PDF, or assignment manifest and claims pending assignments. |
| `src/context/buildContext.js` | Builds the AI prompt context pack. Always uses `resolveLabel` so names are resolved/stripped before any AI call. Includes `patternsByStudent` from `getStudentPatterns`. |
| `src/features/import/SmartImport.jsx` | The AI-driven flagship import. Strips names with `[STUDENT]` placeholder before AI call. |
| `src/features/import/LegacyImportModal.jsx` | Three-step modal that lets a para drag in their old free-text CSV (from before SupaPara), fuzzy-match each row's student name against the loaded Vault, review fuzzy/ambiguous rows, then commit via the normal `addLog` path. The matching pipeline lives in `legacyImport.js` and `src/utils/fuzzyMatch.js`. |
| `src/features/export/exportWorkbook.js` | Sheets-ready `.xlsx` export: bold header row, zebra-striped data rows, frozen header. Used as a richer alternative to the plain CSV export when paras are sharing data with admins or case managers via Google Sheets. |
| `src/features/analytics/getStudentPatterns.js` | Pure function. Classifies logs by keyword (success / fail). Returns commonBehaviors, successfulSupports, failedSupports, recentPatterns. No Supabase calls. |
| `src/styles/styles.css` | Design system v3 tokens + all component styles. |

## Commands

```bash
npm start              # dev server on http://localhost:3000
npm run build          # production build into ./build
npm test               # Jest unit tests (616 passing)
npm run test:e2e       # Playwright e2e tests (uses @playwright/test)
npm run build && CI=true npm test  # what CI would run
```

### Notable `package.json` quirks

- `postinstall: rm -rf node_modules/canvas` — load-bearing workaround. The `canvas` package is a transitive dep that conflicts with `pdfjs-dist` worker bundling under CRA on some platforms; removing it post-install lets the build succeed without changing how PDFs are parsed.
- Jest `transformIgnorePatterns` is configured to transform `@supabase/*` so the supabase-js ESM modules survive Jest's CJS expectations.
- The e2e runner uses `@playwright/test`, not the bare `playwright` package. (Apr 30 fix — the imports were always against `@playwright/test`; the listed dep was wrong.)

## Environment variables

In `.env.local`:

```
REACT_APP_SUPABASE_URL=https://<project>.supabase.co
REACT_APP_SUPABASE_ANON_KEY=<anon-key>
```

When missing, the app still loads but the Sign-In screen shows "Cloud features not configured" — useful for demos without a backend.

## Deployment

- Pushed to GitHub (`unohisname12/para-copilot`).
- Vercel project `supapara` auto-deploys from `main` branch.
- Production URL: `supapara.vercel.app`.
- Branches get preview URLs automatically.

## Local AI setup (Ollama)

The user runs Linux Mint. Ollama is installed as a systemd service with desktop shortcuts to start/stop. The systemd override file sets `OLLAMA_ORIGINS` to allow CORS requests from `supapara.vercel.app` so the production web app can talk to local Ollama.

```ini
# /etc/systemd/system/ollama.service.d/override.conf
[Service]
Environment="OLLAMA_HOST=0.0.0.0:11434"
Environment="OLLAMA_ORIGINS=https://supapara.vercel.app,http://localhost:3000"
```

Model: `qwen2.5:7b-instruct` (~5GB).

## Test coverage

- **616 unit tests passing** across 48 test suites.
- Covers: Simple Mode logging, situation hint matching, IEP import validation, roster utils, identity migration, name resolver, pattern detection, training-gap predicates + engine orchestration, fuzzy-match name matching, legacy CSV parsing + dedupe, xlsx workbook export, draft persistence, etc.
- Playwright e2e tests in `e2e/` cover the major flows.
- Training-gap-specific tests: `src/__tests__/trainingGapPredicates.test.js` and `src/__tests__/trainingGapEngine.test.js`.

## Schema additions since the initial cut (Apr 22 → Apr 30)

The original migration set landed a five-table core (`teams`, `team_members`, `team_students`, `logs`, `handoffs`, plus `parent_notes`, `para_assignments`, and the case-memory trio). Since then several features have added columns and one new table. This is the on-disk reality the privacy doc describes from the FERPA angle; here we just cover the shape.

### `teams.owner_code` (text, unique)

Migration `20260429100100_team_owner_code.sql`. A second invite code, format `OWN-` + 8 alphanumerics drawn from a 31-char alphabet that omits look-alike chars (no 0/O/1/I/L). Distinct prefix from the 6-char `invite_code` so the join modal client-side detects which path to dispatch into. Backfilled to existing teams. Idempotent.

A follow-up migration `20260430100000_create_team_owner_code.sql` rewrites the `create_team` RPC to call `generate_owner_code()` inline at insert — without it, every team minted after Apr 29 came back with `owner_code = NULL` and admins joining a freshly created team had no code to share.

### `teams.normalized_name` (generated, stored)

Migration `20260429100000_team_normalized_name.sql`. A computed lower-case-and-strip-non-alphanumerics version of `name`, indexed for equality. Powers the Phase A "you may already have a team named that" pre-flight check via the `find_similar_team(candidate)` RPC, so two paras at the same school don't accidentally end up in two parallel "Fairview Middle School" teams.

### `team_students.period_ids text[]`

Migration `20260428100000_team_students_period_ids.sql`. Replaces the singular `period_id` for cross-period kids. The unique `(team_id, external_key)` index meant two upserts of the same kid (one per period) collapsed to one row, erasing the second period. The new array column lets the push path write the full list and the read path expand it back into per-period dashboard entries. GIN indexed for `period_ids @> ARRAY['p3']`-style lookups. Legacy rows where `period_ids IS NULL` keep working via fallback to the scalar `period_id`.

### `team_join_requests` table

Migration `20260429100200_team_join_requests.sql`. Phase C of the team-joining UX overhaul. When a para hits "request to join" without an invite or owner code, a row lands here with `status='pending'`. The owner sees pending rows in their Members tab inbox; approval inserts the `team_members` row at the requested role. Denied rows stay as a history record; re-requesting clears them.

### `logs.external_key` (and the same column on `handoffs`, `incidents`, `interventions`, `outcomes`)

Migration `20260429120000_logs_external_key.sql`. The cloud `logs.student_id` foreign key is `references team_students on delete set null`. When a `team_students` row gets regenerated (a different para re-imports the roster, a fresh device first-syncs), the FK can go null and the log loses its only handle on the kid. Surfacing `paraAppNumber` as `external_key` on every cloud row — mirroring the column name on `team_students` — lets the reconnect path heal those rows after the FK goes null. No historical backfill; only the on-write path is covered going forward. The same column on case-memory tables and handoffs lets the rest of the data fabric ride the same bridge.

### New / changed RPCs since Apr 27

| RPC | What it does |
|---|---|
| `generate_owner_code()` | Internal `security definer` helper. Loops until it finds an unused `OWN-XXXXXXXX`. Not callable from the client. |
| `regenerate_owner_code(tid)` | Owner-only. Rotates the owner code for a team. Used after onboarding the sped teacher so the original shared code doesn't stay live. |
| `join_team_as_owner(code, display)` | Validates the `OWN-` code and inserts a `team_members` row with `role='sped_teacher'`. If the caller is already a member at a lower role, promotes. If they're already owner/sped_teacher, no-ops. |
| `find_similar_team(candidate)` | Returns `(id, name, normalized_name)` for any team whose normalized name matches. Used by the create-team pre-flight check. |
| `request_to_join_team(tid, display, msg, requested)` | Para-facing. Inserts/updates a pending row in `team_join_requests`. Refuses if the caller is already a member. Clears any prior denied row so a re-request is a fresh ask. |
| `approve_join_request(rid)` | Admin-only. Inserts the `team_members` row at the requested role and marks the request approved. Re-activates a paused/inactive prior membership. |
| `deny_join_request(rid, reason)` | Admin-only. Marks denied with optional reason. |
| `create_team(team_name, display)` | Updated post-hoc to call `generate_owner_code()` inline so freshly minted teams have an owner code from row zero. |

## Current access-control behavior

- Admins (`owner`, `sped_teacher`) can load the full team roster and manage assignments.
- Paras/subs load `my_assigned_students`, which only returns students assigned to them.
- Paras/subs can still add students to their active team; they can read/update rows they created.
- Paras/subs cannot edit other people's roster rows or browse unassigned admin-created students.
- Paused members and disabled subs are blocked at the database policy layer, not just by the UI.
- Owner code joins land at `role='sped_teacher'`. The 6-char invite code never grants admin — it only grants `para` or `sub`.
- Pending join requests are visible only to the owner/sped teachers of the target team and the requester themselves (RLS).
- Cloud writes are best-effort from the UX perspective. If a log/import/handoff/case-memory sync fails, the app keeps the local record and shows a visible "Cloud sync issue" toast.

## Conventions

- **No comments explaining what code does.** Only why (hidden constraints, bug workarounds).
- **No backwards-compatibility shims.** Delete unused code.
- **No feature flags** unless actually needed.
- **Plain English in user-visible strings.** No "JSON", "bundle", "roster", "vault", "FERPA" — use "name list", "student file", "real names", "saved notes", "Para App Number".
- **Use CSS variables, not hex literals**, in any new component.
- **Privacy first:** any new feature must route name display through `resolveLabel` and must NOT pass real names to network calls.
