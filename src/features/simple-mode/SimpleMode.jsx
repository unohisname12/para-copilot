// ══════════════════════════════════════════════════════════════
// SIMPLE MODE — Para Note Entry (v3)
// - One-tap per category (same as v2)
// - Inline quick-note bar appears 5s after any tap; Enter appends note
// - Today's summary strip with clickable pills (filter to "not yet today")
// - Double-click a category icon → jump straight to the note screen
//   with that category pre-selected
// - Responsive grid: 1 column on narrow, 2 on wide (auto-fit ≥ 520px)
// ══════════════════════════════════════════════════════════════
import React, { useState, useMemo, useRef, useEffect } from "react";
import { DB, SUPPORT_CARDS } from '../../data';
import { runLocalEngine } from '../../engine';
import { getHealth, hdot } from '../../models';
import { resolveLabel } from '../../privacy/nameResolver';
import { VisualTimer, BreathingExercise } from '../../components/tools';
import { getStudentPatterns } from '../analytics/getStudentPatterns';
import PatternsCard from '../analytics/PatternsCard';

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

export function SimpleMode({ activePeriod, setActivePeriod, logs, addLog, deleteLog, updateLogText, currentDate, allStudents, effectivePeriodStudents }) {
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

  // v3: inline quick-note window that opens below the row for 5s after a tap.
  // { logId, studentId, categoryLabel, tone } | null
  const [quickNoteFor, setQuickNoteFor] = useState(null);
  const [quickNoteDraft, setQuickNoteDraft] = useState("");
  const quickNoteTimer = useRef();

  // v3: filter for "show only students who haven't gotten [category] today"
  const [summaryFilter, setSummaryFilter] = useState(null);

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
    if (newLog?.id) {
      showUndo(newLog.id, studentId, cat?.label || 'entry');
      // v3: open the inline quick-note bar for this row. Auto-dismisses
      // after 12s IF THE USER NEVER ENGAGES. As soon as they focus the
      // input, the timer is cancelled and the bar stays open until they
      // explicitly save (Enter), skip, or hit Escape.
      if (quickNoteTimer.current) clearTimeout(quickNoteTimer.current);
      setQuickNoteDraft("");
      setQuickNoteFor({ logId: newLog.id, studentId, categoryLabel: cat?.label, tone: cat?.color });
      quickNoteTimer.current = setTimeout(() => {
        setQuickNoteFor((q) => (q?.logId === newLog.id ? null : q));
      }, 12000);
    }
  };

  // Called when the user focuses the quick-note input — kills the
  // auto-dismiss timer so the bar stays open as long as they need.
  const freezeQuickNoteTimer = () => {
    if (quickNoteTimer.current) {
      clearTimeout(quickNoteTimer.current);
      quickNoteTimer.current = null;
    }
  };

  // v3: commit the inline note (append to the existing log).
  const commitQuickNote = () => {
    if (!quickNoteFor) return;
    const text = quickNoteDraft.trim();
    if (text && updateLogText) {
      updateLogText(quickNoteFor.logId, text);
    }
    setQuickNoteFor(null);
    setQuickNoteDraft("");
    if (quickNoteTimer.current) clearTimeout(quickNoteTimer.current);
  };
  const cancelQuickNote = () => {
    setQuickNoteFor(null);
    setQuickNoteDraft("");
    if (quickNoteTimer.current) clearTimeout(quickNoteTimer.current);
  };

  // v3: double-click on a category button → jump to full note screen with
  // that student + category pre-selected. Gives paras who DO want to write
  // a shortcut past the "tap name → pick category" two-step.
  const handleCategoryDoubleClick = (e, studentId, categoryId) => {
    e.stopPropagation();
    e.preventDefault();
    cancelQuickNote();
    setSelectedStudent(studentId);
    setSelectedCat(categoryId);
    setNoteText("");
    setStep("note");
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
    // v3: "missing category" filter — when summaryFilter is set, only show
    // students who have NOT received that category today.
    if (summaryFilter) {
      r = r.filter(row => !(row.byCat?.[summaryFilter] > 0));
    }
    return sortRows(r, sortMode);
  }, [periodStudentIds, studentsMap, logs, currentDate, search, sortMode, summaryFilter]);

  // v3: today's totals for the summary strip at the top.
  const todayTotals = useMemo(() => {
    const totals = { all: 0 };
    CATEGORIES.forEach(c => { totals[c.id] = 0; });
    logs.forEach(l => {
      if (l.date !== currentDate) return;
      if (l.source !== 'simple_mode' && l.source !== 'quick_action' && !l.category) return;
      totals.all += 1;
      if (l.category && totals[l.category] !== undefined) {
        totals[l.category] += 1;
      }
    });
    return totals;
  }, [logs, currentDate]);

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
    <div style={{ height: "100%", background: "var(--bg-deep)", display: "flex", flexDirection: "column", overflow: "hidden" }}>

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
        <div style={{
          flex: 1, minHeight: 0, overflowY: "auto",
          WebkitOverflowScrolling: "touch", overscrollBehaviorY: "contain",
          touchAction: "pan-y",
          padding: "var(--space-4) var(--space-5) 120px",
        }}>

          {/* Today's summary strip — totals + click-to-filter per category */}
          <div style={{
            marginBottom: 12,
            padding: "var(--space-3) var(--space-4)",
            background: "linear-gradient(90deg, var(--panel-raised), var(--panel-bg))",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)",
            display: "flex", alignItems: "center", gap: "var(--space-3)", flexWrap: "wrap",
          }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em", color: "var(--text-muted)" }}>
                Today
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", lineHeight: 1 }}>
                {todayTotals.all}
              </div>
              <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                total log{todayTotals.all !== 1 ? 's' : ''}
              </div>
            </div>
            <div style={{ width: 1, alignSelf: "stretch", background: "var(--border)" }} />
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", flex: 1 }}>
              {CATEGORIES.map(c => {
                const count = todayTotals[c.id] || 0;
                const active = summaryFilter === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => setSummaryFilter(active ? null : c.id)}
                    title={active
                      ? `Showing students without a ${c.label} log today. Click to clear.`
                      : `Click to filter to students who haven't gotten ${c.label} today.`}
                    style={{
                      padding: "6px 10px",
                      borderRadius: "var(--radius-pill)",
                      border: `1px solid ${active ? c.color : c.color + "40"}`,
                      background: active ? c.color + "25" : "transparent",
                      color: c.color,
                      cursor: "pointer",
                      fontSize: 12, fontWeight: 600, fontFamily: "inherit",
                      display: "inline-flex", alignItems: "center", gap: 6,
                      transition: "all 120ms cubic-bezier(0.16,1,0.3,1)",
                    }}
                  >
                    <span style={{ fontSize: 14 }}>{c.icon}</span>
                    <span>{count}</span>
                    <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>{c.label}</span>
                  </button>
                );
              })}
              {summaryFilter && (
                <button
                  onClick={() => setSummaryFilter(null)}
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: 11, color: "var(--text-muted)" }}
                >
                  Clear filter
                </button>
              )}
            </div>
          </div>

          {/* Legend */}
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 12, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>💡 Tap = log · Double-tap = add detail · Type after a tap to attach a note</span>
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

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(520px, 1fr))",
            gap: 10,
          }}>
            {rows.map(({ id, student: s, health, todayCount, byCat, hasAlert, alertText }) => {
              const isFlashing = flashState?.id === id;
              const label = resolveLabel(s, "compact");
              const flashCat = isFlashing ? CATEGORIES.find(c => c.id === flashState.category) : null;
              const showQuickNote = quickNoteFor?.studentId === id;
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
                            onDoubleClick={e => handleCategoryDoubleClick(e, id, cat.id)}
                            title={`Tap: log ${cat.label}. Double-tap: add detail.${count > 0 ? ` (${count} today)` : ''}`}
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
                              userSelect: "none",
                              WebkitUserSelect: "none",
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

                  {/* Inline quick-note bar — appears for 5s after any one-tap log.
                      User can type a short note and hit Enter to attach it to the
                      log that was just created. Ignoring it leaves the log as-is. */}
                  {showQuickNote && (
                    <div style={{
                      padding: "10px 14px",
                      borderTop: `1px solid ${quickNoteFor.tone}40`,
                      background: `${quickNoteFor.tone}0e`,
                      display: "flex", flexDirection: "column", gap: 8,
                      animation: "fadeIn 160ms ease",
                    }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={{ fontSize: 11, color: quickNoteFor.tone, fontWeight: 700, whiteSpace: "nowrap" }}>
                        ✓ {quickNoteFor.categoryLabel} logged — add detail?
                      </span>
                      <input
                        autoFocus
                        value={quickNoteDraft}
                        onChange={e => { freezeQuickNoteTimer(); setQuickNoteDraft(e.target.value); }}
                        onFocus={freezeQuickNoteTimer}
                        onClick={freezeQuickNoteTimer}
                        onKeyDown={e => {
                          freezeQuickNoteTimer();
                          if (e.key === "Enter") { e.preventDefault(); commitQuickNote(); }
                          if (e.key === "Escape") { e.preventDefault(); cancelQuickNote(); }
                        }}
                        placeholder="Type detail and press Enter — this stays open while you type"
                        style={{
                          flex: 1,
                          padding: "8px 12px",
                          background: "var(--bg-dark)",
                          border: `1px solid ${quickNoteFor.tone}60`,
                          borderRadius: "var(--radius-sm)",
                          color: "var(--text-primary)",
                          fontSize: 13, fontFamily: "inherit",
                          minHeight: 36,
                        }}
                      />
                      <button
                        onClick={commitQuickNote}
                        disabled={!quickNoteDraft.trim()}
                        className="btn btn-primary btn-sm"
                        style={{ fontSize: 11 }}
                      >
                        Attach
                      </button>
                      <button
                        onClick={cancelQuickNote}
                        className="btn btn-ghost btn-sm"
                        style={{ fontSize: 11, color: "var(--text-muted)" }}
                      >
                        Skip
                      </button>
                      </div>
                      <PatternsCard
                        patterns={getStudentPatterns(quickNoteFor.studentId, logs)}
                        studentLabel={resolveLabel(studentsMap[quickNoteFor.studentId], "compact")}
                        onTry={(s) => {
                          freezeQuickNoteTimer();
                          setQuickNoteDraft(d => d ? d + ` — try: ${s.label}` : `Try: ${s.label}`);
                        }}
                      />
                    </div>
                  )}
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
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "var(--space-5)" }}>
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
                  📋 IEP Summary · Accommodations
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
