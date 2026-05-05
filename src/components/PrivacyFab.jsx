import React from 'react';
import { usePrivacyMode } from '../hooks/usePrivacyMode';

// Floating privacy toggle. Mounted once at the App root so it follows
// the para across every screen — Dashboard, Vault, Simple Mode, modals,
// settings — without per-screen wiring. Bottom-right, fixed position,
// thumb-sized hit target. Icon-only so it doesn't take real estate.
//
// State source: usePrivacyMode (paraPrivacyModeV1 in localStorage).
// CSS in styles.css already keys off [data-privacy="on"] on the app
// shell, so flipping this hook flips every .privacy-blur surface.
export default function PrivacyFab() {
  const { on, toggle } = usePrivacyMode();

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={on}
      title={on
        ? 'Privacy mode ON — student data blurred. Click to turn OFF.'
        : 'Privacy mode OFF — click to blur student data so kids can\'t read over your shoulder.'}
      style={{
        position: 'fixed',
        right: 18,
        bottom: 18,
        width: 48,
        height: 48,
        borderRadius: '50%',
        cursor: 'pointer',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 20,
        fontFamily: 'inherit',
        transition: 'all 180ms cubic-bezier(0.16,1,0.3,1)',
        background: on ? 'rgba(167,139,250,0.18)' : 'rgba(15,23,42,0.78)',
        border: on
          ? '1px solid rgba(167,139,250,0.85)'
          : '1px solid rgba(148,163,184,0.35)',
        color: on ? '#c4b5fd' : '#94a3b8',
        boxShadow: on
          ? '0 0 0 4px rgba(167,139,250,0.18), 0 8px 24px rgba(0,0,0,0.45)'
          : '0 6px 18px rgba(0,0,0,0.35)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      <span aria-hidden="true">{on ? '🛡' : '👁'}</span>
      <span style={{
        position: 'absolute',
        inset: 0,
        clip: 'rect(0 0 0 0)',
        clipPath: 'inset(50%)',
        height: 1, width: 1, overflow: 'hidden',
        whiteSpace: 'nowrap',
      }}>
        {on ? 'Privacy mode is on' : 'Privacy mode is off'}
      </span>
    </button>
  );
}
