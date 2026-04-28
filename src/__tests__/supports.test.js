import {
  defaultSupports, migrateSupports,
  BREAK_ACCESS_TYPES, REINFORCEMENT_SYSTEMS, TRINARY_OPTIONS,
  breakAccessLabel, reinforcementLabel,
} from '../models/supports';

describe('defaultSupports', () => {
  test('returns the canonical empty/unknown shape', () => {
    expect(defaultSupports()).toEqual({
      breakAccess: { type: 'unknown', notes: '' },
      bipActive: 'unknown',
      replacementSkills: [],
      reinforcementSystem: 'unknown',
    });
  });
});

describe('migrateSupports', () => {
  test('returns defaults for null/undefined/non-object input', () => {
    expect(migrateSupports(null)).toEqual(defaultSupports());
    expect(migrateSupports(undefined)).toEqual(defaultSupports());
    expect(migrateSupports('not an object')).toEqual(defaultSupports());
  });

  test('preserves valid breakAccess fields', () => {
    const out = migrateSupports({
      breakAccess: { type: 'card', notes: 'kept on her desk' },
    });
    expect(out.breakAccess).toEqual({ type: 'card', notes: 'kept on her desk' });
  });

  test('drops non-string notes safely', () => {
    const out = migrateSupports({ breakAccess: { type: 'card', notes: 123 } });
    expect(out.breakAccess.notes).toBe('');
  });

  test('keeps replacementSkills only when array', () => {
    expect(migrateSupports({ replacementSkills: ['a', 'b'] }).replacementSkills).toEqual(['a', 'b']);
    expect(migrateSupports({ replacementSkills: 'nope' }).replacementSkills).toEqual([]);
  });

  test('falls back to defaults for missing fields', () => {
    const out = migrateSupports({ bipActive: 'yes' });
    expect(out.bipActive).toBe('yes');
    expect(out.breakAccess).toEqual({ type: 'unknown', notes: '' });
    expect(out.reinforcementSystem).toBe('unknown');
  });
});

describe('lookup helpers', () => {
  test('every BREAK_ACCESS_TYPES id has a label', () => {
    BREAK_ACCESS_TYPES.forEach(t => expect(t.label).toBeTruthy());
  });
  test('every REINFORCEMENT_SYSTEMS id has a label', () => {
    REINFORCEMENT_SYSTEMS.forEach(t => expect(t.label).toBeTruthy());
  });
  test('TRINARY_OPTIONS has unknown/yes/no', () => {
    expect(TRINARY_OPTIONS.map(o => o.id)).toEqual(['unknown', 'yes', 'no']);
  });
  test('breakAccessLabel returns label or default', () => {
    expect(breakAccessLabel('card')).toBe('Break card');
    expect(breakAccessLabel('xxx')).toBe('Not sure yet');
  });
  test('reinforcementLabel returns label or default', () => {
    expect(reinforcementLabel('token')).toBe('Token economy / point sheet');
    expect(reinforcementLabel('xxx')).toBe('Not sure yet');
  });
});
