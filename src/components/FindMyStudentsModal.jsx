import React, { useRef, useState } from 'react';
import { useEscape } from '../hooks/useEscape';
import { parseRosterFile, parseRosterCsv } from '../features/import/rosterParsers';
import {
  readManifestFromFile,
  manifestToVaultEntries,
} from '../utils/assignmentManifest';
import { claimPendingAssignments } from '../services/paraAssignments';

// One screen, one job: get the para's students loaded so they see
// real names + IEP info. Smart-routes based on what they hand it:
//   - CSV / TXT / MD / PDF / generic JSON → name-list parser
//   - JSON with type=paraAssignmentManifest → assignment manifest path
//
// Plain English throughout. The whole point is the para does the
// LEAST work for the MOST reward.

const TEMPLATE_CSV = `Name,ParaAppNumber
Maria Lopez,847293
James Chen,102938
Aiden Brown,449112
`;

export default function FindMyStudentsModal({ open, onClose, onIdentityLoad }) {
  const fileRef = useRef();
  const [paste, setPaste]     = useState('');
  const [busy, setBusy]       = useState(false);
  const [result, setResult]   = useState(null); // { found, errors }

  useEscape(open ? onClose : () => {});
  if (!open) return null;

  function close() {
    setResult(null); setPaste('');
    onClose?.();
  }

  async function handleEntries(entries, errors = []) {
    if (!entries || entries.length === 0) {
      setResult({ found: 0, errors: errors.length ? errors : ['No students found in that input.'] });
      return;
    }
    if (onIdentityLoad) onIdentityLoad(entries);
    try { await claimPendingAssignments(); } catch {}
    setResult({ found: entries.length, errors });
  }

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true); setResult(null);
    try {
      // Try as assignment manifest first (JSON only, special type field).
      if (file.name.toLowerCase().endsWith('.json')) {
        try {
          const manifest = await readManifestFromFile(file);
          await handleEntries(manifestToVaultEntries(manifest));
          return;
        } catch {
          // not a manifest — fall through to roster parser
        }
      }
      const { entries, errors } = await parseRosterFile(file);
      await handleEntries(entries, errors);
    } catch (err) {
      setResult({ found: 0, errors: [err.message || String(err)] });
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  }

  async function handlePasteSubmit() {
    if (!paste.trim()) return;
    setBusy(true); setResult(null);
    const { entries, errors } = parseRosterCsv(paste);
    await handleEntries(entries, errors);
    setBusy(false);
  }

  function downloadTemplate() {
    const blob = new Blob([TEMPLATE_CSV], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'my-students-template.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="modal-overlay" onClick={close}>
      <div
        className="modal-content"
        style={{ maxWidth: 600, width: '100%' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <div style={hat}>Para</div>
            <div style={title}>Find your students</div>
            <div style={sub}>
              Tell us who you support. We'll match them to the team's records and load their IEP info + real names — local to this computer only.
            </div>
          </div>
          <button onClick={close} className="close-btn" aria-label="Close">×</button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>

          {/* Path A — quick paste */}
          <section style={section}>
            <div style={sectionHat}>Easiest way</div>
            <div style={sectionTitle}>Type or paste names + Para App Numbers</div>
            <textarea
              value={paste}
              onChange={e => setPaste(e.target.value)}
              placeholder={'Maria Lopez, 847293\nJames Chen, 102938\nAiden Brown, 449112'}
              className="data-textarea"
              style={{ width: '100%', minHeight: 110, fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}
            />
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handlePasteSubmit}
                disabled={!paste.trim() || busy}
                className="btn btn-primary"
              >
                {busy ? 'Looking…' : 'Find these students'}
              </button>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                One per line. Order doesn't matter — we figure out the 6-digit number.
              </span>
            </div>
          </section>

          <div style={divider}>or</div>

          {/* Path B — file upload */}
          <section style={section}>
            <div style={sectionHat}>Got a file from your sped teacher?</div>
            <div style={sectionTitle}>Drop it here</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              CSV, name list, assignment file, PDF — we figure it out.
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.json,.md,.txt,.pdf"
              style={{ display: 'none' }}
              onChange={handleFile}
            />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="btn btn-secondary"
                disabled={busy}
              >
                {busy ? 'Reading…' : '📁 Pick a file'}
              </button>
              <button
                type="button"
                onClick={downloadTemplate}
                className="btn btn-ghost"
                title="Download a CSV with example rows you can fill out"
              >
                ⬇ Download template
              </button>
            </div>
          </section>

          {/* Result */}
          {result && (
            <div
              style={{
                padding: 'var(--space-3) var(--space-4)',
                borderRadius: 'var(--radius-md)',
                background: result.found > 0 ? 'var(--green-muted)' : 'var(--red-muted)',
                border: `1px solid ${result.found > 0 ? 'var(--green)' : 'var(--red)'}33`,
                color: result.found > 0 ? 'var(--green)' : 'var(--red)',
                fontSize: 13, lineHeight: 1.55,
              }}
            >
              {result.found > 0 ? (
                <strong>✓ Loaded {result.found} student{result.found === 1 ? '' : 's'}.</strong>
              ) : (
                <strong>Nothing was loaded.</strong>
              )}
              {result.errors && result.errors.length > 0 && (
                <ul style={{ marginTop: 6, paddingLeft: 18, color: 'var(--text-secondary)', fontSize: 12 }}>
                  {result.errors.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              )}
              {result.found > 0 && (
                <div style={{ marginTop: 6, color: 'var(--text-secondary)', fontSize: 12 }}>
                  Real names show only on this computer. The cloud only sees the 6-digit numbers.
                </div>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <div style={{
            fontSize: 11,
            color: 'var(--text-muted)',
            lineHeight: 1.5,
            flex: 1,
          }}>
            <strong style={{ color: 'var(--text-secondary)' }}>If a student isn't found:</strong> they probably haven't been loaded yet. Ask your sped teacher to load them, or import an IEP file yourself in <strong style={{ color: 'var(--text-secondary)' }}>IEP Import</strong>.
          </div>
          <button onClick={close} className="btn btn-secondary" style={{ minHeight: 44 }}>
            {result?.found > 0 ? 'Done' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}

const hat = {
  fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
  textTransform: 'uppercase', letterSpacing: '0.12em',
};
const title = { fontSize: 22, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--text-primary)', marginTop: 2 };
const sub   = { fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55, marginTop: 6, maxWidth: 460 };

const section = { display: 'flex', flexDirection: 'column', gap: 8 };
const sectionHat   = { fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' };
const sectionTitle = { fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' };

const divider = {
  alignSelf: 'center',
  fontSize: 11, fontWeight: 700,
  color: 'var(--text-muted)',
  textTransform: 'uppercase', letterSpacing: '0.2em',
};
