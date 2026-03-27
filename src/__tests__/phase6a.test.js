import { patchIdentity } from '../identity';

const baseStudent = {
  id: 'stu_1',
  pseudonym: 'Red Student 1',
  color: '#ef4444',
  identity: { colorName: 'Red', color: '#ef4444', emoji: '🔥', codename: 'Ember', sequenceNumber: 1 },
};

describe('patchIdentity', () => {
  test('updates emoji', () => {
    const result = patchIdentity(baseStudent, { emoji: '🦊', codename: 'Ember' });
    expect(result.identity.emoji).toBe('🦊');
  });

  test('updates codename', () => {
    const result = patchIdentity(baseStudent, { emoji: '🔥', codename: 'Fox' });
    expect(result.identity.codename).toBe('Fox');
  });

  test('preserves colorName, color, sequenceNumber', () => {
    const result = patchIdentity(baseStudent, { emoji: '🦊', codename: 'Fox' });
    expect(result.identity.colorName).toBe('Red');
    expect(result.identity.color).toBe('#ef4444');
    expect(result.identity.sequenceNumber).toBe(1);
  });

  test('falls back to existing emoji when empty string provided', () => {
    const result = patchIdentity(baseStudent, { emoji: '', codename: 'Fox' });
    expect(result.identity.emoji).toBe('🔥');
  });

  test('falls back to existing codename when empty string provided', () => {
    const result = patchIdentity(baseStudent, { emoji: '🦊', codename: '' });
    expect(result.identity.codename).toBe('Ember');
  });

  test('falls back to existing emoji when whitespace-only provided', () => {
    const result = patchIdentity(baseStudent, { emoji: '   ', codename: 'Fox' });
    expect(result.identity.emoji).toBe('🔥');
  });

  test('normalizes via migrateIdentity when identity is missing', () => {
    const noIdentity = { id: 'stu_x', pseudonym: 'Blue Student 1', color: '#3b82f6' };
    const result = patchIdentity(noIdentity, { emoji: '🐋', codename: 'Tide' });
    expect(result.identity.emoji).toBe('🐋');
    expect(result.identity.codename).toBe('Tide');
    expect(result.identity.colorName).toBe('Blue');
    expect(result.identity.sequenceNumber).toBe(1);
  });

  test('does not mutate the original student object', () => {
    const original = { ...baseStudent, identity: { ...baseStudent.identity } };
    patchIdentity(baseStudent, { emoji: '🦊', codename: 'Fox' });
    expect(baseStudent.identity.emoji).toBe(original.identity.emoji);
    expect(baseStudent.identity.codename).toBe(original.identity.codename);
  });
});
