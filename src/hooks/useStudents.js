import { useState, useMemo } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { DB, DEMO_STUDENTS } from '../data';
import { patchIdentity } from '../identity';
import { normalizeIdentityEntries } from '../models';

export function useStudents({ activePeriod }) {
  const [importedStudents, setImportedStudents] = useState({});
  const [importedPeriodMap, setImportedPeriodMap] = useState({});
  const [demoMode, setDemoMode] = useState(true);
  const [identityOverrides, setIdentityOverrides] = useLocalStorage('paraIdentityOverridesV1', {});
  const [identityRegistry, setIdentityRegistry] = useState([]);

  const period = DB.periods[activePeriod];

  const allStudentsBase = demoMode
    ? { ...DEMO_STUDENTS, ...importedStudents }
    : { ...importedStudents };

  const allStudents = useMemo(() => {
    if (Object.keys(identityOverrides).length === 0) return allStudentsBase;
    return Object.fromEntries(
      Object.entries(allStudentsBase).map(([id, s]) =>
        identityOverrides[id] ? [id, patchIdentity(s, identityOverrides[id])] : [id, s]
      )
    );
  }, [allStudentsBase, identityOverrides]);

  const effectivePeriodStudents = useMemo(() => {
    if (demoMode) {
      return [...new Set([...period.students, ...(importedPeriodMap[activePeriod] || [])])];
    }
    return [...new Set([...(importedPeriodMap[activePeriod] || [])])];
  }, [demoMode, period.students, importedPeriodMap, activePeriod]);

  const handleImport = (studentObj, periodId) => {
    setImportedStudents(prev => ({ ...prev, [studentObj.id]: studentObj }));
    setImportedPeriodMap(prev => ({ ...prev, [periodId]: [...(prev[periodId] || []), studentObj.id] }));
    setDemoMode(false);
  };

  const handleIdentityLoad = (entries) => {
    const normalized = normalizeIdentityEntries(entries, allStudents);
    if (normalized.length > 0) setIdentityRegistry(normalized);
  };

  const handleUpdateIdentity = (studentId, { emoji, codename }) => {
    setIdentityOverrides(prev => ({ ...prev, [studentId]: { emoji, codename } }));
  };

  const handleBundleImport = (students, periodMapUpdates) => {
    setImportedStudents(prev => {
      const next = { ...prev };
      students.forEach(s => { next[s.id] = s; });
      return next;
    });
    setImportedPeriodMap(prev => {
      const next = { ...prev };
      Object.entries(periodMapUpdates).forEach(([pid, ids]) => {
        next[pid] = [...new Set([...(prev[pid] || []), ...ids])];
      });
      return next;
    });
    if (students.length > 0) setDemoMode(false);
  };

  const getStudentById = (id) => allStudents[id] || null;

  // Wipe all imports + identity back to a fresh state. Used by the
  // "Reset Local Data" action. Does NOT touch the real-name vault
  // (that has its own purge control with its own user consent).
  const resetImports = () => {
    setImportedStudents({});
    setImportedPeriodMap({});
    setIdentityRegistry([]);
    setIdentityOverrides({});
    setDemoMode(true); // back to showing demo students
  };

  return {
    allStudents, effectivePeriodStudents,
    importedStudents, importedPeriodMap,
    demoMode, setDemoMode,
    identityOverrides, identityRegistry, setIdentityRegistry,
    handleImport, handleBundleImport, handleIdentityLoad, handleUpdateIdentity,
    getStudentById,
    resetImports,
  };
}
