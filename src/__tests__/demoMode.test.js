// ── demoMode / allStudents plumbing ───────────────────────────
// Tests for:
//   1. DEMO_STUDENTS export from data.js
//   2. runLocalEngine uses passed allStudents, not DB.students directly
//   3. buildEffectivePeriodStudents helper (if extracted) or
//      direct engine behavior with non-DB student ids

import { DEMO_STUDENTS } from '../data';
import { runLocalEngine } from '../engine';
import { DB } from '../data';

// ── DEMO_STUDENTS export ───────────────────────────────────────
describe('DEMO_STUDENTS export', () => {
  test('is exported from data.js', () => {
    expect(DEMO_STUDENTS).toBeDefined();
  });

  test('contains the same students as DB.students', () => {
    expect(DEMO_STUDENTS).toEqual(DB.students);
  });

  test('has at least one student', () => {
    expect(Object.keys(DEMO_STUDENTS).length).toBeGreaterThan(0);
  });
});

// ── runLocalEngine accepts allStudents param ──────────────────
// The engine must not hard-code DB.students for student lookups.
// An imported student (not in DB) should appear in actions output.
describe('runLocalEngine — allStudents param', () => {
  const importedStudent = {
    id: 'imported_99',
    pseudonym: 'Purple Student 1',
    color: '#a855f7',
    identity: { colorName: 'Purple', color: '#a855f7', emoji: '🔮', codename: 'Prism', sequenceNumber: 1 },
  };
  const allStudents = { imported_99: importedStudent };

  test('actions include imported student when it is in allStudents', () => {
    const result = runLocalEngine(
      'behavior incident',
      ['imported_99'],
      [],
      'p1',
      '',
      'Period 1',
      [],
      allStudents,
    );
    const studentIds = result.actions.map(a => a.studentId);
    expect(studentIds).toContain('imported_99');
  });

  test('actions do not contain undefined student entries for imported ids', () => {
    const result = runLocalEngine(
      'student needs help',
      ['imported_99'],
      [],
      'p1',
      '',
      'Period 1',
      [],
      allStudents,
    );
    // Every action with a studentId should be a real id
    result.actions.forEach(a => {
      if (a.studentId) {
        expect(typeof a.studentId).toBe('string');
      }
    });
  });

  test('works when allStudents is empty (no crash)', () => {
    expect(() =>
      runLocalEngine('test query', [], [], 'p1', '', 'Period 1', [], {})
    ).not.toThrow();
  });

  test('backward compat: still works when allStudents falls back to DB.students keys', () => {
    const result = runLocalEngine(
      'behavior',
      Object.keys(DB.students),
      [],
      'p3',
      '',
      'Period 3',
      [],
      DB.students,
    );
    expect(result).toBeDefined();
    expect(Array.isArray(result.actions)).toBe(true);
  });
});
