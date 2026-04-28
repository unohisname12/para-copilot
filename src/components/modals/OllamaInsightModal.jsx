import React, { useState } from "react";
import { useEscape } from '../../hooks/useEscape';

// ── Ollama Insight Modal ──────────────────────────────────────
// Displays AI-generated results from local Ollama.
// feature: "patterns" | "handoff" | "suggestions"
export function OllamaInsightModal({ feature, text, studentId, onClose, onLog }) {
  useEscape(onClose);
  const [copied, setCopied] = useState(false);

  const featureMeta = {
    patterns:    { label: "Pattern Summary",      icon: "📊", color: "#a78bfa" },
    handoff:     { label: "Handoff Draft",         icon: "📤", color: "#34d399" },
    suggestions: { label: "Teaching Suggestions",  icon: "💡", color: "#fbbf24" },
  };
  const meta = featureMeta[feature] || { label: "Local AI Result", icon: "✦", color: "#a78bfa" };

  const handleCopy = () => {
    navigator.clipboard?.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  const handleSaveAsLog = () => {
    if (onLog && studentId) {
      onLog(studentId, text, "General Observation", { source: "ai", tags: ["ollama", feature] });
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ width: "580px", maxWidth: "96vw", maxHeight: "80vh", display: "flex", flexDirection: "column", borderTop: `3px solid ${meta.color}` }} onClick={e => e.stopPropagation()}>
        <div className="modal-header" style={{ background: `linear-gradient(135deg, ${meta.color}10 0%, transparent 60%)` }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "16px" }}>{meta.icon}</span>
              <span style={{ fontWeight: "700", fontSize: "16px", color: meta.color }}>Local AI — {meta.label}</span>
            </div>
            <div style={{ fontSize: "11px", color: "#475569", marginTop: "4px" }}>
              Generated locally · qwen2.5:7b · no data sent externally
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
          <div style={{ fontSize: "14px", color: "#e2e8f0", lineHeight: "1.7", whiteSpace: "pre-wrap",
            background: "#0a1120", border: `1px solid ${meta.color}30`, borderRadius: "10px", padding: "16px" }}>
            {text}
          </div>
        </div>

        <div style={{ padding: "14px 24px", borderTop: "1px solid var(--border)", display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button className="btn btn-secondary" onClick={handleCopy} style={{ fontSize: "12px" }}>
            {copied ? "✓ Copied!" : "📋 Copy"}
          </button>
          {studentId && onLog && (
            <button className="btn btn-primary" onClick={handleSaveAsLog} style={{ fontSize: "12px" }}>
              💾 Save as Log Entry
            </button>
          )}
          <button className="btn btn-secondary" onClick={onClose} style={{ fontSize: "12px", marginLeft: "auto" }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
