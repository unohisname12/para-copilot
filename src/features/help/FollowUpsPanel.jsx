import React from 'react';
import { resolveLabel } from '../../privacy/nameResolver';
import { formatDelayLabel } from './followUpScheduler';

function timeLabel(iso) {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return 'later';
  const diff = t - Date.now();
  if (diff <= 0) return 'now';
  return formatDelayLabel(Math.max(1, Math.round(diff / 60000)));
}

export function FollowUpsPanel({
  followUps,
  dueFollowUps,
  allStudents,
  incidents,
  interventions,
  onSelect,
  onSnooze,
  onDismiss,
}) {
  const dueIds = new Set((dueFollowUps || []).map(f => f.id));
  const pending = followUps || [];

  if (!pending.length) {
    return (
      <div style={{ padding: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6 }}>
          Follow-ups
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
          No check-ins waiting. When you track an outcome later, it will show up here.
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div>
        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>Follow-ups</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
          {dueFollowUps.length} due now · {pending.length} waiting
        </div>
      </div>

      {pending.map(f => {
        const student = allStudents?.[f.studentId];
        const incident = incidents.find(i => i.id === f.incidentId);
        const intervention = interventions.find(i => i.id === f.interventionId);
        const due = dueIds.has(f.id);
        return (
          <div
            key={f.id}
            style={{
              padding: 12,
              borderRadius: 'var(--radius-md)',
              background: due ? 'var(--accent-glow)' : 'var(--bg-surface)',
              border: `1px solid ${due ? 'var(--accent-border)' : 'var(--border)'}`,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 5 }}>
              <strong style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                {student ? resolveLabel(student, 'compact') : 'Student'}
              </strong>
              <span style={{ fontSize: 11, color: due ? 'var(--accent-hover)' : 'var(--text-muted)', fontWeight: 700 }}>
                {due ? 'Due now' : timeLabel(f.nextPromptAt)}
              </span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.45, marginBottom: 8 }}>
              {incident?.description || 'Saved check-in'}
            </div>
            {intervention && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>
                Tried: {intervention.strategyLabel || intervention.staffNote || 'support'}
              </div>
            )}
            {f.needsIntervention && (
              <div style={{ fontSize: 11, color: 'var(--yellow)', marginBottom: 10 }}>
                Needs what you tried
              </div>
            )}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-action btn-sm" onClick={() => onSelect(f.id)}>
                Open
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => onSnooze(f.id, 15)}>
                Later
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => onDismiss(f.id)}>
                Dismiss
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
