import React, { useState } from "react";

// ── Multiplication Chart ─────────────────────────────────────
export function MultChart() {
  const [hl, setHl] = useState(null);
  return (
    <div style={{ overflowX: "auto", padding: "10px" }}>
      <p style={{ fontSize: "11px", color: "#64748b", marginBottom: "6px" }}>Click a row to highlight.</p>
      <table style={{ borderCollapse: "collapse", fontSize: "12px", fontFamily: "monospace" }}><tbody>
        {Array.from({ length: 13 }, (_, r) => (<tr key={r}>{Array.from({ length: 13 }, (_, c) => {
          const val = r === 0 ? (c === 0 ? "×" : c) : c === 0 ? r : r * c;
          const isH = r === 0 || c === 0, isHl = hl && (r === hl || c === hl);
          return (<td key={c} onClick={() => !isH && setHl(r === hl ? null : r)} style={{ width: "26px", height: "26px", textAlign: "center", cursor: isH ? "default" : "pointer", background: isHl ? "#1d4ed8" : isH ? "#1e293b" : "#0f172a", color: isHl ? "#fff" : isH ? "#93c5fd" : "#cbd5e1", fontWeight: isH ? "600" : "400", border: "1px solid #1e293b" }}>{val}</td>);
        })}</tr>))}
      </tbody></table>
    </div>
  );
}
