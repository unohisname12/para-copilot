import React, { useState } from 'react';
import { useTeam } from '../context/TeamProvider';
import { supabaseConfigured } from '../services/supabaseClient';

export default function SignInScreen() {
  const { signInWithGoogle } = useTeam();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  async function handleClick() {
    setBusy(true); setErr(null);
    try { await signInWithGoogle(); }
    catch (e) { setErr(e.message || String(e)); }
    finally { setBusy(false); }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-deep)',
      color: 'var(--text-primary)',
      padding: 'var(--space-6)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Ambient gradient glow */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: `
          radial-gradient(ellipse 60% 40% at 50% 0%, rgba(122,156,255,0.12), transparent 60%),
          radial-gradient(ellipse 50% 40% at 50% 100%, rgba(167,139,250,0.08), transparent 60%)
        `,
      }} />

      <div className="card-elevated" style={{
        maxWidth: 440,
        width: '100%',
        padding: 'var(--space-8) var(--space-7)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-5)',
        alignItems: 'center',
        textAlign: 'center',
        position: 'relative',
      }}>
        <div style={{
          width: 64, height: 64,
          borderRadius: 'var(--radius-xl)',
          background: 'var(--grad-primary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 28px rgba(122,156,255,0.4)',
          fontSize: 28, fontWeight: 800,
          color: '#fff',
        }}>
          SP
        </div>
        <div>
          <h1 style={{
            fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em',
            background: 'var(--grad-primary)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            marginBottom: 4,
          }}>
            SupaPara
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.5 }}>
            Built for paraprofessionals. Classroom notes, team handoffs,
            and a memory of what's worked — with student privacy protected.
          </p>
        </div>

        {supabaseConfigured ? (
          <button
            type="button"
            onClick={handleClick}
            disabled={busy}
            className="btn btn-primary"
            style={{
              width: '100%',
              fontSize: 15,
              padding: 'var(--space-3) var(--space-5)',
              minHeight: 52,
              gap: 'var(--space-3)',
            }}
          >
            <GoogleIcon />
            {busy ? 'Opening Google…' : 'Sign in with Google'}
          </button>
        ) : (
          <div className="panel" style={{ padding: 'var(--space-4)', fontSize: 13, color: 'var(--text-secondary)' }}>
            Cloud features not configured. Add <code style={codeStyle}>REACT_APP_SUPABASE_URL</code> and{' '}
            <code style={codeStyle}>REACT_APP_SUPABASE_ANON_KEY</code> to <code style={codeStyle}>.env.local</code> and restart.
          </div>
        )}

        {err && (
          <div className="panel" style={{
            padding: 'var(--space-3) var(--space-4)',
            color: 'var(--red)',
            fontSize: 13,
            borderColor: 'rgba(248,113,113,0.4)',
            width: '100%',
          }}>
            {err}
          </div>
        )}

        <div style={{
          fontSize: 11, color: 'var(--text-muted)',
          borderTop: '1px solid var(--border)',
          paddingTop: 'var(--space-4)', width: '100%',
          lineHeight: 1.5,
        }}>
          Real student names never leave this computer. Only each kid's
          6-digit number and notes sync with the team.
        </div>
      </div>
    </div>
  );
}

const codeStyle = {
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: 11,
  background: 'var(--bg-dark)',
  padding: '1px 6px',
  borderRadius: 'var(--radius-xs)',
  border: '1px solid var(--border)',
};

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A10.99 10.99 0 0012 23z"/>
      <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18a11 11 0 000 9.87l3.66-2.84z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
    </svg>
  );
}
