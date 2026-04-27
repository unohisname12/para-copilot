import { countWithoutCounter } from '../engine/trainingGapPredicates';

// Helper: build a minimal log with the fields the predicate cares about.
function log({ studentId = 'stu_001', tags = [], daysAgo = 0 } = {}) {
  const ts = new Date(Date.now() - daysAgo * 86400000).toISOString();
  return { id: `log_${Math.random()}`, studentId, tags, timestamp: ts };
}

describe('countWithoutCounter', () => {
  test('fires when presence>=min and counter<=max within window', () => {
    const logs = [
      log({ tags: ['break', 'regulation'], daysAgo: 0 }),
      log({ tags: ['break'], daysAgo: 1 }),
      log({ tags: ['regulation'], daysAgo: 2 }),
    ];
    const result = countWithoutCounter({
      logs,
      studentId: 'stu_001',
      windowDays: 7,
      presenceTags: ['break', 'regulation'],
      presenceMin: 3,
      counterTags: ['fct', 'replacement_skill'],
      counterMax: 0,
    });
    expect(result.fired).toBe(true);
    expect(result.evidenceLogs).toHaveLength(3);
    expect(result.presenceCount).toBe(3);
    expect(result.counterCount).toBe(0);
  });

  test('does not fire when presence count below min', () => {
    const logs = [
      log({ tags: ['break'], daysAgo: 0 }),
      log({ tags: ['break'], daysAgo: 1 }),
    ];
    const result = countWithoutCounter({
      logs,
      studentId: 'stu_001',
      windowDays: 7,
      presenceTags: ['break'],
      presenceMin: 3,
      counterTags: ['fct'],
      counterMax: 0,
    });
    expect(result.fired).toBe(false);
    expect(result.presenceCount).toBe(2);
  });

  test('does not fire when counter count exceeds max', () => {
    const logs = [
      log({ tags: ['break'], daysAgo: 0 }),
      log({ tags: ['break'], daysAgo: 1 }),
      log({ tags: ['break'], daysAgo: 2 }),
      log({ tags: ['fct'], daysAgo: 3 }),
    ];
    const result = countWithoutCounter({
      logs,
      studentId: 'stu_001',
      windowDays: 7,
      presenceTags: ['break'],
      presenceMin: 3,
      counterTags: ['fct'],
      counterMax: 0,
    });
    expect(result.fired).toBe(false);
    expect(result.counterCount).toBe(1);
  });

  test('counterMax of 1 allows up to 1 counter log (Rule 2 case)', () => {
    const logs = [
      log({ tags: ['redirect'], daysAgo: 0 }),
      log({ tags: ['redirect'], daysAgo: 1 }),
      log({ tags: ['redirect'], daysAgo: 2 }),
      log({ tags: ['positive'], daysAgo: 3 }),
    ];
    const result = countWithoutCounter({
      logs,
      studentId: 'stu_001',
      windowDays: 7,
      presenceTags: ['redirect'],
      presenceMin: 3,
      counterTags: ['positive'],
      counterMax: 1,
    });
    expect(result.fired).toBe(true);
  });

  test('ignores logs outside the window', () => {
    const logs = [
      log({ tags: ['break'], daysAgo: 0 }),
      log({ tags: ['break'], daysAgo: 1 }),
      log({ tags: ['break'], daysAgo: 30 }), // outside 7-day window
    ];
    const result = countWithoutCounter({
      logs,
      studentId: 'stu_001',
      windowDays: 7,
      presenceTags: ['break'],
      presenceMin: 3,
      counterTags: ['fct'],
      counterMax: 0,
    });
    expect(result.fired).toBe(false);
    expect(result.presenceCount).toBe(2);
  });

  test('only counts logs for the specified student (per-student scope)', () => {
    const logs = [
      log({ studentId: 'stu_001', tags: ['break'], daysAgo: 0 }),
      log({ studentId: 'stu_002', tags: ['break'], daysAgo: 0 }),
      log({ studentId: 'stu_002', tags: ['break'], daysAgo: 1 }),
      log({ studentId: 'stu_002', tags: ['break'], daysAgo: 2 }),
    ];
    const result = countWithoutCounter({
      logs,
      studentId: 'stu_001',
      windowDays: 7,
      presenceTags: ['break'],
      presenceMin: 3,
      counterTags: ['fct'],
      counterMax: 0,
    });
    expect(result.fired).toBe(false);
    expect(result.presenceCount).toBe(1);
  });

  test('tag matching is OR semantics — a log with any presenceTag counts', () => {
    const logs = [
      log({ tags: ['redirect', 'behavior'], daysAgo: 0 }),
      log({ tags: ['deescalation', 'bip'], daysAgo: 1 }),
      log({ tags: ['break', 'regulation'], daysAgo: 2 }),
    ];
    const result = countWithoutCounter({
      logs,
      studentId: 'stu_001',
      windowDays: 14,
      presenceTags: ['redirect', 'deescalation', 'break'],
      presenceMin: 3,
      counterTags: ['skill_teaching'],
      counterMax: 0,
    });
    expect(result.fired).toBe(true);
    expect(result.presenceCount).toBe(3);
  });

  test('a single log matching both presence and counter tags counts once on each side', () => {
    // A break-requested log (tags include both 'break' and 'fct') — would count as
    // BOTH a presence (break) and a counter (fct). Intentional: the counter side
    // suppresses firing, which is the correct outcome for Rule 1.
    const logs = [
      log({ tags: ['break'], daysAgo: 0 }),
      log({ tags: ['break'], daysAgo: 1 }),
      log({ tags: ['break', 'fct', 'replacement_skill'], daysAgo: 2 }),
    ];
    const result = countWithoutCounter({
      logs,
      studentId: 'stu_001',
      windowDays: 7,
      presenceTags: ['break'],
      presenceMin: 3,
      counterTags: ['fct'],
      counterMax: 0,
    });
    expect(result.presenceCount).toBe(3);
    expect(result.counterCount).toBe(1);
    expect(result.fired).toBe(false);
  });
});
