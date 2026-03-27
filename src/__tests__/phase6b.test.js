import { partitionByResolved } from '../components/windows';

// ── partitionByResolved ───────────────────────────────────────
// Splits a list of student IDs into resolved (have a real name loaded)
// and unresolved (no real name) buckets.
describe('partitionByResolved', () => {
  const nameById = { stu_1: 'Alice', stu_2: 'Bob' };

  test('resolved contains only ids with a name', () => {
    const { resolved } = partitionByResolved(['stu_1', 'stu_2', 'stu_3'], nameById);
    expect(resolved).toEqual(['stu_1', 'stu_2']);
  });

  test('unresolved contains only ids without a name', () => {
    const { unresolved } = partitionByResolved(['stu_1', 'stu_2', 'stu_3'], nameById);
    expect(unresolved).toEqual(['stu_3']);
  });

  test('all resolved when every id has a name', () => {
    const { resolved, unresolved } = partitionByResolved(['stu_1', 'stu_2'], nameById);
    expect(resolved).toHaveLength(2);
    expect(unresolved).toHaveLength(0);
  });

  test('all unresolved when nameById is empty', () => {
    const { resolved, unresolved } = partitionByResolved(['stu_1', 'stu_2'], {});
    expect(resolved).toHaveLength(0);
    expect(unresolved).toHaveLength(2);
  });

  test('empty input returns empty buckets', () => {
    const { resolved, unresolved } = partitionByResolved([], nameById);
    expect(resolved).toHaveLength(0);
    expect(unresolved).toHaveLength(0);
  });
});
