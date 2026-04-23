// ── Handoff Note Builder ─────────────────────────────────────
import React, { useState } from "react";
import { resolveLabel } from '../../privacy/nameResolver';
import { useTeamOptional } from '../../context/TeamProvider';
import { pushHandoff } from '../../services/teamSync';

const lbl = { fontSize: "11px", color: "#94a3b8", display: "block", marginBottom: "3px" };

export function HandoffBuilder({ students, onSave, studentsMap, ollamaOnline, ollamaLoading, onOllamaHandoff }) {
  const lookup = studentsMap || {};
  const team = useTeamOptional();
  const canShare = Boolean(team?.activeTeamId && team?.user?.id);
  const [audience, setAudience] = useState("next_para"), [urgency, setUrgency] = useState("normal"), [stuId, setStuId] = useState("all"), [summary, setSummary] = useState(""), [nextStep, setNextStep] = useState("");
  const [shareWithTeam, setShareWithTeam] = useState(true);
  const save = () => {
    if (!summary.trim()) return;
    const aud = { next_para: "Next Para", teacher: "Teacher", end_of_day: "End of Day", urgent: "URGENT Follow-up" }[audience];
    const note = `HANDOFF [${aud}] ${urgency === "urgent" ? "🔴 URGENT" : ""}${stuId !== "all" && lookup[stuId] ? " — " + resolveLabel(lookup[stuId], "compact") : ""}: ${summary}${nextStep ? " | Action: " + nextStep : ""}`;
    const targetStu = stuId !== "all" ? stuId : students[0];
    const pseudonym = (stuId !== "all" && lookup[stuId]) ? lookup[stuId].pseudonym : null;
    onSave(targetStu, note, "Handoff Note", {
      tags: ["handoff", audience, urgency],
      source: "handoff_builder",
      pseudonym,
      shared: canShare && shareWithTeam,
    });
    if (canShare && shareWithTeam) {
      const dbStu = pseudonym
        ? (team.teamStudents || []).find((s) => s.pseudonym === pseudonym)
        : null;
      const body = `${aud}${nextStep ? ` — Action: ${nextStep}` : ''}: ${summary}`;
      pushHandoff(team.activeTeamId, team.user.id, {
        studentDbId: dbStu?.id || null,
        audience,
        urgency,
        body,
      }).catch((err) => {
        // eslint-disable-next-line no-console
        console.error('[cloud] pushHandoff failed', err);
      });
    }
    setSummary(""); setNextStep("");
  };
  const handleAIDraft = async () => {
    if (!onOllamaHandoff) return;
    const targetStu = stuId !== "all" ? stuId : null;
    const result = await onOllamaHandoff(targetStu, audience, urgency);
    if (result) setSummary(result);
  };
  return (
    <div style={{ padding: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
        <div><label style={lbl}>Audience</label><select value={audience} onChange={e => setAudience(e.target.value)} className="period-select" style={{ width: "100%" }}><option value="next_para">Next Para</option><option value="teacher">Teacher</option><option value="end_of_day">End of Day</option><option value="urgent">Urgent Follow-up</option></select></div>
        <div><label style={lbl}>Urgency</label><select value={urgency} onChange={e => setUrgency(e.target.value)} className="period-select" style={{ width: "100%" }}><option value="normal">Normal</option><option value="important">Important</option><option value="urgent">Urgent</option></select></div>
      </div>
      <div><label style={lbl}>Student (or all)</label><select value={stuId} onChange={e => setStuId(e.target.value)} className="period-select" style={{ width: "100%" }}><option value="all">All students this period</option>{students.filter(id => lookup[id]).map(id => <option key={id} value={id}>{resolveLabel(lookup[id], "compact")}</option>)}</select></div>
      <div><label style={lbl}>Summary*</label><textarea value={summary} onChange={e => setSummary(e.target.value)} className="data-textarea" style={{ height: "70px" }} placeholder="What happened, what to know..." /></div>
      <div><label style={lbl}>Action Needed</label><input value={nextStep} onChange={e => setNextStep(e.target.value)} className="chat-input" placeholder="e.g. Check in with student at start of next period" /></div>
      {urgency === "urgent" && <div style={{ fontSize: "11px", color: "#f87171", background: "#7f1d1d30", padding: "6px 10px", borderRadius: "6px" }}>🔴 This will be flagged as urgent in the Data Vault.</div>}
      {canShare && (
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#93c5fd", cursor: "pointer" }}>
          <input type="checkbox" checked={shareWithTeam} onChange={e => setShareWithTeam(e.target.checked)} />
          Share with team (realtime handoff to other paras)
        </label>
      )}
      <div style={{ display: "flex", gap: "6px" }}>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={save}>Save Handoff Note</button>
        {ollamaOnline && (
          <button className="btn btn-secondary" onClick={handleAIDraft} disabled={ollamaLoading}
            title="Local AI drafts the handoff based on today's logs"
            style={{ background: "#1e1b4b", color: "#a78bfa", border: "1px solid #4c1d95", fontSize: "12px", whiteSpace: "nowrap" }}>
            {ollamaLoading ? "✦ Drafting..." : "✦ AI Draft"}
          </button>
        )}
      </div>
    </div>
  );
}
