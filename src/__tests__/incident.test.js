import { createIncident, createIntervention, createOutcome, validateStudentId } from '../models';

describe('createIncident', () => {
  test('generates valid incident with all defaults', () => {
    const inc = createIncident({
      studentId: 'stu_001',
      description: 'Student covered ears during loud group work',
      date: '2026-04-01',
      periodId: 'p3',
    });

    expect(inc.id).toMatch(/^inc_/);
    expect(inc.studentId).toBe('stu_001');
    expect(inc.description).toBe('Student covered ears during loud group work');
    expect(inc.date).toBe('2026-04-01');
    expect(inc.periodId).toBe('p3');
    expect(inc.timestamp).toBeTruthy();
    expect(inc.status).toBe('open');
    expect(inc.resolvedAt).toBeNull();
    expect(inc.source).toBe('manual');
    expect(inc.antecedent).toBe('');
    expect(inc.setting).toBe('other');
    expect(inc.logIds).toEqual([]);
    expect(inc.interventionIds).toEqual([]);
    expect(inc.relatedIncidentIds).toEqual([]);
  });

  test('auto-detects category from description', () => {
    const inc = createIncident({
      studentId: 'stu_001',
      description: 'Behavior escalation during transition',
      date: '2026-04-01',
      periodId: 'p1',
    });
    expect(inc.category).toBeTruthy();
  });

  test('uses provided category over auto-detect', () => {
    const inc = createIncident({
      studentId: 'stu_002',
      description: 'test',
      date: '2026-04-01',
      periodId: 'p1',
      category: 'regulation',
    });
    expect(inc.category).toBe('regulation');
  });

  test('auto-generates tags from description', () => {
    const inc = createIncident({
      studentId: 'stu_003',
      description: 'Student escalating, threw materials after break',
      date: '2026-04-01',
      periodId: 'p2',
    });
    expect(inc.tags.length).toBeGreaterThan(0);
  });

  test('uses provided tags over auto-detect', () => {
    const inc = createIncident({
      studentId: 'stu_001',
      description: 'test',
      date: '2026-04-01',
      periodId: 'p1',
      tags: ['sensory', 'shutdown'],
    });
    expect(inc.tags).toEqual(['sensory', 'shutdown']);
  });

  test('preserves optional fields', () => {
    const inc = createIncident({
      studentId: 'stu_005',
      description: 'test',
      date: '2026-04-01',
      periodId: 'p3',
      situationId: 'sit_escalating',
      antecedent: 'Loud noise',
      setting: 'group_work',
      source: 'help_button',
    });
    expect(inc.situationId).toBe('sit_escalating');
    expect(inc.antecedent).toBe('Loud noise');
    expect(inc.setting).toBe('group_work');
    expect(inc.source).toBe('help_button');
  });

  test('generates unique IDs for consecutive calls', () => {
    const a = createIncident({ studentId: 'stu_001', description: 'a', date: '2026-04-01', periodId: 'p1' });
    const b = createIncident({ studentId: 'stu_001', description: 'b', date: '2026-04-01', periodId: 'p1' });
    expect(a.id).not.toBe(b.id);
  });
});

describe('createIntervention', () => {
  test('generates valid intervention with defaults', () => {
    const intv = createIntervention({
      incidentId: 'inc_123',
      studentId: 'stu_005',
    });

    expect(intv.id).toMatch(/^intv_/);
    expect(intv.incidentId).toBe('inc_123');
    expect(intv.studentId).toBe('stu_005');
    expect(intv.timestamp).toBeTruthy();
    expect(intv.strategyId).toBeNull();
    expect(intv.strategyLabel).toBe('');
    expect(intv.accommodationUsed).toEqual([]);
    expect(intv.supportCardId).toBeNull();
    expect(intv.staffNote).toBe('');
    expect(intv.source).toBe('manual');
  });

  test('preserves all provided fields', () => {
    const intv = createIntervention({
      incidentId: 'inc_123',
      studentId: 'stu_005',
      strategyId: 'str_chunk',
      strategyLabel: 'Task Chunking',
      accommodationUsed: ['Graph Paper', 'Calculator'],
      supportCardId: 'sc_math',
      staffNote: 'Broke problem into 3 steps',
      source: 'help_suggestion',
    });

    expect(intv.strategyId).toBe('str_chunk');
    expect(intv.strategyLabel).toBe('Task Chunking');
    expect(intv.accommodationUsed).toEqual(['Graph Paper', 'Calculator']);
    expect(intv.supportCardId).toBe('sc_math');
    expect(intv.staffNote).toBe('Broke problem into 3 steps');
    expect(intv.source).toBe('help_suggestion');
  });
});

describe('createOutcome', () => {
  test('generates valid outcome with defaults', () => {
    const out = createOutcome({
      interventionId: 'intv_123',
      incidentId: 'inc_123',
      studentId: 'stu_005',
      result: 'worked',
    });

    expect(out.id).toMatch(/^out_/);
    expect(out.interventionId).toBe('intv_123');
    expect(out.incidentId).toBe('inc_123');
    expect(out.studentId).toBe('stu_005');
    expect(out.result).toBe('worked');
    expect(out.timestamp).toBeTruthy();
    expect(out.timeToResolve).toBeNull();
    expect(out.studentResponse).toBe('');
    expect(out.wouldRepeat).toBeNull();
    expect(out.note).toBe('');
  });

  test('preserves all provided fields', () => {
    const out = createOutcome({
      interventionId: 'intv_123',
      incidentId: 'inc_123',
      studentId: 'stu_005',
      result: 'partly',
      timeToResolve: 5,
      studentResponse: 'Calmed down after 5 minutes',
      wouldRepeat: true,
      note: 'Works for sensory overload but not frustration',
    });

    expect(out.result).toBe('partly');
    expect(out.timeToResolve).toBe(5);
    expect(out.studentResponse).toBe('Calmed down after 5 minutes');
    expect(out.wouldRepeat).toBe(true);
    expect(out.note).toBe('Works for sensory overload but not frustration');
  });

  test('accepts all result values', () => {
    ['worked', 'partly', 'failed', 'unknown'].forEach(result => {
      const out = createOutcome({ interventionId: 'intv_1', incidentId: 'inc_1', studentId: 'stu_001', result });
      expect(out.result).toBe(result);
    });
  });
});
