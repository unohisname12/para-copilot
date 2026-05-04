import { removeLogsByIds, restoreLogsAtTop } from '../utils/bulkLogOps';

describe('removeLogsByIds', () => {
  test('removes specified ids', () => {
    const logs = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    expect(removeLogsByIds(logs, new Set(['a', 'c']))).toEqual([{ id: 'b' }]);
  });
  test('returns same reference when nothing removed', () => {
    const logs = [{ id: 'a' }];
    expect(removeLogsByIds(logs, new Set(['x']))).toBe(logs);
  });
  test('handles empty set', () => {
    const logs = [{ id: 'a' }];
    expect(removeLogsByIds(logs, new Set())).toBe(logs);
  });
  test('handles array input for ids', () => {
    const logs = [{ id: 'a' }, { id: 'b' }];
    expect(removeLogsByIds(logs, ['a'])).toEqual([{ id: 'b' }]);
  });
});

describe('restoreLogsAtTop', () => {
  test('prepends restored logs', () => {
    const logs = [{ id: 'b' }];
    const out = restoreLogsAtTop(logs, [{ id: 'a' }]);
    expect(out.map(l => l.id)).toEqual(['a', 'b']);
  });
  test('dedupes — does not double-add an id already present', () => {
    const logs = [{ id: 'a' }, { id: 'b' }];
    const out = restoreLogsAtTop(logs, [{ id: 'a', note: 'new' }]);
    expect(out.length).toBe(2);
    expect(out[0]).toEqual({ id: 'a' });
  });
  test('returns same reference when snapshot empty', () => {
    const logs = [{ id: 'a' }];
    expect(restoreLogsAtTop(logs, [])).toBe(logs);
    expect(restoreLogsAtTop(logs, null)).toBe(logs);
  });
});
