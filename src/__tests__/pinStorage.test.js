import { setPin, verifyPin, hasPin, clearPin, isValidPin, _STORAGE_KEY } from '../features/stealth/pinStorage';

// jsdom in CRA's Jest config provides Web Crypto via globalThis.crypto.
// localStorage is also provided. We reset between tests to keep state clean.

beforeEach(() => {
  globalThis.localStorage.clear();
});

describe('isValidPin', () => {
  test('accepts exactly 4 digits', () => {
    expect(isValidPin('1234')).toBe(true);
    expect(isValidPin('0000')).toBe(true);
    expect(isValidPin('9999')).toBe(true);
  });
  test('rejects non-digits, wrong length, non-strings', () => {
    expect(isValidPin('123')).toBe(false);
    expect(isValidPin('12345')).toBe(false);
    expect(isValidPin('12a4')).toBe(false);
    expect(isValidPin('')).toBe(false);
    expect(isValidPin(1234)).toBe(false);
    expect(isValidPin(null)).toBe(false);
    expect(isValidPin(undefined)).toBe(false);
  });
});

describe('setPin / verifyPin / hasPin', () => {
  test('setPin then verifyPin returns true for the correct PIN', async () => {
    const ok = await setPin('1234');
    expect(ok).toBe(true);
    expect(hasPin()).toBe(true);
    await expect(verifyPin('1234')).resolves.toBe(true);
  });

  test('verifyPin returns false for the wrong PIN', async () => {
    await setPin('1234');
    await expect(verifyPin('9999')).resolves.toBe(false);
  });

  test('verifyPin returns false when no PIN is set', async () => {
    expect(hasPin()).toBe(false);
    await expect(verifyPin('1234')).resolves.toBe(false);
  });

  test('verifyPin returns false for invalid input even with a PIN set', async () => {
    await setPin('1234');
    await expect(verifyPin('123')).resolves.toBe(false);
    await expect(verifyPin('abcd')).resolves.toBe(false);
    await expect(verifyPin('')).resolves.toBe(false);
  });

  test('setPin rejects invalid pins', async () => {
    expect(await setPin('123')).toBe(false);
    expect(await setPin('abcd')).toBe(false);
    expect(await setPin('')).toBe(false);
    expect(hasPin()).toBe(false);
  });

  test('setPin overwrites an existing PIN', async () => {
    await setPin('1234');
    await setPin('5678');
    await expect(verifyPin('1234')).resolves.toBe(false);
    await expect(verifyPin('5678')).resolves.toBe(true);
  });
});

describe('clearPin', () => {
  test('removes the stored PIN', async () => {
    await setPin('1234');
    expect(hasPin()).toBe(true);
    clearPin();
    expect(hasPin()).toBe(false);
    await expect(verifyPin('1234')).resolves.toBe(false);
  });

  test('safe to call when no PIN is set', () => {
    expect(hasPin()).toBe(false);
    expect(() => clearPin()).not.toThrow();
  });
});

describe('hash output (defense-in-depth)', () => {
  test('localStorage value is NOT the plaintext PIN', async () => {
    await setPin('1234');
    const stored = globalThis.localStorage.getItem(_STORAGE_KEY);
    expect(stored).toBeTruthy();
    expect(stored).not.toBe('1234');
    // Base64 SHA-256 is 44 chars; never matches the 4-char input.
    expect(stored.length).toBeGreaterThan(20);
  });

  test('different PINs produce different stored hashes', async () => {
    await setPin('1234');
    const a = globalThis.localStorage.getItem(_STORAGE_KEY);
    await setPin('1235');
    const b = globalThis.localStorage.getItem(_STORAGE_KEY);
    expect(a).not.toBe(b);
  });

  test('same PIN twice produces the same stored hash (deterministic)', async () => {
    await setPin('1234');
    const a = globalThis.localStorage.getItem(_STORAGE_KEY);
    clearPin();
    await setPin('1234');
    const b = globalThis.localStorage.getItem(_STORAGE_KEY);
    expect(a).toBe(b);
  });
});
