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
    plainEnglishRule: '3+ times this week the student got a break, with no logs showing them requesting it through a known channel',
    window: { days: 7 },
    scope: 'per-student',
    fires: {
      predicate: 'countWithoutCounter',
      presence: { tags: ['break', 'regulation'], min: 3 },
      counter: { tags: ['fct', 'replacement_skill'], max: 0 },
    },
    topicExplainer:
      "When a kid acts out and the response is 'go take a break,' it can teach them that acting out is what makes the work go away. The fix depends on what's already in place — first thing to figure out together is HOW this kid is supposed to ask for a break (card, signal, words, anything?), then check whether breaks are being earned through that channel or only by escalating.",
    alternatives: [
      "Find out what's in this student's IEP/BIP for breaks — is there a card, signal, picture, or words they're supposed to use? If yes, are they using it? If not, that's the conversation: would adding a request system help?",
      "When logging a break, capture HOW it was earned — did the student ask (and how)? Did you offer? Did they escalate first? That's the data that makes this rule actually useful instead of guessing.",
      "If a request system IS in place, only honor breaks earned through it; don't reward escalation.",
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
      "Sometimes a kid acts out specifically because they want your attention — and when that's what's going on, redirecting them gives them exactly the attention they were after, so the redirect actually rewards the behavior. Worth checking with the sped teacher whether attention IS the function for this kid before applying the fix. If yes: when it's safe, plan to ignore the attention-seeking behavior and notice + praise the moments they're doing the right thing.",
    alternatives: [
      "Talk through the function of this kid's behavior with the sped teacher — is it attention, escape, access to something, sensory? The fix depends on the answer; assuming attention can backfire if it's actually escape.",
      "Once function is known: catch the student being good — specific praise the moment they're doing the right thing, every time.",
      "When safe and the function fits, ignore the attention-seeking behavior while staying close — give your attention for the right behavior, not the wrong one.",
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
      "Putting out the fire — redirecting, calming the kid down, giving a break — handles the moment but doesn't teach them what to do differently next time. The behavior comes back as soon as the same trigger shows up again. The pair to make this rule actionable: check what replacement skills are listed in the student's BIP/IEP. Those are the priority to teach. If nothing's listed, that's the conversation to bring up.",
    alternatives: [
      "Look up what replacement skill IS listed in this student's plan — then build a quick \"what to do instead\" plan around it.",
      "If no replacement skill is listed yet, ask the sped teacher whether one should be added; without it, you're managing forever instead of teaching.",
      "Practice the replacement during calm moments, not only mid-incident — that's when learning sticks.",
    ],
  },
];

// Minimum log threshold per student before any topic surfaces.
// Prevents false positives on brand-new students with very few logs.
export const NEW_STUDENT_MIN_LOGS = 10;
