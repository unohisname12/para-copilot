# Feature Map — Para Copilot

Maps each user-facing feature to its code location.

## Views

| Feature | Component | Hook(s) | Provider |
|---------|-----------|---------|----------|
| Dashboard | `features/dashboard/Dashboard.jsx` | useChat, useDocuments | Ollama, Students, Logs |
| Data Vault | Inline in `App.jsx` (renderVault) | useKnowledgeBase | Logs |
| IEP Import | `features/import/IEPImport.jsx` | useStudents | Students |
| Analytics | `features/analytics/AnalyticsDashboard.jsx` | — | Ollama, Students, Logs |
| Simple Mode | `features/simple-mode/SimpleMode.jsx` | — | Students, Logs |

## Modes

| Feature | Entry Point | Component |
|---------|------------|-----------|
| Stealth Mode | Button in sidebar → `App.jsx` | `features/stealth/StealthScreen.jsx` |
| Simple Mode | Toggle button → `App.jsx` | `features/simple-mode/SimpleMode.jsx` |

## Sidebar Tools (Toolbox)

All tools live in `components/tools/`. Each is a self-contained component.

| Tool | File | Student-Safe? |
|------|------|---------------|
| Visual Timer | `tools/VisualTimer.jsx` | Yes |
| Calculator | `tools/CalculatorTool.jsx` | Yes |
| Mult Chart | `tools/MultChart.jsx` | Yes |
| CER Organizer | `tools/CEROrganizer.jsx` | Yes |
| Breathing Exercise | `tools/BreathingExercise.jsx` | Yes |
| Grounding Exercise | `tools/GroundingExercise.jsx` | Yes |

Tools can appear in three contexts:
1. **Sidebar panel** — single-click a tool nav button
2. **Floating window** — double-click a tool nav button (or click pop-out arrow)
3. **Fullscreen** — click fullscreen button on floating window
4. **Stealth Mode** — student-safe tools only, no identifying info visible

## Sidebar Panels

All panels in `components/panels/`.

| Panel | File | Opens Via |
|-------|------|-----------|
| Situation Picker | `panels/SituationPicker.jsx` | "Situations" nav button |
| Quick Actions | `panels/QuickActionPanel.jsx` | "Quick Actions" nav button |
| Support Card | `panels/SupportCardPanel.jsx` | "Support Card" nav button |
| ABC Builder | `panels/ABCBuilder.jsx` | "ABC Builder" nav button |
| Goal Tracker | `panels/GoalTracker.jsx` | "Goal Tracker" nav button |
| Handoff Builder | `panels/HandoffBuilder.jsx` | "Handoff" nav button |
| Para Checklist | `panels/ParaChecklist.jsx` | "Checklist" nav button |
| Strategy Library | `panels/StrategyLibrary.jsx` | "Strategies" nav button |

Shared helper: `panels/Section.jsx` (collapsible section used by SupportCardPanel and StrategyLibrary).

## Modals

All modals in `components/modals/`.

| Modal | File | Triggered By |
|-------|------|-------------|
| Student Profile | `modals/StudentProfileModal.jsx` | Click student card |
| Email Draft | `modals/EmailModal.jsx` | "Draft Email" action |
| Situation Response | `modals/SituationResponseModal.jsx` | Situation detection |
| Ollama Insight | `modals/OllamaInsightModal.jsx` | AI pattern/handoff results |

## Layout Components

| Component | File | Purpose |
|-----------|------|---------|
| Floating Tool Window | `components/layout/FloatingToolWindow.jsx` | Draggable/resizable pop-out window |
| Fullscreen Tool | `components/layout/FullscreenTool.jsx` | Full-viewport tool overlay |
| Brand Header | `components/BrandHeader.jsx` | App title bar |
| Ollama Status Badge | `components/OllamaStatusBadge.jsx` | AI connection indicator |
| Tip | `components/ui/Tip.jsx` | Tooltip via portal |

## Privacy Features

| Feature | Code Location |
|---------|--------------|
| Name resolution (FERPA gate) | `privacy/nameResolver.js` |
| Identity color palette | `identity.js` |
| Private Roster panel | `features/roster/RosterPanel.jsx` |
| Roster validation/parsing | `features/roster/rosterUtils.js` |
| Safe CSV export | `utils/exportCSV.js` → `exportCSV()` |
| Private CSV export | `utils/exportCSV.js` → `exportCSVPrivate()` |
| Stealth Mode (no student data) | `features/stealth/StealthScreen.jsx` |

## AI / Ollama Features

| Feature | Hook/Function | Engine Function |
|---------|--------------|----------------|
| Chat (ask AI) | `useChat.askAI()` | `engine/ollama.js` → `askOllama()` |
| Pattern summary | `useOllamaInsights.handleOllamaPatternSummary()` | `summarizeStudentPatterns()` |
| Handoff note | `useOllamaInsights.handleOllamaHandoff()` | `generateHandoffNote()` |
| Email draft | `useOllamaInsights.draftEmail()` | `ollamaDraftEmail()` |
| Suggestions | `useChat.handleOllamaSuggestions()` | `ollamaSuggestActions()` |
| Health check | `useOllama` (on mount) | `checkOllamaHealth()` |
| Context packing | — | `context/buildContext.js` |

## Hooks

| Hook | File | Responsibility |
|------|------|---------------|
| `useLocalStorage` | `hooks/useLocalStorage.js` | Generic localStorage read/write/persist |
| `useOllama` | `hooks/useOllama.js` | Ollama connection state + health check |
| `useLogs` | `hooks/useLogs.js` | Log CRUD + localStorage persistence |
| `useStudents` | `hooks/useStudents.js` | Student data, import, identity management |
| `useChat` | `hooks/useChat.js` | Chat state, message handling, AI queries |
| `useDocuments` | `hooks/useDocuments.js` | Google Doc link/content state |
| `useKnowledgeBase` | `hooks/useKnowledgeBase.js` | KB entries + file upload (PDF extraction) |
| `useOllamaInsights` | `hooks/useOllamaInsights.js` | AI modals (patterns, handoff, email) |
