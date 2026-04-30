// Log-layer reconnect tests — paraAppNumber as the stable bridge.
//
// Scenario: Mr. Dre logs notes against students. He clears his computer,
// re-imports the same roster (same paraAppNumbers, but local studentIds
// regenerate). Old logs must still resolve to the right kid by
// paraAppNumber — the existing rosterReconnect logic runs at the student
// registry layer; these tests assert the same FERPA-safe bridge runs at
// the log layer (and through to CSV export).

import { createLog } from '../models';
import { resolveStudentByParaAppNumber } from '../features/roster/rosterUtils';
import { toLogRow } from '../services/teamSync';
import { buildCsvText } from '../utils/exportCSV';

describe('createLog — paraAppNumber field', () => {
  test('round-trips paraAppNumber when provided', () => {
    const log = createLog({
      studentId: 'stu_imp_111',
      type: 'Behavior Note',
      note: 'Used break pass.',
      date: '2026-04-29',
      period: 'Period 3 — Math 2',
      periodId: 'p3',
      paraAppNumber: '847293',
    });
    expect(log.paraAppNumber).toBe('847293');
  });

  test('defaults paraAppNumber to null when omitted', () => {
    const log = createLog({
      studentId: 'stu_imp_111',
      type: 'Behavior Note',
      note: 'note',
      date: '2026-04-29',
      period: 'p3',
      periodId: 'p3',
    });
    expect(log.paraAppNumber).toBeNull();
  });
});

describe('resolveStudentByParaAppNumber', () => {
  const allStudents = {
    stu_a: { id: 'stu_a', pseudonym: 'Red Student 1',  paraAppNumber: '111111' },
    stu_b: { id: 'stu_b', pseudonym: 'Blue Student 1', paraAppNumber: '222222' },
    stu_c: { id: 'stu_c', pseudonym: 'Green Student 1' /* no paraAppNumber */ },
  };

  test('returns the student when paraAppNumber matches', () => {
    expect(resolveStudentByParaAppNumber(allStudents, '111111')?.id).toBe('stu_a');
    expect(resolveStudentByParaAppNumber(allStudents, '222222')?.id).toBe('stu_b');
  });

  test('returns null when paraAppNumber is missing or unknown', () => {
    expect(resolveStudentByParaAppNumber(allStudents, null)).toBeNull();
    expect(resolveStudentByParaAppNumber(allStudents, '')).toBeNull();
    expect(resolveStudentByParaAppNumber(allStudents, '999999')).toBeNull();
  });

  test('coerces numeric paraAppNumbers to strings before comparing', () => {
    // Some import paths leave paraAppNumber as a number; the lookup must still match.
    expect(resolveStudentByParaAppNumber(allStudents, 111111)?.id).toBe('stu_a');
  });
});

describe('toLogRow — external_key surfaces paraAppNumber on cloud rows', () => {
  test('includes external_key from log.paraAppNumber', () => {
    const row = toLogRow('team_xyz', 'user_abc', {
      studentDbId: null, // simulating the post-clear case where no DB row was found locally
      type: 'Goal Progress',
      note: 'Nailed the fraction problem.',
      date: '2026-04-29',
      periodId: 'p3',
      paraAppNumber: '847293',
    });
    expect(row.external_key).toBe('847293');
    expect(row.team_id).toBe('team_xyz');
    expect(row.user_id).toBe('user_abc');
  });

  test('external_key is null when no paraAppNumber is on the log', () => {
    const row = toLogRow('team_xyz', 'user_abc', {
      studentDbId: 'db-uuid-1',
      type: 'Behavior Note',
      note: 'note',
      date: '2026-04-29',
      periodId: 'p3',
    });
    expect(row.external_key).toBeNull();
  });
});

describe('profile-modal-style filter — paraAppNumber bridges stale studentIds', () => {
  // Mirrors StudentProfileModalInner's stuLogs filter — matches by studentId
  // OR by paraAppNumber so a log written under a previous local id still
  // shows up in the current student's profile.
  const studentId = 'stu_current';
  const student = { id: 'stu_current', pseudonym: 'Red Student 1', paraAppNumber: '847293' };
  const logs = [
    { id: 'l_local_today', studentId: 'stu_current',     paraAppNumber: '847293', note: 'Extra time' },
    { id: 'l_cloud_old1',  studentId: 'stu_previous_id', paraAppNumber: '847293', note: 'Did not wear glasses' },
    { id: 'l_cloud_old2',  studentId: 'stu_other',       paraAppNumber: '847293', note: 'Not sure if she learned today' },
    { id: 'l_someone_else', studentId: 'stu_other_kid',  paraAppNumber: '999999', note: 'unrelated' },
  ];

  test('matches all three of the kid\'s logs across studentId mismatches', () => {
    const stuLogs = logs.filter(l =>
      l.studentId === studentId
      || (student.paraAppNumber && l.paraAppNumber === student.paraAppNumber)
    );
    expect(stuLogs).toHaveLength(3);
    expect(stuLogs.map(l => l.id).sort()).toEqual(['l_cloud_old1', 'l_cloud_old2', 'l_local_today']);
  });

  test('does not pull in another kid\'s logs', () => {
    const stuLogs = logs.filter(l =>
      l.studentId === studentId
      || (student.paraAppNumber && l.paraAppNumber === student.paraAppNumber)
    );
    expect(stuLogs.find(l => l.id === 'l_someone_else')).toBeUndefined();
  });
});

describe('end-to-end reconnect — log resolves by paraAppNumber after re-import', () => {
  test('a log whose original studentId is gone still finds the kid via paraAppNumber', () => {
    // Pre-clear: log written against a local student.
    const oldStudents = { stu_old: { id: 'stu_old', pseudonym: 'Red Student 1', paraAppNumber: '847293' } };
    const log = createLog({
      studentId: 'stu_old',
      type: 'Behavior Note',
      note: 'Self-initiated break.',
      date: '2026-04-29',
      period: 'Period 3',
      periodId: 'p3',
      paraAppNumber: oldStudents.stu_old.paraAppNumber,
    });

    // Local clear + re-import with a new local studentId for the same kid.
    const newStudents = { stu_new: { id: 'stu_new', pseudonym: 'Red Student 1', paraAppNumber: '847293' } };

    // Old studentId no longer exists in the rebuilt roster.
    expect(newStudents[log.studentId]).toBeUndefined();
    // ...but paraAppNumber bridges back to the correct current student record.
    expect(resolveStudentByParaAppNumber(newStudents, log.paraAppNumber)?.id).toBe('stu_new');
  });
});

describe('buildCsvText — Para App Number + Period ID columns', () => {
  const allStudents = {
    stu_a: { id: 'stu_a', pseudonym: 'Red Student 1', paraAppNumber: '111111' },
    stu_b: { id: 'stu_b', pseudonym: 'Blue Student 1', paraAppNumber: '222222' },
  };
  const logs = [
    {
      id: 'log_1', studentId: 'stu_a', type: 'Behavior Note',
      category: 'behavior', note: 'used break', date: '2026-04-29',
      period: 'Period 1 — ELA 7', periodId: 'p1', tags: ['break'],
      flagged: false, paraAppNumber: '111111',
    },
    {
      // Studentless log — record's local id is gone but paraAppNumber survives.
      // Tests the fallback to log.paraAppNumber when allStudents lookup misses.
      id: 'log_2', studentId: 'stu_gone', type: 'Goal Progress',
      category: 'academic', note: 'fraction wins', date: '2026-04-29',
      period: 'Period 3 — Math 2', periodId: 'p3', tags: ['goal'],
      flagged: true, paraAppNumber: '222222',
    },
  ];

  test('header includes Para App Number and Period ID columns', () => {
    const csv = buildCsvText(logs, allStudents, '2026-04-29');
    const [header] = csv.split('\n');
    expect(header).toBe('Date,Period,Period ID,Student,Para App Number,Type,Category,Flagged,Tags,Observation');
  });

  test('row populates paraAppNumber from the student record', () => {
    const csv = buildCsvText(logs, allStudents, '2026-04-29');
    const lines = csv.split('\n');
    expect(lines[1]).toContain('"111111"');
    expect(lines[1]).toContain('"p1"');
  });

  test('row falls back to log.paraAppNumber when student record is missing', () => {
    const csv = buildCsvText(logs, allStudents, '2026-04-29');
    const lines = csv.split('\n');
    expect(lines[2]).toContain('"222222"');
    expect(lines[2]).toContain('"p3"');
  });
});
