// Admin Dashboard — visible only to team owners and sped_teachers.
// Tabs: Members | Access | Settings
//
// Members: list of everyone in the team, their role, active/paused flag.
//          Admin can change role, pause/resume, remove.
// Access: quick toggles for sub access.
// Settings: invite code (regenerate), team name (future).
//
// Everything here goes through RPCs that re-verify admin on the server.

import React, { useEffect, useState, useCallback } from 'react';
import { useTeam } from '../context/TeamProvider';
import {
  listTeamMembers,
  setMemberRole,
  setMemberActive,
  removeMember,
  setTeamAllowSubs,
} from '../services/teamSync';

const ROLE_META = {
  owner:        { label: 'Owner',         tone: '#a78bfa', desc: 'Team creator. Full admin access.' },
  sped_teacher: { label: 'Sped Teacher',  tone: '#7a9cff', desc: 'Full admin access. Parent notes visible.' },
  para:         { label: 'Para',          tone: '#34d399', desc: 'Sees IEP summary + logs + handoffs.' },
  sub:          { label: 'Sub',           tone: '#fbbf24', desc: 'Substitute. Can be toggled off at team level.' },
  member:       { label: 'Member (legacy)', tone: '#64748b', desc: 'Pre-Phase-2 membership — promote to a real role.' },
};

export default function AdminDashboard() {
  const team = useTeam();
  const { activeTeam, activeTeamId, isAdmin, user, reloadTeams } = team;
  const [tab, setTab] = useState('members');
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [working, setWorking] = useState(null); // userId currently being acted on

  const refresh = useCallback(async () => {
    if (!activeTeamId) return;
    setLoading(true); setErr(null);
    try {
      const rows = await listTeamMembers(activeTeamId);
      setMembers(rows);
    } catch (e) {
      setErr(e.message || String(e));
    }
    setLoading(false);
  }, [activeTeamId]);

  useEffect(() => { refresh(); }, [refresh]);

  if (!isAdmin) {
    return (
      <div style={{ padding: 'var(--space-6)', color: 'var(--text-muted)' }}>
        You don't have admin access to this team. Ask a Sped Teacher to promote you.
      </div>
    );
  }

  async function handleAction(action, userId) {
    setWorking(userId); setErr(null);
    try {
      await action();
      await refresh();
      await reloadTeams();
    } catch (e) {
      setErr(e.message || String(e));
    }
    setWorking(null);
  }

  return (
    <div style={{ padding: 'var(--space-6)', maxWidth: 1100, margin: '0 auto' }}>
      <div className="header">
        <div>
          <h1 style={{ fontSize: 28 }}>🎓 Admin Dashboard</h1>
          <p className="teacher-subtitle" style={{ fontSize: 14, maxWidth: 720, lineHeight: 1.55 }}>
            Sped teacher controls for <b style={{ color: 'var(--text-primary)' }}>{activeTeam?.name || '—'}</b>.
            Manage who can use the app, change roles, toggle sub access.
            Regular paras don't see this view.
          </p>
        </div>
      </div>

      {/* Tab row */}
      <div style={{
        display: 'flex', gap: 6, marginBottom: 'var(--space-5)',
        padding: 4,
        background: 'var(--bg-dark)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        width: 'fit-content',
      }}>
        {[
          ['members', '👥 Members'],
          ['access',  '🔐 Access'],
          ['settings','⚙️  Settings'],
        ].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{
            padding: 'var(--space-2) var(--space-4)',
            borderRadius: 'var(--radius-sm)',
            border: 'none', cursor: 'pointer',
            fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
            minHeight: 36,
            background: tab === id ? 'var(--grad-primary)' : 'transparent',
            color: tab === id ? '#fff' : 'var(--text-secondary)',
            transition: 'all 120ms cubic-bezier(0.16,1,0.3,1)',
          }}>{label}</button>
        ))}
      </div>

      {err && (
        <div style={{
          marginBottom: 'var(--space-4)',
          padding: 'var(--space-3) var(--space-4)',
          background: 'var(--red-muted)',
          border: '1px solid rgba(248,113,113,0.3)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--red)', fontSize: 13,
        }}>{err}</div>
      )}

      {/* ── Members tab ───────────────────────────────────── */}
      {tab === 'members' && (
        <div>
          {loading && <div style={{ color: 'var(--text-muted)' }}>Loading…</div>}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {members.map(m => {
              const meta = ROLE_META[m.role] || ROLE_META.member;
              const isSelf = m.user_id === user?.id;
              const isBusy = working === m.user_id;
              return (
                <div key={m.user_id} className="panel" style={{
                  padding: 'var(--space-4) var(--space-5)',
                  display: 'flex', alignItems: 'center', gap: 'var(--space-4)',
                  flexWrap: 'wrap',
                  opacity: m.active ? 1 : 0.5,
                }}>
                  <div style={{
                    width: 48, height: 48,
                    borderRadius: '50%',
                    background: `linear-gradient(135deg, ${meta.tone}, ${meta.tone}99)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 800, fontSize: 18, color: '#fff',
                    flexShrink: 0,
                  }}>
                    {(m.display_name || '?').slice(0, 1).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 15, fontWeight: 700 }}>{m.display_name}</span>
                      {isSelf && <span className="pill pill-accent" style={{ fontSize: 10 }}>you</span>}
                      {!m.active && <span className="pill pill-red" style={{ fontSize: 10 }}>paused</span>}
                    </div>
                    <div style={{ fontSize: 12, color: meta.tone, fontWeight: 600, marginTop: 2 }}>
                      {meta.label}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                      Joined {new Date(m.joined_at).toLocaleDateString()}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
                    <select
                      value={m.role}
                      disabled={isBusy}
                      onChange={(e) => handleAction(
                        () => setMemberRole(activeTeamId, m.user_id, e.target.value),
                        m.user_id
                      )}
                      className="period-select"
                      style={{ fontSize: 12, minHeight: 36 }}
                    >
                      {Object.entries(ROLE_META)
                        .filter(([id]) => id !== 'member' || m.role === 'member')
                        .map(([id, v]) => (
                          <option key={id} value={id}>{v.label}</option>
                        ))}
                    </select>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleAction(
                        () => setMemberActive(activeTeamId, m.user_id, !m.active),
                        m.user_id
                      )}
                      className="btn btn-secondary btn-sm"
                      style={{ color: m.active ? 'var(--yellow)' : 'var(--green)' }}
                    >
                      {m.active ? '⏸ Pause' : '▶ Resume'}
                    </button>
                    {!isSelf && (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => {
                          if (!window.confirm(`Remove ${m.display_name} from the team? They'll lose access immediately.`)) return;
                          handleAction(() => removeMember(activeTeamId, m.user_id), m.user_id);
                        }}
                        className="btn btn-secondary btn-sm"
                        style={{ color: 'var(--red)', borderColor: 'rgba(248,113,113,0.3)' }}
                      >
                        ✕ Remove
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {!loading && members.length === 0 && (
              <div className="empty-doc">No team members yet — share your invite code.</div>
            )}
          </div>

          <div style={{
            marginTop: 'var(--space-6)', padding: 'var(--space-4)',
            background: 'var(--bg-dark)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)', fontSize: 12, color: 'var(--text-muted)',
            lineHeight: 1.5,
          }}>
            <b style={{ color: 'var(--text-secondary)' }}>Role reference</b>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-2)', marginTop: 6 }}>
              {Object.entries(ROLE_META).filter(([id]) => id !== 'member').map(([id, v]) => (
                <div key={id}>
                  <span style={{ color: v.tone, fontWeight: 700 }}>{v.label}</span>
                  <div>{v.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Access tab ────────────────────────────────────── */}
      {tab === 'access' && (
        <div className="panel" style={{ padding: 'var(--space-5)' }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 'var(--space-3)' }}>
            Substitute access
          </h3>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55, marginBottom: 'var(--space-4)' }}>
            When OFF, anyone with the role "sub" sees a locked screen instead of the app.
            Useful if you don't want temporary coverage staff to see student data.
          </p>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={activeTeam?.allowSubs !== false}
              onChange={async (e) => {
                try {
                  await setTeamAllowSubs(activeTeamId, e.target.checked);
                  await reloadTeams();
                } catch (err) { setErr(err.message); }
              }}
            />
            <span style={{ fontSize: 14, fontWeight: 600 }}>
              Allow subs to use the app
            </span>
          </label>
        </div>
      )}

      {/* ── Settings tab ──────────────────────────────────── */}
      {tab === 'settings' && (
        <div className="panel" style={{ padding: 'var(--space-5)' }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 'var(--space-3)' }}>
            Team info
          </h3>
          <div style={{ display: 'grid', gap: 'var(--space-3)', fontSize: 13 }}>
            <div>
              <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 4 }}>
                Team name
              </div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{activeTeam?.name}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 4 }}>
                Invite code
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
                <code style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 20, letterSpacing: 4, fontWeight: 700,
                  padding: '8px 14px',
                  background: 'var(--accent-glow)',
                  border: '1px solid var(--accent-border)',
                  color: 'var(--accent-hover)',
                  borderRadius: 'var(--radius-md)',
                }}>{activeTeam?.inviteCode}</code>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={async () => {
                    try {
                      const code = await team.regenerateInviteCode();
                      if (code) alert(`New invite code: ${code}`);
                    } catch (e) { setErr(e.message); }
                  }}
                >
                  🔄 Regenerate
                </button>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                Regenerating invalidates the old code. Anyone who hasn't joined yet will need the new one.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
