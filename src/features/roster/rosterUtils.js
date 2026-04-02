import { migrateIdentity } from '../../identity';

export function validatePrivateRoster(json) {
  if (!json || typeof json !== "object" || Array.isArray(json))
    return "Not a valid JSON object.";

  // Combined export format (has privateRosterMap key)
  if (json.privateRosterMap) {
    const inner = json.privateRosterMap;
    if (!inner || typeof inner !== "object" || Array.isArray(inner))
      return 'Malformed file: "privateRosterMap" must be an object.';
    if (!Array.isArray(inner.privateRosterMap))
      return 'Malformed file: expected "privateRosterMap.privateRosterMap" to be an array.';
    if (!inner.privateRosterMap.some(e => e && e.realName && String(e.realName).trim()))
      return "No real student names found in this file.";
    return null;
  }

  // Pure app bundle (no private roster data)
  if (json.normalizedStudents)
    return "This looks like an App Bundle file — upload it in IEP Import → App Bundle JSON tab, not here.";

  if (json.students && json.periods && !json.type)
    return "This looks like a Master Roster file — upload it in IEP Import → Master Roster JSON tab.";

  // Official privateRoster artifact (schemaVersion 1.0 or 2.0)
  if (json.type !== "privateRoster")
    return json.type
      ? `Wrong file type: "${json.type}". Expected a Private Roster file.`
      : 'Missing type field. Expected { "type": "privateRoster", ... }';
  if (!Array.isArray(json.students))
    return 'Missing "students" array in file.';
  if (!json.students.some(e => e && e.realName && String(e.realName).trim()))
    return "No real student names found in this file.";
  return null;
}

// Normalizes any supported format into [{ realName, pseudonym, color, periodIds, classLabels, identity }]
// so handleIdentityLoad in App.jsx always receives the same v3.0 shape.
export function extractIdentityEntries(json, allStudents = {}) {
  let raw;

  // Combined export — group by realName to build entries
  if (json.privateRosterMap) {
    const colorByPseudonym = {};
    Object.values(allStudents).forEach(s => {
      if (s.pseudonym) colorByPseudonym[s.pseudonym] = s.color || "";
    });
    const byRealName = new Map();
    json.privateRosterMap.privateRosterMap.forEach(e => {
      if (!e.realName) return;
      const key = e.realName.trim();
      if (!byRealName.has(key)) {
        byRealName.set(key, {
          realName: key, pseudonym: e.pseudonym || "",
          color: colorByPseudonym[e.pseudonym] || "",
          periodIds: [], classLabels: {},
        });
      }
      const rec = byRealName.get(key);
      if (e.periodId && !rec.periodIds.includes(e.periodId)) {
        rec.periodIds.push(e.periodId);
        rec.classLabels[e.periodId] = e.classLabel || "";
      }
    });
    raw = [...byRealName.values()];
  } else if (json.students?.[0]?.periodIds !== undefined) {
    // v2.0/v3.0 official artifact — already the right shape
    raw = json.students.filter(e => e && e.realName);
  } else {
    // v1.0 official artifact [{ displayLabel, realName, color }] — promote to v2.0 shape
    raw = (json.students || [])
      .filter(e => e && e.realName)
      .map(e => ({ realName: e.realName, pseudonym: e.displayLabel || "", color: e.color || "", periodIds: [], classLabels: {} }));
  }

  return raw.map(e => migrateIdentity(e));
}

// ── partitionByResolved ───────────────────────────────────────
// Splits studentIds into resolved (real name loaded) / unresolved buckets.
export function partitionByResolved(studentIds, nameById) {
  const resolved = [];
  const unresolved = [];
  studentIds.forEach(id => {
    if (nameById[id]) resolved.push(id);
    else unresolved.push(id);
  });
  return { resolved, unresolved };
}

// ── buildRosterLookups ────────────────────────────────────────
// Resolves registry entries to studentIds ONCE and returns stable id-keyed maps.
// All downstream display code uses studentId keys instead of pseudonym strings.
//
// Resolution strategy (Phase C):
//   1. Prefer e.studentId directly (v3.0+ artifacts — stable, collision-safe)
//   2. Fall back to pseudonym lookup for older artifacts without studentId
//   3. If e.studentId is present but not found in allStudents — skip safely;
//      a stale/wrong id is a data problem, not a missing-id problem.
export function buildRosterLookups(allStudents, identityRegistry) {
  // Pseudonym-keyed lookup retained for backward compat with pre-v3.0 artifacts
  // that were exported before studentId was added to the private roster schema.
  const stuByPseudonym = {};
  Object.values(allStudents).forEach(s => {
    if (s.pseudonym) stuByPseudonym[s.pseudonym] = s;
  });

  const nameById = {};
  const periodIdsById = {};
  identityRegistry.forEach(e => {
    let stu;
    if (e.studentId) {
      // Phase C: studentId-first — direct lookup, no pseudonym needed.
      // If the id is present but stale (not in allStudents), skip — do not fall
      // back to pseudonym, as that could silently join to the wrong student.
      stu = allStudents[e.studentId];
    } else {
      // Fallback for pre-v3.0 artifacts that carry no studentId field.
      stu = stuByPseudonym[e.pseudonym];
    }
    if (!stu) return;
    nameById[stu.id] = e.realName;
    periodIdsById[stu.id] = e.periodIds;
  });
  return { nameById, periodIdsById };
}
