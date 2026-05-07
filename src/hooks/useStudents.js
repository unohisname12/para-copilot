import React, { useState, useMemo } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { DB, DEMO_STUDENTS } from '../data';
import { migrateIdentity, patchIdentity } from '../identity';
import { normalizeIdentityEntries } from '../models';
import { migrateSupports } from '../models/supports';

// Pure reducer for student removal. Lives outside the hook so it can be
// tested directly (no renderer required) and reused if we ever need a
// non-hook caller. Behavior:
//   - no options.periodId  → full delete (drop from every period + the
//                            importedStudents map)
//   - options.periodId set → drop from that period only. If the student
//                            no longer appears in any period, fully delete.
//                            Keeps cross-period kids alive in their other
//                            periods, which is the whole point of this fix.
export function applyStudentRemoval(state, studentId, options = {}) {
  if (!studentId || !state) return state;
  const periodId = options.periodId;
  const importedStudents = { ...(state.importedStudents || {}) };
  const importedPeriodMap = {};
  Object.entries(state.importedPeriodMap || {}).forEach(([pid, ids]) => {
    importedPeriodMap[pid] = Array.isArray(ids) ? [...ids] : [];
  });

  if (!periodId) {
    delete importedStudents[studentId];
    Object.keys(importedPeriodMap).forEach(pid => {
      importedPeriodMap[pid] = importedPeriodMap[pid].filter(id => id !== studentId);
    });
    return { importedStudents, importedPeriodMap };
  }

  if (!importedPeriodMap[periodId]) return state; // nothing to do
  const before = importedPeriodMap[periodId];
  const after = before.filter(id => id !== studentId);
  if (after.length === before.length) return state; // student wasn't in that period
  importedPeriodMap[periodId] = after;

  // Was that the student's last appearance? If so, drop from importedStudents too.
  const stillUsed = Object.values(importedPeriodMap).some(ids => ids.includes(studentId));
  if (!stillUsed) delete importedStudents[studentId];

  return { importedStudents, importedPeriodMap };
}

// Exported under a separate name solely so jest tests can exercise the
// row→student mapping without spinning up a renderer. Production callers
// inside this module use `fromCloudRow` directly.
export function fromCloudRowForTests(row) { return fromCloudRow(row); }

// Pure helper: collapse duplicate students that share a paraAppNumber. Used
// by effectivePeriodStudents and exported so tests can pin the contract.
// Inputs: list of {id, paraAppNumber} and list of importedStudents (map
// id->{paraAppNumber}). Returns { cloudIds, localIds } with first-seen
// cloud retained per paraAppNumber and local entries dropped if their
// paraAppNumber is already in the cloud set.
export function dedupeStudentsByParaAppNumber({ cloudStudents = [], importedIds = [], importedStudents = {} }) {
  const seenKey = new Map();
  const cloudIds = [];
  for (const s of cloudStudents) {
    const key = s?.paraAppNumber ? String(s.paraAppNumber).trim() : null;
    if (!key) { if (s?.id != null) cloudIds.push(s.id); continue; }
    if (!seenKey.has(key)) {
      seenKey.set(key, s.id);
      cloudIds.push(s.id);
    }
  }
  const localIds = importedIds.filter((id) => {
    const s = importedStudents[id];
    const key = s?.paraAppNumber ? String(s.paraAppNumber).trim() : null;
    return !key || !seenKey.has(key);
  });
  return { cloudIds, localIds, seenKey };
}

function fromCloudRow(row) {
  // Prefer the new period_ids[] column. Fall back to scalar period_id for
  // legacy rows written before the multi-period migration. Both are kept in
  // sync going forward (period_ids includes period_id as its first element).
  const periodIds = Array.isArray(row.period_ids) && row.period_ids.length > 0
    ? row.period_ids.filter(Boolean)
    : (row.period_id ? [row.period_id] : []);
  return migrateIdentity({
    id: row.id,
    dbId: row.id,
    pseudonym: row.pseudonym,
    color: row.color,
    periodId: row.period_id || periodIds[0] || '',
    periodIds,
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
    paraAppNumber: row.student_uid || '',
    externalKey: row.external_key || '',
    cloudOnly: true,
    supports: migrateSupports(row.supports),
  });
}

export function useStudents({ activePeriod, cloudStudents = null }) {
  // FERPA: imported student records are pseudonyms + paraAppNumbers only —
  // real names live in the IndexedDB vault (separate persistence) and never
  // touch localStorage. So persisting these here is safe and is what fixes
  // "I clicked Remember, reloaded, my kids vanished." Real names re-attach
  // to the persisted students via paraAppNumber on hydration.
  const [importedStudents, setImportedStudents] = useLocalStorage('paraImportedStudentsV1', {});
  const [importedPeriodMap, setImportedPeriodMap] = useLocalStorage('paraImportedPeriodMapV1', {});
  // Per-user hide list — set by Find My Students dup-scan when the user
  // chooses which copy of a duplicate to keep. Only filters the local view;
  // database rows stay intact so admin can clean up server-side later.
  const [hiddenStudentIds, setHiddenStudentIds] = useLocalStorage('paraHiddenStudentIdsV1', []);
  // Allowlist of paraAppNumbers — the para uploaded a list via Find My
  // Students saying "these are MY students". When populated, the visible
  // roster is restricted to ONLY those keys. Cloud rows that don't match a
  // key are hidden until the para clears the lock from the FMS modal.
  // Empty array = no lock = legacy behavior (show every assigned row).
  const [allowedKeys, setAllowedKeys] = useLocalStorage('paraRosterAllowlistV1', []);
  const [demoMode, setDemoMode] = useLocalStorage('paraDemoModeV1', true);
  // First-seen timestamp: lets us auto-disable the demo dashboard 24h after
  // an account starts using the app. User can flip it back on from
  // Settings → Advanced. Real kids in the roster suppress demos regardless
  // (see effectiveDemoMode below).
  const [firstSeenAt, setFirstSeenAt] = useLocalStorage('paraFirstSeenV1', 0);
  React.useEffect(() => {
    if (!firstSeenAt) { setFirstSeenAt(Date.now()); return; }
    const age = Date.now() - firstSeenAt;
    if (demoMode && age > 24 * 60 * 60 * 1000) setDemoMode(false);
  }, []); // run once on mount

  // One-time heal: previously-imported bundles wrote students to
  // importedStudents but left importedPeriodMap empty when the source
  // file had no period data. Those students were correctly persisted
  // but invisible on every period tab. Rebuild the period map from
  // student.periodId, defaulting to p1 for anything still blank.
  React.useEffect(() => {
    const studentList = Object.values(importedStudents || {});
    if (!studentList.length) return;
    const mapHasContent = Object.values(importedPeriodMap || {}).some(
      arr => Array.isArray(arr) && arr.length > 0
    );
    if (mapHasContent) return;
    const rebuilt = {};
    studentList.forEach(s => {
      const pid = s.periodId && String(s.periodId).trim() ? s.periodId : 'p1';
      if (!rebuilt[pid]) rebuilt[pid] = [];
      rebuilt[pid].push(s.id);
    });
    setImportedPeriodMap(rebuilt);
  }, []); // run once on mount
  const [identityOverrides, setIdentityOverrides] = useLocalStorage('paraIdentityOverridesV1', {});
  const [supportsOverrides, setSupportsOverrides] = useLocalStorage('paraSupportsOverridesV1', {});
  // identityRegistry is intentionally NOT persisted — entries carry realName
  // strings directly. Real names belong in the IndexedDB vault, not in
  // localStorage. The vault re-merges back onto students on reload.
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

  // Dedup imported students against cloud students by paraAppNumber. When in
  // team mode, the cloud is the source of truth — locally-imported records
  // (with regenerated `stu_imp_*` IDs) for the same kid would otherwise stack
  // alongside the cloud row. Drop the local import for any kid the cloud
  // already has.
  const importedFiltered = useMemo(() => {
    if (!cloudStudentsById) return importedStudents;
    const cloudKeys = new Set(
      Object.values(cloudStudentsById)
        .map(s => s?.paraAppNumber)
        .filter(Boolean)
        .map(k => String(k).trim())
    );
    if (cloudKeys.size === 0) return importedStudents;
    return Object.fromEntries(
      Object.entries(importedStudents).filter(([, s]) => {
        const key = (s?.paraAppNumber || s?.externalKey || '').toString().trim();
        return !key || !cloudKeys.has(key);
      })
    );
  }, [importedStudents, cloudStudentsById]);

  // Real-roster guard: once the user has imported real kids (or is on a
  // team with cloud students), demos should never bleed in — even if the
  // demoMode flag stayed true through some path that forgot to flip it.
  // This is what user reports as "test students leaking in."
  const hasRealStudents =
    Object.keys(importedStudents).length > 0 ||
    (Array.isArray(cloudStudentList) && cloudStudentList.length > 0);
  const effectiveDemoMode = demoMode && !hasRealStudents;

  // Demo students should appear whenever effectiveDemoMode is on — cloud
  // connection is orthogonal. Without this branch, joining a team silently
  // hides every sample student and the "Load Demo" button does nothing
  // visible.
  const allStudentsBase = cloudStudentsById
    ? (effectiveDemoMode
        ? { ...DEMO_STUDENTS, ...cloudStudentsById, ...importedFiltered }
        : { ...cloudStudentsById, ...importedFiltered })
    : effectiveDemoMode
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

  const hiddenSet = useMemo(
    () => new Set(Array.isArray(hiddenStudentIds) ? hiddenStudentIds : []),
    [hiddenStudentIds]
  );
  const allowedSet = useMemo(() => {
    const arr = Array.isArray(allowedKeys) ? allowedKeys : [];
    const numbers = new Set();
    const pseudonyms = new Set();
    arr.forEach((entry) => {
      if (entry == null) return;
      if (typeof entry === 'string') {
        const t = entry.trim();
        if (t) numbers.add(t);
        return;
      }
      if (typeof entry === 'object') {
        if (entry.paraAppNumber != null) {
          const t = String(entry.paraAppNumber).trim();
          if (t) numbers.add(t);
        }
        if (entry.pseudonym != null) {
          const t = String(entry.pseudonym).trim();
          if (t) pseudonyms.add(t);
        }
      }
    });
    return { numbers, pseudonyms, total: numbers.size + pseudonyms.size };
  }, [allowedKeys]);
  const effectivePeriodStudents = useMemo(() => {
    const importedIds = importedPeriodMap[activePeriod] || [];
    if (cloudStudentList) {
      // Multi-period match: cross-period kids carry every period in their
      // periodIds array; legacy single-period rows fall back to periodId.
      const inPeriod = (s) => {
        if (!activePeriod) return true;
        const ids = Array.isArray(s.periodIds) && s.periodIds.length > 0
          ? s.periodIds
          : (s.periodId ? [s.periodId] : []);
        return ids.includes(activePeriod);
      };
      // Allowlist gate — when the para has uploaded their roster via Find
      // My Students, only cloud rows whose paraAppNumber appears in the
      // allowlist survive. Empty allowlist = no lock = show all assigned.
      const passesAllowlist = (s) => {
        if (allowedSet.total === 0) return true;
        const num = s?.paraAppNumber ? String(s.paraAppNumber).trim() : '';
        if (num && allowedSet.numbers.has(num)) return true;
        const pseu = s?.pseudonym ? String(s.pseudonym).trim() : '';
        if (pseu && allowedSet.pseudonyms.has(pseu)) return true;
        return false;
      };
      // Dedupe cloud rows by paraAppNumber inside this period and drop
      // locally-imported ids that the cloud already covers. Admin
      // re-uploads or repeated Smart Imports can leave two team_students
      // rows for the same kid (different cloud ids, same external_key);
      // both passed `inPeriod` and both rendered as separate students.
      // Both ids stay in cloudStudentsById so existing logs continue to
      // resolve — only one id surfaces in the roster. See pure helper.
      const cloudInPeriod = cloudStudentList.filter(inPeriod).filter(passesAllowlist);
      const { cloudIds, localIds } = dedupeStudentsByParaAppNumber({
        cloudStudents: cloudInPeriod,
        importedIds,
        importedStudents,
      });
      // Locally-imported students with no cloud match still appear so the
      // dashboard isn't blank after a Smart Import / Master Roster upload
      // before sync completes.
      const merged = effectiveDemoMode
        ? [...new Set([...period.students, ...cloudIds, ...localIds])]
        : [...new Set([...cloudIds, ...localIds])];
      return merged.filter((id) => !hiddenSet.has(id));
    }
    const merged = effectiveDemoMode
      ? [...new Set([...period.students, ...importedIds])]
      : [...new Set([...importedIds])];
    return merged.filter((id) => !hiddenSet.has(id));
  }, [cloudStudentList, effectiveDemoMode, period.students, importedPeriodMap, importedStudents, activePeriod, hiddenSet, allowedSet]);

  const allowlistDiagnostic = useMemo(() => {
    const totalUploaded = allowedSet.total;
    if (!cloudStudentList || totalUploaded === 0) {
      return { totalUploaded, matched: 0, unmatchedKeys: [] };
    }
    const cloudPan = new Set();
    const cloudPseu = new Set();
    cloudStudentList.forEach((s) => {
      if (s.paraAppNumber) cloudPan.add(String(s.paraAppNumber).trim());
      if (s.pseudonym) cloudPseu.add(String(s.pseudonym).trim());
    });
    let matched = 0;
    const unmatched = [];
    allowedSet.numbers.forEach((n) => {
      if (cloudPan.has(n)) matched++; else unmatched.push(`#${n}`);
    });
    allowedSet.pseudonyms.forEach((p) => {
      if (cloudPseu.has(p)) matched++; else unmatched.push(p);
    });
    return { totalUploaded, matched, unmatchedKeys: unmatched.slice(0, 10) };
  }, [cloudStudentList, allowedSet]);

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

  // Wipe every imported student + their period assignments. Used right
  // before a bundle import so re-uploading replaces the imported set
  // instead of stacking pseudonym ghosts from old imports. Does NOT
  // touch demoMode, identity overrides, or the vault — those have
  // their own controls.
  const clearImports = () => {
    setImportedStudents({});
    setImportedPeriodMap({});
  };

  // Surgical removal. Pass `{ periodId }` to drop the student from that
  // class only — cross-period kids stay visible in their other classes.
  // Without options, removes globally (used by Verify Roster orphan cleanup).
  const removeImportedStudent = (studentId, options = {}) => {
    if (!studentId) return;
    // Both pieces of state need to flip atomically — but useLocalStorage
    // setters can only see one slice each. Snapshot current values, run the
    // pure reducer, then push both halves.
    const next = applyStudentRemoval(
      { importedStudents, importedPeriodMap },
      studentId,
      options
    );
    setImportedStudents(next.importedStudents);
    setImportedPeriodMap(next.importedPeriodMap);
  };

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

  const setRosterAllowlist = (keys = []) => {
    // Accept either bare strings (legacy paraAppNumber-only) or
    // objects with { paraAppNumber?, pseudonym? } so callers can supply
    // both keys when they have them. Dedupe by JSON shape so two entries
    // with the same paraAppNumber don't survive twice.
    const seen = new Set();
    const cleaned = [];
    (Array.isArray(keys) ? keys : []).forEach((entry) => {
      if (entry == null) return;
      let normalized = null;
      if (typeof entry === 'string') {
        const t = entry.trim();
        if (t) normalized = t;  // store as string for backwards-compat
      } else if (typeof entry === 'object') {
        const pan = entry.paraAppNumber != null ? String(entry.paraAppNumber).trim() : '';
        const pseu = entry.pseudonym != null ? String(entry.pseudonym).trim() : '';
        if (pan || pseu) {
          normalized = {};
          if (pan) normalized.paraAppNumber = pan;
          if (pseu) normalized.pseudonym = pseu;
        }
      }
      if (normalized == null) return;
      const key = typeof normalized === 'string' ? `s:${normalized}` : `o:${normalized.paraAppNumber || ''}|${normalized.pseudonym || ''}`;
      if (seen.has(key)) return;
      seen.add(key);
      cleaned.push(normalized);
    });
    setAllowedKeys(cleaned);
    // Count = unique identifiers contributed (a paraAppNumber and a pseudonym
    // on the same entry count as 1 student, not 2).
    return cleaned.length;
  };
  const clearRosterAllowlist = () => setAllowedKeys([]);

  const hideStudentIds = (ids = []) => {
    const next = Array.from(new Set([...(hiddenStudentIds || []), ...ids.filter(Boolean)]));
    setHiddenStudentIds(next);
    return next.length;
  };
  const unhideStudentIds = (ids = []) => {
    const drop = new Set(ids);
    const next = (hiddenStudentIds || []).filter((id) => !drop.has(id));
    setHiddenStudentIds(next);
    return next.length;
  };
  const clearHiddenStudents = () => setHiddenStudentIds([]);

  return {
    allStudents, effectivePeriodStudents,
    importedStudents, importedPeriodMap,
    demoMode, setDemoMode,
    effectiveDemoMode, hasRealStudents,
    identityOverrides, identityRegistry, setIdentityRegistry,
    supportsOverrides,
    handleImport, handleBundleImport, handleIdentityLoad, handleUpdateIdentity,
    handleUpdateSupports,
    getStudentById,
    removeImportedStudent,
    clearImports,
    resetImports,
    hiddenStudentIds, hideStudentIds, unhideStudentIds, clearHiddenStudents,
    allowedKeys, setRosterAllowlist, clearRosterAllowlist,
    allowlistDiagnostic,
  };
}
