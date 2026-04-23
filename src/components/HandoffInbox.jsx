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
    <div style={{
      padding: '10px 8px',
      borderTop: '1px solid var(--border, #1c2d4a)',
      marginTop: 8,
    }}>
      <div style={{ fontSize: 10, color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>
        Team Handoffs
        {unseen.length > 0 && (
          <span style={{ color: '#f87171', marginLeft: 6 }}>· {unseen.length} new</span>
        )}
      </div>
      {(!handoffs || handoffs.length === 0) && (
        <div style={{ opacity: 0.5, fontSize: 11, padding: '4px 2px' }}>No handoffs yet.</div>
      )}
      <div style={{ maxHeight: 240, overflowY: 'auto' }}>
        {(handoffs || []).map((h) => {
          const seen = (h.acknowledged_by || []).includes(user?.id);
          const pseudonym = studentPseudonym(h.student_id);
          const urgencyColor = h.urgency === 'urgent' ? '#f87171'
            : h.urgency === 'important' ? '#fbbf24' : '#60a5fa';
          return (
            <div key={h.id} style={{
              padding: 8, marginBottom: 6,
              background: seen ? 'transparent' : 'rgba(248,113,113,0.08)',
              borderRadius: 6,
              border: `1px solid ${seen ? 'var(--border, #1c2d4a)' : '#7f1d1d'}`,
              fontSize: 11,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, color: urgencyColor }}>
                <span>{h.urgency}</span>
                <span style={{ opacity: 0.7 }}>{new Date(h.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              {pseudonym && <div style={{ fontWeight: 600, color: '#93c5fd', marginBottom: 3 }}>{pseudonym}</div>}
              <div style={{ fontSize: 12, color: 'white', marginBottom: 4, lineHeight: 1.4 }}>{h.body}</div>
              {!seen && (
                <button type="button" onClick={() => acknowledgeHandoff(h.id, user?.id)} style={{
                  fontSize: 10, padding: '3px 8px', borderRadius: 4, cursor: 'pointer',
                  background: 'transparent', color: '#93c5fd',
                  border: '1px solid #1d4ed8',
                }}>
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
