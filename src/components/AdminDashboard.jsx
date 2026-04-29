// Admin Dashboard — visible only to team owners and sped_teachers.
// Tabs: Members | Access | Settings
//
// Members: list of everyone in the team, their role, active/paused flag.
//          Admin can change role, pause/resume, remove.
// Access: quick toggles for sub access.
// Settings: invite code (regenerate), team name (future).
//
// Everything here goes through RPCs that re-verify admin on the server.

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useTeam } from '../context/TeamProvider';
import {
  listTeamMembers,
  setMemberRole,
  setMemberActive,
  removeMember,
  setTeamAllowSubs,
  deleteAllTeamStudents,
} from '../services/teamSync';
import ParaAssignmentPanel from './ParaAssignmentPanel';
import { runTrainingGapRules } from '../engine';
import { tailorAdvice } from '../engine/trainingGapTailoring';

const ROLE_META = {
  owner:        { label: 'Owner',         tone: '#a78bfa', desc: 'Full control. Can add, remove, and change anyone. Multiple owners allowed — good for co-leads.' },
  sped_teacher: { label: 'Sped Teacher',  tone: '#7a9cff', desc: 'Full control, same as Owner. Can see parent notes.' },
  para:         { label: 'Para',          tone: '#34d399', desc: 'Sees IEP summary, logs, and handoffs. Cannot see parent notes or change team settings.' },
  sub:          { label: 'Sub',           tone: '#fbbf24', desc: 'Substitute. Same view as Para, but the team admin can turn off all subs\' access with one switch.' },
  member:       { label: 'Member (old)',  tone: '#64748b', desc: 'Older membership — please change to a newer role.' },
};

// Confirmation required when promoting TO Owner or demoting FROM Owner.
// These are high-impact changes (grants/removes full admin access + ability
// to change anyone else's role) and deserve a deliberate click.
function roleChangeConfirm(fromRole, toRole, displayName) {
  if (toRole === 'owner' && fromRole !== 'owner') {
    return `Grant full OWNER access to ${displayName}?\n\n` +
           `Owners can:\n` +
           `  • Change any member's role\n` +
           `  • Pause or remove any member (including other owners)\n` +
           `  • Read and write parent notes\n` +
           `  • Regenerate the invite code\n\n` +
           `Multiple owners are allowed. You'll both have the same power.\n\n` +
           `Continue?`;
  }
  if (fromRole === 'owner' && toRole !== 'owner') {
    return `Remove OWNER access from ${displayName}?\n\n` +
           `They'll become a ${toRole}. They'll no longer be able to manage members or parent notes.\n\n` +
           `Continue?`;
  }
  return null; // no confirm needed for para/sub/sped_teacher swaps
}

export default function AdminDashboard({ allStudents = {}, vaultNames = {} } = {}) {
  const team = useTeam();
  const { activeTeam, activeTeamId, isAdmin, user, reloadTeams } = team;
  const [tab, setTab] = useState('start');
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [working, setWorking] = useState(null); // userId currently being acted on
  const [shareTip, setShareTip] = useState(null); // { topic, paraName, studentLabel }

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
          ['start',       '🤝 Get paras started'],
          ['coaching',    '🔖 Coaching'],
          ['members',     '👥 Members'],
          ['assignments', '🎯 Assign Students'],
          ['access',      '🔐 Access'],
          ['settings',    '⚙️  Settings'],
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
                      onChange={(e) => {
                        const newRole = e.target.value;
                        if (newRole === m.role) return;
                        const confirmMsg = roleChangeConfirm(m.role, newRole, m.display_name);
                        if (confirmMsg && !window.confirm(confirmMsg)) {
                          // revert the select
                          e.target.value = m.role;
                          return;
                        }
                        handleAction(
                          () => setMemberRole(activeTeamId, m.user_id, newRole),
                          m.user_id
                        );
                      }}
                      className="period-select"
                      style={{ fontSize: 12, minHeight: 36 }}
                    >
                      {Object.entries(ROLE_META)
                        .filter(([id]) => id !== 'member' || m.role === 'member')
                        .map(([id, v]) => (
                          <option key={id} value={id}>{v.label}</option>
                        ))}
                    </select>
                    {/* One-click "Transfer ownership" for a clean handoff:
                        promote them to owner, then demote self. */}
                    {isSelf && m.role === 'owner' && (
                      <button
                        type="button"
                        title="Transfer ownership"
                        className="btn btn-ghost btn-sm"
                        style={{ fontSize: 11, color: 'var(--text-muted)' }}
                        disabled
                      >
                        (you)
                      </button>
                    )}
                    {!isSelf && m.role !== 'owner' && (
                      <button
                        type="button"
                        title="Transfer ownership — promotes them to Owner, demotes you to Sped Teacher"
                        disabled={isBusy}
                        onClick={async () => {
                          if (!window.confirm(
                            `Transfer ownership to ${m.display_name}?\n\n` +
                            `• They become Owner (full admin).\n` +
                            `• You become Sped Teacher (still full admin, just not the primary owner).\n` +
                            `• Both of you will retain admin access.\n\n` +
                            `This is safer than adding a second owner and then stepping down — no moment where only one admin exists.\n\n` +
                            `Continue?`
                          )) return;
                          setWorking(m.user_id); setErr(null);
                          try {
                            // Promote target to owner first (so we don't trip the "last-admin" guard when demoting ourselves)
                            await setMemberRole(activeTeamId, m.user_id, 'owner');
                            await setMemberRole(activeTeamId, user.id, 'sped_teacher');
                            await refresh();
                            await reloadTeams();
                          } catch (e) { setErr(e.message || String(e)); }
                          setWorking(null);
                        }}
                        className="btn btn-secondary btn-sm"
                        style={{ color: 'var(--violet)', borderColor: 'rgba(167,139,250,0.35)' }}
                      >
                        🪄 Transfer ownership
                      </button>
                    )}
                    {!isSelf && (
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
                    )}
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

      {/* ── Get Paras Started tab ────────────────────────── */}
      {tab === 'start' && (
        <ParaSetupGuide onGoToAssignments={() => setTab('assignments')} />
      )}

      {/* ── Coaching tab ─────────────────────────────────── */}
      {tab === 'coaching' && (
        <CoachingTopicsSection
          team={team}
          members={members}
          onShareTip={setShareTip}
        />
      )}

      {/* ── Assignments tab ──────────────────────────────── */}
      {tab === 'assignments' && (
        <ParaAssignmentPanel
          teamId={activeTeamId}
          teamLabel={activeTeam?.name || ''}
          members={members}
          allStudents={allStudents}
          vaultNames={vaultNames}
        />
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
            <div>
              <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 4 }}>
                Owner code <span style={{ marginLeft: 6, color: '#a78bfa' }}>(joins as Sped Teacher)</span>
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
                <code style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 18, letterSpacing: 1, fontWeight: 700,
                  padding: '8px 14px',
                  background: '#12102a',
                  border: '1px solid #6d28d9',
                  color: '#c4b5fd',
                  borderRadius: 'var(--radius-md)',
                }}>{activeTeam?.ownerCode || '— not set —'}</code>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    if (activeTeam?.ownerCode) {
                      navigator.clipboard.writeText(activeTeam.ownerCode);
                    }
                  }}
                  disabled={!activeTeam?.ownerCode}
                >
                  📋 Copy
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={async () => {
                    if (!window.confirm('Regenerate the owner code? The old one will stop working immediately.')) return;
                    try {
                      const code = await team.regenerateOwnerCode();
                      if (code) alert(`New owner code: ${code}`);
                    } catch (e) { setErr(e.message); }
                  }}
                >
                  🔄 Regenerate
                </button>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.55 }}>
                Hand this to a teacher / case manager so they can join with full admin access. Don't share with paras — they should use the regular invite code.
              </div>
            </div>
          </div>

          <DangerZone
            team={team}
            activeTeamId={activeTeamId}
            onError={setErr}
          />
        </div>
      )}

      {shareTip && (
        <ShareTipModal
          topic={shareTip.topic}
          paraName={shareTip.paraName}
          studentLabel={shareTip.studentLabel}
          onClose={() => setShareTip(null)}
        />
      )}
    </div>
  );
}

// ── Danger Zone — destructive team-wide actions ─────────────
// "Wipe student records" deletes every team_students row for this team.
// Cascade rules on the database fire as configured: logs / incidents /
// interventions / outcomes / handoffs lose their student_id (set null,
// not deleted), parent_notes + para_assignments cascade-delete. Use case:
// starting a clean roster for a new term, or recovering from an import
// gone wrong.
function DangerZone({ team, activeTeamId, onError }) {
  const [busy, setBusy] = useState(false);
  const [studentCount, setStudentCount] = useState(null);
  const studentsLoaded = Array.isArray(team?.teamStudents);

  useEffect(() => {
    if (studentsLoaded) setStudentCount(team.teamStudents.length);
  }, [studentsLoaded, team?.teamStudents]);

  const handleWipe = async () => {
    const teamName = team?.activeTeam?.name || 'this team';
    const count = studentCount ?? '?';
    const phrase = 'wipe roster';
    const typed = window.prompt(
      `WIPE ALL STUDENT RECORDS for "${teamName}"?\n\n` +
      `This deletes ${count} student row(s) from the cloud. Every para on this team\n` +
      `will see their roster empty out. Logs and case-memory entries lose their\n` +
      `student attribution but the entries themselves stay (set-null, not deleted).\n` +
      `Parent notes and para assignments tied to those students ARE deleted.\n\n` +
      `On THIS device, your local imports / logs / case memory / knowledge base\n` +
      `are also cleared so you start clean. Real-name vault stays — it's per-device,\n` +
      `not per-team.\n\n` +
      `This cannot be undone.\n\n` +
      `Type the exact phrase below to confirm:\n\n` +
      `   ${phrase}`
    );
    if (typed !== phrase) {
      if (typed !== null) alert('Phrase did not match. Nothing was deleted.');
      return;
    }
    setBusy(true);
    try {
      const deleted = await deleteAllTeamStudents(activeTeamId);
      // Local cleanup — Supabase bulk-delete realtime events are unreliable, so
      // we don't trust the subscription to update teamStudents in time. Wipe
      // the localStorage keys that hold student-shaped state, then reload so
      // the admin sees the clean state immediately.
      const LOCAL_KEYS = [
        'paraImportedStudentsV1', 'paraImportedPeriodMapV1', 'paraDemoModeV1',
        'paraLogsV1',
        'paraIncidentsV1', 'paraInterventionsV1', 'paraOutcomesV1',
        'paraKBV1',
        'paraIdentityOverridesV1', 'paraSupportsOverridesV1',
      ];
      try {
        LOCAL_KEYS.forEach(k => globalThis.localStorage?.removeItem(k));
      } catch { /* noop */ }
      alert(`Deleted ${deleted} student record(s) from the team and cleared local data on this device. Reloading…`);
      setTimeout(() => globalThis.location?.reload(), 200);
    } catch (e) {
      onError(e.message || String(e));
      setBusy(false);
    }
  };

  return (
    <div style={{
      marginTop: 'var(--space-6)',
      padding: 'var(--space-4) var(--space-5)',
      border: '1px solid rgba(248,113,113,0.35)',
      background: 'rgba(248,113,113,0.06)',
      borderRadius: 'var(--radius-md)',
      display: 'flex', flexDirection: 'column', gap: 'var(--space-2)',
    }}>
      <div style={{
        fontSize: 11, fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.1em',
        color: 'var(--red)',
      }}>
        ⚠ Danger zone
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5 }}>
        Wipe all student records for this team — fresh roster, clean slate.
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
        Affects every para on this team. {studentCount != null ? `Currently ${studentCount} student record${studentCount === 1 ? '' : 's'} in the cloud.` : ''}
        Logs and case-memory entries stay (their student link goes null);
        parent notes and assignments tied to those students are deleted.
      </div>
      <button
        type="button"
        disabled={busy || !activeTeamId || (studentCount != null && studentCount === 0)}
        onClick={handleWipe}
        className="btn btn-secondary btn-sm"
        style={{
          alignSelf: 'flex-start',
          color: 'var(--red)',
          borderColor: 'rgba(248,113,113,0.35)',
        }}
      >
        {busy ? 'Wiping…' : '🗑 Wipe all student records'}
      </button>
    </div>
  );
}

// ── Coaching Topics Section ─────────────────────────────────
// Sped-teacher triage: which para has a pattern worth bringing
// up at the next check-in, plus a one-click "share a tip" path.
// Runs the rules engine on team.sharedLogs, attributes each topic
// to the para whose logs surfaced it.
function CoachingTopicsSection({ team, members, onShareTip }) {
  const sharedLogs = team?.sharedLogs || [];
  const teamStudents = team?.teamStudents || [];

  const topics = useMemo(() => {
    const studentIds = teamStudents.map(s => s.id);
    if (studentIds.length === 0 || sharedLogs.length === 0) return [];

    const paraMembers = (members || []).filter(
      m => m.active && (m.role === 'para' || m.role === 'sub')
    );

    const studentLookupForTailor = Object.fromEntries(teamStudents.map(s => [s.id, s]));

    const all = paraMembers.flatMap(member => {
      const adapted = sharedLogs
        .filter(l => l.user_id === member.user_id)
        .map(l => ({ ...l, studentId: l.student_id }));
      const result = runTrainingGapRules(adapted, studentIds);
      return result.topics.map(t => {
        const tailored = tailorAdvice(t, studentLookupForTailor[t.studentId]);
        return {
          ...tailored,
          paraDisplayName: member.display_name,
          paraUserId: member.user_id,
        };
      });
    });

    return all.sort((a, b) => {
      const aTime = a.evidenceLogs?.[0]?.timestamp || 0;
      const bTime = b.evidenceLogs?.[0]?.timestamp || 0;
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    });
  }, [sharedLogs, teamStudents, members]);

  if (topics.length === 0) {
    return (
      <div className="card-elevated" style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>👍</div>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
          Nothing to discuss right now
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6, lineHeight: 1.6 }}>
          Your team's logs look good. When patterns worth a coaching conversation
          show up, they'll appear here.
        </div>
      </div>
    );
  }

  const studentLookup = Object.fromEntries(teamStudents.map(s => [s.id, s]));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <div style={{
        fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
        textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 4,
      }}>
        Coaching topics from your team · {topics.length}
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55, marginBottom: 'var(--space-3)' }}>
        Patterns from your team's recent logs that are worth bringing up. Each one
        is a chance to share a tip — not a record on the para.
      </div>
      {topics.map(t => {
        const student = studentLookup[t.studentId];
        const studentLabel = student?.pseudonym || 'Student';
        return (
          <div key={`${t.ruleId}::${t.paraUserId}::${t.studentId}`} className="panel" style={{
            padding: 'var(--space-4) var(--space-5)',
            display: 'flex', alignItems: 'flex-start', gap: 'var(--space-4)',
            flexWrap: 'wrap',
          }}>
            <div style={{ fontSize: 22, lineHeight: 1, paddingTop: 2 }}>🔖</div>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                {t.topicTitle}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.55 }}>
                Para: <strong style={{ color: 'var(--text-primary)' }}>{t.paraDisplayName || 'Unknown para'}</strong>
                {' · '}Student: {studentLabel}
                {' · '}{relativeAge(t.evidenceLogs?.[0]?.timestamp)}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.55 }}>
                {t.plainEnglishRule}
              </div>
            </div>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => onShareTip({ topic: t, paraName: t.paraDisplayName || 'para', studentLabel })}
            >
              Share a tip with {t.paraDisplayName ? t.paraDisplayName.split(' ')[0] : 'para'}
            </button>
          </div>
        );
      })}
    </div>
  );
}

function relativeAge(ts) {
  if (!ts) return '';
  const ms = Date.now() - new Date(ts).getTime();
  const days = Math.floor(ms / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

// ── Share-a-tip Modal ───────────────────────────────────────
// Pre-fills a friendly coaching message the sped teacher can copy
// and send via their normal email/messaging tool. No "flag," no
// "follow-up required" — just a tip.
function ShareTipModal({ topic, paraName, studentLabel, onClose }) {
  const firstName = paraName ? paraName.split(' ')[0] : 'there';
  const altLines = (topic.alternatives || []).map(a => `• ${a}`).join('\n');
  const draft =
    `Hey ${firstName},\n\n` +
    `I noticed something in the recent logs for ${studentLabel || 'one of our students'} that might be worth trying — wanted to share a tip in case it helps.\n\n` +
    `${topic.topicTitle}\n\n` +
    `${topic.topicExplainer}\n\n` +
    `A few things to try:\n${altLines}\n\n` +
    `Want to talk through it at our next check-in?`;

  const [text, setText] = useState(draft);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ width: 560 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>Share a tip with {paraName || 'para'}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Edit and copy — paste into your normal email or messaging app.
            </div>
          </div>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            className="data-textarea"
            style={{ height: 320, fontFamily: 'inherit', lineHeight: 1.6 }}
          />
        </div>
        <div className="modal-footer">
          <button
            className="btn btn-primary"
            style={{ flex: 1 }}
            onClick={() => {
              navigator.clipboard.writeText(text);
              alert('Copied — paste it into your email or chat to send to your para.');
            }}
          >
            Copy to clipboard
          </button>
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ── Para Setup Guide ─────────────────────────────────────────
// Plain-English walkthrough for the sped teacher: "what your paras
// need so they can find their kids in the app." No jargon. Tells them
// the two keys (real name + 6-digit number), shows the workflow, and
// drops a CTA into the Assign Students tab.
function ParaSetupGuide({ onGoToAssignments }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>

      {/* Big intro */}
      <div className="card-elevated" style={{ padding: 'var(--space-6)' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
          For the sped teacher
        </div>
        <h2 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.01em', color: 'var(--text-primary)', marginTop: 4 }}>
          What your paras need from you
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, marginTop: 'var(--space-2)' }}>
          Paras can't see real student names from the cloud — that's by design (FERPA). To match real names to students in the app,
          each para needs <strong style={{ color: 'var(--text-primary)' }}>two keys</strong> for every kid they support:
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
          <KeyCard
            icon="👤"
            title="Real name"
            body='Like "Maria Lopez". The para sees it on their computer only — never uploaded.'
            tone="#3b82f6"
          />
          <KeyCard
            icon="🔢"
            title="6-digit Para App Number"
            body='Like "847293". Goes to the cloud — that&apos;s how everyone&apos;s app finds the same kid without using a name.'
            tone="#a78bfa"
          />
        </div>

        <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.55, marginTop: 'var(--space-4)' }}>
          Without those, paras see students as <span className="mono" style={{ background: 'var(--bg-dark)', padding: '1px 6px', borderRadius: 4 }}>#847293</span> with no real name attached. The cloud has the IEP info ready — you just need to give them the bridge.
        </p>
      </div>

      {/* The 4-step recipe */}
      <div className="card-elevated" style={{ padding: 'var(--space-6)' }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 'var(--space-4)' }}>
          The 4 steps
        </h3>
        <ol style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', listStyle: 'none', padding: 0 }}>
          <Step n={1} title="Load the students once" body={(
            <>Use <strong>IEP Import</strong> (Smart Import or School-style roster). Make sure each student has a Para App Number — the import preview shows you the count of "Para App #s" detected.</>
          )} />
          <Step n={2} title="Pick each para's caseload" body={(
            <>Open the <strong>Assign Students</strong> tab. Pick a para → check their kids → save. You can pre-register paras by email if they haven't signed in yet.</>
          )} cta={onGoToAssignments && (
            <button onClick={onGoToAssignments} className="btn btn-primary btn-sm" style={{ marginTop: 4 }}>
              Open Assign Students →
            </button>
          )} />
          <Step n={3} title="Download a CSV for each para" body={(
            <>After picking their kids, click <strong>📊 CSV — fastest, easy to edit later</strong>. You get a small spreadsheet file with each kid's name + 6-digit number. That's the bridge.</>
          )} />
          <Step n={4} title="Get the file to your para" body={(
            <>Email it. Drop it in your shared drive. AirDrop. Whatever you already use. Tell them: <em style={{ color: 'var(--text-secondary)' }}>"Open the app's sidebar → Find my students → upload this."</em> They're set in 10 seconds.</>
          )} />
        </ol>
      </div>

      {/* The three ways to share */}
      <div className="card-elevated" style={{ padding: 'var(--space-6)' }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 'var(--space-2)' }}>
          Three ways to share with your paras
        </h3>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.55, marginBottom: 'var(--space-4)' }}>
          Pick whichever fits your team. The CSV file works for all of them.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-3)' }}>
          <ShareCard icon="📧" title="Email" body="Attach the CSV. Subject: 'Your students for SupaPara'. One sentence in the body: 'Drop this in Find my students.'" />
          <ShareCard icon="📁" title="Shared drive" body="Drop the CSV in your team's Google Drive / OneDrive folder. Tell paras the folder name. They download → upload." />
          <ShareCard icon="🗣️" title="Just text it" body="If they got a new kid mid-year, just text them the name + 6-digit number. They paste it directly into Find my students." />
        </div>
      </div>

      {/* Privacy reminder */}
      <div style={{
        padding: 'var(--space-3) var(--space-4)',
        background: 'var(--green-muted)',
        border: '1px solid rgba(34,197,94,0.3)',
        borderRadius: 'var(--radius-md)',
        color: 'var(--green)',
        fontSize: 12, lineHeight: 1.6,
      }}>
        🔒 <strong>The CSV file has real names — it lives only on your computer and the para's computer.</strong> The cloud only ever sees the 6-digit numbers. If a CSV ever ends up in a place it shouldn't (lost laptop, wrong email), it's just names + 6-digit numbers — no IEP details, no notes, no goals. The sensitive stuff stays on devices the para is signed into.
      </div>
    </div>
  );
}

function KeyCard({ icon, title, body, tone }) {
  return (
    <div style={{
      padding: 'var(--space-4)',
      background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
      display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <div style={{
        width: 40, height: 40,
        borderRadius: 'var(--radius-md)',
        background: tone + '22',
        border: `1px solid ${tone}55`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 22,
      }}>{icon}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.55 }}>{body}</div>
    </div>
  );
}

function Step({ n, title, body, cta }) {
  return (
    <li style={{
      display: 'flex', gap: 'var(--space-3)',
      padding: 'var(--space-3) var(--space-4)',
      background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
    }}>
      <div style={{
        width: 28, height: 28, flexShrink: 0,
        borderRadius: '50%',
        background: 'var(--accent-strong)',
        color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, fontWeight: 800,
      }}>{n}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55, marginTop: 2 }}>{body}</div>
        {cta}
      </div>
    </li>
  );
}

function ShareCard({ icon, title, body }) {
  return (
    <div style={{
      padding: 'var(--space-3) var(--space-4)',
      background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
    }}>
      <div style={{ fontSize: 22, marginBottom: 4 }}>{icon}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.55, marginTop: 4 }}>{body}</div>
    </div>
  );
}
