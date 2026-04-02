// ── Shared section renderer ──────────────────────────────────
import React from "react";

export function Section({ title, items, color }) {
  return (<div style={{ marginBottom: "10px" }}><div style={{ fontSize: "12px", fontWeight: "600", color, marginBottom: "4px" }}>{title}</div>{items.map((item, i) => (<div key={i} style={{ fontSize: "12px", color: "#cbd5e1", padding: "3px 0 3px 12px", borderLeft: `2px solid ${color}30`, marginBottom: "2px", lineHeight: "1.5" }}>{item}</div>))}</div>);
}
