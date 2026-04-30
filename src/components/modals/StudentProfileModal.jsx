import React, { useState, useMemo, useRef } from "react";
import { useAutoGrammarFix, useGrammarFixSetting } from '../../hooks/useAutoGrammarFix';
import { useDraft } from '../../hooks/useDraft';
import { GOAL_PROGRESS_OPTIONS } from '../../data';
import { getHealth, hdot } from '../../models';
import { migrateIdentity, getDefaultIdentity, isIdentityCustomized } from '../../identity';
import {
  BREAK_ACCESS_TYPES, TRINARY_OPTIONS, REINFORCEMENT_SYSTEMS,
  migrateSupports, breakAccessLabel, reinforcementLabel,
} from '../../models/supports';
import { resolveLabel } from '../../privacy/nameResolver';
import { matchCaseKeywords, isHelpWorthy } from '../../engine';
import { useEscape } from '../../hooks/useEscape';
import { useTeamOptional } from '../../context/TeamProvider';
import ParentNotesSection from '../ParentNotesSection';

// ── Guided follow-up chip options ────────────────────────────
const ANTECEDENT_OPTIONS = ["Work demand", "Loud room", "Transition", "Peer conflict", "Schedule change", "Unclear directions", "Other"];
const INTERVENTION_OPTIONS = ["Break", "Chunked work", "Headphones", "First/then", "Calm voice", "Gave space", "Visual support", "Reduced workload", "Called support", "Other"];
const RESULT_OPTIONS = [
  { label: "Worked", value: "worked", color: "#4ade80" },
  { label: "Partly worked", value: "partly", color: "#fbbf24" },
  { label: "Did not work", value: "did_not_work", color: "#f87171" },
  { label: "Not sure yet", value: "unsure", color: "#94a3b8" },
];
const AFTERMATH_OPTIONS = ["Calmed down", "Returned to work", "Stayed upset", "Escalated more", "Left room", "Needed office/support", "Other"];

function Chip({ label, selected, onClick, color }) {
  return (
    <button onClick={onClick} style={{
      padding: "4px 10px", borderRadius: "14px", fontSize: "11px", fontWeight: "600", cursor: "pointer", border: selected ? `1.5px solid ${color || '#60a5fa'}` : "1px solid #1e293b",
      background: selected ? (color || '#60a5fa') + '20' : 'transparent', color: selected ? (color || '#60a5fa') : '#8fa3c4', transition: "all .15s",
    }}>{label}</button>
  );
}

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

// Top-level export: guard on studentData before mounting the heavy inner
// modal (which calls many hooks and assumes a valid student).
export function StudentProfileModal(props) {
  if (!props.studentData) return <OrphanStudentModal {...props} />;
  return <StudentProfileModalInner {...props} />;
}

function OrphanStudentModal({ studentId, logs, onClose }) {
  const orphanLogs = (logs || []).filter(l => l.studentId === studentId);
  useEscape(onClose);
  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: 460, position: 'relative' }}>
        <button
          type="button"
          onClick={onClose}
          className="close-btn"
          aria-label="Close"
          style={{ position: 'absolute', top: 12, right: 12, zIndex: 2 }}
        >×</button>
        <div style={{ height: 3, background: 'linear-gradient(90deg, var(--yellow), var(--red))' }} />
        <div className="modal-body" style={{ padding: 'var(--space-6)' }}>
          <div style={{
            width: 56, height: 56, borderRadius: 'var(--radius-lg)',
            background: 'var(--yellow-muted)', border: '1px solid rgba(251,191,36,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, marginBottom: 'var(--space-4)',
          }}>❓</div>
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 'var(--space-3)' }}>
            Student not in roster
          </h3>
          <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.55, marginBottom: 'var(--space-4)' }}>
            This log was written for student ID <code style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--accent-hover)' }}>{studentId}</code>,
            but that student isn't in the current period or imported roster.
            The log still exists (you can see it in the table), but there's no profile to open.
          </p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            Likely cause: the roster was re-imported and this student was removed or re-keyed.
            {orphanLogs.length > 1 && ` (${orphanLogs.length - 1} other log${orphanLogs.length > 2 ? 's' : ''} reference this same missing student.)`}
          </p>
          <button onClick={onClose} className="btn btn-secondary" style={{ width: '100%', marginTop: 'var(--space-5)' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function StudentProfileModalInner({ studentId, logs, currentDate, activePeriod, onClose, onLog, onDraftEmail, studentData, onUpdateIdentity, onUpdateSupports, caseMemory }) {
  useEscape(onClose);
  const s = studentData;
  // Defensive paraAppNumber-aware filter: a log row's studentId may be
  // stale (different import path produced a different local id), but its
  // paraAppNumber is the FERPA-safe stable bridge that survives. Match
  // either way so cross-session logs surface in the right kid's profile.
  const stuLogs = logs.filter(l =>
    l.studentId === studentId
    || (s.paraAppNumber && l.paraAppNumber === s.paraAppNumber)
  );
  const health = getHealth(studentId, logs, currentDate);
  const [tab, setTab] = useState("overview"), [logNote, setLogNote] = useState(""), [logType, setLogType] = useState("General Observation");

  const caseSuggestions = useMemo(() => {
    if (!logNote || !caseMemory) return [];
    return matchCaseKeywords(logNote, caseMemory.incidents, caseMemory.interventions, caseMemory.outcomes, 3);
  }, [logNote, caseMemory]);

  // ── Guided follow-up state ──────────────────────────────────
  // Phases: "note" (normal) → "prompt" (detected help-worthy) → "guided" (user opted in) → saved
  const [helpPhase, setHelpPhase] = useState("note");
  const [antecedent, setAntecedent] = useState(null);
  const [intervention, setIntervention] = useState(null);
  const [result, setResult] = useState(null);
  const [aftermath, setAftermath] = useState(null);
  const [staffNote, setStaffNote] = useState("");
  const logNoteRef = useRef(null);
  const staffNoteRef = useRef(null);
  const [autoFix] = useGrammarFixSetting();
  useAutoGrammarFix({ value: logNote,   setValue: setLogNote,   ref: logNoteRef,   enabled: autoFix });
  useAutoGrammarFix({ value: staffNote, setValue: setStaffNote, ref: staffNoteRef, enabled: autoFix });
  // Draft persistence keyed per-student so each kid's notes survive
  // closing the profile modal mid-thought.
  const logNoteStore   = useDraft(studentId ? `profileLog:${studentId}`   : '', logNote,   setLogNote);
  const staffNoteStore = useDraft(studentId ? `profileStaff:${studentId}` : '', staffNote, setStaffNote);
  const helpWorthy = useMemo(() => isHelpWorthy(logNote), [logNote]);

  const resetGuidedFlow = () => { setHelpPhase("note"); setAntecedent(null); setIntervention(null); setResult(null); setAftermath(null); setStaffNote(""); };

  const handleSaveNote = () => {
    if (!logNote.trim()) return;
    onLog(studentId, logNote, logType);
    logNoteStore.clear();
    setLogNote("");
    resetGuidedFlow();
  };

  const handleSaveGuided = () => {
    if (!logNote.trim()) return;
    // 1. Save plain log
    onLog(studentId, logNote, logType);
    // 2. Save structured case memory if caseMemory hooks are available.
    // addIncident/addIntervention/addOutcome each call their createX factory
    // internally — pass raw data and use the returned record's id so the
    // intervention → incident and outcome → intervention links stay intact.
    if (caseMemory?.addIncident) {
      const inc = caseMemory.addIncident({ studentId, description: logNote, date: currentDate, periodId: activePeriod || "p1", category: "behavior", antecedent: antecedent || "", setting: "other", source: "guided" });
      if (intervention) {
        const intv = caseMemory.addIntervention({ incidentId: inc.id, studentId, strategyLabel: intervention, staffNote: staffNote || "", source: "guided" });
        if (result) {
          caseMemory.addOutcome({ interventionId: intv.id, incidentId: inc.id, studentId, result: result, studentResponse: aftermath || "", wouldRepeat: result === "worked" || result === "partly" ? true : false, note: staffNote || "" });
        }
      }
    }
    logNoteStore.clear();
    staffNoteStore.clear();
    setLogNote("");
    resetGuidedFlow();
  };

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

  // Cloud team context — used to gate the Parent Notes tab (Sped-only).
  const team = useTeamOptional();
  const isAdmin = Boolean(team?.isAdmin);
  // Map the local studentId to a team_students row id (uuid) via pseudonym
  // match. Needed because parent_notes.student_id references team_students.id.
  const studentDbId = useMemo(() => {
    if (!team?.teamStudents || !s?.pseudonym) return null;
    const row = team.teamStudents.find((r) => r.pseudonym === s.pseudonym);
    return row?.id || null;
  }, [team?.teamStudents, s?.pseudonym]);

  // Show "Support" tab only when student has v2 fields
  const hasV2 = (s.watchFors?.length > 0) || (s.doThisActions?.length > 0) || (s.healthNotes?.length > 0) || s.crossPeriodInfo?.note;
  const tabs = [
    { id: "overview",  label: "Overview" },
    { id: "goals",     label: "Goals" },
    { id: "accs",      label: "Accommodations" },
    { id: "strategies",label: "Strategies" },
    { id: "tools",     label: "Tools & Supports" },
    ...(hasV2 ? [{ id: "support", label: "Support Info" }] : []),
    { id: "logs",      label: `Logs (${stuLogs.length})` },
    // Parent notes tab — visible only to admins (server RLS also enforces).
    ...(isAdmin ? [{ id: "parent",  label: "🔒 Parent Notes" }] : []),
  ];
  // Student color theming — only affects this modal's detail area
  const c = s.color || '#3b82f6';
  const cFaint = c + "12";
  const cBorder = c + "40";
  return (
    <div className="modal-overlay">
      {/* Backdrop click intentionally does NOT close — log-note + supports
          state lives inside this modal. Use X or Esc. */}
      <div className="modal-content" style={{ width: "680px", maxWidth: "96vw", maxHeight: "88vh", display: "flex", flexDirection: "column", borderTop: `3px solid ${c}` }}>
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
        {/* IEP Summary banner — clarifies scope for paras + admins alike */}
        <div style={{
          padding: "6px 16px",
          background: "var(--bg-dark)",
          borderBottom: "1px solid var(--border)",
          fontSize: 11, color: "var(--text-muted)",
          display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
        }}>
          <span className="pill pill-accent" style={{ fontSize: 10 }}>📋 IEP Summary</span>
          <span>
            Goals, accommodations, and strategies below are a working summary.
            Full IEP documents stay with the Special Ed Teacher / case manager.
          </span>
        </div>
        {/* Color-themed tab bar */}
        <div style={{ display: "flex", gap: "4px", padding: "8px 16px", borderBottom: `1px solid ${cBorder}`, flexShrink: 0, background: cFaint, flexWrap: "wrap" }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ padding: "6px 12px", borderRadius: "6px", border: tab === t.id ? `1px solid ${cBorder}` : "1px solid transparent", cursor: "pointer", fontSize: "12px", fontWeight: "500", background: tab === t.id ? cBorder : "transparent", color: tab === t.id ? c : "var(--text-muted)", minHeight: 32 }}>
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
              <textarea ref={logNoteRef} spellCheck="true" lang="en" value={logNote} onChange={e => setLogNote(e.target.value)} className="data-textarea" style={{ height: "70px", marginBottom: "8px" }} placeholder="Type observation..." />
              {caseSuggestions.length > 0 && (
                <div style={{ marginBottom: '8px', padding: '10px 12px', background: '#0a1628', border: '1px solid #1e3a5f', borderRadius: '8px', maxHeight: '180px', overflow: 'auto' }}>
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
              {/* ── Guided follow-up prompt ── */}
              {helpPhase === "note" && helpWorthy && logNote.trim().length > 0 && (
                <div style={{ marginBottom: '8px', padding: '10px 12px', background: '#0d1a0d', border: '1px solid #166534', borderRadius: '8px' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: '#4ade80', marginBottom: '6px' }}>💡 This looks significant — want to add details?</div>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '8px' }}>Capture what happened before, what you tried, and whether it worked. Completely optional.</div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button onClick={() => setHelpPhase("guided")} style={{ padding: '5px 12px', borderRadius: '6px', border: '1px solid #166534', background: '#166534', color: '#4ade80', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>Add Help Details</button>
                    <button onClick={handleSaveNote} style={{ padding: '5px 12px', borderRadius: '6px', border: '1px solid #1e293b', background: 'transparent', color: '#8fa3c4', fontSize: '11px', cursor: 'pointer' }}>Keep as Note</button>
                  </div>
                </div>
              )}
              {/* ── Guided flow ── */}
              {helpPhase === "guided" && (
                <div style={{ marginBottom: '8px', padding: '12px', background: '#0a1628', border: '1px solid #1e3a5f', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <div style={{ fontSize: '12px', fontWeight: '700', color: '#60a5fa' }}>📋 Guided Details</div>
                    <button onClick={() => { resetGuidedFlow(); }} style={{ fontSize: '10px', color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Cancel</button>
                  </div>
                  {/* Antecedent */}
                  <div style={{ marginBottom: '10px' }}>
                    <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '5px' }}>What happened before?</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {ANTECEDENT_OPTIONS.map(opt => <Chip key={opt} label={opt} selected={antecedent === opt} onClick={() => setAntecedent(antecedent === opt ? null : opt)} />)}
                    </div>
                  </div>
                  {/* Intervention */}
                  <div style={{ marginBottom: '10px' }}>
                    <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '5px' }}>What did you try?</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {INTERVENTION_OPTIONS.map(opt => <Chip key={opt} label={opt} selected={intervention === opt} onClick={() => setIntervention(intervention === opt ? null : opt)} />)}
                    </div>
                  </div>
                  {/* Result */}
                  <div style={{ marginBottom: '10px' }}>
                    <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '5px' }}>Did it work?</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {RESULT_OPTIONS.map(opt => <Chip key={opt.value} label={opt.label} selected={result === opt.value} onClick={() => setResult(result === opt.value ? null : opt.value)} color={opt.color} />)}
                    </div>
                  </div>
                  {/* Aftermath */}
                  <div style={{ marginBottom: '10px' }}>
                    <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '5px' }}>What happened after?</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {AFTERMATH_OPTIONS.map(opt => <Chip key={opt} label={opt} selected={aftermath === opt} onClick={() => setAftermath(aftermath === opt ? null : opt)} />)}
                    </div>
                  </div>
                  {/* Staff note */}
                  <div style={{ marginBottom: '10px' }}>
                    <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '5px' }}>Staff note (optional)</div>
                    <textarea ref={staffNoteRef} spellCheck="true" lang="en" value={staffNote} onChange={e => setStaffNote(e.target.value)} className="data-textarea" style={{ height: '40px', fontSize: '11px' }} placeholder="Any extra context..." />
                  </div>
                  {/* Save guided */}
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button onClick={handleSaveGuided} disabled={!logNote.trim()} style={{ padding: '6px 14px', borderRadius: '6px', border: `1px solid ${c}`, background: c, color: '#000', fontSize: '11px', fontWeight: '700', cursor: logNote.trim() ? 'pointer' : 'not-allowed', opacity: logNote.trim() ? 1 : 0.5 }}>Save with Details</button>
                    <button onClick={handleSaveNote} disabled={!logNote.trim()} style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid #1e293b', background: 'transparent', color: '#8fa3c4', fontSize: '11px', cursor: logNote.trim() ? 'pointer' : 'not-allowed', opacity: logNote.trim() ? 1 : 0.5 }}>Just save note</button>
                  </div>
                </div>
              )}
              {/* Default save button — hidden when guided flow is active or prompt is showing */}
              {helpPhase === "note" && !(helpWorthy && logNote.trim().length > 0) && (
                <button className="btn btn-primary" disabled={!logNote.trim()} style={{ background: c, borderColor: c, color: "#000", opacity: logNote.trim() ? 1 : 0.5, cursor: logNote.trim() ? 'pointer' : 'not-allowed' }} onClick={handleSaveNote}>Save note</button>
              )}
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

          {tab === "tools" && (
            <ToolsAndSupportsSection
              student={s}
              color={c}
              onUpdate={(partial) => onUpdateSupports && onUpdateSupports(studentId, partial)}
            />
          )}

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
          {tab === "parent" && (
            <ParentNotesSection
              studentDbId={studentDbId}
              studentLabel={resolveLabel(s, "compact")}
            />
          )}
        </div>
      </div>
    </div>
  );
}


// ── Tools & Supports section ────────────────────────────────
// Para-editable fact base for what this kid actually has in place.
// The training-gap rule engine reads this to tailor coaching tips.
function ToolsAndSupportsSection({ student, color, onUpdate }) {
  const supports = migrateSupports(student.supports);

  const updateBreakAccess = (type) =>
    onUpdate({ ...supports, breakAccess: { ...supports.breakAccess, type } });
  const updateBreakNotes = (notes) =>
    onUpdate({ ...supports, breakAccess: { ...supports.breakAccess, notes } });
  const updateBip = (val) =>
    onUpdate({ ...supports, bipActive: val });
  const updateReinforcement = (val) =>
    onUpdate({ ...supports, reinforcementSystem: val });

  const sectionStyle = {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '12px 14px',
    display: 'flex', flexDirection: 'column', gap: 10,
  };
  const labelStyle = {
    fontSize: 11, fontWeight: 700,
    color: 'var(--text-muted)',
    textTransform: 'uppercase', letterSpacing: '0.08em',
  };
  const optBtn = (active) => ({
    fontSize: 11, padding: '6px 12px', borderRadius: 6,
    border: `1px solid ${active ? color : 'var(--border)'}`,
    background: active ? `${color}25` : 'transparent',
    color: active ? color : 'var(--text-secondary)',
    cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
    minHeight: 32,
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
        Tell the app what's actually in place for this student. The Coaching tab uses
        these facts to tailor tips — without them, suggestions are guesses.
      </div>

      {/* Break access */}
      <div style={sectionStyle}>
        <div style={labelStyle}>Break request system</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {BREAK_ACCESS_TYPES.map(t => (
            <button key={t.id} onClick={() => updateBreakAccess(t.id)} style={optBtn(supports.breakAccess.type === t.id)}>
              {t.label}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={supports.breakAccess.notes}
          onChange={e => updateBreakNotes(e.target.value)}
          placeholder="Notes (e.g. 'card kept on her desk', 'BIP says to offer at level 2')"
          className="chat-input"
          style={{ fontSize: 11 }}
        />
      </div>

      {/* BIP active */}
      <div style={sectionStyle}>
        <div style={labelStyle}>Active BIP on file?</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {TRINARY_OPTIONS.map(t => (
            <button key={t.id} onClick={() => updateBip(t.id)} style={optBtn(supports.bipActive === t.id)}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Reinforcement system */}
      <div style={sectionStyle}>
        <div style={labelStyle}>Reinforcement system</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {REINFORCEMENT_SYSTEMS.map(r => (
            <button key={r.id} onClick={() => updateReinforcement(r.id)} style={optBtn(supports.reinforcementSystem === r.id)}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.5, fontStyle: 'italic' }}>
        Saved on this device only. The cloud doesn't see this — it's your private fact
        base for tailoring coaching tips.
      </div>
    </div>
  );
}
