// ══════════════════════════════════════════════════════════════
// SIMPLE MODE — Para Note Entry (v2)
// The para should never have to type unless they want to. Every
// category is a one-tap action on every student. If they DO want
// to write something, the "+note" button opens a full note screen.
// ══════════════════════════════════════════════════════════════
import React, { useState, useMemo, useRef, useEffect } from "react";
import { DB, SUPPORT_CARDS } from '../../data';
import { runLocalEngine } from '../../engine';
import { getHealth, hdot } from '../../models';
import { resolveLabel } from '../../privacy/nameResolver';
import { VisualTimer, BreathingExercise } from '../../components/tools';

// Category order matters: arranged left-to-right from most-positive to most-critical.
const CATEGORIES = [
  { id: "positive",  label: "Positive!",      icon: "⭐", color: "#34d399", logType: "Positive Note",       tag: "positive"  },
  { id: "academic",  label: "Academic Help",  icon: "📚", color: "#a78bfa", logType: "Academic Support",    tag: "academic"  },
  { id: "break",     label: "Needed Break",   icon: "☕", color: "#60a5fa", logType: "Accommodation Used",  tag: "break"     },
  { id: "transition",label: "Transition",     icon: "🔔", color: "#fbbf24", logType: "Accommodation Used",  tag: "transition"},
  { id: "refusal",   label: "Work Refusal",   icon: "✋", color: "#fb923c", logType: "Behavior Note",       tag: "refusal"   },
  { id: "behavior",  label: "Behavior",       icon: "🔴", color: "#f87171", logType: "Behavior Note",       tag: "behavior"  },
];

const CATEGORY_CARD_MAP = {
  behavior:   "sc_escal",
  refusal:    "sc_refusal",
  transition: "sc_trans",
  break:      "sc_sensory",
  academic:   "sc_write",
};

// Same hint helper as v1.
export function getHintForCategory(categoryId, supportCards) {
  const cardId = CATEGORY_CARD_MAP[categoryId];
  if (!cardId) return null;
  const card = supportCards.find(c => c.id === cardId);
  if (!card) return null;
  return { title: card.title, whenToUse: card.whenToUse, whatToSay: card.whatToSay.slice(0, 2) };
}

export function buildQuickLogParams(categoryId) {
  const cat = CATEGORIES.find(c => c.id === categoryId);
  if (!cat) return null;
  return { note: `${cat.label} — support provided.`, logType: cat.logType, tag: cat.tag };
}

// Returns rows with computed today-count-by-category so the UI can show
// a mini breakdown without recomputing on every render.
export function buildStudentRows(effectivePeriodStudents, allStudents, logs, currentDate) {
  return effectivePeriodStudents.reduce((acc, id) => {
    const student = allStudents[id];
    if (!student) return acc;
    const health = getHealth(id, logs, currentDate);
    const todaysLogs = logs.filter(l => l.studentId === id && l.date === currentDate);
    const todayCount = todaysLogs.length;
    const byCat = {};
    todaysLogs.forEach(l => {
      const c = l.category || 'general';
      byCat[c] = (byCat[c] || 0) + 1;
    });
    const hasAlert = !!(student.alertText || student.flags?.alert);
    const alertText = student.alertText || (student.flags?.alert ? "Alert flag set" : "");
    acc.push({ id, student, health, todayCount, byCat, hasAlert, alertText });
    return acc;
  }, []);
}

// Default sort: red first, yellow next, green last. Secondary: alphabetical.
function sortRows(rows, mode) {
  const sorted = [...rows];
  if (mode === "needs") {
    const order = { red: 0, yellow: 1, green: 2 };
    sorted.sort((a, b) => {
      const d = (order[a.health] ?? 3) - (order[b.health] ?? 3);
      if (d !== 0) return d;
      return resolveLabel(a.student, "compact").localeCompare(resolveLabel(b.student, "compact"));
    });
  } else {
    sorted.sort((a, b) => resolveLabel(a.student, "compact").localeCompare(resolveLabel(b.student, "compact")));
  }
  return sorted;
}

export function SimpleMode({ activePeriod, setActivePeriod, logs, addLog, deleteLog, currentDate, allStudents, effectivePeriodStudents }) {
  const [step, setStep] = useState("students"); // "students" | "note" | "tool"
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [noteText, setNoteText] = useState("");
  const [selectedCat, setSelectedCat] = useState(null);
  const [saved, setSaved] = useState(false);
  const [activeTool, setActiveTool] = useState(null);
  const [flashState, setFlashState] = useState(null); // { id, category } — row highlight
  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState("needs"); // "needs" | "name"
  const [undoEntry, setUndoEntry] = useState(null); // { logId, studentId, categoryLabel, deadlineTs }
  const undoTimer = useRef();

  const period = DB.periods[activePeriod];
  const studentsMap = allStudents || {};
  const periodStudentIds = effectivePeriodStudents || period.students;

  const reset = () => {
    setStep("students");
    setSelectedStudent(null);
    setNoteText("");
    setSelectedCat(null);
    setSaved(false);
  };

  // Undo window: 5 seconds after any quick-log.
  function showUndo(logId, studentId, categoryLabel) {
    if (undoTimer.current) clearTimeout(undoTimer.current);
    const entry = { logId, studentId, categoryLabel, deadlineTs: Date.now() + 5000 };
    setUndoEntry(entry);
    undoTimer.current = setTimeout(() => setUndoEntry((u) => (u === entry ? null : u)), 5100);
  }

  function handleUndo() {
    if (!undoEntry) return;
    if (deleteLog) deleteLog(undoEntry.logId, { silent: true });
    setUndoEntry(null);
    if (undoTimer.current) clearTimeout(undoTimer.current);
  }

  // ── 1-tap quick log — same log format handleSave writes, no note ─
  const handleQuickLog = (e, studentId, categoryId) => {
    e.stopPropagation();
    const params = buildQuickLogParams(categoryId);
    if (!params) return;
    const cat = CATEGORIES.find(c => c.id === categoryId);
    const newLog = addLog(studentId, params.note, params.logType, {
      source: "simple_mode",
      category: categoryId,
      tags: [params.tag],
      pseudonym: studentsMap[studentId]?.pseudonym,
    });
    setFlashState({ id: studentId, category: categoryId });
    setTimeout(() => setFlashState((f) => (f?.id === studentId ? null : f)), 900);
    if (newLog?.id) showUndo(newLog.id, studentId, cat?.label || 'entry');
  };

  const handleSave = () => {
    const cat = CATEGORIES.find(c => c.id === selectedCat);
    const logType = cat ? cat.logType : "General Observation";
    const note = noteText.trim() || (cat ? `${cat.label} — support provided.` : "Observation noted.");
    const engineQuery = (cat ? cat.label + " " : "") + note;

    const result = runLocalEngine(engineQuery, [selectedStudent], [], activePeriod, null, period.label, logs);

    const newLog = addLog(selectedStudent, note, logType, {
      source: "simple_mode",
      category: result.topic !== "unknown" ? result.topic : (cat ? selectedCat : "general"),
      tags: result.situations.length > 0 ? result.situations[0].tags : (cat ? [cat.tag] : []),
      situationId: result.situations[0]?.id || null,
      pseudonym: studentsMap[selectedStudent]?.pseudonym,
    });

    if (newLog?.id) showUndo(newLog.id, selectedStudent, cat?.label || 'note');
    setSaved(true);
    setTimeout(reset, 1400);
  };

  const canSave = noteText.trim() || selectedCat;

  const rows = useMemo(() => {
    let r = buildStudentRows(periodStudentIds, studentsMap, logs, currentDate);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      r = r.filter(row => resolveLabel(row.student, "compact").toLowerCase().includes(q));
    }
    return sortRows(r, sortMode);
  }, [periodStudentIds, studentsMap, logs, currentDate, search, sortMode]);

  // ── Tool overlay ──
  if (activeTool) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg-deep)", display: "flex", flexDirection: "column" }}>
        <div style={toolHeaderStyle}>
          <span style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>
            {activeTool === "timer" ? "⏱️ Visual Timer" : "🫁 Breathing Exercise"}
          </span>
          <button onClick={() => setActiveTool(null)} className="btn btn-secondary">← Back</button>
        </div>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ width: "100%", maxWidth: 480 }}>
            {activeTool === "timer" ? <VisualTimer /> : <BreathingExercise />}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-deep)", display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* ── Top bar ── */}
      <div style={{
        background: "linear-gradient(180deg, var(--bg-dark), var(--bg-deep))",
        borderBottom: "1px solid var(--border)",
        padding: "var(--space-4) var(--space-5)",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: ".1em" }}>
              Simple Mode · one-tap logging
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.01em", marginTop: 2 }}>
              {period.label}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
              {period.teacher} · {rows.length} / {periodStudentIds.length} students
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setActiveTool("timer")} title="Visual Timer" className="btn btn-secondary" style={{ fontSize: 16, padding: "8px 14px" }}>⏱️</button>
            <button onClick={() => setActiveTool("breathing")} title="Breathing Exercise" className="btn btn-secondary" style={{ fontSize: 16, padding: "8px 14px" }}>🫁</button>
          </div>
        </div>

        {/* Period picker */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          {Object.entries(DB.periods).map(([id, p]) => (
            <button key={id} onClick={() => { setActivePeriod(id); reset(); }}
              style={{
                padding: "7px 13px", borderRadius: "var(--radius-pill)",
                border: `2px solid ${activePeriod === id ? "var(--accent)" : "var(--border)"}`,
                background: activePeriod === id ? "var(--accent-glow)" : "var(--bg-surface)",
                color: activePeriod === id ? "var(--accent-hover)" : "var(--text-muted)",
                fontSize: 12, fontWeight: 600, cursor: "pointer",
                fontFamily: "inherit",
                transition: "all 120ms cubic-bezier(0.16,1,0.3,1)",
              }}>
              {p.label.split("—")[0].trim()}
            </button>
          ))}
        </div>

        {/* Search + sort */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {periodStudentIds.length > 8 && (
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="🔎 Find a student…"
              className="chat-input"
              style={{ flex: "1 1 220px", minWidth: 180, fontSize: 13 }}
            />
          )}
          <div style={{
            display: "flex", gap: 2, padding: 3,
            background: "var(--bg-dark)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
          }}>
            {[
              ["needs", "⚠ Needs first"],
              ["name",  "A → Z"],
            ].map(([id, label]) => (
              <button key={id} onClick={() => setSortMode(id)} style={{
                padding: "6px 12px", borderRadius: "var(--radius-sm)", border: "none", cursor: "pointer",
                fontSize: 11, fontWeight: 600, fontFamily: "inherit",
                background: sortMode === id ? "var(--grad-primary)" : "transparent",
                color: sortMode === id ? "#fff" : "var(--text-secondary)",
              }}>{label}</button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Step: Students ── */}
      {step === "students" && (
        <div style={{ flex: 1, overflowY: "auto", padding: "var(--space-4) var(--space-5) 120px" }}>

          {/* Legend */}
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
            {CATEGORIES.map(c => (
              <span key={c.id} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <span style={{ fontSize: 15 }}>{c.icon}</span>
                <span style={{ color: "var(--text-muted)", fontSize: 11 }}>{c.label}</span>
              </span>
            ))}
          </div>

          {rows.length === 0 && (
            <div style={{
              padding: "var(--space-6)", textAlign: "center",
              background: "var(--bg-surface)", border: "1px dashed var(--border)",
              borderRadius: "var(--radius-lg)", color: "var(--text-muted)",
            }}>
              {search ? `No students match "${search}"` : "No students in this period yet."}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {rows.map(({ id, student: s, health, todayCount, byCat, hasAlert, alertText }) => {
              const isFlashing = flashState?.id === id;
              const label = resolveLabel(s, "compact");
              const flashCat = isFlashing ? CATEGORIES.find(c => c.id === flashState.category) : null;
              return (
                <div key={id}
                  style={{
                    borderRadius: "var(--radius-lg)",
                    border: `2px solid ${isFlashing && flashCat ? flashCat.color : (health === 'red' ? '#7f1d1d' : s.color + '30')}`,
                    background: isFlashing && flashCat
                      ? `linear-gradient(90deg, ${flashCat.color}20, var(--bg-surface) 40%)`
                      : "var(--bg-surface)",
                    overflow: "hidden",
                    transition: "all 200ms cubic-bezier(0.16,1,0.3,1)",
                    boxShadow: isFlashing ? `0 0 24px ${flashCat.color}40` : "none",
                  }}
                >
                  {/* Alert banner (BIP / active alert) */}
                  {hasAlert && (
                    <div style={{
                      padding: "4px 14px",
                      background: "rgba(248,113,113,0.12)",
                      borderBottom: "1px solid rgba(248,113,113,0.28)",
                      fontSize: 11, color: "var(--red)", fontWeight: 700,
                    }}>
                      ⚠ {alertText}
                    </div>
                  )}

                  {/* Main row */}
                  <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", flexWrap: "wrap" }}>
                    {/* Name + eligibility + health */}
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => { setSelectedStudent(id); setStep("note"); }}
                      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { setSelectedStudent(id); setStep("note"); } }}
                      style={{ flex: "1 1 220px", minWidth: 0, cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}
                    >
                      <div style={{
                        width: 18, height: 18, borderRadius: "50%",
                        background: s.color,
                        boxShadow: `0 0 10px ${s.color}70`,
                        flexShrink: 0,
                      }} />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 17, fontWeight: 700, color: s.color, lineHeight: 1.15 }}>
                          {hdot(health)} {label}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 1 }}>
                          {s.eligibility}
                          {todayCount > 0 && (
                            <span style={{ color: "var(--green)", fontWeight: 600, marginLeft: 8 }}>
                              · {todayCount} logged today
                            </span>
                          )}
                        </div>
                        {/* Accommodation pills (first 2) */}
                        {Array.isArray(s.accs) && s.accs.length > 0 && (
                          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 6 }}>
                            {s.accs.slice(0, 3).map(a => (
                              <span key={a} className="pill pill-accent" style={{ fontSize: 10 }}>{a}</span>
                            ))}
                            {s.accs.length > 3 && (
                              <span style={{ fontSize: 10, color: "var(--text-muted)" }}>+{s.accs.length - 3}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* ALL 6 CATEGORY QUICK-TAPS + note */}
                    <div
                      style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}
                      onClick={e => e.stopPropagation()}
                    >
                      {CATEGORIES.map(cat => {
                        const count = byCat[cat.id] || 0;
                        return (
                          <button
                            key={cat.id}
                            onClick={e => handleQuickLog(e, id, cat.id)}
                            title={`Log: ${cat.label}${count > 0 ? ` (${count} today)` : ''}`}
                            style={{
                              position: "relative",
                              width: 48, height: 48,
                              minWidth: 48, minHeight: 48,
                              borderRadius: "var(--radius-md)",
                              border: `1px solid ${cat.color}40`,
                              background: count > 0 ? cat.color + "20" : "var(--bg-dark)",
                              color: cat.color,
                              cursor: "pointer",
                              fontSize: 22, lineHeight: 1,
                              fontFamily: "inherit",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              transition: "all 120ms cubic-bezier(0.16,1,0.3,1)",
                            }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = cat.color; e.currentTarget.style.background = cat.color + '30'; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = cat.color + '40'; e.currentTarget.style.background = count > 0 ? cat.color + '20' : 'var(--bg-dark)'; }}
                          >
                            {cat.icon}
                            {count > 0 && (
                              <span style={{
                                position: "absolute", top: -4, right: -4,
                                minWidth: 16, height: 16,
                                borderRadius: 8,
                                background: cat.color, color: "#000",
                                fontSize: 9, fontWeight: 800,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                padding: "0 4px",
                              }}>{count}</span>
                            )}
                          </button>
                        );
                      })}

                      {/* +note opens the full note-entry screen */}
                      <button
                        onClick={() => { setSelectedStudent(id); setStep("note"); }}
                        title="Write a longer note"
                        style={{
                          height: 48, minHeight: 48,
                          padding: "0 14px",
                          borderRadius: "var(--radius-md)",
                          border: "1px solid var(--border-light)",
                          background: "var(--bg-dark)",
                          color: "var(--text-secondary)",
                          cursor: "pointer", fontSize: 13, fontWeight: 600,
                          fontFamily: "inherit",
                          display: "flex", alignItems: "center", gap: 6,
                        }}
                      >
                        📝 Note
                      </button>
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
          <div style={{ flex: 1, overflowY: "auto", padding: "var(--space-5)" }}>
            {noteAlertText && (
              <div style={{
                padding: "10px 14px", borderRadius: "var(--radius-md)",
                background: "rgba(248,113,113,0.12)",
                border: "1px solid rgba(248,113,113,0.35)",
                marginBottom: 14, fontSize: 12, color: "var(--red)", fontWeight: 700,
              }}>
                ⚠ {noteAlertText}
              </div>
            )}

            <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 20 }}>
              <button onClick={reset} className="btn btn-secondary">← Back</button>
              <div style={{
                flex: 1, padding: "14px 18px", borderRadius: "var(--radius-lg)",
                background: "var(--bg-surface)", border: `2px solid ${s.color}`,
                display: "flex", alignItems: "center", gap: 12,
              }}>
                <div style={{ width: 14, height: 14, borderRadius: "50%", background: s.color, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: s.color }}>{resolveLabel(s, "compact")}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 1 }}>{s.eligibility}</div>
                </div>
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 10, fontWeight: 600 }}>
                What's happening? <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(tap one or skip)</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {CATEGORIES.map(cat => (
                  <button key={cat.id} onClick={() => setSelectedCat(selectedCat === cat.id ? null : cat.id)}
                    style={{
                      minHeight: 56,
                      padding: "12px 14px", borderRadius: "var(--radius-md)",
                      border: `2px solid ${selectedCat === cat.id ? cat.color : "var(--border)"}`,
                      background: selectedCat === cat.id ? cat.color + "20" : "var(--bg-surface)",
                      color: selectedCat === cat.id ? cat.color : "var(--text-muted)",
                      cursor: "pointer", textAlign: "left",
                      display: "flex", alignItems: "center", gap: 10,
                      fontSize: 14, fontWeight: 600, fontFamily: "inherit",
                      transition: "all 120ms cubic-bezier(0.16,1,0.3,1)",
                    }}>
                    <span style={{ fontSize: 20 }}>{cat.icon}</span>
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {(() => {
              const hint = selectedCat ? getHintForCategory(selectedCat, SUPPORT_CARDS) : null;
              const cat = CATEGORIES.find(c => c.id === selectedCat);
              if (!hint || !cat) return null;
              return (
                <div style={{
                  marginBottom: 20, padding: "12px 14px",
                  borderRadius: "var(--radius-md)",
                  background: cat.color + "10",
                  border: `1px solid ${cat.color}40`,
                }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", color: cat.color, marginBottom: 6 }}>
                    {cat.icon} {hint.title}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic", marginBottom: 10, lineHeight: 1.5 }}>
                    {hint.whenToUse}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {hint.whatToSay.map((line, i) => (
                      <div key={i} style={{
                        fontSize: 13, color: "var(--text-secondary)",
                        padding: "8px 12px", borderRadius: "var(--radius-sm)",
                        background: "var(--bg-surface)",
                        borderLeft: `3px solid ${cat.color}`,
                      }}>
                        💬 {line}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 10, fontWeight: 600 }}>
                Write a short note: <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(or just hit Save)</span>
              </div>
              <textarea value={noteText} onChange={e => setNoteText(e.target.value)}
                placeholder={`What happened with ${resolveLabel(s, "compact")}?\n\nJust describe what you saw — keep it simple.`}
                className="data-textarea"
                style={{ minHeight: 130, fontSize: 16, lineHeight: 1.6 }} />
            </div>

            {s.accs && s.accs.length > 0 && (
              <div style={{
                padding: "10px 14px", borderRadius: "var(--radius-md)",
                background: "var(--accent-glow)",
                border: "1px solid var(--accent-border)",
                marginBottom: 20,
              }}>
                <div style={{ fontSize: 10, color: "var(--accent-hover)", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 6 }}>
                  Quick IEP Reminder
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {s.accs.map(a => (
                    <span key={a} className="pill pill-accent" style={{ fontSize: 11 }}>{a}</span>
                  ))}
                </div>
              </div>
            )}

            {saved ? (
              <div style={{
                padding: 20, borderRadius: "var(--radius-lg)",
                background: "var(--green-muted)",
                border: "2px solid rgba(52,211,153,0.4)",
                color: "var(--green)", textAlign: "center",
                fontSize: 20, fontWeight: 700,
              }}>
                ✓ Saved!
              </div>
            ) : (
              <button onClick={handleSave} disabled={!canSave}
                className={canSave ? "btn btn-primary" : "btn btn-secondary"}
                style={{ width: "100%", padding: "20px", fontSize: 18, fontWeight: 700 }}>
                Save Note
              </button>
            )}
          </div>
        );
      })()}

      {/* ── Undo bar (floating, bottom-center) ── */}
      {undoEntry && step === "students" && (
        <div style={{
          position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)",
          zIndex: 9999,
          padding: "12px 16px",
          background: "linear-gradient(180deg, var(--panel-raised), var(--panel-bg))",
          border: "1px solid var(--border-light)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-lg)",
          display: "flex", alignItems: "center", gap: 12,
          animation: "fadeIn 200ms ease",
        }}>
          <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            ✓ Logged <b style={{ color: "var(--text-primary)" }}>{undoEntry.categoryLabel}</b>
          </span>
          <button
            type="button"
            onClick={handleUndo}
            className="btn btn-primary btn-sm"
            style={{ fontSize: 12 }}
          >
            ↶ Undo
          </button>
          <button
            type="button"
            onClick={() => setUndoEntry(null)}
            className="btn btn-ghost btn-sm"
            style={{ fontSize: 16, padding: "0 8px", color: "var(--text-muted)" }}
            aria-label="Dismiss"
          >×</button>
        </div>
      )}
    </div>
  );
}

const toolHeaderStyle = {
  padding: "14px 20px",
  borderBottom: "1px solid var(--border)",
  display: "flex", justifyContent: "space-between", alignItems: "center",
  background: "var(--bg-dark)",
};
