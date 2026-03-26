// ══════════════════════════════════════════════════════════════
// CLASSROOM TOOLS — Student-safe, can go fullscreen
// ══════════════════════════════════════════════════════════════
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

// ── Safe Math Evaluator ──────────────────────────────────────
function safeMath(expr) {
  const tokens = expr.match(/(\d+\.?\d*|[+\-*/()])/g);
  if (!tokens) throw new Error("bad");
  let pos = 0;
  function peek() { return tokens[pos]; }
  function consume() { return tokens[pos++]; }
  function parseFactor() { const t = peek(); if (t === "(") { consume(); const v = parseExpr(); consume(); return v; } if (t === "-") { consume(); return -parseFactor(); } return parseFloat(consume()); }
  function parseTerm() { let left = parseFactor(); while (peek() === "*" || peek() === "/") { const op = consume(); const right = parseFactor(); left = op === "*" ? left * right : left / right; } return left; }
  function parseExpr() { let left = parseTerm(); while (peek() === "+" || peek() === "-") { const op = consume(); const right = parseTerm(); left = op === "+" ? left + right : left - right; } return left; }
  return parseExpr();
}

// ── Calculator ───────────────────────────────────────────────
export function CalculatorTool() {
  const [disp, setDisp] = useState("0"), [expr, setExpr] = useState(""), [mem, setMem] = useState(0);
  const press = val => {
    if (val === "C") { setDisp("0"); setExpr(""); return; } if (val === "M+") { setMem(m => m + (parseFloat(disp) || 0)); return; } if (val === "MR") { setDisp(String(mem)); return; } if (val === "MC") { setMem(0); return; } if (val === "⌫") { setDisp(d => d.length > 1 ? d.slice(0, -1) : "0"); return; }
    if (val === "=") { try { const raw = (expr + disp).replace(/×/g, "*").replace(/÷/g, "/"); const r = safeMath(raw); setDisp(isFinite(r) ? String(parseFloat(r.toFixed(10))) : "Err"); setExpr(""); } catch { setDisp("Err"); setExpr(""); } return; }
    if (["+", "-", "×", "÷"].includes(val)) { setExpr(expr + disp + val); setDisp("0"); return; }
    if (val === "→Frac") { const n = parseFloat(disp); if (!isNaN(n) && n !== Math.floor(n)) { const gcd = (a, b) => b ? gcd(b, a % b) : a, D = 1000000, N = Math.round(n * D), g = gcd(Math.abs(N), D); setDisp(`${N / g}/${D / g}`); } return; }
    setDisp(d => (d === "0" && val !== ".") ? val : d + val);
  };
  const keys = [["MC", "MR", "M+", "C"], ["7", "8", "9", "÷"], ["4", "5", "6", "×"], ["1", "2", "3", "-"], ["0", ".", "⌫", "+"], ["→Frac", "", "", "="]];
  return (
    <div style={{ padding: "12px" }}>
      <div style={{ background: "#0f172a", borderRadius: "8px", padding: "10px 14px", marginBottom: "10px", textAlign: "right" }}>
        <div style={{ fontSize: "11px", color: "#475569", minHeight: "16px" }}>{expr}</div>
        <div style={{ fontSize: "24px", fontFamily: "monospace", color: "#f8fafc", wordBreak: "break-all" }}>{disp}</div>
        <div style={{ fontSize: "11px", color: "#334155" }}>MEM:{mem}</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "5px" }}>
        {keys.flat().map((k, i) => (<button key={i} onClick={() => k && press(k)} style={{ padding: "10px 0", borderRadius: "6px", border: "none", cursor: k ? "pointer" : "default", fontSize: k === "→Frac" ? "10px" : "14px", fontWeight: "500", background: k === "=" ? "#3b82f6" : ["C", "⌫"].includes(k) ? "#7f1d1d" : ["MC", "MR", "M+", "→Frac"].includes(k) ? "#1e3a5f" : "#1e293b", color: k ? "#f8fafc" : "transparent", gridColumn: k === "→Frac" ? "span 3" : "span 1" }}>{k}</button>))}
      </div>
    </div>
  );
}

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

// ── CER Organizer ────────────────────────────────────────────
export function CEROrganizer() {
  const [claim, setClaim] = useState(""), [evidence, setEvidence] = useState(""), [reasoning, setReasoning] = useState("");
  return (
    <div style={{ padding: "12px", display: "flex", flexDirection: "column", gap: "10px" }}>
      {[{ label: "C — Claim", hint: "What is your answer?", val: claim, set: setClaim, color: "#3b82f6" },
        { label: "E — Evidence", hint: "What data supports it?", val: evidence, set: setEvidence, color: "#10b981" },
        { label: "R — Reasoning", hint: "How does evidence prove claim?", val: reasoning, set: setReasoning, color: "#f59e0b" }
      ].map(({ label, hint, val, set, color }) => (
        <div key={label}>
          <div style={{ fontSize: "12px", fontWeight: "600", color, marginBottom: "3px" }}>{label}</div>
          <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "4px" }}>{hint}</div>
          <textarea value={val} onChange={e => set(e.target.value)} className="data-textarea" style={{ height: "70px", marginBottom: 0, border: `1px solid ${color}40` }} />
        </div>
      ))}
    </div>
  );
}

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
