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

import React, { useCallback, useRef, useState } from 'react';
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
  const [ollamaStatus, setOllamaStatus] = useState(null); // { online, model }
  const team = useTeamOptional();
  const vault = useVault();
  const rosterRef = useRef();
  const iepRef = useRef();

  const checkOllama = useCallback(async () => {
    const s = await checkAvailability();
    setOllamaStatus(s);
    return s;
  }, []);

  React.useEffect(() => { checkOllama(); }, [checkOllama]);

  async function onRosterSelected(file) {
    setRosterFile(file);
    setRosterErrors([]); setError(null);
    try {
      const { entries, errors } = await parseRosterFile(file);
      setRosterPairs(entries);
      setRosterErrors(errors || []);
    } catch (e) { setError('Roster parse failed: ' + e.message); }
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
      setError('Local AI (Ollama) is offline. Start it with: ollama serve');
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

      setParsingStep('committed');
    } catch (e) {
      setError('Commit failed: ' + e.message);
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
          🎯 Smart Import — one-step IEP load
        </h3>
        <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          Upload <b>two files</b> — a roster (names + 6-digit Para App Numbers) and your IEP
          summaries. The local AI extracts each kid's IEP, matches by name, builds the
          structured data, and routes real names into your device's private vault.
          Admin never sees a JSON file.
        </p>
      </div>

      {/* Ollama status */}
      <div className="panel" style={{
        padding: 'var(--space-3) var(--space-4)',
        display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Local AI:</span>
        {ollamaStatus?.online
          ? <span className="pill pill-green" style={{ fontSize: 11 }}>
              ✓ Online · {ollamaStatus.model || 'qwen2.5:7b-instruct'}
            </span>
          : <span className="pill pill-red" style={{ fontSize: 11 }}>
              ✗ Offline — run: <code style={{ fontFamily: 'JetBrains Mono, monospace' }}>ollama serve</code>
            </span>
        }
        <button onClick={checkOllama} className="btn btn-ghost btn-sm" style={{ fontSize: 11 }}>
          Re-check
        </button>
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
            <span style={{ fontWeight: 700 }}>Roster</span>
            {rosterPairs.length > 0 && (
              <span className="pill pill-green" style={{ fontSize: 10 }}>
                {rosterPairs.length} paired
              </span>
            )}
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 'var(--space-2)' }}>
            Names + 6-digit Para App Numbers. JSON, CSV, Markdown, TXT, or PDF.
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
            <span style={{ fontWeight: 700 }}>IEP Summaries</span>
            {iepText && (
              <span className="pill pill-green" style={{ fontSize: 10 }}>
                {Math.round(iepText.length / 1000)} KB of text
              </span>
            )}
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 'var(--space-2)' }}>
            One document with IEP summary per student. PDF or text. AI splits it by name.
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
          disabled={!ollamaStatus?.online}
          className="btn btn-primary"
          style={{ padding: 'var(--space-4)', fontSize: 15 }}
        >
          {ollamaStatus?.online
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
          <div>
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
            <button onClick={reset} className="btn btn-secondary btn-sm" style={{ marginTop: 'var(--space-3)' }}>
              Run another import
            </button>
          </div>
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
          What should each file look like?
        </summary>
        <div style={{ padding: 'var(--space-3)', marginTop: 'var(--space-2)', display: 'grid', gap: 'var(--space-3)' }}>
          <div>
            <b style={{ color: 'var(--text-primary)' }}>Roster</b> — one line per student:
            <pre style={preStyle}>{`Jordan Smith - 847293
Taylor Johnson - 128456
Maria Garcia - 555555`}</pre>
          </div>
          <div>
            <b style={{ color: 'var(--text-primary)' }}>IEP Summaries</b> — a single document
            containing each student's IEP summary. Start each student's section with
            their full name (first + last) on its own line so the app can split it:
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
