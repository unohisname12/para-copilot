// ══════════════════════════════════════════════════════════════
// DASHBOARD — Fast UX, 1-click logging, resizable, saved layout
// ══════════════════════════════════════════════════════════════
import React, { useState, useEffect, useRef, useCallback } from "react";
import { DB } from '../data';
import { getHealth, hdot } from '../models';
import { parseDocForPeriod } from '../engine';
import { OllamaStatusBadge } from './OllamaStatusBadge';

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
}) {
  // ── Persisted layout ──────────────────────────────────────
  const [layout, setLayout] = useLS(LAYOUT_KEY, { cols: 2, chatOpen: false, chatH: 320 });
  const [topic, setTopic]   = useLS(topicKey(activePeriod, currentDate), "");

  // ── Ephemeral UI state ───────────────────────────────────
  const [topicEdit,   setTopicEdit]   = useState(false);
  const [topicDraft,  setTopicDraft]  = useState(topic);
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
    showToast(`✅ ${action.label} → ${s.pseudonym || studentId}`);
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

  // ── Styles ────────────────────────────────────────────────
  const card   = { borderRadius: "12px", overflow: "hidden" };
  const panel  = { background: "#080f1e", border: "1px solid #1e293b", borderRadius: "12px", overflow: "hidden" };
  const sectionHdr = { padding: "9px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", userSelect: "none" };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>

      {/* ══ HEADER BAR ══════════════════════════════════════ */}
      <div style={{ padding: "10px 16px", background: "#050b18", borderBottom: "1px solid #141f33", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0, gap: "12px", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: "11px", color: "#4a6284", textTransform: "uppercase", letterSpacing: ".07em" }}>Now Supporting</div>
          <div style={{ fontSize: "19px", fontWeight: "800", color: "#e2e8f0", lineHeight: 1.2 }}>{period.label}</div>
          <div style={{ fontSize: "12px", color: "#4a6284", marginTop: "1px" }}>
            <span style={{ color: "#93c5fd", fontWeight: "600" }}>{period.teacher}</span>
            {" · "}
            <span style={{ color: "#e2e8f0", fontWeight: "700" }}>{effectivePeriodStudents.length}</span> IEP students
          </div>
        </div>

        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
          <OllamaStatusBadge online={ollamaOnline} modelName={ollamaModel} />
          <div style={{ fontSize: "12px", color: "#4a6284", background: "#0f172a", padding: "4px 12px", borderRadius: "20px", border: "1px solid #1e293b" }}>
            {new Date(currentDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
          </div>
          {/* Column selector */}
          <div style={{ display: "flex", gap: "2px", background: "#0f172a", borderRadius: "8px", padding: "3px", border: "1px solid #1e293b" }} title="Student card columns">
            {[1,2,3].map(n => (
              <button key={n} onClick={() => setLayout(l => ({ ...l, cols: n }))}
                title={`${n} column${n>1?"s":""}`}
                style={{ width: "30px", height: "24px", borderRadius: "5px", border: "none", cursor: "pointer", background: layout.cols === n ? "#3b82f6" : "transparent", color: layout.cols === n ? "#fff" : "#475569", fontSize: "11px", fontWeight: "700", lineHeight: 1 }}>
                {"▮".repeat(n)}
              </button>
            ))}
          </div>
          {/* Chat toggle */}
          <button onClick={() => setLayout(l => ({ ...l, chatOpen: !l.chatOpen }))}
            style={{ padding: "5px 12px", borderRadius: "8px", border: `1px solid ${layout.chatOpen ? "#3b82f6" : "#1e293b"}`, background: layout.chatOpen ? "#0c1a2e" : "#0f172a", color: layout.chatOpen ? "#60a5fa" : "#475569", fontSize: "12px", cursor: "pointer", fontWeight: "600" }}>
            💬 Copilot
          </button>
        </div>
      </div>

      {/* ══ SCROLLABLE BODY ══════════════════════════════════ */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px", display: "flex", flexDirection: "column", gap: "10px", minHeight: 0 }}>

        {/* ── TOPIC BAR ─────────────────────────────────── */}
        <div style={{ ...panel, border: topic ? "1px solid #1d4ed8" : "1px solid #334155" }}>
          <div style={{ ...sectionHdr, background: topic ? "#040c1a" : "#080f1e" }}
            onClick={() => !topicEdit && setTopicEdit(true)}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: "18px", flexShrink: 0 }}>📚</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: "10px", color: "#60a5fa", fontWeight: "700", textTransform: "uppercase", letterSpacing: ".07em" }}>What are we doing today?</div>
                {topic
                  ? <div style={{ fontSize: "15px", fontWeight: "700", color: "#e2e8f0", marginTop: "2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{topic}</div>
                  : <div style={{ fontSize: "13px", color: "#334155", fontStyle: "italic", marginTop: "1px" }}>Tap to set today's lesson focus…</div>
                }
              </div>
            </div>
            <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
              {topic && !topicEdit && (
                <button onClick={e => { e.stopPropagation(); logTopic(); }}
                  title="Log this topic to the session"
                  style={{ fontSize: "11px", padding: "5px 10px", background: "#0d2010", color: "#4ade80", border: "1px solid #166534", borderRadius: "7px", cursor: "pointer" }}>
                  📋 Log
                </button>
              )}
              <button onClick={e => { e.stopPropagation(); setTopicEdit(true); setTopicDraft(topic); }}
                style={{ fontSize: "12px", padding: "6px 14px", background: "#1d4ed8", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "700" }}>
                {topic ? "✏ Edit" : "+ Set Topic"}
              </button>
            </div>
          </div>

          {topicEdit && (
            <div style={{ padding: "10px 14px 14px", borderTop: "1px solid #1d3566" }} onClick={e => e.stopPropagation()}>
              <textarea autoFocus
                value={topicDraft}
                onChange={e => setTopicDraft(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveTopic(); } }}
                placeholder={`e.g. "Decimals — converting fractions with manipulatives"\n\nPress Enter to save, Shift+Enter for new line`}
                style={{ width: "100%", background: "#0a1120", border: "1px solid #3b82f6", borderRadius: "8px", color: "#e2e8f0", padding: "10px 12px", fontSize: "15px", resize: "none", height: "72px", fontFamily: "inherit", boxSizing: "border-box", outline: "none" }} />
              <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                <button onClick={saveTopic}
                  style={{ flex: 1, padding: "11px", background: "#1d4ed8", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "15px", fontWeight: "800" }}>
                  ✓ Save
                </button>
                <button onClick={() => { setTopicEdit(false); setTopicDraft(topic); }}
                  style={{ padding: "11px 18px", background: "#1e293b", color: "#94a3b8", border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "14px" }}>
                  Cancel
                </button>
                {topicDraft.trim() && (
                  <button onClick={() => { setTopic(""); setTopicEdit(false); setTopicDraft(""); showToast("Topic cleared"); }}
                    style={{ padding: "11px 14px", background: "#1a0505", color: "#f87171", border: "1px solid #7f1d1d", borderRadius: "8px", cursor: "pointer", fontSize: "13px" }}>
                    Clear
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Doc snippet if loaded */}
          {docSnippet && !topicEdit && (
            <div style={{ padding: "8px 14px 10px", borderTop: "1px solid #1d3566", background: "#040c1a" }}>
              <span style={{ fontSize: "10px", color: "#3b82f6", fontWeight: "700", textTransform: "uppercase" }}>📄 Class Notes</span>
              <div style={{ fontSize: "12px", color: "#5e7fa3", lineHeight: 1.5, marginTop: "3px" }}>{docSnippet.slice(0, 220)}{docSnippet.length > 220 ? "…" : ""}</div>
            </div>
          )}
        </div>

        {/* ── CLASS-WIDE QUICK ACTION BAR ───────────────── */}
        <div style={{ ...panel, padding: "10px 14px" }}>
          <div style={{ fontSize: "10px", color: "#475569", fontWeight: "700", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: "8px" }}>
            {activeAction ? `▶ Tap a student card below to log "${activeAction.label}"` : "Quick Log — tap an action, then tap a student"}
          </div>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            {DASH_ACTIONS.map(action => {
              const active = activeAction?.id === action.id;
              return (
                <button key={action.id}
                  onClick={() => setActiveAction(prev => prev?.id === action.id ? null : action)}
                  style={{
                    padding: "9px 15px", borderRadius: "9px",
                    border: `1.5px solid ${active ? action.border : "#1e293b"}`,
                    background: active ? action.bg : "#0f172a",
                    color: active ? action.color : "#64748b",
                    cursor: "pointer", fontSize: "13px", fontWeight: active ? "800" : "400",
                    transition: "all 0.12s",
                    transform: active ? "scale(1.06)" : "scale(1)",
                    boxShadow: active ? `0 0 12px ${action.bg}` : "none",
                  }}>
                  {action.icon} {action.label}
                </button>
              );
            })}
            {activeAction && (
              <button onClick={() => setActiveAction(null)}
                style={{ padding: "9px 13px", borderRadius: "9px", border: "1px solid #7f1d1d", background: "#1a0505", color: "#f87171", cursor: "pointer", fontSize: "13px" }}>
                ✕
              </button>
            )}
          </div>
        </div>

        {/* ── STUDENT GRID ──────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${layout.cols}, 1fr)`, gap: "10px" }}>
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
              <div key={id}
                onClick={isTarget ? () => handleClassTap(id) : undefined}
                style={{
                  ...card,
                  background: isTarget ? s.color + "16" : "#070e1c",
                  border: `2px solid ${isTarget ? s.color : s.color + "50"}`,
                  cursor: isTarget ? "pointer" : "default",
                  transition: "all 0.15s",
                  boxShadow: isTarget ? `0 0 18px ${s.color}25` : "none",
                  transform: isTarget ? "scale(1.015)" : "scale(1)",
                }}>

                {/* Alert banner — v2 students with alertText or alert flag */}
                {(s.alertText || s.flags?.alert) && (
                  <div style={{ padding: "5px 10px", background: "#1a0505", borderBottom: `1px solid #7f1d1d`, fontSize: "10px", color: "#f87171", fontWeight: "700" }}>
                    ⚠ {s.alertText || "Alert flag set"}
                  </div>
                )}

                {/* Card header — tap to open profile */}
                <div style={{ padding: "11px 13px 9px", background: s.color + "14", borderBottom: `1px solid ${s.color}28`, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}
                  onClick={e => { if (!isTarget) { e.stopPropagation(); setProfileStu(id); } }}>
                  <div style={{ cursor: isTarget ? "default" : "pointer" }}>
                    <div style={{ fontSize: "16px", fontWeight: "800", color: s.color, lineHeight: 1.2 }}>{s.pseudonym}</div>
                    <div style={{ display: "flex", gap: "4px", alignItems: "center", flexWrap: "wrap", marginTop: "2px" }}>
                      <span style={{ fontSize: "11px", color: "#64748b" }}>{s.eligibility}</span>
                      {s.flags?.iepNotYetOnFile && <span style={{ fontSize: "9px", background: "#1a1505", color: "#fbbf24", padding: "1px 5px", borderRadius: "20px", border: "1px solid #854d0e" }}>IEP Pending</span>}
                      {s.flags?.crossPeriod && <span style={{ fontSize: "9px", background: "#0c1a2e", color: "#60a5fa", padding: "1px 5px", borderRadius: "20px", border: "1px solid #1d4ed8" }}>Multi-Period</span>}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" }}>
                    <span style={{ fontSize: "16px" }}>{hdot(health)}</span>
                    <span style={{ fontSize: "10px", color: hStyle.color, background: hStyle.bg, padding: "2px 7px", borderRadius: "20px", border: `1px solid ${hStyle.border}`, whiteSpace: "nowrap" }}>
                      {todayLogs.length} today
                    </span>
                  </div>
                </div>

                {/* Accommodations pills */}
                <div style={{ padding: "6px 10px 6px", display: "flex", flexWrap: "wrap", gap: "3px", borderBottom: `1px solid ${s.color}18`, minHeight: "30px", alignItems: "center" }}>
                  {(s.accs || []).slice(0, 3).map(a => (
                    <span key={a} style={{ fontSize: "10px", background: "#102040", color: "#7baee0", padding: "2px 7px", borderRadius: "20px", border: "1px solid #1e3a5f" }}>{a}</span>
                  ))}
                  {(s.accs || []).length > 3 && (
                    <span style={{ fontSize: "10px", color: "#334155" }}>+{s.accs.length - 3}</span>
                  )}
                  {(!s.accs || s.accs.length === 0) && (
                    <span style={{ fontSize: "10px", color: "#334155" }}>No accommodations listed</span>
                  )}
                </div>

                {/* 1-click action buttons */}
                <div style={{ padding: "8px 8px 6px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5px" }}>
                  {DASH_ACTIONS.slice(0, 6).map(action => (
                    <button key={action.id}
                      onClick={e => handleCardAction(id, action, e)}
                      title={`Log: ${action.type} for ${s.pseudonym}`}
                      style={{ padding: "8px 5px", borderRadius: "8px", border: `1px solid ${action.border}50`, background: action.bg, color: action.color, cursor: "pointer", fontSize: "12px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px", whiteSpace: "nowrap", transition: "filter 0.1s" }}>
                      {action.icon} {action.label}
                    </button>
                  ))}
                </div>

                {/* Last log preview */}
                {lastLog ? (
                  <div style={{ padding: "4px 12px 8px", fontSize: "10px", color: "#334155", borderTop: `1px solid ${s.color}14` }}>
                    Last: <span style={{ color: "#4a6284" }}>{lastLog.type}</span>
                    {" · "}
                    <span style={{ color: "#334155" }}>{lastLog.date === currentDate ? "today" : lastLog.date}</span>
                  </div>
                ) : (
                  <div style={{ padding: "4px 12px 8px", fontSize: "10px", color: "#253045", borderTop: `1px solid ${s.color}14` }}>No logs yet this session</div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── CLASS NOTES DOC BAR ───────────────────────── */}
        <div style={{ ...panel, padding: "8px 12px" }}>
          <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: "11px", color: "#475569", whiteSpace: "nowrap", fontWeight: "600" }}>📄 Class Notes Doc:</span>
            <input value={docLink} onChange={e => setDocLink(e.target.value)}
              placeholder="Paste Google Doc link for today's lesson notes…"
              style={{ flex: 1, minWidth: "180px", padding: "6px 10px", background: "#0a1120", border: "1px solid #1e293b", borderRadius: "7px", color: "white", fontSize: "12px" }} />
            <button onClick={fetchDoc} disabled={docLoading}
              style={{ padding: "6px 14px", background: docContent ? "#0d2010" : "#1e293b", color: docContent ? "#4ade80" : "#94a3b8", border: `1px solid ${docContent ? "#166534" : "#334155"}`, borderRadius: "7px", cursor: "pointer", fontSize: "12px", fontWeight: "600", whiteSpace: "nowrap" }}>
              {docLoading ? "Fetching…" : docContent ? "✓ Loaded" : "Fetch"}
            </button>
          </div>
        </div>

      </div>{/* end scrollable body */}

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
              {allStudents[noteTarget.studentId]?.pseudonym || noteTarget.studentId}
            </div>
            <textarea autoFocus
              value={noteDraft}
              onChange={e => setNoteDraft(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && e.ctrlKey) quickLog(noteTarget.studentId, noteTarget.action, noteDraft); }}
              placeholder="What happened? Add detail (optional) — Ctrl+Enter to log"
              style={{ width: "100%", background: "#0a1120", border: `1px solid ${noteTarget.action.border}`, borderRadius: "8px", color: "#e2e8f0", padding: "10px 12px", fontSize: "14px", resize: "none", height: "90px", fontFamily: "inherit", boxSizing: "border-box", outline: "none" }} />
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

      {/* ══ TOAST ═══════════════════════════════════════════ */}
      {toast && (
        <div style={{ position: "fixed", bottom: "24px", left: "50%", transform: "translateX(-50%)", background: "#040c18", color: "#4ade80", border: "1px solid #166534", padding: "10px 22px", borderRadius: "22px", fontSize: "14px", fontWeight: "700", zIndex: 9000, boxShadow: "0 6px 32px rgba(0,0,0,.6)", whiteSpace: "nowrap", pointerEvents: "none" }}>
          {toast}
        </div>
      )}
    </div>
  );
}
