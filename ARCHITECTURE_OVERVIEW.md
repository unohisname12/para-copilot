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
│  useOllamaInsights                                       │
├──────────────────────────────────────────────────────────┤
│                   Feature Components                      │
│  Dashboard · VaultView · AnalyticsDashboard · IEPImport  │
│  SimpleMode · StealthScreen · RosterPanel                │
├──────────────────────────────────────────────────────────┤
│                   Shared Components                       │
│  Panels (8) · Modals (4) · Tools (6) · Layout (2)       │
│  BrandHeader · OllamaStatusBadge · Tip                   │
├──────────────────────────────────────────────────────────┤
│                     Engine Layer                          │
│  engine/index.js — situation detection, KB search        │
│  engine/ollama.js — Ollama API (7 feature functions)     │
├──────────────────────────────────────────────────────────┤
│                     Model Layer                           │
│  models/index.js — createLog, createStudent, getHealth   │
│  context/buildContext.js — AI prompt context packing     │
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
  features/         — Feature-specific components (7 folders)
  components/       — Shared UI components + re-export stubs
    tools/          — 6 student-safe classroom tools
    panels/         — 8 sidebar panels (support card, ABC, goals, etc.)
    modals/         — 4 modal dialogs
    layout/         — FloatingToolWindow, FullscreenTool
    ui/             — Tip tooltip
  hooks/            — 8 custom hooks
  engine/           — Pure logic (situation detection, Ollama API)
  models/           — Data factories and health calculations
  context/          — AI prompt context building
  privacy/          — FERPA name resolution
  utils/            — exportCSV, sidebarVisibility
  styles/           — CSS
  __tests__/        — 14 test suites (197 tests)
```

## Test Strategy

- **Unit tests** (Jest + jsdom): 14 suites, 197 tests covering models, engine, privacy, identity, IEP import, simple mode, roster utilities, sidebar visibility
- **E2E tests** (Playwright): `e2e/uiAudit.mjs` — 39 automated checks across 15 interactive surface categories
- **Re-export stubs** in `src/components/` preserve all test import paths after file moves
