import { resolveStudentSlot } from '../components/IEPImport';

// ── resolveStudentSlot ────────────────────────────────────────
// Replaces IMPORT_COLORS with IDENTITY_PALETTE (via assignIdentity).
// Verifies that single-student imports get a full identity object.
describe('resolveStudentSlot', () => {
  test('slot 0 → Red Student 1 with identity', () => {
    const result = resolveStudentSlot(0);
    expect(result.pseudonym).toBe('Red Student 1');
    expect(result.color).toBe('#ef4444');
    expect(result.identity).toEqual({
      colorName: 'Red',
      color: '#ef4444',
      emoji: '🔥',
      codename: 'Ember',
      sequenceNumber: 1,
    });
  });

  test('slot 1 → Orange Student 1 with identity', () => {
    const result = resolveStudentSlot(1);
    expect(result.pseudonym).toBe('Orange Student 1');
    expect(result.color).toBe('#f97316');
    expect(result.identity.colorName).toBe('Orange');
    expect(result.identity.sequenceNumber).toBe(1);
  });

  test('slot 12 → Red Student 2 (palette wrap + counter increment)', () => {
    const result = resolveStudentSlot(12);
    expect(result.pseudonym).toBe('Red Student 2');
    expect(result.color).toBe('#ef4444');
    expect(result.identity.sequenceNumber).toBe(2);
  });

  test('slot 11 → last palette entry (Lime Student 1)', () => {
    const result = resolveStudentSlot(11);
    expect(result.pseudonym).toBe('Lime Student 1');
    expect(result.color).toBe('#84cc16');
    expect(result.identity.colorName).toBe('Lime');
  });

  test('identity is consistent with pseudonym on every slot', () => {
    for (let i = 0; i < 24; i++) {
      const { pseudonym, color, identity } = resolveStudentSlot(i);
      expect(pseudonym).toBe(`${identity.colorName} Student ${identity.sequenceNumber}`);
      expect(color).toBe(identity.color);
    }
  });
});
