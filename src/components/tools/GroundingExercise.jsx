import React, { useState } from "react";

// ── 5-4-3-2-1 Grounding ─────────────────────────────────────
export function GroundingExercise() {
  const steps = [{ n: 5, sense: "things you can SEE", icon: "👁️", color: "#60a5fa" }, { n: 4, sense: "things you can TOUCH", icon: "✋", color: "#4ade80" }, { n: 3, sense: "things you can HEAR", icon: "👂", color: "#fbbf24" }, { n: 2, sense: "things you can SMELL", icon: "👃", color: "#f97316" }, { n: 1, sense: "thing you can TASTE", icon: "👅", color: "#ec4899" }];
  const [step, setStep] = useState(0), [done, setDone] = useState(false);
  if (done) return (<div style={{ padding: "20px", textAlign: "center" }}><div style={{ fontSize: "48px", marginBottom: "12px" }}>✅</div><div style={{ fontSize: "16px", color: "#4ade80", fontWeight: "600", marginBottom: "8px" }}>Grounding Complete</div><div style={{ fontSize: "13px", color: "#64748b", marginBottom: "16px" }}>Great job staying present.</div><button className="btn btn-secondary" onClick={() => { setStep(0); setDone(false); }}>Do Again</button></div>);
  const s = steps[step];
  return (
    <div style={{ padding: "20px", textAlign: "center" }}>
      <div style={{ fontSize: "48px", marginBottom: "8px" }}>{s.icon}</div>
      <div style={{ fontSize: "42px", fontWeight: "800", color: s.color, marginBottom: "4px" }}>{s.n}</div>
      <div style={{ fontSize: "15px", color: "#e2e8f0", marginBottom: "16px" }}>{s.sense}</div>
      <div style={{ display: "flex", gap: "6px", justifyContent: "center", marginBottom: "12px" }}>{steps.map((_, i) => (<div key={i} style={{ width: "10px", height: "10px", borderRadius: "50%", background: i <= step ? s.color : "#334155" }} />))}</div>
      <button className="btn btn-primary" onClick={() => { if (step < 4) setStep(step + 1); else setDone(true); }}>
        {step < 4 ? "Next" : "Done"}
      </button>
    </div>
  );
}
