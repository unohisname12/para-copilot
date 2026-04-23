import React, { useState } from 'react';

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
    lede: 'A classroom assistant for paraprofessionals supporting IEP students.',
    bullets: [
      'One-tap logging for behavior, academic support, and goal progress',
      'Situation → support card → recommended action pipeline',
      'Local AI (Ollama) runs on your device — nothing leaves if you don\'t sign in',
    ],
    tint: '#7a9cff',
  },
  {
    icon: '🔒',
    title: 'Privacy by design',
    lede: 'Real student names stay on your device. Always.',
    bullets: [
      'The cloud never sees a real name — only pseudonyms or Para App Numbers',
      'Your "Private Roster" JSON (with real names) lives on your computer',
      'Exports default to pseudonym-only; a separate "Export with Names" button exists for your personal gradebook',
      'You can enable "Remember on this device" to keep real names across refreshes — opt-in, with a purge button',
    ],
    tint: '#34d399',
  },
  {
    icon: '🔢',
    title: 'Para App Number',
    lede: 'A 6-digit ID the admin or Sped teacher assigns to each kid. Same number everywhere.',
    bullets: [
      'Admin adds "paraAppNumber": "847293" to each kid in the roster JSON',
      'The app uses this number as the stable identifier across every para\'s device',
      'Two paras with the same roster both know "847293" is the same kid',
      'The server only ever sees the number — never the name',
    ],
    tint: '#a78bfa',
  },
  {
    icon: '🤝',
    title: 'Team features (optional)',
    lede: 'Sign in with Google to share handoffs with other paras in real time.',
    bullets: [
      'One para creates a team. Others join with a 6-character invite code',
      'Handoffs, shared logs, and case memory stream between teammates instantly',
      'Your private notebook (non-shared logs) is backed up to the cloud, but only you can read it',
      'Skip this entirely if you just want a local app — it works offline too',
    ],
    tint: '#22d3ee',
  },
  {
    icon: '🚀',
    title: 'Getting started',
    lede: 'Three paths depending on where you are in setup.',
    bullets: [
      '📁 Have an IEP bundle JSON? → Go to IEP Import → upload it',
      '🎬 Want to explore with demo data? → Click the Load Demo button on the Dashboard',
      '☁️ Need the team demo? → Sign in with Google, create a team, share the invite code',
      '🧠 AI Copilot requires Ollama running at 127.0.0.1:11434 (optional)',
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

  return (
    <div className="modal-overlay" onClick={finish}>
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
