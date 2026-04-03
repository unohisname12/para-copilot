import { DEMO_INCIDENTS, DEMO_INTERVENTIONS, DEMO_OUTCOMES, DEMO_LOGS } from '../data/demoSeedData';
import { DEMO_STUDENTS, DB } from '../data';

describe('Showcase Demo Data', () => {
  test('demo incidents reference valid demo student IDs', () => {
    DEMO_INCIDENTS.forEach(inc => {
      expect(DEMO_STUDENTS[inc.studentId]).toBeDefined();
    });
  });

  test('demo interventions reference valid incident IDs', () => {
    const incIds = new Set(DEMO_INCIDENTS.map(i => i.id));
    DEMO_INTERVENTIONS.forEach(intv => {
      expect(incIds.has(intv.incidentId)).toBe(true);
    });
  });

  test('demo interventions reference valid student IDs', () => {
    DEMO_INTERVENTIONS.forEach(intv => {
      expect(DEMO_STUDENTS[intv.studentId]).toBeDefined();
    });
  });

  test('demo outcomes reference valid intervention IDs', () => {
    const intvIds = new Set(DEMO_INTERVENTIONS.map(i => i.id));
    DEMO_OUTCOMES.forEach(out => {
      expect(intvIds.has(out.interventionId)).toBe(true);
    });
  });

  test('demo outcomes reference valid incident IDs', () => {
    const incIds = new Set(DEMO_INCIDENTS.map(i => i.id));
    DEMO_OUTCOMES.forEach(out => {
      expect(incIds.has(out.incidentId)).toBe(true);
    });
  });

  test('demo outcomes have valid result values', () => {
    const valid = ['worked', 'partly', 'failed', 'did_not_work', 'unknown'];
    DEMO_OUTCOMES.forEach(out => {
      expect(valid).toContain(out.result);
    });
  });

  test('demo logs reference valid student IDs', () => {
    DEMO_LOGS.forEach(log => {
      expect(DEMO_STUDENTS[log.studentId]).toBeDefined();
    });
  });

  test('demo incidents reference valid period IDs', () => {
    DEMO_INCIDENTS.forEach(inc => {
      expect(DB.periods[inc.periodId]).toBeDefined();
    });
  });

  test('all incident IDs are unique', () => {
    const ids = DEMO_INCIDENTS.map(i => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('all intervention IDs are unique', () => {
    const ids = DEMO_INTERVENTIONS.map(i => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('all outcome IDs are unique', () => {
    const ids = DEMO_OUTCOMES.map(i => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('incident interventionIds arrays match actual interventions', () => {
    DEMO_INCIDENTS.forEach(inc => {
      const actual = DEMO_INTERVENTIONS.filter(i => i.incidentId === inc.id).map(i => i.id);
      expect(inc.interventionIds.sort()).toEqual(actual.sort());
    });
  });

  test('each intervention has a matching outcome', () => {
    DEMO_INTERVENTIONS.forEach(intv => {
      const outcome = DEMO_OUTCOMES.find(o => o.interventionId === intv.id);
      expect(outcome).toBeDefined();
    });
  });

  test('demo data has enough volume for a good demo', () => {
    expect(DEMO_INCIDENTS.length).toBeGreaterThanOrEqual(6);
    expect(DEMO_INTERVENTIONS.length).toBeGreaterThanOrEqual(10);
    expect(DEMO_OUTCOMES.length).toBeGreaterThanOrEqual(10);
    expect(DEMO_LOGS.length).toBeGreaterThanOrEqual(20);
  });

  test('demo data covers multiple students', () => {
    const incStudents = new Set(DEMO_INCIDENTS.map(i => i.studentId));
    expect(incStudents.size).toBeGreaterThanOrEqual(4);
  });

  test('demo outcomes have good distribution (mostly worked)', () => {
    const worked = DEMO_OUTCOMES.filter(o => o.result === 'worked').length;
    const total = DEMO_OUTCOMES.length;
    expect(worked / total).toBeGreaterThanOrEqual(0.5);
  });
});
