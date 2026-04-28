import { tailorAdvice } from '../engine/trainingGapTailoring';

const baseTopic = (overrides = {}) => ({
  ruleId: 'escape_reinforcement_pattern',
  topicTitle: 'Static title',
  topicExplainer: 'Static explainer',
  alternatives: ['Static alt 1', 'Static alt 2'],
  evidenceLogs: [],
  ...overrides,
});

describe('tailorAdvice — escape_reinforcement_pattern', () => {
  test('unknown break access → asks the para to set the supports', () => {
    const out = tailorAdvice(baseTopic(), { supports: { breakAccess: { type: 'unknown' } } });
    expect(out.topicExplainer).toMatch(/Tools & Supports/);
    expect(out.alternatives.join(' ')).toMatch(/Tools & Supports/);
  });

  test('breakAccess: none → urges adding a system, no card-asserting', () => {
    const out = tailorAdvice(baseTopic(), { supports: { breakAccess: { type: 'none' } } });
    expect(out.topicExplainer).toMatch(/doesn't have a break request system on file/);
    expect(out.topicExplainer).not.toMatch(/break card/);
  });

  test('breakAccess: card with notes → tip references the card and the note', () => {
    const out = tailorAdvice(baseTopic(), {
      supports: { breakAccess: { type: 'card', notes: 'kept on her desk' } },
    });
    expect(out.topicExplainer).toMatch(/break card/);
    expect(out.topicExplainer).toMatch(/kept on her desk/);
    expect(out.alternatives[0]).toMatch(/break card channel/);
  });

  test('breakAccess: signal → tip references the signal channel, not card', () => {
    const out = tailorAdvice(baseTopic(), {
      supports: { breakAccess: { type: 'signal' } },
    });
    expect(out.topicExplainer).toMatch(/hand signal/);
    // Alternatives reference the channel by label
    expect(out.alternatives.join(' ')).toMatch(/hand signal/);
  });

  test('breakAccess: informal → tip acknowledges the informal mode', () => {
    const out = tailorAdvice(baseTopic(), {
      supports: { breakAccess: { type: 'informal' } },
    });
    expect(out.topicExplainer).toMatch(/informally/i);
  });

  test('handles missing supports gracefully (defaults to unknown path)', () => {
    const out = tailorAdvice(baseTopic(), {}); // no supports
    expect(out.topicExplainer).toMatch(/Tools & Supports/);
  });
});

describe('tailorAdvice — reactive_without_skill_building_pattern', () => {
  test('no replacementSkills on file → tip asks the para to add one', () => {
    const topic = baseTopic({ ruleId: 'reactive_without_skill_building_pattern' });
    const out = tailorAdvice(topic, { supports: { replacementSkills: [] } });
    expect(out.topicExplainer).toMatch(/don't have any replacement skills on file/);
    expect(out.alternatives[0]).toMatch(/Tools & Supports/);
  });

  test('one replacement skill on file → tip references it specifically', () => {
    const topic = baseTopic({ ruleId: 'reactive_without_skill_building_pattern' });
    const out = tailorAdvice(topic, {
      supports: { replacementSkills: ['ask for a break with break card'] },
    });
    expect(out.topicExplainer).toMatch(/ask for a break with break card/);
  });

  test('replacement skill as object with .skill prop is also handled', () => {
    const topic = baseTopic({ ruleId: 'reactive_without_skill_building_pattern' });
    const out = tailorAdvice(topic, {
      supports: { replacementSkills: [{ skill: 'use calm-down corner', goalId: 'g1' }] },
    });
    expect(out.topicExplainer).toMatch(/use calm-down corner/);
  });
});

describe('tailorAdvice — attention_loop_pattern', () => {
  test('no reinforcement system known → static text unchanged', () => {
    const topic = baseTopic({ ruleId: 'attention_loop_pattern' });
    const out = tailorAdvice(topic, { supports: { reinforcementSystem: 'unknown' } });
    expect(out.topicExplainer).toBe('Static explainer');
  });

  test('reinforcement system known → adds a tailored hint to alternatives', () => {
    const topic = baseTopic({ ruleId: 'attention_loop_pattern' });
    const out = tailorAdvice(topic, { supports: { reinforcementSystem: 'token' } });
    expect(out.alternatives.join(' ')).toMatch(/token economy/i);
  });
});

describe('tailorAdvice — defensive', () => {
  test('returns topic unchanged when ruleId is unknown', () => {
    const topic = baseTopic({ ruleId: 'something_else' });
    expect(tailorAdvice(topic, {})).toBe(topic);
  });

  test('returns topic unchanged when topic is null', () => {
    expect(tailorAdvice(null, {})).toBeNull();
  });
});
