import { getDefaultIdentity, isIdentityCustomized } from '../identity';

// ── getDefaultIdentity ────────────────────────────────────────
describe('getDefaultIdentity', () => {
  test('returns emoji and codename for a known colorName', () => {
    const result = getDefaultIdentity('Red');
    expect(result).toEqual({ emoji: '🔥', codename: 'Ember' });
  });

  test('returns correct defaults for each palette entry spot-check', () => {
    expect(getDefaultIdentity('Blue')).toEqual({ emoji: '🌊', codename: 'Wave' });
    expect(getDefaultIdentity('Teal')).toEqual({ emoji: '🐬', codename: 'Reef' });
    expect(getDefaultIdentity('Violet')).toEqual({ emoji: '🔮', codename: 'Prism' });
  });

  test('returns null for unknown colorName', () => {
    expect(getDefaultIdentity('Unknown')).toBeNull();
    expect(getDefaultIdentity('Indigo')).toBeNull();
    expect(getDefaultIdentity('')).toBeNull();
    expect(getDefaultIdentity(undefined)).toBeNull();
  });
});

// ── isIdentityCustomized ──────────────────────────────────────
describe('isIdentityCustomized', () => {
  test('returns false when emoji and codename match palette defaults', () => {
    const identity = { colorName: 'Red', color: '#ef4444', emoji: '🔥', codename: 'Ember', sequenceNumber: 1 };
    expect(isIdentityCustomized(identity)).toBe(false);
  });

  test('returns true when emoji differs from palette default', () => {
    const identity = { colorName: 'Red', color: '#ef4444', emoji: '🦊', codename: 'Ember', sequenceNumber: 1 };
    expect(isIdentityCustomized(identity)).toBe(true);
  });

  test('returns true when codename differs from palette default', () => {
    const identity = { colorName: 'Red', color: '#ef4444', emoji: '🔥', codename: 'Fox', sequenceNumber: 1 };
    expect(isIdentityCustomized(identity)).toBe(true);
  });

  test('returns true when both differ', () => {
    const identity = { colorName: 'Blue', color: '#3b82f6', emoji: '🐟', codename: 'Fish', sequenceNumber: 1 };
    expect(isIdentityCustomized(identity)).toBe(true);
  });

  test('returns false when colorName is unknown (no palette to compare against)', () => {
    const identity = { colorName: 'Indigo', color: '#6366f1', emoji: '🔷', codename: 'Custom', sequenceNumber: 1 };
    expect(isIdentityCustomized(identity)).toBe(false);
  });

  test('returns false for null or undefined identity', () => {
    expect(isIdentityCustomized(null)).toBe(false);
    expect(isIdentityCustomized(undefined)).toBe(false);
  });
});
