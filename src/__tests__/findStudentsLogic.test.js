import {
  groupByParaAppNumber,
  chooseCanonical,
  buildHiddenSet,
  addToHidden,
  removeFromHidden,
  countRemainingDupes,
} from '../features/find-students/findStudentsLogic';

const stu = (overrides = {}) => ({
  id: 'stu_default',
  paraAppNumber: '111111',
  pseudonym: 'Red Student 1',
  color: '#ef4444',
  periodId: 'p1',
  periodIds: ['p1'],
  createdAt: '2026-04-28T00:00:00Z',
  ...overrides,
});

describe('groupByParaAppNumber', () => {
  test('groups two students with the same paraAppNumber', () => {
    const a = stu({ id: 'a', paraAppNumber: '123456' });
    const b = stu({ id: 'b', paraAppNumber: '123456' });
    const c = stu({ id: 'c', paraAppNumber: '999999' });
    const { groups } = groupByParaAppNumber({ a, b, c });
    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe('123456');
    expect(groups[0].rows.map((r) => r.id).sort()).toEqual(['a', 'b']);
  });

  test('students with no paraAppNumber go to unkeyed', () => {
    const a = stu({ id: 'a', paraAppNumber: null });
    const b = stu({ id: 'b', paraAppNumber: '' });
    const c = stu({ id: 'c', paraAppNumber: '111111' });
    const { groups, unkeyed } = groupByParaAppNumber({ a, b, c });
    expect(groups).toHaveLength(0);
    expect(unkeyed.map((r) => r.id).sort()).toEqual(['a', 'b']);
  });

  test('externalKey falls back to paraAppNumber for grouping', () => {
    const a = stu({ id: 'a', paraAppNumber: null, externalKey: '777' });
    const b = stu({ id: 'b', paraAppNumber: null, externalKey: '777' });
    const { groups } = groupByParaAppNumber({ a, b });
    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe('777');
  });

  test('whitespace and number coercion in keys', () => {
    const a = stu({ id: 'a', paraAppNumber: 123456 });
    const b = stu({ id: 'b', paraAppNumber: '  123456 ' });
    const { groups } = groupByParaAppNumber({ a, b });
    expect(groups).toHaveLength(1);
  });

  test('groups sort by descending row count', () => {
    const a = stu({ id: 'a', paraAppNumber: '111' });
    const b = stu({ id: 'b', paraAppNumber: '111' });
    const c = stu({ id: 'c', paraAppNumber: '222' });
    const d = stu({ id: 'd', paraAppNumber: '222' });
    const e = stu({ id: 'e', paraAppNumber: '222' });
    const { groups } = groupByParaAppNumber({ a, b, c, d, e });
    expect(groups[0].key).toBe('222');
    expect(groups[1].key).toBe('111');
  });
});

describe('chooseCanonical', () => {
  test('picks the row with the most logs', () => {
    const a = stu({ id: 'a', createdAt: '2026-04-28T00:00:00Z' });
    const b = stu({ id: 'b', createdAt: '2026-04-30T00:00:00Z' });
    expect(chooseCanonical([a, b], { a: 5, b: 1 }).id).toBe('a');
  });

  test('ties on logs go to the row with more periods', () => {
    const a = stu({ id: 'a', periodIds: ['p1'] });
    const b = stu({ id: 'b', periodIds: ['p1', 'p2'] });
    expect(chooseCanonical([a, b], { a: 1, b: 1 }).id).toBe('b');
  });

  test('ties on logs and periods go to the earliest createdAt', () => {
    const a = stu({ id: 'a', createdAt: '2026-04-30T00:00:00Z' });
    const b = stu({ id: 'b', createdAt: '2026-04-28T00:00:00Z' });
    expect(chooseCanonical([a, b], { a: 0, b: 0 }).id).toBe('b');
  });

  test('returns null on empty input', () => {
    expect(chooseCanonical([])).toBeNull();
  });

  test('returns the only row when input has one element', () => {
    const a = stu({ id: 'solo' });
    expect(chooseCanonical([a]).id).toBe('solo');
  });
});

describe('buildHiddenSet', () => {
  test('returns every row except the canonical', () => {
    const a = stu({ id: 'a' });
    const b = stu({ id: 'b' });
    const c = stu({ id: 'c' });
    expect(buildHiddenSet({ rows: [a, b, c] }, 'b').sort()).toEqual(['a', 'c']);
  });

  test('returns empty when canonical is the only row', () => {
    const a = stu({ id: 'a' });
    expect(buildHiddenSet({ rows: [a] }, 'a')).toEqual([]);
  });

  test('returns empty when group is missing rows', () => {
    expect(buildHiddenSet(null, 'a')).toEqual([]);
    expect(buildHiddenSet({}, 'a')).toEqual([]);
  });
});

describe('addToHidden / removeFromHidden', () => {
  test('addToHidden never mutates the input set', () => {
    const orig = new Set(['x']);
    const next = addToHidden(orig, ['y', 'z']);
    expect(orig.has('y')).toBe(false);
    expect(next.has('x') && next.has('y') && next.has('z')).toBe(true);
  });

  test('removeFromHidden never mutates the input set', () => {
    const orig = new Set(['a', 'b', 'c']);
    const next = removeFromHidden(orig, ['b']);
    expect(orig.has('b')).toBe(true);
    expect(next.has('b')).toBe(false);
    expect(next.has('a') && next.has('c')).toBe(true);
  });

  test('addToHidden ignores falsy ids', () => {
    const next = addToHidden(new Set(), [null, undefined, '', 'x']);
    expect([...next]).toEqual(['x']);
  });
});

describe('countRemainingDupes', () => {
  test('counts only groups still showing 2+ visible rows', () => {
    const a = stu({ id: 'a', paraAppNumber: '111' });
    const b = stu({ id: 'b', paraAppNumber: '111' });
    const c = stu({ id: 'c', paraAppNumber: '222' });
    const d = stu({ id: 'd', paraAppNumber: '222' });
    const groups = groupByParaAppNumber({ a, b, c, d }).groups;
    expect(countRemainingDupes(groups, new Set())).toBe(2);
    expect(countRemainingDupes(groups, new Set(['b']))).toBe(1);
    expect(countRemainingDupes(groups, new Set(['b', 'd']))).toBe(0);
  });
});
