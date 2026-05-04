import { relinkLogsByParaAppNumber } from '../utils/relinkLogs';

describe('relinkLogsByParaAppNumber', () => {
  test('rewrites studentId when paraAppNumber matches a new student record', () => {
    const logs = [{ id: 'l1', studentId: 'old-1', paraAppNumber: '847293' }];
    const allStudents = { 'new-1': { id: 'new-1', paraAppNumber: '847293' } };
    const out = relinkLogsByParaAppNumber(logs, allStudents);
    expect(out[0].studentId).toBe('new-1');
  });

  test('leaves logs unchanged when studentId already matches', () => {
    const logs = [{ id: 'l1', studentId: 'new-1', paraAppNumber: '847293' }];
    const allStudents = { 'new-1': { id: 'new-1', paraAppNumber: '847293' } };
    const out = relinkLogsByParaAppNumber(logs, allStudents);
    expect(out[0]).toBe(logs[0]);
  });

  test('leaves logs without paraAppNumber alone', () => {
    const logs = [{ id: 'l1', studentId: 'old-1' }];
    const allStudents = { 'new-1': { id: 'new-1', paraAppNumber: '847293' } };
    const out = relinkLogsByParaAppNumber(logs, allStudents);
    expect(out[0]).toBe(logs[0]);
  });

  test('leaves logs whose paraAppNumber matches no current student', () => {
    const logs = [{ id: 'l1', studentId: 'old-1', paraAppNumber: '999999' }];
    const allStudents = { 'new-1': { id: 'new-1', paraAppNumber: '847293' } };
    const out = relinkLogsByParaAppNumber(logs, allStudents);
    expect(out[0]).toBe(logs[0]);
  });

  test('returns same array reference when nothing changed', () => {
    const logs = [{ id: 'l1', studentId: 'new-1', paraAppNumber: '847293' }];
    const allStudents = { 'new-1': { id: 'new-1', paraAppNumber: '847293' } };
    expect(relinkLogsByParaAppNumber(logs, allStudents)).toBe(logs);
  });

  test('handles empty inputs', () => {
    expect(relinkLogsByParaAppNumber([], {})).toEqual([]);
    expect(relinkLogsByParaAppNumber(null, {})).toEqual([]);
  });

  test('rewrites only the orphans, leaves correct ones in place', () => {
    const logs = [
      { id: 'l1', studentId: 'new-1', paraAppNumber: '111' },
      { id: 'l2', studentId: 'old-2', paraAppNumber: '222' },
      { id: 'l3', studentId: 'new-3' /* no bridge */ },
    ];
    const allStudents = {
      'new-1': { id: 'new-1', paraAppNumber: '111' },
      'new-2': { id: 'new-2', paraAppNumber: '222' },
    };
    const out = relinkLogsByParaAppNumber(logs, allStudents);
    expect(out[0]).toBe(logs[0]);
    expect(out[1].studentId).toBe('new-2');
    expect(out[2]).toBe(logs[2]);
  });
});
