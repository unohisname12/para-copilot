import { CLARIFIERS, hasClarifier, resolveClarifierLog } from '../components/modals/ClarifierModal';

describe('hasClarifier', () => {
  test('true for actions that have a clarifier defined', () => {
    expect(hasClarifier('qa_break')).toBe(true);
    expect(hasClarifier('qa_break_requested')).toBe(true);
    expect(hasClarifier('qa_skill_taught')).toBe(true);
  });
  test('false for actions without a clarifier', () => {
    expect(hasClarifier('qa_redirect')).toBe(false);
    expect(hasClarifier('qa_positive')).toBe(false);
    expect(hasClarifier('xxx')).toBe(false);
    expect(hasClarifier(undefined)).toBe(false);
  });
});

describe('resolveClarifierLog', () => {
  const breakAction = { id: 'qa_break', defaultNote: 'fallback', tags: ['break'], logType: 'Accommodation Used' };

  test('returns the variant that matches the picked id', () => {
    const out = resolveClarifierLog(breakAction, 'asked_card');
    expect(out.note).toBe('Student requested the break using their card or signal.');
    expect(out.tags).toContain('break_request_card');
    expect(out.tags).toContain('fct');
  });

  test('falls back to first variant when picked id not found', () => {
    const out = resolveClarifierLog(breakAction, 'nonsense');
    expect(out.note).toContain('Student requested');
  });

  test('falls back to action defaults when no clarifier defined', () => {
    const noClarifier = { id: 'qa_redirect', defaultNote: 'redirected', tags: ['redirect'] };
    expect(resolveClarifierLog(noClarifier, 'asked_card')).toEqual({
      note: 'redirected',
      tags: ['redirect'],
    });
  });

  test('escalation variant captures the right tag for the rule engine', () => {
    const out = resolveClarifierLog(breakAction, 'escalated');
    expect(out.tags).toContain('break_escalation');
    // Critically: does NOT contain fct/replacement_skill (so it does NOT
    // count as a "counter" log that suppresses the escape-reinforcement rule)
    expect(out.tags).not.toContain('fct');
    expect(out.tags).not.toContain('replacement_skill');
  });
});

describe('CLARIFIERS coverage', () => {
  test('every clarifier has at least 2 variants', () => {
    Object.values(CLARIFIERS).forEach(def => {
      expect(def.variants.length).toBeGreaterThanOrEqual(2);
      expect(def.title).toBeTruthy();
    });
  });
  test('every variant has a unique id within its clarifier', () => {
    Object.values(CLARIFIERS).forEach(def => {
      const ids = def.variants.map(v => v.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });
});
