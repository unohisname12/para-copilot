// ── Situation Picker ─────────────────────────────────────────
import React from "react";
import { SITUATIONS } from '../../data';

export function SituationPicker({ onSelect }) {
  return (
    <div style={{ padding: "10px", display: "flex", flexDirection: "column", gap: "6px" }}>
      <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "4px" }}>Tap a situation for instant recommendations:</div>
      {SITUATIONS.map(s => (
        <button key={s.id} onClick={() => onSelect(s)} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px", background: "#0f172a", border: "1px solid #1e293b", borderRadius: "8px", cursor: "pointer", textAlign: "left" }}>
          <span style={{ fontSize: "20px" }}>{s.icon}</span>
          <div><div style={{ fontSize: "13px", fontWeight: "600", color: "#e2e8f0" }}>{s.title}</div>
            <div style={{ fontSize: "11px", color: "#64748b" }}>{s.tags.join(" · ")}</div></div>
        </button>
      ))}
    </div>
  );
}
