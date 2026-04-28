import { sanitizeFact, stripNamesFromFact } from '../privacy/factSanitizer';

describe('sanitizeFact', () => {
  const vault = {
    '847293': 'Marcus Thompson',
    '562918': 'Lily Park',
    '102837': 'Sam',
  };

  test('empty text returns empty', () => {
    expect(sanitizeFact('', vault)).toEqual({ sanitized: '', foundNames: [] });
    expect(sanitizeFact(null, vault)).toEqual({ sanitized: '', foundNames: [] });
  });

  test('empty vault returns text unchanged', () => {
    const r = sanitizeFact('Marcus loves Pokémon', {});
    expect(r.sanitized).toBe('Marcus loves Pokémon');
    expect(r.foundNames).toEqual([]);
  });

  test('strips a single first name', () => {
    const r = sanitizeFact('Marcus loves Pokémon', vault);
    expect(r.sanitized).toBe('[student] loves Pokémon');
    expect(r.foundNames).toContain('Marcus Thompson');
  });

  test('strips a full name', () => {
    const r = sanitizeFact('Marcus Thompson got dysregulated after lunch', vault);
    expect(r.sanitized).toBe('[student] got dysregulated after lunch');
    expect(r.foundNames).toContain('Marcus Thompson');
  });

  test('strips a possessive', () => {
    const r = sanitizeFact("Marcus's mom said he yells at home", vault);
    expect(r.sanitized).toBe('[student] mom said he yells at home');
  });

  test('case-insensitive match', () => {
    const r = sanitizeFact('marcus and MARCUS and Marcus all match', vault);
    expect(r.sanitized).toBe('[student] and [student] and [student] all match');
  });

  test('does not false-strip embedded substrings', () => {
    // "Mark" should not match "Marcus" — \b word boundaries
    const r = sanitizeFact('Mark used the marker board well', vault);
    expect(r.sanitized).toBe('Mark used the marker board well');
    expect(r.foundNames).toEqual([]);
  });

  test('strips multiple students from same fact', () => {
    const r = sanitizeFact('Marcus and Lily worked together on math', vault);
    expect(r.sanitized).toBe('[student] and [student] worked together on math');
    expect(r.foundNames).toContain('Marcus Thompson');
    expect(r.foundNames).toContain('Lily Park');
  });

  test('strips last name on its own', () => {
    const r = sanitizeFact('Thompson responded well to humor today', vault);
    expect(r.sanitized).toBe('[student] responded well to humor today');
  });

  test('strips first-only vault entry', () => {
    const r = sanitizeFact('Sam needs movement breaks every 20 min', vault);
    expect(r.sanitized).toBe('[student] needs movement breaks every 20 min');
    expect(r.foundNames).toContain('Sam');
  });

  test('preserves non-name text intact', () => {
    const r = sanitizeFact('Use Pokémon analogies for fractions', vault);
    expect(r.sanitized).toBe('Use Pokémon analogies for fractions');
    expect(r.foundNames).toEqual([]);
  });

  test('handles regex-special chars in name without crashing', () => {
    const weirdVault = { '111111': 'D.J. (Doe)' };
    expect(() => sanitizeFact("D.J. brought a graphic novel today", weirdVault)).not.toThrow();
    const r = sanitizeFact("D.J. brought a graphic novel today", weirdVault);
    expect(typeof r.sanitized).toBe('string');
  });

  test('stripNamesFromFact convenience wrapper returns string', () => {
    expect(stripNamesFromFact('Marcus is doing well', vault)).toBe('[student] is doing well');
  });

  test('vault is missing or non-object returns text', () => {
    expect(sanitizeFact('Marcus is here', null).sanitized).toBe('Marcus is here');
    expect(sanitizeFact('Marcus is here', undefined).sanitized).toBe('Marcus is here');
  });
});
