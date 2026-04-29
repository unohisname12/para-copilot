import React, { useState } from 'react';
import { useEscape } from '../hooks/useEscape';

const SUPPORT_EMAIL = 'Sampletutoring@gmail.com';

// Sidebar button + modal. Opens the user's email client pre-filled with
// browser/app context so support tickets always have what's needed.
//
// No server-side ticketing system — keeps it simple and free. The email
// is the ticket. If volume grows, this can be replaced with a proper
// form POST without touching the call sites.

export default function BugReportButton({ collapsed = false }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState('bug');     // 'bug' | 'idea' | 'help'
  const [subject, setSubject] = useState('');
  const [details, setDetails] = useState('');
  const [whatHappened, setWhatHappened] = useState('');

  useEscape(open ? () => setOpen(false) : () => {});

  function close() {
    setOpen(false);
    setSubject(''); setDetails(''); setWhatHappened('');
  }

  function send() {
    const ua    = (typeof navigator !== 'undefined' && navigator.userAgent) || 'unknown';
    const url   = (typeof window !== 'undefined' && window.location?.href) || '';
    const when  = new Date().toISOString();
    const label = kind === 'bug' ? 'Bug' : kind === 'idea' ? 'Idea' : 'Help';

    const subjectLine = `[SupaPara ${label}] ${subject || '(no subject)'}`;
    const bodyLines = [
      whatHappened ? `What happened:\n${whatHappened}\n` : '',
      details      ? `More detail:\n${details}\n` : '',
      '──────────────',
      `Sent from: ${url}`,
      `When: ${when}`,
      `Browser: ${ua}`,
    ].filter(Boolean);

    const mailto = `mailto:${SUPPORT_EMAIL}` +
      `?subject=${encodeURIComponent(subjectLine)}` +
      `&body=${encodeURIComponent(bodyLines.join('\n'))}`;

    if (typeof window !== 'undefined') window.location.href = mailto;
    close();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="nav-btn"
        title="Report a problem or share an idea"
        style={collapsed ? { justifyContent: 'center', padding: '8px 6px' } : null}
      >
        <span style={{ fontSize: 14 }}>🛟</span>
        {!collapsed && <span style={{ marginLeft: 8 }}>Report a problem</span>}
      </button>

      {open && (
        <div className="modal-overlay">
          {/* Backdrop click intentionally does NOT close — bug-report draft
              would be lost. Use X or Esc. */}
          <div
            className="modal-content"
            style={{ maxWidth: 520, width: '100%' }}
          >
            <div className="modal-header">
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  Send to Dre
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>
                  Something broken? Got an idea?
                </div>
              </div>
              <button onClick={close} className="close-btn" aria-label="Close">×</button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {/* Kind picker */}
              <div style={{
                display: 'flex', gap: 2,
                background: 'var(--bg-dark)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: 3,
                width: 'fit-content',
              }}>
                {[
                  ['bug',  '🐞 Bug'],
                  ['idea', '💡 Idea'],
                  ['help', '❓ Need help'],
                ].map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setKind(id)}
                    style={{
                      padding: '6px 12px',
                      border: 'none',
                      borderRadius: 'var(--radius-sm)',
                      background: kind === id ? 'var(--accent-strong)' : 'transparent',
                      color: kind === id ? '#fff' : 'var(--text-secondary)',
                      fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div>
                <label style={fieldLabel}>Quick title</label>
                <input
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  placeholder={kind === 'bug' ? 'e.g. Save button not working' : kind === 'idea' ? 'e.g. Add a daily summary email' : 'e.g. How do I share with a sub'}
                  className="chat-input"
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={fieldLabel}>What happened (one or two lines)</label>
                <textarea
                  spellCheck="true" lang="en"
                  value={whatHappened}
                  onChange={e => setWhatHappened(e.target.value)}
                  placeholder={kind === 'bug' ? 'I clicked X and Y happened. Expected Z.' : kind === 'idea' ? 'It would help if...' : 'I need help with...'}
                  className="data-textarea"
                  style={{ width: '100%', minHeight: 80 }}
                />
              </div>

              <div>
                <label style={fieldLabel}>More detail (optional)</label>
                <textarea
                  spellCheck="true" lang="en"
                  value={details}
                  onChange={e => setDetails(e.target.value)}
                  placeholder="Anything else you want Dre to know"
                  className="data-textarea"
                  style={{ width: '100%', minHeight: 60 }}
                />
              </div>

              <div style={{
                fontSize: 11,
                color: 'var(--text-muted)',
                lineHeight: 1.5,
                padding: '8px 10px',
                background: 'var(--bg-surface)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
              }}>
                When you click Send, your email app opens with a message ready to go to <strong style={{ color: 'var(--text-secondary)' }}>{SUPPORT_EMAIL}</strong>. We add the page you were on + your browser so Dre can fix it faster. <strong>No student names are included.</strong>
              </div>
            </div>

            <div className="modal-footer">
              <button onClick={close} className="btn btn-ghost">Cancel</button>
              <div style={{ flex: 1 }} />
              <button
                onClick={send}
                disabled={!subject.trim() && !whatHappened.trim()}
                className="btn btn-primary"
              >
                Send to Dre
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const fieldLabel = {
  display: 'block',
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: 6,
};
