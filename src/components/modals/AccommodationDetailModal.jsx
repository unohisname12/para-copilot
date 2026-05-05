import React from 'react';
import { useEscape } from '../../hooks/useEscape';
import { lookupAccommodation } from '../../data/accommodationGlossary';

const STUDENT_DEFAULT_COLOR = '#A78BFA';

function Section({ icon, label, color, children, accent }) {
  return (
    <section
      style={{
        background: accent ? `${color}10` : 'rgba(0,0,0,.22)',
        border: `1px solid ${accent ? color + '40' : 'rgba(255,255,255,.06)'}`,
        borderLeft: `4px solid ${color}`,
        borderRadius: 10,
        padding: '14px 16px',
        marginBottom: 14,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 8,
          fontSize: 11,
          fontWeight: 800,
          textTransform: 'uppercase',
          letterSpacing: '.09em',
          color,
        }}
      >
        <span style={{ fontSize: 14 }}>{icon}</span>
        {label}
      </div>
      {children}
    </section>
  );
}

export default function AccommodationDetailModal({ open, onClose, accommodation, student, logs = [], strategies = [] }) {
  useEscape(open ? onClose : () => {});
  if (!open || !accommodation) return null;

  const text = typeof accommodation === 'string' ? accommodation : (accommodation.text || '');
  const sourceFile = student?.iepImport?.fileName || student?.importMeta?.fileName || null;
  const sourceDate = student?.iepImport?.date || student?.importMeta?.date || null;
  const studentColor = student?.color || STUDENT_DEFAULT_COLOR;
  const studentName = student?.pseudonym || student?.realName || null;

  const glossary = lookupAccommodation(text);

  const snippet = text.toLowerCase().slice(0, 25);
  const linkedStrategies = (strategies || []).filter(s => {
    const st = (typeof s === 'string' ? s : (s.text || '')).toLowerCase();
    return snippet && st && st.includes(snippet);
  });
  const linkedLogs = (logs || []).filter(l => {
    const note = (l.note || l.text || '').toLowerCase();
    return snippet && note && note.includes(snippet);
  });

  return (
    <div className="modal-overlay" style={{ alignItems: 'flex-start', overflowY: 'auto', padding: '40px 16px' }}>
      <div
        className="modal-content"
        style={{
          maxWidth: 680,
          width: '100%',
          padding: 0,
          overflow: 'hidden',
          borderRadius: 14,
          boxShadow: '0 24px 60px rgba(0,0,0,.45)',
        }}
      >
        {/* Header — color bar + title + close */}
        <div
          style={{
            background: `linear-gradient(135deg, ${studentColor}28 0%, ${studentColor}08 60%, transparent 100%)`,
            borderBottom: `1px solid ${studentColor}30`,
            padding: '18px 22px 16px',
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: 3,
              background: studentColor, opacity: 0.95,
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontSize: 10,
                  textTransform: 'uppercase',
                  letterSpacing: '.12em',
                  color: 'var(--text-muted)',
                  fontWeight: 700,
                  marginBottom: 4,
                }}
              >
                {studentName ? `${studentName} · IEP accommodation` : 'IEP accommodation'}
              </div>
              <h2
                style={{
                  margin: 0,
                  fontSize: 20,
                  fontWeight: 800,
                  letterSpacing: '-0.01em',
                  color: studentColor,
                }}
              >
                {glossary?.title || 'Accommodation detail'}
              </h2>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              style={{
                background: 'rgba(255,255,255,.06)',
                border: '1px solid rgba(255,255,255,.1)',
                color: 'var(--text-primary)',
                fontSize: 16,
                lineHeight: 1,
                width: 32,
                height: 32,
                borderRadius: 8,
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >×</button>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '18px 22px 22px' }}>
          <Section icon="📄" label="From the IEP" color="#94A3B8">
            <div style={{ fontSize: 14.5, lineHeight: 1.55, color: 'var(--text-primary)' }}>{text}</div>
          </Section>

          {glossary ? (
            <>
              <Section icon="💡" label="What this means" color="#A78BFA" accent>
                <div style={{ fontSize: 14.5, lineHeight: 1.6, color: 'var(--text-primary)' }}>{glossary.plain}</div>
              </Section>

              <Section icon="✅" label="What it looks like in class" color="#22C55E" accent>
                <ul style={{ margin: 0, paddingLeft: 18, listStyle: 'none' }}>
                  {glossary.looksLike.map((tip, i) => (
                    <li
                      key={i}
                      style={{
                        fontSize: 13.5,
                        lineHeight: 1.6,
                        marginBottom: 8,
                        position: 'relative',
                        paddingLeft: 18,
                      }}
                    >
                      <span
                        style={{
                          position: 'absolute',
                          left: 0,
                          top: 4,
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: '#22C55E',
                          opacity: 0.85,
                        }}
                      />
                      {tip}
                    </li>
                  ))}
                </ul>
              </Section>

              {glossary.watchOut && (
                <Section icon="⚠" label="Watch out" color="#F87171" accent>
                  <div style={{ fontSize: 13.5, lineHeight: 1.6, color: '#FCA5A5' }}>{glossary.watchOut}</div>
                </Section>
              )}
            </>
          ) : (
            <Section icon="❓" label="No quick explainer" color="#94A3B8">
              <div style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                We don't have a glossary entry for this one yet. Ask the case manager or sped teacher what it should look like in your room — then add it to the team's shared notes so the next para has a head start.
              </div>
            </Section>
          )}

          {(sourceFile || sourceDate) && (
            <div
              style={{
                fontSize: 11.5,
                color: 'var(--text-muted)',
                marginBottom: 16,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                flexWrap: 'wrap',
              }}
            >
              <span style={{ textTransform: 'uppercase', letterSpacing: '.1em', fontWeight: 700 }}>Source</span>
              {sourceFile && <span style={{ color: 'var(--text-secondary)' }}>{sourceFile}</span>}
              {sourceDate && <span>· {sourceDate}</span>}
            </div>
          )}

          <Section icon="🧰" label={`Linked strategies (${linkedStrategies.length})`} color="#60A5FA">
            {linkedStrategies.length === 0 ? (
              <div style={{ fontSize: 12.5, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                No strategies in this student's profile match this accommodation text yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {linkedStrategies.map((s, i) => (
                  <div
                    key={i}
                    style={{
                      fontSize: 13,
                      lineHeight: 1.5,
                      padding: '8px 10px',
                      background: 'rgba(96,165,250,.08)',
                      border: '1px solid rgba(96,165,250,.18)',
                      borderRadius: 6,
                    }}
                  >{typeof s === 'string' ? s : s.text}</div>
                ))}
              </div>
            )}
          </Section>

          <Section icon="🗂" label={`Past logs that referenced it (${linkedLogs.length})`} color="#FBBF24">
            {linkedLogs.length === 0 ? (
              <div style={{ fontSize: 12.5, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                No past logs reference this accommodation. Once you start tagging it in observations, they'll show up here.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 240, overflowY: 'auto' }}>
                {linkedLogs.slice(0, 20).map(l => (
                  <div
                    key={l.id}
                    style={{
                      fontSize: 12.5,
                      lineHeight: 1.5,
                      padding: '8px 10px',
                      background: 'rgba(251,191,36,.06)',
                      border: '1px solid rgba(251,191,36,.18)',
                      borderRadius: 6,
                    }}
                  >
                    <div style={{ fontSize: 10.5, color: '#FBBF24', fontWeight: 700, marginBottom: 2 }}>{l.date}</div>
                    <div style={{ color: 'var(--text-primary)' }}>{l.note || l.text}</div>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}
