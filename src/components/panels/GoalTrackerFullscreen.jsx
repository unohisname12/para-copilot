// ── Goal Tracker Fullscreen ─────────────────────────────────
// Per-student deep-dive overlay: big donut with segment-click filter,
// goal grid (3-up to use the wider screen), notes textarea (saves as a
// log; optional goal attach), and a recent-activity timeline. Esc closes.
import React, { useState, useEffect, useRef } from 'react';
import { GOAL_PROGRESS_OPTIONS } from '../../data';
import { resolveLabel } from '../../privacy/nameResolver';
import { Donut } from './Donut';
import { useEscape } from '../../hooks/useEscape';
import { optionForId } from './goalTrackerHelpers';

function StatusChip({ optionId }) {
  const opt = optionForId(optionId);
  if (!opt) {
    return (
      <span style={{
        fontSize: 10, fontWeight: 600,
        padding: '2px 8px', borderRadius: 999,
        background: 'var(--bg-dark)', color: 'var(--text-muted)',
        border: '1px solid var(--border)',
        whiteSpace: 'nowrap',
      }}>
        Not yet logged
      </span>
    );
  }
  return (
    <span style={{
      fontSize: 11, fontWeight: 700,
      padding: '3px 10px', borderRadius: 999,
      background: `${opt.color}28`, color: opt.color,
      border: `1px solid ${opt.color}66`,
      whiteSpace: 'nowrap',
      boxShadow: `0 0 12px ${opt.color}30`,
    }}>
      {opt.icon} {opt.label}
    </span>
  );
}

const POSITIVE = new Set(['gp_progress', 'gp_support', 'gp_mastery']);
const NEGATIVE = new Set(['gp_concern', 'gp_notattempt']);
function bucketForOption(optionId) {
  if (POSITIVE.has(optionId)) return 'positive';
  if (NEGATIVE.has(optionId)) return 'negative';
  return optionId ? 'neutral' : null;
}

function buildTimeline(logs, studentId, max = 30) {
  return (logs || [])
    .filter(l => l.studentId === studentId)
    .sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime())
    .slice(0, max);
}

export function GoalTrackerFullscreen({
  student, goals, aggregate, allLogs,
  onLog, onClose,
}) {
  useEscape(onClose);
  const [filter, setFilter] = useState(null); // 'positive' | 'neutral' | 'negative' | null
  const [note, setNote] = useState('');
  const [attachToGoalId, setAttachToGoalId] = useState('');
  const noteRef = useRef('');
  noteRef.current = note;

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const studentLabel = resolveLabel(student, 'compact');

  const filteredGoals = filter
    ? goals.filter(g => bucketForOption(g.summary?.latestOptionId) === filter)
    : goals;

  const timeline = buildTimeline(allLogs, student.id, 30);

  const saveNote = () => {
    const text = (noteRef.current || '').trim();
    if (!text) return;
    onLog(student.id, text, 'General Observation', {
      source: 'goal_tracker_fullscreen',
      tags: attachToGoalId ? ['goal', 'goal_tracker_note'] : ['goal_tracker_note'],
      goalId: attachToGoalId || null,
      pseudonym: student.pseudonym,
    });
    setNote('');
  };

  const logGoalProgress = (goal, opt) => {
    const text = `Goal Progress: "${(goal.text || '').slice(0, 60)}${(goal.text || '').length > 60 ? '…' : ''}" — ${opt.label}`;
    onLog(student.id, text, 'Goal Progress', {
      source: 'goal_tracker_fullscreen',
      goalId: goal.id,
      tags: ['goal', opt.id],
      pseudonym: student.pseudonym,
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Goal dashboard for ${studentLabel}`}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(2, 6, 23, 0.92)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          flex: 1, minHeight: 0,
          margin: 'min(3vw, 32px)',
          background: `radial-gradient(circle at top left, ${student.color}10, var(--panel-bg) 60%)`,
          border: `1px solid ${student.color}50`,
          borderRadius: 18,
          boxShadow: `0 0 80px ${student.color}30, 0 24px 60px rgba(0,0,0,0.5)`,
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '18px 24px',
          borderBottom: `1px solid ${student.color}30`,
          display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0,
        }}>
          <div style={{
            width: 14, height: 14, borderRadius: '50%',
            background: student.color,
            boxShadow: `0 0 16px ${student.color}, 0 0 32px ${student.color}80`,
          }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 22, fontWeight: 800, color: student.color,
              letterSpacing: '-0.01em', lineHeight: 1.1,
            }}>
              {studentLabel}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 2 }}>
              Goal dashboard · {goals.length} goal{goals.length === 1 ? '' : 's'}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              minWidth: 38, minHeight: 38, borderRadius: 8,
              background: 'transparent', border: '1px solid var(--border)',
              color: 'var(--text-secondary)', cursor: 'pointer',
              fontSize: 18, fontFamily: 'inherit',
            }}
          >
            ✕
          </button>
        </div>

        {/* Body — scrollable */}
        <div style={{
          flex: 1, minHeight: 0, overflowY: 'auto',
          padding: 24,
          display: 'grid',
          gridTemplateColumns: 'minmax(280px, 360px) 1fr',
          gap: 20,
        }}>
          {/* Left column — donut + stats + notes */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
              padding: 18,
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 14,
            }}>
              <Donut
                positive={aggregate.positive}
                neutral={aggregate.neutral}
                negative={aggregate.negative}
                size={220}
                centerColor={student.color}
                centerLabel="last 14d"
                showHaloPulse
                onSegmentClick={(seg) => setFilter(f => f === seg ? null : seg)}
                activeFilter={filter}
              />
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.5 }}>
                {filter
                  ? <>Filtering goals to <b style={{ color: 'var(--text-primary)', textTransform: 'capitalize' }}>{filter}</b> · <button onClick={() => setFilter(null)} style={{ background: 'transparent', border: 'none', color: 'var(--accent-hover)', cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline' }}>clear</button></>
                  : 'Tap a segment to filter goals by status'}
              </div>

              <div style={{ display: 'flex', gap: 14, paddingTop: 8, borderTop: '1px solid var(--border)', width: '100%', justifyContent: 'space-around' }}>
                <Stat label="Today" value={aggregate.today} color={student.color} />
                <Stat label="Positive" value={aggregate.positive} color="#4ade80" />
                <Stat label="Concern" value={aggregate.negative} color="#f87171" />
              </div>
            </div>

            {/* Notes */}
            <div style={{
              padding: 14,
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 14,
              display: 'flex', flexDirection: 'column', gap: 8,
            }}>
              <div style={{
                fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
                textTransform: 'uppercase', letterSpacing: '0.08em',
              }}>
                Add a note
              </div>
              <textarea
                spellCheck="true" lang="en"
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="What's going on with this kid right now? Saves to the activity log."
                style={{
                  width: '100%', minHeight: 90,
                  padding: 10,
                  background: 'var(--bg-dark)', color: 'var(--text-primary)',
                  border: '1px solid var(--border)', borderRadius: 8,
                  fontSize: 13, fontFamily: 'inherit', lineHeight: 1.5,
                  resize: 'vertical',
                }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <select
                  value={attachToGoalId}
                  onChange={e => setAttachToGoalId(e.target.value)}
                  style={{
                    fontSize: 11, padding: '6px 8px',
                    background: 'var(--bg-dark)', color: 'var(--text-primary)',
                    border: '1px solid var(--border)', borderRadius: 6,
                    fontFamily: 'inherit',
                  }}
                >
                  <option value="">Not attached to a goal</option>
                  {goals.map(g => (
                    <option key={g.goal.id} value={g.goal.id}>
                      Attach to: {(g.goal.text || '').slice(0, 50)}{(g.goal.text || '').length > 50 ? '…' : ''}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={saveNote}
                  disabled={!note.trim()}
                  style={{ minHeight: 32 }}
                >
                  Save note
                </button>
              </div>
            </div>
          </div>

          {/* Right column — goal grid + timeline */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
            {/* Goal grid */}
            <div>
              <div style={{
                fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
                textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8,
              }}>
                Goals {filter ? `· filtered to ${filter}` : ''} · {filteredGoals.length}
              </div>
              {filteredGoals.length === 0 && (
                <div style={{ padding: 16, fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  {filter ? `No goals match the "${filter}" filter.` : 'No goals on file for this student.'}
                </div>
              )}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: 10,
              }}>
                {filteredGoals.map(({ goal, summary, recentSupports, suggestion }) => (
                  <div key={goal.id} style={{
                    padding: 12,
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    display: 'flex', flexDirection: 'column', gap: 6,
                    minHeight: 160,
                  }}>
                    <div style={{
                      fontSize: 13, fontWeight: 600, color: 'var(--text-primary)',
                      lineHeight: 1.45,
                    }}>
                      {goal.text}
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                      <StatusChip optionId={summary.latestOptionId} />
                      {summary.totalCount > 0 && (
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>
                          {summary.totalCount} logs · 14d
                        </span>
                      )}
                    </div>
                    {recentSupports && recentSupports.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {recentSupports.slice(0, 3).map(t => (
                          <span key={t} style={{
                            fontSize: 9, fontWeight: 600,
                            padding: '2px 7px', borderRadius: 999,
                            background: 'var(--bg-dark)', color: 'var(--text-secondary)',
                            border: '1px solid var(--border)',
                          }}>{t}</span>
                        ))}
                      </div>
                    )}
                    {suggestion && (
                      <div style={{
                        marginTop: 4, padding: '5px 9px',
                        background: `${student.color}10`,
                        border: `1px solid ${student.color}30`,
                        borderRadius: 6,
                        fontSize: 10, color: 'var(--text-primary)', lineHeight: 1.35,
                      }}>
                        <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Try next: </span>
                        {suggestion.title || suggestion.label || suggestion.id}
                      </div>
                    )}
                    <div style={{ marginTop: 'auto', display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {GOAL_PROGRESS_OPTIONS.map(opt => (
                        <button
                          key={opt.id}
                          onClick={() => logGoalProgress(goal, opt)}
                          title={opt.label}
                          style={{
                            fontSize: 16, padding: '4px 8px', borderRadius: 6,
                            border: 'none', cursor: 'pointer',
                            background: opt.color + '22', color: opt.color,
                            fontFamily: 'inherit',
                            minHeight: 30, minWidth: 30,
                          }}
                        >
                          {opt.icon}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Activity timeline */}
            <div>
              <div style={{
                fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
                textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8,
              }}>
                Recent activity · {timeline.length}
              </div>
              {timeline.length === 0 ? (
                <div style={{ padding: 16, fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  No logs yet.
                </div>
              ) : (
                <div style={{
                  display: 'flex', flexDirection: 'column', gap: 4,
                  maxHeight: 360, overflowY: 'auto',
                  paddingRight: 6,
                }}>
                  {timeline.map(l => (
                    <div key={l.id} style={{
                      padding: '8px 10px',
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border)',
                      borderLeft: `3px solid ${student.color}`,
                      borderRadius: 6,
                      fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.4,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                        <span style={{
                          fontSize: 9, fontWeight: 700,
                          textTransform: 'uppercase', letterSpacing: '0.06em',
                          color: 'var(--text-muted)',
                        }}>
                          {l.type || 'Note'}
                        </span>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>
                          {l.timestamp ? new Date(l.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : l.date}
                        </span>
                      </div>
                      <div>{l.note || l.text || '—'}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: color || 'var(--text-primary)', lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2 }}>
        {label}
      </div>
    </div>
  );
}
