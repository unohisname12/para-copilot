import { enrichStudentsWithNames } from '../context/VaultProvider';
import { getStudentLabel } from '../identity';

describe('enrichStudentsWithNames + getStudentLabel', () => {
  const students = {
    stu1: { id: 'stu1', pseudonym: 'Red Student 1', color: '#ef4444', paraAppNumber: '847293' },
    stu2: { id: 'stu2', pseudonym: 'Blue Student 1', color: '#3b82f6' }, // no paraAppNumber
  };
  const vault = { '847293': 'Maria Garcia' };

  test('enriches student with realName when toggle is ON and paraAppNumber matches', () => {
    const enriched = enrichStudentsWithNames(students, vault, true);
    expect(enriched.stu1.realName).toBe('Maria Garcia');
    expect(enriched.stu1.pseudonym).toBe('Red Student 1'); // preserved
  });

  test('leaves students untouched when toggle is OFF', () => {
    const enriched = enrichStudentsWithNames(students, vault, false);
    expect(enriched.stu1.realName).toBeUndefined();
    expect(enriched).toEqual(students);
  });

  test('leaves students untouched when vault is empty', () => {
    const enriched = enrichStudentsWithNames(students, {}, true);
    expect(enriched.stu1.realName).toBeUndefined();
  });

  test('skips students missing paraAppNumber', () => {
    const enriched = enrichStudentsWithNames(students, vault, true);
    expect(enriched.stu2.realName).toBeUndefined();
  });

  test('getStudentLabel prefers realName when present', () => {
    const enriched = enrichStudentsWithNames(students, vault, true);
    expect(getStudentLabel(enriched.stu1)).toBe('Maria Garcia');
    // stu2 has no realName, falls back to pseudonym
    expect(getStudentLabel(enriched.stu2)).toBe('Blue Student 1');
  });

  test('getStudentLabel falls back to pseudonym when no vault match', () => {
    const enriched = enrichStudentsWithNames(students, {}, true);
    expect(getStudentLabel(enriched.stu1)).toBe('Red Student 1');
  });
});
