import { resolveCompactFromInputs, COMPACT_THRESHOLD_PX } from '../hooks/useCompactView';

describe('resolveCompactFromInputs', () => {
  test('compact when override = "compact" regardless of width', () => {
    expect(resolveCompactFromInputs({ override: 'compact', width: 1920 })).toBe(true);
    expect(resolveCompactFromInputs({ override: 'compact', width: 800 })).toBe(true);
  });

  test('roomy when override = "roomy" regardless of width', () => {
    expect(resolveCompactFromInputs({ override: 'roomy', width: 1920 })).toBe(false);
    expect(resolveCompactFromInputs({ override: 'roomy', width: 800 })).toBe(false);
  });

  test('auto: compact under threshold', () => {
    expect(resolveCompactFromInputs({ override: 'auto', width: COMPACT_THRESHOLD_PX - 1 })).toBe(true);
    expect(resolveCompactFromInputs({ override: 'auto', width: 1280 })).toBe(true);
    expect(resolveCompactFromInputs({ override: 'auto', width: 800 })).toBe(true);
  });

  test('auto: roomy at or above threshold', () => {
    expect(resolveCompactFromInputs({ override: 'auto', width: COMPACT_THRESHOLD_PX })).toBe(false);
    expect(resolveCompactFromInputs({ override: 'auto', width: 1920 })).toBe(false);
  });

  test('threshold value is 1366 (Chromebook line)', () => {
    expect(COMPACT_THRESHOLD_PX).toBe(1366);
  });

  test('unknown override falls back to auto behavior', () => {
    expect(resolveCompactFromInputs({ override: 'something-else', width: 1280 })).toBe(true);
    expect(resolveCompactFromInputs({ override: 'something-else', width: 1920 })).toBe(false);
  });
});
