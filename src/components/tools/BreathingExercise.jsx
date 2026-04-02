import React, { useState, useEffect, useRef } from "react";

// ── Breathing Exercise ───────────────────────────────────────
export function BreathingExercise() {
  const PHASES = [{ key: "in", name: "Breathe In", dur: 4, color: "#60a5fa" }, { key: "hold", name: "Hold", dur: 4, color: "#fbbf24" }, { key: "out", name: "Breathe Out", dur: 6, color: "#4ade80" }];
  const [active, setActive] = useState(false), [phaseIdx, setPhaseIdx] = useState(0), [count, setCount] = useState(4), [cycle, setCycle] = useState(0);
  const ref = useRef();
  useEffect(() => {
    if (!active) { clearInterval(ref.current); return; }
    ref.current = setInterval(() => {
      setCount(c => {
        if (c <= 1) {
          setPhaseIdx(pi => { const next = (pi + 1) % 3; if (next === 0) setCycle(cy => cy + 1); setCount(PHASES[next].dur); return next; });
          return 1;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(ref.current);
  }, [active]);
  const start = () => { setActive(true); setPhaseIdx(0); setCount(4); setCycle(0); };
  const stop = () => { setActive(false); setPhaseIdx(0); setCount(0); setCycle(0); };
  const cur = active ? PHASES[phaseIdx] : null;
  const scale = cur?.key === "in" ? 1.4 : cur?.key === "hold" ? 1.4 : cur?.key === "out" ? 0.8 : 1;
  return (
    <div style={{ padding: "20px", textAlign: "center" }}>
      <div style={{ width: "120px", height: "120px", borderRadius: "50%", margin: "0 auto 16px", display: "flex", alignItems: "center", justifyContent: "center", background: cur ? cur.color + "30" : "#1e293b", border: `3px solid ${cur ? cur.color : "#334155"}`, transition: "all 1s ease", transform: `scale(${scale})` }}>
        <div style={{ fontSize: "28px", fontWeight: "700", color: cur ? cur.color : "#64748b", fontFamily: "monospace" }}>{!active ? "—" : count}</div>
      </div>
      <div style={{ fontSize: "16px", fontWeight: "600", color: cur ? cur.color : "#64748b", marginBottom: "4px", minHeight: "24px" }}>{cur ? cur.name : "Ready"}</div>
      <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "16px" }}>{active ? `Cycle ${cycle + 1}` : "4-4-6 breathing"}</div>
      {!active ? <button className="btn btn-primary" onClick={start}>Start Breathing</button> :
        <button className="btn btn-secondary" onClick={stop}>Stop</button>}
    </div>
  );
}
