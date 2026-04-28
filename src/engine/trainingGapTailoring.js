// ── Training-Gap Tailoring ────────────────────────────────────
// Rewrites a fired topic's explainer/alternatives based on what the app
// actually knows about the student's supports. Without this, suggestions
// are generic guesses (and were sometimes wrong, e.g. "use a break card"
// when the student doesn't have one).
//
// Reads student.supports (see src/models/supports.js).
// Falls back to the rule's static text when no tailoring applies.

import { breakAccessLabel, reinforcementLabel } from '../models/supports';

// Per-rule tailoring functions. Keyed by rule.id. Each takes the static
// rule + the student object and returns { topicExplainer, alternatives }.
// Return null/undefined to use the rule's static text unchanged.
const TAILORINGS = {
  escape_reinforcement_pattern(rule, student) {
    const supports = student?.supports || {};
    const breakType = supports.breakAccess?.type || 'unknown';
    const breakNotes = (supports.breakAccess?.notes || '').trim();

    if (breakType === 'unknown') {
      return {
        topicExplainer:
          "When breaks happen right after problem behavior, it can teach the kid that acting out is what makes the work go away. " +
          "But the fix depends on what's actually in this student's plan — and we don't have that on file yet. " +
          "First step: ask the sped teacher what the break system is for this kid (card, signal, words, or none) and update the student's Tools & Supports tab so the next tip can be specific.",
        alternatives: [
          "Open the student profile → Tools & Supports → set 'Break request system' so future tips are tailored to what's actually in place.",
          "When you log a break, tap the break action and pick how it was earned (asked vs. offered vs. escalated). That's the data that makes this rule useful.",
          "Bring up at the next check-in: 'Does this kid have a way to ask for a break? If not, would adding one help?'",
        ],
      };
    }

    if (breakType === 'none') {
      return {
        topicExplainer:
          "When breaks happen right after problem behavior, it can teach the kid that acting out is what makes the work go away. " +
          "This student doesn't have a break request system on file — that's the conversation. " +
          "Without a way to ask, the kid only earns breaks by escalating, which trains escalation.",
        alternatives: [
          "Bring up adding a break request system at the next check-in. Even a simple card or signal is a start.",
          "Until something is in place, log how each break was earned (offered? earned by escalation?) so the picture stays accurate.",
        ],
      };
    }

    if (breakType === 'informal') {
      return {
        topicExplainer:
          "Breaks are happening informally for this kid — staff judgment, no formal system. That can work, but the rule fired because there's a pattern of breaks without clear evidence the kid is asking for them. " +
          "Worth checking whether the informal approach is reading as 'act out = break' to this kid.",
        alternatives: [
          "Log how each break is earned (offered vs. escalated) for the next two weeks; bring the data to your check-in.",
          "Worth asking whether a more formal request system would help this kid — informal works for some, not for others.",
        ],
      };
    }

    // Real, documented system in place: card / signal / verbal
    const channelLabel = breakAccessLabel(breakType).toLowerCase();
    const channelHint = breakNotes ? ` (note on file: "${breakNotes}")` : '';
    return {
      topicExplainer:
        `This student's break system is on file: ${channelLabel}${channelHint}. ` +
        `The rule fired because we logged 3+ breaks this week without any logs showing the student requesting one through that channel — meaning breaks are likely being earned by escalation instead of by using the system. ` +
        `When breaks come right after problem behavior, the brain learns "act out = work goes away." Worth checking together whether the request system is being honored.`,
      alternatives: [
        `Make sure breaks ONLY happen when earned through the ${channelLabel} channel — not after escalation.`,
        `When you log a break, pick how it was earned (asked / offered / escalated) so the data matches reality.`,
        `If the student isn't using their ${channelLabel}, practice it during calm moments — that's when learning sticks.`,
      ],
    };
  },

  attention_loop_pattern(rule, student) {
    // Doesn't depend on a specific tool; static text already cautions the
    // para to confirm function with the sped teacher first. Add a soft
    // hint when reinforcement system is known.
    const supports = student?.supports || {};
    const reinf = supports.reinforcementSystem || 'unknown';
    if (reinf === 'unknown' || reinf === 'none') return null;
    const reinfLabel = reinforcementLabel(reinf).toLowerCase();
    return {
      topicExplainer: rule.topicExplainer,
      alternatives: [
        ...rule.alternatives,
        `Their reinforcement system on file is "${reinfLabel}" — make sure on-task moments are being reinforced through THAT channel, not just verbal redirects.`,
      ],
    };
  },

  reactive_without_skill_building_pattern(rule, student) {
    const supports = student?.supports || {};
    const skills = Array.isArray(supports.replacementSkills) ? supports.replacementSkills : [];
    if (skills.length === 0) {
      return {
        topicExplainer:
          "Putting out the fire — redirecting, calming the kid down, giving a break — handles the moment but doesn't teach what to do differently. " +
          "We don't have any replacement skills on file for this student yet, so the rule can't suggest a specific skill to teach. That's the conversation: what should this kid do INSTEAD of the problem behavior, and is that being taught?",
        alternatives: [
          "Open the student profile → Tools & Supports → add the replacement skill from their BIP/IEP if one is listed, so the app knows what to suggest.",
          "If nothing's listed in the plan yet, ask the sped teacher whether one should be added. Without it, you're managing forever instead of teaching.",
        ],
      };
    }
    const first = skills[0]?.skill || skills[0];
    return {
      topicExplainer:
        `On file, this student's replacement skill is: "${first}". ` +
        `The rule fired because we logged 3+ reactive interventions in 2 weeks (redirect, calm-down, give break) without any logs showing that skill being practiced or taught. ` +
        `In-the-moment responses fix the moment but don't teach the kid what to do next time the same trigger shows up.`,
      alternatives: [
        `When you have a calm moment with this kid, run a quick rep of "${first}" — modeling, practicing together, or just reminding them counts.`,
        `When you log skill teaching, pick the mode (modeled / practiced / reminded / reviewed) so the picture is accurate.`,
        `Pair your next reactive intervention with a quick reminder of "${first}" — the team can see whether that pairing reduces the pattern.`,
      ],
    };
  },
};

// Top-level entry. Returns the topic with its explainer + alternatives
// possibly tailored. Always returns a topic-shaped object.
export function tailorAdvice(topic, student) {
  if (!topic || !topic.ruleId) return topic;
  const fn = TAILORINGS[topic.ruleId];
  if (!fn) return topic;
  // The rule object is approximated from the topic's fields here — the
  // tailoring function uses these as the static fallback.
  const ruleStatic = {
    topicExplainer: topic.topicExplainer,
    alternatives: topic.alternatives,
  };
  let tailored;
  try {
    tailored = fn(ruleStatic, student);
  } catch {
    tailored = null;
  }
  if (!tailored) return topic;
  return {
    ...topic,
    topicExplainer: tailored.topicExplainer || topic.topicExplainer,
    alternatives: tailored.alternatives || topic.alternatives,
  };
}
