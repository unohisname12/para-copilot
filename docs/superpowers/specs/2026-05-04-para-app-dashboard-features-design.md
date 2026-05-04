# Para-App Dashboard Features — Design

**Status:** draft 2026-05-04 · **Owner:** Mr. Dre · **Skill:** superpowers:brainstorming

## Context

Mr. Dre runs the para-facing SupaPara app on a Chromebook in his classroom. Five concrete pain points have piled up against the same surface — the dashboard + vault + student profile flow — so they get one shared spec and one shared plan rather than five disconnected PRs.

The five items, in his words:
1. **Mass log button is missing on the Chromebook.** A button to log multiple students in one motion is needed and not currently present.
2. **IEP accommodations are flat text.** Para should be able to double-click an accommodation in a student profile and see what it actually means / where it came from / how it has been used.
3. **Logs decouple from roster on reload.** When the para uses "Find My Students" to reload the roster, old logs visibly stay in the vault but stop appearing in exports. The exporter only grabs the new logs against the new student records.
4. **Bulk delete logs.** Need a way to delete more than one log entry at a time. Today the only path is one-by-one through `deleteLog(id)`.
5. **Private screen while typing.** The Chromebook screen is visible to nearby students/staff. Para wants a way to type observations without real names rendered in plain sight.

This spec scopes all five as one wave of dashboard + vault + profile work. Schema and storage layers stay almost untouched — every fix lands in UI shells and existing hooks.

## Architecture

Five features, three layers, one wave:

1. **Pure-functional core** — small helpers in `src/utils/` and `src/features/dashboard/`. No React, no DOM, no async. Unit-tested in isolation. New: log re-linking by `paraAppNumber`, bulk-delete reducer, name-mask fn for privacy mode.
2. **Hooks / providers** — extend `useLogs` (bulk delete, re-link on roster reload) and add a one-screen-wide `usePrivacyMode` toggle persisted in localStorage. No new contexts; piggyback on the existing `LogsProvider` and `VaultProvider`.
3. **UI shells** — three new modals (`MassLogModal`, `AccommodationDetailModal`, `BulkDeleteBar`) and one new dashboard control (`PrivacyToggle`). All other changes are surgical edits to existing components.

The pure core is the only thing that gets unit tests in this wave. UI shells get a smoke render and a click-path integration test; nothing fancier.

## File-by-file breakdown

| File | New/Mod | Purpose |
|---|---|---|
| `src/components/panels/MassLogModal.jsx` | New | Multi-select student list + single action picker (Type / Category / Note). Confirm → loops `addLog` over selected students. Mounts from a new dashboard button. |
| `src/features/dashboard/Dashboard.jsx` | Modify | Add "Mass log" button next to existing "Quick log" panel. Wire to `MassLogModal`. Place near `QuickActionPanel` so para never has to scroll for either. |
| `src/components/modals/AccommodationDetailModal.jsx` | New | Read-only detail view for one accommodation: full text, source (which IEP import + date), strategies tagged with this accommodation, past logs that referenced it. |
| `src/components/modals/StudentProfileModal.jsx` | Modify | Wrap accommodation rows under `tab === "accs"` with a `onDoubleClick` handler that opens `AccommodationDetailModal`. Keyboard-equivalent: Enter on a focused row. |
| `src/hooks/useLogs.js` | Modify | (a) Add `bulkDeleteLogs(ids)` and `restoreLogs(logs)` for undo. (b) Add roster-reload reconcile: when `allStudents` changes, any orphan log with a `paraAppNumber` that now resolves to a new `studentId` gets its `studentId` rewritten in place. (c) Keep existing one-shot `paraAppNumber` backfill effect. |
| `src/components/vault/BulkDeleteBar.jsx` | New | Sticky toolbar that appears in the vault when `selectedLogIds.size > 0`. Shows count + Delete + Cancel. Confirms once for the whole batch. |
| `src/App.jsx` | Modify | Add `selectedLogIds` state to vault. Add row checkbox column in the vault table. Wire `BulkDeleteBar` actions. Toast with Undo on success (calls `restoreLogs`). |
| `src/utils/privacyMask.js` | New | `maskName(name) → string` — returns first-initial + last-initial (e.g. "Maria Lopez" → "M.L."). Pure. Unit-tested. |
| `src/hooks/usePrivacyMode.js` | New | Tiny hook: `[on, setOn]` backed by `localStorage['paraPrivacyModeV1']`. Default off. |
| `src/components/PrivacyToggle.jsx` | New | Small icon-button rendered in dashboard header. Tap toggles privacy mode. Tooltip: "Privacy screen — masks names while typing." |
| Wherever student names render in the dashboard / log composer: `QuickActionPanel.jsx`, `MassLogModal.jsx`, `Dashboard.jsx` student chips, log-composer student picker | Modify | When `usePrivacyMode().on === true`, swap rendered name through `maskName()`. Vault and exports are untouched — privacy mode is a *typing-time* shield, not a vault rewrite. |
| `src/__tests__/bulkDelete.test.js` | New | Unit tests for `bulkDeleteLogs` / `restoreLogs` / orphan re-link. |
| `src/__tests__/privacyMask.test.js` | New | Unit tests for `maskName` (single name, two-part, three-part, empty, non-Latin). |

## Data flow

### F1 — Mass log

```
Dashboard → "Mass log" button
    ↓
MassLogModal opens
    ↓
Step 1 — pick students (chips, "Select all in period", "Clear")
Step 2 — pick Type + Category + (optional) note + tags
Step 3 — Confirm
    ↓
For each selected studentId:
    addLog(studentId, note, type, { category, tags, source: 'mass_log' })
    ↓
Toast: "Logged for N students. Undo."
```

`addLog` is the existing single-student path. No new write path, no new schema. Each log gets `source: "mass_log"` so future analytics can tell mass-logged from quick-logged.

### F2 — Accommodation detail

```
StudentProfileModal "Accommodations" tab
    ↓ (double-click row OR Enter on focused row)
AccommodationDetailModal opens with:
    - full accommodation text
    - source: which IEP import file + date (from import metadata)
    - linked strategies: filter strategies where strategy.accommodations includes this text
    - past logs: filter logs where (l.studentId === student.id) AND
                 ((l.tags || []).includes(accommodationTag) OR l.note contains accommodation snippet)
    ↓ (Esc or X to close)
```

Read-only first pass. No editing, no notes. If signal demands richer detail later, extend the modal.

### F3 — Log glue across roster reload

The visible bug is "old logs don't export after Find My Students." Root cause is studentId drift: a roster reload mints new student records with new `id`s, but old logs still point at old `id`s. The vault renders them anyway (because the table walks `logs` directly and falls back to `studentId` text), but vault filters and the workbook exporter both pivot on `studentId === current student` and miss orphans.

```
On roster reload (FindMyStudentsModal.onIdentityLoad fires →
  setStudents(...) → useStudents resolves new studentIds):
    ↓
useLogs effect fires (allStudents dep already wired today):
    For each log l with l.paraAppNumber:
      newStudent = Object.values(allStudents).find(s => s.paraAppNumber === l.paraAppNumber)
      if newStudent && newStudent.id !== l.studentId:
        l.studentId = newStudent.id   // re-link in place
    ↓
setLogs(prev → re-linked array)   // localStorage rewritten
    ↓
Vault filter, byStudent filter, exportWorkbook studentId filter — all see fresh ids.
Export now grabs old + new logs as one set.
```

This is idempotent: a log already pointing at the right `studentId` is left alone. Logs without a `paraAppNumber` (truly legacy entries from before the bridge) stay orphaned and still render under their stored `studentId`; this spec does not invent paraAppNumbers for them.

The re-link fix benefits **every export and filter** that pivots on `studentId` — CSV, workbook, vault byStudent, byPeriod. The user-reported symptom resolves the moment the studentIds line up.

Workbook scope is intentionally **left alone** for this wave: `exportWorkbook` stays "today's snapshot" (it filters `l.date === currentDate` by design at `exportWorkbook.js:37`). If Dre wants a "full history workbook" later, that's a separate, small add.

### F4 — Bulk delete

```
Vault table → row checkbox column appears
    ↓
User ticks N logs
    ↓
BulkDeleteBar slides in: "N selected · Delete · Cancel"
    ↓ (Delete)
window.confirm("Delete N log entries? This cannot be undone from this device.")
    ↓ (yes)
bulkDeleteLogs(ids):
    snapshot = logs.filter(l => ids.has(l.id))   // for Undo
    setLogs(prev => prev.filter(l => !ids.has(l.id)))
    ↓
Toast: "Deleted N logs. Undo."
    ↓ (Undo within ~10s)
restoreLogs(snapshot)   // setLogs(prev => [...snapshot, ...prev])
```

Cloud parity: `onLogCreated` already exists for additions; the cloud-side delete handler should mirror it. If a `onLogDeleted(id)` hook is already wired, `bulkDeleteLogs` calls it per id. If not, this spec adds the call site but defers cloud wiring to whatever owns the cloud sync; flagged in the implementation plan as a check-in point.

### F5 — Privacy screen

```
Dashboard header → PrivacyToggle (eye / eye-off icon)
    ↓ (tap)
usePrivacyMode → setOn(!on)   // localStorage persists
    ↓
QuickActionPanel chips, MassLogModal student rows, log-composer "for: <Name>"
  read usePrivacyMode().on:
    on  → render maskName(student.pseudonym || real)
    off → render student.pseudonym
```

`maskName` returns first-initial + last-initial dotted (e.g. "Maria Lopez" → "M.L."). Single-token names render as `M.`. Empty inputs render as `—`.

The vault and exports are deliberately untouched. Privacy mode is a typing-time shield against a passing glance over the para's shoulder, not a vault encryption layer. The vault is a longer, more deliberate flow; if Dre wants vault privacy too, that's a later, separately considered add.

## Testing strategy

- Pure helpers (`maskName`, `bulkDeleteLogs` reducer logic, log re-link) get unit tests.
- Modals get one render-and-click smoke test each (existing harness).
- Manual QA checklist (because this is UX-shaped):
  - Mass-log 3 students → 3 logs land with `source: "mass_log"`.
  - Double-click an accommodation → modal opens with text, source, linked logs.
  - Add a log → "Find My Students" with a new roster CSV → export CSV; confirm old log appears with the new student name.
  - Tick 3 logs in vault → bulk delete → confirm → Undo → confirm restored.
  - Toggle privacy → student names mask in the dashboard, vault unchanged, export unchanged.
  - All five flows pass on Chromebook (the actual device).

## Out of scope

- Server-side log audit trail.
- Workbook (.xlsx) "all-history" export — stays today-only this wave.
- Vault privacy masking (only typing-side surfaces).
- Cloud delete plumbing if not already wired (flagged in plan).
- Editing accommodations from the detail modal.

## Open in plan, not in spec

Implementation order, file-by-file diff sketches, and merge sequence land in the implementation plan written by the `writing-plans` skill in the next step.
