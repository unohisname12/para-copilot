// Tests for the pure reducer behind removeImportedStudent + scope handling.
// Hook-level testing requires a renderer; the reducer is pulled out into
// useStudents.js as `applyStudentRemoval(state, id, options)` so it can be
// exercised directly here.

import { applyStudentRemoval, fromCloudRowForTests } from '../hooks/useStudents';

const stu = (id, periodId = 'p1') => ({ id, periodId, paraAppNumber: id, pseudonym: id });

const baseState = () => ({
  importedStudents: {
    stu_a: stu('stu_a', 'p1'),
    stu_b: stu('stu_b', 'p2'),
    stu_cross: stu('stu_cross', 'p1'), // also lives in p3
  },
  importedPeriodMap: {
    p1: ['stu_a', 'stu_cross'],
    p2: ['stu_b'],
    p3: ['stu_cross'],
  },
});

describe('applyStudentRemoval', () => {
  test('default (no scope) — removes student globally and from every period', () => {
    const next = applyStudentRemoval(baseState(), 'stu_cross');
    expect(next.importedStudents.stu_cross).toBeUndefined();
    expect(next.importedPeriodMap.p1).toEqual(['stu_a']);
    expect(next.importedPeriodMap.p3).toEqual([]);
  });

  test('with periodId — removes only from that period; student stays in others', () => {
    const next = applyStudentRemoval(baseState(), 'stu_cross', { periodId: 'p1' });
    // Still in importedStudents because they're still in p3
    expect(next.importedStudents.stu_cross).toBeDefined();
    // Removed from p1 only
    expect(next.importedPeriodMap.p1).toEqual(['stu_a']);
    expect(next.importedPeriodMap.p3).toEqual(['stu_cross']);
  });

  test('with periodId on a single-period kid — fully deletes them', () => {
    const next = applyStudentRemoval(baseState(), 'stu_a', { periodId: 'p1' });
    // stu_a only existed in p1, so global delete kicks in
    expect(next.importedStudents.stu_a).toBeUndefined();
    expect(next.importedPeriodMap.p1).toEqual(['stu_cross']);
  });

  test('with periodId — removing a student NOT in that period is a no-op', () => {
    const next = applyStudentRemoval(baseState(), 'stu_cross', { periodId: 'p99' });
    expect(next.importedStudents.stu_cross).toBeDefined();
    expect(next.importedPeriodMap).toEqual(baseState().importedPeriodMap);
  });

  test('removing the last appearance fully deletes the student', () => {
    // First call — remove from p1
    const after1 = applyStudentRemoval(baseState(), 'stu_cross', { periodId: 'p1' });
    expect(after1.importedStudents.stu_cross).toBeDefined();
    // Second call — remove from p3 (their last period)
    const after2 = applyStudentRemoval(after1, 'stu_cross', { periodId: 'p3' });
    expect(after2.importedStudents.stu_cross).toBeUndefined();
    expect(after2.importedPeriodMap.p3).toEqual([]);
  });

  test('null/undefined studentId is a safe no-op', () => {
    const before = baseState();
    expect(applyStudentRemoval(before, null)).toEqual(before);
    expect(applyStudentRemoval(before, undefined, { periodId: 'p1' })).toEqual(before);
  });
});

describe('fromCloudRow / period_ids unpacking', () => {
  test('cloud row with period_ids[] populates the array on the student', () => {
    const stu = fromCloudRowForTests({
      id: 'db1', pseudonym: 'X', color: '#000',
      external_key: '111111',
      period_id: 'p1',
      period_ids: ['p1', 'p3'],
    });
    expect(stu.periodIds).toEqual(['p1', 'p3']);
    expect(stu.periodId).toBe('p1');
  });

  test('legacy row with only period_id falls back to a single-element array', () => {
    const stu = fromCloudRowForTests({
      id: 'db1', pseudonym: 'X', color: '#000',
      external_key: '111111',
      period_id: 'p2',
      // no period_ids
    });
    expect(stu.periodIds).toEqual(['p2']);
    expect(stu.periodId).toBe('p2');
  });

  test('row with neither period column gives an empty array', () => {
    const stu = fromCloudRowForTests({
      id: 'db1', pseudonym: 'X', color: '#000',
      external_key: '111111',
    });
    expect(stu.periodIds).toEqual([]);
  });
});
