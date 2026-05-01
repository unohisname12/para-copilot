import React from 'react';
import { useLocalStorage } from './useLocalStorage';
import {
  createPendingFollowUp,
  expireOldFollowUps,
  getDueFollowUps,
  snoozeFollowUp,
} from '../features/help/followUpScheduler';

export function useFollowUps() {
  const [followUps, setFollowUps] = useLocalStorage('paraPendingFollowUpsV1', []);
  const [nowTick, setNowTick] = React.useState(() => Date.now());

  React.useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  React.useEffect(() => {
    setFollowUps(prev => expireOldFollowUps(prev));
  }, [setFollowUps]);

  const scheduleFollowUp = React.useCallback((data) => {
    const followUp = createPendingFollowUp(data);
    if (!followUp) return null;
    setFollowUps(prev => {
      const existing = prev.find(f =>
        f.interventionId === followUp.interventionId &&
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
  };
}
