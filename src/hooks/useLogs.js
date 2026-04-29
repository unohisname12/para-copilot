import { useLocalStorage } from './useLocalStorage';
import { createLog } from '../models';
import { polishText } from '../utils/spellPolish';

export function useLogs({ currentDate, periodLabel, activePeriod, onLogCreated }) {
  const [logs, setLogs] = useLocalStorage('paraLogsV1', []);
  // Auto-polish toggle. Default ON — paras want quick messy notes cleaned
  // up automatically. They can flip it off in Settings → Editor if they
  // want raw input preserved.
  const [autoPolish] = useLocalStorage('paraAutoPolishV1', true);

  const addLog = (studentId, note, type, extras = {}) => {
    let finalNote = note;
    let polishMeta = null;
    if (autoPolish && note && typeof note === 'string') {
      const { polished, original, changes } = polishText(note);
      if (changes.length > 0 && polished !== note) {
        finalNote = polished;
        polishMeta = { original, changes: changes.length };
      }
    }
    const log = createLog({
      studentId, type, note: finalNote, date: currentDate,
      period: periodLabel, periodId: activePeriod,
      ...extras,
      // Tag the log so the UI can offer Undo to the original text.
      polish: polishMeta || undefined,
    });
    setLogs(prev => [log, ...prev]);
    if (onLogCreated) {
      // Fire-and-forget; local save already succeeded.
      try { onLogCreated(log, extras); } catch (e) {
        // eslint-disable-next-line no-console
        console.error('[onLogCreated] handler threw', e);
      }
    }
    return log;
  };

  const toggleFlag = id =>
    setLogs(prev => prev.map(l => l.id === id ? { ...l, flagged: !l.flagged } : l));

  const deleteLog = (id, opts = {}) => {
    // { silent: true } skips the confirm — used by Undo flows where the user
    // has already indicated they want the entry gone.
    if (opts.silent || window.confirm("Delete this log entry?")) {
      setLogs(prev => prev.filter(l => l.id !== id));
    }
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
