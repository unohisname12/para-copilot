import { renderHook, act } from '@testing-library/react';
import { useLocalStorageKeyed } from '../hooks/useLocalStorageKeyed';

beforeEach(() => { localStorage.clear(); });

test('re-reads when key changes', () => {
  localStorage.setItem('classTopic_p1_2026-05-07', JSON.stringify('Algebra'));
  localStorage.setItem('classTopic_p2_2026-05-07', JSON.stringify('Biology'));

  const { result, rerender } = renderHook(
    ({ k }) => useLocalStorageKeyed(k, ''),
    { initialProps: { k: 'classTopic_p1_2026-05-07' } }
  );
  expect(result.current[0]).toBe('Algebra');

  rerender({ k: 'classTopic_p2_2026-05-07' });
  expect(result.current[0]).toBe('Biology');

  rerender({ k: 'classTopic_p1_2026-05-07' });
  expect(result.current[0]).toBe('Algebra');
});

test('writes to the current key', () => {
  const { result, rerender } = renderHook(
    ({ k }) => useLocalStorageKeyed(k, ''),
    { initialProps: { k: 'k1' } }
  );
  act(() => result.current[1]('hello'));
  expect(JSON.parse(localStorage.getItem('k1'))).toBe('hello');

  rerender({ k: 'k2' });
  act(() => result.current[1]('world'));
  expect(JSON.parse(localStorage.getItem('k1'))).toBe('hello');
  expect(JSON.parse(localStorage.getItem('k2'))).toBe('world');
});

test('falls back to default when key has no stored value', () => {
  const { result } = renderHook(() => useLocalStorageKeyed('missing_key', 'fallback'));
  expect(result.current[0]).toBe('fallback');
});
