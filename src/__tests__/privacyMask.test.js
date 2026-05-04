import { maskName } from '../utils/privacyMask';

describe('maskName', () => {
  test('two-token name returns dotted initials', () => {
    expect(maskName('Maria Lopez')).toBe('M.L.');
  });
  test('three-token name uses first + last initials', () => {
    expect(maskName('Anna Maria Lopez')).toBe('A.L.');
  });
  test('single-token name returns one initial', () => {
    expect(maskName('Cher')).toBe('C.');
  });
  test('empty string returns em-dash', () => {
    expect(maskName('')).toBe('—');
  });
  test('null/undefined returns em-dash', () => {
    expect(maskName(null)).toBe('—');
    expect(maskName(undefined)).toBe('—');
  });
  test('extra whitespace collapses', () => {
    expect(maskName('  Maria   Lopez  ')).toBe('M.L.');
  });
  test('lowercase input returns uppercase initials', () => {
    expect(maskName('maria lopez')).toBe('M.L.');
  });
});
