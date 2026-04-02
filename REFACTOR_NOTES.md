# Refactor Notes — Para Copilot

## Summary

Modular refactoring of a React 19 special education paraprofessional app. Reduced the god component `App.jsx` from **688 LOC to 355 LOC** by extracting 8 custom hooks, 3 context providers, and organizing ~80 source files into a feature-based folder structure. All 14 test suites (197 tests) pass. Playwright E2E audit confirms 39/39 interactive surface checks pass.

## What Changed and Why

### Phase 1: Custom Hook Extraction

**Problem:** App.jsx owned all state and handlers — 688 lines of tangled concerns.

**Solution:** Extracted 8 custom hooks:

| Hook | LOC | Extracted From |
|------|-----|---------------|
| `useLocalStorage` | 15 | Repeated localStorage init+persist pattern (3 occurrences) |
| `useOllama` | 35 | Ollama connection state + health check |
| `useLogs` | 30 | Log CRUD (addLog, toggleFlag, deleteLog, updateLogText) |
| `useStudents` | 65 | Student data, IEP import, identity management |
| `useChat` | 100 | Chat state, message handling, AI queries |
| `useDocuments` | 55 | Google Doc state (link, content, loading) |
| `useKnowledgeBase` | 55 | KB entries, file upload with PDF extraction |
| `useOllamaInsights` | 40 | AI modal state (patterns, handoff, email draft) |

**Decision:** `useDocuments` is state-only (no `fetchDoc`) because `fetchDoc` needs both doc state and chat state — a circular dependency. `fetchDoc` stays in App.jsx where both hooks' values are available.

### Phase 2: Context Providers

**Problem:** Dashboard received 21 props. Cross-cutting state (Ollama, students, logs) drilled through every component.

**Solution:** 3 providers wrap the most cross-cutting hooks:

- `OllamaProvider` — consumed by Dashboard, Analytics, BrandHeader
- `StudentsProvider` — consumed by Dashboard, SimpleMode, Roster, Modals
- `LogsProvider` — consumed by Dashboard, Vault, Analytics, Profile

**Decision:** Chat, Documents, KB, and Insights hooks stay as direct hook calls in App.jsx — they're consumed in fewer places and don't benefit from context.

**Pattern:** App.jsx split into `App` (renders providers) + `AppShell` (consumes context). A component can't consume context it provides.

### Phase 3: Feature Folders

**Problem:** All components in flat `src/components/` directory — no grouping by feature.

**Solution:** Created `src/features/` with 7 feature folders:

| Feature | Moved From |
|---------|-----------|
| `features/dashboard/` | `components/Dashboard.jsx` |
| `features/simple-mode/` | `components/SimpleMode.jsx` |
| `features/analytics/` | `components/AnalyticsDashboard.jsx` |
| `features/import/` | `components/IEPImport.jsx` |
| `features/stealth/` | `components/windows.jsx` (StealthScreen) |
| `features/roster/` | `components/windows.jsx` (RosterPanel + utils) |
| `features/vault/` | Inline in App.jsx (renderVault) — not yet extracted |

**Re-export stubs** at original paths preserve all test imports. Example:
```js
// src/components/SimpleMode.jsx (stub)
export { SimpleMode, buildQuickLogParams, ... } from '../features/simple-mode/SimpleMode';
```

### Phase 4: Split Grouped Files

**Problem:** `tools.jsx` (6 components), `panels.jsx` (8 components), `modals.jsx` (4 components), `windows.jsx` (5 components + 4 utils) — large files grouping unrelated components.

**Solution:** Each group split into individual files in subdirectories with barrel exports:

| Original | Split Into | Files |
|----------|-----------|-------|
| `tools.jsx` | `components/tools/` | 6 + index.js |
| `panels.jsx` | `components/panels/` | 9 + index.js (includes shared Section.jsx) |
| `modals.jsx` | `components/modals/` | 4 + index.js |
| `windows.jsx` | Split across features + components | Tip, FloatingToolWindow, FullscreenTool, StealthScreen, RosterPanel, rosterUtils |

Original files kept as re-export stubs.

### Phase 5: Slim App.jsx

**Problem:** Even after hook extraction, App.jsx had dead code and inline utilities.

**Solution:**
- Removed dead `renderDashboard()` function (never called — confirmed via grep)
- Extracted `exportCSV` / `exportCSVPrivate` to `utils/exportCSV.js`
- Extracted email/AI modal state to `useOllamaInsights` hook

**Result:** App.jsx reduced to 355 LOC (from 688). Could go lower by extracting `renderVault()` to `features/vault/VaultView.jsx` — left as future work.

### Phase 6: Playwright UI Debugging

**Script:** `e2e/uiAudit.mjs` — automated headless Playwright audit of 15 interactive surface categories.

**Result:** 39/39 checks pass. Zero console errors. Zero real app bugs found.

## Decision Log

| Decision | Rationale |
|----------|-----------|
| Re-export stubs instead of updating test imports | Zero test file modifications; all 197 tests pass without changes |
| State-only useDocuments (no fetchDoc) | Avoids circular dependency between useChat and useDocuments |
| App/AppShell split | Component can't consume context it provides |
| No context for Chat/KB/Insights | Single consumer (App.jsx) — context adds complexity without benefit |
| useMemo for derived student data | allStudents and effectivePeriodStudents recompute only when deps change |
| Shared Section.jsx in panels/ | Used by SupportCardPanel and StrategyLibrary — extracted to avoid duplication |
| Keep renderVault() in App.jsx | Vault view is tightly coupled to vault UI state (vaultTab, vaultFilter, editingLog) — extract later |

## Test Import Paths Preserved

| Test File | Imports From | Stub At |
|-----------|-------------|---------|
| `quickLog.test.js` | `../components/SimpleMode` | Re-exports from `features/simple-mode/` |
| `situationHint.test.js` | `../components/SimpleMode` | Same |
| `simpleMode.test.js` | `../components/SimpleMode` | Same |
| `IEPImport.test.js` | `../components/IEPImport` | Re-exports from `features/import/` |
| `phase6b.test.js` | `../components/windows` | Re-exports `partitionByResolved` from `features/roster/rosterUtils` |
| `rosterLookups.test.js` | `../components/windows` | Re-exports `buildRosterLookups` from same |

## Remaining Technical Debt

1. **renderVault() still inline in App.jsx** — Should be extracted to `features/vault/VaultView.jsx` with its own state (vaultTab, vaultFilter, editingLog)
2. **useChat has large parameter list** — Accepts 12 params from other hooks. Would benefit from additional context providers or a combined app context
3. **Dashboard still receives many props** — Reduced from 21 but could use more context consumption
4. **No TypeScript** — All files are plain JS/JSX
5. **Inline styles everywhere** — No CSS modules or styled-components; all styling is inline `style={}` objects
6. **Page title is "React App"** — Should be "Para Copilot" (in `public/index.html`)

## How to Roll Back

Each phase builds on the previous. To roll back:

1. The re-export stubs mean old import paths still work — reverting a file move just means deleting the new location and restoring the stub to a full component
2. Hooks can be inlined back into App.jsx by moving their contents and removing the import
3. Providers can be removed by replacing `useXxxContext()` calls with direct hook calls and passing props

All changes are additive (new files + modified App.jsx). The engine, models, context, privacy, identity, and data layers were never modified.
