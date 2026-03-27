# Super Para App — Complete System Knowledge Document
# Optimized for AI reading. Every function, component, data structure, and flow documented.
# Last updated: 2026-03-26

---

## 1. PURPOSE AND CONTEXT

This is a browser-based React application designed for a special education paraprofessional named Mr. Dre. A paraprofessional (para) works in classrooms supporting students with Individualized Education Programs (IEPs). The app helps Mr. Dre:

- Track which students need what accommodations in real time during class
- Log observations, behaviors, and supports provided throughout the school day
- Get situation-specific coaching suggestions powered by rule-based logic and local AI
- Generate handoff notes, email drafts to case managers, and IEP progress records
- Import and parse student IEP documents into structured, FERPA-safe profiles
- Access classroom tools (timers, breathing exercises, calculators) that students can also use

**Critical privacy constraint:** The app is FERPA-compliant. All student data uses pseudonyms (e.g., "Red Student 1"). Real student names are NEVER stored in localStorage, never sent to any AI, and never included in any export. Real names exist only in `identityRegistry` — session-only React state in App.jsx that clears on page reload.

---

## 2. TECHNOLOGY STACK

- **Framework:** React 19 with functional components and hooks
- **Build tool:** Create React App (react-scripts 5, Webpack 5)
- **Language:** JavaScript with JSX (not TypeScript)
- **Styling:** CSS custom properties (variables) in a single global stylesheet
- **Local AI:** Ollama running qwen2.5:7b-instruct at http://127.0.0.1:11434
- **PDF parsing:** pdfjs-dist v3.11.174 (browser-based, fully offline)
- **No backend server.** Frontend-only single-page application.
- **No database.** Data lives in React state (in-memory) + localStorage for persistence.
- **No authentication.** Runs locally on the para's device.

---

## 3. FILE AND FOLDER STRUCTURE

```
/src
  index.js                    React entry point — mounts App into #root DOM node
  App.jsx                     Master orchestrator — all state, all logic, all routing
  data.js                     Static data layer — all constants, DB, lookup functions
  styles/
    styles.css                Global CSS with custom properties for dark theme

  engine/
    index.js                  Rule-based AI engine — zero network calls
    ollama.js                 Local Ollama AI service — all LLM communication

  context/
    buildContext.js           Context-pack assembler — serializes app state for AI prompts

  models/
    index.js                  Data constructors — pseudonym generation, identity registry,
                              createLog, student helpers, query functions

  components/
    tools.jsx                 6 student-facing classroom tools (Timer, Calculator, etc.)
    panels.jsx                8 sidebar toolbox panels (Support Cards, Goal Tracker, etc.)
    modals.jsx                4 modal overlays (Student Profile, Email, Situation, OllamaInsight)
    windows.jsx               Tooltip, Floating Window, RosterPanel, Stealth Screen
    AnalyticsDashboard.jsx    Log analytics with charts and grouping
    SimpleMode.jsx            Stripped-down mode for quick note-taking
    IEPImport.jsx             IEP document upload, AI parsing, student profile creation, bundle import
    OllamaStatusBadge.jsx     Tiny indicator showing whether local AI is online or offline
    Dashboard.jsx             Dashboard view component
    BrandHeader.jsx           Fixed app header with logo and Ollama status badge

  __tests__/
    identityRegistry.test.js  Unit tests for PSEUDONYM_PALETTE, generatePseudonymSet,
                              buildIdentityRegistry (13 tests, all passing)

/public
  assets/
    logo.png                  SupaPara logo
```

---

## 4. DATA LAYER — src/data.js

This file is the single source of truth for all static data. Nothing in this file changes at runtime. All IDs use consistent prefixes so the data is queryable.

### 4.1 DB Object

`DB` contains two nested objects: `periods` and `students`.

**DB.periods** — 6 class periods, each with:
- `label` — human-readable name like "Period 3 — Math 2"
- `teacher` — teacher's last name
- `subject` — subject being taught
- `students` — array of student IDs assigned to that period

Period IDs: p1 through p6.
- p1: ELA 7 with Ms. Lambard — students stu_001, stu_002
- p2: ELA 8 with Mr. Koehler — student stu_003
- p3: Math 2 with Junt — students stu_004, stu_005
- p4: Science 8 with Mr. Bowser — student stu_006
- p5: Science 7 with Ms. Moore — students stu_007, stu_008
- p6: Math 2 with Junt — student stu_009

**DB.students** — 9 built-in students (demo/development fixtures). Each student has:
- `id` — unique identifier (e.g., "stu_001")
- `pseudonym` — color-based name (e.g., "Red Student 1")
- `color` — hex color code unique to this student
- `eligibility` — disability classification(s) (e.g., "SLD + ELL")
- `accs` — accommodations array (v2: string[], v1: string)
- `goals` — IEP goals array: `[{ id, text, area, subject, baselineToTarget, yourRole }]`
- `caseManager` — case manager name
- `behaviorNotes`, `strengths`, `triggers` — descriptive strings
- `strategies` — array of strategy IDs
- `tags` — array of topic tags (e.g., ["ell", "sld"])
- `gradeLevel` — string
- `flags` — `{ alert: bool, iepNotYetOnFile: bool, profileMissing: bool, crossPeriod: bool }`
- `alertText` — additional alert text
- `crossPeriodInfo` — `{ note: string, otherPeriods: [] }`
- `watchFors`, `doThisActions`, `healthNotes` — v2 arrays
- `sourceMeta` — `{ importType, schemaVersion }`
- `imported` — false for DB students; true for bundle-imported students

### 4.2 Support Cards (`SUPPORT_CARDS`)

7 cards: Transition Support, De-escalation, Writing Support, Math Support, Sensory Regulation, Reading Support, Work Refusal. Each card: `{ id, title, category, whenToUse, steps[], whatToSay[], whatToAvoid[], accommodations[] }`.

### 4.3 Quick Actions (`QUICK_ACTIONS`)

9 one-tap logging buttons. Each: `{ id, label, emoji, type, tags[], note }`. Examples: Redirect, Break Offered, Praise, Checked In, etc.

### 4.4 Situations (`SITUATIONS`)

8 classroom situations with keyword triggers and recommended responses. Each: `{ id, label, triggers[], description, moves[], cards[], tools[] }`. Used by the local engine for scoring.

### 4.5 Regulation Tools (`REG_TOOLS`)

7 tools: Visual Timer, Breathing Exercise, Grounding Exercise, etc. Each: `{ id, name, description, whenToUse, component }`.

### 4.6 Other Constants

- `CHECKLIST_TEMPLATES` — before/during/after class checklists
- `STRATEGIES` — 6 evidence-based teaching strategies with search tags
- `GOAL_PROGRESS_OPTIONS` — 6 progress levels with color+icon
- `KW` — keyword map for fallback engine matching (behavior, math, reading, science, etc.)

### 4.7 Helper Functions

```js
getStudent(id)                        // Single student by ID
getPeriod(id)                         // Single period by ID
getStudentsForPeriod(periodId)        // Array of student objects for a period
searchStrategies(tags)                // Filter strategies by tag array
getSupportCard(id)                    // Single support card
getQuickAction(id)                    // Single quick action
```

---

## 5. MODELS — src/models/index.js

Data validators, constructors, identity registry, and log query utilities.

### 5.1 Pseudonym Generation

```js
PSEUDONYM_PALETTE   // Array of 12 { hex, name } objects (exported const):
                    // Red #ef4444, Orange #f97316, Yellow #eab308, Green #22c55e,
                    // Cyan #06b6d4, Blue #3b82f6, Violet #8b5cf6, Pink #ec4899,
                    // Rose #f43f5e, Teal #14b8a6, Purple #a855f7, Lime #84cc16

generatePseudonymSet(uniqueNames)
// Input:  string[] of unique real names in assignment order
// Output: Map<realName, { pseudonym: string, color: string }>
// Logic:  palette[i % 12] assigns color; colorCounts[name] tracks counter per color
// Format: "Red Student 1", "Blue Student 1", "Red Student 2", etc.
// Guard:  throws TypeError if uniqueNames is not an Array
```

### 5.2 Identity Registry Builder

```js
buildIdentityRegistry(bundleData)
// Input:  combined bundle JSON (has both normalizedStudents and privateRosterMap)
// Output: { registry, importStudents, periodMap }
//
// registry: [{ realName, pseudonym, color, periodIds[], classLabels{} }]
//   - One entry per unique real person (cross-period duplicates collapsed)
//   - realName is the ONLY place real names live — never in importStudents
//
// importStudents: { [stu_gen_001]: { id, pseudonym, color, periodId, classLabel,
//                                    goals, accs, eligibility, ... } }
//   - One entry per unique person (cross-period student = one entry, not two)
//   - NO realName field on any student object
//   - IDs: stu_gen_001, stu_gen_002, ...
//   - Goals merged (dedup by text), accs merged (union) across period appearances
//
// periodMap: { [periodId]: studentId[] }
//   - Cross-period students appear in MULTIPLE arrays (same ID in p1 and p3)
//
// Falls back to empty registry if privateRosterMap absent
// Includes normalizedStudents entries not in privateRosterMap as safe fallback
```

### 5.3 Log Constructor

```js
createLog({ studentId, type, note, date, timestamp, period, periodId, flagged,
            situationId, strategyUsed, goalId, source })
// Returns enriched log entry with auto-detected category and auto-generated tags
// Assigns: id (log_TIMESTAMP_COUNTER), category, tags
```

**Log category detection** (type → category):
| Type | Category |
|------|----------|
| Academic Support | academic |
| Accommodation Used | academic |
| Goal Progress | academic |
| Behavior Note | behavior |
| Positive Note | positive |
| General Observation | general |
| Handoff Note | admin |
| Class Note | admin |
| Parent Contact | admin |

**Auto-tag keywords:** break, chunk, escal, transition, calculator, tool (detected in note text).

### 5.4 Student Constructor

```js
createStudent(data)             // Normalizes student with all required fields, empty defaults
normalizeImportedStudent(raw)   // Converts raw bundle student to app student shape
                                // Never writes realName to output
```

### 5.5 Log Query Functions

```js
getRecentStudentLogs(logs, studentId, limit)
getLogsByDateRange(logs, startDate, endDate)
getLogsByType(logs, type)
getLogsByCategory(logs, category)
getHealth(studentId, logs, currentDate) // Returns "green" | "yellow" | "red"
hdot(h)                                 // Maps health to emoji 🟢🟡🔴
```

**Health thresholds:** green = logged today; yellow = within 3 days; red = 4+ days.

---

## 6. LOCAL ENGINE — src/engine/index.js

Pure rule-based logic. Zero API calls. Zero network.

### 6.1 Core Functions

```js
detectSituation(text)
// Scores text against all SITUATIONS[].triggers (keyword matching, +1 per hit)
// Returns sorted array of { situation, score } where score > 0

matchAccommodations(topic, accs)
// Filters student accommodations by topic: "behavior" | "math" | "reading" | "writing" | "science"

runLocalEngine(text, studentIds, knowledgeBase, activePeriod, docContent, periodLabel, recentLogs)
// Main entry point. Returns:
{
  topic,              // Detected subject area
  situations[],       // Matched situations sorted by score
  score,              // Confidence 0-100
  moves[],            // Recommended teaching moves (text)
  actions[],          // Action buttons per matched student
  sources[],          // IEP-based sources used
  kbHits,             // Knowledge base hits
  docSnippet,         // Relevant doc excerpt
  needsNoteBuilding,  // Boolean
  recommendedCards[], // Support card IDs
  recommendedTools[], // Regulation tool IDs
  followUp            // Follow-up suggestion text
}
```

### 6.2 Helper Functions

```js
searchKBDoc(doc, queryWords)          // Extracts matching sentences from knowledge base
parseDocForPeriod(docText, periodLabel) // Extracts lesson context for a specific period
```

---

## 7. LOCAL AI SERVICE — src/engine/ollama.js

All LLM interactions. No data leaves the device.

### 7.1 Configuration

- `OLLAMA_BASE`: http://127.0.0.1:11434
- `OLLAMA_MODEL`: qwen2.5:7b-instruct
- `TIMEOUT_MS`: 60000

### 7.2 Custom Errors

```js
OllamaOfflineError    // Ollama not running
OllamaTimeoutError    // Request exceeded TIMEOUT_MS
OllamaResponseError   // Unexpected response shape
```

### 7.3 Core Functions

```js
checkOllamaHealth()               // Polls /api/tags → { online: bool, model: string }
callOllama(systemPrompt, userPrompt) // Core fetch wrapper with timeout/error handling
```

### 7.4 Feature Functions (all take serialized context, return text)

```js
ollamaAskAI(contextBlock)                 // Para Copilot real-time suggestions
summarizeStudentPatterns(serializedContext) // Behavioral/academic pattern summary
generateHandoffNote(serializedContext)     // Handoff note draft
generateTeachingSuggestions(serializedContext) // In-the-moment support moves
ollamaDraftEmail(contextBlock)            // Email to case manager
ollamaExtractPDF(rawText)                 // PDF text cleanup
ollamaParseIEP(documentText)              // IEP JSON extraction from document text
```

All system prompts emphasize pseudonym-only usage, IEP-aligned responses, and brevity.

---

## 8. CONTEXT PACKING — src/context/buildContext.js

Assembles relevant data into serialized text blocks for AI prompts. Real names are never included — only pseudonyms.

### 8.1 Core Function

```js
buildContextPack({ studentIds, allStudents, logs, activePeriod, currentDate,
                   docContent, handoffAudience, handoffUrgency, logDaysBack })
// Returns context pack object (see shape below)
// Default logDaysBack: 14 days
// Max logs per request: 25 (token budget)
```

**Context pack shape:**
```js
{
  period: { id, label, teacher, subject },
  students: [...],         // Serialized student profiles
  logs: [...],             // Recent logs (pseudonym only)
  docSnippet: "...",       // Lesson context from Google Doc
  currentDate: "YYYY-MM-DD",
  detectedSituations: [],
  handoffAudience: "next_para",
  handoffUrgency: "normal"
}
```

### 8.2 Serializers

```js
serializeForAI(pack, query, kbDocs)     // For Para Copilot chat
serializeForPatternPrompt(pack)          // For pattern summaries
serializeForHandoffPrompt(pack)          // For handoff notes
serializeForSuggestionsPrompt(pack)      // For teaching suggestions
serializeForEmailPrompt(student, logs)   // For case manager emails
```

Helper: `serializeStudent(s)` formats a student profile as text (pseudonym, goals, accs, strategies). `serializeLogs(logs, label)` formats log entries as text lines.

---

## 9. COMPONENTS

### 9.1 App.jsx — Root Orchestrator

All global state, all routing, all localStorage read/write, Ollama health polling.

**Key state variables:**

| Variable | Type | Description |
|----------|------|-------------|
| `activePeriod` | string | Currently selected period ID (p1–p6) |
| `logs` | array | All log entries — persisted to localStorage `data_vault` |
| `importedStudents` | object | Bundle-imported students keyed by ID |
| `importedPeriodMap` | object | `{ [periodId]: studentId[] }` for imported students |
| `identityRegistry` | array | Real name mapping — SESSION ONLY, never persisted |
| `allStudents` | computed | Merged DB.students + importedStudents |
| `currentDate` | string | Today's date (YYYY-MM-DD) |
| `activeView` | string | Current main view |
| `rosterPanelOpen` | bool | Private roster sidebar toggle |
| `ollamaOnline` | bool | Ollama health status |
| `ollamaModel` | string | Model name from health check |

**Key handlers:**

```js
handleImport(student)             // Single student import
handleBundleImport(students[], periodMapUpdates)  // Bulk import from bundle
handleIdentityLoad(entries)       // Load real name registry (v1.0 + v2.0 compatible)
                                  // Normalizes to [{ realName, pseudonym, color,
                                  //                  periodIds, classLabels }]
                                  // Only updates if entries are non-empty
addLog(...)                       // Create and persist a log entry
```

**RosterPanel render:**
```jsx
<RosterPanel
  onClose={() => setRosterPanelOpen(false)}
  allStudents={allStudents}
  identityRegistry={identityRegistry}
  activePeriod={activePeriod}
  onIdentityLoad={handleIdentityLoad}
  onClearRoster={() => setIdentityRegistry([])}
/>
```

**IEPImport render:**
```jsx
<IEPImport
  onImport={handleImport}
  onBulkImport={handleBundleImport}
  onIdentityLoad={handleIdentityLoad}
  importedCount={Object.keys(importedStudents).length}
/>
```

**localStorage keys:**
- `data_vault` — serialized logs array
- `imported_students` — imported student profiles (object)
- `imported_period_map` — period → student ID array mapping

**NOT persisted to localStorage:** `identityRegistry` (real names — session only).

---

### 9.2 IEPImport.jsx — IEP & Bundle Import

Tab-based import interface.

**Props:** `{ onImport, onBulkImport, onIdentityLoad, importedCount }`

**Tabs:**
1. **IEP Bundle JSON** — Upload/paste v2.0 IEP bundle. Validates schema, imports all students at once via `doBundleImport()`.
2. **IEP PDF/Document** — Upload PDF, Ollama parses structured data.
3. **App Bundle JSON** — Import students from exported app bundles. Calls `buildIdentityRegistry` → `onBulkImport` → `onIdentityLoad`.

**`doBundleImport()` logic:**
```
If bundleData.privateRosterMap?.privateRosterMap?.length > 0:
  → buildIdentityRegistry(bundleData)
  → onBulkImport(Object.values(importStudents), periodMap)
  → onIdentityLoad?.(registry)
  → Show "Save Private Roster JSON" modal with registry entries
Else (plain bundle, no real names):
  → normalizeImportedStudent for each student
  → onBulkImport(normalized, periodMapUpdates)
  → Show "missing names" info modal
```

**Save modal** (`showRosterSaveModal`): Appears after combined JSON import. Lets user download the identity registry as a `private-roster-YYYY-MM-DD.json` file (schemaVersion 2.0).

**`downloadPrivateRosterFromBundle()`:** Downloads current `pendingRosterData` (registry entries) as:
```json
{
  "type": "privateRoster",
  "schemaVersion": "2.0",
  "createdAt": "...",
  "students": [{ "realName": "...", "pseudonym": "...", "color": "...",
                 "periodIds": [...], "classLabels": {} }]
}
```

**Expected combined bundle schema (v2.0):**
```json
{
  "schemaVersion": "2.0",
  "normalizedStudents": {
    "students": [{ "id": "...", "pseudonym": "...", "color": "...", "periodId": "p1",
                   "goals": [...], "accs": [...], ... }]
  },
  "privateRosterMap": {
    "schemaVersion": "2.0",
    "privateRosterMap": [
      { "studentId": "...", "realName": "John Doe", "pseudonym": "...",
        "periodId": "p1", "classLabel": "Period 1 — ELA" }
    ]
  }
}
```

---

### 9.3 windows.jsx — Panels and Tool Windows

**`Tip({ text, children, pos })`** — Portal-rendered tooltip. pos: "top" | "bottom" | "left" | "right".

**`FullscreenTool({ tool, onClose })`** — Fullscreen overlay for classroom tools.

**`FloatingToolWindow({ tool, onClose, onFullscreen, onDock })`**
- Draggable and resizable (BASE_W = 360px)
- Scales content with window width
- Touch support for tablets

**`StealthScreen({ activeTool, toolboxTools, onSelectTool, onExit })`** — Student-safe fullscreen mode hiding teacher content.

---

### 9.4 RosterPanel (in windows.jsx) — Private Roster

**Purpose:** Real name ↔ pseudonym reference, local only. Never exported, never sent to AI.

**Props:**
```js
{ onClose, allStudents = {}, identityRegistry = [], activePeriod,
  onIdentityLoad, onClearRoster }
```

**Local state:**
- `rosterMode`: `"current"` | `"whole"` (default: "current")
- `showImport`, `importText`, `rosterError`

**Mode toggle:** Two-button toggle — "Current Class" / "Whole Roster"

**Current Class mode:**
- Shows only students in `periodGroups[activePeriod]`
- Period label header with student count
- Each row: color dot + pseudonym + real name (or "name not loaded" italic) + cross-period badge

**Whole Roster mode:**
- All period groups sorted by period ID
- Active period highlighted with ★ prefix and brighter header
- Same student row format

**Cross-period badge:** `p1·p3` shown when `identityRegistry[i].periodIds.length > 1`.

**`periodGroups` computation** (via `useMemo` on `[allStudents, identityRegistry]`):
1. Initialize groups from `DB.periods` (includes DB students)
2. Place identity-registry imported students into ALL their period groups
3. Place uncovered imported students by their primary `periodId`

**File upload:** Validates with `validatePrivateRoster()`, extracts with `extractIdentityEntries()`, calls `onIdentityLoad()`.

**Save:** Downloads `identityRegistry` as `private-roster-YYYY-MM-DD.json` (schemaVersion 2.0).

**Paste import:** Textarea + Apply button, same validation/extraction pipeline.

**Clear:** `window.confirm("Clear all real names?")` → `onClearRoster?.()`.

**`validatePrivateRoster(json)` accepts:**
- Combined bundle format (has `privateRosterMap` key with real names)
- schemaVersion 1.0 artifact: `{ type: "privateRoster", students: [{ displayLabel, realName, color }] }`
- schemaVersion 2.0 artifact: `{ type: "privateRoster", students: [{ realName, pseudonym, color, periodIds, classLabels }] }`

**Rejects:** Pure app bundles (has `normalizedStudents` but no real names).

**`extractIdentityEntries(json, allStudents)`:** Normalizes any accepted format to v2.0 shape `[{ realName, pseudonym, color, periodIds, classLabels }]`.

---

### 9.5 panels.jsx — Sidebar Toolbox Panels

**`SupportCardPanel({ cards })`** — Browse 7 support cards.

**`QuickActionPanel({ students, onLog, studentsMap })`** — One-tap logging per student.

**`ABCBuilder({ students, onSave, periodLabel, currentDate, studentsMap })`**
- Records: Antecedent, Behavior, Consequence, Intensity, Duration, Staff Response, Follow-up

**`GoalTracker({ students, onSave, studentsMap })`**
- Log progress on each student's IEP goals
- Progress: Progress Made, Completed w/ Support, Needed Prompting, Not Attempted, Concern, Mastery

**`HandoffBuilder({ students, onSave, studentsMap, ollamaOnline, onOllamaHandoff })`**
- Audience: Next Para, Teacher, End of Day, Urgent Follow-up
- Urgency: Normal, Important, Urgent

**`ParaChecklist()`** — Before/During/After class checklist tracker.

**`StrategyLibrary()`** — Search 6 teaching strategies by tag.

**`SituationPicker({ onSelect })`** — Tap a situation for instant recommendations.

---

### 9.6 modals.jsx — Overlay UI

**`StudentProfileModal({ studentId, logs, currentDate, onClose, onLog, onDraftEmail, studentData })`**
- Tabs: Overview, Goals, Accommodations, Strategies, Support Info (v2 only), Logs
- Health indicator (green/yellow/red dot)
- Quick inline logging
- Draft email button

**`EmailModal({ studentId, emailLoading, emailDraft, setEmailDraft, onClose, studentData })`**
- Displays AI-drafted email, copy to clipboard

**`SituationResponseModal({ situation, students, onClose, onLog, onOpenCard, studentsMap })`**
- "Students to Watch" section (matching tags)
- Recommended moves with one-tap logging
- Support card previews
- Regulation tools

**`OllamaInsightModal({ feature, text, studentId, onClose, onLog })`**
- feature: `"patterns"` | `"handoff"` | `"suggestions"`
- Copy and save as log entry

---

### 9.7 Dashboard.jsx — Main View

Period overview, period picker, data vault (log table), AI chat sidebar (Para Copilot).

**Key sections:**
- Period header (teacher, subject, student count)
- Period picker (p1–p6 buttons)
- Data Vault: searchable/filterable log table (Date, Time, Type, Student, Note, Category, Tags)
- Para Copilot chat panel (right side): local engine + Ollama responses

---

### 9.8 AnalyticsDashboard.jsx — Data Visualization

**Tabs:** Overview | By Student | Groups

**Key local state:**
- `range` — day | week | 2weeks | month | quarter | year | custom
- `customStart`, `customEnd`
- `focusStudent`, `focusGroup`
- `groups` — custom student groups for analysis

**Sub-components:**
- `BarChart({ data, width, height, color })` — SVG bar chart (daily counts)
- `TypeBars({ counts })` — Horizontal bar chart (log type breakdown)
- `StudentAnalytics({ id })` — Per-student graph + pattern summary button
- `GroupAnalytics({ group })` — Per-group graph + student list

**Log type colors:**
- Positive Note: #4ade80
- Behavior Note: #f87171
- Academic Support: #60a5fa
- Goal Progress: #fbbf24
- Handoff Note: #fb923c

---

### 9.9 SimpleMode.jsx — Fast Para Note Entry

Minimal 3-step flow: Student → Category → Text.

**Steps:** students → note → (saves automatically)

**Categories (maps to log type):**
- Behavior (🔴) → Behavior Note
- Work Refusal (✋) → Behavior Note
- Transition (🔔) → Accommodation Used
- Positive! (⭐) → Positive Note
- Needed Break (🚶) → Accommodation Used
- Academic Help (📚) → Academic Support

IEP quick-ref strip at bottom (accommodations). Tool overlays: Timer, Breathing Exercise. Period picker at top.

---

### 9.10 tools.jsx — Classroom Tools (Student-Safe)

**`VisualTimer()`** — SVG countdown. Presets: 1/3/5/10 min. Color shifts green → yellow → red.

**`CalculatorTool()`** — 4-function calc with memory (MC, MR, M+) and `→Frac` (decimal to fraction).

**`MultChart()`** — 13×13 multiplication table with row highlighting.

**`CEROrganizer()`** — Claim-Evidence-Reasoning writing scaffold (3 color-coded textareas).

**`BreathingExercise()`** — Guided 4-4-6 breathing with animated circle. Phases: Breathe In (4s, blue) → Hold (4s, yellow) → Breathe Out (6s, green).

**`GroundingExercise()`** — 5-4-3-2-1 sensory grounding (see, touch, hear, smell, taste). Progress dots, completion screen.

---

### 9.11 BrandHeader.jsx

Logo + "Powering ParaProfessionals" tagline. Optional `right` prop for content. Logo: `/assets/logo.png` with text fallback.

---

### 9.12 OllamaStatusBadge.jsx

Props: `{ online, modelName }`. Online: purple badge with model name. Offline: gray badge + "Run: ollama serve" hint.

---

## 10. DESIGN SYSTEM — src/styles/styles.css

Dark ops-center aesthetic with a blue-slate palette.

**CSS custom properties:**
- `--bg-deep`: #04080f
- `--bg-dark`: #0a1120
- `--bg-surface`: #0f1a2e
- `--border`: #1c2d4a
- `--accent`: #4d9fff
- `--green`: #34d399
- `--red`: #f87171
- `--purple`: #a78bfa
- `--yellow`: #fbbf24
- `--radius-sm`: 6px, `--radius-md`: 10px, `--radius-lg`: 14px
- `--sidebar-w`: 210px

**Typography:** DM Sans (body), JetBrains Mono (code/data).

**Features:** Subtle grid texture, radial gradients, smooth transitions, custom scrollbars, responsive (hides sidebar < 700px), status pill badges.

---

## 11. PRIVATE ROSTER SYSTEM (FERPA)

### 11.1 Data Flow

```
User uploads combined JSON (has privateRosterMap with real names)
  ↓
IEPImport.doBundleImport()
  ↓
buildIdentityRegistry(bundleData)  [models/index.js]
  - Groups privateRosterMap[] by realName → finds unique people
  - Assigns ONE pseudonym + ONE color per unique person
  - Merges goals (text-dedup) and accs (union) across period appearances
  - Returns: { registry[], importStudents{}, periodMap{} }
  ↓
onBulkImport(Object.values(importStudents), periodMap) → App.jsx state
onIdentityLoad?.(registry)  → identityRegistry state (SESSION ONLY)
  ↓
"Save Private Roster JSON" modal → user downloads private-roster.json
```

### 11.2 Identity Registry Shape

```js
// In App.jsx: const [identityRegistry, setIdentityRegistry] = useState([]);
// NEVER written to localStorage. Cleared on page reload.
[
  {
    realName:    "Alexia Uriostegui",   // ONLY lives here
    pseudonym:   "Red Student 1",
    color:       "#ef4444",
    periodIds:   ["p1", "p3"],
    classLabels: { p1: "Period 1 — Language Arts 7", p3: "Period 3 — Math 2" }
  }
]
```

### 11.3 Private Roster Artifact Formats

**v2.0** (current — generated by app after bundle import):
```json
{
  "type": "privateRoster",
  "schemaVersion": "2.0",
  "createdAt": "...",
  "students": [
    { "realName": "...", "pseudonym": "...", "color": "...",
      "periodIds": ["p1", "p3"], "classLabels": { "p1": "...", "p3": "..." } }
  ]
}
```

**v1.0** (legacy — accepted for backward compatibility):
```json
{
  "type": "privateRoster",
  "schemaVersion": "1.0",
  "students": [{ "displayLabel": "...", "realName": "...", "color": "..." }]
}
```

### 11.4 Cross-Period Students

When a student appears in multiple periods in the combined JSON:
- They get **ONE** entry in `importedStudents` (primary period = first appearance)
- They appear in **MULTIPLE** arrays in `importedPeriodMap`
- They have **ONE** pseudonym and **ONE** color across all periods
- RosterPanel shows them in each relevant period group with a `p1·p3` badge

### 11.5 FERPA Guarantees

- `identityRegistry` is React state only — clears on page reload
- Never written to `localStorage`
- Never included in `exportBundle()` (reads importedStudents which has no realName)
- Never sent to Ollama (context builder reads allStudents, no realName field)
- Private roster artifact lives on user's computer only

### 11.6 Re-Import Flow

User loads a saved `private-roster-YYYY-MM-DD.json` via:
1. The **👤 Private Roster** sidebar panel → "Load Private Roster JSON" button
2. `validatePrivateRoster()` checks format
3. `extractIdentityEntries()` normalizes to v2.0 shape
4. `onIdentityLoad(entries)` → `handleIdentityLoad()` in App.jsx → updates `identityRegistry`

---

## 12. KEY DATA SHAPES

### Log Entry
```js
{
  id: "log_1711483245_5",
  studentId: "stu_001",
  type: "Behavior Note",
  category: "behavior",
  note: "Student escalating near back table...",
  date: "2026-03-26",
  timestamp: "2026-03-26T14:30:45Z",
  period: "p1",
  periodId: "p1",
  tags: ["behavior", "escalation"],
  flagged: false,
  situationId: "sit_escalating",
  strategyUsed: "str_2choice",
  goalId: null,
  source: "manual"  // "manual" | "quick_action" | "engine" | "ai"
}
```

### Imported Student (in allStudents, no realName)
```js
{
  id: "stu_gen_001",
  pseudonym: "Red Student 1",
  color: "#ef4444",
  periodId: "p1",           // Primary period
  classLabel: "Period 1 — Language Arts 7",
  eligibility: "SLD",
  accs: ["Extended time", "Graphic organizer"],
  goals: [{ id: "g1", text: "Reading fluency...", area: "reading", ... }],
  caseManager: "Smith",
  gradeLevel: "7",
  behaviorNotes: "",
  strengths: "",
  triggers: "",
  strategies: [],
  tags: [],
  flags: {},
  crossPeriodInfo: {},
  sourceMeta: { importType: "bundle_import", schemaVersion: "2.0" },
  imported: true
  // NO realName field
}
```

### Goal Progress Options
```js
[
  { id: "gp_progress",    label: "Progress Made",          icon: "📈", color: "#4ade80" },
  { id: "gp_supported",   label: "Completed w/ Support",   icon: "🤝", color: "#60a5fa" },
  { id: "gp_prompted",    label: "Needed Prompting",       icon: "💬", color: "#fbbf24" },
  { id: "gp_not_tried",   label: "Not Attempted",          icon: "⏸️", color: "#94a3b8" },
  { id: "gp_concern",     label: "Concern",                icon: "⚠️", color: "#f87171" },
  { id: "gp_mastery",     label: "Mastery Moment!",        icon: "🏆", color: "#a78bfa" }
]
```

---

## 13. COMMON WORKFLOWS

### Log a Behavior Note (Simple Mode)
1. Select student (health dot visible)
2. Tap "Behavior" category
3. Type observation
4. Tap "Save Note"
5. Background: local engine detects situation, auto-tags, saves to `data_vault`

### Import Student Roster with Real Names
1. Go to IEP Import → App Bundle JSON tab
2. Upload combined JSON (has both normalizedStudents + privateRosterMap)
3. App calls `buildIdentityRegistry()` — 27 unique students from 33 entries
4. "Save Private Roster JSON" modal appears — click to download
5. Students imported with pseudonyms only; real names in `identityRegistry` (session only)

### View Real Names in Roster Panel
1. Click 👤 sidebar button
2. Panel opens in "Current Class" mode
3. Toggle to "Whole Roster" to see all period groups
4. Real names show under pseudonyms (or "name not loaded" if not loaded yet)
5. Click "↓ Save Private Roster" to save artifact; "Clear Private Roster" to wipe names

### Get AI Handoff Note
1. Open Handoff Builder panel, select students + urgency + audience
2. Click "AI Draft" (requires Ollama online)
3. `serializeForHandoffPrompt()` packs context (pseudonyms only)
4. `generateHandoffNote()` calls Ollama
5. OllamaInsightModal shows result → copy or save as log

### Track Goal Progress
1. Open Goal Tracker panel
2. Select a goal for each student
3. Pick a progress level
4. Save → creates Goal Progress log entry

---

## 14. ARCHITECTURAL PATTERNS

### Privacy-First Data Flow
Real names → `identityRegistry` (session-only state) ONLY. All logs, exports, AI calls use pseudonym + ID. Private roster artifact lives on user's device only.

### Local-First Processing
- Situation detection: keyword scoring in engine/index.js (zero API)
- Accommodation matching: topic-based filtering (zero API)
- Ollama: local qwen2.5:7b-instruct (zero external network)
- App fully functional when Ollama offline (local engine fallback)

### Dual Student Systems
- **DB students:** Hard-coded in data.js (stu_001–stu_009), `imported: false`
- **Imported students:** From bundles (stu_gen_001+), `imported: true`
- Both coexist in `allStudents`; period grouping uses both `DB.periods` and `importedPeriodMap`

### v1 ↔ v2 Schema Compatibility
- v1: String fields for goals/accs/triggers
- v2: Array fields + watchFors, doThisActions, healthNotes, flags, crossPeriodInfo
- `normalizeImportedStudent()` and serializers handle both
- Private roster artifact: v1.0 (displayLabel) and v2.0 (pseudonym + periodIds) both accepted

### Situation → Action → Log Pipeline
1. User types text or selects situation
2. Engine scores keyword matches against SITUATIONS[].triggers
3. Recommendations: support cards, quick actions, regulation tools
4. User taps → log created with `situationId`, `tags`, `source: "engine"`
