import { generateIdentitySet, deriveIdentityFromParaAppNumber } from '../identity';

describe('deriveIdentityFromParaAppNumber', () => {
  test('same number always produces the same identity', () => {
    const a = deriveIdentityFromParaAppNumber('847293');
    const b = deriveIdentityFromParaAppNumber('847293');
    expect(a.pseudonym).toBe(b.pseudonym);
    expect(a.color).toBe(b.color);
    expect(a.identity.sequenceNumber).toBe(b.identity.sequenceNumber);
  });

  test('different numbers produce different identities (usually)', () => {
    const a = deriveIdentityFromParaAppNumber('100000');
    const b = deriveIdentityFromParaAppNumber('999999');
    // Different palette OR different sequence — at least one must differ
    const allEqual = a.pseudonym === b.pseudonym && a.color === b.color;
    expect(allEqual).toBe(false);
  });

  test('uses last 3 digits as sequence', () => {
    const r = deriveIdentityFromParaAppNumber('847293');
    expect(r.identity.sequenceNumber).toBe(293);
    expect(r.pseudonym).toMatch(/\b293\b/);
  });

  test('trims whitespace', () => {
    const a = deriveIdentityFromParaAppNumber('  847293  ');
    const b = deriveIdentityFromParaAppNumber('847293');
    expect(a.pseudonym).toBe(b.pseudonym);
  });

  test('returns null for empty input', () => {
    expect(deriveIdentityFromParaAppNumber('')).toBeNull();
    expect(deriveIdentityFromParaAppNumber(null)).toBeNull();
  });
});

describe('generateIdentitySet — deterministic path', () => {
  test('same names, same paraAppNumbers, different input order → same identities', () => {
    const inputA = [
      { name: 'Maria', paraAppNumber: '847293' },
      { name: 'James', paraAppNumber: '128456' },
      { name: 'Alice', paraAppNumber: '555555' },
    ];
    const inputB = [
      { name: 'Alice', paraAppNumber: '555555' },
      { name: 'Maria', paraAppNumber: '847293' },
      { name: 'James', paraAppNumber: '128456' },
    ];
    const a = generateIdentitySet(inputA);
    const b = generateIdentitySet(inputB);
    expect(a.get('Maria').pseudonym).toBe(b.get('Maria').pseudonym);
    expect(a.get('James').pseudonym).toBe(b.get('James').pseudonym);
    expect(a.get('Alice').pseudonym).toBe(b.get('Alice').pseudonym);
  });

  test('pseudonym override from roster wins', () => {
    const result = generateIdentitySet([
      { name: 'Maria', paraAppNumber: '847293', pseudonym: 'Red Student 1' },
    ]);
    expect(result.get('Maria').pseudonym).toBe('Red Student 1');
  });

  test('legacy string[] input still works', () => {
    const r = generateIdentitySet(['Maria', 'James']);
    expect(r.get('Maria').pseudonym).toMatch(/Student 1/);
    expect(r.get('James').pseudonym).toMatch(/Student 1/);
    // Different palette buckets when sequenced
    expect(r.get('Maria').color).not.toBe(r.get('James').color);
  });

  test('mixed input — some with paraAppNumber, some without', () => {
    const r = generateIdentitySet([
      { name: 'Alpha', paraAppNumber: '111111' },
      { name: 'Beta' }, // no paraAppNumber
      { name: 'Gamma', paraAppNumber: '333333' },
    ]);
    // Beta falls back to legacy path
    expect(r.get('Beta').pseudonym).toBeTruthy();
    // Alpha and Gamma are deterministic
    const alpha2 = generateIdentitySet([{ name: 'Alpha', paraAppNumber: '111111' }]);
    expect(r.get('Alpha').pseudonym).toBe(alpha2.get('Alpha').pseudonym);
  });
});
