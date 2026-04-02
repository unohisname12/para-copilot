// ── Para Checklist ────────────────────────────────────────────
import React, { useState } from "react";
import { CHECKLIST_TEMPLATES } from '../../data';

export function ParaChecklist() {
  const [phase, setPhase] = useState("before");
  const [checks, setChecks] = useState({ before: {}, during: {}, after: {} });
  const toggle = (ph, idx) => setChecks(prev => ({ ...prev, [ph]: { ...prev[ph], [idx]: !prev[ph][idx] } }));
  const items = CHECKLIST_TEMPLATES[phase];
  const completed = Object.values(checks[phase]).filter(Boolean).length;
  return (
    <div style={{ padding: "12px" }}>
      <div style={{ display: "flex", gap: "4px", marginBottom: "12px" }}>{["before", "during", "after"].map(p => (
        <button key={p} onClick={() => setPhase(p)} style={{ flex: 1, padding: "6px", borderRadius: "6px", border: "none", cursor: "pointer", fontSize: "11px", fontWeight: "600", textTransform: "capitalize", background: phase === p ? "#1d4ed8" : "#1e293b", color: phase === p ? "#fff" : "#64748b" }}>{p} Class</button>
      ))}</div>
      <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "8px" }}>{completed}/{items.length} complete</div>
      <div style={{ background: "#0f172a", borderRadius: "6px", height: "4px", marginBottom: "12px", overflow: "hidden" }}><div style={{ height: "100%", background: completed === items.length ? "#4ade80" : "#3b82f6", width: `${(completed / items.length) * 100}%`, transition: "width 0.3s" }} /></div>
      {items.map((item, i) => (
        <div key={i} onClick={() => toggle(phase, i)} style={{ display: "flex", gap: "10px", alignItems: "flex-start", padding: "8px 6px", cursor: "pointer", borderRadius: "6px", background: checks[phase][i] ? "#14532d20" : "transparent", marginBottom: "2px" }}>
          <div style={{ width: "18px", height: "18px", borderRadius: "4px", border: `2px solid ${checks[phase][i] ? "#4ade80" : "#334155"}`, background: checks[phase][i] ? "#4ade80" : "transparent", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", marginTop: "1px" }}>
            {checks[phase][i] && <span style={{ color: "#000", fontSize: "12px", fontWeight: "700" }}>✓</span>}
          </div>
          <div>
            <div style={{ fontSize: "12px", color: checks[phase][i] ? "#4ade80" : "#e2e8f0", textDecoration: checks[phase][i] ? "line-through" : "none" }}>{item.label}</div>
            {item.priority === "high" && !checks[phase][i] && <span style={{ fontSize: "9px", color: "#f87171", marginTop: "2px", display: "inline-block" }}>HIGH PRIORITY</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
