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
    expect(normalizeName("O'Brien-Smith")).toBe('obrien smith');
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
    expect(jaroWinkler('marco herrera barojas', 'marco herrera barojas')).toBe(1);
  });
  test('symmetric: jaroWinkler(a,b) === jaroWinkler(b,a)', () => {
    expect(jaroWinkler('alpha', 'alphabet')).toBe(jaroWinkler('alphabet', 'alpha'));
  });
});
