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
| Tests | Jest (unit) + Playwright (e2e) | 346 unit tests passing across 28 suites |

## Repository layout

```
JPDs-gZD/
├── src/
│   ├── App.jsx                       — shell, auth gate, sidebar, Data Vault screen
│   ├── index.tsx                     — React entry
│   ├── styles/styles.css             — ALL styling (no Tailwind, no CSS modules)
│   │
│   ├── app/providers/                — provider composition root
│   │
│   ├── components/                   — screens & modals
│   │   ├── AdminDashboard.jsx        — team management panel (owner/sped teacher only). 6 tabs: Get paras started, Coaching, Members, Assign Students, Access, Settings. Hosts CoachingTopicsSection + ShareTipModal helpers (defined in same file).
│   │   ├── ParaAssignmentPanel.jsx   — admin assigns students to paras/subs
│   │   ├── BrandHeader.jsx           — top-of-page brand strip
│   │   ├── Dashboard.jsx             — re-export shell
│   │   ├── IEPImport.jsx             — legacy IEP import page (3 cards above Smart Import)
│   │   ├── OnboardingModal.jsx       — multi-slide welcome tour
│   │   ├── SignInScreen.jsx          — Google sign-in landing
│   │   ├── RealNamesControls.jsx     — sidebar real-names toggle + persistence modal
│   │   ├── FindMyStudentsModal.jsx   — para loads names/assignment files for their students
│   │   ├── SettingsModal.jsx         — Display/Help/Account/Danger zone tabs; opened via sidebar ⚙️ button
│   │   ├── BugReportButton.jsx       — mailto support/idea/bug modal
│   │   ├── HandoffInbox.jsx          — incoming handoffs from teammates
│   │   ├── SimpleMode.jsx            — re-export
│   │   ├── SubLockedScreen.jsx       — shown when admin disables subs
│   │   ├── TeamSwitcher.jsx          — change which team you're viewing
│   │   ├── TeamOnboardingModal.jsx   — create/join a team
│   │   ├── OllamaStatusBadge.jsx     — local-AI online/offline chip
│   │   ├── ParentNotesSection.jsx    — sped-teacher-only private parent notes
│   │   ├── modals/
│   │   │   ├── StudentProfileModal.jsx     — full profile + parent notes (sped teacher only)
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
│   │   ├── TeamProvider.jsx          — React context: current team, role, members, cloud roster, sync warnings
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
│   │   │   └── rosterParsers.js      — JSON/CSV/MD/PDF parsers
│   │   ├── roster/
│   │   │   ├── RosterPanel.jsx       — sidebar "Real Names" widget
│   │   │   └── rosterUtils.js        — validation + normalization
│   │   ├── analytics/
│   │   │   ├── getStudentPatterns.js — pure: classifies logs into worked/didn't work
│   │   │   ├── PatternsCard.jsx      — "What worked before" component
│   │   │   └── AnalyticsDashboard.jsx
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
│   │   ├── teamSync.js               — Supabase auth/team/roster/log/handoff/case-memory helpers
│   │   ├── paraAssignments.js        — student assignment RPC helpers + assigned-students view
│   │   └── stripUnsafeKeys.js        — defensive key-filter before any cloud write
│   │
│   ├── utils/
│   │   ├── exportCSV.js              — exportCSV (no names) + exportCSVPrivate (with names)
│   │   ├── localBackup.js            — File System Access API for picking save folder
│   │   └── pdfWorker.js              — local pdfjs worker configuration
│   │
│   ├── data/                         — DB constants, demo seed data, periods/schedule
│   ├── models/                       — health calc, hdot, identity, case-memory shapes
│   ├── hooks/                        — useEscape, useLocalStorage, useChat, etc.
│   └── __tests__/                    — Jest unit tests
│
├── e2e/                              — Playwright tests
├── supabase/migrations/              — SQL migrations for teams, RLS, roles, assignments, access hardening
├── docs/                             — architecture notes, business plan, this folder
├── public/
├── package.json
├── vercel.json
└── .env.local.example
```

## Provider tree (context)

```
<App>
  <TeamProvider>         ← auth, current team, role, cloud roster, handoffs, sync warnings
    <OllamaProvider>     ← local AI status
      <StudentsProvider> ← local/offline students OR cloud roster rows
        <VaultProvider>  ← real names, persistence, showRealNames toggle
          <LogsProvider> ← local logs + best-effort cloud sync
            <App content>
```

## Critical files

| File | What it does |
|---|---|
| `src/App.jsx` | The shell. Routes between Dashboard / Simple Mode / Vault / Import / Admin. Holds top-level UI state, hosts the sidebar (Find My Students button, period/date controls, toolbox panels grouped by audience, Real Names widget, Handoff Inbox, Settings, etc.), and renders the Data Vault screen via `renderVault()`. ~1087 lines (acknowledged candidate for splitting). |
| `src/features/dashboard/Dashboard.jsx` | The Normal-Mode screen with hero, Today's Plan card, action picker, student cards, AI Copilot, and the Apple-style note sheet that opens on action tap. ~1378 lines. |
| `src/features/simple-mode/SimpleMode.jsx` | Fast logging — student grid, 6 category buttons per row, undo timer, inline quick-note. |
| `src/privacy/nameResolver.js` | `resolveLabel(student, mode)` — the only function in the codebase that returns a display string. Honors `showRealNames` flag. Everything else routes through this. |
| `src/services/supabaseClient.js` | Singleton Supabase client + `supabaseConfigured` flag (false when env vars missing — app still runs in local/offline mode). |
| `src/services/teamSync.js` | All Supabase-facing team, roster, logs, handoffs, parent notes, and case-memory calls. Student imports upsert by `(team_id, external_key)` when a Para App Number exists. |
| `src/services/paraAssignments.js` | Admin assignment RPC wrappers plus `my_assigned_students` fetch helper. |
| `src/components/AdminDashboard.jsx` | Owner/sped-teacher dashboard with **six tabs**: Get paras started, **🔖 Coaching** (auto-detected training-gap topics with "share a tip" actions), Members, Assign Students, Access, Settings. The `CoachingTopicsSection` and `ShareTipModal` helpers are defined in the same file. |
| `src/engine/trainingGapRules.js` + `trainingGapPredicates.js` | The Training-Gap Agenda's hybrid rule format — JSON descriptors (one per rule) reference named JS predicates by string. v1 ships 3 rules using one predicate (`countWithoutCounter`). |
| `src/components/ParaAssignmentPanel.jsx` | Admin assignment workflow: pick existing para/sub or pre-register by email, check students, save, export CSV/full assignment file. |
| `src/components/FindMyStudentsModal.jsx` | Para-facing name/assignment loader. Accepts paste, CSV/JSON/MD/TXT/PDF, or assignment manifest and claims pending assignments. |
| `src/context/buildContext.js` | Builds the AI prompt context pack. Always uses `resolveLabel` so names are resolved/stripped before any AI call. Includes `patternsByStudent` from `getStudentPatterns`. |
| `src/features/import/SmartImport.jsx` | The AI-driven flagship import. Strips names with `[STUDENT]` placeholder before AI call. |
| `src/features/analytics/getStudentPatterns.js` | Pure function. Classifies logs by keyword (success / fail). Returns commonBehaviors, successfulSupports, failedSupports, recentPatterns. No Supabase calls. |
| `src/styles/styles.css` | Design system v3 tokens + all component styles. ~1063 lines. |

## Commands

```bash
npm start              # dev server on http://localhost:3000
npm run build          # production build into ./build
npm test               # Jest unit tests
npm run test:e2e       # Playwright e2e tests
npm run build && CI=true npm test  # what CI would run
```

### Notable `package.json` quirks

- `postinstall: rm -rf node_modules/canvas` — load-bearing workaround. The `canvas` package is a transitive dep that conflicts with `pdfjs-dist` worker bundling under CRA on some platforms; removing it post-install lets the build succeed without changing how PDFs are parsed.
- Jest `transformIgnorePatterns` is configured to transform `@supabase/*` so the supabase-js ESM modules survive Jest's CJS expectations.

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

- **346 unit tests passing** across 28 test suites
- Covers: Simple Mode logging, situation hint matching, IEP import validation, roster utils, identity migration, name resolver, pattern detection, training-gap predicates + engine orchestration, etc.
- Playwright e2e tests in `e2e/` cover the major flows.
- Training-gap-specific tests: `src/__tests__/trainingGapPredicates.test.js` (8 tests) and `src/__tests__/trainingGapEngine.test.js` (9 tests).

## Current access-control behavior

- Admins (`owner`, `sped_teacher`) can load the full team roster and manage assignments.
- Paras/subs load `my_assigned_students`, which only returns students assigned to them.
- Paras/subs can still add students to their active team; they can read/update rows they created.
- Paras/subs cannot edit other people's roster rows or browse unassigned admin-created students.
- Paused members and disabled subs are blocked at the database policy layer, not just by the UI.
- Cloud writes are best-effort from the UX perspective. If a log/import/handoff/case-memory sync fails, the app keeps the local record and shows a visible "Cloud sync issue" toast.

## Conventions

- **No comments explaining what code does.** Only why (hidden constraints, bug workarounds).
- **No backwards-compatibility shims.** Delete unused code.
- **No feature flags** unless actually needed.
- **Plain English in user-visible strings.** No "JSON", "bundle", "roster", "vault", "FERPA" — use "name list", "student file", "real names", "saved notes", "Para App Number".
- **Use CSS variables, not hex literals**, in any new component.
- **Privacy first:** any new feature must route name display through `resolveLabel` and must NOT pass real names to network calls.
