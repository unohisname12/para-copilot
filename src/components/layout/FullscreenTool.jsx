import React from "react";
import { useEscape } from '../../hooks/useEscape';

// ── Fullscreen Tool ──────────────────────────────────────────
export function FullscreenTool({ tool, onClose }) {
  useEscape(onClose);
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 2000, background: "#04080f", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "8px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #1e293b", flexShrink: 0, background: "#0a1120" }}>
        <span style={{ fontSize: "14px", fontWeight: "700", color: "#e2e8f0" }}>{tool.label}</span>
        <button onClick={onClose} style={{ padding: "6px 16px", background: "#1e293b", color: "#94a3b8", border: "1px solid #334155", borderRadius: "8px", cursor: "pointer", fontSize: "13px", fontWeight: "600" }}>✕ Close (Esc)</button>
      </div>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", overflow: "auto", padding: "20px" }} className="fullscreen-tool-body">
        <div style={{ width: "100%", maxWidth: "600px", transform: "scale(1.3)", transformOrigin: "center center" }}>{tool.component}</div>
      </div>
    </div>
  );
}
