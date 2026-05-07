import { renderHook, act } from '@testing-library/react';
import { useLogs } from '../hooks/useLogs';

beforeEach(() => { localStorage.clear(); });

test('bulkDeleteLogs fires onLogDeleted for cloud-only ids', () => {
  const fired = [];
  const { result } = renderHook(() => useLogs({
    currentDate: '2026-05-07',
    periodLabel: 'P1',
    activePeriod: 'p1',
    onLogDeleted: (removed) => { fired.push(...removed); },
    allStudents: {},
  }));

  act(() => { result.current.addLog('stu_001', 'note', 'X'); });
  const localId = result.current.logs[0].id;

  act(() => { result.current.bulkDeleteLogs([localId, 'cloud_only_uuid_zzz']); });

  expect(fired.map(l => l.id).sort()).toEqual([localId, 'cloud_only_uuid_zzz'].sort());
  expect(result.current.logs).toHaveLength(0);
});

test('bulkDeleteLogs with only cloud ids still fires', () => {
  const fired = [];
  const { result } = renderHook(() => useLogs({
    currentDate: '2026-05-07',
    periodLabel: 'P1',
    activePeriod: 'p1',
    onLogDeleted: (removed) => { fired.push(...removed); },
    allStudents: {},
  }));

  act(() => { result.current.bulkDeleteLogs(['cloud_a', 'cloud_b']); });
  expect(fired.map(l => l.id).sort()).toEqual(['cloud_a', 'cloud_b']);
});

test('deleteLog fires onLogDeleted for cloud-only id', () => {
  const fired = [];
  const { result } = renderHook(() => useLogs({
    currentDate: '2026-05-07',
    periodLabel: 'P1',
    activePeriod: 'p1',
    onLogDeleted: (removed) => { fired.push(...removed); },
    allStudents: {},
  }));

  act(() => { result.current.deleteLog('cloud_only_x', { silent: true }); });
  expect(fired.map(l => l.id)).toEqual(['cloud_only_x']);
});
