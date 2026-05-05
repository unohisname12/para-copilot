import React, { useState, useEffect } from 'react';

// Floating Mass Log launcher pinned bottom-right of the dashboard.
// Always visible regardless of how the dashboard layout is sized,
// so the para never has to hunt for the action bar.
//
// Two stages:
//   1. No activeAction → drawer shows the action chip grid.
//   2. activeAction set → drawer shows "Tap student cards" guidance
//      with a live count, a Log button, and Cancel.
//
// Tapping outside the drawer collapses it but keeps activeAction +
// selection alive so the para can keep tapping student cards. The
// FAB shows an N-selected badge when collapsed mid-flow.
export default function MassLogFab({
  actions,
  activeAction,
  setActiveAction,
  selectedCount,
  onCommit,
  onCancel,
}) {
  const [open, setOpen] = useState(false);

  // When an action is freshly picked, ensure drawer is open so the
  // para sees the next-step guidance. We only auto-open on transition
  // from null → action (not on every render).
  useEffect(() => {
    if (activeAction) setOpen(true);
  }, [activeAction]);

  const handleCancel = () => {
    onCancel?.();
    setOpen(false);
  };
  const handleCommit = () => {
    if (selectedCount === 0) return;
    onCommit?.();
    setOpen(false);
  };

  return (
    <>
      {/* Backdrop only when drawer is open. Click closes drawer but
          keeps the in-flight action + selection. */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,.35)',
            zIndex: 60,
            backdropFilter: 'blur(2px)',
          }}
        />
      )}

      {/* Drawer — slides up from the FAB. */}
      {open && (
        <div
          role="dialog"
          aria-label="Mass log"
          style={{
            position: 'fixed',
            bottom: 90,
            right: 24,
            width: 'min(420px, calc(100vw - 32px))',
            maxHeight: 'calc(100vh - 140px)',
            overflowY: 'auto',
            background: 'linear-gradient(180deg, #1E1B4B 0%, #14122F 100%)',
            border: '1px solid rgba(167,139,250,.4)',
            borderRadius: 16,
            boxShadow: '0 24px 60px rgba(0,0,0,.55), 0 0 0 1px rgba(167,139,250,.18)',
            zIndex: 61,
            padding: 18,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{
                background: 'rgba(167,139,250,.22)',
                color: '#A78BFA',
                border: '1px solid rgba(167,139,250,.5)',
                borderRadius: 999,
                padding: '4px 12px',
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: '.08em',
                textTransform: 'uppercase',
              }}>📋 Mass Log</span>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close"
              style={{
                background: 'rgba(255,255,255,.06)',
                border: '1px solid rgba(255,255,255,.1)',
                color: 'var(--text-primary)',
                fontSize: 16,
                lineHeight: 1,
                width: 30,
                height: 30,
                borderRadius: 8,
                cursor: 'pointer',
              }}
            >×</button>
          </div>

          {!activeAction ? (
            <>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.5 }}>
                <strong style={{ color: '#A78BFA' }}>Step 1:</strong> pick the action you want to log for several students.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                {actions.map(action => (
                  <button
                    key={action.id}
                    onClick={() => setActiveAction(action)}
                    style={{
                      minHeight: 56,
                      padding: '10px 12px',
                      borderRadius: 10,
                      border: `1.5px solid ${action.border}`,
                      background: action.bg,
                      color: action.color,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      fontSize: 13,
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      textAlign: 'left',
                    }}
                  >
                    <span style={{ fontSize: 18 }}>{action.icon}</span>
                    {action.label}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <div style={{
                background: 'rgba(167,139,250,.08)',
                border: '1px solid rgba(167,139,250,.3)',
                borderRadius: 10,
                padding: 12,
                marginBottom: 14,
              }}>
                <div style={{ fontSize: 11, color: '#A78BFA', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 800, marginBottom: 4 }}>
                  Action picked
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: activeAction.color, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 18 }}>{activeAction.icon}</span> {activeAction.label}
                </div>
              </div>

              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.5 }}>
                <strong style={{ color: '#A78BFA' }}>Step 2:</strong> tap each student card you want to log this for. Tap again to unselect. The drawer can stay open or you can close it — the highlights stick.
              </div>

              <div style={{
                background: selectedCount > 0 ? 'rgba(34,197,94,.12)' : 'rgba(255,255,255,.04)',
                border: `1px solid ${selectedCount > 0 ? 'rgba(34,197,94,.35)' : 'rgba(255,255,255,.1)'}`,
                borderRadius: 10,
                padding: '10px 14px',
                marginBottom: 12,
                fontSize: 14,
                fontWeight: 700,
                color: selectedCount > 0 ? '#86EFAC' : 'var(--text-muted)',
                textAlign: 'center',
              }}>
                {selectedCount === 0
                  ? 'No students selected yet'
                  : `${selectedCount} student${selectedCount === 1 ? '' : 's'} selected`}
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={handleCommit}
                  disabled={selectedCount === 0}
                  style={{
                    flex: 1,
                    minHeight: 48,
                    background: selectedCount === 0 ? 'rgba(255,255,255,.05)' : '#A78BFA',
                    color: selectedCount === 0 ? 'var(--text-muted)' : '#1E1B4B',
                    border: '1.5px solid rgba(167,139,250,.5)',
                    borderRadius: 10,
                    fontSize: 14,
                    fontWeight: 800,
                    cursor: selectedCount === 0 ? 'not-allowed' : 'pointer',
                    opacity: selectedCount === 0 ? 0.55 : 1,
                  }}
                >✓ Log for {selectedCount}</button>
                <button
                  onClick={handleCancel}
                  style={{
                    minHeight: 48,
                    padding: '0 16px',
                    background: 'transparent',
                    color: '#FCA5A5',
                    border: '1px solid rgba(248,113,113,.4)',
                    borderRadius: 10,
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >✕ Cancel</button>
              </div>
            </>
          )}
        </div>
      )}

      {/* The FAB itself — always visible. */}
      <button
        onClick={() => setOpen(o => !o)}
        title={activeAction
          ? `Mass log "${activeAction.label}" — ${selectedCount} student${selectedCount === 1 ? '' : 's'} selected`
          : 'Open Mass Log'}
        aria-label="Mass log"
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          height: 60,
          padding: activeAction ? '0 22px' : '0 22px',
          minWidth: 60,
          borderRadius: 999,
          background: activeAction
            ? 'linear-gradient(135deg, #A78BFA 0%, #7C3AED 100%)'
            : 'linear-gradient(135deg, #6D28D9 0%, #4C1D95 100%)',
          border: '2px solid rgba(167,139,250,.6)',
          color: 'white',
          fontSize: 15,
          fontWeight: 800,
          cursor: 'pointer',
          boxShadow: '0 18px 40px rgba(124,58,237,.5), 0 0 0 4px rgba(167,139,250,.15)',
          zIndex: 62,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          transition: 'transform 160ms cubic-bezier(0.16,1,0.3,1), box-shadow 160ms',
        }}
        onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.96)'; }}
        onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
      >
        <span style={{ fontSize: 22 }}>📋</span>
        <span>Mass log</span>
        {activeAction && selectedCount > 0 && (
          <span style={{
            background: 'rgba(255,255,255,.22)',
            color: 'white',
            border: '1px solid rgba(255,255,255,.5)',
            borderRadius: 999,
            padding: '2px 10px',
            fontSize: 12,
            fontWeight: 800,
            marginLeft: 4,
          }}>{selectedCount}</span>
        )}
      </button>
    </>
  );
}
