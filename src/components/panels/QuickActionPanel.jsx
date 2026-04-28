// ── Quick Action Panel — grouped, Chromebook-friendly redesign ─
// Tap an action row → student chips slide in below that action only.
// Tap a student chip → log fires + brief "Logged for [name]" feedback.
// 5 always-expanded category sections so paras can scan + tap fast.
import React, { useState, useRef, useEffect } from "react";
import { QUICK_ACTIONS } from '../../data';
import { resolveLabel } from '../../privacy/nameResolver';
import { buildQuickActionGroups } from './quickActionGroups';
import { ClarifierModal, hasClarifier, resolveClarifierLog } from '../modals/ClarifierModal';

export function QuickActionPanel({ students, onLog, studentsMap }) {
  const lookup = studentsMap || {};
  const [pickingFor, setPickingFor] = useState(null); // action.id | null
  const [recentLog, setRecentLog] = useState(null);   // { actionId, studentLabel } | null
  const [clarifying, setClarifying] = useState(null); // { action, studentId } | null
  const recentTimer = useRef();

  const groups = buildQuickActionGroups(QUICK_ACTIONS);
  const studentList = (students || []).filter(id => lookup[id]);

  useEffect(() => () => clearTimeout(recentTimer.current), []);

  const completeLog = (action, studentId, note, tags) => {
    onLog(studentId, note, action.logType, {
      source: 'quick_action',
      tags,
    });
    const studentLabel = resolveLabel(lookup[studentId], 'compact');
    setRecentLog({ actionId: action.id, studentLabel });
    setPickingFor(null);
    clearTimeout(recentTimer.current);
    recentTimer.current = setTimeout(
      () => setRecentLog(r => (r?.actionId === action.id ? null : r)),
      1500
    );
  };

  const fireLog = (action, studentId) => {
    if (hasClarifier(action.id)) {
      setClarifying({ action, studentId });
      return;
    }
    completeLog(action, studentId, action.defaultNote, action.tags);
  };

  const handleClarifierPick = (variantId) => {
    if (!clarifying) return;
    const { action, studentId } = clarifying;
    const { note, tags } = resolveClarifierLog(action, variantId);
    completeLog(action, studentId, note, tags);
    setClarifying(null);
  };

  if (studentList.length === 0) {
    return (
      <div style={{ padding: 16, color: 'var(--text-muted)', textAlign: 'center', fontSize: 12 }}>
        No students this period.
      </div>
    );
  }

  return (
    <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {clarifying && (
        <ClarifierModal
          action={clarifying.action}
          studentLabel={resolveLabel(lookup[clarifying.studentId], 'compact')}
          onPick={handleClarifierPick}
          onCancel={() => setClarifying(null)}
        />
      )}
      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
        Tap an action, then tap the student.
      </div>

      {groups.map(group => (
        <div key={group.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{
            fontSize: 10, fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.1em',
            color: group.color,
            padding: '0 2px',
          }}>
            {group.label}
          </div>
          {group.actions.map(action => {
            const isPicking = pickingFor === action.id;
            const isRecent = recentLog?.actionId === action.id;
            return (
              <div key={action.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <button
                  type="button"
                  onClick={() => setPickingFor(p => p === action.id ? null : action.id)}
                  style={{
                    minHeight: 44,
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: `1px solid ${isPicking ? 'var(--accent-border)' : 'var(--border)'}`,
                    background: isPicking ? 'var(--accent-glow)' : 'var(--bg-surface)',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
                    textAlign: 'left',
                    width: '100%',
                  }}
                >
                  <span style={{ fontSize: 18, lineHeight: 1 }}>{action.icon}</span>
                  <span style={{ flex: 1 }}>{action.label}</span>
                  {isRecent ? (
                    <span style={{
                      fontSize: 10, color: 'var(--green)', fontWeight: 700,
                      whiteSpace: 'nowrap',
                    }}>
                      ✓ Logged for {recentLog.studentLabel}
                    </span>
                  ) : (
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {isPicking ? 'pick a student ▾' : 'tap to pick student ▸'}
                    </span>
                  )}
                </button>

                {isPicking && (
                  <div style={{
                    display: 'flex', flexWrap: 'wrap', gap: 6,
                    padding: '4px 8px 8px 22px',
                  }}>
                    {studentList.map(id => {
                      const s = lookup[id];
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => fireLog(action, id)}
                          style={{
                            minHeight: 36,
                            padding: '6px 12px',
                            borderRadius: 'var(--radius-sm)',
                            border: `1px solid ${s.color}50`,
                            background: `${s.color}15`,
                            color: s.color,
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                            fontSize: 12, fontWeight: 600,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {resolveLabel(s, 'compact')}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
