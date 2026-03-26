// ══════════════════════════════════════════════════════════════
// WINDOW COMPONENTS — Tip, Floating, Fullscreen, Stealth, RosterPanel
// ══════════════════════════════════════════════════════════════
import React, { useState, useEffect, useRef, useCallback } from "react";
import ReactDOM from 'react-dom';
import { DB } from '../data';

// ── System 2: Private Roster validator ───────────────────────
// Accepts two formats:
//   A) Official:  { type: "privateRoster", schemaVersion: "1.0", students: [...] }
//   B) Combined:  { privateRosterMap: { schemaVersion, privateRosterMap: [...] }, normalizedStudents: ... }
// Returns null if valid, error string otherwise.
function validatePrivateRoster(json) {
  if (!json || typeof json !== "object" || Array.isArray(json))
    return "Not a valid JSON object.";

  // Format B: combined export — check this BEFORE normalizedStudents guard
  if (json.privateRosterMap) {
    const inner = json.privateRosterMap;
    if (!inner || typeof inner !== "object" || Array.isArray(inner))
      return 'Malformed file: "privateRosterMap" must be an object.';
    if (!Array.isArray(inner.privateRosterMap))
      return 'Malformed file: expected "privateRosterMap.privateRosterMap" to be an array.';
    const hasNames = inner.privateRosterMap.some(e => e && e.realName && String(e.realName).trim());
    if (!hasNames)
      return "No real student names found in this file. Fill in the realName fields and try again.";
    return null;
  }

  // Pure app bundle (no privateRosterMap, has normalizedStudents)
  if (json.normalizedStudents)
    return "This looks like an App Bundle file — upload it in IEP Import → App Bundle JSON tab, not here.";

  // Format A: official privateRoster
  if (json.type !== "privateRoster")
    return json.type
      ? `Wrong file type: "${json.type}". Expected a Private Roster file.`
      : 'Missing type field. Expected { "type": "privateRoster", ... }';
  if (!Array.isArray(json.students))
    return 'Missing "students" array in file.';
  const hasNames = json.students.some(e => e && e.realName && String(e.realName).trim());
  if (!hasNames)
    return "No real student names found in this file. Fill in the realName fields and try again.";
  return null;
}

// ── Private Roster entry normalizer ──────────────────────────
// Converts either format into [{ displayLabel, realName, color }]
// so handlePrivateRosterLoad in App.jsx always receives the same shape.
function extractRosterEntries(json, allStudents = {}) {
  if (json.privateRosterMap) {
    // Build a pseudonym→color map from available imported students
    const colorByPseudonym = {};
    Object.values(allStudents).forEach(s => {
      if (s.pseudonym) colorByPseudonym[s.pseudonym] = s.color || "";
    });
    return json.privateRosterMap.privateRosterMap.map(e => ({
      displayLabel: e.pseudonym || "",
      realName:     e.realName  || "",
      color:        colorByPseudonym[e.pseudonym] || "",
    }));
  }
  // Official format already matches the expected shape
  return json.students;
}

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

// ── Fullscreen Tool ──────────────────────────────────────────
export function FullscreenTool({ tool, onClose }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 2000, background: "#04080f", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "8px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #1e293b", flexShrink: 0, background: "#0a1120" }}>
        <span style={{ fontSize: "14px", fontWeight: "700", color: "#e2e8f0" }}>{tool.label}</span>
        <button onClick={onClose} style={{ padding: "6px 16px", background: "#1e293b", color: "#94a3b8", border: "1px solid #334155", borderRadius: "8px", cursor: "pointer", fontSize: "13px", fontWeight: "600" }}>✕ Close</button>
      </div>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", overflow: "auto", padding: "20px" }} className="fullscreen-tool-body">
        <div style={{ width: "100%", maxWidth: "600px", transform: "scale(1.3)", transformOrigin: "center center" }}>{tool.component}</div>
      </div>
    </div>
  );
}

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

// ── Private Roster Panel ─────────────────────────────────────
// Local-only real name reference. Never stored, logged, exported, or sent to AI.
export function RosterPanel({ onClose, allStudents = {}, privateRoster = {}, onNameChange, onRosterLoad, onClearRoster }) {
  const initPeriods = () => Object.entries(DB.periods).map(([id, p]) => ({ id, pseudonym: p.label, realClass: "" }));
  const [periods,    setPeriods]   = useState(initPeriods);
  const [importText, setImportText] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [rosterError, setRosterError] = useState("");
  const fileInputRef = useRef();

  // All students (DB + imported), in a stable order
  const students = Object.values(allStudents).map(s => ({ id: s.id, pseudonym: s.pseudonym, color: s.color }));

  const updatePeriodClass = (id, val) => setPeriods(prev => prev.map(m => m.id === id ? { ...m, realClass: val } : m));

  // Upload a Private Roster JSON file — strict validation, match by displayLabel
  const handleFileUpload = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setRosterError("");
    try {
      const json = JSON.parse(await file.text());
      const err = validatePrivateRoster(json);
      if (err) { setRosterError(err); return; }
      onRosterLoad?.(extractRosterEntries(json, allStudents)); // [{displayLabel, realName, color}]
    } catch { setRosterError("Could not read file. Make sure it is a valid Private Roster JSON."); }
    e.target.value = "";
  };

  const hasNames = Object.values(privateRoster).some(v => v);

  // Generate a Private Roster JSON template pre-filled with current student slots
  const buildRosterTemplate = () => ({
    schemaVersion: "1.0",
    type: "privateRoster",
    students: students.map(m => ({
      color: m.color,
      displayLabel: m.pseudonym,
      realName: privateRoster[m.pseudonym] || "",
    })),
  });

  const handleDownloadTemplate = () => {
    const json = JSON.stringify(buildRosterTemplate(), null, 2);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    a.download = "private_roster.json";
    a.click();
  };

  const handleCopyTemplate = () => {
    const json = JSON.stringify(buildRosterTemplate(), null, 2);
    navigator.clipboard?.writeText(json)
      .then(() => alert("Template copied! Fill in realName fields, then upload it here."))
      .catch(() => alert(json));
  };

  // Paste JSON import — accepts new privateRoster format
  const handleImport = () => {
    try {
      const data = JSON.parse(importText);
      const err = validatePrivateRoster(data);
      if (err) { alert("Invalid format: " + err); return; }
      onRosterLoad?.(extractRosterEntries(data, allStudents));
      setImportText(""); setShowImport(false);
    } catch { alert("Invalid JSON. Use the downloaded template format."); }
  };

  return (
    <div style={{ width: "220px", flexShrink: 0, background: "#060c18", borderRight: "2px solid #1e3a5f", display: "flex", flexDirection: "column", overflow: "hidden", height: "100vh" }}>
      {/* Header */}
      <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexShrink: 0, background: "#0a1628" }}>
        <div>
          <div style={{ fontSize: "12px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "2px" }}>Private Roster</div>
          <div style={{ fontSize: "10px", color: "#f59e0b", lineHeight: "1.4" }}>⚠ Local only — never saved, logged, or sent to AI</div>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: "20px", cursor: "pointer", lineHeight: 1, flexShrink: 0, marginLeft: "8px" }}>×</button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "10px" }}>
        {/* Privacy notice */}
        <div style={{ padding: "8px 10px", background: "#1a1505", border: "1px solid #854d0e", borderRadius: "8px", marginBottom: "10px", fontSize: "10px", color: "#fbbf24", lineHeight: "1.5" }}>
          This panel is a temporary visual reference only. Nothing you type here is stored, exported, or used anywhere in the app.
        </div>

        {/* Upload button */}
        <input type="file" ref={fileInputRef} style={{ display: "none" }} accept=".json" onChange={handleFileUpload} />
        <button onClick={() => { setRosterError(""); fileInputRef.current?.click(); }}
          style={{ width: "100%", padding: "9px 10px", borderRadius: "8px", border: `2px solid ${hasNames ? "#166534" : "var(--border-light)"}`, background: hasNames ? "#0d2010" : "var(--bg-surface)", color: hasNames ? "#4ade80" : "var(--text-secondary)", fontSize: "12px", fontWeight: "700", cursor: "pointer", marginBottom: "6px", display: "flex", alignItems: "center", gap: "8px", justifyContent: "center" }}>
          <span>{hasNames ? "✓" : "📂"}</span>
          <span>{hasNames ? "Private Roster Loaded" : "Upload Private Roster JSON"}</span>
        </button>
        {rosterError && (
          <div style={{ fontSize: "11px", color: "#f87171", background: "#1a0505", border: "1px solid #7f1d1d", borderRadius: "6px", padding: "8px 10px", marginBottom: "6px", lineHeight: "1.5" }}>
            ✗ {rosterError}
          </div>
        )}
        {hasNames && (
          <button onClick={() => { if (window.confirm("Clear all real names?")) { onClearRoster?.(); setRosterError(""); } }}
            style={{ width: "100%", padding: "6px", borderRadius: "6px", border: "1px solid #7f1d1d", background: "#1a0505", color: "#f87171", fontSize: "10px", cursor: "pointer", marginBottom: "12px" }}>
            Clear Private Roster
          </button>
        )}

        {/* Students */}
        <div style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: "8px", fontWeight: "600" }}>Students</div>
        {students.map(m => {
          const realName = privateRoster[m.pseudonym] || "";
          return (
            <div key={m.id} style={{ marginBottom: "9px" }}>
              <div style={{ fontSize: "10px", color: m.color, fontWeight: "600", marginBottom: "3px" }}>{m.pseudonym}</div>
              <input value={realName} onChange={e => onNameChange?.(m.pseudonym, e.target.value)}
                placeholder="Real name..."
                style={{ width: "100%", padding: "6px 8px", background: "var(--bg-surface)", border: `1px solid ${realName ? m.color + "60" : "var(--border)"}`, borderRadius: "6px", color: realName ? "var(--text-primary)" : "var(--text-muted)", fontSize: "12px" }} />
            </div>
          );
        })}

        {/* Classes */}
        <div style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: "8px", marginTop: "16px", fontWeight: "600" }}>Classes</div>
        {periods.map(m => (
          <div key={m.id} style={{ marginBottom: "9px" }}>
            <div style={{ fontSize: "10px", color: "#60a5fa", fontWeight: "600", marginBottom: "3px" }}>{m.pseudonym.split("—")[0].trim()}</div>
            <input value={m.realClass} onChange={e => updatePeriodClass(m.id, e.target.value)}
              placeholder="Real class..."
              style={{ width: "100%", padding: "6px 8px", background: "var(--bg-surface)", border: `1px solid ${m.realClass ? "#3b82f680" : "var(--border)"}`, borderRadius: "6px", color: m.realClass ? "var(--text-primary)" : "var(--text-muted)", fontSize: "12px" }} />
          </div>
        ))}

        {/* Template / import */}
        <div style={{ marginTop: "16px", paddingTop: "12px", borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: "6px" }}>
          <button onClick={handleDownloadTemplate}
            style={{ width: "100%", padding: "7px", borderRadius: "6px", border: "1px solid #166534", background: "#0d2010", color: "#4ade80", fontSize: "11px", cursor: "pointer", fontWeight: "600" }}>
            ↓ Download Roster Template
          </button>
          <button onClick={handleCopyTemplate}
            style={{ width: "100%", padding: "7px", borderRadius: "6px", border: "1px solid var(--border-light)", background: "var(--bg-surface)", color: "#60a5fa", fontSize: "11px", cursor: "pointer", fontWeight: "500" }}>
            📋 Copy Fill-in Template
          </button>
          <button onClick={() => setShowImport(!showImport)}
            style={{ width: "100%", padding: "7px", borderRadius: "6px", border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text-muted)", fontSize: "11px", cursor: "pointer" }}>
            {showImport ? "Cancel" : "Import JSON"}
          </button>
          {showImport && (
            <>
              <textarea value={importText} onChange={e => setImportText(e.target.value)}
                placeholder="Paste filled-in template JSON here..."
                style={{ width: "100%", minHeight: "80px", padding: "8px", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "6px", color: "var(--text-primary)", fontSize: "11px", resize: "none", fontFamily: "monospace" }} />
              <button onClick={handleImport}
                style={{ width: "100%", padding: "7px", borderRadius: "6px", border: "1px solid #166534", background: "#14532d", color: "#4ade80", fontSize: "11px", cursor: "pointer", fontWeight: "600" }}>
                Apply Names
              </button>
            </>
          )}
          <button onClick={() => { if (window.confirm("Clear all real names from the roster panel?")) onClearRoster?.(); }}
            style={{ width: "100%", padding: "6px", borderRadius: "6px", border: "1px solid #7f1d1d", background: "#1a0505", color: "#f87171", fontSize: "10px", cursor: "pointer", marginTop: "4px" }}>
            Clear All Names
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Stealth Mode Screen ──────────────────────────────────────
export function StealthScreen({ activeTool, toolboxTools, onSelectTool, onExit }) {
  const tool = toolboxTools.find(t => t.id === activeTool);
  const studentTools = toolboxTools.filter(t => ["timer", "breathing", "grounding", "calc", "mult", "cer"].includes(t.id));
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1500, background: "#04080f", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #1e293b", flexShrink: 0 }}>
        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
          <span style={{ fontSize: "14px", fontWeight: "700", color: "#e2e8f0" }}>Classroom Tools</span>
          <span style={{ fontSize: "10px", color: "#334155", background: "#0f172a", padding: "2px 8px", borderRadius: "20px" }}>Student-Safe View</span>
        </div>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {studentTools.map(t => (
            <button key={t.id} onClick={() => onSelectTool(t.id)} style={{ padding: "6px 14px", borderRadius: "6px", border: "none", cursor: "pointer", fontSize: "13px", fontWeight: "500", background: activeTool === t.id ? "#1d4ed8" : "#1e293b", color: activeTool === t.id ? "#fff" : "#94a3b8" }}>{t.label}</button>
          ))}
          <div style={{ width: "1px", background: "#1e293b", margin: "0 4px" }} />
          <button onClick={onExit} style={{ padding: "6px 14px", borderRadius: "6px", border: "1px solid #7f1d1d", cursor: "pointer", fontSize: "13px", fontWeight: "600", background: "#1a0505", color: "#f87171" }}>Exit Stealth</button>
        </div>
      </div>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", overflow: "auto", padding: "20px" }}>
        {tool ? <div style={{ width: "100%", maxWidth: "600px", transform: "scale(1.3)", transformOrigin: "center center" }}>{tool.component}</div> :
          <div style={{ textAlign: "center", color: "#334155" }}><div style={{ fontSize: "48px", marginBottom: "12px" }}>🛡️</div><div style={{ fontSize: "16px", fontWeight: "600" }}>Stealth Mode Active</div><div style={{ fontSize: "13px", marginTop: "4px" }}>Pick a tool above.</div></div>}
      </div>
    </div>
  );
}
