import React, { useState, useEffect } from 'react';

// Subtle strip pinned to the top of the dashboard scroll area.
// Collapsed = thin "📋 Mass log" pill on the right, single-line guidance.
// Expanded = action chips inline. After picking an action, the same
// strip shows the selected count + Log/Cancel inline.
//
// Crucially: NO overlay, NO backdrop blur. The strip is just inline
// content. Student cards behind/below it stay fully clickable so the
// para can highlight kids while the chips are visible.
export default function MassLogStrip({
  actions,
  activeAction,
  setActiveAction,
  selectedCount,
  onCommit,
  onCancel,
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');

  // Auto-open when an action is freshly picked so the para sees the
  // commit button without needing an extra tap.
  useEffect(() => {
    if (activeAction) setOpen(true);
  }, [activeAction]);

  // Reset the shared note whenever the activeAction clears (committed
  // or cancelled) so the next round starts fresh.
  useEffect(() => {
    if (!activeAction) setNote('');
  }, [activeAction]);

  const commit = () => {
    onCommit?.(note);
  };

  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 25,
        background: 'rgba(20,18,47,.92)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        borderBottom: '1px solid rgba(167,139,250,.18)',
        padding: '6px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: open ? 8 : 0,
        transition: 'gap 160ms ease',
      }}
    >
      {/* Top row — compact, always visible */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
          aria-label="Toggle Mass Log"
          style={{
            background: open ? 'rgba(167,139,250,.18)' : 'transparent',
            border: '1px solid rgba(167,139,250,.4)',
            color: '#A78BFA',
            borderRadius: 999,
            padding: '4px 12px',
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: '.08em',
            textTransform: 'uppercase',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span style={{ fontSize: 13 }}>📋</span>
          Mass Log
          <span style={{ fontSize: 9, opacity: 0.7 }}>{open ? '▲' : '▼'}</span>
        </button>

        <span style={{ fontSize: 12, color: 'var(--text-muted)', flex: 1, minWidth: 0 }}>
          {activeAction ? (
            <>
              <strong style={{ color: activeAction.color }}>{activeAction.icon} {activeAction.label}</strong>
              <span style={{ color: 'var(--text-muted)' }}> — tap student cards to highlight, then "Log for N" below.</span>
            </>
          ) : (
            <span>Tap to pick an action, then tap each student card you want to log it for.</span>
          )}
        </span>

        {activeAction && (
          <span style={{
            background: selectedCount > 0 ? 'rgba(34,197,94,.15)' : 'rgba(255,255,255,.04)',
            color: selectedCount > 0 ? '#86EFAC' : 'var(--text-muted)',
            border: `1px solid ${selectedCount > 0 ? 'rgba(34,197,94,.4)' : 'rgba(255,255,255,.1)'}`,
            borderRadius: 999,
            padding: '2px 10px',
            fontSize: 11,
            fontWeight: 700,
            whiteSpace: 'nowrap',
          }}>
            {selectedCount} selected
          </span>
        )}
      </div>

      {/* Expanded body — action chips OR commit row */}
      {open && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingBottom: 4 }}>
          {actions.map(action => {
            const active = activeAction?.id === action.id;
            return (
              <button
                key={action.id}
                onClick={() => setActiveAction(prev => prev?.id === action.id ? null : action)}
                style={{
                  minHeight: 32,
                  padding: '4px 10px',
                  borderRadius: 8,
                  border: `1px solid ${active ? action.border : 'var(--border)'}`,
                  background: active ? action.bg : 'transparent',
                  color: active ? action.color : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  fontSize: 12,
                  fontWeight: active ? 700 : 500,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  transition: 'all 120ms ease',
                }}
              >
                <span style={{ fontSize: 13 }}>{action.icon}</span>
                {action.label}
              </button>
            );
          })}

        </div>
      )}

      {/* Note row — only when an action is picked. The note applies to
          every kid in the selection. Blank = falls back to action default. */}
      {open && activeAction && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', paddingBottom: 4 }}>
          <input
            type="text"
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder={`Note for all ${selectedCount || 'selected'} students (optional — applied to each log)`}
            onKeyDown={e => {
              if (e.key === 'Enter' && selectedCount > 0) commit();
              if (e.key === 'Escape') onCancel?.();
            }}
            style={{
              flex: 1,
              minHeight: 36,
              padding: '6px 12px',
              background: 'rgba(0,0,0,.3)',
              border: '1px solid rgba(255,255,255,.12)',
              borderRadius: 8,
              color: 'var(--text-primary)',
              fontSize: 13,
              fontFamily: 'inherit',
            }}
          />
          <button
            onClick={commit}
            disabled={selectedCount === 0}
            style={{
              minHeight: 36,
              padding: '6px 16px',
              background: selectedCount === 0 ? 'rgba(255,255,255,.04)' : '#A78BFA',
              color: selectedCount === 0 ? 'var(--text-muted)' : '#1E1B4B',
              border: '1px solid rgba(167,139,250,.5)',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 800,
              cursor: selectedCount === 0 ? 'not-allowed' : 'pointer',
              opacity: selectedCount === 0 ? 0.55 : 1,
              whiteSpace: 'nowrap',
            }}
          >✓ Log for {selectedCount}</button>
          <button
            onClick={onCancel}
            aria-label="Clear selection"
            style={{
              minHeight: 36,
              padding: '6px 12px',
              background: 'transparent',
              color: '#FCA5A5',
              border: '1px solid rgba(248,113,113,.35)',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >✕</button>
        </div>
      )}
    </div>
  );
}
