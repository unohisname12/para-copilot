import { buildQuickLogParams } from '../features/simple-mode/SimpleMode';

// The UX prototype renamed Simple Mode quick-action UI labels.
// Persisted IDs (`positive`, `academic`, `break`, `transition`, `refusal`,
// `behavior`) are unchanged so existing logs continue to resolve.
// These tests pin the new labels to prevent silent regression.

describe('Simple Mode quick-action labels — UX prototype rename', () => {
  test('positive id → "Success" label', () => {
    const r = buildQuickLogParams('positive');
    expect(r.note).toContain('Success');
    expect(r.tag).toBe('positive');
    expect(r.logType).toBe('Positive Note');
  });

  test('refusal id → "Redirect" label', () => {
    const r = buildQuickLogParams('refusal');
    expect(r.note).toContain('Redirect');
    expect(r.tag).toBe('refusal');
    expect(r.logType).toBe('Behavior Note');
  });

  test('academic id → "Accommodation" label', () => {
    const r = buildQuickLogParams('academic');
    expect(r.note).toContain('Accommodation');
    expect(r.tag).toBe('academic');
    expect(r.logType).toBe('Accommodation Used');
  });

  test('break id → "Break" label (no longer "Needed Break")', () => {
    const r = buildQuickLogParams('break');
    expect(r.note).toContain('Break');
    expect(r.note).not.toContain('Needed Break');
    expect(r.tag).toBe('break');
  });

  test('behavior id → "Behavior" label', () => {
    const r = buildQuickLogParams('behavior');
    expect(r.note).toContain('Behavior');
    expect(r.tag).toBe('behavior');
    expect(r.logType).toBe('Behavior Note');
  });

  test('transition id is still resolvable for legacy logs even though it is no longer a quick action', () => {
    const r = buildQuickLogParams('transition');
    expect(r).not.toBeNull();
    expect(r.tag).toBe('transition');
  });

  test('unknown id returns null', () => {
    expect(buildQuickLogParams('nonsense')).toBeNull();
  });
});
