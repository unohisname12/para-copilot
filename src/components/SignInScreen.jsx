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
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-deep, #04080f)', color: 'white',
      flexDirection: 'column', gap: 24, padding: 24,
    }}>
      <div style={{ textAlign: 'center' }}>
        <img src="/assets/logo.png" alt="SupaPara" style={{ height: 56 }}
             onError={(e) => { e.currentTarget.style.display = 'none'; }} />
        <h1 style={{ marginTop: 16, fontWeight: 600 }}>SupaPara</h1>
        <p style={{ opacity: 0.7 }}>Powering ParaProfessionals</p>
      </div>
      {supabaseConfigured ? (
        <button
          type="button"
          onClick={handleClick}
          disabled={busy}
          style={{
            background: '#fff', color: '#222', padding: '12px 24px', borderRadius: 8,
            border: 'none', fontWeight: 600, fontSize: 16, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 12, minWidth: 260, justifyContent: 'center',
          }}
        >
          <span style={{ fontSize: 20 }}>G</span>
          {busy ? 'Opening Google...' : 'Sign in with Google'}
        </button>
      ) : (
        <div style={{ padding: 16, border: '1px solid var(--border, #1c2d4a)', borderRadius: 8, maxWidth: 500 }}>
          Cloud features not configured. Add <code>REACT_APP_SUPABASE_URL</code> and{' '}
          <code>REACT_APP_SUPABASE_ANON_KEY</code> to <code>.env.local</code> and restart the dev server.
        </div>
      )}
      {err && <div style={{ color: '#f87171', maxWidth: 400, textAlign: 'center' }}>{err}</div>}
      <div style={{ opacity: 0.5, fontSize: 12, maxWidth: 420, textAlign: 'center' }}>
        Real student names never leave your device. Only pseudonymous data syncs to the cloud.
      </div>
    </div>
  );
}
