import { buildRosterLookups } from '../components/windows';

// ── buildRosterLookups ────────────────────────────────────────
// Converts identityRegistry (pseudonym-keyed) into stable studentId-keyed
// lookup maps so RosterPanel display never touches s.pseudonym as a key.
describe('buildRosterLookups', () => {
  const allStudents = {
    'stu_1': { id: 'stu_1', pseudonym: 'Red Student 1',  color: '#ef4444', imported: true },
    'stu_2': { id: 'stu_2', pseudonym: 'Blue Student 1', color: '#3b82f6', imported: true },
    'stu_3': { id: 'stu_3', pseudonym: 'Green Student 1',color: '#22c55e', imported: false },
  };
  const identityRegistry = [
    { realName: 'Alice Smith',  pseudonym: 'Red Student 1',  color: '#ef4444', periodIds: ['p1'], classLabels: {} },
    { realName: 'Bob Jones',    pseudonym: 'Blue Student 1', color: '#3b82f6', periodIds: ['p1', 'p2'], classLabels: {} },
  ];

  test('nameById is keyed by studentId, not pseudonym', () => {
    const { nameById } = buildRosterLookups(allStudents, identityRegistry);
    expect(nameById['stu_1']).toBe('Alice Smith');
    expect(nameById['stu_2']).toBe('Bob Jones');
  });

  test('periodIdsById is keyed by studentId', () => {
    const { periodIdsById } = buildRosterLookups(allStudents, identityRegistry);
    expect(periodIdsById['stu_1']).toEqual(['p1']);
    expect(periodIdsById['stu_2']).toEqual(['p1', 'p2']);
  });

  test('students not in identityRegistry get no entry', () => {
    const { nameById, periodIdsById } = buildRosterLookups(allStudents, identityRegistry);
    expect(nameById['stu_3']).toBeUndefined();
    expect(periodIdsById['stu_3']).toBeUndefined();
  });

  test('registry entry with no matching student is skipped safely', () => {
    const registry = [
      { realName: 'Ghost Person', pseudonym: 'Purple Student 9', periodIds: [] },
    ];
    const { nameById, periodIdsById } = buildRosterLookups(allStudents, registry);
    expect(Object.keys(nameById)).toHaveLength(0);
    expect(Object.keys(periodIdsById)).toHaveLength(0);
  });

  test('empty allStudents returns empty maps', () => {
    const { nameById, periodIdsById } = buildRosterLookups({}, identityRegistry);
    expect(nameById).toEqual({});
    expect(periodIdsById).toEqual({});
  });

  test('empty identityRegistry returns empty maps', () => {
    const { nameById, periodIdsById } = buildRosterLookups(allStudents, []);
    expect(nameById).toEqual({});
    expect(periodIdsById).toEqual({});
  });

  test('non-imported student with matching pseudonym still gets a lookup entry', () => {
    // stu_3 is not imported but has a pseudonym — should still be resolvable
    const registry = [
      { realName: 'Carol Lee', pseudonym: 'Green Student 1', periodIds: ['p3'] },
    ];
    const { nameById } = buildRosterLookups(allStudents, registry);
    expect(nameById['stu_3']).toBe('Carol Lee');
  });
});

// ── buildRosterLookups — studentId-first resolution (Phase C) ─
// Phase C: registry entries that carry a studentId should be resolved directly,
// making the join robust against pseudonym changes or collisions.

describe('buildRosterLookups — studentId-first (Phase C)', () => {
  const allStudents = {
    'stu_1': { id: 'stu_1', pseudonym: 'Red Student 1',  color: '#ef4444' },
    'stu_2': { id: 'stu_2', pseudonym: 'Blue Student 1', color: '#3b82f6' },
  };

  test('resolves via entry.studentId directly when present', () => {
    // v3.0 registry entry already has studentId — should not need pseudonym.
    const registry = [
      { realName: 'Alice', studentId: 'stu_1', pseudonym: 'Red Student 1', periodIds: ['p1'], classLabels: {} },
    ];
    const { nameById } = buildRosterLookups(allStudents, registry);
    expect(nameById['stu_1']).toBe('Alice');
  });

  test('resolves via entry.studentId even when pseudonym does not match', () => {
    // Pseudonym may have changed or been re-assigned. studentId is stable.
    // Old code would skip this entry entirely (stuByPseudonym miss).
    const registry = [
      { realName: 'Alice', studentId: 'stu_1', pseudonym: 'OLD STALE PSEUDONYM', periodIds: ['p1'], classLabels: {} },
    ];
    const { nameById } = buildRosterLookups(allStudents, registry);
    expect(nameById['stu_1']).toBe('Alice');
  });

  test('falls back to pseudonym lookup when studentId is absent (backward compat)', () => {
    // Old-format entry without studentId — must still resolve via pseudonym map.
    const registry = [
      { realName: 'Alice', pseudonym: 'Red Student 1', periodIds: ['p1'], classLabels: {} },
    ];
    const { nameById } = buildRosterLookups(allStudents, registry);
    expect(nameById['stu_1']).toBe('Alice');
  });

  test('falls back to pseudonym lookup when studentId is empty string', () => {
    const registry = [
      { realName: 'Alice', studentId: '', pseudonym: 'Red Student 1', periodIds: ['p1'], classLabels: {} },
    ];
    const { nameById } = buildRosterLookups(allStudents, registry);
    expect(nameById['stu_1']).toBe('Alice');
  });

  test('skips safely when studentId is present but not in allStudents', () => {
    // studentId doesn't resolve — do not fall back to pseudonym in this case,
    // as a stale id is a data integrity issue, not a missing-id issue.
    const registry = [
      { realName: 'Alice', studentId: 'stu_99', pseudonym: 'Red Student 1', periodIds: ['p1'], classLabels: {} },
    ];
    const { nameById } = buildRosterLookups(allStudents, registry);
    expect(nameById['stu_99']).toBeUndefined();
    // should NOT fall back to stu_1 via pseudonym when a stale studentId is present
    expect(nameById['stu_1']).toBeUndefined();
  });

  test('collision scenario — two registry entries share pseudonym but different studentIds', () => {
    // With studentId-first, both entries resolve to their own student.
    // Pseudonym-only lookup would silently drop one.
    const collisionStudents = {
      'stu_A': { id: 'stu_A', pseudonym: 'Red Student 1', color: '#ef4444' },
      'stu_B': { id: 'stu_B', pseudonym: 'Red Student 1', color: '#ef4444' },
    };
    const registry = [
      { realName: 'Alice',  studentId: 'stu_A', pseudonym: 'Red Student 1', periodIds: ['p1'], classLabels: {} },
      { realName: 'Brenda', studentId: 'stu_B', pseudonym: 'Red Student 1', periodIds: ['p2'], classLabels: {} },
    ];
    const { nameById } = buildRosterLookups(collisionStudents, registry);
    expect(nameById['stu_A']).toBe('Alice');
    expect(nameById['stu_B']).toBe('Brenda');
  });
});
