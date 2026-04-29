import React, { useState } from 'react';
import { render, act } from '@testing-library/react';
import { useDraft, draftStorageKey, readDraft, clearDraft } from '../hooks/useDraft';

jest.useFakeTimers();

beforeEach(() => { globalThis.localStorage.clear(); });

function Harness({ k, initial = '', autoFire = null, debounceMs = 50 }) {
  const [value, setValue] = useState(initial);
  const draft = useDraft(k, value, setValue, { debounceMs });
  // Expose hooks to the test via a global ref so we can drive them
  React.useEffect(() => {
    if (autoFire) autoFire({ value, setValue, clear: draft.clear });
  });
  return <textarea value={value} onChange={(e) => setValue(e.target.value)} />;
}

describe('useDraft', () => {
  test('saves to localStorage after debounce', async () => {
    let api;
    render(<Harness k="t1" autoFire={(a) => { api = a; }} />);
    act(() => { api.setValue('partial note'); });
    await act(async () => { jest.advanceTimersByTime(50); });
    expect(globalThis.localStorage.getItem(draftStorageKey('t1'))).toBe('partial note');
  });

  test('hydrates from localStorage on mount when current value is empty', () => {
    globalThis.localStorage.setItem(draftStorageKey('t2'), 'recovered draft');
    let captured = null;
    render(<Harness k="t2" autoFire={(a) => { captured = a.value; }} />);
    expect(captured).toBe('recovered draft');
  });

  test('does NOT overwrite an existing initial value', () => {
    globalThis.localStorage.setItem(draftStorageKey('t3'), 'old draft');
    let captured = null;
    render(<Harness k="t3" initial="user-loaded value" autoFire={(a) => { captured = a.value; }} />);
    expect(captured).toBe('user-loaded value');
  });

  test('clear() removes the draft', async () => {
    let api;
    render(<Harness k="t4" autoFire={(a) => { api = a; }} />);
    act(() => { api.setValue('to be cleared'); });
    await act(async () => { jest.advanceTimersByTime(50); });
    expect(globalThis.localStorage.getItem(draftStorageKey('t4'))).toBe('to be cleared');
    act(() => { api.clear(); });
    expect(globalThis.localStorage.getItem(draftStorageKey('t4'))).toBe(null);
  });

  test('empty value removes the storage entry (no orphan junk)', async () => {
    let api;
    render(<Harness k="t5" initial="ok" autoFire={(a) => { api = a; }} />);
    await act(async () => { jest.advanceTimersByTime(50); });
    expect(globalThis.localStorage.getItem(draftStorageKey('t5'))).toBe('ok');
    act(() => { api.setValue(''); });
    await act(async () => { jest.advanceTimersByTime(50); });
    expect(globalThis.localStorage.getItem(draftStorageKey('t5'))).toBe(null);
  });

  test('readDraft / clearDraft work outside React', () => {
    globalThis.localStorage.setItem(draftStorageKey('t6'), 'some text');
    expect(readDraft('t6')).toBe('some text');
    clearDraft('t6');
    expect(readDraft('t6')).toBe('');
  });

  test('null/empty key is a safe no-op', () => {
    expect(() => useDraft).not.toThrow();
    expect(readDraft('')).toBe('');
    expect(readDraft(null)).toBe('');
    clearDraft(''); clearDraft(null); // no throw
  });
});
