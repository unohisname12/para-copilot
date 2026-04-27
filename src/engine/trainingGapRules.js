// ══════════════════════════════════════════════════════════════
// TRAINING-GAP RULES — JSON-style descriptors for v1
// Each rule references a named predicate from trainingGapPredicates.js.
// See docs/superpowers/specs/2026-04-26-training-gap-agenda-design.md
//
// COPY RULE: every string in this file is rendered to paras. Plain
// English only — no specialist vocabulary. See the "Para-facing copy
// rule" section in the spec.
// ══════════════════════════════════════════════════════════════

export const TRAINING_GAP_RULES = [
  {
    id: 'escape_reinforcement_pattern',
    topicTitle: 'When breaks help vs. when they backfire',
    plainEnglishRule: '3+ times this week the student got a break, but they never asked for one with their break card',
    window: { days: 7 },
    scope: 'per-student',
    fires: {
      predicate: 'countWithoutCounter',
      presence: { tags: ['break', 'regulation'], min: 3 },
      counter: { tags: ['fct', 'replacement_skill'], max: 0 },
    },
    topicExplainer:
      "When a kid acts out and the response is 'go take a break,' it can teach them that acting out is what makes the work go away. A better path: teach the student to ASK for a break (with a card or simple signal), then only give the break when they ask the right way. The break still happens — but the kid earns it by asking, not by escalating.",
    alternatives: [
      "Teach the student to use a break card or simple signal to ask for a break — practice it during calm moments first.",
      "Only give the break when they ask for it the right way, not when they act out.",
    ],
  },
  {
    id: 'attention_loop_pattern',
    topicTitle: 'Catching them being good — when the redirect is the reward',
    plainEnglishRule: '3+ times this week you redirected this student, but only 0–1 moments logged of catching them doing the right thing',
    window: { days: 7 },
    scope: 'per-student',
    fires: {
      predicate: 'countWithoutCounter',
      presence: { tags: ['redirect', 'behavior'], min: 3 },
      counter: { tags: ['positive', 'praise'], max: 1 },
    },
    topicExplainer:
      "Sometimes a kid acts out specifically because they want your attention. When that's what's going on, redirecting them gives them exactly the attention they were after — so the redirect actually rewards the behavior. The fix: when it's safe, ignore the attention-seeking behavior, and notice + praise them every single time you catch them doing the right thing.",
    alternatives: [
      "Catch the student being good — give specific praise the moment they're doing the right thing.",
      "When safe, ignore the attention-seeking behavior while staying close — give your attention for the right behavior, not the wrong one.",
    ],
  },
  {
    id: 'reactive_without_skill_building_pattern',
    topicTitle: 'What we want them to do instead',
    plainEnglishRule: '3+ in-the-moment responses (redirect, calm-down, break) in the last 2 weeks, but no time logged teaching them what to do differently',
    window: { days: 14 },
    scope: 'per-student',
    fires: {
      predicate: 'countWithoutCounter',
      presence: { tags: ['redirect', 'deescalation', 'break'], min: 3 },
      counter: { tags: ['skill_teaching', 'replacement'], max: 0 },
    },
    topicExplainer:
      "Putting out the fire — redirecting, calming the kid down, giving a break — handles the moment but doesn't teach them what to do differently next time. The behavior comes back as soon as the same trigger shows up again. Pair the in-the-moment response with teaching them what to do instead.",
    alternatives: [
      "Figure out what the kid is trying to get from the behavior, then teach them a better way to get the same thing.",
      "Practice the new way during calm moments — not only when the behavior is happening.",
    ],
  },
];

// Minimum log threshold per student before any topic surfaces.
// Prevents false positives on brand-new students with very few logs.
export const NEW_STUDENT_MIN_LOGS = 10;
