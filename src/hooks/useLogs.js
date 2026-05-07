import { useEffect } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { createLog } from '../models';
import { polishText } from '../utils/spellPolish';
import { relinkLogsByParaAppNumber } from '../utils/relinkLogs';
import { removeLogsByIds, restoreLogsAtTop } from '../utils/bulkLogOps';

export function useLogs({ currentDate, periodLabel, activePeriod, onLogCreated, onLogDeleted, allStudents = {} }) {
  const [logs, setLogs] = useLocalStorage('paraLogsV1', []);
  // Auto-polish toggle. Default ON — paras want quick messy notes cleaned
  // up automatically. They can flip it off in Settings → Editor if they
  // want raw input preserved.
  const [autoPolish] = useLocalStorage('paraAutoPolishV1', true);

  // One-shot backfill of paraAppNumber on legacy paraLogsV1 entries.
  // Older logs were written before paraAppNumber was a field; resolve it
  // from the current allStudents map when the studentId still matches.
  // Idempotent: only writes when at least one log is missing the field
  // AND its student record has a paraAppNumber to provide. Logs whose
  // studentId no longer maps to any student stay untouched (the field
  // stays absent and the Vault still renders them).
  useEffect(() => {
    if (!allStudents || !logs?.length) return;
    const needsBackfill = logs.some(l => !l.paraAppNumber && allStudents[l.studentId]?.paraAppNumber);
    if (!needsBackfill) return;
    setLogs(prev => prev.map(l => {
      if (l.paraAppNumber) return l;
      const fromStu = allStudents[l.studentId]?.paraAppNumber;
      return fromStu ? { ...l, paraAppNumber: String(fromStu).trim() || null } : l;
    }));
    // We deliberately don't depend on `logs` — that would re-fire on every
    // setLogs and ping-pong. allStudents is the right trigger.
  }, [allStudents]);

  // Re-link orphan logs when roster reloads. Roster reloads mint new
  // studentIds; logs that carry a paraAppNumber bridge get their studentId
  // rewritten in place so byStudent filters and exports include them again.
  // The pure helper returns the same array reference when nothing changed,
  // so this effect is idempotent and safe.
  useEffect(() => {
    if (!allStudents || !logs?.length) return;
    setLogs(prev => relinkLogsByParaAppNumber(prev, allStudents));
  }, [allStudents]);

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
    // Resolve paraAppNumber: caller's extras win, fall back to the student
    // record. This way every log is born with the FERPA-safe stable bridge,
    // even at call sites that don't know about paraAppNumber yet.
    const resolvedParaAppNumber =
      extras.paraAppNumber
      ?? allStudents[studentId]?.paraAppNumber
      ?? null;
    const log = createLog({
      studentId, type, note: finalNote, date: currentDate,
      period: periodLabel, periodId: activePeriod,
      ...extras,
      paraAppNumber: resolvedParaAppNumber,
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

  const fireDeleted = (removed) => {
    if (!removed || !removed.length || !onLogDeleted) return;
    try { onLogDeleted(removed); } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[onLogDeleted] handler threw', e);
    }
  };

  const deleteLog = (id, opts = {}) => {
    // { silent: true } skips the confirm — used by Undo flows where the user
    // has already indicated they want the entry gone.
    if (opts.silent || window.confirm("Delete this log entry?")) {
      const removedLocal = logs.filter(l => l.id === id);
      if (removedLocal.length > 0) {
        setLogs(prev => prev.filter(l => l.id !== id));
      }
      const removed = removedLocal.length > 0 ? removedLocal : [{ id }];
      fireDeleted(removed);
    }
  };

  // Returns the deleted entries so callers can wire Undo without re-reading
  // state. No confirm — caller is expected to confirm at the bar level.
  const bulkDeleteLogs = (ids) => {
    const set = ids instanceof Set ? ids : new Set(ids || []);
    if (set.size === 0) return [];
    const removedLocal = logs.filter(l => set.has(l.id));
    if (removedLocal.length > 0) {
      setLogs(prev => removeLogsByIds(prev, set));
    }
    // Synthesize stub entries for ids that exist only in cloud / sharedLogs.
    // The downstream onLogDeleted handler reads only `id`, so a minimal stub
    // is enough to fire the cloud delete and seed the tombstone.
    const removedLocalIds = new Set(removedLocal.map(l => l.id));
    const cloudOnlyStubs = [];
    set.forEach(id => {
      if (!removedLocalIds.has(id)) cloudOnlyStubs.push({ id });
    });
    const removed = [...removedLocal, ...cloudOnlyStubs];
    fireDeleted(removed);
    return removedLocal;
  };

  const restoreLogs = (snapshot) => {
    if (!snapshot || snapshot.length === 0) return;
    setLogs(prev => restoreLogsAtTop(prev, snapshot));
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

  return { logs, setLogs, addLog, toggleFlag, deleteLog, bulkDeleteLogs, restoreLogs, updateLogText, loadDemoLogs, clearDemoLogs };
}
