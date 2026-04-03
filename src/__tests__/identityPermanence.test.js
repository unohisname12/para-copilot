import { validateStudentId, createIncident, createIntervention, createOutcome } from '../models';
import { DEMO_STUDENTS } from '../data';

describe('validateStudentId', () => {
  test('accepts valid demo student IDs', () => {
    expect(validateStudentId('stu_001')).toBe(true);
    expect(validateStudentId('stu_009')).toBe(true);
  });

  test('accepts valid imported student IDs', () => {
    expect(validateStudentId('stu_imp_1712000000')).toBe(true);
    expect(validateStudentId('stu_gen_001')).toBe(true);
    expect(validateStudentId('stu_mr_abc123')).toBe(true);
  });

  test('rejects malformed IDs', () => {
    expect(validateStudentId('')).toBe(false);
    expect(validateStudentId('student_001')).toBe(false);
    expect(validateStudentId('stu_')).toBe(false);
    expect(validateStudentId('001')).toBe(false);
    expect(validateStudentId(null)).toBe(false);
    expect(validateStudentId(undefined)).toBe(false);
    expect(validateStudentId(123)).toBe(false);
  });
});

describe('DEMO_STUDENTS ID stability', () => {
  const expectedIds = ['stu_001','stu_002','stu_003','stu_004','stu_005','stu_006','stu_007','stu_008','stu_009'];

  test('all 9 demo students exist with expected IDs', () => {
    const actualIds = Object.keys(DEMO_STUDENTS).sort();
    expect(actualIds).toEqual(expectedIds.sort());
  });

  test('all demo student IDs pass validation', () => {
    Object.keys(DEMO_STUDENTS).forEach(id => {
      expect(validateStudentId(id)).toBe(true);
    });
  });

  test('each demo student has required identity fields', () => {
    Object.values(DEMO_STUDENTS).forEach(s => {
      expect(s).toHaveProperty('id');
      expect(s).toHaveProperty('pseudonym');
      expect(s).toHaveProperty('color');
      expect(s).toHaveProperty('identity');
      expect(s.identity).toHaveProperty('colorName');
      expect(s.identity).toHaveProperty('emoji');
      expect(s.identity).toHaveProperty('codename');
    });
  });
});

describe('case memory factory ID formats', () => {
  test('createIncident generates inc_ prefixed IDs', () => {
    const inc = createIncident({ studentId: 'stu_001', description: 'test', date: '2026-04-01', periodId: 'p1' });
    expect(inc.id).toMatch(/^inc_\d+_\d+$/);
    expect(inc.studentId).toBe('stu_001');
    expect(inc.status).toBe('open');
  });

  test('createIntervention generates intv_ prefixed IDs', () => {
    const intv = createIntervention({ incidentId: 'inc_1', studentId: 'stu_001' });
    expect(intv.id).toMatch(/^intv_\d+_\d+$/);
    expect(intv.incidentId).toBe('inc_1');
  });

  test('createOutcome generates out_ prefixed IDs', () => {
    const out = createOutcome({ interventionId: 'intv_1', incidentId: 'inc_1', studentId: 'stu_001', result: 'worked' });
    expect(out.id).toMatch(/^out_\d+_\d+$/);
    expect(out.result).toBe('worked');
  });
});
