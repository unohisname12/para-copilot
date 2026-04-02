// ── Support Card Panel ───────────────────────────────────────
import React, { useState } from "react";
import { SUPPORT_CARDS } from '../../data';
import { Section } from './Section';

export function SupportCardPanel({ cards }) {
  const [selected, setSelected] = useState(cards?.[0] || SUPPORT_CARDS[0]);
  const list = cards && cards.length > 0 ? cards : SUPPORT_CARDS;
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ display: "flex", gap: "4px", padding: "8px", overflowX: "auto", flexShrink: 0, borderBottom: "1px solid var(--border)" }}>
        {list.map(c => (<button key={c.id} onClick={() => setSelected(c)} style={{ padding: "4px 10px", borderRadius: "6px", border: "none", cursor: "pointer", fontSize: "11px", fontWeight: "500", whiteSpace: "nowrap", background: selected.id === c.id ? "#1d4ed8" : "#1e293b", color: selected.id === c.id ? "#fff" : "#94a3b8" }}>{c.title}</button>))}
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "12px" }}>
        <div style={{ fontSize: "16px", fontWeight: "700", color: "#f8fafc", marginBottom: "6px" }}>{selected.title}</div>
        <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "12px" }}>{selected.whenToUse}</div>
        <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginBottom: "12px" }}>
          {selected.studentTypes.map(t => (<span key={t} style={{ fontSize: "10px", background: "#1e3a5f", color: "#93c5fd", padding: "2px 8px", borderRadius: "20px" }}>{t}</span>))}
        </div>
        <Section title="✅ Steps" items={selected.steps} color="#4ade80" />
        <Section title="💬 What to Say" items={selected.whatToSay} color="#60a5fa" />
        <Section title="🚫 What to Avoid" items={selected.whatToAvoid} color="#f87171" />
        <div style={{ marginTop: "10px" }}><div style={{ fontSize: "11px", color: "#64748b", marginBottom: "4px" }}>Related Accommodations</div>
          <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>{selected.accommodations.map(a => (<span key={a} style={{ fontSize: "10px", background: "#14532d", color: "#4ade80", padding: "2px 8px", borderRadius: "20px" }}>{a}</span>))}</div>
        </div>
      </div>
    </div>
  );
}
