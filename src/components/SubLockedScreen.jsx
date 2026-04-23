import React from 'react';
import { useTeam } from '../context/TeamProvider';

// Shown when the current user's role is 'sub' AND the active team's
// allow_subs toggle is OFF. Admin-controlled gate — server RLS still
// lets subs read their own logs; this is the client-side door.

export default function SubLockedScreen() {
  const { activeTeam, signOut } = useTeam();
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-deep)',
      color: 'var(--text-primary)',
      padding: 'var(--space-6)',
      position: 'relative',
    }}>
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: `
          radial-gradient(ellipse 60% 40% at 50% 0%, rgba(251,191,36,0.08), transparent 60%),
          radial-gradient(ellipse 50% 40% at 50% 100%, rgba(248,113,113,0.06), transparent 60%)
        `,
      }} />
      <div className="card-elevated" style={{
        maxWidth: 480, width: '100%',
        padding: 'var(--space-7) var(--space-6)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', textAlign: 'center',
        gap: 'var(--space-4)',
        position: 'relative',
      }}>
        <div style={{
          width: 64, height: 64,
          borderRadius: 'var(--radius-xl)',
          background: 'linear-gradient(135deg, var(--yellow), var(--orange))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 28,
          boxShadow: '0 8px 28px rgba(251,191,36,0.35)',
        }}>
          🔒
        </div>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.01em', marginBottom: 6 }}>
            Sub access is paused
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.55, maxWidth: 380 }}>
            The admin of <b style={{ color: 'var(--text-primary)' }}>{activeTeam?.name || 'this team'}</b>{' '}
            has turned off access for the Sub role. Your sign-in still works — the app will open the
            moment the admin flips it back on.
          </p>
        </div>
        <div style={{
          padding: 'var(--space-3) var(--space-4)',
          background: 'var(--bg-dark)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.55,
          width: '100%',
        }}>
          If you think this is a mistake — or you're a regular para, not a sub — ask your Sped
          Teacher to change your role in the Admin Dashboard → Members.
        </div>
        <button onClick={signOut} className="btn btn-secondary" style={{ width: '100%' }}>
          ← Sign out
        </button>
      </div>
    </div>
  );
}
