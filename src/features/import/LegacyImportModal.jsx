import React, { useState } from 'react';
import { useEscape } from '../../hooks/useEscape';
import { useVault } from '../../context/VaultProvider';
import { useStudentsContext } from '../../app/providers/StudentsProvider';
import { useLogsContext } from '../../app/providers/LogsProvider';
import { parseLegacyCsv, matchRowsToVault, dedupeAgainstLogs } from './legacyImport';

// Three steps: 'upload' → 'review' → 'confirm' → 'done'.
// Each step renders inside the same modal shell so the user keeps state
// (parsed rows + their decisions) without remounting.
export function LegacyImportModal({ open, onClose, vaultLogs }) {
  const vault = useVault();
  const students = useStudentsContext();
  const { addLog } = useLogsContext();

  const [step, setStep] = useState('upload');
  const [error, setError] = useState(null);
  const [rows, setRows] = useState([]);          // matched rows (exact + others)
  const [skipped, setSkipped] = useState([]);    // rows skipped during parse
  const [decisions, setDecisions] = useState({}); // rowIndex -> { studentId, paraAppNumber, realName } | "skip"
  const [counts, setCounts] = useState({ exact: 0, fuzzy: 0, ambiguous: 0, none: 0, duplicates: 0 });
  const [importedCount, setImportedCount] = useState(0);

  useEscape(onClose);

  // Build vault entries: invert vault.realNames map and pair with allStudents
  // so each entry carries the local studentId.
  const vaultEntries = React.useMemo(() => {
    const map = vault?.vault || {}; // { paraAppNumber: realName }
    const studentByPan = {};
    for (const s of Object.values(students.allStudents || {})) {
      if (s && s.paraAppNumber) studentByPan[String(s.paraAppNumber).trim()] = s.id;
    }
    return Object.entries(map).map(([pan, name]) => ({
      paraAppNumber: pan,
      realName: name,
      studentId: studentByPan[pan] || null,
    }));
  }, [vault?.vault, students.allStudents]);

  if (!open) return null;

  const vaultIsEmpty = vaultEntries.length === 0;

  async function handleFile(file) {
    setError(null);
    if (!file) return;
    let text;
    try {
      text = await file.text();
    } catch (e) {
      setError(`Could not read that file: ${e?.message || 'unknown error'}. Try a smaller export or a different browser.`);
      return;
    }
    const parsed = parseLegacyCsv(text);
    if (parsed.error) { setError(parsed.error); return; }
    const matched = matchRowsToVault(parsed.rows, vaultEntries);
    const { fresh, duplicates } = dedupeAgainstLogs(matched, vaultLogs || []);
    setRows(fresh);
    setSkipped(parsed.skipped);
    const newCounts = {
      exact:     fresh.filter(r => r.match.kind === 'exact').length,
      fuzzy:     fresh.filter(r => r.match.kind === 'fuzzy').length,
      ambiguous: fresh.filter(r => r.match.kind === 'ambiguous').length,
      none:      fresh.filter(r => r.match.kind === 'none').length,
      duplicates: duplicates.length,
    };
    setCounts(newCounts);
    // Pre-decide exact matches (auto-confirmed); leave others for review.
    const initial = {};
    for (const r of fresh) {
      if (r.match.kind === 'exact') {
        initial[r.rowIndex] = {
          studentId: r.match.studentId, paraAppNumber: r.match.paraAppNumber, realName: r.match.realName,
        };
      }
    }
    setDecisions(initial);
    const reviewNeeded = fresh.some(r => r.match.kind !== 'exact');
    setStep(reviewNeeded ? 'review' : 'confirm');
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: 720, position: 'relative' }}>
        <button type="button" onClick={onClose} className="close-btn"
          aria-label="Close" style={{ position: 'absolute', top: 12, right: 12, zIndex: 2 }}>×</button>
        <div className="modal-body" style={{ padding: 'var(--space-6)' }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
            Import legacy observations
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 'var(--space-4)' }}>
            Drop in an old "Export with real names" CSV. Names get matched to your roster's Para App Numbers
            so the rows show up in the Vault under the right kid. Real names never leave this browser.
          </p>

          {step === 'upload' && (
            <UploadStep
              vaultIsEmpty={vaultIsEmpty}
              error={error}
              onFile={handleFile}
            />
          )}
          {/* Review + Confirm steps are added in Tasks 6 + 7. */}
          {step === 'review' && (
            <ReviewStep
              rows={rows}
              decisions={decisions}
              setDecisions={setDecisions}
              counts={counts}
              onContinue={() => setStep('confirm')}
              onBack={() => setStep('upload')}
            />
          )}
          {step === 'confirm' && (
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Confirm step renders here (Task 7).
            </div>
          )}
          {step === 'done' && (
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Imported {importedCount} observations. Open the Vault to see them.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function UploadStep({ vaultIsEmpty, error, onFile }) {
  if (vaultIsEmpty) {
    return (
      <div style={{ background: 'var(--yellow-muted)', border: '1px solid rgba(251,191,36,0.35)',
                    padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', fontSize: 13 }}>
        <strong>Import your roster first.</strong>
        <p style={{ marginTop: 6 }}>
          This tool needs your real-name vault loaded so it can match spreadsheet rows to the
          right kid. Open <em>Settings → Manage roster</em> first, then come back.
        </p>
      </div>
    );
  }
  return (
    <div>
      <label className="btn btn-primary" style={{ display: 'inline-block' }}>
        Choose CSV file
        <input type="file" accept=".csv,text/csv" hidden
               onChange={(e) => onFile(e.target.files?.[0])} />
      </label>
      {error && (
        <div style={{ marginTop: 'var(--space-3)', color: 'var(--red)', fontSize: 13 }}>
          {error}
        </div>
      )}
    </div>
  );
}

function ReviewStep({ rows, decisions, setDecisions, counts, onContinue, onBack }) {
  // Show only non-exact rows in the review table; exact matches were auto-
  // decided. The badge shows what was auto-confirmed silently.
  const reviewRows = rows.filter(r => r.match.kind !== 'exact');

  function pick(rowIndex, candidate) {
    setDecisions(prev => ({
      ...prev,
      [rowIndex]: candidate
        ? { studentId: candidate.studentId, paraAppNumber: candidate.paraAppNumber, realName: candidate.realName }
        : 'skip',
    }));
  }

  const decidedCount = reviewRows.filter(r => decisions[r.rowIndex]).length;
  const allDecided = decidedCount === reviewRows.length;

  return (
    <div>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 'var(--space-3)' }}>
        ✓ {counts.exact} rows auto-matched.
        {counts.duplicates > 0 && ` ${counts.duplicates} duplicates skipped.`}
        {' '}Review the {reviewRows.length} below.
      </div>
      <div style={{ maxHeight: 360, overflowY: 'auto', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)' }}>
        <table className="data-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th>Row</th><th>Spreadsheet</th><th>Match</th><th>Pick</th>
            </tr>
          </thead>
          <tbody>
            {reviewRows.map(r => {
              const decided = decisions[r.rowIndex];
              return (
                <tr key={r.rowIndex}>
                  <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>#{r.rowIndex}</td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{r.student}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {r.date} · {r.observation.slice(0, 64)}{r.observation.length > 64 ? '…' : ''}
                    </div>
                  </td>
                  <td>
                    {r.match.kind === 'fuzzy' && (
                      <span className="pill pill-yellow" style={{ fontSize: 11 }}>fuzzy</span>
                    )}
                    {r.match.kind === 'ambiguous' && (
                      <span className="pill pill-yellow" style={{ fontSize: 11 }}>ambiguous</span>
                    )}
                    {r.match.kind === 'none' && (
                      <span className="pill" style={{ fontSize: 11 }}>no match</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {(r.match.candidates || []).slice(0, 3).map(c => (
                        <button
                          key={c.paraAppNumber}
                          type="button"
                          className={'btn ' + (decided && decided !== 'skip' && decided.paraAppNumber === c.paraAppNumber ? 'btn-primary' : 'btn-secondary')}
                          style={{ fontSize: 12, padding: '4px 8px', textAlign: 'left' }}
                          onClick={() => pick(r.rowIndex, c)}
                        >
                          {c.realName}{c.score < 1 ? ` (${Math.round(c.score * 100)}%)` : ''}
                        </button>
                      ))}
                      <button type="button"
                        className={'btn ' + (decided === 'skip' ? 'btn-primary' : 'btn-secondary')}
                        style={{ fontSize: 12, padding: '4px 8px', color: 'var(--text-muted)' }}
                        onClick={() => pick(r.rowIndex, null)}>
                        Skip this row
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--space-4)' }}>
        <button className="btn btn-secondary" onClick={onBack}>← Back</button>
        <button className="btn btn-primary" disabled={!allDecided} onClick={onContinue}>
          Continue → ({decidedCount}/{reviewRows.length} decided)
        </button>
      </div>
    </div>
  );
}

export default LegacyImportModal;
