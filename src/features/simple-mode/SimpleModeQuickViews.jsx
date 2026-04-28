// ── Simple Mode quick-views shortcut ─────────────────────────
// Single 🗄️ button in the Simple Mode header opens a popover with three
// shortcuts that overlay on top of Simple Mode (Esc closes). Para never
// leaves the mode — they peek at logs / goals / topics, then keep moving.

import React, { useState, useEffect, useRef } from 'react';
import { resolveLabel } from '../../privacy/nameResolver';
import { useEscape } from '../../hooks/useEscape';
import { GoalTracker } from '../../components/panels/GoalTracker';
import { TrainingGapPanel } from '../../components/panels/TrainingGapPanel';

// Mini-vault — shows the last 50 logs for the current period, with a search
// box. Lightweight; doesn't try to be the full Data Vault. For deeper digging
// the para can leave Simple Mode.
function RecentLogsOverlay({ logs, students, studentsMap, currentDate, onClose }) {
  useEscape(onClose);
  const [query, setQuery] = useState('');

  const periodStudentIds = new Set(students || []);
  const periodLogs = (logs || [])
    .filter(l => periodStudentIds.has(l.studentId))
    .sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime())
    .slice(0, 200);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? periodLogs.filter(l => {
        const s = studentsMap?.[l.studentId];
        const name = s ? resolveLabel(s, 'compact').toLowerCase() : '';
        return (l.note || '').toLowerCase().includes(q)
          || (l.type || '').toLowerCase().includes(q)
          || name.includes(q);
      })
    : periodLogs;

  return (
    <Sheet title="Recent logs (this period)" onClose={onClose}>
      <input
        autoFocus
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search by student, type, or text…"
        style={{
          width: '100%', padding: '10px 12px',
          background: 'var(--bg-dark)', color: 'var(--text-primary)',
          border: '1px solid var(--border)', borderRadius: 8,
          fontSize: 13, fontFamily: 'inherit',
          marginBottom: 12,
        }}
      />
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
        Showing {filtered.length} of {periodLogs.length} most-recent logs · today is {currentDate}
      </div>
      {filtered.length === 0 ? (
        <div style={{ padding: 16, fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center' }}>
          {q ? 'No logs match your search.' : 'No logs yet for this period.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filtered.map(l => {
            const s = studentsMap?.[l.studentId];
            const studentLabel = s ? resolveLabel(s, 'compact') : l.studentId;
            const color = s?.color || 'var(--border)';
            return (
              <div key={l.id} style={{
                padding: '8px 12px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderLeft: `3px solid ${color}`,
                borderRadius: 6,
                fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.45,
              }}>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  gap: 8, marginBottom: 4, flexWrap: 'wrap',
                }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color }}>{studentLabel}</span>
                  <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
                    {l.type || 'Note'}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                    {l.timestamp ? new Date(l.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : (l.date || '—')}
                  </span>
                </div>
                <div>{l.note || l.text || '—'}</div>
              </div>
            );
          })}
        </div>
      )}
    </Sheet>
  );
}

function Sheet({ title, onClose, children }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(2, 6, 23, 0.92)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        display: 'flex', flexDirection: 'column',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          flex: 1, minHeight: 0,
          margin: 'min(3vw, 28px)',
          background: 'var(--panel-bg)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div style={{
          padding: '14px 20px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
            {title}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              minWidth: 36, minHeight: 36, borderRadius: 8,
              background: 'transparent', border: '1px solid var(--border)',
              color: 'var(--text-secondary)', cursor: 'pointer',
              fontSize: 16, fontFamily: 'inherit',
            }}
          >✕</button>
        </div>
        <div style={{
          flex: 1, minHeight: 0, overflowY: 'auto',
          padding: 16,
        }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// Trigger button + popover menu.
export function SimpleModeQuickViews({ students, studentsMap, logs, addLog, currentDate }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [view, setView] = useState(null); // 'logs' | 'goals' | 'topics' | null
  const wrapRef = useRef(null);

  // Click outside menu to close.
  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuOpen]);

  const open = (v) => { setView(v); setMenuOpen(false); };

  return (
    <div ref={wrapRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={() => setMenuOpen(o => !o)}
        title="Quick access: logs, goals, topics"
        aria-label="Open quick views menu"
        aria-expanded={menuOpen}
        className="btn btn-secondary"
        style={{
          fontSize: 16, padding: '8px 12px',
          minHeight: 38,
          display: 'flex', alignItems: 'center', gap: 6,
        }}
      >
        🗄️ <span style={{ fontSize: 12, fontWeight: 600 }}>More</span>
      </button>

      {menuOpen && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', right: 0,
          minWidth: 240, zIndex: 50,
          background: 'var(--panel-bg)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          boxShadow: '0 12px 36px rgba(0,0,0,0.4)',
          padding: 6,
          display: 'flex', flexDirection: 'column', gap: 2,
        }}>
          <MenuItem icon="🗂️" label="Recent logs" hint="Search this period's notes" onClick={() => open('logs')} />
          <MenuItem icon="🎯" label="Goal Tracker" hint="Visual goal dashboard" onClick={() => open('goals')} />
          <MenuItem icon="🔖" label="Topics for Next Check-in" hint="EBP coaching topics" onClick={() => open('topics')} />
        </div>
      )}

      {view === 'logs' && (
        <RecentLogsOverlay
          logs={logs}
          students={students}
          studentsMap={studentsMap}
          currentDate={currentDate}
          onClose={() => setView(null)}
        />
      )}

      {view === 'goals' && (
        <Sheet title="Goal Tracker" onClose={() => setView(null)}>
          <GoalTracker
            students={students}
            studentsMap={studentsMap}
            logs={logs}
            onSave={addLog}
          />
        </Sheet>
      )}

      {view === 'topics' && (
        <Sheet title="Topics for Next Check-in" onClose={() => setView(null)}>
          <TrainingGapPanel
            students={students}
            studentsMap={studentsMap}
            logs={logs}
          />
        </Sheet>
      )}
    </div>
  );
}

function MenuItem({ icon, label, hint, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 12px',
        background: 'transparent', border: 'none', borderRadius: 8,
        color: 'var(--text-primary)', cursor: 'pointer',
        fontFamily: 'inherit', textAlign: 'left',
        minHeight: 44,
        transition: 'background 120ms',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-surface)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
    >
      <span style={{ fontSize: 18, lineHeight: 1 }}>{icon}</span>
      <span style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{hint}</span>
      </span>
    </button>
  );
}
