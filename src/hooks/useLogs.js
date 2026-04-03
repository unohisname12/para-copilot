import { useLocalStorage } from './useLocalStorage';
import { createLog } from '../models';

export function useLogs({ currentDate, periodLabel, activePeriod }) {
  const [logs, setLogs] = useLocalStorage('paraLogsV1', []);

  const addLog = (studentId, note, type, extras = {}) => {
    const log = createLog({
      studentId, type, note, date: currentDate,
      period: periodLabel, periodId: activePeriod,
      ...extras,
    });
    setLogs(prev => [log, ...prev]);
  };

  const toggleFlag = id =>
    setLogs(prev => prev.map(l => l.id === id ? { ...l, flagged: !l.flagged } : l));

  const deleteLog = id => {
    if (window.confirm("Delete this log entry?")) setLogs(prev => prev.filter(l => l.id !== id));
  };

  const updateLogText = (id, newText) =>
    setLogs(prev => prev.map(l => l.id === id ? { ...l, note: newText, text: newText } : l));

  const loadDemoLogs = (demoLogs) => {
    const built = demoLogs.map(l => createLog({
      studentId: l.studentId, type: l.type, note: l.note, date: l.date,
      period: '', periodId: '',
      tags: l.tags || [], source: 'demo',
    }));
    setLogs(prev => [...built, ...prev]);
  };

  const clearDemoLogs = () => {
    setLogs(prev => prev.filter(l => l.source !== 'demo'));
  };

  return { logs, setLogs, addLog, toggleFlag, deleteLog, updateLogText, loadDemoLogs, clearDemoLogs };
}
