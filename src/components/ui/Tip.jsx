import React, { useState, useEffect, useRef } from "react";
import ReactDOM from 'react-dom';

// ── Click-to-learn Info Button (portal-rendered, always on top) ──
export function Tip({ text, children, pos = "top" }) {
  const [show, setShow] = useState(false);
  const [coords, setCoords] = useState(null);
  const triggerRef = useRef();

  useEffect(() => {
    if (!show) return;
    const close = e => { if (triggerRef.current && !triggerRef.current.contains(e.target)) setShow(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [show]);

  const handleToggle = e => {
    e.stopPropagation();
    if (!show && triggerRef.current) {
      setCoords({ rect: triggerRef.current.getBoundingClientRect(), pos });
    }
    setShow(s => !s);
  };

  if (!text) return children;

  const getStyle = () => {
    if (!coords) return {};
    const { rect } = coords;
    const GAP = 10;
    const base = {
      position: "fixed", background: "#1e293b", color: "#e2e8f0", fontSize: "12px",
      lineHeight: "1.6", padding: "10px 14px", borderRadius: "8px",
      border: "1px solid #334155", zIndex: 99999,
      boxShadow: "0 12px 40px rgba(0,0,0,0.8), 0 0 0 1px rgba(77,159,255,0.1)",
      maxWidth: "280px", whiteSpace: "normal", pointerEvents: "none",
    };
    if (pos === "top")    return { ...base, bottom: window.innerHeight - rect.top + GAP, left: rect.left + rect.width / 2, transform: "translateX(-50%)" };
    if (pos === "bottom") return { ...base, top: rect.bottom + GAP, left: rect.left + rect.width / 2, transform: "translateX(-50%)" };
    if (pos === "right")  return { ...base, top: rect.top + rect.height / 2, left: rect.right + GAP, transform: "translateY(-50%)" };
    return { ...base, top: rect.top + rect.height / 2, right: window.innerWidth - rect.left + GAP, transform: "translateY(-50%)" };
  };

  return (
    <div ref={triggerRef} style={{ position: "relative", display: "flex", alignItems: "center", gap: "2px" }}>
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
      <button onClick={handleToggle}
        style={{ width: "16px", height: "16px", borderRadius: "50%", border: "1px solid #334155", background: show ? "#1d4ed8" : "#0f172a", color: show ? "#fff" : "#4a6284", fontSize: "9px", fontWeight: "700", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, lineHeight: 1, padding: 0 }}>?</button>
      {show && coords && ReactDOM.createPortal(
        <div style={getStyle()}>{text}</div>,
        document.body
      )}
    </div>
  );
}
