import React, { useState, useMemo } from 'react';
import { searchCaseMemory } from '../../engine';
import { getStudentLabel } from '../../identity';
import { CaseMemoryCard } from './CaseMemoryCard';
import { InterventionLogger } from './InterventionLogger';
import { OutcomeLogger } from './OutcomeLogger';

export function HelpPanel({
  student, allStudents,
  incidents, interventions, outcomes,
  addIncident, addIntervention, addOutcome, addLog,
  onScheduleFollowUp,
  currentDate, activePeriod,
  initialDescription,
  onClose,
}) {
  const [description, setDescription] = useState(initialDescription || '');
  const [searched, setSearched] = useState(!!initialDescription);
  const [activeIncident, setActiveIncident] = useState(null);
  const [step, setStep] = useState('search'); // search | results | logIntervention | logOutcome
  const [lastIntervention, setLastIntervention] = useState(null);
  const [prefillIntv, setPrefillIntv] = useState(null);
  const [toast, setToast] = useState(null);

  // Build context for search from the description
  const currentContext = useMemo(() => {
    if (!description) return {};
    const words = description.toLowerCase().split(/\s+/);
    const tags = [];
    if (/escal|angry|yell|meltdown/i.test(description)) tags.push('escalation');
    if (/sensory|loud|noise|ears/i.test(description)) tags.push('sensory');
    if (/refus|won't|refuse/i.test(description)) tags.push('refusal');
    if (/math|fraction|decimal/i.test(description)) tags.push('math');
    if (/read|book|text/i.test(description)) tags.push('reading');
    if (/writ|essay|paragraph/i.test(description)) tags.push('writing');
    if (/break|calm|breath/i.test(description)) tags.push('regulation');
    if (/transition|pack|bell/i.test(description)) tags.push('transition');
    if (/off.?task|distract|tap/i.test(description)) tags.push('off-task');
    if (/shut.?down|head.?down|withdraw/i.test(description)) tags.push('shutdown');

    // Auto-detect category
    let category = 'general';
    if (tags.some(t => ['escalation', 'refusal', 'off-task', 'shutdown'].includes(t))) category = 'behavior';
    else if (tags.some(t => ['sensory', 'regulation'].includes(t))) category = 'regulation';
    else if (tags.some(t => ['math', 'reading', 'writing'].includes(t))) category = 'academic';

    return { category, tags, description };
  }, [description]);

  const caseResults = useMemo(() => {
    if (!searched || !student) return [];
    return searchCaseMemory(student.id, currentContext, incidents, interventions, outcomes, { maxResults: 5, includeOtherStudents: false });
  }, [searched, student, currentContext, incidents, interventions, outcomes]);

  const handleSearch = () => {
    if (!description.trim()) return;
    setSearched(true);
    setStep('results');
  };

  const handleCreateIncident = () => {
    const inc = addIncident({
      studentId: student.id,
      description: description.trim(),
      date: currentDate,
      periodId: activePeriod,
      category: currentContext.category,
      tags: currentContext.tags,
      source: 'help_button',
    });
    setActiveIncident(inc);
    setStep('logIntervention');
  };

  const handleSaveIntervention = (data) => {
    // Create incident if not already created
    let inc = activeIncident;
    if (!inc) {
      inc = addIncident({
        studentId: student.id,
        description: description.trim(),
        date: currentDate,
        periodId: activePeriod,
        category: currentContext.category,
        tags: currentContext.tags,
        source: 'help_button',
      });
      setActiveIncident(inc);
    }

    const intv = addIntervention({ ...data, incidentId: inc.id });
    setLastIntervention(intv);

    // Create companion log
    addLog(student.id, `[Help] ${data.strategyLabel || data.staffNote || 'Intervention logged'}`, 'Intervention', {
      source: 'help_button',
      tags: [...(currentContext.tags || []), 'help_intervention'],
    });

    setToast('Intervention saved');
    setTimeout(() => setToast(null), 2000);
    setStep('logOutcome');
  };

  const handleSaveOutcome = (data) => {
    addOutcome(data);

    addLog(student.id, `[Help] Outcome: ${data.result}${data.studentResponse ? ' — ' + data.studentResponse : ''}`, 'Outcome', {
      source: 'help_button',
      tags: [...(currentContext.tags || []), 'help_outcome'],
    });

    setToast('Outcome recorded');
    setTimeout(() => { setToast(null); onClose(); }, 1500);
  };

  const handleTrackLater = () => {
    if (activeIncident && lastIntervention && onScheduleFollowUp) {
      const followUp = onScheduleFollowUp({
        incident: activeIncident,
        intervention: lastIntervention,
        currentDate,
        activePeriod,
      });
      setToast(followUp ? 'Saved. I will ask again later.' : 'Saved for later.');
      setTimeout(() => { setToast(null); onClose(); }, 900);
      return;
    }
    onClose();
  };

  const handleTryAgain = (pastIntervention) => {
    setPrefillIntv({
      strategyId: pastIntervention.strategyId,
      strategyLabel: pastIntervention.strategyLabel,
      accommodationUsed: pastIntervention.accommodationUsed || [],
      staffNote: '',
    });
    if (!activeIncident) {
      const inc = addIncident({
        studentId: student.id,
        description: description.trim(),
        date: currentDate,
        periodId: activePeriod,
        category: currentContext.category,
        tags: currentContext.tags,
        source: 'help_button',
      });
      setActiveIncident(inc);
    }
    setStep('logIntervention');
  };

  if (!student) return null;
  const stuLabel = getStudentLabel(student, 'compact');

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, maxHeight: '70vh',
      background: '#0b1222', borderTop: '2px solid #1d4ed8', borderRadius: '16px 16px 0 0',
      zIndex: 1300, display: 'flex', flexDirection: 'column', overflow: 'hidden',
      boxShadow: '0 -8px 32px rgba(0,0,0,0.5)',
    }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div>
          <span style={{ fontSize: '15px', fontWeight: '700', color: '#e2e8f0' }}>Help — </span>
          <span style={{ fontSize: '14px', color: '#60a5fa' }}>{stuLabel}</span>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: '1px solid #1e293b', color: '#64748b', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontSize: '13px' }}>Close</button>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{ padding: '8px 16px', background: '#052e16', color: '#4ade80', fontSize: '12px', fontWeight: '600', textAlign: 'center' }}>{toast}</div>
      )}

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '14px 16px' }}>
        {/* Search bar — always visible */}
        {(step === 'search' || step === 'results') && (
          <div style={{ marginBottom: '14px' }}>
            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                type="text" value={description}
                onChange={e => { setDescription(e.target.value); setSearched(false); }}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="What's happening? (e.g. 'covering ears during group work')"
                style={{ flex: 1, padding: '10px 12px', background: '#0f172a', color: '#e2e8f0', border: '1px solid #1e293b', borderRadius: '8px', fontSize: '13px' }}
              />
              <button onClick={handleSearch} style={{
                padding: '10px 16px', background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: '8px',
                fontSize: '13px', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap',
              }}>Search</button>
            </div>
            {currentContext.tags?.length > 0 && (
              <div style={{ display: 'flex', gap: '4px', marginTop: '6px', flexWrap: 'wrap' }}>
                {currentContext.tags.map(t => (
                  <span key={t} style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '10px', background: '#1e293b', color: '#60a5fa' }}>{t}</span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Results */}
        {step === 'results' && searched && (
          <>
            {caseResults.length > 0 ? (
              <>
                <div style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  Past Cases ({caseResults.length})
                </div>
                {caseResults.map(r => (
                  <CaseMemoryCard key={r.incident.id} caseResult={r} onTryAgain={handleTryAgain} />
                ))}
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px', color: '#475569' }}>
                <div style={{ fontSize: '24px', marginBottom: '8px' }}>📋</div>
                <div style={{ fontSize: '13px' }}>No past cases found for this student.</div>
                <div style={{ fontSize: '12px', marginTop: '4px' }}>Log an intervention and it'll show up here next time.</div>
              </div>
            )}

            <button onClick={handleCreateIncident} style={{
              width: '100%', padding: '10px', marginTop: '10px', fontSize: '13px', fontWeight: '600',
              background: '#0f172a', color: '#60a5fa', border: '1px solid #1d4ed8', borderRadius: '8px', cursor: 'pointer',
            }}>Log What I'm Trying</button>
          </>
        )}

        {/* Intervention Logger */}
        {step === 'logIntervention' && activeIncident && (
          <InterventionLogger
            student={student}
            incident={activeIncident}
            prefill={prefillIntv}
            onSave={handleSaveIntervention}
            onCancel={() => { setPrefillIntv(null); setStep('results'); }}
          />
        )}

        {/* Outcome Logger */}
        {step === 'logOutcome' && lastIntervention && activeIncident && (
          <OutcomeLogger
            intervention={lastIntervention}
            incident={activeIncident}
            onSave={handleSaveOutcome}
            onSkip={onClose}
            onTrackLater={handleTrackLater}
          />
        )}
      </div>
    </div>
  );
}
