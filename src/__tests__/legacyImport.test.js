import { normalizeName, jaroWinkler } from '../utils/fuzzyMatch';

describe('normalizeName', () => {
  test('lowercases and trims', () => {
    expect(normalizeName('  Maria Lopez  ')).toBe('maria lopez');
  });
  test('strips diacritics so accented and unaccented match', () => {
    expect(normalizeName('Maria López')).toBe(normalizeName('Maria Lopez'));
    expect(normalizeName('García')).toBe(normalizeName('Garcia'));
  });
  test('collapses internal whitespace', () => {
    expect(normalizeName('Maria   E.  Lopez')).toBe('maria e lopez');
  });
  test('drops common punctuation', () => {
    expect(normalizeName("O'Brien-Smith")).toBe('o brien smith');
  });
  test('returns empty string for null/undefined', () => {
    expect(normalizeName(null)).toBe('');
    expect(normalizeName(undefined)).toBe('');
  });
});

describe('jaroWinkler', () => {
  test('returns 1 for identical strings', () => {
    expect(jaroWinkler('maria', 'maria')).toBe(1);
  });
  test('returns 0 for completely disjoint short strings', () => {
    expect(jaroWinkler('abc', 'xyz')).toBeLessThan(0.1);
  });
  test('rates near-matches above 0.85', () => {
    // "Maria E. Lopez" → "Maria Lopez" after normalization
    expect(jaroWinkler('maria e lopez', 'maria lopez')).toBeGreaterThan(0.85);
  });
  test('rates "Marco Herrera-Barojas" vs "Marco Herrera Barojas" above 0.95', () => {
    expect(jaroWinkler(normalizeName('Marco Herrera-Barojas'), normalizeName('Marco Herrera Barojas'))).toBeGreaterThan(0.95);
  });
  test('symmetric: jaroWinkler(a,b) === jaroWinkler(b,a)', () => {
    expect(jaroWinkler('alpha', 'alphabet')).toBe(jaroWinkler('alphabet', 'alpha'));
  });
});

import { parseLegacyCsv } from '../features/import/legacyImport';

describe('parseLegacyCsv', () => {
  const HEADER_PREFIX = 'Date,Period,Student,Type,Category,Flagged,Tags,Observation';

  test('parses a standard well-formed row', () => {
    const csv = HEADER_PREFIX + '\n' +
      '"2026-04-29","Period 3 — Math 2","Maria Lopez","Behavior Note","behavior","No","break;regulation","Used break pass."';
    const { rows, error } = parseLegacyCsv(csv);
    expect(error).toBeNull();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      date: '2026-04-29',
      period: 'Period 3 — Math 2',
      student: 'Maria Lopez',
      type: 'Behavior Note',
      category: 'behavior',
      flagged: false,
      tags: ['break', 'regulation'],
      observation: 'Used break pass.',
    });
  });

  test('handles embedded commas and escaped quotes inside quoted fields', () => {
    const csv = HEADER_PREFIX + '\n' +
      '"2026-04-29","p3","Maria Lopez","Note","g","Yes","","Said ""hi, friend"" loudly"';
    const { rows } = parseLegacyCsv(csv);
    expect(rows[0].observation).toBe('Said "hi, friend" loudly');
    expect(rows[0].flagged).toBe(true);
    expect(rows[0].tags).toEqual([]);
  });

  test('accepts post-fix schema with extra columns and ignores them', () => {
    // Post-fix exports added "Period ID" + "Para App Number" columns. Parser
    // must accept these without error and ignore unknown columns.
    const post = 'Date,Period,Period ID,Student,Para App Number,Type,Category,Flagged,Tags,Observation\n' +
      '"2026-04-29","Period 3","p3","Maria Lopez","847293","Note","g","No","","obs"';
    const { rows, error } = parseLegacyCsv(post);
    expect(error).toBeNull();
    expect(rows[0].student).toBe('Maria Lopez');
    expect(rows[0].observation).toBe('obs');
  });

  test('rejects a file whose header does not match either expected schema', () => {
    const bad = 'name,age\n"Bob","12"';
    const { rows, error } = parseLegacyCsv(bad);
    expect(rows).toEqual([]);
    expect(error).toMatch(/doesn't look like/i);
  });

  test('skips rows missing required fields and reports them', () => {
    const csv = HEADER_PREFIX + '\n' +
      '"","p3","Maria","Note","g","No","","obs"\n' +                           // missing date
      '"2026-04-29","p3","","Note","g","No","","obs"\n' +                      // missing student
      '"2026-04-29","p3","Maria","Note","g","No","",""\n' +                    // missing observation
      '"2026-04-29","p3","Maria","Note","g","No","","kept"';
    const { rows, skipped } = parseLegacyCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].observation).toBe('kept');
    expect(skipped).toHaveLength(3);
    expect(skipped[0].reason).toMatch(/date/i);
    expect(skipped[1].reason).toMatch(/student/i);
    expect(skipped[2].reason).toMatch(/observation/i);
  });

  test('strips a leading BOM (Excel-saved files)', () => {
    const HEADER = 'Date,Period,Student,Type,Category,Flagged,Tags,Observation';
    const csv = '﻿' + HEADER + '\n' +
      '"2026-04-29","p3","Maria Lopez","Note","g","No","","obs"';
    const { rows, error } = parseLegacyCsv(csv);
    expect(error).toBeNull();
    expect(rows).toHaveLength(1);
    expect(rows[0].student).toBe('Maria Lopez');
  });

  test('CRLF line endings parse identically to LF', () => {
    const HEADER = 'Date,Period,Student,Type,Category,Flagged,Tags,Observation';
    const lf   = HEADER + '\n'   + '"2026-04-29","p3","Maria","Note","g","No","","obs"';
    const crlf = HEADER + '\r\n' + '"2026-04-29","p3","Maria","Note","g","No","","obs"';
    expect(parseLegacyCsv(lf).rows).toEqual(parseLegacyCsv(crlf).rows);
  });

  test('returns an error for an unterminated quoted field', () => {
    const HEADER = 'Date,Period,Student,Type,Category,Flagged,Tags,Observation';
    const csv = HEADER + '\n' +
      '"2026-04-29","p3","Maria","Note","g","No","","this never closes';
    const { rows, error } = parseLegacyCsv(csv);
    expect(rows).toEqual([]);
    expect(error).toMatch(/never closed|corrupted/i);
  });

  test('skips rows whose column count does not match the header', () => {
    const HEADER = 'Date,Period,Student,Type,Category,Flagged,Tags,Observation';
    const csv = HEADER + '\n' +
      '"2026-04-29","p3","Maria","Note","g","No","obs"\n' +                    // 7 cells, header has 8
      '"2026-04-29","p3","Maria","Note","g","No","","kept"';
    const { rows, skipped } = parseLegacyCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].observation).toBe('kept');
    expect(skipped.some(s => /column count|mismatch/i.test(s.reason))).toBe(true);
  });

  test('post-fix schema correctly extracts csvParaAppNumber', () => {
    const post = 'Date,Period,Period ID,Student,Para App Number,Type,Category,Flagged,Tags,Observation\n' +
      '"2026-04-29","Period 3","p3","Maria Lopez","847293","Note","g","No","","obs"';
    const { rows } = parseLegacyCsv(post);
    expect(rows[0].csvParaAppNumber).toBe('847293');
    expect(rows[0].periodId).toBe('p3');
  });
});

import { matchRowsToVault } from '../features/import/legacyImport';

describe('matchRowsToVault', () => {
  // vaultEntries = [{ paraAppNumber, realName, studentId? }]
  // Mirror what the modal will pass: vault names paired with the local
  // studentId so matched rows can be ingested directly without a second
  // lookup.
  const vault = [
    { paraAppNumber: '111111', realName: 'Maria Lopez',           studentId: 'stu_a' },
    { paraAppNumber: '222222', realName: 'Marco Herrera-Barojas', studentId: 'stu_b' },
    { paraAppNumber: '333333', realName: 'Henry Carrillo',        studentId: 'stu_c' },
    { paraAppNumber: '444444', realName: 'Sophie Blake',          studentId: 'stu_d' },
  ];

  function row(student, extras = {}) {
    return { rowIndex: 1, date: '2026-04-29', student, observation: 'obs', tags: [], ...extras };
  }

  test('exact (case + whitespace insensitive) match', () => {
    const out = matchRowsToVault([row('  maria lopez  ')], vault);
    expect(out[0].match.kind).toBe('exact');
    expect(out[0].match.paraAppNumber).toBe('111111');
    expect(out[0].match.studentId).toBe('stu_a');
  });

  test('diacritic-insensitive exact match', () => {
    const out = matchRowsToVault([row('Maria López')], vault);
    expect(out[0].match.kind).toBe('exact');
    expect(out[0].match.paraAppNumber).toBe('111111');
  });

  test('hyphen vs space normalizes to exact match', () => {
    // "Marco Herrera Barojas" (no hyphen) vs "Marco Herrera-Barojas" — same
    // after normalization → exact, not fuzzy.
    const out = matchRowsToVault([row('Marco Herrera Barojas')], vault);
    expect(out[0].match.kind).toBe('exact');
  });

  test('fuzzy match for true near-misses (typo)', () => {
    const out = matchRowsToVault([row('Henry Carillo')], vault); // missing one r
    expect(out[0].match.kind).toBe('fuzzy');
    expect(out[0].match.candidates[0].paraAppNumber).toBe('333333');
    expect(out[0].match.candidates[0].score).toBeGreaterThan(0.85);
  });

  test('returns kind=none when no candidate clears 0.85', () => {
    const out = matchRowsToVault([row('Zelda Northgate')], vault);
    expect(out[0].match.kind).toBe('none');
    expect(out[0].match.candidates || []).toEqual([]);
  });

  test('flags ambiguous when two vault entries normalize equal', () => {
    const dupVault = [
      ...vault,
      { paraAppNumber: '555555', realName: 'maria lopez', studentId: 'stu_e' },
    ];
    const out = matchRowsToVault([row('Maria Lopez')], dupVault);
    expect(out[0].match.kind).toBe('ambiguous');
    expect(out[0].match.candidates).toHaveLength(2);
  });

  test('honors csvParaAppNumber when present (post-fix exports)', () => {
    // If the row already carries paraAppNumber from a post-fix export, skip
    // the name lookup and accept it.
    const r = row('Maria Lopez', { csvParaAppNumber: '111111' });
    const out = matchRowsToVault([r], vault);
    expect(out[0].match.kind).toBe('exact');
    expect(out[0].match.paraAppNumber).toBe('111111');
    expect(out[0].match.studentId).toBe('stu_a');
  });

  test('returns kind=vault_empty when vault is empty', () => {
    const out = matchRowsToVault([row('Maria Lopez')], []);
    expect(out[0].match.kind).toBe('vault_empty');
  });
});

import { dedupeAgainstLogs } from '../features/import/legacyImport';

describe('dedupeAgainstLogs', () => {
  function row(overrides = {}) {
    return {
      rowIndex: 1, date: '2026-04-29', student: 'Maria Lopez',
      observation: 'Used break pass.', tags: [],
      match: { kind: 'exact', paraAppNumber: '111111', studentId: 'stu_a', realName: 'Maria Lopez' },
      ...overrides,
    };
  }

  test('exact duplicate (same paraAppNumber + date + observation) is detected', () => {
    const existingLogs = [
      { paraAppNumber: '111111', date: '2026-04-29', note: 'Used break pass.' },
    ];
    const { fresh, duplicates } = dedupeAgainstLogs([row()], existingLogs);
    expect(fresh).toHaveLength(0);
    expect(duplicates).toHaveLength(1);
  });

  test('observation differing only by trailing whitespace is treated as duplicate', () => {
    const existingLogs = [
      { paraAppNumber: '111111', date: '2026-04-29', note: 'Used break pass.   ' },
    ];
    const { fresh, duplicates } = dedupeAgainstLogs([row()], existingLogs);
    expect(duplicates).toHaveLength(1);
    expect(fresh).toHaveLength(0);
  });

  test('same kid + same day but different text is NOT a duplicate', () => {
    const existingLogs = [
      { paraAppNumber: '111111', date: '2026-04-29', note: 'Different observation.' },
    ];
    const { fresh, duplicates } = dedupeAgainstLogs([row()], existingLogs);
    expect(fresh).toHaveLength(1);
    expect(duplicates).toHaveLength(0);
  });

  test('rows whose match.kind is not "exact" are returned as fresh (review path handles them)', () => {
    const r = row({ match: { kind: 'fuzzy', candidates: [] } });
    const { fresh, duplicates } = dedupeAgainstLogs([r], []);
    expect(fresh).toHaveLength(1);
    expect(duplicates).toHaveLength(0);
  });

  test('logs without paraAppNumber are skipped during dedupe (legacy local logs)', () => {
    const existingLogs = [
      { date: '2026-04-29', note: 'Used break pass.' }, // no paraAppNumber on this log
    ];
    const { fresh } = dedupeAgainstLogs([row()], existingLogs);
    expect(fresh).toHaveLength(1);
  });
});
