import { buildStudentRows } from '../components/SimpleMode';

// Minimal student fixtures — only the fields SimpleMode reads
const STU_IMPORTED = {
  id: 'stu_imported',
  pseudonym: 'Green Student 99',
  color: '#22c55e',
  eligibility: 'OHI',
  accs: [],
  identity: { colorName: 'Green', color: '#22c55e', emoji: '🌿', codename: 'Fern', sequenceNumber: 99 },
};

const STU_ALERT = {
  id: 'stu_alert',
  pseudonym: 'Pink Student 1',
  color: '#ec4899',
  eligibility: 'OHI (BIP Active)',
  accs: ['Break Pass'],
  alertText: 'ACTIVE BIP. Do not correct publicly.',
  identity: { colorName: 'Pink', color: '#ec4899', emoji: '🌸', codename: 'Bloom', sequenceNumber: 1 },
};

const STU_FLAG_ALERT = {
  id: 'stu_flag',
  pseudonym: 'Red Student 2',
  color: '#ef4444',
  eligibility: 'ED',
  accs: [],
  flags: { alert: true },
  identity: { colorName: 'Red', color: '#ef4444', emoji: '🔥', codename: 'Ember', sequenceNumber: 2 },
};

const STU_NORMAL = {
  id: 'stu_normal',
  pseudonym: 'Blue Student 1',
  color: '#3b82f6',
  eligibility: 'SLD',
  accs: ['Extended Time'],
  identity: { colorName: 'Blue', color: '#3b82f6', emoji: '🌊', codename: 'Wave', sequenceNumber: 1 },
};

const ALL_STUDENTS = {
  stu_imported: STU_IMPORTED,
  stu_alert:    STU_ALERT,
  stu_flag:     STU_FLAG_ALERT,
  stu_normal:   STU_NORMAL,
};

const DATE = '2026-03-27';

const makeLog = (studentId, date = DATE) => ({
  id: `log_${Math.random()}`,
  studentId,
  date,
  type: 'General Observation',
  note: 'test',
});

// ── buildStudentRows ──────────────────────────────────────────

describe('buildStudentRows — uses allStudents, not DB', () => {
  test('returns a row for each id in effectivePeriodStudents', () => {
    const rows = buildStudentRows(['stu_normal'], ALL_STUDENTS, [], DATE);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe('stu_normal');
  });

  test('includes imported students (not in DB) when in effectivePeriodStudents', () => {
    const rows = buildStudentRows(['stu_imported'], ALL_STUDENTS, [], DATE);
    expect(rows).toHaveLength(1);
    expect(rows[0].student).toBe(STU_IMPORTED);
  });

  test('skips ids not found in allStudents (null guard)', () => {
    const rows = buildStudentRows(['stu_normal', 'stu_ghost'], ALL_STUDENTS, [], DATE);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe('stu_normal');
  });

  test('preserves order from effectivePeriodStudents', () => {
    const rows = buildStudentRows(
      ['stu_normal', 'stu_imported', 'stu_alert'],
      ALL_STUDENTS, [], DATE
    );
    expect(rows.map(r => r.id)).toEqual(['stu_normal', 'stu_imported', 'stu_alert']);
  });
});

describe('buildStudentRows — todayCount', () => {
  test('counts only logs for the given date', () => {
    const logs = [
      makeLog('stu_normal', DATE),
      makeLog('stu_normal', DATE),
      makeLog('stu_normal', '2026-03-26'), // yesterday — should not count
    ];
    const rows = buildStudentRows(['stu_normal'], ALL_STUDENTS, logs, DATE);
    expect(rows[0].todayCount).toBe(2);
  });

  test('todayCount is 0 when no logs for student today', () => {
    const logs = [makeLog('stu_alert', DATE)]; // different student
    const rows = buildStudentRows(['stu_normal'], ALL_STUDENTS, logs, DATE);
    expect(rows[0].todayCount).toBe(0);
  });
});

describe('buildStudentRows — health', () => {
  test('health is red when no logs at all (no recent activity)', () => {
    const rows = buildStudentRows(['stu_normal'], ALL_STUDENTS, [], DATE);
    expect(rows[0].health).toBe('red');
  });

  test('health reflects recent log activity', () => {
    // 3 logs today → should produce some health signal (not testing getHealth internals)
    const logs = [makeLog('stu_normal'), makeLog('stu_normal'), makeLog('stu_normal')];
    const rows = buildStudentRows(['stu_normal'], ALL_STUDENTS, logs, DATE);
    expect(['green', 'yellow', 'red']).toContain(rows[0].health);
  });
});

describe('buildStudentRows — alert detection', () => {
  test('hasAlert is true when student has alertText', () => {
    const rows = buildStudentRows(['stu_alert'], ALL_STUDENTS, [], DATE);
    expect(rows[0].hasAlert).toBe(true);
    expect(rows[0].alertText).toBe('ACTIVE BIP. Do not correct publicly.');
  });

  test('hasAlert is true when student has flags.alert set', () => {
    const rows = buildStudentRows(['stu_flag'], ALL_STUDENTS, [], DATE);
    expect(rows[0].hasAlert).toBe(true);
  });

  test('hasAlert is false when student has no alert fields', () => {
    const rows = buildStudentRows(['stu_normal'], ALL_STUDENTS, [], DATE);
    expect(rows[0].hasAlert).toBe(false);
  });

  test('alertText falls back to "Alert flag set" when only flags.alert is present', () => {
    const rows = buildStudentRows(['stu_flag'], ALL_STUDENTS, [], DATE);
    expect(rows[0].alertText).toBe('Alert flag set');
  });
});
