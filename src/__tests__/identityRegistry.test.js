import { generatePseudonymSet, PSEUDONYM_PALETTE } from '../models';

describe('generatePseudonymSet', () => {
  test('assigns Red Student 1 to the first name', () => {
    const result = generatePseudonymSet(['Alice']);
    expect(result.get('Alice')).toEqual({ pseudonym: 'Red Student 1', color: '#ef4444' });
  });

  test('assigns different colors to sequential names', () => {
    const result = generatePseudonymSet(['Alice', 'Bob', 'Carol']);
    expect(result.get('Alice').color).toBe('#ef4444');  // Red
    expect(result.get('Bob').color).toBe('#f97316');    // Orange
    expect(result.get('Carol').color).toBe('#eab308');  // Yellow
  });

  test('cycles palette after 12 names and increments counter', () => {
    const names = Array.from({ length: 13 }, (_, i) => `Person ${i + 1}`);
    const result = generatePseudonymSet(names);
    expect(result.get('Person 1').pseudonym).toBe('Red Student 1');
    expect(result.get('Person 13').pseudonym).toBe('Red Student 2');
    expect(result.get('Person 13').color).toBe('#ef4444');
  });

  test('returns empty Map for empty input', () => {
    expect(generatePseudonymSet([]).size).toBe(0);
  });

  test('silently overwrites duplicate input names (Map behavior)', () => {
    const result = generatePseudonymSet(['Alice', 'Alice']);
    expect(result.size).toBe(1);
    expect(result.get('Alice').pseudonym).toBe('Orange Student 1');
  });
});

describe('PSEUDONYM_PALETTE', () => {
  test('has exactly 12 entries', () => {
    expect(PSEUDONYM_PALETTE).toHaveLength(12);
  });
});
