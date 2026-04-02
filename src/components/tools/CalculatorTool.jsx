import React, { useState } from "react";

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
