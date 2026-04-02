// ── Quick Action Panel ───────────────────────────────────────
import React from "react";
import { QUICK_ACTIONS } from '../../data';
import { resolveLabel } from '../../privacy/nameResolver';

export function QuickActionPanel({ students, onLog, studentsMap }) {
  const lookup = studentsMap || {};
  return (
    <div style={{ padding: "10px", display: "flex", flexDirection: "column", gap: "4px" }}>
      <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "4px" }}>One-tap logging — pick an action, then the student:</div>
      {QUICK_ACTIONS.map(qa => (
        <div key={qa.id} style={{ marginBottom: "6px" }}>
          <div style={{ fontSize: "12px", fontWeight: "600", color: "#e2e8f0", marginBottom: "3px" }}>{qa.icon} {qa.label}</div>
          <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
            {students.filter(id => lookup[id]).map(id => (
              <button key={id} onClick={() => onLog(id, qa.defaultNote, qa.logType, { source: "quick_action", tags: qa.tags })}
                style={{ fontSize: "11px", padding: "3px 10px", borderRadius: "6px", border: `1px solid ${lookup[id].color}40`, cursor: "pointer", background: lookup[id].color + "15", color: lookup[id].color }}>
                {resolveLabel(lookup[id], "compact")}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
