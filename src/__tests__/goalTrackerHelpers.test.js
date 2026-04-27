import {
  summarizeGoalProgress,
  optionForId,
  recentSupportTagsForStudent,
  pickNextBestSupport,
  buildVisualGoalData,
  summarizeStudentGoals,
  trendSymbol,
} from '../components/panels/goalTrackerHelpers';

function log({ studentId = 'stu_a', goalId = null, tags = [], daysAgo = 0 } = {}) {
  return {
    id: `log_${Math.random()}`,
    studentId, goalId, tags,
    timestamp: new Date(Date.now() - daysAgo * 86400000).toISOString(),
  };
}

describe('summarizeGoalProgress', () => {
  test('returns zeroed summary when no matching logs', () => {
    expect(summarizeGoalProgress([], 'g1', 14)).toEqual({
      totalCount: 0,
      latestOptionId: null,
      positive: 0,
      negative: 0,
      neutral: 0,
      latestTimestamp: null,
    });
  });

  test('counts positive vs. negative vs. neutral by goal-progress tag', () => {
    const logs = [
      log({ goalId: 'g1', tags: ['goal', 'gp_progress'], daysAgo: 1 }),
      log({ goalId: 'g1', tags: ['goal', 'gp_support'], daysAgo: 2 }),
      log({ goalId: 'g1', tags: ['goal', 'gp_concern'], daysAgo: 3 }),
      log({ goalId: 'g1', tags: ['goal', 'gp_prompt'], daysAgo: 4 }),
    ];
    const s = summarizeGoalProgress(logs, 'g1', 14);
    expect(s.totalCount).toBe(4);
    expect(s.positive).toBe(2); // progress + support
    expect(s.negative).toBe(1); // concern
    expect(s.neutral).toBe(1); // prompt
  });

  test('latestOptionId reflects the most recent log by timestamp', () => {
    const logs = [
      log({ goalId: 'g1', tags: ['goal', 'gp_concern'], daysAgo: 5 }),
      log({ goalId: 'g1', tags: ['goal', 'gp_mastery'], daysAgo: 1 }),
      log({ goalId: 'g1', tags: ['goal', 'gp_progress'], daysAgo: 3 }),
    ];
    expect(summarizeGoalProgress(logs, 'g1', 14).latestOptionId).toBe('gp_mastery');
  });

  test('respects windowDays', () => {
    const logs = [
      log({ goalId: 'g1', tags: ['gp_progress'], daysAgo: 0 }),
      log({ goalId: 'g1', tags: ['gp_progress'], daysAgo: 30 }),
    ];
    expect(summarizeGoalProgress(logs, 'g1', 7).totalCount).toBe(1);
  });

  test('ignores logs with a different goalId', () => {
    const logs = [
      log({ goalId: 'g1', tags: ['gp_progress'], daysAgo: 0 }),
      log({ goalId: 'g2', tags: ['gp_progress'], daysAgo: 0 }),
    ];
    expect(summarizeGoalProgress(logs, 'g1', 14).totalCount).toBe(1);
  });
});

describe('optionForId', () => {
  test('returns the option object for a known id', () => {
    expect(optionForId('gp_progress')).toMatchObject({ id: 'gp_progress', label: 'Progress Made' });
  });
  test('returns null for unknown id', () => {
    expect(optionForId('gp_nope')).toBeNull();
    expect(optionForId(null)).toBeNull();
  });
});

describe('recentSupportTagsForStudent', () => {
  test('returns deduped tags ordered by recency, capped by max', () => {
    const logs = [
      log({ studentId: 'stu_a', tags: ['break', 'regulation'], daysAgo: 0 }),
      log({ studentId: 'stu_a', tags: ['redirect', 'behavior'], daysAgo: 1 }),
      log({ studentId: 'stu_a', tags: ['break'], daysAgo: 2 }), // dupe
    ];
    const out = recentSupportTagsForStudent(logs, 'stu_a', 7, 5);
    expect(out).toEqual(['break', 'regulation', 'redirect', 'behavior']);
  });

  test('skips meta tags (goal, handoff, gp_*)', () => {
    const logs = [
      log({ studentId: 'stu_a', tags: ['goal', 'gp_progress', 'break'], daysAgo: 0 }),
    ];
    expect(recentSupportTagsForStudent(logs, 'stu_a', 7, 5)).toEqual(['break']);
  });

  test('respects windowDays', () => {
    const logs = [
      log({ studentId: 'stu_a', tags: ['break'], daysAgo: 30 }),
    ];
    expect(recentSupportTagsForStudent(logs, 'stu_a', 7, 5)).toEqual([]);
  });

  test('only returns this student\'s logs', () => {
    const logs = [
      log({ studentId: 'stu_a', tags: ['break'], daysAgo: 0 }),
      log({ studentId: 'stu_b', tags: ['praise'], daysAgo: 0 }),
    ];
    expect(recentSupportTagsForStudent(logs, 'stu_a', 7, 5)).toEqual(['break']);
  });

  test('caps at max', () => {
    const logs = [
      log({ studentId: 'stu_a', tags: ['a', 'b', 'c', 'd', 'e', 'f'], daysAgo: 0 }),
    ];
    expect(recentSupportTagsForStudent(logs, 'stu_a', 7, 3)).toEqual(['a', 'b', 'c']);
  });
});

describe('pickNextBestSupport', () => {
  const strategies = [
    { id: 'str_chunk', tags: ['chunking', 'adhd', 'writing'] },
    { id: 'str_firstthen', tags: ['first-then', 'autism', 'transition'] },
  ];

  test('returns the strategy with the highest tag overlap', () => {
    const student = { tags: ['adhd', 'writing'] };
    const goal = { area: 'Writing', text: 'Complete writing tasks' };
    const out = pickNextBestSupport({ student, goal, strategies });
    expect(out?.id).toBe('str_chunk');
  });

  test('returns null when no overlap', () => {
    const student = { tags: ['low-vision'] };
    const goal = { area: 'Math', text: 'compute sums' };
    expect(pickNextBestSupport({ student, goal, strategies })).toBeNull();
  });

  test('handles missing input safely', () => {
    expect(pickNextBestSupport({})).toBeNull();
    expect(pickNextBestSupport({ student: {}, goal: {}, strategies: null })).toBeNull();
  });
});

describe('summarizeStudentGoals', () => {
  const student = {
    id: 'stu_a',
    goals: [{ id: 'g1' }, { id: 'g2' }],
  };

  test('returns zeroed shape when student has no goals', () => {
    const out = summarizeStudentGoals([], { id: 'stu_a', goals: [] }, 14);
    expect(out).toEqual({ total: 0, positive: 0, neutral: 0, negative: 0, today: 0, trend: 'flat', priorTotal: 0 });
  });

  test('counts positive/neutral/negative across all student goals', () => {
    const logs = [
      log({ goalId: 'g1', tags: ['gp_progress'], daysAgo: 1 }),
      log({ goalId: 'g2', tags: ['gp_concern'], daysAgo: 2 }),
      log({ goalId: 'g1', tags: ['gp_prompt'], daysAgo: 3 }),
      log({ goalId: 'g2', tags: ['gp_mastery'], daysAgo: 4 }),
    ];
    const out = summarizeStudentGoals(logs, student, 14);
    expect(out.total).toBe(4);
    expect(out.positive).toBe(2);
    expect(out.negative).toBe(1);
    expect(out.neutral).toBe(1);
  });

  test('today count uses todayʼs YYYY-MM-DD', () => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const logs = [
      { ...log({ goalId: 'g1', tags: ['gp_progress'], daysAgo: 0 }), date: todayStr },
      { ...log({ goalId: 'g1', tags: ['gp_progress'], daysAgo: 5 }), date: '2020-01-01' },
    ];
    const out = summarizeStudentGoals(logs, student, 14);
    expect(out.today).toBe(1);
  });

  test('trend = up when this window has more logs than prior', () => {
    const logs = [
      log({ goalId: 'g1', tags: ['gp_progress'], daysAgo: 1 }),
      log({ goalId: 'g1', tags: ['gp_progress'], daysAgo: 2 }),
      log({ goalId: 'g1', tags: ['gp_progress'], daysAgo: 16 }), // prior window
    ];
    expect(summarizeStudentGoals(logs, student, 14).trend).toBe('up');
  });

  test('trend = down when this window has fewer logs than prior', () => {
    const logs = [
      log({ goalId: 'g1', tags: ['gp_progress'], daysAgo: 16 }),
      log({ goalId: 'g1', tags: ['gp_progress'], daysAgo: 17 }),
      log({ goalId: 'g1', tags: ['gp_progress'], daysAgo: 18 }),
      log({ goalId: 'g1', tags: ['gp_progress'], daysAgo: 1 }),
    ];
    expect(summarizeStudentGoals(logs, student, 14).trend).toBe('down');
  });

  test('ignores logs for goals not on this student', () => {
    const logs = [
      log({ goalId: 'g_other', tags: ['gp_progress'], daysAgo: 1 }),
    ];
    expect(summarizeStudentGoals(logs, student, 14).total).toBe(0);
  });
});

describe('trendSymbol', () => {
  test('maps trends to arrows', () => {
    expect(trendSymbol('up')).toBe('↑');
    expect(trendSymbol('down')).toBe('↓');
    expect(trendSymbol('flat')).toBe('→');
    expect(trendSymbol('garbage')).toBe('→');
  });
});

describe('buildVisualGoalData', () => {
  test('returns one entry per known student with nested goal data', () => {
    const studentsMap = {
      stu_a: { id: 'stu_a', pseudonym: 'Red 1', tags: ['adhd'], goals: [{ id: 'g1', text: 'Focus 10 min', area: 'Attention' }] },
      stu_b: { id: 'stu_b', pseudonym: 'Blue 1', tags: [], goals: [] },
    };
    const logs = [
      log({ studentId: 'stu_a', goalId: 'g1', tags: ['goal', 'gp_mastery'], daysAgo: 1 }),
    ];
    const out = buildVisualGoalData({
      studentIds: ['stu_a', 'stu_b'],
      studentsMap,
      logs,
      strategies: [],
    });
    expect(out).toHaveLength(2);
    expect(out[0].goals).toHaveLength(1);
    expect(out[0].goals[0].summary.totalCount).toBe(1);
    expect(out[0].goals[0].latestOption.id).toBe('gp_mastery');
    expect(out[1].goals).toEqual([]);
  });

  test('skips student ids that aren\'t in studentsMap', () => {
    const out = buildVisualGoalData({
      studentIds: ['ghost'],
      studentsMap: {},
      logs: [],
      strategies: [],
    });
    expect(out).toEqual([]);
  });
});
