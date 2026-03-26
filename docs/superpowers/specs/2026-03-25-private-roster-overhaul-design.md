# Private Roster Overhaul — Design Spec
**Date:** 2026-03-25
**Status:** Approved
**Scope:** Import pipeline, identity registry, RosterPanel UI redesign

---

## Problem

The current Private Roster feature is a flat `{ pseudonym → realName }` map rendered as an unsorted wall of all students. It has three concrete failures:

1. **No period organization.** All 33+ imported students appear in one unsorted list.
2. **Cross-period students have broken identity.** Alexia Uriostegui appears in Period 1 and Period 3 with *different* pseudonyms and colors — looks like two unrelated people.
3. **Manual name entry is the wrong model.** The app asks the user to type names they already have in the uploaded JSON.

---

## Goals

- One upload → app reads real names automatically from the combined JSON
- Cross-period students get **one** pseudonym + **one** color across all periods
- Roster panel organized by class/period with a two-mode view
- Real names never enter normal app state, logs, exports, or AI context
- Private roster artifact is downloadable and re-importable for future sessions

---

## Out of Scope

- No Firebase, no server calls, no API changes
- No changes to DB.students (existing hardcoded dev fixtures)
- No changes to the Vault, Analytics, Dashboard, or Ollama flows
- No changes to how logs/notes reference students (still keyed by pseudonym/studentId)

---

## Architecture: Approach A — App-generated identity registry

### How the upload works

1. User uploads the combined JSON (contains both `normalizedStudents` and `privateRosterMap`)
2. `buildIdentityRegistry()` (new function in IEPImport.jsx) runs **before** normalization:
   - Reads real names from `bundleData.privateRosterMap.privateRosterMap[]`
   - Groups entries by `realName` → identifies unique real people
   - For each unique person: assigns **one** pseudonym + **one** hex color (color-based scheme, same as existing app)
   - Merges IEP data (goals, accs, etc.) across all their period appearances
   - Returns: `identityRegistry[]`, `importStudents{}`, `periodMap{}`
3. `doBundleImport()` calls `buildIdentityRegistry()` then calls `onBulkImport()`
4. After import: auto-shows "Save Private Roster" modal with the identity registry pre-populated

### Pseudonym generation

Color palette (12 colors, cycling):
```
#ef4444 Red  |  #f97316 Orange  |  #eab308 Yellow  |  #22c55e Green
#06b6d4 Cyan  |  #3b82f6 Blue  |  #8b5cf6 Violet  |  #ec4899 Pink
#f43f5e Rose  |  #14b8a6 Teal  |  #a855f7 Purple  |  #84cc16 Lime
```

Assignment: iterate unique real students in order of first appearance. Assign next palette color. Count existing uses of that color name for the counter. Result: `"Red Student 1"`, `"Blue Student 1"`, `"Red Student 2"`, etc.

Pseudonyms are **stable within one import** (same JSON → same assignment order → same pseudonyms). Re-importing a different JSON may produce different pseudonyms. This is acceptable — the user cares about in-session identity, not cross-session pseudonym permanence.

---

## Data Shapes

### `identityRegistry` (new — session-only, never persisted)

```js
// In App.jsx: const [identityRegistry, setIdentityRegistry] = useState([]);
[
  {
    realName:    "Alexia Uriostegui",      // ONLY lives here, never in app state elsewhere
    pseudonym:   "Red Student 1",
    color:       "#ef4444",
    periodIds:   ["p1", "p3"],
    classLabels: { p1: "Period 1 — Language Arts 7", p3: "Period 3 — Math 2" }
  },
  ...
]
```

- **Never persisted** to localStorage or exported in safe bundles
- **Never sent** to Ollama or any external service
- Re-loaded from the private roster artifact file in future sessions
- Replaces the current `privateRoster = { [pseudonym]: realName }` state

### `importedStudents` (existing shape — unchanged)

```js
{
  "stu_gen_001": {
    id:          "stu_gen_001",      // app-generated stable ID
    pseudonym:   "Red Student 1",
    color:       "#ef4444",
    periodId:    "p1",               // primary period (first appearance)
    classLabel:  "Period 1 — Language Arts 7",
    goals:       [...],
    accs:        [...],
    // ... all other IEP fields — NO realName field
  }
}
```

Cross-period students have **one entry** in `importedStudents` (not two). Their `periodId` is their primary period.

### `importedPeriodMap` (existing shape — extended for cross-period)

```js
{
  "p1": ["stu_gen_001", "stu_gen_002", ...],
  "p3": ["stu_gen_001", "stu_gen_005", ...],
  // stu_gen_001 (Alexia) appears in BOTH p1 and p3
}
```

Same shape as today — cross-period students simply appear in multiple period arrays.

### Private Roster Artifact (downloadable JSON, schemaVersion 2.0)

```json
{
  "type": "privateRoster",
  "schemaVersion": "2.0",
  "createdAt": "2026-03-25T...",
  "students": [
    {
      "realName":    "Alexia Uriostegui",
      "pseudonym":   "Red Student 1",
      "color":       "#ef4444",
      "periodIds":   ["p1", "p3"],
      "classLabels": { "p1": "Period 1 — Language Arts 7", "p3": "Period 3 — Math 2" }
    }
  ]
}
```

**Re-import:** Loading this file via the 👤 sidebar button populates `identityRegistry` state — restoring name recognition without re-importing the full bundle.

---

## RosterPanel UI

### Props (updated)

```jsx
<RosterPanel
  onClose={...}
  allStudents={allStudents}           // existing
  identityRegistry={identityRegistry} // NEW — replaces privateRoster
  activePeriod={activePeriod}         // NEW
  onIdentityLoad={handleIdentityLoad} // NEW — replaces onRosterLoad
  onClearRoster={...}                 // existing
/>
```

`onNameChange` prop removed — no manual name editing.

### Mode toggle

Local state: `rosterMode = "current" | "whole"` (default: `"current"`)

Two-segment toggle at top of panel:
```
[ Current Class ]  [ Whole Roster ]
```

### Current Class mode

- Shows only students whose ID is in `importedPeriodMap[activePeriod]` (plus `DB.periods[activePeriod].students`)
- Header: period label (e.g., "Period 3 — Math 2 · 9 students")
- Each student row: `● color-dot  Pseudonym  Real Name  [p1·p3 badge if cross-period]`
- "name not loaded" italic text if student not in identityRegistry

### Whole Roster mode

- Shows all 6 periods as stacked groups
- Each group: period label header with left accent border + student count
- Active period highlighted (★ prefix, brighter header)
- Same student row format
- Cross-period students appear in each group they belong to — same pseudonym/color both times

### Cross-period badge

Small inline badge: `p1·p3` — shown whenever `identityRegistry[i].periodIds.length > 1`. Blue tint, rounded pill style.

### No manual input fields

Removed: `<input>` fields for typing real names.
Removed: "Classes" section with period label inputs.
Removed: `onNameChange` prop.
Kept: Download Template, Copy Template, Import JSON (paste) — repurposed for the new `schemaVersion: "2.0"` artifact format.

### Upload / Save buttons

- **Upload Private Roster JSON** — loads a previously saved artifact into `identityRegistry`
- **↓ Save Roster** — downloads current `identityRegistry` as the artifact file
- **Clear** — clears `identityRegistry` state (confirm prompt)

---

## Files to Change

| File | Changes |
|------|---------|
| `src/components/IEPImport.jsx` | Add `buildIdentityRegistry()`, overhaul `doBundleImport()`, update save modal |
| `src/App.jsx` | Replace `privateRoster` state with `identityRegistry`; replace `handlePrivateRosterLoad` with `handleIdentityLoad`; add `activePeriod` prop to `RosterPanel`; update `handleBundleImport` |
| `src/components/windows.jsx` | Overhaul `RosterPanel` (mode toggle, period groups, read-only display); update `validatePrivateRoster` for v2.0 artifact; update `extractRosterEntries` → `extractIdentityEntries`; add pseudonym generation helper |
| `src/models/index.js` | Add `PSEUDONYM_PALETTE` constant and `generatePseudonym()` helper |

---

## IEP Data Merging for Cross-period Students

When a student appears in multiple periods, their IEP data (goals, accommodations) may differ per class. Strategy:

- **Goals:** Concatenate from all periods, deduplicating by text
- **Accommodations (`accs`):** Union from all periods
- **All other fields** (eligibility, caseManager, gradeLevel, etc.): Use primary period (first occurrence in `privateRosterMap` array order)
- **`crossPeriodInfo`:** Set `crossPeriod: true`, `otherPeriods: [all period IDs except primary]`

---

## Validation: Private Roster Artifact (v2.0)

`validatePrivateRoster()` updated to also accept `schemaVersion: "2.0"` shape:

```js
// Accept: { type: "privateRoster", schemaVersion: "2.0", students: [{ realName, pseudonym, color, periodIds }] }
// Accept: { type: "privateRoster", schemaVersion: "1.0", students: [{ displayLabel, realName, color }] } // backward compat
// Accept: combined format (has privateRosterMap) — existing logic unchanged
// Reject: no realName fields present
```

---

## FERPA Safety Guarantees (unchanged)

- `identityRegistry` is session-only React state — cleared on page reload
- Never written to `localStorage`
- Never included in bundle exports (`exportBundle()` only reads `importedStudents`)
- Never sent to Ollama (AI context builder reads `allStudents`, which has no `realName`)
- The private roster artifact file lives on the user's computer only

---

## Migration: Existing `privateRoster` State

Old shape: `{ [pseudonym]: realName }`
New shape: `identityRegistry[]` with richer fields

Any existing session state in `privateRoster` is lost on upgrade (it was never persisted anyway — session-only). No localStorage migration needed. Users who had a saved v1.0 private roster JSON file can still re-import it — the validator accepts both `schemaVersion: "1.0"` and `"2.0"`.

---

## Verification Checklist (post-implementation)

1. Upload `para_app_test_data_v2.json` → import succeeds → "Save Private Roster" modal appears
2. Alexia Uriostegui → same pseudonym + color in Period 1 group AND Period 3 group
3. Cross-period badge `p1·p3` appears on her row in both groups
4. Save the artifact → open file → confirm `schemaVersion: "2.0"`, all 27 unique students (not 33)
5. Reload app → no names showing → re-import saved artifact → names restore
6. Current Class mode → switch active period → panel updates immediately
7. Whole Roster mode → active period highlighted → all 6 groups visible
8. No `realName` field anywhere in `importedStudents`, logs, or bundle export
9. Ollama AI context does not include any real names
