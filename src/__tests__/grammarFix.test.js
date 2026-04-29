import { applyLightGrammarFix, applyFixWithCursor } from '../utils/grammarFix';

describe('applyLightGrammarFix', () => {
  test('capitalizes first letter of the string', () => {
    expect(applyLightGrammarFix('hello world')).toBe('Hello world');
  });

  test('capitalizes after sentence-ending punctuation', () => {
    expect(applyLightGrammarFix('Done. then we move on.')).toBe('Done. Then we move on.');
    expect(applyLightGrammarFix('really? yes.')).toBe('Really? Yes.');
    expect(applyLightGrammarFix('great! next one.')).toBe('Great! Next one.');
  });

  test('capitalizes standalone lowercase "i"', () => {
    expect(applyLightGrammarFix('today i tried something')).toBe('Today I tried something');
    expect(applyLightGrammarFix("i'm tired")).toBe("I'm tired");
  });

  test('does NOT mangle "i" inside a word', () => {
    expect(applyLightGrammarFix('this is a riff')).toBe('This is a riff');
  });

  test('collapses multiple spaces but preserves newlines', () => {
    expect(applyLightGrammarFix('too    many   spaces')).toBe('Too many spaces');
    expect(applyLightGrammarFix('line one\nline two')).toBe('Line one\nLine two');
    expect(applyLightGrammarFix('line one\n\nline two')).toBe('Line one\n\nLine two');
  });

  test('returns empty string unchanged', () => {
    expect(applyLightGrammarFix('')).toBe('');
    expect(applyLightGrammarFix(null)).toBe(null);
  });

  test('idempotent — already-clean text stays unchanged', () => {
    const clean = 'Today I worked with Jordan. He needed extra time.';
    expect(applyLightGrammarFix(clean)).toBe(clean);
  });
});

describe('applyFixWithCursor', () => {
  test('preserves cursor when fix changes text length', () => {
    // "too  many" → "Too many" (one space removed before cursor)
    const { text, cursor } = applyFixWithCursor('too  many spaces', 9);
    expect(text).toBe('Too many spaces');
    // Cursor was after "too  many" (pos 9 in old). In new, that's after "Too many" = pos 8.
    expect(cursor).toBe(8);
  });

  test('cursor at end stays at end after capitalization', () => {
    const input = 'hello world';
    const { text, cursor } = applyFixWithCursor(input, input.length);
    expect(text).toBe('Hello world');
    expect(cursor).toBe(11);
  });

  test('cursor at start stays at 0 after first-letter capitalization', () => {
    const { text, cursor } = applyFixWithCursor('hello', 0);
    expect(text).toBe('Hello');
    expect(cursor).toBe(0);
  });

  test('handles cursor in the middle of unchanged region', () => {
    const { text, cursor } = applyFixWithCursor('today i tried', 6);
    expect(text).toBe('Today I tried');
    // Cursor at pos 6 (between "today " and "i"). Should still be at the same logical spot.
    expect(text.slice(0, cursor)).toBe('Today ');
  });

  test('safe with empty input', () => {
    expect(applyFixWithCursor('', 0)).toEqual({ text: '', cursor: 0 });
  });
});
