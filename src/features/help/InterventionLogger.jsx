import React, { useState } from 'react';
import { STRATEGIES } from '../../data';

export function InterventionLogger({ student, incident, onSave, onCancel, prefill }) {
  const [strategyLabel, setStrategyLabel] = useState(prefill?.strategyLabel || '');
  const [staffNote, setStaffNote] = useState(prefill?.staffNote || '');
  const [selectedAccs, setSelectedAccs] = useState(prefill?.accommodationUsed || []);
  const [strategyId, setStrategyId] = useState(prefill?.strategyId || '');

  const studentStrategies = (student?.strategies || []).map(s => ({ id: null, label: s }));
  const allStrategies = [
    ...studentStrategies,
    ...STRATEGIES.map(s => ({ id: s.id, label: s.title })),
  ];
  const studentAccs = student?.accs || [];

  const toggleAcc = (acc) => {
    setSelectedAccs(prev => prev.includes(acc) ? prev.filter(a => a !== acc) : [...prev, acc]);
  };

  const handleSave = () => {
    if (!strategyLabel && !staffNote) return;
    onSave({
      incidentId: incident.id,
      studentId: student.id,
      strategyId: strategyId || null,
      strategyLabel,
      accommodationUsed: selectedAccs,
      staffNote,
      source: prefill ? 'help_suggestion' : 'manual',
    });
  };

  return (
    <div style={{ background: '#0a1628', border: '1px solid #1e293b', borderRadius: '10px', padding: '14px' }}>
      <div style={{ fontSize: '14px', fontWeight: '600', color: '#e2e8f0', marginBottom: '12px' }}>What did you try?</div>

      <div style={{ marginBottom: '10px' }}>
        <label style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '4px' }}>Strategy</label>
        <select
          value={strategyLabel}
          onChange={e => {
            const val = e.target.value;
            setStrategyLabel(val);
            const match = allStrategies.find(s => s.label === val);
            setStrategyId(match?.id || '');
          }}
          style={{ width: '100%', padding: '8px', background: '#0f172a', color: '#e2e8f0', border: '1px solid #1e293b', borderRadius: '6px', fontSize: '13px' }}
        >
          <option value="">Select or type below...</option>
          {studentStrategies.length > 0 && <optgroup label="Student's IEP Strategies">
            {studentStrategies.map((s, i) => <option key={`stu_${i}`} value={s.label}>{s.label}</option>)}
          </optgroup>}
          <optgroup label="General Strategies">
            {STRATEGIES.map(s => <option key={s.id} value={s.title}>{s.title}</option>)}
          </optgroup>
        </select>
        <input
          type="text" value={strategyLabel} onChange={e => setStrategyLabel(e.target.value)}
          placeholder="Or describe what you did..."
          style={{ width: '100%', padding: '8px', marginTop: '6px', background: '#0f172a', color: '#e2e8f0', border: '1px solid #1e293b', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }}
        />
      </div>

      {studentAccs.length > 0 && (
        <div style={{ marginBottom: '10px' }}>
          <label style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '4px' }}>Accommodations Used</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {studentAccs.map(acc => (
              <button key={acc} onClick={() => toggleAcc(acc)} style={{
                padding: '4px 10px', fontSize: '11px', borderRadius: '14px', cursor: 'pointer', border: 'none',
                background: selectedAccs.includes(acc) ? '#1d4ed8' : '#1e293b',
                color: selectedAccs.includes(acc) ? '#fff' : '#8fa3c4',
              }}>{acc}</button>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginBottom: '12px' }}>
        <label style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '4px' }}>Staff Note (optional)</label>
        <textarea
          value={staffNote} onChange={e => setStaffNote(e.target.value)}
          placeholder="What exactly did you do?"
          rows={2}
          style={{ width: '100%', padding: '8px', background: '#0f172a', color: '#e2e8f0', border: '1px solid #1e293b', borderRadius: '6px', fontSize: '13px', resize: 'vertical', boxSizing: 'border-box' }}
        />
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        <button onClick={handleSave} style={{
          flex: 1, padding: '9px', fontSize: '13px', fontWeight: '600', background: '#1d4ed8', color: '#fff',
          border: 'none', borderRadius: '8px', cursor: 'pointer',
        }}>Save Intervention</button>
        <button onClick={onCancel} style={{
          padding: '9px 14px', fontSize: '13px', background: 'transparent', color: '#64748b',
          border: '1px solid #1e293b', borderRadius: '8px', cursor: 'pointer',
        }}>Cancel</button>
      </div>
    </div>
  );
}
