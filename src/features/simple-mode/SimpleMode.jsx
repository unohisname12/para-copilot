// ══════════════════════════════════════════════════════════════
// SIMPLE MODE — Para Note Entry
// Large buttons, minimal choices, background engine processing.
// The user types what happened; the app does the rest.
// ══════════════════════════════════════════════════════════════
import React, { useState } from "react";
import { DB, SUPPORT_CARDS } from '../../data';
import { runLocalEngine } from '../../engine';
import { getHealth, hdot } from '../../models';
import { resolveLabel } from '../../privacy/nameResolver';
import { VisualTimer, BreathingExercise } from '../../components/tools';

const CATEGORIES = [
  { id: "behavior",  label: "Behavior",       icon: "🔴", color: "#ef4444", logType: "Behavior Note",       tag: "behavior" },
  { id: "refusal",   label: "Work Refusal",   icon: "✋", color: "#f97316", logType: "Behavior Note",       tag: "refusal" },
  { id: "transition",label: "Transition",     icon: "🔔", color: "#f59e0b", logType: "Accommodation Used",  tag: "transition" },
  { id: "positive",  label: "Positive!",      icon: "⭐", color: "#4ade80", logType: "Positive Note",       tag: "positive" },
  { id: "break",     label: "Needed Break",   icon: "🚶", color: "#60a5fa", logType: "Accommodation Used",  tag: "break" },
  { id: "academic",  label: "Academic Help",  icon: "📚", color: "#a78bfa", logType: "Academic Support",    tag: "academic" },
];

// ── CATEGORY → SUPPORT CARD mapping ──────────────────────────
// Maps each CATEGORIES id to the most relevant SUPPORT_CARDS id.
// "positive" has no card — it's a celebration, not a support situation.
const CATEGORY_CARD_MAP = {
  behavior:   "sc_escal",
  refusal:    "sc_refusal",
  transition: "sc_trans",
  break:      "sc_sensory",
  academic:   "sc_write",
};

// ── getHintForCategory ────────────────────────────────────────
// Returns a slim { title, whenToUse, whatToSay } hint for the
// selected category, drawn from the matching SUPPORT_CARD.
// whatToSay is capped at 2 items to keep the hint fast to read.
// Returns null if no card maps to the category (e.g. "positive").
export function getHintForCategory(categoryId, supportCards) {
  const cardId = CATEGORY_CARD_MAP[categoryId];
  if (!cardId) return null;
  const card = supportCards.find(c => c.id === cardId);
  if (!card) return null;
  return {
    title:      card.title,
    whenToUse:  card.whenToUse,
    whatToSay:  card.whatToSay.slice(0, 2),
  };
}

// ── buildQuickLogParams ───────────────────────────────────────
// Returns the note/logType/tag for a 1-tap action, derived from the
// same CATEGORIES array used by handleSave. Produces an identical
// note to what handleSave writes when a category is selected but no
// free text is entered — keeps the log format consistent.
// Returns null if the categoryId is not found.
export function buildQuickLogParams(categoryId) {
  const cat = CATEGORIES.find(c => c.id === categoryId);
  if (!cat) return null;
  return {
    note: `${cat.label} — support provided.`,
    logType: cat.logType,
    tag: cat.tag,
  };
}

// ── buildStudentRows ───────────────────────────────────────────
// Pure helper — builds display rows from the merged allStudents map.
// Exported so it can be unit-tested without rendering the component.
export function buildStudentRows(effectivePeriodStudents, allStudents, logs, currentDate) {
  return effectivePeriodStudents.reduce((acc, id) => {
    const student = allStudents[id];
    if (!student) return acc; // skip IDs not found (null guard)
    const health = getHealth(id, logs, currentDate);
    const todayCount = logs.filter(l => l.studentId === id && l.date === currentDate).length;
    const hasAlert = !!(student.alertText || student.flags?.alert);
    const alertText = student.alertText || (student.flags?.alert ? "Alert flag set" : "");
    acc.push({ id, student, health, todayCount, hasAlert, alertText });
    return acc;
  }, []);
}

export function SimpleMode({ activePeriod, setActivePeriod, logs, addLog, currentDate, allStudents, effectivePeriodStudents }) {
  const [step, setStep] = useState("students"); // "students" | "note" | "tool"
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [noteText, setNoteText] = useState("");
  const [selectedCat, setSelectedCat] = useState(null);
  const [saved, setSaved] = useState(false);
  const [activeTool, setActiveTool] = useState(null); // "timer" | "breathing"
  // quickFlash: studentId that just received a 1-tap log, cleared after 1.2s
  const [quickFlash, setQuickFlash] = useState(null);

  // Period label/teacher still come from DB (static config) — not changing roster architecture
  const period = DB.periods[activePeriod];

  const studentsMap = allStudents || {};
  // Use effectivePeriodStudents if provided, fall back to DB period list for safety
  const periodStudentIds = effectivePeriodStudents || period.students;

  const reset = () => {
    setStep("students");
    setSelectedStudent(null);
    setNoteText("");
    setSelectedCat(null);
    setSaved(false);
  };

  // ── 1-tap quick log (no second screen needed) ────────────────
  // Calls addLog directly — same path as handleSave, same log format.
  // No engine run needed: these are the simplest possible support logs.
  const handleQuickLog = (e, studentId, categoryId) => {
    e.stopPropagation(); // prevent the card's "go to note step" click from firing
    const params = buildQuickLogParams(categoryId);
    if (!params) return;
    addLog(studentId, params.note, params.logType, {
      source: "simple_mode",
      category: categoryId,
      tags: [params.tag],
    });
    setQuickFlash(studentId);
    setTimeout(() => setQuickFlash(null), 1200);
  };

  const handleSave = () => {
    const cat = CATEGORIES.find(c => c.id === selectedCat);
    const logType = cat ? cat.logType : "General Observation";
    const note = noteText.trim() || (cat ? `${cat.label} — support provided.` : "Observation noted.");
    const engineQuery = (cat ? cat.label + " " : "") + note;

    // Background engine processing — user never sees this complexity
    const result = runLocalEngine(
      engineQuery,
      [selectedStudent],
      [],
      activePeriod,
      null,
      period.label,
      logs
    );

    addLog(selectedStudent, note, logType, {
      source: "simple_mode",
      category: result.topic !== "unknown" ? result.topic : (cat ? selectedCat : "general"),
      tags: result.situations.length > 0
        ? result.situations[0].tags
        : (cat ? [cat.tag] : []),
      situationId: result.situations[0]?.id || null,
    });

    setSaved(true);
    setTimeout(reset, 1600);
  };

  const canSave = noteText.trim() || selectedCat;

  // ── Tool overlay ──────────────────────────────────────────
  if (activeTool) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg-deep)", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg-dark)" }}>
          <span style={{ fontSize: "16px", fontWeight: "700", color: "var(--text-primary)" }}>
            {activeTool === "timer" ? "⏱️ Visual Timer" : "🫁 Breathing Exercise"}
          </span>
          <button onClick={() => setActiveTool(null)}
            style={{ padding: "10px 18px", borderRadius: "10px", border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text-secondary)", fontSize: "15px", cursor: "pointer", fontWeight: "600" }}>
            ← Back
          </button>
        </div>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div style={{ width: "100%", maxWidth: "480px" }}>
            {activeTool === "timer" ? <VisualTimer /> : <BreathingExercise />}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-deep)", display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* ── Top bar ── */}
      <div style={{ background: "var(--bg-dark)", borderBottom: "2px solid var(--border-light)", padding: "14px 20px", flexShrink: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <div>
            <div style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: ".1em", marginBottom: "2px" }}>Para Notes — Simple Mode</div>
            <div style={{ fontSize: "19px", fontWeight: "700", color: "var(--text-primary)" }}>{period.label}</div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>Teacher: {period.teacher} · {periodStudentIds.length} students</div>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button onClick={() => setActiveTool("timer")}
              style={{ padding: "9px 14px", borderRadius: "10px", border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text-secondary)", fontSize: "14px", cursor: "pointer" }} title="Visual Timer">
              ⏱️
            </button>
            <button onClick={() => setActiveTool("breathing")}
              style={{ padding: "9px 14px", borderRadius: "10px", border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text-secondary)", fontSize: "14px", cursor: "pointer" }} title="Breathing Exercise">
              🫁
            </button>
          </div>
        </div>

        {/* Period picker — DB.periods is the correct source for period labels */}
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {Object.entries(DB.periods).map(([id, p]) => (
            <button key={id} onClick={() => { setActivePeriod(id); reset(); }}
              style={{ padding: "7px 13px", borderRadius: "20px", border: `2px solid ${activePeriod === id ? "#3b82f6" : "var(--border)"}`, background: activePeriod === id ? "#1e3a5f" : "var(--bg-surface)", color: activePeriod === id ? "#93c5fd" : "var(--text-muted)", fontSize: "12px", fontWeight: "600", cursor: "pointer", transition: "all .15s" }}>
              {p.label.split("—")[0].trim()}
            </button>
          ))}
        </div>
      </div>

      {/* ── Step: Students ── */}
      {step === "students" && (
        <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
          <div style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "16px", fontWeight: "500" }}>
            ⭐ ☕ = log instantly · tap name to write a note
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {buildStudentRows(periodStudentIds, studentsMap, logs, currentDate).map(({ id, student: s, health, todayCount, hasAlert, alertText }) => {
              const isFlashing = quickFlash === id;
              return (
                // Outer div instead of button — allows real <button> elements inside for quick actions
                <div key={id} role="button" tabIndex={0}
                  onClick={() => { setSelectedStudent(id); setStep("note"); }}
                  onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { setSelectedStudent(id); setStep("note"); } }}
                  style={{ borderRadius: "14px", border: `2px solid ${s.color}30`, background: "var(--bg-surface)", color: "var(--text-primary)", textAlign: "left", cursor: "pointer", display: "flex", flexDirection: "column", transition: "border-color .15s", overflow: "hidden" }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = s.color + "80"}
                  onMouseLeave={e => e.currentTarget.style.borderColor = s.color + "30"}>

                  {/* Alert banner — shown for BIP/active alert students */}
                  {hasAlert && (
                    <div style={{ padding: "5px 14px", background: "#1a0505", borderBottom: "1px solid #7f1d1d", fontSize: "11px", color: "#f87171", fontWeight: "700" }}>
                      ⚠ {alertText}
                    </div>
                  )}

                  {/* Main card body */}
                  <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: "14px" }}>
                    <div style={{ width: "16px", height: "16px", borderRadius: "50%", background: s.color, flexShrink: 0, boxShadow: `0 0 8px ${s.color}60` }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "17px", fontWeight: "700", color: s.color, marginBottom: "2px" }}>
                        {hdot(health)} {resolveLabel(s, "compact")}
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>{s.eligibility}</div>
                    </div>

                    {/* 1-tap quick actions — stop propagation so card tap still goes to note step */}
                    <div style={{ display: "flex", gap: "6px", flexShrink: 0, alignItems: "center" }} onClick={e => e.stopPropagation()}>
                      {isFlashing ? (
                        <div style={{ fontSize: "13px", color: "#4ade80", fontWeight: "700", padding: "6px 10px", borderRadius: "8px", background: "#0d2010", border: "1px solid #166534", minWidth: "60px", textAlign: "center" }}>
                          ✓ Logged
                        </div>
                      ) : (<>
                        <button
                          onClick={e => handleQuickLog(e, id, "positive")}
                          title="Log: Positive!"
                          style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #166534", background: "#0d2010", color: "#4ade80", cursor: "pointer", fontSize: "16px", lineHeight: 1 }}>
                          ⭐
                        </button>
                        <button
                          onClick={e => handleQuickLog(e, id, "break")}
                          title="Log: Needed Break"
                          style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #1d4ed8", background: "#0c1a2e", color: "#60a5fa", cursor: "pointer", fontSize: "16px", lineHeight: 1 }}>
                          ☕
                        </button>
                        <div style={{ textAlign: "right", fontSize: "11px", color: todayCount > 0 ? "#4ade80" : "var(--text-muted)", fontWeight: todayCount > 0 ? "600" : "400" }}>
                          {todayCount > 0 ? `${todayCount}✓` : "—"}
                        </div>
                      </>)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Step: Note Entry ── */}
      {step === "note" && (() => {
        const s = studentsMap[selectedStudent];
        if (!s) return null;
        const noteAlertText = s.alertText || (s.flags?.alert ? "Alert flag set" : null);
        return (
          <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>

            {/* Alert warning on note screen */}
            {noteAlertText && (
              <div style={{ padding: "10px 14px", borderRadius: "10px", background: "#1a0505", border: "1px solid #7f1d1d", marginBottom: "14px", fontSize: "12px", color: "#f87171", fontWeight: "600" }}>
                ⚠ {noteAlertText}
              </div>
            )}

            {/* Back + student header */}
            <div style={{ display: "flex", gap: "12px", alignItems: "center", marginBottom: "20px" }}>
              <button onClick={reset}
                style={{ padding: "9px 16px", borderRadius: "10px", border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text-secondary)", fontSize: "14px", cursor: "pointer", fontWeight: "600", flexShrink: 0 }}>
                ← Back
              </button>
              <div style={{ flex: 1, padding: "14px 18px", borderRadius: "12px", background: "var(--bg-surface)", border: `2px solid ${s.color}`, display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ width: "14px", height: "14px", borderRadius: "50%", background: s.color, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: "17px", fontWeight: "700", color: s.color }}>{resolveLabel(s, "compact")}</div>
                  <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "1px" }}>{s.eligibility}</div>
                </div>
              </div>
            </div>

            {/* Category buttons */}
            <div style={{ marginBottom: "20px" }}>
              <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "10px", fontWeight: "600" }}>
                What's happening? <span style={{ color: "var(--text-muted)", fontWeight: "400" }}>(tap one or skip)</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                {CATEGORIES.map(cat => (
                  <button key={cat.id} onClick={() => setSelectedCat(selectedCat === cat.id ? null : cat.id)}
                    style={{ padding: "14px 12px", borderRadius: "12px", border: `2px solid ${selectedCat === cat.id ? cat.color : "var(--border)"}`, background: selectedCat === cat.id ? cat.color + "18" : "var(--bg-surface)", color: selectedCat === cat.id ? cat.color : "var(--text-muted)", cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: "10px", fontSize: "14px", fontWeight: "600", transition: "all .15s" }}>
                    <span style={{ fontSize: "20px" }}>{cat.icon}</span>
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Situation hint — appears when a category with a matching support card is selected */}
            {(() => {
              const hint = selectedCat ? getHintForCategory(selectedCat, SUPPORT_CARDS) : null;
              const cat  = CATEGORIES.find(c => c.id === selectedCat);
              if (!hint || !cat) return null;
              return (
                <div style={{ marginBottom: "20px", padding: "12px 14px", borderRadius: "12px", background: cat.color + "0e", border: `1px solid ${cat.color}40` }}>
                  <div style={{ fontSize: "10px", fontWeight: "700", textTransform: "uppercase", letterSpacing: ".08em", color: cat.color, marginBottom: "6px" }}>
                    {cat.icon} {hint.title}
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-muted)", fontStyle: "italic", marginBottom: "10px", lineHeight: "1.5" }}>
                    {hint.whenToUse}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {hint.whatToSay.map((line, i) => (
                      <div key={i} style={{ fontSize: "13px", color: "var(--text-secondary)", padding: "7px 10px", borderRadius: "8px", background: "var(--bg-surface)", borderLeft: `3px solid ${cat.color}` }}>
                        💬 {line}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Text note */}
            <div style={{ marginBottom: "20px" }}>
              <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "10px", fontWeight: "600" }}>
                Write a short note: <span style={{ color: "var(--text-muted)", fontWeight: "400" }}>(or just tap Save above)</span>
              </div>
              <textarea value={noteText} onChange={e => setNoteText(e.target.value)}
                placeholder={`What happened with ${resolveLabel(s, "compact")}?\n\nJust describe what you saw — keep it simple.`}
                style={{ width: "100%", minHeight: "130px", padding: "14px", background: "var(--bg-surface)", border: "2px solid var(--border-light)", borderRadius: "12px", color: "var(--text-primary)", fontSize: "16px", lineHeight: "1.6", resize: "none", fontFamily: "inherit" }} />
            </div>

            {/* IEP quick-ref strip */}
            {s.accs && s.accs.length > 0 && (
              <div style={{ padding: "10px 14px", borderRadius: "10px", background: "#0c1a2e", border: "1px solid #1d4ed8", marginBottom: "20px" }}>
                <div style={{ fontSize: "10px", color: "#60a5fa", fontWeight: "600", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: "6px" }}>Quick IEP Reminder</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                  {s.accs.map(a => (
                    <span key={a} style={{ fontSize: "11px", background: "#1e3a5f", color: "#93c5fd", padding: "3px 8px", borderRadius: "20px" }}>{a}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Save button */}
            {saved ? (
              <div style={{ padding: "20px", borderRadius: "14px", background: "#14532d", border: "2px solid #166534", color: "#4ade80", textAlign: "center", fontSize: "20px", fontWeight: "700" }}>
                ✓ Saved!
              </div>
            ) : (
              <button onClick={handleSave} disabled={!canSave}
                style={{ width: "100%", padding: "20px", borderRadius: "14px", border: "none", background: canSave ? "#1d4ed8" : "var(--bg-surface)", color: canSave ? "#fff" : "var(--text-muted)", fontSize: "18px", fontWeight: "700", cursor: canSave ? "pointer" : "not-allowed", transition: "all .15s" }}>
                Save Note
              </button>
            )}
          </div>
        );
      })()}

    </div>
  );
}
