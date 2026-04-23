import React from 'react';
import { useTeamOptional } from '../context/TeamProvider';
import { acknowledgeHandoff } from '../services/teamSync';

export default function HandoffInbox() {
  const team = useTeamOptional();
  if (!team) return null;
  const { handoffs, user, teamStudents } = team;

  const unseen = (handoffs || []).filter(
    (h) => !(h.acknowledged_by || []).includes(user?.id) && h.from_user_id !== user?.id
  );

  const studentPseudonym = (studentId) => {
    if (!studentId) return null;
    const s = (teamStudents || []).find((x) => x.id === studentId);
    return s ? s.pseudonym : null;
  };

  return (
    <div className="sidebar-hide-when-collapsed" style={{
      marginTop: 'var(--space-3)',
      padding: 'var(--space-3)',
      background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        fontSize: 10, fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.1em',
        color: 'var(--text-muted)',
        marginBottom: 'var(--space-2)',
      }}>
        <span>Team Handoffs</span>
        {unseen.length > 0 && (
          <span className="pill pill-red" style={{ fontSize: 10 }}>
            {unseen.length} new
          </span>
        )}
      </div>
      {(!handoffs || handoffs.length === 0) && (
        <div style={{ opacity: 0.5, fontSize: 11, padding: 'var(--space-1) 0' }}>
          No handoffs yet.
        </div>
      )}
      <div style={{ maxHeight: 260, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {(handoffs || []).map((h) => {
          const seen = (h.acknowledged_by || []).includes(user?.id);
          const pseudonym = studentPseudonym(h.student_id);
          const urgencyPill = h.urgency === 'urgent' ? 'pill-red'
            : h.urgency === 'important' ? 'pill-yellow' : 'pill-accent';
          return (
            <div key={h.id} style={{
              padding: 'var(--space-3)',
              background: seen ? 'transparent' : 'rgba(248,113,113,0.07)',
              borderRadius: 'var(--radius-md)',
              border: `1px solid ${seen ? 'var(--border)' : 'rgba(248,113,113,0.25)'}`,
              fontSize: 11,
            }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', marginBottom: 4,
              }}>
                <span className={`pill ${urgencyPill}`} style={{ fontSize: 9, padding: '1px 7px' }}>
                  {h.urgency}
                </span>
                <span style={{ opacity: 0.6, fontSize: 10 }}>
                  {new Date(h.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              {pseudonym && (
                <div style={{ fontWeight: 600, color: 'var(--accent-hover)', fontSize: 12, marginBottom: 3 }}>
                  {pseudonym}
                </div>
              )}
              <div style={{ fontSize: 12, color: 'var(--text-primary)', marginBottom: 4, lineHeight: 1.4 }}>
                {h.body}
              </div>
              {!seen && (
                <button
                  type="button"
                  onClick={() => acknowledgeHandoff(h.id, user?.id)}
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: 10, color: 'var(--accent)', padding: '2px 8px' }}
                >
                  Mark seen
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
