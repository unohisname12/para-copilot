import React, { useState } from 'react';
import { useTeam } from '../context/TeamProvider';

export default function TeamOnboardingModal({ onClose, mustChoose = false }) {
  const { user, createTeam, joinTeamByCode } = useTeam();
  const [tab, setTab] = useState('create');
  const [teamName, setTeamName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const defaultDisplay = user?.user_metadata?.given_name
    || user?.user_metadata?.name
    || (user?.email ? user.email.split('@')[0] : 'Para');
  const [displayName, setDisplayName] = useState(defaultDisplay);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [created, setCreated] = useState(null);

  async function handleCreate(e) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const t = await createTeam(teamName.trim(), displayName.trim());
      setCreated(t);
    } catch (e2) { setErr(e2.message || String(e2)); }
    finally { setBusy(false); }
  }

  async function handleJoin(e) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      await joinTeamByCode(inviteCode.trim().toUpperCase(), displayName.trim());
      if (!mustChoose && onClose) onClose();
    } catch (e2) { setErr(e2.message || String(e2)); }
    finally { setBusy(false); }
  }

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <h2 style={{ marginTop: 0 }}>Welcome to SupaPara</h2>
        <p style={{ opacity: 0.75 }}>Create a team for your school, or join one with an invite code.</p>
        <div style={{ display: 'flex', gap: 8, margin: '16px 0' }}>
          <TabBtn active={tab === 'create'} onClick={() => setTab('create')}>Create a team</TabBtn>
          <TabBtn active={tab === 'join'} onClick={() => setTab('join')}>Join a team</TabBtn>
        </div>

        {tab === 'create' && !created && (
          <form onSubmit={handleCreate}>
            <Field label="Team name">
              <input value={teamName} onChange={(e) => setTeamName(e.target.value)} required autoFocus
                     style={inputStyle} placeholder="e.g. Lincoln Middle School" />
            </Field>
            <Field label="Your display name">
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required style={inputStyle} />
            </Field>
            <button type="submit" disabled={busy} style={primaryBtnStyle}>
              {busy ? 'Creating…' : 'Create team'}
            </button>
          </form>
        )}

        {tab === 'create' && created && (
          <div>
            <p>Team <b>{created.name}</b> created.</p>
            <p>Invite code:</p>
            <div style={{
              fontSize: 28, fontFamily: 'JetBrains Mono, monospace', letterSpacing: 4, padding: 12,
              background: 'rgba(255,255,255,0.05)', borderRadius: 8, textAlign: 'center',
            }}>
              {created.inviteCode}
            </div>
            <button type="button" onClick={() => navigator.clipboard.writeText(created.inviteCode)}
                    style={secondaryBtnStyle}>
              Copy code
            </button>
            {!mustChoose && onClose && (
              <button type="button" onClick={onClose} style={primaryBtnStyle}>Done</button>
            )}
          </div>
        )}

        {tab === 'join' && (
          <form onSubmit={handleJoin}>
            <Field label="Invite code">
              <input value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} required autoFocus
                     maxLength={6}
                     style={{ ...inputStyle, letterSpacing: 4, textTransform: 'uppercase' }}
                     placeholder="ABC123" />
            </Field>
            <Field label="Your display name">
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required style={inputStyle} />
            </Field>
            <button type="submit" disabled={busy} style={primaryBtnStyle}>
              {busy ? 'Joining…' : 'Join team'}
            </button>
          </form>
        )}

        {err && <div style={{ color: '#f87171', marginTop: 12 }}>{err}</div>}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: 'block', marginBottom: 12 }}>
      <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 4 }}>{label}</div>
      {children}
    </label>
  );
}

function TabBtn({ active, onClick, children }) {
  return (
    <button type="button" onClick={onClick} style={{
      padding: '8px 14px', borderRadius: 6, border: '1px solid var(--border, #1c2d4a)',
      background: active ? 'var(--accent, #4d9fff)' : 'transparent',
      color: active ? '#000' : '#fff', cursor: 'pointer', fontWeight: 500,
    }}>
      {children}
    </button>
  );
}

const overlayStyle = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
};
const modalStyle = {
  background: 'var(--bg-surface, #0f1a2e)', color: 'white', padding: 24,
  borderRadius: 12, minWidth: 360, maxWidth: 480,
  border: '1px solid var(--border, #1c2d4a)',
};
const inputStyle = {
  width: '100%', padding: 10, borderRadius: 6, border: '1px solid var(--border, #1c2d4a)',
  background: 'rgba(255,255,255,0.05)', color: 'white', fontSize: 15,
};
const primaryBtnStyle = {
  width: '100%', padding: 12, borderRadius: 6, border: 'none',
  background: 'var(--accent, #4d9fff)', color: '#000', fontWeight: 600,
  cursor: 'pointer', marginTop: 8,
};
const secondaryBtnStyle = {
  width: '100%', padding: 10, borderRadius: 6, border: '1px solid var(--border, #1c2d4a)',
  background: 'transparent', color: 'white', cursor: 'pointer', marginTop: 8, marginBottom: 8,
};
