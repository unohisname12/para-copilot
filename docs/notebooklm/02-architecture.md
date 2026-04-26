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
| PDF parsing | `pdfjs-dist` | Used in Smart Import to read IEP PDFs |
| Tests | Jest (unit) + Playwright (e2e) | 327 unit tests passing |

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
│   │   ├── AdminDashboard.jsx        — team management panel (owner/sped teacher only)
│   │   ├── Dashboard.jsx             — re-export shell
│   │   ├── IEPImport.jsx             — legacy IEP import page (3 cards above Smart Import)
│   │   ├── OnboardingModal.jsx       — 5-slide welcome tour
│   │   ├── SignInScreen.jsx          — Google sign-in landing
│   │   ├── RealNamesControls.jsx     — sidebar real-names toggle + persistence modal
│   │   ├── HandoffInbox.jsx          — incoming handoffs from teammates
│   │   ├── SimpleMode.jsx            — re-export
│   │   ├── SubLockedScreen.jsx       — shown when admin disables subs
│   │   ├── TeamSwitcher.jsx          — change which team you're viewing
│   │   ├── TeamOnboardingModal.jsx   — create/join a team
│   │   ├── OllamaStatusBadge.jsx     — local-AI online/offline chip
│   │   ├── ParentNotesSection.jsx    — sped-teacher-only private parent notes
│   │   ├── modals/StudentProfileModal.jsx
│   │   ├── panels/HandoffBuilder.jsx
│   │   ├── panels/GoalTracker.jsx
│   │   └── windows.jsx, panels.jsx, tools.jsx — re-export barrels
│   │
│   ├── context/
│   │   ├── VaultProvider.jsx         — React context: real-name vault, persistence, toggles
│   │   ├── TeamProvider.jsx          — React context: current team, role, members
│   │   └── buildContext.js           — builds AI prompts from student data + patterns
│   │
│   ├── engine/
│   │   ├── aiProvider.js             — router: local vs cloud AI
│   │   ├── ollama.js                 — local AI client
│   │   ├── cloudAI.js                — Gemini client
│   │   └── index.js                  — keyword engine, doc parser, situation matching
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
│   │   ├── vault/                    — Data Vault (search/filter/sort/expand)
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
│   │   ├── teamSync.js               — realtime handoff subscribe/publish
│   │   └── stripUnsafeKeys.js        — defensive key-filter before any cloud write
│   │
│   ├── utils/
│   │   ├── exportCSV.js              — exportCSV (no names) + exportCSVPrivate (with names)
│   │   └── localBackup.js            — File System Access API for picking save folder
│   │
│   ├── data/                         — DB constants, demo seed data, periods/schedule
│   ├── models/                       — health calc, hdot, identity, case-memory shapes
│   ├── hooks/                        — useEscape, useLocalStorage, useChat, etc.
│   └── __tests__/                    — Jest unit tests
│
├── e2e/                              — Playwright tests
├── supabase/migrations/              — 7 SQL migrations
├── docs/                             — architecture notes, business plan, this folder
├── public/
├── package.json
├── vercel.json
└── .env.local.example
```

## Provider tree (context)

```
<App>
  <VaultProvider>     ← real names, persistence, showRealNames toggle
    <TeamProvider>    ← current team, role, members, invite codes
      <App content>
```

## Critical files

| File | What it does |
|---|---|
| `src/App.jsx` | The shell. Routes between Dashboard / Simple Mode / Vault / Import / Admin. Holds top-level UI state. ~1000 lines (acknowledged candidate for splitting). |
| `src/features/dashboard/Dashboard.jsx` | The Normal-Mode screen with hero, Today's Plan card, action picker, student cards, AI Copilot, and the Apple-style note sheet that opens on action tap. |
| `src/features/simple-mode/SimpleMode.jsx` | Fast logging — student grid, 6 category buttons per row, undo timer, inline quick-note. |
| `src/privacy/nameResolver.js` | `resolveLabel(student, mode)` — the only function in the codebase that returns a display string. Honors `showRealNames` flag. Everything else routes through this. |
| `src/services/supabaseClient.js` | Singleton Supabase client + `supabaseConfigured` flag (false when env vars missing — app still runs in demo mode). |
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

- **327 unit tests passing** across 26 test suites
- Covers: Simple Mode logging, situation hint matching, IEP import validation, roster utils, identity migration, name resolver, pattern detection, etc.
- Playwright e2e tests in `e2e/` cover the major flows.

## Conventions

- **No comments explaining what code does.** Only why (hidden constraints, bug workarounds).
- **No backwards-compatibility shims.** Delete unused code.
- **No feature flags** unless actually needed.
- **Plain English in user-visible strings.** No "JSON", "bundle", "roster", "vault", "FERPA" — use "name list", "student file", "real names", "saved notes", "Para App Number".
- **Use CSS variables, not hex literals**, in any new component.
- **Privacy first:** any new feature must route name display through `resolveLabel` and must NOT pass real names to network calls.
