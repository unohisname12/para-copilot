// Pure reducers for bulk delete + undo. Used by useLogs.bulkDeleteLogs
// and useLogs.restoreLogs. No React, no DOM, no async.
export function removeLogsByIds(logs, ids) {
  const set = ids instanceof Set ? ids : new Set(ids || []);
  if (set.size === 0) return logs;
  let removed = 0;
  const next = logs.filter(l => {
    if (set.has(l.id)) { removed++; return false; }
    return true;
  });
  return removed === 0 ? logs : next;
}

export function restoreLogsAtTop(logs, snapshot) {
  if (!snapshot || snapshot.length === 0) return logs;
  const present = new Set(logs.map(l => l.id));
  const fresh = snapshot.filter(l => !present.has(l.id));
  if (fresh.length === 0) return logs;
  return [...fresh, ...logs];
}
