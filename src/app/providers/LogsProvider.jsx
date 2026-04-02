import React, { createContext, useContext } from 'react';
import { useLogs } from '../../hooks/useLogs';

const LogsContext = createContext(null);

export function LogsProvider({ currentDate, periodLabel, activePeriod, children }) {
  const logsBag = useLogs({ currentDate, periodLabel, activePeriod });
  return <LogsContext.Provider value={logsBag}>{children}</LogsContext.Provider>;
}

export function useLogsContext() {
  const ctx = useContext(LogsContext);
  if (!ctx) throw new Error('useLogsContext must be used within LogsProvider');
  return ctx;
}
