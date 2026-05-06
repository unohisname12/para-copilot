import React from 'react';
import PrivacyName from '../../components/PrivacyName';

// Compact "What worked before" card. Designed to sit inline under a
// quick-log row — one line of context so the para sees it without
// switching screens.
export default function PatternsCard({ patterns, studentLabel, onTry }) {
  if (!patterns) return null;
  const { successfulSupports, failedSupports, commonBehaviors } = patterns;
  const hasAnything =
    successfulSupports.length > 0 ||
    failedSupports.length > 0 ||
    commonBehaviors.length > 0;

  if (!hasAnything) {
    return (
      <div style={wrap}>
        <div style={title}>What worked before</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
          Nothing saved yet for <PrivacyName>{studentLabel || 'this student'}</PrivacyName>. Your next note
          will start building the picture.
        </div>
      </div>
    );
  }

  const topSuccess = successfulSupports.slice(0, 2);
  const topBehavior = commonBehaviors[0];
  const suggestion = topSuccess[0];

  return (
    <div style={wrap}>
      <div style={title}>
        What worked before
        <span style={meta}>
          · <PrivacyName>{studentLabel || ''}</PrivacyName>
        </span>
      </div>

      {topSuccess.length > 0 && (
        <div style={section}>
          <div style={sectionLabel}>Worked ({topSuccess.length})</div>
          <div style={chipRow}>
            {topSuccess.map(s => (
              <span key={s.label} style={chipGreen}>
                ✓ {s.label} <small style={count}>×{s.count}</small>
              </span>
            ))}
          </div>
        </div>
      )}

      {failedSupports.length > 0 && (
        <div style={section}>
          <div style={sectionLabel}>Didn't help</div>
          <div style={chipRow}>
            {failedSupports.slice(0, 2).map(s => (
              <span key={s.label} style={chipRed}>
                ✗ {s.label} <small style={count}>×{s.count}</small>
              </span>
            ))}
          </div>
        </div>
      )}

      {topBehavior && (
        <div style={{ ...section, marginBottom: suggestion ? 'var(--space-2)' : 0 }}>
          <div style={sectionLabel}>Most common</div>
          <span style={chipYellow}>{topBehavior.label} ×{topBehavior.count}</span>
        </div>
      )}

      {suggestion && (
        <div style={suggest}>
          Try: <strong style={{ color: 'var(--green)' }}>{suggestion.label}</strong>
          {onTry && (
            <button
              type="button"
              onClick={() => onTry(suggestion)}
              className="btn btn-ghost btn-sm"
              style={{ marginLeft: 'auto', fontSize: 11 }}
            >
              Use this
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── styles ──────────────────────────────────────────────────
const wrap = {
  marginTop: 'var(--space-2)',
  padding: 'var(--space-3) var(--space-4)',
  background: 'var(--bg-surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
};
const title = {
  fontSize: 10,
  fontWeight: 700,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
};
const meta = { color: 'var(--text-dim)', fontWeight: 500, textTransform: 'none', letterSpacing: 0 };
const section = { display: 'flex', flexDirection: 'column', gap: 3 };
const sectionLabel = { fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 };
const chipRow = { display: 'flex', flexWrap: 'wrap', gap: 4 };
const chipBase = {
  fontSize: 11,
  fontWeight: 600,
  padding: '3px 8px',
  borderRadius: 'var(--radius-pill)',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
};
const chipGreen  = { ...chipBase, background: 'var(--green-muted)',  color: 'var(--green)' };
const chipRed    = { ...chipBase, background: 'var(--red-muted)',    color: 'var(--red)'   };
const chipYellow = { ...chipBase, background: 'var(--yellow-muted)', color: 'var(--yellow)' };
const count = { opacity: 0.7, fontWeight: 400 };
const suggest = {
  marginTop: 2,
  fontSize: 12,
  color: 'var(--text-primary)',
  background: 'var(--bg-dark)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  padding: '6px 10px',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};
