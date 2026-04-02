// ── Goal Progress Tracker ────────────────────────────────────
import React, { useState } from "react";
import { GOAL_PROGRESS_OPTIONS } from '../../data';
import { resolveLabel } from '../../privacy/nameResolver';

export function GoalTracker({ students, onSave, studentsMap }) {
  const lookup = studentsMap || {};
  const allGoals = students.filter(id => lookup[id]).flatMap(id => (lookup[id].goals || []).map(g => ({ ...g, studentId: id, pseudonym: resolveLabel(lookup[id], "compact"), color: lookup[id].color })));
  const [note, setNote] = useState("");
  const logGoal = (goal, opt) => {
    const entry = `Goal Progress: "${goal.text.slice(0, 60)}..." — ${opt.label}${note ? " | Note: " + note : ""}`;
    onSave(goal.studentId, entry, "Goal Progress", { goalId: goal.id, tags: ["goal", opt.id], source: "goal_tracker" });
    setNote("");
  };
  if (allGoals.length === 0) return <div style={{ padding: "16px", color: "#64748b", textAlign: "center" }}>No students this period.</div>;
  return (
    <div style={{ padding: "10px", display: "flex", flexDirection: "column", gap: "10px" }}>
      {allGoals.map(g => (
        <div key={g.id} style={{ background: "#0f172a", borderRadius: "8px", padding: "10px 12px", borderLeft: `3px solid ${g.color}` }}>
          <div style={{ fontSize: "11px", color: g.color, fontWeight: "600", marginBottom: "3px" }}>{g.pseudonym}</div>
          <div style={{ fontSize: "12px", color: "#cbd5e1", marginBottom: "6px", lineHeight: "1.4" }}>{g.text.length > 80 ? g.text.slice(0, 80) + "..." : g.text}</div>
          <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
            {GOAL_PROGRESS_OPTIONS.map(opt => (
              <button key={opt.id} onClick={() => logGoal(g, opt)} title={opt.label}
                style={{ fontSize: "10px", padding: "3px 8px", borderRadius: "6px", border: "none", cursor: "pointer", background: opt.color + "20", color: opt.color }}>
                {opt.icon} {opt.label}
              </button>
            ))}
          </div>
        </div>
      ))}
      <div><input value={note} onChange={e => setNote(e.target.value)} className="chat-input" placeholder="Optional note for next goal tap..." style={{ fontSize: "11px" }} /></div>
    </div>
  );
}
