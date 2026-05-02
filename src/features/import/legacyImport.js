// Pure-functional core for legacy CSV import. No React. No DOM. No async.
// Input: CSV text (and supporting context). Output: structured rows ready
// for the modal to display + ingest.
//
// Three exported functions:
//   parseLegacyCsv(text)          → { rows, skipped, error }
//   matchRowsToVault(rows, ...)   → matchedRows[]   (Task 3)
//   dedupeAgainstLogs(rows, ...)  → { fresh, duplicates }  (Task 4)

import { normalizeName, jaroWinkler } from '../../utils/fuzzyMatch';

const PRE_FIX_HEADER = 'Date,Period,Student,Type,Category,Flagged,Tags,Observation';
const POST_FIX_HEADER = 'Date,Period,Period ID,Student,Para App Number,Type,Category,Flagged,Tags,Observation';

// RFC 4180 line splitter: respects quoted fields containing newlines, commas,
// and "" escapes. Returns { rows, truncated } where truncated indicates an
// unterminated quoted field (data loss).
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
  return { rows, truncated: inQuotes };
}

export function parseLegacyCsv(text) {
  if (!text || typeof text !== 'string') {
    return { rows: [], skipped: [], error: "This doesn't look like a SuperPara private export — empty file." };
  }
  // Fix 1: Strip leading BOM (e.g., from Excel-saved CSV files)
  const cleaned = String(text).replace(/^﻿/, '');
  const { rows: allRows, truncated } = splitCsv(cleaned);

  // Fix 2: Detect unterminated quoted field
  if (truncated) {
    return { rows: [], skipped: [], error: "This file looks corrupted — a quoted field never closed." };
  }

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
    csvParaAppNumber: idx('Para App Number'), // -1 in pre-fix (renamed for symmetry)
  };

  const rows = [];
  const skipped = [];
  for (let r = 1; r < allRows.length; r++) {
    const cells = allRows[r];
    // Fix 3: Detect column-count mismatch per data row
    if (cells.length !== headerCells.length) {
      skipped.push({ rowIndex: r, reason: 'column count mismatch' });
      continue;
    }
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
      csvParaAppNumber: I.csvParaAppNumber >= 0 ? ((cells[I.csvParaAppNumber] || '').trim() || null) : null,
    });
  }
  return { rows, skipped, error: null, schema };
}

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
    const key = (r.student || '').toLowerCase();
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

// Dedupe key: paraAppNumber|date|trimmed-observation. Plain string equality
// on the composite key — no crypto dep needed and equivalent for our scale.
// Trim normalization catches whitespace-only differences.
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
