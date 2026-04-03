import React, { useState } from 'react';
import { DEMO_INCIDENTS, DEMO_INTERVENTIONS, DEMO_OUTCOMES, DEMO_LOGS } from '../../data/demoSeedData';
import { createLog } from '../../models';

export function ShowcaseLoader({ onLoadDemo, onClearDemo, hasData }) {
  const [loaded, setLoaded] = useState(false);

  const handleLoad = () => {
    onLoadDemo({
      incidents: DEMO_INCIDENTS,
      interventions: DEMO_INTERVENTIONS,
      outcomes: DEMO_OUTCOMES,
      logs: DEMO_LOGS,
    });
    setLoaded(true);
  };

  const handleClear = () => {
    onClearDemo();
    setLoaded(false);
  };

  if (loaded || hasData) {
    return (
      <div style={{ padding: '14px 16px', background: '#0d2010', border: '1px solid #166534', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: '13px', fontWeight: '700', color: '#4ade80' }}>Demo data loaded</div>
          <div style={{ fontSize: '11px', color: '#166534', marginTop: '2px' }}>Try the Help button with any student</div>
        </div>
        <button onClick={handleClear} style={{
          padding: '6px 14px', fontSize: '11px', fontWeight: '600', borderRadius: '6px',
          background: 'transparent', border: '1px solid #166534', color: '#4ade80', cursor: 'pointer',
        }}>Clear Demo Data</button>
      </div>
    );
  }

  return (
    <button onClick={handleLoad} style={{
      width: '100%', padding: '12px 16px', borderRadius: '10px',
      background: '#0c1a3d', border: '1px dashed #1d4ed8',
      color: '#60a5fa', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
    }}>
      <span style={{ fontSize: '18px' }}>&#x2728;</span>
      Load Demo Experience
    </button>
  );
}

export function ShowcaseBanner({ onLoadDemo, hasLogs, hasCaseData }) {
  if (hasLogs || hasCaseData) return null;

  return (
    <div style={{
      margin: '0 0 12px', padding: '12px 16px', borderRadius: '10px',
      background: 'linear-gradient(135deg, #0c1a3d 0%, #12102a 100%)',
      border: '1px solid #1e3a5f',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
    }}>
      <div>
        <div style={{ fontSize: '13px', fontWeight: '600', color: '#e2e8f0' }}>New here? Try the demo</div>
        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Load sample students with realistic case history</div>
      </div>
      <button onClick={onLoadDemo} style={{
        padding: '8px 16px', fontSize: '12px', fontWeight: '700', borderRadius: '8px',
        background: '#1d4ed8', color: '#fff', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
      }}>Load Demo</button>
    </div>
  );
}
