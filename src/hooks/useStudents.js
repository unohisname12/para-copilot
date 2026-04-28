import { useState, useMemo } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { DB, DEMO_STUDENTS } from '../data';
import { migrateIdentity, patchIdentity } from '../identity';
import { normalizeIdentityEntries } from '../models';
import { migrateSupports } from '../models/supports';

function fromCloudRow(row) {
  return migrateIdentity({
    id: row.id,
    dbId: row.id,
    pseudonym: row.pseudonym,
    color: row.color,
    periodId: row.period_id || '',
    classLabel: row.class_label || '',
    eligibility: row.eligibility || '',
    accs: row.accs || [],
    goals: row.goals || [],
    caseManager: row.case_manager || '',
    gradeLevel: row.grade_level || '',
    tags: row.tags || [],
    flags: row.flags || {},
    watchFors: row.watch_fors || [],
    doThisActions: row.do_this_actions || [],
    healthNotes: row.health_notes || [],
    crossPeriodInfo: row.cross_period || {},
    sourceMeta: row.source_meta || {},
    paraAppNumber: row.external_key || '',
    externalKey: row.external_key || '',
    cloudOnly: true,
    supports: migrateSupports(row.supports),
  });
}

export function useStudents({ activePeriod, cloudStudents = null }) {
  const [importedStudents, setImportedStudents] = useState({});
  const [importedPeriodMap, setImportedPeriodMap] = useState({});
  const [demoMode, setDemoMode] = useState(true);
  const [identityOverrides, setIdentityOverrides] = useLocalStorage('paraIdentityOverridesV1', {});
  const [supportsOverrides, setSupportsOverrides] = useLocalStorage('paraSupportsOverridesV1', {});
  const [identityRegistry, setIdentityRegistry] = useState([]);

  const period = DB.periods[activePeriod];

  const cloudStudentList = useMemo(
    () => (Array.isArray(cloudStudents) ? cloudStudents.map(fromCloudRow) : null),
    [cloudStudents]
  );
  const cloudStudentsById = useMemo(
    () => cloudStudentList
      ? Object.fromEntries(cloudStudentList.map((s) => [s.id, s]))
      : null,
    [cloudStudentList]
  );

  const allStudentsBase = cloudStudentsById
    ? { ...cloudStudentsById, ...importedStudents }
    : demoMode
    ? { ...DEMO_STUDENTS, ...importedStudents }
    : { ...importedStudents };

  const allStudents = useMemo(() => {
    const hasIdentity = Object.keys(identityOverrides).length > 0;
    const hasSupports = Object.keys(supportsOverrides).length > 0;
    if (!hasIdentity && !hasSupports) return allStudentsBase;
    return Object.fromEntries(
      Object.entries(allStudentsBase).map(([id, s]) => {
        let next = s;
        if (identityOverrides[id]) next = patchIdentity(next, identityOverrides[id]);
        if (supportsOverrides[id]) {
          next = { ...next, supports: migrateSupports({ ...(next.supports || {}), ...supportsOverrides[id] }) };
        }
        return [id, next];
      })
    );
  }, [allStudentsBase, identityOverrides, supportsOverrides]);

  const effectivePeriodStudents = useMemo(() => {
    if (cloudStudentList) {
      return cloudStudentList
        .filter((s) => !activePeriod || s.periodId === activePeriod)
        .map((s) => s.id);
    }
    if (demoMode) {
      return [...new Set([...period.students, ...(importedPeriodMap[activePeriod] || [])])];
    }
    return [...new Set([...(importedPeriodMap[activePeriod] || [])])];
  }, [cloudStudentList, demoMode, period.students, importedPeriodMap, activePeriod]);

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

  const handleUpdateSupports = (studentId, partialSupports) => {
    setSupportsOverrides(prev => ({
      ...prev,
      [studentId]: migrateSupports({ ...(prev[studentId] || {}), ...partialSupports }),
    }));
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
    setSupportsOverrides({});
    setDemoMode(true); // back to showing demo students
  };

  return {
    allStudents, effectivePeriodStudents,
    importedStudents, importedPeriodMap,
    demoMode, setDemoMode,
    identityOverrides, identityRegistry, setIdentityRegistry,
    supportsOverrides,
    handleImport, handleBundleImport, handleIdentityLoad, handleUpdateIdentity,
    handleUpdateSupports,
    getStudentById,
    resetImports,
  };
}
