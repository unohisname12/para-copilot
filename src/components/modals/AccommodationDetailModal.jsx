import React from 'react';
import { useEscape } from '../../hooks/useEscape';

export default function AccommodationDetailModal({ open, onClose, accommodation, student, logs = [], strategies = [] }) {
  useEscape(open ? onClose : () => {});
  if (!open || !accommodation) return null;

  const text = typeof accommodation === 'string' ? accommodation : (accommodation.text || '');
  const sourceFile = student?.iepImport?.fileName || student?.importMeta?.fileName || null;
  const sourceDate = student?.iepImport?.date || student?.importMeta?.date || null;

  const snippet = text.toLowerCase().slice(0, 25);
  const linkedStrategies = (strategies || []).filter(s => {
    const st = (typeof s === 'string' ? s : (s.text || '')).toLowerCase();
    return snippet && st && st.includes(snippet);
  });
  const linkedLogs = (logs || []).filter(l => {
    const note = (l.note || l.text || '').toLowerCase();
    return snippet && note && note.includes(snippet);
  });

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: 560 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>Accommodation detail</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: 20, cursor: 'pointer' }}>×</button>
        </div>

        <div style={{ background: 'rgba(0,0,0,.25)', borderRadius: 8, padding: 14, marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 6 }}>Text</div>
          <div style={{ fontSize: 14, lineHeight: 1.5 }}>{text}</div>
        </div>

        {(sourceFile || sourceDate) && (
          <div style={{ marginBottom: 14, fontSize: 12, color: 'var(--text-muted)' }}>
            <span style={{ textTransform: 'uppercase', letterSpacing: '.07em', marginRight: 8 }}>Source</span>
            {sourceFile && <span>{sourceFile}</span>}
            {sourceDate && <span style={{ marginLeft: 8 }}>· {sourceDate}</span>}
          </div>
        )}

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 6 }}>Linked strategies ({linkedStrategies.length})</div>
          {linkedStrategies.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>No strategies match this accommodation text.</div>
          ) : (
            linkedStrategies.map((s, i) => (
              <div key={i} style={{ fontSize: 13, padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,.05)' }}>{typeof s === 'string' ? s : s.text}</div>
            ))
          )}
        </div>

        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 6 }}>Past logs that referenced it ({linkedLogs.length})</div>
          {linkedLogs.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>No past logs reference this accommodation.</div>
          ) : (
            linkedLogs.slice(0, 20).map(l => (
              <div key={l.id} style={{ fontSize: 12, padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,.05)' }}>
                <span style={{ color: 'var(--text-muted)' }}>{l.date}</span> — {l.note || l.text}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
