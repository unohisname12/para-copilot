import React, { useState } from 'react';

const RESULT_OPTIONS = [
  { value: 'worked', label: 'Worked', icon: '✅', bg: '#052e16', border: '#166534', color: '#4ade80' },
  { value: 'partly', label: 'Partly', icon: '⚡', bg: '#1a1505', border: '#854d0e', color: '#fbbf24' },
  { value: 'failed', label: "Didn't Work", icon: '❌', bg: '#1a0505', border: '#7f1d1d', color: '#f87171' },
  { value: 'unknown', label: 'Not Sure', icon: '❓', bg: '#0f172a', border: '#334155', color: '#94a3b8' },
];

export function OutcomeLogger({ intervention, incident, onSave, onSkip }) {
  const [result, setResult] = useState(null);
  const [studentResponse, setStudentResponse] = useState('');
  const [wouldRepeat, setWouldRepeat] = useState(null);

  const handleSave = () => {
    if (!result) return;
    onSave({
      interventionId: intervention.id,
      incidentId: incident.id,
      studentId: intervention.studentId,
      result,
      studentResponse,
      wouldRepeat,
    });
  };

  return (
    <div style={{ background: '#0a1628', border: '1px solid #1e293b', borderRadius: '10px', padding: '14px' }}>
      <div style={{ fontSize: '14px', fontWeight: '600', color: '#e2e8f0', marginBottom: '4px' }}>Did it work?</div>
      <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '12px' }}>
        {intervention.strategyLabel || intervention.staffNote || 'Intervention'}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '12px' }}>
        {RESULT_OPTIONS.map(opt => (
          <button key={opt.value} onClick={() => setResult(opt.value)} style={{
            padding: '10px', fontSize: '13px', fontWeight: '600', borderRadius: '8px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center',
            background: result === opt.value ? opt.bg : '#0f172a',
            border: `2px solid ${result === opt.value ? opt.border : '#1e293b'}`,
            color: result === opt.value ? opt.color : '#64748b',
          }}>
            <span>{opt.icon}</span> {opt.label}
          </button>
        ))}
      </div>

      {result && (
        <>
          <div style={{ marginBottom: '10px' }}>
            <label style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '4px' }}>What happened? (optional)</label>
            <input
              type="text" value={studentResponse} onChange={e => setStudentResponse(e.target.value)}
              placeholder="Student calmed down, returned to work..."
              style={{ width: '100%', padding: '8px', background: '#0f172a', color: '#e2e8f0', border: '1px solid #1e293b', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '4px' }}>Would you try this again?</label>
            <div style={{ display: 'flex', gap: '6px' }}>
              {[{ v: true, l: 'Yes' }, { v: false, l: 'No' }].map(opt => (
                <button key={String(opt.v)} onClick={() => setWouldRepeat(opt.v)} style={{
                  padding: '6px 16px', fontSize: '12px', borderRadius: '6px', cursor: 'pointer',
                  background: wouldRepeat === opt.v ? '#1d4ed8' : '#0f172a',
                  color: wouldRepeat === opt.v ? '#fff' : '#64748b',
                  border: `1px solid ${wouldRepeat === opt.v ? '#1d4ed8' : '#1e293b'}`,
                }}>{opt.l}</button>
              ))}
            </div>
          </div>

          <button onClick={handleSave} style={{
            width: '100%', padding: '10px', fontSize: '13px', fontWeight: '600',
            background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer',
          }}>Save Outcome</button>
        </>
      )}

      <button onClick={onSkip} style={{
        width: '100%', padding: '8px', marginTop: '6px', fontSize: '12px',
        background: 'transparent', color: '#475569', border: 'none', cursor: 'pointer',
      }}>Track outcome later</button>
    </div>
  );
}
