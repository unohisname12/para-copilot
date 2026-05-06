import { NOTE_TEMPLATES, insertTemplate } from '../features/simple-mode/noteTemplates';

describe('NOTE_TEMPLATES — shape', () => {
  test('exposes 5 starter templates', () => {
    expect(NOTE_TEMPLATES).toHaveLength(5);
  });

  test('every template has a stable id, label, and text', () => {
    NOTE_TEMPLATES.forEach(t => {
      expect(typeof t.id).toBe('string');
      expect(t.id.length).toBeGreaterThan(0);
      expect(typeof t.label).toBe('string');
      expect(t.label.length).toBeGreaterThan(0);
      expect(typeof t.text).toBe('string');
      expect(t.text.length).toBeGreaterThan(0);
    });
  });

  test('template ids are unique', () => {
    const ids = NOTE_TEMPLATES.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('contains the five UX-spec starters', () => {
    const ids = NOTE_TEMPLATES.map(t => t.id).sort();
    expect(ids).toEqual(['accommodation', 'escalation', 'positive', 'redirect', 'success'].sort());
  });
});

describe('insertTemplate', () => {
  test('returns the template text when the draft is empty', () => {
    const out = insertTemplate('', 'redirect');
    expect(out).toBe('Needed redirection during ');
  });

  test('appends with a newline when the draft has content', () => {
    const out = insertTemplate('first line', 'positive');
    expect(out).toBe('first line\nResponded well to ');
  });

  test('does not double-newline when the draft already ends in newline', () => {
    const out = insertTemplate('line one\n', 'success');
    expect(out).toBe('line one\nSuccessful support was ');
  });

  test('returns the draft unchanged when the template id is unknown', () => {
    const out = insertTemplate('some draft', 'does_not_exist');
    expect(out).toBe('some draft');
  });

  test('handles undefined draft gracefully', () => {
    const out = insertTemplate(undefined, 'escalation');
    expect(out).toBe('Escalated when ');
  });

  test('whitespace-only draft is treated like empty', () => {
    const out = insertTemplate('   ', 'accommodation');
    expect(out).toBe('Used accommodation: ');
  });
});
