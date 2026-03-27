// ══════════════════════════════════════════════════════════════
// ANALYTICS DASHBOARD — Visual data tracking with date ranges and groups
// ══════════════════════════════════════════════════════════════
import React, { useState } from "react";
import { DB } from '../data';
import { resolveLabel } from '../privacy/nameResolver';

export function AnalyticsDashboard({ logs, groups, setGroups, onOpenProfile, ollamaOnline, ollamaLoading, onOllamaPatternSummary }) {
  const [range, setRange] = useState("week"), [customStart, setCustomStart] = useState(""), [customEnd, setCustomEnd] = useState("");
  const [focusStudent, setFocusStudent] = useState(null), [focusGroup, setFocusGroup] = useState(null);
  const [newGroupName, setNewGroupName] = useState(""), [newGroupStudents, setNewGroupStudents] = useState([]);
  const [showGroupForm, setShowGroupForm] = useState(false), [tab, setTab] = useState("overview");

  const today = new Date();
  const getStartDate = () => {
    if (range === "custom" && customStart) return new Date(customStart + "T00:00:00");
    const d = new Date(today);
    if (range === "day") d.setDate(d.getDate());
    else if (range === "week") d.setDate(d.getDate() - 7);
    else if (range === "2weeks") d.setDate(d.getDate() - 14);
    else if (range === "month") d.setMonth(d.getMonth() - 1);
    else if (range === "quarter") d.setMonth(d.getMonth() - 3);
    else if (range === "year") d.setFullYear(d.getFullYear() - 1);
    return d;
  };
  const startDate = getStartDate();
  const endDate = range === "custom" && customEnd ? new Date(customEnd + "T23:59:59") : today;

  const filteredLogs = logs.filter(l => { const d = new Date(l.date + "T12:00:00"); return d >= startDate && d <= endDate; });
  const logsFor = (ids) => filteredLogs.filter(l => ids.includes(l.studentId));
  const typeCounts = (logSet) => { const c = {}; logSet.forEach(l => { c[l.type] = (c[l.type] || 0) + 1; }); return c; };

  const dailyCounts = (logSet) => {
    const days = {};
    const diffDays = Math.max(1, Math.ceil((endDate - startDate) / 86400000));
    for (let i = 0; i <= diffDays; i++) { const d = new Date(startDate); d.setDate(d.getDate() + i); days[d.toISOString().split("T")[0]] = 0; }
    logSet.forEach(l => { if (days[l.date] !== undefined) days[l.date]++; });
    return Object.entries(days).map(([d, c]) => ({ date: d, count: c }));
  };

  const BarChart = ({ data, width = 320, height = 120, color = "#4d9fff" }) => {
    if (!data.length) return <div style={{ color: "#334155", fontSize: "12px", padding: "20px", textAlign: "center" }}>No data in range</div>;
    const max = Math.max(...data.map(d => d.count), 1);
    const barW = Math.max(2, Math.min(12, (width - 20) / data.length - 1));
    const gap = Math.max(1, (width - 20 - barW * data.length) / (data.length - 1 || 1));
    return (
      <svg width={width} height={height} style={{ display: "block" }}>
        <line x1="10" y1={height - 20} x2={width - 10} y2={height - 20} stroke="#1e293b" strokeWidth="1" />
        {data.map((d, i) => { const bh = max > 0 ? (d.count / max) * (height - 30) : 0; const x = 10 + i * (barW + gap); return <rect key={i} x={x} y={height - 20 - bh} width={barW} height={bh} fill={d.count > 0 ? color : "#1e293b"} rx="1"><title>{d.date}: {d.count} logs</title></rect>; })}
        <text x="10" y={height - 4} fill="#4a6284" fontSize="9">{data[0]?.date?.slice(5)}</text>
        <text x={width - 50} y={height - 4} fill="#4a6284" fontSize="9" textAnchor="end">{data[data.length - 1]?.date?.slice(5)}</text>
      </svg>
    );
  };

  const typeColors = { "Positive Note": "#4ade80", "Behavior Note": "#f87171", "Academic Support": "#60a5fa", "Accommodation Used": "#a78bfa", "Goal Progress": "#fbbf24", "Handoff Note": "#fb923c", "General Observation": "#94a3b8", "Class Note": "#2dd4bf" };

  const TypeBars = ({ counts }) => {
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const max = Math.max(...entries.map(e => e[1]), 1);
    if (!entries.length) return <div style={{ color: "#334155", fontSize: "12px" }}>No logs</div>;
    return entries.map(([type, count]) => (
      <div key={type} style={{ marginBottom: "6px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginBottom: "2px" }}><span style={{ color: "#8fa3c4" }}>{type}</span><span style={{ color: typeColors[type] || "#94a3b8", fontWeight: "600" }}>{count}</span></div>
        <div style={{ background: "#0f172a", borderRadius: "3px", height: "6px", overflow: "hidden" }}><div style={{ width: `${(count / max) * 100}%`, height: "100%", background: typeColors[type] || "#4a6284", borderRadius: "3px", transition: "width 0.3s" }} /></div>
      </div>
    ));
  };

  const StudentAnalytics = ({ id }) => {
    const s = DB.students[id], sl = logsFor([id]), tc = typeCounts(sl), dc = dailyCounts(sl);
    return (
      <div className="panel" style={{ padding: "14px", borderLeft: `3px solid ${s.color}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
          <div>
            <div style={{ fontWeight: "700", fontSize: "14px", color: s.color, cursor: "pointer" }} onClick={() => onOpenProfile(id)}>{resolveLabel(s, "compact")}</div>
            <div style={{ fontSize: "11px", color: "#4a6284" }}>{s.eligibility} · {sl.length} logs in range</div>
          </div>
          <div style={{ display: "flex", gap: "4px" }}>
            {ollamaOnline && onOllamaPatternSummary && (
              <button onClick={() => onOllamaPatternSummary(id)} disabled={ollamaLoading}
                title="Local AI summarizes patterns from this student's logs"
                style={{ fontSize: "10px", padding: "3px 8px", borderRadius: "6px", border: "1px solid #4c1d95", background: "#1e1b4b", color: "#a78bfa", cursor: "pointer", whiteSpace: "nowrap" }}>
                {ollamaLoading ? "✦..." : "✦ Patterns"}
              </button>
            )}
            <button onClick={() => setFocusStudent(focusStudent === id ? null : id)} style={{ fontSize: "10px", padding: "3px 10px", borderRadius: "6px", border: "1px solid #1e293b", background: focusStudent === id ? "#1d4ed8" : "#0f172a", color: focusStudent === id ? "#fff" : "#8fa3c4", cursor: "pointer" }}>{focusStudent === id ? "Collapse" : "Expand"}</button>
          </div>
        </div>
        <BarChart data={dc} color={s.color} width={280} height={60} />
        {focusStudent === id && <div style={{ marginTop: "10px", paddingTop: "10px", borderTop: "1px solid #1e293b" }}><TypeBars counts={tc} /></div>}
      </div>
    );
  };

  const GroupAnalytics = ({ group }) => {
    const gl = logsFor(group.students), tc = typeCounts(gl), dc = dailyCounts(gl);
    return (
      <div className="panel" style={{ padding: "14px", borderLeft: "3px solid #a78bfa" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
          <div>
            <div style={{ fontWeight: "700", fontSize: "14px", color: "#a78bfa" }}>{group.name}</div>
            <div style={{ fontSize: "11px", color: "#4a6284" }}>{group.students.length} students · {gl.length} logs</div>
            <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginTop: "4px" }}>{group.students.map(id => <span key={id} style={{ fontSize: "10px", color: DB.students[id]?.color, background: DB.students[id]?.color + "15", padding: "1px 7px", borderRadius: "20px" }}>{resolveLabel(DB.students[id], "compact")}</span>)}</div>
          </div>
          <div style={{ display: "flex", gap: "4px" }}>
            <button onClick={() => setFocusGroup(focusGroup === group.id ? null : group.id)} style={{ fontSize: "10px", padding: "3px 10px", borderRadius: "6px", border: "1px solid #1e293b", background: focusGroup === group.id ? "#1d4ed8" : "#0f172a", color: focusGroup === group.id ? "#fff" : "#8fa3c4", cursor: "pointer" }}>{focusGroup === group.id ? "Collapse" : "Expand"}</button>
            <button onClick={() => setGroups(prev => prev.filter(g => g.id !== group.id))} style={{ fontSize: "10px", padding: "3px 8px", borderRadius: "6px", border: "1px solid #7f1d1d", background: "transparent", color: "#f87171", cursor: "pointer" }}>×</button>
          </div>
        </div>
        <BarChart data={dc} color="#a78bfa" width={280} height={60} />
        {focusGroup === group.id && <div style={{ marginTop: "10px", paddingTop: "10px", borderTop: "1px solid #1e293b" }}><TypeBars counts={tc} /></div>}
      </div>
    );
  };

  const addGroup = () => {
    if (!newGroupName.trim() || !newGroupStudents.length) return;
    setGroups(prev => [...prev, { id: Date.now(), name: newGroupName, students: [...newGroupStudents] }]);
    setNewGroupName(""); setNewGroupStudents([]); setShowGroupForm(false);
  };
  const toggleGroupStu = (id) => setNewGroupStudents(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);

  const allTC = typeCounts(filteredLogs), allDC = dailyCounts(filteredLogs);
  const rangeTabs = [{ id: "day", label: "Today" }, { id: "week", label: "7 Days" }, { id: "2weeks", label: "14 Days" }, { id: "month", label: "Month" }, { id: "quarter", label: "Quarter" }, { id: "year", label: "Year" }, { id: "custom", label: "Custom" }];

  return (
    <div>
      <div className="header"><div><h1>Analytics</h1><p className="teacher-subtitle">{filteredLogs.length} logs in range · {Object.keys(DB.students).length} students tracked</p></div></div>
      <div style={{ display: "flex", gap: "4px", marginBottom: "16px", flexWrap: "wrap", alignItems: "center" }}>
        {rangeTabs.map(r => (<button key={r.id} onClick={() => setRange(r.id)} style={{ padding: "6px 14px", borderRadius: "6px", border: "none", cursor: "pointer", fontSize: "12px", fontWeight: "500", background: range === r.id ? "#1d4ed8" : "var(--panel-bg)", color: range === r.id ? "#fff" : "var(--text-muted)" }}>{r.label}</button>))}
        {range === "custom" && (<div style={{ display: "flex", gap: "6px", alignItems: "center", marginLeft: "8px" }}><input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="period-select" style={{ fontSize: "12px" }} /><span style={{ color: "#4a6284", fontSize: "12px" }}>to</span><input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="period-select" style={{ fontSize: "12px" }} /></div>)}
      </div>
      <div style={{ display: "flex", gap: "4px", marginBottom: "16px" }}>
        {[{ id: "overview", label: "Overview" }, { id: "students", label: "By Student" }, { id: "groups", label: "Groups" }].map(t => (<button key={t.id} onClick={() => setTab(t.id)} style={{ padding: "6px 14px", borderRadius: "6px", border: "none", cursor: "pointer", fontSize: "12px", fontWeight: "600", background: tab === t.id ? "#0f172a" : "transparent", color: tab === t.id ? "#e2e8f0" : "#4a6284" }}>{t.label}</button>))}
      </div>

      {tab === "overview" && (<div>
        <div className="panel" style={{ padding: "16px", marginBottom: "16px" }}><div style={{ fontSize: "13px", fontWeight: "600", color: "#e2e8f0", marginBottom: "10px" }}>Activity Over Time</div><BarChart data={allDC} width={600} height={100} /></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
          <div className="panel" style={{ padding: "16px" }}><div style={{ fontSize: "13px", fontWeight: "600", color: "#e2e8f0", marginBottom: "10px" }}>Log Types</div><TypeBars counts={allTC} /></div>
          <div className="panel" style={{ padding: "16px" }}><div style={{ fontSize: "13px", fontWeight: "600", color: "#e2e8f0", marginBottom: "10px" }}>Per Student</div>
            {Object.keys(DB.students).map(id => { const sl = logsFor([id]); return sl.length > 0 ? (<div key={id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", borderBottom: "1px solid #0f172a" }}><span style={{ fontSize: "12px", color: DB.students[id].color, cursor: "pointer" }} onClick={() => onOpenProfile(id)}>{resolveLabel(DB.students[id], "compact")}</span><span style={{ fontSize: "12px", fontWeight: "600", color: "#8fa3c4" }}>{sl.length}</span></div>) : null; })}
          </div>
        </div>
      </div>)}

      {tab === "students" && (<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>{Object.keys(DB.students).map(id => <StudentAnalytics key={id} id={id} />)}</div>)}

      {tab === "groups" && (<div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "16px" }}>
          <button onClick={() => setShowGroupForm(!showGroupForm)} className="btn btn-primary" style={{ fontSize: "12px" }}>+ Create Group</button>
          <span style={{ fontSize: "12px", color: "#4a6284" }}>{groups.length} group{groups.length !== 1 ? "s" : ""}</span>
        </div>
        {showGroupForm && (<div className="panel" style={{ padding: "16px", marginBottom: "16px" }}>
          <div style={{ fontSize: "13px", fontWeight: "600", color: "#e2e8f0", marginBottom: "8px" }}>New Group</div>
          <input value={newGroupName} onChange={e => setNewGroupName(e.target.value)} className="chat-input" placeholder="Group name (e.g. 'Period 3 Focus', 'BIP Students')" style={{ marginBottom: "10px" }} />
          <div style={{ fontSize: "11px", color: "#4a6284", marginBottom: "6px" }}>Select students:</div>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "10px" }}>
            {Object.entries(DB.students).map(([id, s]) => (<button key={id} onClick={() => toggleGroupStu(id)} style={{ fontSize: "11px", padding: "4px 10px", borderRadius: "6px", border: `1px solid ${newGroupStudents.includes(id) ? s.color : s.color + "40"}`, cursor: "pointer", background: newGroupStudents.includes(id) ? s.color + "25" : "transparent", color: s.color, fontWeight: newGroupStudents.includes(id) ? "600" : "400" }}>{resolveLabel(s, "compact")}</button>))}
          </div>
          <div style={{ display: "flex", gap: "8px" }}><button onClick={addGroup} className="btn btn-primary" style={{ fontSize: "12px" }}>Save Group</button><button onClick={() => setShowGroupForm(false)} className="btn btn-secondary" style={{ fontSize: "12px" }}>Cancel</button></div>
        </div>)}
        {groups.length === 0 && !showGroupForm && <div className="empty-doc">No groups yet. Create one to track students together.</div>}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>{groups.map(g => <GroupAnalytics key={g.id} group={g} />)}</div>
      </div>)}
    </div>
  );
}
