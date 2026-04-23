import React, { useState } from 'react';
import { useTeam } from '../context/TeamProvider';
import TeamOnboardingModal from './TeamOnboardingModal';

export default function TeamSwitcher() {
  const { teams, activeTeam, setActiveTeamId, signOut } = useTeam();
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!activeTeam) return null;

  function copyCode() {
    navigator.clipboard.writeText(activeTeam.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {teams.length > 1 ? (
          <select
            value={activeTeam.id}
            onChange={(e) => setActiveTeamId(e.target.value)}
            className="period-select"
            style={{ fontSize: 12, minHeight: 32, padding: '4px 8px' }}
          >
            {teams.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
          </select>
        ) : (
          <span style={{ color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600 }}>
            {activeTeam.name}
          </span>
        )}
        <button
          type="button"
          onClick={copyCode}
          title={copied ? 'Copied!' : 'Click to copy invite code'}
          style={{
            fontFamily: 'JetBrains Mono, monospace',
            letterSpacing: 2,
            fontSize: 11,
            fontWeight: 700,
            padding: '4px 10px',
            background: copied ? 'var(--green-muted)' : 'var(--accent-glow)',
            color: copied ? 'var(--green)' : 'var(--accent-hover)',
            border: `1px solid ${copied ? 'rgba(52,211,153,0.4)' : 'var(--accent-border)'}`,
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
            transition: 'all 120ms cubic-bezier(0.16,1,0.3,1)',
          }}
        >
          {copied ? '✓ Copied' : activeTeam.inviteCode}
        </button>
        <button
          type="button"
          onClick={() => setOnboardingOpen(true)}
          className="btn btn-ghost btn-sm"
          style={{ fontSize: 11 }}
        >
          + Team
        </button>
        <button
          type="button"
          onClick={signOut}
          className="btn btn-ghost btn-sm"
          style={{ fontSize: 11 }}
        >
          Sign out
        </button>
      </div>
      {onboardingOpen && <TeamOnboardingModal onClose={() => setOnboardingOpen(false)} />}
    </>
  );
}
