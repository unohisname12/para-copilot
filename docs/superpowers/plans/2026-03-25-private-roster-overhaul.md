# Private Roster Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat private roster with an identity-registry system — one pseudonym+color per unique real student across all periods — and rebuild RosterPanel with a two-mode period-grouped UI.

**Architecture:** A new `buildIdentityRegistry(bundleData)` function in `models/index.js` reads real names from `privateRosterMap`, deduplicates cross-period students, assigns one pseudonym+color each via `generatePseudonymSet()`, and returns typed student imports + period map. `App.jsx` swaps `privateRoster` state for `identityRegistry[]`. `RosterPanel` is rebuilt with a mode toggle (Current Class / Whole Roster) and period-grouped student rows — no manual name inputs.

**Tech Stack:** React functional components, useState/useMemo/useRef, Create React App, Jest (built-in)

---

## File Map

| File | What changes |
|------|-------------|
| `src/models/index.js` | Add `PSEUDONYM_PALETTE`, `generatePseudonymSet()`, `buildIdentityRegistry()` |
| `src/__tests__/identityRegistry.test.js` | New — unit tests for pure functions above |
| `src/components/IEPImport.jsx` | Add `onIdentityLoad` prop; replace `doBundleImport()`; update `downloadPrivateRosterFromBundle()` |
| `src/App.jsx` | Replace `privateRoster` → `identityRegistry`; replace `handlePrivateRosterLoad` → `handleIdentityLoad`; update RosterPanel + IEPImport props |
| `src/components/windows.jsx` | Update `validatePrivateRoster()`; replace `extractRosterEntries` → `extractIdentityEntries()`; full RosterPanel rewrite |

---

## Task 1 — Pseudonym generation helper (models/index.js)

**Files:**
- Modify: `src/models/index.js`
- Create: `src/__tests__/identityRegistry.test.js`

- [ ] **Step 1: Create the test file**

```js
// src/__tests__/identityRegistry.test.js
import { generatePseudonymSet, PSEUDONYM_PALETTE } from '../models';

describe('generatePseudonymSet', () => {
  test('assigns Red Student 1 to the first name', () => {
    const result = generatePseudonymSet(['Alice']);
    expect(result.get('Alice')).toEqual({ pseudonym: 'Red Student 1', color: '#ef4444' });
  });

  test('assigns different colors to sequential names', () => {
    const result = generatePseudonymSet(['Alice', 'Bob', 'Carol']);
    expect(result.get('Alice').color).toBe('#ef4444');  // Red
    expect(result.get('Bob').color).toBe('#f97316');    // Orange
    expect(result.get('Carol').color).toBe('#eab308');  // Yellow
  });

  test('cycles palette after 12 names and increments counter', () => {
    const names = Array.from({ length: 13 }, (_, i) => `Person ${i + 1}`);
    const result = generatePseudonymSet(names);
    expect(result.get('Person 1').pseudonym).toBe('Red Student 1');
    expect(result.get('Person 13').pseudonym).toBe('Red Student 2');
    expect(result.get('Person 13').color).toBe('#ef4444');
  });

  test('returns empty Map for empty input', () => {
    expect(generatePseudonymSet([]).size).toBe(0);
  });

  test('PSEUDONYM_PALETTE has exactly 12 entries', () => {
    expect(PSEUDONYM_PALETTE).toHaveLength(12);
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
cd "/home/dre/Documents/code mach/JPDs-gZD"
npx react-scripts test --watchAll=false --testPathPattern="identityRegistry" 2>&1 | tail -15
```

Expected: FAIL — `generatePseudonymSet is not a function`

- [ ] **Step 3: Add PSEUDONYM_PALETTE and generatePseudonymSet to models/index.js**

Insert at the very top of `src/models/index.js`, before the `_logCounter` line:

```js
// ── Pseudonym palette — 12 named colors for identity generation ──────────
export const PSEUDONYM_PALETTE = [
  { hex: "#ef4444", name: "Red" },
  { hex: "#f97316", name: "Orange" },
  { hex: "#eab308", name: "Yellow" },
  { hex: "#22c55e", name: "Green" },
  { hex: "#06b6d4", name: "Cyan" },
  { hex: "#3b82f6", name: "Blue" },
  { hex: "#8b5cf6", name: "Violet" },
  { hex: "#ec4899", name: "Pink" },
  { hex: "#f43f5e", name: "Rose" },
  { hex: "#14b8a6", name: "Teal" },
  { hex: "#a855f7", name: "Purple" },
  { hex: "#84cc16", name: "Lime" },
];

// Input: string[] of unique real names in desired assignment order
// Output: Map<realName, { pseudonym: string, color: string }>
// Cycles through palette; increments counter per color on wrap-around.
export function generatePseudonymSet(uniqueNames) {
  const colorCounts = {};
  const result = new Map();
  uniqueNames.forEach((realName, i) => {
    const { hex, name } = PSEUDONYM_PALETTE[i % PSEUDONYM_PALETTE.length];
    colorCounts[name] = (colorCounts[name] || 0) + 1;
    result.set(realName, { pseudonym: `${name} Student ${colorCounts[name]}`, color: hex });
  });
  return result;
}
```

- [ ] **Step 4: Run to verify all 5 tests pass**

```bash
cd "/home/dre/Documents/code mach/JPDs-gZD"
npx react-scripts test --watchAll=false --testPathPattern="identityRegistry" 2>&1 | tail -15
```

Expected: `Tests: 5 passed, 5 total`

- [ ] **Step 5: Commit**

```bash
cd "/home/dre/Documents/code mach/JPDs-gZD"
git add src/models/index.js src/__tests__/identityRegistry.test.js
git commit -m "feat: add PSEUDONYM_PALETTE and generatePseudonymSet to models"
```

---

## Task 2 — buildIdentityRegistry (models/index.js)

**Files:**
- Modify: `src/models/index.js`
- Modify: `src/__tests__/identityRegistry.test.js`

- [ ] **Step 1: Add tests for buildIdentityRegistry**

First, update the import line at the top of `src/__tests__/identityRegistry.test.js` to add `buildIdentityRegistry`:

```js
import { generatePseudonymSet, PSEUDONYM_PALETTE, buildIdentityRegistry } from '../models';
```

Then append the following describe block after the existing one (do not add a second import line):

```js

const BASE_STU = { eligibility: "SLD", caseManager: "Smith", gradeLevel: "7",
  goalArea: "", strategies: [], tags: [], flags: {}, crossPeriodInfo: {},
  sourceMeta: { importType: "bundle_import", schemaVersion: "2.0" },
  behaviorNotes: [], strengths: [], healthNotes: [], triggers: [],
  watchFors: [], doThisActions: [] };

const mockBundle = {
  privateRosterMap: {
    schemaVersion: "2.0",
    privateRosterMap: [
      { studentId: "imp_p1_001", realName: "Alice Smith", pseudonym: "old-p1",  periodId: "p1", classLabel: "Period 1 — LA 7" },
      { studentId: "imp_p3_001", realName: "Alice Smith", pseudonym: "old-p3",  periodId: "p3", classLabel: "Period 3 — Math" },
      { studentId: "imp_p1_002", realName: "Bob Jones",   pseudonym: "old-p1b", periodId: "p1", classLabel: "Period 1 — LA 7" },
    ]
  },
  normalizedStudents: {
    students: [
      { ...BASE_STU, id: "imp_p1_001", pseudonym: "old-p1",  color: "#aaa", periodId: "p1", classLabel: "Period 1 — LA 7", goals: [{ id: "g1", text: "Reading" }], accs: ["Extended time"] },
      { ...BASE_STU, id: "imp_p3_001", pseudonym: "old-p3",  color: "#bbb", periodId: "p3", classLabel: "Period 3 — Math",  goals: [{ id: "g2", text: "Math" }],    accs: ["Calculator"] },
      { ...BASE_STU, id: "imp_p1_002", pseudonym: "old-p1b", color: "#ccc", periodId: "p1", classLabel: "Period 1 — LA 7", goals: [], accs: [] },
    ]
  }
};

describe('buildIdentityRegistry', () => {
  test('produces one importStudents entry per unique real person', () => {
    const { importStudents } = buildIdentityRegistry(mockBundle);
    expect(Object.keys(importStudents)).toHaveLength(2); // Alice + Bob, not 3
  });

  test('cross-period student appears in both periodIds in registry', () => {
    const { registry } = buildIdentityRegistry(mockBundle);
    const alice = registry.find(e => e.realName === 'Alice Smith');
    expect(alice.periodIds).toContain('p1');
    expect(alice.periodIds).toContain('p3');
  });

  test('cross-period student maps to same studentId in both period arrays', () => {
    const { periodMap, registry, importStudents } = buildIdentityRegistry(mockBundle);
    const alice = registry.find(e => e.realName === 'Alice Smith');
    const aliceId = Object.values(importStudents).find(s => s.pseudonym === alice.pseudonym)?.id;
    expect(periodMap['p1']).toContain(aliceId);
    expect(periodMap['p3']).toContain(aliceId);
  });

  test('merges goals from all appearances (deduplicates by text)', () => {
    const { importStudents, registry } = buildIdentityRegistry(mockBundle);
    const alice = registry.find(e => e.realName === 'Alice Smith');
    const stu = Object.values(importStudents).find(s => s.pseudonym === alice.pseudonym);
    const texts = stu.goals.map(g => typeof g === 'string' ? g : g.text);
    expect(texts).toContain('Reading');
    expect(texts).toContain('Math');
  });

  test('merges accs from all appearances', () => {
    const { importStudents, registry } = buildIdentityRegistry(mockBundle);
    const alice = registry.find(e => e.realName === 'Alice Smith');
    const stu = Object.values(importStudents).find(s => s.pseudonym === alice.pseudonym);
    expect(stu.accs).toContain('Extended time');
    expect(stu.accs).toContain('Calculator');
  });

  test('importStudents entries have no realName field', () => {
    const { importStudents } = buildIdentityRegistry(mockBundle);
    Object.values(importStudents).forEach(s => {
      expect(s.realName).toBeUndefined();
    });
  });

  test('returns empty registry when privateRosterMap is absent', () => {
    const { registry } = buildIdentityRegistry({ normalizedStudents: { students: [] } });
    expect(registry).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
cd "/home/dre/Documents/code mach/JPDs-gZD"
npx react-scripts test --watchAll=false --testPathPattern="identityRegistry" 2>&1 | tail -15
```

Expected: FAIL — `buildIdentityRegistry is not a function`

- [ ] **Step 3: Add buildIdentityRegistry to models/index.js**

Insert after `generatePseudonymSet`, before `getHealth`:

```js
// ── Identity Registry Builder ─────────────────────────────────
// Reads a combined bundle JSON, groups all privateRosterMap entries by realName,
// assigns one pseudonym+color per unique person, merges IEP data across periods.
//
// Returns:
//   registry:       [{ realName, pseudonym, color, periodIds[], classLabels{} }]
//   importStudents: { [id]: student }  — no realName field, safe for app state
//   periodMap:      { [periodId]: id[] }
export function buildIdentityRegistry(bundleData) {
  const prEntries    = bundleData?.privateRosterMap?.privateRosterMap || [];
  const rawStudents  = bundleData?.normalizedStudents?.students        || [];
  const registry     = [];
  const importStudents = {};
  const periodMap    = {};

  if (!prEntries.length) return { registry, importStudents, periodMap };

  // Build studentId → raw student lookup for IEP fields
  const rawById = {};
  rawStudents.forEach(s => { if (s.id) rawById[s.id] = s; });

  // Group privateRosterMap entries by realName to find unique people
  const byRealName = new Map();
  prEntries.forEach(entry => {
    const name = (entry.realName || "").trim();
    if (!name) return;
    if (!byRealName.has(name)) byRealName.set(name, []);
    byRealName.get(name).push(entry);
  });

  // One pseudonym+color per unique person
  const pseudonymMap = generatePseudonymSet([...byRealName.keys()]);

  let idCounter = 1;
  const coveredRawIds = new Set();

  byRealName.forEach((appearances, realName) => {
    const { pseudonym, color } = pseudonymMap.get(realName);
    const periodIds  = [...new Set(appearances.map(a => a.periodId).filter(Boolean))];
    const classLabels = {};
    appearances.forEach(a => { if (a.periodId) classLabels[a.periodId] = a.classLabel || ""; });

    const raws = appearances.map(a => rawById[a.studentId]).filter(Boolean);
    raws.forEach(r => coveredRawIds.add(r.id));

    // Merge goals — deduplicate by text
    const seenGoalTexts = new Set();
    const mergedGoals = [];
    raws.forEach(r => {
      (r.goals || []).forEach(g => {
        const text = typeof g === "string" ? g : (g.text || "");
        if (text && !seenGoalTexts.has(text)) { seenGoalTexts.add(text); mergedGoals.push(g); }
      });
    });

    // Merge accs — union
    const mergedAccs = [...new Set(raws.flatMap(r => r.accs || r.accommodations || []))];

    const primaryRaw    = raws[0] || {};
    const primaryEntry  = appearances[0];
    const studentId     = `stu_gen_${String(idCounter++).padStart(3, "0")}`;

    const profile = normalizeImportedStudent({
      ...primaryRaw,
      id:         studentId,
      pseudonym,
      color,
      goals:      mergedGoals.length ? mergedGoals : (primaryRaw.goals || []),
      accs:       mergedAccs.length  ? mergedAccs  : (primaryRaw.accs  || []),
      periodId:   primaryEntry?.periodId   || "",
      classLabel: primaryEntry?.classLabel || "",
    });

    importStudents[studentId] = profile;
    periodIds.forEach(pid => {
      if (!periodMap[pid]) periodMap[pid] = [];
      periodMap[pid].push(studentId);
    });
    registry.push({ realName, pseudonym, color, periodIds, classLabels });
  });

  // Include any normalizedStudents not in privateRosterMap (safe fallback)
  rawStudents.forEach(s => {
    if (coveredRawIds.has(s.id) || !s.id) return;
    const profile = normalizeImportedStudent(s);
    importStudents[profile.id] = profile;
    if (s.periodId) {
      if (!periodMap[s.periodId]) periodMap[s.periodId] = [];
      periodMap[s.periodId].push(profile.id);
    }
  });

  return { registry, importStudents, periodMap };
}
```

- [ ] **Step 4: Run to verify all tests pass**

```bash
cd "/home/dre/Documents/code mach/JPDs-gZD"
npx react-scripts test --watchAll=false --testPathPattern="identityRegistry" 2>&1 | tail -15
```

Expected: `Tests: 12 passed, 12 total`

- [ ] **Step 5: Commit**

```bash
cd "/home/dre/Documents/code mach/JPDs-gZD"
git add src/models/index.js src/__tests__/identityRegistry.test.js
git commit -m "feat: add buildIdentityRegistry with cross-period deduplication and goal merge"
```

---

## Task 3 — Overhaul IEPImport.jsx pipeline

**Files:**
- Modify: `src/components/IEPImport.jsx`

- [ ] **Step 1: Update the models import line**

Find line 9:
```js
import { normalizeImportedStudent } from '../models';
```
Replace with:
```js
import { normalizeImportedStudent, buildIdentityRegistry } from '../models';
```

- [ ] **Step 2: Add onIdentityLoad to the IEPImport function signature**

Find line 65:
```js
export function IEPImport({ onImport, onBulkImport, importedCount }) {
```
Replace with:
```js
export function IEPImport({ onImport, onBulkImport, onIdentityLoad, importedCount }) {
```

- [ ] **Step 3: Replace doBundleImport (lines 90–136)**

Find the entire `doBundleImport` function from `const doBundleImport = () => {` through its closing `};` and replace with:

```js
const doBundleImport = () => {
  if (!bundleData || !onBulkImport) return;

  if (bundleData.privateRosterMap?.privateRosterMap?.length > 0) {
    // Combined JSON with real names — build identity registry
    const { registry, importStudents, periodMap } = buildIdentityRegistry(bundleData);
    onBulkImport(Object.values(importStudents), periodMap);
    if (registry.length > 0) onIdentityLoad?.(registry);
    setBundleImported(true);
    setTimeout(() => { setBundleImported(false); setBundleData(null); }, 3500);
    if (registry.length > 0) {
      setPendingRosterData(registry);
      setShowRosterSaveModal(true);
    } else {
      setShowMissingNamesModal(true);
    }
  } else {
    // Plain bundle without privateRosterMap — import with bundle pseudonyms, no real names
    const rawStudents = bundleData.normalizedStudents.students;
    const normalized  = rawStudents.map(s => normalizeImportedStudent(s));
    const periodMapUpdates = {};
    normalized.forEach(s => {
      if (!s.periodId) return;
      if (!periodMapUpdates[s.periodId]) periodMapUpdates[s.periodId] = [];
      periodMapUpdates[s.periodId].push(s.id);
    });
    onBulkImport(normalized, periodMapUpdates);
    setBundleImported(true);
    setTimeout(() => { setBundleImported(false); setBundleData(null); }, 3500);
    setShowMissingNamesModal(true);
  }
};
```

- [ ] **Step 4: Update downloadPrivateRosterFromBundle to emit schemaVersion 2.0**

Find lines 170–187 (`const downloadPrivateRosterFromBundle`). Replace with:

```js
const downloadPrivateRosterFromBundle = () => {
  const dateStr = new Date().toISOString().slice(0, 10);
  const json = {
    type: "privateRoster",
    schemaVersion: "2.0",
    createdAt: new Date().toISOString(),
    students: pendingRosterData, // [{ realName, pseudonym, color, periodIds, classLabels }]
  };
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(json, null, 2)], { type: "application/json" })
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `private-roster-${dateStr}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  setShowRosterSaveModal(false);
};
```

- [ ] **Step 5: Update the save modal description text**

In the `{showRosterSaveModal && ( ... )}` modal JSX, find the `<div>` containing the description paragraph (the one that currently describes "save the colors and student slots"). Replace that inner `<div>` with:

```jsx
<div style={{ fontSize: "13px", color: "#94a3b8", lineHeight: "1.75", marginBottom: "22px" }}>
  Identities generated for{" "}
  <strong style={{ color: "#e2e8f0" }}>
    {pendingRosterData.length} student{pendingRosterData.length !== 1 ? "s" : ""}
  </strong>
  {" "}— each real name now has one pseudonym and color across all their classes.
  Save this file to your computer.
  <br /><br />
  Re-upload it via the <strong style={{ color: "#e2e8f0" }}>👤 Private Roster</strong> sidebar button
  in any future session to restore name recognition.
  <br /><br />
  <span style={{ color: "#fbbf24" }}>
    ⚠ This file contains real names. Store it securely and never share it.
  </span>
</div>
```

- [ ] **Step 6: Build to verify**

```bash
cd "/home/dre/Documents/code mach/JPDs-gZD"
npm run build 2>&1 | tail -10
```

Expected: `Compiled successfully.`

- [ ] **Step 7: Commit**

```bash
cd "/home/dre/Documents/code mach/JPDs-gZD"
git add src/components/IEPImport.jsx
git commit -m "feat: overhaul IEPImport doBundleImport to use buildIdentityRegistry"
```

---

## Task 4 — Update App.jsx state, handlers, and props

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Replace privateRoster state declaration (line 102)**

Find:
```js
  const [privateRoster, setPrivateRoster] = useState({}); // { [studentId]: realName }
```
Replace with:
```js
  // identityRegistry — local only, FERPA-sensitive, never persisted
  // Shape: [{ realName, pseudonym, color, periodIds: string[], classLabels: {} }]
  const [identityRegistry, setIdentityRegistry] = useState([]);
```

- [ ] **Step 2: Replace handlePrivateRosterLoad with handleIdentityLoad (lines 104–121)**

Find the entire `handlePrivateRosterLoad` function (from the comment `// System 2:` through its closing `};`). Replace with:

```js
  // handleIdentityLoad — accepts v2.0 registry entries or v1.0 backward-compat shape.
  // v2.0: [{ realName, pseudonym, color, periodIds, classLabels }]
  // v1.0: [{ displayLabel, realName, color }] — promoted to minimal v2.0 shape
  const handleIdentityLoad = (entries) => {
    const normalized = (entries || [])
      .filter(e => e.realName && (e.pseudonym || e.displayLabel))
      .map(e => ({
        realName:    e.realName,
        pseudonym:   e.pseudonym   || e.displayLabel,
        color:       e.color       || "",
        periodIds:   e.periodIds   || [],
        classLabels: e.classLabels || {},
      }));
    if (normalized.length > 0) setIdentityRegistry(normalized);
  };
```

- [ ] **Step 3: Update RosterPanel props (lines 533–541)**

Find:
```jsx
      {rosterPanelOpen && (
        <RosterPanel
          onClose={() => setRosterPanelOpen(false)}
          allStudents={allStudents}
          privateRoster={privateRoster}
          onNameChange={(id, val) => setPrivateRoster(prev => ({ ...prev, [id]: val }))}
          onRosterLoad={handlePrivateRosterLoad}
          onClearRoster={() => setPrivateRoster({})}
        />
      )}
```
Replace with:
```jsx
      {rosterPanelOpen && (
        <RosterPanel
          onClose={() => setRosterPanelOpen(false)}
          allStudents={allStudents}
          identityRegistry={identityRegistry}
          activePeriod={activePeriod}
          onIdentityLoad={handleIdentityLoad}
          onClearRoster={() => setIdentityRegistry([])}
        />
      )}
```

- [ ] **Step 4: Add onIdentityLoad to the IEPImport render (line 608)**

Find:
```jsx
              {view === "import" && <IEPImport onImport={handleImport} onBulkImport={handleBundleImport} importedCount={Object.keys(importedStudents).length} />}
```
Replace with:
```jsx
              {view === "import" && <IEPImport onImport={handleImport} onBulkImport={handleBundleImport} onIdentityLoad={handleIdentityLoad} importedCount={Object.keys(importedStudents).length} />}
```

- [ ] **Step 5: Build to verify**

```bash
cd "/home/dre/Documents/code mach/JPDs-gZD"
npm run build 2>&1 | tail -10
```

Expected: `Compiled successfully.`

- [ ] **Step 6: Commit**

```bash
cd "/home/dre/Documents/code mach/JPDs-gZD"
git add src/App.jsx
git commit -m "feat: replace privateRoster with identityRegistry in App.jsx"
```

---

## Task 5 — Overhaul windows.jsx: validators, extractor, RosterPanel

**Files:**
- Modify: `src/components/windows.jsx`

- [ ] **Step 1: Add useMemo to the React import**

Find line 4:
```js
import React, { useState, useEffect, useRef, useCallback } from "react";
```
Replace with:
```js
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
```

- [ ] **Step 2: Replace validatePrivateRoster (lines 13–45)**

Find the entire `validatePrivateRoster` function and replace it:

```js
function validatePrivateRoster(json) {
  if (!json || typeof json !== "object" || Array.isArray(json))
    return "Not a valid JSON object.";

  // Combined export format (has privateRosterMap key)
  if (json.privateRosterMap) {
    const inner = json.privateRosterMap;
    if (!inner || typeof inner !== "object" || Array.isArray(inner))
      return 'Malformed file: "privateRosterMap" must be an object.';
    if (!Array.isArray(inner.privateRosterMap))
      return 'Malformed file: expected "privateRosterMap.privateRosterMap" to be an array.';
    if (!inner.privateRosterMap.some(e => e && e.realName && String(e.realName).trim()))
      return "No real student names found in this file.";
    return null;
  }

  // Pure app bundle (no private roster data)
  if (json.normalizedStudents)
    return "This looks like an App Bundle file — upload it in IEP Import → App Bundle JSON tab, not here.";

  // Official privateRoster artifact (schemaVersion 1.0 or 2.0)
  if (json.type !== "privateRoster")
    return json.type
      ? `Wrong file type: "${json.type}". Expected a Private Roster file.`
      : 'Missing type field. Expected { "type": "privateRoster", ... }';
  if (!Array.isArray(json.students))
    return 'Missing "students" array in file.';
  if (!json.students.some(e => e && e.realName && String(e.realName).trim()))
    return "No real student names found in this file.";
  return null;
}
```

- [ ] **Step 3: Replace extractRosterEntries with extractIdentityEntries (lines 50–65)**

Find the entire `extractRosterEntries` function and replace it:

```js
// Normalizes any supported format into [{ realName, pseudonym, color, periodIds, classLabels }]
// so handleIdentityLoad in App.jsx always receives the same v2.0 shape.
function extractIdentityEntries(json, allStudents = {}) {
  // Combined export — group by realName to build v2.0 entries
  if (json.privateRosterMap) {
    const colorByPseudonym = {};
    Object.values(allStudents).forEach(s => {
      if (s.pseudonym) colorByPseudonym[s.pseudonym] = s.color || "";
    });
    const byRealName = new Map();
    json.privateRosterMap.privateRosterMap.forEach(e => {
      if (!e.realName) return;
      const key = e.realName.trim();
      if (!byRealName.has(key)) {
        byRealName.set(key, {
          realName: key, pseudonym: e.pseudonym || "",
          color: colorByPseudonym[e.pseudonym] || "",
          periodIds: [], classLabels: {},
        });
      }
      const rec = byRealName.get(key);
      if (e.periodId && !rec.periodIds.includes(e.periodId)) {
        rec.periodIds.push(e.periodId);
        rec.classLabels[e.periodId] = e.classLabel || "";
      }
    });
    return [...byRealName.values()];
  }

  // v2.0 official artifact — already the right shape
  if (json.students?.[0]?.periodIds !== undefined)
    return json.students.filter(e => e && e.realName);

  // v1.0 official artifact [{ displayLabel, realName, color }] — promote to v2.0 shape
  return (json.students || [])
    .filter(e => e && e.realName)
    .map(e => ({ realName: e.realName, pseudonym: e.displayLabel || "", color: e.color || "", periodIds: [], classLabels: {} }));
}
```

- [ ] **Step 4: Replace the entire RosterPanel component (lines 193–354)**

Find from `// ── Private Roster Panel` through the closing `}` of the RosterPanel function. Replace the entire component:

```jsx
// ── Private Roster Panel ─────────────────────────────────────
// Local-only real name reference. Never stored, logged, exported, or sent to AI.
export function RosterPanel({ onClose, allStudents = {}, identityRegistry = [], activePeriod, onIdentityLoad, onClearRoster }) {
  const [rosterMode,  setRosterMode]  = useState("current"); // "current" | "whole"
  const [showImport,  setShowImport]  = useState(false);
  const [importText,  setImportText]  = useState("");
  const [rosterError, setRosterError] = useState("");
  const fileInputRef = useRef();

  const hasNames = identityRegistry.length > 0;

  // pseudonym → realName lookup for rendering
  const nameByPseudonym = {};
  identityRegistry.forEach(e => { nameByPseudonym[e.pseudonym] = e.realName; });

  // pseudonym → all periodIds (for cross-period badge)
  const periodIdsByPseudonym = {};
  identityRegistry.forEach(e => { periodIdsByPseudonym[e.pseudonym] = e.periodIds; });

  // Period groups: { [periodId]: { classLabel, studentIds: string[] } }
  const periodGroups = useMemo(() => {
    const groups = {};

    // DB students — placed via DB.periods
    Object.entries(DB.periods).forEach(([pid, p]) => {
      groups[pid] = { classLabel: p.label, studentIds: [] };
      p.students.forEach(stuId => {
        if (allStudents[stuId]) groups[pid].studentIds.push(stuId);
      });
    });

    // Build pseudonym → student map for imported students
    const stuByPseudonym = {};
    Object.values(allStudents).forEach(s => {
      if (s.imported && s.pseudonym) stuByPseudonym[s.pseudonym] = s;
    });

    // Place identity-registry students into all their period groups
    const placedByRegistry = new Set();
    identityRegistry.forEach(entry => {
      const stu = stuByPseudonym[entry.pseudonym];
      if (!stu) return;
      placedByRegistry.add(stu.id);
      entry.periodIds.forEach(pid => {
        if (!groups[pid]) groups[pid] = { classLabel: entry.classLabels[pid] || pid, studentIds: [] };
        if (!groups[pid].studentIds.includes(stu.id)) groups[pid].studentIds.push(stu.id);
      });
    });

    // Place any imported students not in identityRegistry by their primary periodId
    Object.values(allStudents).forEach(s => {
      if (!s.imported || placedByRegistry.has(s.id) || !s.periodId) return;
      if (!groups[s.periodId]) groups[s.periodId] = { classLabel: s.classLabel || s.periodId, studentIds: [] };
      if (!groups[s.periodId].studentIds.includes(s.id)) groups[s.periodId].studentIds.push(s.id);
    });

    return groups;
  }, [allStudents, identityRegistry]);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setRosterError("");
    try {
      const json = JSON.parse(await file.text());
      const err = validatePrivateRoster(json);
      if (err) { setRosterError(err); return; }
      onIdentityLoad?.(extractIdentityEntries(json, allStudents));
    } catch { setRosterError("Could not read file. Make sure it is a valid Private Roster JSON."); }
    e.target.value = "";
  };

  const handleSaveRoster = () => {
    const dateStr = new Date().toISOString().slice(0, 10);
    const json = { type: "privateRoster", schemaVersion: "2.0", createdAt: new Date().toISOString(), students: identityRegistry };
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(json, null, 2)], { type: "application/json" }));
    a.download = `private-roster-${dateStr}.json`;
    a.click();
  };

  const handlePasteImport = () => {
    try {
      const data = JSON.parse(importText);
      const err = validatePrivateRoster(data);
      if (err) { alert("Invalid format: " + err); return; }
      onIdentityLoad?.(extractIdentityEntries(data, allStudents));
      setImportText(""); setShowImport(false);
    } catch { alert("Invalid JSON. Paste the contents of your saved Private Roster file."); }
  };

  const renderStudentRow = (stuId) => {
    const stu = allStudents[stuId];
    if (!stu) return null;
    const realName   = nameByPseudonym[stu.pseudonym];
    const crossPids  = periodIdsByPseudonym[stu.pseudonym] || [];
    return (
      <div key={stuId} style={{ display: "flex", alignItems: "center", gap: "7px", padding: "5px 8px", background: "#0a1628", border: "1px solid #1e3a5f", borderRadius: "6px" }}>
        <div style={{ width: "9px", height: "9px", borderRadius: "50%", background: stu.color, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "10px", color: stu.color, fontWeight: "600", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{stu.pseudonym}</div>
          {realName
            ? <div style={{ fontSize: "9px", color: "#94a3b8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{realName}</div>
            : <div style={{ fontSize: "9px", color: "#334155", fontStyle: "italic" }}>name not loaded</div>
          }
        </div>
        {crossPids.length > 1 && (
          <div style={{ fontSize: "7px", background: "#1e3a5f", color: "#60a5fa", padding: "2px 5px", borderRadius: "10px", whiteSpace: "nowrap", flexShrink: 0 }}>
            {crossPids.join("·")}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ width: "220px", flexShrink: 0, background: "#060c18", borderRight: "2px solid #1e3a5f", display: "flex", flexDirection: "column", overflow: "hidden", height: "100vh" }}>

      {/* Header */}
      <div style={{ padding: "10px 12px", background: "#0a1628", borderBottom: "1px solid #1e3a5f", flexShrink: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "3px" }}>
          <span style={{ fontSize: "12px", fontWeight: "700", color: "#e2e8f0" }}>Private Roster</span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#475569", fontSize: "20px", cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>
        <div style={{ fontSize: "9px", color: "#f59e0b" }}>⚠ Local only — never saved or sent to AI</div>
      </div>

      {/* Mode toggle */}
      <div style={{ display: "flex", margin: "8px 10px 0", background: "#0a1628", border: "1px solid #1e3a5f", borderRadius: "8px", overflow: "hidden", flexShrink: 0 }}>
        {(["current", "whole"]).map(mode => (
          <button key={mode} onClick={() => setRosterMode(mode)}
            style={{ flex: 1, padding: "6px", background: rosterMode === mode ? "#1e3a5f" : "transparent", color: rosterMode === mode ? "#93c5fd" : "#475569", fontSize: "10px", fontWeight: rosterMode === mode ? "700" : "400", border: "none", cursor: "pointer" }}>
            {mode === "current" ? "Current Class" : "Whole Roster"}
          </button>
        ))}
      </div>

      {/* Upload / status */}
      <div style={{ padding: "8px 10px 0", flexShrink: 0 }}>
        <input type="file" ref={fileInputRef} style={{ display: "none" }} accept=".json" onChange={handleFileUpload} />
        <button onClick={() => { setRosterError(""); fileInputRef.current?.click(); }}
          style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: `2px solid ${hasNames ? "#166534" : "#1e3a5f"}`, background: hasNames ? "#0d2010" : "#0a1628", color: hasNames ? "#4ade80" : "#475569", fontSize: "11px", fontWeight: "700", cursor: "pointer", display: "flex", alignItems: "center", gap: "7px", justifyContent: "center" }}>
          <span>{hasNames ? "✓" : "📂"}</span>
          <span>{hasNames ? "Private Roster Loaded" : "Load Private Roster JSON"}</span>
        </button>
        {rosterError && (
          <div style={{ fontSize: "10px", color: "#f87171", background: "#1a0505", border: "1px solid #7f1d1d", borderRadius: "6px", padding: "7px 9px", marginTop: "6px", lineHeight: "1.5" }}>
            ✗ {rosterError}
          </div>
        )}
      </div>

      {/* Student list — scrollable */}
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 10px" }}>

        {rosterMode === "current" ? (
          (() => {
            const group = periodGroups[activePeriod];
            if (!group) return (
              <div style={{ fontSize: "11px", color: "#334155", fontStyle: "italic", textAlign: "center", marginTop: "20px" }}>
                No students found for this period.
              </div>
            );
            return (
              <>
                <div style={{ padding: "4px 8px", background: "#0f2040", borderLeft: "3px solid #3b82f6", fontSize: "10px", fontWeight: "700", color: "#60a5fa", marginBottom: "8px", borderRadius: "0 4px 4px 0" }}>
                  {group.classLabel}&nbsp;·&nbsp;<span style={{ fontWeight: "400" }}>{group.studentIds.length}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                  {group.studentIds.map(renderStudentRow)}
                </div>
              </>
            );
          })()
        ) : (
          Object.entries(periodGroups)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([pid, group]) => (
              <div key={pid} style={{ marginBottom: "12px" }}>
                <div style={{ padding: "4px 8px", background: pid === activePeriod ? "#1e3a5f" : "#0f2040", borderLeft: `3px solid ${pid === activePeriod ? "#93c5fd" : "#3b82f6"}`, fontSize: "10px", fontWeight: "700", color: pid === activePeriod ? "#93c5fd" : "#60a5fa", marginBottom: "5px", borderRadius: "0 4px 4px 0", display: "flex", justifyContent: "space-between" }}>
                  <span>{pid === activePeriod ? "★ " : ""}{group.classLabel}</span>
                  <span style={{ fontWeight: "400", opacity: 0.7 }}>{group.studentIds.length}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  {group.studentIds.map(renderStudentRow)}
                </div>
              </div>
            ))
        )}

      </div>

      {/* Footer */}
      <div style={{ padding: "8px 10px", borderTop: "1px solid #1e3a5f", flexShrink: 0, display: "flex", flexDirection: "column", gap: "5px" }}>
        {hasNames && (
          <button onClick={handleSaveRoster}
            style={{ width: "100%", padding: "7px", borderRadius: "6px", border: "1px solid #166534", background: "#0d2010", color: "#4ade80", fontSize: "11px", fontWeight: "700", cursor: "pointer" }}>
            ↓ Save Private Roster
          </button>
        )}
        <button onClick={() => setShowImport(!showImport)}
          style={{ width: "100%", padding: "6px", borderRadius: "6px", border: "1px solid #1e3a5f", background: "transparent", color: "#475569", fontSize: "10px", cursor: "pointer" }}>
          {showImport ? "Cancel" : "Import JSON"}
        </button>
        {showImport && (
          <>
            <textarea value={importText} onChange={e => setImportText(e.target.value)}
              placeholder="Paste saved Private Roster JSON here..."
              style={{ width: "100%", minHeight: "70px", padding: "7px", background: "#0a1628", border: "1px solid #1e3a5f", borderRadius: "6px", color: "#e2e8f0", fontSize: "10px", resize: "none", fontFamily: "monospace", boxSizing: "border-box" }} />
            <button onClick={handlePasteImport}
              style={{ width: "100%", padding: "6px", borderRadius: "6px", border: "1px solid #166534", background: "#14532d", color: "#4ade80", fontSize: "10px", fontWeight: "700", cursor: "pointer" }}>
              Apply
            </button>
          </>
        )}
        {hasNames && (
          <button onClick={() => { if (window.confirm("Clear all real names?")) { onClearRoster?.(); setRosterError(""); } }}
            style={{ width: "100%", padding: "5px", borderRadius: "6px", border: "1px solid #7f1d1d", background: "#1a0505", color: "#f87171", fontSize: "9px", cursor: "pointer" }}>
            Clear Private Roster
          </button>
        )}
      </div>

    </div>
  );
}
```

- [ ] **Step 5: Build to verify**

```bash
cd "/home/dre/Documents/code mach/JPDs-gZD"
npm run build 2>&1 | tail -10
```

Expected: `Compiled successfully.`

- [ ] **Step 6: Run all tests**

```bash
cd "/home/dre/Documents/code mach/JPDs-gZD"
npx react-scripts test --watchAll=false 2>&1 | tail -15
```

Expected: All 12 tests pass.

- [ ] **Step 7: Commit**

```bash
cd "/home/dre/Documents/code mach/JPDs-gZD"
git add src/components/windows.jsx
git commit -m "feat: overhaul RosterPanel — period groups, mode toggle, identity registry display"
```

---

## Task 6 — End-to-end verification

No files modified — manual checks only.

- [ ] **Step 1: Start the dev server**

```bash
cd "/home/dre/Documents/code mach/JPDs-gZD"
npm start
```

Open http://localhost:3000.

- [ ] **Step 2: Import the combined JSON**

1. Click "IEP Import" in the sidebar
2. Go to "App Bundle JSON" tab
3. Upload `/home/dre/Downloads/para_app_test_data_v2.json`
4. Click "Import X Students into App"

Expected: "Save Private Roster JSON" modal appears with **27 students** (not 33 — the 6 cross-period duplicates are collapsed).

- [ ] **Step 3: Save the artifact**

1. Click "↓ Save Private Roster JSON"
2. Open the downloaded file
3. Confirm: `"schemaVersion": "2.0"`, `"type": "privateRoster"`, `students` array with 27 entries
4. Find a cross-period student — confirm they have `"periodIds": ["p1", "p3"]` (two periods) and ONE real name

- [ ] **Step 4: Verify Current Class mode**

1. Set Active Period to Period 1 in sidebar
2. Click "👤 Private Roster" button
3. Confirm "Current Class" is the active tab
4. Confirm Period 1 students are listed with their real names under each pseudonym
5. Confirm cross-period students show a `p1·p3` badge

- [ ] **Step 5: Verify Whole Roster mode**

1. Click "Whole Roster" tab
2. Confirm 6 period groups appear, each with correct class label
3. Confirm Period 1 is highlighted with ★
4. Find a cross-period student in Period 1's group — note their pseudonym and color
5. Scroll to Period 3's group — confirm the same student appears with the **same pseudonym and same color**

- [ ] **Step 6: Verify re-import restores names**

1. Click "Clear Private Roster" → confirm names disappear (all show "name not loaded")
2. Click "Load Private Roster JSON" → upload the file saved in Step 3
3. Confirm all names reappear immediately

- [ ] **Step 7: Confirm real names are not in app storage**

Open browser DevTools → Application → Local Storage.
Confirm no key contains real student names. The keys should only be `paraLogsV1` and `paraKBV1`.

- [ ] **Step 8: Final commit**

```bash
cd "/home/dre/Documents/code mach/JPDs-gZD"
git add -A
git commit -m "feat: complete private roster overhaul — identity registry, cross-period identity, period-grouped panel"
```
