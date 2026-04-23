// RosterOnlyImport — seed the local vault with { realName → paraAppNumber }
// pairs from any of several file formats. No IEPs, no network, just names.
// Any future bundle that uses matching paraAppNumbers auto-resolves to these
// real names on the device via VaultProvider.

import React, { useRef, useState } from 'react';
import { parseRosterFile, parseRosterJson, parseRosterCsv, parseRosterMarkdown, dedupeAndValidate } from './rosterParsers';
import { useVault } from '../../context/VaultProvider';

const FORMATS = [
  { id: 'auto',     label: '📄 Auto-detect (any file)', accept: '.json,.csv,.md,.txt,.pdf' },
  { id: 'json',     label: '🟨 JSON',                   accept: '.json', parse: (t) => parseRosterJson(t) },
  { id: 'csv',      label: '📊 CSV',                    accept: '.csv',  parse: (t) => parseRosterCsv(t) },
  { id: 'markdown', label: '📝 Markdown / TXT',         accept: '.md,.txt', parse: (t) => parseRosterMarkdown(t) },
  { id: 'pdf',      label: '📕 PDF',                    accept: '.pdf' },
];

export default function RosterOnlyImport() {
  const { mergeVault, hasVault, vault, persisted } = useVault();

  const [format, setFormat] = useState('auto');
  const [source, setSource] = useState('file'); // 'file' | 'paste'
  const [pasteText, setPasteText] = useState('');
  const [preview, setPreview] = useState(null); // { entries, errors }
  const [busy, setBusy] = useState(false);
  const [savedSummary, setSavedSummary] = useState(null); // { added, updated, total }
  const fileRef = useRef();

  const currentFormat = FORMATS.find(f => f.id === format);

  async function runFileImport(file) {
    setBusy(true); setSavedSummary(null);
    try {
      const result = format === 'auto'
        ? await parseRosterFile(file)
        : (currentFormat?.parse
            ? currentFormat.parse(await file.text())
            : await parseRosterFile(file));
      const deduped = dedupeAndValidate(result.entries);
      setPreview({
        entries: deduped.entries,
        errors: [...result.errors, ...deduped.errors],
      });
    } catch (e) {
      setPreview({ entries: [], errors: [`Parse error: ${e.message}`] });
    }
    setBusy(false);
  }

  function runPasteImport() {
    setSavedSummary(null);
    const text = pasteText || '';
    // Auto-detect pasted text: JSON if it looks like JSON, else Markdown rules
    let result;
    const trimmed = text.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      result = parseRosterJson(text);
    } else if (trimmed.includes(',') && trimmed.split('\n').every(l => !l.trim() || l.includes(','))) {
      result = parseRosterCsv(text);
    } else {
      result = parseRosterMarkdown(text);
    }
    const deduped = dedupeAndValidate(result.entries);
    setPreview({
      entries: deduped.entries,
      errors: [...result.errors, ...deduped.errors],
    });
  }

  async function confirmSave() {
    if (!preview?.entries?.length) return;
    const map = {};
    preview.entries.forEach(e => { map[e.paraAppNumber] = e.realName; });
    const summary = await mergeVault(map);
    setSavedSummary({ ...summary, total: preview.entries.length });
    setPreview(null);
    setPasteText('');
    if (fileRef.current) fileRef.current.value = '';
  }

  function cancelPreview() {
    setPreview(null);
    setSavedSummary(null);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <div className="card-elevated" style={{ padding: 'var(--space-5)' }}>
        <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 6, letterSpacing: '-0.01em' }}>
          Save real names + Para App Numbers to this device
        </h3>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          Upload a file (or paste text) with one row per student showing the real name
          and their 6-digit Para App Number. These stay on your device only.
          Any later IEP file using matching Para App Numbers will auto-resolve to these names.
        </p>
      </div>

      {/* Source + Format picker */}
      <div className="panel" style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={labelStyle}>Source</label>
            <select value={source} onChange={e => { setSource(e.target.value); setPreview(null); setSavedSummary(null); }} className="period-select" style={{ width: '100%' }}>
              <option value="file">📁 Upload a file</option>
              <option value="paste">📋 Paste text</option>
            </select>
          </div>
          {source === 'file' && (
            <div style={{ flex: 1, minWidth: 200 }}>
              <label style={labelStyle}>Format</label>
              <select value={format} onChange={e => setFormat(e.target.value)} className="period-select" style={{ width: '100%' }}>
                {FORMATS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
              </select>
            </div>
          )}
        </div>

        {source === 'file' ? (
          <>
            <input
              ref={fileRef}
              type="file"
              accept={currentFormat?.accept || '.json,.csv,.md,.txt,.pdf'}
              onChange={e => { const f = e.target.files[0]; if (f) runFileImport(f); }}
              disabled={busy}
              style={{
                padding: 'var(--space-3)',
                background: 'var(--bg-dark)',
                color: 'var(--text-primary)',
                border: '1px dashed var(--border-light)',
                borderRadius: 'var(--radius-md)',
                fontSize: 13,
                cursor: 'pointer',
                width: '100%',
              }}
            />
            {busy && <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Parsing…</div>}
          </>
        ) : (
          <>
            <textarea
              value={pasteText}
              onChange={e => setPasteText(e.target.value)}
              placeholder={`Paste text in any of these formats:

Maria Garcia: 847293
James Wilson — 128456

OR a Markdown table, JSON array, or CSV...`}
              className="data-textarea"
              style={{ height: 180, fontFamily: 'JetBrains Mono, monospace', fontSize: 12.5 }}
            />
            <button
              type="button"
              onClick={runPasteImport}
              disabled={!pasteText.trim()}
              className="btn btn-primary"
              style={{ alignSelf: 'flex-start' }}
            >
              Parse pasted text
            </button>
          </>
        )}

        {/* Format examples */}
        <details style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          <summary style={{ cursor: 'pointer', color: 'var(--text-secondary)' }}>
            Show accepted formats
          </summary>
          <div style={{ marginTop: 'var(--space-3)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-3)' }}>
            <FormatCard title="JSON">{`[
  { "realName": "Maria Garcia",
    "paraAppNumber": "847293" },
  { "realName": "James Wilson",
    "paraAppNumber": "128456" }
]`}</FormatCard>
            <FormatCard title="CSV">{`Name,ParaAppNumber
Maria Garcia,847293
James Wilson,128456`}</FormatCard>
            <FormatCard title="Markdown / TXT">{`Maria Garcia: 847293
James Wilson — 128456
847293 Maria Garcia`}</FormatCard>
            <FormatCard title="Markdown table">{`| Name          | Para # |
| ------------- | ------ |
| Maria Garcia  | 847293 |
| James Wilson  | 128456 |`}</FormatCard>
          </div>
        </details>
      </div>

      {/* Preview */}
      {preview && (
        <div className="panel" style={{ padding: 'var(--space-4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>
                Preview: {preview.entries.length} student{preview.entries.length !== 1 ? 's' : ''} parsed
              </div>
              {preview.errors.length > 0 && (
                <div style={{ fontSize: 11, color: 'var(--yellow)', marginTop: 3 }}>
                  {preview.errors.length} warning{preview.errors.length !== 1 ? 's' : ''} — see below
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button onClick={cancelPreview} className="btn btn-secondary">Cancel</button>
              <button onClick={confirmSave} disabled={preview.entries.length === 0} className="btn btn-primary">
                Save {preview.entries.length} to this device
              </button>
            </div>
          </div>

          {preview.entries.length > 0 && (
            <div className="table-container" style={{ maxHeight: 360 }}>
              <table className="data-table">
                <thead>
                  <tr><th>#</th><th>Real Name</th><th>Para App Number</th></tr>
                </thead>
                <tbody>
                  {preview.entries.map((e, i) => (
                    <tr key={`${e.paraAppNumber}-${i}`}>
                      <td style={{ color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                        {i + 1}
                      </td>
                      <td>{e.realName}</td>
                      <td style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--accent-hover)', letterSpacing: 1 }}>
                        {e.paraAppNumber}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {preview.errors.length > 0 && (
            <div style={{
              marginTop: 'var(--space-3)',
              padding: 'var(--space-3)',
              background: 'var(--yellow-muted)',
              border: '1px solid rgba(251,191,36,0.35)',
              borderRadius: 'var(--radius-md)',
              fontSize: 12, color: 'var(--yellow)',
              maxHeight: 160, overflowY: 'auto',
            }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Warnings:</div>
              <ul style={{ paddingLeft: 18, lineHeight: 1.6 }}>
                {preview.errors.map((err, i) => <li key={i}>{err}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Success */}
      {savedSummary && (
        <div style={{
          padding: 'var(--space-4)',
          background: 'var(--green-muted)',
          border: '1px solid rgba(52,211,153,0.4)',
          borderRadius: 'var(--radius-lg)',
          display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start',
        }}>
          <span style={{ fontSize: 22, flexShrink: 0 }}>✅</span>
          <div>
            <div style={{ fontWeight: 700, color: 'var(--green)', fontSize: 14 }}>
              Saved {savedSummary.total} names to this device
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.5 }}>
              {savedSummary.added} added{savedSummary.updated > 0 ? ` · ${savedSummary.updated} updated` : ''}.
              The "Show real names" toggle is on — any future upload with matching Para App Numbers
              will now resolve to these real names.{' '}
              {!persisted && (
                <b style={{ color: 'var(--yellow)' }}>
                  Enable "Remember on this device" in the sidebar if you want these to survive page refresh.
                </b>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Current vault contents */}
      {hasVault && !preview && !savedSummary && (
        <div className="panel" style={{ padding: 'var(--space-4)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 6 }}>
            Currently saved on this device ({Object.keys(vault).length})
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            {Object.keys(vault).length > 0 && (
              <span>
                {Object.entries(vault).slice(0, 3).map(([k, n]) => `${n} (${k})`).join(', ')}
                {Object.keys(vault).length > 3 && ` + ${Object.keys(vault).length - 3} more`}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const labelStyle = {
  display: 'block',
  fontSize: 11, fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: '0.1em',
  color: 'var(--text-muted)',
  marginBottom: 4,
};

function FormatCard({ title, children }) {
  return (
    <div style={{
      padding: 'var(--space-3)',
      background: 'var(--bg-dark)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
    }}>
      <div style={{
        fontSize: 10, fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.1em',
        color: 'var(--accent-hover)',
        marginBottom: 6,
      }}>
        {title}
      </div>
      <pre style={{
        fontSize: 11, fontFamily: 'JetBrains Mono, monospace',
        color: 'var(--text-primary)', lineHeight: 1.5,
        whiteSpace: 'pre-wrap', margin: 0,
      }}>
        {children}
      </pre>
    </div>
  );
}
