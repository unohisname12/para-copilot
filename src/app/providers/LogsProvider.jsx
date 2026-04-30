import React, { createContext, useContext, useCallback } from 'react';
import { useLogs } from '../../hooks/useLogs';
import { useTeamOptional } from '../../context/TeamProvider';
import { pushLog } from '../../services/teamSync';
import { useStudentsContext } from './StudentsProvider';

const LogsContext = createContext(null);

export function LogsProvider({ currentDate, periodLabel, activePeriod, children }) {
  const team = useTeamOptional();
  const { allStudents } = useStudentsContext();

  const onLogCreated = useCallback((log, extras) => {
    if (!team?.activeTeamId || !team?.user?.id) return;
    // Resolve team_students row by paraAppNumber first — the FERPA-safe
    // stable bridge that survives pseudonym regeneration across devices.
    // Fall back to pseudonym only when no paraAppNumber is on the log
    // (e.g. demo students with no admin number).
    const teamStudents = team.teamStudents || [];
    const paraAppNumber = log.paraAppNumber || extras?.paraAppNumber || null;
    let dbStu = null;
    if (paraAppNumber) {
      const key = String(paraAppNumber).trim();
      dbStu = teamStudents.find(
        (s) => s.paraAppNumber != null && String(s.paraAppNumber).trim() === key
      ) || null;
    }
    if (!dbStu) {
      const pseudonym = extras?.pseudonym;
      if (pseudonym) {
        dbStu = teamStudents.find((s) => s.pseudonym === pseudonym) || null;
      }
    }
    const payload = {
      ...log,
      studentDbId: dbStu?.id || null,
      shared: Boolean(extras?.shared),
    };
    pushLog(team.activeTeamId, team.user.id, payload).catch((err) => {
      team.reportCloudError?.(`Log saved locally but did not sync: ${err.message || err}`);
      // eslint-disable-next-line no-console
      console.error('[cloud] pushLog failed', err);
    });
  }, [team]);

  const logsBag = useLogs({ currentDate, periodLabel, activePeriod, onLogCreated, allStudents });
  return <LogsContext.Provider value={logsBag}>{children}</LogsContext.Provider>;
}

export function useLogsContext() {
  const ctx = useContext(LogsContext);
  if (!ctx) throw new Error('useLogsContext must be used within LogsProvider');
  return ctx;
}
