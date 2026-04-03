# Architecture Overview — Para Copilot

## What This App Does

Para Copilot is a React 19 classroom tool for special education paraprofessionals. It manages student IEPs, logs behavioral observations, detects situations requiring intervention, provides local AI support via Ollama, and enforces FERPA compliance throughout.

## Layer Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    App.jsx (355 LOC)                     │
│        Provider composition + view routing + layout      │
├─────────┬──────────┬──────────┬──────────┬──────────────┤
│ Ollama  │ Students │  Logs    │  Chat    │   Documents  │
│Provider │ Provider │ Provider │  Hook    │   Hook       │
│         │          │          │          │              │
│ useOlla │ useStude │ useLogs  │ useChat  │ useDocuments │
│ ma()    │ nts()    │   ()     │   ()     │ useKB()      │
│         │          │          │          │ useInsights() │
├─────────┴──────────┴──────────┴──────────┴──────────────┤
│                    Custom Hooks Layer                     │
│  useLocalStorage · useOllama · useLogs · useStudents     │
│  useChat · useDocuments · useKnowledgeBase               │
│  useOllamaInsights · useCaseMemory                       │
├──────────────────────────────────────────────────────────┤
│                   Feature Components                      │
│  Dashboard · VaultView · AnalyticsDashboard · IEPImport  │
│  SimpleMode · StealthScreen · RosterPanel                │
│  HelpButton · HelpPanel · ShowcaseLoader                 │
├──────────────────────────────────────────────────────────┤
│                   Shared Components                       │
│  Panels (8) · Modals (4) · Tools (6) · Layout (2)       │
│  BrandHeader · OllamaStatusBadge · Tip                   │
├──────────────────────────────────────────────────────────┤
│                     Engine Layer                          │
│  engine/index.js — situation detection, KB search,       │
│                    searchCaseMemory                       │
│  engine/ollama.js — Ollama API (8 feature functions)     │
├──────────────────────────────────────────────────────────┤
│                     Model Layer                           │
│  models/index.js — createLog, createIncident,            │
│    createIntervention, createOutcome, getHealth           │
│  context/buildContext.js — AI prompt + case memory pack   │
├──────────────────────────────────────────────────────────┤
│                    Privacy Layer                          │
│  privacy/nameResolver.js — FERPA-safe name resolution    │
│  identity.js — 12-color identity palette system          │
├──────────────────────────────────────────────────────────┤
│                     Data Layer                            │
│  data.js — static data (DB, QUICK_ACTIONS, situations)   │
└──────────────────────────────────────────────────────────┘
```

## Provider Tree

```jsx
<OllamaProvider>                    // Ollama connection state
  <StudentsProvider activePeriod>   // Student data + identity
    <LogsProvider ...>              // Log CRUD + persistence
      <AppShell />                  // Layout + view routing
    </LogsProvider>
  </StudentsProvider>
</OllamaProvider>
```

Providers wrap hooks in React Context, eliminating prop drilling for the most cross-cutting state. Components consume via `useOllamaContext()`, `useStudentsContext()`, `useLogsContext()`.

## Data Flow

```
User action (click/type)
  → Component handler
    → Custom hook (state update)
      → React re-render
        → Component displays new state

AI interactions:
  User sends chat message
    → useChat.handleChat()
      → buildContextPack() (context layer)
        → engine.askAI() or ollama.askOllama()
          → Response displayed in chat

Log persistence:
  useLogs.addLog() → setLogs() → useLocalStorage → localStorage
  Page reload → useLocalStorage reads from localStorage → logs restored
```

## Privacy Gates (FERPA Compliance)

All student name display passes through `resolveLabel()` from `privacy/nameResolver.js`:

- **Default (safe mode):** Shows identity color label (e.g., "Crimson-7") — no real names
- **Private mode:** Shows real names only when `identityRegistry` is loaded via Private Roster
- **Export:** `exportCSV()` uses safe names; `exportCSVPrivate()` resolves real names only with explicit registry

The Private Roster panel (`features/roster/RosterPanel.jsx`) is the only entry point for loading real student names. Stealth Mode (`features/stealth/StealthScreen.jsx`) strips all student-identifying information from the screen.

## State Ownership

| State | Owner | Consumers |
|-------|-------|-----------|
| Ollama connection | `useOllama` → `OllamaProvider` | Dashboard, Analytics, BrandHeader |
| Student data | `useStudents` → `StudentsProvider` | Dashboard, SimpleMode, Modals, Roster |
| Logs | `useLogs` → `LogsProvider` | Dashboard, Vault, Analytics, Profile |
| Case Memory | `useCaseMemory` (hook) | Dashboard (Help), App.jsx |
| Chat | `useChat` (hook) | Dashboard only |
| Documents | `useDocuments` (hook) | App.jsx (fetchDoc wiring) |
| Knowledge Base | `useKnowledgeBase` (hook) | Vault KB tab |
| AI Insights | `useOllamaInsights` (hook) | Modals (pattern, handoff, email) |
| View/Navigation | `App.jsx` (useState) | Layout routing |
| UI orchestration | `App.jsx` (useState) | Toolbox, floating, fullscreen, stealth |

## Key Directories

```
src/
  app/providers/    — React Context providers (3 files)
  features/         — Feature-specific components (9 folders)
    help/           — Help Button + Case Memory UI (5 components)
    showcase/       — Demo data loader (ShowcaseLoader, ShowcaseBanner)
  components/       — Shared UI components + re-export stubs
    tools/          — 6 student-safe classroom tools
    panels/         — 8 sidebar panels (support card, ABC, goals, etc.)
    modals/         — 4 modal dialogs
    layout/         — FloatingToolWindow, FullscreenTool
    ui/             — Tip tooltip
  data/             — Demo seed data (demoSeedData.js)
  hooks/            — 9 custom hooks (+ useCaseMemory)
  engine/           — Pure logic (situation detection, Ollama API, searchCaseMemory)
  models/           — Data factories (createLog, createIncident, createIntervention, createOutcome)
  context/          — AI prompt context building (+ serializeForCaseMemoryPrompt)
  privacy/          — FERPA name resolution
  utils/            — exportCSV, sidebarVisibility
  styles/           — CSS
  __tests__/        — 19 test suites (255 tests)
```

## Case Memory Data Flow

```
User describes situation
  → HelpPanel auto-detects tags
    → searchCaseMemory() scores past incidents
      → CaseMemoryCards displayed with outcomes
        → "Try This Again" → InterventionLogger (pre-filled)
          → OutcomeLogger → outcome saved
            → Companion Log created via addLog()
```

## Test Strategy

- **Unit tests** (Jest + jsdom): 19 suites, 255 tests covering models, engine, privacy, identity, IEP import, case memory, showcase data, help flow integration
- **E2E tests** (Playwright): `e2e/uiAudit.mjs` (39 checks), `e2e/helpButtonAudit.mjs` (Help flow), `e2e/showcaseAudit.mjs` (demo data)
- **Re-export stubs** in `src/components/` preserve all test import paths after file moves
