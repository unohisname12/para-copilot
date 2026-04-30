import { useCallback } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { createIncident, createIntervention, createOutcome } from '../models';
import { useTeamOptional } from '../context/TeamProvider';
import { pushIncident, pushIntervention, pushOutcome } from '../services/teamSync';

export function useCaseMemory() {
  const [incidents, setIncidents] = useLocalStorage('paraIncidentsV1', []);
  const [interventions, setInterventions] = useLocalStorage('paraInterventionsV1', []);
  const [outcomes, setOutcomes] = useLocalStorage('paraOutcomesV1', []);

  const team = useTeamOptional();
  const cloudCtx = team?.activeTeamId && team?.user?.id
    ? { teamId: team.activeTeamId, userId: team.user.id, teamStudents: team.teamStudents || [] }
    : null;

  // Resolve cloud team_students row by paraAppNumber first (FERPA-safe stable
  // bridge), then by id, then by pseudonym. Pseudonym last because it can
  // drift between devices when rosters regenerate independently.
  const resolveDbStudentId = (data) => {
    if (!cloudCtx) return null;
    const paraAppNumber = data?.paraAppNumber || null;
    if (paraAppNumber) {
      const key = String(paraAppNumber).trim();
      const byKey = cloudCtx.teamStudents.find(
        (s) => s.paraAppNumber != null && String(s.paraAppNumber).trim() === key
      );
      if (byKey) return byKey.id;
    }
    const candidate = data?.studentId || data?.pseudonym || null;
    if (!candidate) return null;
    const match = cloudCtx.teamStudents.find(
      (s) => s.id === candidate || s.pseudonym === candidate
    );
    return match ? match.id : null;
  };

  const addIncident = useCallback((data) => {
    const inc = createIncident(data);
    setIncidents(prev => [inc, ...prev]);
    if (cloudCtx) {
      pushIncident(cloudCtx.teamId, cloudCtx.userId, {
        ...inc,
        studentDbId: resolveDbStudentId(data),
        paraAppNumber: data.paraAppNumber || null,
      }).catch((err) => {
        team.reportCloudError?.(`Incident saved locally but did not sync: ${err.message || err}`);
        // eslint-disable-next-line no-console
        console.error('[cloud] pushIncident failed', err);
      });
    }
    return inc;
  }, [setIncidents, cloudCtx]);

  const addIntervention = useCallback((data) => {
    const intv = createIntervention(data);
    setInterventions(prev => [intv, ...prev]);
    // Link to parent incident
    setIncidents(prev => prev.map(inc =>
      inc.id === data.incidentId
        ? { ...inc, interventionIds: [...inc.interventionIds, intv.id] }
        : inc
    ));
    if (cloudCtx) {
      pushIntervention(cloudCtx.teamId, cloudCtx.userId, {
        ...intv,
        studentDbId: resolveDbStudentId(data),
        paraAppNumber: data.paraAppNumber || null,
      }).catch((err) => {
        team.reportCloudError?.(`Intervention saved locally but did not sync: ${err.message || err}`);
        // eslint-disable-next-line no-console
        console.error('[cloud] pushIntervention failed', err);
      });
    }
    return intv;
  }, [setInterventions, setIncidents, cloudCtx]);

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
    if (cloudCtx) {
      pushOutcome(cloudCtx.teamId, cloudCtx.userId, {
        ...out,
        studentDbId: resolveDbStudentId(data),
        paraAppNumber: data.paraAppNumber || null,
      }).catch((err) => {
        team.reportCloudError?.(`Outcome saved locally but did not sync: ${err.message || err}`);
        // eslint-disable-next-line no-console
        console.error('[cloud] pushOutcome failed', err);
      });
    }
    return out;
  }, [setOutcomes, setIncidents, cloudCtx]);

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

  // Surgical: remove ONLY the demo-seeded records (IDs prefixed inc_demo_ /
  // intv_demo_ / out_demo_). Used when a real import happens so the showcase
  // data disappears without touching anything the user actually produced.
  const clearDemoOnly = useCallback(() => {
    setIncidents(prev => prev.filter(i => !String(i.id || '').startsWith('inc_demo_')));
    setInterventions(prev => prev.filter(i => !String(i.id || '').startsWith('intv_demo_')));
    setOutcomes(prev => prev.filter(o => !String(o.id || '').startsWith('out_demo_')));
  }, [setIncidents, setInterventions, setOutcomes]);

  return {
    incidents, interventions, outcomes,
    addIncident, addIntervention, addOutcome,
    resolveIncident, getStudentCaseHistory,
    loadDemoCaseMemory, clearCaseMemory, clearDemoOnly,
  };
}
