// ══════════════════════════════════════════════════════════════
// SIMPLE MODE — Para Note Entry
// Large buttons, minimal choices, background engine processing.
// The user types what happened; the app does the rest.
// ══════════════════════════════════════════════════════════════
import React, { useState } from "react";
import { DB } from '../data';
import { runLocalEngine } from '../engine';
import { getHealth } from '../models';
import { VisualTimer, BreathingExercise } from './tools';

const CATEGORIES = [
  { id: "behavior",  label: "Behavior",       icon: "🔴", color: "#ef4444", logType: "Behavior Note",       tag: "behavior" },
  { id: "refusal",   label: "Work Refusal",   icon: "✋", color: "#f97316", logType: "Behavior Note",       tag: "refusal" },
  { id: "transition",label: "Transition",     icon: "🔔", color: "#f59e0b", logType: "Accommodation Used",  tag: "transition" },
  { id: "positive",  label: "Positive!",      icon: "⭐", color: "#4ade80", logType: "Positive Note",       tag: "positive" },
  { id: "break",     label: "Needed Break",   icon: "🚶", color: "#60a5fa", logType: "Accommodation Used",  tag: "break" },
  { id: "academic",  label: "Academic Help",  icon: "📚", color: "#a78bfa", logType: "Academic Support",    tag: "academic" },
];

export function SimpleMode({ activePeriod, setActivePeriod, logs, addLog, currentDate }) {
  const [step, setStep] = useState("students"); // "students" | "note" | "tool"
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [noteText, setNoteText] = useState("");
  const [selectedCat, setSelectedCat] = useState(null);
  const [saved, setSaved] = useState(false);
  const [activeTool, setActiveTool] = useState(null); // "timer" | "breathing"

  const period = DB.periods[activePeriod];

  const reset = () => {
    setStep("students");
    setSelectedStudent(null);
    setNoteText("");
    setSelectedCat(null);
    setSaved(false);
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
            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>Teacher: {period.teacher} · {period.students.length} students</div>
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

        {/* Period picker */}
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
            Tap a student to write a note:
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {period.students.map(id => {
              const s = DB.students[id];
              const health = getHealth(id, logs, currentDate);
              const todayCount = logs.filter(l => l.studentId === id && l.date === currentDate).length;
              return (
                <button key={id} onClick={() => { setSelectedStudent(id); setStep("note"); }}
                  style={{ padding: "18px 20px", borderRadius: "14px", border: `2px solid ${s.color}30`, background: "var(--bg-surface)", color: "var(--text-primary)", textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: "16px", transition: "border-color .15s" }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = s.color + "80"}
                  onMouseLeave={e => e.currentTarget.style.borderColor = s.color + "30"}>
                  <div style={{ width: "16px", height: "16px", borderRadius: "50%", background: s.color, flexShrink: 0, boxShadow: `0 0 8px ${s.color}60` }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "18px", fontWeight: "700", color: s.color, marginBottom: "3px" }}>{s.pseudonym}</div>
                    <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>{s.eligibility}</div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    {todayCount > 0
                      ? <div style={{ fontSize: "12px", color: "#4ade80", fontWeight: "600" }}>{todayCount} note{todayCount > 1 ? "s" : ""} today ✓</div>
                      : <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>No notes yet</div>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Step: Note Entry ── */}
      {step === "note" && (() => {
        const s = DB.students[selectedStudent];
        return (
          <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>

            {/* Back + student header */}
            <div style={{ display: "flex", gap: "12px", alignItems: "center", marginBottom: "20px" }}>
              <button onClick={reset}
                style={{ padding: "9px 16px", borderRadius: "10px", border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text-secondary)", fontSize: "14px", cursor: "pointer", fontWeight: "600", flexShrink: 0 }}>
                ← Back
              </button>
              <div style={{ flex: 1, padding: "14px 18px", borderRadius: "12px", background: "var(--bg-surface)", border: `2px solid ${s.color}`, display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ width: "14px", height: "14px", borderRadius: "50%", background: s.color, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: "17px", fontWeight: "700", color: s.color }}>{s.pseudonym}</div>
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

            {/* Text note */}
            <div style={{ marginBottom: "20px" }}>
              <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "10px", fontWeight: "600" }}>
                Write a short note: <span style={{ color: "var(--text-muted)", fontWeight: "400" }}>(or just tap Save above)</span>
              </div>
              <textarea value={noteText} onChange={e => setNoteText(e.target.value)}
                placeholder={`What happened with ${s.pseudonym}?\n\nJust describe what you saw — keep it simple.`}
                style={{ width: "100%", minHeight: "130px", padding: "14px", background: "var(--bg-surface)", border: "2px solid var(--border-light)", borderRadius: "12px", color: "var(--text-primary)", fontSize: "16px", lineHeight: "1.6", resize: "none", fontFamily: "inherit" }} />
            </div>

            {/* IEP quick-ref strip */}
            {s.accs.length > 0 && (
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
