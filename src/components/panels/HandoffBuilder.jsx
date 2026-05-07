// ── Handoff Note Builder ─────────────────────────────────────
import React, { useState, useRef } from "react";
import { resolveLabel } from '../../privacy/nameResolver';
import { useTeamOptional } from '../../context/TeamProvider';
import { pushHandoff } from '../../services/teamSync';
import { useAutoGrammarFix, useGrammarFixSetting } from '../../hooks/useAutoGrammarFix';
import { useDraft } from '../../hooks/useDraft';
import { usePrivacyMode } from '../../hooks/usePrivacyMode';

const lbl = { fontSize: "11px", color: "#94a3b8", display: "block", marginBottom: "3px" };

export function HandoffBuilder({ students, onSave, studentsMap, ollamaOnline, ollamaLoading, onOllamaHandoff }) {
  const lookup = studentsMap || {};
  const { on: privacyOn } = usePrivacyMode();
  const team = useTeamOptional();
  const canShare = Boolean(team?.activeTeamId && team?.user?.id);
  const [audience, setAudience] = useState("next_para"), [urgency, setUrgency] = useState("normal"), [stuId, setStuId] = useState("all"), [summary, setSummary] = useState(""), [nextStep, setNextStep] = useState("");
  const [shareWithTeam, setShareWithTeam] = useState(true);
  const summaryRef = useRef(null);
  const nextStepRef = useRef(null);
  const [autoFix] = useGrammarFixSetting();
  useAutoGrammarFix({ value: summary,  setValue: setSummary,  ref: summaryRef,  enabled: autoFix });
  useAutoGrammarFix({ value: nextStep, setValue: setNextStep, ref: nextStepRef, enabled: autoFix });
  // Draft persistence — keyed per (audience × student) so a half-typed
  // handoff for next_para about stu_001 doesn't clobber another in-flight
  // one for parent about all kids.
  const draftKey = `handoff:${audience}:${stuId}`;
  const summaryStore  = useDraft(`${draftKey}:summary`,  summary,  setSummary);
  const nextStepStore = useDraft(`${draftKey}:nextStep`, nextStep, setNextStep);
  const save = () => {
    if (!summary.trim()) return;
    const aud = { next_para: "Next Para", teacher: "Teacher", end_of_day: "End of Day", urgent: "URGENT Follow-up" }[audience];
    const note = `HANDOFF [${aud}] ${urgency === "urgent" ? "🔴 URGENT" : ""}${stuId !== "all" && lookup[stuId] ? " — " + resolveLabel(lookup[stuId], "compact") : ""}: ${summary}${nextStep ? " | Action: " + nextStep : ""}`;
    const targetStu = stuId !== "all" ? stuId : students[0];
    const targetStuRecord = (stuId !== "all" && lookup[stuId]) ? lookup[stuId] : null;
    const pseudonym = targetStuRecord?.pseudonym || null;
    const paraAppNumber = targetStuRecord?.paraAppNumber || null;
    onSave(targetStu, note, "Handoff Note", {
      tags: ["handoff", audience, urgency],
      source: "handoff_builder",
      pseudonym,
      paraAppNumber,
      shared: canShare && shareWithTeam,
    });
    if (canShare && shareWithTeam) {
      // Resolve the cloud team_students row by paraAppNumber first — pseudonyms
      // can drift across devices, paraAppNumber doesn't.
      const teamStudents = team.teamStudents || [];
      let dbStu = null;
      if (paraAppNumber) {
        const key = String(paraAppNumber).trim();
        dbStu = teamStudents.find(
          (s) => s.paraAppNumber != null && String(s.paraAppNumber).trim() === key
        ) || null;
      }
      if (!dbStu && pseudonym) {
        dbStu = teamStudents.find((s) => s.pseudonym === pseudonym) || null;
      }
      const body = `${aud}${nextStep ? ` — Action: ${nextStep}` : ''}: ${summary}`;
      pushHandoff(team.activeTeamId, team.user.id, {
        studentDbId: dbStu?.id || null,
        paraAppNumber,
        audience,
        urgency,
        body,
      }).catch((err) => {
        team.reportCloudError?.(`Handoff saved locally but did not sync: ${err.message || err}`);
        // eslint-disable-next-line no-console
        console.error('[cloud] pushHandoff failed', err);
      });
    }
    summaryStore.clear();
    nextStepStore.clear();
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
      <div><label style={lbl}>Student (or all)</label><select value={stuId} onChange={e => setStuId(e.target.value)} className="period-select" style={{ width: "100%" }}><option value="all">All students this period</option>{students.filter(id => lookup[id]).map(id => {
        const s = lookup[id];
        const label = privacyOn ? (s.pseudonym || resolveLabel(s, 'compact')) : resolveLabel(s, 'compact');
        return <option key={id} value={id}>{label}</option>;
      })}</select></div>
      <div><label style={lbl}>Summary*</label><textarea ref={summaryRef} spellCheck="true" lang="en" value={summary} onChange={e => setSummary(e.target.value)} className="data-textarea" style={{ height: "70px" }} placeholder="What happened, what to know..." /></div>
      <div><label style={lbl}>Action Needed</label><input ref={nextStepRef} spellCheck="true" lang="en" value={nextStep} onChange={e => setNextStep(e.target.value)} className="chat-input" placeholder="e.g. Check in with student at start of next period" /></div>
      {urgency === "urgent" && <div style={{ fontSize: "11px", color: "#f87171", background: "#7f1d1d30", padding: "6px 10px", borderRadius: "6px" }}>🔴 This will show up as urgent in your records.</div>}
      {canShare && (
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#93c5fd", cursor: "pointer" }}>
          <input type="checkbox" checked={shareWithTeam} onChange={e => setShareWithTeam(e.target.checked)} />
          Share with team (other paras see this right away)
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
