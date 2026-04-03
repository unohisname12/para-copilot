// ══════════════════════════════════════════════════════════════
// CONTEXT-PACK — Assembles all relevant data for Ollama calls
// Pure functions — no network, no side effects, fully testable
// ══════════════════════════════════════════════════════════════

import { DB } from '../data';
import { parseDocForPeriod } from '../engine';
import { resolveLabel } from '../privacy/nameResolver';

// ── Build a context pack from App state ──────────────────────
export function buildContextPack({
  studentIds,
  allStudents,
  logs,
  activePeriod,
  docContent,
  currentDate,
  focusStudentId = null,
  logDaysBack = 14,
  detectedSituations = [],
  handoffAudience = "next_para",
  handoffUrgency = "normal",
}) {
  const period = DB.periods[activePeriod] || {};

  // Determine which students to include
  const targetIds = focusStudentId ? [focusStudentId] : studentIds;
  const students = targetIds
    .map(id => allStudents[id])
    .filter(Boolean);

  // Filter logs by date range
  const cutoff = new Date(currentDate + "T00:00:00");
  cutoff.setDate(cutoff.getDate() - logDaysBack);
  const filteredLogs = logs
    .filter(l => targetIds.includes(l.studentId))
    .filter(l => new Date(l.date + "T00:00:00") >= cutoff)
    .slice(0, 25) // hard cap — keep tokens under budget
    .map(l => ({
      date: l.date,
      type: l.type,
      category: l.category || "",
      note: (l.note || l.text || "").slice(0, 200),
      tags: l.tags || [],
      flagged: l.flagged || false,
      studentPseudonym: resolveLabel(allStudents[l.studentId]) || l.studentId,
    }));

  const docSnippet = docContent
    ? parseDocForPeriod(docContent, period.label || "")
    : null;

  return {
    period: {
      id: activePeriod,
      label: period.label || activePeriod,
      teacher: period.teacher || "",
      subject: period.subject || "",
    },
    students,
    logs: filteredLogs,
    docSnippet,
    currentDate,
    detectedSituations,
    handoffAudience,
    handoffUrgency,
  };
}

// ══════════════════════════════════════════════════════════════
// SERIALIZERS — Turn a context pack into a prompt string
// ══════════════════════════════════════════════════════════════

// Handles both v1 string fields and v2 array fields safely
function _fieldText(v) {
  if (!v) return "";
  if (Array.isArray(v)) return v.filter(Boolean).join("; ");
  return String(v);
}
function _hasContent(v) {
  if (!v) return false;
  if (Array.isArray(v)) return v.length > 0;
  return String(v).trim().length > 0;
}

function serializeStudent(s) {
  const goals = (s.goals || []).map(g => typeof g === "string" ? g : g.text).filter(Boolean);
  const goalLines = goals.map((g, i) => {
    const gObj = (s.goals || [])[i];
    const role = (typeof gObj === "object" && gObj?.yourRole) ? ` (Role: ${gObj.yourRole})` : "";
    return `  - ${g}${role}`;
  });

  return [
    s.alertText        ? `⚠ ALERT: ${s.alertText}` : null,
    `STUDENT: ${resolveLabel(s)}`,
    `Eligibility: ${s.eligibility || "Not specified"}`,
    `Accommodations: ${(s.accs || []).join(", ") || "None listed"}`,
    goals.length       ? `Goals:\n${goalLines.join("\n")}` : "Goals: None listed",
    _hasContent(s.strengths)      ? `Strengths: ${_fieldText(s.strengths)}` : null,
    _hasContent(s.triggers)       ? `Known Triggers: ${_fieldText(s.triggers)}` : null,
    _hasContent(s.strategies)     ? `Strategies: ${_fieldText(s.strategies)}` : null,
    // v2 fields
    _hasContent(s.watchFors)      ? `Watch For: ${_fieldText(s.watchFors)}` : null,
    _hasContent(s.doThisActions)  ? `Do This: ${_fieldText(s.doThisActions)}` : null,
    _hasContent(s.healthNotes)    ? `Health Notes: ${_fieldText(s.healthNotes)}` : null,
  ].filter(Boolean).join("\n");
}

function serializeLogs(logs, label = "") {
  if (!logs.length) return `${label}No logs in this date range.`;
  const lines = logs.map(l =>
    `  ${l.date} | ${l.type}${l.flagged ? " [FLAGGED]" : ""} | ${l.studentPseudonym} | ${l.note}`
  );
  return `${label}\n${lines.join("\n")}`;
}

// ── General "Ask AI" serializer — used by Para Copilot chat ──
export function serializeForAI(pack, query, kbDocs = "") {
  const studentBlock = pack.students.map(serializeStudent).join("\n\n");
  const logBlock = serializeLogs(pack.logs, "RECENT LOGS:");
  const docBlock = pack.docSnippet ? `\nCLASS NOTES:\n${pack.docSnippet.slice(0, 400)}` : "";
  const kbBlock = kbDocs ? `\nKNOWLEDGE BASE:\n${kbDocs}` : "";
  return [
    `PERIOD: ${pack.period.label} | Teacher: ${pack.period.teacher} | Date: ${pack.currentDate}`,
    "",
    "STUDENT IEP PROFILES:",
    studentBlock,
    "",
    logBlock,
    docBlock,
    kbBlock,
    "",
    `SITUATION: "${query}"`,
    "",
    "Give 2-4 specific, immediately actionable strategies for this situation.",
  ].join("\n");
}

// ── Pattern summary serializer ────────────────────────────────
export function serializeForPatternPrompt(pack) {
  const studentBlock = pack.students.map(serializeStudent).join("\n\n");
  const logBlock = serializeLogs(pack.logs, `LOGS (last ${Math.round((new Date(pack.currentDate) - new Date(new Date(pack.currentDate).setDate(new Date(pack.currentDate).getDate() - 14))) / 86400000)} days):`);
  return [
    `DATE: ${pack.currentDate} | PERIOD: ${pack.period.label}`,
    "",
    studentBlock,
    "",
    logBlock,
    "",
    "Summarize the behavioral and academic patterns. What is working, what needs attention, and one IEP-aligned next step.",
  ].join("\n");
}

// ── Handoff note serializer ───────────────────────────────────
export function serializeForHandoffPrompt(pack) {
  const { handoffAudience, handoffUrgency } = pack;
  const studentBlock = pack.students.map(serializeStudent).join("\n\n");
  const logBlock = serializeLogs(pack.logs, "TODAY'S LOGS:");
  return [
    `HANDOFF FOR: ${handoffAudience} | URGENCY: ${handoffUrgency} | DATE: ${pack.currentDate}`,
    `PERIOD: ${pack.period.label} | Teacher: ${pack.period.teacher}`,
    "",
    studentBlock,
    "",
    logBlock,
    "",
    `Write a handoff note for ${handoffAudience}.${handoffUrgency === "urgent" ? " This is URGENT — start with URGENT:" : ""}`,
  ].join("\n");
}

// ── Teaching suggestions serializer ──────────────────────────
export function serializeForSuggestionsPrompt(pack) {
  const situations = pack.detectedSituations
    .map(s => `${s.title} (matched: ${s.matchedTriggers?.join(", ") || "—"})`)
    .join(", ");
  const studentBlock = pack.students.map(serializeStudent).join("\n\n");
  const logBlock = serializeLogs(
    pack.logs.filter(l => l.category === "behavior" || l.category === "regulation"),
    "RECENT BEHAVIOR/REGULATION LOGS:"
  );
  return [
    `DATE: ${pack.currentDate} | PERIOD: ${pack.period.label} | Subject: ${pack.period.subject}`,
    `DETECTED SITUATION(S): ${situations || "General classroom support"}`,
    "",
    "STUDENT IEP PROFILES:",
    studentBlock,
    "",
    logBlock,
    "",
    "Give 3-5 specific support moves for this moment.",
  ].join("\n");
}

// ── Email draft serializer ────────────────────────────────────
export function serializeForEmailPrompt(student, logs) {
  const goals = (student.goals || []).map(g => typeof g === "string" ? g : g.text).join(" | ");
  const logText = logs.length
    ? logs.map(l => `[${l.date}] ${l.type}: ${(l.note || l.text || "").slice(0, 150)}`).join("\n")
    : "No recent observations logged.";
  return [
    `TO: ${student.caseManager || "Case Manager"}`,
    `RE: ${resolveLabel(student)}`,
    `Eligibility: ${student.eligibility}`,
    `Goals: ${goals || "None listed"}`,
    `Accommodations: ${(student.accs || []).join(", ")}`,
    "",
    "RECENT OBSERVATIONS:",
    logText,
    "",
    `Start the email with "Hi ${student.caseManager || "Team"},"`,
  ].join("\n");
}

// ── Case Memory serializer ────────────────────────────────────
export function serializeForCaseMemoryPrompt(student, currentDescription, caseMemoryResults) {
  const lines = [
    `STUDENT: ${resolveLabel(student)}`,
    `Eligibility: ${_fieldText(student.eligibility)}`,
    `Accommodations: ${_fieldText(student.accs)}`,
    `Strategies: ${_fieldText(student.strategies)}`,
    `Triggers: ${_fieldText(student.triggers)}`,
    "",
    "CURRENT SITUATION:",
    currentDescription || "(no description provided)",
    "",
  ];

  if (caseMemoryResults && caseMemoryResults.length > 0) {
    lines.push("PAST CASES:");
    caseMemoryResults.forEach((r, i) => {
      lines.push(`  Case ${i + 1}: ${r.incident.description} [${r.incident.date}]`);
      r.interventions.forEach(ci => {
        const result = ci.outcome ? ci.outcome.result : "no outcome recorded";
        lines.push(`    Tried: ${ci.intervention.strategyLabel || ci.intervention.staffNote || "unspecified"} → ${result}`);
        if (ci.outcome?.studentResponse) lines.push(`    Response: ${ci.outcome.studentResponse}`);
      });
    });
    lines.push("");
  } else {
    lines.push("PAST CASES: None recorded for this student yet.");
    lines.push("");
  }

  lines.push("Based on this student's profile and past cases, give 2-3 specific, immediately actionable recommendations for this moment.");
  return lines.join("\n");
}
