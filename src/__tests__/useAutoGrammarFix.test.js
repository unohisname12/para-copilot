import React, { useState, useRef } from 'react';
import { render, act } from '@testing-library/react';
import { useAutoGrammarFix } from '../hooks/useAutoGrammarFix';

jest.useFakeTimers();

function Harness({ initial = '', enabled = true, onValueChange }) {
  const [value, setValue] = useState(initial);
  const ref = useRef(null);
  useAutoGrammarFix({ value, setValue, ref, enabled, delayMs: 100 });
  // Notify caller after each render so the test can grab the latest value
  React.useEffect(() => { onValueChange?.(value); });
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      data-testid="ta"
    />
  );
}

describe('useAutoGrammarFix', () => {
  test('applies fix after debounce when enabled', async () => {
    let captured = '';
    render(<Harness initial="hello world" onValueChange={(v) => { captured = v; }} />);
    expect(captured).toBe('hello world');
    await act(async () => { jest.advanceTimersByTime(100); });
    expect(captured).toBe('Hello world');
  });

  test('no fix when disabled', async () => {
    let captured = '';
    render(<Harness initial="hello world" enabled={false} onValueChange={(v) => { captured = v; }} />);
    await act(async () => { jest.advanceTimersByTime(500); });
    expect(captured).toBe('hello world');
  });

  test('no fix on empty value', async () => {
    let captured = '';
    render(<Harness initial="" onValueChange={(v) => { captured = v; }} />);
    await act(async () => { jest.advanceTimersByTime(500); });
    expect(captured).toBe('');
  });

  test('idempotent — already-clean text stays put', async () => {
    let captured = '';
    render(<Harness initial="Hello World" onValueChange={(v) => { captured = v; }} />);
    await act(async () => { jest.advanceTimersByTime(100); });
    expect(captured).toBe('Hello World');
  });
});
