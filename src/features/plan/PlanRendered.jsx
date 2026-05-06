import React from 'react';

// Pretty-render a structured plan returned by geminiSummarizePlan().
// Shape: { topic, objectives[], vocab[], activities[], para_focus }
//
// Designed to land inside the existing Today's Plan panel body. Uses the
// same CSS variables (--accent-strong, --bg-dark, etc.) as the rest of
// the dashboard so it inherits theme + color contrast. No new colors.
export default function PlanRendered({ plan, source = 'doc' }) {
  if (!plan) return null;
  const {
    topic = '',
    objectives = [],
    vocab = [],
    activities = [],
    para_focus = '',
  } = plan;

  const sourceLabel = source === 'pdf' ? '📎 Parsed from PDF' : '📄 Parsed from doc';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--accent-hover)',
            background: 'var(--accent-muted, rgba(167,139,250,.12))',
            border: '1px solid var(--accent-border)',
            padding: '2px 8px', borderRadius: 999,
          }}
        >{sourceLabel}</span>
        <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>AI summarized</span>
      </div>

      {topic && (
        <div style={{
          fontSize: 18, fontWeight: 700, color: 'var(--text-primary)',
          lineHeight: 1.3, letterSpacing: '-0.01em',
        }}>
          {topic}
        </div>
      )}

      {para_focus && (
        <div style={{
          padding: '10px 14px',
          background: 'rgba(167,139,250,.08)',
          border: '1px solid var(--accent-border)',
          borderLeft: '3px solid var(--accent-strong)',
          borderRadius: 'var(--radius-md)',
          fontSize: 13, lineHeight: 1.55,
          color: 'var(--text-primary)',
        }}>
          <div style={{
            fontSize: 10, fontWeight: 800, letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--accent-hover)', marginBottom: 4,
          }}>👁 Para focus today</div>
          {para_focus}
        </div>
      )}

      {objectives.length > 0 && (
        <Section title="🎯 Learning objectives">
          <ul style={ulStyle}>
            {objectives.map((o, i) => (<li key={i} style={liStyle}>{o}</li>))}
          </ul>
        </Section>
      )}

      {vocab.length > 0 && (
        <Section title="📖 Key vocab">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {vocab.map((v, i) => (
              <span key={i} style={{
                fontSize: 12, fontWeight: 600,
                color: 'var(--accent-hover)',
                background: 'rgba(167,139,250,.08)',
                border: '1px solid var(--accent-border)',
                padding: '3px 10px', borderRadius: 999,
              }}>{v}</span>
            ))}
          </div>
        </Section>
      )}

      {activities.length > 0 && (
        <Section title="🧩 Activities">
          <ol style={{ ...ulStyle, paddingLeft: 22 }}>
            {activities.map((a, i) => (<li key={i} style={liStyle}>{a}</li>))}
          </ol>
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <div style={{
        fontSize: 11, fontWeight: 800, letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: 'var(--text-muted)', marginBottom: 6,
      }}>{title}</div>
      {children}
    </div>
  );
}

const ulStyle = {
  margin: 0, paddingLeft: 18,
  display: 'flex', flexDirection: 'column', gap: 4,
  color: 'var(--text-primary)', fontSize: 13.5, lineHeight: 1.5,
};
const liStyle = { paddingLeft: 2 };
