// ══════════════════════════════════════════════════════════════
// APP.JSX — Orchestrator
// Imports everything, manages state, wires it together.
// ══════════════════════════════════════════════════════════════
import React, { useState, useEffect, useRef, useCallback } from "react";
import "./styles/styles.css";

// Data layer
import { DB, QUICK_ACTIONS } from './data';

// Engine layer
import { runLocalEngine, parseDocForPeriod } from './engine';
import { checkOllamaHealth, ollamaAskAI, ollamaDraftEmail, ollamaExtractPDF,
         summarizeStudentPatterns, generateHandoffNote, generateTeachingSuggestions,
         OllamaOfflineError } from './engine/ollama';
import { buildContextPack, serializeForAI, serializeForPatternPrompt,
         serializeForHandoffPrompt, serializeForSuggestionsPrompt,
         serializeForEmailPrompt } from './context/buildContext';

// Model layer
import { createLog, getHealth, hdot } from './models';

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

export default function App() {
  // ── Core state ─────────────────────────────────────────────
  const today = new Date(), localISO = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().split("T")[0];
  const [currentDate, setCurrentDate] = useState(localISO);
  const [activePeriod, setActivePeriod] = useState("p3");
  const [view, setView] = useState("dashboard");
  const [logs, setLogs] = useState(() => {
    try { const s = localStorage.getItem("paraLogsV1"); return s ? JSON.parse(s) : []; } catch { return []; }
  });
  const [knowledgeBase, setKnowledgeBase] = useState(() => {
    try { const s = localStorage.getItem("paraKBV1"); return s ? JSON.parse(s) : []; } catch { return []; }
  });
  const [simpleMode, setSimpleMode] = useState(false);
  const [rosterPanelOpen, setRosterPanelOpen] = useState(false);
  const [importedStudents, setImportedStudents] = useState({});
  const [importedPeriodMap, setImportedPeriodMap] = useState({});

  // ── UI state ───────────────────────────────────────────────
  const [profileStu, setProfileStu] = useState(null);
  const [activeToolbox, setActiveToolbox] = useState(null);
  const [floatingTools, setFloatingTools] = useState([]);
  const [fullscreenTool, setFullscreenTool] = useState(null);
  const [stealthMode, setStealthMode] = useState(false);
  const [stealthTool, setStealthTool] = useState("timer");
  const [situationModal, setSituationModal] = useState(null);
  const [emailModal, setEmailModal] = useState(null);
  const [emailDraft, setEmailDraft] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [groups, setGroups] = useState([]);

  // ── Chat state ─────────────────────────────────────────────
  const initMsg = pid => [{ sender: "app", text: `Hi Mr. Dre! Watching ${DB.periods[pid].label} with ${DB.periods[pid].teacher}. Tell me what is happening and I will cross-reference IEPs, Support Cards, and the Situation Engine.` }];
  const [periodChats, setPeriodChats] = useState({ p1: initMsg("p1"), p2: initMsg("p2"), p3: initMsg("p3"), p4: initMsg("p4"), p5: initMsg("p5"), p6: initMsg("p6") });
  const [masterChat, setMasterChat] = useState([{ sender: "app", text: "Master chat — shows all cross-period AI messages." }]);
  const [chatMode, setChatMode] = useState("period");
  const [chatInput, setChatInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  // ── Ollama state ───────────────────────────────────────────
  const [ollamaOnline, setOllamaOnline] = useState(false);
  const [ollamaModel, setOllamaModel] = useState(null);
  const [ollamaLoading, setOllamaLoading] = useState(false);
  const [ollamaModal, setOllamaModal] = useState(null); // { feature, text, studentId }

  // ── Doc state ──────────────────────────────────────────────
  const [docLink, setDocLink] = useState(""), [docContent, setDocContent] = useState(""), [docLoading, setDocLoading] = useState(false), [docId, setDocId] = useState("");
  const [noteDraft, setNoteDraft] = useState(""), [showNoteDraft, setShowNoteDraft] = useState(false), [docPushStatus, setDocPushStatus] = useState("");

  // ── Vault state ────────────────────────────────────────────
  const [vaultTab, setVaultTab] = useState("all"), [vaultFilter, setVaultFilter] = useState("all"), [editingLog, setEditingLog] = useState(null);
  const [kbInput, setKbInput] = useState(""), [kbTitle, setKbTitle] = useState(""), [kbDocType, setKbDocType] = useState("Teaching Strategy"), [kbUploading, setKbUploading] = useState(false);
  const fileInputRef = useRef();

  // ── Derived ────────────────────────────────────────────────
  const chatEndRef = useRef();
  const period = DB.periods[activePeriod];
  // Merge static DB students with any imported students
  const allStudents = { ...DB.students, ...importedStudents };
  const effectivePeriodStudents = [...new Set([...period.students, ...(importedPeriodMap[activePeriod] || [])])];

  // Single-student import (existing IEP/Ollama/manual flow)
  const handleImport = (studentObj, periodId) => {
    setImportedStudents(prev => ({ ...prev, [studentObj.id]: studentObj }));
    setImportedPeriodMap(prev => ({ ...prev, [periodId]: [...(prev[periodId] || []), studentObj.id] }));
  };

  // identityRegistry — local only, FERPA-sensitive, never persisted
  // Shape: [{ realName, pseudonym, color, periodIds: string[], classLabels: {} }]
  const [identityRegistry, setIdentityRegistry] = useState([]);

  // handleIdentityLoad — accepts v2.0 registry entries or v1.0 backward-compat shape.
  // v2.0: [{ realName, pseudonym, color, periodIds, classLabels }]
  // v1.0: [{ displayLabel, realName, color }] — promoted to minimal v2.0 shape
  const handleIdentityLoad = (entries) => {
    const normalized = (entries || [])
      .filter(e => e.realName && (e.pseudonym || e.displayLabel))
      .map(e => ({
        realName:    e.realName,
        pseudonym:   e.pseudonym   || e.displayLabel,
        color:       e.color       || "",
        periodIds:   e.periodIds   || [],
        classLabels: e.classLabels || {},
      }));
    if (normalized.length > 0) setIdentityRegistry(normalized);
  };

  // Bulk bundle import — deduplicates by id, never touches privateRosterMap
  const handleBundleImport = (students, periodMapUpdates) => {
    setImportedStudents(prev => {
      const next = { ...prev };
      students.forEach(s => { next[s.id] = s; }); // same id = replace, new id = add
      return next;
    });
    setImportedPeriodMap(prev => {
      const next = { ...prev };
      Object.entries(periodMapUpdates).forEach(([pid, ids]) => {
        next[pid] = [...new Set([...(prev[pid] || []), ...ids])];
      });
      return next;
    });
  };
  const currentChat = chatMode === "master" ? masterChat : (periodChats[activePeriod] || []);
  const setCurrentChat = useCallback(updater => {
    if (chatMode === "master") { setMasterChat(updater); }
    else { setPeriodChats(prev => ({ ...prev, [activePeriod]: typeof updater === "function" ? updater(prev[activePeriod]) : updater })); }
  }, [chatMode, activePeriod]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [currentChat, activePeriod]);

  // Persist logs + KB to localStorage on every change
  useEffect(() => { try { localStorage.setItem("paraLogsV1", JSON.stringify(logs)); } catch {} }, [logs]);
  useEffect(() => { try { localStorage.setItem("paraKBV1",  JSON.stringify(knowledgeBase)); } catch {} }, [knowledgeBase]);

  // Check Ollama on mount
  useEffect(() => {
    checkOllamaHealth().then(({ online, model }) => { setOllamaOnline(online); setOllamaModel(model); });
  }, []);

  // ══════════════════════════════════════════════════════════
  // ACTIONS — all use createLog from models layer
  // ══════════════════════════════════════════════════════════
  const addLog = (studentId, note, type, extras = {}) => {
    const log = createLog({
      studentId, type, note, date: currentDate,
      period: period.label, periodId: activePeriod,
      ...extras,
    });
    setLogs(prev => [log, ...prev]);
  };

  const toggleFlag = id => setLogs(prev => prev.map(l => l.id === id ? { ...l, flagged: !l.flagged } : l));
  const deleteLog = id => { if (window.confirm("Delete this log entry?")) setLogs(prev => prev.filter(l => l.id !== id)); };
  const saveEdit = (id, newText) => { setLogs(prev => prev.map(l => l.id === id ? { ...l, note: newText, text: newText } : l)); setEditingLog(null); };

  // ── Chat handler — uses engine ─────────────────────────────
  const handleChat = e => {
    e?.preventDefault(); if (!chatInput.trim()) return;
    const userText = chatInput; setChatInput("");
    setCurrentChat(h => [...h, { sender: "user", text: userText }]);
    const result = runLocalEngine(userText, effectivePeriodStudents, knowledgeBase, activePeriod, docContent, period.label, logs);
    let kbBlock = "";
    if (result.kbHits.length > 0) { kbBlock = "\n\n📚 From your Knowledge Base:"; result.kbHits.forEach(hit => { kbBlock += `\n[${hit.docTitle}]`; hit.snippets.forEach(s => { kbBlock += `\n  — ${s}`; }); }); }
    let docBlock = result.docSnippet ? `\n\n📄 From Class Notes 4 Paras:\n${result.docSnippet.slice(0, 200)}${result.docSnippet.length > 200 ? "..." : ""}` : "";
    let notePrompt = result.needsNoteBuilding ? "\n\n📝 No shared doc data for this period yet." : "";
    setCurrentChat(h => [...h, {
      sender: "app", text: result.moves.join("\n") + kbBlock + docBlock + notePrompt,
      actions: result.actions, sources: result.sources, kbHits: result.kbHits, showAI: true,
      originalQuery: userText, followUp: result.followUp, needsNoteBuilding: result.needsNoteBuilding,
      recommendedCards: result.recommendedCards, recommendedTools: result.recommendedTools,
      detectedSituations: result.situations,
    }]);
  };

  const askAI = async (query) => {
    if (!ollamaOnline) {
      setCurrentChat(h => [...h, { sender: "app", text: "Local AI is offline. Start Ollama with: ollama serve\nLocal engine results above are still valid." }]);
      return;
    }
    setAiLoading(true);
    const kbDocs = knowledgeBase.filter(k => k.period === activePeriod || k.period === "all").map(k => `[${k.title}]:\n${k.content.slice(0, 600)}`).join("\n\n");
    const bundledSources = ["📋 IEP database", ...(kbDocs ? [`📚 KB (${knowledgeBase.filter(k => k.period === activePeriod || k.period === "all").length} docs)`] : []), ...(docContent ? ["📄 Class Notes"] : []), ...(logs.length ? ["🗄️ Recent logs"] : [])];
    setCurrentChat(h => [...h, { sender: "app", text: `Local AI reading:\n${bundledSources.join("\n")}`, isBundleNotice: true }]);
    const pack = buildContextPack({ studentIds: effectivePeriodStudents, allStudents, logs, activePeriod, docContent, currentDate, logDaysBack: 7 });
    const userPrompt = serializeForAI(pack, query, kbDocs);
    try {
      const reply = await ollamaAskAI(userPrompt);
      setCurrentChat(h => [...h, { sender: "ai", text: reply, aiSources: bundledSources }]);
      if (chatMode === "period") setMasterChat(h => [...h, { sender: "ai", text: `[${period.label}] ${reply}` }]);
    } catch (err) {
      if (err instanceof OllamaOfflineError) setOllamaOnline(false);
      setCurrentChat(h => [...h, { sender: "app", text: `Local AI error: ${err.message}` }]);
    }
    setAiLoading(false);
  };

  // ── Doc fetch/push ─────────────────────────────────────────
  const fetchDoc = async () => {
    if (!docLink.trim()) return; setDocLoading(true);
    try {
      const match = docLink.match(/\/d\/([\w-]+)/);
      if (!match) { alert("Invalid Google Doc link."); setDocLoading(false); return; }
      const id = match[1]; setDocId(id);
      const res = await fetch(`https://docs.google.com/document/d/${id}/export?format=txt`);
      if (!res.ok) throw new Error("Make sure doc is set to 'Anyone with link can view'.");
      const text = await res.text(); setDocContent(text);
      const snippet = parseDocForPeriod(text, period.label);
      if (snippet) setCurrentChat(h => [...h, { sender: "app", text: `📄 Class Notes loaded for ${period.label}:\n\n${snippet}`, sources: [{ label: "Class Notes 4 Paras", icon: "📄", detail: "Auto-parsed" }], isBriefing: true }]);
      else setCurrentChat(h => [...h, { sender: "app", text: `📄 Google Doc loaded but no section for ${period.label}.\n📝 Build the note yourself.`, needsNoteBuilding: true }]);
    } catch (err) { setCurrentChat(h => [...h, { sender: "app", text: `Could not fetch doc: ${err.message}` }]); }
    setDocLoading(false);
  };

  const pushNoteToDoc = async (noteText) => {
    if (!docId) { alert("No Google Doc loaded yet."); return; }
    setDocPushStatus("pushing");
    const formattedNote = `\n\n--- ${period.label} | Mr. Dre | ${currentDate} ---\n${noteText}\n`;
    try {
      const res = await fetch(`https://docs.googleapis.com/v1/documents/${docId}:batchUpdate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requests: [{ insertText: { location: { segmentId: "", index: 1 }, text: formattedNote } }] }) });
      if (res.ok) { setDocPushStatus("done"); setCurrentChat(h => [...h, { sender: "app", text: `✅ Note pushed!\n\n"${formattedNote.trim()}"` }]); }
      else { setDocPushStatus("auth-needed"); setCurrentChat(h => [...h, { sender: "app", text: `⚠️ Direct push needs auth.\n\n📋 Copy this:\n\n${formattedNote.trim()}` }]); }
      setTimeout(() => setDocPushStatus(""), 3000);
    } catch { setDocPushStatus("error"); setCurrentChat(h => [...h, { sender: "app", text: `📋 Copy and paste:\n\n${formattedNote.trim()}` }]); setTimeout(() => setDocPushStatus(""), 3000); }
  };

  // ── KB management ──────────────────────────────────────────
  const addToKB = scope => {
    if (!kbTitle.trim() || !kbInput.trim()) return;
    setKnowledgeBase(prev => [...prev, { id: Date.now(), title: kbTitle, content: kbInput, docType: kbDocType, period: scope, date: currentDate, source: "text" }]);
    setKbTitle(""); setKbInput("");
    alert(`Added "${kbTitle}" to KB.`);
  };

  const handleFileUpload = async (e, scope) => {
    const file = e.target.files[0]; if (!file) return; setKbUploading(true);
    try {
      let text = "";
      if (file.type === "application/pdf") {
        // Extract PDF text locally via pdfjs-dist — no Anthropic API needed
        try {
          const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf");
          pdfjsLib.GlobalWorkerOptions.workerSrc =
            `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
          const arrayBuffer = await file.arrayBuffer();
          const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            text += content.items.map(item => item.str).join(" ") + "\n";
          }
        } catch {
          alert("Could not extract PDF text. Try a .txt file instead.");
          setKbUploading(false); e.target.value = ""; return;
        }
      } else {
        text = await file.text();
      }
      setKnowledgeBase(prev => [...prev, {
        id: Date.now(), title: kbTitle.trim() || file.name.replace(/\.\w+$/, ""),
        content: text, docType: kbDocType, period: scope, date: currentDate,
        source: file.type === "application/pdf" ? "pdf" : "file", fileName: file.name,
      }]);
      setKbTitle("");
    } catch { alert("Could not read file."); }
    setKbUploading(false); e.target.value = "";
  };

  const draftEmail = async studentId => {
    setEmailDraft(""); setEmailModal({ studentId }); setEmailLoading(true);
    const s = allStudents[studentId];
    const stuLogs = logs.filter(l => l.studentId === studentId).slice(0, 5);
    const prompt = serializeForEmailPrompt(s, stuLogs);
    try {
      const draft = await ollamaDraftEmail(prompt);
      setEmailDraft(draft);
    } catch (err) {
      if (err instanceof OllamaOfflineError) setOllamaOnline(false);
      setEmailDraft("Local AI is offline. Start Ollama with: ollama serve");
    }
    setEmailLoading(false);
  };

  // ── Ollama handlers ────────────────────────────────────────
  const ollamaErrorHandler = (err) => {
    if (err instanceof OllamaOfflineError) { setOllamaOnline(false); return "Local AI is offline. Run: ollama serve"; }
    return `Local AI error: ${err.message}`;
  };

  const handleOllamaPatternSummary = async (studentId) => {
    setOllamaLoading(true);
    try {
      const pack = buildContextPack({ studentIds: effectivePeriodStudents, allStudents, logs, activePeriod, docContent, currentDate, focusStudentId: studentId, logDaysBack: 14 });
      const result = await summarizeStudentPatterns(serializeForPatternPrompt(pack));
      setOllamaModal({ feature: "patterns", text: result, studentId });
    } catch (err) { setCurrentChat(h => [...h, { sender: "app", text: ollamaErrorHandler(err) }]); }
    setOllamaLoading(false);
  };

  const handleOllamaHandoff = async (studentId, audience, urgency) => {
    setOllamaLoading(true);
    try {
      const pack = buildContextPack({ studentIds: effectivePeriodStudents, allStudents, logs, activePeriod, docContent, currentDate, focusStudentId: studentId, logDaysBack: 1, handoffAudience: audience, handoffUrgency: urgency });
      const result = await generateHandoffNote(serializeForHandoffPrompt(pack));
      setOllamaLoading(false);
      return result;
    } catch (err) { setCurrentChat(h => [...h, { sender: "app", text: ollamaErrorHandler(err) }]); setOllamaLoading(false); return null; }
  };

  const handleOllamaSuggestions = async (query, detectedSituations) => {
    setOllamaLoading(true);
    try {
      const pack = buildContextPack({ studentIds: effectivePeriodStudents, allStudents, logs, activePeriod, docContent, currentDate, logDaysBack: 7, detectedSituations });
      const result = await generateTeachingSuggestions(serializeForSuggestionsPrompt(pack));
      setCurrentChat(h => [...h, { sender: "ollama", text: result, ollamaFeature: "suggestions" }]);
    } catch (err) { setCurrentChat(h => [...h, { sender: "app", text: ollamaErrorHandler(err) }]); }
    setOllamaLoading(false);
  };

  const exportCSV = filteredLogs => {
    const target = filteredLogs || logs; if (!target.length) { alert("No data!"); return; }
    const hdr = "Date,Period,Student,Type,Category,Flagged,Tags,Observation\n";
    const rows = target.map(l => { const s = allStudents[l.studentId] || { pseudonym: l.studentId }; return `"${l.date}","${l.period}","${s.pseudonym}","${l.type}","${l.category || ""}","${l.flagged ? "Yes" : "No"}","${(l.tags || []).join(";")}","${(l.note || l.text || "").replace(/"/g, '""')}"`; }).join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([hdr + rows], { type: "text/csv" })); a.download = `MrDre_ParaData_${currentDate}.csv`; a.click();
  };

  // ══════════════════════════════════════════════════════════
  // TOOLBOX CONFIG — config-driven, not hardcoded
  // ══════════════════════════════════════════════════════════
  const toolboxTools = [
    { id: "situations", label: "🧠 Situations", tip: "Pick a classroom situation and get instant recommended moves, support cards, and tools.", component: <SituationPicker onSelect={s => setSituationModal(s)} /> },
    { id: "quickactions", label: "⚡ Quick Actions", tip: "One-tap logging — pick an action then tap the student to log instantly.", component: <QuickActionPanel students={effectivePeriodStudents} studentsMap={allStudents} onLog={addLog} /> },
    { id: "cards", label: "📋 Support Cards", tip: "Step-by-step reference cards for common situations.", component: <SupportCardPanel /> },
    { id: "abc", label: "📊 ABC Builder", tip: "Build structured behavior records: Antecedent, Behavior, Consequence.", component: <ABCBuilder students={effectivePeriodStudents} studentsMap={allStudents} onSave={addLog} periodLabel={period.label} currentDate={currentDate} /> },
    { id: "goals", label: "🎯 Goal Tracker", tip: "Mark IEP goal progress for any student with one tap.", component: <GoalTracker students={effectivePeriodStudents} studentsMap={allStudents} onSave={addLog} /> },
    { id: "handoff", label: "📤 Handoff Notes", tip: "Write notes for the next para, teacher, or end-of-day.", component: <HandoffBuilder students={effectivePeriodStudents} studentsMap={allStudents} onSave={addLog} ollamaOnline={ollamaOnline} ollamaLoading={ollamaLoading} onOllamaHandoff={handleOllamaHandoff} /> },
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
  // RENDER — Dashboard
  // ══════════════════════════════════════════════════════════
  const renderDashboard = () => {
    const docSnippet = docContent ? parseDocForPeriod(docContent, period.label) : null;
    return (<>
      <div className="welcome-banner">
        <div><div style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: "2px" }}>Now Supporting</div><h2 style={{ margin: 0, fontSize: "20px" }}>{period.label}</h2><p style={{ margin: "4px 0 0", color: "var(--text-muted)", fontSize: "13px" }}>Teacher: <strong>{period.teacher}</strong> · <strong>{period.students.length}</strong> IEP students</p></div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <div style={{ display: "flex", gap: "4px", background: "#0f172a", borderRadius: "8px", padding: "3px" }}>
            <button onClick={() => setChatMode("period")} style={{ padding: "4px 10px", borderRadius: "6px", border: "none", cursor: "pointer", fontSize: "11px", background: chatMode === "period" ? "#3b82f6" : "transparent", color: chatMode === "period" ? "#fff" : "var(--text-muted)" }}>This Period</button>
            <button onClick={() => setChatMode("master")} style={{ padding: "4px 10px", borderRadius: "6px", border: "none", cursor: "pointer", fontSize: "11px", background: chatMode === "master" ? "#f59e0b" : "transparent", color: chatMode === "master" ? "#000" : "var(--text-muted)" }}>Master</button>
          </div>
          <div className="date-badge">{new Date(currentDate + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}</div>
        </div>
      </div>

      {/* Quick Actions Bar */}
      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "12px", padding: "0 2px" }}>
        {QUICK_ACTIONS.slice(0, 6).map(qa => (
          <Tip key={qa.id} text={qa.defaultNote} pos="bottom"><button onClick={() => setActiveToolbox("quickactions")} style={{ fontSize: "11px", padding: "5px 10px", borderRadius: "8px", border: "1px solid #1e293b", cursor: "pointer", background: "#0f172a", color: "#94a3b8", display: "flex", alignItems: "center", gap: "4px" }}>{qa.icon} {qa.label}</button></Tip>
        ))}
      </div>

      {docSnippet && (<div style={{ background: "#0c1a2e", border: "1px solid #1d4ed8", borderRadius: "10px", padding: "12px 16px", marginBottom: "12px", display: "flex", gap: "12px", alignItems: "flex-start" }}><span style={{ fontSize: "18px", flexShrink: 0 }}>📄</span><div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: "11px", color: "#60a5fa", fontWeight: "600", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: "4px" }}>Daily Briefing</div><div style={{ fontSize: "13px", color: "#93c5fd", lineHeight: "1.5", whiteSpace: "pre-wrap" }}>{docSnippet.slice(0, 300)}{docSnippet.length > 300 ? "..." : ""}</div></div><button onClick={() => setShowNoteDraft(true)} style={{ fontSize: "11px", background: "#1d4ed8", color: "#fff", border: "none", borderRadius: "6px", padding: "4px 10px", cursor: "pointer", flexShrink: 0 }}>+ Add Note</button></div>)}
      {!docSnippet && (<div style={{ background: "#1a1a0a", border: "1px solid #854d0e", borderRadius: "10px", padding: "10px 16px", marginBottom: "12px", display: "flex", gap: "10px", alignItems: "center" }}><span style={{ fontSize: "16px" }}>📝</span><div style={{ flex: 1, fontSize: "12px", color: "#fbbf24" }}>{docContent ? `No lesson data for ${period.label} yet.` : "No Class Notes loaded. Paste doc link or observe."}</div><button onClick={() => setShowNoteDraft(true)} style={{ fontSize: "11px", background: "#854d0e", color: "#fde68a", border: "none", borderRadius: "6px", padding: "4px 10px", cursor: "pointer", flexShrink: 0 }}>Build Note</button></div>)}

      <div className="dashboard-split" style={{ gridTemplateColumns: "1fr 340px", height: "calc(100vh - 260px)", minHeight: 0 }}>
        {/* Chat panel */}
        <div className="assistant-panel" style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div className="assistant-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
            <h3 style={{ margin: 0, fontSize: "15px" }}>{chatMode === "master" ? "Master Chat" : "Para Copilot"}{chatMode === "period" && <span style={{ fontSize: "11px", color: "#64748b", fontWeight: "400", marginLeft: "8px" }}>{period.label}</span>}</h3>
            <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
              <span style={{ fontSize: "10px", background: "#14532d", color: "#4ade80", padding: "2px 8px", borderRadius: "20px" }}>Engine</span>
              <OllamaStatusBadge online={ollamaOnline} modelName={ollamaModel} />
            </div>
          </div>
          <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--border)", background: "rgba(0,0,0,.15)", flexShrink: 0 }}>
            <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
              <span style={{ fontSize: "11px", color: "#64748b", whiteSpace: "nowrap" }}>Para Doc:</span>
              <input value={docLink} onChange={e => setDocLink(e.target.value)} placeholder="Paste shared Google Doc link..." style={{ flex: 1, padding: "5px 9px", background: "var(--bg-dark)", border: "1px solid var(--border)", borderRadius: "6px", color: "white", fontSize: "12px" }} />
              <button className="btn btn-secondary" style={{ fontSize: "12px", padding: "5px 10px", whiteSpace: "nowrap" }} onClick={fetchDoc} disabled={docLoading}>{docLoading ? "Fetching..." : "Fetch Doc"}</button>
              {docContent && <span style={{ fontSize: "11px", color: "#4ade80" }}>✓</span>}
            </div>
          </div>
          <div className="chat-window" style={{ flex: 1, overflowY: "auto" }}>
            {currentChat.map((msg, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: msg.sender === "user" ? "flex-end" : "flex-start", gap: "5px" }}>
                <div className={`chat-bubble ${msg.sender === "user" ? "user" : "app"}`}
                  style={msg.sender === "ai" ? { background: "#0d2010", color: "#86efac", border: "1px solid #166534" } : msg.sender === "ollama" ? { background: "#1e1b4b", color: "#c4b5fd", border: "1px solid #4c1d95" } : msg.isBundleNotice ? { background: "#1a1a2e", color: "#a78bfa", border: "1px solid #4c1d95", fontSize: "12px" } : msg.isBriefing ? { background: "#0c1a2e", color: "#93c5fd", border: "1px solid #1d4ed8" } : {}}>
                  {msg.sender === "ai" && <div style={{ fontSize: "10px", color: "#4ade80", fontWeight: "600", marginBottom: "4px" }}>✦ AI DEEP DIVE</div>}
                  {msg.sender === "ollama" && <div style={{ fontSize: "10px", color: "#a78bfa", fontWeight: "600", marginBottom: "4px" }}>✦ LOCAL AI — TEACHING SUGGESTIONS</div>}
                  {msg.isBundleNotice && <div style={{ fontSize: "10px", color: "#a78bfa", fontWeight: "600", marginBottom: "4px" }}>LOCAL AI READING CONTEXT</div>}
                  {msg.text}
                  {msg.followUp && <div style={{ marginTop: "8px", fontSize: "12px", color: "#60a5fa", fontStyle: "italic" }}>{msg.followUp}</div>}
                </div>
                {msg.sources?.length > 0 && (<div style={{ display: "flex", flexWrap: "wrap", gap: "4px", maxWidth: "90%" }}>{msg.sources.map((src, si) => (<span key={si} title={src.detail} style={{ fontSize: "10px", background: "#0f172a", color: "#64748b", border: "1px solid #1e293b", padding: "2px 8px", borderRadius: "20px" }}>{src.icon} {src.label}</span>))}</div>)}
                {msg.aiSources?.length > 0 && (<div style={{ display: "flex", flexWrap: "wrap", gap: "4px", maxWidth: "90%" }}><span style={{ fontSize: "10px", color: "#4ade80", marginRight: "4px" }}>AI used:</span>{msg.aiSources.map((src, si) => (<span key={si} style={{ fontSize: "10px", background: "#0d2010", color: "#4ade80", border: "1px solid #166534", padding: "2px 8px", borderRadius: "20px" }}>{src}</span>))}</div>)}
                {msg.recommendedCards?.length > 0 && (<div style={{ display: "flex", gap: "4px", flexWrap: "wrap", maxWidth: "90%" }}>{msg.recommendedCards.map(c => (<button key={c.id} onClick={() => setActiveToolbox("cards")} style={{ fontSize: "10px", background: "#0c1a2e", color: "#60a5fa", border: "1px solid #1d4ed8", padding: "3px 10px", borderRadius: "20px", cursor: "pointer" }}>📋 {c.title}</button>))}</div>)}
                {msg.actions?.length > 0 && (<div className="chat-actions" style={{ flexDirection: "row", flexWrap: "wrap" }}>{msg.actions.map((btn, bi) => (<button key={bi} className="btn btn-action" style={{ fontSize: "12px", padding: "5px 10px" }} onClick={() => { addLog(btn.studentId, btn.note, btn.type, { source: "engine" }); setCurrentChat(h => [...h, { sender: "app", text: `✅ Logged: ${btn.label}` }]); }}>{btn.label}</button>))}</div>)}
                {msg.needsNoteBuilding && (<button style={{ fontSize: "12px", background: "#1a1a0a", color: "#fbbf24", border: "1px solid #854d0e", borderRadius: "6px", padding: "5px 12px", cursor: "pointer" }} onClick={() => setShowNoteDraft(true)}>📝 Build class note →</button>)}
                {msg.showAI && (
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                    <button disabled={aiLoading || ollamaLoading} style={{ fontSize: "12px", background: "#0d1a2e", color: "#a78bfa", border: "1px solid #4c1d95", borderRadius: "6px", padding: "5px 12px", cursor: "pointer" }} onClick={() => askAI(msg.originalQuery)}>{aiLoading ? "✦ Thinking..." : "✦ Ask Local AI"}</button>
                    {ollamaOnline && msg.detectedSituations?.length > 0 && (
                      <button disabled={ollamaLoading || aiLoading} style={{ fontSize: "12px", background: "#1e1b4b", color: "#c4b5fd", border: "1px solid #6d28d9", borderRadius: "6px", padding: "5px 12px", cursor: "pointer" }} onClick={() => handleOllamaSuggestions(msg.originalQuery, msg.detectedSituations)}>{ollamaLoading ? "✦ Generating..." : "✦ Teaching Moves"}</button>
                    )}
                  </div>
                )}
              </div>
            ))}
            {aiLoading && <div style={{ color: "#4ade80", fontSize: "13px", fontStyle: "italic", padding: "8px 0" }}>✦ AI reading IEPs, KB, and logs...</div>}
            <div ref={chatEndRef} />
          </div>
          <form className="chat-input-area" onSubmit={handleChat} style={{ flexShrink: 0 }}>
            <input value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder={chatMode === "master" ? "Switch to period to chat..." : "e.g. 'doing decimals' or 'student escalating'..."} disabled={chatMode === "master"} style={{ flex: 1, padding: "9px 12px", background: "var(--bg-dark)", color: "white", border: "1px solid var(--border)", borderRadius: "6px", fontSize: "13px", fontFamily: "inherit" }} />
            <button type="submit" className="btn btn-primary" disabled={chatMode === "master"}>Send</button>
          </form>
          {showNoteDraft && (<div style={{ borderTop: "1px solid #854d0e", background: "#1a1a0a", padding: "12px", flexShrink: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}><span style={{ fontSize: "12px", fontWeight: "600", color: "#fbbf24" }}>📝 Draft — Class Notes 4 Paras</span><button onClick={() => setShowNoteDraft(false)} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: "16px" }}>×</button></div>
            <textarea value={noteDraft} onChange={e => setNoteDraft(e.target.value)} style={{ width: "100%", background: "#0f172a", border: "1px solid #854d0e", borderRadius: "6px", color: "#fde68a", padding: "8px", fontSize: "12px", resize: "none", height: "80px", fontFamily: "sans-serif" }} placeholder={`${period.label}\nLesson topic: ...\nStudent notes: ...`} />
            <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
              <button className="btn btn-primary" style={{ fontSize: "12px", padding: "5px 12px" }} onClick={() => { if (!noteDraft.trim()) return; addLog(period.students[0], `CLASS NOTE — ${period.label}: ${noteDraft}`, "Class Note"); pushNoteToDoc(noteDraft); setNoteDraft(""); setShowNoteDraft(false); }}>💾 Save + Push</button>
              <button className="btn btn-secondary" style={{ fontSize: "12px", padding: "5px 12px" }} onClick={() => { if (noteDraft.trim()) askAI(`Help expand this class note: "${noteDraft}". Include IEP-based student needs.`); }}>✦ AI Expand</button>
            </div>
          </div>)}
        </div>
        {/* Caseload matrix */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", overflow: "hidden" }}>
          <div className="panel" style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", padding: 0 }}>
            <div style={{ padding: "11px 14px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
              <strong style={{ fontSize: "13px" }}>Caseload Matrix</strong>
              <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Click for profile</span>
            </div>
            <div style={{ overflowY: "auto", flex: 1, padding: "8px" }}>
              {effectivePeriodStudents.map(id => { const s = allStudents[id]; if (!s) return null; const health = getHealth(id, logs, currentDate); return (
                <div key={id} className="student-card-small" style={{ marginBottom: "8px", borderLeft: `3px solid ${s.color}`, cursor: "pointer" }} onClick={() => setProfileStu(id)}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "3px" }}><span style={{ fontWeight: "700", fontSize: "13px", color: s.color }}>{s.pseudonym}</span><span>{hdot(health)}</span></div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "5px" }}>{s.eligibility}</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "3px", marginBottom: "6px" }}>{s.accs.slice(0, 3).map(a => <span key={a} style={{ fontSize: "10px", background: "#1e3a5f", color: "#93c5fd", padding: "2px 6px", borderRadius: "20px" }}>{a}</span>)}{s.accs.length > 3 && <span style={{ fontSize: "10px", color: "#64748b" }}>+{s.accs.length - 3}</span>}</div>
                  <div style={{ fontSize: "11px", color: "#4ade80" }}>Goals: {(s.goals || []).length} · Logs: {logs.filter(l => l.studentId === id).length}</div>
                </div>
              ); })}
            </div>
          </div>
        </div>
      </div>
    </>);
  };

  // ══════════════════════════════════════════════════════════
  // RENDER — Vault (keeping compact since structure didn't change)
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
      <div className="header"><div><h1>Data Vault</h1><p className="teacher-subtitle">{logs.length} observations · {knowledgeBase.length} KB docs · FERPA-safe</p></div><div style={{ display: "flex", gap: "8px" }}><button className="btn btn-secondary" onClick={() => exportCSV(filteredLogs)}>Export Filtered</button><button className="btn btn-primary" onClick={() => exportCSV()}>Export All</button></div></div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "12px", marginBottom: "20px" }}>{[{ h: "green", label: "Logged today", color: "var(--green)", border: "#166534" }, { h: "yellow", label: "This week", color: "var(--yellow)", border: "#854d0e" }, { h: "red", label: "Needs attention", color: "var(--red)", border: "#7f1d1d" }].map(({ h, label, color, border }) => (<div key={h} className="panel" style={{ padding: "14px 16px", borderColor: border }}><div style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "4px" }}>{label}</div><div style={{ fontSize: "28px", fontWeight: "700", color }}>{counts[h]}</div><div style={{ fontSize: "12px", color: "var(--text-muted)" }}>student{counts[h] !== 1 ? "s" : ""}</div></div>))}</div>
      <div style={{ display: "flex", gap: "4px", marginBottom: "16px", flexWrap: "wrap" }}>{vaultTabs.map(t => (<button key={t.id} onClick={() => { setVaultTab(t.id); setVaultFilter("all"); }} style={{ padding: "6px 14px", borderRadius: "6px", border: "none", cursor: "pointer", fontSize: "12px", fontWeight: "500", background: vaultTab === t.id ? "#1d4ed8" : "var(--panel-bg)", color: vaultTab === t.id ? "#fff" : "var(--text-muted)" }}>{t.label}</button>))}</div>
      {(vaultTab === "byStudent" || vaultTab === "byPeriod") && (<div style={{ marginBottom: "14px", display: "flex", gap: "8px", alignItems: "center" }}><span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Filter:</span><select value={vaultFilter} onChange={e => setVaultFilter(e.target.value)} className="period-select" style={{ maxWidth: "280px" }}><option value="all">All</option>{vaultTab === "byStudent" && Object.entries(allStudents).map(([id, s]) => (<option key={id} value={id}>{s.pseudonym} ({logs.filter(l => l.studentId === id).length})</option>))}{vaultTab === "byPeriod" && Object.entries(DB.periods).map(([id, p]) => (<option key={id} value={id}>{p.label}</option>))}</select></div>)}
      {vaultTab === "knowledge" && (<div>
        <div className="panel" style={{ padding: "16px", marginBottom: "16px" }}>
          <h3 style={{ margin: "0 0 4px", fontSize: "14px", color: "var(--accent)" }}>Add to Knowledge Base</h3>
          <p style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "12px" }}>AI uses everything in here.</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "8px" }}>
            <div><label style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>Title</label><input value={kbTitle} onChange={e => setKbTitle(e.target.value)} placeholder="e.g. Decimal Strategies" style={{ width: "100%", padding: "8px 10px", background: "var(--bg-dark)", border: "1px solid var(--border)", borderRadius: "6px", color: "white", fontSize: "13px" }} /></div>
            <div><label style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>Type</label><select value={kbDocType} onChange={e => setKbDocType(e.target.value)} className="period-select" style={{ width: "100%" }}><option>Teaching Strategy</option><option>Lesson Plan</option><option>IEP Document</option><option>My Own Notes</option><option>Para Team Notes</option><option>Other</option></select></div>
          </div>
          <textarea value={kbInput} onChange={e => setKbInput(e.target.value)} className="data-textarea" style={{ height: "100px" }} placeholder="Paste content or upload below..." />
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
            <button className="btn btn-primary" onClick={() => addToKB(activePeriod)}>+ Add for {period.label}</button>
            <button className="btn btn-secondary" onClick={() => addToKB("all")}>+ Add for All</button>
            <input type="file" ref={fileInputRef} style={{ display: "none" }} accept=".pdf,.txt,.doc,.docx" onChange={e => handleFileUpload(e, activePeriod)} />
            <button className="btn btn-secondary" style={{ background: "#1e3a5f", color: "#93c5fd", border: "1px solid #1d4ed8" }} onClick={() => fileInputRef.current?.click()} disabled={kbUploading}>{kbUploading ? "Extracting..." : "📎 Upload"}</button>
          </div>
        </div>
        {knowledgeBase.length === 0 ? <div className="empty-doc">No documents yet.</div> : (<div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {knowledgeBase.map(doc => (<div key={doc.id} className="panel" style={{ padding: "14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "6px" }}>
              <div><div style={{ fontWeight: "600", fontSize: "14px", color: "var(--accent)", marginBottom: "4px" }}>{doc.title}</div><div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}><span style={{ fontSize: "10px", background: "#1e293b", color: "#f59e0b", padding: "2px 8px", borderRadius: "20px", border: "1px solid #854d0e" }}>{doc.docType}</span><span style={{ fontSize: "10px", background: "#1e3a5f", color: "#93c5fd", padding: "2px 8px", borderRadius: "20px" }}>{doc.period === "all" ? "All Periods" : DB.periods[doc.period]?.label || doc.period}</span></div></div>
              <button onClick={() => setKnowledgeBase(prev => prev.filter(d => d.id !== doc.id))} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: "16px" }}>×</button>
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
      <BrandHeader right={<OllamaStatusBadge online={ollamaOnline} model={ollamaModel} />} />

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
      {/* Private Roster Panel — local-only, never stored or exported */}
      {rosterPanelOpen && (
        <RosterPanel
          onClose={() => setRosterPanelOpen(false)}
          allStudents={allStudents}
          identityRegistry={identityRegistry}
          activePeriod={activePeriod}
          onIdentityLoad={handleIdentityLoad}
          onClearRoster={() => setIdentityRegistry([])}
        />
      )}

    <div className="app-layout" style={{ flex: 1, minWidth: 0 }}>
      <aside className="sidebar">
        <div className="brand" style={{ fontSize: "11px", color: "#1e3a5f", padding: "0 4px 10px", marginBottom: "2px" }}>v2</div>
        <div className="sidebar-control"><label>Date</label><input type="date" className="period-select" style={{ width: "100%", marginTop: "4px" }} value={currentDate} onChange={e => setCurrentDate(e.target.value)} /></div>
        <div className="sidebar-control"><label>Active Period</label><select className="period-select" style={{ width: "100%", marginTop: "4px" }} value={activePeriod} onChange={e => setActivePeriod(e.target.value)}>{Object.entries(DB.periods).map(([id, p]) => (<option key={id} value={id}>{p.label}</option>))}</select></div>
        <div style={{ marginTop: "8px" }}>
          <div style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: "6px", padding: "0 4px" }}>Navigation</div>
          {[{ id: "dashboard", label: "📊 Dashboard", tip: "Main copilot view" }, { id: "vault", label: "🗄️ Data Vault", tip: "All logs, flagged items, knowledge base" }, { id: "import", label: "📥 IEP Import", tip: "Upload IEPs or paste student documents — converted to FERPA-safe structured student profiles automatically" }, { id: "analytics", label: "📈 Analytics", tip: "Visual data dashboard with custom date ranges and groups" }].map(({ id, label, tip }) => (
            <Tip key={id} text={tip} pos="right"><button className={`nav-btn${view === id ? " active" : ""}`} onClick={() => setView(id)}>{label}</button></Tip>
          ))}
        </div>
        <div style={{ marginTop: "16px" }}>
          <div style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: "6px", padding: "0 4px" }}>Toolbox <span style={{ color: "#334155", fontWeight: "400", textTransform: "none" }}>(dbl-click = pop out)</span></div>
          {toolboxTools.map(t => (
            <Tip key={t.id} text={t.tip} pos="right"><button className="nav-btn" style={activeToolbox === t.id ? { background: "#1e3a5f", color: "#93c5fd" } : {}}
              onClick={() => setActiveToolbox(activeToolbox === t.id ? null : t.id)}
              onDoubleClick={(e) => { e.preventDefault(); setActiveToolbox(null); if (!floatingTools.includes(t.id)) setFloatingTools(prev => [...prev, t.id]); }}
            >{t.label}</button></Tip>
          ))}
        </div>
        <div style={{ marginTop: "auto", paddingTop: "16px", borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: "6px" }}>
          <Tip text="Hide all student data. Screen shows only classroom tools." pos="right">
            <button onClick={() => setStealthMode(true)} style={{ width: "100%", padding: "6px", borderRadius: "6px", border: "1px solid #7f1d1d", background: "#1a0505", color: "#f87171", cursor: "pointer", fontSize: "11px", fontWeight: "600" }}>🛡️ Stealth Mode</button>
          </Tip>
          <Tip text="Simplified note-taking for paras. Large buttons, plain language — advanced processing runs in the background." pos="right">
            <button onClick={() => setSimpleMode(!simpleMode)} style={{ width: "100%", padding: "7px", borderRadius: "6px", border: `1px solid ${simpleMode ? "#166534" : "#334155"}`, background: simpleMode ? "#14532d" : "transparent", color: simpleMode ? "#4ade80" : "#64748b", cursor: "pointer", fontSize: "11px", fontWeight: "600" }}>
              {simpleMode ? "✓ Para Notes Mode" : "📝 Para Notes Mode"}
            </button>
          </Tip>
          <Tip text="Private local reference panel for real student and class names. Never stored or exported." pos="right">
            <button onClick={() => setRosterPanelOpen(!rosterPanelOpen)} style={{ width: "100%", padding: "7px", borderRadius: "6px", border: `1px solid ${rosterPanelOpen ? "#1d4ed8" : "#334155"}`, background: rosterPanelOpen ? "#1e3a5f" : "transparent", color: rosterPanelOpen ? "#93c5fd" : "#64748b", cursor: "pointer", fontSize: "11px", fontWeight: "600" }}>
              {rosterPanelOpen ? "✓ Private Roster" : "👤 Private Roster"}
            </button>
          </Tip>
          <div style={{ fontSize: "11px", color: "#334155", textAlign: "center", lineHeight: "1.8" }}>FERPA-Safe — Pseudonyms only</div>
        </div>
      </aside>

      <main className="main-content" style={{ flex: 1, overflowY: simpleMode ? "hidden" : "auto", padding: simpleMode ? 0 : undefined }}>
        {simpleMode
          ? <SimpleMode
              activePeriod={activePeriod}
              setActivePeriod={setActivePeriod}
              logs={logs}
              addLog={addLog}
              currentDate={currentDate}
            />
          : <>
              {view === "dashboard" && (
                <Dashboard
                  period={period} activePeriod={activePeriod}
                  effectivePeriodStudents={effectivePeriodStudents} allStudents={allStudents}
                  logs={logs} addLog={addLog} currentDate={currentDate}
                  ollamaOnline={ollamaOnline} ollamaModel={ollamaModel} ollamaLoading={ollamaLoading}
                  askAI={askAI} aiLoading={aiLoading} handleOllamaSuggestions={handleOllamaSuggestions}
                  currentChat={currentChat} chatInput={chatInput} setChatInput={setChatInput}
                  handleChat={handleChat} chatMode={chatMode} setChatMode={setChatMode}
                  chatEndRef={chatEndRef}
                  docContent={docContent} docLink={docLink} setDocLink={setDocLink}
                  fetchDoc={fetchDoc} docLoading={docLoading}
                  setProfileStu={setProfileStu}
                />
              )}
              {view === "vault" && renderVault()}
              {view === "import" && <IEPImport onImport={handleImport} onBulkImport={handleBundleImport} onIdentityLoad={handleIdentityLoad} importedCount={Object.keys(importedStudents).length} />}
              {view === "analytics" && <AnalyticsDashboard logs={logs} groups={groups} setGroups={setGroups} onOpenProfile={setProfileStu} ollamaOnline={ollamaOnline} ollamaLoading={ollamaLoading} onOllamaPatternSummary={handleOllamaPatternSummary} />}
            </>
        }
      </main>

      {/* Sidebar tool panel */}
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

      {/* Modals */}
      {profileStu && (<StudentProfileModal studentId={profileStu} studentData={allStudents[profileStu]} logs={logs} currentDate={currentDate} onClose={() => setProfileStu(null)} onLog={addLog} onDraftEmail={(id) => { setProfileStu(null); draftEmail(id); }} />)}
      {emailModal && (<EmailModal studentId={emailModal.studentId} studentData={allStudents[emailModal.studentId]} emailLoading={emailLoading} emailDraft={emailDraft} setEmailDraft={setEmailDraft} onClose={() => { setEmailModal(null); setEmailDraft(""); }} />)}
      {situationModal && (<SituationResponseModal situation={situationModal} students={effectivePeriodStudents} studentsMap={allStudents} onClose={() => setSituationModal(null)} onLog={(id, note, type) => addLog(id, note, type)} onOpenCard={() => { setSituationModal(null); setActiveToolbox("cards"); }} />)}
      {ollamaModal && (<OllamaInsightModal feature={ollamaModal.feature} text={ollamaModal.text} studentId={ollamaModal.studentId} onClose={() => setOllamaModal(null)} onLog={addLog} />)}

      {/* Floating tool windows */}
      {floatingTools.map(tid => { const t = toolboxTools.find(x => x.id === tid); return t ? <FloatingToolWindow key={tid} tool={t} onClose={() => setFloatingTools(prev => prev.filter(x => x !== tid))} onFullscreen={() => { setFullscreenTool(tid); setFloatingTools(prev => prev.filter(x => x !== tid)); }} onDock={() => { setFloatingTools(prev => prev.filter(x => x !== tid)); setActiveToolbox(tid); }} /> : null; })}

      {/* Fullscreen & Stealth overlays */}
      {fullscreenTool && (<FullscreenTool tool={toolboxTools.find(t => t.id === fullscreenTool) || toolboxTools[0]} onClose={() => setFullscreenTool(null)} />)}
      {stealthMode && (<StealthScreen activeTool={stealthTool} toolboxTools={toolboxTools} onSelectTool={setStealthTool} onExit={() => setStealthMode(false)} />)}
    </div>
    </div>
    </div>
  );
}
