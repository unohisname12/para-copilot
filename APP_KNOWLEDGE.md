# Super Para App — Complete System Knowledge Document
# Optimized for AI reading. Every function, component, data structure, and flow documented.
# Last updated: 2026-03-25

---

## 1. PURPOSE AND CONTEXT

This is a browser-based React application designed for a special education paraprofessional named Mr. Dre. A paraprofessional (para) works in classrooms supporting students with Individualized Education Programs (IEPs). The app helps Mr. Dre:

- Track which students need what accommodations in real time during class
- Log observations, behaviors, and supports provided throughout the school day
- Get situation-specific coaching suggestions powered by rule-based logic and local AI
- Generate handoff notes, email drafts to case managers, and IEP progress records
- Import and parse student IEP documents into structured, FERPA-safe profiles
- Access classroom tools (timers, breathing exercises, calculators) that students can also use

**Critical privacy constraint:** The app is FERPA-compliant. All student data uses pseudonyms (e.g., "Red Student 1", "Purple Student 1"). Real student names are NEVER stored in the app, never sent to any AI, and never included in any export. The only place real names can exist is in a session-only `privateRoster` state object in App.jsx (keyed by pseudonym) and in the Private Roster Panel sidebar inputs — both disappear when the tab is closed.

---

## 2. TECHNOLOGY STACK

- **Framework:** React 19 with functional components and hooks
- **Build tool:** Create React App (react-scripts 5, Webpack 5)
- **Language:** JavaScript with JSX (not TypeScript despite devDependency listing)
- **Styling:** CSS custom properties (variables) in a single global stylesheet
- **Local AI:** Ollama running qwen2.5:7b-instruct at http://127.0.0.1:11434
- **PDF parsing:** pdfjs-dist v3.11.174 (browser-based, no server, fully offline)
- **No backend server.** This is a frontend-only single-page application.
- **No database.** All data lives in React state (in-memory, session only).
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
    index.js                  Data constructors — createLog, student helpers, query functions

  components/
    tools.jsx                 6 student-facing classroom tools (Timer, Calculator, etc.)
    panels.jsx                8 sidebar toolbox panels (Support Cards, Goal Tracker, etc.)
    modals.jsx                4 modal overlays (Student Profile, Email, Situation, OllamaInsight)
    windows.jsx               Tooltip, Floating Window, Roster Panel, Stealth Screen
    AnalyticsDashboard.jsx    Log analytics with charts and grouping
    SimpleMode.jsx            Stripped-down mode for quick note-taking
    IEPImport.jsx             IEP document upload, AI parsing, student profile creation, bundle import
    OllamaStatusBadge.jsx     Tiny indicator showing whether local AI is online or offline
    Dashboard.jsx             Dashboard view component
    BrandHeader.jsx           Fixed app header with logo and Ollama status badge

/public
  assets/
    logo.png                  SupaPara logo (user-provided)
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

**DB.students** — 9 built-in students, each with these fields:
- `id` — unique identifier (e.g., "stu_001")
- `pseudonym` — color-based name (e.g., "Red Student 1")
- `color` — hex color code unique to this student, used for visual identity throughout the app
- `eligibility` — IEP disability categories (e.g., "SLD + ADHD", "Autism", "OHI — ADHD")
- `accs` — array of accommodation strings (e.g., "Extended Time", "Calculator", "Break Pass")
- `caseManager` — name of the case manager (used in email drafts)
- `goalArea` — text summary of IEP goal areas
- `goals` — array of goal objects, each with: id, text (full goal statement), area (Reading/Math/etc.), subject
- `behaviorNotes` — important behavioral context for the para
- `strengths` — what the student is good at
- `triggers` — known situations that cause difficulty
- `strategies` — array of specific strategy strings
- `tags` — lowercase searchable tags (e.g., ["sld", "adhd", "reading"])

**The 9 students:**
- stu_001 Red Student 1 — SLD + ELL, Period 1 ELA 7 — reading fluency and writing goals
- stu_002 Blue Student 1 — SLD + Low Vision, Period 1 ELA 7 — reading comprehension goals
- stu_003 Green Student 1 — OHI ADHD, Period 2 ELA 8 — writing and attention goals
- stu_004 Purple Student 1 — SLD Math, Period 3 Math 2 — fractions and computation goals
- stu_005 Orange Student 1 — Autism, Period 3 Math 2 — self-regulation and communication goals
- stu_006 Teal Student 1 — SLD + Speech, Period 4 Science 8 — written expression goals
- stu_007 Pink Student 1 — OHI with ACTIVE BIP, Period 5 Science 7 — behavior and engagement goals
- stu_008 Yellow Student 1 — Autism + Low Vision, Period 5 Science 7 — orientation and social goals
- stu_009 Indigo Student 1 — SLD Math, Period 6 Math 2 — math reasoning goals

### 4.2 SUPPORT_CARDS

7 reference cards the para can read during class. Each card covers a specific situation and has:
- `id` — prefixed with "sc_"
- `title` — the card name
- `category` — "transition", "behavior", "academic", "regulation"
- `tags` — searchable disability/situation tags
- `whenToUse` — a sentence describing when to pull this card
- `studentTypes` — list of disability labels this card is for
- `steps` — ordered array of action steps
- `whatToSay` — exact example phrases the para can say
- `whatToAvoid` — things NOT to do
- `accommodations` — IEP accommodations this card supports

The 7 cards: Transition Support, De-escalation Support, Writing Support, Math Support, Sensory Support, Reading Support, Work Refusal Support.

### 4.3 QUICK_ACTIONS

10 one-tap logging shortcuts. Each has:
- `id` — prefixed with "qa_"
- `label` — button text (e.g., "Used Break Pass")
- `icon` — emoji
- `category` — "regulation", "transition", "academic", "behavior", "positive"
- `logType` — the log entry type string used when creating the log
- `defaultNote` — pre-written note text that gets logged
- `tags` — searchable tags
- `suggestedSituations` — which SITUATIONS this action applies to

The 10 actions: Used Break Pass, Gave Transition Warning, Chunked Task, Redirected Behavior, Positive Participation, Provided IEP Tool, Check-in Completed, De-escalation Used, Verbal Narration, Headphones Allowed.

### 4.4 SITUATIONS

10 pre-defined classroom situations. This is what the rule-based engine matches against. Each has:
- `id` — prefixed with "sit_"
- `title` — display name
- `icon` — emoji
- `tags` — topic tags
- `triggers` — array of keyword strings that, if found in the para's typed text, add 1 point to this situation's score
- `recommendedCards` — array of support card IDs
- `recommendedActions` — array of quick action IDs
- `recommendedTools` — array of regulation tool IDs
- `followUp` — a reminder string shown after detection

The 10 situations: Student Escalating, Transition Coming, Writing Task Starting, Math Activity, Reading Activity, Science Lab Starting, Student Refusing Work, Off-Task Behavior, Reading Fatigue, Great Moment.

### 4.5 REG_TOOLS

7 regulation and support tools:
- tool_breathing — Breathing Exercise (2-3 min calming activity)
- tool_calm — Calming Screen (visual focus point)
- tool_timer — Visual Timer (timed work or break)
- tool_firstthen — First/Then Board (clear sequence for transitions)
- tool_countdown — Visual Countdown (5 minutes before transition)
- tool_grounding — 5-4-3-2-1 Grounding Exercise (anxiety/dissociation)
- tool_choices — Break Choices menu (regulation options)

### 4.6 CHECKLIST_TEMPLATES

Before/during/after class checklists. Each phase has an array of items with `label` and `priority` ("high", "medium", "low").
- Before: 6 items (check agenda, place IEP tools, review BIPs, seating, prep materials, check in with teacher)
- During: 6 items (scan behavior, provide accommodations, log observations, give transition warnings, positive reinforcement, check blank pages)
- After: 6 items (log in vault, write handoff, flag IEP concerns, store tools, note parent contact, update goal progress)

### 4.7 STRATEGIES

6 detailed strategy guides:
- str_chunk — Task Chunking: break work into 3 visible sections
- str_firstthen — First/Then Language: clear sequence statements
- str_vocab — Pre-teach Vocabulary: 3-5 key terms before the lesson
- str_2choice — Two-Choice Redirect: calm private redirection with 2 options
- str_narrate — Verbal Narration: describe all visual content aloud (for low vision)
- str_praise — Specific Praise: name the exact behavior within 3 seconds

Each strategy has: steps, whenToUse, avoidWhen, accommodations, gradeRange, subjects, disabilityTags.

### 4.8 GOAL_PROGRESS_OPTIONS

6 options for logging IEP goal progress: Progress Made (green), Completed w/ Support (blue), Needed Prompting (yellow), Not Attempted (gray), Concern (red), Mastery Moment (purple).

### 4.9 KW (Keyword Map)

Fallback keyword lists for when the Situation Engine finds no match. Contains arrays of keywords for 6 topics: behavior, math, reading, science, transition, praise. Used as a secondary detection layer.

### 4.10 Exported Lookup Functions

- `getStudent(id)` — returns a student object by ID or null
- `getPeriod(id)` — returns a period object by ID or null
- `getStudentsForPeriod(periodId)` — returns array of full student objects for a period
- `searchStrategies(tags)` — returns strategies that match any of the given tags
- `getSupportCard(id)` — returns a support card by ID or null
- `getQuickAction(id)` — returns a quick action by ID or null

---

## 5. ENGINE LAYER — src/engine/index.js

Pure logic functions. No React. No network. No side effects. Can be called from anywhere.

### searchKBDoc(doc, queryWords)
- Takes a knowledge base document object and an array of query words
- Splits doc.content by sentence delimiters (periods, exclamation marks, newlines)
- Filters to sentences longer than 20 characters that contain any query word
- Returns up to 3 matching sentences as an array of strings

### parseDocForPeriod(docText, periodLabel)
- Takes raw Google Doc text and a period label string
- Splits by newline, trims, filters blank lines
- Finds the first line that contains the period label (case-insensitive) or the word "period"
- Returns the next 8 lines joined together, capped at 400 characters
- Returns null if no matching section found

### detectSituation(text)
- Takes a string of text typed by the para
- Lowercases the input
- Iterates through all 10 SITUATIONS
- For each situation, counts how many trigger strings appear in the text (each match = 1 point)
- Attaches the score and the list of matched triggers to each situation object
- Filters out situations with score of 0
- Sorts remaining situations by score descending (highest confidence first)
- Returns the sorted array of matched situations with their scores

### matchAccommodations(topic, accs) [internal, not exported]
- Takes a topic string and an array of accommodation strings
- Maps topic categories to regex patterns that match relevant accommodations:
  - "behavior" or "escalation" → matches accommodations containing Break, BIP, Fidget, De-esc, headphone
  - "math" or "computation" → matches Calculator, Chart, Chunk, Anchor, Graph
  - "reading", "writing", or "academic" → matches Organizer, Word Bank, Strip, Print, Speech, Oral, Reduce, Chunk
  - "science" → matches Reduce, Speech, Extra, Verbal, Tactile
  - "transition" → matches Schedule, Warning, Timer, Advance
  - "sensory" → matches Fidget, headphone, Noise, Tactile
- Returns filtered array of accommodations that match the topic

### runLocalEngine(text, studentIds, knowledgeBase, activePeriod, docContent, periodLabel, recentLogs)
This is the core brain of the app. It runs on every chat message. Zero API calls.

Input:
- `text` — the para's typed message
- `studentIds` — array of student IDs for the current period (may include imported students)
- `knowledgeBase` — array of KB document objects
- `activePeriod` — period ID string ("p1" through "p6")
- `docContent` — raw text of the loaded Google Doc (or empty string)
- `periodLabel` — the human-readable period label
- `recentLogs` — all current log entries

What it does:
1. Runs detectSituation on the text
2. Resolves student IDs into full student objects
3. If no situations detected and no keyword matches, returns a generic fallback response with "no match" messaging
4. From matched situations, collects all recommended card IDs, action IDs, and tool IDs (deduplicated)
5. Resolves those IDs to full card, action, and tool objects
6. Determines the primary topic from the top situation's first tag (or from KW fallback)
7. For each student, runs matchAccommodations against the topic — if relevant accommodations found, adds a coaching move and a log action button
8. Adds quick action buttons for each matched quick action × each student
9. Searches the knowledge base for the period's docs and "all" docs using the query words
10. Parses the Google Doc for the period section
11. Counts recent logs for those students
12. Builds source attribution objects showing where each recommendation came from

Output object:
- `topic` — the primary topic string
- `situations` — array of matched situations with scores
- `score` — score of the top situation (0 if none)
- `moves` — array of human-readable coaching strings shown in the chat
- `actions` — array of log action button objects, each with: label, studentId, note, type
- `sources` — array of source badge objects, each with: label, icon, detail
- `kbHits` — array of KB matches with document title and snippet text
- `docSnippet` — extracted lesson context string or null
- `needsNoteBuilding` — boolean, true if no useful doc context found
- `recommendedCards` — array of full support card objects
- `recommendedTools` — array of full regulation tool objects
- `followUp` — joined follow-up strings from all matched situations, or null

---

## 6. OLLAMA SERVICE LAYER — src/engine/ollama.js

All communication with local Ollama. No Anthropic API. No external network. The model is qwen2.5:7b-instruct at http://127.0.0.1:11434.

### Error Types
- `OllamaOfflineError` — thrown when the connection is refused (Ollama not running)
- `OllamaTimeoutError` — thrown when the request takes longer than 60 seconds
- `OllamaResponseError` — thrown when Ollama returns a non-200 HTTP status

### checkOllamaHealth()
- Makes a GET request to /api/tags with a 4-second timeout
- Checks the returned models list for any model whose name starts with "qwen2.5"
- Returns object: { online: boolean, model: string or null }
- Called once on app mount to set the ollamaOnline state

### callOllama(systemPrompt, userPrompt)
- The core fetch function used by all features
- Creates an AbortController with a 60-second timeout
- POST to /api/chat with body: { model: "qwen2.5:7b-instruct", stream: false, options: { temperature: 0.4, num_predict: 800 }, messages: [{role:"system"}, {role:"user"}] }
- Reads response: data.message.content trimmed
- On AbortError → throws OllamaTimeoutError
- On network error → throws OllamaOfflineError
- On non-200 HTTP → throws OllamaResponseError

### System Prompts (internal constants)
Each feature has a dedicated system prompt tuned for qwen2.5:7b-instruct:

**SYS_PARA_COPILOT** — For the main "Ask Local AI" chat button. Instructs the model to give 2-4 specific, immediately actionable strategies using only pseudonyms, referencing IEP accommodations by name. Be concise for real-time classroom use.

**SYS_PATTERN_SUMMARY** — For the "Patterns" button in Analytics. Instructs the model to write a 3-section summary: what's working, what needs attention, one IEP-aligned next step. Under 200 words. Note if fewer than 3 logs exist.

**SYS_HANDOFF** — For the "AI Draft" button in HandoffBuilder. Instructs the model to write one 4-6 sentence paragraph: what happened, current status, what next staff should do. Start with "URGENT:" if urgency is urgent. Adjust tone based on audience.

**SYS_SUGGESTIONS** — For the "Teaching Moves" button in chat. Instructs the model to write 3-5 numbered, immediately usable support moves. Each must: be doable in 60 seconds, name the student by pseudonym, reference their specific IEP accommodation in imperative form.

**SYS_EMAIL** — For email drafting. Instructs the model to write a 3-4 paragraph professional email to a case manager using pseudonym only, referencing IEP goals and accommodations, ending with a clear ask.

**SYS_PDF_EXTRACT** — For knowledge base PDF upload. Instructs the model to extract all text with no commentary.

**SYS_IEP_PARSE** — For IEP document parsing. Instructs the model to return a specific JSON structure with fields: studentName, gradeLevel, classLabel, subject, teacherName, caseManager, eligibility, accommodations, goals, behaviorNotes, strengths, triggers, strategies, tags. Return ONLY JSON.

### Exported Feature Functions

**ollamaAskAI(contextBlock)** — calls callOllama with SYS_PARA_COPILOT. Used by the "Ask Local AI" button in chat.

**summarizeStudentPatterns(serializedContext)** — calls callOllama with SYS_PATTERN_SUMMARY. Used by "Patterns" button in Analytics.

**generateHandoffNote(serializedContext)** — calls callOllama with SYS_HANDOFF. Used by "AI Draft" button in HandoffBuilder.

**generateTeachingSuggestions(serializedContext)** — calls callOllama with SYS_SUGGESTIONS. Used by "Teaching Moves" button in chat bubbles.

**ollamaDraftEmail(contextBlock)** — calls callOllama with SYS_EMAIL. Used by the email drafting function in App.jsx.

**ollamaExtractPDF(rawText)** — calls callOllama with SYS_PDF_EXTRACT. Available but KB upload uses pdfjs directly.

**ollamaParseIEP(documentText)** — calls callOllama with SYS_IEP_PARSE, then strips markdown fencing and parses the JSON. Returns the parsed object or null if JSON parsing fails.

---

## 7. CONTEXT-PACK SYSTEM — src/context/buildContext.js

Pure functions that assemble app state into structured text prompts for Ollama. No network. No side effects.

### buildContextPack(params)
Accepts an object with these parameters:
- `studentIds` — array of student IDs for the current period
- `allStudents` — the merged student lookup object (DB.students + importedStudents)
- `logs` — all current log entries
- `activePeriod` — period ID string
- `docContent` — raw Google Doc text or empty string
- `currentDate` — date string in YYYY-MM-DD format
- `focusStudentId` (optional) — if set, only includes this one student's data
- `logDaysBack` (optional, default 14) — how many days of logs to include
- `detectedSituations` (optional) — array of matched situations from the engine
- `handoffAudience` (optional, default "next_para") — "next_para", "teacher", or "end_of_day"
- `handoffUrgency` (optional, default "normal") — "normal", "important", or "urgent"

Returns a ContextPack object with:
- `period` — object with id, label, teacher, subject
- `students` — array of resolved student objects
- `logs` — filtered, date-ranged, capped at 25 entries, with pseudonym resolved
- `docSnippet` — extracted lesson context or null
- `currentDate` — the date
- `detectedSituations` — passed through
- `handoffAudience` — passed through
- `handoffUrgency` — passed through

### serializeForAI(pack, query, kbDocs)
Produces the user prompt string for the main "Ask Local AI" chat feature. Includes: period header, all student IEP profiles, recent logs, doc snippet, KB docs, and the para's query. Ends with instruction to give 2-4 actionable strategies.

### serializeForPatternPrompt(pack)
Produces the user prompt string for the Pattern Summary feature. Includes: date and period header, student IEP profile, recent logs with date range label, instruction to summarize patterns.

### serializeForHandoffPrompt(pack)
Produces the user prompt string for the Handoff Note feature. Includes: audience, urgency, date, period, student IEP profile, today's logs only, instruction to write the handoff.

### serializeForSuggestionsPrompt(pack)
Produces the user prompt string for Teaching Suggestions. Includes: date, period, subject, detected situations with matched triggers, all student IEP profiles, recent behavior/regulation logs only, instruction to give 3-5 support moves.

### serializeForEmailPrompt(student, logs)
Produces the user prompt string for email drafting. Includes: recipient (case manager), student pseudonym, eligibility, goals, accommodations, recent log entries.

---

## 8. MODEL LAYER — src/models/index.js

Data constructors and query helpers. No React. No network.

### createLog(params)
Creates a complete, enriched log entry object. Accepts: studentId, type, note, date, period, periodId, flagged (default false), category (optional), tags (optional), situationId (optional), strategyUsed (optional), goalId (optional), source (optional, default "manual").

Auto-detects category from type using a map: "Academic Support" and "Accommodation Used" → "academic"; "Behavior Note" → "behavior"; "Positive Note" → "positive"; "Handoff Note" and "Class Note" and "Parent Contact" → "admin"; others → "general".

Auto-generates tags from type and note content. Type-based tags: "positive" for Positive Note, "behavior" for Behavior Note, etc. Note-based tags: "break" if note contains break/pass, "chunking" if chunk, "escalation" if escal/de-esc, "transition" if transition/warning, "tool" if calculator/chart/tool.

Returns an object with: id (timestamp-based unique ID), studentId, type, category, note, tags, date, period, periodId, timestamp (ISO string), flagged (auto-flags Handoff Notes containing "URGENT"), situationId, strategyUsed, goalId, source.

### getHealth(studentId, logs, currentDate)
Calculates a "health" color for a student based on recency of logging. Filters logs to that student. Finds the most recent log date. Calculates days since that date. Returns "green" (logged today), "yellow" (logged 1-3 days ago), or "red" (no logs or more than 3 days ago).

### hdot(h)
Converts a health string to an emoji: "green" → 🟢, "yellow" → 🟡, anything else → 🔴.

### createStudent(data)
Creates a normalized student object from raw data. Applies defaults for all fields. Converts any string goals to goal objects with auto-generated IDs.

### normalizeImportedStudent(rawStudent)
Normalizes a raw student object from an App Bundle JSON into a full student object with all required fields defaulted. Ensures `id`, `pseudonym`, `color`, `goals` (converted from strings if needed), `accs`, `strategies`, `tags` all exist.

### Log Query Helpers (MCP-ready functions)
- `getRecentStudentLogs(logs, studentId, limit)` — returns the most recent N logs for a student
- `getLogsByDateRange(logs, startDate, endDate)` — returns logs within a date range
- `getLogsByType(logs, type)` — returns logs matching a specific type string
- `getLogsByCategory(logs, category)` — returns logs matching a specific category string

---

## 9. MAIN ORCHESTRATOR — src/App.jsx

The root React component. Manages all state, wires all functions, renders the entire UI.

### 9.1 State Variables

**Core state:**
- `currentDate` — YYYY-MM-DD string, initialized to local date today
- `activePeriod` — period ID string ("p1"-"p6"), default "p3"
- `view` — current main view string: "dashboard", "vault", "import", "analytics"
- `logs` — array of all log entry objects, newest first
- `knowledgeBase` — array of KB document objects
- `simpleMode` — boolean, toggles Para Notes Mode
- `rosterPanelOpen` — boolean, shows/hides the Private Roster Panel
- `importedStudents` — object map of { studentId: studentObject } for imported students
- `importedPeriodMap` — object map of { periodId: [studentId, ...] } for imported student period assignments
- `privateRoster` — object map of { [pseudonym]: realName } — FERPA-sensitive, session-only, never persisted. Keyed by student `pseudonym` (displayLabel), not studentId.

**UI state:**
- `profileStu` — student ID of the currently open StudentProfileModal (null = closed)
- `activeToolbox` — tool ID of the open sidebar panel (null = closed)
- `floatingTools` — array of tool IDs currently popped out as floating windows
- `fullscreenTool` — tool ID currently in fullscreen mode (null = none)
- `stealthMode` — boolean, shows the Stealth Screen overlay
- `stealthTool` — tool ID active in stealth mode, default "timer"
- `situationModal` — situation object for the SituationResponseModal (null = closed)
- `emailModal` — object with studentId for EmailModal (null = closed)
- `emailDraft` — string content of the generated email draft
- `emailLoading` — boolean, true while email is being generated
- `groups` — array of custom analytics group objects

**Chat state:**
- `periodChats` — object with one chat history array per period (p1-p6), each initialized with a greeting message
- `masterChat` — array of cross-period AI messages
- `chatMode` — "period" or "master"
- `chatInput` — current value of the chat input box
- `aiLoading` — boolean, true while waiting for Ollama response

**Ollama state:**
- `ollamaOnline` — boolean, true if Ollama responded to health check
- `ollamaModel` — string name of the detected Ollama model or null
- `ollamaLoading` — boolean, true while any Ollama feature call is in progress
- `ollamaModal` — object with { feature, text, studentId } for OllamaInsightModal (null = closed)

**Doc state:**
- `docLink` — string, the Google Doc URL input value
- `docContent` — string, the fetched raw text of the Google Doc
- `docLoading` — boolean, true while fetching doc
- `docId` — extracted Google Doc ID string
- `noteDraft` — string content of the note draft textarea
- `showNoteDraft` — boolean, shows/hides the note draft area

**Vault state:**
- `vaultTab` — current vault tab: "all", "byStudent", "byPeriod", "flagged", "handoffs", "goalProgress", "knowledge"
- `vaultFilter` — current filter value ("all" or a student/period ID)
- `editingLog` — log ID currently being edited (null = none)
- `kbInput` — textarea content for KB text input
- `kbTitle` — title input for KB document
- `kbDocType` — selected doc type for KB upload
- `kbUploading` — boolean, true while PDF is being processed

### 9.2 Derived Values (computed on every render)

- `period` — DB.periods[activePeriod], the current period object
- `allStudents` — spread of DB.students merged with importedStudents (imported students override DB on collision, though IDs are unique)
- `effectivePeriodStudents` — deduplicated array of student IDs for the current period, combining DB period students with any imported students mapped to this period
- `currentChat` — either masterChat or periodChats[activePeriod] depending on chatMode
- `setCurrentChat` — memoized callback that updates either masterChat or the correct period in periodChats

### 9.3 Action Functions

**addLog(studentId, note, type, extras)** — creates a log via createLog(), prepends to the logs array. The extras object can add source, tags, situationId, etc.

**toggleFlag(id)** — toggles the flagged boolean on a log entry.

**deleteLog(id)** — shows window.confirm, then filters out the log.

**saveEdit(id, newText)** — updates both note and text fields of a log entry, clears editingLog.

**handleChat(e)** — the main chat submit handler. Prevents default. Reads chatInput. Appends user message. Runs runLocalEngine. Formats the response (with KB hits, doc snippet, note prompt). Appends the engine result as an app bubble. The bubble includes: actions, sources, kbHits, showAI flag, originalQuery, followUp, recommendedCards, recommendedTools, detectedSituations.

**askAI(query)** — sends the para's query plus full context to Ollama. First checks if ollamaOnline is false and shows offline message. Builds context pack and serializes it. Appends a "LOCAL AI READING CONTEXT" bundle notice bubble first. Calls ollamaAskAI with the serialized prompt. Appends the AI response as an "ai" bubble. Also appends to masterChat if in period mode. Shows error message on failure.

**handleImport(studentObj, periodId)** — merges an imported student into importedStudents state and adds their ID to importedPeriodMap for the given period. NOTE: IEPImport passes a third arg (privateMapping) which App.jsx ignores — real name handling is done in IEPImport via exportedPrivateRoster.

**handleBundleImport(students, periodMapUpdates)** — bulk import from App Bundle JSON. Deduplicates by student ID (same ID = replace, new ID = add). Merges period map updates into importedPeriodMap using Set deduplication.

**handlePrivateRosterLoad(entries)** — loads Private Roster JSON entries into `privateRoster` state. Entries format: `[{ displayLabel, realName, color }]`. Matches by `displayLabel` (= pseudonym) as primary key. Falls back to `color` match against `allStudents` if `displayLabel` is missing. Only updates entries where `realName` is truthy.

**fetchDoc()** — extracts the Google Doc ID from the URL, fetches the doc as plain text, calls parseDocForPeriod to find the period section, appends a briefing bubble or a "no section found" message.

**pushNoteToDoc(noteText)** — attempts to push a note via the Google Docs API (requires OAuth, usually fails with auth-needed and shows copy text instead).

**addToKB(scope)** — creates a KB document from the title/content/type inputs and adds it to knowledgeBase state.

**handleFileUpload(e, scope)** — handles file uploads to the KB. For PDFs, dynamically imports pdfjs-dist/legacy/build/pdf, uses CDN worker, extracts text page by page, adds to knowledgeBase. For text files, reads as text. Resets the file input.

**draftEmail(studentId)** — opens the email modal, sets loading, serializes the student's IEP and recent logs using serializeForEmailPrompt, calls ollamaDraftEmail, sets the email draft text.

**exportCSV(filteredLogs)** — generates a CSV string from log entries (Date, Period, Student, Type, Category, Flagged, Tags, Observation), creates a blob URL, triggers a download.

### 9.4 Ollama Handlers

**ollamaErrorHandler(err)** — checks if error is OllamaOfflineError (sets ollamaOnline false) or other. Returns human-readable error string.

**handleOllamaPatternSummary(studentId)** — sets ollamaLoading true. Builds context pack with 14 days of logs focused on the given student. Calls summarizeStudentPatterns with the serialized prompt. Sets ollamaModal with feature "patterns" and the result text.

**handleOllamaHandoff(studentId, audience, urgency)** — sets ollamaLoading true. Builds context pack with today's logs only (logDaysBack: 1) focused on the given student. Calls generateHandoffNote. Returns the result string (the HandoffBuilder uses this to set its summary textarea).

**handleOllamaSuggestions(query, detectedSituations)** — sets ollamaLoading true. Builds context pack with 7 days of logs and the detected situations. Calls generateTeachingSuggestions. Appends the result as an "ollama" bubble in the chat.

### 9.5 Toolbox Configuration

The `toolboxTools` array drives both the sidebar buttons and the floating windows. Each tool entry has: id, label, tip (tooltip text), component (JSX). Some have `studentSafe: true` which enables the fullscreen button.

The 8 standard tools:
1. "situations" — SituationPicker panel, lets para pick from 10 situations manually
2. "quickactions" — QuickActionPanel, one-tap logging for the 10 quick actions
3. "cards" — SupportCardPanel, tabbed reference cards
4. "abc" — ABCBuilder, structured behavior record form
5. "goals" — GoalTracker, IEP goal progress logging
6. "handoff" — HandoffBuilder, handoff note composer with AI draft capability
7. "checklist" — ParaChecklist, before/during/after class checklists
8. "strategies" — StrategyLibrary, searchable strategy guides

The 6 student-safe tools (shown in normal mode, 2 shown in simple mode):
9. "timer" — VisualTimer (studentSafe: true)
10. "breathing" — BreathingExercise (studentSafe: true)
11. "grounding" — GroundingExercise (studentSafe: true, normal mode only)
12. "calc" — CalculatorTool (studentSafe: true, normal mode only)
13. "mult" — MultChart (studentSafe: true, normal mode only)
14. "cer" — CEROrganizer (studentSafe: true, normal mode only)

### 9.6 Chat Bubble Rendering

The chat window maps over currentChat and renders each message. Visual treatment by sender:
- sender "user" → right-aligned, default dark bubble
- sender "app" → left-aligned, default dark bubble
- sender "ai" → left-aligned, dark green bubble (#0d2010, #86efac), "✦ AI DEEP DIVE" label
- sender "ollama" → left-aligned, dark purple bubble (#1e1b4b, #c4b5fd), "✦ LOCAL AI — TEACHING SUGGESTIONS" label
- isBundleNotice: true → dark indigo bubble, "LOCAL AI READING CONTEXT" label
- isBriefing: true → dark blue bubble for doc briefings

Below each message, conditionally renders: source badges, AI source tags, recommended card buttons, action log buttons, note building prompt button, "Ask Local AI" button, "Teaching Moves" button (only if ollamaOnline and detectedSituations exist).

---

## 10. COMPONENTS

### 10.1 tools.jsx — Classroom Tools

**VisualTimer** — Circular SVG countdown timer. Presets: 1, 2, 3, 5, 10 minutes. Custom minute input. Counts down, shows remaining time in large text. Green progress arc. Sound or visual end alert. Can be used by students directly (studentSafe).

**CalculatorTool** — Basic expression evaluator. Input box, result display, history. Includes fraction-to-decimal conversion. Uses JavaScript eval (sanitized). Student-safe.

**MultChart** — Interactive multiplication table 1-12. Hover highlight on rows and columns. Student can tap a cell to see the product highlighted. Student-safe.

**CEROrganizer** — Claim-Evidence-Reasoning graphic organizer. Three text areas. Can copy formatted output. Student-safe.

**BreathingExercise** — Guided box breathing: inhale 4s, hold 4s, exhale 6s, repeat. Animated circle expands/contracts. Counter shows cycles. Student-safe.

**GroundingExercise** — 5-4-3-2-1 sensory grounding. Steps through: 5 things you see, 4 you can touch, 3 you hear, 2 you smell, 1 you taste. Paced with a timer. Student-safe.

### 10.2 panels.jsx — Toolbox Panels

**SupportCardPanel({ cards })** — Tab strip of support card titles. Shows the selected card's steps, what to say, what to avoid, accommodations. Cards prop is optional; defaults to all SUPPORT_CARDS.

**QuickActionPanel({ students, studentsMap, onLog })** — Shows the 10 quick action buttons. User taps an action then taps a student name. Creates a log entry with the action's defaultNote and logType.

**ABCBuilder({ students, studentsMap, onSave, periodLabel, currentDate })** — Form for structured behavior records: date picker, student picker, antecedent (what happened before), behavior (what the student did), consequence (what happened after), intensity selector, notes. Saves as a "Behavior Note" log.

**GoalTracker({ students, studentsMap, onSave })** — Dropdown to select student, then shows their IEP goals. Each goal gets a row of 6 progress option buttons (from GOAL_PROGRESS_OPTIONS). Tapping a progress option logs it as a "Goal Progress" entry with the goal text and progress label.

**HandoffBuilder({ students, studentsMap, onSave, ollamaOnline, ollamaLoading, onOllamaHandoff })** — Form with audience selector (Next Para, Teacher, End of Day, Urgent), urgency selector, student picker, summary textarea, action-needed input. Save button logs as "Handoff Note". When ollamaOnline is true, shows "✦ AI Draft" button that calls onOllamaHandoff and sets the summary textarea with the returned text.

**ParaChecklist()** — Three-phase (Before/During/After) checklist. Toggle buttons for each phase. Checkbox for each item. Shows progress bar and completion count.

**StrategyLibrary()** — Filterable list of all 6 STRATEGIES. Filter by tag (sld, adhd, autism, behavior, reading, writing, math, transition). Shows each strategy's steps, when to use, when to avoid in an expandable card.

**SituationPicker({ onSelect })** — Grid of the 10 SITUATIONS with their icons and titles. Tapping one calls onSelect with the situation object, which opens the SituationResponseModal.

### 10.3 modals.jsx — Modal Overlays

**StudentProfileModal({ studentId, studentData, logs, currentDate, onClose, onLog, onDraftEmail })** — Full-screen overlay for a student's profile. Uses studentData prop if provided, otherwise falls back to DB.students[studentId]. Color-themed using the student's color (header gradient, tab borders, card borders). Tabs: Overview (eligibility, goals count, log count, notes, strengths, triggers, strategies), Goals (each goal with a progress log form), Accommodations (all accommodations as checklist items), Strategies (the student's strategy list), Logs (all past log entries for this student). Inline log creation form. "Draft Email" button opens the email modal.

**EmailModal({ studentId, studentData, emailLoading, emailDraft, setEmailDraft, onClose })** — Shows the AI-generated email draft (or loading spinner). Editable textarea for the draft. Copy to clipboard button. Close button.

**SituationResponseModal({ situation, students, studentsMap, onClose, onLog, onOpenCard })** — Shows the selected situation's recommended cards (as clickable buttons), recommended actions (with log buttons per student), and follow-up text. "View Support Cards" button calls onOpenCard to open the cards panel.

**OllamaInsightModal({ feature, text, studentId, onClose, onLog })** — Displays AI-generated text from Ollama. Feature determines the header: "patterns" → "Pattern Summary" (purple), "handoff" → "Handoff Draft" (green), "suggestions" → "Teaching Suggestions" (yellow). Shows the text in a scrollable styled box. Copy button. "Save as Log Entry" button (only if studentId provided) calls onLog with the text as a General Observation tagged ["ollama", feature].

### 10.4 windows.jsx — UI Infrastructure

**Tip({ text, children, pos })** — Portal-based tooltip. Uses ReactDOM.createPortal to render at document.body level with position: fixed. Uses getBoundingClientRect() for accurate positioning. pos can be "top", "bottom", "left", "right". Avoids viewport edge overflow. Renders a "?" button trigger. Clicking shows/hides the tooltip above all stacking contexts.

**FullscreenTool({ tool, onClose })** — Full viewport overlay for student-safe tools. Dark background. Tool rendered at 1.3x scale. Close button.

**FloatingToolWindow({ tool, onClose, onFullscreen, onDock })** — Draggable, resizable floating window. Mouse and touch drag support. Resize handle at bottom-right corner. Base width 360px. Content scales proportionally with window width using CSS transform: scale(). Header buttons: "⊟" dock (closes float, re-opens in sidebar via onDock), "⛶" fullscreen (if studentSafe), "✕" close.

**RosterPanel({ students, privateRoster, onNameChange, onRosterLoad, onClose })** — Session-only Private Roster sidebar panel. Props:
- `students` — array of all student objects (DB + imported) for the current period
- `privateRoster` — object `{ [pseudonym]: realName }` from App.jsx state
- `onNameChange(pseudonym, value)` — callback to update a single entry in `privateRoster`
- `onRosterLoad(entries)` — callback when a Private Roster JSON file is uploaded
- `onClose` — closes the panel

Features:
- Shows each student's color dot and pseudonym with a text input for real name
- Upload button: accepts `.json` files only; validates using `validatePrivateRoster()` (System 2 validator); calls `onRosterLoad` on success; shows error if wrong file type
- "↓ Download Roster Template" button: builds a Private Roster JSON object from current student list and `privateRoster` state, downloads as `private-roster-template.json`
- "Clear Private Roster" button: shown only when any names are entered; resets all names by calling `onNameChange` for each
- `validatePrivateRoster(json)` — System 2 validator: rejects if `normalizedStudents` field exists (redirect to bundle tab), rejects if `type !== "privateRoster"`, rejects if `students` array is missing

**StealthScreen({ activeTool, toolboxTools, onSelectTool, onExit })** — Full dark overlay that hides all student data. Only shows a tool selector and the active classroom tool. Used during observations or when privacy is needed. Exit button returns to normal view.

### 10.5 AnalyticsDashboard.jsx

Receives: logs, groups, setGroups, onOpenProfile, ollamaOnline, ollamaLoading, onOllamaPatternSummary.

Shows overall log counts (total, by category). Date range filter. Type breakdown bar chart. Per-student analytics card showing log activity chart, type breakdown, and a "✦ Patterns" button (visible only when ollamaOnline is true) that triggers handleOllamaPatternSummary for that student. Custom group builder — para can define groups of students and see combined analytics. Clicking a student name opens their profile modal.

### 10.6 SimpleMode.jsx — Para Notes Mode

Stripped-down UI for non-technical users or when the para needs speed. Steps:
1. Period picker — quick tap to select active period
2. Student selector — large colored buttons for each student in the period
3. Category selector — 6 large category buttons: Behavior, Work Refusal, Transition, Positive!, Needed Break, Academic Help
4. Note text area — plain language input
5. Save — one tap saves the log

On save, runs runLocalEngine in the background (silent — user doesn't see the result). Detects situation, category, and tags automatically. Shows IEP Quick Reminder strip (the student's top accommodations) above the save button. Timer and Breathing buttons always visible in the header.

### 10.7 IEPImport.jsx — IEP Document Import

Component signature: `IEPImport({ onImport, onBulkImport, importedCount })`

Four input modes (tabs):
- **📋 Paste Text** — textarea for pasting IEP content, then "Parse with Local AI" button
- **📎 Upload File** — file picker for PDF or TXT, auto-parses after upload
- **✏️ Manual Entry** — form fields for each IEP field
- **📦 App Bundle JSON** — upload a previously-exported FERPA-safe app bundle

#### System 1: App Bundle Validator

`validateBundle(json)` — validates App Bundle JSON files:
- Rejects non-objects and arrays
- Rejects files with `type === "privateRoster"` with clear redirect message: "This is a Private Roster file — upload it using the 👤 Private Roster button in the sidebar"
- Requires `schemaVersion` field; supported values: "2.0", "2.1"
- Requires `normalizedStudents.students` array
- Returns null if valid, error string if invalid

App Bundle JSON format:
```json
{
  "schemaVersion": "2.0",
  "normalizedStudents": {
    "students": [ ...student objects... ]
  }
}
```

#### Bundle Import Flow (Tab 4)

1. User uploads App Bundle JSON — `handleBundleFile` validates it
2. Preview table shows: pseudonym, color, eligibility, goals count, accommodations count, flags
3. "Import N Students into App" button calls `doBundleImport`
4. `doBundleImport`: runs each student through `normalizeImportedStudent`, builds period map, calls `onBulkImport(normalized, periodMapUpdates)`
5. Success banner shows "✓ N students imported from bundle!"
6. After success, a purple companion prompt: "Have a Private Roster JSON? Load it via the 👤 Private Roster button in the sidebar."

#### Individual IEP Import Flow (Tabs 1-3)

**PDF handling:** Dynamically imports pdfjs-dist/legacy/build/pdf. Sets GlobalWorkerOptions.workerSrc to CDN URL for that version. Loads the PDF as ArrayBuffer. Iterates each page, extracts text content items, joins them. Sends extracted text to ollamaParseIEP.

**Parsing:** ollamaParseIEP sends to Ollama with SYS_IEP_PARSE prompt. Returns parsed JSON or null. On null, shows error message.

**Privacy conversion:** Assigns a color from IMPORT_COLORS palette (10 colors: Cyan, Lime, Rose, Sky, Fuchsia, Coral, Turquoise, Lavender, Yellow, Mint) based on `importedCount % 10`. Generates pseudonym like "Cyan Student 1", "Lime Student 2". Shows real name (struck through) → pseudonym preview.

**Import (`handleImport`):**
1. Builds `studentObj` with pseudonym, color, IEP fields — NO real name
2. Calls `onImport(studentObj, selectedPeriod, privateMapping)` — App.jsx only uses first two args
3. Determines `capturedName`: if `data.studentName` is non-empty and not "Unknown" → use it; otherwise `""`
4. ALWAYS adds entry to `exportedPrivateRoster`: `{ color, displayLabel: pseudonym, realName: capturedName }`
5. Sets `lastImportedPseudonym` (frozen at import time to survive `importedCount` re-render)
6. Sets `imported: true` for 3-second success display

**Private Roster Accumulator:**
- `exportedPrivateRoster` state: array of `{ color, displayLabel, realName }` entries
- Accumulates across multiple imports in the session
- Entries always created after import (realName may be empty if name not extracted)
- Persistent green banner appears at top of IEP Import whenever `exportedPrivateRoster.length > 0`
- Banner shows "↓ Save Private Roster JSON" button and a "✕" to clear
- If any entry has empty realName: shows hint "Some names were not extracted — fill them in after downloading"
- `downloadPrivateRosterJSON()`: creates JSON blob, downloads as `private-roster-YYYY-MM-DD.json`

**Private Roster JSON format (output):**
```json
{
  "schemaVersion": "1.0",
  "type": "privateRoster",
  "createdAt": "ISO_TIMESTAMP",
  "students": [
    { "color": "#06b6d4", "displayLabel": "Cyan Student 1", "realName": "Jordan" }
  ]
}
```

**Downloads:**
- "↓ Save Private Roster JSON" — downloads `exportedPrivateRoster` as `private-roster-YYYY-MM-DD.json` (shown in green banner when entries exist)
- "↓ Safe JSON" — downloads the FERPA-safe student object (no real name)
- "↓ Private Mapping" — downloads a JSON file with the real-name mapping, labeled with a privacy warning

### 10.8 OllamaStatusBadge.jsx

A tiny presentational component that shows either "Local AI: online" (dark indigo background, purple text) or "Local AI: offline" (dark gray). Shown in the BrandHeader (top of app). Has a tooltip with the model name when online. No interaction.

### 10.9 BrandHeader.jsx

Fixed 52px header at the top of the app. Dark background (#04080f), border-bottom (#1e3a5f). Contains:
- SupaPara logo image at `/public/assets/logo.png` with text fallback on error
- Tagline "Powering ParaProfessionals" (hidden below 1100px viewport width via CSS)
- `right` prop slot — renders OllamaStatusBadge passed from App.jsx

The App.jsx wraps the entire layout in a `flex-column` div: BrandHeader at top, then the main flex-row layout below.

---

## 11. LAYOUT AND NAVIGATION

The app uses a flex-column wrapper:
1. **BrandHeader** — fixed 52px header (logo + Ollama status)
2. **Main flex-row** (flex: 1, overflow: hidden):
   - Left (optional, 220px) — RosterPanel, appears when rosterPanelOpen is true
   - Middle — app-layout div containing: sidebar + main content
   - Right (optional, 320px) — activeToolbox sidebar panel

The app-layout has `height: 100%` (not 100vh — the BrandHeader takes up the top portion).

The sidebar (inside app-layout) contains:
- Date picker (sets currentDate)
- Active Period dropdown (sets activePeriod)
- Navigation buttons: Dashboard, Data Vault, IEP Import, Analytics
- Toolbox buttons (single-click = open in sidebar, double-click = pop out as float)
- Bottom buttons: Stealth Mode, Para Notes Mode toggle, Private Roster toggle
- FERPA label

The main content area switches based on `view` state:
- "dashboard" → renderDashboard() — chat panel + caseload matrix
- "vault" → renderVault() — data vault with tabs and KB management
- "import" → IEPImport component
- "analytics" → AnalyticsDashboard component

When simpleMode is true, the entire main content area shows SimpleMode instead.

---

## 12. DATA FLOWS

### 12.1 Para types a message → AI response

1. Para types in chat input box
2. handleChat() fires
3. runLocalEngine() runs instantly with the text, period students, KB, doc content, period label, logs
4. Engine returns: situations, moves, actions, sources, recommendedCards, recommendedTools, docSnippet, kbHits
5. Chat bubble appears with the engine output and action buttons
6. Para optionally clicks "Ask Local AI" button
7. askAI() fires, builds context pack, serializes it, calls ollamaAskAI
8. Ollama processes for 5-30 seconds
9. AI response appears as a green "ai" bubble in chat
10. Also stored in masterChat

### 12.2 Para taps a log action button in chat

1. Para taps a button like "✦ Break Pass: Purple Student 1"
2. addLog() fires with studentId, note (the defaultNote), type (the logType)
3. createLog() in models layer adds auto-category, auto-tags, timestamp, unique ID
4. Log is prepended to logs state array
5. Confirmation bubble appears in chat: "✅ Logged: [label]"

### 12.3 Individual IEP import → Private Roster generation

1. Para pastes IEP text or uploads file or uses manual entry
2. PDF: pdfjs extracts text locally (no network)
3. ollamaParseIEP sends text to Ollama with JSON extraction prompt
4. Ollama returns JSON string
5. ollamaParseIEP parses JSON
6. Preview panel shows privacy conversion and extracted fields
7. Para selects period and taps "Add [Pseudonym] to App"
8. handleImport() in IEPImport:
   - Creates studentObj (pseudonym only, no real name) → calls onImport → App.jsx adds to importedStudents
   - ALWAYS creates roster entry in exportedPrivateRoster (capturedName = extracted name or "")
   - Sets lastImportedPseudonym to freeze the pseudonym name for the success display
9. Green "🔒 Private Roster JSON ready" banner appears at top
10. Para clicks "↓ Save Private Roster JSON" → downloads `private-roster-YYYY-MM-DD.json`
11. Later: para loads the file in the 👤 Private Roster sidebar to reconnect names

### 12.4 App Bundle import

1. Para goes to IEP Import → App Bundle JSON tab
2. Uploads bundle JSON file
3. validateBundle() checks schemaVersion (2.0 or 2.1) and normalizedStudents structure
4. Preview table shows all students in the bundle
5. Para clicks "Import N Students into App"
6. doBundleImport() normalizes students via normalizeImportedStudent()
7. onBulkImport() → handleBundleImport() in App.jsx adds all students
8. Success: "✓ N students imported!" + reminder to load Private Roster JSON via sidebar

### 12.5 Private Roster re-import (sidebar)

1. Para clicks 👤 Private Roster button in sidebar
2. RosterPanel opens
3. Para clicks "Upload Private Roster JSON" button
4. validatePrivateRoster() checks type === "privateRoster" and students array
5. onRosterLoad(json.students) → handlePrivateRosterLoad() in App.jsx
6. handlePrivateRosterLoad builds update object keyed by displayLabel (= pseudonym)
7. Merges into privateRoster state: { [pseudonym]: realName }
8. RosterPanel inputs now show the real names pre-filled
9. Names used only in the sidebar — never in logs, AI context, exports

### 12.6 Pattern Summary via Analytics

1. Para clicks "✦ Patterns" button on a student row in Analytics
2. handleOllamaPatternSummary(studentId) fires
3. buildContextPack() with focusStudentId and logDaysBack: 14
4. serializeForPatternPrompt() converts pack to text string
5. summarizeStudentPatterns() calls callOllama with SYS_PATTERN_SUMMARY
6. Ollama returns summary text
7. ollamaModal state set to { feature: "patterns", text, studentId }
8. OllamaInsightModal renders with purple styling
9. Para can copy or save as log entry

### 12.7 AI Handoff Draft in HandoffBuilder

1. Para selects audience and urgency in HandoffBuilder
2. Taps "✦ AI Draft" button
3. HandoffBuilder calls onOllamaHandoff(studentId, audience, urgency)
4. handleOllamaHandoff() in App fires
5. buildContextPack() with logDaysBack: 1 (today only)
6. serializeForHandoffPrompt() converts to text
7. generateHandoffNote() calls callOllama with SYS_HANDOFF
8. Result string returned to HandoffBuilder
9. HandoffBuilder sets its summary state to the result
10. Summary textarea fills with the AI draft

---

## 13. TWO-SYSTEM IMPORT ARCHITECTURE

The app has two completely separate import systems, each with its own validator and UI entry point. They are mutually exclusive — each rejects the other's file type with a clear redirect message.

### System 1: App Bundle JSON (IEPImport.jsx, bundle tab)

- Purpose: Restore a previously exported FERPA-safe app bundle
- Validator: `validateBundle(json)` in IEPImport.jsx
- Accepted: `{ schemaVersion: "2.0"|"2.1", normalizedStudents: { students: [...] } }`
- Rejected: Any file with `type === "privateRoster"` (redirect to System 2)
- State: `importedStudents`, `importedPeriodMap` in App.jsx
- Contains: pseudonyms only — NO real names
- UI: Tab 4 "📦 App Bundle JSON" in IEP Import view

### System 2: Private Roster JSON (RosterPanel in windows.jsx, sidebar)

- Purpose: Connect real student names to pseudonyms in the sidebar
- Validator: `validatePrivateRoster(json)` in windows.jsx
- Accepted: `{ type: "privateRoster", schemaVersion: "1.0", students: [...] }`
- Rejected: Any file with `normalizedStudents` field (redirect to System 1)
- State: `privateRoster` in App.jsx — object `{ [pseudonym]: realName }`
- Key: `pseudonym` (= student's `displayLabel`) — NOT student ID
- UI: 👤 Private Roster button in sidebar → upload button in RosterPanel

---

## 14. FERPA SAFETY ARCHITECTURE

The app enforces FERPA compliance through these mechanisms:

**Pseudonym system:** All student data in DB.students uses color-based pseudonyms. Real names are never in the codebase, never in any state variable that gets serialized or persisted, never sent to any AI.

**Imported students:** When a para imports an IEP, the real name (if extracted by Ollama) is captured in `exportedPrivateRoster` state INSIDE IEPImport component only. The `studentObj` stored in `importedStudents` state contains only the pseudonym. The real name NEVER enters App.jsx state (handleImport only accepts studentObj and periodId).

**privateRoster state:** Lives in App.jsx as `{ [pseudonym]: realName }`. Used ONLY by RosterPanel for display. Never passed to any AI function, never included in logs, never in any serializer, never exported in CSV. Disappears when tab is closed (not persisted to localStorage).

**Private Roster Panel:** Reads from `privateRoster` state. Inputs keyed by student `pseudonym` (not studentId). The real name shown in the input never leaves the sidebar UI.

**AI context:** The buildContextPack function and all serializers use only pseudonyms (from s.pseudonym). No serializer accesses any real name field.

**Exports:** The CSV export uses s.pseudonym for the student column. The safe JSON download from IEPImport uses pseudonym. The "Private Mapping" download contains real names but has a `_warning` field labeling it as private. The "Private Roster JSON" download from IEPImport is labeled "PRIVATE" and documents the correct workflow for re-import.

**Logs:** All logs store studentId (e.g., "stu_001") and are displayed using the pseudonym. No log contains any real name.

---

## 15. OLLAMA FALLBACK BEHAVIOR

When Ollama is offline (ollamaOnline is false):
- OllamaStatusBadge shows gray "Local AI: offline" in BrandHeader
- "Ask Local AI" button in chat shows offline message when clicked
- "Teaching Moves" button in chat is hidden (only shown when ollamaOnline is true)
- "✦ AI Draft" button in HandoffBuilder is hidden
- "✦ Patterns" button in Analytics is hidden
- Email drafting shows "Local AI is offline. Start Ollama with: ollama serve"
- KB PDF upload falls back to pdfjs text extraction only (no AI summarization needed for raw text)
- IEPImport shows parse error suggesting to check Ollama
- All rule-based features (runLocalEngine, support cards, quick actions, checklists, strategies, timers, etc.) continue working with no impact

If Ollama goes offline mid-session (e.g., network hiccup), the error handler in each Ollama function catches OllamaOfflineError and calls setOllamaOnline(false), which immediately hides all Ollama buttons via conditional rendering.

---

## 16. FLOATING WINDOW SYSTEM

Any toolbox tool can be "popped out" as a floating window by double-clicking its sidebar button (or clicking the ↗ button in the sidebar panel header).

**FloatingToolWindow behavior:**
- Draggable by the header bar (mouse and touch)
- Resizable from bottom-right corner
- Content scales proportionally with window width (CSS transform: scale based on size.w / 360 ratio, so at 720px wide everything is 2x the base size)
- "⊟" dock button: removes from floatingTools state, sets activeToolbox to that tool's ID (snaps back to sidebar)
- "⛶" fullscreen button (student-safe tools only): removes from floatingTools, sets fullscreenTool state
- "✕" close button: removes from floatingTools state

Multiple tools can float simultaneously. They are rendered in a z-index 1200 layer above everything except modals.

---

## 17. COMPLETE FUNCTION INVENTORY

### src/data.js
- getStudent(id) — lookup student by ID
- getPeriod(id) — lookup period by ID
- getStudentsForPeriod(periodId) — get full student objects for a period
- searchStrategies(tags) — filter strategies by tag array
- getSupportCard(id) — lookup support card by ID
- getQuickAction(id) — lookup quick action by ID

### src/engine/index.js
- searchKBDoc(doc, queryWords) — keyword search in a KB document
- parseDocForPeriod(docText, periodLabel) — extract period section from Google Doc
- detectSituation(text) — score and rank matching situations
- runLocalEngine(...) — full recommendation engine, zero API calls

### src/engine/ollama.js
- checkOllamaHealth() — health check, returns online status and model name
- callOllama(systemPrompt, userPrompt) — core Ollama fetch wrapper
- ollamaAskAI(contextBlock) — para copilot chat feature
- summarizeStudentPatterns(serializedContext) — pattern summary feature
- generateHandoffNote(serializedContext) — handoff note feature
- generateTeachingSuggestions(serializedContext) — teaching suggestions feature
- ollamaDraftEmail(contextBlock) — email draft feature
- ollamaExtractPDF(rawText) — PDF text extraction via AI
- ollamaParseIEP(documentText) — IEP document parsing, returns parsed JSON object or null

### src/context/buildContext.js
- buildContextPack(params) — assembles ContextPack from app state
- serializeForAI(pack, query, kbDocs) — serializes for main chat AI call
- serializeForPatternPrompt(pack) — serializes for pattern summary
- serializeForHandoffPrompt(pack) — serializes for handoff generation
- serializeForSuggestionsPrompt(pack) — serializes for teaching suggestions
- serializeForEmailPrompt(student, logs) — serializes for email drafting

### src/models/index.js
- createLog(params) — creates enriched log entry object
- detectCategory(type) — maps log type to category string [internal]
- generateTags(type, note) — auto-generates tags from log content [internal]
- getHealth(studentId, logs, currentDate) — returns "green", "yellow", or "red"
- hdot(h) — converts health string to emoji
- createStudent(data) — normalizes a student data object
- normalizeImportedStudent(rawStudent) — normalizes a bundle student for app use
- getRecentStudentLogs(logs, studentId, limit) — query helper
- getLogsByDateRange(logs, startDate, endDate) — query helper
- getLogsByType(logs, type) — query helper
- getLogsByCategory(logs, category) — query helper

### src/App.jsx (all functions)
- addLog(studentId, note, type, extras) — creates and stores a log
- toggleFlag(id) — toggles flag on a log
- deleteLog(id) — deletes a log after confirmation
- saveEdit(id, newText) — updates a log's text
- handleChat(e) — chat submit, runs engine, shows response
- askAI(query) — sends to Ollama, shows AI response
- handleImport(studentObj, periodId) — merges imported student (real name arg silently unused)
- handleBundleImport(students, periodMapUpdates) — bulk import from bundle
- handlePrivateRosterLoad(entries) — loads Private Roster JSON into privateRoster state
- fetchDoc() — fetches Google Doc content
- pushNoteToDoc(noteText) — attempts to push note to Google Doc
- addToKB(scope) — adds text content to knowledge base
- handleFileUpload(e, scope) — handles KB file uploads with pdfjs
- draftEmail(studentId) — generates email via Ollama
- exportCSV(filteredLogs) — downloads CSV of log data
- ollamaErrorHandler(err) — maps errors to user messages
- handleOllamaPatternSummary(studentId) — pattern summary handler
- handleOllamaHandoff(studentId, audience, urgency) — handoff draft handler
- handleOllamaSuggestions(query, detectedSituations) — teaching suggestions handler
- renderDashboard() — renders the dashboard view
- renderVault() — renders the data vault view

### src/components/IEPImport.jsx (key functions)
- validateBundle(json) — System 1 validator (module-level, not exported)
- extractPDFText(file) — async, uses pdfjs-dist to extract text from PDF locally
- handleBundleFile(e) — parses and validates uploaded bundle JSON file
- doBundleImport() — bulk imports bundle students via onBulkImport
- handleFileUpload(e) — uploads and auto-parses IEP PDF/TXT file
- runParse(text) — calls ollamaParseIEP, sets parsed state
- handleParseAI() — triggers runParse with current rawText
- buildFromManual() — builds parsed data object from manual entry fields
- getActiveParsed() — returns parsed (AI mode) or buildFromManual() (manual mode)
- handleImport() — imports student, always creates Private Roster entry
- downloadPrivateRosterJSON() — downloads exportedPrivateRoster as JSON file
- downloadJSON(obj, filename) — generic JSON blob download helper

### src/components/windows.jsx (key functions — RosterPanel)
- validatePrivateRoster(json) — System 2 validator (module-level, not exported)
- handleFileUpload(e) — validates and loads Private Roster JSON via onRosterLoad
- buildRosterTemplate() — builds Private Roster JSON object from current student list
- handleDownloadTemplate() — downloads the roster template as JSON
- handleImport() — paste-JSON flow using validatePrivateRoster
