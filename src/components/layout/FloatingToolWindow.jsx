import React, { useState, useCallback, useEffect } from "react";

// ── Floating Draggable + Resizable Window ────────────────────
// Clamps position to viewport so windows can't drift off-screen on small
// displays (Chromebooks). Re-clamps on window resize / orientation change.
const BASE_W = 360;
const MARGIN = 8; // keep at least this much on-screen

function clampPos(x, y, w, h) {
  const vw = window.innerWidth, vh = window.innerHeight;
  return {
    x: Math.min(Math.max(0, x), Math.max(0, vw - MARGIN - Math.min(w, 100))),
    y: Math.min(Math.max(0, y), Math.max(0, vh - MARGIN - 32)),
  };
}

export function FloatingToolWindow({ tool, onClose, onFullscreen, onDock }) {
  const [pos, setPos] = useState(() =>
    clampPos(Math.max(60, window.innerWidth / 2 - 200), 60, BASE_W, 420)
  );
  const [size, setSize] = useState(() => {
    const vw = window.innerWidth, vh = window.innerHeight;
    return { w: Math.min(BASE_W, vw - 32), h: Math.min(420, vh - 80) };
  });

  // Re-clamp when viewport changes (rotation, Chromebook dock, DevTools open)
  useEffect(() => {
    const onResize = () => {
      setPos(p => clampPos(p.x, p.y, size.w, size.h));
      setSize(s => ({
        w: Math.min(s.w, window.innerWidth - 32),
        h: Math.min(s.h, window.innerHeight - 80),
      }));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [size.w, size.h]);

  const startDrag = useCallback((e) => {
    e.preventDefault();
    const startX = e.clientX - pos.x, startY = e.clientY - pos.y;
    const move = ev => setPos(clampPos(ev.clientX - startX, ev.clientY - startY, size.w, size.h));
    const up = () => { document.removeEventListener("mousemove", move); document.removeEventListener("mouseup", up); };
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
  }, [pos, size]);

  const startResize = useCallback((e) => {
    e.preventDefault(); e.stopPropagation();
    const startX = e.clientX, startY = e.clientY, startW = size.w, startH = size.h;
    const move = ev => {
      const newW = Math.max(260, Math.min(window.innerWidth - 32, startW + (ev.clientX - startX)));
      const newH = Math.max(200, Math.min(window.innerHeight - 80, startH + (ev.clientY - startY)));
      setSize({ w: newW, h: newH });
    };
    const up = () => { document.removeEventListener("mousemove", move); document.removeEventListener("mouseup", up); };
    document.addEventListener("mousemove", move); document.addEventListener("mouseup", up);
  }, [size]);

  const startTouchDrag = useCallback((e) => {
    const t = e.touches[0];
    const startX = t.clientX - pos.x, startY = t.clientY - pos.y;
    const move = ev => { const ct = ev.touches[0]; setPos(clampPos(ct.clientX - startX, ct.clientY - startY, size.w, size.h)); };
    const up = () => { document.removeEventListener("touchmove", move); document.removeEventListener("touchend", up); };
    document.addEventListener("touchmove", move, { passive: false });
    document.addEventListener("touchend", up);
  }, [pos, size]);

  // Recall: snap to a safe default position (useful if viewport shrank and window is at edge)
  const recall = () => setPos(clampPos(40, 60, size.w, size.h));

  const scale = size.w / BASE_W;

  return (
    <div
      style={{
        position: "fixed",
        left: pos.x, top: pos.y,
        width: size.w, height: size.h,
        zIndex: 1200,
        display: "flex", flexDirection: "column",
        background: "linear-gradient(180deg, var(--panel-raised), var(--panel-bg))",
        border: "1px solid var(--border-light)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow-lg), 0 0 0 1px var(--accent-border)",
        overflow: "hidden",
      }}
    >
      <div
        onMouseDown={startDrag}
        onTouchStart={startTouchDrag}
        style={{
          padding: "var(--space-2) var(--space-3)",
          background: "var(--bg-surface)",
          borderBottom: "1px solid var(--border)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          cursor: "grab", flexShrink: 0, userSelect: "none",
          minHeight: 40,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <span style={{ color: "var(--text-dim)", fontSize: 10, letterSpacing: 2 }}>⋮⋮</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
            {tool.label}
          </span>
        </div>
        <div style={{ display: "flex", gap: 4, alignItems: "center", flexShrink: 0 }}>
          <button
            onClick={recall}
            title="Recenter window"
            style={floatBtnStyle}
          >↺</button>
          <button
            onClick={onDock}
            title="Dock back to sidebar"
            style={floatBtnStyle}
          >⊟</button>
          {tool.studentSafe && (
            <button
              onClick={onFullscreen}
              title="Fullscreen"
              style={floatBtnStyle}
            >⛶</button>
          )}
          <button
            onClick={onClose}
            title="Close"
            style={{ ...floatBtnStyle, borderColor: "rgba(248,113,113,0.35)", color: "var(--red)" }}
          >✕</button>
        </div>
      </div>
      <div
        style={{
          flex: 1, overflow: "auto",
          transformOrigin: "top left",
          transform: `scale(${scale})`,
          width: `${100 / scale}%`,
          height: `${100 / scale}%`,
        }}
      >
        {tool.component}
      </div>
      <div
        onMouseDown={startResize}
        style={{
          position: "absolute", bottom: 0, right: 0,
          width: 22, height: 22,
          cursor: "nwse-resize",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        <svg width="12" height="12" viewBox="0 0 12 12">
          <path d="M11 1L1 11M11 5L5 11M11 9L9 11" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  );
}

const floatBtnStyle = {
  width: 28, height: 28,
  display: "flex", alignItems: "center", justifyContent: "center",
  background: "transparent",
  border: "1px solid var(--border)",
  color: "var(--text-secondary)",
  fontSize: 13,
  cursor: "pointer",
  borderRadius: "var(--radius-sm)",
  padding: 0,
  lineHeight: 1,
  transition: "all 120ms cubic-bezier(0.16,1,0.3,1)",
};
