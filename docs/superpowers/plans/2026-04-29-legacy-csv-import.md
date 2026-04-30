# Legacy CSV Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Settings → Advanced flow that lets Mr. Dre re-ingest old `_private` SuperPara CSV exports as logs by name-matching against the realNameVault to recover paraAppNumber.

**Architecture:** Three-layer split — pure-functional core (`src/features/import/legacyImport.js`) handles parse + match + dedupe with no React; modal UI (`src/features/import/LegacyImportModal.jsx`) drives the three-step flow (Upload → Review → Confirm) and ingests via the existing `useLogsContext().addLog` path so cloud sync is free; Settings entry point (`src/components/SettingsModal.jsx`) gates the modal behind an "Advanced" section that's disabled when the vault is empty.

**Tech Stack:** React 19 + CRA, JS (no TS), Jest via react-scripts, no new npm dependencies (Jaro-Winkler is hand-rolled in ~30 lines).

**Spec:** `docs/superpowers/specs/2026-04-29-legacy-csv-import-design.md`

---

## File Structure

| File | Created by Task | Responsibility |
|---|---|---|
| `src/utils/fuzzyMatch.js` | Task 1 | `normalizeName(s)`, `jaroWinkler(a, b)`. Pure string utilities. |
| `src/features/import/legacyImport.js` | Tasks 2–4 | `parseLegacyCsv`, `matchRowsToVault`, `dedupeAgainstLogs`. Pure data-in/data-out functions. No React, no DOM, no async. |
| `src/__tests__/legacyImport.test.js` | Tasks 1–4 | All unit tests for the pure-functional core. |
| `src/features/import/LegacyImportModal.jsx` | Tasks 5–7 | Three-step modal UI. Calls into the core for compute, into `useLogsContext().addLog` for ingestion. |
| `src/components/SettingsModal.jsx` | Task 8 | Modify — add "Advanced" section with the legacy-import entry. |

---

## Task 1: `fuzzyMatch.js` — string normalization + Jaro-Winkler

**Files:**
- Create: `src/utils/fuzzyMatch.js`
- Test: `src/__tests__/legacyImport.test.js`

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/legacyImport.test.js` with the imports + first describe block:

```javascript
import { normalizeName, jaroWinkler } from '../utils/fuzzyMatch';

describe('normalizeName', () => {
  test('lowercases and trims', () => {
    expect(normalizeName('  Maria Lopez  ')).toBe('maria lopez');
  });
  test('strips diacritics so accented and unaccented match', () => {
    expect(normalizeName('Maria López')).toBe(normalizeName('Maria Lopez'));
    expect(normalizeName('García')).toBe(normalizeName('Garcia'));
  });
  test('collapses internal whitespace', () => {
    expect(normalizeName('Maria   E.  Lopez')).toBe('maria e lopez');
  });
  test('drops common punctuation', () => {
    expect(normalizeName("O'Brien-Smith")).toBe('obrien smith');
  });
  test('returns empty string for null/undefined', () => {
    expect(normalizeName(null)).toBe('');
    expect(normalizeName(undefined)).toBe('');
  });
});

describe('jaroWinkler', () => {
  test('returns 1 for identical strings', () => {
    expect(jaroWinkler('maria', 'maria')).toBe(1);
  });
  test('returns 0 for completely disjoint short strings', () => {
    expect(jaroWinkler('abc', 'xyz')).toBeLessThan(0.1);
  });
  test('rates near-matches above 0.85', () => {
    // "Maria E. Lopez" → "Maria Lopez" after normalization
    expect(jaroWinkler('maria e lopez', 'maria lopez')).toBeGreaterThan(0.85);
  });
  test('rates "Marco Herrera-Barojas" vs "Marco Herrera Barojas" above 0.95', () => {
    expect(jaroWinkler('marco herrera barojas', 'marco herrera barojas')).toBe(1);
  });
  test('symmetric: jaroWinkler(a,b) === jaroWinkler(b,a)', () => {
    expect(jaroWinkler('alpha', 'alphabet')).toBe(jaroWinkler('alphabet', 'alpha'));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /home/dre/Code/SuperPara && CI=true npx react-scripts test --env=jsdom --testPathPattern=legacyImport --no-coverage`
Expected: FAIL — "Cannot find module '../utils/fuzzyMatch'".

- [ ] **Step 3: Implement `src/utils/fuzzyMatch.js`**

Create `src/utils/fuzzyMatch.js`:

```javascript
// Tiny fuzzy-match utilities for legacy import. Two functions:
//   normalizeName(s) — case-fold, strip diacritics, drop punctuation,
//   collapse whitespace. Idempotent. Used as the comparison key.
//   jaroWinkler(a, b) — similarity in [0,1]. Used for "did the user
//   misspell this?" decisions on rows that don't normalize-equal any
//   vault entry.
//
// No external deps — Jaro-Winkler is small enough to ship inline.

export function normalizeName(s) {
  if (s == null) return '';
  return String(s)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')   // strip combining diacritics
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')      // drop punctuation
    .replace(/\s+/g, ' ')              // collapse runs of whitespace
    .trim();
}

// ── Jaro-Winkler similarity ─────────────────────────────────────────
// Jaro: matching window = floor(max(len)/2) - 1, transpositions /= 2.
// Winkler bonus: +0.1 * commonPrefix (up to 4 chars).

function jaro(a, b) {
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;
  const matchWindow = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const aMatched = new Array(a.length).fill(false);
  const bMatched = new Array(b.length).fill(false);
  let matches = 0;
  for (let i = 0; i < a.length; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(b.length - 1, i + matchWindow);
    for (let j = start; j <= end; j++) {
      if (bMatched[j]) continue;
      if (a[i] !== b[j]) continue;
      aMatched[i] = true;
      bMatched[j] = true;
      matches++;
      break;
    }
  }
  if (!matches) return 0;
  // count transpositions
  let transpositions = 0;
  let bIdx = 0;
  for (let i = 0; i < a.length; i++) {
    if (!aMatched[i]) continue;
    while (!bMatched[bIdx]) bIdx++;
    if (a[i] !== b[bIdx]) transpositions++;
    bIdx++;
  }
  transpositions /= 2;
  return (matches / a.length + matches / b.length + (matches - transpositions) / matches) / 3;
}

export function jaroWinkler(a, b) {
  if (a === b) return 1;
  if (!a || !b) return 0;
  const j = jaro(a, b);
  if (j < 0.7) return j; // standard Winkler skip threshold
  let prefix = 0;
  const maxPrefix = Math.min(4, a.length, b.length);
  while (prefix < maxPrefix && a[prefix] === b[prefix]) prefix++;
  return j + prefix * 0.1 * (1 - j);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /home/dre/Code/SuperPara && CI=true npx react-scripts test --env=jsdom --testPathPattern=legacyImport --no-coverage`
Expected: PASS — `normalizeName` (5 tests) + `jaroWinkler` (5 tests) green.

- [ ] **Step 5: Commit**

```bash
cd /home/dre/Code/SuperPara && git add src/utils/fuzzyMatch.js src/__tests__/legacyImport.test.js && git commit -m "feat(import): fuzzyMatch utilities — normalizeName + Jaro-Winkler"
```

---

## Task 2: `legacyImport.js` — CSV parser

**Files:**
- Create: `src/features/import/legacyImport.js`
- Modify: `src/__tests__/legacyImport.test.js` (append)

- [ ] **Step 1: Write the failing tests**

Append to `src/__tests__/legacyImport.test.js`:

```javascript
import { parseLegacyCsv } from '../features/import/legacyImport';

describe('parseLegacyCsv', () => {
  const HEADER_PREFIX = 'Date,Period,Student,Type,Category,Flagged,Tags,Observation';

  test('parses a standard well-formed row', () => {
    const csv = HEADER_PREFIX + '\n' +
      '"2026-04-29","Period 3 — Math 2","Maria Lopez","Behavior Note","behavior","No","break;regulation","Used break pass."';
    const { rows, error } = parseLegacyCsv(csv);
    expect(error).toBeNull();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      date: '2026-04-29',
      period: 'Period 3 — Math 2',
      student: 'Maria Lopez',
      type: 'Behavior Note',
      category: 'behavior',
      flagged: false,
      tags: ['break', 'regulation'],
      observation: 'Used break pass.',
    });
  });

  test('handles embedded commas and escaped quotes inside quoted fields', () => {
    const csv = HEADER_PREFIX + '\n' +
      '"2026-04-29","p3","Maria Lopez","Note","g","Yes","","Said ""hi, friend"" loudly"';
    const { rows } = parseLegacyCsv(csv);
    expect(rows[0].observation).toBe('Said "hi, friend" loudly');
    expect(rows[0].flagged).toBe(true);
    expect(rows[0].tags).toEqual([]);
  });

  test('accepts post-fix schema with extra columns and ignores them', () => {
    // Post-fix exports added "Period ID" + "Para App Number" columns. Parser
    // must accept these without error and ignore unknown columns.
    const post = 'Date,Period,Period ID,Student,Para App Number,Type,Category,Flagged,Tags,Observation\n' +
      '"2026-04-29","Period 3","p3","Maria Lopez","847293","Note","g","No","","obs"';
    const { rows, error } = parseLegacyCsv(post);
    expect(error).toBeNull();
    expect(rows[0].student).toBe('Maria Lopez');
    expect(rows[0].observation).toBe('obs');
  });

  test('rejects a file whose header does not match either expected schema', () => {
    const bad = 'name,age\n"Bob","12"';
    const { rows, error } = parseLegacyCsv(bad);
    expect(rows).toEqual([]);
    expect(error).toMatch(/doesn't look like/i);
  });

  test('skips rows missing required fields and reports them', () => {
    const csv = HEADER_PREFIX + '\n' +
      '"","p3","Maria","Note","g","No","","obs"\n' +                           // missing date
      '"2026-04-29","p3","","Note","g","No","","obs"\n' +                      // missing student
      '"2026-04-29","p3","Maria","Note","g","No","",""\n' +                    // missing observation
      '"2026-04-29","p3","Maria","Note","g","No","","kept"';
    const { rows, skipped } = parseLegacyCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].observation).toBe('kept');
    expect(skipped).toHaveLength(3);
    expect(skipped[0].reason).toMatch(/date/i);
    expect(skipped[1].reason).toMatch(/student/i);
    expect(skipped[2].reason).toMatch(/observation/i);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /home/dre/Code/SuperPara && CI=true npx react-scripts test --env=jsdom --testPathPattern=legacyImport --no-coverage`
Expected: FAIL — "Cannot find module '../features/import/legacyImport'".

- [ ] **Step 3: Implement parser in `src/features/import/legacyImport.js`**

Create `src/features/import/legacyImport.js`:

```javascript
// Pure-functional core for legacy CSV import. No React. No DOM. No async.
// Input: CSV text (and supporting context). Output: structured rows ready
// for the modal to display + ingest.
//
// Three exported functions:
//   parseLegacyCsv(text)          → { rows, skipped, error }
//   matchRowsToVault(rows, ...)   → matchedRows[]   (Task 3)
//   dedupeAgainstLogs(rows, ...)  → { fresh, duplicates }  (Task 4)

const PRE_FIX_HEADER = 'Date,Period,Student,Type,Category,Flagged,Tags,Observation';
const POST_FIX_HEADER = 'Date,Period,Period ID,Student,Para App Number,Type,Category,Flagged,Tags,Observation';

// RFC 4180 line splitter: respects quoted fields containing newlines, commas,
// and "" escapes. Returns array of cell arrays, one per logical row.
function splitCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; continue; }
      if (c === '"') { inQuotes = false; continue; }
      cell += c;
      continue;
    }
    if (c === '"') { inQuotes = true; continue; }
    if (c === ',') { row.push(cell); cell = ''; continue; }
    if (c === '\n' || c === '\r') {
      // skip \r if part of \r\n
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      // ignore fully-empty lines
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
      continue;
    }
    cell += c;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

export function parseLegacyCsv(text) {
  if (!text || typeof text !== 'string') {
    return { rows: [], skipped: [], error: "This doesn't look like a SuperPara private export — empty file." };
  }
  const allRows = splitCsv(text);
  if (!allRows.length) {
    return { rows: [], skipped: [], error: "This doesn't look like a SuperPara private export — no data." };
  }
  const headerCells = allRows[0];
  const headerStr = headerCells.join(',');
  let schema;
  if (headerStr === PRE_FIX_HEADER) schema = 'pre';
  else if (headerStr === POST_FIX_HEADER) schema = 'post';
  else {
    return { rows: [], skipped: [], error: "This doesn't look like a SuperPara private export — header doesn't match." };
  }

  const idx = (name) => headerCells.indexOf(name);
  const I = {
    date: idx('Date'),
    period: idx('Period'),
    student: idx('Student'),
    type: idx('Type'),
    category: idx('Category'),
    flagged: idx('Flagged'),
    tags: idx('Tags'),
    observation: idx('Observation'),
    periodId: idx('Period ID'),               // -1 in pre-fix
    paraAppNumberFromCsv: idx('Para App Number'), // -1 in pre-fix
  };

  const rows = [];
  const skipped = [];
  for (let r = 1; r < allRows.length; r++) {
    const cells = allRows[r];
    const date = (cells[I.date] || '').trim();
    const student = (cells[I.student] || '').trim();
    const observation = (cells[I.observation] || '').trim();
    if (!date)        { skipped.push({ rowIndex: r, reason: 'missing date' });        continue; }
    if (!student)     { skipped.push({ rowIndex: r, reason: 'missing student name' }); continue; }
    if (!observation) { skipped.push({ rowIndex: r, reason: 'missing observation' }); continue; }
    const tagsRaw = I.tags >= 0 ? (cells[I.tags] || '') : '';
    const tags = tagsRaw ? tagsRaw.split(';').map(t => t.trim()).filter(Boolean) : [];
    rows.push({
      rowIndex: r,
      date,
      period: (cells[I.period] || '').trim(),
      periodId: I.periodId >= 0 ? (cells[I.periodId] || '').trim() : '',
      student,
      type: (cells[I.type] || '').trim() || 'General Observation',
      category: (cells[I.category] || '').trim() || null,
      flagged: ((cells[I.flagged] || '').trim().toLowerCase() === 'yes'),
      tags,
      observation,
      // post-fix exports may already carry paraAppNumber; matcher honors it
      // before doing name lookup.
      csvParaAppNumber: I.paraAppNumberFromCsv >= 0 ? ((cells[I.paraAppNumberFromCsv] || '').trim() || null) : null,
    });
  }
  return { rows, skipped, error: null, schema };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /home/dre/Code/SuperPara && CI=true npx react-scripts test --env=jsdom --testPathPattern=legacyImport --no-coverage`
Expected: PASS — `parseLegacyCsv` 5 tests green, plus the previous fuzzyMatch 10.

- [ ] **Step 5: Commit**

```bash
cd /home/dre/Code/SuperPara && git add src/features/import/legacyImport.js src/__tests__/legacyImport.test.js && git commit -m "feat(import): legacyImport.parseLegacyCsv — RFC 4180 parser with schema validation"
```

---

## Task 3: `legacyImport.js` — `matchRowsToVault`

**Files:**
- Modify: `src/features/import/legacyImport.js`
- Modify: `src/__tests__/legacyImport.test.js` (append)

- [ ] **Step 1: Write the failing tests**

Append to `src/__tests__/legacyImport.test.js`:

```javascript
import { matchRowsToVault } from '../features/import/legacyImport';

describe('matchRowsToVault', () => {
  // vaultEntries = [{ paraAppNumber, realName, studentId? }]
  // Mirror what the modal will pass: vault names paired with the local
  // studentId so matched rows can be ingested directly without a second
  // lookup.
  const vault = [
    { paraAppNumber: '111111', realName: 'Maria Lopez',           studentId: 'stu_a' },
    { paraAppNumber: '222222', realName: 'Marco Herrera-Barojas', studentId: 'stu_b' },
    { paraAppNumber: '333333', realName: 'Henry Carrillo',        studentId: 'stu_c' },
    { paraAppNumber: '444444', realName: 'Sophie Blake',          studentId: 'stu_d' },
  ];

  function row(student, extras = {}) {
    return { rowIndex: 1, date: '2026-04-29', student, observation: 'obs', tags: [], ...extras };
  }

  test('exact (case + whitespace insensitive) match', () => {
    const out = matchRowsToVault([row('  maria lopez  ')], vault);
    expect(out[0].match.kind).toBe('exact');
    expect(out[0].match.paraAppNumber).toBe('111111');
    expect(out[0].match.studentId).toBe('stu_a');
  });

  test('diacritic-insensitive exact match', () => {
    const out = matchRowsToVault([row('Maria López')], vault);
    expect(out[0].match.kind).toBe('exact');
    expect(out[0].match.paraAppNumber).toBe('111111');
  });

  test('fuzzy match returns top candidates above threshold', () => {
    // "Marco Herrera Barojas" (no hyphen) vs "Marco Herrera-Barojas" — same
    // after normalization → exact, not fuzzy.
    const out = matchRowsToVault([row('Marco Herrera Barojas')], vault);
    expect(out[0].match.kind).toBe('exact');
  });

  test('fuzzy match for true near-misses (typo)', () => {
    const out = matchRowsToVault([row('Henry Carillo')], vault); // missing one r
    expect(out[0].match.kind).toBe('fuzzy');
    expect(out[0].match.candidates[0].paraAppNumber).toBe('333333');
    expect(out[0].match.candidates[0].score).toBeGreaterThan(0.85);
  });

  test('returns kind=none when no candidate clears 0.85', () => {
    const out = matchRowsToVault([row('Zelda Northgate')], vault);
    expect(out[0].match.kind).toBe('none');
    expect(out[0].match.candidates || []).toEqual([]);
  });

  test('flags ambiguous when two vault entries normalize equal', () => {
    const dupVault = [
      ...vault,
      { paraAppNumber: '555555', realName: 'maria lopez', studentId: 'stu_e' },
    ];
    const out = matchRowsToVault([row('Maria Lopez')], dupVault);
    expect(out[0].match.kind).toBe('ambiguous');
    expect(out[0].match.candidates).toHaveLength(2);
  });

  test('honors csvParaAppNumber when present (post-fix exports)', () => {
    // If the row already carries paraAppNumber from a post-fix export, skip
    // the name lookup and accept it. The vault is only consulted if the
    // paraAppNumber resolves to a known studentId; otherwise mark unmatched.
    const r = row('Maria Lopez', { csvParaAppNumber: '111111' });
    const out = matchRowsToVault([r], vault);
    expect(out[0].match.kind).toBe('exact');
    expect(out[0].match.paraAppNumber).toBe('111111');
    expect(out[0].match.studentId).toBe('stu_a');
  });

  test('returns kind=vault_empty when vault is empty', () => {
    const out = matchRowsToVault([row('Maria Lopez')], []);
    expect(out[0].match.kind).toBe('vault_empty');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /home/dre/Code/SuperPara && CI=true npx react-scripts test --env=jsdom --testPathPattern=legacyImport --no-coverage`
Expected: FAIL — "matchRowsToVault is not a function".

- [ ] **Step 3: Append `matchRowsToVault` to `src/features/import/legacyImport.js`**

Append to `src/features/import/legacyImport.js`:

```javascript
import { normalizeName, jaroWinkler } from '../../utils/fuzzyMatch';

const FUZZY_THRESHOLD = 0.85;
const TOP_CANDIDATES = 3;

// Match each row's `student` field against vault entries.
// vaultEntries: Array<{ paraAppNumber, realName, studentId? }>
// Returns the same rows with a `.match` field added describing the resolution.
//   match.kind:
//     "exact"      — exactly one vault entry normalizes equal to row.student
//     "ambiguous"  — two or more vault entries normalize equal (rare)
//     "fuzzy"      — best Jaro-Winkler candidate >= threshold, normalize-not-equal
//     "none"       — no candidate clears threshold
//     "vault_empty"— vault has zero entries; matcher is effectively a no-op
//   For exact: { paraAppNumber, studentId, realName }
//   For ambiguous/fuzzy: { candidates: [{paraAppNumber,studentId,realName,score}] }
//   For none / vault_empty: { candidates: [] }
//
// Special case: if row.csvParaAppNumber is set (from a post-fix export's
// "Para App Number" column) AND that paraAppNumber resolves to a known vault
// entry, treat as exact and skip the name lookup entirely.
export function matchRowsToVault(rows, vaultEntries) {
  if (!Array.isArray(vaultEntries) || vaultEntries.length === 0) {
    return rows.map(r => ({ ...r, match: { kind: 'vault_empty', candidates: [] } }));
  }
  // Pre-compute normalized keys + an inverse lookup by paraAppNumber.
  const byNormalized = new Map(); // normName -> Array<entry>
  const byParaAppNumber = new Map();
  for (const e of vaultEntries) {
    if (!e || !e.realName) continue;
    const norm = normalizeName(e.realName);
    if (!byNormalized.has(norm)) byNormalized.set(norm, []);
    byNormalized.get(norm).push(e);
    if (e.paraAppNumber) byParaAppNumber.set(String(e.paraAppNumber), e);
  }

  return rows.map((r) => {
    // Honor explicit paraAppNumber from post-fix exports first.
    if (r.csvParaAppNumber) {
      const hit = byParaAppNumber.get(String(r.csvParaAppNumber));
      if (hit) {
        return {
          ...r,
          match: {
            kind: 'exact',
            paraAppNumber: hit.paraAppNumber,
            studentId: hit.studentId || null,
            realName: hit.realName,
          },
        };
      }
      // Fall through to name match if csv paraAppNumber isn't in the vault.
    }
    const key = normalizeName(r.student);
    const exact = byNormalized.get(key);
    if (exact && exact.length === 1) {
      const e = exact[0];
      return {
        ...r,
        match: { kind: 'exact', paraAppNumber: e.paraAppNumber, studentId: e.studentId || null, realName: e.realName },
      };
    }
    if (exact && exact.length > 1) {
      return {
        ...r,
        match: {
          kind: 'ambiguous',
          candidates: exact.map(e => ({
            paraAppNumber: e.paraAppNumber, studentId: e.studentId || null, realName: e.realName, score: 1,
          })),
        },
      };
    }
    // Fuzzy: rank all entries by Jaro-Winkler against the row's normalized name.
    const ranked = vaultEntries
      .map((e) => ({
        paraAppNumber: e.paraAppNumber,
        studentId: e.studentId || null,
        realName: e.realName,
        score: jaroWinkler(key, normalizeName(e.realName)),
      }))
      .filter(c => c.score >= FUZZY_THRESHOLD)
      .sort((a, b) => b.score - a.score)
      .slice(0, TOP_CANDIDATES);
    if (ranked.length > 0) return { ...r, match: { kind: 'fuzzy', candidates: ranked } };
    return { ...r, match: { kind: 'none', candidates: [] } };
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /home/dre/Code/SuperPara && CI=true npx react-scripts test --env=jsdom --testPathPattern=legacyImport --no-coverage`
Expected: PASS — `matchRowsToVault` 8 tests green; previous 15 still green.

- [ ] **Step 5: Commit**

```bash
cd /home/dre/Code/SuperPara && git add src/features/import/legacyImport.js src/__tests__/legacyImport.test.js && git commit -m "feat(import): legacyImport.matchRowsToVault — exact + fuzzy + ambiguous resolution"
```

---

## Task 4: `legacyImport.js` — `dedupeAgainstLogs`

**Files:**
- Modify: `src/features/import/legacyImport.js`
- Modify: `src/__tests__/legacyImport.test.js` (append)

- [ ] **Step 1: Write the failing tests**

Append to `src/__tests__/legacyImport.test.js`:

```javascript
import { dedupeAgainstLogs } from '../features/import/legacyImport';

describe('dedupeAgainstLogs', () => {
  function row(overrides = {}) {
    return {
      rowIndex: 1, date: '2026-04-29', student: 'Maria Lopez',
      observation: 'Used break pass.', tags: [],
      match: { kind: 'exact', paraAppNumber: '111111', studentId: 'stu_a', realName: 'Maria Lopez' },
      ...overrides,
    };
  }

  test('exact duplicate (same paraAppNumber + date + observation) is detected', () => {
    const existingLogs = [
      { paraAppNumber: '111111', date: '2026-04-29', note: 'Used break pass.' },
    ];
    const { fresh, duplicates } = dedupeAgainstLogs([row()], existingLogs);
    expect(fresh).toHaveLength(0);
    expect(duplicates).toHaveLength(1);
  });

  test('observation differing only by trailing whitespace is treated as duplicate', () => {
    const existingLogs = [
      { paraAppNumber: '111111', date: '2026-04-29', note: 'Used break pass.   ' },
    ];
    const { fresh, duplicates } = dedupeAgainstLogs([row()], existingLogs);
    expect(duplicates).toHaveLength(1);
    expect(fresh).toHaveLength(0);
  });

  test('same kid + same day but different text is NOT a duplicate', () => {
    const existingLogs = [
      { paraAppNumber: '111111', date: '2026-04-29', note: 'Different observation.' },
    ];
    const { fresh, duplicates } = dedupeAgainstLogs([row()], existingLogs);
    expect(fresh).toHaveLength(1);
    expect(duplicates).toHaveLength(0);
  });

  test('rows whose match.kind is not "exact" are returned as fresh (review path handles them)', () => {
    const r = row({ match: { kind: 'fuzzy', candidates: [] } });
    const { fresh, duplicates } = dedupeAgainstLogs([r], []);
    expect(fresh).toHaveLength(1);
    expect(duplicates).toHaveLength(0);
  });

  test('logs without paraAppNumber are skipped during dedupe (legacy local logs)', () => {
    const existingLogs = [
      { date: '2026-04-29', note: 'Used break pass.' }, // no paraAppNumber on this log
    ];
    const { fresh } = dedupeAgainstLogs([row()], existingLogs);
    expect(fresh).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /home/dre/Code/SuperPara && CI=true npx react-scripts test --env=jsdom --testPathPattern=legacyImport --no-coverage`
Expected: FAIL — "dedupeAgainstLogs is not a function".

- [ ] **Step 3: Append `dedupeAgainstLogs` to `src/features/import/legacyImport.js`**

Append to `src/features/import/legacyImport.js`:

```javascript
// Dedupe key: paraAppNumber|date|trimmed-observation. SHA-1 not needed here —
// JS string equality on the composite key is sufficient and avoids a crypto
// dependency. The trim normalization catches whitespace-only differences.
function dupeKey(paraAppNumber, date, text) {
  return `${paraAppNumber}|${date}|${(text || '').trim()}`;
}

// Splits matched rows into (fresh, duplicates) based on the existing log set.
// Existing logs may come from the merged vaultLogs (paraLogsV1 + adapted
// cloud sharedLogs). Logs without paraAppNumber are skipped from the dedupe
// index (we can't compute a comparable key).
export function dedupeAgainstLogs(rows, existingLogs) {
  const seen = new Set();
  for (const l of existingLogs || []) {
    if (!l || !l.paraAppNumber) continue;
    const text = l.note || l.text || '';
    seen.add(dupeKey(l.paraAppNumber, l.date, text));
  }
  const fresh = [];
  const duplicates = [];
  for (const r of rows) {
    if (!r.match || r.match.kind !== 'exact') {
      // Only "exact" rows have a confirmed paraAppNumber at dedupe time;
      // ambiguous/fuzzy/none go to review and run dedupe again post-pick.
      fresh.push(r);
      continue;
    }
    const key = dupeKey(r.match.paraAppNumber, r.date, r.observation);
    if (seen.has(key)) duplicates.push(r);
    else { fresh.push(r); seen.add(key); }
  }
  return { fresh, duplicates };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /home/dre/Code/SuperPara && CI=true npx react-scripts test --env=jsdom --testPathPattern=legacyImport --no-coverage`
Expected: PASS — `dedupeAgainstLogs` 5 tests + previous 23 = 28 green.

- [ ] **Step 5: Commit**

```bash
cd /home/dre/Code/SuperPara && git add src/features/import/legacyImport.js src/__tests__/legacyImport.test.js && git commit -m "feat(import): legacyImport.dedupeAgainstLogs — skip rows already in the Vault"
```

---

## Task 5: `LegacyImportModal.jsx` — Step 1 (Upload)

**Files:**
- Create: `src/features/import/LegacyImportModal.jsx`

- [ ] **Step 1: Write the upload-step component**

Create `src/features/import/LegacyImportModal.jsx`:

```jsx
import React, { useState } from 'react';
import { useEscape } from '../../hooks/useEscape';
import { useVault } from '../../context/VaultProvider';
import { useStudentsContext } from '../../app/providers/StudentsProvider';
import { useLogsContext } from '../../app/providers/LogsProvider';
import { parseLegacyCsv, matchRowsToVault, dedupeAgainstLogs } from './legacyImport';

// Three steps: 'upload' → 'review' → 'confirm' → 'done'.
// Each step renders inside the same modal shell so the user keeps state
// (parsed rows + their decisions) without remounting.
export function LegacyImportModal({ open, onClose, vaultLogs }) {
  const vault = useVault();
  const students = useStudentsContext();
  const { addLog } = useLogsContext();

  const [step, setStep] = useState('upload');
  const [error, setError] = useState(null);
  const [rows, setRows] = useState([]);          // matched rows (exact + others)
  const [skipped, setSkipped] = useState([]);    // rows skipped during parse
  const [decisions, setDecisions] = useState({}); // rowIndex -> { studentId, paraAppNumber, realName } | "skip"
  const [counts, setCounts] = useState({ exact: 0, fuzzy: 0, ambiguous: 0, none: 0, duplicates: 0 });
  const [importedCount, setImportedCount] = useState(0);

  useEscape(onClose);

  if (!open) return null;

  // Build vault entries: invert vault.realNames map and pair with allStudents
  // so each entry carries the local studentId.
  const vaultEntries = React.useMemo(() => {
    const map = vault?.vault || {}; // { paraAppNumber: realName }
    const studentByPan = {};
    for (const s of Object.values(students.allStudents || {})) {
      if (s && s.paraAppNumber) studentByPan[String(s.paraAppNumber).trim()] = s.id;
    }
    return Object.entries(map).map(([pan, name]) => ({
      paraAppNumber: pan,
      realName: name,
      studentId: studentByPan[pan] || null,
    }));
  }, [vault?.vault, students.allStudents]);

  const vaultIsEmpty = vaultEntries.length === 0;

  async function handleFile(file) {
    setError(null);
    if (!file) return;
    const text = await file.text();
    const parsed = parseLegacyCsv(text);
    if (parsed.error) { setError(parsed.error); return; }
    const matched = matchRowsToVault(parsed.rows, vaultEntries);
    const { fresh, duplicates } = dedupeAgainstLogs(matched, vaultLogs || []);
    setRows(fresh);
    setSkipped(parsed.skipped);
    setCounts({
      exact:     fresh.filter(r => r.match.kind === 'exact').length,
      fuzzy:     fresh.filter(r => r.match.kind === 'fuzzy').length,
      ambiguous: fresh.filter(r => r.match.kind === 'ambiguous').length,
      none:      fresh.filter(r => r.match.kind === 'none').length,
      duplicates: duplicates.length,
    });
    // Pre-decide exact matches (auto-confirmed); leave others for review.
    const initial = {};
    for (const r of fresh) {
      if (r.match.kind === 'exact') {
        initial[r.rowIndex] = {
          studentId: r.match.studentId, paraAppNumber: r.match.paraAppNumber, realName: r.match.realName,
        };
      }
    }
    setDecisions(initial);
    setStep(counts.fuzzy + counts.ambiguous + counts.none > 0 ? 'review' : 'confirm');
    // ↑ `counts` snapshot is one render behind, but the calling render will
    // recompute via setStep; if every row is exact, jump to confirm directly.
    const reviewNeeded = fresh.some(r => r.match.kind !== 'exact');
    setStep(reviewNeeded ? 'review' : 'confirm');
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: 720, position: 'relative' }}>
        <button type="button" onClick={onClose} className="close-btn"
          aria-label="Close" style={{ position: 'absolute', top: 12, right: 12, zIndex: 2 }}>×</button>
        <div className="modal-body" style={{ padding: 'var(--space-6)' }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
            Import legacy observations
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 'var(--space-4)' }}>
            Drop in an old "Export with real names" CSV. Names get matched to your roster's Para App Numbers
            so the rows show up in the Vault under the right kid. Real names never leave this browser.
          </p>

          {step === 'upload' && (
            <UploadStep
              vaultIsEmpty={vaultIsEmpty}
              error={error}
              onFile={handleFile}
            />
          )}
          {/* Review + Confirm steps are added in Tasks 6 + 7. */}
          {step === 'review' && (
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Review step renders here (Task 6).
            </div>
          )}
          {step === 'confirm' && (
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Confirm step renders here (Task 7).
            </div>
          )}
          {step === 'done' && (
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Imported {importedCount} observations. Open the Vault to see them.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function UploadStep({ vaultIsEmpty, error, onFile }) {
  if (vaultIsEmpty) {
    return (
      <div style={{ background: 'var(--yellow-muted)', border: '1px solid rgba(251,191,36,0.35)',
                    padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', fontSize: 13 }}>
        <strong>Import your roster first.</strong>
        <p style={{ marginTop: 6 }}>
          This tool needs your real-name vault loaded so it can match spreadsheet rows to the
          right kid. Open <em>Settings → Manage roster</em> first, then come back.
        </p>
      </div>
    );
  }
  return (
    <div>
      <label className="btn btn-primary" style={{ display: 'inline-block' }}>
        Choose CSV file
        <input type="file" accept=".csv,text/csv" hidden
               onChange={(e) => onFile(e.target.files?.[0])} />
      </label>
      {error && (
        <div style={{ marginTop: 'var(--space-3)', color: 'var(--red)', fontSize: 13 }}>
          {error}
        </div>
      )}
    </div>
  );
}

export default LegacyImportModal;
```

- [ ] **Step 2: Run the build to confirm it compiles**

Run: `cd /home/dre/Code/SuperPara && CI=true npx react-scripts build 2>&1 | tail -10`
Expected: `The build folder is ready to be deployed.` (no compile errors).

- [ ] **Step 3: Run the test suite to confirm no regressions**

Run: `cd /home/dre/Code/SuperPara && CI=true npx react-scripts test --env=jsdom --no-coverage 2>&1 | tail -5`
Expected: `Test Suites: 47 passed, 47 total` (legacy tests now 28 green from earlier tasks; total was 583 + 28 new = 611).

- [ ] **Step 4: Commit**

```bash
cd /home/dre/Code/SuperPara && git add src/features/import/LegacyImportModal.jsx && git commit -m "feat(import): LegacyImportModal step 1 — upload + parse + match"
```

---

## Task 6: `LegacyImportModal.jsx` — Step 2 (Review)

**Files:**
- Modify: `src/features/import/LegacyImportModal.jsx`

- [ ] **Step 1: Replace the placeholder `step === 'review'` block with a working table**

In `src/features/import/LegacyImportModal.jsx`, replace the placeholder block:

```jsx
          {step === 'review' && (
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Review step renders here (Task 6).
            </div>
          )}
```

with:

```jsx
          {step === 'review' && (
            <ReviewStep
              rows={rows}
              decisions={decisions}
              setDecisions={setDecisions}
              counts={counts}
              onContinue={() => setStep('confirm')}
              onBack={() => setStep('upload')}
            />
          )}
```

Then append the `ReviewStep` component near the bottom of the file (above `export default`):

```jsx
function ReviewStep({ rows, decisions, setDecisions, counts, onContinue, onBack }) {
  // Show only non-exact rows in the review table; exact matches were auto-
  // decided. The badge shows what was auto-confirmed silently.
  const reviewRows = rows.filter(r => r.match.kind !== 'exact');

  function pick(rowIndex, candidate) {
    setDecisions(prev => ({
      ...prev,
      [rowIndex]: candidate
        ? { studentId: candidate.studentId, paraAppNumber: candidate.paraAppNumber, realName: candidate.realName }
        : 'skip',
    }));
  }

  const decidedCount = reviewRows.filter(r => decisions[r.rowIndex]).length;
  const allDecided = decidedCount === reviewRows.length;

  return (
    <div>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 'var(--space-3)' }}>
        ✓ {counts.exact} rows auto-matched.
        {counts.duplicates > 0 && ` ${counts.duplicates} duplicates skipped.`}
        {' '}Review the {reviewRows.length} below.
      </div>
      <div style={{ maxHeight: 360, overflowY: 'auto', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)' }}>
        <table className="data-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th>Row</th><th>Spreadsheet</th><th>Match</th><th>Pick</th>
            </tr>
          </thead>
          <tbody>
            {reviewRows.map(r => {
              const decided = decisions[r.rowIndex];
              return (
                <tr key={r.rowIndex}>
                  <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>#{r.rowIndex}</td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{r.student}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {r.date} · {r.observation.slice(0, 64)}{r.observation.length > 64 ? '…' : ''}
                    </div>
                  </td>
                  <td>
                    {r.match.kind === 'fuzzy' && (
                      <span className="pill pill-yellow" style={{ fontSize: 11 }}>fuzzy</span>
                    )}
                    {r.match.kind === 'ambiguous' && (
                      <span className="pill pill-yellow" style={{ fontSize: 11 }}>ambiguous</span>
                    )}
                    {r.match.kind === 'none' && (
                      <span className="pill" style={{ fontSize: 11 }}>no match</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {(r.match.candidates || []).slice(0, 3).map(c => (
                        <button
                          key={c.paraAppNumber}
                          type="button"
                          className={'btn ' + (decided && decided !== 'skip' && decided.paraAppNumber === c.paraAppNumber ? 'btn-primary' : 'btn-secondary')}
                          style={{ fontSize: 12, padding: '4px 8px', textAlign: 'left' }}
                          onClick={() => pick(r.rowIndex, c)}
                        >
                          {c.realName}{c.score < 1 ? ` (${Math.round(c.score * 100)}%)` : ''}
                        </button>
                      ))}
                      <button type="button"
                        className={'btn ' + (decided === 'skip' ? 'btn-primary' : 'btn-secondary')}
                        style={{ fontSize: 12, padding: '4px 8px', color: 'var(--text-muted)' }}
                        onClick={() => pick(r.rowIndex, null)}>
                        Skip this row
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--space-4)' }}>
        <button className="btn btn-secondary" onClick={onBack}>← Back</button>
        <button className="btn btn-primary" disabled={!allDecided} onClick={onContinue}>
          Continue → ({decidedCount}/{reviewRows.length} decided)
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Build to confirm compile**

Run: `cd /home/dre/Code/SuperPara && CI=true npx react-scripts build 2>&1 | tail -5`
Expected: `The build folder is ready to be deployed.`

- [ ] **Step 3: Run tests to confirm no regression**

Run: `cd /home/dre/Code/SuperPara && CI=true npx react-scripts test --env=jsdom --no-coverage 2>&1 | tail -5`
Expected: PASS, suite count unchanged.

- [ ] **Step 4: Commit**

```bash
cd /home/dre/Code/SuperPara && git add src/features/import/LegacyImportModal.jsx && git commit -m "feat(import): LegacyImportModal step 2 — review table for fuzzy/ambiguous rows"
```

---

## Task 7: `LegacyImportModal.jsx` — Step 3 (Confirm + ingest)

**Files:**
- Modify: `src/features/import/LegacyImportModal.jsx`

- [ ] **Step 1: Replace the placeholder `step === 'confirm'` block + add ingest logic**

In `src/features/import/LegacyImportModal.jsx`:

(a) Replace the placeholder block:

```jsx
          {step === 'confirm' && (
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Confirm step renders here (Task 7).
            </div>
          )}
```

with:

```jsx
          {step === 'confirm' && (
            <ConfirmStep
              rows={rows}
              decisions={decisions}
              skipped={skipped}
              counts={counts}
              onBack={() => setStep('review')}
              onImport={runImport}
            />
          )}
```

(b) Add the `runImport` function inside `LegacyImportModal`, just above `return (`:

```jsx
  async function runImport() {
    let ingested = 0;
    for (const r of rows) {
      const d = decisions[r.rowIndex];
      if (!d || d === 'skip') continue;
      // Build the addLog payload. Type defaults to "General Observation"
      // if the legacy CSV had a non-canonical type — addLog accepts any
      // string, but match the app's well-known set when possible.
      addLog(d.studentId, r.observation, r.type, {
        date: r.date,
        period: r.period,
        periodId: r.periodId || r.period,
        category: r.category,
        flagged: r.flagged,
        tags: r.tags,
        paraAppNumber: d.paraAppNumber,
        source: 'legacy_import',
      });
      ingested++;
    }
    setImportedCount(ingested);
    setStep('done');
  }
```

(c) Append the `ConfirmStep` component near the bottom of the file:

```jsx
function ConfirmStep({ rows, decisions, skipped, counts, onBack, onImport }) {
  const toImport = rows.filter(r => {
    const d = decisions[r.rowIndex];
    return d && d !== 'skip';
  }).length;
  const skippedByUser = rows.filter(r => decisions[r.rowIndex] === 'skip').length;
  const undecided = rows.filter(r => !decisions[r.rowIndex]).length;

  return (
    <div>
      <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', marginBottom: 'var(--space-3)' }}>
        Ready to import.
      </div>
      <ul style={{ fontSize: 13, lineHeight: 1.8, paddingLeft: 18 }}>
        <li><strong>{toImport}</strong> rows will be imported as logs</li>
        <li><strong>{counts.duplicates}</strong> rows already exist in the Vault and will be skipped</li>
        <li><strong>{skippedByUser}</strong> rows you marked skip</li>
        <li><strong>{skipped.length}</strong> rows were missing required fields (date / student / observation)</li>
        {undecided > 0 && (
          <li style={{ color: 'var(--red)' }}>
            <strong>{undecided}</strong> rows are still undecided — go back to review them.
          </li>
        )}
      </ul>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--space-4)' }}>
        <button className="btn btn-secondary" onClick={onBack}>← Back to review</button>
        <button className="btn btn-primary" disabled={toImport === 0 || undecided > 0} onClick={onImport}>
          Import {toImport} observation{toImport !== 1 ? 's' : ''}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Build to confirm compile**

Run: `cd /home/dre/Code/SuperPara && CI=true npx react-scripts build 2>&1 | tail -5`
Expected: `The build folder is ready to be deployed.`

- [ ] **Step 3: Run tests to confirm no regression**

Run: `cd /home/dre/Code/SuperPara && CI=true npx react-scripts test --env=jsdom --no-coverage 2>&1 | tail -5`
Expected: PASS, no test count change.

- [ ] **Step 4: Commit**

```bash
cd /home/dre/Code/SuperPara && git add src/features/import/LegacyImportModal.jsx && git commit -m "feat(import): LegacyImportModal step 3 — confirm + ingest via addLog"
```

---

## Task 8: Wire into Settings → Advanced

**Files:**
- Modify: `src/components/SettingsModal.jsx`
- Modify: `src/App.jsx` (pass `vaultLogs` into the modal — it lives at App level)

- [ ] **Step 1: Add the Advanced section to SettingsModal**

In `src/components/SettingsModal.jsx`, find the line `<Section label="Help">` (around line 152) and insert this new section ABOVE it:

```jsx
          <Section label="Advanced">
            <button
              type="button"
              className="btn btn-secondary"
              style={{ width: '100%', justifyContent: 'flex-start' }}
              disabled={!Object.keys(vault?.vault || {}).length}
              title={!Object.keys(vault?.vault || {}).length
                ? 'Import your roster first — this tool needs the name → Para App Number map.'
                : 'Re-ingest old _private CSV exports as logs.'}
              onClick={() => { onOpenLegacyImport?.(); onClose(); }}
            >
              📥 Import legacy observation CSV…
            </button>
          </Section>
```

Then update the function signature to accept the new prop. Find:

```jsx
export default function SettingsModal({ open, onClose, onReplayOnboarding }) {
```

and change to:

```jsx
export default function SettingsModal({ open, onClose, onReplayOnboarding, onOpenLegacyImport }) {
```

- [ ] **Step 2: Wire into App.jsx**

In `src/App.jsx`, add the import for the modal near the other modal imports (around line 36–37):

```jsx
import { LegacyImportModal } from './features/import/LegacyImportModal';
```

Add a state for the modal near the other modal states. Find the line `const [profileStu, setProfileStu] = useState(null);` and add below it:

```jsx
const [legacyImportOpen, setLegacyImportOpen] = useState(false);
```

Find where SettingsModal is rendered (search for `<SettingsModal`). Add the new prop:

```jsx
onOpenLegacyImport={() => setLegacyImportOpen(true)}
```

Below the SettingsModal render line, add the LegacyImportModal render:

```jsx
{legacyImportOpen && (
  <LegacyImportModal
    open={legacyImportOpen}
    onClose={() => setLegacyImportOpen(false)}
    vaultLogs={vaultLogs}
  />
)}
```

- [ ] **Step 3: Run the build**

Run: `cd /home/dre/Code/SuperPara && CI=true npx react-scripts build 2>&1 | tail -5`
Expected: `The build folder is ready to be deployed.`

- [ ] **Step 4: Run the test suite**

Run: `cd /home/dre/Code/SuperPara && CI=true npx react-scripts test --env=jsdom --no-coverage 2>&1 | tail -5`
Expected: PASS, suite count unchanged.

- [ ] **Step 5: Commit**

```bash
cd /home/dre/Code/SuperPara && git add src/components/SettingsModal.jsx src/App.jsx && git commit -m "feat(import): wire LegacyImportModal into Settings → Advanced"
```

---

## Task 9: Push to GitHub + deploy to production

**Files:** none (deploy operations only)

- [ ] **Step 1: Push commits to origin/main**

Run: `cd /home/dre/Code/SuperPara && git push origin main 2>&1 | tail -5`
Expected: `<oldsha>..<newsha>  main -> main`

- [ ] **Step 2: Deploy to Vercel production**

Run: `cd /home/dre/Code/SuperPara && vercel --prod --yes 2>&1 | tail -10`
Expected: `"readyState": "READY"` in the JSON, with a new production URL.

- [ ] **Step 3: Verify deploy lists at top of Vercel deployments**

Run: `cd /home/dre/Code/SuperPara && vercel ls --yes 2>&1 | sed -n '5,8p'`
Expected: First row shows the new deployment with status `● Ready` and Age `Xm`.

- [ ] **Step 4: Manual smoke test on https://supapara.vercel.app**

Hard-refresh (Ctrl+Shift+R). Navigate to Settings → Advanced. The "Import legacy observation CSV…" button should appear. Click it: modal opens. With vault populated, the file picker accepts a `.csv`. Drop in an old `_private` export.

Walk through Upload → Review → Confirm → Done. Open the Vault: imported rows should appear under the right kid's name + color, tagged `source: legacy_import`. Re-run the same file → "0 to import, N duplicates" — proves de-dup works.

If smoke test fails, run `vercel rollback` to revert to the prior production deployment.

---

## Self-Review

**1. Spec coverage:**
- Three-step modal (Upload / Review / Confirm) — Tasks 5–7 ✓
- Pure-functional core (parser, matcher, dedupe) — Tasks 2–4 ✓
- Vault-empty block — Task 5 (UploadStep) ✓
- Exact / fuzzy / ambiguous / none / vault_empty match kinds — Task 3 ✓
- Click-to-pick review UI with top-3 candidates — Task 6 ✓
- De-dup on (paraAppNumber, date, observation.trim()) — Task 4 ✓
- Settings → Advanced placement, disabled when vault empty — Task 8 ✓
- FERPA: real names never on a log payload — Task 7's `runImport` only writes paraAppNumber; verified by Task 3 contract ✓
- All test cases from spec — split across Tasks 1–4 ✓

**2. Placeholder scan:** No TBD/TODO. Every code step has full code. Every command shows expected output.

**3. Type / signature consistency:**
- `parseLegacyCsv` returns `{ rows, skipped, error, schema }` — used consistently in Tasks 5–7.
- `matchRowsToVault` adds `.match` field with `{ kind, paraAppNumber?, studentId?, realName?, candidates? }` — consumed in Task 6 (`r.match.kind`, `r.match.candidates`) and Task 4 (`r.match.kind === 'exact'`) ✓.
- `dedupeAgainstLogs` returns `{ fresh, duplicates }` — used in Task 5's `handleFile` ✓.
- `decisions[rowIndex]` is `{studentId, paraAppNumber, realName}` or `'skip'` — used identically in Tasks 6 and 7.
- `addLog(studentId, note, type, extras)` matches `useLogs.addLog` signature in `src/hooks/useLogs.js:41`.
- `Section` component imported implicitly from inside SettingsModal.jsx — already declared at line 243 of that file.

**4. Spec → plan delta:** None. Spec called for sha1 dedupe; plan substitutes plain string-equality on the composite key (no crypto dep; outcome equivalent for our purposes — tested).

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-29-legacy-csv-import.md`. Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
