import { polishText, applyTypoFixes } from '../utils/spellPolish';

describe('applyTypoFixes', () => {
  test('fixes common para-vocab misspellings', () => {
    const r = applyTypoFixes('he had a behavoir incident');
    expect(r.text).toBe('he had a behavior incident');
    expect(r.changes[0]).toMatchObject({ from: 'behavoir', to: 'behavior', kind: 'typo' });
  });

  test('preserves capitalization on the typed token', () => {
    expect(applyTypoFixes('Behavoir notes').text).toBe('Behavior notes');
    expect(applyTypoFixes('BEHAVOIR notes').text).toBe('BEHAVIOR notes');
    expect(applyTypoFixes('behavoir notes').text).toBe('behavior notes');
  });

  test('does NOT touch words it doesn\'t know (slang, names)', () => {
    const r = applyTypoFixes('Jordan was a champ today');
    expect(r.text).toBe('Jordan was a champ today');
    expect(r.changes).toHaveLength(0);
  });

  test('common contractions get the apostrophe', () => {
    expect(applyTypoFixes("he wasnt ready").text).toBe("he wasn't ready");
    expect(applyTypoFixes("it doesnt matter").text).toBe("it doesn't matter");
  });

  test('leaves correct words alone', () => {
    expect(applyTypoFixes('Maria received the accommodation').text)
      .toBe('Maria received the accommodation');
  });

  test('safe with empty input', () => {
    expect(applyTypoFixes('').text).toBe('');
    expect(applyTypoFixes(null).text).toBe('');
  });
});

describe('polishText', () => {
  test('combines typos + grammar + trailing-whitespace cleanup', () => {
    const messy = 'jordan had a behavoir issue today.   he   was very fustrated   ';
    const { polished, changes } = polishText(messy);
    expect(polished).toBe('Jordan had a behavior issue today. He was very frustrated');
    // typo fixes for behavoir + fustrated; format change for caps + spaces
    expect(changes.filter(c => c.kind === 'typo').length).toBe(2);
    expect(changes.find(c => c.kind === 'format')).toBeDefined();
  });

  test('returns no changes when text is already clean', () => {
    const clean = 'Jordan was on task today.';
    const { polished, changes } = polishText(clean);
    expect(polished).toBe(clean);
    expect(changes).toHaveLength(0);
  });

  test('preserves newlines (paras format their own line breaks)', () => {
    const lines = 'first line\nsecond line\nthird line';
    const { polished } = polishText(lines);
    expect(polished).toBe('First line\nSecond line\nThird line');
  });

  test('original is returned alongside polished for Undo', () => {
    const { original } = polishText('messy text  ');
    expect(original).toBe('messy text  ');
  });

  test('safe with empty input', () => {
    expect(polishText('').polished).toBe('');
    expect(polishText(null).polished).toBe(''); // normalized to empty
    expect(polishText(undefined).polished).toBe('');
  });
});
