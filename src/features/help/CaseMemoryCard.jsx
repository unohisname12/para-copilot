import React from 'react';

const RESULT_STYLES = {
  worked: { bg: '#052e16', border: '#166534', color: '#4ade80', label: 'Worked' },
  partly: { bg: '#1a1505', border: '#854d0e', color: '#fbbf24', label: 'Partly' },
  failed: { bg: '#1a0505', border: '#7f1d1d', color: '#f87171', label: "Didn't Work" },
  unknown: { bg: '#0f172a', border: '#334155', color: '#94a3b8', label: 'Unknown' },
};

export function CaseMemoryCard({ caseResult, onTryAgain }) {
  const { incident, interventions, matchReasons } = caseResult;

  return (
    <div style={{ background: '#0a1628', border: '1px solid #1e293b', borderRadius: '10px', padding: '12px', marginBottom: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
        <div style={{ fontSize: '12px', color: '#64748b' }}>{incident.date}</div>
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {matchReasons.map(r => (
            <span key={r} style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '10px', background: '#1e293b', color: '#8fa3c4' }}>{r.replace('_', ' ')}</span>
          ))}
        </div>
      </div>

      <div style={{ fontSize: '13px', color: '#e2e8f0', marginBottom: '10px', lineHeight: '1.4' }}>
        {incident.description}
      </div>

      {interventions.length > 0 ? interventions.map(({ intervention: intv, outcome }) => {
        const rs = outcome ? RESULT_STYLES[outcome.result] || RESULT_STYLES.unknown : null;
        return (
          <div key={intv.id} style={{ background: '#0f1a2e', borderRadius: '8px', padding: '10px', marginBottom: '6px' }}>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
              <strong style={{ color: '#cbd5e1' }}>Tried:</strong> {intv.strategyLabel || intv.staffNote || 'Unspecified'}
            </div>
            {intv.accommodationUsed.length > 0 && (
              <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>
                Accs: {intv.accommodationUsed.join(', ')}
              </div>
            )}
            {outcome && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                <span style={{ fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '6px', background: rs.bg, border: `1px solid ${rs.border}`, color: rs.color }}>
                  {rs.label}
                </span>
                {outcome.studentResponse && (
                  <span style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic' }}>{outcome.studentResponse.slice(0, 80)}</span>
                )}
              </div>
            )}
            {onTryAgain && (
              <button onClick={() => onTryAgain(intv)} style={{
                marginTop: '8px', padding: '5px 12px', fontSize: '11px', fontWeight: '600',
                background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer',
              }}>Try This Again</button>
            )}
          </div>
        );
      }) : (
        <div style={{ fontSize: '12px', color: '#475569', fontStyle: 'italic' }}>No interventions logged for this incident</div>
      )}
    </div>
  );
}
