// ── ABC Behavior Builder ─────────────────────────────────────
import React, { useState } from "react";
import { resolveLabel } from '../../privacy/nameResolver';
import { usePrivacyMode } from '../../hooks/usePrivacyMode';

const lbl = { fontSize: "11px", color: "#94a3b8", display: "block", marginBottom: "3px" };

export function ABCBuilder({ students, onSave, periodLabel, currentDate, studentsMap }) {
  const lookup = studentsMap || {};
  const { on: privacyOn } = usePrivacyMode();
  const [stu, setStu] = useState(students[0] || ""), [ant, setAnt] = useState(""), [beh, setBeh] = useState(""), [con, setCon] = useState(""), [intensity, setIntensity] = useState("low"), [duration, setDuration] = useState(""), [staffResp, setStaffResp] = useState(""), [followUp, setFollowUp] = useState("");
  const save = () => {
    if (!beh.trim()) return;
    const note = `ABC | A: ${ant || "N/A"} | B: ${beh} | C: ${con || "N/A"} | Intensity: ${intensity} | Duration: ${duration || "N/A"} | Staff: ${staffResp || "N/A"} | Follow-up: ${followUp || "N/A"}`;
    onSave(stu, note, "Behavior Note", { tags: ["abc", "behavior", intensity], source: "abc_builder" });
    setAnt(""); setBeh(""); setCon(""); setDuration(""); setStaffResp(""); setFollowUp("");
  };
  return (
    <div style={{ padding: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
      <div><label style={lbl}>Student</label><select value={stu} onChange={e => setStu(e.target.value)} className="period-select" style={{ width: "100%" }}>{students.filter(id => lookup[id]).map(id => {
        const s = lookup[id];
        const label = privacyOn ? (s.pseudonym || resolveLabel(s, 'compact')) : resolveLabel(s, 'compact');
        return <option key={id} value={id}>{label}</option>;
      })}</select></div>
      <div><label style={lbl}>A — Antecedent <span style={{ color: "#64748b" }}>(what happened before)</span></label><input value={ant} onChange={e => setAnt(e.target.value)} className="chat-input" placeholder="e.g. Teacher asked class to open books" /></div>
      <div><label style={{ ...lbl, color: "#f87171" }}>B — Behavior <span style={{ color: "#64748b" }}>(what you observed)*</span></label><input value={beh} onChange={e => setBeh(e.target.value)} className="chat-input" placeholder="e.g. Student put head down and refused" /></div>
      <div><label style={lbl}>C — Consequence <span style={{ color: "#64748b" }}>(what happened after)</span></label><input value={con} onChange={e => setCon(e.target.value)} className="chat-input" placeholder="e.g. Offered break pass, student took 5 min walk" /></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
        <div><label style={lbl}>Intensity</label><select value={intensity} onChange={e => setIntensity(e.target.value)} className="period-select" style={{ width: "100%" }}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="crisis">Crisis</option></select></div>
        <div><label style={lbl}>Duration</label><input value={duration} onChange={e => setDuration(e.target.value)} className="chat-input" placeholder="e.g. 5 min" /></div>
      </div>
      <div><label style={lbl}>Staff Response</label><input value={staffResp} onChange={e => setStaffResp(e.target.value)} className="chat-input" placeholder="e.g. Quiet redirect, offered choices" /></div>
      <div><label style={lbl}>Follow-up Needed</label><input value={followUp} onChange={e => setFollowUp(e.target.value)} className="chat-input" placeholder="e.g. Notify case manager" /></div>
      <button className="btn btn-primary" onClick={save} style={{ marginTop: "4px" }}>Save ABC Record</button>
    </div>
  );
}
