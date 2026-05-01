import React from 'react';
import { resolveLabel } from '../../privacy/nameResolver';

const OPTIONS = [
  { value: 'worked', label: 'Helped', detail: 'Student moved in the right direction.' },
  { value: 'failed', label: 'Got worse', detail: 'The support did not help this time.' },
  { value: 'partly', label: 'No change yet', detail: 'Keep watching and ask again later.' },
  { value: 'unknown', label: 'Not sure', detail: 'Save what you know.' },
];

export function FollowUpPrompt({ followUp, student, incident, intervention, onAnswer, onSnooze, onDismiss }) {
  const [details, setDetails] = React.useState('');
  if (!followUp) return null;

  const needsIntervention = followUp.needsIntervention || !intervention;
  const studentLabel = student ? resolveLabel(student, 'compact') : 'this student';
  const tried = intervention?.strategyLabel || intervention?.staffNote || 'what you tried';

  const saveIntervention = () => {
    const staffNote = details.trim();
    if (!staffNote) {
      onSnooze(followUp.id, 5);
      return;
    }
    onAnswer(followUp, { kind: 'intervention', staffNote });
  };

  const handleAnswer = (result) => {
    if (result === 'partly' && !details.trim()) {
      onSnooze(followUp.id, 15);
      return;
    }
    onAnswer(followUp, {
      result,
      studentResponse: details.trim(),
      wouldRepeat: result === 'worked' ? true : result === 'failed' ? false : null,
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Follow-up check-in"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9400,
        background: 'var(--bg-dark)',
        borderTop: '2px solid var(--accent)',
        boxShadow: 'var(--shadow-lg)',
        borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0',
        maxHeight: '72vh',
        overflow: 'auto',
      }}
    >
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '18px 20px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>
              Follow-up check-in
            </div>
            <h2 style={{ margin: '4px 0 0', fontSize: 20, color: 'var(--text-primary)', letterSpacing: 0 }}>
              {needsIntervention ? 'What did you try?' : 'What happened after?'}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => onDismiss(followUp.id)}
            aria-label="Dismiss follow-up"
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        <div style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.5, marginBottom: 14 }}>
          <strong style={{ color: 'var(--text-primary)' }}>{studentLabel}</strong>
          {' '}had this note: {incident?.description || 'a saved note'}.
          <br />
          {needsIntervention ? (
            <>Add the support you tried. Then I will ask what happened after.</>
          ) : (
            <>You tried: <strong style={{ color: 'var(--accent-hover)' }}>{tried}</strong>.</>
          )}
        </div>

        {needsIntervention ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            {['Gave space', 'Offered break', 'Used calm voice', 'Reduced task', 'Called for help'].map(label => (
              <button
                key={label}
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setDetails(label)}
              >
                {label}
              </button>
            ))}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginBottom: 12 }}>
            {OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleAnswer(opt.value)}
                style={{
                  minHeight: 52,
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border)',
                  background: 'var(--panel-bg)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: 'inherit',
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 800 }}>{opt.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{opt.detail}</div>
              </button>
            ))}
          </div>
        )}

        <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, marginBottom: 5 }}>
          Details optional
        </label>
        <textarea
          value={details}
          onChange={e => setDetails(e.target.value)}
          rows={3}
          spellCheck="true"
          lang="en"
          placeholder={needsIntervention ? 'What did you try?' : 'Add details if you have them.'}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            resize: 'vertical',
            padding: 10,
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)',
            background: 'var(--bg-surface)',
            color: 'var(--text-primary)',
            fontFamily: 'inherit',
            fontSize: 13,
          }}
        />

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 12 }}>
          <button type="button" className="btn btn-ghost" onClick={() => onSnooze(followUp.id, needsIntervention ? 5 : 15)}>
            Ask me later
          </button>
          {needsIntervention ? (
            <button type="button" className="btn btn-action" onClick={saveIntervention}>
              Save what I tried
            </button>
          ) : (
            <button type="button" className="btn btn-secondary" onClick={() => handleAnswer('unknown')}>
              Save without details
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
