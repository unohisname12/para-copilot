// Per-student "supports in place" fact base. The Coaching engine reads
// this BEFORE generating tip text so we stop suggesting "use a break
// card" when the kid doesn't have one.
//
// Lives on the student object as `student.supports`. All fields default
// to 'unknown' / [] so missing data behaves predictably (the rule engine
// asks the para to find out vs. asserting a fix).

export const BREAK_ACCESS_TYPES = [
  { id: 'unknown', label: 'Not sure yet', notes: 'Default — the app will ask the sped teacher to clarify.' },
  { id: 'card',    label: 'Break card', notes: 'Student has a physical card / picture they hand over to ask.' },
  { id: 'signal',  label: 'Hand signal / sign', notes: 'Student uses a gesture or sign-language sign to ask.' },
  { id: 'verbal',  label: 'Words', notes: 'Student verbally asks for the break.' },
  { id: 'informal',label: 'Informal', notes: 'No formal system; staff offers when judgment says so.' },
  { id: 'none',    label: 'None — not in plan', notes: 'No break system documented for this student.' },
];

export const TRINARY_OPTIONS = [
  { id: 'unknown', label: 'Not sure yet' },
  { id: 'yes',     label: 'Yes' },
  { id: 'no',      label: 'No' },
];

export const REINFORCEMENT_SYSTEMS = [
  { id: 'unknown',     label: 'Not sure yet' },
  { id: 'token',       label: 'Token economy / point sheet' },
  { id: 'first_then',  label: 'First/Then board' },
  { id: 'praise',      label: 'Verbal praise / behavior-specific praise' },
  { id: 'check_in',    label: 'Check-in / Check-out' },
  { id: 'none',        label: 'No formal system' },
];

export function defaultSupports() {
  return {
    breakAccess: { type: 'unknown', notes: '' },
    bipActive: 'unknown',
    replacementSkills: [], // [{ skill, goalId? }]
    reinforcementSystem: 'unknown',
  };
}

// Given a possibly-missing or partial supports object, fill in defaults.
// Used when reading supports from localStorage / older student records.
export function migrateSupports(s) {
  const d = defaultSupports();
  if (!s || typeof s !== 'object') return d;
  return {
    breakAccess: {
      type: s.breakAccess?.type || d.breakAccess.type,
      notes: typeof s.breakAccess?.notes === 'string' ? s.breakAccess.notes : '',
    },
    bipActive: s.bipActive || d.bipActive,
    replacementSkills: Array.isArray(s.replacementSkills) ? s.replacementSkills : [],
    reinforcementSystem: s.reinforcementSystem || d.reinforcementSystem,
  };
}

// Lookup helpers used by the tailoring layer.
export function breakAccessLabel(type) {
  return BREAK_ACCESS_TYPES.find(t => t.id === type)?.label || 'Not sure yet';
}
export function reinforcementLabel(id) {
  return REINFORCEMENT_SYSTEMS.find(s => s.id === id)?.label || 'Not sure yet';
}
