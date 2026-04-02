import React, { useState, useEffect, useRef } from "react";

// ── Visual Timer ─────────────────────────────────────────────
export function VisualTimer() {
  const [total, setTotal] = useState(300), [rem, setRem] = useState(300), [running, setRunning] = useState(false);
  const ref = useRef();
  useEffect(() => {
    if (running && rem > 0) { ref.current = setInterval(() => setRem(r => r - 1), 1000); }
    else { clearInterval(ref.current); if (rem === 0) setRunning(false); }
    return () => clearInterval(ref.current);
  }, [running, rem]);
  const pct = total > 0 ? rem / total : 0, r = 60, cx = 70, cy = 70, circ = 2 * Math.PI * r;
  const stroke = pct > .5 ? "#10b981" : pct > .2 ? "#f59e0b" : "#ef4444";
  const mm = String(Math.floor(rem / 60)).padStart(2, "0"), ss = String(rem % 60).padStart(2, "0");
  const preset = m => { setTotal(m * 60); setRem(m * 60); setRunning(false); };
  return (
    <div style={{ padding: "16px", textAlign: "center" }}>
      <svg width="140" height="140" viewBox="0 0 140 140">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1e293b" strokeWidth="10" />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={stroke} strokeWidth="10" strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)} strokeLinecap="round" transform={`rotate(-90 ${cx} ${cy})`} style={{ transition: "stroke-dashoffset 1s linear,stroke 0.5s" }} />
        <text x={cx} y={cy + 8} textAnchor="middle" fill="#f8fafc" fontSize="22" fontWeight="600" fontFamily="monospace">{mm}:{ss}</text>
      </svg>
      <div style={{ display: "flex", gap: "6px", justifyContent: "center", margin: "10px 0 8px" }}>
        {[1, 3, 5, 10].map(m => <button key={m} className="btn btn-secondary" style={{ padding: "4px 10px", fontSize: "12px" }} onClick={() => preset(m)}>{m}m</button>)}
      </div>
      <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
        <button className="btn btn-primary" onClick={() => setRunning(r => !r)}>{running ? "Pause" : "Start"}</button>
        <button className="btn btn-secondary" onClick={() => { setRunning(false); setRem(total); }}>Reset</button>
      </div>
    </div>
  );
}
