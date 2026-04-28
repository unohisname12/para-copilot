import React, { useRef, useState } from 'react';
import { verifyRoster } from './verifyRoster';

const STATUS_META = {
  linked:    { label: 'Linked',     icon: '✓', color: '#10b981', bg: '#052e22' },
  missing:   { label: 'Missing',    icon: '⚠', color: '#fbbf24', bg: '#1a1505' },
  orphan:    { label: 'Orphan',     icon: '⚠', color: '#fb923c', bg: '#1a0f05' },
  collision: { label: 'Collision',  icon: '🔢', color: '#f87171', bg: '#1a0505' },
  noPeriod:  { label: 'No period',  icon: '?', color: '#60a5fa', bg: '#0c1a2e' },
};

// VerifyRoster — drop your roster CSV in, see what landed where.
//
// Props:
//   importedStudents: { [id]: student }  — paraImportedStudentsV1 contents
//   vault:            { [paraAppNumber]: realName } — IndexedDB vault map
//   onRemoveOrphan:   (studentId) => void  — optional pruning callback
export default function VerifyRoster({ importedStudents = {}, vault = {}, onRemoveOrphan }) {
  const [csvText, setCsvText] = useState(null);
  const [csvName, setCsvName] = useState('');
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const fileRef = useRef();

  const importedCount = Object.keys(importedStudents).length;

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    try {
      const text = await file.text();
      setCsvText(text);
      setCsvName(file.name);
      const r = verifyRoster({
        imported: importedStudents,
        vault,
        csvText: text,
      });
      setReport(r);
      if (r.errors?.length) setError(r.errors.join(' '));
    } catch (err) {
      setError(`Could not read file: ${err.message}`);
    }
    e.target.value = '';
  };

  const orphanCount = report?.summary?.orphan || 0;
  const removeAllOrphans = () => {
    if (!report || !onRemoveOrphan) return;
    report.rows.forEach(r => { if (r.status === 'orphan' && r.studentId) onRemoveOrphan(r.studentId); });
    // After pruning, force a fresh verification so the table updates
    if (csvText) {
      const fresh = verifyRoster({
        imported: importedStudents, // parent re-renders with updated importedStudents
        vault,
        csvText,
      });
      setReport(fresh);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{
        padding: '12px 16px',
        background: '#0c1a2e',
        border: '1px solid #1e3a8a',
        borderRadius: 10,
        fontSize: 12,
        color: '#cbd5e1',
        lineHeight: 1.55,
      }}>
        🔍 <strong>Roster Health Check.</strong> Drop the same roster CSV you used to import — this will
        show you, kid by kid, which ones landed correctly and flag anything weird (missing kids, orphans
        from old imports, paraAppNumber collisions, kids with no period). All checks run on your computer.
      </div>

      <input
        type="file"
        ref={fileRef}
        accept=".csv"
        style={{ display: 'none' }}
        onChange={handleFile}
      />

      <button
        onClick={() => fileRef.current?.click()}
        style={{
          padding: '14px 20px',
          borderRadius: 10,
          border: `2px solid ${csvName ? '#3b82f6' : 'var(--border-light)'}`,
          background: csvName ? '#0c1a2e' : 'var(--bg-surface)',
          color: csvName ? '#60a5fa' : 'var(--text-primary)',
          fontSize: 14,
          fontWeight: 700,
          cursor: 'pointer',
          textAlign: 'left',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <span style={{ fontSize: 22 }}>📄</span>
        <span>{csvName ? `✓ ${csvName}` : 'Upload your roster CSV to verify'}</span>
      </button>

      {error && (
        <div style={{ padding: '10px 14px', background: '#1a0505', border: '1px solid #7f1d1d',
          borderRadius: 8, fontSize: 12, color: '#f87171' }}>
          ✗ {error}
        </div>
      )}

      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
        Currently in app: <strong style={{ color: 'var(--text-primary)' }}>{importedCount}</strong> imported student{importedCount === 1 ? '' : 's'}
      </div>

      {report && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
            {Object.entries(STATUS_META).map(([key, meta]) => (
              <div key={key} style={{
                background: 'var(--bg-surface)',
                borderRadius: 8,
                padding: '10px 12px',
                textAlign: 'center',
                border: report.summary[key] > 0 ? `1px solid ${meta.color}40` : '1px solid transparent',
              }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: report.summary[key] > 0 ? meta.color : 'var(--text-muted)' }}>
                  {report.summary[key]}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{meta.label}</div>
              </div>
            ))}
          </div>

          {orphanCount > 0 && onRemoveOrphan && (
            <button
              onClick={removeAllOrphans}
              style={{
                padding: '10px 14px',
                borderRadius: 8,
                border: '1px solid #fb923c',
                background: '#1a0f05',
                color: '#fb923c',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Remove {orphanCount} orphan{orphanCount === 1 ? '' : 's'} from the app
            </button>
          )}

          <div style={{ overflowX: 'auto', maxHeight: 480, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-surface)' }}>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Status', 'Real Name', 'Para #', 'Period', 'Pseudonym', 'Detail'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.rows.map((r, i) => {
                  const meta = STATUS_META[r.status] || STATUS_META.linked;
                  return (
                    <tr key={`${r.paraAppNumber}_${i}`} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '7px 12px' }}>
                        <span style={{
                          fontSize: 10, fontWeight: 700,
                          background: meta.bg, color: meta.color,
                          padding: '2px 8px', borderRadius: 20,
                          whiteSpace: 'nowrap',
                        }}>
                          {meta.icon} {meta.label}
                        </span>
                      </td>
                      <td style={{ padding: '7px 12px', color: 'var(--text-primary)' }}>{r.realName || '—'}</td>
                      <td style={{ padding: '7px 12px', fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-secondary)' }}>{r.paraAppNumber}</td>
                      <td style={{ padding: '7px 12px', color: 'var(--text-secondary)' }}>{r.periodId || '—'}</td>
                      <td style={{ padding: '7px 12px', color: 'var(--text-muted)' }}>{r.pseudonym || '—'}</td>
                      <td style={{ padding: '7px 12px', color: 'var(--text-muted)', fontSize: 11 }}>{r.detail}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
