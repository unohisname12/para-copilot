import React, { useState } from 'react';
import { useTeam } from '../context/TeamProvider';
import TeamOnboardingModal from './TeamOnboardingModal';

export default function TeamSwitcher() {
  const { teams, activeTeam, setActiveTeamId, signOut } = useTeam();
  const [onboardingOpen, setOnboardingOpen] = useState(false);

  if (!activeTeam) return null;

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {teams.length > 1 ? (
          <select value={activeTeam.id} onChange={(e) => setActiveTeamId(e.target.value)} style={selectStyle}>
            {teams.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
          </select>
        ) : (
          <span style={{ opacity: 0.85, fontSize: 13 }}>{activeTeam.name}</span>
        )}
        <span style={codeStyle} title="Team invite code">{activeTeam.inviteCode}</span>
        <button type="button" onClick={() => setOnboardingOpen(true)} style={smallBtnStyle}>
          + Join / Create
        </button>
        <button type="button" onClick={signOut} style={smallBtnStyle}>Sign out</button>
      </div>
      {onboardingOpen && <TeamOnboardingModal onClose={() => setOnboardingOpen(false)} />}
    </>
  );
}

const selectStyle = {
  background: 'transparent', color: 'white',
  border: '1px solid var(--border, #1c2d4a)', borderRadius: 6, padding: '4px 8px',
};
const codeStyle = {
  fontFamily: 'JetBrains Mono, monospace', letterSpacing: 2, fontSize: 12,
  padding: '4px 8px', background: 'rgba(255,255,255,0.05)', borderRadius: 4,
};
const smallBtnStyle = {
  padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border, #1c2d4a)',
  background: 'transparent', color: 'white', fontSize: 12, cursor: 'pointer',
};
