// ── Clarifier Modal ─────────────────────────────────────────
// When the para taps a Quick Action where "what actually happened" matters
// (was the break asked for? offered? earned via escalation?), show this
// quick modal so the log captures the truth instead of flattening it.
//
// The training-gap rule engine reads the resulting tags to tailor coaching
// tips. Without this, rules guess; with it, rules can be specific.

import React from 'react';
import { useEscape } from '../../hooks/useEscape';

// One clarifier per action id. Each variant builds the final log payload.
// `note` augments the action's defaultNote; `tags` adds to the action's tags.
export const CLARIFIERS = {
  qa_break: {
    title: 'How was the break earned?',
    subtitle: 'Helps the Coaching tab tell the difference between a kid who asked properly and a kid who escalated until you gave one.',
    variants: [
      {
        id: 'asked_card', label: 'Student asked with their card / signal',
        note: 'Student requested the break using their card or signal.',
        tags: ['break', 'fct', 'replacement_skill', 'regulation', 'positive', 'break_request_card'],
      },
      {
        id: 'asked_verbal', label: 'Student asked verbally',
        note: 'Student verbally requested the break.',
        tags: ['break', 'fct', 'replacement_skill', 'regulation', 'positive', 'break_request_verbal'],
      },
      {
        id: 'offered', label: 'I offered the break',
        note: 'I offered the break (proactive).',
        tags: ['break', 'regulation', 'break_offered'],
      },
      {
        id: 'escalated', label: 'Student escalated, then I gave one',
        note: 'Student escalated; break was given to de-escalate.',
        tags: ['break', 'regulation', 'break_escalation'],
      },
      {
        id: 'skip', label: 'Just log a break (no detail)',
        note: 'Student used break pass.',
        tags: ['break', 'regulation', 'bip'],
      },
    ],
  },
  qa_break_requested: {
    title: 'How did the student ask?',
    subtitle: 'Capturing the channel helps the team see whether their request system is working.',
    variants: [
      {
        id: 'card', label: 'With a break card / picture',
        note: 'Student requested the break using their card.',
        tags: ['break', 'fct', 'replacement_skill', 'regulation', 'positive', 'break_request_card'],
      },
      {
        id: 'signal', label: 'With a hand signal / sign',
        note: 'Student requested the break using a signal.',
        tags: ['break', 'fct', 'replacement_skill', 'regulation', 'positive', 'break_request_signal'],
      },
      {
        id: 'verbal', label: 'Verbally / in words',
        note: 'Student verbally requested the break.',
        tags: ['break', 'fct', 'replacement_skill', 'regulation', 'positive', 'break_request_verbal'],
      },
      {
        id: 'unsure', label: 'Not sure — but they asked',
        note: 'Student asked for the break (channel unclear).',
        tags: ['break', 'fct', 'replacement_skill', 'regulation', 'positive'],
      },
    ],
  },
  qa_skill_taught: {
    title: 'How did you teach it?',
    subtitle: 'Different teaching modes track differently. Mostly useful when the team is reviewing whether skills are sticking.',
    variants: [
      {
        id: 'modeled', label: 'Modeled it for the student',
        note: 'Modeled the replacement skill for the student.',
        tags: ['skill_teaching', 'replacement', 'positive', 'skill_modeled'],
      },
      {
        id: 'practiced', label: 'Practiced together (rehearsal)',
        note: 'Practiced the replacement skill with the student.',
        tags: ['skill_teaching', 'replacement', 'positive', 'skill_practiced'],
      },
      {
        id: 'reminded', label: 'Reminded student of the skill',
        note: 'Reminded the student of the replacement skill.',
        tags: ['skill_teaching', 'replacement', 'positive', 'skill_reminded'],
      },
      {
        id: 'reviewed', label: 'Reviewed how it went after',
        note: 'Reviewed the skill with the student after the situation.',
        tags: ['skill_teaching', 'replacement', 'positive', 'skill_reviewed'],
      },
    ],
  },
};

export function hasClarifier(actionId) {
  return Boolean(CLARIFIERS[actionId]);
}

// Resolves a (action, variantId) to the final log payload.
export function resolveClarifierLog(action, variantId) {
  const def = CLARIFIERS[action.id];
  if (!def) return { note: action.defaultNote, tags: action.tags || [] };
  const v = def.variants.find(x => x.id === variantId) || def.variants[0];
  return { note: v.note, tags: v.tags };
}

export function ClarifierModal({ action, studentLabel, onPick, onCancel }) {
  useEscape(onCancel);
  const def = CLARIFIERS[action?.id];
  if (!def) return null;
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{def.title}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              for {studentLabel} · {action.label}
            </div>
          </div>
          <button className="close-btn" onClick={onCancel}>×</button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 4 }}>
            {def.subtitle}
          </div>
          {def.variants.map(v => (
            <button
              key={v.id}
              type="button"
              onClick={() => onPick(v.id)}
              className="btn btn-secondary"
              style={{
                minHeight: 44,
                justifyContent: 'flex-start',
                fontSize: 13, fontWeight: 600,
                textAlign: 'left',
                padding: '10px 14px',
              }}
            >
              {v.label}
            </button>
          ))}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onCancel} style={{ flex: 1 }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
