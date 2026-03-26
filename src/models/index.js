// ══════════════════════════════════════════════════════════════
// MODELS — Schema-enforced data constructors
// Every log, student lookup, and health check goes through here
// ══════════════════════════════════════════════════════════════

// ── Pseudonym palette — 12 named colors for identity generation ──────────
export const PSEUDONYM_PALETTE = [
  { hex: "#ef4444", name: "Red" },
  { hex: "#f97316", name: "Orange" },
  { hex: "#eab308", name: "Yellow" },
  { hex: "#22c55e", name: "Green" },
  { hex: "#06b6d4", name: "Cyan" },
  { hex: "#3b82f6", name: "Blue" },
  { hex: "#8b5cf6", name: "Violet" },
  { hex: "#ec4899", name: "Pink" },
  { hex: "#f43f5e", name: "Rose" },
  { hex: "#14b8a6", name: "Teal" },
  { hex: "#a855f7", name: "Purple" },
  { hex: "#84cc16", name: "Lime" },
];

// Input: string[] of unique real names in desired assignment order
// Output: Map<realName, { pseudonym: string, color: string }>
// Cycles through palette; increments counter per color on wrap-around.
export function generatePseudonymSet(uniqueNames) {
  if (!Array.isArray(uniqueNames)) {
    throw new TypeError('generatePseudonymSet: uniqueNames must be an Array');
  }
  const colorCounts = {};
  const result = new Map();
  uniqueNames.forEach((realName, i) => {
    const { hex, name } = PSEUDONYM_PALETTE[i % PSEUDONYM_PALETTE.length];
    colorCounts[name] = (colorCounts[name] || 0) + 1;
    result.set(realName, { pseudonym: `${name} Student ${colorCounts[name]}`, color: hex });
  });
  return result;
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

  // One pseudonym+color per unique person
  const pseudonymMap = generatePseudonymSet([...byRealName.keys()]);

  let idCounter = 1;
  const coveredRawIds = new Set();

  byRealName.forEach((appearances, realName) => {
    const { pseudonym, color } = pseudonymMap.get(realName);
    const periodIds  = [...new Set(appearances.map(a => a.periodId).filter(Boolean))];
    const classLabels = {};
    appearances.forEach(a => { if (a.periodId) classLabels[a.periodId] = a.classLabel || ""; });

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
    const mergedAccs = [...new Set(raws.flatMap(r => r.accs || r.accommodations || []))];

    const primaryRaw    = raws[0] || {};
    const primaryEntry  = appearances[0];
    const studentId     = `stu_gen_${String(idCounter++).padStart(3, "0")}`;

    const profile = normalizeImportedStudent({
      ...primaryRaw,
      id:         studentId,
      pseudonym,
      color,
      goals:      mergedGoals.length ? mergedGoals : (primaryRaw.goals || []),
      accs:       mergedAccs.length  ? mergedAccs  : (primaryRaw.accs  || []),
      periodId:   primaryEntry?.periodId   || "",
      classLabel: primaryEntry?.classLabel || "",
    });

    importStudents[studentId] = profile;
    periodIds.forEach(pid => {
      if (!periodMap[pid]) periodMap[pid] = [];
      periodMap[pid].push(studentId);
    });
    registry.push({ realName, pseudonym, color, periodIds, classLabels });
  });

  // Include any normalizedStudents not in privateRosterMap (safe fallback)
  rawStudents.forEach(s => {
    if (coveredRawIds.has(s.id) || !s.id) return;
    const profile = normalizeImportedStudent(s);
    importStudents[profile.id] = profile;
    if (s.periodId) {
      if (!periodMap[s.periodId]) periodMap[s.periodId] = [];
      periodMap[s.periodId].push(profile.id);
    }
  });

  return { registry, importStudents, periodMap };
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

  return {
    id:           String(raw.id           || `stu_imp_${Date.now()}`),
    pseudonym:    String(raw.pseudonym    || "Unnamed Student"),
    color:        String(raw.color        || "#94a3b8"),
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
