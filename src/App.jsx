// ══════════════════════════════════════════════════════════════
// APP.JSX — Orchestrator
// Imports everything, manages state, wires it together.
// ══════════════════════════════════════════════════════════════
import React, { useState } from "react";
import "./styles/styles.css";

// Data layer
import { DB, QUICK_ACTIONS } from './data';

// Engine + Model layer
import { parseDocForPeriod } from './engine';
import { getHealth, hdot } from './models';
import { resolveLabel } from './privacy/nameResolver';

// Providers
import { OllamaProvider, useOllamaContext } from './app/providers/OllamaProvider';
import { StudentsProvider, useStudentsContext } from './app/providers/StudentsProvider';
import { LogsProvider, useLogsContext } from './app/providers/LogsProvider';

// Hooks
import { useChat } from './hooks/useChat';
import { useDocuments } from './hooks/useDocuments';
import { useKnowledgeBase } from './hooks/useKnowledgeBase';
import { useOllamaInsights } from './hooks/useOllamaInsights';
import { useCaseMemory } from './hooks/useCaseMemory';

// Utilities
import { exportCSV, exportCSVPrivate } from './utils/exportCSV';

// Components
import { VisualTimer, CalculatorTool, MultChart, CEROrganizer, BreathingExercise, GroundingExercise } from './components/tools';
import { SupportCardPanel, QuickActionPanel, ABCBuilder, GoalTracker, HandoffBuilder, ParaChecklist, StrategyLibrary, SituationPicker } from './components/panels';
import { StudentProfileModal, EmailModal, SituationResponseModal, OllamaInsightModal } from './components/modals';
import { Tip, FloatingToolWindow, FullscreenTool, StealthScreen, RosterPanel } from './components/windows';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { SimpleMode } from './components/SimpleMode';
import { IEPImport } from './components/IEPImport';
import { OllamaStatusBadge } from './components/OllamaStatusBadge';
import { Dashboard } from './components/Dashboard';
import { BrandHeader } from './components/BrandHeader';
import { getSidebarVisibility } from './utils/sidebarVisibility';

export default function App() {
  const today = new Date(), localISO = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().split("T")[0];
  const [currentDate, setCurrentDate] = useState(localISO);
  const [activePeriod, setActivePeriod] = useState("p3");
  const period = DB.periods[activePeriod];

  return (
    <OllamaProvider>
      <StudentsProvider activePeriod={activePeriod}>
        <LogsProvider currentDate={currentDate} periodLabel={period.label} activePeriod={activePeriod}>
          <AppShell
            currentDate={currentDate} setCurrentDate={setCurrentDate}
            activePeriod={activePeriod} setActivePeriod={setActivePeriod}
            period={period}
          />
        </LogsProvider>
      </StudentsProvider>
    </OllamaProvider>
  );
}

function AppShell({ currentDate, setCurrentDate, activePeriod, setActivePeriod, period }) {
  const [view, setView] = useState("dashboard");
  const [simpleMode, setSimpleMode] = useState(false);

  // ── Context hooks ──────────────────────────────────────────
  const ollama = useOllamaContext();
  const students = useStudentsContext();
  const logsBag = useLogsContext();

  // ── Non-provided hooks ─────────────────────────────────────
  const docs = useDocuments();
  const kb = useKnowledgeBase({ currentDate, activePeriod });
  const chat = useChat({
    activePeriod, period,
    effectivePeriodStudents: students.effectivePeriodStudents,
    allStudents: students.allStudents,
    logs: logsBag.logs, knowledgeBase: kb.knowledgeBase,
    docContent: docs.docContent, currentDate,
    ollamaOnline: ollama.ollamaOnline, setOllamaOnline: ollama.setOllamaOnline,
    ollamaLoading: ollama.ollamaLoading, setOllamaLoading: ollama.setOllamaLoading,
    ollamaErrorHandler: ollama.ollamaErrorHandler,
  });

  // Destructure for convenience
  const { allStudents, effectivePeriodStudents, identityRegistry } = students;
  const { logs, addLog, toggleFlag, deleteLog, updateLogText, loadDemoLogs, clearDemoLogs } = logsBag;
  const { knowledgeBase } = kb;

  // ── UI state ───────────────────────────────────────────────
  const [profileStu, setProfileStu] = useState(null);
  const [activeToolbox, setActiveToolbox] = useState(null);
  const [floatingTools, setFloatingTools] = useState([]);
  const [fullscreenTool, setFullscreenTool] = useState(null);
  const [stealthMode, setStealthMode] = useState(false);
  const [stealthTool, setStealthTool] = useState("timer");
  const [situationModal, setSituationModal] = useState(null);
  const [rosterPanelOpen, setRosterPanelOpen] = useState(false);
  const [groups, setGroups] = useState([]);

  // ── Ollama insights + email (hook) ─────────────────────────
  const insights = useOllamaInsights({
    effectivePeriodStudents, allStudents, logs, activePeriod,
    docContent: docs.docContent, currentDate,
    ollamaOnline: ollama.ollamaOnline, setOllamaOnline: ollama.setOllamaOnline,
    ollamaLoading: ollama.ollamaLoading, setOllamaLoading: ollama.setOllamaLoading,
    ollamaErrorHandler: ollama.ollamaErrorHandler,
    setCurrentChat: chat.setCurrentChat,
  });

  // ── Case Memory ────────────────────────────────────────────
  const caseMemory = useCaseMemory();

  // ── Showcase (demo mode) ──────────────────────────────────
  const handleLoadDemo = ({ incidents, interventions, outcomes, logs: demoLogs }) => {
    caseMemory.loadDemoCaseMemory({ incidents, interventions, outcomes });
    if (demoLogs) loadDemoLogs(demoLogs);
    students.setDemoMode(true);
  };
  const handleClearDemo = () => {
    caseMemory.clearCaseMemory();
    clearDemoLogs();
  };

  // ── Vault state ────────────────────────────────────────────
  const [vaultTab, setVaultTab] = useState("all"), [vaultFilter, setVaultFilter] = useState("all"), [editingLog, setEditingLog] = useState(null);

  // ── saveEdit wires updateLogText + vault UI ────────────────
  const saveEdit = (id, newText) => { updateLogText(id, newText); setEditingLog(null); };

  // ── Doc fetch/push (cross-cuts docs + chat) ────────────────
  const fetchDoc = async () => {
    if (!docs.docLink.trim()) return; docs.setDocLoading(true);
    try {
      const match = docs.docLink.match(/\/d\/([\w-]+)/);
      if (!match) { alert("Invalid Google Doc link."); docs.setDocLoading(false); return; }
      const id = match[1]; docs.setDocId(id);
      const res = await fetch(`https://docs.google.com/document/d/${id}/export?format=txt`);
      if (!res.ok) throw new Error("Make sure doc is set to 'Anyone with link can view'.");
      const text = await res.text(); docs.setDocContent(text);
      const snippet = parseDocForPeriod(text, period.label);
      if (snippet) chat.setCurrentChat(h => [...h, { sender: "app", text: `📄 Class Notes loaded for ${period.label}:\n\n${snippet}`, sources: [{ label: "Class Notes 4 Paras", icon: "📄", detail: "Auto-parsed" }], isBriefing: true }]);
      else chat.setCurrentChat(h => [...h, { sender: "app", text: `📄 Google Doc loaded but no section for ${period.label}.\n📝 Build the note yourself.`, needsNoteBuilding: true }]);
    } catch (err) { chat.setCurrentChat(h => [...h, { sender: "app", text: `Could not fetch doc: ${err.message}` }]); }
    docs.setDocLoading(false);
  };

  const pushNoteToDoc = async (noteText) => {
    if (!docs.docId) { alert("No Google Doc loaded yet."); return; }
    docs.setDocPushStatus("pushing");
    const formattedNote = `\n\n--- ${period.label} | Mr. Dre | ${currentDate} ---\n${noteText}\n`;
    try {
      const res = await fetch(`https://docs.googleapis.com/v1/documents/${docs.docId}:batchUpdate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requests: [{ insertText: { location: { segmentId: "", index: 1 }, text: formattedNote } }] }) });
      if (res.ok) { docs.setDocPushStatus("done"); chat.setCurrentChat(h => [...h, { sender: "app", text: `✅ Note pushed!\n\n"${formattedNote.trim()}"` }]); }
      else { docs.setDocPushStatus("auth-needed"); chat.setCurrentChat(h => [...h, { sender: "app", text: `⚠️ Direct push needs auth.\n\n📋 Copy this:\n\n${formattedNote.trim()}` }]); }
      setTimeout(() => docs.setDocPushStatus(""), 3000);
    } catch { docs.setDocPushStatus("error"); chat.setCurrentChat(h => [...h, { sender: "app", text: `📋 Copy and paste:\n\n${formattedNote.trim()}` }]); setTimeout(() => docs.setDocPushStatus(""), 3000); }
  };

  // ── CSV export (utility functions) ──────────────────────────
  const handleExportCSV = (filteredLogs) => exportCSV(logs, allStudents, currentDate, filteredLogs);
  const handleExportCSVPrivate = (filteredLogs) => exportCSVPrivate(logs, allStudents, currentDate, identityRegistry, filteredLogs);

  // ══════════════════════════════════════════════════════════
  // TOOLBOX CONFIG
  // ══════════════════════════════════════════════════════════
  const toolboxTools = [
    { id: "situations", label: "🧠 Situations", tip: "Pick a classroom situation and get instant recommended moves, support cards, and tools.", component: <SituationPicker onSelect={s => setSituationModal(s)} /> },
    { id: "quickactions", label: "⚡ Quick Actions", tip: "One-tap logging — pick an action then tap the student to log instantly.", component: <QuickActionPanel students={effectivePeriodStudents} studentsMap={allStudents} onLog={addLog} /> },
    { id: "cards", label: "📋 Support Cards", tip: "Step-by-step reference cards for common situations.", component: <SupportCardPanel /> },
    { id: "abc", label: "📊 ABC Builder", tip: "Build structured behavior records: Antecedent, Behavior, Consequence.", component: <ABCBuilder students={effectivePeriodStudents} studentsMap={allStudents} onSave={addLog} periodLabel={period.label} currentDate={currentDate} /> },
    { id: "goals", label: "🎯 Goal Tracker", tip: "Mark IEP goal progress for any student with one tap.", component: <GoalTracker students={effectivePeriodStudents} studentsMap={allStudents} onSave={addLog} /> },
    { id: "handoff", label: "📤 Handoff Notes", tip: "Write notes for the next para, teacher, or end-of-day.", component: <HandoffBuilder students={effectivePeriodStudents} studentsMap={allStudents} onSave={addLog} ollamaOnline={ollama.ollamaOnline} ollamaLoading={ollama.ollamaLoading} onOllamaHandoff={insights.handleOllamaHandoff} /> },
    { id: "checklist", label: "✅ Checklist", tip: "Before/during/after class checklist.", component: <ParaChecklist /> },
    { id: "strategies", label: "📖 Strategies", tip: "Searchable strategy library with step-by-step guides.", component: <StrategyLibrary /> },
    ...(!simpleMode ? [
      { id: "timer", label: "⏱️ Timer", tip: "Visual countdown timer.", studentSafe: true, component: <VisualTimer /> },
      { id: "breathing", label: "🫁 Breathing", tip: "Guided 4-4-6 breathing exercise.", studentSafe: true, component: <BreathingExercise /> },
      { id: "grounding", label: "🖐️ Grounding", tip: "5-4-3-2-1 grounding exercise.", studentSafe: true, component: <GroundingExercise /> },
      { id: "calc", label: "🔢 Calculator", tip: "Calculator with fraction conversion.", studentSafe: true, component: <CalculatorTool /> },
      { id: "mult", label: "📐 Mult Chart", tip: "Interactive multiplication chart.", studentSafe: true, component: <MultChart /> },
      { id: "cer", label: "📝 CER", tip: "Claim-Evidence-Reasoning organizer.", studentSafe: true, component: <CEROrganizer /> },
    ] : [
      { id: "timer", label: "⏱️ Timer", tip: "Visual countdown timer.", studentSafe: true, component: <VisualTimer /> },
      { id: "breathing", label: "🫁 Breathing", tip: "Guided breathing.", studentSafe: true, component: <BreathingExercise /> },
    ]),
  ];

  // ══════════════════════════════════════════════════════════
  // RENDER — Vault
  // ══════════════════════════════════════════════════════════
  const renderVault = () => {
    const allStu = Object.entries(allStudents);
    const counts = { green: allStu.filter(([id]) => getHealth(id, logs, currentDate) === "green").length, yellow: allStu.filter(([id]) => getHealth(id, logs, currentDate) === "yellow").length, red: allStu.filter(([id]) => getHealth(id, logs, currentDate) === "red").length };
    let filteredLogs = logs;
    if (vaultTab === "byStudent" && vaultFilter !== "all") filteredLogs = logs.filter(l => l.studentId === vaultFilter);
    if (vaultTab === "byPeriod" && vaultFilter !== "all") filteredLogs = logs.filter(l => l.periodId === vaultFilter);
    if (vaultTab === "flagged") filteredLogs = logs.filter(l => l.flagged);
    if (vaultTab === "handoffs") filteredLogs = logs.filter(l => l.type === "Handoff Note");
    if (vaultTab === "goalProgress") filteredLogs = logs.filter(l => l.type === "Goal Progress");
    const vaultTabs = [{ id: "all", label: "All Logs" }, { id: "byStudent", label: "By Student" }, { id: "byPeriod", label: "By Period" }, { id: "flagged", label: `Flagged (${logs.filter(l => l.flagged).length})` }, { id: "handoffs", label: `Handoffs (${logs.filter(l => l.type === "Handoff Note").length})` }, { id: "goalProgress", label: `Goals (${logs.filter(l => l.type === "Goal Progress").length})` }, { id: "knowledge", label: `KB (${knowledgeBase.length})` }];
    return (<div>
      <div className="header"><div><h1>Data Vault</h1><p className="teacher-subtitle">{logs.length} observations · {knowledgeBase.length} KB docs · FERPA-safe</p></div><div style={{ display: "flex", gap: "8px" }}><button className="btn btn-secondary" onClick={() => handleExportCSV(filteredLogs)}>Export Filtered</button><button className="btn btn-primary" onClick={() => handleExportCSV()}>Export All</button>{identityRegistry.length > 0 && <button className="btn btn-secondary" style={{ borderColor: "#854d0e", color: "#fbbf24" }} onClick={() => handleExportCSVPrivate(filteredLogs)}>Export with Names</button>}</div></div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "12px", marginBottom: "20px" }}>{[{ h: "green", label: "Logged today", color: "var(--green)", border: "#166534" }, { h: "yellow", label: "This week", color: "var(--yellow)", border: "#854d0e" }, { h: "red", label: "Needs attention", color: "var(--red)", border: "#7f1d1d" }].map(({ h, label, color, border }) => (<div key={h} className="panel" style={{ padding: "14px 16px", borderColor: border }}><div style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "4px" }}>{label}</div><div style={{ fontSize: "28px", fontWeight: "700", color }}>{counts[h]}</div><div style={{ fontSize: "12px", color: "var(--text-muted)" }}>student{counts[h] !== 1 ? "s" : ""}</div></div>))}</div>
      <div style={{ display: "flex", gap: "4px", marginBottom: "16px", flexWrap: "wrap" }}>{vaultTabs.map(t => (<button key={t.id} onClick={() => { setVaultTab(t.id); setVaultFilter("all"); }} style={{ padding: "6px 14px", borderRadius: "6px", border: "none", cursor: "pointer", fontSize: "12px", fontWeight: "500", background: vaultTab === t.id ? "#1d4ed8" : "var(--panel-bg)", color: vaultTab === t.id ? "#fff" : "var(--text-muted)" }}>{t.label}</button>))}</div>
      {(vaultTab === "byStudent" || vaultTab === "byPeriod") && (<div style={{ marginBottom: "14px", display: "flex", gap: "8px", alignItems: "center" }}><span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Filter:</span><select value={vaultFilter} onChange={e => setVaultFilter(e.target.value)} className="period-select" style={{ maxWidth: "280px" }}><option value="all">All</option>{vaultTab === "byStudent" && Object.entries(allStudents).map(([id, s]) => (<option key={id} value={id}>{resolveLabel(s, "compact")} ({logs.filter(l => l.studentId === id).length})</option>))}{vaultTab === "byPeriod" && Object.entries(DB.periods).map(([id, p]) => (<option key={id} value={id}>{p.label}</option>))}</select></div>)}
      {vaultTab === "knowledge" && (<div>
        <div className="panel" style={{ padding: "16px", marginBottom: "16px" }}>
          <h3 style={{ margin: "0 0 4px", fontSize: "14px", color: "var(--accent)" }}>Add to Knowledge Base</h3>
          <p style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "12px" }}>AI uses everything in here.</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "8px" }}>
            <div><label style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>Title</label><input value={kb.kbTitle} onChange={e => kb.setKbTitle(e.target.value)} placeholder="e.g. Decimal Strategies" style={{ width: "100%", padding: "8px 10px", background: "var(--bg-dark)", border: "1px solid var(--border)", borderRadius: "6px", color: "white", fontSize: "13px" }} /></div>
            <div><label style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>Type</label><select value={kb.kbDocType} onChange={e => kb.setKbDocType(e.target.value)} className="period-select" style={{ width: "100%" }}><option>Teaching Strategy</option><option>Lesson Plan</option><option>IEP Document</option><option>My Own Notes</option><option>Para Team Notes</option><option>Other</option></select></div>
          </div>
          <textarea value={kb.kbInput} onChange={e => kb.setKbInput(e.target.value)} className="data-textarea" style={{ height: "100px" }} placeholder="Paste content or upload below..." />
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
            <button className="btn btn-primary" onClick={() => kb.addToKB(activePeriod)}>+ Add for {period.label}</button>
            <button className="btn btn-secondary" onClick={() => kb.addToKB("all")}>+ Add for All</button>
            <input type="file" ref={kb.fileInputRef} style={{ display: "none" }} accept=".pdf,.txt,.doc,.docx" onChange={e => kb.handleFileUpload(e, activePeriod)} />
            <button className="btn btn-secondary" style={{ background: "#1e3a5f", color: "#93c5fd", border: "1px solid #1d4ed8" }} onClick={() => kb.fileInputRef.current?.click()} disabled={kb.kbUploading}>{kb.kbUploading ? "Extracting..." : "📎 Upload"}</button>
          </div>
        </div>
        {knowledgeBase.length === 0 ? <div className="empty-doc">No documents yet.</div> : (<div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {knowledgeBase.map(doc => (<div key={doc.id} className="panel" style={{ padding: "14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "6px" }}>
              <div><div style={{ fontWeight: "600", fontSize: "14px", color: "var(--accent)", marginBottom: "4px" }}>{doc.title}</div><div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}><span style={{ fontSize: "10px", background: "#1e293b", color: "#f59e0b", padding: "2px 8px", borderRadius: "20px", border: "1px solid #854d0e" }}>{doc.docType}</span><span style={{ fontSize: "10px", background: "#1e3a5f", color: "#93c5fd", padding: "2px 8px", borderRadius: "20px" }}>{doc.period === "all" ? "All Periods" : DB.periods[doc.period]?.label || doc.period}</span></div></div>
              <button onClick={() => kb.setKnowledgeBase(prev => prev.filter(d => d.id !== doc.id))} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: "16px" }}>×</button>
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)", lineHeight: "1.5", maxHeight: "60px", overflow: "hidden", borderTop: "1px solid var(--border)", paddingTop: "8px", marginTop: "2px" }}>{doc.content.slice(0, 200)}{doc.content.length > 200 ? "..." : ""}</div>
          </div>))}
        </div>)}
      </div>)}
      {vaultTab !== "knowledge" && (filteredLogs.length === 0 ? (<div className="empty-doc">{vaultTab === "flagged" ? "No flagged entries." : "No logs match."}</div>) : (<div className="table-container"><table className="data-table"><thead><tr><th>Date</th><th>Period</th><th>Student</th><th>Type</th><th>Tags</th><th>Observation</th><th style={{ textAlign: "right" }}>Actions</th></tr></thead><tbody>{filteredLogs.map(l => { const s = allStudents[l.studentId] || { pseudonym: l.studentId, color: "#64748b" }; return (<tr key={l.id}><td style={{ whiteSpace: "nowrap", color: "var(--text-muted)" }}>{l.date}</td><td style={{ fontSize: "12px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>{l.period}</td><td style={{ fontWeight: "600", color: s.color, whiteSpace: "nowrap", cursor: "pointer" }} onClick={() => setProfileStu(l.studentId)}>{s.pseudonym}</td><td><span style={{ fontSize: "11px", background: l.type === "Handoff Note" ? "#854d0e" : "#1e3a5f", color: l.type === "Handoff Note" ? "#fde68a" : "#93c5fd", padding: "2px 8px", borderRadius: "20px", whiteSpace: "nowrap" }}>{l.type}</span></td><td style={{ fontSize: "10px", color: "#4a6284" }}>{(l.tags || []).slice(0, 3).join(", ")}</td><td>{editingLog === l.id ? (<div style={{ display: "flex", gap: "6px" }}><input defaultValue={l.note || l.text} id={`edit_${l.id}`} style={{ flex: 1, padding: "4px 8px", background: "var(--bg-dark)", border: "1px solid var(--border)", borderRadius: "4px", color: "white", fontSize: "12px" }} /><button className="btn btn-primary" style={{ fontSize: "11px", padding: "4px 8px" }} onClick={() => saveEdit(l.id, document.getElementById(`edit_${l.id}`).value)}>Save</button><button className="btn btn-secondary" style={{ fontSize: "11px", padding: "4px 8px" }} onClick={() => setEditingLog(null)}>Cancel</button></div>) : <span style={{ fontSize: "13px" }}>{l.note || l.text}</span>}</td><td style={{ textAlign: "right", whiteSpace: "nowrap" }}><button onClick={() => toggleFlag(l.id)} title="Flag for IEP" style={{ background: "none", border: "none", cursor: "pointer", fontSize: "14px", color: l.flagged ? "#f59e0b" : "#334155" }}>⚑</button><button onClick={() => setEditingLog(l.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "13px", color: "#60a5fa", marginLeft: "4px" }}>✏</button><button onClick={() => deleteLog(l.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "13px", color: "#ef4444", marginLeft: "4px" }}>🗑</button></td></tr>); })}</tbody></table></div>))}
    </div>);
  };

  // ══════════════════════════════════════════════════════════
  // MAIN RENDER
  // ══════════════════════════════════════════════════════════
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
      <BrandHeader right={<OllamaStatusBadge online={ollama.ollamaOnline} model={ollama.ollamaModel} />} />

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
      {rosterPanelOpen && (
        <RosterPanel
          onClose={() => setRosterPanelOpen(false)}
          allStudents={allStudents}
          identityRegistry={identityRegistry}
          activePeriod={activePeriod}
          onIdentityLoad={students.handleIdentityLoad}
          onClearRoster={() => students.setIdentityRegistry([])}
        />
      )}

    <div className="app-layout" style={{ flex: 1, minWidth: 0 }}>
      <aside className="sidebar">
        {(() => {
          const sb = getSidebarVisibility(simpleMode);
          return (<>
            <div className="brand" style={{ fontSize: "11px", color: "#1e3a5f", padding: "0 4px 10px", marginBottom: "2px" }}>v2</div>

            <Tip text="Simplified note-taking for paras. Large buttons, plain language — advanced processing runs in the background." pos="right">
              <button onClick={() => setSimpleMode(!simpleMode)} style={{ width: "100%", padding: "9px 7px", borderRadius: "8px", border: `2px solid ${simpleMode ? "#166534" : "#1d4ed8"}`, background: simpleMode ? "#14532d" : "#0c1a2e", color: simpleMode ? "#4ade80" : "#93c5fd", cursor: "pointer", fontSize: "12px", fontWeight: "700", marginBottom: "10px" }}>
                {simpleMode ? "✓ Simple Mode ON" : "📝 Simple Mode"}
              </button>
            </Tip>

            <div className="sidebar-control"><label>Date</label><input type="date" className="period-select" style={{ width: "100%", marginTop: "4px" }} value={currentDate} onChange={e => setCurrentDate(e.target.value)} /></div>
            <div className="sidebar-control"><label>Active Period</label><select className="period-select" style={{ width: "100%", marginTop: "4px" }} value={activePeriod} onChange={e => setActivePeriod(e.target.value)}>{Object.entries(DB.periods).map(([id, p]) => (<option key={id} value={id}>{p.label}</option>))}</select></div>

            {sb.showNav && (
              <div style={{ marginTop: "8px" }}>
                <div style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: "6px", padding: "0 4px" }}>Navigation</div>
                {[{ id: "dashboard", label: "📊 Dashboard", tip: "Main copilot view" }, { id: "vault", label: "🗄️ Data Vault", tip: "All logs, flagged items, knowledge base" }, { id: "import", label: "📥 IEP Import", tip: "Upload IEPs or paste student documents — converted to FERPA-safe structured student profiles automatically" }, { id: "analytics", label: "📈 Analytics", tip: "Visual data dashboard with custom date ranges and groups" }].map(({ id, label, tip }) => (
                  <Tip key={id} text={tip} pos="right"><button className={`nav-btn${view === id ? " active" : ""}`} onClick={() => setView(id)}>{label}</button></Tip>
                ))}
              </div>
            )}

            {sb.showToolbox && (
              <div style={{ marginTop: "16px" }}>
                <div style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: "6px", padding: "0 4px" }}>Toolbox <span style={{ color: "#334155", fontWeight: "400", textTransform: "none" }}>(dbl-click = pop out)</span></div>
                {toolboxTools.map(t => (
                  <Tip key={t.id} text={t.tip} pos="right"><button className="nav-btn" style={activeToolbox === t.id ? { background: "#1e3a5f", color: "#93c5fd" } : {}}
                    onClick={() => setActiveToolbox(activeToolbox === t.id ? null : t.id)}
                    onDoubleClick={(e) => { e.preventDefault(); setActiveToolbox(null); if (!floatingTools.includes(t.id)) setFloatingTools(prev => [...prev, t.id]); }}
                  >{t.label}</button></Tip>
                ))}
              </div>
            )}

            <div style={{ marginTop: "auto", paddingTop: "16px", borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: "6px" }}>
              <Tip text="Hide all student data. Screen shows only classroom tools." pos="right">
                <button onClick={() => setStealthMode(true)} style={{ width: "100%", padding: "6px", borderRadius: "6px", border: "1px solid #7f1d1d", background: "#1a0505", color: "#f87171", cursor: "pointer", fontSize: "11px", fontWeight: "600" }}>🛡️ Stealth Mode</button>
              </Tip>
              <Tip text="Private local reference panel for real student and class names. Never stored or exported." pos="right">
                <button onClick={() => setRosterPanelOpen(!rosterPanelOpen)} style={{ width: "100%", padding: "7px", borderRadius: "6px", border: `1px solid ${rosterPanelOpen ? "#1d4ed8" : "#334155"}`, background: rosterPanelOpen ? "#1e3a5f" : "transparent", color: rosterPanelOpen ? "#93c5fd" : "#64748b", cursor: "pointer", fontSize: "11px", fontWeight: "600" }}>
                  {rosterPanelOpen ? "✓ Private Roster" : "👤 Private Roster"}
                </button>
              </Tip>
              <div style={{ fontSize: "11px", color: "#334155", textAlign: "center", lineHeight: "1.8" }}>FERPA-Safe — Pseudonyms only</div>
            </div>
          </>);
        })()}
      </aside>

      <main className="main-content" style={{ flex: 1, overflowY: simpleMode ? "hidden" : "auto", padding: simpleMode ? 0 : undefined }}>
        {simpleMode
          ? <SimpleMode
              activePeriod={activePeriod}
              setActivePeriod={setActivePeriod}
              logs={logs}
              addLog={addLog}
              currentDate={currentDate}
              allStudents={allStudents}
              effectivePeriodStudents={effectivePeriodStudents}
            />
          : <>
              {view === "dashboard" && (
                <Dashboard
                  period={period} activePeriod={activePeriod}
                  effectivePeriodStudents={effectivePeriodStudents} allStudents={allStudents}
                  logs={logs} addLog={addLog} currentDate={currentDate}
                  ollamaOnline={ollama.ollamaOnline} ollamaModel={ollama.ollamaModel} ollamaLoading={ollama.ollamaLoading}
                  askAI={chat.askAI} aiLoading={chat.aiLoading} handleOllamaSuggestions={chat.handleOllamaSuggestions}
                  currentChat={chat.currentChat} chatInput={chat.chatInput} setChatInput={chat.setChatInput}
                  handleChat={chat.handleChat} chatMode={chat.chatMode} setChatMode={chat.setChatMode}
                  chatEndRef={chat.chatEndRef}
                  docContent={docs.docContent} docLink={docs.docLink} setDocLink={docs.setDocLink}
                  fetchDoc={fetchDoc} docLoading={docs.docLoading}
                  setProfileStu={setProfileStu}
                  caseMemory={caseMemory}
                  onLoadDemo={handleLoadDemo}
                  onClearDemo={handleClearDemo}
                />
              )}
              {view === "vault" && renderVault()}
              {view === "import" && <IEPImport onImport={students.handleImport} onBulkImport={students.handleBundleImport} onIdentityLoad={students.handleIdentityLoad} importedCount={Object.keys(students.importedStudents).length} onLoadDemo={handleLoadDemo} />}
              {view === "analytics" && <AnalyticsDashboard logs={logs} groups={groups} setGroups={setGroups} onOpenProfile={setProfileStu} ollamaOnline={ollama.ollamaOnline} ollamaLoading={ollama.ollamaLoading} onOllamaPatternSummary={insights.handleOllamaPatternSummary} allStudents={allStudents} />}
            </>
        }
      </main>

      {activeToolbox && (<aside style={{ width: "320px", flexShrink: 0, background: "var(--panel-bg)", borderLeft: "1px solid var(--border)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <strong style={{ fontSize: "13px" }}>{toolboxTools.find(t => t.id === activeToolbox)?.label}</strong>
          <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
            <button onClick={() => { if (!floatingTools.includes(activeToolbox)) setFloatingTools(prev => [...prev, activeToolbox]); setActiveToolbox(null); }} title="Pop out" style={{ background: "none", border: "1px solid #1e293b", color: "#8fa3c4", fontSize: "11px", cursor: "pointer", borderRadius: "4px", padding: "2px 6px", lineHeight: 1 }}>↗</button>
            {toolboxTools.find(t => t.id === activeToolbox)?.studentSafe && (<button onClick={() => setFullscreenTool(activeToolbox)} title="Fullscreen" style={{ background: "none", border: "1px solid #1e293b", color: "#8fa3c4", fontSize: "14px", cursor: "pointer", borderRadius: "4px", padding: "2px 6px", lineHeight: 1 }}>⛶</button>)}
            <button onClick={() => setActiveToolbox(null)} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: "20px", cursor: "pointer", lineHeight: 1 }}>×</button>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>{toolboxTools.find(t => t.id === activeToolbox)?.component}</div>
      </aside>)}

      {profileStu && (<StudentProfileModal studentId={profileStu} studentData={allStudents[profileStu]} logs={logs} currentDate={currentDate} activePeriod={activePeriod} onClose={() => setProfileStu(null)} onLog={addLog} onDraftEmail={(id) => { setProfileStu(null); insights.draftEmail(id); }} onUpdateIdentity={students.handleUpdateIdentity} caseMemory={caseMemory} />)}
      {insights.emailModal && (<EmailModal studentId={insights.emailModal.studentId} studentData={allStudents[insights.emailModal.studentId]} emailLoading={insights.emailLoading} emailDraft={insights.emailDraft} setEmailDraft={insights.setEmailDraft} onClose={() => { insights.setEmailModal(null); insights.setEmailDraft(""); }} />)}
      {situationModal && (<SituationResponseModal situation={situationModal} students={effectivePeriodStudents} studentsMap={allStudents} onClose={() => setSituationModal(null)} onLog={(id, note, type) => addLog(id, note, type)} onOpenCard={() => { setSituationModal(null); setActiveToolbox("cards"); }} />)}
      {insights.ollamaModal && (<OllamaInsightModal feature={insights.ollamaModal.feature} text={insights.ollamaModal.text} studentId={insights.ollamaModal.studentId} onClose={() => insights.setOllamaModal(null)} onLog={addLog} />)}

      {floatingTools.map(tid => { const t = toolboxTools.find(x => x.id === tid); return t ? <FloatingToolWindow key={tid} tool={t} onClose={() => setFloatingTools(prev => prev.filter(x => x !== tid))} onFullscreen={() => { setFullscreenTool(tid); setFloatingTools(prev => prev.filter(x => x !== tid)); }} onDock={() => { setFloatingTools(prev => prev.filter(x => x !== tid)); setActiveToolbox(tid); }} /> : null; })}

      {fullscreenTool && (<FullscreenTool tool={toolboxTools.find(t => t.id === fullscreenTool) || toolboxTools[0]} onClose={() => setFullscreenTool(null)} />)}
      {stealthMode && (<StealthScreen activeTool={stealthTool} toolboxTools={toolboxTools} onSelectTool={setStealthTool} onExit={() => setStealthMode(false)} />)}
    </div>
    </div>
    </div>
  );
}
