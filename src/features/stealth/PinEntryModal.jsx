// ── PIN entry modal ───────────────────────────────────────────
// Two modes:
//   "verify" — exit Stealth Mode. Onboarded with a single 4-digit row.
//              On success calls onSuccess(); on wrong, shake + clear.
//   "set"    — set/change the PIN. Two rows (PIN + confirm). On match,
//              writes via setPin() and calls onSuccess(pin).
//
// Also exports `PinEntryInline` — same UX, no modal chrome — for the
// onboarding slide where it lives inside the existing slide layout.

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { setPin as savePin, verifyPin, isValidPin } from './pinStorage';
import { useEscape } from '../../hooks/useEscape';

const SHAKE_KEYFRAMES_INJECTED = '__stealth_shake_kf__';
function ensureShakeKeyframes() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(SHAKE_KEYFRAMES_INJECTED)) return;
  const style = document.createElement('style');
  style.id = SHAKE_KEYFRAMES_INJECTED;
  style.textContent = `
    @keyframes stealthPinShake {
      0%, 100% { transform: translateX(0); }
      20% { transform: translateX(-6px); }
      40% { transform: translateX(6px); }
      60% { transform: translateX(-4px); }
      80% { transform: translateX(4px); }
    }
  `;
  document.head.appendChild(style);
}

// One row of 4 digits with auto-advance + backspace-back. Fully controlled.
// Returns the assembled string via onChange. Calls onComplete when 4 entered.
export function PinDigitRow({ value, onChange, onComplete, autoFocus = false, shake = false, ariaLabel }) {
  const refs = [useRef(), useRef(), useRef(), useRef()];
  const digits = [0, 1, 2, 3].map(i => value[i] || '');

  useEffect(() => {
    if (autoFocus && refs[0].current) refs[0].current.focus();
  }, [autoFocus]); // refs are stable; intentionally not in deps

  useEffect(() => {
    ensureShakeKeyframes();
  }, []);

  const handleInput = (i, raw) => {
    const ch = (raw || '').replace(/\D/g, '').slice(-1);
    const next = digits.slice();
    next[i] = ch;
    const joined = next.join('');
    onChange(joined);
    if (ch && i < 3) refs[i + 1].current?.focus();
    if (i === 3 && ch && joined.length === 4) {
      // Defer so the controlled value updates first.
      setTimeout(() => onComplete && onComplete(joined), 0);
    }
  };

  const handleKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      refs[i - 1].current?.focus();
      const next = digits.slice();
      next[i - 1] = '';
      onChange(next.join(''));
      e.preventDefault();
    }
    if (e.key === 'ArrowLeft' && i > 0) refs[i - 1].current?.focus();
    if (e.key === 'ArrowRight' && i < 3) refs[i + 1].current?.focus();
  };

  return (
    <div
      role="group"
      aria-label={ariaLabel || '4-digit PIN'}
      style={{
        display: 'flex', gap: 10, justifyContent: 'center',
        animation: shake ? 'stealthPinShake 320ms cubic-bezier(0.36,0.07,0.19,0.97)' : 'none',
      }}
    >
      {[0, 1, 2, 3].map(i => (
        <input
          key={i}
          ref={refs[i]}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={1}
          value={digits[i]}
          onChange={e => handleInput(i, e.target.value)}
          onKeyDown={e => handleKeyDown(i, e)}
          aria-label={`PIN digit ${i + 1}`}
          style={{
            width: 56, height: 64,
            fontSize: 28, fontWeight: 700,
            textAlign: 'center',
            background: 'var(--bg-dark)',
            border: `1px solid ${digits[i] ? 'var(--accent-border)' : 'var(--border)'}`,
            borderRadius: 10,
            color: 'var(--text-primary)',
            fontFamily: 'JetBrains Mono, monospace',
            outline: 'none',
            transition: 'border-color 120ms',
          }}
          onFocus={e => { e.target.select(); }}
        />
      ))}
    </div>
  );
}

// Inline (no modal chrome) — for embedding in the onboarding slide.
export function PinEntryInline({ mode = 'set', onSuccess, onSkip }) {
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [shake, setShake] = useState(false);
  const [err, setErr] = useState('');

  const handlePinComplete = useCallback(async (val) => {
    if (mode === 'set') {
      // wait for confirm; nothing to do yet
      return;
    }
    const ok = await verifyPin(val);
    if (ok) onSuccess && onSuccess(val);
    else { setShake(true); setErr('Wrong code, try again.'); setTimeout(() => { setPin(''); setShake(false); }, 320); }
  }, [mode, onSuccess]);

  const handleConfirmComplete = useCallback(async (val) => {
    if (!isValidPin(pin)) { setErr('Enter your 4-digit code first.'); return; }
    if (val !== pin) {
      setShake(true);
      setErr('Codes don\'t match. Try again.');
      setTimeout(() => { setConfirm(''); setShake(false); }, 320);
      return;
    }
    const saved = await savePin(pin);
    if (saved) {
      setErr('');
      onSuccess && onSuccess(pin);
    } else {
      setErr('Could not save the PIN — try again.');
    }
  }, [pin, onSuccess]);

  if (mode === 'set') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Pick a 4-digit code
          </div>
          <PinDigitRow value={pin} onChange={setPin} autoFocus shake={shake && !confirm} ariaLabel="New PIN" />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Type it again to confirm
          </div>
          <PinDigitRow
            value={confirm}
            onChange={setConfirm}
            onComplete={handleConfirmComplete}
            shake={shake}
            ariaLabel="Confirm PIN"
          />
        </div>
        {err && <div role="alert" style={{ fontSize: 12, color: 'var(--red)', fontWeight: 600 }}>{err}</div>}
        {onSkip && (
          <button
            type="button"
            onClick={onSkip}
            className="btn btn-ghost btn-sm"
            style={{ fontSize: 11, color: 'var(--text-muted)' }}
          >
            Skip for now (set it later in Settings)
          </button>
        )}
      </div>
    );
  }

  // verify-mode inline
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
      <PinDigitRow value={pin} onChange={setPin} onComplete={handlePinComplete} autoFocus shake={shake} ariaLabel="Enter PIN" />
      {err && <div role="alert" style={{ fontSize: 12, color: 'var(--red)', fontWeight: 600 }}>{err}</div>}
    </div>
  );
}

// Modal wrapper — verify-mode (exit Stealth) and set-mode (Settings).
export function PinEntryModal({ mode = 'verify', title, subtitle, onSuccess, onCancel }) {
  useEscape(() => onCancel && onCancel());
  const defaultTitle = mode === 'verify' ? 'Enter your code to exit' : 'Set your stealth code';
  const defaultSubtitle = mode === 'verify'
    ? 'Type the 4-digit code you set so we can return to the app.'
    : 'Pick a 4-digit code. You\'ll type this whenever you exit Stealth Mode.';
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title || defaultTitle}
      onClick={onCancel}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(2, 6, 23, 0.92)',
        backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="card-elevated"
        style={{
          maxWidth: 420, width: '100%',
          padding: 'var(--space-6)',
          display: 'flex', flexDirection: 'column', gap: 'var(--space-4)',
          alignItems: 'center', textAlign: 'center',
        }}
      >
        <div style={{
          width: 56, height: 56,
          borderRadius: 'var(--radius-xl)',
          background: 'linear-gradient(135deg, var(--yellow), var(--orange))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 26,
        }}>
          🔒
        </div>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>
            {title || defaultTitle}
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            {subtitle || defaultSubtitle}
          </p>
        </div>
        <PinEntryInline mode={mode} onSuccess={onSuccess} />
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="btn btn-ghost btn-sm"
            style={{ fontSize: 12, color: 'var(--text-muted)' }}
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
