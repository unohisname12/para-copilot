import { getHintForCategory } from '../components/SimpleMode';
import { SUPPORT_CARDS } from '../data';

// ── getHintForCategory — card routing ────────────────────────

describe('getHintForCategory — correct card selected per category', () => {
  test('behavior maps to De-escalation Support', () => {
    const hint = getHintForCategory('behavior', SUPPORT_CARDS);
    expect(hint.title).toBe('De-escalation Support');
  });

  test('refusal maps to Work Refusal Support', () => {
    const hint = getHintForCategory('refusal', SUPPORT_CARDS);
    expect(hint.title).toBe('Work Refusal Support');
  });

  test('transition maps to Transition Support', () => {
    const hint = getHintForCategory('transition', SUPPORT_CARDS);
    expect(hint.title).toBe('Transition Support');
  });

  test('break maps to Sensory Support', () => {
    const hint = getHintForCategory('break', SUPPORT_CARDS);
    expect(hint.title).toBe('Sensory Support');
  });

  test('academic maps to Writing Support', () => {
    const hint = getHintForCategory('academic', SUPPORT_CARDS);
    expect(hint.title).toBe('Writing Support');
  });
});

// ── getHintForCategory — nulls ────────────────────────────────

describe('getHintForCategory — returns null when no card applies', () => {
  test('positive returns null (it is a celebration, not a support situation)', () => {
    expect(getHintForCategory('positive', SUPPORT_CARDS)).toBeNull();
  });

  test('unknown category returns null', () => {
    expect(getHintForCategory('doesNotExist', SUPPORT_CARDS)).toBeNull();
  });

  test('empty supportCards array returns null', () => {
    expect(getHintForCategory('behavior', [])).toBeNull();
  });
});

// ── getHintForCategory — output shape ────────────────────────

describe('getHintForCategory — output shape', () => {
  const MAPPED = ['behavior', 'refusal', 'transition', 'break', 'academic'];

  test('every mapped category returns title, whenToUse, and whatToSay', () => {
    MAPPED.forEach(cat => {
      const hint = getHintForCategory(cat, SUPPORT_CARDS);
      expect(hint).not.toBeNull();
      expect(typeof hint.title).toBe('string');
      expect(hint.title.length).toBeGreaterThan(0);
      expect(typeof hint.whenToUse).toBe('string');
      expect(hint.whenToUse.length).toBeGreaterThan(0);
      expect(Array.isArray(hint.whatToSay)).toBe(true);
    });
  });

  test('whatToSay is capped at 2 items for all mapped categories', () => {
    MAPPED.forEach(cat => {
      const hint = getHintForCategory(cat, SUPPORT_CARDS);
      expect(hint.whatToSay.length).toBeGreaterThanOrEqual(1);
      expect(hint.whatToSay.length).toBeLessThanOrEqual(2);
    });
  });

  test('whenToUse comes directly from the matched support card', () => {
    const hint = getHintForCategory('behavior', SUPPORT_CARDS);
    const card = SUPPORT_CARDS.find(c => c.id === 'sc_escal');
    expect(hint.whenToUse).toBe(card.whenToUse);
  });

  test('whatToSay items are the first two from the matched support card', () => {
    const hint = getHintForCategory('transition', SUPPORT_CARDS);
    const card = SUPPORT_CARDS.find(c => c.id === 'sc_trans');
    expect(hint.whatToSay[0]).toBe(card.whatToSay[0]);
    expect(hint.whatToSay[1]).toBe(card.whatToSay[1]);
  });
});
