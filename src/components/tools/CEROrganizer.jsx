import React, { useState } from "react";

// ── CER Organizer ────────────────────────────────────────────
export function CEROrganizer() {
  const [claim, setClaim] = useState(""), [evidence, setEvidence] = useState(""), [reasoning, setReasoning] = useState("");
  return (
    <div style={{ padding: "12px", display: "flex", flexDirection: "column", gap: "10px" }}>
      {[{ label: "C — Claim", hint: "What is your answer?", val: claim, set: setClaim, color: "#3b82f6" },
        { label: "E — Evidence", hint: "What data supports it?", val: evidence, set: setEvidence, color: "#10b981" },
        { label: "R — Reasoning", hint: "How does evidence prove claim?", val: reasoning, set: setReasoning, color: "#f59e0b" }
      ].map(({ label, hint, val, set, color }) => (
        <div key={label}>
          <div style={{ fontSize: "12px", fontWeight: "600", color, marginBottom: "3px" }}>{label}</div>
          <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "4px" }}>{hint}</div>
          <textarea spellCheck="true" lang="en" value={val} onChange={e => set(e.target.value)} className="data-textarea" style={{ height: "70px", marginBottom: 0, border: `1px solid ${color}40` }} />
        </div>
      ))}
    </div>
  );
}
