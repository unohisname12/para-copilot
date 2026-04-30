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
