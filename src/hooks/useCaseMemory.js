import { useCallback } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { createIncident, createIntervention, createOutcome } from '../models';

export function useCaseMemory() {
  const [incidents, setIncidents] = useLocalStorage('paraIncidentsV1', []);
  const [interventions, setInterventions] = useLocalStorage('paraInterventionsV1', []);
  const [outcomes, setOutcomes] = useLocalStorage('paraOutcomesV1', []);

  const addIncident = useCallback((data) => {
    const inc = createIncident(data);
    setIncidents(prev => [inc, ...prev]);
    return inc;
  }, [setIncidents]);

  const addIntervention = useCallback((data) => {
    const intv = createIntervention(data);
    setInterventions(prev => [intv, ...prev]);
    // Link to parent incident
    setIncidents(prev => prev.map(inc =>
      inc.id === data.incidentId
        ? { ...inc, interventionIds: [...inc.interventionIds, intv.id] }
        : inc
    ));
    return intv;
  }, [setInterventions, setIncidents]);

  const addOutcome = useCallback((data) => {
    const out = createOutcome(data);
    setOutcomes(prev => [out, ...prev]);
    // Auto-resolve incident if result is "worked"
    if (data.result === "worked") {
      setIncidents(prev => prev.map(inc =>
        inc.id === data.incidentId
          ? { ...inc, status: "resolved", resolvedAt: new Date().toISOString() }
          : inc
      ));
    }
    return out;
  }, [setOutcomes, setIncidents]);

  const resolveIncident = useCallback((incidentId, status = "resolved") => {
    setIncidents(prev => prev.map(inc =>
      inc.id === incidentId
        ? { ...inc, status, resolvedAt: new Date().toISOString() }
        : inc
    ));
  }, [setIncidents]);

  const getStudentCaseHistory = useCallback((studentId) => {
    const stuIncidents = incidents.filter(i => i.studentId === studentId);
    return stuIncidents.map(inc => ({
      incident: inc,
      interventions: interventions
        .filter(intv => intv.incidentId === inc.id)
        .map(intv => ({
          intervention: intv,
          outcome: outcomes.find(o => o.interventionId === intv.id) || null,
        })),
    }));
  }, [incidents, interventions, outcomes]);

  const loadDemoCaseMemory = useCallback(({ incidents: demoInc, interventions: demoIntv, outcomes: demoOut }) => {
    setIncidents(demoInc);
    setInterventions(demoIntv);
    setOutcomes(demoOut);
  }, [setIncidents, setInterventions, setOutcomes]);

  const clearCaseMemory = useCallback(() => {
    setIncidents([]);
    setInterventions([]);
    setOutcomes([]);
  }, [setIncidents, setInterventions, setOutcomes]);

  return {
    incidents, interventions, outcomes,
    addIncident, addIntervention, addOutcome,
    resolveIncident, getStudentCaseHistory,
    loadDemoCaseMemory, clearCaseMemory,
  };
}
