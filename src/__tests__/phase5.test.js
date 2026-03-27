import { normalizeIdentityEntries } from '../models/index';
import { DB } from '../data';

// ── normalizeIdentityEntries ──────────────────────────────────
describe('normalizeIdentityEntries', () => {
  const allStudents = {
    'stu_1': { id: 'stu_1', pseudonym: 'Red Student 1',  color: '#ef4444', imported: true },
    'stu_2': { id: 'stu_2', pseudonym: 'Blue Student 1', color: '#3b82f6', imported: true },
  };

  test('adds identity via migrateIdentity for parseable pseudonym', () => {
    const entries = [{ realName: 'Alice', pseudonym: 'Red Student 1', color: '#ef4444', periodIds: [], classLabels: {} }];
    const result = normalizeIdentityEntries(entries, allStudents);
    expect(result[0].identity).toBeDefined();
    expect(result[0].identity.colorName).toBe('Red');
    expect(result[0].identity.sequenceNumber).toBe(1);
    expect(result[0].identity.emoji).toBe('🔥');
  });

  test('resolves studentId from allStudents by pseudonym', () => {
    const entries = [{ realName: 'Alice', pseudonym: 'Red Student 1', color: '#ef4444', periodIds: [], classLabels: {} }];
    const result = normalizeIdentityEntries(entries, allStudents);
    expect(result[0].studentId).toBe('stu_1');
  });

  test('no studentId when pseudonym has no match in allStudents', () => {
    const entries = [{ realName: 'Ghost', pseudonym: 'Purple Student 9', color: '#a855f7', periodIds: [], classLabels: {} }];
    const result = normalizeIdentityEntries(entries, allStudents);
    expect(result[0].studentId).toBeUndefined();
  });

  test('preserves existing identity — migrateIdentity is a no-op', () => {
    const existingIdentity = { colorName: 'Blue', color: '#3b82f6', emoji: '🌊', codename: 'Wave', sequenceNumber: 1 };
    const entries = [{ realName: 'Bob', pseudonym: 'Blue Student 1', color: '#3b82f6', identity: existingIdentity, periodIds: [], classLabels: {} }];
    const result = normalizeIdentityEntries(entries, allStudents);
    expect(result[0].identity).toBe(existingIdentity);
  });

  test('promotes v1.0 displayLabel entries to pseudonym field', () => {
    const entries = [{ realName: 'Carol', displayLabel: 'Blue Student 1', color: '#3b82f6' }];
    const result = normalizeIdentityEntries(entries, allStudents);
    expect(result[0].pseudonym).toBe('Blue Student 1');
    expect(result[0].identity).toBeDefined();
    expect(result[0].studentId).toBe('stu_2');
  });

  test('filters out entries with no realName', () => {
    const entries = [
      { realName: 'Alice', pseudonym: 'Red Student 1', color: '#ef4444', periodIds: [], classLabels: {} },
      { realName: '',      pseudonym: 'Blue Student 1', color: '#3b82f6', periodIds: [], classLabels: {} },
      { pseudonym: 'Green Student 1' },
    ];
    const result = normalizeIdentityEntries(entries, allStudents);
    expect(result).toHaveLength(1);
    expect(result[0].realName).toBe('Alice');
  });

  test('returns empty array for null/undefined input', () => {
    expect(normalizeIdentityEntries(null, allStudents)).toEqual([]);
    expect(normalizeIdentityEntries(undefined, allStudents)).toEqual([]);
  });

  test('works with no allStudents — identity added but no studentId', () => {
    const entries = [{ realName: 'Alice', pseudonym: 'Red Student 1', color: '#ef4444', periodIds: [], classLabels: {} }];
    const result = normalizeIdentityEntries(entries, {});
    expect(result[0].identity).toBeDefined();
    expect(result[0].studentId).toBeUndefined();
  });
});

// ── normalizeIdentityEntries — studentId-first resolution ─────
// Phase C: entries that carry a studentId should be resolved directly
// without relying on pseudonym lookup, which is fragile.

describe('normalizeIdentityEntries — studentId-first (Phase C)', () => {
  const allStudents = {
    'stu_1': { id: 'stu_1', pseudonym: 'Red Student 1',  color: '#ef4444' },
    'stu_2': { id: 'stu_2', pseudonym: 'Blue Student 1', color: '#3b82f6' },
  };

  test('uses entry.studentId directly when present — no pseudonym lookup needed', () => {
    // Entry already carries studentId (v3.0+ artifact).
    // Should resolve to that studentId regardless of pseudonym lookup.
    const entries = [{ realName: 'Alice', pseudonym: 'Red Student 1', studentId: 'stu_1', periodIds: [], classLabels: {} }];
    const result = normalizeIdentityEntries(entries, allStudents);
    expect(result[0].studentId).toBe('stu_1');
  });

  test('trusts entry.studentId even when pseudonym does not match any student', () => {
    // Collision/migration scenario: pseudonym was reassigned or changed, but
    // the studentId is still correct. Old code would return undefined here.
    const entries = [{ realName: 'Alice', pseudonym: 'OLD WRONG PSEUDONYM', studentId: 'stu_1', periodIds: [], classLabels: {} }];
    const result = normalizeIdentityEntries(entries, allStudents);
    expect(result[0].studentId).toBe('stu_1');
  });

  test('falls back to pseudonym lookup when entry.studentId is absent (backward compat)', () => {
    // Old-format artifact with no studentId — must still resolve via pseudonym.
    const entries = [{ realName: 'Alice', pseudonym: 'Red Student 1', periodIds: [], classLabels: {} }];
    const result = normalizeIdentityEntries(entries, allStudents);
    expect(result[0].studentId).toBe('stu_1');
  });

  test('falls back to pseudonym lookup when entry.studentId is empty string', () => {
    const entries = [{ realName: 'Alice', pseudonym: 'Red Student 1', studentId: '', periodIds: [], classLabels: {} }];
    const result = normalizeIdentityEntries(entries, allStudents);
    expect(result[0].studentId).toBe('stu_1');
  });

  test('returns no studentId when both entry.studentId and pseudonym lookup fail', () => {
    // Safe failure: unresolvable entry — should not guess or throw.
    const entries = [{ realName: 'Ghost', pseudonym: 'UNKNOWN PSEUDONYM', periodIds: [], classLabels: {} }];
    const result = normalizeIdentityEntries(entries, allStudents);
    expect(result[0].studentId).toBeUndefined();
  });

  test('collision scenario — two entries share a pseudonym but have different studentIds', () => {
    // If pseudonym lookup were used exclusively, the second entry would clobber
    // the first. With studentId-first, each resolves to its own correct id.
    const collisionStudents = {
      'stu_A': { id: 'stu_A', pseudonym: 'Red Student 1', color: '#ef4444' },
      'stu_B': { id: 'stu_B', pseudonym: 'Red Student 1', color: '#ef4444' }, // same pseudonym!
    };
    const entries = [
      { realName: 'Alice', pseudonym: 'Red Student 1', studentId: 'stu_A', periodIds: ['p1'], classLabels: {} },
      { realName: 'Brenda', pseudonym: 'Red Student 1', studentId: 'stu_B', periodIds: ['p2'], classLabels: {} },
    ];
    const result = normalizeIdentityEntries(entries, collisionStudents);
    expect(result[0].studentId).toBe('stu_A');
    expect(result[1].studentId).toBe('stu_B');
  });
});

// ── DB.students have identity fields ─────────────────────────
describe('DB.students identity fields', () => {
  const students = Object.values(DB.students);

  test('every DB student has an identity field', () => {
    students.forEach(s => {
      expect(s.identity).toBeDefined();
    });
  });

  test('every identity has required fields', () => {
    students.forEach(s => {
      expect(s.identity).toHaveProperty('colorName');
      expect(s.identity).toHaveProperty('color');
      expect(s.identity).toHaveProperty('emoji');
      expect(s.identity).toHaveProperty('codename');
      expect(s.identity).toHaveProperty('sequenceNumber');
      expect(s.identity.sequenceNumber).toBe(1);
    });
  });

  test('stu_001 has Red identity', () => {
    expect(DB.students['stu_001'].identity.colorName).toBe('Red');
    expect(DB.students['stu_001'].identity.emoji).toBe('🔥');
    expect(DB.students['stu_001'].identity.codename).toBe('Ember');
  });

  test('stu_002 has Blue identity', () => {
    expect(DB.students['stu_002'].identity.colorName).toBe('Blue');
    expect(DB.students['stu_002'].identity.emoji).toBe('🌊');
    expect(DB.students['stu_002'].identity.codename).toBe('Wave');
  });
});

// ── extractIdentityEntries normalizes through migrateIdentity ─
import { extractIdentityEntries } from '../components/windows';

describe('extractIdentityEntries applies migrateIdentity', () => {
  test('v1.0 artifact entries get identity field', () => {
    const v1Artifact = {
      type: 'privateRoster',
      students: [
        { displayLabel: 'Red Student 1', realName: 'Alice', color: '#ef4444' },
      ],
    };
    const result = extractIdentityEntries(v1Artifact);
    expect(result[0].identity).toBeDefined();
    expect(result[0].identity.colorName).toBe('Red');
  });

  test('v2.0 artifact entries without identity get identity added', () => {
    const v2Artifact = {
      type: 'privateRoster',
      students: [
        { realName: 'Alice', pseudonym: 'Blue Student 1', color: '#3b82f6', periodIds: ['p1'], classLabels: {} },
      ],
    };
    const result = extractIdentityEntries(v2Artifact);
    expect(result[0].identity).toBeDefined();
    expect(result[0].identity.colorName).toBe('Blue');
  });

  test('v3.0 artifact entries with identity pass through unchanged', () => {
    const existingIdentity = { colorName: 'Green', color: '#22c55e', emoji: '🌿', codename: 'Fern', sequenceNumber: 1 };
    const v3Artifact = {
      type: 'privateRoster',
      students: [
        { realName: 'Carol', pseudonym: 'Green Student 1', color: '#22c55e', identity: existingIdentity, periodIds: [], classLabels: {} },
      ],
    };
    const result = extractIdentityEntries(v3Artifact);
    expect(result[0].identity).toBe(existingIdentity);
  });
});
