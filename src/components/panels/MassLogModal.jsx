import React, { useState } from 'react';
import { useEscape } from '../../hooks/useEscape';
import { resolveLabel } from '../../privacy/nameResolver';
import { usePrivacyMode } from '../../hooks/usePrivacyMode';
import { maskName } from '../../utils/privacyMask';
import { QUICK_ACTIONS } from '../../data';

const btnGhost = {
  background: 'transparent',
  border: '1px solid rgba(255,255,255,.15)',
  color: 'var(--text-primary)',
  borderRadius: 6,
  padding: '6px 12px',
  fontSize: 12,
  cursor: 'pointer',
};
const fieldStyle = {
  width: '100%',
  background: 'rgba(0,0,0,.25)',
  border: '1px solid rgba(255,255,255,.1)',
  borderRadius: 6,
  color: 'var(--text-primary)',
  padding: 8,
  fontSize: 13,
};

export default function MassLogModal({ open, onClose, students, studentsMap, onLog }) {
  const { on: privacyOn } = usePrivacyMode();
  const [picked, setPicked] = useState(() => new Set());
  const [actionId, setActionId] = useState('');
  const [note, setNote] = useState('');
  useEscape(open ? onClose : () => {});
  if (!open) return null;

  const lookup = studentsMap || {};
  const studentList = (students || []).filter(id => lookup[id]);
  const action = QUICK_ACTIONS.find(a => a.id === actionId) || null;
  const labelFor = (id) => {
    const raw = resolveLabel(lookup[id], 'compact');
    return privacyOn ? maskName(raw) : raw;
  };

  const togglePick = (id) => setPicked(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const pickAll = () => setPicked(new Set(studentList));
  const clearPicks = () => setPicked(new Set());

  const submit = () => {
    if (!action || picked.size === 0) return;
    const finalNote = note.trim() || action.defaultNote;
    for (const sid of picked) {
      onLog(sid, finalNote, action.logType, {
        source: 'mass_log',
        category: action.category,
        tags: action.tags,
      });
    }
    setPicked(new Set());
    setNote('');
    setActionId('');
    onClose?.();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: 560 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>Mass log</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: 20, cursor: 'pointer' }}>×</button>
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Students</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <button onClick={pickAll} style={btnGhost}>Select all in period</button>
            <button onClick={clearPicks} style={btnGhost}>Clear</button>
            <span style={{ marginLeft: 'auto', fontSize: 12, color: '#A78BFA', alignSelf: 'center' }}>{picked.size} selected</span>
          </div>
          {studentList.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>No students in this period.</div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {studentList.map(id => (
                <button
                  key={id}
                  onClick={() => togglePick(id)}
                  style={{
                    background: picked.has(id) ? 'rgba(167,139,250,.25)' : 'rgba(255,255,255,.05)',
                    border: picked.has(id) ? '1px solid #A78BFA' : '1px solid rgba(255,255,255,.1)',
                    color: picked.has(id) ? '#E9D5FF' : 'var(--text-primary)',
                    borderRadius: 18,
                    padding: '6px 12px',
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >{labelFor(id)}</button>
              ))}
            </div>
          )}
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Action</div>
          <select value={actionId} onChange={e => setActionId(e.target.value)} style={fieldStyle}>
            <option value="">— pick a quick action —</option>
            {QUICK_ACTIONS.map(a => (
              <option key={a.id} value={a.id}>{a.icon} {a.label} · {a.logType}</option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Note (optional — uses action's default if blank)</div>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={3}
            placeholder={action ? action.defaultNote : ''}
            style={fieldStyle}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={btnGhost}>Cancel</button>
          <button
            onClick={submit}
            disabled={!action || picked.size === 0}
            style={{
              background: '#A78BFA',
              color: '#1E1B4B',
              border: 'none',
              borderRadius: 6,
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 700,
              cursor: (!action || picked.size === 0) ? 'not-allowed' : 'pointer',
              opacity: (!action || picked.size === 0) ? 0.4 : 1,
            }}
          >Log for {picked.size} student{picked.size === 1 ? '' : 's'}</button>
        </div>
      </div>
    </div>
  );
}
