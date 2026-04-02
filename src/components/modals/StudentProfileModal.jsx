import React, { useState } from "react";
import { GOAL_PROGRESS_OPTIONS } from '../../data';
import { getHealth, hdot } from '../../models';
import { migrateIdentity, getDefaultIdentity, isIdentityCustomized } from '../../identity';
import { resolveLabel } from '../../privacy/nameResolver';

// Renders a field that may be a plain string (v1) or an array (v2)
function FieldText({ value, fallback = "\u2014" }) {
  if (!value || (Array.isArray(value) && value.length === 0)) return <span>{fallback}</span>;
  if (Array.isArray(value)) {
    return value.length === 1
      ? <span>{value[0]}</span>
      : <ul style={{ margin: "4px 0 0", paddingLeft: "16px" }}>{value.map((v, i) => <li key={i} style={{ marginBottom: "3px" }}>{v}</li>)}</ul>;
  }
  return <span>{value}</span>;
}

export function StudentProfileModal({ studentId, logs, currentDate, onClose, onLog, onDraftEmail, studentData, onUpdateIdentity }) {
  const s = studentData;
  const stuLogs = logs.filter(l => l.studentId === studentId);
  const health = getHealth(studentId, logs, currentDate);
  const [tab, setTab] = useState("overview"), [logNote, setLogNote] = useState(""), [logType, setLogType] = useState("General Observation");

  // Identity editor — initialized from current (or migrated) identity
  const identity = migrateIdentity(s).identity;
  const [emojiDraft, setEmojiDraft] = useState(identity.emoji);
  const [codenameDraft, setCodenameDraft] = useState(identity.codename);
  const identityDirty = emojiDraft.trim() !== identity.emoji || codenameDraft.trim() !== identity.codename;
  const customized = isIdentityCustomized(identity);
  const paletteDefault = getDefaultIdentity(identity.colorName);

  // Sync drafts when studentData changes externally (e.g. after save or reset).
  React.useEffect(() => {
    setEmojiDraft(identity.emoji);
    setCodenameDraft(identity.codename);
  }, [identity.emoji, identity.codename]); // intentional: sync drafts only when identity changes

  const handleSaveIdentity = () => {
    if (onUpdateIdentity) onUpdateIdentity(studentId, { emoji: emojiDraft, codename: codenameDraft });
  };
  const handleResetIdentity = () => {
    if (!paletteDefault || !onUpdateIdentity) return;
    setEmojiDraft(paletteDefault.emoji);
    setCodenameDraft(paletteDefault.codename);
    onUpdateIdentity(studentId, { emoji: paletteDefault.emoji, codename: paletteDefault.codename });
  };

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
              <span style={{ fontWeight: "700", fontSize: "17px", color: c }}>{resolveLabel(s, "full")}</span>
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
            {onUpdateIdentity && (
              <div className="panel" style={{ padding: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: ".07em" }}>Identity Label</div>
                  {customized && (
                    <span style={{ fontSize: "9px", background: cFaint, color: c, border: `1px solid ${cBorder}`, borderRadius: "10px", padding: "1px 6px", fontWeight: "600" }}>customized</span>
                  )}
                </div>
                <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                  <input
                    value={emojiDraft}
                    onChange={e => setEmojiDraft(e.target.value)}
                    className="period-select"
                    style={{ width: "58px", textAlign: "center", fontSize: "20px", padding: "4px 6px" }}
                    maxLength={10}
                    title="Emoji (tap to change)"
                    placeholder={identity.emoji}
                  />
                  <input
                    value={codenameDraft}
                    onChange={e => setCodenameDraft(e.target.value)}
                    className="period-select"
                    style={{ flex: 1, fontSize: "13px" }}
                    maxLength={32}
                    title="Codename"
                    placeholder={identity.codename}
                  />
                  <button
                    onClick={handleSaveIdentity}
                    disabled={!identityDirty}
                    style={{ padding: "5px 12px", borderRadius: "6px", border: `1px solid ${identityDirty ? cBorder : "#1e293b"}`, background: identityDirty ? cFaint : "transparent", color: identityDirty ? c : "#475569", fontSize: "11px", fontWeight: "700", cursor: identityDirty ? "pointer" : "default" }}
                  >Save</button>
                  {customized && paletteDefault && (
                    <button
                      onClick={handleResetIdentity}
                      title={`Reset to ${paletteDefault.emoji} ${paletteDefault.codename}`}
                      style={{ padding: "5px 8px", borderRadius: "6px", border: "1px solid #1e293b", background: "transparent", color: "#475569", fontSize: "13px", cursor: "pointer", lineHeight: 1 }}
                    >↺</button>
                  )}
                </div>
                {/* Live label preview */}
                <div style={{ marginTop: "6px", display: "inline-flex", alignItems: "center", gap: "5px", background: cFaint, border: `1px solid ${cBorder}`, borderRadius: "6px", padding: "3px 8px" }}>
                  <span style={{ fontSize: "14px" }}>{emojiDraft.trim() || identity.emoji}</span>
                  <span style={{ fontSize: "11px", color: c, fontWeight: "600" }}>{codenameDraft.trim() || identity.codename}</span>
                  <span style={{ fontSize: "11px", color: "#475569" }}>{identity.sequenceNumber}</span>
                </div>
              </div>
            )}
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
