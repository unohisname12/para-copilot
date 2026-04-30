import { migrateIdentity } from '../../identity';

export function validatePrivateRoster(json) {
  if (!json || typeof json !== "object" || Array.isArray(json))
    return "That file doesn't look right.";

  // Combined export format (has privateRosterMap key)
  if (json.privateRosterMap) {
    const inner = json.privateRosterMap;
    if (!inner || typeof inner !== "object" || Array.isArray(inner))
      return "That file is missing its name list section.";
    if (!Array.isArray(inner.privateRosterMap))
      return "That file's name list isn't in the expected format.";
    if (!inner.privateRosterMap.some(e => e && e.realName && String(e.realName).trim()))
      return "No real student names were found in that file.";
    return null;
  }

  // Pure app bundle (no private roster data)
  if (json.normalizedStudents)
    return "This looks like a student file — upload it on the IEP Import page under 'Full student info (one file)'.";

  if (json.students && json.periods && !json.type)
    return "This looks like a school-style name list — upload it on the IEP Import page under 'School-style roster'.";

  // Official privateRoster artifact (schemaVersion 1.0 or 2.0)
  if (json.type !== "privateRoster")
    return "That doesn't look like a saved name list file.";
  if (!Array.isArray(json.students))
    return "That file is missing its student list.";
  if (!json.students.some(e => e && e.realName && String(e.realName).trim()))
    return "No real student names were found in that file.";
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
      const incomingParaAppNumber = e.paraAppNumber ?? e.externalKey ?? e.externalStudentKey ?? null;
      if (!byRealName.has(key)) {
        byRealName.set(key, {
          realName: key, pseudonym: e.pseudonym || "",
          color: colorByPseudonym[e.pseudonym] || "",
          periodIds: [], classLabels: {},
          ...(incomingParaAppNumber ? { paraAppNumber: String(incomingParaAppNumber) } : {}),
        });
      }
      const rec = byRealName.get(key);
      if (e.periodId && !rec.periodIds.includes(e.periodId)) {
        rec.periodIds.push(e.periodId);
        rec.classLabels[e.periodId] = e.classLabel || "";
      }
      if (!rec.paraAppNumber && incomingParaAppNumber) {
        rec.paraAppNumber = String(incomingParaAppNumber);
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
// Resolution strategy (Phase D — paraAppNumber-aware):
//   1. e.studentId — direct lookup, no fallback if stale (data integrity issue).
//   2. e.paraAppNumber — FERPA-safe stable bridge that survives pseudonym
//      regeneration on roster re-upload.
//   3. e.pseudonym — backward compat for pre-v3.0 artifacts.
export function buildRosterLookups(allStudents, identityRegistry) {
  const stuByPseudonym = {};
  const stuByParaAppNumber = {};
  Object.values(allStudents).forEach(s => {
    if (s.pseudonym) stuByPseudonym[s.pseudonym] = s;
    if (s.paraAppNumber) stuByParaAppNumber[String(s.paraAppNumber)] = s;
  });

  const nameById = {};
  const periodIdsById = {};
  identityRegistry.forEach(e => {
    let stu;
    if (e.studentId) {
      // studentId-first — direct lookup, no fallback if stale.
      stu = allStudents[e.studentId];
    } else if (e.paraAppNumber && stuByParaAppNumber[String(e.paraAppNumber)]) {
      stu = stuByParaAppNumber[String(e.paraAppNumber)];
    } else {
      stu = stuByPseudonym[e.pseudonym];
    }
    if (!stu) return;
    nameById[stu.id] = e.realName;
    periodIdsById[stu.id] = e.periodIds;
  });
  return { nameById, periodIdsById };
}

// ── resolveStudentByParaAppNumber ─────────────────────────────
// FERPA-safe stable bridge for the LOG layer. When a log's studentId is
// orphaned (e.g. after a roster re-import that regenerated stu_imp_/stu_gen_
// IDs), the paraAppNumber is the cross-device stable key that still points at
// the right kid. Returns the student object or null.
//
// Accepts numeric or string inputs — some import paths leave paraAppNumber as
// a number; coerce here so callers don't have to.
export function resolveStudentByParaAppNumber(allStudents, paraAppNumber) {
  if (paraAppNumber == null) return null;
  const key = String(paraAppNumber).trim();
  if (!key) return null;
  for (const s of Object.values(allStudents || {})) {
    if (s?.paraAppNumber != null && String(s.paraAppNumber).trim() === key) return s;
  }
  return null;
}
