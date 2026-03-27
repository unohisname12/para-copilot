// ══════════════════════════════════════════════════════════════
// TOOLBOX PANELS — Sidebar panel components
// ══════════════════════════════════════════════════════════════
import React, { useState } from "react";
import { DB, SUPPORT_CARDS, QUICK_ACTIONS, SITUATIONS, STRATEGIES, CHECKLIST_TEMPLATES, GOAL_PROGRESS_OPTIONS } from '../data';
import { resolveLabel } from '../privacy/nameResolver';

const lbl = { fontSize: "11px", color: "#94a3b8", display: "block", marginBottom: "3px" };

// ── Shared section renderer ──────────────────────────────────
function Section({ title, items, color }) {
  return (<div style={{ marginBottom: "10px" }}><div style={{ fontSize: "12px", fontWeight: "600", color, marginBottom: "4px" }}>{title}</div>{items.map((item, i) => (<div key={i} style={{ fontSize: "12px", color: "#cbd5e1", padding: "3px 0 3px 12px", borderLeft: `2px solid ${color}30`, marginBottom: "2px", lineHeight: "1.5" }}>{item}</div>))}</div>);
}

// ── Support Card Panel ───────────────────────────────────────
export function SupportCardPanel({ cards }) {
  const [selected, setSelected] = useState(cards?.[0] || SUPPORT_CARDS[0]);
  const list = cards && cards.length > 0 ? cards : SUPPORT_CARDS;
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ display: "flex", gap: "4px", padding: "8px", overflowX: "auto", flexShrink: 0, borderBottom: "1px solid var(--border)" }}>
        {list.map(c => (<button key={c.id} onClick={() => setSelected(c)} style={{ padding: "4px 10px", borderRadius: "6px", border: "none", cursor: "pointer", fontSize: "11px", fontWeight: "500", whiteSpace: "nowrap", background: selected.id === c.id ? "#1d4ed8" : "#1e293b", color: selected.id === c.id ? "#fff" : "#94a3b8" }}>{c.title}</button>))}
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "12px" }}>
        <div style={{ fontSize: "16px", fontWeight: "700", color: "#f8fafc", marginBottom: "6px" }}>{selected.title}</div>
        <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "12px" }}>{selected.whenToUse}</div>
        <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginBottom: "12px" }}>
          {selected.studentTypes.map(t => (<span key={t} style={{ fontSize: "10px", background: "#1e3a5f", color: "#93c5fd", padding: "2px 8px", borderRadius: "20px" }}>{t}</span>))}
        </div>
        <Section title="✅ Steps" items={selected.steps} color="#4ade80" />
        <Section title="💬 What to Say" items={selected.whatToSay} color="#60a5fa" />
        <Section title="🚫 What to Avoid" items={selected.whatToAvoid} color="#f87171" />
        <div style={{ marginTop: "10px" }}><div style={{ fontSize: "11px", color: "#64748b", marginBottom: "4px" }}>Related Accommodations</div>
          <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>{selected.accommodations.map(a => (<span key={a} style={{ fontSize: "10px", background: "#14532d", color: "#4ade80", padding: "2px 8px", borderRadius: "20px" }}>{a}</span>))}</div>
        </div>
      </div>
    </div>
  );
}

// ── Quick Action Panel ───────────────────────────────────────
export function QuickActionPanel({ students, onLog, studentsMap }) {
  const lookup = studentsMap || DB.students;
  return (
    <div style={{ padding: "10px", display: "flex", flexDirection: "column", gap: "4px" }}>
      <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "4px" }}>One-tap logging — pick an action, then the student:</div>
      {QUICK_ACTIONS.map(qa => (
        <div key={qa.id} style={{ marginBottom: "6px" }}>
          <div style={{ fontSize: "12px", fontWeight: "600", color: "#e2e8f0", marginBottom: "3px" }}>{qa.icon} {qa.label}</div>
          <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
            {students.filter(id => lookup[id]).map(id => (
              <button key={id} onClick={() => onLog(id, qa.defaultNote, qa.logType, { source: "quick_action", tags: qa.tags })}
                style={{ fontSize: "11px", padding: "3px 10px", borderRadius: "6px", border: `1px solid ${lookup[id].color}40`, cursor: "pointer", background: lookup[id].color + "15", color: lookup[id].color }}>
                {resolveLabel(lookup[id], "compact")}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── ABC Behavior Builder ─────────────────────────────────────
export function ABCBuilder({ students, onSave, periodLabel, currentDate, studentsMap }) {
  const lookup = studentsMap || DB.students;
  const [stu, setStu] = useState(students[0] || ""), [ant, setAnt] = useState(""), [beh, setBeh] = useState(""), [con, setCon] = useState(""), [intensity, setIntensity] = useState("low"), [duration, setDuration] = useState(""), [staffResp, setStaffResp] = useState(""), [followUp, setFollowUp] = useState("");
  const save = () => {
    if (!beh.trim()) return;
    const note = `ABC | A: ${ant || "N/A"} | B: ${beh} | C: ${con || "N/A"} | Intensity: ${intensity} | Duration: ${duration || "N/A"} | Staff: ${staffResp || "N/A"} | Follow-up: ${followUp || "N/A"}`;
    onSave(stu, note, "Behavior Note", { tags: ["abc", "behavior", intensity], source: "abc_builder" });
    setAnt(""); setBeh(""); setCon(""); setDuration(""); setStaffResp(""); setFollowUp("");
  };
  return (
    <div style={{ padding: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
      <div><label style={lbl}>Student</label><select value={stu} onChange={e => setStu(e.target.value)} className="period-select" style={{ width: "100%" }}>{students.filter(id => lookup[id]).map(id => <option key={id} value={id}>{resolveLabel(lookup[id], "compact")}</option>)}</select></div>
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

// ── Goal Progress Tracker ────────────────────────────────────
export function GoalTracker({ students, onSave, studentsMap }) {
  const lookup = studentsMap || DB.students;
  const allGoals = students.filter(id => lookup[id]).flatMap(id => (lookup[id].goals || []).map(g => ({ ...g, studentId: id, pseudonym: resolveLabel(lookup[id], "compact"), color: lookup[id].color })));
  const [note, setNote] = useState("");
  const logGoal = (goal, opt) => {
    const entry = `Goal Progress: "${goal.text.slice(0, 60)}..." — ${opt.label}${note ? " | Note: " + note : ""}`;
    onSave(goal.studentId, entry, "Goal Progress", { goalId: goal.id, tags: ["goal", opt.id], source: "goal_tracker" });
    setNote("");
  };
  if (allGoals.length === 0) return <div style={{ padding: "16px", color: "#64748b", textAlign: "center" }}>No students this period.</div>;
  return (
    <div style={{ padding: "10px", display: "flex", flexDirection: "column", gap: "10px" }}>
      {allGoals.map(g => (
        <div key={g.id} style={{ background: "#0f172a", borderRadius: "8px", padding: "10px 12px", borderLeft: `3px solid ${g.color}` }}>
          <div style={{ fontSize: "11px", color: g.color, fontWeight: "600", marginBottom: "3px" }}>{g.pseudonym}</div>
          <div style={{ fontSize: "12px", color: "#cbd5e1", marginBottom: "6px", lineHeight: "1.4" }}>{g.text.length > 80 ? g.text.slice(0, 80) + "..." : g.text}</div>
          <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
            {GOAL_PROGRESS_OPTIONS.map(opt => (
              <button key={opt.id} onClick={() => logGoal(g, opt)} title={opt.label}
                style={{ fontSize: "10px", padding: "3px 8px", borderRadius: "6px", border: "none", cursor: "pointer", background: opt.color + "20", color: opt.color }}>
                {opt.icon} {opt.label}
              </button>
            ))}
          </div>
        </div>
      ))}
      <div><input value={note} onChange={e => setNote(e.target.value)} className="chat-input" placeholder="Optional note for next goal tap..." style={{ fontSize: "11px" }} /></div>
    </div>
  );
}

// ── Handoff Note Builder ─────────────────────────────────────
export function HandoffBuilder({ students, onSave, studentsMap, ollamaOnline, ollamaLoading, onOllamaHandoff }) {
  const lookup = studentsMap || DB.students;
  const [audience, setAudience] = useState("next_para"), [urgency, setUrgency] = useState("normal"), [stuId, setStuId] = useState("all"), [summary, setSummary] = useState(""), [nextStep, setNextStep] = useState("");
  const save = () => {
    if (!summary.trim()) return;
    const aud = { next_para: "Next Para", teacher: "Teacher", end_of_day: "End of Day", urgent: "URGENT Follow-up" }[audience];
    const note = `HANDOFF [${aud}] ${urgency === "urgent" ? "🔴 URGENT" : ""}${stuId !== "all" && lookup[stuId] ? " — " + resolveLabel(lookup[stuId], "compact") : ""}: ${summary}${nextStep ? " | Action: " + nextStep : ""}`;
    const targetStu = stuId !== "all" ? stuId : students[0];
    onSave(targetStu, note, "Handoff Note", { tags: ["handoff", audience, urgency], source: "handoff_builder" });
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

// ── Para Checklist ────────────────────────────────────────────
export function ParaChecklist() {
  const [phase, setPhase] = useState("before");
  const [checks, setChecks] = useState({ before: {}, during: {}, after: {} });
  const toggle = (ph, idx) => setChecks(prev => ({ ...prev, [ph]: { ...prev[ph], [idx]: !prev[ph][idx] } }));
  const items = CHECKLIST_TEMPLATES[phase];
  const completed = Object.values(checks[phase]).filter(Boolean).length;
  return (
    <div style={{ padding: "12px" }}>
      <div style={{ display: "flex", gap: "4px", marginBottom: "12px" }}>{["before", "during", "after"].map(p => (
        <button key={p} onClick={() => setPhase(p)} style={{ flex: 1, padding: "6px", borderRadius: "6px", border: "none", cursor: "pointer", fontSize: "11px", fontWeight: "600", textTransform: "capitalize", background: phase === p ? "#1d4ed8" : "#1e293b", color: phase === p ? "#fff" : "#64748b" }}>{p} Class</button>
      ))}</div>
      <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "8px" }}>{completed}/{items.length} complete</div>
      <div style={{ background: "#0f172a", borderRadius: "6px", height: "4px", marginBottom: "12px", overflow: "hidden" }}><div style={{ height: "100%", background: completed === items.length ? "#4ade80" : "#3b82f6", width: `${(completed / items.length) * 100}%`, transition: "width 0.3s" }} /></div>
      {items.map((item, i) => (
        <div key={i} onClick={() => toggle(phase, i)} style={{ display: "flex", gap: "10px", alignItems: "flex-start", padding: "8px 6px", cursor: "pointer", borderRadius: "6px", background: checks[phase][i] ? "#14532d20" : "transparent", marginBottom: "2px" }}>
          <div style={{ width: "18px", height: "18px", borderRadius: "4px", border: `2px solid ${checks[phase][i] ? "#4ade80" : "#334155"}`, background: checks[phase][i] ? "#4ade80" : "transparent", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", marginTop: "1px" }}>
            {checks[phase][i] && <span style={{ color: "#000", fontSize: "12px", fontWeight: "700" }}>✓</span>}
          </div>
          <div>
            <div style={{ fontSize: "12px", color: checks[phase][i] ? "#4ade80" : "#e2e8f0", textDecoration: checks[phase][i] ? "line-through" : "none" }}>{item.label}</div>
            {item.priority === "high" && !checks[phase][i] && <span style={{ fontSize: "9px", color: "#f87171", marginTop: "2px", display: "inline-block" }}>HIGH PRIORITY</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Strategy Library ─────────────────────────────────────────
export function StrategyLibrary() {
  const [search, setSearch] = useState(""), [selected, setSelected] = useState(null);
  const filtered = STRATEGIES.filter(s => !search || s.title.toLowerCase().includes(search.toLowerCase()) || s.tags.some(t => t.includes(search.toLowerCase())));
  if (selected) return (
    <div style={{ padding: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
      <button onClick={() => setSelected(null)} style={{ alignSelf: "flex-start", fontSize: "11px", color: "#60a5fa", background: "none", border: "none", cursor: "pointer" }}>← Back to Library</button>
      <div style={{ fontSize: "16px", fontWeight: "700", color: "#f8fafc" }}>{selected.title}</div>
      <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>{selected.tags.map(t => (<span key={t} style={{ fontSize: "10px", background: "#1e3a5f", color: "#93c5fd", padding: "2px 8px", borderRadius: "20px" }}>{t}</span>))}</div>
      <Section title="Steps" items={selected.steps} color="#4ade80" />
      <div style={{ fontSize: "12px", color: "#60a5fa", marginBottom: "4px" }}>✅ When to Use</div><div style={{ fontSize: "12px", color: "#cbd5e1", marginBottom: "8px", paddingLeft: "12px" }}>{selected.whenToUse}</div>
      <div style={{ fontSize: "12px", color: "#f87171", marginBottom: "4px" }}>🚫 Avoid When</div><div style={{ fontSize: "12px", color: "#cbd5e1", marginBottom: "8px", paddingLeft: "12px" }}>{selected.avoidWhen}</div>
      {selected.accommodations.length > 0 && <div><div style={{ fontSize: "11px", color: "#64748b", marginBottom: "4px" }}>Related Accommodations</div><div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>{selected.accommodations.map(a => (<span key={a} style={{ fontSize: "10px", background: "#14532d", color: "#4ade80", padding: "2px 8px", borderRadius: "20px" }}>{a}</span>))}</div></div>}
    </div>
  );
  return (
    <div style={{ padding: "10px" }}>
      <input value={search} onChange={e => setSearch(e.target.value)} className="chat-input" placeholder="Search strategies..." style={{ marginBottom: "10px", fontSize: "12px" }} />
      {filtered.map(s => (
        <div key={s.id} onClick={() => setSelected(s)} style={{ padding: "10px", background: "#0f172a", borderRadius: "8px", marginBottom: "6px", cursor: "pointer", borderLeft: `3px solid ${s.category === "academic" ? "#3b82f6" : s.category === "behavior" ? "#f87171" : s.category === "transition" ? "#fbbf24" : "#4ade80"}` }}>
          <div style={{ fontSize: "13px", fontWeight: "600", color: "#e2e8f0" }}>{s.title}</div>
          <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>{s.category} · {s.subjects.join(", ")}</div>
        </div>
      ))}
    </div>
  );
}

// ── Situation Picker ─────────────────────────────────────────
export function SituationPicker({ onSelect }) {
  return (
    <div style={{ padding: "10px", display: "flex", flexDirection: "column", gap: "6px" }}>
      <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "4px" }}>Tap a situation for instant recommendations:</div>
      {SITUATIONS.map(s => (
        <button key={s.id} onClick={() => onSelect(s)} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px", background: "#0f172a", border: "1px solid #1e293b", borderRadius: "8px", cursor: "pointer", textAlign: "left" }}>
          <span style={{ fontSize: "20px" }}>{s.icon}</span>
          <div><div style={{ fontSize: "13px", fontWeight: "600", color: "#e2e8f0" }}>{s.title}</div>
            <div style={{ fontSize: "11px", color: "#64748b" }}>{s.tags.join(" · ")}</div></div>
        </button>
      ))}
    </div>
  );
}
