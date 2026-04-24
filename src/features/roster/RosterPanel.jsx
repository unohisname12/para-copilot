import React, { useState, useRef, useMemo } from "react";
import { DB } from '../../data';
import { getStudentLabel } from '../../identity';
import { validatePrivateRoster, extractIdentityEntries, partitionByResolved, buildRosterLookups } from './rosterUtils';

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
    } catch { setRosterError("Could not read that file. Make sure it's a saved name list file."); }
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
    } catch { alert("That text doesn't look right. Paste the contents of your saved name list file."); }
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
        {unresolved.length} not in name list
      </div>
    );
  };

  return (
    <div style={{ width: "220px", flexShrink: 0, background: "#060c18", borderRight: "2px solid #1e3a5f", display: "flex", flexDirection: "column", overflow: "hidden", height: "100%" }}>

      {/* Header */}
      <div style={{ padding: "10px 12px", background: "#0a1628", borderBottom: "1px solid #1e3a5f", flexShrink: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "3px" }}>
          <span style={{ fontSize: "12px", fontWeight: "700", color: "#e2e8f0" }}>Real Names</span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#475569", fontSize: "20px", cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>
        <div style={{ fontSize: "9px", color: "#f59e0b" }}>⚠ Stays on this computer only — never sent anywhere</div>
      </div>

      {/* Scrollable body — everything below the header in one region */}
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>

        {/* Mode toggle */}
        <div style={{ display: "flex", margin: "8px 10px 0", background: "#0a1628", border: "1px solid #1e3a5f", borderRadius: "8px", overflow: "hidden", flexShrink: 0 }}>
          {(["current", "whole"]).map(mode => (
            <button key={mode} onClick={() => setRosterMode(mode)}
              style={{ flex: 1, padding: "6px", background: rosterMode === mode ? "#1e3a5f" : "transparent", color: rosterMode === mode ? "#93c5fd" : "#475569", fontSize: "10px", fontWeight: rosterMode === mode ? "700" : "400", border: "none", cursor: "pointer" }}>
              {mode === "current" ? "This class" : "All students"}
            </button>
          ))}
        </div>

        {/* Upload / status */}
        <div style={{ padding: "8px 10px 0", flexShrink: 0 }}>
          <input type="file" ref={fileInputRef} style={{ display: "none" }} accept=".json" onChange={handleFileUpload} />
          <button onClick={() => { setRosterError(""); fileInputRef.current?.click(); }}
            style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: `2px solid ${hasNames ? "#166534" : "#1e3a5f"}`, background: hasNames ? "#0d2010" : "#0a1628", color: hasNames ? "#4ade80" : "#475569", fontSize: "11px", fontWeight: "700", cursor: "pointer", display: "flex", alignItems: "center", gap: "7px", justifyContent: "center" }}>
            <span>{hasNames ? "✓" : "📂"}</span>
            <span>{hasNames ? "Name list loaded" : "Load name list file"}</span>
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
              ↓ Save name list to file
            </button>
          )}
          <button onClick={() => setShowImport(!showImport)}
            style={{ width: "100%", padding: "6px", borderRadius: "6px", border: "1px solid #1e3a5f", background: "transparent", color: "#475569", fontSize: "10px", cursor: "pointer" }}>
            {showImport ? "Cancel" : "Paste name list text"}
          </button>
          {showImport && (
            <>
              <textarea value={importText} onChange={e => setImportText(e.target.value)}
                placeholder="Paste your saved name list text here..."
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
              Clear name list
            </button>
          )}
        </div>

      </div>

    </div>
  );
}
