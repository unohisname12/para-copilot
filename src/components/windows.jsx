// ══════════════════════════════════════════════════════════════
// WINDOW COMPONENTS — Tip, Floating, Fullscreen, Stealth, RosterPanel
// ══════════════════════════════════════════════════════════════
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import ReactDOM from 'react-dom';
import { DB } from '../data';
import { getStudentLabel, migrateIdentity } from '../identity';

function validatePrivateRoster(json) {
  if (!json || typeof json !== "object" || Array.isArray(json))
    return "Not a valid JSON object.";

  // Combined export format (has privateRosterMap key)
  if (json.privateRosterMap) {
    const inner = json.privateRosterMap;
    if (!inner || typeof inner !== "object" || Array.isArray(inner))
      return 'Malformed file: "privateRosterMap" must be an object.';
    if (!Array.isArray(inner.privateRosterMap))
      return 'Malformed file: expected "privateRosterMap.privateRosterMap" to be an array.';
    if (!inner.privateRosterMap.some(e => e && e.realName && String(e.realName).trim()))
      return "No real student names found in this file.";
    return null;
  }

  // Pure app bundle (no private roster data)
  if (json.normalizedStudents)
    return "This looks like an App Bundle file — upload it in IEP Import → App Bundle JSON tab, not here.";

  if (json.students && json.periods && !json.type)
    return "This looks like a Master Roster file — upload it in IEP Import → Master Roster JSON tab.";

  // Official privateRoster artifact (schemaVersion 1.0 or 2.0)
  if (json.type !== "privateRoster")
    return json.type
      ? `Wrong file type: "${json.type}". Expected a Private Roster file.`
      : 'Missing type field. Expected { "type": "privateRoster", ... }';
  if (!Array.isArray(json.students))
    return 'Missing "students" array in file.';
  if (!json.students.some(e => e && e.realName && String(e.realName).trim()))
    return "No real student names found in this file.";
  return null;
}

// Normalizes any supported format into [{ realName, pseudonym, color, periodIds, classLabels, identity }]
// so handleIdentityLoad in App.jsx always receives the same v3.0 shape.
export function extractIdentityEntries(json, allStudents = {}) {
  let raw;

  // Combined export — group by realName to build entries
  if (json.privateRosterMap) {
    const colorByPseudonym = {};
    Object.values(allStudents).forEach(s => {
      if (s.pseudonym) colorByPseudonym[s.pseudonym] = s.color || "";
    });
    const byRealName = new Map();
    json.privateRosterMap.privateRosterMap.forEach(e => {
      if (!e.realName) return;
      const key = e.realName.trim();
      if (!byRealName.has(key)) {
        byRealName.set(key, {
          realName: key, pseudonym: e.pseudonym || "",
          color: colorByPseudonym[e.pseudonym] || "",
          periodIds: [], classLabels: {},
        });
      }
      const rec = byRealName.get(key);
      if (e.periodId && !rec.periodIds.includes(e.periodId)) {
        rec.periodIds.push(e.periodId);
        rec.classLabels[e.periodId] = e.classLabel || "";
      }
    });
    raw = [...byRealName.values()];
  } else if (json.students?.[0]?.periodIds !== undefined) {
    // v2.0/v3.0 official artifact — already the right shape
    raw = json.students.filter(e => e && e.realName);
  } else {
    // v1.0 official artifact [{ displayLabel, realName, color }] — promote to v2.0 shape
    raw = (json.students || [])
      .filter(e => e && e.realName)
      .map(e => ({ realName: e.realName, pseudonym: e.displayLabel || "", color: e.color || "", periodIds: [], classLabels: {} }));
  }

  return raw.map(e => migrateIdentity(e));
}

// ── partitionByResolved ───────────────────────────────────────
// Splits studentIds into resolved (real name loaded) / unresolved buckets.
export function partitionByResolved(studentIds, nameById) {
  const resolved = [];
  const unresolved = [];
  studentIds.forEach(id => {
    if (nameById[id]) resolved.push(id);
    else unresolved.push(id);
  });
  return { resolved, unresolved };
}

// ── buildRosterLookups ────────────────────────────────────────
// Resolves registry entries to studentIds ONCE and returns stable id-keyed maps.
// All downstream display code uses studentId keys instead of pseudonym strings.
//
// Resolution strategy (Phase C):
//   1. Prefer e.studentId directly (v3.0+ artifacts — stable, collision-safe)
//   2. Fall back to pseudonym lookup for older artifacts without studentId
//   3. If e.studentId is present but not found in allStudents — skip safely;
//      a stale/wrong id is a data problem, not a missing-id problem.
export function buildRosterLookups(allStudents, identityRegistry) {
  // Pseudonym-keyed lookup retained for backward compat with pre-v3.0 artifacts
  // that were exported before studentId was added to the private roster schema.
  const stuByPseudonym = {};
  Object.values(allStudents).forEach(s => {
    if (s.pseudonym) stuByPseudonym[s.pseudonym] = s;
  });

  const nameById = {};
  const periodIdsById = {};
  identityRegistry.forEach(e => {
    let stu;
    if (e.studentId) {
      // Phase C: studentId-first — direct lookup, no pseudonym needed.
      // If the id is present but stale (not in allStudents), skip — do not fall
      // back to pseudonym, as that could silently join to the wrong student.
      stu = allStudents[e.studentId];
    } else {
      // Fallback for pre-v3.0 artifacts that carry no studentId field.
      stu = stuByPseudonym[e.pseudonym];
    }
    if (!stu) return;
    nameById[stu.id] = e.realName;
    periodIdsById[stu.id] = e.periodIds;
  });
  return { nameById, periodIdsById };
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
export function RosterPanel({ onClose, allStudents = {}, identityRegistry = [], activePeriod, onIdentityLoad, onClearRoster }) {
  const [rosterMode,  setRosterMode]  = useState("current"); // "current" | "whole"
  const [showImport,  setShowImport]  = useState(false);
  const [importText,  setImportText]  = useState("");
  const [rosterError, setRosterError] = useState("");
  const fileInputRef = useRef();

  const hasNames = identityRegistry.length > 0;

  // Stable studentId-keyed lookups — pseudonym resolution happens once here.
  // renderStudentRow uses stuId directly; no pseudonym key access at display time.
  const { nameById, periodIdsById } = useMemo(
    () => buildRosterLookups(allStudents, identityRegistry),
    [allStudents, identityRegistry]
  );

  // Period groups: { [periodId]: { classLabel, studentIds: string[] } }
  const periodGroups = useMemo(() => {
    const groups = {};

    // DB students — placed via DB.periods
    Object.entries(DB.periods).forEach(([pid, p]) => {
      groups[pid] = { classLabel: p.label, studentIds: [] };
      p.students.forEach(stuId => {
        if (allStudents[stuId]) groups[pid].studentIds.push(stuId);
      });
    });

    // Resolve pseudonym → student for period placement.
    // Prefer entry.studentId (v3.0+); fall back to pseudonym bridge for older entries.
    const byPseudonym = {};
    Object.values(allStudents).forEach(s => {
      if (s.pseudonym) byPseudonym[s.pseudonym] = s;
    });

    // Place identity-registry students into all their period groups
    const placedByRegistry = new Set();
    identityRegistry.forEach(entry => {
      const stu = (entry.studentId && allStudents[entry.studentId]) || byPseudonym[entry.pseudonym];
      if (!stu) return;
      placedByRegistry.add(stu.id);
      entry.periodIds.forEach(pid => {
        if (!groups[pid]) groups[pid] = { classLabel: entry.classLabels[pid] || pid, studentIds: [] };
        if (!groups[pid].studentIds.includes(stu.id)) groups[pid].studentIds.push(stu.id);
      });
    });

    // Place any imported students not in identityRegistry by their primary periodId
    Object.values(allStudents).forEach(s => {
      if (!s.imported || placedByRegistry.has(s.id) || !s.periodId) return;
      if (!groups[s.periodId]) groups[s.periodId] = { classLabel: s.classLabel || s.periodId, studentIds: [] };
      if (!groups[s.periodId].studentIds.includes(s.id)) groups[s.periodId].studentIds.push(s.id);
    });

    return groups;
  }, [allStudents, identityRegistry]);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setRosterError("");
    try {
      const json = JSON.parse(await file.text());
      const err = validatePrivateRoster(json);
      if (err) { setRosterError(err); return; }
      onIdentityLoad?.(extractIdentityEntries(json, allStudents));
    } catch { setRosterError("Could not read file. Make sure it is a valid Private Roster JSON."); }
    e.target.value = "";
  };

  const handleSaveRoster = () => {
    const dateStr = new Date().toISOString().slice(0, 10);
    const json = { type: "privateRoster", schemaVersion: "3.0", createdAt: new Date().toISOString(), students: identityRegistry };
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(json, null, 2)], { type: "application/json" }));
    a.download = `private-roster-${dateStr}.json`;
    a.click();
  };

  const handlePasteImport = () => {
    try {
      const data = JSON.parse(importText);
      const err = validatePrivateRoster(data);
      if (err) { alert("Invalid format: " + err); return; }
      onIdentityLoad?.(extractIdentityEntries(data, allStudents));
      setImportText(""); setShowImport(false);
    } catch { alert("Invalid JSON. Paste the contents of your saved Private Roster file."); }
  };

  const renderStudentRow = (stuId) => {
    const stu = allStudents[stuId];
    if (!stu) return null;
    const realName  = nameById[stuId];
    // When a roster is loaded, hide rows with no resolved real name.
    if (hasNames && !realName) return null;
    const crossPids = periodIdsById[stuId] || [];
    return (
      <div key={stuId} style={{ display: "flex", alignItems: "center", gap: "7px", padding: "5px 8px", background: "#0a1628", border: "1px solid #1e3a5f", borderRadius: "6px" }}>
        <div style={{ width: "9px", height: "9px", borderRadius: "50%", background: stu.color, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "10px", color: stu.color, fontWeight: "600", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{getStudentLabel(stu, "compact")}</div>
          {realName && (
            <div style={{ fontSize: "9px", color: "#94a3b8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{realName}</div>
          )}
        </div>
        {crossPids.length > 1 && (
          <div style={{ fontSize: "7px", background: "#1e3a5f", color: "#60a5fa", padding: "2px 5px", borderRadius: "10px", whiteSpace: "nowrap", flexShrink: 0 }}>
            {crossPids.join("·")}
          </div>
        )}
      </div>
    );
  };

  const renderUnresolvedHint = (studentIds) => {
    if (!hasNames) return null;
    const { unresolved } = partitionByResolved(studentIds, nameById);
    if (unresolved.length === 0) return null;
    return (
      <div style={{ fontSize: "9px", color: "#334155", fontStyle: "italic", paddingLeft: "8px", marginTop: "3px" }}>
        {unresolved.length} not in roster
      </div>
    );
  };

  return (
    <div style={{ width: "220px", flexShrink: 0, background: "#060c18", borderRight: "2px solid #1e3a5f", display: "flex", flexDirection: "column", overflow: "hidden", height: "100%" }}>

      {/* Header */}
      <div style={{ padding: "10px 12px", background: "#0a1628", borderBottom: "1px solid #1e3a5f", flexShrink: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "3px" }}>
          <span style={{ fontSize: "12px", fontWeight: "700", color: "#e2e8f0" }}>Private Roster</span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#475569", fontSize: "20px", cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>
        <div style={{ fontSize: "9px", color: "#f59e0b" }}>⚠ Local only — never saved or sent to AI</div>
      </div>

      {/* Scrollable body — everything below the header in one region */}
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>

        {/* Mode toggle */}
        <div style={{ display: "flex", margin: "8px 10px 0", background: "#0a1628", border: "1px solid #1e3a5f", borderRadius: "8px", overflow: "hidden", flexShrink: 0 }}>
          {(["current", "whole"]).map(mode => (
            <button key={mode} onClick={() => setRosterMode(mode)}
              style={{ flex: 1, padding: "6px", background: rosterMode === mode ? "#1e3a5f" : "transparent", color: rosterMode === mode ? "#93c5fd" : "#475569", fontSize: "10px", fontWeight: rosterMode === mode ? "700" : "400", border: "none", cursor: "pointer" }}>
              {mode === "current" ? "Current Class" : "Whole Roster"}
            </button>
          ))}
        </div>

        {/* Upload / status */}
        <div style={{ padding: "8px 10px 0", flexShrink: 0 }}>
          <input type="file" ref={fileInputRef} style={{ display: "none" }} accept=".json" onChange={handleFileUpload} />
          <button onClick={() => { setRosterError(""); fileInputRef.current?.click(); }}
            style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: `2px solid ${hasNames ? "#166534" : "#1e3a5f"}`, background: hasNames ? "#0d2010" : "#0a1628", color: hasNames ? "#4ade80" : "#475569", fontSize: "11px", fontWeight: "700", cursor: "pointer", display: "flex", alignItems: "center", gap: "7px", justifyContent: "center" }}>
            <span>{hasNames ? "✓" : "📂"}</span>
            <span>{hasNames ? "Private Roster Loaded" : "Load Private Roster JSON"}</span>
          </button>
          {rosterError && (
            <div style={{ fontSize: "10px", color: "#f87171", background: "#1a0505", border: "1px solid #7f1d1d", borderRadius: "6px", padding: "7px 9px", marginTop: "6px", lineHeight: "1.5" }}>
              ✗ {rosterError}
            </div>
          )}
        </div>

        {/* Student list */}
        <div style={{ padding: "8px 10px" }}>
          {rosterMode === "current" ? (
            (() => {
              const group = periodGroups[activePeriod];
              if (!group) return (
                <div style={{ fontSize: "11px", color: "#334155", fontStyle: "italic", textAlign: "center", marginTop: "20px" }}>
                  No students found for this period.
                </div>
              );
              return (
                <>
                  <div style={{ padding: "4px 8px", background: "#0f2040", borderLeft: "3px solid #3b82f6", fontSize: "10px", fontWeight: "700", color: "#60a5fa", marginBottom: "8px", borderRadius: "0 4px 4px 0" }}>
                    {group.classLabel}&nbsp;·&nbsp;<span style={{ fontWeight: "400" }}>{hasNames ? partitionByResolved(group.studentIds, nameById).resolved.length : group.studentIds.length}</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                    {group.studentIds.map(renderStudentRow)}
                  </div>
                  {renderUnresolvedHint(group.studentIds)}
                </>
              );
            })()
          ) : (
            Object.entries(periodGroups)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([pid, group]) => (
                <div key={pid} style={{ marginBottom: "12px" }}>
                  <div style={{ padding: "4px 8px", background: pid === activePeriod ? "#1e3a5f" : "#0f2040", borderLeft: `3px solid ${pid === activePeriod ? "#93c5fd" : "#3b82f6"}`, fontSize: "10px", fontWeight: "700", color: pid === activePeriod ? "#93c5fd" : "#60a5fa", marginBottom: "5px", borderRadius: "0 4px 4px 0", display: "flex", justifyContent: "space-between" }}>
                    <span>{pid === activePeriod ? "★ " : ""}{group.classLabel}</span>
                    <span style={{ fontWeight: "400", opacity: 0.7 }}>{hasNames ? partitionByResolved(group.studentIds, nameById).resolved.length : group.studentIds.length}</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    {group.studentIds.map(renderStudentRow)}
                  </div>
                  {renderUnresolvedHint(group.studentIds)}
                </div>
              ))
          )}
        </div>

        {/* Footer buttons */}
        <div style={{ padding: "8px 10px 16px", borderTop: "1px solid #1e3a5f", marginTop: "auto", display: "flex", flexDirection: "column", gap: "5px" }}>
          {hasNames && (
            <button onClick={handleSaveRoster}
              style={{ width: "100%", padding: "7px", borderRadius: "6px", border: "1px solid #166534", background: "#0d2010", color: "#4ade80", fontSize: "11px", fontWeight: "700", cursor: "pointer" }}>
              ↓ Save Private Roster
            </button>
          )}
          <button onClick={() => setShowImport(!showImport)}
            style={{ width: "100%", padding: "6px", borderRadius: "6px", border: "1px solid #1e3a5f", background: "transparent", color: "#475569", fontSize: "10px", cursor: "pointer" }}>
            {showImport ? "Cancel" : "Import JSON"}
          </button>
          {showImport && (
            <>
              <textarea value={importText} onChange={e => setImportText(e.target.value)}
                placeholder="Paste saved Private Roster JSON here..."
                style={{ width: "100%", minHeight: "70px", padding: "7px", background: "#0a1628", border: "1px solid #1e3a5f", borderRadius: "6px", color: "#e2e8f0", fontSize: "10px", resize: "none", fontFamily: "monospace", boxSizing: "border-box" }} />
              <button onClick={handlePasteImport}
                style={{ width: "100%", padding: "6px", borderRadius: "6px", border: "1px solid #166534", background: "#14532d", color: "#4ade80", fontSize: "10px", fontWeight: "700", cursor: "pointer" }}>
                Apply
              </button>
            </>
          )}
          {hasNames && (
            <button onClick={() => { if (window.confirm("Clear all real names?")) { onClearRoster?.(); setRosterError(""); } }}
              style={{ width: "100%", padding: "5px", borderRadius: "6px", border: "1px solid #7f1d1d", background: "#1a0505", color: "#f87171", fontSize: "9px", cursor: "pointer" }}>
              Clear Private Roster
            </button>
          )}
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
