import { searchCaseMemory } from '../engine';

const makeInc = (id, studentId, opts = {}) => ({
  id, studentId,
  date: '2026-04-01', periodId: 'p3',
  timestamp: new Date().toISOString(),
  description: opts.description || 'test incident',
  category: opts.category || 'behavior',
  tags: opts.tags || [],
  situationId: opts.situationId || null,
  status: 'open', interventionIds: [], logIds: [], relatedIncidentIds: [],
  antecedent: '', setting: 'other', source: 'manual', resolvedAt: null,
});

const makeIntv = (id, incidentId, studentId, opts = {}) => ({
  id, incidentId, studentId,
  timestamp: new Date().toISOString(),
  strategyId: null, strategyLabel: opts.strategyLabel || '',
  accommodationUsed: [], supportCardId: null, staffNote: '', source: 'manual',
});

const makeOut = (id, interventionId, incidentId, studentId, result) => ({
  id, interventionId, incidentId, studentId,
  timestamp: new Date().toISOString(),
  result, timeToResolve: null, studentResponse: '', wouldRepeat: null, note: '',
});

describe('searchCaseMemory', () => {
  test('returns empty array when no incidents exist', () => {
    const results = searchCaseMemory('stu_001', { category: 'behavior', tags: ['escalation'] }, [], [], []);
    expect(results).toEqual([]);
  });

  test('returns empty array when no matches score > 0', () => {
    const incidents = [makeInc('inc_1', 'stu_002', { category: 'academic', tags: ['reading'] })];
    const results = searchCaseMemory('stu_001', { category: 'behavior', tags: ['escalation'] }, incidents, [], []);
    // Different student, different category, no tag overlap → score 0 (filtered out)
    expect(results).toEqual([]);
  });

  test('same-student incidents score +3', () => {
    const incidents = [
      makeInc('inc_1', 'stu_001', { category: 'academic' }),
      makeInc('inc_2', 'stu_002', { category: 'academic' }),
    ];
    const results = searchCaseMemory('stu_001', { category: 'regulation' }, incidents, [], [], { includeOtherStudents: true });
    // inc_1: same_student(+3) + recent(+1) = 4
    // inc_2: different student + recent(+1) = 1
    expect(results.length).toBe(2);
    expect(results[0].incident.id).toBe('inc_1');
    expect(results[0].matchReasons).toContain('same_student');
    expect(results[0].relevanceScore).toBeGreaterThan(results[1].relevanceScore);
  });

  test('same-category incidents score +2', () => {
    const incidents = [
      makeInc('inc_1', 'stu_001', { category: 'behavior' }),
      makeInc('inc_2', 'stu_001', { category: 'academic' }),
    ];
    const results = searchCaseMemory('stu_001', { category: 'behavior', tags: [] }, incidents, [], []);
    // inc_1: same_student(+3) + same_category(+2) = 5
    // inc_2: same_student(+3) = 3
    expect(results[0].incident.id).toBe('inc_1');
    expect(results[0].relevanceScore).toBeGreaterThan(results[1].relevanceScore);
  });

  test('tag overlap adds +1 per matching tag', () => {
    const incidents = [
      makeInc('inc_1', 'stu_001', { tags: ['sensory', 'shutdown', 'noise'] }),
      makeInc('inc_2', 'stu_001', { tags: ['transition'] }),
    ];
    const results = searchCaseMemory('stu_001', { tags: ['sensory', 'shutdown'] }, incidents, [], []);
    // inc_1: same_student(+3) + 2 tags(+2) = 5
    // inc_2: same_student(+3) + 0 tags = 3
    expect(results[0].incident.id).toBe('inc_1');
    expect(results[0].matchReasons).toContain('similar_tags');
  });

  test('same situationId scores +2', () => {
    const incidents = [
      makeInc('inc_1', 'stu_001', { situationId: 'sit_escalating' }),
      makeInc('inc_2', 'stu_001', { situationId: 'sit_math' }),
    ];
    const results = searchCaseMemory('stu_001', { situationId: 'sit_escalating' }, incidents, [], []);
    expect(results[0].incident.id).toBe('inc_1');
    expect(results[0].matchReasons).toContain('same_situation');
  });

  test('interventions with "worked" outcome boost score +2 per', () => {
    const incidents = [
      makeInc('inc_1', 'stu_001'),
      makeInc('inc_2', 'stu_001'),
    ];
    const interventions = [
      makeIntv('intv_1', 'inc_1', 'stu_001', { strategyLabel: 'Headphones' }),
      makeIntv('intv_2', 'inc_2', 'stu_001', { strategyLabel: 'Break pass' }),
    ];
    const outcomes = [
      makeOut('out_1', 'intv_1', 'inc_1', 'stu_001', 'worked'),
      makeOut('out_2', 'intv_2', 'inc_2', 'stu_001', 'failed'),
    ];
    const results = searchCaseMemory('stu_001', {}, incidents, interventions, outcomes);
    // inc_1: same_student(+3) + worked(+2) = 5
    // inc_2: same_student(+3) + failed(+0) = 3
    expect(results[0].incident.id).toBe('inc_1');
    expect(results[0].matchReasons).toContain('has_success');
    expect(results[0].interventions[0].outcome.result).toBe('worked');
  });

  test('results sorted by relevance descending', () => {
    const incidents = [
      makeInc('inc_lo', 'stu_001', { category: 'academic' }),
      makeInc('inc_hi', 'stu_001', { category: 'behavior', tags: ['escalation'], situationId: 'sit_escalating' }),
    ];
    const results = searchCaseMemory('stu_001', { category: 'behavior', tags: ['escalation'], situationId: 'sit_escalating' }, incidents, [], []);
    expect(results[0].incident.id).toBe('inc_hi');
    expect(results[0].relevanceScore).toBeGreaterThanOrEqual(results[1].relevanceScore);
  });

  test('maxResults limits output', () => {
    const incidents = Array.from({ length: 10 }, (_, i) => makeInc(`inc_${i}`, 'stu_001'));
    const results = searchCaseMemory('stu_001', {}, incidents, [], [], { maxResults: 3 });
    expect(results.length).toBe(3);
  });

  test('incident with no interventions still appears', () => {
    const incidents = [makeInc('inc_bare', 'stu_001')];
    const results = searchCaseMemory('stu_001', {}, incidents, [], []);
    expect(results.length).toBe(1);
    expect(results[0].interventions).toEqual([]);
  });

  test('excludes current incident by ID', () => {
    const incidents = [
      makeInc('inc_current', 'stu_001', { category: 'behavior' }),
      makeInc('inc_past', 'stu_001', { category: 'behavior' }),
    ];
    const results = searchCaseMemory('stu_001', { id: 'inc_current', category: 'behavior' }, incidents, [], []);
    expect(results.length).toBe(1);
    expect(results[0].incident.id).toBe('inc_past');
  });

  test('filters to same student by default', () => {
    const incidents = [
      makeInc('inc_1', 'stu_001'),
      makeInc('inc_2', 'stu_002'),
    ];
    const results = searchCaseMemory('stu_001', {}, incidents, [], []);
    expect(results.every(r => r.incident.studentId === 'stu_001')).toBe(true);
  });

  test('includeOtherStudents expands search', () => {
    const incidents = [
      makeInc('inc_1', 'stu_001', { category: 'behavior' }),
      makeInc('inc_2', 'stu_002', { category: 'behavior' }),
    ];
    const results = searchCaseMemory('stu_001', { category: 'behavior' }, incidents, [], [], { includeOtherStudents: true });
    expect(results.length).toBe(2);
  });
});
