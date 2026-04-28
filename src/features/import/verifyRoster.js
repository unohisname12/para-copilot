// Roster Health Check — compares a re-uploaded roster CSV to the students
// currently in the app + the real-name vault, and reports per-row status.
//
// Pure function: no React, no I/O, no side effects. Easy to test and to wire
// into either a UI button or a future cloud-side audit job.

import { parseRosterCsv, dedupeAndValidate } from './rosterParsers';

const STATUSES = ['linked', 'missing', 'orphan', 'collision', 'noPeriod'];

function emptySummary() {
  return STATUSES.reduce((acc, k) => { acc[k] = 0; return acc; }, {});
}

// imported: { [id]: student } — what's in paraImportedStudentsV1
// vault:    { [paraAppNumber]: realName } — what's in the IndexedDB vault
// csvText:  raw text of the user-uploaded roster CSV
export function verifyRoster({ imported, vault, csvText }) {
  const errors = [];
  const rows = [];
  const summary = emptySummary();

  const { entries: rawEntries, errors: parseErrors } = parseRosterCsv(csvText || '');
  if (parseErrors && parseErrors.length) errors.push(...parseErrors);
  if (!rawEntries.length) {
    if (!errors.length) errors.push('CSV is empty or unreadable.');
    return { rows, summary, errors };
  }

  // Detect duplicate paraAppNumbers in the CSV itself
  const numberCounts = new Map();
  rawEntries.forEach(e => {
    const k = String(e.paraAppNumber).trim();
    numberCounts.set(k, (numberCounts.get(k) || 0) + 1);
  });

  // Build paraAppNumber → student lookup from importedStudents
  const importedByNumber = new Map();
  Object.values(imported || {}).forEach(s => {
    const key = (s?.paraAppNumber || s?.externalKey || '').toString().trim();
    if (key) importedByNumber.set(key, s);
  });

  const seenInImport = new Set();

  // 1. One row per CSV entry — either linked / missing / collision
  rawEntries.forEach(e => {
    const number = String(e.paraAppNumber).trim();
    const isCollision = (numberCounts.get(number) || 0) > 1;
    if (isCollision) {
      rows.push({
        realName: e.realName,
        paraAppNumber: number,
        status: 'collision',
        detail: `paraAppNumber ${number} appears ${numberCounts.get(number)} times in the CSV`,
      });
      summary.collision += 1;
      return;
    }
    const stu = importedByNumber.get(number);
    if (!stu) {
      rows.push({
        realName: e.realName,
        paraAppNumber: number,
        status: 'missing',
        detail: 'in your CSV but not loaded into the app',
      });
      summary.missing += 1;
      return;
    }
    seenInImport.add(stu.id);
    const hasPeriod = stu.periodId && String(stu.periodId).trim();
    if (!hasPeriod) {
      rows.push({
        realName: e.realName,
        paraAppNumber: number,
        status: 'noPeriod',
        studentId: stu.id,
        pseudonym: stu.pseudonym,
        detail: 'loaded but not assigned to any class period',
      });
      summary.noPeriod += 1;
      return;
    }
    rows.push({
      realName: e.realName,
      paraAppNumber: number,
      status: 'linked',
      studentId: stu.id,
      pseudonym: stu.pseudonym,
      periodId: stu.periodId,
      detail: `linked → ${stu.pseudonym} (${stu.periodId})`,
    });
    summary.linked += 1;
  });

  // 2. Add rows for orphans — imported kids whose number is NOT in the CSV
  Object.values(imported || {}).forEach(s => {
    if (seenInImport.has(s.id)) return;
    const number = (s?.paraAppNumber || s?.externalKey || '').toString().trim();
    if (!number) return;
    rows.push({
      realName: vault?.[number] || '(unknown)',
      paraAppNumber: number,
      status: 'orphan',
      studentId: s.id,
      pseudonym: s.pseudonym,
      detail: 'loaded into the app but not in the CSV — likely from a prior import',
    });
    summary.orphan += 1;
  });

  return { rows, summary, errors };
}
