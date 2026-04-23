import React, { createContext, useContext, useCallback } from 'react';
import { useLogs } from '../../hooks/useLogs';
import { useTeamOptional } from '../../context/TeamProvider';
import { pushLog } from '../../services/teamSync';

const LogsContext = createContext(null);

export function LogsProvider({ currentDate, periodLabel, activePeriod, children }) {
  const team = useTeamOptional();

  const onLogCreated = useCallback((log, extras) => {
    if (!team?.activeTeamId || !team?.user?.id) return;
    // Resolve team_students row by pseudonym. extras may carry pseudonym explicitly;
    // otherwise look up via teamStudents.
    const pseudonym = extras?.pseudonym;
    const dbStu = pseudonym
      ? (team.teamStudents || []).find((s) => s.pseudonym === pseudonym)
      : null;
    const payload = {
      ...log,
      studentDbId: dbStu?.id || null,
      shared: Boolean(extras?.shared),
    };
    pushLog(team.activeTeamId, team.user.id, payload).catch((err) => {
      // eslint-disable-next-line no-console
      console.error('[cloud] pushLog failed', err);
    });
  }, [team]);

  const logsBag = useLogs({ currentDate, periodLabel, activePeriod, onLogCreated });
  return <LogsContext.Provider value={logsBag}>{children}</LogsContext.Provider>;
}

export function useLogsContext() {
  const ctx = useContext(LogsContext);
  if (!ctx) throw new Error('useLogsContext must be used within LogsProvider');
  return ctx;
}
