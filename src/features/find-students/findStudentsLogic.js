// Pure helpers for the Find My Students duplicate-scan flow. No React, no
// async, no DOM — every input is a plain JS object so the module is easy to
// unit-test and reuse from other surfaces (e.g., a CLI cleanup script).

const trim = (v) => (v == null ? '' : String(v).trim());

// Group `allStudents` (map keyed by student id) by paraAppNumber. Keyless
// rows go into a separate `unkeyed` list so the UI can flag them as
// "won't auto-dedupe". Returned `groups` only includes paraAppNumbers that
// have 2+ entries — ones with a single row are not duplicates.
export function groupByParaAppNumber(allStudents = {}) {
  const buckets = new Map();
  const unkeyed = [];
  Object.values(allStudents || {}).forEach((s) => {
    if (!s || !s.id) return;
    const key = trim(s.paraAppNumber || s.externalKey);
    if (!key) {
      unkeyed.push(s);
      return;
    }
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(s);
  });
  const groups = [];
  for (const [key, rows] of buckets.entries()) {
    if (rows.length >= 2) groups.push({ key, rows });
  }
  // Sort groups by descending row count so the messiest ones surface first.
  groups.sort((a, b) => b.rows.length - a.rows.length || a.key.localeCompare(b.key));
  return { groups, unkeyed };
}

// Pick the canonical (keep) row in a duplicate group. Heuristic order:
//   1. Most logs already attached (don't orphan history).
//   2. Most periods (cross-period rows hold more context).
//   3. Earliest createdAt (stable across reloads).
//   4. Lexicographic id as the final tiebreaker so the choice is
//      deterministic regardless of input order.
// `logCounts` is { [studentId]: number } from the caller.
export function chooseCanonical(rows = [], logCounts = {}) {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  if (rows.length === 1) return rows[0];

  const score = (s) => {
    const logs = logCounts[s.id] || 0;
    const periods = Array.isArray(s.periodIds) ? s.periodIds.length : (s.periodId ? 1 : 0);
    const created = s.createdAt ? Date.parse(s.createdAt) : Number.POSITIVE_INFINITY;
    return { logs, periods, created, id: s.id };
  };

  return [...rows].sort((a, b) => {
    const sa = score(a);
    const sb = score(b);
    if (sb.logs !== sa.logs) return sb.logs - sa.logs;
    if (sb.periods !== sa.periods) return sb.periods - sa.periods;
    if (sa.created !== sb.created) return sa.created - sb.created;
    return sa.id.localeCompare(sb.id);
  })[0];
}

// Add `ids` to a hidden-set (a Set) and return the new Set so the caller can
// persist + setState. Pure — never mutates the input.
export function addToHidden(hiddenSet, ids = []) {
  const next = new Set(hiddenSet || []);
  ids.forEach((id) => { if (id) next.add(id); });
  return next;
}

export function removeFromHidden(hiddenSet, ids = []) {
  const next = new Set(hiddenSet || []);
  ids.forEach((id) => next.delete(id));
  return next;
}

// Build the hide list for a duplicate group given a chosen canonical id.
// Returns the ids that should be hidden (everything except canonical).
export function buildHiddenSet(group, canonicalId) {
  if (!group || !Array.isArray(group.rows)) return [];
  return group.rows.filter((s) => s.id !== canonicalId).map((s) => s.id);
}

// Count how many duplicate clusters survive after applying a hidden set.
// Useful for the "scan summary" pill in the UI.
export function countRemainingDupes(groups = [], hiddenSet = new Set()) {
  let count = 0;
  for (const g of groups) {
    const visible = g.rows.filter((s) => !hiddenSet.has(s.id));
    if (visible.length >= 2) count += 1;
  }
  return count;
}
