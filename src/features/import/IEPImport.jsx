// ══════════════════════════════════════════════════════════════
// IEP IMPORT — Parse student support files into structured profiles
// Uses local Ollama (qwen2.5:7b) for AI parsing — no external API.
// PDF text extraction via pdfjs-dist — fully offline.
// ══════════════════════════════════════════════════════════════
import React, { useState, useRef } from "react";
import { DB } from '../../data';
import { ollamaParseIEP } from '../../engine/ollama';
import { normalizeImportedStudent, buildIdentityRegistry, buildIdentityRegistryFromMasterRoster } from '../../models';
import { useTeamOptional } from '../../context/TeamProvider';
import { pushStudents } from '../../services/teamSync';
import { configurePdfWorker } from '../../utils/pdfWorker';
import { assembleBundleFromFiles } from './iepExtractor';
import RosterOnlyImport from './RosterOnlyImport';
import SmartImport from './SmartImport';
import VerifyRoster from './VerifyRoster';
import { assignIdentity, IDENTITY_PALETTE } from '../../identity';
import { DEMO_INCIDENTS, DEMO_INTERVENTIONS, DEMO_OUTCOMES, DEMO_LOGS } from '../../data/demoSeedData';

// ── System 1: App Bundle validation ──────────────────────────
// Accepts schemaVersion 2.0 / 2.1 app bundles only.
// Rejects private roster files with a clear redirect message.
const SUPPORTED_SCHEMA = ["2.0", "2.1"];
function validateBundle(json) {
  if (!json || typeof json !== "object" || Array.isArray(json))
    return "Not a valid JSON object.";
  if (json.type === "privateRoster")
    return "This is a Private Roster file — upload it using the 👤 Private Roster button in the sidebar, not here.";
  if (!json.schemaVersion)
    return "Missing schemaVersion field. Is this a valid App Bundle? (Expected schemaVersion: 2.0 or 2.1)";
  if (!SUPPORTED_SCHEMA.includes(String(json.schemaVersion)))
    return `Unsupported schemaVersion "${json.schemaVersion}". Supported: ${SUPPORTED_SCHEMA.join(", ")}.`;
  if (!json.normalizedStudents || !Array.isArray(json.normalizedStudents.students))
    return "Missing normalizedStudents.students array.";
  return null; // null = valid
}

function validateMasterRoster(json) {
  if (!json || typeof json !== "object" || Array.isArray(json))
    return "Not a valid JSON object.";
  if (!Array.isArray(json.students) || json.students.length === 0)
    return "Missing or empty students array.";
  if (!Array.isArray(json.periods) || json.periods.length === 0)
    return "Missing or empty periods array.";
  for (let i = 0; i < json.students.length; i++) {
    const s = json.students[i];
    if (!s.id || typeof s.id !== "string" || !s.id.trim())
      return `Student at index ${i} is missing a valid id field.`;
    if (!s.fullName || typeof s.fullName !== "string" || !s.fullName.trim())
      return `Student at index ${i} (id: "${s.id}") is missing a valid fullName field.`;
  }
  return null; // null = valid
}

// ── resolveStudentSlot ────────────────────────────────────────
// Maps importedCount → { pseudonym, color, identity } using IDENTITY_PALETTE.
// Replaces the old IMPORT_COLORS 10-color palette with the unified 12-entry palette.
export function resolveStudentSlot(importedCount) {
  const size = IDENTITY_PALETTE.length;
  const colorNum = Math.floor(importedCount / size) + 1;
  const identity = assignIdentity(importedCount, colorNum);
  return {
    pseudonym: `${identity.colorName} Student ${colorNum}`,
    color: identity.color,
    identity,
  };
}

// ── PDF text extractor (pdfjs-dist) ──────────────────────────
async function extractPDFText(file) {
  try {
    const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf");
    configurePdfWorker(pdfjsLib);

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      fullText += content.items.map(item => item.str).join(" ") + "\n";
    }
    return fullText.trim();
  } catch (err) {
    throw new Error("Could not read PDF. Paste the text instead, or install pdfjs-dist.");
  }
}

export function IEPImport({ onImport, onBulkImport, onIdentityLoad, importedCount, onLoadDemo, importedStudents, vault, onRemoveOrphan, cloudStudents, onRemoveCloudOrphan, isOwnerOrAdmin }) {
  const [inputMode, setInputMode] = useState("prepared"); // "prepared" | "paste" | "upload" | "manual" | "bundle" | "masterRoster" | "rosterOnly" | "verify"

  // Cloud team context — null when app is offline-only (no Supabase env configured).
  const team = useTeamOptional();

  // After any bulk import, push the pseudonymous students to the team cloud roster.
  // Fire-and-forget: local import already succeeded; cloud is best-effort.
  const syncStudentsToCloud = (students) => {
    if (!team?.activeTeamId || !team?.user?.id) return;
    pushStudents(team.activeTeamId, students, team.user.id).catch((err) => {
      team.reportCloudError?.(`Students imported locally but did not sync: ${err.message || err}`);
      // eslint-disable-next-line no-console
      console.error('[cloud] pushStudents failed', err);
    });
  };

  // ── Prepared import state ───────────────────────────────────
  const [preparedData, setPreparedData] = useState(null);
  const [preparedError, setPreparedError] = useState("");
  const [preparedImported, setPreparedImported] = useState(false);
  const preparedFileRef = useRef();

  // ── Bundle state ──────────────────────────────────────────────
  const [bundleData,          setBundleData]          = useState(null);
  const [bundleError,         setBundleError]         = useState("");
  const [bundleImported,      setBundleImported]      = useState(false);
  // Post-import save prompt: auto-extracts real names from bundle before normalizing.
  const [showRosterSaveModal,   setShowRosterSaveModal]   = useState(false);
  const [showMissingNamesModal, setShowMissingNamesModal] = useState(false);
  const [pendingRosterData,     setPendingRosterData]     = useState([]);
  const bundleFileRef = useRef();

  // ── Master Roster state ─────────────────────────────────────────
  const [masterRosterData,     setMasterRosterData]     = useState(null);
  const [masterRosterError,    setMasterRosterError]     = useState("");
  const [masterRosterImported, setMasterRosterImported] = useState(false);
  const [mrImportedStudentCount, setMrImportedStudentCount] = useState(0);
  const masterRosterFileRef = useRef();

  // Accepts:
  //   - one .json bundle (existing path)
  //   - one .md file (per-student structured Markdown — paraAppNumbers
  //     generated deterministically from name)
  //   - one .csv file (roster only — IEP fields left blank)
  //   - .md + .csv pair (MD provides IEP fields, CSV provides paraAppNumbers)
  const handleBundleFile = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setBundleError(""); setBundleData(null); setBundleImported(false);

    const byExt = {};
    for (const f of files) {
      const ext = (f.name.split('.').pop() || '').toLowerCase();
      if (byExt[ext]) {
        setBundleError(`Got two .${ext} files. Pick one .${ext} at a time.`);
        e.target.value = ""; return;
      }
      byExt[ext] = f;
    }

    try {
      let bundle = null;

      // JSON path — must be the only file
      if (byExt.json) {
        if (byExt.md || byExt.csv) {
          setBundleError("Pick a JSON bundle alone, OR an MD file (with optional CSV roster). Not both.");
          e.target.value = ""; return;
        }
        const json = JSON.parse(await byExt.json.text());
        const err = validateBundle(json);
        if (err) { setBundleError(err); e.target.value = ""; return; }
        bundle = json;
      } else if (byExt.md || byExt.csv) {
        // MD / CSV path — assemble a bundle in memory
        const md = byExt.md ? await byExt.md.text() : null;
        const csv = byExt.csv ? await byExt.csv.text() : null;
        bundle = assembleBundleFromFiles({ md, csv });
        if (!bundle.normalizedStudents.students.length) {
          setBundleError("No students found. MD needs `## Student Name` headings; CSV needs Name + 6-digit number columns.");
          e.target.value = ""; return;
        }
      } else {
        setBundleError("Unsupported file type. Use .json, .md, or .csv.");
        e.target.value = ""; return;
      }

      // Show the preview + auto-import in one shot. The preview tile
      // becomes a "what just landed" recap; user doesn't need a 2nd click.
      setBundleData(bundle);
      doBundleImport(bundle);
    } catch (err) {
      setBundleError("Could not parse file: " + err.message);
    }
    e.target.value = "";
  };

  // Accepts an optional bundle arg so it can be invoked inline right after
  // assembly (when React state hasn't flushed yet). Falls back to bundleData
  // when called from the click handler.
  const doBundleImport = (bundleArg) => {
    const data = bundleArg || bundleData;
    if (!data || !onBulkImport) return;

    if (data.privateRosterMap?.privateRosterMap?.length > 0) {
      // Combined JSON with real names — build identity registry
      const { registry, importStudents, periodMap } = buildIdentityRegistry(data);
      const studentList = Object.values(importStudents);
      onBulkImport(studentList, periodMap);
      syncStudentsToCloud(studentList);
      if (registry.length > 0) onIdentityLoad?.(registry);
      setBundleImported(true);
      setTimeout(() => { setBundleImported(false); setBundleData(null); }, 3500);
      if (registry.length > 0) {
        setPendingRosterData(registry);
        setShowRosterSaveModal(true);
      } else {
        setShowMissingNamesModal(true);
      }
    } else {
      // Plain bundle without privateRosterMap — import with bundle pseudonyms, no real names
      const rawStudents = data.normalizedStudents.students;
      const normalized  = rawStudents.map(s => normalizeImportedStudent(s));
      const periodMapUpdates = {};
      normalized.forEach(s => {
        if (!s.periodId) return;
        if (!periodMapUpdates[s.periodId]) periodMapUpdates[s.periodId] = [];
        periodMapUpdates[s.periodId].push(s.id);
      });
      onBulkImport(normalized, periodMapUpdates);
      syncStudentsToCloud(normalized);
      setBundleImported(true);
      setTimeout(() => { setBundleImported(false); setBundleData(null); }, 3500);
      setShowMissingNamesModal(true);
    }
  };

  const handleMasterRosterFile = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setMasterRosterError(""); setMasterRosterData(null); setMasterRosterImported(false);
    try {
      const json = JSON.parse(await file.text());
      const err = validateMasterRoster(json);
      if (err) { setMasterRosterError(err); e.target.value = ""; return; }
      setMasterRosterData(json);
    } catch (err) { setMasterRosterError("Could not parse JSON: " + err.message); }
    e.target.value = "";
  };

  const doMasterRosterImport = () => {
    if (!masterRosterData || !onBulkImport) return;
    const { registry, importStudents, periodMap } = buildIdentityRegistryFromMasterRoster(masterRosterData);
    const studentList = Object.values(importStudents);
    onBulkImport(studentList, periodMap);
    syncStudentsToCloud(studentList);
    if (registry.length > 0) onIdentityLoad?.(registry);
    setMrImportedStudentCount(Object.keys(importStudents).length);
    setMasterRosterImported(true);
    setTimeout(() => { setMasterRosterImported(false); setMasterRosterData(null); }, 3500);
    if (registry.length > 0) {
      setPendingRosterData(registry);
      setShowRosterSaveModal(true);
    }
  };

  // ── Prepared import handlers ─────────────────────────────────
  const handlePreparedFile = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setPreparedError(""); setPreparedData(null); setPreparedImported(false);
    try {
      const json = JSON.parse(await file.text());
      const err = validateBundle(json);
      if (err) { setPreparedError(err); return; }
      setPreparedData(json);
    } catch (err) { setPreparedError("Could not parse JSON: " + err.message); }
    e.target.value = "";
  };

  const doPreparedImport = () => {
    if (!preparedData || !onBulkImport) return;
    // Reuse the same logic as bundle import
    if (preparedData.privateRosterMap?.privateRosterMap?.length > 0) {
      const { registry, importStudents, periodMap } = buildIdentityRegistry(preparedData);
      const studentList = Object.values(importStudents);
      onBulkImport(studentList, periodMap);
      syncStudentsToCloud(studentList);
      if (registry.length > 0) onIdentityLoad?.(registry);
      setPreparedImported(true);
      if (registry.length > 0) {
        setPendingRosterData(registry);
        setShowRosterSaveModal(true);
      }
    } else {
      const rawStudents = preparedData.normalizedStudents.students;
      const normalized = rawStudents.map(s => normalizeImportedStudent(s));
      const periodMapUpdates = {};
      normalized.forEach(s => {
        if (!s.periodId) return;
        if (!periodMapUpdates[s.periodId]) periodMapUpdates[s.periodId] = [];
        periodMapUpdates[s.periodId].push(s.id);
      });
      onBulkImport(normalized, periodMapUpdates);
      syncStudentsToCloud(normalized);
      setPreparedImported(true);
    }
  };

  // ── Bundle summary helpers ───────────────────────────────────
  const bundleStudents = bundleData?.normalizedStudents?.students || [];
  const bundleSummary = {
    total:          bundleStudents.length,
    profileMissing: bundleStudents.filter(s => s.flags?.profileMissing).length,
    iepPending:     bundleStudents.filter(s => s.flags?.iepNotYetOnFile).length,
    crossPeriod:    bundleStudents.filter(s => s.flags?.crossPeriod).length,
    withAlerts:     bundleStudents.filter(s => s.flags?.alert || s.alertText).length,
  };

  // ── Master Roster summary helpers ────────────────────────────
  const mrStudents = masterRosterData?.students || [];
  const mrPeriods  = masterRosterData?.periods  || [];
  const mrCrossPeriodCount = mrStudents.filter(s => Array.isArray(s.periodIds) && s.periodIds.length > 1).length;
  const mrWithParaNumber   = mrStudents.filter(s => s.paraAppNumber || s.externalKey || s.externalStudentKey).length;

  // ── Private Roster accumulator ────────────────────────────────
  const [exportedPrivateRoster, setExportedPrivateRoster] = useState([]);

  const downloadPrivateRosterJSON = () => {
    const json = {
      schemaVersion: "1.0",
      type: "privateRoster",
      createdAt: new Date().toISOString(),
      students: exportedPrivateRoster,
    };
    const dateStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const url = URL.createObjectURL(new Blob([JSON.stringify(json, null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `private-roster-${dateStr}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  };

  // Browser-side download of bundle-derived Private Roster.
  // Names come from the modal inputs the user filled in.
  // Never calls a server; no real names leave the device.
  const downloadPrivateRosterFromBundle = () => {
    const dateStr = new Date().toISOString().slice(0, 10);
    const json = {
      type: "privateRoster",
      schemaVersion: "2.0",
      createdAt: new Date().toISOString(),
      students: pendingRosterData, // [{ realName, pseudonym, color, periodIds, classLabels }]
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(json, null, 2)], { type: "application/json" })
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `private-roster-${dateStr}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    setShowRosterSaveModal(false);
  };

  const [rawText, setRawText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState(null);
  const [parseError, setParseError] = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState("p1");
  const [imported, setImported] = useState(false);
  // Captures the pseudonym at the moment of import (importedCount increments on re-render, so we freeze it)
  const [lastImportedPseudonym, setLastImportedPseudonym] = useState("");
  const [manualFields, setManualFields] = useState({
    studentName: "", gradeLevel: "", classLabel: "", subject: "",
    teacherName: "", caseManager: "", eligibility: "",
    accommodations: "", goals: "", behaviorNotes: "",
    strengths: "", triggers: "", strategies: "", tags: "",
  });
  const fileRef = useRef();

  const { pseudonym, color: slotColor, identity: slotIdentity } = resolveStudentSlot(importedCount);

  // ── File upload handler ───────────────────────────────────
  const handleFileUpload = async e => {
    const file = e.target.files[0];
    if (!file) return;
    setParsing(true); setParseError(""); setParsed(null);

    try {
      let text = "";
      if (file.type === "application/pdf") {
        text = await extractPDFText(file);
        setRawText("[PDF extracted locally — no data sent externally]");
      } else {
        text = await file.text();
        setRawText(text);
      }
      // Auto-parse after upload
      await runParse(text);
    } catch (err) {
      setParseError(err.message);
      setParsing(false);
    }
    e.target.value = "";
  };

  // ── Core parse function ───────────────────────────────────
  const runParse = async (text) => {
    setParsing(true); setParseError(""); setParsed(null);
    try {
      const result = await ollamaParseIEP(text.slice(0, 6000));
      if (!result) throw new Error("AI returned an unexpected format. Try Manual Entry or check that Ollama is running.");
      setParsed(result);
    } catch (err) {
      setParseError(err.message || "Parsing failed. Is Ollama running? (ollama serve)");
    }
    setParsing(false);
  };

  const handleParseAI = () => {
    if (!rawText.trim()) return;
    runParse(rawText);
  };

  // ── Manual entry builder ──────────────────────────────────
  const buildFromManual = () => ({
    studentName: manualFields.studentName || "Unknown",
    gradeLevel: manualFields.gradeLevel || null,
    classLabel: manualFields.classLabel || null,
    subject: manualFields.subject || null,
    teacherName: manualFields.teacherName || null,
    caseManager: manualFields.caseManager || null,
    eligibility: manualFields.eligibility || "Not specified",
    accommodations: manualFields.accommodations ? manualFields.accommodations.split("\n").map(s => s.trim()).filter(Boolean) : [],
    goals: manualFields.goals ? manualFields.goals.split("\n").filter(Boolean).map((t, i) => ({ text: t.trim(), id: `goal_imp_${i}`, area: "General", subject: manualFields.subject || "All" })) : [],
    behaviorNotes: manualFields.behaviorNotes || null,
    strengths: manualFields.strengths || null,
    triggers: manualFields.triggers || null,
    strategies: manualFields.strategies ? manualFields.strategies.split("\n").map(s => s.trim()).filter(Boolean) : [],
    tags: manualFields.tags ? manualFields.tags.split(",").map(s => s.trim().toLowerCase()).filter(Boolean) : [],
  });

  const getActiveParsed = () => inputMode === "manual" ? buildFromManual() : parsed;

  // ── Import into app ───────────────────────────────────────
  const handleImport = () => {
    const data = getActiveParsed();
    if (!data) return;
    const id = `stu_imp_${Date.now()}`;
    const goals = (data.goals || []).map((g, i) => ({
      id: g.id || `goal_imp_${id}_${i}`,
      text: g.text || g,
      area: g.area || "General",
      subject: g.subject || data.subject || "All",
    }));
    const studentObj = {
      id, pseudonym, color: slotColor, identity: slotIdentity,
      eligibility: data.eligibility || "Imported",
      accs: data.accommodations || [],
      caseManager: data.caseManager || "",
      goalArea: goals.map(g => g.area).filter((v, i, a) => a.indexOf(v) === i).join(", ") || "See Goals",
      goals, behaviorNotes: data.behaviorNotes || "", strengths: data.strengths || "",
      triggers: data.triggers || "", strategies: data.strategies || [],
      tags: data.tags || [], imported: true, importedAt: new Date().toISOString(),
    };
    const privateMapping = {
      studentId: id, pseudonym, realName: data.studentName || "Unknown",
      realClass: data.classLabel || data.subject || "",
      teacherName: data.teacherName || "",
      caseManager: data.caseManager || "", gradeLevel: data.gradeLevel || "",
    };
    onImport(studentObj, selectedPeriod, privateMapping);
    // Always create a roster entry so the download CTA always appears.
    // realName is "" if AI didn't extract one — user can fill it in after downloading.
    const capturedName = (data.studentName && data.studentName !== "Unknown") ? data.studentName : "";
    setExportedPrivateRoster(prev => {
      const alreadyExists = prev.some(e => e.displayLabel === pseudonym);
      if (alreadyExists) return prev;
      return [...prev, { color: slotColor, displayLabel: pseudonym, realName: capturedName }];
    });
    setLastImportedPseudonym(pseudonym); // freeze the name before importedCount re-renders
    setImported(true);
    setTimeout(() => {
      setImported(false);
      setLastImportedPseudonym("");
      setParsed(null);
      setRawText("");
      setParseError("");
    }, 3000);
  };

  const downloadJSON = (obj, filename) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" }));
    a.download = filename; a.click();
  };

  const data = getActiveParsed();

  return (
    <div style={{ padding: "var(--space-6)", maxWidth: 1100, margin: "0 auto" }}>
      <div className="header">
        <div>
          <h1 style={{ fontSize: 28 }}>IEP Import</h1>
          <p className="teacher-subtitle" style={{ fontSize: 14, maxWidth: 720, lineHeight: 1.55 }}>
            Bring student rosters and IEP summaries into SupaPara. Only a working
            summary lives in the app — goals, accommodations, strategies. Full IEP
            documents stay with your Special Ed Teacher / case manager. Everything
            is parsed on this device — real names never leave your browser unless
            you explicitly enable "Remember on this device."
          </p>
        </div>
      </div>

      {/* Private Roster ready — persistent, always shown after any import */}
      {exportedPrivateRoster.length > 0 && (
        <div style={{ marginBottom: "14px", padding: "14px 16px", background: "#071a0e", border: "2px solid #16a34a", borderRadius: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: "13px", color: "#4ade80", fontWeight: "800", marginBottom: "2px" }}>
                🔒 Private Roster JSON ready — {exportedPrivateRoster.length} student{exportedPrivateRoster.length !== 1 ? "s" : ""}
              </div>
              <div style={{ fontSize: "11px", color: "#4b7a5a" }}>
                {exportedPrivateRoster.some(e => !e.realName)
                  ? "Some names were not extracted — fill them in after downloading, then reload via the 👤 sidebar button."
                  : "All names captured. Download and keep this file private — reload it via the 👤 sidebar button."}
              </div>
            </div>
            <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
              <button onClick={downloadPrivateRosterJSON}
                style={{ padding: "9px 18px", borderRadius: "8px", border: "1px solid #16a34a", background: "#14532d", color: "#4ade80", fontSize: "13px", fontWeight: "800", cursor: "pointer", whiteSpace: "nowrap" }}>
                ↓ Save Private Roster JSON
              </button>
              <button onClick={() => setExportedPrivateRoster([])} title="Clear roster"
                style={{ padding: "9px 12px", borderRadius: "8px", border: "1px solid #1e3a5f", background: "transparent", color: "#475569", fontSize: "12px", cursor: "pointer" }}>
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Row 1 — three fallback workflows. Smart Import is below, full-width. */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: "var(--space-4)",
        marginBottom: "var(--space-4)",
      }}>
        <ImportModeCard
          id="rosterOnly"
          active={inputMode === "rosterOnly"}
          icon="👥"
          title="Names + Para #s only"
          subtitle="Seed names without IEPs"
          tone="#7a9cff"
          body="Just the name-to-Para-App-Number map. No IEP data. Useful if you want to get real names into the vault first and import IEPs separately later."
          when="Use when IEPs aren't ready yet but you want the roster in."
          onClick={() => setInputMode("rosterOnly")}
        />
        <ImportModeCard
          id="bundle"
          active={inputMode === "bundle"}
          icon="📦"
          title="App Bundle"
          subtitle="JSON, Markdown, or MD + CSV roster"
          tone="#a78bfa"
          body="Drop in a complete bundle (.json), a structured Markdown summary (.md), or a Markdown summary paired with a roster CSV. The richest import — students come in with full IEP data."
          when="Use this when you have a complete bundle from SupaPara, your admin, or the docx-extractor output."
          onClick={() => { setInputMode("bundle"); setParsed(null); setParseError(""); setMasterRosterData(null); setMasterRosterError(""); setMasterRosterImported(false); setPreparedData(null); setPreparedError(""); setPreparedImported(false); }}
        />
        <ImportModeCard
          id="masterRoster"
          active={inputMode === "masterRoster"}
          icon="🗂️"
          title="Master Roster"
          subtitle="Class-by-class roster with IEPs embedded"
          tone="#34d399"
          body="A school/district export: top-level students + periods arrays, full IEP fields on each kid. Real names are read from fullName and flow through the vault if Para App Numbers are present."
          when="Use this for the '…_fullName_fixed.json' style files from your admin."
          onClick={() => { setInputMode("masterRoster"); setParsed(null); setParseError(""); setBundleError(""); setPreparedData(null); setPreparedError(""); setPreparedImported(false); }}
        />
      </div>

      {/* Row 2 — Smart Import as the big wide hero banner. Same width as the 3 cards above. */}
      <SmartImportBanner
        active={inputMode === "smart"}
        onClick={() => setInputMode("smart")}
      />

      {/* Row 3 — Roster Health Check. Para-friendly diagnostic for import issues. */}
      <button
        onClick={() => { setInputMode("verify"); setParsed(null); setParseError(""); setBundleError(""); setMasterRosterError(""); setPreparedError(""); }}
        style={{
          marginTop: "var(--space-4)", marginBottom: "var(--space-4)",
          width: "100%", padding: "12px 16px",
          borderRadius: "var(--radius-md)",
          border: `1px solid ${inputMode === "verify" ? "#3b82f6" : "var(--border)"}`,
          background: inputMode === "verify" ? "#0c1a2e" : "var(--panel-bg)",
          color: inputMode === "verify" ? "#60a5fa" : "var(--text-secondary)",
          fontSize: 13, fontWeight: 600, cursor: "pointer", textAlign: "left",
          display: "flex", alignItems: "center", gap: 12,
        }}
      >
        <span style={{ fontSize: 18 }}>🔍</span>
        <span style={{ flex: 1 }}>
          <span style={{ fontWeight: 700 }}>Verify Roster</span>
          <span style={{ fontWeight: 400, marginLeft: 8, color: "var(--text-muted)", fontSize: 12 }}>
            See exactly which kids are loaded, flag missing or orphaned ones
          </span>
        </span>
      </button>

      {/* Advanced — collapsed by default; single-student / demo flows */}
      <details style={{ marginBottom: "var(--space-5)" }}>
        <summary style={{
          cursor: "pointer", userSelect: "none",
          fontSize: 13, fontWeight: 600,
          color: "var(--text-secondary)",
          padding: "var(--space-3) var(--space-4)",
          background: "var(--panel-bg)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-md)",
        }}>
          Advanced import options (single student, demo profiles, manual entry)
        </summary>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "var(--space-3)",
          marginTop: "var(--space-3)",
        }}>
          {[
            ["prepared",  "🎯", "Load Profiles",  "Prepared demo profiles"],
            ["upload",    "📎", "Upload PDF",     "Single student IEP PDF"],
            ["paste",     "📋", "Paste Text",     "Paste raw IEP text"],
            ["manual",    "✏️", "Manual Entry",   "Type a student in by hand"],
          ].map(([id, icon, title, sub]) => (
            <button
              key={id}
              onClick={() => { setInputMode(id); setParsed(null); setParseError(""); setBundleError(""); setMasterRosterData(null); setMasterRosterError(""); setMasterRosterImported(false); setPreparedError(""); setPreparedData(null); setPreparedImported(false); }}
              style={{
                padding: "var(--space-3) var(--space-4)",
                background: inputMode === id ? "var(--accent-glow)" : "var(--bg-dark)",
                border: `1px solid ${inputMode === id ? "var(--accent-border)" : "var(--border)"}`,
                borderRadius: "var(--radius-md)",
                color: inputMode === id ? "var(--accent-hover)" : "var(--text-secondary)",
                cursor: "pointer", textAlign: "left",
                display: "flex", alignItems: "center", gap: "var(--space-3)",
                minHeight: 56,
                fontFamily: "inherit",
                transition: "all 160ms cubic-bezier(0.16,1,0.3,1)",
              }}
            >
              <span style={{ fontSize: 22, flexShrink: 0 }}>{icon}</span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 13, fontWeight: 700 }}>{title}</span>
                <span style={{ display: "block", fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>{sub}</span>
              </span>
            </button>
          ))}
        </div>
      </details>

      {/* ── SMART IMPORT (flagship: roster + IEP doc, AI-driven) ─── */}
      {inputMode === "smart" && (
        <SmartImport
          onBulkImport={onBulkImport}
          onIdentityLoad={onIdentityLoad}
        />
      )}

      {/* ── ROSTER ONLY (Names + Para App Numbers; seeds the vault) ─── */}
      {inputMode === "rosterOnly" && <RosterOnlyImport />}

      {/* ── VERIFY ROSTER (self-diagnostic — what landed where) ─────── */}
      {inputMode === "verify" && (
        <VerifyRoster
          importedStudents={importedStudents || {}}
          vault={vault || {}}
          onRemoveOrphan={onRemoveOrphan}
          cloudStudents={cloudStudents || []}
          onRemoveCloudOrphan={onRemoveCloudOrphan}
          isOwnerOrAdmin={!!isOwnerOrAdmin}
        />
      )}

      {/* ── PREPARED PROFILES (simplified demo import) ────────── */}
      {inputMode === "prepared" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

          {/* Friendly intro */}
          <div style={{ padding: "14px 16px", background: "#0c1a3d", border: "1px solid #1d4ed8", borderRadius: "12px", fontSize: "13px", color: "#93c5fd", lineHeight: "1.7" }}>
            <strong style={{ color: "#60a5fa" }}>Load Prepared Student Profiles</strong><br />
            Upload a JSON file with pre-built student profiles (goals, accommodations, strategies, schedules). This is the fastest way to get started.
          </div>

          {/* File input */}
          <input type="file" ref={preparedFileRef} style={{ display: "none" }} accept=".json" onChange={handlePreparedFile} />

          {/* Big upload button */}
          <button onClick={() => preparedFileRef.current?.click()}
            style={{
              width: "100%", padding: "28px 20px", borderRadius: "14px",
              border: `2px dashed ${preparedData ? "#1d4ed8" : "#334155"}`,
              background: preparedData ? "#0c1a3d" : "var(--bg-surface)",
              color: preparedData ? "#60a5fa" : "var(--text-primary)",
              fontSize: "16px", fontWeight: "700", cursor: "pointer",
              display: "flex", flexDirection: "column", alignItems: "center", gap: "8px",
            }}>
            <span style={{ fontSize: "36px" }}>{preparedData ? "✓" : "📁"}</span>
            <span>{preparedData
              ? `Loaded — ${preparedData.normalizedStudents.students.length} student${preparedData.normalizedStudents.students.length !== 1 ? "s" : ""} ready`
              : "Upload your prepared student file"
            }</span>
            {!preparedData && <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: "400" }}>The one-file version your admin prepared</span>}
          </button>

          {/* Validation error */}
          {preparedError && (
            <div style={{ padding: "10px 14px", background: "#1a0505", border: "1px solid #7f1d1d", borderRadius: "8px", fontSize: "12px", color: "#f87171" }}>
              {preparedError}
            </div>
          )}

          {/* Preview + import */}
          {preparedData && !preparedImported && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
                {[
                  { label: "Students", val: preparedData.normalizedStudents.students.length, color: "#e2e8f0" },
                  { label: "With Goals", val: preparedData.normalizedStudents.students.filter(s => (s.goals || []).length > 0).length, color: "#60a5fa" },
                  { label: "With Accs", val: preparedData.normalizedStudents.students.filter(s => (s.accs || s.accommodations || []).length > 0).length, color: "#4ade80" },
                ].map(({ label, val, color }) => (
                  <div key={label} style={{ background: "var(--bg-surface)", borderRadius: "8px", padding: "10px 12px", textAlign: "center" }}>
                    <div style={{ fontSize: "22px", fontWeight: "700", color }}>{val}</div>
                    <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "2px" }}>{label}</div>
                  </div>
                ))}
              </div>

              <button onClick={doPreparedImport}
                style={{ width: "100%", padding: "14px", borderRadius: "12px", border: "1px solid #1d4ed8", background: "#0c1a3d", color: "#60a5fa", fontSize: "15px", fontWeight: "800", cursor: "pointer" }}>
                Load {preparedData.normalizedStudents.students.length} student{preparedData.normalizedStudents.students.length !== 1 ? "s" : ""} into the app
              </button>
            </>
          )}

          {/* Success */}
          {preparedImported && (
            <div style={{ padding: "20px", borderRadius: "12px", background: "#0d2010", border: "2px solid #166534", color: "#4ade80", textAlign: "center", fontSize: "16px", fontWeight: "700" }}>
              Profiles loaded! Navigate to your schedule to start working.
            </div>
          )}

          {/* Divider */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px", margin: "4px 0" }}>
            <div style={{ flex: 1, height: "1px", background: "#1e293b" }} />
            <span style={{ fontSize: "11px", color: "#475569", fontWeight: "600" }}>OR</span>
            <div style={{ flex: 1, height: "1px", background: "#1e293b" }} />
          </div>

          {/* Demo students button */}
          <button
            onClick={() => {
              if (onLoadDemo) {
                onLoadDemo({ incidents: DEMO_INCIDENTS, interventions: DEMO_INTERVENTIONS, outcomes: DEMO_OUTCOMES, logs: DEMO_LOGS });
                setPreparedImported(true);
              }
            }}
            style={{
              width: "100%", padding: "12px", borderRadius: "10px",
              border: "1px solid #334155", background: "var(--bg-surface)",
              color: "var(--text-secondary)", fontSize: "13px", fontWeight: "600", cursor: "pointer",
            }}>
            Load Demo Students (try the app with sample data)
          </button>
        </div>
      )}

      {/* ── BUNDLE IMPORT UI ─────────────────────────────────── */}
      {inputMode === "bundle" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

          {/* Privacy notice */}
          <div style={{ padding: "10px 14px", background: "#12102a", border: "1px solid #4c1d95", borderRadius: "10px", fontSize: "11px", color: "#c4b5fd", lineHeight: "1.6" }}>
            🔒 <strong>Safe to use:</strong> This file has fake names only. If it also includes real names, they stay on this computer — never sent to the cloud, AI, or anyone else.
          </div>

          {/* Bundle file input — accepts JSON bundle, OR MD (+optional CSV roster) */}
          <input type="file" ref={bundleFileRef} style={{ display: "none" }} accept=".json,.md,.csv" multiple onChange={handleBundleFile} />

          {/* Upload button */}
          <button onClick={() => bundleFileRef.current?.click()}
            style={{ width: "100%", padding: "14px 20px", borderRadius: "10px", border: `2px solid ${bundleData ? "#6d28d9" : "var(--border-light)"}`, background: bundleData ? "#12102a" : "var(--bg-surface)", color: bundleData ? "#a78bfa" : "var(--text-primary)", fontSize: "14px", fontWeight: "700", cursor: "pointer", display: "flex", alignItems: "center", gap: "12px", textAlign: "left" }}>
            <span style={{ fontSize: "22px" }}>📦</span>
            <span>{bundleData ? `✓ File loaded` : "Upload your student file (.json, .md, or .md + .csv)"}</span>
          </button>

          {/* Validation error */}
          {bundleError && (
            <div style={{ padding: "10px 14px", background: "#1a0505", border: "1px solid #7f1d1d", borderRadius: "8px", fontSize: "12px", color: "#f87171" }}>
              ✗ {bundleError}
            </div>
          )}

          {/* Preview table + summary */}
          {bundleData && !bundleImported && (
            <>
              {/* Summary counters */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "8px" }}>
                {[
                  { label: "Total",          val: bundleSummary.total,          color: "#e2e8f0" },
                  { label: "Profile Missing",val: bundleSummary.profileMissing, color: "#f87171"  },
                  { label: "IEP Pending",    val: bundleSummary.iepPending,     color: "#fbbf24"  },
                  { label: "Multi-Period",   val: bundleSummary.crossPeriod,    color: "#60a5fa"  },
                  { label: "With Alerts",    val: bundleSummary.withAlerts,     color: "#f87171"  },
                ].map(({ label, val, color }) => (
                  <div key={label} style={{ background: "var(--bg-surface)", borderRadius: "8px", padding: "10px 12px", textAlign: "center" }}>
                    <div style={{ fontSize: "22px", fontWeight: "700", color }}>{val}</div>
                    <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "2px" }}>{label}</div>
                  </div>
                ))}
              </div>

              {/* Preview table */}
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)" }}>
                      {["Pseudonym", "Period", "Subject", "Teacher", "Eligibility", "Flags", "Goals", "Accs"].map(h => (
                        <th key={h} style={{ padding: "6px 10px", textAlign: "left", color: "var(--text-muted)", fontWeight: "600", fontSize: "11px", whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {bundleStudents.map((s, i) => {
                      const flags = s.flags || {};
                      const flagBadges = [
                        flags.alert           && { label: "⚠", color: "#f87171", bg: "#1a0505" },
                        flags.iepNotYetOnFile  && { label: "IEP?", color: "#fbbf24", bg: "#1a1505" },
                        flags.profileMissing   && { label: "No Profile", color: "#f87171", bg: "#1a0505" },
                        flags.crossPeriod      && { label: "Multi", color: "#60a5fa", bg: "#0c1a2e" },
                      ].filter(Boolean);
                      return (
                        <tr key={s.id || i} style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "rgba(0,0,0,.1)" : "transparent" }}>
                          <td style={{ padding: "7px 10px", fontWeight: "700", color: s.color || "#e2e8f0", whiteSpace: "nowrap" }}>
                            <span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", background: s.color || "#94a3b8", marginRight: "6px", verticalAlign: "middle" }} />
                            {s.pseudonym || "—"}
                          </td>
                          <td style={{ padding: "7px 10px", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>{s.periodId || "—"}</td>
                          <td style={{ padding: "7px 10px", color: "var(--text-secondary)" }}>{s.subject || "—"}</td>
                          <td style={{ padding: "7px 10px", color: "var(--text-muted)" }}>{s.teacherName || "—"}</td>
                          <td style={{ padding: "7px 10px", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>{s.eligibility || "—"}</td>
                          <td style={{ padding: "7px 10px" }}>
                            <div style={{ display: "flex", gap: "3px", flexWrap: "wrap" }}>
                              {flagBadges.map((f, fi) => (
                                <span key={fi} style={{ fontSize: "10px", background: f.bg, color: f.color, padding: "1px 6px", borderRadius: "20px", whiteSpace: "nowrap" }}>{f.label}</span>
                              ))}
                              {flagBadges.length === 0 && <span style={{ fontSize: "10px", color: "#334155" }}>—</span>}
                            </div>
                          </td>
                          <td style={{ padding: "7px 10px", color: "var(--text-muted)", textAlign: "center" }}>{(s.goals || []).length}</td>
                          <td style={{ padding: "7px 10px", color: "var(--text-muted)", textAlign: "center" }}>{(s.accs || s.accommodations || []).length}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Import button */}
              <button onClick={doBundleImport}
                style={{ width: "100%", padding: "14px", borderRadius: "12px", border: "1px solid #6d28d9", background: "#1e1b4b", color: "#a78bfa", fontSize: "15px", fontWeight: "800", cursor: "pointer" }}>
                📦 Load {bundleSummary.total} student{bundleSummary.total !== 1 ? "s" : ""} into the app
              </button>

            </>
          )}

          {/* Success banner */}
          {bundleImported && (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ padding: "20px", borderRadius: "12px", background: "#0d2010", border: "2px solid #166534", color: "#4ade80", textAlign: "center", fontSize: "16px", fontWeight: "700" }}>
                ✓ {bundleSummary.total} student{bundleSummary.total !== 1 ? "s" : ""} loaded!
              </div>
              <div style={{ padding: "12px 16px", borderRadius: "10px", background: "#12102a", border: "1px solid #4c1d95", fontSize: "12px", color: "#c4b5fd", lineHeight: "1.6" }}>
                👤 <strong>Have a saved name list file?</strong> Load it now using the <strong>👤 Real Names</strong> button in the left sidebar so you see real names next to each student.
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── MASTER ROSTER IMPORT UI ─────────────────────────── */}
      {inputMode === "masterRoster" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

          {/* Privacy notice */}
          <div style={{ padding: "10px 14px", background: "#071a0e", border: "1px solid #166534", borderRadius: "10px", fontSize: "11px", color: "#4ade80", lineHeight: "1.6" }}>
            🔒 <strong>Safe to use:</strong> Real names stay on this computer only. They're never sent to the cloud, AI, or anyone else. The shared version uses only Para App Numbers.
          </div>

          {/* Duplicate-import warning */}
          {importedCount > 0 && (
            <div style={{ padding: "10px 14px", background: "#1a1505", border: "1px solid #854d0e", borderRadius: "10px", fontSize: "11px", color: "#fbbf24", lineHeight: "1.6" }}>
              ⚠ <strong>You already have {importedCount} student{importedCount !== 1 ? "s" : ""} loaded.</strong> Loading another name list will add duplicates. Clear the current students first if you want to start fresh.
            </div>
          )}

          {/* File input */}
          <input type="file" ref={masterRosterFileRef} style={{ display: "none" }} accept=".json" onChange={handleMasterRosterFile} />

          {/* Upload button */}
          <button onClick={() => masterRosterFileRef.current?.click()}
            style={{ width: "100%", padding: "14px 20px", borderRadius: "10px", border: `2px solid ${masterRosterData ? "#166534" : "var(--border-light)"}`, background: masterRosterData ? "#071a0e" : "var(--bg-surface)", color: masterRosterData ? "#4ade80" : "var(--text-primary)", fontSize: "14px", fontWeight: "700", cursor: "pointer", display: "flex", alignItems: "center", gap: "12px", textAlign: "left" }}>
            <span style={{ fontSize: "22px" }}>🗂️</span>
            <span>{masterRosterData ? `✓ Loaded — ${mrStudents.length} student${mrStudents.length !== 1 ? "s" : ""} across ${mrPeriods.length} period${mrPeriods.length !== 1 ? "s" : ""}` : "Upload a school-style name list"}</span>
          </button>

          {/* Validation error */}
          {masterRosterError && (
            <div style={{ padding: "10px 14px", background: "#1a0505", border: "1px solid #7f1d1d", borderRadius: "8px", fontSize: "12px", color: "#f87171" }}>
              ✗ {masterRosterError}
            </div>
          )}

          {/* Preview */}
          {masterRosterData && !masterRosterImported && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px" }}>
                {[
                  { label: "Students",      val: mrStudents.length,      color: "#e2e8f0" },
                  { label: "Periods",       val: mrPeriods.length,       color: "#60a5fa" },
                  { label: "Multi-Period",  val: mrCrossPeriodCount,     color: "#4ade80" },
                  { label: "Para App #s",   val: mrWithParaNumber,       color: mrWithParaNumber === mrStudents.length ? "#4ade80" : "#fbbf24" },
                ].map(({ label, val, color }) => (
                  <div key={label} style={{ background: "var(--bg-surface)", borderRadius: "8px", padding: "10px 12px", textAlign: "center" }}>
                    <div style={{ fontSize: "22px", fontWeight: "700", color }}>{val}</div>
                    <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "2px" }}>{label}</div>
                  </div>
                ))}
              </div>

              {/* Para App Numbers preview — first 6 with names */}
              {mrWithParaNumber > 0 && (
                <div style={{
                  padding: "10px 12px",
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  fontSize: 11, color: "var(--text-muted)", lineHeight: 1.6,
                }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>
                    Para App Numbers detected
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {mrStudents.filter(s => s.paraAppNumber).slice(0, 8).map(s => (
                      <span key={s.id} className="mono" style={{
                        padding: "2px 8px",
                        background: "var(--bg-dark)",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius-pill)",
                        color: "var(--text-secondary)",
                        fontSize: 11,
                      }}>
                        #{s.paraAppNumber} <span style={{ color: "var(--text-muted)" }}>· {s.fullName || "—"}</span>
                      </span>
                    ))}
                    {mrWithParaNumber > 8 && (
                      <span style={{ fontSize: 11, color: "var(--text-muted)", alignSelf: "center" }}>
                        + {mrWithParaNumber - 8} more
                      </span>
                    )}
                  </div>
                </div>
              )}

              <button onClick={doMasterRosterImport}
                style={{ width: "100%", padding: "14px", borderRadius: "12px", border: "1px solid #166534", background: "#0d2010", color: "#4ade80", fontSize: "15px", fontWeight: "800", cursor: "pointer" }}>
                🗂️ Load {mrStudents.length} student{mrStudents.length !== 1 ? "s" : ""} into the app
              </button>
            </>
          )}

          {/* Success banner */}
          {masterRosterImported && (
            <div style={{ padding: "20px", borderRadius: "12px", background: "#0d2010", border: "2px solid #166534", color: "#4ade80", textAlign: "center", fontSize: "16px", fontWeight: "700" }}>
              ✓ {mrImportedStudentCount} student{mrImportedStudentCount !== 1 ? "s" : ""} loaded
              {mrWithParaNumber > 0 && (
                <div style={{ fontSize: 13, fontWeight: 500, marginTop: 4, color: "#86efac" }}>
                  {mrWithParaNumber} Para App Number{mrWithParaNumber !== 1 ? "s" : ""} attached — paras can find their students by these numbers.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── ORIGINAL IEP/AI IMPORT (paste / upload / manual) ──── */}
      {inputMode !== "prepared" && inputMode !== "bundle" && inputMode !== "masterRoster" && <div style={{ display: "grid", gridTemplateColumns: parsed || inputMode === "manual" ? "1fr 1fr" : "1fr", gap: "20px" }}>

        {/* Left: Input */}
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>

          {/* Privacy notice — updated for local AI */}
          <div style={{ padding: "10px 14px", background: "#0d1a2e", border: "1px solid #1d4ed8", borderRadius: "10px", fontSize: "11px", color: "#93c5fd", lineHeight: "1.6" }}>
            🔒 <strong>Fully private:</strong> PDF text is extracted locally in your browser. AI parsing runs on your local Ollama instance. <strong>No data leaves your computer.</strong> Real student names are never stored in the app — they stay in Private Roster Panel only.
          </div>

          {inputMode === "paste" && (
            <div>
              <label style={{ fontSize: "12px", color: "var(--text-secondary)", display: "block", marginBottom: "6px", fontWeight: "600" }}>Paste IEP or support document text:</label>
              <textarea value={rawText} onChange={e => setRawText(e.target.value)}
                style={{ width: "100%", minHeight: "220px", padding: "12px", background: "var(--bg-surface)", border: "1px solid var(--border-light)", borderRadius: "10px", color: "var(--text-primary)", fontSize: "13px", lineHeight: "1.6", resize: "vertical", fontFamily: "inherit" }}
                placeholder="Paste the full text of an IEP, support plan, accommodation letter, or any student document here...&#10;&#10;Local AI will extract: eligibility, goals, accommodations, strategies, behavior notes, strengths, and triggers." />
              <button onClick={handleParseAI} disabled={!rawText.trim() || parsing}
                style={{ marginTop: "10px", width: "100%", padding: "12px", borderRadius: "10px", border: "none", background: rawText.trim() && !parsing ? "#1e1b4b" : "var(--bg-surface)", color: rawText.trim() && !parsing ? "#a78bfa" : "var(--text-muted)", fontSize: "14px", fontWeight: "700", cursor: rawText.trim() && !parsing ? "pointer" : "not-allowed", border: "1px solid #4c1d95" }}>
                {parsing ? "✦ Parsing locally..." : "✦ Parse with Local AI"}
              </button>
            </div>
          )}

          {inputMode === "upload" && (
            <div>
              <input type="file" ref={fileRef} style={{ display: "none" }} accept=".pdf,.txt,.doc,.docx" onChange={handleFileUpload} />
              <div onClick={() => fileRef.current?.click()}
                style={{ border: "2px dashed var(--border-light)", borderRadius: "12px", padding: "40px 20px", textAlign: "center", cursor: "pointer", background: "var(--bg-surface)" }}>
                <div style={{ fontSize: "32px", marginBottom: "10px" }}>📎</div>
                <div style={{ fontSize: "14px", fontWeight: "600", color: "var(--text-primary)", marginBottom: "4px" }}>Click to upload file</div>
                <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>PDF, TXT — IEP or support documents</div>
                <div style={{ fontSize: "11px", color: "#475569", marginTop: "6px" }}>PDF text extracted locally — no upload to any server</div>
              </div>
              {rawText && !parsing && (
                <div style={{ marginTop: "10px", padding: "10px", background: "var(--bg-surface)", borderRadius: "8px", fontSize: "12px", color: "#4ade80" }}>
                  ✓ {rawText.startsWith("[PDF") ? "PDF extracted locally — ready to parse" : `File loaded (${rawText.length} chars)`}
                </div>
              )}
              {parsing && <div style={{ marginTop: "10px", color: "#a78bfa", fontSize: "13px", fontStyle: "italic", textAlign: "center" }}>✦ Local AI parsing document...</div>}
            </div>
          )}

          {inputMode === "manual" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ fontSize: "12px", color: "var(--text-secondary)", fontWeight: "600" }}>Fill in what you know — all fields optional:</div>
              {[
                ["studentName", "Student Name (real — stays private)"],
                ["eligibility", "Eligibility (e.g. SLD + ADHD)"],
                ["caseManager", "Case Manager"],
                ["gradeLevel", "Grade Level"],
                ["classLabel", "Class / Period Label"],
                ["subject", "Subject"],
                ["teacherName", "Teacher Name"],
              ].map(([k, label]) => (
                <div key={k}>
                  <label style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", marginBottom: "3px" }}>{label}</label>
                  <input value={manualFields[k]} onChange={e => setManualFields(p => ({ ...p, [k]: e.target.value }))}
                    style={{ width: "100%", padding: "8px 10px", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "6px", color: "var(--text-primary)", fontSize: "13px" }} />
                </div>
              ))}
              {[["accommodations", "Accommodations (one per line)"], ["goals", "Goals (one per line)"], ["strategies", "Strategies (one per line)"]].map(([k, label]) => (
                <div key={k}>
                  <label style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", marginBottom: "3px" }}>{label}</label>
                  <textarea value={manualFields[k]} onChange={e => setManualFields(p => ({ ...p, [k]: e.target.value }))}
                    style={{ width: "100%", minHeight: "70px", padding: "8px 10px", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "6px", color: "var(--text-primary)", fontSize: "12px", resize: "vertical", fontFamily: "inherit" }} />
                </div>
              ))}
              {[["behaviorNotes", "Behavior / Para Notes"], ["strengths", "Strengths"], ["triggers", "Triggers"], ["tags", "Tags (comma-separated: sld, adhd...)"]].map(([k, label]) => (
                <div key={k}>
                  <label style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", marginBottom: "3px" }}>{label}</label>
                  <input value={manualFields[k]} onChange={e => setManualFields(p => ({ ...p, [k]: e.target.value }))}
                    style={{ width: "100%", padding: "8px 10px", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "6px", color: "var(--text-primary)", fontSize: "12px" }} />
                </div>
              ))}
            </div>
          )}

          {parseError && (
            <div style={{ padding: "10px 14px", background: "#1a0505", border: "1px solid #7f1d1d", borderRadius: "8px", fontSize: "12px", color: "#f87171" }}>
              ✗ {parseError}
            </div>
          )}
        </div>

        {/* Right: Preview + Import */}
        {(parsed || inputMode === "manual") && data && (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>

            {/* Privacy conversion preview */}
            <div style={{ padding: "14px", background: "#070e1c", border: `2px solid ${slotColor}40`, borderRadius: "12px" }}>
              <div style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: "10px", fontWeight: "600" }}>How the app protects the name</div>
              <div style={{ display: "flex", gap: "12px", alignItems: "center", marginBottom: "8px" }}>
                <div style={{ flex: 1, padding: "8px 12px", background: "#1a0505", borderRadius: "8px", fontSize: "12px", color: "#f87171", textDecoration: "line-through", opacity: .6 }}>
                  {data.studentName || "Student Name"} (stays local only)
                </div>
                <div style={{ fontSize: "16px", color: "var(--text-muted)" }}>→</div>
                <div style={{ flex: 1, padding: "8px 12px", background: slotColor + "18", border: `1px solid ${slotColor}50`, borderRadius: "8px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <div style={{ width: "12px", height: "12px", borderRadius: "50%", background: slotColor, flexShrink: 0 }} />
                  <span style={{ fontSize: "13px", fontWeight: "700", color: slotColor }}>{pseudonym}</span>
                </div>
              </div>
              <div style={{ fontSize: "10px", color: "var(--text-muted)", lineHeight: "1.5" }}>
                The app uses <strong style={{ color: slotColor }}>{pseudonym}</strong> everywhere. The real name stays on this computer only.
              </div>
            </div>

            {/* Extracted fields */}
            <div className="panel" style={{ padding: "14px" }}>
              <div style={{ fontSize: "12px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "12px" }}>What we found</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "12px" }}>
                {data.eligibility && <Row label="Eligibility" value={data.eligibility} color="#60a5fa" />}
                {data.caseManager && <Row label="Case Manager" value={data.caseManager} />}
                {data.gradeLevel && <Row label="Grade" value={data.gradeLevel} />}
                {data.subject && <Row label="Subject" value={data.subject} />}
                {data.teacherName && <Row label="Teacher" value={data.teacherName} />}
                {data.accommodations?.length > 0 && (
                  <div>
                    <div style={{ color: "var(--text-muted)", marginBottom: "4px" }}>Accommodations ({data.accommodations.length}):</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                      {data.accommodations.map((a, i) => <span key={i} style={{ fontSize: "10px", background: "#1e3a5f", color: "#93c5fd", padding: "2px 8px", borderRadius: "20px" }}>{a}</span>)}
                    </div>
                  </div>
                )}
                {data.goals?.length > 0 && (
                  <div>
                    <div style={{ color: "var(--text-muted)", marginBottom: "4px" }}>Goals ({data.goals.length}):</div>
                    {data.goals.map((g, i) => <div key={i} style={{ fontSize: "11px", color: "var(--text-secondary)", padding: "4px 8px", background: "rgba(0,0,0,.2)", borderRadius: "6px", borderLeft: `2px solid ${slotColor}` }}>{(g.text || g).slice(0, 100)}{(g.text || g).length > 100 ? "..." : ""}</div>)}
                  </div>
                )}
                {data.strengths && <Row label="Strengths" value={data.strengths.slice(0, 100)} color="#4ade80" />}
                {data.triggers && <Row label="Triggers" value={data.triggers.slice(0, 100)} color="#f87171" />}
                {data.tags?.length > 0 && (
                  <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                    {data.tags.map((t, i) => <span key={i} style={{ fontSize: "10px", background: slotColor + "20", color: slotColor, padding: "2px 8px", borderRadius: "20px" }}>{t}</span>)}
                  </div>
                )}
              </div>
            </div>

            {/* Period assignment */}
            <div>
              <label style={{ fontSize: "12px", color: "var(--text-secondary)", display: "block", marginBottom: "6px", fontWeight: "600" }}>Add student to which period?</label>
              <select value={selectedPeriod} onChange={e => setSelectedPeriod(e.target.value)} className="period-select" style={{ width: "100%" }}>
                {Object.entries(DB.periods).map(([id, p]) => <option key={id} value={id}>{p.label}</option>)}
              </select>
            </div>

            {imported ? (
              <div style={{ padding: "14px 16px", borderRadius: "12px", background: "#14532d", border: "2px solid #166534", color: "#4ade80", textAlign: "center", fontSize: "15px", fontWeight: "700" }}>
                ✓ {lastImportedPseudonym || pseudonym} added to {DB.periods[selectedPeriod]?.label}! — See green bar above to save Private Roster
              </div>
            ) : (
              <button onClick={handleImport}
                style={{ width: "100%", padding: "14px", borderRadius: "12px", border: "none", background: slotColor, color: "#000", fontSize: "15px", fontWeight: "700", cursor: "pointer" }}>
                Add {pseudonym} to App
              </button>
            )}

            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={() => {
                const safeJSON = { id: `stu_preview_${Date.now()}`, pseudonym, color: slotColor, eligibility: data.eligibility, accs: data.accommodations, goals: data.goals, strengths: data.strengths, triggers: data.triggers, strategies: data.strategies, tags: data.tags, behaviorNotes: data.behaviorNotes, caseManager: data.caseManager };
                downloadJSON(safeJSON, `${pseudonym.replace(" ", "_")}_safe.json`);
              }} style={{ flex: 1, padding: "8px", borderRadius: "8px", border: "1px solid var(--border-light)", background: "var(--bg-surface)", color: "var(--text-secondary)", fontSize: "11px", cursor: "pointer" }}>
                ↓ Safe JSON
              </button>
              <button onClick={() => {
                const privateMap = { _warning: "PRIVATE — never share or store in app", pseudonym, color: slotColor, realName: data.studentName, realClass: data.classLabel, teacherName: data.teacherName, caseManager: data.caseManager, gradeLevel: data.gradeLevel };
                downloadJSON(privateMap, `${pseudonym.replace(" ", "_")}_private_mapping.json`);
              }} style={{ flex: 1, padding: "8px", borderRadius: "8px", border: "1px solid #854d0e", background: "#1a1505", color: "#fbbf24", fontSize: "11px", cursor: "pointer" }}>
                ↓ Private Mapping
              </button>
            </div>
          </div>
        )}
      </div>}

      {/* ── Save Private Roster Modal ─────────────────────────────
          Appears after bundle import when real names were found in the file.
          Names are auto-extracted — no manual entry. Download → upload to 👤 panel. */}
      {showRosterSaveModal && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999,
          background: "rgba(4,8,15,0.88)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: "20px"
        }}>
          <div style={{
            background: "#0d1a2e", border: "2px solid #16a34a", borderRadius: "16px",
            padding: "24px 28px", maxWidth: "500px", width: "100%",
            boxShadow: "0 24px 64px rgba(0,0,0,0.8)", display: "flex", flexDirection: "column", gap: "16px"
          }}>

            {/* Header */}
            <div>
              <div style={{ fontSize: "13px", fontWeight: "800", color: "#4ade80", marginBottom: "4px" }}>
                🔒 Save Private Roster to your computer
              </div>
              <div style={{ fontSize: "13px", color: "#94a3b8", lineHeight: "1.75", marginBottom: "22px" }}>
                Identities generated for{" "}
                <strong style={{ color: "#e2e8f0" }}>
                  {pendingRosterData.length} student{pendingRosterData.length !== 1 ? "s" : ""}
                </strong>
                {" "}— each real name now has one display name and color across all their classes.
                Save this file to your computer.
                <br /><br />
                Next time, load it using the <strong style={{ color: "#e2e8f0" }}>👤 Real Names</strong> button in the left sidebar to see real names again.
                <br /><br />
                <span style={{ color: "#fbbf24" }}>
                  ⚠ This file contains real names. Store it securely and never share it.
                </span>
              </div>
            </div>

            {/* Name display — read-only, extracted from uploaded file */}
            <div style={{ maxHeight: "280px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px" }}>
              {pendingRosterData.map((entry, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div style={{
                    width: "10px", height: "10px", borderRadius: "50%",
                    background: entry.color, flexShrink: 0
                  }} />
                  <div style={{ fontSize: "12px", color: entry.color, fontWeight: "600", minWidth: "120px", flexShrink: 0 }}>
                    {entry.displayLabel}
                  </div>
                  <div style={{
                    flex: 1, padding: "6px 10px", background: "#0a1628",
                    border: `1px solid ${entry.realName ? "#16a34a" : "#2d1a1a"}`,
                    borderRadius: "6px",
                    color: entry.realName ? "#e2e8f0" : "#475569",
                    fontSize: "12px",
                    fontStyle: entry.realName ? "normal" : "italic"
                  }}>
                    {entry.realName || "(not in file)"}
                  </div>
                </div>
              ))}
            </div>

            {/* Buttons */}
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={downloadPrivateRosterFromBundle}
                style={{
                  flex: 1, padding: "12px", borderRadius: "10px",
                  border: "1px solid #16a34a", background: "#14532d",
                  color: "#4ade80", fontSize: "13px", fontWeight: "800", cursor: "pointer"
                }}>
                ↓ Save Private Roster JSON
              </button>
              <button
                onClick={() => setShowRosterSaveModal(false)}
                style={{
                  padding: "12px 20px", borderRadius: "10px",
                  border: "1px solid #334155", background: "transparent",
                  color: "#64748b", fontSize: "12px", cursor: "pointer"
                }}>
                Skip for Now
              </button>
            </div>

          </div>
        </div>
      )}
      {/* ── Missing Names Modal ───────────────────────────────────
          Appears when the uploaded bundle contains no real student names. */}
      {showMissingNamesModal && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999,
          background: "rgba(4,8,15,0.88)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: "20px"
        }}>
          <div style={{
            background: "#0d1a2e", border: "2px solid #7f1d1d", borderRadius: "16px",
            padding: "24px 28px", maxWidth: "460px", width: "100%",
            boxShadow: "0 24px 64px rgba(0,0,0,0.8)", display: "flex", flexDirection: "column", gap: "14px"
          }}>
            <div style={{ fontSize: "22px" }}>⚠️</div>
            <div style={{ fontSize: "13px", fontWeight: "800", color: "#f87171" }}>
              Missing student names in uploaded file.
            </div>
            <div style={{ fontSize: "12px", color: "#94a3b8", lineHeight: "1.75" }}>
              This file does not contain real student names, so a Private Roster cannot be created.
            </div>
            <button
              onClick={() => setShowMissingNamesModal(false)}
              style={{
                padding: "12px", borderRadius: "10px",
                border: "1px solid #334155", background: "#1e1b2e",
                color: "#94a3b8", fontSize: "13px", cursor: "pointer"
              }}>
              Close
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

function Row({ label, value, color }) {
  return (
    <div style={{ display: "flex", gap: "8px" }}>
      <span style={{ color: "var(--text-muted)", flexShrink: 0, minWidth: "90px" }}>{label}:</span>
      <span style={{ color: color || "var(--text-primary)" }}>{value}</span>
    </div>
  );
}

function ImportModeCard({ icon, title, subtitle, tone, body, when, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex", flexDirection: "column", gap: "var(--space-3)",
        padding: "var(--space-5)",
        background: active
          ? `linear-gradient(180deg, ${tone}14, var(--panel-bg))`
          : "var(--panel-bg)",
        border: `2px solid ${active ? tone : "var(--border)"}`,
        borderRadius: "var(--radius-xl)",
        cursor: "pointer",
        textAlign: "left",
        minHeight: 220,
        fontFamily: "inherit",
        transition: "all 200ms cubic-bezier(0.16,1,0.3,1)",
        boxShadow: active
          ? `0 10px 30px ${tone}22, 0 0 0 1px ${tone}44`
          : "var(--shadow-sm)",
        transform: active ? "translateY(-2px)" : "translateY(0)",
        position: "relative",
        overflow: "hidden",
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.borderColor = tone + "66"; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.borderColor = "var(--border)"; }}
    >
      {/* Accent stripe */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 3,
        background: tone, opacity: active ? 1 : 0.35,
      }} />
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
        <div style={{
          width: 52, height: 52,
          borderRadius: "var(--radius-lg)",
          background: `linear-gradient(135deg, ${tone}, ${tone}99)`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 26,
          boxShadow: `0 4px 14px ${tone}55`,
          flexShrink: 0,
        }}>
          {icon}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontSize: 17, fontWeight: 800, letterSpacing: "-0.01em",
            color: "var(--text-primary)",
          }}>
            {title}
          </div>
          <div style={{ fontSize: 12, color: tone, fontWeight: 600, marginTop: 2 }}>
            {subtitle}
          </div>
        </div>
      </div>

      <div style={{
        fontSize: 13, color: "var(--text-secondary)",
        lineHeight: 1.55, flex: 1,
      }}>
        {body}
      </div>

      <div style={{
        fontSize: 11, fontWeight: 600,
        color: active ? tone : "var(--text-muted)",
        paddingTop: "var(--space-2)",
        borderTop: `1px solid ${active ? tone + "33" : "var(--border)"}`,
        lineHeight: 1.5,
      }}>
        <span style={{ textTransform: "uppercase", letterSpacing: "0.1em", marginRight: 4 }}>
          When to use:
        </span>
        <span style={{ color: "var(--text-secondary)", fontWeight: 500 }}>{when}</span>
      </div>

      {active && (
        <div style={{
          position: "absolute", top: 14, right: 14,
          fontSize: 10, fontWeight: 700,
          textTransform: "uppercase", letterSpacing: "0.1em",
          color: tone,
          padding: "2px 8px",
          background: tone + "22",
          borderRadius: "var(--radius-pill)",
          border: `1px solid ${tone}55`,
        }}>
          Active
        </div>
      )}
    </button>
  );
}


function SmartImportBanner({ active, onClick }) {
  // Primary import path — hero banner spanning the full width of the three
  // cards above. Gradient, larger type, animated glow on hover. If the user

  // knows where they are, this is the one button they should click.
  const tone = "#f97316";
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: "100%",
        display: "flex", alignItems: "center", gap: "var(--space-5)",
        padding: "var(--space-5) var(--space-6)",
        background: active
          ? `linear-gradient(120deg, ${tone}20 0%, rgba(167,139,250,0.12) 40%, var(--panel-raised) 100%)`
          : `linear-gradient(120deg, ${tone}14 0%, rgba(167,139,250,0.08) 40%, var(--panel-bg) 100%)`,
        border: `2px solid ${active ? tone : tone + "55"}`,
        borderRadius: "var(--radius-xl)",
        cursor: "pointer",
        textAlign: "left",
        fontFamily: "inherit",
        position: "relative",
        overflow: "hidden",
        transition: "all 200ms cubic-bezier(0.16,1,0.3,1)",
        boxShadow: active
          ? `0 16px 48px ${tone}33, 0 0 0 1px ${tone}80`
          : "var(--shadow-md)",
        transform: active ? "translateY(-2px)" : "translateY(0)",
        marginBottom: "var(--space-5)",
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.boxShadow = `0 12px 36px ${tone}28, var(--shadow-md)`; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.boxShadow = "var(--shadow-md)"; }}
    >
      {/* Decorative accent ribbon */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 4,
        background: `linear-gradient(90deg, ${tone}, #a78bfa, #7a9cff)`,
      }} />
      {/* Left: icon tile */}
      <div style={{
        width: 88, height: 88, flexShrink: 0,
        borderRadius: "var(--radius-xl)",
        background: `linear-gradient(135deg, ${tone}, #a78bfa)`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 44,
        boxShadow: `0 10px 32px ${tone}55`,
      }}>
        🎯
      </div>
      {/* Middle: title + description */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          display: "flex", alignItems: "center", gap: "var(--space-2)",
          marginBottom: 4,
        }}>
          <span className="pill" style={{
            fontSize: 10, fontWeight: 800,
            background: tone, color: "#000",
            padding: "3px 10px",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}>
            ⭐ Start Here
          </span>
          {active && (
            <span className="pill" style={{
              fontSize: 10, fontWeight: 700,
              color: tone,
              background: `${tone}22`,
              border: `1px solid ${tone}55`,
              padding: "2px 8px",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}>
              Active
            </span>
          )}
        </div>
        <h2 style={{
          fontSize: 26, fontWeight: 800,
          letterSpacing: "-0.02em",
          color: "var(--text-primary)",
          lineHeight: 1.1,
          marginBottom: 6,
        }}>
          Smart Import (AI) — the one-step import
        </h2>
        <p style={{
          fontSize: 14, color: "var(--text-secondary)",
          lineHeight: 1.55, margin: 0, maxWidth: 720,
        }}>
          Upload <b style={{ color: "var(--text-primary)" }}>two files at once</b> — a roster
          (names + Para App Numbers) and a document with every student's IEP summary.
          Local AI or Google Gemini splits the doc by name, extracts each kid's IEP, matches
          by name, and builds the data for you. Admin never writes JSON. Backup files save
          to your Downloads or a folder you pick.
        </p>
      </div>
      {/* Right: chevron / CTA */}
      <div style={{
        flexShrink: 0, display: "flex", flexDirection: "column",
        alignItems: "center", gap: 4,
      }}>
        <div style={{
          padding: "var(--space-3) var(--space-5)",
          borderRadius: "var(--radius-pill)",
          background: active ? tone : `${tone}22`,
          color: active ? "#000" : tone,
          fontWeight: 700, fontSize: 14,
          border: `1px solid ${tone}`,
          whiteSpace: "nowrap",
        }}>
          {active ? "Open below ↓" : "Use this →"}
        </div>
      </div>
    </button>
  );
}
