// ── Strategy Library ─────────────────────────────────────────
import React, { useState } from "react";
import { STRATEGIES } from '../../data';
import { Section } from './Section';

export function StrategyLibrary() {
  const [search, setSearch] = useState(""), [selected, setSelected] = useState(null);
  const filtered = STRATEGIES.filter(s => !search || s.title.toLowerCase().includes(search.toLowerCase()) || s.tags.some(t => t.includes(search.toLowerCase())));
  if (selected) return (
    <div style={{ padding: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
      <button onClick={() => setSelected(null)} style={{ alignSelf: "flex-start", fontSize: "11px", color: "#60a5fa", background: "none", border: "none", cursor: "pointer" }}>← Back to Library</button>
      <div style={{ fontSize: "16px", fontWeight: "700", color: "#f8fafc" }}>{selected.title}</div>
      <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>{selected.tags.map(t => (<span key={t} style={{ fontSize: "10px", background: "#1e3a5f", color: "#93c5fd", padding: "2px 8px", borderRadius: "20px" }}>{t}</span>))}</div>
      <Section title="Steps" items={selected.steps} color="#4ade80" />
      <div style={{ fontSize: "12px", color: "#60a5fa", marginBottom: "4px" }}>✅ When to Use</div><div style={{ fontSize: "12px", color: "#cbd5e1", marginBottom: "8px", paddingLeft: "12px" }}>{selected.whenToUse}</div>
      <div style={{ fontSize: "12px", color: "#f87171", marginBottom: "4px" }}>🚫 Avoid When</div><div style={{ fontSize: "12px", color: "#cbd5e1", marginBottom: "8px", paddingLeft: "12px" }}>{selected.avoidWhen}</div>
      {selected.accommodations.length > 0 && <div><div style={{ fontSize: "11px", color: "#64748b", marginBottom: "4px" }}>Related Accommodations</div><div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>{selected.accommodations.map(a => (<span key={a} style={{ fontSize: "10px", background: "#14532d", color: "#4ade80", padding: "2px 8px", borderRadius: "20px" }}>{a}</span>))}</div></div>}
    </div>
  );
  return (
    <div style={{ padding: "10px" }}>
      <input value={search} onChange={e => setSearch(e.target.value)} className="chat-input" placeholder="Search by title or tag..." style={{ marginBottom: "10px", fontSize: "12px" }} />
      {filtered.length === 0 ? (
        <div style={{ padding: "16px 12px", textAlign: "center", background: "#0f172a", border: "1px dashed #1e293b", borderRadius: 8 }}>
          <div style={{ fontSize: 13, color: "#cbd5e1", marginBottom: 6 }}>No strategies match "{search}".</div>
          <button onClick={() => setSearch("")} style={{ fontSize: 11, color: "#60a5fa", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>Clear search</button>
        </div>
      ) : filtered.map(s => (
        <div key={s.id} onClick={() => setSelected(s)} style={{ padding: "10px", background: "#0f172a", borderRadius: "8px", marginBottom: "6px", cursor: "pointer", borderLeft: `3px solid ${s.category === "academic" ? "#3b82f6" : s.category === "behavior" ? "#f87171" : s.category === "transition" ? "#fbbf24" : "#4ade80"}` }}>
          <div style={{ fontSize: "13px", fontWeight: "600", color: "#e2e8f0" }}>{s.title}</div>
          <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>{s.category} · {s.subjects.join(", ")}</div>
        </div>
      ))}
    </div>
  );
}
