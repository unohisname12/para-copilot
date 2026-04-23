import React from 'react';
import { useVault } from '../context/VaultProvider';
import { useEscape } from '../hooks/useEscape';

// Sidebar real-name controls. Renders nothing when the vault is empty
// (nothing to show / persist).
export default function RealNamesControls() {
  const {
    hasVault, showRealNames, persisted, expiredBanner, inactivityDays,
    confirmPersistOpen,
    toggleShowRealNames,
    requestEnablePersistence, confirmEnablePersistence, cancelEnablePersistence,
    purgeVault, dismissExpiredBanner,
  } = useVault();
  useEscape(confirmPersistOpen ? cancelEnablePersistence : () => {});

  return (
    <>
      {expiredBanner && (
        <div style={{
          padding: 'var(--space-3)', marginTop: 'var(--space-2)',
          background: 'var(--yellow-muted)',
          border: '1px solid rgba(251,191,36,0.35)',
          borderRadius: 'var(--radius-md)',
          fontSize: 11, color: 'var(--yellow)',
          display: 'flex', flexDirection: 'column', gap: 6,
        }}>
          <div style={{ fontWeight: 700 }}>Stored names expired</div>
          <div style={{ lineHeight: 1.5, opacity: 0.9 }}>
            Device sat unused for {inactivityDays}+ days. Names have been wiped.
            Re-load your private roster JSON to restore.
          </div>
          <button
            type="button"
            onClick={dismissExpiredBanner}
            className="btn btn-ghost btn-sm"
            style={{ fontSize: 10, color: 'var(--yellow)', alignSelf: 'flex-start' }}
          >
            Dismiss
          </button>
        </div>
      )}

      {hasVault && (
        <div style={{
          marginTop: 'var(--space-2)',
          padding: 'var(--space-3)',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          display: 'flex', flexDirection: 'column', gap: 6,
        }}>
          <div style={{
            fontSize: 10, fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.1em',
            color: 'var(--text-muted)',
          }}>
            Real Names
          </div>

          {/* Toggle */}
          <label style={{
            display: 'flex', alignItems: 'center', gap: 8,
            cursor: 'pointer', minHeight: 32,
          }}>
            <span style={{
              position: 'relative', display: 'inline-block',
              width: 36, height: 20,
              borderRadius: 10,
              background: showRealNames ? 'var(--grad-primary)' : 'var(--bg-dark)',
              border: `1px solid ${showRealNames ? 'var(--accent-border)' : 'var(--border)'}`,
              transition: 'all 160ms cubic-bezier(0.16,1,0.3,1)',
              flexShrink: 0,
            }}>
              <span style={{
                position: 'absolute',
                left: showRealNames ? 18 : 2, top: 1,
                width: 16, height: 16,
                borderRadius: 8,
                background: '#fff',
                boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
                transition: 'left 160ms cubic-bezier(0.16,1,0.3,1)',
              }} />
            </span>
            <input
              type="checkbox"
              checked={showRealNames}
              onChange={toggleShowRealNames}
              style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
            />
            <span style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500 }}>
              Show real names
            </span>
          </label>

          {/* Persistence line */}
          {persisted ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
              <span className="pill pill-green" style={{ fontSize: 9 }}>Remembered</span>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(
                    'Purge all real names from this device?\n\n' +
                    'You\'ll need to reload the private roster JSON next session.'
                  )) purgeVault();
                }}
                className="btn btn-ghost btn-sm"
                style={{ fontSize: 10, color: 'var(--red)', padding: '2px 8px' }}
              >
                Purge
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={requestEnablePersistence}
              className="btn btn-ghost btn-sm"
              style={{
                fontSize: 11,
                color: 'var(--text-secondary)',
                justifyContent: 'flex-start',
                width: '100%',
              }}
              title="Keep real names on this device across refreshes (opt-in)"
            >
              💾 Remember on this device
            </button>
          )}

          <div style={{
            fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.5, marginTop: 2,
          }}>
            {persisted
              ? `Auto-purges after ${inactivityDays} days of inactivity.`
              : 'Names stay only for this session.'}
          </div>
        </div>
      )}

      {confirmPersistOpen && (
        <div className="modal-overlay" onClick={cancelEnablePersistence}>
          <div
            className="modal-content"
            style={{ maxWidth: 480 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              height: 3,
              background: 'linear-gradient(90deg, var(--yellow), var(--red))',
            }} />
            <div className="modal-body" style={{ padding: 'var(--space-6)' }}>
              <div style={{
                width: 56, height: 56,
                borderRadius: 'var(--radius-lg)',
                background: 'var(--yellow-muted)',
                border: '1px solid rgba(251,191,36,0.35)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 28, marginBottom: 'var(--space-4)',
              }}>⚠️</div>
              <h3 style={{
                fontSize: 20, fontWeight: 800, letterSpacing: '-0.01em',
                marginBottom: 'var(--space-3)',
              }}>
                Store real names on this device?
              </h3>

              <div style={{
                padding: 'var(--space-3) var(--space-4)',
                background: 'var(--bg-dark)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                marginBottom: 'var(--space-4)',
                fontSize: 13, lineHeight: 1.55, color: 'var(--text-primary)',
              }}>
                Real student names will be saved to this browser's IndexedDB.
                They <b style={{ color: 'var(--text-primary)' }}>never leave the device</b> and are
                never uploaded.
              </div>

              <div style={{
                fontSize: 12.5, color: 'var(--text-secondary)',
                lineHeight: 1.6, marginBottom: 'var(--space-4)',
              }}>
                <div style={{ fontWeight: 700, color: 'var(--yellow)', marginBottom: 6 }}>
                  Only do this if:
                </div>
                <ul style={{ paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <li>This is your personal / assigned device</li>
                  <li>The device has a lock screen and disk encryption (default on Chromebooks)</li>
                  <li>Your district's policy allows local storage of student PII</li>
                </ul>
              </div>

              <div style={{
                fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5,
                marginBottom: 'var(--space-5)',
              }}>
                Auto-purges after {INACTIVITY_DAYS_LABEL} of inactivity. You can purge anytime from the sidebar.
              </div>

              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <button
                  type="button"
                  onClick={cancelEnablePersistence}
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmEnablePersistence}
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                >
                  I understand, enable
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const INACTIVITY_DAYS_LABEL = '14 days';
