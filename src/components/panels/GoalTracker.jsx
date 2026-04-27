// ── Goal Progress Tracker — visual rewrite ───────────────────
// Para-friendly card per student: status chip + progress bar + recent
// supports + "next best support" + the existing 6-button quick logger.
import React, { useState } from "react";
import { GOAL_PROGRESS_OPTIONS, STRATEGIES } from '../../data';
import { resolveLabel } from '../../privacy/nameResolver';
import { buildVisualGoalData, optionForId } from './goalTrackerHelpers';

function StatusChip({ optionId }) {
  const opt = optionForId(optionId);
  if (!opt) {
    return (
      <span style={{
        fontSize: 10, fontWeight: 600,
        padding: '2px 8px', borderRadius: 999,
        background: 'var(--bg-dark)', color: 'var(--text-muted)',
        border: '1px solid var(--border)',
      }}>
        Not yet logged
      </span>
    );
  }
  return (
    <span style={{
      fontSize: 10, fontWeight: 700,
      padding: '2px 8px', borderRadius: 999,
      background: `${opt.color}20`, color: opt.color,
      border: `1px solid ${opt.color}40`,
      whiteSpace: 'nowrap',
    }}>
      {opt.icon} {opt.label}
    </span>
  );
}

function ProgressBar({ summary }) {
  const total = summary.totalCount;
  if (total === 0) {
    return (
      <div style={{
        height: 6, background: 'var(--bg-dark)', borderRadius: 3,
        marginTop: 6, opacity: 0.5,
      }} />
    );
  }
  const pos = Math.round((summary.positive / total) * 100);
  const neg = Math.round((summary.negative / total) * 100);
  const neu = 100 - pos - neg;
  return (
    <div title={`${summary.positive} positive · ${summary.neutral} neutral · ${summary.negative} concern (last 14 days)`}
      style={{
        display: 'flex', height: 6, marginTop: 6,
        borderRadius: 3, overflow: 'hidden', background: 'var(--bg-dark)',
      }}>
      {pos > 0 && <div style={{ width: `${pos}%`, background: '#4ade80' }} />}
      {neu > 0 && <div style={{ width: `${neu}%`, background: '#fbbf24' }} />}
      {neg > 0 && <div style={{ width: `${neg}%`, background: '#f87171' }} />}
    </div>
  );
}

function RecentSupports({ tags }) {
  if (!tags || tags.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
      <span style={{ fontSize: 10, color: 'var(--text-muted)', alignSelf: 'center' }}>
        Recent:
      </span>
      {tags.map(t => (
        <span key={t} className="pill" style={{
          fontSize: 9, padding: '1px 6px', borderRadius: 999,
          background: 'var(--bg-dark)', color: 'var(--text-secondary)',
          border: '1px solid var(--border)',
        }}>
          {t}
        </span>
      ))}
    </div>
  );
}

function NextBestSupport({ suggestion }) {
  if (!suggestion) return null;
  return (
    <div style={{
      marginTop: 8, padding: '6px 10px',
      background: 'var(--accent-glow)',
      border: '1px solid var(--accent-border)',
      borderRadius: 6,
      fontSize: 11, color: 'var(--accent-hover)',
      lineHeight: 1.4,
    }}>
      <span style={{ fontWeight: 700 }}>Try next: </span>
      {suggestion.title || suggestion.label || suggestion.id}
    </div>
  );
}

export function GoalTracker({ students, onSave, studentsMap, logs = [] }) {
  const lookup = studentsMap || {};
  const data = buildVisualGoalData({
    studentIds: students || [],
    studentsMap: lookup,
    logs,
    strategies: STRATEGIES,
    windowDays: 14,
  });
  const [note, setNote] = useState('');
  const [openStudent, setOpenStudent] = useState(null);

  const logGoal = (goal, studentId, opt) => {
    const entry = `Goal Progress: "${goal.text.slice(0, 60)}${goal.text.length > 60 ? '…' : ''}" — ${opt.label}${note ? ' | Note: ' + note : ''}`;
    onSave(studentId, entry, 'Goal Progress', { goalId: goal.id, tags: ['goal', opt.id], source: 'goal_tracker' });
    setNote('');
  };

  if (data.length === 0) {
    return (
      <div style={{ padding: 16, color: 'var(--text-muted)', textAlign: 'center' }}>
        No students this period.
      </div>
    );
  }

  return (
    <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {data.map(({ student, goals }) => {
        const isOpen = openStudent === student.id || data.length === 1;
        const studentLabel = resolveLabel(student, 'compact');
        return (
          <div key={student.id} style={{
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            borderRadius: 8, overflow: 'hidden',
          }}>
            <button
              type="button"
              onClick={() => setOpenStudent(o => o === student.id ? null : student.id)}
              style={{
                width: '100%', padding: '10px 12px',
                background: 'transparent', border: 'none',
                borderLeft: `3px solid ${student.color}`,
                color: 'var(--text-primary)', cursor: 'pointer',
                fontFamily: 'inherit', textAlign: 'left',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 700, color: student.color }}>
                {studentLabel}
              </span>
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                {goals.length === 0 ? 'no goals' : `${goals.length} goal${goals.length === 1 ? '' : 's'}`}
                {' '}{isOpen ? '▾' : '▸'}
              </span>
            </button>

            {isOpen && goals.length === 0 && (
              <div style={{ padding: '8px 12px 12px', fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                No goals on file for this student yet.
              </div>
            )}

            {isOpen && goals.map(({ goal, summary, latestOption, recentSupports, suggestion }) => (
              <div key={goal.id} style={{
                padding: '10px 12px',
                borderTop: '1px solid var(--border)',
                display: 'flex', flexDirection: 'column', gap: 2,
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 240px', minWidth: 0, fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.45 }}>
                    {goal.text}
                  </div>
                  <StatusChip optionId={summary.latestOptionId} />
                </div>

                <ProgressBar summary={summary} />

                <RecentSupports tags={recentSupports} />

                <NextBestSupport suggestion={suggestion} />

                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 8 }}>
                  {GOAL_PROGRESS_OPTIONS.map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => logGoal(goal, student.id, opt)}
                      title={opt.label}
                      style={{
                        fontSize: 10, padding: '4px 10px', borderRadius: 6,
                        border: 'none', cursor: 'pointer',
                        background: opt.color + '20', color: opt.color,
                        fontFamily: 'inherit', fontWeight: 600,
                        minHeight: 28,
                      }}
                    >
                      {opt.icon} {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        );
      })}

      <input
        value={note}
        onChange={e => setNote(e.target.value)}
        className="chat-input"
        placeholder="Optional note for next goal tap…"
        style={{ fontSize: 11 }}
      />
    </div>
  );
}
