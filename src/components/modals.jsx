// ══════════════════════════════════════════════════════════════
// MODALS — Overlay UI components
// ══════════════════════════════════════════════════════════════
import React, { useState } from "react";
import { DB, SUPPORT_CARDS, QUICK_ACTIONS, REG_TOOLS, GOAL_PROGRESS_OPTIONS } from '../data';
import { getHealth, hdot } from '../models';

// ── Student Profile Modal ────────────────────────────────────
// studentData prop: pass merged student object (supports both DB and imported students)
// Renders a field that may be a plain string (v1) or an array (v2)
function FieldText({ value, fallback = "—" }) {
  if (!value || (Array.isArray(value) && value.length === 0)) return <span>{fallback}</span>;
  if (Array.isArray(value)) {
    return value.length === 1
      ? <span>{value[0]}</span>
      : <ul style={{ margin: "4px 0 0", paddingLeft: "16px" }}>{value.map((v, i) => <li key={i} style={{ marginBottom: "3px" }}>{v}</li>)}</ul>;
  }
  return <span>{value}</span>;
}

export function StudentProfileModal({ studentId, logs, currentDate, onClose, onLog, onDraftEmail, studentData }) {
  const s = studentData || DB.students[studentId];
  const stuLogs = logs.filter(l => l.studentId === studentId);
  const health = getHealth(studentId, logs, currentDate);
  const [tab, setTab] = useState("overview"), [logNote, setLogNote] = useState(""), [logType, setLogType] = useState("General Observation");

  // Show "Support" tab only when student has v2 fields
  const hasV2 = (s.watchFors?.length > 0) || (s.doThisActions?.length > 0) || (s.healthNotes?.length > 0) || s.crossPeriodInfo?.note;
  const tabs = [
    { id: "overview",  label: "Overview" },
    { id: "goals",     label: "Goals" },
    { id: "accs",      label: "Accommodations" },
    { id: "strategies",label: "Strategies" },
    ...(hasV2 ? [{ id: "support", label: "Support Info" }] : []),
    { id: "logs",      label: `Logs (${stuLogs.length})` },
  ];
  // Student color theming — only affects this modal's detail area
  const c = s.color;
  const cFaint = c + "12";
  const cBorder = c + "40";
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ width: "680px", maxWidth: "96vw", maxHeight: "88vh", display: "flex", flexDirection: "column", borderTop: `3px solid ${c}` }} onClick={e => e.stopPropagation()}>
        {/* Alert banner — only for v2 students with alertText or alert flag */}
        {(s.alertText || s.flags?.alert) && (
          <div style={{ padding: "8px 16px", background: "#1a0505", borderBottom: "1px solid #7f1d1d", fontSize: "12px", color: "#f87171", fontWeight: "700", display: "flex", alignItems: "center", gap: "8px" }}>
            <span>⚠</span>
            <span>{s.alertText || "Alert flag is set for this student."}</span>
          </div>
        )}
        {/* Color-themed header */}
        <div className="modal-header" style={{ borderLeft: `5px solid ${c}`, background: `linear-gradient(135deg, ${cFaint} 0%, transparent 60%)`, gap: "12px" }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <span style={{ fontWeight: "700", fontSize: "17px", color: c }}>{s.pseudonym}</span>
              <span style={{ fontSize: "11px", background: cBorder, color: c, padding: "2px 9px", borderRadius: "20px" }}>{s.eligibility}</span>
              <span>{hdot(health)}</span>
              {s.eligibility?.includes("BIP") && <span style={{ fontSize: "11px", background: "#7f1d1d", color: "#fca5a5", padding: "2px 8px", borderRadius: "20px" }}>ACTIVE BIP</span>}
              {s.flags?.iepNotYetOnFile && <span style={{ fontSize: "10px", background: "#1a1505", color: "#fbbf24", border: "1px solid #854d0e", padding: "2px 8px", borderRadius: "20px" }}>IEP Pending</span>}
              {s.flags?.crossPeriod && <span style={{ fontSize: "10px", background: "#0c1a2e", color: "#60a5fa", border: "1px solid #1d4ed8", padding: "2px 8px", borderRadius: "20px" }}>Multi-Period</span>}
              {s.imported && <span style={{ fontSize: "10px", background: cBorder, color: c, padding: "2px 8px", borderRadius: "20px" }}>Imported</span>}
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>Goals: {s.goalArea} · CM: {s.caseManager}</div>
          </div>
          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
            <button style={{ fontSize: "11px", padding: "5px 10px", background: "#0d2010", color: "#4ade80", border: "1px solid #166534", borderRadius: "6px", cursor: "pointer" }} onClick={() => onDraftEmail(studentId)}>✉ Draft Email</button>
            <button className="close-btn" onClick={onClose}>×</button>
          </div>
        </div>
        {/* Color-themed tab bar */}
        <div style={{ display: "flex", gap: "4px", padding: "8px 16px", borderBottom: `1px solid ${cBorder}`, flexShrink: 0, background: cFaint }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ padding: "5px 12px", borderRadius: "6px", border: tab === t.id ? `1px solid ${cBorder}` : "1px solid transparent", cursor: "pointer", fontSize: "12px", fontWeight: "500", background: tab === t.id ? cBorder : "transparent", color: tab === t.id ? c : "var(--text-muted)" }}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="modal-body" style={{ flex: 1, overflowY: "auto" }}>
          {tab === "overview" && (<div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div className="panel" style={{ padding: "12px", borderLeft: `3px solid ${c}40` }}><div style={{ fontSize: "11px", color: c, textTransform: "uppercase", letterSpacing: ".07em", marginBottom: "6px", opacity: .7 }}>Strengths</div><div style={{ fontSize: "13px", lineHeight: "1.6", color: "#86efac" }}><FieldText value={s.strengths} /></div></div>
              <div className="panel" style={{ padding: "12px", borderLeft: "3px solid #f8717140" }}><div style={{ fontSize: "11px", color: "#f87171", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: "6px", opacity: .7 }}>Known Triggers</div><div style={{ fontSize: "13px", lineHeight: "1.6", color: "#fca5a5" }}><FieldText value={s.triggers} /></div></div>
            </div>
            <div className="panel" style={{ padding: "12px" }}><div style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: "6px" }}>Para Notes</div><div style={{ fontSize: "13px", lineHeight: "1.6" }}><FieldText value={s.behaviorNotes} /></div></div>
            <div className="panel" style={{ padding: "12px" }}>
              <div style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: "8px" }}>Quick Log</div>
              <select value={logType} onChange={e => setLogType(e.target.value)} className="period-select" style={{ width: "100%", marginBottom: "8px" }}><option>Academic Support</option><option>Accommodation Used</option><option>Behavior Note</option><option>Positive Note</option><option>General Observation</option><option>Parent Contact</option><option>Goal Progress</option><option>Handoff Note</option></select>
              <textarea value={logNote} onChange={e => setLogNote(e.target.value)} className="data-textarea" style={{ height: "70px", marginBottom: "8px" }} placeholder="Type observation..." />
              <button className="btn btn-primary" style={{ background: c, borderColor: c, color: "#000" }} onClick={() => { if (logNote.trim()) { onLog(studentId, logNote, logType); setLogNote(""); } }}>Save to Vault</button>
            </div>
          </div>)}
          {tab === "goals" && (<div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>{(s.goals || []).map((g, i) => {
            const gObj = typeof g === "string" ? { text: g, id: `goal_${i}`, area: "General" } : g;
            return (
              <div key={i} style={{ background: "rgba(0,0,0,.2)", borderRadius: "8px", padding: "12px 14px", borderLeft: `3px solid ${c}` }}>
                <div style={{ fontSize: "11px", color: c, marginBottom: "4px", opacity: .8 }}>Goal {i + 1}{gObj.area ? ` · ${gObj.area}` : ""}{gObj.subject ? ` · ${gObj.subject}` : ""}</div>
                <div style={{ fontSize: "13px", lineHeight: "1.6", marginBottom: "6px" }}>{gObj.text}</div>
                {gObj.baselineToTarget && <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "4px" }}>Baseline → Target: {gObj.baselineToTarget}</div>}
                {gObj.yourRole && <div style={{ fontSize: "11px", color: "#60a5fa", marginBottom: "8px" }}>Your Role: {gObj.yourRole}</div>}
                <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>{GOAL_PROGRESS_OPTIONS.map(opt => (
                  <button key={opt.id} onClick={() => onLog(studentId, `Goal Progress: "${gObj.text.slice(0, 50)}..." — ${opt.label}`, "Goal Progress")}
                    style={{ fontSize: "10px", padding: "3px 8px", borderRadius: "6px", border: "none", cursor: "pointer", background: opt.color + "20", color: opt.color }}>
                    {opt.icon} {opt.label}
                  </button>
                ))}</div>
              </div>);
          })}{(s.goals || []).length === 0 && <div style={{ color: "var(--text-muted)", padding: "20px", textAlign: "center" }}>No goals listed.</div>}</div>)}
          {tab === "accs" && (<div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>{(s.accs || []).map((a, i) => (<div key={i} style={{ background: "rgba(0,0,0,.2)", borderRadius: "8px", padding: "10px 14px", display: "flex", alignItems: "center", gap: "10px", borderLeft: `3px solid ${c}30` }}><span style={{ fontSize: "16px", color: c }}>✓</span><span style={{ fontSize: "13px" }}>{a}</span></div>))}{(s.accs || []).length === 0 && <div style={{ color: "var(--text-muted)", padding: "20px", textAlign: "center" }}>No accommodations listed.</div>}</div>)}
          {tab === "strategies" && (<div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>{(s.strategies || []).map((st, i) => (<div key={i} style={{ background: "rgba(0,0,0,.2)", borderRadius: "8px", padding: "12px 14px", borderLeft: `3px solid ${c}60` }}><span style={{ fontSize: "13px", lineHeight: "1.6" }}>{st}</span></div>))}{(s.strategies || []).length === 0 && <div style={{ color: "var(--text-muted)", padding: "20px", textAlign: "center" }}>No strategies listed.</div>}</div>)}
          {tab === "support" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {(s.watchFors || []).length > 0 && (
                <div className="panel" style={{ padding: "12px", borderLeft: "3px solid #f8717160" }}>
                  <div style={{ fontSize: "11px", color: "#f87171", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: "8px", fontWeight: "600" }}>👀 Watch For</div>
                  {s.watchFors.map((w, i) => <div key={i} style={{ fontSize: "13px", padding: "5px 0", borderBottom: i < s.watchFors.length - 1 ? "1px solid rgba(255,255,255,.05)" : "none", color: "#fca5a5" }}>{w}</div>)}
                </div>
              )}
              {(s.doThisActions || []).length > 0 && (
                <div className="panel" style={{ padding: "12px", borderLeft: `3px solid ${c}60` }}>
                  <div style={{ fontSize: "11px", color: c, textTransform: "uppercase", letterSpacing: ".07em", marginBottom: "8px", fontWeight: "600" }}>✅ Do This</div>
                  {s.doThisActions.map((a, i) => <div key={i} style={{ fontSize: "13px", padding: "5px 0", borderBottom: i < s.doThisActions.length - 1 ? "1px solid rgba(255,255,255,.05)" : "none" }}>{a}</div>)}
                </div>
              )}
              {(s.healthNotes || []).length > 0 && (
                <div className="panel" style={{ padding: "12px", borderLeft: "3px solid #fbbf2460" }}>
                  <div style={{ fontSize: "11px", color: "#fbbf24", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: "8px", fontWeight: "600" }}>🏥 Health Notes</div>
                  {s.healthNotes.map((n, i) => <div key={i} style={{ fontSize: "13px", padding: "5px 0", borderBottom: i < s.healthNotes.length - 1 ? "1px solid rgba(255,255,255,.05)" : "none", color: "#fde68a" }}>{n}</div>)}
                </div>
              )}
              {s.crossPeriodInfo?.note && (
                <div className="panel" style={{ padding: "12px", borderLeft: "3px solid #60a5fa60" }}>
                  <div style={{ fontSize: "11px", color: "#60a5fa", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: "8px", fontWeight: "600" }}>🔗 Cross-Period Info</div>
                  <div style={{ fontSize: "13px", color: "#93c5fd" }}>{s.crossPeriodInfo.note}</div>
                </div>
              )}
            </div>
          )}
          {tab === "logs" && (<div>{stuLogs.length === 0 ? (<div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>No logs yet.</div>) : (stuLogs.map(l => (<div key={l.id} style={{ background: "rgba(0,0,0,.2)", borderRadius: "8px", padding: "10px 12px", marginBottom: "8px", borderLeft: `2px solid ${c}30` }}><div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}><span style={{ fontSize: "11px", background: cBorder, color: c, padding: "2px 8px", borderRadius: "20px" }}>{l.type}</span><span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{l.date}</span></div><div style={{ fontSize: "13px", lineHeight: "1.5" }}>{l.text || l.note}</div></div>)))}</div>)}
        </div>
      </div>
    </div>
  );
}

// ── Email Modal ──────────────────────────────────────────────
export function EmailModal({ studentId, emailLoading, emailDraft, setEmailDraft, onClose, studentData }) {
  const s = studentData || DB.students[studentId];
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ width: "560px" }} onClick={e => e.stopPropagation()}>
        <div className="modal-header"><div><div style={{ fontWeight: "700", fontSize: "16px" }}>AI Email Draft</div><div style={{ fontSize: "12px", color: s.color }}>{s.pseudonym} → {s.caseManager}</div></div><button className="close-btn" onClick={onClose}>×</button></div>
        <div className="modal-body">{emailLoading ? (<div style={{ textAlign: "center", padding: "40px", color: "#4ade80" }}>AI drafting...</div>) : (<textarea value={emailDraft} onChange={e => setEmailDraft(e.target.value)} className="data-textarea" style={{ height: "260px", fontFamily: "inherit", lineHeight: "1.6" }} />)}</div>
        {!emailLoading && (<div className="modal-footer"><button className="btn btn-primary" style={{ flex: 1 }} onClick={() => { navigator.clipboard.writeText(emailDraft); alert("Copied!"); }}>Copy to Clipboard</button><button className="btn btn-secondary" onClick={onClose}>Close</button></div>)}
      </div>
    </div>
  );
}

// ── Situation Response Modal ─────────────────────────────────
export function SituationResponseModal({ situation, students, onClose, onLog, onOpenCard, studentsMap }) {
  const cards = situation.recommendedCards.map(id => SUPPORT_CARDS.find(c => c.id === id)).filter(Boolean);
  const actions = situation.recommendedActions.map(id => QUICK_ACTIONS.find(a => a.id === id)).filter(Boolean);
  const tools = situation.recommendedTools.map(id => REG_TOOLS.find(t => t.id === id)).filter(Boolean);
  const lookup = studentsMap || DB.students;
  const studs = students.map(id => ({ id, ...lookup[id] })).filter(s => s.pseudonym);
  const watchStudents = studs.filter(s => s.tags?.some(t => situation.tags.includes(t)));
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ width: "640px", maxWidth: "96vw", maxHeight: "85vh", display: "flex", flexDirection: "column" }} onClick={e => e.stopPropagation()}>
        <div className="modal-header" style={{ background: "#0c1a2e", borderBottom: "1px solid #1d4ed8" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}><span style={{ fontSize: "28px" }}>{situation.icon}</span><div><div style={{ fontSize: "17px", fontWeight: "700" }}>{situation.title}</div><div style={{ fontSize: "12px", color: "#64748b" }}>{situation.tags.join(" · ")}{situation.score ? ` · ${situation.score} trigger match${situation.score > 1 ? "es" : ""}` : ""}</div></div></div>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="modal-body" style={{ flex: 1, overflowY: "auto" }}>
          {watchStudents.length > 0 && <div style={{ marginBottom: "14px" }}><div style={{ fontSize: "12px", fontWeight: "600", color: "#fbbf24", marginBottom: "6px" }}>👀 Students to Watch</div>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>{watchStudents.map(s => (<span key={s.id} style={{ fontSize: "12px", fontWeight: "600", color: s.color, background: s.color + "20", padding: "3px 10px", borderRadius: "20px" }}>{s.pseudonym}</span>))}</div>
          </div>}
          <div style={{ marginBottom: "14px" }}><div style={{ fontSize: "12px", fontWeight: "600", color: "#4ade80", marginBottom: "6px" }}>🎯 Recommended Moves</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>{actions.map(a => (
              <div key={a.id} style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ fontSize: "12px", color: "#e2e8f0" }}>{a.icon} {a.label}</span>
                {studs.map(s => (<button key={s.id} onClick={() => onLog(s.id, a.defaultNote, a.logType)} className="btn btn-action" style={{ fontSize: "10px", padding: "2px 8px" }}>{s.pseudonym}</button>))}
              </div>
            ))}</div>
          </div>
          {cards.length > 0 && <div style={{ marginBottom: "14px" }}><div style={{ fontSize: "12px", fontWeight: "600", color: "#60a5fa", marginBottom: "6px" }}>📋 Support Cards</div>
            {cards.map(c => (<div key={c.id} onClick={() => onOpenCard(c)} style={{ padding: "8px 12px", background: "#0f172a", borderRadius: "8px", marginBottom: "4px", cursor: "pointer", borderLeft: "3px solid #3b82f6" }}>
              <div style={{ fontSize: "13px", fontWeight: "600", color: "#e2e8f0" }}>{c.title}</div>
              <div style={{ fontSize: "11px", color: "#64748b" }}>{c.whenToUse}</div>
            </div>))}
          </div>}
          {tools.length > 0 && <div style={{ marginBottom: "14px" }}><div style={{ fontSize: "12px", fontWeight: "600", color: "#a78bfa", marginBottom: "6px" }}>🧰 Regulation Tools</div>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>{tools.map(t => (<span key={t.id} style={{ fontSize: "12px", background: "#1a1a2e", color: "#a78bfa", padding: "4px 12px", borderRadius: "8px", border: "1px solid #4c1d95" }}>{t.icon} {t.name}</span>))}</div>
          </div>}
          {situation.followUp && <div style={{ background: "#1a1a0a", border: "1px solid #854d0e", borderRadius: "8px", padding: "10px 14px" }}><div style={{ fontSize: "11px", color: "#fbbf24", fontWeight: "600", marginBottom: "4px" }}>📝 Follow-up</div><div style={{ fontSize: "12px", color: "#fde68a" }}>{situation.followUp}</div></div>}
        </div>
      </div>
    </div>
  );
}

// ── Ollama Insight Modal ──────────────────────────────────────
// Displays AI-generated results from local Ollama.
// feature: "patterns" | "handoff" | "suggestions"
export function OllamaInsightModal({ feature, text, studentId, onClose, onLog }) {
  const [copied, setCopied] = useState(false);

  const featureMeta = {
    patterns:    { label: "Pattern Summary",      icon: "📊", color: "#a78bfa" },
    handoff:     { label: "Handoff Draft",         icon: "📤", color: "#34d399" },
    suggestions: { label: "Teaching Suggestions",  icon: "💡", color: "#fbbf24" },
  };
  const meta = featureMeta[feature] || { label: "Local AI Result", icon: "✦", color: "#a78bfa" };

  const handleCopy = () => {
    navigator.clipboard?.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  const handleSaveAsLog = () => {
    if (onLog && studentId) {
      onLog(studentId, text, "General Observation", { source: "ai", tags: ["ollama", feature] });
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ width: "580px", maxWidth: "96vw", maxHeight: "80vh", display: "flex", flexDirection: "column", borderTop: `3px solid ${meta.color}` }} onClick={e => e.stopPropagation()}>
        <div className="modal-header" style={{ background: `linear-gradient(135deg, ${meta.color}10 0%, transparent 60%)` }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "16px" }}>{meta.icon}</span>
              <span style={{ fontWeight: "700", fontSize: "16px", color: meta.color }}>Local AI — {meta.label}</span>
            </div>
            <div style={{ fontSize: "11px", color: "#475569", marginTop: "4px" }}>
              Generated locally · qwen2.5:7b · no data sent externally
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
          <div style={{ fontSize: "14px", color: "#e2e8f0", lineHeight: "1.7", whiteSpace: "pre-wrap",
            background: "#0a1120", border: `1px solid ${meta.color}30`, borderRadius: "10px", padding: "16px" }}>
            {text}
          </div>
        </div>

        <div style={{ padding: "14px 24px", borderTop: "1px solid var(--border)", display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button className="btn btn-secondary" onClick={handleCopy} style={{ fontSize: "12px" }}>
            {copied ? "✓ Copied!" : "📋 Copy"}
          </button>
          {studentId && onLog && (
            <button className="btn btn-primary" onClick={handleSaveAsLog} style={{ fontSize: "12px" }}>
              💾 Save as Log Entry
            </button>
          )}
          <button className="btn btn-secondary" onClick={onClose} style={{ fontSize: "12px", marginLeft: "auto" }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
