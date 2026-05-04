// Idempotent re-link of orphaned log studentIds via the paraAppNumber bridge.
// Roster reloads mint new studentIds; old logs still point at old ids and
// fall out of byStudent filters and the workbook exporter. This rewrites
// only the logs whose paraAppNumber resolves to a different current id,
// returning the original array reference when nothing changes (so React
// effects don't ping-pong).
export function relinkLogsByParaAppNumber(logs, allStudents) {
  if (!Array.isArray(logs) || logs.length === 0) return logs || [];
  if (!allStudents) return logs;

  const byParaAppNumber = new Map();
  for (const s of Object.values(allStudents)) {
    if (s && s.paraAppNumber) byParaAppNumber.set(String(s.paraAppNumber), s.id);
  }
  if (byParaAppNumber.size === 0) return logs;

  let changed = false;
  const next = logs.map(l => {
    if (!l.paraAppNumber) return l;
    const currentId = byParaAppNumber.get(String(l.paraAppNumber));
    if (!currentId || currentId === l.studentId) return l;
    changed = true;
    return { ...l, studentId: currentId };
  });
  return changed ? next : logs;
}
