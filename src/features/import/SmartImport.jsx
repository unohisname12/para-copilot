// Smart Import — flagship IEP import flow.
//
// Admin provides TWO inputs at once:
//   1. Roster list  — name + 6-digit Para App Number pairs (JSON/CSV/MD/TXT/PDF)
//   2. IEP summaries — one document containing all students' IEP summaries
//
// The app:
//   • Parses the roster → { realName, paraAppNumber } pairs
//   • Splits the IEP doc by student name
//   • Sends each section to local Ollama (qwen2.5:7b-instruct) for
//     structured extraction
//   • Builds the bundle JSON internally
//   • Routes real names to the local vault; pseudonymous data to the cloud
//
// Admin never touches JSON. This is the primary, promoted path.

import React, { useCallback, useRef, useState, useEffect } from 'react';
import { parseRosterFile } from './rosterParsers';
import {
  readFileAsText,
  splitByStudents,
  extractAllStudents,
  buildBundleFromExtraction,
  buildMatchReport,
  checkAvailability,
} from './iepExtractor';
import { buildIdentityRegistry } from '../../models';
import { useTeamOptional } from '../../context/TeamProvider';
import { useVault } from '../../context/VaultProvider';
import { pushStudents } from '../../services/teamSync';
import {
  AI_PROVIDERS, getAiProvider, setAiProvider,
  getCloudApiKey, setCloudApiKey,
  getCloudModel, setCloudModel, DEFAULT_GEMINI_MODEL,
} from '../../engine/aiProvider';
import {
  saveBundleLocally, pickBackupFolder, getBackupFolderName, fsaSupported,
} from '../../utils/localBackup';

export default function SmartImport({ onBulkImport, onIdentityLoad }) {
  const [rosterFile, setRosterFile] = useState(null);
  const [iepFile, setIepFile] = useState(null);
  const [rosterPairs, setRosterPairs] = useState([]);
  const [rosterErrors, setRosterErrors] = useState([]);
  const [iepText, setIepText] = useState('');
  const [parsingStep, setParsingStep] = useState('idle'); // idle | reading | extracting | done | error
  const [progress, setProgress] = useState({ total: 0, done: 0, currentName: '' });
  const [matchReport, setMatchReport] = useState(null);
  const [bundle, setBundle] = useState(null);
  const [error, setError] = useState(null);
  const [aiStatus, setAiStatus] = useState(null); // { online, model, provider, reason? }
  const [provider, setProviderState] = useState(() => getAiProvider());
  const [cloudKeyDraft, setCloudKeyDraft] = useState(() => getCloudApiKey());
  const [cloudModelDraft, setCloudModelDraft] = useState(() => getCloudModel());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [keyRevealed, setKeyRevealed] = useState(false);
  const [backupFolder, setBackupFolder] = useState(null);
  const [lastBackup, setLastBackup] = useState(null); // { method, folderName, filenames }
  const team = useTeamOptional();
  const vault = useVault();
  const rosterRef = useRef();
  const iepRef = useRef();

  const checkOllama = useCallback(async () => {
    const s = await checkAvailability();
    setAiStatus(s);
    return s;
  }, []);

  useEffect(() => { checkOllama(); }, [checkOllama, provider]);
  useEffect(() => { getBackupFolderName().then(setBackupFolder); }, []);

  // Apply provider change + save cloud config
  function handleProviderChange(next) {
    setProviderState(next);
    setAiProvider(next);
    setAiStatus(null);
  }
  function saveCloudConfig() {
    setCloudApiKey(cloudKeyDraft.trim());
    setCloudModel(cloudModelDraft.trim() || DEFAULT_GEMINI_MODEL);
    checkOllama();
  }

  async function onRosterSelected(file) {
    setRosterFile(file);
    setRosterErrors([]); setError(null);
    try {
      const { entries, errors } = await parseRosterFile(file);
      setRosterPairs(entries);
      setRosterErrors(errors || []);
    } catch (e) { setError("Couldn't read the name list: " + e.message); }
  }

  async function onIepSelected(file) {
    setIepFile(file); setError(null);
    try {
      const text = await readFileAsText(file);
      setIepText(text);
    } catch (e) { setError('IEP doc read failed: ' + e.message); }
  }

  async function runExtraction() {
    setError(null); setMatchReport(null); setBundle(null);
    if (rosterPairs.length === 0) { setError('Upload a roster first.'); return; }
    if (!iepText.trim()) { setError('Upload an IEP summary doc first.'); return; }

    const status = await checkOllama();
    if (!status.online) {
      if (status.provider === 'cloud') {
        if (status.reason === 'no_key')       setError('Gemini API key not set. Open Settings and paste a key.');
        else if (status.reason === 'invalid_key') setError('Gemini rejected the API key. Check it in Settings.');
        else if (status.reason === 'quota')   setError('Gemini quota exceeded. Wait a minute and retry.');
        else                                  setError('Gemini is unreachable. Check your network.');
      } else {
        setError('Local AI (Ollama) is offline. Start it with: ollama serve');
      }
      return;
    }

    setParsingStep('reading');
    const names = rosterPairs.map(p => p.realName);
    const sections = splitByStudents(iepText, names);
    if (sections.size === 0) {
      setError('Couldn\'t find any of the roster names in the IEP doc. Check names match.');
      setParsingStep('error');
      return;
    }

    setParsingStep('extracting');
    setProgress({ total: sections.size, done: 0, currentName: '' });

    const { results, errors } = await extractAllStudents(sections, (name, status) => {
      setProgress(prev => ({
        total: sections.size,
        done: status === 'done' || status === 'failed' ? prev.done + 1 : prev.done,
        currentName: name,
      }));
    });

    const report = buildMatchReport(rosterPairs, sections, results);
    setMatchReport(report);
    const b = buildBundleFromExtraction(rosterPairs, results);
    setBundle(b);
    if (errors.length > 0) console.warn('[smart-import] extraction issues:', errors);
    setParsingStep('done');
  }

  async function commitImport() {
    if (!bundle) return;
    try {
      const { registry, importStudents, periodMap } = buildIdentityRegistry(bundle);
      const studentList = Object.values(importStudents);

      // Seed local state (same handlers as other import paths)
      onBulkImport?.(studentList, periodMap);

      // Load names into the session vault / identity registry
      if (registry.length > 0) onIdentityLoad?.(registry);

      // Push pseudonymous students to the team cloud roster
      if (team?.activeTeamId && team?.user?.id) {
        try {
          await pushStudents(team.activeTeamId, studentList, team.user.id);
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error('[smart-import] cloud push failed', e);
        }
      }

      // Save BOTH files locally so the admin can see where the data lives.
      // Pseudonymous bundle + private roster (names + Para App Numbers) + README.
      try {
        const backup = await saveBundleLocally(bundle, registry);
        setLastBackup(backup);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[smart-import] local backup failed', e);
      }

      setParsingStep('committed');
    } catch (e) {
      setError('Commit failed: ' + e.message);
    }
  }

  async function handlePickFolder() {
    const ok = await pickBackupFolder();
    if (ok) {
      const name = await getBackupFolderName();
      setBackupFolder(name);
    }
  }

  function reset() {
    setRosterFile(null); setIepFile(null);
    setRosterPairs([]); setRosterErrors([]); setIepText('');
    setParsingStep('idle'); setProgress({ total: 0, done: 0, currentName: '' });
    setMatchReport(null); setBundle(null); setError(null);
    if (rosterRef.current) rosterRef.current.value = '';
    if (iepRef.current) iepRef.current.value = '';
  }

  // ── Rendering ──

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>

      {/* Intro card */}
      <div className="card-elevated" style={{ padding: 'var(--space-5)' }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>
          🎯 Smart Import — load everyone in one step
        </h3>
        <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          Upload <b>two files</b> — a name list (each student's name + 6-digit Para App
          Number) and a document with each student's IEP summary. The AI reads both, matches
          each kid to their IEP, and sets everything up for you. Real names stay on this
          computer; only the Para App Number and IEP info go anywhere else.
        </p>
      </div>

      {/* AI provider bar — picks Ollama vs Gemini, shows status, opens settings */}
      <div className="panel" style={{ padding: 'var(--space-3) var(--space-4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>AI:</span>
          <div style={{
            display: 'flex', gap: 2, padding: 3,
            background: 'var(--bg-dark)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
          }}>
            {Object.values(AI_PROVIDERS).map(p => (
              <button key={p.id} onClick={() => handleProviderChange(p.id)} style={{
                padding: '5px 10px', borderRadius: 'var(--radius-sm)',
                border: 'none', cursor: 'pointer',
                fontSize: 11, fontWeight: 600, fontFamily: 'inherit',
                background: provider === p.id ? 'var(--grad-primary)' : 'transparent',
                color: provider === p.id ? '#fff' : 'var(--text-secondary)',
                transition: 'all 120ms cubic-bezier(0.16,1,0.3,1)',
              }}>
                {p.label} <span style={{ opacity: 0.75 }}>· {p.tag}</span>
              </button>
            ))}
          </div>
          {aiStatus?.online
            ? <span className="pill pill-green" style={{ fontSize: 11 }}>
                ✓ Online{aiStatus.model ? ` · ${aiStatus.model}` : ''}
              </span>
            : (
              <span className="pill pill-red" style={{ fontSize: 11 }}>
                {provider === 'cloud' && aiStatus?.reason === 'no_key' && '✗ Need API key'}
                {provider === 'cloud' && aiStatus?.reason === 'invalid_key' && '✗ Invalid key'}
                {provider === 'cloud' && aiStatus?.reason === 'quota' && '✗ Quota exceeded'}
                {provider === 'cloud' && aiStatus?.reason === 'network' && '✗ Network error'}
                {provider === 'cloud' && !aiStatus?.reason && '✗ Offline'}
                {provider === 'local' && '✗ Offline — run: ollama serve'}
              </span>
            )
          }
          <button onClick={checkOllama} className="btn btn-ghost btn-sm" style={{ fontSize: 11 }}>
            Re-check
          </button>
          {provider === 'cloud' && (
            <button onClick={() => setSettingsOpen(!settingsOpen)} className="btn btn-ghost btn-sm" style={{ fontSize: 11 }}>
              ⚙ Settings
            </button>
          )}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.5 }}>
          {AI_PROVIDERS[provider].description}
        </div>

        {/* Cloud settings (expanded) */}
        {provider === 'cloud' && settingsOpen && (
          <div style={{
            marginTop: 'var(--space-3)', padding: 'var(--space-3)',
            background: 'var(--bg-dark)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                Gemini API key
              </label>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  type={keyRevealed ? 'text' : 'password'}
                  value={cloudKeyDraft}
                  onChange={e => setCloudKeyDraft(e.target.value)}
                  placeholder="AIza…"
                  className="chat-input"
                  style={{ flex: 1, fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}
                />
                <button onClick={() => setKeyRevealed(k => !k)} className="btn btn-secondary btn-sm" style={{ fontSize: 11 }}>
                  {keyRevealed ? 'Hide' : 'Show'}
                </button>
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.5 }}>
                Get a free key at{' '}
                <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer"
                   style={{ color: 'var(--accent-hover)' }}>aistudio.google.com/app/apikey</a>.
                Stored in this browser's localStorage only. Never sent anywhere except Google.
              </div>
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                Model
              </label>
              <select value={cloudModelDraft} onChange={e => setCloudModelDraft(e.target.value)} className="period-select" style={{ width: '100%', fontSize: 12 }}>
                <option value="gemini-2.5-flash">gemini-2.5-flash — cheap + fast (recommended)</option>
                <option value="gemini-2.5-pro">gemini-2.5-pro — smarter, 5× pricier</option>
                <option value="gemini-2.0-flash">gemini-2.0-flash — older, still solid</option>
              </select>
            </div>
            <button onClick={saveCloudConfig} className="btn btn-primary btn-sm">
              Save + re-check
            </button>
            {/* Privacy warning — explains free vs paid tier data handling */}
            <div style={{
              padding: 'var(--space-3)',
              background: 'var(--yellow-muted)',
              border: '1px solid rgba(251,191,36,0.35)',
              borderRadius: 'var(--radius-md)',
              fontSize: 11.5, color: 'var(--text-primary)',
              lineHeight: 1.55, marginTop: 'var(--space-2)',
            }}>
              <div style={{ fontWeight: 700, color: 'var(--yellow)', marginBottom: 4 }}>
                ⚠ Privacy: know what tier you're on
              </div>
              <div style={{ color: 'var(--text-secondary)' }}>
                <b>Free API key (no billing enabled):</b> Google uses prompts + responses to
                improve their models. Not safe for real student data.<br />
                <b>Paid API key (billing enabled, often $0/mo in practice):</b> Google does
                NOT train on your data; 55-day abuse-detection retention only.<br /><br />
                We <b>already strip student names</b> before sending text to the cloud, but
                IEP details still go. For district deployments, flip on billing at{' '}
                <a href="https://console.cloud.google.com/billing" target="_blank" rel="noopener noreferrer"
                   style={{ color: 'var(--accent-hover)' }}>console.cloud.google.com/billing</a>.
                Your key format stays the same; data handling changes immediately.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Two-file picker */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: 'var(--space-3)',
      }}>
        {/* Roster */}
        <div className="panel" style={{ padding: 'var(--space-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 20 }}>👥</span>
            <span style={{ fontWeight: 700 }}>Name list</span>
            {rosterPairs.length > 0 && (
              <span className="pill pill-green" style={{ fontSize: 10 }}>
                {rosterPairs.length} students found
              </span>
            )}
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 'var(--space-2)' }}>
            Each student's real name + their 6-digit Para App Number.
            Accepts Word, PDF, a typed list, a spreadsheet — pretty much any format.
          </p>
          <input
            ref={rosterRef}
            type="file"
            accept=".json,.csv,.md,.txt,.pdf"
            onChange={(e) => { const f = e.target.files[0]; if (f) onRosterSelected(f); }}
            style={inputStyle}
          />
          {rosterPairs.length > 0 && (
            <div style={{ marginTop: 'var(--space-2)', fontSize: 11, color: 'var(--text-secondary)' }}>
              First 3: {rosterPairs.slice(0, 3).map(p => `${p.realName} (${p.paraAppNumber})`).join(' · ')}
              {rosterPairs.length > 3 && ` · +${rosterPairs.length - 3} more`}
            </div>
          )}
          {rosterErrors.length > 0 && (
            <div style={{ marginTop: 6, fontSize: 11, color: 'var(--yellow)' }}>
              {rosterErrors.length} roster warning{rosterErrors.length !== 1 ? 's' : ''} — see console
            </div>
          )}
        </div>

        {/* IEP summaries */}
        <div className="panel" style={{ padding: 'var(--space-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 20 }}>📄</span>
            <span style={{ fontWeight: 700 }}>IEP summaries</span>
            {iepText && (
              <span className="pill pill-green" style={{ fontSize: 10 }}>
                loaded
              </span>
            )}
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 'var(--space-2)' }}>
            One document with a short IEP summary for each student (goals, accommodations,
            etc.). PDF or a text/Word file. The AI finds each student by name.
          </p>
          <input
            ref={iepRef}
            type="file"
            accept=".pdf,.txt,.md,.docx"
            onChange={(e) => { const f = e.target.files[0]; if (f) onIepSelected(f); }}
            style={inputStyle}
          />
        </div>
      </div>

      {/* Run button */}
      {rosterPairs.length > 0 && iepText && parsingStep === 'idle' && (
        <button
          onClick={runExtraction}
          disabled={!aiStatus?.online}
          className="btn btn-primary"
          style={{ padding: 'var(--space-4)', fontSize: 15 }}
        >
          {aiStatus?.online
            ? `🎯 Run Smart Import (${rosterPairs.length} students)`
            : 'Local AI must be online first'}
        </button>
      )}

      {/* Progress */}
      {(parsingStep === 'reading' || parsingStep === 'extracting') && (
        <div className="panel" style={{ padding: 'var(--space-4)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
            {parsingStep === 'reading' ? 'Splitting document…' : `Extracting IEPs…`}
          </div>
          <div style={{
            height: 8, background: 'var(--bg-dark)', borderRadius: 4, overflow: 'hidden',
            marginBottom: 6,
          }}>
            <div style={{
              height: '100%',
              width: progress.total > 0 ? `${(progress.done / progress.total) * 100}%` : '0%',
              background: 'var(--grad-primary)',
              transition: 'width 300ms',
            }} />
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {progress.done} / {progress.total}{progress.currentName ? ` · parsing ${progress.currentName}…` : ''}
          </div>
        </div>
      )}

      {/* Match report */}
      {matchReport && parsingStep !== 'committed' && (
        <div className="panel" style={{ padding: 'var(--space-4)' }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: 'var(--space-3)', flexWrap: 'wrap', gap: 8,
          }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>
                Extracted {matchReport.filter(r => r.status === 'ok').length} of {matchReport.length}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                Review below. Unmatched kids will still be imported with a "IEP Pending" flag.
              </div>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button onClick={reset} className="btn btn-secondary">Cancel</button>
              <button onClick={commitImport} className="btn btn-primary">
                ✓ Import {matchReport.length} students
              </button>
            </div>
          </div>
          <div className="table-container" style={{ maxHeight: 380 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Para #</th>
                  <th>Status</th>
                  <th>Eligibility</th>
                  <th>Goals</th>
                  <th>Accommodations</th>
                </tr>
              </thead>
              <tbody>
                {matchReport.map((r) => (
                  <tr key={r.paraAppNumber}>
                    <td>{r.realName}</td>
                    <td className="mono" style={{ color: 'var(--accent-hover)' }}>{r.paraAppNumber}</td>
                    <td>
                      {r.status === 'ok' && <span className="pill pill-green" style={{ fontSize: 10 }}>AI OK</span>}
                      {r.status === 'section_but_no_ai' && <span className="pill pill-yellow" style={{ fontSize: 10 }}>AI failed</span>}
                      {r.status === 'no_section' && <span className="pill pill-red" style={{ fontSize: 10 }}>No IEP</span>}
                    </td>
                    <td style={{ fontSize: 12 }}>{r.parsed?.eligibility || '—'}</td>
                    <td style={{ fontSize: 12 }}>
                      {r.parsed?.goals?.length
                        ? `${r.parsed.goals.length} goal${r.parsed.goals.length !== 1 ? 's' : ''}`
                        : '—'}
                    </td>
                    <td style={{ fontSize: 12 }}>
                      {r.parsed?.accommodations?.length
                        ? `${r.parsed.accommodations.length} acc.`
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Success */}
      {parsingStep === 'committed' && (
        <div style={{
          padding: 'var(--space-5)',
          background: 'var(--green-muted)',
          border: '1px solid rgba(52,211,153,0.4)',
          borderRadius: 'var(--radius-lg)',
          display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start',
        }}>
          <span style={{ fontSize: 24 }}>✅</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, color: 'var(--green)', fontSize: 15 }}>
              Imported {matchReport?.length || 0} students.
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.55 }}>
              Pseudonymous IEP data pushed to the cloud, keyed by Para App Number.
              Real names are in your device's vault (toggle "Show real names" in the sidebar).
              {!vault?.persisted && (
                <> Enable <b style={{ color: 'var(--yellow)' }}>"Remember on this device"</b> in
                the sidebar if you want names to survive page refresh.</>
              )}
            </div>

            {/* Where the backup files went */}
            {lastBackup && (
              <div style={{
                marginTop: 'var(--space-3)',
                padding: 'var(--space-3)',
                background: 'var(--bg-dark)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                fontSize: 12.5, color: 'var(--text-primary)', lineHeight: 1.55,
              }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>
                  📁 Backup files saved to <code style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--accent-hover)' }}>
                    {lastBackup.folderName}
                  </code>
                  {lastBackup.method === 'downloads' && (
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, marginLeft: 6 }}>
                      (your browser's default Downloads folder)
                    </span>
                  )}
                </div>
                <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--text-secondary)' }}>
                  {lastBackup.filenames.map(f => (
                    <li key={f}>
                      <code style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11.5 }}>{f}</code>
                    </li>
                  ))}
                </ul>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8, lineHeight: 1.5 }}>
                  The <b>bundle</b> file is safe to share — no real names.
                  The <b>private roster</b> contains real names; keep it on this device only.
                  The <b>README.txt</b> explains both files.
                </div>
              </div>
            )}

            <button onClick={reset} className="btn btn-secondary btn-sm" style={{ marginTop: 'var(--space-3)' }}>
              Run another import
            </button>
          </div>
        </div>
      )}

      {/* Backup folder control (always visible, above the run button) */}
      {(parsingStep === 'idle' || !parsingStep) && fsaSupported() && (
        <div className="panel" style={{
          padding: 'var(--space-3) var(--space-4)',
          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>📁 Backup folder:</span>
          {backupFolder ? (
            <>
              <code style={{
                fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
                padding: '3px 8px', background: 'var(--accent-glow)',
                color: 'var(--accent-hover)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--accent-border)',
              }}>{backupFolder}</code>
              <button onClick={handlePickFolder} className="btn btn-ghost btn-sm" style={{ fontSize: 11 }}>
                Change
              </button>
            </>
          ) : (
            <>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Default: your browser's Downloads folder.
              </span>
              <button onClick={handlePickFolder} className="btn btn-secondary btn-sm" style={{ fontSize: 11 }}>
                Pick a folder…
              </button>
            </>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          padding: 'var(--space-3) var(--space-4)',
          background: 'var(--red-muted)',
          border: '1px solid rgba(248,113,113,0.3)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--red)', fontSize: 13,
        }}>
          {error}
        </div>
      )}

      {/* Help block */}
      <details style={{ fontSize: 12, color: 'var(--text-muted)' }}>
        <summary style={{ cursor: 'pointer', color: 'var(--text-secondary)' }}>
          Not sure what each file should look like? Examples →
        </summary>
        <div style={{ padding: 'var(--space-3)', marginTop: 'var(--space-2)', display: 'grid', gap: 'var(--space-3)' }}>
          <div>
            <b style={{ color: 'var(--text-primary)' }}>Name list</b> — one line per student,
            name and number separated by a dash or colon:
            <pre style={preStyle}>{`Jordan Smith - 847293
Taylor Johnson - 128456
Maria Garcia - 555555`}</pre>
          </div>
          <div>
            <b style={{ color: 'var(--text-primary)' }}>IEP summaries</b> — one document with
            a short section for each student. Put each student's full name at the top of
            their section so the app can tell them apart:
            <pre style={preStyle}>{`Jordan Smith
Eligibility: Speech/Language
Case Manager: Heather Thomas
Goals: Improve articulation of /s/ and /r/ sounds.
Accommodations: Extended time, graphic organizers.

Taylor Johnson
Eligibility: SLD + Low Vision
...`}</pre>
          </div>
        </div>
      </details>
    </div>
  );
}

const inputStyle = {
  width: '100%',
  padding: 'var(--space-3)',
  background: 'var(--bg-dark)',
  color: 'var(--text-primary)',
  border: '1px dashed var(--border-light)',
  borderRadius: 'var(--radius-md)',
  fontSize: 13,
  cursor: 'pointer',
};

const preStyle = {
  fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
  background: 'var(--bg-dark)',
  padding: 'var(--space-3)',
  borderRadius: 'var(--radius-md)',
  color: 'var(--text-secondary)',
  whiteSpace: 'pre-wrap', margin: 0,
  border: '1px solid var(--border)',
};
