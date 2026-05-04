import React from 'react';
import { usePrivacyMode } from '../hooks/usePrivacyMode';

export default function PrivacyToggle() {
  const { on, toggle } = usePrivacyMode();
  return (
    <button
      onClick={toggle}
      title={on ? 'Privacy on — names masked while typing' : 'Privacy off — names visible'}
      aria-pressed={on}
      style={{
        background: on ? 'rgba(167,139,250,.18)' : 'transparent',
        border: '1px solid rgba(167,139,250,.4)',
        borderRadius: 8,
        color: on ? '#A78BFA' : 'var(--text-muted)',
        padding: '6px 10px',
        cursor: 'pointer',
        fontSize: 13,
        fontWeight: 600,
      }}
    >
      {on ? '🛡 Privacy ON' : '🛡 Privacy'}
    </button>
  );
}
