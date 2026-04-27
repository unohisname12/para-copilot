// ══════════════════════════════════════════════════════════════
// TRAINING-GAP PREDICATES — Pure pattern-matching functions
// Each predicate is a named, isolated function the rule descriptors
// in trainingGapRules.js reference by name.
// ══════════════════════════════════════════════════════════════

function withinWindow(log, windowDays) {
  const ageMs = Date.now() - new Date(log.timestamp).getTime();
  return ageMs <= windowDays * 86400000;
}

function hasAnyTag(log, tagList) {
  if (!Array.isArray(log.tags)) return false;
  return tagList.some(t => log.tags.includes(t));
}

// Fires when ≥ presenceMin logs match presenceTags AND ≤ counterMax logs
// match counterTags, both within the same window and student scope.
// Tag matching is OR — a log matches if it has ANY of the listed tags.
export function countWithoutCounter({
  logs,
  studentId,
  windowDays,
  presenceTags,
  presenceMin,
  counterTags,
  counterMax,
}) {
  const inScope = logs.filter(l => l.studentId === studentId && withinWindow(l, windowDays));
  const presenceLogs = inScope.filter(l => hasAnyTag(l, presenceTags));
  const counterLogs = inScope.filter(l => hasAnyTag(l, counterTags));
  const fired = presenceLogs.length >= presenceMin && counterLogs.length <= counterMax;
  return {
    fired,
    presenceCount: presenceLogs.length,
    counterCount: counterLogs.length,
    evidenceLogs: presenceLogs,
  };
}

// Registry — rules reference predicates by name string.
export const PREDICATES = {
  countWithoutCounter,
};
