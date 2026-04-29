import React, { useState } from 'react';
import { useTeam } from '../context/TeamProvider';
import { useEscape } from '../hooks/useEscape';
import { findSimilarTeam } from '../services/teamSync';

export default function TeamOnboardingModal({ onClose, mustChoose = false }) {
  const { user, teams, activeTeamId, setActiveTeamId, createTeam, joinTeamByCode, signOut } = useTeam();
  const hasExistingTeams = (teams || []).length > 0;
  // Default to "switch" if the user is already in teams; otherwise start on "create".
  const [tab, setTab] = useState(hasExistingTeams ? 'switch' : 'create');
  const [teamName, setTeamName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [switchTeamId, setSwitchTeamId] = useState(activeTeamId || (teams && teams[0]?.id) || '');
  const [joinRole, setJoinRole] = useState('para'); // 'para' | 'sub'
  const defaultDisplay = user?.user_metadata?.given_name
    || user?.user_metadata?.name
    || (user?.email ? user.email.split('@')[0] : 'Para');
  const [displayName, setDisplayName] = useState(defaultDisplay);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [created, setCreated] = useState(null);
  // When create-team detects an existing team with the same normalized name,
  // we hold the form submission and pop a confirmation step. Cleared on
  // cancel/dismiss so the user can edit the name and try again.
  const [duplicateMatches, setDuplicateMatches] = useState(null);
  useEscape(() => { if (!mustChoose && onClose) onClose(); });

  async function handleCreate(e) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      // Pre-flight: warn if a team with the same normalized name already exists.
      // Skipped only if user already saw + dismissed the warning (duplicateMatches set).
      if (duplicateMatches === null) {
        const hits = await findSimilarTeam(teamName.trim());
        if (hits && hits.length > 0) {
          setDuplicateMatches(hits);
          setBusy(false);
          return;
        }
      }
      const t = await createTeam(teamName.trim(), displayName.trim());
      setDuplicateMatches(null);
      setCreated(t);
    } catch (e2) { setErr(e2.message || String(e2)); }
    finally { setBusy(false); }
  }

  async function handleJoin(e) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      await joinTeamByCode(inviteCode.trim().toUpperCase(), displayName.trim(), joinRole);
      if (!mustChoose && onClose) onClose();
    } catch (e2) { setErr(e2.message || String(e2)); }
    finally { setBusy(false); }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: 480, position: 'relative' }}>
        {/* Escape hatch — always visible. If mustChoose (no team yet), the
            only way out is to sign out (because the cloud gate requires a
            team selection). Otherwise, a normal close. */}
        <button
          type="button"
          onClick={() => { if (mustChoose) signOut(); else if (onClose) onClose(); }}
          title={mustChoose ? 'Sign out' : 'Close'}
          className="close-btn"
          style={{ position: 'absolute', top: 12, right: 12, zIndex: 3 }}
          aria-label={mustChoose ? 'Sign out' : 'Close'}
        >×</button>
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
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            {hasExistingTeams && (
              <TabBtn active={tab === 'switch'} onClick={() => setTab('switch')}>
                Switch team
              </TabBtn>
            )}
            <TabBtn active={tab === 'create'} onClick={() => setTab('create')}>Create a team</TabBtn>
            <TabBtn active={tab === 'join'} onClick={() => setTab('join')}>Join a team</TabBtn>
          </div>

          {tab === 'switch' && hasExistingTeams && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!switchTeamId) return;
                setActiveTeamId(switchTeamId);
                if (onClose) onClose();
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}
            >
              <Field label={`You're in ${teams.length} team${teams.length !== 1 ? 's' : ''}`}>
                <select
                  value={switchTeamId}
                  onChange={(e) => setSwitchTeamId(e.target.value)}
                  className="period-select"
                  autoFocus
                  style={{ width: '100%', fontSize: 14, padding: 'var(--space-3)' }}
                >
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} · {t.inviteCode} · {t.role}
                    </option>
                  ))}
                </select>
              </Field>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', marginTop: 'var(--space-2)' }}
                disabled={!switchTeamId || switchTeamId === activeTeamId}
              >
                {switchTeamId === activeTeamId ? 'Already active' : 'Switch to this team'}
              </button>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
                Switching updates what's shown — your data for each team stays separate.
              </div>
            </form>
          )}

          {tab === 'create' && !created && !duplicateMatches && (
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <Field label="Team name">
                <input
                  className="chat-input"
                  value={teamName}
                  onChange={(e) => { setTeamName(e.target.value); setDuplicateMatches(null); }}
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
                {busy ? 'Checking…' : 'Create team'}
              </button>
            </form>
          )}

          {tab === 'create' && !created && duplicateMatches && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <div style={{
                padding: 'var(--space-4)',
                background: '#1a1505',
                border: '1px solid #854d0e',
                borderRadius: 'var(--radius-md)',
                color: '#fbbf24',
                fontSize: 13, lineHeight: 1.55,
              }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>
                  ⚠ A team with this name already exists
                </div>
                {duplicateMatches.map(m => (
                  <div key={m.id} style={{ marginTop: 6, fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--text-secondary)' }}>
                    • {m.name}
                  </div>
                ))}
                <div style={{ marginTop: 10, color: 'var(--text-secondary)', fontSize: 12 }}>
                  Are you trying to <strong>join</strong> this team, or is yours a different one?
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setTab('join'); setDuplicateMatches(null); }}
                className="btn btn-primary"
                style={{ width: '100%' }}
              >
                I'm joining this team — take me to the invite-code form
              </button>
              <button
                type="button"
                onClick={async () => {
                  // User confirmed the new team genuinely is different.
                  // Re-call handleCreate; duplicateMatches is set so it'll skip the pre-flight.
                  setBusy(true); setErr(null);
                  try {
                    const t = await createTeam(teamName.trim(), displayName.trim());
                    setDuplicateMatches(null);
                    setCreated(t);
                  } catch (e2) { setErr(e2.message || String(e2)); }
                  finally { setBusy(false); }
                }}
                disabled={busy}
                className="btn btn-secondary"
                style={{ width: '100%' }}
              >
                {busy ? 'Creating…' : 'No, mine is different — create anyway'}
              </button>
              <button
                type="button"
                onClick={() => setDuplicateMatches(null)}
                className="btn btn-ghost"
                style={{ width: '100%', fontSize: 12, color: 'var(--text-muted)' }}
              >
                ← Back, change the team name
              </button>
            </div>
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
              <Field label="I'm joining as">
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  {[
                    { id: 'para', label: '👩‍🏫 Para', desc: 'Regular access' },
                    { id: 'sub',  label: '🕒 Sub',  desc: 'Substitute / temp' },
                  ].map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setJoinRole(r.id)}
                      className={joinRole === r.id ? 'btn btn-primary' : 'btn btn-secondary'}
                      style={{
                        flex: 1, flexDirection: 'column', height: 'auto',
                        padding: 'var(--space-3)',
                        alignItems: 'center', justifyContent: 'center',
                        gap: 2,
                      }}
                    >
                      <span style={{ fontSize: 14, fontWeight: 700 }}>{r.label}</span>
                      <span style={{ fontSize: 11, opacity: 0.8 }}>{r.desc}</span>
                    </button>
                  ))}
                </div>
              </Field>
              <div style={{
                padding: 'var(--space-3)',
                background: 'var(--bg-dark)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.55,
              }}>
                <b style={{ color: 'var(--text-secondary)' }}>About access:</b>{' '}
                Paras and Subs see student data, logs, and handoffs. Admin access
                (Sped Teacher / Owner) can't be self-selected — a team admin has to
                promote you after you join.
              </div>
              <button type="submit" disabled={busy} className="btn btn-primary" style={{ width: '100%', marginTop: 'var(--space-2)' }}>
                {busy ? 'Joining…' : `Join as ${joinRole === 'sub' ? 'Sub' : 'Para'}`}
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

          {/* Footer escape hatch — always visible text link to sign out,
              so it's impossible to get stuck on this modal. */}
          {mustChoose && (
            <div style={{
              paddingTop: 'var(--space-3)',
              borderTop: '1px solid var(--border)',
              marginTop: 'var(--space-2)',
              textAlign: 'center',
            }}>
              <button
                type="button"
                onClick={signOut}
                className="btn btn-ghost"
                style={{ fontSize: 12, color: 'var(--text-muted)' }}
              >
                ← Sign out and use a different account
              </button>
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
