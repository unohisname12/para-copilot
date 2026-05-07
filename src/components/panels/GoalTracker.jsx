// ── Goal Tracker — visual mini-dashboard per student ─────────
// Per-student hero (polished donut + big numbers + recent supports
// + trend) over an expandable 2-up grid of goal mini-tiles. Built
// to read in <1 second during class. ⛶ button per student opens a
// fullscreen deep-dive with notes + timeline + segment-filter donut.
import React, { useState, useEffect, useRef } from "react";
import { GOAL_PROGRESS_OPTIONS, STRATEGIES } from '../../data';
import { resolveLabel } from '../../privacy/nameResolver';
import {
  buildVisualGoalData, optionForId,
  summarizeStudentGoals, trendSymbol,
} from './goalTrackerHelpers';
import { Donut } from './Donut';
import { GoalTrackerFullscreen } from './GoalTrackerFullscreen';
import PrivacyName from '../PrivacyName';

function StatusChip({ optionId, glow = false }) {
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
      fontSize: 10, fontWeight: 700,
      padding: '2px 8px', borderRadius: 999,
      background: `${opt.color}25`, color: opt.color,
      border: `1px solid ${opt.color}55`,
      whiteSpace: 'nowrap',
      boxShadow: glow ? `0 0 12px ${opt.color}40` : 'none',
    }}>
      {opt.icon} {opt.label}
    </span>
  );
}

function MiniProgressBar({ summary }) {
  const total = summary.totalCount;
  if (total === 0) {
    return (
      <div style={{
        height: 4, background: 'var(--bg-dark)', borderRadius: 2,
        marginTop: 4, opacity: 0.5,
      }} />
    );
  }
  const pos = (summary.positive / total) * 100;
  const neg = (summary.negative / total) * 100;
  const neu = 100 - pos - neg;
  return (
    <div title={`${summary.positive} pos · ${summary.neutral} neutral · ${summary.negative} concern`}
      style={{
        display: 'flex', height: 4, marginTop: 6,
        borderRadius: 2, overflow: 'hidden', background: 'var(--bg-dark)',
      }}>
      {pos > 0 && <div style={{ width: `${pos}%`, background: '#4ade80', transition: 'width 600ms ease-out' }} />}
      {neu > 0 && <div style={{ width: `${neu}%`, background: '#fbbf24', transition: 'width 600ms ease-out' }} />}
      {neg > 0 && <div style={{ width: `${neg}%`, background: '#f87171', transition: 'width 600ms ease-out' }} />}
    </div>
  );
}

function RecentSupportChips({ tags }) {
  if (!tags || tags.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {tags.map(t => (
        <span key={t} style={{
          fontSize: 9, fontWeight: 600,
          padding: '2px 7px', borderRadius: 999,
          background: 'var(--bg-dark)', color: 'var(--text-secondary)',
          border: '1px solid var(--border)',
          whiteSpace: 'nowrap',
        }}>
          {t}
        </span>
      ))}
    </div>
  );
}

function TryNext({ suggestion, color }) {
  if (!suggestion) return null;
  const label = suggestion.title || suggestion.label || suggestion.id;
  return (
    <div style={{
      marginTop: 6, padding: '5px 9px',
      background: `${color}10`,
      border: `1px solid ${color}30`,
      borderRadius: 6,
      fontSize: 10, color: 'var(--text-primary)',
      lineHeight: 1.35,
      display: 'flex', alignItems: 'center', gap: 6,
    }}>
      <span style={{ fontSize: 11 }}>✦</span>
      <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Try next:</span>
      <span style={{ fontWeight: 600 }}>{label}</span>
    </div>
  );
}

function GoalTile({ goal, summary, recentSupports, suggestion, color, onLog }) {
  return (
    <div style={{
      padding: 10, borderRadius: 10,
      background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', gap: 6,
      minHeight: 140,
    }}>
      <div style={{
        fontSize: 12, color: 'var(--text-primary)', fontWeight: 600,
        lineHeight: 1.4,
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
      }}>
        {goal.text}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <StatusChip optionId={summary.latestOptionId} glow />
        {summary.totalCount > 0 && (
          <span style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 600 }}>
            {summary.totalCount} logs · 14d
          </span>
        )}
      </div>

      <MiniProgressBar summary={summary} />

      {recentSupports && recentSupports.length > 0 && (
        <RecentSupportChips tags={recentSupports.slice(0, 3)} />
      )}

      <TryNext suggestion={suggestion} color={color} />

      <div style={{
        marginTop: 'auto', display: 'flex', gap: 3, flexWrap: 'wrap',
        paddingTop: 4,
      }}>
        {GOAL_PROGRESS_OPTIONS.map(opt => (
          <button
            key={opt.id}
            onClick={() => onLog(goal, opt)}
            title={opt.label}
            style={{
              fontSize: 16, padding: '4px 7px', borderRadius: 6,
              border: 'none', cursor: 'pointer',
              background: opt.color + '22', color: opt.color,
              fontFamily: 'inherit',
              minHeight: 30, minWidth: 30,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 120ms cubic-bezier(0.16,1,0.3,1)',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = opt.color + '40'; }}
            onMouseLeave={e => { e.currentTarget.style.background = opt.color + '22'; }}
          >
            {opt.icon}
          </button>
        ))}
      </div>
    </div>
  );
}

function StudentDashboardCard({ student, goals, logs, allLogs, onLog, onExpandFullscreen }) {
  const [expanded, setExpanded] = useState(true);
  const studentLabel = resolveLabel(student, 'compact');
  const aggregate = summarizeStudentGoals(allLogs, student, 14);
  const trend = aggregate.trend;
  const trendColor =
    trend === 'up' ? '#4ade80' : trend === 'down' ? '#f87171' : 'var(--text-muted)';

  // Pull recent supports across all logs for this student (not just goals).
  const recentSupports = goals[0]?.recentSupports || [];

  return (
    <div style={{
      borderRadius: 14,
      background: `linear-gradient(180deg, ${student.color}10, var(--bg-surface) 60%)`,
      border: `1px solid ${student.color}40`,
      overflow: 'hidden',
      boxShadow: `0 6px 24px rgba(0,0,0,0.25), 0 0 0 1px ${student.color}10`,
    }}>
      {/* Hero */}
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        style={{
          width: '100%', padding: 14,
          background: 'transparent', border: 'none', cursor: 'pointer',
          fontFamily: 'inherit', textAlign: 'left',
          display: 'flex', alignItems: 'center', gap: 14,
        }}
      >
        <Donut
          positive={aggregate.positive}
          neutral={aggregate.neutral}
          negative={aggregate.negative}
          color={student.color}
          size={84}
        />

        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{
            fontSize: 16, fontWeight: 800, color: student.color,
            letterSpacing: '-0.01em', lineHeight: 1.1,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{
              width: 12, height: 12, borderRadius: '50%',
              background: student.color,
              boxShadow: `0 0 8px ${student.color}90`,
              flexShrink: 0,
            }} />
            <PrivacyName>{studentLabel}</PrivacyName>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
                {aggregate.today}
              </div>
              <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                today
              </div>
            </div>
            <div style={{ fontSize: 11, color: trendColor, fontWeight: 700 }}>
              {trendSymbol(trend)} {trend === 'up' ? 'more this window' : trend === 'down' ? 'fewer this window' : 'steady'}
            </div>
          </div>

          {recentSupports.length > 0 && (
            <RecentSupportChips tags={recentSupports.slice(0, 4)} />
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); if (onExpandFullscreen) onExpandFullscreen(); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault(); e.stopPropagation();
                if (onExpandFullscreen) onExpandFullscreen();
              }
            }}
            title="Open fullscreen dashboard for this student"
            aria-label="Open fullscreen dashboard"
            style={{
              cursor: 'pointer',
              minWidth: 34, minHeight: 34,
              borderRadius: 8,
              border: `1px solid ${student.color}50`,
              background: `${student.color}15`,
              color: student.color,
              fontSize: 16, fontWeight: 700,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 160ms cubic-bezier(0.16,1,0.3,1)',
            }}
          >
            ⛶
          </span>
          <span style={{
            fontSize: 11, color: 'var(--text-muted)',
            padding: '4px 10px', borderRadius: 999,
            background: 'var(--bg-dark)', border: '1px solid var(--border)',
          }}>
            {goals.length} goal{goals.length === 1 ? '' : 's'} {expanded ? '▾' : '▸'}
          </span>
        </div>
      </button>

      {/* Goal mini-tiles */}
      {expanded && goals.length > 0 && (
        <div style={{
          padding: '0 12px 12px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 8,
        }}>
          {goals.map(({ goal, summary, recentSupports, suggestion }) => (
            <GoalTile
              key={goal.id}
              goal={goal}
              summary={summary}
              recentSupports={recentSupports}
              suggestion={suggestion}
              color={student.color}
              onLog={onLog}
            />
          ))}
        </div>
      )}

      {expanded && goals.length === 0 && (
        <div style={{
          padding: '0 14px 14px',
          fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic',
        }}>
          No goals on file for this student yet.
        </div>
      )}
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
  const noteRef = useRef('');
  noteRef.current = note;
  const [fullscreenStudentId, setFullscreenStudentId] = useState(null);

  if (data.length === 0) {
    return (
      <div style={{ padding: 16, color: 'var(--text-muted)', textAlign: 'center', fontSize: 12 }}>
        No students this period.
      </div>
    );
  }

  const makeOnLog = (studentId) => (goal, opt) => {
    const n = noteRef.current;
    const entry = `Goal Progress: "${goal.text.slice(0, 60)}${goal.text.length > 60 ? '…' : ''}" — ${opt.label}${n ? ' | Note: ' + n : ''}`;
    onSave(studentId, entry, 'Goal Progress', { goalId: goal.id, tags: ['goal', opt.id], source: 'goal_tracker' });
    setNote('');
  };

  // Generic onLog used by the fullscreen view (it builds its own log payloads).
  const fullscreenOnLog = (studentId, text, type, meta) => onSave(studentId, text, type, meta);

  const fullscreenEntry = fullscreenStudentId
    ? data.find(d => d.student.id === fullscreenStudentId)
    : null;

  return (
    <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {data.map(({ student, goals }) => (
        <StudentDashboardCard
          key={student.id}
          student={student}
          goals={goals}
          allLogs={logs}
          onLog={makeOnLog(student.id)}
          onExpandFullscreen={() => setFullscreenStudentId(student.id)}
        />
      ))}

      <input
        value={note}
        onChange={e => setNote(e.target.value)}
        className="chat-input"
        placeholder="Optional note for next goal tap…"
        style={{ fontSize: 11 }}
      />

      {fullscreenEntry && (
        <GoalTrackerFullscreen
          student={fullscreenEntry.student}
          goals={fullscreenEntry.goals}
          aggregate={summarizeStudentGoals(logs, fullscreenEntry.student, 14)}
          allLogs={logs}
          onLog={fullscreenOnLog}
          onClose={() => setFullscreenStudentId(null)}
        />
      )}
    </div>
  );
}
