import React, { useState, useCallback } from "react";

// ── Floating Draggable + Resizable Window ────────────────────
const BASE_W = 360;
export function FloatingToolWindow({ tool, onClose, onFullscreen, onDock }) {
  const [pos, setPos] = useState({ x: Math.max(60, window.innerWidth / 2 - 200), y: 60 });
  const [size, setSize] = useState({ w: BASE_W, h: 420 });

  const startDrag = useCallback((e) => {
    e.preventDefault();
    const startX = e.clientX - pos.x, startY = e.clientY - pos.y;
    const move = ev => { setPos({ x: Math.max(0, ev.clientX - startX), y: Math.max(0, ev.clientY - startY) }); };
    const up = () => { document.removeEventListener("mousemove", move); document.removeEventListener("mouseup", up); };
    document.addEventListener("mousemove", move); document.addEventListener("mouseup", up);
  }, [pos]);

  const startResize = useCallback((e) => {
    e.preventDefault(); e.stopPropagation();
    const startX = e.clientX, startY = e.clientY, startW = size.w, startH = size.h;
    const move = ev => { setSize({ w: Math.max(260, startW + (ev.clientX - startX)), h: Math.max(200, startH + (ev.clientY - startY)) }); };
    const up = () => { document.removeEventListener("mousemove", move); document.removeEventListener("mouseup", up); };
    document.addEventListener("mousemove", move); document.addEventListener("mouseup", up);
  }, [size]);

  const startTouchDrag = useCallback((e) => {
    const t = e.touches[0];
    const startX = t.clientX - pos.x, startY = t.clientY - pos.y;
    const move = ev => { const ct = ev.touches[0]; setPos({ x: Math.max(0, ct.clientX - startX), y: Math.max(0, ct.clientY - startY) }); };
    const up = () => { document.removeEventListener("touchmove", move); document.removeEventListener("touchend", up); };
    document.addEventListener("touchmove", move, { passive: false }); document.addEventListener("touchend", up);
  }, [pos]);

  // Scale content proportionally to window width
  const scale = size.w / BASE_W;

  return (
    <div style={{ position: "fixed", left: pos.x, top: pos.y, width: size.w, height: size.h, zIndex: 1200, display: "flex", flexDirection: "column", background: "#111d32", border: "1px solid #253a5c", borderRadius: "12px", boxShadow: "0 16px 48px rgba(0,0,0,0.6),0 0 0 1px rgba(77,159,255,0.08)", overflow: "hidden" }}>
      <div onMouseDown={startDrag} onTouchStart={startTouchDrag}
        style={{ padding: "8px 12px", background: "#0f1a2e", borderBottom: "1px solid #1c2d4a", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "grab", flexShrink: 0, userSelect: "none" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ color: "#334155", fontSize: "10px", letterSpacing: "2px" }}>⋮⋮</span>
          <span style={{ fontSize: "13px", fontWeight: "600", color: "#e2e8f0" }}>{tool.label}</span>
        </div>
        <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
          <button onClick={onDock} title="Dock back to sidebar" style={{ background: "none", border: "1px solid #1e293b", color: "#8fa3c4", fontSize: "13px", cursor: "pointer", borderRadius: "4px", padding: "2px 6px", lineHeight: 1 }}>⊟</button>
          {tool.studentSafe && <button onClick={onFullscreen} title="Fullscreen" style={{ background: "none", border: "1px solid #1e293b", color: "#8fa3c4", fontSize: "13px", cursor: "pointer", borderRadius: "4px", padding: "2px 6px", lineHeight: 1 }}>⛶</button>}
          <button onClick={onClose} style={{ background: "none", border: "1px solid #7f1d1d", color: "#f87171", fontSize: "13px", cursor: "pointer", borderRadius: "4px", padding: "2px 6px", lineHeight: 1 }}>✕</button>
        </div>
      </div>
      {/* Content scales with window width so text/images grow as you resize */}
      <div style={{ flex: 1, overflow: "auto", transformOrigin: "top left", transform: `scale(${scale})`, width: `${100 / scale}%`, height: `${100 / scale}%` }}>
        {tool.component}
      </div>
      <div onMouseDown={startResize} style={{ position: "absolute", bottom: 0, right: 0, width: "18px", height: "18px", cursor: "nwse-resize", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width="10" height="10" viewBox="0 0 10 10"><path d="M9 1L1 9M9 5L5 9M9 9L9 9" stroke="#334155" strokeWidth="1.5" strokeLinecap="round" /></svg>
      </div>
    </div>
  );
}
