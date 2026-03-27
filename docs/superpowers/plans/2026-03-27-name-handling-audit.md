# Name Handling Audit & Remediation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate fragile pseudonym-as-lookup patterns, add an explicit export policy flag, and route all name resolution through a single centralized module so FERPA compliance is enforceable by construction.

**Architecture:** Introduce `src/privacy/nameResolver.js` as the single source of truth for all name formatting and export decisions. Migrate pseudonym-based lookups to studentId-based lookups. Add an explicit `exportMode` flag to distinguish Safe vs. Private exports.

**Tech Stack:** React, plain JS (no new libraries)

---

## 1. Current Problem Summary

The app has **three overlapping name-handling patterns** that have never been consolidated:

| Pattern | Where | Problem |
|---------|-------|---------|
| `getStudentLabel()` called directly | 23+ call sites across 10 files | No enforcement layer — any caller can drift to adding real names |
| `pseudonym` used as a lookup key | `models/index.js:145`, `windows.jsx:110` | Pseudonyms are not unique; two students can share a color sequence, causing silent merge bugs |
| Export uses `getStudentLabel` with no mode flag | `App.jsx:343` | No distinction between Safe Export (pseudonym only) and Private Export (real name allowed); adding private export later requires touching every export call site |

The overall FERPA posture is **sound** — real names never reach logs, AI context, or localStorage. But the architecture is **one bad pull-request away** from a violation: there is no structural barrier preventing a future call site from using `student.realName` instead of `getStudentLabel(student)`.

---

## 2. Current Name Flow

```
Import (IEPImport / windows.jsx)
  ↓
realName + pseudonym extracted from CSV/JSON
  ↓
buildIdentityRegistry() / buildIdentityRegistryFromMasterRoster()
  → returns [{ realName, pseudonym, studentId, identity, ... }]
  ↓
identityRegistry state (App.jsx)          identityOverrides state (App.jsx)
  ↑ ephemeral, never persisted             ↑ persisted (localStorage), emoji/codename only
  ↓
allStudents map (App.jsx)
  = DB.students merged with importedStudents
    with identityOverrides applied
  → each student: { id, pseudonym, identity, accs, ... }
  ↓
getStudentLabel(student, format)           ← called at 23+ sites
  → falls back: identity → pseudonym → "Unknown"
  ↓
Display / AI context / CSV export
```

**Fragile join points:**
- `normalizeIdentityEntries()` at `models/index.js:145`: joins registry → app students by matching `pseudonym` string
- `buildRosterLookups()` at `windows.jsx:110`: joins private roster → app students by matching `pseudonym` string
- `App.jsx:343`: CSV export calls `getStudentLabel()` without an export-mode argument

---

## 3. Recommended Architecture — nameResolver.js

Create `src/privacy/nameResolver.js` as the **single, auditable gate** between the app and any name data.

```js
// src/privacy/nameResolver.js

/**
 * EXPORT MODES
 * 'safe'    — pseudonym / identity label only (FERPA-safe, shareable)
 * 'private' — real name allowed (requires private roster loaded, local-only)
 */
export const EXPORT_MODE = {
  SAFE:    'safe',
  PRIVATE: 'private',
};

/**
 * Resolve a student's display label.
 * This is the ONLY place in the app that may format a student name for display.
 *
 * @param {object} student  — allStudents entry { id, pseudonym, identity }
 * @param {string} format   — 'compact' | 'full' (passed to formatLabel)
 * @returns {string}
 */
export function resolveLabel(student, format = 'compact') {
  // Delegates to existing getStudentLabel — centralises the call site
  return getStudentLabel(student, format);
}

/**
 * Resolve a student's name for export.
 * 'safe'    → identity label / pseudonym
 * 'private' → realName from identityRegistry, only if provided and loaded
 *
 * @param {object}   student          — allStudents entry
 * @param {string}   mode             — EXPORT_MODE.SAFE | EXPORT_MODE.PRIVATE
 * @param {Map}      [realNameMap]    — Map<studentId, realName>, required for PRIVATE mode
 * @returns {string}
 */
export function resolveExportName(student, mode, realNameMap = null) {
  if (mode === EXPORT_MODE.PRIVATE && realNameMap?.has(student.id)) {
    return realNameMap.get(student.id);
  }
  return resolveLabel(student, 'compact');
}

/**
 * Resolve a student by studentId.
 * Use this wherever pseudonym was previously used as a lookup key.
 *
 * @param {string}  studentId
 * @param {object}  allStudents  — keyed by studentId
 * @returns {object|undefined}
 */
export function resolveById(studentId, allStudents) {
  return allStudents[studentId];
}
```

This module:
- Contains zero business logic (delegates to existing `getStudentLabel`)
- Is the only file any future developer needs to audit for name-handling compliance
- Makes the export mode an **explicit argument**, not a side-effect of which function is called
- Provides `resolveById` to remove pseudonym-as-lookup from call sites that don't need to touch raw student data

---

## 4. Export Policy Design

**Two export modes, enforced at the call site:**

| Mode | Label | When Available | What Name Field |
|------|-------|---------------|----------------|
| `EXPORT_MODE.SAFE` | "Export (Safe)" | Always | `getStudentLabel()` result — identity or pseudonym |
| `EXPORT_MODE.PRIVATE` | "Export with Names" | Only when `identityRegistry.length > 0` (private roster loaded) | `realName` from a `realNameMap` built at export time from `identityRegistry` |

**Build the realNameMap at export time (never store it in state):**
```js
// Built fresh when "Export with Names" is clicked, disposed immediately after
function buildRealNameMap(identityRegistry) {
  const map = new Map();
  identityRegistry.forEach(entry => {
    if (entry.studentId && entry.realName) {
      map.set(entry.studentId, entry.realName);
    }
  });
  return map;
}
```

**CSV export call signature after migration:**
```js
// Safe export (default)
exportCSV(filteredLogs, allStudents, EXPORT_MODE.SAFE);

// Private export (only when private roster loaded)
exportCSV(filteredLogs, allStudents, EXPORT_MODE.PRIVATE, buildRealNameMap(identityRegistry));
```

---

## 5. Phased Implementation Plan

### Phase A — Build nameResolver.js (no behavior change)

Create `src/privacy/nameResolver.js` with `resolveLabel`, `resolveExportName`, `resolveById`.
Migrate all 23 `getStudentLabel()` call sites to `resolveLabel()`.
This is a pure rename/re-route — zero behavior change, but creates the auditable single gate.

**Files changed:**
- Create: `src/privacy/nameResolver.js`
- Modify: `src/context/buildContext.js` (lines 46, 96, 203)
- Modify: `src/components/panels.jsx` (lines 54, 76, 94, 106, 130, 147)
- Modify: `src/components/AnalyticsDashboard.jsx` (lines 76, 104, 143)
- Modify: `src/components/Dashboard.jsx` (lines 100, 313, 346, 500)
- Modify: `src/components/SimpleMode.jsx` (lines 242, 303, 355)
- Modify: `src/App.jsx` (lines 343, 469, 472)
- Modify: `src/engine/index.js` (lines 85, 114-124)
- Modify: `src/components/modals.jsx` (line 80)
- Test: `src/__tests__/nameResolver.test.js` (new)

**TDD requirement:** Write tests for `resolveLabel`, `resolveExportName`, `resolveById` before touching any call sites.

---

### Phase B — Add explicit export mode (Safe / Private)

Migrate the single CSV export call in `App.jsx:343` to use `resolveExportName(s, mode, realNameMap)`.
Add a "Export with Names" button (only visible when `identityRegistry.length > 0`).
Build `realNameMap` from `identityRegistry` at call time, never store it in app state.

**Files changed:**
- Modify: `src/App.jsx` — `exportCSV()` function signature and call sites; add "Export with Names" button
- Modify: `src/privacy/nameResolver.js` — `buildRealNameMap` helper (or inline in App.jsx)
- Test: extend `nameResolver.test.js` with export mode tests

---

### Phase C — Fix pseudonym-as-lookup (fragile joins)

Replace the two pseudonym-based lookups with studentId-based lookups:

**`models/index.js:145` — `normalizeIdentityEntries()`:**
The current flow: `stuIdByPseudonym[pseudonym] → studentId`. This is needed because the identity registry may contain entries that were imported before students existed in the DB. The fix is to cross-reference by `studentId` when present in the entry, and only fall back to pseudonym matching when no studentId is available (backward compat for old exports).

```js
// After fix:
const studentId = entry.studentId   // prefer direct id
  || stuIdByPseudonym[entry.pseudonym]; // fallback for old imports
```

**`windows.jsx:110` — `buildRosterLookups()`:**
Same pattern. The private roster JSON now includes `studentId` (added in 2026-03-25 overhaul). Prefer it; keep pseudonym fallback for files exported before that date.

```js
// After fix:
const stu = (e.studentId && allStudents[e.studentId])
  || stuByPseudonym[e.pseudonym]; // fallback for old exports
```

**Files changed:**
- Modify: `src/models/index.js` (lines 125-148)
- Modify: `src/components/windows.jsx` (lines 102-114)
- Test: `src/__tests__/rosterLookups.test.js` (extend existing tests; cover studentId-first path)

---

### Phase D — Lint rule / ESLint guard (optional hardening)

Add an ESLint `no-restricted-syntax` rule that flags any direct access to `student.realName` outside of `src/privacy/nameResolver.js` and `src/models/index.js`. This makes the architecture self-enforcing for future contributors.

```json
// .eslintrc addition
{
  "no-restricted-syntax": [
    "warn",
    {
      "selector": "MemberExpression[property.name='realName']",
      "message": "Access realName only through src/privacy/nameResolver.js or src/models/index.js"
    }
  ]
}
```

**Files changed:**
- Modify: `.eslintrc` or `package.json` eslint config

---

## 6. Backward Compatibility Strategy

- **Phase A** is a pure rename — no behavior change, no state change, no export format change.
- **Phase B** adds a new export button; existing "Export" button behavior is unchanged.
- **Phase C** fixes the pseudonym-as-lookup bug but adds a fallback for old exports. Private roster files exported before the Phase C fix will still import correctly via the pseudonym fallback path.
- **Phase D** is lint-only; no runtime change.

No migration scripts needed. No localStorage schema changes.

---

## 7. Highest Risk Areas

| Area | Risk | Mitigation |
|------|------|-----------|
| `normalizeIdentityEntries()` pseudonym lookup | Silent merge failure if two students share a pseudonym sequence | Phase C fix adds studentId-first path; write regression tests with collision scenario |
| `buildRosterLookups()` pseudonym lookup | Same as above; affects private roster load | Phase C fix; existing `rosterLookups.test.js` should cover the new path |
| `exportCSV` real-name mode | Real names could appear in a CSV that gets shared | Phase B explicitly gates on `identityRegistry.length > 0`; build `realNameMap` at call time, dispose immediately |
| `engine/index.js` action label generation | `getStudentLabel` in what is partly logic (suggestion labels) — could drift to including real names | Phase A routes through `resolveLabel`; engine never touches student object directly after Phase A |
| `buildContext.js` AI serialization | AI prompts must never include real names | Already uses `getStudentLabel` only; Phase A routes through resolver with no behavior change |

---

## 8. Recommended First Phase

**Start with Phase A.**

Why:
1. Zero risk — it's a pure rename of 23 call sites with no logic change
2. Immediately creates the auditable single gate
3. All future phases build on the resolver being in place
4. Tests for `nameResolver.js` will document the contract before any migration happens

Sequence for Phase A:
1. Write tests for `resolveLabel`, `resolveExportName`, `resolveById` in `nameResolver.test.js` — run, confirm RED
2. Create `src/privacy/nameResolver.js` with the three functions
3. Run tests — confirm GREEN
4. Migrate call sites file-by-file (buildContext.js first — it's the AI boundary, highest stakes)
5. Run full test suite after each file — confirm no regressions
6. Commit

Do not start Phase B, C, or D until Phase A is committed and tests pass cleanly.
