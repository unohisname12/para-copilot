import { stripUnsafeKeys, containsUnsafeKey } from '../services/stripUnsafeKeys';

describe('stripUnsafeKeys', () => {
  test('removes top-level realName', () => {
    const input = { id: 'x', realName: 'John Doe', pseudonym: 'Red 1' };
    expect(stripUnsafeKeys(input)).toEqual({ id: 'x', pseudonym: 'Red 1' });
  });

  test('removes nested real_name inside jsonb-shaped field', () => {
    const input = {
      id: 'x',
      goals: [{ id: 'g1', real_name: 'Jane', text: 'reading' }],
    };
    expect(stripUnsafeKeys(input)).toEqual({
      id: 'x',
      goals: [{ id: 'g1', text: 'reading' }],
    });
  });

  test('removes multiple variants: firstName, lastName, studentName', () => {
    const input = { firstName: 'A', lastName: 'B', studentName: 'C', keep: true };
    expect(stripUnsafeKeys(input)).toEqual({ keep: true });
  });

  test('is case-insensitive', () => {
    const input = { RealName: 'x', FIRSTNAME: 'y', keep: 1 };
    expect(stripUnsafeKeys(input)).toEqual({ keep: 1 });
  });

  test('leaves arrays of primitives alone', () => {
    const input = { tags: ['a', 'b'], flags: { alert: true } };
    expect(stripUnsafeKeys(input)).toEqual(input);
  });

  test('containsUnsafeKey detects nested keys', () => {
    expect(containsUnsafeKey({ a: { b: { realName: 'x' } } })).toBe(true);
    expect(containsUnsafeKey({ a: 1, b: [{ keep: 2 }] })).toBe(false);
  });
});
