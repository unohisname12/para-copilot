import React from 'react';
import { useEscape } from '../../hooks/useEscape';
import { lookupAccommodation } from '../../data/accommodationGlossary';

export default function AccommodationDetailModal({ open, onClose, accommodation, student, logs = [], strategies = [] }) {
  useEscape(open ? onClose : () => {});
  if (!open || !accommodation) return null;

  const text = typeof accommodation === 'string' ? accommodation : (accommodation.text || '');
  const sourceFile = student?.iepImport?.fileName || student?.importMeta?.fileName || null;
  const sourceDate = student?.iepImport?.date || student?.importMeta?.date || null;

  const glossary = lookupAccommodation(text);

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
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 6 }}>From the IEP</div>
          <div style={{ fontSize: 14, lineHeight: 1.5 }}>{text}</div>
        </div>

        {glossary ? (
          <div style={{ background: 'rgba(167,139,250,.08)', border: '1px solid rgba(167,139,250,.3)', borderRadius: 8, padding: 14, marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: '#A78BFA', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 6, fontWeight: 700 }}>What this means — {glossary.title}</div>
            <div style={{ fontSize: 14, lineHeight: 1.55, marginBottom: 12 }}>{glossary.plain}</div>

            <div style={{ fontSize: 11, color: '#86EFAC', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 6, fontWeight: 700 }}>What it looks like in class</div>
            <ul style={{ margin: 0, paddingLeft: 20, marginBottom: 12 }}>
              {glossary.looksLike.map((tip, i) => (
                <li key={i} style={{ fontSize: 13, lineHeight: 1.55, marginBottom: 4 }}>{tip}</li>
              ))}
            </ul>

            {glossary.watchOut && (
              <>
                <div style={{ fontSize: 11, color: '#FCA5A5', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 6, fontWeight: 700 }}>Watch out</div>
                <div style={{ fontSize: 13, lineHeight: 1.55, color: '#FCA5A5' }}>{glossary.watchOut}</div>
              </>
            )}
          </div>
        ) : (
          <div style={{ background: 'rgba(255,255,255,.03)', border: '1px dashed rgba(255,255,255,.15)', borderRadius: 8, padding: 14, marginBottom: 14 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
              No quick explainer in the glossary for this accommodation. Ask the case manager or sped teacher what it should look like in your room — and add it to the team's shared notes once you know.
            </div>
          </div>
        )}

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
