import { dedupeStudentsByParaAppNumber } from '../hooks/useStudents';

describe('dedupeStudentsByParaAppNumber', () => {
  test('first-seen cloud row wins when two rows share a paraAppNumber', () => {
    const cloud = [
      { id: 'c1', paraAppNumber: '123456' },
      { id: 'c2', paraAppNumber: '123456' }, // dupe
      { id: 'c3', paraAppNumber: '789012' },
    ];
    const out = dedupeStudentsByParaAppNumber({ cloudStudents: cloud, importedIds: [], importedStudents: {} });
    expect(out.cloudIds).toEqual(['c1', 'c3']);
  });

  test('cloud rows missing a paraAppNumber are passed through (no key to dedupe on)', () => {
    const cloud = [
      { id: 'c1', paraAppNumber: '123456' },
      { id: 'c2', paraAppNumber: null },
      { id: 'c3' },
      { id: 'c4', paraAppNumber: '   ' },
    ];
    const out = dedupeStudentsByParaAppNumber({ cloudStudents: cloud, importedIds: [], importedStudents: {} });
    // c4 has whitespace-only key → falls into "no key" bucket and is kept
    expect(out.cloudIds).toEqual(['c1', 'c2', 'c3', 'c4']);
  });

  test('local imports are dropped when their paraAppNumber is already in the cloud set', () => {
    const cloud = [{ id: 'c1', paraAppNumber: '123456' }];
    const importedStudents = {
      imp_a: { id: 'imp_a', paraAppNumber: '123456' }, // dup of c1, drop
      imp_b: { id: 'imp_b', paraAppNumber: '999999' }, // unique, keep
      imp_c: { id: 'imp_c' },                          // no key, keep
    };
    const out = dedupeStudentsByParaAppNumber({
      cloudStudents: cloud,
      importedIds: ['imp_a', 'imp_b', 'imp_c'],
      importedStudents,
    });
    expect(out.cloudIds).toEqual(['c1']);
    expect(out.localIds).toEqual(['imp_b', 'imp_c']);
  });

  test('paraAppNumber comparison is whitespace-insensitive and string-coerced', () => {
    const cloud = [
      { id: 'c1', paraAppNumber: 123456 },     // number
      { id: 'c2', paraAppNumber: '  123456 ' } // string with whitespace
    ];
    const out = dedupeStudentsByParaAppNumber({ cloudStudents: cloud, importedIds: [], importedStudents: {} });
    expect(out.cloudIds).toEqual(['c1']);
  });

  test('empty inputs return empty arrays', () => {
    const out = dedupeStudentsByParaAppNumber({});
    expect(out.cloudIds).toEqual([]);
    expect(out.localIds).toEqual([]);
  });

  test('local-only inputs (no cloud) keep all imported ids', () => {
    const importedStudents = {
      imp_a: { id: 'imp_a', paraAppNumber: '111' },
      imp_b: { id: 'imp_b', paraAppNumber: '222' },
    };
    const out = dedupeStudentsByParaAppNumber({
      cloudStudents: [],
      importedIds: ['imp_a', 'imp_b'],
      importedStudents,
    });
    expect(out.cloudIds).toEqual([]);
    expect(out.localIds).toEqual(['imp_a', 'imp_b']);
  });

  test('seenKey returns the first-seen cloud id per paraAppNumber for caller use', () => {
    const cloud = [
      { id: 'c1', paraAppNumber: '123456' },
      { id: 'c2', paraAppNumber: '123456' },
    ];
    const out = dedupeStudentsByParaAppNumber({ cloudStudents: cloud, importedIds: [], importedStudents: {} });
    expect(out.seenKey.get('123456')).toBe('c1');
  });
});
