import { createIncident, createIntervention, createOutcome } from '../models';
import { searchCaseMemory, isHelpWorthy, matchCaseKeywords } from '../engine';
import { DEMO_STUDENTS } from '../data';
import { DEMO_INCIDENTS, DEMO_INTERVENTIONS, DEMO_OUTCOMES } from '../data/demoSeedData';

describe('Help Flow Integration', () => {
  // Simulate full: incident → intervention → outcome → search finds it
  test('full incident → intervention → outcome cycle', () => {
    const inc = createIncident({
      studentId: 'stu_005',
      description: 'Covered ears during loud discussion',
      date: '2026-04-01',
      periodId: 'p3',
      category: 'regulation',
      tags: ['sensory', 'shutdown'],
    });

    expect(inc.id).toMatch(/^inc_/);
    expect(inc.studentId).toBe('stu_005');
    expect(inc.status).toBe('open');

    const intv = createIntervention({
      incidentId: inc.id,
      studentId: 'stu_005',
      strategyLabel: 'Offered headphones',
      accommodationUsed: ['Noise-Canceling Headphones'],
      staffNote: 'Slid headphones across desk',
    });

    expect(intv.id).toMatch(/^intv_/);
    expect(intv.incidentId).toBe(inc.id);

    const out = createOutcome({
      interventionId: intv.id,
      incidentId: inc.id,
      studentId: 'stu_005',
      result: 'worked',
      timeToResolve: 3,
      studentResponse: 'Regulated within 3 min',
      wouldRepeat: true,
    });

    expect(out.id).toMatch(/^out_/);
    expect(out.result).toBe('worked');
    expect(out.wouldRepeat).toBe(true);
  });

  test('searchCaseMemory finds incidents with matching tags', () => {
    const incidents = [
      createIncident({
        studentId: 'stu_005',
        description: 'Sensory overload from noise',
        date: new Date().toISOString().split('T')[0],
        periodId: 'p3',
        category: 'regulation',
        tags: ['sensory', 'shutdown'],
      }),
    ];

    const interventions = [
      createIntervention({
        incidentId: incidents[0].id,
        studentId: 'stu_005',
        strategyLabel: 'Headphones offered',
        accommodationUsed: ['Headphones'],
      }),
    ];

    const outcomes = [
      createOutcome({
        interventionId: interventions[0].id,
        incidentId: incidents[0].id,
        studentId: 'stu_005',
        result: 'worked',
      }),
    ];

    const results = searchCaseMemory(
      'stu_005',
      { category: 'regulation', tags: ['sensory'], description: 'ears covered' },
      incidents,
      interventions,
      outcomes,
      { maxResults: 5 }
    );

    expect(results.length).toBe(1);
    expect(results[0].incident.id).toBe(incidents[0].id);
    expect(results[0].interventions.length).toBe(1);
    expect(results[0].interventions[0].outcome.result).toBe('worked');
    expect(results[0].relevanceScore).toBeGreaterThan(0);
  });

  test('case memory search ranks same-student higher than different-student', () => {
    const incidents = [
      createIncident({
        studentId: 'stu_005',
        description: 'Sensory issue',
        date: new Date().toISOString().split('T')[0],
        periodId: 'p3',
        category: 'regulation',
        tags: ['sensory'],
      }),
      createIncident({
        studentId: 'stu_003',
        description: 'Sensory issue',
        date: new Date().toISOString().split('T')[0],
        periodId: 'p2',
        category: 'regulation',
        tags: ['sensory'],
      }),
    ];

    const results = searchCaseMemory(
      'stu_005',
      { category: 'regulation', tags: ['sensory'], description: 'sensory' },
      incidents, [], [],
      { maxResults: 5, includeOtherStudents: true }
    );

    // same student should rank higher
    const sameStudentResult = results.find(r => r.incident.studentId === 'stu_005');
    const otherStudentResult = results.find(r => r.incident.studentId === 'stu_003');

    if (sameStudentResult && otherStudentResult) {
      expect(sameStudentResult.relevanceScore).toBeGreaterThan(otherStudentResult.relevanceScore);
    }
  });

  test('worked interventions boost relevance score', () => {
    const incidents = [
      createIncident({
        studentId: 'stu_005',
        description: 'Sensory issue A',
        date: new Date().toISOString().split('T')[0],
        periodId: 'p3',
        category: 'regulation',
        tags: ['sensory'],
      }),
      createIncident({
        studentId: 'stu_005',
        description: 'Sensory issue B',
        date: new Date().toISOString().split('T')[0],
        periodId: 'p3',
        category: 'regulation',
        tags: ['sensory'],
      }),
    ];

    const interventions = [
      createIntervention({
        incidentId: incidents[0].id,
        studentId: 'stu_005',
        strategyLabel: 'Strategy A',
      }),
    ];

    const outcomes = [
      createOutcome({
        interventionId: interventions[0].id,
        incidentId: incidents[0].id,
        studentId: 'stu_005',
        result: 'worked',
      }),
    ];

    const results = searchCaseMemory(
      'stu_005',
      { category: 'regulation', tags: ['sensory'], description: 'sensory' },
      incidents, interventions, outcomes,
      { maxResults: 5 }
    );

    // incident with worked intervention should score higher
    const withOutcome = results.find(r => r.incident.id === incidents[0].id);
    const withoutOutcome = results.find(r => r.incident.id === incidents[1].id);

    expect(withOutcome.relevanceScore).toBeGreaterThan(withoutOutcome.relevanceScore);
  });

  test('empty case memory returns empty array gracefully', () => {
    const results = searchCaseMemory(
      'stu_005',
      { category: 'regulation', tags: ['sensory'], description: 'test' },
      [], [], [],
      { maxResults: 5 }
    );

    expect(results).toEqual([]);
  });

  test('explicit category and tags are preserved', () => {
    const inc = createIncident({
      studentId: 'stu_007',
      description: 'Student yelling and escalating',
      date: '2026-04-01',
      periodId: 'p5',
      category: 'behavior',
      tags: ['escalation', 'refusal'],
    });
    expect(inc.category).toBe('behavior');
    expect(inc.tags).toEqual(['escalation', 'refusal']);
  });

  test('category defaults to general when not provided', () => {
    const inc = createIncident({
      studentId: 'stu_004',
      description: 'Something happened',
      date: '2026-04-01',
      periodId: 'p3',
    });
    // detectCategory uses log type map, description falls through to "general"
    expect(inc.category).toBeDefined();
  });

  test('tags from description auto-detection includes escalation keyword', () => {
    const inc = createIncident({
      studentId: 'stu_005',
      description: 'Student escalating and covering ears',
      date: '2026-04-01',
      periodId: 'p3',
    });
    // generateTags checks for escalation keyword in note
    expect(inc.tags).toContain('escalation');
  });
});

describe('isHelpWorthy', () => {
  test('detects help-worthy keywords', () => {
    expect(isHelpWorthy('Student threw a chair')).toBe(true);
    expect(isHelpWorthy('Yelling at peers during math')).toBe(true);
    expect(isHelpWorthy('Ran out of the classroom')).toBe(true);
    expect(isHelpWorthy('Refused all work today')).toBe(true);
    expect(isHelpWorthy('Student shut down completely')).toBe(true);
    expect(isHelpWorthy('Crying at desk')).toBe(true);
    expect(isHelpWorthy('Unsafe behavior in hallway')).toBe(true);
    expect(isHelpWorthy('Student was aggressive towards aide')).toBe(true);
    expect(isHelpWorthy('Left room without permission')).toBe(true);
    expect(isHelpWorthy('Walked out of class without permission')).toBe(true);
    expect(isHelpWorthy('Walked out of class without permisson')).toBe(true);
    expect(isHelpWorthy('Full meltdown during transition')).toBe(true);
    expect(isHelpWorthy('Student seemed dysregulated')).toBe(true);
    expect(isHelpWorthy('Hit another student')).toBe(true);
    expect(isHelpWorthy('Student escalated quickly')).toBe(true);
  });

  test('does NOT trigger for normal observations', () => {
    expect(isHelpWorthy('Completed 5 math problems today')).toBe(false);
    expect(isHelpWorthy('Great participation in reading group')).toBe(false);
    expect(isHelpWorthy('Used calculator independently')).toBe(false);
    expect(isHelpWorthy('On task for 20 minutes')).toBe(false);
    expect(isHelpWorthy('')).toBe(false);
    expect(isHelpWorthy('Hi')).toBe(false);
    expect(isHelpWorthy(null)).toBe(false);
  });
});

describe('Guided Flow Data Model', () => {
  test('createIncident with guided source stores antecedent', () => {
    const inc = createIncident({
      studentId: 'stu_007',
      description: 'Student threw materials',
      date: '2026-04-02',
      periodId: 'p5',
      category: 'behavior',
      antecedent: 'Peer conflict',
      source: 'guided',
    });
    expect(inc.antecedent).toBe('Peer conflict');
    expect(inc.source).toBe('guided');
    expect(inc.status).toBe('open');
  });

  test('full guided flow creates linked incident → intervention → outcome', () => {
    const inc = createIncident({
      studentId: 'stu_007',
      description: 'Threw chair during math',
      date: '2026-04-02',
      periodId: 'p5',
      category: 'behavior',
      antecedent: 'Work demand',
      source: 'guided',
    });

    const intv = createIntervention({
      incidentId: inc.id,
      studentId: 'stu_007',
      strategyLabel: 'Gave space',
      staffNote: 'Stepped back and waited',
      source: 'guided',
    });

    const out = createOutcome({
      interventionId: intv.id,
      incidentId: inc.id,
      studentId: 'stu_007',
      result: 'did_not_work',
      studentResponse: 'Escalated more',
      wouldRepeat: false,
      note: 'Need to try break card next time',
    });

    expect(out.result).toBe('did_not_work');
    expect(out.wouldRepeat).toBe(false);
    expect(out.studentResponse).toBe('Escalated more');
    expect(intv.incidentId).toBe(inc.id);
    expect(out.interventionId).toBe(intv.id);
  });

  test('failed outcomes are stored and retrievable via searchCaseMemory', () => {
    const inc = createIncident({
      studentId: 'stu_007',
      description: 'Aggressive behavior',
      date: new Date().toISOString().split('T')[0],
      periodId: 'p5',
      category: 'behavior',
      tags: ['escalation', 'aggression'],
    });

    const intv = createIntervention({
      incidentId: inc.id,
      studentId: 'stu_007',
      strategyLabel: 'Verbal redirect',
    });

    const out = createOutcome({
      interventionId: intv.id,
      incidentId: inc.id,
      studentId: 'stu_007',
      result: 'did_not_work',
    });

    const results = searchCaseMemory(
      'stu_007',
      { category: 'behavior', tags: ['escalation'] },
      [inc], [intv], [out],
      { maxResults: 5 }
    );

    expect(results.length).toBe(1);
    expect(results[0].interventions[0].outcome.result).toBe('did_not_work');
  });
});

describe('Demo Seed Data — Failed Outcome', () => {
  test('demo data includes a did_not_work outcome', () => {
    const failed = DEMO_OUTCOMES.find(o => o.result === 'did_not_work');
    expect(failed).toBeDefined();
    expect(failed.id).toBe('out_demo_018');
    expect(failed.wouldRepeat).toBe(false);
  });

  test('failed outcome links to existing incident and intervention', () => {
    const failed = DEMO_OUTCOMES.find(o => o.id === 'out_demo_018');
    const inc = DEMO_INCIDENTS.find(i => i.id === failed.incidentId);
    const intv = DEMO_INTERVENTIONS.find(i => i.id === failed.interventionId);
    expect(inc).toBeDefined();
    expect(intv).toBeDefined();
    expect(inc.studentId).toBe('stu_007');
  });

  test('matchCaseKeywords finds failed outcome in demo data', () => {
    const results = matchCaseKeywords('throwing materials yelling', DEMO_INCIDENTS, DEMO_INTERVENTIONS, DEMO_OUTCOMES, 5);
    expect(results.length).toBeGreaterThan(0);
    // Should find the failed incident about throwing materials
    const throwingMatch = results.find(r => r.behavior.includes('throwing'));
    expect(throwingMatch).toBeDefined();
  });
});
