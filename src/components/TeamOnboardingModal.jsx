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
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em' }}>
              Welcome to SupaPara
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
              Create a team for your school, or join one with an invite code.
            </p>
          </div>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <TabBtn active={tab === 'create'} onClick={() => setTab('create')}>Create a team</TabBtn>
            <TabBtn active={tab === 'join'} onClick={() => setTab('join')}>Join a team</TabBtn>
          </div>

          {tab === 'create' && !created && (
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <Field label="Team name">
                <input
                  className="chat-input"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  required autoFocus
                  placeholder="e.g. Lincoln Middle School"
                />
              </Field>
              <Field label="Your display name">
                <input
                  className="chat-input"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                />
              </Field>
              <button type="submit" disabled={busy} className="btn btn-primary" style={{ width: '100%', marginTop: 'var(--space-2)' }}>
                {busy ? 'Creating…' : 'Create team'}
              </button>
            </form>
          )}

          {tab === 'create' && created && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <p>
                Team <b style={{ color: 'var(--accent-hover)' }}>{created.name}</b> created.
                Share this invite code:
              </p>
              <div style={{
                fontSize: 32,
                fontFamily: 'JetBrains Mono, monospace',
                letterSpacing: 6,
                padding: 'var(--space-4)',
                background: 'var(--bg-dark)',
                border: '1px solid var(--accent-border)',
                borderRadius: 'var(--radius-lg)',
                textAlign: 'center',
                color: 'var(--text-primary)',
                fontWeight: 700,
              }}>
                {created.inviteCode}
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(created.inviteCode)}
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                >
                  📋 Copy code
                </button>
                {!mustChoose && onClose && (
                  <button type="button" onClick={onClose} className="btn btn-primary" style={{ flex: 1 }}>
                    Done
                  </button>
                )}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
                Paras you invite can join by pasting this code at sign-in.
              </div>
            </div>
          )}

          {tab === 'join' && (
            <form onSubmit={handleJoin} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <Field label="Invite code">
                <input
                  className="chat-input"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  required autoFocus maxLength={6}
                  placeholder="ABC123"
                  style={{
                    letterSpacing: 6,
                    textTransform: 'uppercase',
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: 16,
                    textAlign: 'center',
                  }}
                />
              </Field>
              <Field label="Your display name">
                <input
                  className="chat-input"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                />
              </Field>
              <button type="submit" disabled={busy} className="btn btn-primary" style={{ width: '100%', marginTop: 'var(--space-2)' }}>
                {busy ? 'Joining…' : 'Join team'}
              </button>
            </form>
          )}

          {err && (
            <div style={{
              padding: 'var(--space-3)',
              color: 'var(--red)',
              fontSize: 13,
              background: 'var(--red-muted)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid rgba(248,113,113,0.3)',
            }}>
              {err}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: 'block' }}>
      <div style={{
        fontSize: 11, fontWeight: 600,
        textTransform: 'uppercase', letterSpacing: '0.08em',
        color: 'var(--text-muted)',
        marginBottom: 6,
      }}>
        {label}
      </div>
      {children}
    </label>
  );
}

function TabBtn({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={active ? 'btn btn-primary' : 'btn btn-secondary'}
      style={{ flex: 1, fontSize: 13 }}
    >
      {children}
    </button>
  );
}
