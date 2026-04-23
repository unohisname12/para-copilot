// ══════════════════════════════════════════════════════════════
// MODELS — Schema-enforced data constructors
// Every log, student lookup, and health check goes through here
// ══════════════════════════════════════════════════════════════

import { generateIdentitySet, migrateIdentity, IDENTITY_PALETTE } from '../identity';

// ── Pseudonym palette — backward-compatible alias of IDENTITY_PALETTE ──────
export const PSEUDONYM_PALETTE = IDENTITY_PALETTE.map(({ hex, name }) => ({ hex, name }));

// Input: string[] of unique real names in desired assignment order
// Output: Map<realName, { pseudonym: string, color: string, identity?: object }>
// Backward-compatible: existing callers destructure { pseudonym, color } and ignore identity.
export function generatePseudonymSet(uniqueNames) {
  if (!Array.isArray(uniqueNames)) {
    throw new TypeError('generatePseudonymSet: uniqueNames must be an Array');
  }
  return generateIdentitySet(uniqueNames);
}

// ── Identity Registry Builder ─────────────────────────────────────────────
// Reads a combined bundle JSON, groups all privateRosterMap entries by realName,
// assigns one pseudonym+color per unique person, merges IEP data across periods.
//
// Returns:
//   registry:       [{ realName, pseudonym, color, periodIds[], classLabels{} }]
//   importStudents: { [id]: student }  — no realName field, safe for app state
//   periodMap:      { [periodId]: id[] }
export function buildIdentityRegistry(bundleData) {
  const prEntries    = bundleData?.privateRosterMap?.privateRosterMap || [];
  const rawStudents  = bundleData?.normalizedStudents?.students        || [];
  const registry     = [];
  const importStudents = {};
  const periodMap    = {};

  if (!prEntries.length) return { registry, importStudents, periodMap };

  // Build studentId → raw student lookup for IEP fields
  const rawById = {};
  rawStudents.forEach(s => { if (s.id) rawById[s.id] = s; });

  // Group privateRosterMap entries by realName to find unique people
  const byRealName = new Map();
  prEntries.forEach(entry => {
    const name = (entry.realName || "").trim();
    if (!name) return;
    if (!byRealName.has(name)) byRealName.set(name, []);
    byRealName.get(name).push(entry);
  });

  // One pseudonym+color per unique person. Prefer deterministic derivation
  // from Para App Number when available so every para on every device
  // produces the SAME pseudonym for the same kid.
  const pseudonymInput = [...byRealName.entries()].map(([name, appearances]) => {
    const paraAppNumber = appearances
      .map(a => (a.paraAppNumber || a.externalKey || a.externalStudentKey || '').toString().trim())
      .find(k => k) || null;
    const pseudonym = appearances.map(a => a.pseudonym).find(p => p) || null;
    return { name, paraAppNumber, pseudonym };
  });
  const pseudonymMap = generatePseudonymSet(pseudonymInput);

  let idCounter = 1;
  const coveredRawIds = new Set();

  byRealName.forEach((appearances, realName) => {
    const entry = pseudonymMap.get(realName);
    if (!entry) { console.error(`buildIdentityRegistry: no pseudonym generated for "${realName}" — skipping`); return; }
    const { pseudonym, color } = entry;
    const periodIds  = [...new Set(appearances.map(a => a.periodId).filter(Boolean))];
    const classLabels = {};
    appearances.forEach(a => { if (a.periodId) classLabels[a.periodId] = a.classLabel || ""; });

    // Para App Number: admin-assigned 6-digit stable student ID (e.g. "847293").
    // Same number on every para's device + on the cloud server. Real name never
    // rides with it to the server. Accept legacy field names for backward compat.
    const paraAppNumber = appearances
      .map(a => (a.paraAppNumber || a.externalKey || a.externalStudentKey || "").toString().trim())
      .find(k => k) || null;

    const raws = appearances.map(a => rawById[a.studentId]).filter(Boolean);
    raws.forEach(r => coveredRawIds.add(r.id));

    // Merge goals — deduplicate by text
    const seenGoalTexts = new Set();
    const mergedGoals = [];
    raws.forEach(r => {
      (r.goals || []).forEach(g => {
        const text = typeof g === "string" ? g : (g.text || "");
        if (text && !seenGoalTexts.has(text)) { seenGoalTexts.add(text); mergedGoals.push(g); }
      });
    });

    // Merge accs — union
    // r.accommodations: legacy field name used in older bundle schemas (pre-2.0)
    const mergedAccs = [...new Set(raws.flatMap(r => r.accs || r.accommodations || []))];

    const primaryRaw    = raws[0] || {};
    const primaryEntry  = appearances[0];
    const studentId     = `stu_gen_${String(idCounter++).padStart(3, "0")}`;

    const profile = migrateIdentity(normalizeImportedStudent({
      ...primaryRaw,
      id:         studentId,
      pseudonym,
      color,
      goals:      mergedGoals.length ? mergedGoals : (primaryRaw.goals || []),
      accs:       mergedAccs.length  ? mergedAccs  : (primaryRaw.accs  || []),
      periodId:   primaryEntry?.periodId   || "",
      classLabel: primaryEntry?.classLabel || "",
      // Para App Number: admin-assigned 6-digit stable ID. Cloud-safe.
      // Pseudonymous — does not identify the student without the local roster vault.
      paraAppNumber,
    }));

    importStudents[studentId] = profile;
    periodIds.forEach(pid => {
      if (!periodMap[pid]) periodMap[pid] = [];
      periodMap[pid].push(studentId);
    });
    registry.push({
      realName, pseudonym, color, periodIds, classLabels,
      identity: entry.identity,
      paraAppNumber,
    });
  });

  // Include any normalizedStudents not in privateRosterMap (safe fallback)
  rawStudents.forEach(s => {
    if (coveredRawIds.has(s.id) || !s.id) return;
    const profile = migrateIdentity(normalizeImportedStudent(s));
    importStudents[profile.id] = profile;
    if (s.periodId) {
      if (!periodMap[s.periodId]) periodMap[s.periodId] = [];
      periodMap[s.periodId].push(profile.id);
    }
  });

  return { registry, importStudents, periodMap };
}

// ── normalizeIdentityEntries ─────────────────────────────────
// Converts raw private-roster entries (any schema version) into the v3.0 registry
// shape: [{ realName, pseudonym, color, periodIds, classLabels, identity, studentId? }]
//   • identity  — added via migrateIdentity() (no-op if already present)
//   • studentId — resolved via studentId-first strategy:
//       1. Use entry.studentId directly when present (v3.0+ artifacts)
//       2. Fall back to pseudonym lookup for older artifacts without studentId
//     Absent if neither path resolves.
// Called by handleIdentityLoad in App.jsx; the single point of normalization.
export function normalizeIdentityEntries(rawEntries, allStudents = {}) {
  // Pseudonym-keyed lookup retained for backward compat with pre-v3.0 artifacts
  // that were exported before studentId was added to the private roster schema.
  const stuIdByPseudonym = {};
  Object.values(allStudents).forEach(s => {
    if (s.pseudonym) stuIdByPseudonym[s.pseudonym] = s.id;
  });

  return (rawEntries || [])
    .filter(e => e.realName && (e.pseudonym || e.displayLabel))
    .map(e => {
      const pseudonym = e.pseudonym || e.displayLabel || "";
      // Preserve paraAppNumber (and legacy externalKey variants) so the
      // real-name vault can key on it. Without this, the vault never learns
      // about any student and the "Show real names" toggle has nothing to do.
      const paraAppNumber = e.paraAppNumber
        ?? e.externalKey
        ?? e.externalStudentKey
        ?? null;
      const base = {
        realName:    e.realName,
        pseudonym,
        color:       e.color       || "",
        periodIds:   e.periodIds   || [],
        classLabels: e.classLabels || {},
        // carry through identity if already present so migrateIdentity is a no-op
        ...(e.identity ? { identity: e.identity } : {}),
        ...(paraAppNumber ? { paraAppNumber } : {}),
      };
      const withIdentity = migrateIdentity(base);
      // Phase C: prefer entry.studentId (stable, collision-safe).
      // Fall back to pseudonym lookup only for older artifacts that lack studentId.
      const studentId = e.studentId || stuIdByPseudonym[pseudonym];
      return studentId ? { ...withIdentity, studentId } : withIdentity;
    });
}

// ── Enriched Log Factory ─────────────────────────────────────
// Every log entry gets full context — ready for analytics, AI, MCP
let _logCounter = 0;

export function createLog({
  studentId,
  type,
  note,
  date,
  period,
  periodId,
  flagged = false,
  // NEW enriched fields
  category = null,      // "academic", "behavior", "regulation", "positive", "admin"
  tags = [],            // searchable tags
  situationId = null,   // which situation triggered this
  strategyUsed = null,  // which strategy was applied
  goalId = null,        // linked IEP goal
  source = "manual",    // "manual", "quick_action", "engine", "ai"
}) {
  _logCounter++;

  // Auto-detect category from type if not provided
  const autoCategory = category || detectCategory(type);

  // Auto-generate tags from type and note
  const autoTags = tags.length > 0 ? tags : generateTags(type, note);

  return {
    id: `log_${Date.now()}_${_logCounter}`,
    studentId,
    type,
    category: autoCategory,
    note,
    tags: autoTags,
    date,
    period,
    periodId,
    timestamp: new Date().toISOString(),
    flagged: flagged || (type === "Handoff Note" && note.includes("URGENT")),
    situationId,
    strategyUsed,
    goalId,
    source,
  };
}

function detectCategory(type) {
  const map = {
    "Academic Support": "academic",
    "Accommodation Used": "academic",
    "Behavior Note": "behavior",
    "Positive Note": "positive",
    "General Observation": "general",
    "Goal Progress": "academic",
    "Handoff Note": "admin",
    "Class Note": "admin",
    "Parent Contact": "admin",
  };
  return map[type] || "general";
}

function generateTags(type, note) {
  const tags = [];
  const n = (note || "").toLowerCase();

  if (type === "Positive Note") tags.push("positive");
  if (type === "Behavior Note") tags.push("behavior");
  if (type === "Goal Progress") tags.push("goal");
  if (type === "Handoff Note") tags.push("handoff");
  if (type === "Accommodation Used") tags.push("accommodation");

  // Auto-tag from note content
  if (/break|pass/i.test(n)) tags.push("break");
  if (/chunk/i.test(n)) tags.push("chunking");
  if (/escal|de-esc/i.test(n)) tags.push("escalation");
  if (/transition|warning/i.test(n)) tags.push("transition");
  if (/calculator|chart|tool/i.test(n)) tags.push("tool");

  return tags;
}

// ── Student Health (data freshness) ──────────────────────────
export function getHealth(studentId, logs, currentDate) {
  const today = new Date(currentDate + "T12:00:00");
  const sl = logs.filter(l => l.studentId === studentId);
  if (!sl.length) return "red";
  // Find most recent log date
  const mostRecent = sl.reduce((latest, l) => {
    const d = new Date(l.date + "T12:00:00");
    return d > latest ? d : latest;
  }, new Date(sl[0].date + "T12:00:00"));
  const days = Math.floor((today - mostRecent) / 86400000);
  return days === 0 ? "green" : days <= 3 ? "yellow" : "red";
}

export const hdot = h => h === "green" ? "🟢" : h === "yellow" ? "🟡" : "🔴";

// ── Student Model Helper ─────────────────────────────────────
export function createStudent(data) {
  return {
    id: data.id || `stu_${Date.now()}`,
    pseudonym: data.pseudonym || "Unnamed Student",
    color: data.color || "#94a3b8",
    eligibility: data.eligibility || "",
    accs: data.accs || [],
    caseManager: data.caseManager || "",
    goalArea: data.goalArea || "",
    goals: (data.goals || []).map(g => typeof g === "string"
      ? { id: `goal_auto_${Date.now()}`, text: g, area: "General", subject: "All", baselineToTarget: "", yourRole: "" }
      : { baselineToTarget: "", yourRole: "", ...g }),
    behaviorNotes: data.behaviorNotes || "",
    strengths: data.strengths || "",
    triggers: data.triggers || "",
    strategies: data.strategies || [],
    tags: data.tags || [],
    // v2 extended fields — safe empty defaults for v1 students
    healthNotes:    data.healthNotes    || [],
    alertText:      data.alertText      || null,
    watchFors:      data.watchFors      || [],
    doThisActions:  data.doThisActions  || [],
    flags: data.flags || { alert: false, iepNotYetOnFile: false, profileMissing: false, crossPeriod: false },
    crossPeriodInfo: data.crossPeriodInfo || { note: null, otherPeriods: [] },
    sourceMeta: data.sourceMeta || { importType: "manual", schemaVersion: "1.0" },
  };
}

// ── Bundle Import Normalizer ─────────────────────────────────
// Converts a raw student object from a v2 JSON bundle into a
// fully-typed AppStudent. NEVER call with real-name data.
function _toArr(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v.filter(x => x != null);
  if (typeof v === "string") return v.trim() ? [v] : [];
  return [];
}

export function normalizeImportedStudent(raw) {
  const goals = (raw.goals || []).map((g, i) => {
    if (typeof g === "string") {
      return { id: `goal_${i}`, area: "General", text: g, subject: "", baselineToTarget: "", yourRole: "" };
    }
    return {
      id:              g.id              || `goal_${i}`,
      area:            g.area            || "General",
      text:            g.text            || "",
      subject:         g.subject         || "",
      baselineToTarget: g.baselineToTarget || "",
      yourRole:        g.yourRole        || "",
    };
  });

  // Para App Number — admin-assigned stable ID. Accept any historical field name.
  // null (not "") so downstream logic can distinguish "not provided" from empty.
  const paraAppNumberRaw = raw.paraAppNumber
    ?? raw.externalKey
    ?? raw.external_key
    ?? raw.externalStudentKey
    ?? null;
  const paraAppNumber = paraAppNumberRaw != null ? String(paraAppNumberRaw).trim() || null : null;

  return {
    id:           String(raw.id           || `stu_imp_${Date.now()}`),
    pseudonym:    String(raw.pseudonym    || "Unnamed Student"),
    color:        String(raw.color        || "#94a3b8"),
    paraAppNumber,
    periodId:     String(raw.periodId     || ""),
    periodNumber: Number(raw.periodNumber)  || 0,
    classLabel:   String(raw.classLabel   || ""),
    subject:      String(raw.subject      || ""),
    teacherName:  String(raw.teacherName  || ""),
    gradeLevel:   String(raw.gradeLevel   || ""),
    caseManager:  String(raw.caseManager  || ""),
    eligibility:  String(raw.eligibility  || "Not specified"),
    goalArea:     String(raw.goalArea     || goals.map(g => g.area).filter((v, i, a) => a.indexOf(v) === i).join(", ") || ""),
    accs:         _toArr(raw.accs || raw.accommodations),
    goals,
    behaviorNotes:  _toArr(raw.behaviorNotes),
    strengths:      _toArr(raw.strengths),
    healthNotes:    _toArr(raw.healthNotes),
    triggers:       _toArr(raw.triggers),
    strategies:     _toArr(raw.strategies),
    watchFors:      _toArr(raw.watchFors),
    doThisActions:  _toArr(raw.doThisActions),
    flags: {
      alert:            Boolean(raw.flags?.alert),
      iepNotYetOnFile:  Boolean(raw.flags?.iepNotYetOnFile),
      profileMissing:   Boolean(raw.flags?.profileMissing),
      crossPeriod:      Boolean(raw.flags?.crossPeriod),
    },
    crossPeriodInfo: {
      note:         raw.crossPeriodInfo?.note || null,
      otherPeriods: Array.isArray(raw.crossPeriodInfo?.otherPeriods) ? raw.crossPeriodInfo.otherPeriods : [],
    },
    alertText:  raw.alertText  || null,
    tags:       _toArr(raw.tags),
    sourceMeta: {
      importType:    String(raw.sourceMeta?.importType    || "bundle_import"),
      schemaVersion: String(raw.sourceMeta?.schemaVersion || "2.0"),
    },
    imported:   true,
    importedAt: raw.importedAt || new Date().toISOString(),
  };
}

// ── Master Roster Identity Registry Builder ──────────────────────────────────
// Reads a Master Roster JSON (students + periods), assigns pseudonyms, and
// returns the same shape as buildIdentityRegistry:
//   registry:       [{ realName, pseudonym, color, periodIds[], classLabels{} }]
//   importStudents: { [id]: student }  — no realName/fullName, FERPA-safe
//   periodMap:      { [periodId]: id[] }
export function buildIdentityRegistryFromMasterRoster(masterRosterData) {
  const students = masterRosterData?.students;
  const periods  = masterRosterData?.periods;

  const emptyResult = { registry: [], importStudents: {}, periodMap: {} };
  if (!Array.isArray(students) || !Array.isArray(periods)) return emptyResult;

  // Build periodLabelMap: { [id]: label }
  const periodLabelMap = {};
  periods.forEach(p => { if (p.id) periodLabelMap[p.id] = p.label || p.id; });

  // Sort students by id alphabetically (locale-independent)
  const sortedStudents = [...students].sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  );

  // Duplicate fullName guard — build deduped name map iterating sorted order
  const nameCounts = {};
  sortedStudents.forEach(s => {
    const name = s.fullName || "";
    nameCounts[name] = (nameCounts[name] || 0) + 1;
  });

  const dedupedNameMap = new Map(); // student.id -> dedupedName

  sortedStudents.forEach(s => {
    const name = s.fullName || "";
    if (nameCounts[name] > 1) {
      // Append last 4 chars of id, padded to 4 with leading underscores
      const rawSuffix = String(s.id || "");
      const suffix = rawSuffix.slice(-4).padStart(4, "_");
      dedupedNameMap.set(s.id, `${name}_${suffix}`);
    } else {
      dedupedNameMap.set(s.id, name);
    }
  });

  // Generate pseudonym set using deduped names in sorted order.
  // Prefer deterministic derivation from Para App Number when present.
  // NOTE: do NOT forward raw s.pseudonym — in the Master Roster format it
  // carries the fake name ("Jordan Smith"), not a color-label like
  // "Red Student 1". Using it as an override would collapse every student
  // to palette[0] (Red) since no fake name matches a palette color prefix.
  const pseudonymInput = sortedStudents.map(s => ({
    name: dedupedNameMap.get(s.id) || s.fullName || '',
    paraAppNumber: s.paraAppNumber || s.externalKey || s.externalStudentKey || null,
  }));
  const pseudonymMap = generatePseudonymSet(pseudonymInput);

  const registry       = [];
  const importStudents = {};
  const periodMap      = {};

  sortedStudents.forEach(student => {
    const fullName = (student.fullName || "").trim();
    if (!fullName) return; // skip students with no real name — matches buildIdentityRegistry behavior

    const dedupedName = dedupedNameMap.get(student.id) || fullName;
    const entry = pseudonymMap.get(dedupedName);
    if (!entry) {
      console.error(`buildIdentityRegistryFromMasterRoster: no pseudonym generated for id "${student.id}" — skipping`);
      return;
    }
    const { pseudonym, color } = entry;

    // Resolve periodIds: prefer student.periodIds, fallback to scanning periods[]
    const periodIds = Array.isArray(student.periodIds) && student.periodIds.length > 0
      ? student.periodIds
      : periods.filter(p => Array.isArray(p.studentIds) && p.studentIds.includes(student.id)).map(p => p.id);

    const classLabels = Object.fromEntries(
      periodIds.map(pid => [pid, periodLabelMap[pid] || pid])
    );

    const primaryPeriod = periodIds[0] || "";

    let studentId = `stu_mr_${String(student.id).replace(/[^a-z0-9]/gi, "_").toLowerCase().slice(0, 20)}`;
    // Guard against truncation collisions
    if (importStudents[studentId]) {
      let suffix = 2;
      while (importStudents[`${studentId}_${suffix}`]) suffix++;
      studentId = `${studentId}_${suffix}`;
    }

    // Preserve IEP fields from the raw student entry when present. Legacy
    // master-roster files were name-only; newer exports embed IEPs. Keeping
    // them avoids a secondary import step. firstName/lastName/fullName/
    // displayName are stripped by normalizeImportedStudent (FERPA — never
    // ride onto the student object).
    const hasIepData = Boolean(
      student.eligibility || (student.goals && student.goals.length) ||
      (student.accs && student.accs.length) || student.caseManager
    );
    const paraAppNumber = student.paraAppNumber
      ?? student.externalKey
      ?? student.externalStudentKey
      ?? null;

    const normalized = migrateIdentity(normalizeImportedStudent({
      id:         studentId,
      pseudonym,
      color,
      periodId:   primaryPeriod,
      classLabel: periodLabelMap[primaryPeriod] || "",
      // Carry through IEP data if embedded
      eligibility:      student.eligibility,
      caseManager:      student.caseManager,
      gradeLevel:       student.grade || student.gradeLevel,
      goals:            student.goals,
      accs:             student.accs,
      behaviorNotes:    student.behaviorNotes,
      strengths:        student.strengths,
      healthNotes:      student.healthNotes,
      triggers:         student.triggers,
      strategies:       student.strategies,
      watchFors:        student.watchFors,
      doThisActions:    student.doThisActions,
      tags:             student.tags,
      flags:            hasIepData ? (student.flags || {}) : { profileMissing: true },
      paraAppNumber,
      sourceMeta: { importType: "master_roster", schemaVersion: "1.0" },
    }));

    importStudents[studentId] = normalized;

    periodIds.forEach(pid => {
      if (!periodMap[pid]) periodMap[pid] = [];
      periodMap[pid].push(studentId);
    });

    registry.push({
      realName: fullName,
      ...(student.displayName ? { displayName: student.displayName } : {}),
      pseudonym,
      color,
      periodIds,
      classLabels,
      identity: entry.identity,
      paraAppNumber,
    });
  });

  return { registry, importStudents, periodMap };
}

// ── Student ID Validation ────────────────────────────────────
// All student IDs must start with "stu_". Prefixes:
//   stu_001–stu_009  Demo students (constants in data.js)
//   stu_imp_*        Imported via IEPImport single-student flow
//   stu_gen_*        Generated by buildIdentityRegistry (bundle import)
//   stu_mr_*         Generated by buildIdentityRegistryFromMasterRoster
//   stu_ext_*        Future: teacher-supplied external key
export function validateStudentId(id) {
  return typeof id === 'string' && id.startsWith('stu_') && id.length >= 5;
}

// ── Case Memory Factories ────────────────────────────────────
let _incCounter = 0;
export function createIncident({
  studentId, description, date, periodId,
  category = null, tags = [], situationId = null,
  antecedent = "", setting = "other", source = "manual",
}) {
  _incCounter++;
  return {
    id: `inc_${Date.now()}_${_incCounter}`,
    studentId,
    date,
    periodId,
    timestamp: new Date().toISOString(),
    description,
    category: category || detectCategory(description),
    tags: tags.length > 0 ? tags : generateTags("Incident", description),
    situationId: situationId || null,
    antecedent,
    setting,
    logIds: [],
    interventionIds: [],
    relatedIncidentIds: [],
    status: "open",
    resolvedAt: null,
    source,
  };
}

let _intvCounter = 0;
export function createIntervention({
  incidentId, studentId,
  strategyId = null, strategyLabel = "", accommodationUsed = [],
  supportCardId = null, staffNote = "", source = "manual",
}) {
  _intvCounter++;
  return {
    id: `intv_${Date.now()}_${_intvCounter}`,
    incidentId,
    studentId,
    timestamp: new Date().toISOString(),
    strategyId: strategyId || null,
    strategyLabel,
    accommodationUsed,
    supportCardId: supportCardId || null,
    staffNote,
    source,
  };
}

let _outCounter = 0;
export function createOutcome({
  interventionId, incidentId, studentId,
  result, timeToResolve = null, studentResponse = "",
  wouldRepeat = null, note = "",
}) {
  _outCounter++;
  return {
    id: `out_${Date.now()}_${_outCounter}`,
    interventionId,
    incidentId,
    studentId,
    timestamp: new Date().toISOString(),
    result,
    timeToResolve,
    studentResponse,
    wouldRepeat,
    note,
  };
}

// ── Log query helpers (MCP-ready) ────────────────────────────
export function getRecentStudentLogs(logs, studentId, limit = 10) {
  return logs.filter(l => l.studentId === studentId).slice(0, limit);
}

export function getLogsByDateRange(logs, startDate, endDate) {
  return logs.filter(l => {
    const d = new Date(l.date + "T12:00:00");
    return d >= startDate && d <= endDate;
  });
}

export function getLogsByType(logs, type) {
  return logs.filter(l => l.type === type);
}

export function getLogsByCategory(logs, category) {
  return logs.filter(l => l.category === category);
}
