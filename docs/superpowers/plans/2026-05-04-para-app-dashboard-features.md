# Para-App Dashboard Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship five connected para-app fixes — mass log button, IEP accommodation drill-down, log glue across roster reload, bulk-delete logs, and a privacy screen for typing — in one wave on the existing dashboard + vault + profile surface.

**Architecture:** Three layers — pure helpers (mask, re-link reducer, bulk reducers), hooks/providers (extend `useLogs`, new `usePrivacyMode`), UI shells (three modals, one bar, one toggle). No schema changes; all writes go through existing `addLog` / `setLogs` paths.

**Tech Stack:** React 18, react-scripts test (Jest + jsdom), localStorage-backed hooks, Supabase for cloud parity (already wired via `onLogCreated`).

**Spec:** `docs/superpowers/specs/2026-05-04-para-app-dashboard-features-design.md`

**Test command:** `npx jest <path> --watchAll=false` (or `npm test -- --watchAll=false <path>`)

---

## File Structure

| File | New/Mod | Owns |
|---|---|---|
| `src/utils/privacyMask.js` | New | `maskName(name) → "F.L."` pure helper |
| `src/__tests__/privacyMask.test.js` | New | unit tests for mask |
| `src/hooks/usePrivacyMode.js` | New | toggle hook backed by `paraPrivacyModeV1` |
| `src/components/PrivacyToggle.jsx` | New | header icon-button |
| `src/utils/relinkLogs.js` | New | pure `relinkLogsByParaAppNumber(logs, allStudents)` reducer |
| `src/__tests__/relinkLogs.test.js` | New | unit tests for re-link |
| `src/utils/bulkLogOps.js` | New | pure `removeLogsByIds`, `restoreLogsAtTop` |
| `src/__tests__/bulkLogOps.test.js` | New | unit tests for bulk reducers |
| `src/hooks/useLogs.js` | Modify | wire re-link effect, expose `bulkDeleteLogs`, `restoreLogs` |
| `src/components/vault/BulkDeleteBar.jsx` | New | sticky toolbar |
| `src/components/panels/MassLogModal.jsx` | New | multi-select + single action picker |
| `src/components/modals/AccommodationDetailModal.jsx` | New | read-only detail modal |
| `src/components/modals/StudentProfileModal.jsx` | Modify | wire double-click on accommodation rows |
| `src/components/panels/QuickActionPanel.jsx` | Modify | apply `maskName` when privacy mode on |
| `src/features/dashboard/Dashboard.jsx` | Modify | mount Mass Log button, mount PrivacyToggle |
| `src/App.jsx` | Modify | vault row checkboxes, BulkDeleteBar wiring, MassLogModal mount |

---

## Task 1: Privacy mask helper (TDD)

**Files:**
- Create: `src/utils/privacyMask.js`
- Test: `src/__tests__/privacyMask.test.js`

- [ ] **Step 1: Write failing tests**

```js
// src/__tests__/privacyMask.test.js
import { maskName } from '../utils/privacyMask';

describe('maskName', () => {
  test('two-token name returns dotted initials', () => {
    expect(maskName('Maria Lopez')).toBe('M.L.');
  });
  test('three-token name uses first + last initials', () => {
    expect(maskName('Anna Maria Lopez')).toBe('A.L.');
  });
  test('single-token name returns one initial', () => {
    expect(maskName('Cher')).toBe('C.');
  });
  test('empty string returns em-dash', () => {
    expect(maskName('')).toBe('—');
  });
  test('null/undefined returns em-dash', () => {
    expect(maskName(null)).toBe('—');
    expect(maskName(undefined)).toBe('—');
  });
  test('extra whitespace collapses', () => {
    expect(maskName('  Maria   Lopez  ')).toBe('M.L.');
  });
  test('lowercase input returns uppercase initials', () => {
    expect(maskName('maria lopez')).toBe('M.L.');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest src/__tests__/privacyMask.test.js --watchAll=false
```
Expected: FAIL — `Cannot find module '../utils/privacyMask'`.

- [ ] **Step 3: Implement helper**

```js
// src/utils/privacyMask.js
export function maskName(name) {
  if (name == null) return '—';
  const trimmed = String(name).trim().replace(/\s+/g, ' ');
  if (!trimmed) return '—';
  const parts = trimmed.split(' ').filter(Boolean);
  if (parts.length === 1) return `${parts[0][0].toUpperCase()}.`;
  const first = parts[0][0].toUpperCase();
  const last = parts[parts.length - 1][0].toUpperCase();
  return `${first}.${last}.`;
}
```

- [ ] **Step 4: Run test to verify pass**

```bash
npx jest src/__tests__/privacyMask.test.js --watchAll=false
```
Expected: 7 passing.

- [ ] **Step 5: Commit**

```bash
git add src/utils/privacyMask.js src/__tests__/privacyMask.test.js
git commit -m "feat(privacy): add maskName helper for typing-time name masking"
```

---

## Task 2: Privacy mode hook

**Files:**
- Create: `src/hooks/usePrivacyMode.js`

- [ ] **Step 1: Implement hook**

```js
// src/hooks/usePrivacyMode.js
import { useLocalStorage } from './useLocalStorage';

export function usePrivacyMode() {
  const [on, setOn] = useLocalStorage('paraPrivacyModeV1', false);
  return { on, setOn, toggle: () => setOn(v => !v) };
}
```

- [ ] **Step 2: Smoke check via build**

```bash
npx jest src/__tests__ --watchAll=false 2>&1 | tail -5
```
Expected: prior tests still pass.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/usePrivacyMode.js
git commit -m "feat(privacy): add usePrivacyMode hook"
```

---

## Task 3: Privacy toggle button

**Files:**
- Create: `src/components/PrivacyToggle.jsx`

- [ ] **Step 1: Implement component**

```jsx
// src/components/PrivacyToggle.jsx
import React from 'react';
import { usePrivacyMode } from '../hooks/usePrivacyMode';

export default function PrivacyToggle() {
  const { on, toggle } = usePrivacyMode();
  return (
    <button
      onClick={toggle}
      title={on ? 'Privacy on — names masked while typing' : 'Privacy off — names visible'}
      aria-pressed={on}
      style={{
        background: on ? 'rgba(167,139,250,.18)' : 'transparent',
        border: '1px solid rgba(167,139,250,.4)',
        borderRadius: 8,
        color: on ? '#A78BFA' : 'var(--text-muted)',
        padding: '6px 10px',
        cursor: 'pointer',
        fontSize: 13,
        fontWeight: 600,
      }}
    >
      {on ? '🛡 Privacy ON' : '🛡 Privacy'}
    </button>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/PrivacyToggle.jsx
git commit -m "feat(privacy): add PrivacyToggle button"
```

---

## Task 4: Mount PrivacyToggle in Dashboard

**Files:**
- Modify: `src/features/dashboard/Dashboard.jsx`

- [ ] **Step 1: Locate dashboard header region**

```bash
grep -n "exportOpen\|Export today\|dashboard-header\|className=\"dashboard" /home/dre/Code/SuperPara/src/features/dashboard/Dashboard.jsx | head
```

- [ ] **Step 2: Import + render PrivacyToggle next to existing dashboard header controls**

Add at top of file:
```jsx
import PrivacyToggle from '../../components/PrivacyToggle';
```

Add `<PrivacyToggle />` adjacent to the existing "Export today" / quick-action header buttons (place inside the same flex row used for top-of-dashboard tools — pick the row that contains the "Export today" button or the "find my students" CTA).

- [ ] **Step 3: Sanity check**

```bash
npm run build 2>&1 | tail -20
```
Expected: build succeeds, no missing-import errors.

- [ ] **Step 4: Commit**

```bash
git add src/features/dashboard/Dashboard.jsx
git commit -m "feat(privacy): mount PrivacyToggle in dashboard header"
```

---

## Task 5: Apply mask in QuickActionPanel student chips

**Files:**
- Modify: `src/components/panels/QuickActionPanel.jsx`

- [ ] **Step 1: Read current chip render**

```bash
grep -n "studentLabel\|resolveLabel\|chip" src/components/panels/QuickActionPanel.jsx | head
```

- [ ] **Step 2: Replace label resolution to honor privacy mode**

At top of file, add:
```jsx
import { usePrivacyMode } from '../../hooks/usePrivacyMode';
import { maskName } from '../../utils/privacyMask';
```

Inside the component (top of `QuickActionPanel`):
```jsx
const { on: privacyOn } = usePrivacyMode();
const labelFor = (id) => {
  const raw = resolveLabel(lookup[id], 'compact');
  return privacyOn ? maskName(raw) : raw;
};
```

Replace every existing call site of `resolveLabel(lookup[id], 'compact')` for chip rendering with `labelFor(id)`. Keep `resolveLabel` for the toast / `recentLog.studentLabel` ALSO routed through privacy when populated:

In `completeLog`:
```jsx
const studentLabel = privacyOn ? maskName(resolveLabel(lookup[studentId], 'compact')) : resolveLabel(lookup[studentId], 'compact');
```

- [ ] **Step 3: Build sanity**

```bash
npm run build 2>&1 | tail -10
```
Expected: success.

- [ ] **Step 4: Commit**

```bash
git add src/components/panels/QuickActionPanel.jsx
git commit -m "feat(privacy): mask student chip names when privacy mode on"
```

---

## Task 6: Re-link logs by paraAppNumber (TDD pure helper)

**Files:**
- Create: `src/utils/relinkLogs.js`
- Test: `src/__tests__/relinkLogs.test.js`

- [ ] **Step 1: Write failing tests**

```js
// src/__tests__/relinkLogs.test.js
import { relinkLogsByParaAppNumber } from '../utils/relinkLogs';

describe('relinkLogsByParaAppNumber', () => {
  test('rewrites studentId when paraAppNumber matches a new student record', () => {
    const logs = [{ id: 'l1', studentId: 'old-1', paraAppNumber: '847293' }];
    const allStudents = { 'new-1': { id: 'new-1', paraAppNumber: '847293' } };
    const out = relinkLogsByParaAppNumber(logs, allStudents);
    expect(out[0].studentId).toBe('new-1');
  });

  test('leaves logs unchanged when studentId already matches', () => {
    const logs = [{ id: 'l1', studentId: 'new-1', paraAppNumber: '847293' }];
    const allStudents = { 'new-1': { id: 'new-1', paraAppNumber: '847293' } };
    const out = relinkLogsByParaAppNumber(logs, allStudents);
    expect(out[0]).toBe(logs[0]); // referential equality — no rewrite
  });

  test('leaves logs without paraAppNumber alone', () => {
    const logs = [{ id: 'l1', studentId: 'old-1' }];
    const allStudents = { 'new-1': { id: 'new-1', paraAppNumber: '847293' } };
    const out = relinkLogsByParaAppNumber(logs, allStudents);
    expect(out[0]).toBe(logs[0]);
  });

  test('leaves logs whose paraAppNumber matches no current student', () => {
    const logs = [{ id: 'l1', studentId: 'old-1', paraAppNumber: '999999' }];
    const allStudents = { 'new-1': { id: 'new-1', paraAppNumber: '847293' } };
    const out = relinkLogsByParaAppNumber(logs, allStudents);
    expect(out[0]).toBe(logs[0]);
  });

  test('returns same array reference when nothing changed', () => {
    const logs = [{ id: 'l1', studentId: 'new-1', paraAppNumber: '847293' }];
    const allStudents = { 'new-1': { id: 'new-1', paraAppNumber: '847293' } };
    expect(relinkLogsByParaAppNumber(logs, allStudents)).toBe(logs);
  });

  test('handles empty inputs', () => {
    expect(relinkLogsByParaAppNumber([], {})).toEqual([]);
    expect(relinkLogsByParaAppNumber(null, {})).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest src/__tests__/relinkLogs.test.js --watchAll=false
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement helper**

```js
// src/utils/relinkLogs.js
// Idempotent re-link of orphaned log studentIds via the paraAppNumber bridge.
// Roster reloads mint new studentIds; old logs still point at old ids and
// fall out of byStudent filters and the workbook exporter. This rewrites
// only the logs whose paraAppNumber resolves to a different current id,
// returning the original array reference when nothing changes (so React
// effects don't ping-pong).
export function relinkLogsByParaAppNumber(logs, allStudents) {
  if (!Array.isArray(logs) || logs.length === 0) return logs || [];
  if (!allStudents) return logs;

  const byParaAppNumber = new Map();
  for (const s of Object.values(allStudents)) {
    if (s && s.paraAppNumber) byParaAppNumber.set(String(s.paraAppNumber), s.id);
  }
  if (byParaAppNumber.size === 0) return logs;

  let changed = false;
  const next = logs.map(l => {
    if (!l.paraAppNumber) return l;
    const currentId = byParaAppNumber.get(String(l.paraAppNumber));
    if (!currentId || currentId === l.studentId) return l;
    changed = true;
    return { ...l, studentId: currentId };
  });
  return changed ? next : logs;
}
```

- [ ] **Step 4: Run test to verify pass**

```bash
npx jest src/__tests__/relinkLogs.test.js --watchAll=false
```
Expected: 6 passing.

- [ ] **Step 5: Commit**

```bash
git add src/utils/relinkLogs.js src/__tests__/relinkLogs.test.js
git commit -m "feat(logs): pure relink helper to glue logs across roster reload"
```

---

## Task 7: Wire re-link effect into useLogs

**Files:**
- Modify: `src/hooks/useLogs.js`

- [ ] **Step 1: Add import + effect**

At top of file:
```js
import { relinkLogsByParaAppNumber } from '../utils/relinkLogs';
```

After the existing `useEffect` block that does the `paraAppNumber` backfill, add:
```js
// Re-link orphan logs when the roster reloads and student ids drift.
// The bridge is paraAppNumber; if a log's paraAppNumber now points at a
// different current studentId, rewrite. Pure helper returns the same
// array reference when nothing changed → no ping-pong.
useEffect(() => {
  if (!allStudents || !logs?.length) return;
  setLogs(prev => relinkLogsByParaAppNumber(prev, allStudents));
  // allStudents is the right trigger; depending on `logs` would re-fire
  // on every setLogs.
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [allStudents]);
```

- [ ] **Step 2: Build sanity**

```bash
npm run build 2>&1 | tail -10
```
Expected: success.

- [ ] **Step 3: Run all tests**

```bash
npx jest --watchAll=false 2>&1 | tail -20
```
Expected: prior suite green.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useLogs.js
git commit -m "feat(logs): re-link orphan logs to new studentIds on roster reload"
```

---

## Task 8: Bulk-log reducers (TDD pure)

**Files:**
- Create: `src/utils/bulkLogOps.js`
- Test: `src/__tests__/bulkLogOps.test.js`

- [ ] **Step 1: Write failing tests**

```js
// src/__tests__/bulkLogOps.test.js
import { removeLogsByIds, restoreLogsAtTop } from '../utils/bulkLogOps';

describe('removeLogsByIds', () => {
  test('removes specified ids', () => {
    const logs = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    expect(removeLogsByIds(logs, new Set(['a', 'c']))).toEqual([{ id: 'b' }]);
  });
  test('returns same reference when nothing removed', () => {
    const logs = [{ id: 'a' }];
    expect(removeLogsByIds(logs, new Set(['x']))).toBe(logs);
  });
  test('handles empty set', () => {
    const logs = [{ id: 'a' }];
    expect(removeLogsByIds(logs, new Set())).toBe(logs);
  });
  test('handles array input for ids', () => {
    const logs = [{ id: 'a' }, { id: 'b' }];
    expect(removeLogsByIds(logs, ['a'])).toEqual([{ id: 'b' }]);
  });
});

describe('restoreLogsAtTop', () => {
  test('prepends restored logs', () => {
    const logs = [{ id: 'b' }];
    const out = restoreLogsAtTop(logs, [{ id: 'a' }]);
    expect(out.map(l => l.id)).toEqual(['a', 'b']);
  });
  test('dedupes — does not double-add an id already present', () => {
    const logs = [{ id: 'a' }, { id: 'b' }];
    const out = restoreLogsAtTop(logs, [{ id: 'a', note: 'new' }]);
    expect(out.length).toBe(2);
    expect(out[0]).toEqual({ id: 'a' }); // original wins, restore is a no-op for that id
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest src/__tests__/bulkLogOps.test.js --watchAll=false
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement reducers**

```js
// src/utils/bulkLogOps.js
export function removeLogsByIds(logs, ids) {
  const set = ids instanceof Set ? ids : new Set(ids || []);
  if (set.size === 0) return logs;
  let removed = 0;
  const next = logs.filter(l => {
    if (set.has(l.id)) { removed++; return false; }
    return true;
  });
  return removed === 0 ? logs : next;
}

export function restoreLogsAtTop(logs, snapshot) {
  if (!snapshot || snapshot.length === 0) return logs;
  const present = new Set(logs.map(l => l.id));
  const fresh = snapshot.filter(l => !present.has(l.id));
  if (fresh.length === 0) return logs;
  return [...fresh, ...logs];
}
```

- [ ] **Step 4: Run test to verify pass**

```bash
npx jest src/__tests__/bulkLogOps.test.js --watchAll=false
```
Expected: 6 passing.

- [ ] **Step 5: Commit**

```bash
git add src/utils/bulkLogOps.js src/__tests__/bulkLogOps.test.js
git commit -m "feat(logs): pure reducers for bulk delete + restore"
```

---

## Task 9: Expose bulkDeleteLogs / restoreLogs from useLogs

**Files:**
- Modify: `src/hooks/useLogs.js`

- [ ] **Step 1: Add import**

```js
import { removeLogsByIds, restoreLogsAtTop } from '../utils/bulkLogOps';
```

- [ ] **Step 2: Add functions inside `useLogs`**

After the existing `deleteLog`:

```js
// Bulk delete returns the deleted entries so callers can wire Undo.
const bulkDeleteLogs = (ids) => {
  const set = ids instanceof Set ? ids : new Set(ids || []);
  if (set.size === 0) return [];
  const removed = logs.filter(l => set.has(l.id));
  setLogs(prev => removeLogsByIds(prev, set));
  return removed;
};

const restoreLogs = (snapshot) => {
  if (!snapshot || snapshot.length === 0) return;
  setLogs(prev => restoreLogsAtTop(prev, snapshot));
};
```

- [ ] **Step 3: Add to return**

```js
return { logs, setLogs, addLog, toggleFlag, deleteLog, bulkDeleteLogs, restoreLogs, updateLogText, loadDemoLogs, clearDemoLogs };
```

- [ ] **Step 4: Build sanity + tests**

```bash
npm run build 2>&1 | tail -10 && npx jest --watchAll=false 2>&1 | tail -10
```
Expected: build OK, suite green.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useLogs.js
git commit -m "feat(logs): expose bulkDeleteLogs and restoreLogs from useLogs"
```

---

## Task 10: BulkDeleteBar component

**Files:**
- Create: `src/components/vault/BulkDeleteBar.jsx`

- [ ] **Step 1: Create file**

```bash
mkdir -p /home/dre/Code/SuperPara/src/components/vault
```

- [ ] **Step 2: Implement**

```jsx
// src/components/vault/BulkDeleteBar.jsx
import React from 'react';

export default function BulkDeleteBar({ count, onDelete, onCancel }) {
  if (!count) return null;
  return (
    <div
      role="toolbar"
      aria-label="Bulk delete actions"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        background: 'rgba(232,69,69,.12)',
        borderBottom: '1px solid rgba(232,69,69,.35)',
        padding: '10px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <span style={{ fontSize: 13, fontWeight: 600, color: '#FCA5A5' }}>
        {count} selected
      </span>
      <button
        onClick={onDelete}
        style={{
          background: '#E84545',
          color: 'white',
          border: 'none',
          borderRadius: 6,
          padding: '6px 14px',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Delete {count}
      </button>
      <button
        onClick={onCancel}
        style={{
          background: 'transparent',
          color: 'var(--text-muted)',
          border: '1px solid rgba(255,255,255,.2)',
          borderRadius: 6,
          padding: '6px 14px',
          fontSize: 13,
          cursor: 'pointer',
        }}
      >
        Cancel
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/vault/BulkDeleteBar.jsx
git commit -m "feat(vault): BulkDeleteBar toolbar component"
```

---

## Task 11: Wire vault checkboxes + BulkDeleteBar in App.jsx

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Locate vault table render (around `filteredLogs.map`)**

```bash
grep -n "filteredLogs.map\|vaultTab\|<tbody>" /home/dre/Code/SuperPara/src/App.jsx | head
```

- [ ] **Step 2: Add state + handlers near existing vault state declarations**

```jsx
import BulkDeleteBar from './components/vault/BulkDeleteBar';
// ...
const [selectedLogIds, setSelectedLogIds] = useState(() => new Set());
const [undoSnapshot, setUndoSnapshot] = useState(null);
const undoTimerRef = useRef(null);

const toggleLogSelection = (id) => {
  setSelectedLogIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
};
const clearLogSelection = () => setSelectedLogIds(new Set());

const confirmBulkDelete = () => {
  if (selectedLogIds.size === 0) return;
  if (!window.confirm(`Delete ${selectedLogIds.size} log entries? Undo available for 10 seconds.`)) return;
  const removed = bulkDeleteLogs(selectedLogIds);
  clearLogSelection();
  setUndoSnapshot(removed);
  clearTimeout(undoTimerRef.current);
  undoTimerRef.current = setTimeout(() => setUndoSnapshot(null), 10000);
};
const undoBulkDelete = () => {
  if (!undoSnapshot) return;
  restoreLogs(undoSnapshot);
  setUndoSnapshot(null);
  clearTimeout(undoTimerRef.current);
};
```

(Where `bulkDeleteLogs` and `restoreLogs` come from the existing `useLogs(...)` destructure — add them: `const { logs, setLogs, addLog, deleteLog, bulkDeleteLogs, restoreLogs, ... } = useLogs(...);` — match the actual destructure already in App.jsx.)

- [ ] **Step 3: Render BulkDeleteBar above vault table**

Just inside the vault tab JSX block, before `<table>` or row map:
```jsx
<BulkDeleteBar
  count={selectedLogIds.size}
  onDelete={confirmBulkDelete}
  onCancel={clearLogSelection}
/>
{undoSnapshot && (
  <div style={{ padding: '8px 14px', background: 'rgba(34,197,94,.12)', borderBottom: '1px solid rgba(34,197,94,.35)', display: 'flex', alignItems: 'center', gap: 10 }}>
    <span style={{ fontSize: 13, color: '#86EFAC' }}>{undoSnapshot.length} log{undoSnapshot.length === 1 ? '' : 's'} deleted.</span>
    <button onClick={undoBulkDelete} style={{ background: 'transparent', color: '#86EFAC', border: '1px solid #22C55E', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer' }}>Undo</button>
  </div>
)}
```

- [ ] **Step 4: Add checkbox column to each rendered log row**

Inside `filteredLogs.map(l => { ... return ( ... ) })`, prepend a `<td>` cell or column:
```jsx
<td style={{ padding: '6px 8px', verticalAlign: 'top', width: 28 }}>
  <input
    type="checkbox"
    checked={selectedLogIds.has(l.id)}
    onChange={() => toggleLogSelection(l.id)}
    aria-label="Select log for bulk action"
  />
</td>
```

(If the vault uses a different render shape — e.g. divs not table cells — match the surrounding pattern.)

- [ ] **Step 5: Build + manual smoke**

```bash
npm run build 2>&1 | tail -10
```
Expected: success.

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx
git commit -m "feat(vault): row checkboxes + BulkDeleteBar with Undo"
```

---

## Task 12: MassLogModal scaffold

**Files:**
- Create: `src/components/panels/MassLogModal.jsx`

- [ ] **Step 1: Implement modal**

```jsx
// src/components/panels/MassLogModal.jsx
import React, { useState, useMemo } from 'react';
import { useEscape } from '../../hooks/useEscape';
import { resolveLabel } from '../../privacy/nameResolver';
import { usePrivacyMode } from '../../hooks/usePrivacyMode';
import { maskName } from '../../utils/privacyMask';
import { QUICK_ACTIONS } from '../../data';

export default function MassLogModal({ open, onClose, students, studentsMap, onLog }) {
  const { on: privacyOn } = usePrivacyMode();
  const [picked, setPicked] = useState(() => new Set());
  const [actionId, setActionId] = useState('');
  const [note, setNote] = useState('');
  useEscape(open ? onClose : () => {});
  if (!open) return null;

  const action = QUICK_ACTIONS.find(a => a.id === actionId) || null;
  const studentList = (students || []).filter(id => studentsMap[id]);
  const labelFor = (id) => {
    const raw = resolveLabel(studentsMap[id], 'compact');
    return privacyOn ? maskName(raw) : raw;
  };
  const togglePick = (id) => setPicked(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const pickAll = () => setPicked(new Set(studentList));
  const clearPicks = () => setPicked(new Set());

  const submit = () => {
    if (!action || picked.size === 0) return;
    const finalNote = note.trim() || action.defaultNote;
    for (const sid of picked) {
      onLog(sid, finalNote, action.logType, {
        source: 'mass_log',
        category: action.category,
        tags: action.tags,
      });
    }
    setPicked(new Set());
    setNote('');
    setActionId('');
    onClose?.();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: 560 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>Mass log</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: 20, cursor: 'pointer' }}>×</button>
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Students</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <button onClick={pickAll} style={btnGhost}>Select all in period</button>
            <button onClick={clearPicks} style={btnGhost}>Clear</button>
            <span style={{ marginLeft: 'auto', fontSize: 12, color: '#A78BFA' }}>{picked.size} selected</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {studentList.map(id => (
              <button
                key={id}
                onClick={() => togglePick(id)}
                style={{
                  background: picked.has(id) ? 'rgba(167,139,250,.25)' : 'rgba(255,255,255,.05)',
                  border: picked.has(id) ? '1px solid #A78BFA' : '1px solid rgba(255,255,255,.1)',
                  color: picked.has(id) ? '#E9D5FF' : 'var(--text-primary)',
                  borderRadius: 18,
                  padding: '6px 12px',
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >{labelFor(id)}</button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Action</div>
          <select value={actionId} onChange={e => setActionId(e.target.value)} style={selStyle}>
            <option value="">— pick a quick action —</option>
            {QUICK_ACTIONS.map(a => (
              <option key={a.id} value={a.id}>{a.icon} {a.label} · {a.logType}</option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Note (optional — uses action's default if blank)</div>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={3}
            style={{ width: '100%', background: 'rgba(0,0,0,.25)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 6, color: 'var(--text-primary)', padding: 8, fontSize: 13 }}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={btnGhost}>Cancel</button>
          <button
            onClick={submit}
            disabled={!action || picked.size === 0}
            style={{
              background: '#A78BFA',
              color: '#1E1B4B',
              border: 'none',
              borderRadius: 6,
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 700,
              cursor: (!action || picked.size === 0) ? 'not-allowed' : 'pointer',
              opacity: (!action || picked.size === 0) ? 0.4 : 1,
            }}
          >Log for {picked.size} student{picked.size === 1 ? '' : 's'}</button>
        </div>
      </div>
    </div>
  );
}

const btnGhost = { background: 'transparent', border: '1px solid rgba(255,255,255,.15)', color: 'var(--text-primary)', borderRadius: 6, padding: '6px 12px', fontSize: 12, cursor: 'pointer' };
const selStyle = { width: '100%', background: 'rgba(0,0,0,.25)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 6, color: 'var(--text-primary)', padding: 8, fontSize: 13 };
```

- [ ] **Step 2: Build sanity**

```bash
npm run build 2>&1 | tail -10
```
Expected: success (modal not yet mounted, but compiles).

- [ ] **Step 3: Commit**

```bash
git add src/components/panels/MassLogModal.jsx
git commit -m "feat(masslog): MassLogModal with multi-select + single action picker"
```

---

## Task 13: Mount Mass log button on Dashboard

**Files:**
- Modify: `src/features/dashboard/Dashboard.jsx`
- Modify: `src/App.jsx` (mount the modal at app level OR pass open state to Dashboard)

- [ ] **Step 1: Locate dashboard QuickActionPanel render**

```bash
grep -n "QuickActionPanel\|quickLog\|Quick log" src/features/dashboard/Dashboard.jsx | head
```

- [ ] **Step 2: Add Mass log trigger near QuickActionPanel**

In Dashboard.jsx, just above the `<QuickActionPanel ... />` render, add:
```jsx
<div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 10px 6px' }}>
  <button
    onClick={() => onOpenMassLog?.()}
    style={{
      background: 'rgba(167,139,250,.12)',
      border: '1px solid rgba(167,139,250,.4)',
      color: '#A78BFA',
      borderRadius: 8,
      padding: '6px 12px',
      fontSize: 13,
      fontWeight: 600,
      cursor: 'pointer',
    }}
  >📋 Mass log</button>
</div>
```

Add `onOpenMassLog` to the Dashboard props signature.

- [ ] **Step 3: In App.jsx, add mount + state**

```jsx
import MassLogModal from './components/panels/MassLogModal';
// ...
const [massLogOpen, setMassLogOpen] = useState(false);
// ...
// Pass to dashboard:
<Dashboard
  ...existingProps
  onOpenMassLog={() => setMassLogOpen(true)}
/>
// Mount modal at top level near other modals:
<MassLogModal
  open={massLogOpen}
  onClose={() => setMassLogOpen(false)}
  students={currentPeriodStudents /* the same array passed to QuickActionPanel */}
  studentsMap={allStudents}
  onLog={addLog}
/>
```

(Match the existing variable names already used by QuickActionPanel mount in App.jsx.)

- [ ] **Step 4: Build sanity + manual click test**

```bash
npm run build 2>&1 | tail -10
```
Expected: success. Manual: open dashboard, click "Mass log", pick students, pick action, confirm → toast or count update; verify logs land via Vault.

- [ ] **Step 5: Commit**

```bash
git add src/features/dashboard/Dashboard.jsx src/App.jsx
git commit -m "feat(masslog): mount Mass log button on dashboard"
```

---

## Task 14: AccommodationDetailModal scaffold

**Files:**
- Create: `src/components/modals/AccommodationDetailModal.jsx`

- [ ] **Step 1: Implement modal**

```jsx
// src/components/modals/AccommodationDetailModal.jsx
import React from 'react';
import { useEscape } from '../../hooks/useEscape';

export default function AccommodationDetailModal({ open, onClose, accommodation, student, logs = [], strategies = [] }) {
  useEscape(open ? onClose : () => {});
  if (!open || !accommodation) return null;

  const text = typeof accommodation === 'string' ? accommodation : (accommodation.text || '');
  const sourceFile = student?.iepImport?.fileName || student?.importMeta?.fileName || null;
  const sourceDate = student?.iepImport?.date || student?.importMeta?.date || null;
  const linkedStrategies = (strategies || []).filter(s => {
    const st = typeof s === 'string' ? s : (s.text || '');
    return st && text && st.toLowerCase().includes(text.toLowerCase().slice(0, 30));
  });
  const snippet = text.toLowerCase().slice(0, 25);
  const linkedLogs = (logs || []).filter(l => {
    if (l.studentId !== student?.id) return false;
    const note = (l.note || l.text || '').toLowerCase();
    return snippet && note.includes(snippet);
  });

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: 560 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>Accommodation detail</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: 20, cursor: 'pointer' }}>×</button>
        </div>

        <div style={{ background: 'rgba(0,0,0,.25)', borderRadius: 8, padding: 14, marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 6 }}>Text</div>
          <div style={{ fontSize: 14, lineHeight: 1.5 }}>{text}</div>
        </div>

        {(sourceFile || sourceDate) && (
          <div style={{ marginBottom: 14, fontSize: 12, color: 'var(--text-muted)' }}>
            <span style={{ textTransform: 'uppercase', letterSpacing: '.07em', marginRight: 8 }}>Source</span>
            {sourceFile && <span>{sourceFile}</span>}
            {sourceDate && <span style={{ marginLeft: 8 }}>· {sourceDate}</span>}
          </div>
        )}

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 6 }}>Linked strategies ({linkedStrategies.length})</div>
          {linkedStrategies.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>No strategies match this accommodation text.</div>
          ) : (
            linkedStrategies.map((s, i) => (
              <div key={i} style={{ fontSize: 13, padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,.05)' }}>{typeof s === 'string' ? s : s.text}</div>
            ))
          )}
        </div>

        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 6 }}>Past logs that referenced it ({linkedLogs.length})</div>
          {linkedLogs.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>No past logs reference this accommodation.</div>
          ) : (
            linkedLogs.slice(0, 20).map(l => (
              <div key={l.id} style={{ fontSize: 12, padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,.05)' }}>
                <span style={{ color: 'var(--text-muted)' }}>{l.date}</span> — {l.note || l.text}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Build sanity**

```bash
npm run build 2>&1 | tail -10
```
Expected: success.

- [ ] **Step 3: Commit**

```bash
git add src/components/modals/AccommodationDetailModal.jsx
git commit -m "feat(profile): AccommodationDetailModal scaffold"
```

---

## Task 15: Wire double-click on accommodation rows

**Files:**
- Modify: `src/components/modals/StudentProfileModal.jsx`

- [ ] **Step 1: Add import + state**

At top of file:
```jsx
import AccommodationDetailModal from './AccommodationDetailModal';
```

Inside the component (top, near other `useState`):
```jsx
const [accDetail, setAccDetail] = useState(null);
```

- [ ] **Step 2: Wrap accommodation row**

Replace the existing accommodation row render at line 427:

```jsx
{tab === "accs" && (<div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>{(s.accs || []).map((a, i) => (
  <div
    key={i}
    onDoubleClick={() => setAccDetail(a)}
    onKeyDown={(e) => { if (e.key === 'Enter') setAccDetail(a); }}
    tabIndex={0}
    role="button"
    aria-label="Open accommodation details"
    title="Double-click for details"
    style={{ background: "rgba(0,0,0,.2)", borderRadius: "8px", padding: "10px 14px", display: "flex", alignItems: "center", gap: "10px", borderLeft: `3px solid ${c}30`, cursor: 'pointer' }}
  >
    <span style={{ fontSize: "16px", color: c }}>✓</span>
    <span style={{ fontSize: "13px" }}>{typeof a === 'string' ? a : (a.text || '')}</span>
  </div>
))}{(s.accs || []).length === 0 && <div style={{ color: "var(--text-muted)", padding: "20px", textAlign: "center" }}>No accommodations listed.</div>}</div>)}
```

- [ ] **Step 3: Mount the detail modal at end of JSX**

Just before the closing tags at the end of the modal's outer container:
```jsx
<AccommodationDetailModal
  open={!!accDetail}
  onClose={() => setAccDetail(null)}
  accommodation={accDetail}
  student={s}
  logs={stuLogs}
  strategies={s?.strategies}
/>
```

- [ ] **Step 4: Build sanity**

```bash
npm run build 2>&1 | tail -10
```
Expected: success.

- [ ] **Step 5: Commit**

```bash
git add src/components/modals/StudentProfileModal.jsx
git commit -m "feat(profile): double-click accommodation opens detail modal"
```

---

## Task 16: Manual QA + final tests

- [ ] **Step 1: Run full test suite**

```bash
npx jest --watchAll=false 2>&1 | tail -30
```
Expected: all green (existing + new).

- [ ] **Step 2: Build production**

```bash
npm run build 2>&1 | tail -20
```
Expected: build succeeds.

- [ ] **Step 3: Manual QA on Chromebook (or local browser smoke)**

```bash
npm start
```

Walk this checklist:
1. Mass log: open dashboard → "Mass log" → select 2 students, pick action, confirm → vault shows 2 new logs with `source: mass_log`.
2. Accommodation detail: open student profile → Accommodations tab → double-click row → modal shows text + source + linked.
3. Log glue: load roster → make a log → "Find My Students" with new template → export CSV → new student name + old log present.
4. Bulk delete: vault → tick 3 logs → BulkDeleteBar appears → Delete → confirm → 3 gone → Undo → 3 restored.
5. Privacy: dashboard → toggle Privacy → student chips render `M.L.` style → toggle off → real names back.

- [ ] **Step 4: If any issue, file as separate fix-up commit, do NOT amend prior commits.**

---

## Task 17: Push wave to main

**Files:** none

- [ ] **Step 1: Confirm clean tree on feature branch**

```bash
git status
```
Expected: working tree clean (all wave commits made).

- [ ] **Step 2: Fetch + rebase main onto current branch's wave commits, OR merge to main**

(Strategy: fast-forward main to feature branch tip if linear, else merge with `--no-ff`.)

```bash
git fetch origin main
git checkout main
git pull --ff-only origin main
git merge --no-ff <feature-branch> -m "merge: para-app dashboard features wave"
```

- [ ] **Step 3: Push main**

```bash
git push origin main
```
Expected: push succeeds.

- [ ] **Step 4: Confirm**

```bash
git log --oneline origin/main -5
```

Wave shipped.

---

## Self-review check

- Spec coverage: F1 (Tasks 12–13), F2 (Tasks 14–15), F3 (Tasks 6–7), F4 (Tasks 8–11), F5 (Tasks 1–5). All five covered. ✓
- No placeholders. ✓
- Type consistency: `bulkDeleteLogs(ids: Set|Array) → Log[]`, `restoreLogs(snapshot: Log[]) → void` consistent across hook + reducers. ✓
- Test commands match `react-scripts` Jest. ✓
- Each task ends in a commit. ✓
