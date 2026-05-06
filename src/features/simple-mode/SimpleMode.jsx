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
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { useAutoGrammarFix, useGrammarFixSetting } from '../../hooks/useAutoGrammarFix';
import { useDraft } from '../../hooks/useDraft';
import { useCompactView } from '../../hooks/useCompactView';
import { DB, SUPPORT_CARDS } from '../../data';
import { runLocalEngine } from '../../engine';
import { getHealth, hdot } from '../../models';
import { resolveLabel } from '../../privacy/nameResolver';
import { useVault } from '../../context/VaultProvider';
import PrivacyName from '../../components/PrivacyName';
import { VisualTimer, BreathingExercise } from '../../components/tools';
import { getStudentPatterns } from '../analytics/getStudentPatterns';
import PatternsCard from '../analytics/PatternsCard';
import { SimpleModeQuickViews } from './SimpleModeQuickViews';
import { NOTE_TEMPLATES, insertTemplate } from './noteTemplates';

// Category order matters: arranged left-to-right from most-positive to most-critical.
// UX prototype reorder: per Dre's para field-test feedback, the five quick
// actions are ordered Redirect → Break → Accommodation → Behavior → Success
// so the most-frequent in-the-moment supports are leftmost.
// IDs are PERSISTED in logs — do NOT rename them. `transition` stays in the
// array so legacy logs and the hint engine still resolve, but it is no longer
// surfaced as a quick-action button (use the +Note flow instead).
const CATEGORIES = [
  { id: "refusal",    label: "Redirect",      icon: "↩️", color: "#fb923c", logType: "Behavior Note",       tag: "refusal",     quick: true  },
  { id: "break",      label: "Break",         icon: "☕", color: "#60a5fa", logType: "Accommodation Used",  tag: "break",       quick: true  },
  { id: "academic",   label: "Accommodation", icon: "📚", color: "#a78bfa", logType: "Accommodation Used",  tag: "academic",    quick: true  },
  { id: "behavior",   label: "Behavior",      icon: "🔴", color: "#f87171", logType: "Behavior Note",       tag: "behavior",    quick: true  },
  { id: "positive",   label: "Success",       icon: "⭐", color: "#34d399", logType: "Positive Note",       tag: "positive",    quick: true  },
  { id: "transition", label: "Transition",    icon: "🔔", color: "#fbbf24", logType: "Accommodation Used",  tag: "transition",  quick: false },
];

const QUICK_CATEGORIES = CATEGORIES.filter(c => c.quick);

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
// Auto-save the focus-row draft as a normal Simple-Mode log. Called on
// student-swap, Esc, click-outside, and explicit Save in the focus row.
// Returns true if a log was created. Empty/whitespace drafts are no-ops.
export function commitFocusedDraft({ draft, studentId, allStudents, addLog }) {
  const text = (draft || '').trim();
  if (!text || !studentId || typeof addLog !== 'function') return false;
  const s = (allStudents || {})[studentId];
  addLog(studentId, text, 'General Observation', {
    source: 'simple_mode_focus',
    category: 'general',
    tags: [],
    pseudonym: s?.pseudonym,
  });
  return true;
}

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
  // Real-names visibility — used to surface a warning chip when a student is
  // missing a real-name match while real-names mode is active.
  const { showRealNames } = useVault();

  // Density layer — Chromebook-friendly compact mode. Auto-on under 1366px,
  // settings override available. Metrics flow into inline styles below so the
  // existing DOM doesn't need a CSS rewrite.
  const { compact } = useCompactView();
  const M = useMemo(() => ({
    rowGap:      compact ? 6   : 10,
    rowPadV:     compact ? 8   : 12,
    rowPadH:     compact ? 12  : 14,
    qaSize:      compact ? 40  : 48,
    qaIcon:      compact ? 18  : 22,
    nameSize:    compact ? 15  : 17,
    nameSizeFocus: compact ? 19 : 22,
    subSize:     compact ? 11  : 12,
    periodPillH: compact ? 40  : 44,
    noteMin:     compact ? 160 : 220,
    noteFont:    compact ? 14  : 15,
    gridMin:     compact ? 360 : 520,
    accLimit:    compact ? 2   : 3,
    accFocusLimit: compact ? 3 : 4,
    summaryStripVPad: compact ? 6 : 12,
    showSummaryHero: !compact,
  }), [compact]);

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

  // Surface today's lesson topic in Simple Mode too — paras shouldn't have
  // to flip back to the full Dashboard just to see what they're teaching.
  // Same storage key the Dashboard writes to, read-only here. Edit happens
  // in Dashboard's "Today's Plan" card.
  const [todayTopic] = useLocalStorage(`classTopic_${activePeriod}_${currentDate}`, "");

  // Focus row — tap a student's name or 📝 Note to expand that row in place.
  // The textarea grows, quick-actions stay visible, accommodations + the first
  // goal show as reminders. Switching to another student auto-saves the
  // current draft (so notes are never lost).
  const [focusedStudentId, setFocusedStudentId] = useState(null);
  const [focusedDraft, setFocusedDraft] = useState('');
  const focusedRef = useRef(null);
  const noteTextRef = useRef(null);
  const [autoFix] = useGrammarFixSetting();
  useAutoGrammarFix({ value: focusedDraft, setValue: setFocusedDraft, ref: focusedRef, enabled: autoFix && !!focusedStudentId });
  useAutoGrammarFix({ value: noteText,     setValue: setNoteText,     ref: noteTextRef, enabled: autoFix });

  // When a student row is focused, scroll its expansion into view smoothly so
  // the textarea is visible without a manual scroll. block:'nearest' avoids
  // ripping the page when the row is already on-screen.
  useEffect(() => {
    if (!focusedStudentId) return;
    const t = setTimeout(() => {
      const row = document.querySelector(`[data-row-index][data-student-id="${focusedStudentId}"]`);
      if (row && typeof row.scrollIntoView === 'function') {
        row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 60);
    return () => clearTimeout(t);
  }, [focusedStudentId]);

  // Draft persistence — keyed per-student so each kid's in-flight note is
  // remembered separately. Survives focus swap, navigation away, reload.
  const focusedKey = focusedStudentId ? `simpleFocus:${focusedStudentId}` : '';
  const focusedDraftStore = useDraft(focusedKey, focusedDraft, setFocusedDraft);
  const noteKey = `simpleNote`; // shared — popover holds one note at a time
  const noteDraftStore = useDraft(noteKey, noteText, setNoteText);

  const swapFocus = (newStudentId) => {
    if (focusedStudentId && focusedDraft.trim()) {
      commitFocusedDraft({
        draft: focusedDraft,
        studentId: focusedStudentId,
        allStudents: studentsMap,
        addLog,
      });
      focusedDraftStore.clear(); // saved → drop the persisted draft
    }
    setFocusedStudentId(newStudentId);
    setFocusedDraft('');
  };

  const closeFocus = () => {
    if (focusedStudentId && focusedDraft.trim()) {
      commitFocusedDraft({
        draft: focusedDraft,
        studentId: focusedStudentId,
        allStudents: studentsMap,
        addLog,
      });
      focusedDraftStore.clear();
    }
    setFocusedStudentId(null);
    setFocusedDraft('');
  };

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
    noteDraftStore.clear();  // saved → drop persisted draft
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
            {todayTopic && todayTopic.trim() && (
              <div
                style={{
                  marginTop: 8,
                  padding: "8px 12px",
                  background: "var(--accent-soft, #1e1b4b)",
                  border: "1px solid var(--accent-border, #4c1d95)",
                  borderRadius: 8,
                  fontSize: 13,
                  color: "var(--accent-hover, #c4b5fd)",
                  display: "flex",
                  gap: 8,
                  alignItems: "flex-start",
                  maxWidth: 520,
                }}
                title="Today's lesson focus — edit in the full Dashboard"
              >
                <span style={{ fontSize: 14, flexShrink: 0 }}>📚</span>
                <span style={{ whiteSpace: "pre-wrap", lineHeight: 1.4 }}>{todayTopic}</span>
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={() => setActiveTool("timer")} title="Visual Timer" className="btn btn-secondary" style={{ fontSize: 16, padding: "8px 14px" }}>⏱️</button>
            <button onClick={() => setActiveTool("breathing")} title="Breathing Exercise" className="btn btn-secondary" style={{ fontSize: 16, padding: "8px 14px" }}>🫁</button>
            <SimpleModeQuickViews
              students={periodStudentIds}
              studentsMap={studentsMap}
              logs={logs}
              addLog={addLog}
              currentDate={currentDate}
            />
          </div>
        </div>

        {/* Period picker */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          {Object.entries(DB.periods).map(([id, p]) => (
            <button key={id} onClick={() => { setActivePeriod(id); reset(); }}
              className="sm-qa-btn"
              style={{
                minHeight: M.periodPillH, padding: compact ? "8px 12px" : "10px 16px",
                borderRadius: "var(--radius-pill)",
                border: `2px solid ${activePeriod === id ? "var(--accent)" : "var(--border)"}`,
                background: activePeriod === id ? "var(--accent-glow)" : "var(--bg-surface)",
                color: activePeriod === id ? "var(--accent-hover)" : "var(--text-muted)",
                fontSize: compact ? 12 : 13, fontWeight: 600, cursor: "pointer",
                fontFamily: "inherit",
                transition: "background-color 180ms ease, color 180ms ease, border-color 180ms ease",
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

          {/* Today's summary strip — totals + click-to-filter per category.
              In compact mode the big total number is dropped to save vertical
              space; the count for each category still rides on its pill. */}
          <div style={{
            marginBottom: compact ? 8 : 12,
            padding: compact ? "6px 10px" : "var(--space-3) var(--space-4)",
            background: "linear-gradient(90deg, var(--panel-raised), var(--panel-bg))",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)",
            display: "flex", alignItems: "center", gap: compact ? 8 : "var(--space-3)", flexWrap: "wrap",
          }}>
            {M.showSummaryHero && (
              <>
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
              </>
            )}
            {compact && (
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", color: "var(--text-muted)" }}>
                Today {todayTotals.all}
              </span>
            )}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", flex: 1 }}>
              {QUICK_CATEGORIES.map(c => {
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
            gridTemplateColumns: `repeat(auto-fit, minmax(min(${M.gridMin}px, 100%), 1fr))`,
            gap: M.rowGap,
          }}>
            {rows.map(({ id, student: s, health, todayCount, byCat, hasAlert, alertText }, rowIndex) => {
              const isFlashing = flashState?.id === id;
              const label = resolveLabel(s, "compact");
              const flashCat = isFlashing ? CATEGORIES.find(c => c.id === flashState.category) : null;
              const showQuickNote = quickNoteFor?.studentId === id;
              const isFocused = focusedStudentId === id;
              const isDimmed = focusedStudentId !== null && !isFocused;
              return (
                <div key={id}
                  data-row-index={rowIndex}
                  data-student-id={id}
                  className={isFlashing ? "sm-row sm-row--flash" : "sm-row"}
                  style={{
                    borderRadius: "var(--radius-lg)",
                    // Focused row: thick s.color border on all sides PLUS an
                    // extra-bold left edge so the per-kid color is unmissable
                    // even on washed-out Chromebook screens.
                    border: `${isFocused ? 3 : 2}px solid ${isFlashing && flashCat ? flashCat.color : (isFocused ? s.color : (health === 'red' ? '#7f1d1d' : s.color + '50'))}`,
                    borderLeftWidth: isFocused ? 8 : 4,
                    borderLeftColor: isFlashing && flashCat ? flashCat.color : s.color,
                    background: isFlashing && flashCat
                      ? `linear-gradient(90deg, ${flashCat.color}25, var(--bg-surface) 40%)`
                      : isFocused
                      ? `linear-gradient(135deg, ${s.color}28, ${s.color}08 40%, var(--bg-surface))`
                      : `linear-gradient(90deg, ${s.color}12, var(--bg-surface) 18%)`,
                    overflow: "hidden",
                    transition: "border-color 200ms cubic-bezier(0.16,1,0.3,1), box-shadow 200ms cubic-bezier(0.16,1,0.3,1), opacity 180ms ease, transform 240ms cubic-bezier(.34,1.56,.64,1), background 200ms ease",
                    boxShadow: isFlashing
                      ? `0 0 28px ${flashCat.color}55, 0 0 0 4px ${flashCat.color}30`
                      : isFocused
                      ? `0 0 32px ${s.color}55, 0 6px 20px rgba(0,0,0,0.35)`
                      : "none",
                    opacity: isDimmed ? 0.5 : 1,
                    transform: isFocused ? "scale(1.01)" : "scale(1)",
                    transformOrigin: "center top",
                    gridColumn: isFocused ? "1 / -1" : "auto",
                    animation: `sm-row-fade-in 220ms ease both`,
                    animationDelay: `${Math.min(rowIndex, 8) * 30}ms`,
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
                  <div style={{ display: "flex", alignItems: "center", gap: compact ? 8 : 12, padding: `${M.rowPadV}px ${M.rowPadH}px`, flexWrap: "wrap" }}>
                    {/* Name + eligibility + health */}
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => swapFocus(id)}
                      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") swapFocus(id); }}
                      style={{ flex: "1 1 200px", minWidth: 0, cursor: "pointer", display: "flex", alignItems: "center", gap: compact ? 8 : 12 }}
                    >
                      <div style={{
                        width: isFocused ? (compact ? 20 : 24) : (compact ? 14 : 18),
                        height: isFocused ? (compact ? 20 : 24) : (compact ? 14 : 18),
                        borderRadius: "50%",
                        background: s.color,
                        boxShadow: `0 0 ${isFocused ? 16 : 10}px ${s.color}${isFocused ? '90' : '70'}`,
                        flexShrink: 0,
                        transition: "all 200ms cubic-bezier(0.16,1,0.3,1)",
                      }} />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{
                          fontSize: isFocused ? M.nameSizeFocus : M.nameSize,
                          fontWeight: isFocused ? 800 : 700,
                          color: s.color,
                          lineHeight: 1.15,
                          transition: "all 200ms cubic-bezier(0.16,1,0.3,1)",
                          display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
                        }}>
                          <span>{hdot(health)} <PrivacyName>{label}</PrivacyName></span>
                          {showRealNames && !s.realName && (
                            <span
                              title="Real-names mode is on but this student is missing a vault match. Showing the codename instead."
                              style={{
                                fontSize: 10, fontWeight: 700,
                                padding: "2px 8px",
                                borderRadius: "var(--radius-pill)",
                                background: "rgba(251,191,36,0.18)",
                                border: "1px solid rgba(251,191,36,0.55)",
                                color: "#fbbf24",
                                textTransform: "uppercase", letterSpacing: ".06em",
                              }}
                            >
                              ⚠ name missing
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: M.subSize, color: "var(--text-muted)", marginTop: 1 }}>
                          {s.eligibility}
                          {todayCount > 0 && (
                            <span style={{ color: "var(--green)", fontWeight: 600, marginLeft: 8 }}>
                              · {todayCount} logged today
                            </span>
                          )}
                        </div>
                        {/* Accommodation pills — fewer in compact mode to save vertical space */}
                        {Array.isArray(s.accs) && s.accs.length > 0 && !compact && (
                          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 6 }}>
                            {s.accs.slice(0, M.accLimit).map(a => (
                              <span key={a} className="pill pill-accent" style={{ fontSize: 10 }}>{a}</span>
                            ))}
                            {s.accs.length > M.accLimit && (
                              <span style={{ fontSize: 10, color: "var(--text-muted)" }}>+{s.accs.length - M.accLimit}</span>
                            )}
                          </div>
                        )}
                        {Array.isArray(s.accs) && s.accs.length > 0 && compact && (
                          <div style={{ marginTop: 4, fontSize: 10, color: "var(--text-muted)" }}>
                            <span className="pill pill-accent" style={{ fontSize: 10 }}>{s.accs.length} acc</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* ALL 6 CATEGORY QUICK-TAPS + note */}
                    <div
                      style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}
                      onClick={e => e.stopPropagation()}
                    >
                      {QUICK_CATEGORIES.map(cat => {
                        const count = byCat[cat.id] || 0;
                        return (
                          <button
                            key={cat.id}
                            onClick={e => handleQuickLog(e, id, cat.id)}
                            onDoubleClick={e => handleCategoryDoubleClick(e, id, cat.id)}
                            title={`Tap: log ${cat.label}. Double-tap: add detail.${count > 0 ? ` (${count} today)` : ''}`}
                            className="sm-qa-btn"
                            style={{
                              position: "relative",
                              width: M.qaSize, height: M.qaSize,
                              minWidth: M.qaSize, minHeight: M.qaSize,
                              borderRadius: "var(--radius-md)",
                              border: `1px solid ${cat.color}40`,
                              background: count > 0 ? cat.color + "20" : "var(--bg-dark)",
                              color: cat.color,
                              cursor: "pointer",
                              fontSize: M.qaIcon, lineHeight: 1,
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

                      {/* +note opens the focus-row expansion in place */}
                      <button
                        onClick={() => swapFocus(id)}
                        title="Expand this row to write a longer note"
                        className="sm-qa-btn"
                        style={{
                          height: M.qaSize, minHeight: M.qaSize,
                          padding: compact ? "0 10px" : "0 14px",
                          borderRadius: "var(--radius-md)",
                          border: focusedStudentId === id ? `1px solid ${s.color}` : "1px solid var(--border-light)",
                          background: focusedStudentId === id ? `${s.color}20` : "var(--bg-dark)",
                          color: focusedStudentId === id ? s.color : "var(--text-secondary)",
                          cursor: "pointer", fontSize: compact ? 12 : 13, fontWeight: 600,
                          fontFamily: "inherit",
                          display: "flex", alignItems: "center", gap: 6,
                        }}
                      >
                        📝 {compact ? "" : "Note"}
                      </button>
                    </div>
                  </div>

                  {/* Focus-row expansion — opens when a student's name or 📝 Note
                      is tapped. Sticky back-bar, larger textarea, accommodation
                      pills, goal-chip block, and quick note templates.
                      Switching students auto-saves the current draft. */}
                  {focusedStudentId === id && (
                    <div
                      style={{
                        padding: "12px 14px",
                        borderTop: `2px solid ${s.color}40`,
                        background: `${s.color}08`,
                        display: "flex", flexDirection: "column", gap: 12,
                      }}
                      onKeyDown={e => {
                        if (e.key === "Escape") { e.preventDefault(); closeFocus(); }
                      }}
                    >
                      {/* Sticky back-to-class-view bar — gives the para a single,
                          unmissable exit. Sits above everything else in the panel. */}
                      <div style={{
                        position: "sticky", top: 0, zIndex: 5,
                        marginTop: -12, marginLeft: -14, marginRight: -14, marginBottom: 0,
                        padding: "10px 14px",
                        background: `linear-gradient(180deg, ${s.color}25, ${s.color}08)`,
                        borderBottom: `1px solid ${s.color}40`,
                        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                        flexWrap: "wrap",
                      }}>
                        <button
                          type="button"
                          onClick={closeFocus}
                          aria-label="Back to class view"
                          style={{
                            minHeight: 44, padding: "10px 14px",
                            borderRadius: "var(--radius-md)",
                            background: "var(--bg-dark)", color: s.color,
                            border: `1px solid ${s.color}60`,
                            fontSize: 13, fontWeight: 700, fontFamily: "inherit",
                            cursor: "pointer",
                            display: "inline-flex", alignItems: "center", gap: 6,
                          }}
                        >
                          ← Back to class view
                        </button>
                        <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>
                          Focused on <PrivacyName>{label}</PrivacyName>
                        </span>
                      </div>

                      {/* Accommodation pills */}
                      {Array.isArray(s.accs) && s.accs.length > 0 && (
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                          <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", color: "var(--text-muted)", marginRight: 4 }}>
                            Accommodations
                          </span>
                          {s.accs.slice(0, 4).map(a => (
                            <span key={`acc-${a}`} className="pill pill-accent" style={{ fontSize: 11 }}>
                              {a}
                            </span>
                          ))}
                          {s.accs.length > 4 && (
                            <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                              +{s.accs.length - 4} more
                            </span>
                          )}
                        </div>
                      )}

                      {/* Goal chip block — replaces the old italic line.
                          Shows up to 2 goals as cards with a status dot and
                          a "next step" cue derived from the goal text. */}
                      {Array.isArray(s.goals) && s.goals.length > 0 && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", color: "var(--text-muted)" }}>
                            Active goals
                          </span>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(0, 1fr))", gap: 8 }}>
                            {s.goals.slice(0, 2).map((g, gi) => {
                              const text = (typeof g === 'string' ? g : (g?.text || '')).trim();
                              if (!text) return null;
                              const status = (typeof g === 'object' && g?.status) || 'active';
                              const statusColor = status === 'met' ? '#34d399'
                                : status === 'at_risk' ? '#fbbf24'
                                : '#60a5fa';
                              const nextStep = (typeof g === 'object' && g?.nextStep) || 'Support today';
                              return (
                                <div key={`goal-${gi}`} style={{
                                  padding: "8px 10px",
                                  background: "var(--bg-dark)",
                                  border: `1px solid ${statusColor}40`,
                                  borderLeft: `3px solid ${statusColor}`,
                                  borderRadius: "var(--radius-sm)",
                                  display: "flex", flexDirection: "column", gap: 4,
                                  minWidth: 0,
                                }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: statusColor, flexShrink: 0 }} />
                                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                      {text.length > 80 ? text.slice(0, 80) + '…' : text}
                                    </span>
                                  </div>
                                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                                    Next: {nextStep}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Note-template chips — pre-fill common sentence starters */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", color: "var(--text-muted)" }}>
                          Quick starters
                        </span>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {NOTE_TEMPLATES.map(tpl => (
                            <button
                              key={tpl.id}
                              type="button"
                              onClick={() => {
                                setFocusedDraft(prev => insertTemplate(prev, tpl.id));
                                setTimeout(() => focusedRef.current?.focus(), 0);
                              }}
                              title={`Insert: "${tpl.text.trim()}"`}
                              style={{
                                minHeight: 36, padding: "6px 12px",
                                borderRadius: "var(--radius-pill)",
                                border: `1px solid ${s.color}40`,
                                background: "var(--bg-dark)",
                                color: s.color,
                                fontSize: 12, fontWeight: 600, fontFamily: "inherit",
                                cursor: "pointer",
                                transition: "all 120ms cubic-bezier(0.16,1,0.3,1)",
                              }}
                              onMouseEnter={e => { e.currentTarget.style.background = `${s.color}20`; }}
                              onMouseLeave={e => { e.currentTarget.style.background = "var(--bg-dark)"; }}
                            >
                              {tpl.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <textarea
                        ref={focusedRef}
                        autoFocus
                        spellCheck="true"
                        lang="en"
                        value={focusedDraft}
                        onChange={e => setFocusedDraft(e.target.value)}
                        placeholder={`What happened with ${label}? Type freely — saves automatically when you switch students.`}
                        style={{
                          width: "100%",
                          minHeight: M.noteMin,
                          padding: compact ? "10px 12px" : "14px 16px",
                          background: "var(--bg-dark)",
                          border: `1px solid ${s.color}40`,
                          borderRadius: "var(--radius-md)",
                          color: "var(--text-primary)",
                          fontSize: M.noteFont, lineHeight: 1.55, fontFamily: "inherit",
                          resize: "vertical",
                        }}
                      />

                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <button
                          type="button"
                          onClick={closeFocus}
                          className="btn btn-primary"
                          style={{ minHeight: 48, padding: "0 18px", fontSize: 14, fontWeight: 700 }}
                          title="Save this note and close the focus area (Esc also works)"
                        >
                          Save & Done
                        </button>
                        <button
                          type="button"
                          onClick={() => { setFocusedDraft(''); setFocusedStudentId(null); }}
                          className="btn btn-ghost"
                          style={{ minHeight: 48, padding: "0 14px", color: "var(--text-muted)" }}
                          title="Discard the draft and close"
                        >
                          Cancel (no save)
                        </button>
                        {focusedDraft.trim() && (
                          <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 4 }}>
                            Auto-saves as a General Observation log when you tap Save or switch students.
                          </span>
                        )}
                      </div>
                    </div>
                  )}

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
                  <div style={{ fontSize: 17, fontWeight: 700, color: s.color }}><PrivacyName>{resolveLabel(s, "compact")}</PrivacyName></div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 1 }}>{s.eligibility}</div>
                </div>
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 10, fontWeight: 600 }}>
                What's happening? <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(tap one or skip)</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {QUICK_CATEGORIES.map(cat => (
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
              <textarea ref={noteTextRef} spellCheck="true" lang="en" value={noteText} onChange={e => setNoteText(e.target.value)}
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
