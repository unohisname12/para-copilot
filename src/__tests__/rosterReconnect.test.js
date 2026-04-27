// Reconnect-after-reupload tests.
//
// Scenario the user reported as broken:
//   1. Cloud students exist with `paraAppNumber` (from `external_key`) but no real names locally.
//   2. User re-uploads the private roster file containing `realName` + `paraAppNumber`.
//   3. The pseudonym field on the re-upload may not match the cloud student's pseudonym
//      (regenerated independently), and the roster artifact may not carry `studentId`.
//   4. Names should still reconnect because `paraAppNumber` is the stable, FERPA-safe key
//      shared by both sides.
//
// These tests exercise the matching logic that was previously studentId-then-pseudonym only.
// They assert the new paraAppNumber-aware resolution.

import { normalizeIdentityEntries } from '../models';
import { buildRosterLookups, extractIdentityEntries } from '../features/roster/rosterUtils';

describe('normalizeIdentityEntries — paraAppNumber resolution', () => {
  const students = {
    stu_a: { id: 'stu_a', pseudonym: 'Red Student 1',  paraAppNumber: '111111' },
    stu_b: { id: 'stu_b', pseudonym: 'Blue Student 1', paraAppNumber: '222222' },
    stu_c: { id: 'stu_c', pseudonym: 'Green Student 1', paraAppNumber: '333333' },
  };

  test('resolves studentId via paraAppNumber when entry has paraAppNumber but no studentId', () => {
    const entries = [
      { realName: 'Alice', pseudonym: 'Red Student 1', paraAppNumber: '111111', periodIds: [], classLabels: {} },
    ];
    const out = normalizeIdentityEntries(entries, students);
    expect(out[0].studentId).toBe('stu_a');
    expect(out[0].realName).toBe('Alice');
    expect(out[0].paraAppNumber).toBe('111111');
  });

  test('resolves via paraAppNumber even when pseudonym mismatches (the regen scenario)', () => {
    // The privateRoster artifact's pseudonym is from a different generation
    // than the cloud student's current pseudonym. paraAppNumber is the bridge.
    const entries = [
      { realName: 'Alice', pseudonym: 'Some Stale Pseudonym', paraAppNumber: '111111', periodIds: [], classLabels: {} },
    ];
    const out = normalizeIdentityEntries(entries, students);
    expect(out[0].studentId).toBe('stu_a');
  });

  test('studentId on the entry still wins over paraAppNumber', () => {
    // If both are present, studentId is the canonical id and overrides.
    const entries = [
      { realName: 'Alice', studentId: 'stu_b', pseudonym: 'Red Student 1', paraAppNumber: '111111', periodIds: [], classLabels: {} },
    ];
    const out = normalizeIdentityEntries(entries, students);
    expect(out[0].studentId).toBe('stu_b');
  });

  test('falls back to pseudonym only when neither studentId nor paraAppNumber resolves', () => {
    const entries = [
      { realName: 'Carol', pseudonym: 'Green Student 1', periodIds: [], classLabels: {} },
    ];
    const out = normalizeIdentityEntries(entries, students);
    expect(out[0].studentId).toBe('stu_c');
  });

  test('accepts entry with realName + paraAppNumber + no pseudonym', () => {
    // The minimal valid entry: realName + paraAppNumber. No pseudonym needed
    // because paraAppNumber is the stable key.
    const entries = [
      { realName: 'Alice', paraAppNumber: '111111', periodIds: [], classLabels: {} },
    ];
    const out = normalizeIdentityEntries(entries, students);
    expect(out).toHaveLength(1);
    expect(out[0].studentId).toBe('stu_a');
    expect(out[0].realName).toBe('Alice');
  });

  test('returns entry with no studentId when nothing matches (allowing UI to warn)', () => {
    const entries = [
      { realName: 'Stranger', pseudonym: 'Unknown', paraAppNumber: '999999', periodIds: [], classLabels: {} },
    ];
    const out = normalizeIdentityEntries(entries, students);
    expect(out).toHaveLength(1);
    expect(out[0].studentId).toBeUndefined();
    expect(out[0].realName).toBe('Stranger');
  });

  test('handles the legacy externalKey field name as paraAppNumber', () => {
    const entries = [
      { realName: 'Alice', pseudonym: 'mismatched', externalKey: '111111', periodIds: [], classLabels: {} },
    ];
    const out = normalizeIdentityEntries(entries, students);
    expect(out[0].studentId).toBe('stu_a');
  });
});

describe('buildRosterLookups — paraAppNumber fallback', () => {
  const students = {
    stu_a: { id: 'stu_a', pseudonym: 'Red Student 1',  paraAppNumber: '111111' },
    stu_b: { id: 'stu_b', pseudonym: 'Blue Student 1', paraAppNumber: '222222' },
  };

  test('resolves via paraAppNumber when registry entry has it but no studentId', () => {
    // This covers the case where the entry came from a path that didn't
    // run normalizeIdentityEntries — defensive fallback.
    const registry = [
      { realName: 'Alice', paraAppNumber: '111111', pseudonym: 'mismatched', periodIds: ['p1'], classLabels: {} },
    ];
    const { nameById } = buildRosterLookups(students, registry);
    expect(nameById.stu_a).toBe('Alice');
  });

  test('studentId still wins when both studentId and paraAppNumber are on the entry', () => {
    const registry = [
      { realName: 'Alice', studentId: 'stu_b', paraAppNumber: '111111', pseudonym: 'Red Student 1', periodIds: ['p1'], classLabels: {} },
    ];
    const { nameById } = buildRosterLookups(students, registry);
    expect(nameById.stu_b).toBe('Alice');
    expect(nameById.stu_a).toBeUndefined();
  });

  test('pseudonym fallback still works when neither studentId nor paraAppNumber present', () => {
    const registry = [
      { realName: 'Alice', pseudonym: 'Red Student 1', periodIds: ['p1'], classLabels: {} },
    ];
    const { nameById } = buildRosterLookups(students, registry);
    expect(nameById.stu_a).toBe('Alice');
  });
});

describe('extractIdentityEntries — paraAppNumber preservation', () => {
  test('preserves paraAppNumber when reading combined-export privateRosterMap entries', () => {
    const json = {
      privateRosterMap: {
        privateRosterMap: [
          { realName: 'Alice Smith', pseudonym: 'Red Student 1', paraAppNumber: '111111', periodId: 'p1', classLabel: 'Math' },
          { realName: 'Bob Jones',  pseudonym: 'Blue Student 1', paraAppNumber: '222222', periodId: 'p1', classLabel: 'Math' },
        ],
      },
    };
    const out = extractIdentityEntries(json, {});
    expect(out).toHaveLength(2);
    const alice = out.find(e => e.realName === 'Alice Smith');
    expect(alice.paraAppNumber).toBe('111111');
    const bob = out.find(e => e.realName === 'Bob Jones');
    expect(bob.paraAppNumber).toBe('222222');
  });
});

describe('end-to-end reconnect (the user-reported scenario)', () => {
  test('cloud students with paraAppNumber, re-uploaded roster with mismatched pseudonyms — names reconnect', () => {
    // Simulate cloud students fetched from team_students. They have paraAppNumber
    // (from external_key) but local pseudonyms that may have been regenerated
    // independently of the original artifact's pseudonyms.
    const cloudStudents = {
      stu_cloud_1: { id: 'stu_cloud_1', pseudonym: 'Red Student 1',   paraAppNumber: '847293' },
      stu_cloud_2: { id: 'stu_cloud_2', pseudonym: 'Blue Student 1',  paraAppNumber: '583921' },
      stu_cloud_3: { id: 'stu_cloud_3', pseudonym: 'Green Student 1', paraAppNumber: '294857' },
    };

    // Re-uploaded roster — paraAppNumber is canonical. Pseudonyms in the artifact
    // are from a previous import session and don't necessarily match the current
    // cloud-side pseudonyms (or are absent entirely).
    const rosterJson = {
      privateRosterMap: {
        privateRosterMap: [
          { realName: 'Maria Lopez',  pseudonym: 'STALE Red Student 1',   paraAppNumber: '847293', periodId: 'p3' },
          { realName: 'Jordan Park',  pseudonym: 'STALE Blue Student 1',  paraAppNumber: '583921', periodId: 'p3' },
          { realName: 'Sam Chen',     paraAppNumber: '294857', periodId: 'p3' }, // no pseudonym at all
        ],
      },
    };

    const entries = extractIdentityEntries(rosterJson, cloudStudents);
    const registry = normalizeIdentityEntries(entries, cloudStudents);
    const { nameById } = buildRosterLookups(cloudStudents, registry);

    expect(nameById.stu_cloud_1).toBe('Maria Lopez');
    expect(nameById.stu_cloud_2).toBe('Jordan Park');
    expect(nameById.stu_cloud_3).toBe('Sam Chen');
  });
});
