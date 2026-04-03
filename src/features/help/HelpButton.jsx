import React, { useState } from 'react';
import { HelpPanel } from './HelpPanel';

export function HelpButton({
  student, allStudents,
  incidents, interventions, outcomes,
  addIncident, addIntervention, addOutcome, addLog,
  currentDate, activePeriod,
  lastChatMessage,
}) {
  const [open, setOpen] = useState(false);

  // Count open incidents for current period as badge
  const openCount = incidents.filter(i => i.status === 'open' && i.periodId === activePeriod).length;

  if (!student) return null;

  return (
    <>
      {/* FAB */}
      <button
        onClick={() => setOpen(true)}
        title="Help — What worked before?"
        style={{
          position: 'fixed', bottom: '24px', right: '24px', zIndex: 1250,
          width: '56px', height: '56px', borderRadius: '50%',
          background: 'linear-gradient(135deg, #1d4ed8, #3b82f6)',
          color: '#fff', border: 'none', cursor: 'pointer',
          fontSize: '22px', fontWeight: '700',
          boxShadow: '0 4px 20px rgba(29,78,216,0.4), 0 0 0 3px rgba(59,130,246,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'transform 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.08)'}
        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
      >
        ?
        {openCount > 0 && (
          <span style={{
            position: 'absolute', top: '-4px', right: '-4px',
            background: '#ef4444', color: '#fff', fontSize: '10px', fontWeight: '700',
            width: '18px', height: '18px', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{openCount}</span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <HelpPanel
          student={student}
          allStudents={allStudents}
          incidents={incidents}
          interventions={interventions}
          outcomes={outcomes}
          addIncident={addIncident}
          addIntervention={addIntervention}
          addOutcome={addOutcome}
          addLog={addLog}
          currentDate={currentDate}
          activePeriod={activePeriod}
          initialDescription={lastChatMessage || ''}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
