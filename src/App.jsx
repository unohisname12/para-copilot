// ══════════════════════════════════════════════════════════════
// APP.JSX — Orchestrator
// Imports everything, manages state, wires it together.
// ══════════════════════════════════════════════════════════════
import React, { useState, useRef } from "react";
import BulkDeleteBar from './components/vault/BulkDeleteBar';
import { useLocalStorage } from './hooks/useLocalStorage';
import "./styles/styles.css";

// Data layer
import { DB, QUICK_ACTIONS } from './data';

// Engine + Model layer
import { isHelpWorthy, parseDocForPeriod } from './engine';
import { classifyNoteForFollowUp } from './engine/aiProvider';
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
import { useFollowUps } from './hooks/useFollowUps';

// Utilities
import { exportCSV, exportCSVPrivate } from './utils/exportCSV';
import { resolveStudentByParaAppNumber } from './features/roster/rosterUtils';
import { logsInLastHours } from './features/analytics/getStudentPatterns';

// Components
import { VisualTimer, CalculatorTool, MultChart, CEROrganizer, BreathingExercise, GroundingExercise } from './components/tools';
import { SupportCardPanel, QuickActionPanel, ABCBuilder, GoalTracker, HandoffBuilder, ParaChecklist, StrategyLibrary, SituationPicker, TrainingGapPanel } from './components/panels';
import { StudentProfileModal, EmailModal, SituationResponseModal, OllamaInsightModal } from './components/modals';
import { Tip, FloatingToolWindow, FullscreenTool, StealthScreen, RosterPanel } from './components/windows';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { SimpleMode } from './components/SimpleMode';
import { IEPImport } from './components/IEPImport';
import { OllamaStatusBadge } from './components/OllamaStatusBadge';
import { Dashboard } from './components/Dashboard';
import { BrandHeader } from './components/BrandHeader';
import TeamSwitcher from './components/TeamSwitcher';
import HandoffInbox from './components/HandoffInbox';
import OnboardingModal, { hasSeenOnboarding } from './components/OnboardingModal';
import { usePrivacyMode } from './hooks/usePrivacyMode';
import AdminDashboard from './components/AdminDashboard';
import BugReportButton from './components/BugReportButton';
import FindMyStudentsModal from './components/FindMyStudentsModal';
import SettingsModal, { isFindStudentsBannerHidden } from './components/SettingsModal';
import { LegacyImportModal } from './features/import/LegacyImportModal';
import { FollowUpPrompt, FollowUpsPanel } from './features/help';
import { claimPendingAssignments } from './services/paraAssignments';
import SubLockedScreen from './components/SubLockedScreen';
import { VaultProvider, useVault, enrichStudentsWithNames } from './context/VaultProvider';
import { useTeamOptional } from './context/TeamProvider';
import { getSidebarVisibility } from './utils/sidebarVisibility';

// Cloud layer — runs only when Supabase is configured. Offline install works unchanged.
import { supabaseConfigured } from './services/supabaseClient';
import { TeamProvider, useTeam } from './context/TeamProvider';
import SignInScreen from './components/SignInScreen';
import TeamOnboardingModal from './components/TeamOnboardingModal';

// ── Vault helpers (presentational, reusable) ─────────────────────────
function SortableHeader({ col, label, sort, onSort }) {
  const active = sort.col === col;
  const arrow = active ? (sort.dir === "asc" ? " ↑" : " ↓") : "";
  return (
    <th
      onClick={() => onSort({
        col,
        dir: active && sort.dir === "desc" ? "asc" : "desc",
      })}
      style={{ cursor: "pointer", userSelect: "none", color: active ? "var(--accent-hover)" : undefined }}
      title={`Sort by ${label.toLowerCase()}`}
    >
      {label}{arrow}
    </th>
  );
}
function LogDetailCell({ label, children }) {
  return (
    <div>
      <div style={{
        fontSize: 10, fontWeight: 700, textTransform: "uppercase",
        letterSpacing: "0.1em", color: "var(--text-muted)", marginBottom: 3,
      }}>{label}</div>
      <div>{children}</div>
    </div>
  );
}

export default function App() {
  if (!supabaseConfigured) {
    // No cloud env — skip auth, run fully local as before.
    return <AppCore />;
  }
  return (
    <TeamProvider>
      <CloudGate>
        <AppCore />
      </CloudGate>
    </TeamProvider>
  );
}

function CloudGate({ children }) {
  const { authReady, session, teams, teamsLoading, subLockedOut } = useTeam();
  const [stuck, setStuck] = React.useState(false);
  // Auto-claim any pending email assignments the moment a session is live.
  // Idempotent — safe to fire on every sign-in.
  React.useEffect(() => {
    if (session) { claimPendingAssignments().catch(() => {}); }
  }, [session?.user?.id]);
  // If sign-in or team load takes longer than 10s, show a recovery option.
  React.useEffect(() => {
    if (authReady && !teamsLoading) { setStuck(false); return; }
    const t = setTimeout(() => setStuck(true), 10000);
    return () => clearTimeout(t);
  }, [authReady, teamsLoading]);
  const StuckScreen = ({ what }) => (
    <div style={{ padding: 40, color: 'white', background: '#04080f', minHeight: '100vh' }}>
      <div style={{ maxWidth: 420 }}>
        <div style={{ fontSize: 14, marginBottom: 8 }}>{what}</div>
        <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.55, marginBottom: 16 }}>
          This is taking longer than usual. Check your internet, then try reloading.
        </div>
        <button onClick={() => window.location.reload()} className="btn btn-primary" style={{ fontSize: 12 }}>
          Reload
        </button>
      </div>
    </div>
  );
  if (!authReady) {
    return stuck
      ? <StuckScreen what="Still signing you in…" />
      : <div style={{ padding: 40, color: 'white', background: '#04080f', minHeight: '100vh' }}>Loading…</div>;
  }
  if (!session) return <SignInScreen />;
  if (teamsLoading) {
    return stuck
      ? <StuckScreen what="Still loading your teams…" />
      : <div style={{ padding: 40, color: 'white', background: '#04080f', minHeight: '100vh' }}>Loading your teams…</div>;
  }
  if (teams.length === 0) return <TeamOnboardingModal mustChoose />;
  if (subLockedOut) return <SubLockedScreen />;
  return children;
}

function AppCore() {
  const today = new Date(), localISO = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().split("T")[0];
  // currentDate stays in plain useState — it should default to today on each
  // reload (paras work in "today" 99% of the time), even if they navigated
  // to a different date in the previous session.
  const [currentDate, setCurrentDate] = useState(localISO);
  // activePeriod persists so you come back to the period you were last in
  // — paras switch periods all day; resetting to a default is annoying.
  const [activePeriod, setActivePeriod] = useLocalStorage("paraActivePeriodV1", "p3");
  const period = DB.periods[activePeriod];

  return (
    <OllamaProvider>
      <StudentsProvider activePeriod={activePeriod}>
        <VaultBridge>
          <LogsProvider currentDate={currentDate} periodLabel={period.label} activePeriod={activePeriod}>
            <AppShell
              currentDate={currentDate} setCurrentDate={setCurrentDate}
              activePeriod={activePeriod} setActivePeriod={setActivePeriod}
              period={period}
            />
          </LogsProvider>
        </VaultBridge>
      </StudentsProvider>
    </OllamaProvider>
  );
}

// Bridge: reads identityRegistry from StudentsContext and hands it to VaultProvider.
// Lets VaultProvider sit in the tree without StudentsProvider needing to know about it.
function VaultBridge({ children }) {
  const students = useStudentsContext();
  return (
    <VaultProvider
      identityRegistry={students.identityRegistry}
      onPurgeIdentityRegistry={() => students.setIdentityRegistry([])}
    >
      {children}
    </VaultProvider>
  );
}

function AppShell({ currentDate, setCurrentDate, activePeriod, setActivePeriod, period }) {
  // view + simpleMode persist across reload so you don't lose your spot when
  // a school computer reloads the tab unexpectedly.
  const [view, setView] = useLocalStorage("paraLastViewV1", "dashboard");
  const [simpleMode, setSimpleMode] = useLocalStorage("paraSimpleModeV1", false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [findStudentsOpen, setFindStudentsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [bannerHiddenAlways, setBannerHiddenAlways] = useState(() => isFindStudentsBannerHidden());
  const [onboardingOpen, setOnboardingOpen] = useState(() => !hasSeenOnboarding());
  const [sampleDataClearedToast, setSampleDataClearedToast] = useState(false);

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
  const { allStudents: allStudentsRaw, effectivePeriodStudents, identityRegistry } = students;
  const { logs, addLog, toggleFlag, deleteLog, bulkDeleteLogs, restoreLogs, updateLogText, loadDemoLogs, clearDemoLogs } = logsBag;

  const [selectedLogIds, setSelectedLogIds] = useState(() => new Set());
  const [undoSnapshot, setUndoSnapshot] = useState(null);
  const undoTimerRef = useRef(null);

  const toggleLogSelection = (id) => {
    setSelectedLogIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const clearLogSelection = () => setSelectedLogIds(new Set());
  const confirmBulkDelete = () => {
    if (selectedLogIds.size === 0) return;
    if (!window.confirm(`Delete ${selectedLogIds.size} log entries? Undo available for 10 seconds.`)) return;
    const removed = bulkDeleteLogs(selectedLogIds);
    clearLogSelection();
    setUndoSnapshot(removed);
    clearTimeout(undoTimerRef.current);
    undoTimerRef.current = setTimeout(() => setUndoSnapshot(null), 10000);
  };
  const undoBulkDelete = () => {
    if (!undoSnapshot) return;
    restoreLogs(undoSnapshot);
    setUndoSnapshot(null);
    clearTimeout(undoTimerRef.current);
  };
  const { knowledgeBase } = kb;

  // Vault enrichment — when user flips "Show real names" ON and the vault has
  // a match on paraAppNumber, each student gets a `realName` field that
  // getStudentLabel / resolveLabel prefer. No changes needed at call sites.
  const vaultCtx = useVault();
  // Team context (optional — null in offline-only mode). Used to gate the
  // admin nav + the sub-locked-out screen.
  const teamCtx = useTeamOptional();
  const allStudents = React.useMemo(
    () => enrichStudentsWithNames(allStudentsRaw, vaultCtx.vault, vaultCtx.showRealNames),
    [allStudentsRaw, vaultCtx.vault, vaultCtx.showRealNames]
  );

  // ── vaultLogs ──────────────────────────────────────────────
  // Merged log set: local paraLogsV1 + cloud-shared logs adapted into the
  // local log shape. Hoisted out of renderVault so the StudentProfileModal,
  // health badges, and analytics see the same set the Vault does — without
  // it, opening a kid's profile after a local clear shows "Logs (1)" while
  // the Vault correctly shows N.
  //
  // For each cloud row, resolve studentId via paraAppNumber when the FK
  // doesn't match anything local (rosterReconnect bridge at the log layer).
  const vaultLogs = React.useMemo(() => {
    const localFingerprints = new Set(
      (logs || []).map(l => `${l.studentId}__${l.timestamp}`)
    );
    const sharedAdapted = (teamCtx?.sharedLogs || [])
      .filter(l => l && !localFingerprints.has(`${l.student_id}__${l.timestamp}`))
      .map(l => {
        const cloudStudentId = l.student_id;
        const paraAppNumber = l.external_key || null;
        const stuByDirectId = cloudStudentId ? allStudents[cloudStudentId] : null;
        const stuByParaAppNumber = !stuByDirectId
          ? resolveStudentByParaAppNumber(allStudents, paraAppNumber)
          : null;
        const resolvedStudentId =
          (stuByDirectId && cloudStudentId)
          || (stuByParaAppNumber && stuByParaAppNumber.id)
          || cloudStudentId
          || null;
        return {
          id: l.id,
          studentId: resolvedStudentId,
          paraAppNumber,
          type: l.type,
          category: l.category,
          note: l.note,
          date: l.date,
          period: l.period_id,
          periodId: l.period_id,
          timestamp: l.timestamp,
          tags: l.tags || [],
          flagged: Boolean(l.flagged),
          source: l.source || 'cloud_sync',
          situationId: l.situation_id,
          strategyUsed: l.strategy_used,
          goalId: l.goal_id,
          sharedFromTeammate: l.user_id !== teamCtx?.user?.id,
        };
      });
    return sharedAdapted.length ? [...(logs || []), ...sharedAdapted] : (logs || []);
  }, [logs, teamCtx?.sharedLogs, teamCtx?.user?.id, allStudents]);

  // Auto-clear sample data when real students come in. demoMode flips to
  // false inside useStudents on any handleImport / handleBundleImport call.
  // This watches that flip and wipes the seeded demo logs + case memory so
  // the user doesn't see stale "Orange Student 1 covered ears" next to
  // their real kids. Surgical — only touches records tagged as demo
  // (IDs prefixed inc_demo_ / intv_demo_ / out_demo_, logs with
  // source: "demo"). Does NOT touch anything the user produced.
  const prevDemoModeRef = React.useRef(students.demoMode);
  React.useEffect(() => {
    if (prevDemoModeRef.current && !students.demoMode) {
      const demoLogCount = (logsBag.logs || []).filter(l => l.source === 'demo').length;
      const demoCaseCount =
        (caseMemory.incidents || []).filter(i => String(i.id || '').startsWith('inc_demo_')).length +
        (caseMemory.interventions || []).filter(i => String(i.id || '').startsWith('intv_demo_')).length +
        (caseMemory.outcomes || []).filter(o => String(o.id || '').startsWith('out_demo_')).length;
      logsBag.clearDemoLogs();
      if (caseMemory.clearDemoOnly) caseMemory.clearDemoOnly();
      if (demoLogCount + demoCaseCount > 0) {
        setSampleDataClearedToast(true);
        setTimeout(() => setSampleDataClearedToast(false), 4200);
      }
    }
    prevDemoModeRef.current = students.demoMode;
    // Intentionally only depend on demoMode — we want this to fire once
    // on the transition, not every time logs or case memory update.
  }, [students.demoMode]);

  // One-time mount sweep: if demoMode is already false (e.g. user closed
  // the tab after importing real students), the transition effect above
  // never fires on the next reload — so any source:'demo' logs that were
  // written previously linger in localStorage forever. This catches that
  // stale state once at boot.
  React.useEffect(() => {
    if (students.demoMode) return;
    const hasStaleDemoLogs = (logsBag.logs || []).some(l => l.source === 'demo');
    const hasStaleDemoCase =
      (caseMemory.incidents || []).some(i => String(i.id || '').startsWith('inc_demo_')) ||
      (caseMemory.interventions || []).some(i => String(i.id || '').startsWith('intv_demo_')) ||
      (caseMemory.outcomes || []).some(o => String(o.id || '').startsWith('out_demo_'));
    if (hasStaleDemoLogs) logsBag.clearDemoLogs();
    if (hasStaleDemoCase && caseMemory.clearDemoOnly) caseMemory.clearDemoOnly();
    if (hasStaleDemoLogs || hasStaleDemoCase) {
      setSampleDataClearedToast(true);
      setTimeout(() => setSampleDataClearedToast(false), 4200);
    }
    // Run once at mount; deliberately empty deps.
    // eslint-disable-next-line
  }, []);

  // ── UI state ───────────────────────────────────────────────
  const [profileStu, setProfileStu] = useState(null);
  const [legacyImportOpen, setLegacyImportOpen] = useState(false);
  const [activeToolbox, setActiveToolbox] = useState(null);
  const [floatingTools, setFloatingTools] = useState([]);
  const [fullscreenTool, setFullscreenTool] = useState(null);
  const [stealthMode, setStealthMode] = useState(false);
  const [stealthPinNudge, setStealthPinNudge] = useState(false);
  const [stealthTool, setStealthTool] = useState("timer");
  const [situationModal, setSituationModal] = useState(null);
  const [groups, setGroups] = useState([]);
  const { on: privacyOn, toggle: togglePrivacy } = usePrivacyMode();
  const [planPanelOpen, setPlanPanelOpen] = useLocalStorage('planPanelOpenV1', true);

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
  const followUps = useFollowUps();
  const [activeFollowUpId, setActiveFollowUpId] = useState(null);

  const activeFollowUp = activeFollowUpId
    ? followUps.pendingFollowUps.find(f => f.id === activeFollowUpId)
    : null;
  const activeFollowUpIncident = activeFollowUp
    ? caseMemory.incidents.find(i => i.id === activeFollowUp.incidentId)
    : null;
  const activeFollowUpIntervention = activeFollowUp
    ? caseMemory.interventions.find(i => i.id === activeFollowUp.interventionId)
    : null;
  const activeFollowUpStudent = activeFollowUp
    ? allStudents[activeFollowUp.studentId]
    : null;

  const openFollowUpsPanel = () => {
    setActiveToolbox("followups");
  };

  const openNextDueFollowUp = () => {
    const next = followUps.dueFollowUps.find(f => allStudents[f.studentId]);
    if (next) setActiveFollowUpId(next.id);
  };

  const handleFollowUpAnswer = (followUp, data) => {
    if (data.kind === 'intervention') {
      const incident = caseMemory.incidents.find(i => i.id === followUp.incidentId);
      if (!incident) return;
      const intv = caseMemory.addIntervention({
        incidentId: followUp.incidentId,
        studentId: followUp.studentId,
        staffNote: data.staffNote,
        source: 'follow_up',
      });
      addLog(followUp.studentId, `[Follow-up] Tried: ${data.staffNote}`, 'Intervention', {
        source: 'follow_up',
        tags: ['follow_up', 'help_intervention'],
        incidentId: followUp.incidentId,
        interventionId: intv.id,
      });
      followUps.markAnswered(followUp.id);
      followUps.scheduleFollowUp({
        incident,
        intervention: intv,
        currentDate: followUp.currentDate || currentDate,
        activePeriod: followUp.activePeriod || activePeriod,
      });
      setActiveFollowUpId(null);
      return;
    }

    const out = caseMemory.addOutcome({
      interventionId: followUp.interventionId,
      incidentId: followUp.incidentId,
      studentId: followUp.studentId,
      result: data.result,
      studentResponse: data.studentResponse || '',
      wouldRepeat: data.wouldRepeat,
    });
    const resultLabel = data.result === 'worked'
      ? 'helped'
      : data.result === 'failed'
        ? 'got worse'
        : data.result === 'partly'
          ? 'no change yet'
          : 'not sure';
    addLog(followUp.studentId, `[Follow-up] ${resultLabel}${data.studentResponse ? ' — ' + data.studentResponse : ''}`, 'Outcome', {
      source: 'follow_up',
      tags: ['follow_up', 'help_outcome'],
      incidentId: followUp.incidentId,
      interventionId: followUp.interventionId,
      outcomeId: out.id,
    });
    followUps.markAnswered(followUp.id);
    setActiveFollowUpId(null);
  };

  const handleFollowUpSnooze = (id, minutes = 15) => {
    followUps.snooze(id, minutes);
    setActiveFollowUpId(null);
  };

  const handleFollowUpDismiss = (id) => {
    followUps.dismiss(id);
    setActiveFollowUpId(null);
  };

  const seenLogIdsForFollowUps = React.useRef(new Set((logs || []).map(l => l.id)));
  React.useEffect(() => {
    const seen = seenLogIdsForFollowUps.current;
    (logs || []).forEach(log => {
      if (!log?.id || seen.has(log.id)) return;
      seen.add(log.id);
      if (!log.studentId || log.source === 'follow_up') return;
      if (['Intervention', 'Outcome', 'Handoff Note', 'Class Note'].includes(log.type)) return;
      const note = log.note || log.text || '';
      const scheduleAutoFollowUp = (ai = null) => {
        const incident = caseMemory.addIncident({
          studentId: log.studentId,
          description: note,
          date: log.date || currentDate,
          periodId: log.periodId || activePeriod,
          category: ai?.category || (/academic|goal|assignment|work/i.test(`${log.type} ${note}`) ? 'academic' : 'behavior'),
          tags: ['auto_follow_up', ...(ai?.reason ? [`ai_${ai.reason}`] : [])],
          source: ai ? 'ai_note_classifier' : 'auto_note',
          paraAppNumber: log.paraAppNumber || null,
        });
        followUps.scheduleFollowUp({
          incident: { ...incident, logIds: [log.id], paraAppNumber: log.paraAppNumber || null },
          intervention: null,
          currentDate: log.date || currentDate,
          activePeriod: log.periodId || activePeriod,
          needsIntervention: ai?.askWhatTriedNow ?? true,
        });
      };

      if (isHelpWorthy(note)) {
        scheduleAutoFollowUp();
        return;
      }

      classifyNoteForFollowUp(note, { type: log.type, tags: log.tags || [] }).then(ai => {
        if (!ai?.needsFollowUp) return;
        scheduleAutoFollowUp(ai);
      }).catch(() => {});
    });
  }, [logs, caseMemory, followUps, currentDate, activePeriod]);

  // ── Showcase (demo mode) ──────────────────────────────────
  const handleLoadDemo = ({ incidents, interventions, outcomes, logs: demoLogs }) => {
    caseMemory.loadDemoCaseMemory({ incidents, interventions, outcomes });
    if (demoLogs) loadDemoLogs(demoLogs);
    students.setDemoMode(true);
  };
  const handleClearDemo = () => {
    caseMemory.clearCaseMemory();
    followUps.clearFollowUps();
    clearDemoLogs();
  };

  // ── Vault state ────────────────────────────────────────────
  const [vaultTab, setVaultTab] = useState("all"), [vaultFilter, setVaultFilter] = useState("all"), [editingLog, setEditingLog] = useState(null);
  // Interactive vault state
  const [vaultSearch, setVaultSearch] = useState("");
  const [vaultRange, setVaultRange] = useState("all"); // all | today | week | month
  const [vaultSort, setVaultSort] = useState({ col: "date", dir: "desc" });
  const [vaultExpandedId, setVaultExpandedId] = useState(null);
  const [vaultTagFilter, setVaultTagFilter] = useState(null);
  const [vaultTypeFilter, setVaultTypeFilter] = useState(null);

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
    { id: "followups", label: `Follow-ups${followUps.dueFollowUps.length ? ` (${followUps.dueFollowUps.length})` : ""}`, tip: "Outcome check-ins you saved for later.", component: <FollowUpsPanel followUps={followUps.pendingFollowUps} dueFollowUps={followUps.dueFollowUps} allStudents={allStudents} incidents={caseMemory.incidents} interventions={caseMemory.interventions} onSelect={setActiveFollowUpId} onSnooze={handleFollowUpSnooze} onDismiss={handleFollowUpDismiss} /> },
    { id: "cards", label: "📋 Support Cards", tip: "Step-by-step reference cards for common situations.", component: <SupportCardPanel /> },
    { id: "abc", label: "📊 ABC Builder", tip: "Build structured behavior records: Antecedent, Behavior, Consequence.", component: <ABCBuilder students={effectivePeriodStudents} studentsMap={allStudents} onSave={addLog} periodLabel={period.label} currentDate={currentDate} /> },
    { id: "goals", label: "🎯 Goal Tracker", tip: "Mark IEP goal progress for any student with one tap.", component: <GoalTracker students={effectivePeriodStudents} studentsMap={allStudents} logs={logs} onSave={addLog} /> },
    { id: "handoff", label: "📤 Handoff Notes", tip: "Write notes for the next para, teacher, or end-of-day.", component: <HandoffBuilder students={effectivePeriodStudents} studentsMap={allStudents} onSave={addLog} ollamaOnline={ollama.ollamaOnline} ollamaLoading={ollama.ollamaLoading} onOllamaHandoff={insights.handleOllamaHandoff} /> },
    { id: "trainingGap", label: "🔖 Topics for Next Check-in", tip: "Generate EBP topics worth bringing up at your next sped-teacher meeting. Patterns only — no single log surfaces a topic.", component: <TrainingGapPanel students={effectivePeriodStudents} studentsMap={allStudents} logs={logs} /> },
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
    // vaultLogs is hoisted to top-level useMemo (above) so the modal +
    // analytics see the same merged set the Vault renders.
    const allStu = Object.entries(allStudents);
    const counts = { green: allStu.filter(([id]) => getHealth(id, vaultLogs, currentDate) === "green").length, yellow: allStu.filter(([id]) => getHealth(id, vaultLogs, currentDate) === "yellow").length, red: allStu.filter(([id]) => getHealth(id, vaultLogs, currentDate) === "red").length };
    // Students with >3 logs in the last 24h — surface as "needs attention"
    // next to the byStudent filter so nothing gets lost in a busy day.
    const needsAttention = new Set(
      allStu
        .map(([id]) => id)
        .filter(id => logsInLastHours(id, vaultLogs, 24) > 3)
    );
    let filteredLogs = vaultLogs;
    // Tab-based filters
    if (vaultTab === "byStudent" && vaultFilter !== "all") filteredLogs = filteredLogs.filter(l => l.studentId === vaultFilter);
    if (vaultTab === "byPeriod" && vaultFilter !== "all") filteredLogs = filteredLogs.filter(l => l.periodId === vaultFilter);
    if (vaultTab === "flagged") filteredLogs = filteredLogs.filter(l => l.flagged);
    if (vaultTab === "handoffs") filteredLogs = filteredLogs.filter(l => l.type === "Handoff Note");
    if (vaultTab === "goalProgress") filteredLogs = filteredLogs.filter(l => l.type === "Goal Progress");

    // Date range filter
    if (vaultRange !== "all" && vaultRange !== "knowledge") {
      const today = new Date(currentDate + "T00:00:00");
      let threshold = null;
      if (vaultRange === "today") threshold = today;
      else if (vaultRange === "week") { threshold = new Date(today); threshold.setDate(threshold.getDate() - 7); }
      else if (vaultRange === "month") { threshold = new Date(today); threshold.setMonth(threshold.getMonth() - 1); }
      if (threshold) {
        const ts = threshold.getTime();
        filteredLogs = filteredLogs.filter(l => {
          if (!l.date) return false;
          return new Date(l.date + "T12:00:00").getTime() >= ts;
        });
      }
    }

    // Active type/tag chip filters
    if (vaultTypeFilter) filteredLogs = filteredLogs.filter(l => l.type === vaultTypeFilter);
    if (vaultTagFilter) filteredLogs = filteredLogs.filter(l => (l.tags || []).includes(vaultTagFilter));

    // Resolve a student record for a log, falling back to paraAppNumber when
    // the studentId is stale (e.g. the original local id was wiped and
    // re-imported under a new id). Keeps Vault names + colors stable across
    // roster regenerations.
    const studentForLog = (l) =>
      allStudents[l.studentId]
      || resolveStudentByParaAppNumber(allStudents, l.paraAppNumber);

    // Text search across note / student name / tags / type
    if (vaultSearch.trim()) {
      const q = vaultSearch.trim().toLowerCase();
      filteredLogs = filteredLogs.filter(l => {
        const stu = studentForLog(l);
        const name = (stu?.realName || stu?.pseudonym || l.studentId || '').toLowerCase();
        const note = (l.note || l.text || '').toLowerCase();
        const type = (l.type || '').toLowerCase();
        const tags = (l.tags || []).join(' ').toLowerCase();
        return name.includes(q) || note.includes(q) || type.includes(q) || tags.includes(q);
      });
    }

    // Sort
    filteredLogs = [...filteredLogs].sort((a, b) => {
      const dir = vaultSort.dir === "asc" ? 1 : -1;
      if (vaultSort.col === "date") {
        const at = (a.timestamp || a.date || '');
        const bt = (b.timestamp || b.date || '');
        return at > bt ? dir : at < bt ? -dir : 0;
      }
      if (vaultSort.col === "student") {
        const as = studentForLog(a);
        const bs = studentForLog(b);
        const an = (as?.realName || as?.pseudonym || a.studentId || '').toLowerCase();
        const bn = (bs?.realName || bs?.pseudonym || b.studentId || '').toLowerCase();
        return an > bn ? dir : an < bn ? -dir : 0;
      }
      if (vaultSort.col === "type") {
        return (a.type || '') > (b.type || '') ? dir : (a.type || '') < (b.type || '') ? -dir : 0;
      }
      return 0;
    });
    const vaultTabs = [{ id: "all", label: "All Logs" }, { id: "byStudent", label: "By Student" }, { id: "byPeriod", label: "By Period" }, { id: "flagged", label: `Flagged (${logs.filter(l => l.flagged).length})` }, { id: "handoffs", label: `Handoffs (${logs.filter(l => l.type === "Handoff Note").length})` }, { id: "goalProgress", label: `Goals (${logs.filter(l => l.type === "Goal Progress").length})` }, { id: "knowledge", label: `Notes (${knowledgeBase.length})` }];
    return (<div>
      <div className="header">
        <div>
          <h1>Data Vault</h1>
          <p className="teacher-subtitle">
            <span className="pill pill-accent" style={{ fontSize: 11, marginRight: 8 }}>
              {logs.length} observations
            </span>
            <span className="pill pill-violet" style={{ fontSize: 11, marginRight: 8 }}>
              {knowledgeBase.length} saved notes
            </span>
            <span className="pill pill-green" style={{ fontSize: 11 }}>
              Real names stay local
            </span>
          </p>
        </div>
        <div style={{ display: "flex", gap: "var(--space-2)" }}>
          <button className="btn btn-primary" onClick={() => handleExportCSV(filteredLogs)}>Export filtered data</button>
          <button className="btn btn-secondary" onClick={() => handleExportCSV()}>Export everything</button>
          {identityRegistry.length > 0 && (
            <button className="btn btn-secondary"
              style={{ borderColor: "rgba(251,191,36,0.35)", color: "var(--yellow)" }}
              onClick={() => handleExportCSVPrivate(filteredLogs)}>
              Export with real names
            </button>
          )}
        </div>
      </div>
      <div className="metric-grid" style={{ marginBottom: "var(--space-6)" }}>
        {[
          { h: "green",  label: "Logged today",    tone: "tone-green"  },
          { h: "yellow", label: "This week",       tone: "tone-yellow" },
          { h: "red",    label: "Needs attention", tone: "tone-red"    },
        ].map(({ h, label, tone }) => (
          <div key={h} className="metric-card">
            <div className="metric-label">{label}</div>
            <div className={`metric-value ${tone}`}>{counts[h]}</div>
            <div className="metric-sub">student{counts[h] !== 1 ? "s" : ""}</div>
          </div>
        ))}
      </div>
      <div style={{
        display: "flex", gap: 6, marginBottom: "var(--space-4)",
        flexWrap: "wrap",
        padding: 4,
        background: "var(--bg-dark)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        width: "fit-content",
        maxWidth: "100%",
      }}>
        {vaultTabs.map(t => (
          <button key={t.id}
            onClick={() => { setVaultTab(t.id); setVaultFilter("all"); }}
            style={{
              padding: "var(--space-2) var(--space-4)",
              borderRadius: "var(--radius-sm)",
              border: "none",
              cursor: "pointer",
              fontSize: 12, fontWeight: 600,
              fontFamily: "inherit",
              background: vaultTab === t.id ? "var(--grad-primary)" : "transparent",
              color: vaultTab === t.id ? "#fff" : "var(--text-secondary)",
              transition: "all 120ms cubic-bezier(0.16,1,0.3,1)",
              minHeight: 36,
              boxShadow: vaultTab === t.id ? "0 2px 8px rgba(100,136,255,0.3)" : "none",
            }}>
            {t.label}
          </button>
        ))}
      </div>
      {(vaultTab === "byStudent" || vaultTab === "byPeriod") && (<div style={{ marginBottom: "14px", display: "flex", gap: "8px", alignItems: "center" }}><span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Filter:</span><select value={vaultFilter} onChange={e => setVaultFilter(e.target.value)} className="period-select" style={{ maxWidth: "280px" }}><option value="all">All</option>{vaultTab === "byStudent" && Object.entries(allStudents).map(([id, s]) => (<option key={id} value={id}>{needsAttention.has(id) ? "⚠ " : ""}{resolveLabel(s, "compact")} ({logs.filter(l => l.studentId === id).length})</option>))}{vaultTab === "byPeriod" && Object.entries(DB.periods).map(([id, p]) => (<option key={id} value={id}>{p.label}</option>))}</select></div>)}

      {/* Interactive filter + search bar (hidden on KB tab) */}
      {vaultTab !== "knowledge" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", marginBottom: "var(--space-4)" }}>
          <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center", flexWrap: "wrap" }}>
            <input
              value={vaultSearch}
              onChange={e => setVaultSearch(e.target.value)}
              placeholder="🔎 Search notes, students, types, tags…"
              className="chat-input"
              style={{ flex: "1 1 260px", minWidth: 240, fontSize: 13 }}
            />
            <div style={{
              display: "flex", gap: 2, padding: 3,
              background: "var(--bg-dark)", border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
            }}>
              {[
                ["all", "All time"],
                ["today", "Today"],
                ["week", "Week"],
                ["month", "Month"],
              ].map(([id, label]) => (
                <button key={id} onClick={() => setVaultRange(id)} style={{
                  padding: "6px 12px", borderRadius: "var(--radius-sm)",
                  border: "none", cursor: "pointer",
                  fontSize: 11, fontWeight: 600, fontFamily: "inherit",
                  background: vaultRange === id ? "var(--grad-primary)" : "transparent",
                  color: vaultRange === id ? "#fff" : "var(--text-secondary)",
                }}>{label}</button>
              ))}
            </div>
          </div>
          {/* Active-filter chips (clear-as-you-go) */}
          {(vaultTypeFilter || vaultTagFilter || vaultSearch || vaultRange !== "all") && (
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", fontSize: 11, color: "var(--text-muted)" }}>
              <span>Filters:</span>
              {vaultTypeFilter && (
                <button onClick={() => setVaultTypeFilter(null)} className="pill pill-accent" style={{ fontSize: 10, cursor: "pointer", border: "none" }}>
                  Type: {vaultTypeFilter} ×
                </button>
              )}
              {vaultTagFilter && (
                <button onClick={() => setVaultTagFilter(null)} className="pill pill-violet" style={{ fontSize: 10, cursor: "pointer", border: "none" }}>
                  Tag: {vaultTagFilter} ×
                </button>
              )}
              {vaultRange !== "all" && (
                <button onClick={() => setVaultRange("all")} className="pill pill-yellow" style={{ fontSize: 10, cursor: "pointer", border: "none" }}>
                  Range: {vaultRange} ×
                </button>
              )}
              {vaultSearch && (
                <button onClick={() => setVaultSearch("")} className="pill pill-green" style={{ fontSize: 10, cursor: "pointer", border: "none" }}>
                  "{vaultSearch.slice(0, 20)}{vaultSearch.length > 20 ? '…' : ''}" ×
                </button>
              )}
              <button
                onClick={() => { setVaultTypeFilter(null); setVaultTagFilter(null); setVaultRange("all"); setVaultSearch(""); }}
                className="btn btn-ghost btn-sm"
                style={{ fontSize: 11, marginLeft: "auto" }}
              >Clear all</button>
            </div>
          )}
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
            Showing <b style={{ color: "var(--text-primary)" }}>{filteredLogs.length}</b> of {logs.length} logs
          </div>
        </div>
      )}
      {vaultTab === "knowledge" && (<div>
        <div className="panel" style={{ padding: "16px", marginBottom: "16px" }}>
          <h3 style={{ margin: "0 0 4px", fontSize: "14px", color: "var(--accent)" }}>Add to Knowledge Base</h3>
          <p style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "12px" }}>AI uses everything in here.</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "8px" }}>
            <div><label style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>Title</label><input value={kb.kbTitle} onChange={e => kb.setKbTitle(e.target.value)} placeholder="e.g. Decimal Strategies" style={{ width: "100%", padding: "8px 10px", background: "var(--bg-dark)", border: "1px solid var(--border)", borderRadius: "6px", color: "white", fontSize: "13px" }} /></div>
            <div><label style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>Type</label><select value={kb.kbDocType} onChange={e => kb.setKbDocType(e.target.value)} className="period-select" style={{ width: "100%" }}><option>Teaching Strategy</option><option>Lesson Plan</option><option>IEP Document</option><option>My Own Notes</option><option>Para Team Notes</option><option>Other</option></select></div>
          </div>
          <textarea spellCheck="true" lang="en" value={kb.kbInput} onChange={e => kb.setKbInput(e.target.value)} className="data-textarea" style={{ height: "100px" }} placeholder="Paste content or upload below..." />
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
      {vaultTab !== "knowledge" && (
        <>
          <BulkDeleteBar
            count={selectedLogIds.size}
            onDelete={confirmBulkDelete}
            onCancel={clearLogSelection}
          />
          {undoSnapshot && (
            <div style={{ padding: '8px 14px', background: 'rgba(34,197,94,.12)', borderBottom: '1px solid rgba(34,197,94,.35)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 13, color: '#86EFAC' }}>{undoSnapshot.length} log{undoSnapshot.length === 1 ? '' : 's'} deleted.</span>
              <button onClick={undoBulkDelete} style={{ background: 'transparent', color: '#86EFAC', border: '1px solid #22C55E', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer' }}>Undo</button>
            </div>
          )}
        </>
      )}
      {vaultTab !== "knowledge" && (filteredLogs.length === 0 ? (
        <div className="empty-doc">
          {vaultTab === "flagged" ? "No flagged entries." :
           (vaultSearch || vaultTypeFilter || vaultTagFilter || vaultRange !== "all")
             ? "No logs match your filters."
             : "No logs yet."}
        </div>
      ) : (<div className="table-container"><table className="data-table">
        <thead><tr>
          <th style={{ width: 28 }}></th>
          <th style={{ width: 28 }}><input
            type="checkbox"
            aria-label="Select all visible logs"
            checked={filteredLogs.length > 0 && filteredLogs.every(l => selectedLogIds.has(l.id))}
            onChange={(e) => {
              if (e.target.checked) setSelectedLogIds(new Set(filteredLogs.map(l => l.id)));
              else clearLogSelection();
            }}
          /></th>
          <SortableHeader col="date" label="Date" sort={vaultSort} onSort={setVaultSort} />
          <th>Period</th>
          <SortableHeader col="student" label="Student" sort={vaultSort} onSort={setVaultSort} />
          <SortableHeader col="type" label="Type" sort={vaultSort} onSort={setVaultSort} />
          <th>Tags</th>
          <th>Observation</th>
          <th style={{ textAlign: "right" }}>Actions</th>
        </tr></thead>
        <tbody>{filteredLogs.map(l => {
        // Same fallback as the search/sort: missing studentId resolves via
        // paraAppNumber so old logs keep showing the right name + color
        // after a roster regen wipes their original local id.
        const rawStudent = studentForLog(l);
        const isOrphan = !rawStudent;
        const s = rawStudent || { pseudonym: l.studentId, color: "var(--text-muted)" };
        const label = isOrphan
          ? `↯ ${(l.studentId || '').slice(0, 24)}${(l.studentId || '').length > 24 ? '…' : ''}`
          : (s.realName || resolveLabel(s, "compact"));
        const isExpanded = vaultExpandedId === l.id;
        const rowNeedsAttn = needsAttention.has(l.studentId);
        const rowBg = isExpanded
          ? "var(--panel-hover)"
          : rowNeedsAttn
            ? "rgba(239,68,68,0.06)"
            : undefined;
        return (
          <React.Fragment key={l.id}>
            <tr style={rowBg ? { background: rowBg } : undefined}>
              <td style={{ textAlign: "center", padding: 0 }}>
                <button
                  onClick={() => setVaultExpandedId(isExpanded ? null : l.id)}
                  title={isExpanded ? "Collapse" : "Expand"}
                  style={{
                    background: "transparent", border: "none", cursor: "pointer",
                    color: "var(--text-muted)", fontSize: 12,
                    padding: "4px 6px", borderRadius: 4,
                    transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                    transition: "transform 120ms ease",
                  }}
                >▶</button>
              </td>
              <td style={{ textAlign: "center", padding: 0 }}>
                <input
                  type="checkbox"
                  checked={selectedLogIds.has(l.id)}
                  onChange={() => toggleLogSelection(l.id)}
                  aria-label="Select log for bulk action"
                />
              </td>
              <td style={{ whiteSpace: "nowrap", color: "var(--text-muted)" }}>{l.date}</td>
              <td style={{ fontSize: "12px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>{l.period}</td>
              <td
                onClick={() => setProfileStu(l.studentId)}
                title={isOrphan ? "Student not in current roster — click for details" : "Open profile"}
                style={{
                  fontWeight: isOrphan ? 400 : 600,
                  color: isOrphan ? "var(--text-muted)" : s.color,
                  whiteSpace: "nowrap",
                  cursor: "pointer",
                  fontStyle: isOrphan ? "italic" : "normal",
                }}
              >{label}</td>
              <td>
                <button
                  onClick={() => setVaultTypeFilter(vaultTypeFilter === l.type ? null : l.type)}
                  title={`Filter by "${l.type}"`}
                  style={{
                    fontSize: "11px",
                    background: l.type === "Handoff Note" ? "#854d0e" : "#1e3a5f",
                    color: l.type === "Handoff Note" ? "#fde68a" : "#93c5fd",
                    padding: "3px 10px", borderRadius: "20px", whiteSpace: "nowrap",
                    border: vaultTypeFilter === l.type ? "1px solid currentColor" : "1px solid transparent",
                    cursor: "pointer", fontFamily: "inherit",
                  }}
                >{l.type}</button>
              </td>
              <td style={{ fontSize: "10px" }}>
                {(l.tags || []).slice(0, 4).map(tag => (
                  <button
                    key={tag}
                    onClick={() => setVaultTagFilter(vaultTagFilter === tag ? null : tag)}
                    title={`Filter by tag "${tag}"`}
                    style={{
                      fontSize: 10, marginRight: 3, marginBottom: 2,
                      padding: "1px 6px", borderRadius: 10,
                      background: vaultTagFilter === tag ? "var(--violet-muted)" : "transparent",
                      color: vaultTagFilter === tag ? "var(--violet)" : "#4a6284",
                      border: `1px solid ${vaultTagFilter === tag ? "var(--violet)" : "var(--border)"}`,
                      cursor: "pointer", fontFamily: "inherit",
                    }}
                  >{tag}</button>
                ))}
              </td>
              <td className="privacy-blur" tabIndex={0}>{editingLog === l.id ? (<div style={{ display: "flex", gap: "6px" }}><input defaultValue={l.note || l.text} id={`edit_${l.id}`} style={{ flex: 1, padding: "4px 8px", background: "var(--bg-dark)", border: "1px solid var(--border)", borderRadius: "4px", color: "white", fontSize: "12px" }} /><button className="btn btn-primary" style={{ fontSize: "11px", padding: "4px 8px" }} onClick={() => saveEdit(l.id, document.getElementById(`edit_${l.id}`).value)}>Save</button><button className="btn btn-secondary" style={{ fontSize: "11px", padding: "4px 8px" }} onClick={() => setEditingLog(null)}>Cancel</button></div>) : <span style={{ fontSize: "13px" }}>{l.note || l.text}</span>}</td>
              <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                <button onClick={() => toggleFlag(l.id)} title="Flag for IEP" style={{ background: "none", border: "none", cursor: "pointer", fontSize: "14px", color: l.flagged ? "#f59e0b" : "#334155" }}>⚑</button>
                <button onClick={() => setEditingLog(l.id)} title="Edit" style={{ background: "none", border: "none", cursor: "pointer", fontSize: "13px", color: "#60a5fa", marginLeft: "4px" }}>✏</button>
                <button onClick={() => deleteLog(l.id)} title="Delete" style={{ background: "none", border: "none", cursor: "pointer", fontSize: "13px", color: "#ef4444", marginLeft: "4px" }}>🗑</button>
              </td>
            </tr>
            {isExpanded && (
              <tr>
                <td colSpan={8} style={{
                  padding: "var(--space-4) var(--space-5)",
                  background: "var(--bg-dark)",
                  borderTop: "none",
                }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "var(--space-3)", fontSize: 12 }}>
                    <LogDetailCell label="Full observation">
                      <div style={{ color: "var(--text-primary)", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                        {l.note || l.text || <i>(no note)</i>}
                      </div>
                    </LogDetailCell>
                    <LogDetailCell label="Timestamp">
                      <code style={{ fontFamily: "JetBrains Mono, monospace" }}>{l.timestamp || l.date || '—'}</code>
                    </LogDetailCell>
                    <LogDetailCell label="Source">{l.source || '—'}</LogDetailCell>
                    <LogDetailCell label="Category">{l.category || '—'}</LogDetailCell>
                    <LogDetailCell label="Situation ID">{l.situationId || '—'}</LogDetailCell>
                    <LogDetailCell label="Strategy used">{l.strategyUsed || '—'}</LogDetailCell>
                    <LogDetailCell label="Goal ID">{l.goalId || '—'}</LogDetailCell>
                    <LogDetailCell label="All tags">
                      {(l.tags || []).length > 0 ? (l.tags || []).join(', ') : '—'}
                    </LogDetailCell>
                    <LogDetailCell label="Log ID">
                      <code style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10 }}>{l.id}</code>
                    </LogDetailCell>
                    <LogDetailCell label="Shared">
                      {l.shared ? <span style={{ color: "var(--green)" }}>✓ Team-visible</span> : <span style={{ color: "var(--text-muted)" }}>Private (yours only)</span>}
                    </LogDetailCell>
                  </div>
                </td>
              </tr>
            )}
          </React.Fragment>
        );
      })}</tbody></table></div>))}
    </div>);
  };

  // ══════════════════════════════════════════════════════════
  // MAIN RENDER
  // ══════════════════════════════════════════════════════════
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
      <BrandHeader right={
        <>
          {supabaseConfigured && <TeamSwitcher />}
          <OllamaStatusBadge online={ollama.ollamaOnline} modelName={ollama.ollamaModel} />
        </>
      } />

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
      {false && (
        <RosterPanel
          onClose={() => {}}
          allStudents={allStudents}
          identityRegistry={identityRegistry}
          activePeriod={activePeriod}
          onIdentityLoad={students.handleIdentityLoad}
          onClearRoster={() => students.setIdentityRegistry([])}
        />
      )}

    <div className="app-layout" data-privacy={privacyOn ? "on" : "off"} style={{ flex: 1, minWidth: 0 }}>
      <aside className={`sidebar${sidebarCollapsed ? ' collapsed' : ''}`} style={{ position: 'relative' }}>
        <button
          type="button"
          className="sidebar-toggle"
          onClick={() => setSidebarCollapsed(c => !c)}
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? '›' : '‹'}
        </button>
        {(() => {
          const sb = getSidebarVisibility(simpleMode);
          return (<>
            <div className="brand" style={{ fontSize: "11px", color: "#1e3a5f", padding: "0 4px 10px", marginBottom: "2px" }}>v2</div>

            {/* Para's primary front door — always visible at the top so a new
                para never has to hunt for "where do I start". */}
            <button
              type="button"
              onClick={() => setFindStudentsOpen(true)}
              title="Load your students so you see real names + each kid's IEP info"
              style={{
                width: "100%",
                padding: "10px 12px",
                marginBottom: 10,
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--accent-border)",
                background: "var(--accent-glow)",
                color: "var(--accent-hover)",
                cursor: "pointer",
                fontSize: 13, fontWeight: 700,
                display: "flex", alignItems: "center", gap: 8,
                fontFamily: "inherit",
              }}
            >
              <span style={{ fontSize: 16 }}>🎯</span>
              {!sidebarCollapsed && <span>Find my students</span>}
            </button>

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
                {[
                  { id: "dashboard", label: "📊 Dashboard", tip: "Main copilot view" },
                  { id: "vault",     label: "🗄️ Data Vault", tip: "All logs, flagged items, knowledge base" },
                  { id: "import",    label: "📥 IEP Import",  tip: "Upload IEPs or paste student documents — converted to FERPA-safe structured student profiles automatically" },
                  { id: "analytics", label: "📈 Analytics",   tip: "Visual data dashboard with custom date ranges and groups" },
                  // Admin-only tab: shown to owners + sped_teachers.
                  ...(teamCtx?.isAdmin ? [{ id: "admin", label: "🎓 Admin", tip: "Manage team members, roles, sub access, and team settings." }] : []),
                ].map(({ id, label, tip }) => (
                  <Tip key={id} text={tip} pos="right"><button className={`nav-btn${view === id ? " active" : ""}`} onClick={() => setView(id)}>{label}</button></Tip>
                ))}
              </div>
            )}

            {sb.showToolbox && (
              <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: 4 }}>
                {/* Tools the para uses for their own work — opens in side panel */}
                <div className="sidebar-section-label">For your work</div>
                {toolboxTools.filter(t => !t.studentSafe).map(t => (
                  <Tip key={t.id} text={t.tip} pos="right">
                    <button
                      className={`nav-btn${activeToolbox === t.id ? ' active' : ''}`}
                      onClick={() => setActiveToolbox(activeToolbox === t.id ? null : t.id)}
                      onDoubleClick={(e) => { e.preventDefault(); setActiveToolbox(null); if (!floatingTools.includes(t.id)) setFloatingTools(prev => [...prev, t.id]); }}
                    >
                      {t.label}
                    </button>
                  </Tip>
                ))}

                {/* Student-safe tools — typically popped out fullscreen for the kid */}
                {toolboxTools.some(t => t.studentSafe) && (
                  <>
                    <div className="sidebar-section-label" style={{ marginTop: 8 }}>For your student</div>
                    {toolboxTools.filter(t => t.studentSafe).map(t => (
                      <Tip key={t.id} text={t.tip} pos="right">
                        <button
                          className={`nav-btn${activeToolbox === t.id ? ' active' : ''}`}
                          onClick={() => setActiveToolbox(activeToolbox === t.id ? null : t.id)}
                          onDoubleClick={(e) => { e.preventDefault(); setActiveToolbox(null); if (!floatingTools.includes(t.id)) setFloatingTools(prev => [...prev, t.id]); }}
                        >
                          {t.label}
                        </button>
                      </Tip>
                    ))}
                    <div style={{ fontSize: 10, color: "var(--text-dim)", padding: "2px 8px 0", lineHeight: 1.4 }}>
                      Double-click any tool to pop it out into a window.
                    </div>
                  </>
                )}
              </div>
            )}

            <div style={{ marginTop: "auto", paddingTop: "16px", borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: "6px" }}>
              <Tip text="Hide all student data. Screen shows only classroom tools." pos="right">
                <button onClick={() => setStealthMode(true)} style={{ width: "100%", padding: "6px", borderRadius: "6px", border: "1px solid #7f1d1d", background: "#1a0505", color: "#f87171", cursor: "pointer", fontSize: "11px", fontWeight: "600" }}>🛡️ Stealth Mode</button>
              </Tip>
              <Tip text="Mask student names while typing. Vault and exports stay unchanged. Per-device toggle." pos="right">
                <button
                  onClick={togglePrivacy}
                  aria-pressed={privacyOn}
                  style={{
                    width: "100%", padding: "7px", borderRadius: "6px",
                    border: `1px solid ${privacyOn ? "#A78BFA" : "#334155"}`,
                    background: privacyOn ? "rgba(167,139,250,.15)" : "transparent",
                    color: privacyOn ? "#A78BFA" : "#64748b",
                    cursor: "pointer", fontSize: "11px", fontWeight: "600",
                  }}
                >
                  {privacyOn ? "🛡 Privacy ON" : "🛡 Privacy mode"}
                </button>
              </Tip>
              <Tip text="Show or hide the Today's Plan + Class Notes Doc panel on the dashboard." pos="right">
                <button
                  onClick={() => setPlanPanelOpen(o => !o)}
                  aria-pressed={planPanelOpen}
                  style={{
                    width: "100%", padding: "7px", borderRadius: "6px",
                    border: `1px solid ${planPanelOpen ? "#1d4ed8" : "#334155"}`,
                    background: planPanelOpen ? "#1e3a5f" : "transparent",
                    color: planPanelOpen ? "#93c5fd" : "#64748b",
                    cursor: "pointer", fontSize: "11px", fontWeight: "600",
                  }}
                >
                  📚 Today's Plan {planPanelOpen ? "ON" : "OFF"}
                </button>
              </Tip>
              {supabaseConfigured && <HandoffInbox />}
              <button
                type="button"
                onClick={() => setOnboardingOpen(true)}
                title="How does this app work?"
                style={{
                  width: "100%", padding: "7px",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border)",
                  background: "transparent",
                  color: "var(--text-secondary)",
                  cursor: "pointer", fontSize: 11, fontWeight: 600,
                  marginTop: 6,
                }}
              >
                ❓ How it works
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!window.confirm(
                    'Reset everything on THIS COMPUTER?\n\n' +
                    'CLEARS (this device only):\n' +
                    '  • All logs\n' +
                    '  • All imported students and roster files\n' +
                    '  • Case memory (incidents, interventions, outcomes)\n' +
                    '  • Knowledge base documents\n' +
                    '  • Identity + supports overrides\n' +
                    '  • Real-name vault on this computer\n\n' +
                    'KEEPS:\n' +
                    '  • Cloud team roster (other paras + your team data on the server)\n' +
                    '  • Google sign-in / team membership\n\n' +
                    'To wipe the cloud team roster too, use Admin Dashboard → Settings → Danger Zone.\n\n' +
                    'This local reset cannot be undone.'
                  )) return;
                  logsBag.setLogs([]);
                  students.resetImports();
                  caseMemory.clearCaseMemory();
                  followUps.clearFollowUps();
                  kb.setKnowledgeBase([]);
                  try { await vaultCtx.purgeVault(); } catch { /* noop */ }
                  setTimeout(() => window.alert('This computer cleared. Cloud roster untouched. Reload to see the demo state.'), 50);
                }}
                title="Clear everything on THIS device — logs, imports, case memory, knowledge base, real-name vault. Cloud team data stays. For a cloud wipe, use Admin → Danger Zone."
                style={{
                  width: "100%", padding: "7px",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid rgba(248,113,113,0.25)",
                  background: "transparent",
                  color: "var(--red)",
                  cursor: "pointer", fontSize: 11, fontWeight: 600,
                  marginTop: 6,
                }}
              >
                🧹 Reset data on this computer
              </button>
              <div style={{ marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setSettingsOpen(true)}
                  className="nav-btn"
                  title="Settings"
                  style={sidebarCollapsed ? { justifyContent: 'center', padding: '8px 6px' } : null}
                >
                  <span style={{ fontSize: 14 }}>⚙️</span>
                  {!sidebarCollapsed && <span style={{ marginLeft: 8 }}>Settings</span>}
                </button>
              </div>
              <div style={{ marginTop: 4 }}>
                <BugReportButton collapsed={sidebarCollapsed} />
              </div>
              <div style={{ fontSize: "11px", color: "#334155", textAlign: "center", lineHeight: "1.8", marginTop: 4 }}>Student names stay on this computer</div>
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
              deleteLog={deleteLog}
              updateLogText={updateLogText}
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
                  onScheduleFollowUp={followUps.scheduleFollowUp}
                  onLoadDemo={handleLoadDemo}
                  onClearDemo={handleClearDemo}
                  hasVault={vaultCtx?.hasVault}
                  onFindMyStudents={() => setFindStudentsOpen(true)}
                  bannerHiddenAlways={bannerHiddenAlways}
                  planPanelOpen={planPanelOpen}
                  onTogglePlanPanel={(next) => setPlanPanelOpen(typeof next === 'function' ? next(planPanelOpen) : next)}
                />
              )}
              {view === "vault" && renderVault()}
              {view === "import" && <IEPImport
                onImport={students.handleImport}
                onBulkImport={students.handleBundleImport}
                onIdentityLoad={students.handleIdentityLoad}
                importedCount={Object.keys(students.importedStudents).length}
                onLoadDemo={handleLoadDemo}
                importedStudents={students.importedStudents}
                vault={vaultCtx.vault}
                onRemoveOrphan={students.removeImportedStudent}
                onClearImports={students.clearImports}
                cloudStudents={teamCtx?.teamStudents || []}
                onRemoveCloudOrphan={async (paraAppNumber) => {
                  const { deleteTeamStudentByExternalKey } = await import('./services/teamSync');
                  return deleteTeamStudentByExternalKey(teamCtx?.activeTeamId, paraAppNumber);
                }}
                isOwnerOrAdmin={!!teamCtx?.isAdmin}
              />}
              {view === "analytics" && <AnalyticsDashboard logs={logs} groups={groups} setGroups={setGroups} onOpenProfile={setProfileStu} ollamaOnline={ollama.ollamaOnline} ollamaLoading={ollama.ollamaLoading} onOllamaPatternSummary={insights.handleOllamaPatternSummary} allStudents={allStudents} />}
              {view === "admin" && teamCtx?.isAdmin && (
                <AdminDashboard
                  allStudents={allStudents}
                  vaultNames={Object.fromEntries(
                    Object.values(allStudents)
                      .filter(s => s && s.realName)
                      .map(s => [s.id, s.realName])
                  )}
                />
              )}
            </>
        }
      </main>

      {activeToolbox && (<aside style={{ width: activeToolbox === "cards" || activeToolbox === "strategies" ? "380px" : "320px", flexShrink: 0, background: "var(--panel-bg)", borderLeft: "1px solid var(--border)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
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

      {profileStu && (<StudentProfileModal studentId={profileStu} studentData={allStudents[profileStu]} logs={vaultLogs} currentDate={currentDate} activePeriod={activePeriod} onClose={() => setProfileStu(null)} onLog={addLog} onDraftEmail={(id) => { setProfileStu(null); insights.draftEmail(id); }} onUpdateIdentity={students.handleUpdateIdentity} onUpdateSupports={students.handleUpdateSupports} caseMemory={caseMemory} />)}
      {insights.emailModal && (<EmailModal studentId={insights.emailModal.studentId} studentData={allStudents[insights.emailModal.studentId]} emailLoading={insights.emailLoading} emailDraft={insights.emailDraft} setEmailDraft={insights.setEmailDraft} onClose={() => { insights.setEmailModal(null); insights.setEmailDraft(""); }} />)}
      {situationModal && (<SituationResponseModal situation={situationModal} students={effectivePeriodStudents} studentsMap={allStudents} onClose={() => setSituationModal(null)} onLog={(id, note, type) => addLog(id, note, type)} onOpenCard={() => { setSituationModal(null); setActiveToolbox("cards"); }} />)}
      {insights.ollamaModal && (<OllamaInsightModal feature={insights.ollamaModal.feature} text={insights.ollamaModal.text} studentId={insights.ollamaModal.studentId} onClose={() => insights.setOllamaModal(null)} onLog={addLog} />)}

      {!stealthMode && !activeFollowUp && followUps.dueFollowUps.length > 0 && (
        <div
          role="status"
          style={{
            position: 'fixed',
            right: 20,
            top: 64,
            zIndex: 9300,
            width: 'min(360px, calc(100vw - 40px))',
            padding: 14,
            background: 'var(--panel-raised)',
            border: '1px solid var(--accent-border)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>
            {followUps.dueFollowUps.length} follow-up{followUps.dueFollowUps.length === 1 ? '' : 's'} due
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.45, marginBottom: 10 }}>
            Check what happened after a support you logged earlier.
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn btn-action btn-sm" onClick={openNextDueFollowUp}>
              Open
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={openFollowUpsPanel}>
              Panel
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleFollowUpSnooze(followUps.dueFollowUps[0].id, 15)}>
              Later
            </button>
          </div>
        </div>
      )}

      {!stealthMode && activeFollowUp && (
        <FollowUpPrompt
          followUp={activeFollowUp}
          student={activeFollowUpStudent}
          incident={activeFollowUpIncident}
          intervention={activeFollowUpIntervention}
          onAnswer={handleFollowUpAnswer}
          onSnooze={handleFollowUpSnooze}
          onDismiss={handleFollowUpDismiss}
        />
      )}

      {floatingTools.map(tid => { const t = toolboxTools.find(x => x.id === tid); return t ? <FloatingToolWindow key={tid} tool={t} onClose={() => setFloatingTools(prev => prev.filter(x => x !== tid))} onFullscreen={() => { setFullscreenTool(tid); setFloatingTools(prev => prev.filter(x => x !== tid)); }} onDock={() => { setFloatingTools(prev => prev.filter(x => x !== tid)); setActiveToolbox(tid); }} /> : null; })}

      {fullscreenTool && (<FullscreenTool tool={toolboxTools.find(t => t.id === fullscreenTool) || toolboxTools[0]} onClose={() => setFullscreenTool(null)} />)}
      {stealthMode && (
        <StealthScreen
          activeTool={stealthTool}
          toolboxTools={toolboxTools}
          onSelectTool={setStealthTool}
          onExit={() => setStealthMode(false)}
          onExitWithoutPin={() => {
            setStealthMode(false);
            setStealthPinNudge(true);
          }}
        />
      )}
      {stealthPinNudge && (
        <div
          role="status"
          style={{
            position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
            zIndex: 9998,
            maxWidth: 'min(560px, calc(100vw - 32px))',
            padding: '10px 16px',
            background: 'var(--panel-raised, var(--bg-surface))',
            border: '1px solid rgba(251,191,36,0.5)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-lg)',
            display: 'flex', alignItems: 'center', gap: 10,
            fontSize: 13, fontWeight: 600, color: 'var(--text-primary)',
          }}
        >
          <span style={{ fontSize: 16 }}>🔒</span>
          <span style={{ flex: 1, color: 'var(--text-secondary)', fontWeight: 500 }}>
            Want to lock Stealth Mode? Open Settings → Stealth screen PIN to set a 4-digit code.
          </span>
          <button
            type="button"
            onClick={() => { setStealthPinNudge(false); setSettingsOpen(true); }}
            className="btn btn-primary btn-sm"
            style={{ minHeight: 30, fontSize: 11 }}
          >
            Open Settings
          </button>
          <button
            type="button"
            onClick={() => setStealthPinNudge(false)}
            aria-label="Dismiss"
            style={{
              background: 'transparent', border: 'none',
              color: 'var(--text-muted)', cursor: 'pointer',
              fontSize: 16, lineHeight: 1, padding: '0 4px',
            }}
          >×</button>
        </div>
      )}
      {onboardingOpen && <OnboardingModal onClose={() => setOnboardingOpen(false)} />}
      <FindMyStudentsModal
        open={findStudentsOpen}
        onClose={() => setFindStudentsOpen(false)}
        onIdentityLoad={students.handleIdentityLoad}
      />
      <SettingsModal
        open={settingsOpen}
        onClose={() => {
          // Re-read the persistent flag whenever the modal closes so the
          // dashboard banner immediately reflects any toggle changes.
          setBannerHiddenAlways(isFindStudentsBannerHidden());
          setSettingsOpen(false);
        }}
        onReplayOnboarding={() => setOnboardingOpen(true)}
        onOpenLegacyImport={() => setLegacyImportOpen(true)}
      />
      {legacyImportOpen && (
        <LegacyImportModal
          open={legacyImportOpen}
          onClose={() => setLegacyImportOpen(false)}
          vaultLogs={vaultLogs}
        />
      )}

      {sampleDataClearedToast && (
        <div style={{
          position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
          zIndex: 9999,
          padding: '10px 18px',
          background: 'linear-gradient(180deg, var(--panel-raised), var(--panel-bg))',
          border: '1px solid rgba(52,211,153,0.5)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
          color: 'var(--text-primary)',
          fontSize: 13, fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: 10,
          animation: 'fadeIn 0.2s ease',
        }}>
          <span style={{ fontSize: 18 }}>✨</span>
          Sample data cleared — your real students are front and center now.
          <button
            type="button"
            onClick={() => setSampleDataClearedToast(false)}
            style={{
              background: 'transparent', border: 'none',
              color: 'var(--text-muted)', cursor: 'pointer',
              fontSize: 18, lineHeight: 1, padding: '0 4px',
            }}
          >×</button>
        </div>
      )}
    </div>
    </div>
    </div>
  );
}
