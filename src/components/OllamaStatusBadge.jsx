import React from "react";

// ── Ollama connection status indicator ────────────────────────
// Shows in chat header alongside the "Engine" badge.
// Green = model loaded and ready. Gray = offline / not found.
export function OllamaStatusBadge({ online, modelName }) {
  if (online) {
    return (
      <span title={`Model: ${modelName || "qwen2.5:7b-instruct"} — running locally`}
        style={{ fontSize: "10px", background: "#1e1b4b", color: "#a78bfa",
          padding: "2px 8px", borderRadius: "20px", border: "1px solid #4c1d95",
          cursor: "default", userSelect: "none" }}>
        Local AI: online
      </span>
    );
  }
  return (
    <span title="Ollama is offline. Run: ollama serve"
      style={{ fontSize: "10px", background: "#1e293b", color: "#475569",
        padding: "2px 8px", borderRadius: "20px", border: "1px solid #334155",
        cursor: "default", userSelect: "none" }}>
      Local AI: offline
    </span>
  );
}
