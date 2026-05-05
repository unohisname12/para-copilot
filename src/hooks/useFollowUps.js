import React from 'react';
import { useLocalStorage } from './useLocalStorage';
import {
  addBusinessDays,
  createPendingFollowUp,
  getDueFollowUps,
  purgeExpiredFollowUps,
  snoozeFollowUp,
} from '../features/help/followUpScheduler';

export function useFollowUps() {
  const [followUps, setFollowUps] = useLocalStorage('paraPendingFollowUpsV1', []);
  // ISO timestamp; while now < this, the login banner is hidden so the
  // para isn't nagged. Pending follow-ups still expire on their own.
  const [silencedUntil, setSilencedUntil] = useLocalStorage('paraFollowUpsSilencedUntilV1', null);
  const [nowTick, setNowTick] = React.useState(() => Date.now());

  React.useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  React.useEffect(() => {
    // Purge anything past its 2-business-day window so old entries
    // about things the para has forgotten don't pile up.
    setFollowUps(prev => purgeExpiredFollowUps(prev, nowTick));
  }, [setFollowUps, nowTick]);

  const scheduleFollowUp = React.useCallback((data) => {
    const followUp = createPendingFollowUp(data);
    if (!followUp) return null;
    setFollowUps(prev => {
      const existing = prev.find(f =>
        f.incidentId === followUp.incidentId &&
        f.interventionId === followUp.interventionId &&
        Boolean(f.needsIntervention) === Boolean(followUp.needsIntervention) &&
        ['pending', 'snoozed'].includes(f.status)
      );
      return existing ? prev : [followUp, ...prev];
    });
    return followUp;
  }, [setFollowUps]);

  const snooze = React.useCallback((id, delayMinutes = 15) => {
    setFollowUps(prev => prev.map(f => f.id === id ? snoozeFollowUp(f, delayMinutes) : f));
  }, [setFollowUps]);

  const markAnswered = React.useCallback((id) => {
    setFollowUps(prev => prev.map(f => f.id === id ? { ...f, status: 'answered', answeredAt: new Date().toISOString() } : f));
  }, [setFollowUps]);

  const dismiss = React.useCallback((id) => {
    setFollowUps(prev => prev.map(f => f.id === id ? { ...f, status: 'dismissed', dismissedAt: new Date().toISOString() } : f));
  }, [setFollowUps]);

  const clearFollowUps = React.useCallback(() => {
    setFollowUps([]);
  }, [setFollowUps]);

  // Mass-silence: para taps "Later" on the login banner once and the
  // banner stays hidden for the next 2 business days. The Follow-ups
  // panel is still reachable from the sidebar for manual entry.
  const silenceAll = React.useCallback(() => {
    setSilencedUntil(addBusinessDays(new Date(), 2).toISOString());
  }, [setSilencedUntil]);

  const isSilenced = React.useMemo(() => {
    if (!silencedUntil) return false;
    return new Date(silencedUntil).getTime() > nowTick;
  }, [silencedUntil, nowTick]);

  const dueFollowUps = React.useMemo(
    () => getDueFollowUps(followUps, new Date(nowTick)),
    [followUps, nowTick]
  );

  const pendingFollowUps = React.useMemo(
    () => followUps
      .filter(f => ['pending', 'snoozed'].includes(f.status))
      .sort((a, b) => new Date(a.nextPromptAt).getTime() - new Date(b.nextPromptAt).getTime()),
    [followUps]
  );

  return {
    followUps,
    pendingFollowUps,
    dueFollowUps,
    scheduleFollowUp,
    snooze,
    markAnswered,
    dismiss,
    clearFollowUps,
    silenceAll,
    isSilenced,
    silencedUntil,
  };
}
