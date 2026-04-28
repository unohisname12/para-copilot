import React from "react";

// ── Stealth Mode Screen ──────────────────────────────────────
export function StealthScreen({ activeTool, toolboxTools, onSelectTool, onExit }) {
  const tool = toolboxTools.find(t => t.id === activeTool);
  const studentTools = toolboxTools.filter(t => ["timer", "breathing", "grounding", "calc", "mult", "cer"].includes(t.id));
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1500, background: "#04080f", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #1e293b", flexShrink: 0 }}>
        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
          <span style={{ fontSize: "14px", fontWeight: "700", color: "#e2e8f0" }}>Classroom Tools</span>
        </div>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {studentTools.map(t => (
            <button key={t.id} onClick={() => onSelectTool(t.id)} style={{ padding: "6px 14px", borderRadius: "6px", border: "none", cursor: "pointer", fontSize: "13px", fontWeight: "500", background: activeTool === t.id ? "#1d4ed8" : "#1e293b", color: activeTool === t.id ? "#fff" : "#94a3b8" }}>{t.label}</button>
          ))}
          <div style={{ width: "1px", background: "#1e293b", margin: "0 4px" }} />
          <button onClick={onExit} style={{ padding: "6px 14px", borderRadius: "6px", border: "1px solid #1e293b", cursor: "pointer", fontSize: "13px", fontWeight: "600", background: "#0f172a", color: "#94a3b8" }}>Done</button>
        </div>
      </div>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", overflow: "auto", padding: "20px" }}>
        {tool ? <div style={{ width: "100%", maxWidth: "600px", transform: "scale(1.3)", transformOrigin: "center center" }}>{tool.component}</div> :
          <div style={{ textAlign: "center", color: "#334155" }}><div style={{ fontSize: "48px", marginBottom: "12px" }}>📐</div><div style={{ fontSize: "16px", fontWeight: "600" }}>Pick a tool above</div></div>}
      </div>
    </div>
  );
}
