import { generatePseudonymSet, PSEUDONYM_PALETTE, buildIdentityRegistry, buildIdentityRegistryFromMasterRoster } from '../models';

describe('generatePseudonymSet', () => {
  test('assigns Red Student 1 to the first name', () => {
    const result = generatePseudonymSet(['Alice']);
    expect(result.get('Alice')).toEqual({ pseudonym: 'Red Student 1', color: '#ef4444' });
  });

  test('assigns different colors to sequential names', () => {
    const result = generatePseudonymSet(['Alice', 'Bob', 'Carol']);
    expect(result.get('Alice').color).toBe('#ef4444');  // Red
    expect(result.get('Bob').color).toBe('#f97316');    // Orange
    expect(result.get('Carol').color).toBe('#eab308');  // Yellow
  });

  test('cycles palette after 12 names and increments counter', () => {
    const names = Array.from({ length: 13 }, (_, i) => `Person ${i + 1}`);
    const result = generatePseudonymSet(names);
    expect(result.get('Person 1').pseudonym).toBe('Red Student 1');
    expect(result.get('Person 13').pseudonym).toBe('Red Student 2');
    expect(result.get('Person 13').color).toBe('#ef4444');
  });

  test('returns empty Map for empty input', () => {
    expect(generatePseudonymSet([]).size).toBe(0);
  });

  test('silently overwrites duplicate input names (Map behavior)', () => {
    const result = generatePseudonymSet(['Alice', 'Alice']);
    expect(result.size).toBe(1);
    expect(result.get('Alice').pseudonym).toBe('Orange Student 1');
  });
});

describe('PSEUDONYM_PALETTE', () => {
  test('has exactly 12 entries', () => {
    expect(PSEUDONYM_PALETTE).toHaveLength(12);
  });
});

const BASE_STU = { eligibility: "SLD", caseManager: "Smith", gradeLevel: "7",
  goalArea: "", strategies: [], tags: [], flags: {}, crossPeriodInfo: {},
  sourceMeta: { importType: "bundle_import", schemaVersion: "2.0" },
  behaviorNotes: [], strengths: [], healthNotes: [], triggers: [],
  watchFors: [], doThisActions: [] };

const mockBundle = {
  privateRosterMap: {
    schemaVersion: "2.0",
    privateRosterMap: [
      { studentId: "imp_p1_001", realName: "Alice Smith", pseudonym: "old-p1",  periodId: "p1", classLabel: "Period 1 — LA 7" },
      { studentId: "imp_p3_001", realName: "Alice Smith", pseudonym: "old-p3",  periodId: "p3", classLabel: "Period 3 — Math" },
      { studentId: "imp_p1_002", realName: "Bob Jones",   pseudonym: "old-p1b", periodId: "p1", classLabel: "Period 1 — LA 7" },
    ]
  },
  normalizedStudents: {
    students: [
      { ...BASE_STU, id: "imp_p1_001", pseudonym: "old-p1",  color: "#aaa", periodId: "p1", classLabel: "Period 1 — LA 7", goals: [{ id: "g1", text: "Reading" }], accs: ["Extended time"] },
      { ...BASE_STU, id: "imp_p3_001", pseudonym: "old-p3",  color: "#bbb", periodId: "p3", classLabel: "Period 3 — Math",  goals: [{ id: "g2", text: "Math" }],    accs: ["Calculator"] },
      { ...BASE_STU, id: "imp_p1_002", pseudonym: "old-p1b", color: "#ccc", periodId: "p1", classLabel: "Period 1 — LA 7", goals: [], accs: [] },
    ]
  }
};

describe('buildIdentityRegistry', () => {
  test('produces one importStudents entry per unique real person', () => {
    const { importStudents } = buildIdentityRegistry(mockBundle);
    expect(Object.keys(importStudents)).toHaveLength(2); // Alice + Bob, not 3
  });

  test('cross-period student appears in both periodIds in registry', () => {
    const { registry } = buildIdentityRegistry(mockBundle);
    const alice = registry.find(e => e.realName === 'Alice Smith');
    expect(alice.periodIds).toContain('p1');
    expect(alice.periodIds).toContain('p3');
  });

  test('cross-period student maps to same studentId in both period arrays', () => {
    const { periodMap, registry, importStudents } = buildIdentityRegistry(mockBundle);
    const alice = registry.find(e => e.realName === 'Alice Smith');
    const aliceId = Object.values(importStudents).find(s => s.pseudonym === alice.pseudonym)?.id;
    expect(periodMap['p1']).toContain(aliceId);
    expect(periodMap['p3']).toContain(aliceId);
  });

  test('merges goals from all appearances (deduplicates by text)', () => {
    const { importStudents, registry } = buildIdentityRegistry(mockBundle);
    const alice = registry.find(e => e.realName === 'Alice Smith');
    const stu = Object.values(importStudents).find(s => s.pseudonym === alice.pseudonym);
    const texts = stu.goals.map(g => typeof g === 'string' ? g : g.text);
    expect(texts).toContain('Reading');
    expect(texts).toContain('Math');
  });

  test('merges accs from all appearances', () => {
    const { importStudents, registry } = buildIdentityRegistry(mockBundle);
    const alice = registry.find(e => e.realName === 'Alice Smith');
    const stu = Object.values(importStudents).find(s => s.pseudonym === alice.pseudonym);
    expect(stu.accs).toContain('Extended time');
    expect(stu.accs).toContain('Calculator');
  });

  test('importStudents entries have no realName field', () => {
    const { importStudents } = buildIdentityRegistry(mockBundle);
    Object.values(importStudents).forEach(s => {
      expect(s.realName).toBeUndefined();
    });
  });

  test('returns empty registry when privateRosterMap is absent', () => {
    const { registry } = buildIdentityRegistry({ normalizedStudents: { students: [] } });
    expect(registry).toHaveLength(0);
  });
});

describe('buildIdentityRegistryFromMasterRoster', () => {
  // Sample data reused across tests
  const sampleRoster = {
    students: [
      { id: "s001", fullName: "Alice Tan", periodIds: ["p1"] },
      { id: "s002", fullName: "Bob Patel", periodIds: ["p1", "p3"], displayName: "B. Patel" }
    ],
    periods: [
      { id: "p1", label: "Period 1 — ELA 7", studentIds: ["s001", "s002"] },
      { id: "p3", label: "Period 3 — Math 2", studentIds: ["s002"] }
    ]
  };

  test('returns empty result for empty students array', () => {
    const result = buildIdentityRegistryFromMasterRoster({ students: [], periods: [] });
    expect(result).toEqual({ registry: [], importStudents: {}, periodMap: {} });
  });

  test('single-period student gets correct pseudonym and periodMap entry', () => {
    const { registry, importStudents, periodMap } = buildIdentityRegistryFromMasterRoster(sampleRoster);
    const alice = registry.find(r => r.realName === "Alice Tan");
    expect(alice).toBeDefined();
    expect(alice.pseudonym).toBeTruthy();
    expect(alice.color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(alice.periodIds).toEqual(["p1"]);
    expect(alice.classLabels).toEqual({ p1: "Period 1 — ELA 7" });
    // periodMap
    expect(periodMap.p1).toContainEqual(expect.stringMatching(/^stu_mr_/));
  });

  test('cross-period student appears in both period arrays with same student ID', () => {
    const { registry, importStudents, periodMap } = buildIdentityRegistryFromMasterRoster(sampleRoster);
    const bob = registry.find(r => r.realName === "Bob Patel");
    expect(bob.periodIds).toEqual(["p1", "p3"]);
    // Find Bob's student ID
    const bobEntry = Object.values(importStudents).find(s => s.pseudonym === bob.pseudonym);
    expect(bobEntry).toBeDefined();
    const bobId = bobEntry.id;
    expect(periodMap.p1).toContain(bobId);
    expect(periodMap.p3).toContain(bobId);
  });

  test('importStudents records have no realName or fullName field', () => {
    const { importStudents } = buildIdentityRegistryFromMasterRoster(sampleRoster);
    Object.values(importStudents).forEach(s => {
      expect(s).not.toHaveProperty('realName');
      expect(s).not.toHaveProperty('fullName');
    });
  });

  test('student IDs are deterministic — same input produces same IDs', () => {
    const r1 = buildIdentityRegistryFromMasterRoster(sampleRoster);
    const r2 = buildIdentityRegistryFromMasterRoster(sampleRoster);
    expect(Object.keys(r1.importStudents).sort()).toEqual(Object.keys(r2.importStudents).sort());
  });

  test('period label is looked up from periods array', () => {
    const { registry } = buildIdentityRegistryFromMasterRoster(sampleRoster);
    const bob = registry.find(r => r.realName === "Bob Patel");
    expect(bob.classLabels.p1).toBe("Period 1 — ELA 7");
    expect(bob.classLabels.p3).toBe("Period 3 — Math 2");
  });

  test('displayName is included in registry when present', () => {
    const { registry } = buildIdentityRegistryFromMasterRoster(sampleRoster);
    const bob = registry.find(r => r.realName === "Bob Patel");
    expect(bob.displayName).toBe("B. Patel");
    const alice = registry.find(r => r.realName === "Alice Tan");
    expect(alice).not.toHaveProperty('displayName');
  });

  test('duplicate fullName students get disambiguated pseudonyms', () => {
    const dupRoster = {
      students: [
        { id: "x001", fullName: "Alex Smith", periodIds: ["p1"] },
        { id: "x002", fullName: "Alex Smith", periodIds: ["p2"] }
      ],
      periods: [
        { id: "p1", label: "Period 1", studentIds: ["x001"] },
        { id: "p2", label: "Period 2", studentIds: ["x002"] }
      ]
    };
    const { registry } = buildIdentityRegistryFromMasterRoster(dupRoster);
    // Both should get valid pseudonyms (not skip)
    expect(registry).toHaveLength(2);
    // They should have different pseudonyms
    expect(registry[0].pseudonym).not.toBe(registry[1].pseudonym);
    // realName is preserved as the original name for both
    expect(registry[0].realName).toBe("Alex Smith");
    expect(registry[1].realName).toBe("Alex Smith");
  });
});
