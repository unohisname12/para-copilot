// ══════════════════════════════════════════════════════════════
// MODELS — Schema-enforced data constructors
// Every log, student lookup, and health check goes through here
// ══════════════════════════════════════════════════════════════

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
    goals: (data.goals || []).map(g => typeof g === "string" ? { id: `goal_auto_${Date.now()}`, text: g, area: "General", subject: "All" } : g),
    behaviorNotes: data.behaviorNotes || "",
    strengths: data.strengths || "",
    triggers: data.triggers || "",
    strategies: data.strategies || [],
    tags: data.tags || [],
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
