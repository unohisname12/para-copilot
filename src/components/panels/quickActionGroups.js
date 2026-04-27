// Maps each QUICK_ACTION id to a para-friendly category section.
// Used by QuickActionPanel to render grouped headers + actions.
//
// Categories (always expanded; there are 5):
//   - Behavior support
//   - Academic support
//   - Regulation / sensory
//   - Transition
//   - Positive
//
// Each action lands in exactly one category. Adding a new action means
// adding it here too.

export const QA_CATEGORIES = [
  {
    id: 'behavior',
    label: 'Behavior support',
    color: 'var(--red)',
    actionIds: ['qa_redirect', 'qa_deescal', 'qa_break', 'qa_break_requested', 'qa_skill_taught'],
  },
  {
    id: 'academic',
    label: 'Academic support',
    color: 'var(--blue)',
    actionIds: ['qa_chunk', 'qa_tool', 'qa_verbal'],
  },
  {
    id: 'regulation',
    label: 'Regulation / sensory',
    color: 'var(--purple)',
    actionIds: ['qa_checkin', 'qa_headphones'],
  },
  {
    id: 'transition',
    label: 'Transition',
    color: 'var(--yellow)',
    actionIds: ['qa_trans_warn'],
  },
  {
    id: 'positive',
    label: 'Positive',
    color: 'var(--green)',
    actionIds: ['qa_positive'],
  },
];

// Returns categories with their resolved actions (skipping any action ids
// that aren't in the supplied actions array — e.g. if the data file
// changes). Actions not in any category land in an "Other" section so
// nothing is silently dropped.
export function buildQuickActionGroups(actions) {
  const byId = {};
  (actions || []).forEach(a => { byId[a.id] = a; });

  const used = new Set();
  const groups = QA_CATEGORIES.map(cat => ({
    id: cat.id,
    label: cat.label,
    color: cat.color,
    actions: cat.actionIds
      .map(id => { used.add(id); return byId[id]; })
      .filter(Boolean),
  })).filter(g => g.actions.length > 0);

  const leftover = (actions || []).filter(a => !used.has(a.id));
  if (leftover.length > 0) {
    groups.push({
      id: 'other',
      label: 'Other',
      color: 'var(--text-muted)',
      actions: leftover,
    });
  }
  return groups;
}
