// ══════════════════════════════════════════════════════════════
// TRAINING-GAP RULES — JSON-style descriptors for v1
// Each rule references a named predicate from trainingGapPredicates.js.
// See docs/superpowers/specs/2026-04-26-training-gap-agenda-design.md
// ══════════════════════════════════════════════════════════════

export const TRAINING_GAP_RULES = [
  {
    id: 'escape_reinforcement_pattern',
    topicTitle: 'When breaks help vs. when they backfire',
    plainEnglishRule: '3+ break-pass uses with no break-card-request in 7 days',
    window: { days: 7 },
    scope: 'per-student',
    fires: {
      predicate: 'countWithoutCounter',
      presence: { tags: ['break', 'regulation'], min: 3 },
      counter: { tags: ['fct', 'replacement_skill'], max: 0 },
    },
    topicExplainer:
      "Giving a break right after problem behavior can reinforce the escape — the kid learns 'act out → demand goes away.' Teaching the student to *ask* for the break (functional communication) and only honoring breaks earned that way is the EBP fix.",
    alternatives: [
      "Functional communication training: teach a 'break card' or break sign so the student can request the break.",
      'Pair earned breaks with skill demonstration, not with escalation.',
    ],
  },
  {
    id: 'attention_loop_pattern',
    topicTitle: 'Catching them being good — flipping attention loops',
    plainEnglishRule: '3+ verbal-redirect logs with fewer than 2 positive-participation logs in 7 days',
    window: { days: 7 },
    scope: 'per-student',
    fires: {
      predicate: 'countWithoutCounter',
      presence: { tags: ['redirect', 'behavior'], min: 3 },
      counter: { tags: ['positive', 'praise'], max: 1 },
    },
    topicExplainer:
      'For attention-maintained behavior, the redirect IS the reinforcer — talking to the kid about the behavior is the thing they were after. The fix is planned ignoring of the problem behavior plus heavy reinforcement of any moment of on-task behavior (DRA/DRO).',
    alternatives: [
      'Catch the student being good — specific praise the moment they are on-task.',
      'Use planned ignoring of the attention-seeking behavior while staying close.',
    ],
  },
  {
    id: 'reactive_without_skill_building_pattern',
    topicTitle: 'What we want them to do instead',
    plainEnglishRule: '3+ reactive-intervention logs with no skill-teaching logs in 14 days',
    window: { days: 14 },
    scope: 'per-student',
    fires: {
      predicate: 'countWithoutCounter',
      presence: { tags: ['redirect', 'deescalation', 'break'], min: 3 },
      counter: { tags: ['skill_teaching', 'replacement'], max: 0 },
    },
    topicExplainer:
      "Reactive interventions (redirect, de-escalate, give break) don't teach the kid what to do *instead*. Without an explicit replacement skill being taught, the behavior comes back as soon as the situation repeats. Pair every reactive intervention with a 'what we want them to do instead' plan.",
    alternatives: [
      'Identify and explicitly teach a replacement skill that meets the same need as the problem behavior.',
      'Model and rehearse the replacement skill during calm moments, not only when the behavior is happening.',
    ],
  },
];

// Minimum log threshold per student before any topic surfaces.
// Prevents false positives on brand-new students with very few logs.
export const NEW_STUDENT_MIN_LOGS = 10;
