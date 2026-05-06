// Quick note starters for Simple Mode focus area.
// Each template gives the para a sentence-stem they can finish in 5 seconds
// while still managing student behavior. Order matches the Simple Mode UX
// spec: redirect / accommodation / success / escalation / wraparound.
//
// `id` is stable so tests + analytics can reference it.
// `label` is the chip text the para sees.
// `text` is the literal string inserted into the textarea (with a trailing
// space so the para starts typing without a manual gap).

export const NOTE_TEMPLATES = [
  { id: 'redirect',      label: 'Needed redirection',  text: 'Needed redirection during ' },
  { id: 'accommodation', label: 'Used accommodation',  text: 'Used accommodation: ' },
  { id: 'positive',      label: 'Responded well',      text: 'Responded well to ' },
  { id: 'escalation',    label: 'Escalated when…',     text: 'Escalated when ' },
  { id: 'success',       label: 'Successful support',  text: 'Successful support was ' },
];

// Insert (or append) a template's `text` into a draft string. Adds a leading
// newline if the draft already has content so back-to-back templates don't
// run together. Pure function — easy to unit-test.
export function insertTemplate(draft, templateId) {
  const tpl = NOTE_TEMPLATES.find(t => t.id === templateId);
  if (!tpl) return draft;
  const current = draft || '';
  if (!current.trim()) return tpl.text;
  const sep = current.endsWith('\n') ? '' : '\n';
  return current + sep + tpl.text;
}
