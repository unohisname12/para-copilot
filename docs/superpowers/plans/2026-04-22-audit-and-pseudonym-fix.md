# Audit + Deterministic Pseudonyms — Plan

**Date:** 2026-04-22
**Branch:** feat/ui-reskin
**Goal:** (1) make pseudonyms deterministic from Para App Number; (2) find and fix bugs before the user demos this.

---

## Part 1 — Deterministic pseudonyms (Option B)

**Today:** `generatePseudonymSet(uniqueNames)` assigns palette entries in the order names appear. First para to import a bundle decides who's "Red Student 1"; another para may land on a different pseudonym for the same kid.

**Target:** When a student has a `paraAppNumber`, pseudonym + color derive deterministically from it. Any para on any device, at any time, sees the same pseudonym for that kid. No migration burden on the admin — they only have to assign Para App Numbers (which they already do).

**Algorithm:**
```
paletteIndex = hash(paraAppNumber) % palette.length
sequenceInBucket = (hash(paraAppNumber + "seq") % 99) + 1
pseudonym = `${palette[paletteIndex].codename} ${sequenceInBucket}`
color     = palette[paletteIndex].hex
```

**Override:** if the roster entry already carries a `pseudonym` field, honor it (admin choice wins).

**Fallback:** if no `paraAppNumber` is present on the entry, use the existing first-come palette cycle (unchanged behavior for legacy imports).

**Touch points:**
- `src/models/index.js` `generatePseudonymSet` — accept optional per-name `paraAppNumber`/`pseudonym` inputs. Derive per-entry.
- Callers: `buildIdentityRegistry`, `buildIdentityRegistryFromMasterRoster` — pass paraAppNumber alongside name.
- Tests: new test file asserting same `paraAppNumber` → same pseudonym regardless of input order.

---

## Part 2 — Audit scope

### Known user-reported issues
1. **Vault: clicking a student name in the log table → errors.** Suspects: `setProfileStu(l.studentId)` opens `StudentProfileModal` with a possibly-missing student (roster changed since log was created). Modal may crash on undefined fields.
2. **Stale/old data in Data Vault.** Demo data sticking around, logs for now-absent students, no obvious "start fresh" action.

### Additional sweep (Playwright-driven)
Run a headless Chromium pass against `http://localhost:3000` that:
- Loads the app, captures all console errors/warnings during mount.
- Navigates each main view (Dashboard, Vault, Analytics, IEP Import, Simple Mode).
- Clicks every visible top-level button.
- In the Vault, clicks the first visible student-name cell.
- Opens each Advanced Import tab.
- Captures a screenshot per view and a full console log.

### Manual code read
Focus on these known hazard areas:
- `getStudentLabel` / `resolveLabel` with `null`/`undefined` student.
- `allStudents[log.studentId]` lookups when the log is older than current roster.
- Pseudonym-keyed lookups colliding after new identity system.
- Missing keys on modals (e.g. `studentData` prop undefined).
- Any `student.pseudonym` access without null guard.

---

## Part 3 — Fix strategy

1. **Orphan log guard:** in the Vault render and everywhere we look up a student by id, render a clear "unknown / deleted" chip instead of blowing up. Click handler should open nothing, or a "missing student" banner.
2. **"Start fresh" escape hatch:** a single button that clears logs, case memory, imported students, KB docs, identity registry, and (optionally) the real-name vault. Double-confirm. Essential for demo hygiene.
3. **Tighten `getStudentLabel`** to never crash.
4. **Explicit demo-data marker** — make the "Clear Demo Data" control more visible (the Dashboard has a ShowcaseBanner; Vault doesn't surface it).

---

## Part 4 — Deliverables

1. Commit: Option B implementation + tests.
2. Commit(s): each bug fix individually with a clear message.
3. `docs/superpowers/audits/2026-04-22-findings.md` — structured list of everything found (severity, file, repro, fix).
4. Final summary reply listing:
   - What was fixed
   - What was found but deferred (with reason)
   - What I couldn't reproduce

---

## Order of operations

1. Implement Option B + unit tests.
2. Write Playwright audit script.
3. Run audit, capture raw output.
4. Read code around user-reported issues.
5. Fix findings.
6. Write `findings.md`.
7. Re-run Playwright to verify fixes land.
8. Report back.
