// ══════════════════════════════════════════════════════════════
// DASHBOARD — Fast UX, 1-click logging, resizable, saved layout
// ══════════════════════════════════════════════════════════════
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { DB } from '../../data';
import { getHealth, hdot } from '../../models';
import { resolveLabel } from '../../privacy/nameResolver';
import { parseDocForPeriod, matchCaseKeywords } from '../../engine';
import { OllamaStatusBadge } from '../../components/OllamaStatusBadge';
import { HelpButton } from '../help';
import { ShowcaseBanner } from '../showcase';
import { DEMO_INCIDENTS, DEMO_INTERVENTIONS, DEMO_OUTCOMES, DEMO_LOGS } from '../../data/demoSeedData';

// ── Constants ────────────────────────────────────────────────
const LAYOUT_KEY  = "dashLayoutV3";
const topicKey    = (pid, date) => `classTopic_${pid}_${date}`;

// One-tap action types — each maps to a log type
const DASH_ACTIONS = [
  { id: "obs",  icon: "✓",  label: "Observed",      type: "General Observation", border: "#166534", bg: "#0d2010", color: "#4ade80" },
  { id: "part", icon: "🙋", label: "Participated",  type: "Participation",        border: "#1d4ed8", bg: "#0c1a2e", color: "#60a5fa" },
  { id: "beh",  icon: "⚠",  label: "Behavior",      type: "Behavior Incident",   border: "#854d0e", bg: "#1a1505", color: "#fbbf24", needsNote: true },
  { id: "goal", icon: "★",  label: "Goal Check",    type: "Goal Progress",       border: "#6d28d9", bg: "#1e1b4b", color: "#a78bfa" },
  { id: "brk",  icon: "☕",  label: "Break",         type: "Break Taken",         border: "#0e7490", bg: "#041e28", color: "#67e8f9" },
  { id: "acc",  icon: "♿",  label: "Accommodation", type: "Accommodation Used",  border: "#0f766e", bg: "#041a18", color: "#2dd4bf" },
  { id: "esc",  icon: "🔴", label: "Escalation",    type: "Escalation",          border: "#7f1d1d", bg: "#1a0505", color: "#f87171", needsNote: true },
  { id: "note", icon: "📝", label: "Add Note",       type: "General Note",        border: "#334155", bg: "#0f172a", color: "#94a3b8", needsNote: true },
];

const HEALTH_STYLE = {
  green:  { bg: "#0d2010", color: "#4ade80", border: "#166534" },
  yellow: { bg: "#1a1505", color: "#fbbf24", border: "#854d0e" },
  red:    { bg: "#1a0505", color: "#f87171", border: "#7f1d1d" },
};

// ── Small util: localStorage hook ────────────────────────────
function useLS(key, def) {
  const [val, setVal] = useState(() => {
    try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : def; } catch { return def; }
  });
  const set = useCallback((v) => {
    setVal(prev => {
      const next = typeof v === "function" ? v(prev) : v;
      try { localStorage.setItem(key, JSON.stringify(next)); } catch {}
      return next;
    });
  }, [key]);
  return [val, set];
}

// ═════════════════════════════════════════════════════════════
// MAIN DASHBOARD COMPONENT
// ═════════════════════════════════════════════════════════════
export function Dashboard({
  period, activePeriod, effectivePeriodStudents, allStudents,
  logs, addLog, currentDate,
  ollamaOnline, ollamaModel, ollamaLoading,
  askAI, aiLoading, handleOllamaSuggestions,
  currentChat, chatInput, setChatInput, handleChat,
  chatMode, setChatMode,
  chatEndRef,
  docContent, docLink, setDocLink, fetchDoc, docLoading,
  setProfileStu,
  caseMemory,
  onLoadDemo,
  onClearDemo,
}) {
  // ── Persisted layout ──────────────────────────────────────
  const [layout, setLayout] = useLS(LAYOUT_KEY, { cols: 2, chatOpen: false, chatH: 320 });
  const [topic, setTopic]   = useLS(topicKey(activePeriod, currentDate), "");
  // 'write' = type the topic in the app; 'fetch' = pull from Google Doc URL;
  // 'none' = skip (no plan today). Persisted per-period-per-day.
  const [planMode, setPlanMode] = useLS(`planMode_${activePeriod}_${currentDate}`, 'write');

  // ── Ephemeral UI state ───────────────────────────────────
  const [topicEdit,   setTopicEdit]   = useState(false);
  const [topicDraft,  setTopicDraft]  = useState(topic);
  const [exportOpen,  setExportOpen]  = useState(false);
  const [activeAction, setActiveAction] = useState(null); // class-wide action selector
  const [noteTarget,  setNoteTarget]  = useState(null);   // { studentId, action }
  const [noteDraft,   setNoteDraft]   = useState("");
  const [toast,       setToast]       = useState(null);
  const toastRef = useRef();

  // ── Chat resize drag ─────────────────────────────────────
  const chatResizeRef = useRef();
  const startChatResize = useCallback((e) => {
    e.preventDefault();
    const startY = e.clientY, startH = layout.chatH;
    const move = ev => setLayout(l => ({ ...l, chatH: Math.max(160, Math.min(680, startH - (ev.clientY - startY))) }));
    const up   = () => { document.removeEventListener("mousemove", move); document.removeEventListener("mouseup", up); };
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
  }, [layout.chatH, setLayout]);

  // Sync topic draft when switching periods / dates
  useEffect(() => { setTopicDraft(topic); }, [activePeriod, currentDate]);

  const showToast = useCallback((msg) => {
    setToast(msg);
    clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => setToast(null), 2400);
  }, []);

  // ── 1-click log ──────────────────────────────────────────
  const quickLog = useCallback((studentId, action, extraNote = "") => {
    const s = allStudents[studentId] || {};
    const note = extraNote.trim() || (topic ? `${action.type} — ${topic}` : action.type);
    addLog(studentId, note, action.type);
    showToast(`✅ ${action.label} → ${resolveLabel(s, "compact")}`);
    setActiveAction(null);
    setNoteTarget(null);
    setNoteDraft("");
  }, [allStudents, topic, addLog, showToast]);

  const handleCardAction = useCallback((studentId, action, e) => {
    e.stopPropagation();
    if (action.needsNote) { setNoteTarget({ studentId, action }); setNoteDraft(""); }
    else quickLog(studentId, action);
  }, [quickLog]);

  const handleClassTap = useCallback((studentId) => {
    if (!activeAction) return;
    if (activeAction.needsNote) { setNoteTarget({ studentId, action: activeAction }); setNoteDraft(""); }
    else quickLog(studentId, activeAction);
  }, [activeAction, quickLog]);

  const saveTopic = useCallback(() => {
    setTopic(topicDraft);
    setTopicEdit(false);
    if (topicDraft.trim()) showToast("📚 Topic saved");
  }, [topicDraft, setTopic, showToast]);

  const logTopic = useCallback(() => {
    if (!topic.trim() || !effectivePeriodStudents.length) return;
    addLog(effectivePeriodStudents[0], `CLASS TOPIC [${period.label}]: ${topic}`, "Class Note");
    showToast("📋 Topic logged to session");
  }, [topic, effectivePeriodStudents, addLog, period, showToast]);

  const docSnippet = docContent ? parseDocForPeriod(docContent, period.label || "") : null;

  // ── Inline case memory suggestions ───────────────────────
  const caseSuggestions = useMemo(() => {
    if (!noteTarget || !noteDraft || !caseMemory) return [];
    return matchCaseKeywords(noteDraft, caseMemory.incidents, caseMemory.interventions, caseMemory.outcomes, 3);
  }, [noteDraft, noteTarget, caseMemory]);

  // ── Styles ────────────────────────────────────────────────
  const card   = { borderRadius: "var(--radius-lg)", overflow: "hidden" };
  const panel  = { background: "var(--panel-bg)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden" };
  const sectionHdr = { padding: "var(--space-3) var(--space-4)", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", userSelect: "none" };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>

      {/* ══ HERO HEADER ═════════════════════════════════════ */}
      <div style={{
        margin: "var(--space-5) var(--space-6) var(--space-4)",
        padding: "var(--space-5) var(--space-6)",
        background: "linear-gradient(135deg, var(--panel-raised) 0%, var(--panel-bg) 100%)",
        border: "1px solid var(--border-light)",
        borderRadius: "var(--radius-xl)",
        boxShadow: "var(--shadow-md)",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        flexShrink: 0, gap: "var(--space-4)", flexWrap: "wrap",
        position: "relative", overflow: "hidden",
      }}>
        {/* Single accent bar — quiet */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 2,
          background: "var(--accent)", opacity: 0.5,
        }} />

        <div style={{ position: "relative", zIndex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 11, color: "var(--text-muted)",
            textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 600,
          }}>
            Now Supporting
          </div>
          <div style={{
            fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em",
            color: "var(--text-primary)", lineHeight: 1.15, marginTop: 4,
          }}>
            {period.label}
          </div>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span className="pill pill-accent" style={{ fontSize: 11 }}>
              {period.teacher}
            </span>
            <span>·</span>
            <span style={{ color: "var(--text-primary)", fontWeight: 700 }}>
              {effectivePeriodStudents.length}
            </span>
            <span>IEP students</span>
          </div>
        </div>

        <div style={{
          position: "relative", zIndex: 1,
          display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap",
        }}>
          <OllamaStatusBadge online={ollamaOnline} modelName={ollamaModel} />
          <span className="mono" style={{
            fontSize: 11, color: "var(--text-secondary)",
            background: "var(--bg-dark)",
            padding: "6px 12px",
            borderRadius: "var(--radius-pill)",
            border: "1px solid var(--border)",
            letterSpacing: "0.02em", fontWeight: 600,
          }}>
            {new Date(currentDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
          </span>
          {/* Column selector */}
          <div
            title="Student card columns"
            style={{
              display: "flex", gap: 2,
              background: "var(--bg-dark)",
              borderRadius: "var(--radius-md)",
              padding: 3,
              border: "1px solid var(--border)",
            }}
          >
            {[1,2,3].map(n => (
              <button key={n} onClick={() => setLayout(l => ({ ...l, cols: n }))}
                title={`${n} column${n>1?"s":""}`}
                style={{
                  width: 32, height: 28,
                  borderRadius: "var(--radius-sm)", border: "none", cursor: "pointer",
                  background: layout.cols === n ? "var(--accent-strong)" : "transparent",
                  color: layout.cols === n ? "#fff" : "var(--text-muted)",
                  fontSize: 11, fontWeight: 700, lineHeight: 1,
                  transition: "all 120ms cubic-bezier(0.16,1,0.3,1)",
                }}>
                {"▮".repeat(n)}
              </button>
            ))}
          </div>
          <button
            onClick={() => setLayout(l => ({ ...l, chatOpen: !l.chatOpen }))}
            className="btn btn-secondary btn-sm"
            style={{
              minHeight: 36,
              ...(layout.chatOpen && {
                background: 'var(--accent-glow)',
                borderColor: 'var(--accent-border)',
                color: 'var(--accent-hover)',
              }),
            }}
          >
            💬 Copilot
          </button>
        </div>
      </div>

      {/* ══ SCROLLABLE BODY ══════════════════════════════════ */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 var(--space-6) var(--space-6)", display: "flex", flexDirection: "column", gap: "var(--space-4)", minHeight: 0 }}>

        {/* ── TODAY'S PLAN CARD (merged Topic + Class Notes Doc) ─ */}
        <div style={{
          background: "var(--panel-bg)",
          border: `1px solid ${(topic || docContent) ? "var(--accent-border)" : "var(--border)"}`,
          borderRadius: "var(--radius-xl)",
          overflow: "hidden",
          transition: "all 200ms cubic-bezier(0.16,1,0.3,1)",
          boxShadow: "var(--shadow-sm)",
        }}>
          {/* Header row: icon + label + mode selector + export */}
          <div style={{
            padding: "var(--space-4) var(--space-5)",
            display: "flex", alignItems: "center", gap: "var(--space-3)",
            flexWrap: "wrap",
          }}>
            <div style={{
              width: 44, height: 44,
              background: (topic || docContent) ? "var(--accent-strong)" : "var(--bg-dark)",
              borderRadius: "var(--radius-md)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 20, flexShrink: 0,
            }}>
              📚
            </div>
            <div style={{ flex: 1, minWidth: 160 }}>
              <div style={{
                fontSize: 10, fontWeight: 700,
                textTransform: "uppercase", letterSpacing: "0.1em",
                color: (topic || docContent) ? "var(--accent-hover)" : "var(--text-muted)",
              }}>
                Today's Plan
              </div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>
                What are we doing today?
              </div>
            </div>
            {/* Mode selector — pill segmented control */}
            <div style={{
              display: "flex", gap: 2,
              background: "var(--bg-dark)",
              borderRadius: "var(--radius-md)",
              padding: 3,
              border: "1px solid var(--border)",
            }}>
              {[
                ["write", "✏️ Write it"],
                ["fetch", "📄 Get from link"],
                ["none",  "— Skip"],
              ].map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setPlanMode(id)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "var(--radius-sm)",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 12, fontWeight: 600,
                    fontFamily: "inherit",
                    background: planMode === id ? "var(--accent-strong)" : "transparent",
                    color: planMode === id ? "#fff" : "var(--text-secondary)",
                    transition: "all 120ms cubic-bezier(0.16,1,0.3,1)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setExportOpen(true)}
              className="btn btn-secondary btn-sm"
              title="Format today's plan + logs as text to paste into your Class Notes doc"
              style={{ whiteSpace: "nowrap" }}
            >
              📋 Export today
            </button>
          </div>

          {/* Body — conditional on mode */}
          {planMode === "write" && (
            <div style={{
              padding: "var(--space-3) var(--space-5) var(--space-4)",
              borderTop: "1px solid var(--border)",
            }}>
              {!topicEdit ? (
                <div
                  onClick={() => { setTopicEdit(true); setTopicDraft(topic); }}
                  style={{
                    cursor: "pointer", userSelect: "none",
                    padding: "var(--space-2) 0",
                    display: "flex", gap: "var(--space-3)", alignItems: "center",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {topic ? (
                      <div style={{
                        fontSize: 17, fontWeight: 700, color: "var(--text-primary)",
                        whiteSpace: "pre-wrap", wordBreak: "break-word",
                      }}>{topic}</div>
                    ) : (
                      <div style={{ fontSize: 13, color: "var(--text-dim)", fontStyle: "italic" }}>
                        Tap to set today's lesson focus — what you're teaching, what to watch for, etc.
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    {topic && (
                      <button
                        onClick={e => { e.stopPropagation(); logTopic(); }}
                        title="Log this topic as a Class Note"
                        className="btn btn-secondary btn-sm"
                        style={{ color: "var(--green)", borderColor: "rgba(52,211,153,0.3)" }}
                      >
                        📋 Log
                      </button>
                    )}
                    <button className="btn btn-primary btn-sm">
                      {topic ? "✏ Edit" : "+ Set"}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <textarea
                    autoFocus
                    value={topicDraft}
                    onChange={e => setTopicDraft(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveTopic(); } }}
                    placeholder={`e.g. "Decimals — converting fractions with manipulatives"\n\nPress Enter to save, Shift+Enter for new line.`}
                    className="data-textarea"
                    style={{ height: 90 }}
                  />
                  <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-2)" }}>
                    <button onClick={saveTopic} className="btn btn-primary" style={{ flex: 1 }}>
                      ✓ Save
                    </button>
                    <button onClick={() => { setTopicEdit(false); setTopicDraft(topic); }}
                            className="btn btn-secondary">
                      Cancel
                    </button>
                    {topicDraft.trim() && (
                      <button
                        onClick={() => { setTopic(""); setTopicEdit(false); setTopicDraft(""); showToast("Topic cleared"); }}
                        className="btn btn-secondary"
                        style={{ color: "var(--red)", borderColor: "rgba(248,113,113,0.3)" }}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {planMode === "fetch" && (
            <div style={{
              padding: "var(--space-3) var(--space-5) var(--space-4)",
              borderTop: "1px solid var(--border)",
              display: "flex", flexDirection: "column", gap: "var(--space-2)",
            }}>
              <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center", flexWrap: "wrap" }}>
                <input
                  value={docLink}
                  onChange={e => setDocLink(e.target.value)}
                  placeholder="Paste Google Doc link for today's lesson notes…"
                  className="chat-input"
                  style={{ flex: 1, minWidth: 220 }}
                />
                <button
                  onClick={fetchDoc}
                  disabled={docLoading || !docLink.trim()}
                  className={docContent ? "btn btn-secondary" : "btn btn-primary"}
                  style={{
                    color: docContent ? "var(--green)" : undefined,
                    borderColor: docContent ? "rgba(52,211,153,0.35)" : undefined,
                  }}
                >
                  {docLoading ? "Fetching…" : docContent ? "✓ Loaded" : "Fetch"}
                </button>
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.5 }}>
                The doc must be <b>"Anyone with the link can view"</b>. The app pulls the text, finds
                the section for this period, and shows a snippet below.
              </div>
              {docSnippet && (
                <div style={{
                  padding: "var(--space-3)",
                  background: "var(--bg-dark)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md)",
                  marginTop: "var(--space-2)",
                }}>
                  <span className="pill pill-accent" style={{ fontSize: 10 }}>
                    📄 Class Notes · {period.label}
                  </span>
                  <div style={{
                    fontSize: 12.5, color: "var(--text-primary)",
                    lineHeight: 1.55, marginTop: 6, whiteSpace: "pre-wrap",
                  }}>
                    {docSnippet.slice(0, 500)}{docSnippet.length > 500 ? "…" : ""}
                  </div>
                </div>
              )}
            </div>
          )}

          {planMode === "none" && (
            <div style={{
              padding: "var(--space-3) var(--space-5) var(--space-4)",
              borderTop: "1px solid var(--border)",
              fontSize: 12.5, color: "var(--text-muted)", fontStyle: "italic",
            }}>
              No plan set for today. Your student logs still export normally.
            </div>
          )}
        </div>

        {/* ── CLASS-WIDE QUICK ACTION BAR ───────────────── */}
        <div className="panel" style={{ padding: "var(--space-4) var(--space-5)" }}>
          <div style={{
            fontSize: 11, fontWeight: 700,
            textTransform: "uppercase", letterSpacing: "0.1em",
            color: activeAction ? "var(--accent-hover)" : "var(--text-muted)",
            marginBottom: "var(--space-3)",
            display: "flex", alignItems: "center", gap: "var(--space-2)",
          }}>
            {activeAction ? (
              <>
                <span style={{ color: "var(--accent)" }}>▶</span>
                Tap a student card below to log "{activeAction.label}"
              </>
            ) : "Quick Log — tap an action, then tap a student"}
          </div>
          <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
            {DASH_ACTIONS.map(action => {
              const active = activeAction?.id === action.id;
              return (
                <button
                  key={action.id}
                  onClick={() => setActiveAction(prev => prev?.id === action.id ? null : action)}
                  style={{
                    minHeight: 44,
                    padding: "var(--space-2) var(--space-4)",
                    borderRadius: "var(--radius-md)",
                    border: `1.5px solid ${active ? action.border : "var(--border)"}`,
                    background: active ? action.bg : "var(--bg-dark)",
                    color: active ? action.color : "var(--text-secondary)",
                    cursor: "pointer",
                    fontSize: 13, fontWeight: active ? 700 : 500,
                    fontFamily: "inherit",
                    transition: "all 160ms cubic-bezier(0.16,1,0.3,1)",
                    transform: active ? "translateY(-1px)" : "translateY(0)",
                    boxShadow: active
                      ? `0 6px 20px ${action.bg}, inset 0 1px 0 rgba(255,255,255,0.08)`
                      : "var(--shadow-sm)",
                    display: "inline-flex", alignItems: "center", gap: 6,
                  }}
                >
                  <span style={{ fontSize: 15 }}>{action.icon}</span> {action.label}
                </button>
              );
            })}
            {activeAction && (
              <button
                onClick={() => setActiveAction(null)}
                className="btn btn-secondary"
                style={{
                  minHeight: 44,
                  color: "var(--red)",
                  borderColor: "rgba(248,113,113,0.3)",
                }}
              >
                ✕ Cancel
              </button>
            )}
          </div>
        </div>

        {/* ── SHOWCASE BANNER ────────────────────────────── */}
        {onLoadDemo && (
          <ShowcaseBanner
            onLoadDemo={() => onLoadDemo({ incidents: DEMO_INCIDENTS, interventions: DEMO_INTERVENTIONS, outcomes: DEMO_OUTCOMES, logs: DEMO_LOGS })}
            hasLogs={logs.length > 0}
            hasCaseData={caseMemory && caseMemory.incidents.length > 0}
          />
        )}

        {/* ── STUDENT GRID ──────────────────────────────── */}
        <div style={{
          display: "grid",
          gridTemplateColumns: `repeat(${layout.cols}, 1fr)`,
          gap: "var(--space-3)",
        }}>
          {effectivePeriodStudents.map(id => {
            const s = allStudents[id];
            if (!s) return null;
            const health    = getHealth(id, logs, currentDate);
            const hStyle    = HEALTH_STYLE[health] || HEALTH_STYLE.green;
            const stuLogs   = logs.filter(l => l.studentId === id);
            const todayLogs = stuLogs.filter(l => l.date === currentDate);
            const lastLog   = stuLogs[0];
            const isTarget  = activeAction !== null;

            return (
              <div
                key={id}
                onClick={isTarget ? () => handleClassTap(id) : undefined}
                style={{
                  borderRadius: "var(--radius-lg)",
                  overflow: "hidden",
                  background: `linear-gradient(180deg, ${s.color}0a 0%, var(--panel-bg) 40%)`,
                  border: `1px solid ${isTarget ? s.color : s.color + "30"}`,
                  cursor: isTarget ? "pointer" : "default",
                  transition: "all 200ms cubic-bezier(0.16,1,0.3,1)",
                  boxShadow: isTarget
                    ? `0 12px 32px ${s.color}28, 0 0 0 1px ${s.color}60`
                    : "var(--shadow-sm)",
                  transform: isTarget ? "translateY(-2px)" : "translateY(0)",
                  position: "relative",
                }}
              >
                {/* Color-coded accent stripe */}
                <div style={{
                  position: "absolute", top: 0, left: 0, right: 0, height: 3,
                  background: s.color, opacity: 0.9,
                }} />

                {/* Alert banner — v2 students with alertText or alert flag */}
                {(s.alertText || s.flags?.alert) && (
                  <div style={{
                    padding: "var(--space-1) var(--space-3)",
                    background: "var(--red-muted)",
                    borderBottom: "1px solid rgba(248,113,113,0.3)",
                    fontSize: 10, color: "var(--red)", fontWeight: 700,
                    letterSpacing: "0.02em",
                  }}>
                    ⚠ {s.alertText || "Alert flag set"}
                  </div>
                )}

                {/* Card header — tap to open profile */}
                <div
                  onClick={e => { if (!isTarget) { e.stopPropagation(); setProfileStu(id); } }}
                  style={{
                    padding: "var(--space-4) var(--space-4) var(--space-3)",
                    display: "flex", justifyContent: "space-between", alignItems: "flex-start",
                    gap: "var(--space-2)",
                  }}
                >
                  <div style={{ cursor: isTarget ? "default" : "pointer", minWidth: 0, flex: 1 }}>
                    <div style={{
                      fontSize: 18, fontWeight: 800,
                      color: s.color, lineHeight: 1.15,
                      letterSpacing: "-0.01em",
                    }}>
                      {resolveLabel(s, "compact")}
                    </div>
                    <div style={{
                      display: "flex", gap: 6, alignItems: "center",
                      flexWrap: "wrap", marginTop: 4,
                    }}>
                      <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>
                        {s.eligibility}
                      </span>
                      {s.flags?.iepNotYetOnFile && (
                        <span className="pill pill-yellow" style={{ fontSize: 9, padding: "1px 6px" }}>
                          IEP Pending
                        </span>
                      )}
                      {s.flags?.crossPeriod && (
                        <span className="pill pill-accent" style={{ fontSize: 9, padding: "1px 6px" }}>
                          Multi-Period
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{
                    display: "flex", flexDirection: "column",
                    alignItems: "flex-end", gap: 4, flexShrink: 0,
                  }}>
                    <span style={{ fontSize: 18 }}>{hdot(health)}</span>
                    <span style={{
                      fontSize: 10, fontWeight: 600,
                      color: hStyle.color, background: hStyle.bg,
                      padding: "2px 8px", borderRadius: "var(--radius-pill)",
                      border: `1px solid ${hStyle.border}`,
                      whiteSpace: "nowrap",
                    }}>
                      {todayLogs.length} today
                    </span>
                  </div>
                </div>

                {/* Accommodations pills */}
                <div style={{
                  padding: "var(--space-2) var(--space-4)",
                  display: "flex", flexWrap: "wrap", gap: 4,
                  minHeight: 34, alignItems: "center",
                  borderTop: "1px solid var(--border)",
                }}>
                  {(s.accs || []).slice(0, 3).map(a => (
                    <span key={a} style={{
                      fontSize: 10,
                      background: "var(--accent-glow)",
                      color: "var(--accent-hover)",
                      padding: "2px 8px",
                      borderRadius: "var(--radius-pill)",
                      border: "1px solid var(--accent-border)",
                      fontWeight: 500,
                    }}>
                      {a}
                    </span>
                  ))}
                  {(s.accs || []).length > 3 && (
                    <span style={{ fontSize: 10, color: "var(--text-dim)", fontWeight: 600 }}>
                      +{s.accs.length - 3}
                    </span>
                  )}
                  {(!s.accs || s.accs.length === 0) && (
                    <span style={{ fontSize: 10, color: "var(--text-dim)", fontStyle: "italic" }}>
                      No accommodations listed
                    </span>
                  )}
                </div>

                {/* 1-click action buttons */}
                <div style={{
                  padding: "var(--space-3) var(--space-3) var(--space-2)",
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 6,
                  borderTop: "1px solid var(--border)",
                }}>
                  {DASH_ACTIONS.slice(0, 6).map(action => (
                    <button
                      key={action.id}
                      onClick={e => handleCardAction(id, action, e)}
                      title={`Log: ${action.type} for ${resolveLabel(s, "compact")}`}
                      style={{
                        minHeight: 38,
                        padding: "6px 8px",
                        borderRadius: "var(--radius-md)",
                        border: `1px solid ${action.border}55`,
                        background: action.bg,
                        color: action.color,
                        cursor: "pointer",
                        fontSize: 12, fontWeight: 700,
                        fontFamily: "inherit",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 4,
                        whiteSpace: "nowrap",
                        transition: "all 120ms cubic-bezier(0.16,1,0.3,1)",
                      }}
                      onMouseEnter={e => { e.currentTarget.style.filter = "brightness(1.15)"; }}
                      onMouseLeave={e => { e.currentTarget.style.filter = "brightness(1)"; }}
                    >
                      {action.icon} {action.label}
                    </button>
                  ))}
                </div>

                {/* Last log preview */}
                <div style={{
                  padding: "var(--space-2) var(--space-4) var(--space-3)",
                  fontSize: 11,
                  color: lastLog ? "var(--text-muted)" : "var(--text-dim)",
                }}>
                  {lastLog ? (
                    <>
                      <span style={{ color: "var(--text-dim)" }}>Last: </span>
                      <span style={{ color: "var(--text-secondary)", fontWeight: 500 }}>
                        {lastLog.type}
                      </span>
                      <span style={{ color: "var(--text-dim)" }}>
                        {" · "}
                        {lastLog.date === currentDate ? "today" : lastLog.date}
                      </span>
                    </>
                  ) : (
                    <span style={{ fontStyle: "italic" }}>No logs yet this session</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

      </div>{/* end scrollable body */}

      {exportOpen && (
        <ExportTodayModal
          period={period}
          activePeriod={activePeriod}
          currentDate={currentDate}
          topic={topic}
          docSnippet={docSnippet}
          logs={logs}
          allStudents={allStudents}
          onClose={() => setExportOpen(false)}
        />
      )}

      {/* ══ PARA COPILOT — docked to bottom, resizable ══════ */}
      {layout.chatOpen && (
        <div style={{ flexShrink: 0, background: "#050b18", borderTop: "1px solid #141f33", display: "flex", flexDirection: "column", height: layout.chatH }}>

          {/* Drag handle */}
          <div ref={chatResizeRef} onMouseDown={startChatResize}
            style={{ height: "6px", cursor: "ns-resize", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <div style={{ width: "40px", height: "3px", background: "#1e293b", borderRadius: "3px" }} />
          </div>

          {/* Chat header */}
          <div style={{ padding: "6px 14px", borderBottom: "1px solid #141f33", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <span style={{ fontSize: "13px", fontWeight: "700", color: "#e2e8f0" }}>Para Copilot</span>
              <span style={{ fontSize: "10px", background: "#0d2010", color: "#4ade80", padding: "2px 8px", borderRadius: "20px", border: "1px solid #166534" }}>Engine</span>
              <OllamaStatusBadge online={ollamaOnline} modelName={ollamaModel} />
            </div>
            <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
              <div style={{ display: "flex", gap: "2px", background: "#0f172a", borderRadius: "6px", padding: "2px" }}>
                {["period", "master"].map(m => (
                  <button key={m} onClick={() => setChatMode(m)}
                    style={{ padding: "3px 9px", borderRadius: "4px", border: "none", cursor: "pointer", fontSize: "10px", background: chatMode === m ? (m === "master" ? "#f59e0b" : "#3b82f6") : "transparent", color: chatMode === m ? (m === "master" ? "#000" : "#fff") : "#475569", fontWeight: chatMode === m ? "700" : "400" }}>
                    {m === "period" ? "This Period" : "Master"}
                  </button>
                ))}
              </div>
              <button onClick={() => setLayout(l => ({ ...l, chatOpen: false }))}
                style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: "18px", lineHeight: 1, padding: "0 4px" }}>×</button>
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "8px 14px" }}>
            {currentChat.map((msg, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: msg.sender === "user" ? "flex-end" : "flex-start", gap: "4px", marginBottom: "8px" }}>
                <div className={`chat-bubble ${msg.sender === "user" ? "user" : "app"}`}
                  style={
                    msg.sender === "ai"      ? { background: "#0d2010", color: "#86efac", border: "1px solid #166534" } :
                    msg.sender === "ollama"  ? { background: "#1e1b4b", color: "#c4b5fd", border: "1px solid #4c1d95" } :
                    msg.isBundleNotice       ? { background: "#12102a", color: "#a78bfa", border: "1px solid #4c1d95", fontSize: "12px" } :
                    msg.isBriefing           ? { background: "#0c1a2e", color: "#93c5fd", border: "1px solid #1d4ed8" } : {}
                  }>
                  {msg.sender === "ai"     && <div style={{ fontSize: "10px", color: "#4ade80", fontWeight: "700", marginBottom: "4px" }}>✦ AI DEEP DIVE</div>}
                  {msg.sender === "ollama" && <div style={{ fontSize: "10px", color: "#a78bfa", fontWeight: "700", marginBottom: "4px" }}>✦ TEACHING SUGGESTIONS</div>}
                  {msg.isBundleNotice      && <div style={{ fontSize: "10px", color: "#a78bfa", fontWeight: "700", marginBottom: "4px" }}>LOCAL AI READING CONTEXT</div>}
                  {msg.text}
                  {msg.followUp && <div style={{ marginTop: "6px", fontSize: "12px", color: "#60a5fa", fontStyle: "italic" }}>{msg.followUp}</div>}
                </div>
                {msg.sources?.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", maxWidth: "92%" }}>
                    {msg.sources.map((src, si) => (
                      <span key={si} title={src.detail} style={{ fontSize: "10px", background: "#0a1120", color: "#475569", border: "1px solid #1e293b", padding: "2px 8px", borderRadius: "20px" }}>{src.icon} {src.label}</span>
                    ))}
                  </div>
                )}
                {msg.recommendedCards?.length > 0 && (
                  <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", maxWidth: "92%" }}>
                    {msg.recommendedCards.map(c => (
                      <span key={c.id} style={{ fontSize: "10px", background: "#0c1a2e", color: "#60a5fa", border: "1px solid #1d4ed8", padding: "3px 10px", borderRadius: "20px" }}>📋 {c.title}</span>
                    ))}
                  </div>
                )}
                {msg.actions?.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", maxWidth: "92%" }}>
                    {msg.actions.map((btn, bi) => (
                      <button key={bi} className="btn btn-action" style={{ fontSize: "12px", padding: "5px 10px" }}
                        onClick={() => { addLog(btn.studentId, btn.note, btn.type, { source: "engine" }); showToast(`✅ Logged: ${btn.label}`); }}>
                        {btn.label}
                      </button>
                    ))}
                  </div>
                )}
                {msg.showAI && (
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                    <button disabled={aiLoading || ollamaLoading}
                      style={{ fontSize: "12px", background: "#0d1a2e", color: "#a78bfa", border: "1px solid #4c1d95", borderRadius: "6px", padding: "5px 12px", cursor: "pointer" }}
                      onClick={() => askAI(msg.originalQuery)}>
                      {aiLoading ? "✦ Thinking…" : "✦ Ask Local AI"}
                    </button>
                    {ollamaOnline && msg.detectedSituations?.length > 0 && (
                      <button disabled={ollamaLoading || aiLoading}
                        style={{ fontSize: "12px", background: "#1e1b4b", color: "#c4b5fd", border: "1px solid #6d28d9", borderRadius: "6px", padding: "5px 12px", cursor: "pointer" }}
                        onClick={() => handleOllamaSuggestions(msg.originalQuery, msg.detectedSituations)}>
                        {ollamaLoading ? "✦ Generating…" : "✦ Teaching Moves"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
            {aiLoading && <div style={{ color: "#4ade80", fontSize: "13px", fontStyle: "italic", padding: "4px 0" }}>✦ AI reading IEPs, KB, and logs…</div>}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleChat}
            style={{ padding: "8px 14px 10px", borderTop: "1px solid #141f33", display: "flex", gap: "8px", flexShrink: 0 }}>
            <input value={chatInput} onChange={e => setChatInput(e.target.value)}
              placeholder={chatMode === "master" ? "Switch to period view to chat…" : "e.g. 'doing decimals' or 'student escalating'…"}
              disabled={chatMode === "master"}
              style={{ flex: 1, padding: "9px 12px", background: "#0a1120", color: "white", border: "1px solid #1e293b", borderRadius: "8px", fontSize: "13px", fontFamily: "inherit" }} />
            <button type="submit" className="btn btn-primary" disabled={chatMode === "master"} style={{ fontSize: "13px", padding: "9px 18px" }}>Send</button>
          </form>
        </div>
      )}

      {/* ══ NOTE ENTRY MODAL ════════════════════════════════ */}
      {noteTarget && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.75)", zIndex: 800, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => { setNoteTarget(null); setNoteDraft(""); }}>
          <div style={{ background: "#080f1e", border: `2px solid ${noteTarget.action.border}`, borderRadius: "16px", padding: "22px", width: "380px", maxWidth: "92vw" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: "17px", fontWeight: "800", color: noteTarget.action.color, marginBottom: "4px" }}>
              {noteTarget.action.icon} {noteTarget.action.label}
            </div>
            <div style={{ fontSize: "13px", color: allStudents[noteTarget.studentId]?.color || "#e2e8f0", fontWeight: "600", marginBottom: "14px" }}>
              {resolveLabel(allStudents[noteTarget.studentId], "compact") || noteTarget.studentId}
            </div>
            <textarea autoFocus
              value={noteDraft}
              onChange={e => setNoteDraft(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && e.ctrlKey) quickLog(noteTarget.studentId, noteTarget.action, noteDraft); }}
              placeholder="What happened? Add detail (optional) — Ctrl+Enter to log"
              style={{ width: "100%", background: "#0a1120", border: `1px solid ${noteTarget.action.border}`, borderRadius: "8px", color: "#e2e8f0", padding: "10px 12px", fontSize: "14px", resize: "none", height: "90px", fontFamily: "inherit", boxSizing: "border-box", outline: "none" }} />
            {caseSuggestions.length > 0 && (
              <div style={{ marginTop: '8px', padding: '10px 12px', background: '#0a1628', border: '1px solid #1e3a5f', borderRadius: '8px', maxHeight: '180px', overflow: 'auto' }}>
                <div style={{ fontSize: '11px', fontWeight: '700', color: '#60a5fa', marginBottom: '8px' }}>
                  🧠 Previous Similar Situations
                </div>
                {caseSuggestions.map((s, i) => (
                  <div key={i} style={{ padding: '8px 0', borderTop: i > 0 ? '1px solid #1e293b' : 'none', fontSize: '12px', lineHeight: '1.5' }}>
                    <div style={{ color: '#e2e8f0' }}><strong>Behavior:</strong> {s.behavior}</div>
                    {s.intervention && <div style={{ color: '#4ade80' }}><strong>Tried:</strong> {s.intervention}</div>}
                    {s.outcome && <div style={{ color: '#60a5fa' }}><strong>Result:</strong> {s.outcome}</div>}
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
              <button onClick={() => quickLog(noteTarget.studentId, noteTarget.action, noteDraft)}
                style={{ flex: 1, padding: "13px", background: noteTarget.action.bg, color: noteTarget.action.color, border: `1.5px solid ${noteTarget.action.border}`, borderRadius: "10px", cursor: "pointer", fontSize: "16px", fontWeight: "800" }}>
                ✓ Log It
              </button>
              <button onClick={() => { setNoteTarget(null); setNoteDraft(""); }}
                style={{ padding: "13px 18px", background: "#1e293b", color: "#94a3b8", border: "none", borderRadius: "10px", cursor: "pointer", fontSize: "14px" }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ HELP BUTTON ══════════════════════════════════════ */}
      {caseMemory && effectivePeriodStudents.length > 0 && (() => {
        const helpStu = noteTarget?.studentId
          ? allStudents[noteTarget.studentId]
          : effectivePeriodStudents.length === 1 ? allStudents[effectivePeriodStudents[0]] : null;
        const lastUserMsg = [...(currentChat || [])].reverse().find(m => m.sender === 'user')?.text || '';
        return helpStu ? (
          <HelpButton
            student={helpStu}
            allStudents={allStudents}
            incidents={caseMemory.incidents}
            interventions={caseMemory.interventions}
            outcomes={caseMemory.outcomes}
            addIncident={caseMemory.addIncident}
            addIntervention={caseMemory.addIntervention}
            addOutcome={caseMemory.addOutcome}
            addLog={addLog}
            currentDate={currentDate}
            activePeriod={activePeriod}
            lastChatMessage={lastUserMsg}
          />
        ) : null;
      })()}

      {/* ══ TOAST ═══════════════════════════════════════════ */}
      {toast && (
        <div style={{ position: "fixed", bottom: "24px", left: "50%", transform: "translateX(-50%)", background: "#040c18", color: "#4ade80", border: "1px solid #166534", padding: "10px 22px", borderRadius: "22px", fontSize: "14px", fontWeight: "700", zIndex: 9000, boxShadow: "0 6px 32px rgba(0,0,0,.6)", whiteSpace: "nowrap", pointerEvents: "none" }}>
          {toast}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// Export Today Modal
// Formats period label + date + topic + doc snippet + today's logs as
// a plain-text block the para can copy and paste into their live
// Google Doc (or wherever they're keeping Class Notes).
// ══════════════════════════════════════════════════════════════
function ExportTodayModal({ period, activePeriod, currentDate, topic, docSnippet, logs, allStudents, onClose }) {
  const [copied, setCopied] = React.useState(false);
  const [includeDocSnippet, setIncludeDocSnippet] = React.useState(Boolean(docSnippet));

  // Filter logs to today + this period.
  const todaysLogs = React.useMemo(() => {
    return (logs || [])
      .filter(l => l.date === currentDate && (l.periodId === activePeriod || l.period === activePeriod))
      .sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''));
  }, [logs, currentDate, activePeriod]);

  // Group logs by student.
  const byStudent = React.useMemo(() => {
    const out = new Map();
    todaysLogs.forEach(l => {
      if (!out.has(l.studentId)) out.set(l.studentId, []);
      out.get(l.studentId).push(l);
    });
    return out;
  }, [todaysLogs]);

  const text = React.useMemo(() => {
    const dateStr = new Date(currentDate + 'T12:00:00').toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'short', day: 'numeric',
    });
    const lines = [];
    lines.push(`--- ${period.label} | ${dateStr} ---`);
    lines.push('');

    if (topic && topic.trim()) {
      lines.push('📚 Today\'s focus:');
      lines.push(topic.trim());
      lines.push('');
    }

    if (includeDocSnippet && docSnippet) {
      lines.push('📄 From Class Notes Doc:');
      lines.push(docSnippet.trim());
      lines.push('');
    }

    if (todaysLogs.length === 0) {
      lines.push('(No student logs for this period today.)');
    } else {
      lines.push(`📝 Student notes (${todaysLogs.length} entr${todaysLogs.length === 1 ? 'y' : 'ies'}):`);
      lines.push('');
      byStudent.forEach((stuLogs, studentId) => {
        const s = allStudents[studentId];
        const name = s?.realName || s?.pseudonym || studentId;
        lines.push(`• ${name}`);
        stuLogs.forEach(l => {
          const t = l.timestamp
            ? new Date(l.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : '';
          const type = l.type ? `[${l.type}]` : '';
          const note = (l.note || l.text || '').trim();
          lines.push(`   ${t ? t + ' ' : ''}${type}${note ? ' — ' + note : ''}`);
        });
        lines.push('');
      });
    }

    lines.push(`— Exported from SupaPara on ${new Date().toLocaleString()} —`);
    return lines.join('\n');
  }, [period, currentDate, topic, docSnippet, includeDocSnippet, todaysLogs, byStudent, allStudents]);

  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  function download() {
    const safeDate = currentDate.replace(/[^0-9-]/g, '');
    const safePeriod = (period.label || activePeriod).replace(/[^a-z0-9]+/gi, '_');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `supapara-${safePeriod}-${safeDate}.txt`;
    a.click();
  }

  // Esc to close
  React.useEffect(() => {
    function k(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        style={{ maxWidth: 720, width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', position: 'relative' }}
        onClick={e => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="close-btn"
          aria-label="Close"
          style={{ position: 'absolute', top: 12, right: 12, zIndex: 3 }}
        >×</button>
        <div style={{ height: 3, background: 'var(--grad-primary)' }} />
        <div style={{ padding: 'var(--space-5) var(--space-6)', borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em' }}>
            📋 Export today's notes
          </h3>
          <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.5 }}>
            Copy this and paste it into your Class Notes doc. Your live doc stays the source of truth;
            SupaPara just gives you a clean, dated block for today.
          </p>
          <div style={{ marginTop: 'var(--space-3)', display: 'flex', gap: 'var(--space-3)', alignItems: 'center', flexWrap: 'wrap' }}>
            {docSnippet && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={includeDocSnippet}
                  onChange={e => setIncludeDocSnippet(e.target.checked)}
                />
                Include fetched doc snippet
              </label>
            )}
          </div>
        </div>
        <div style={{ padding: 'var(--space-4) var(--space-6)', overflowY: 'auto', flex: 1 }}>
          <pre style={{
            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            background: 'var(--bg-dark)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-4)',
            fontSize: 13, fontFamily: 'JetBrains Mono, monospace',
            color: 'var(--text-primary)',
            lineHeight: 1.55,
            margin: 0,
          }}>
            {text}
          </pre>
        </div>
        <div style={{
          padding: 'var(--space-3) var(--space-6)',
          borderTop: '1px solid var(--border)',
          display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end',
          background: 'var(--bg-surface)',
        }}>
          <button onClick={download} className="btn btn-secondary">⬇ Download .txt</button>
          <button
            onClick={copy}
            className={copied ? "btn btn-secondary" : "btn btn-primary"}
            style={{
              color: copied ? 'var(--green)' : undefined,
              borderColor: copied ? 'rgba(52,211,153,0.35)' : undefined,
            }}
          >
            {copied ? '✓ Copied!' : '📋 Copy to clipboard'}
          </button>
        </div>
      </div>
    </div>
  );
}
