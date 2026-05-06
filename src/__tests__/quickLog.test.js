import { buildQuickLogParams } from '../components/SimpleMode';

describe('buildQuickLogParams — positive (label "Success")', () => {
  test('returns the correct logType for positive', () => {
    const result = buildQuickLogParams('positive');
    expect(result.logType).toBe('Positive Note');
  });

  test('returns the correct tag for positive', () => {
    const result = buildQuickLogParams('positive');
    expect(result.tag).toBe('positive');
  });

  test('note includes the (renamed) category label', () => {
    const result = buildQuickLogParams('positive');
    expect(result.note).toContain('Success');
  });
});

describe('buildQuickLogParams — break', () => {
  test('returns the correct logType for break', () => {
    const result = buildQuickLogParams('break');
    expect(result.logType).toBe('Accommodation Used');
  });

  test('returns the correct tag for break', () => {
    const result = buildQuickLogParams('break');
    expect(result.tag).toBe('break');
  });

  test('note includes the (renamed) category label', () => {
    const result = buildQuickLogParams('break');
    expect(result.note).toContain('Break');
  });
});

describe('buildQuickLogParams — output contract', () => {
  test('note is a non-empty string for both quick-tap categories', () => {
    ['positive', 'break'].forEach(id => {
      const result = buildQuickLogParams(id);
      expect(typeof result.note).toBe('string');
      expect(result.note.length).toBeGreaterThan(0);
    });
  });

  test('logType is a non-empty string for both quick-tap categories', () => {
    ['positive', 'break'].forEach(id => {
      expect(typeof buildQuickLogParams(id).logType).toBe('string');
      expect(buildQuickLogParams(id).logType.length).toBeGreaterThan(0);
    });
  });

  test('returns null for an unknown category id', () => {
    expect(buildQuickLogParams('doesNotExist')).toBeNull();
  });

  test('note format matches the same default used by handleSave (label — support provided.)', () => {
    // The 1-tap note should be identical to what handleSave produces when
    // a category is selected but no free text is typed. This keeps logs consistent.
    expect(buildQuickLogParams('positive').note).toBe('Success — support provided.');
    expect(buildQuickLogParams('break').note).toBe('Break — support provided.');
  });
});
