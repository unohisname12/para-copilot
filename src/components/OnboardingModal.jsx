import React, { useState } from 'react';
import { useEscape } from '../hooks/useEscape';

// First-run onboarding. Re-openable from the sidebar "?" button any time.
// Dismissal is stored in localStorage under a non-sensitive key — only a
// "has seen onboarding" flag, never any student data.

export const ONBOARDING_KEY = 'supapara_onboarded_v1';

export function hasSeenOnboarding() {
  try { return localStorage.getItem(ONBOARDING_KEY) === '1'; }
  catch { return false; }
}

export function markOnboarded() {
  try { localStorage.setItem(ONBOARDING_KEY, '1'); } catch {}
}

const SLIDES = [
  {
    icon: '👋',
    title: 'Welcome to SupaPara',
    lede: 'A classroom helper for paraprofessionals who support students with IEPs.',
    bullets: [
      'One-tap logging for behavior, academic help, goals, and more',
      'Pick a situation → get a ready-made response card with what to say and do',
      'Works offline. You don\'t have to sign in to use it.',
    ],
    tint: '#7a9cff',
  },
  {
    icon: '🔒',
    title: 'Your students\' privacy comes first',
    lede: 'Real student names stay on your computer. Always.',
    bullets: [
      'Anything shared online only uses each kid\'s 6-digit Para App Number — never their real name',
      'Your name list (with real names) sits in a file on your own computer',
      'Exports use nicknames by default. A separate "Export with Names" button exists for your private gradebook',
      'You can turn on "Remember on this device" so real names stick around after you close the browser — off by default, easy to wipe',
    ],
    tint: '#34d399',
  },
  {
    icon: '🔢',
    title: 'Para App Number',
    lede: 'A 6-digit number the admin or Special Ed Teacher gives each kid. Same number everywhere.',
    bullets: [
      'Admin puts each student\'s name + a 6-digit number (like 847293) in the name list',
      'The app uses that number to know which kid is which, without ever using their real name in the cloud',
      'Two paras with the same list both see "847293" as the same kid',
      'Only the number leaves the device — the name stays local',
    ],
    tint: '#a78bfa',
  },
  {
    icon: '🤝',
    title: 'Team mode (optional)',
    lede: 'Sign in with Google to share notes and handoffs with other paras on your team live.',
    bullets: [
      'One person creates a team. Others join with a 6-letter invite code',
      'Handoffs and shared notes show up on teammates\' screens within seconds',
      'Your personal notes (the ones you don\'t share) are backed up but only you can see them',
      'Not a team? Skip this. The app still works great on its own.',
    ],
    tint: '#22d3ee',
  },
  {
    icon: '🚀',
    title: 'How to start',
    lede: 'Pick whichever one matches what you have in front of you.',
    bullets: [
      '📁 Got a file from your admin? → Go to IEP Import → pick the Smart Import box',
      '🎬 Just want to try it out? → Hit "Load Demo" on the Dashboard',
      '☁️ Working with a team? → Sign in with Google, create a team, share the invite code',
      '🧠 AI Copilot is optional — works if you have local AI running, otherwise the app still does everything else',
    ],
    tint: '#fbbf24',
  },
];

export default function OnboardingModal({ onClose }) {
  const [i, setI] = useState(0);
  const last = i === SLIDES.length - 1;
  const slide = SLIDES[i];

  function finish() {
    markOnboarded();
    if (onClose) onClose();
  }
  // Esc + backdrop click only close — they don't mark onboarding "seen forever".
  // Only Skip and Get-started commit that, so a misclick is reversible.
  function dismissWithoutMarking() {
    if (onClose) onClose();
  }
  useEscape(dismissWithoutMarking);

  return (
    <div className="modal-overlay" onClick={dismissWithoutMarking}>
      <div
        className="modal-content"
        style={{ maxWidth: 560, width: '100%' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Accent bar tinted by current slide */}
        <div style={{
          height: 3,
          background: `linear-gradient(90deg, ${slide.tint}, var(--violet))`,
        }} />

        <div className="modal-body" style={{ padding: 'var(--space-6)' }}>
          {/* Icon tile */}
          <div style={{
            width: 72, height: 72,
            borderRadius: 'var(--radius-xl)',
            background: `linear-gradient(135deg, ${slide.tint}, var(--violet))`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 36,
            marginBottom: 'var(--space-5)',
            boxShadow: `0 8px 28px ${slide.tint}40`,
          }}>
            {slide.icon}
          </div>

          <div style={{
            fontSize: 11, fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.12em',
            color: 'var(--text-muted)',
            marginBottom: 'var(--space-1)',
          }}>
            Step {i + 1} of {SLIDES.length}
          </div>

          <h2 style={{
            fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em',
            color: 'var(--text-primary)',
            marginBottom: 'var(--space-2)',
          }}>
            {slide.title}
          </h2>

          <p style={{
            fontSize: 15, color: 'var(--text-secondary)',
            lineHeight: 1.55, marginBottom: 'var(--space-5)',
          }}>
            {slide.lede}
          </p>

          <ul style={{
            listStyle: 'none',
            display: 'flex', flexDirection: 'column', gap: 'var(--space-2)',
            marginBottom: 'var(--space-6)',
          }}>
            {slide.bullets.map((b, idx) => (
              <li key={idx} style={{
                display: 'flex', gap: 'var(--space-2)',
                alignItems: 'flex-start',
                fontSize: 13.5, color: 'var(--text-primary)',
                lineHeight: 1.55,
                padding: 'var(--space-2) var(--space-3)',
                background: 'var(--bg-dark)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
              }}>
                <span style={{ color: slide.tint, fontWeight: 700, flexShrink: 0 }}>•</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>

          {/* Progress dots */}
          <div style={{
            display: 'flex', justifyContent: 'center',
            gap: 6, marginBottom: 'var(--space-5)',
          }}>
            {SLIDES.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setI(idx)}
                aria-label={`Go to slide ${idx + 1}`}
                style={{
                  width: idx === i ? 24 : 8, height: 8,
                  borderRadius: 4,
                  background: idx === i ? slide.tint : 'var(--border-light)',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 200ms cubic-bezier(0.16,1,0.3,1)',
                  padding: 0,
                }}
              />
            ))}
          </div>

          {/* Navigation */}
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            {i > 0 && (
              <button
                type="button"
                onClick={() => setI(i - 1)}
                className="btn btn-secondary"
                style={{ flex: 0 }}
              >
                ← Back
              </button>
            )}
            <button
              type="button"
              onClick={finish}
              className="btn btn-ghost"
              style={{ flex: i > 0 ? 0 : 1 }}
            >
              Skip
            </button>
            <button
              type="button"
              onClick={() => last ? finish() : setI(i + 1)}
              className="btn btn-primary"
              style={{ flex: 1 }}
            >
              {last ? 'Get started →' : 'Next →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
