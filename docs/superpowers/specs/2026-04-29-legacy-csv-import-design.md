# Legacy CSV Import — Design

**Status:** approved 2026-04-29 · **Owner:** Mr. Dre · **Skill:** superpowers:brainstorming

## Context

Mr. Dre has months of testing data sitting in old `_private` SuperPara CSV exports. Before tonight's `paraAppNumber` bridge shipped, those exports captured real student names + observation text + dates but never carried the `paraAppNumber` (the column didn't exist). The data is real, useful, FERPA-clean — and right now it's stuck on disk because there's no way back into the app.

This feature is a one-off recovery tool: drop in an old `_private` CSV, the app matches each row's real name against the local **`realNameVault`** (IndexedDB) to recover the kid's `paraAppNumber`, then re-creates the row as a normal log via the same `addLog` path that handles a fresh observation today. After import, the rows live in `paraLogsV1` + Supabase `logs` indistinguishably from logs typed in directly — same paraAppNumber bridge, same Vault rendering, same CSV exports.

It is intentionally **placed under Settings → Advanced** because:

- It's a recovery tool, not a daily flow.
- It can write a meaningful amount of cloud data in one click; that warrants a deliberate path, not a sidebar shortcut.
- "Advanced" signals to a future user (paraprofessional, not engineer) that the feature has more knobs and a bigger blast radius than other UI elements.

## Architecture

A three-step modal launched from Settings → Advanced. All work runs in the browser; no server-side ingestion. The vault must already be populated (i.e. the user has imported their roster at some point on this device) — the modal blocks otherwise.

Three layers:

1. **Pure-functional core** (`legacyImport.js`) — parser, matcher, de-duper. No React, no DOM, no async. All inputs in, all outputs out. This is the layer the unit tests exercise.
2. **UI shell** (`LegacyImportModal.jsx`) — three-step modal: Upload → Review → Confirm. Calls into the core for compute, into existing `useLogs.addLog` for ingestion.
3. **Settings entry point** (`SettingsModal.jsx`) — one button under a new "Advanced" section. Disabled when the vault is empty, with a tooltip pointing the user to import their roster first.

The pure-functional core never sees React state and never touches the network. The UI shell never inlines parsing or matching logic. This boundary makes the core testable without jsdom and makes the UI's job trivial.

## File-by-file breakdown

| File | New/Mod | Purpose |
|---|---|---|
| `src/features/import/legacyImport.js` | New | `parseLegacyCsv(text) → rows[]`, `matchRowsToVault(rows, vaultEntries) → matches[]`, `dedupeAgainstLogs(rows, existingLogs) → { fresh, duplicates }`. Pure functions. |
| `src/utils/fuzzyMatch.js` | New | Tiny Jaro-Winkler implementation (~30 lines). No new npm dependency. Exports `jaroWinkler(a, b) → number in [0,1]` and `normalizeName(s) → string` (lowercase, strip diacritics, collapse whitespace, drop punctuation). |
| `src/features/import/LegacyImportModal.jsx` | New | Modal UI. Three steps: Upload (file picker + parse + first stats), Review (table of fuzzy/unmatched rows with click-to-pick), Confirm (final counts + Import button). Uses `useLogsContext` for the ingest path. |
| `src/components/SettingsModal.jsx` | Modify | Add an "Advanced" section with a single entry: "Import legacy observation CSV." Disabled state shows a tooltip directing to the roster importer when vault is empty. |
| `src/__tests__/legacyImport.test.js` | New | ~15 unit tests covering parser, matcher, dedupe, FERPA invariants. |

## Data flow

```
Settings → Advanced → "Import legacy CSV"
    ↓
LegacyImportModal opens
    ↓ (vault empty? → block with redirect message)
Step 1 — Upload
    user picks one .csv file
    parseLegacyCsv(text) → rows[]                  // pure function
    matchRowsToVault(rows, vaultEntries) → matches // pure function
    dedupeAgainstLogs(rows, vaultLogs) → splits    // pure function
    ↓
Step 2 — Review
    auto-confirmed rows shown as count badge
    review table renders only fuzzy + unmatched rows
    each row: top-3 candidates, click-to-pick or skip
    ↓
Step 3 — Confirm
    show final counts: M to import, K skipped, D duplicates
    user clicks Import
    ↓
For each confirmed non-dup row:
    addLog(studentId, note, type, {
        date, period, periodId, category, tags, flagged,
        paraAppNumber,
        source: "legacy_import",
    })
    → existing path: setLogs (paraLogsV1) + onLogCreated (cloud push)
    ↓
Done modal: "Imported M observations. Open the Vault to see them."
```

### Match resolution rules

For each row, after `normalizeName(row.Student)`:

1. **Exact** — normalized name matches exactly one vault entry → auto-confirm. `match = { kind: "exact", paraAppNumber, studentId }`.
2. **Exact-but-ambiguous** — normalized name matches >1 vault entry (two real "Maria Lopez"s). → review, all matches as candidates. `match = { kind: "ambiguous", candidates }`.
3. **Fuzzy** — no exact, top fuzzy candidates with `jaroWinkler >= 0.85`. → review, top 3. `match = { kind: "fuzzy", candidates }`.
4. **None** — no candidate above threshold. → review, "no candidate" row, only action is "skip." `match = { kind: "none" }`.

### De-dup hash

```
sha1(`${paraAppNumber}|${date}|${observation.trim()}`)
```

Computed across `vaultLogs` (the merged paraLogsV1 + cloud sharedLogs from the existing `vaultLogs` useMemo in App.jsx). Re-importing the same file → all rows surface as duplicates → zero writes. Importing a partially-overlapping file → only fresh rows write.

## CSV format

Pre-fix `_private` export schema (the format Mr. Dre's existing backups use):

```
Date,Period,Student,Type,Category,Flagged,Tags,Observation
"2026-04-29","Period 3 — Math 2","Maria Lopez","Behavior Note","behavior","No","break;regulation","Used break pass."
```

Parser uses standard quote escaping (RFC 4180). Header row required and validated — if the first line isn't `Date,Period,Student,Type,Category,Flagged,Tags,Observation`, modal shows "this doesn't look like a SuperPara private export" and bails. The post-fix schema (with `Period ID` and `Para App Number` columns) is also accepted; extra columns are ignored. Tags are split on `;`.

## FERPA invariants

- Real names are read from the CSV in the browser. They are mapped to `paraAppNumber` via the vault. **Real names are never written to a log object** and never sent to the network. The created log carries only `paraAppNumber` + the existing FERPA-safe fields.
- Real names are never persisted by this feature. The CSV file content is held in component state for the duration of the modal session and discarded on close.
- The vault itself is unchanged by this feature — it's a read-only consumer of vault entries.

## Edge cases (and how they're handled)

| Case | Behavior |
|---|---|
| Vault empty | Modal blocks, points user to roster import. No upload allowed. |
| CSV header doesn't match expected shape | "This doesn't look like a SuperPara private export" — bail, no parsing. |
| Row missing required field (Date, Student, Observation) | Skip with reason logged; counted in Step 3 summary. User can download a "skipped rows" CSV. |
| Date in the future | Skip with reason "future date — not a legacy record." |
| Two real "Maria Lopez"s in vault | Treated as ambiguous; user picks. |
| Name with accents (López, García) | `normalizeName` strips diacritics before comparison; matches accented and unaccented variants. |
| User imports the same file twice | All rows surface as duplicates in Step 3; zero writes. |
| User cancels mid-flow | Component state discarded. No partial writes. |

## Tests

`src/__tests__/legacyImport.test.js`:

- **Parser** (5 cases): standard well-formed CSV; embedded quotes; embedded commas in quoted fields; empty Tags column; missing-header rejection.
- **Matcher** (6 cases): exact match; case + whitespace + diacritic insensitivity; fuzzy match at threshold; fuzzy below threshold returns `none`; ambiguous duplicate names; vault-empty input.
- **Dedupe** (3 cases): exact duplicate skipped; observation differing by trailing whitespace treated as duplicate; same paraAppNumber + same date but different text = NOT duplicate.
- **FERPA invariant** (1 case): output of `addLog` payloads contains `paraAppNumber` but NEVER `realName`.

Total ~15 cases. All pure-function tests, no jsdom required.

## Out of scope (explicit)

- **Multi-file batch import.** v1 is one file at a time. If Mr. Dre has 12 weekly backup files, he runs the flow 12 times. Multi-file can be added later.
- **`.xlsx` support.** v1 is CSV only. The app already exports `.xlsx`, but importing it requires a parser dep we don't need today.
- **Editing legacy rows after import.** Once imported, the rows are normal logs. The Vault's existing edit/delete handles them.
- **Backfilling existing `paraLogsV1` orphan logs.** That's a separate concern; tonight's `useLogs` backfill already covers stale-`paraAppNumber` repair on hydration.
- **Cloud-side dedupe.** De-dup runs against the local `vaultLogs` set (which already includes pulled cloud logs). We don't query Supabase directly for dedup.

## Verification

1. Run `npm test` — `legacyImport.test.js` passes alongside the existing 583.
2. Manual: drop an old `_private` export into the modal. Auto-match count should be plausible. Pick one fuzzy candidate, skip one, confirm. Open the Vault — the imported rows show with the right kid's name + color, tagged `source: legacy_import`. Re-run the same file → all rows surface as duplicates → "0 imported."
3. Supabase dashboard: confirm cloud `logs` row count matches the local imported count + previous baseline.

## Acceptance

This spec is approved if:

- Step 1-3 modal flow matches the data-flow diagram above.
- Real names never appear in any log object or network payload.
- Re-importing the same file is a no-op.
- The `legacyImport.js` core has no React imports.
