// React context for the real-name vault. Owns:
//   - showRealNames (toggle)
//   - vault map { paraAppNumber -> realName }
//   - persisted flag (IndexedDB on/off)
//   - expiredBanner flag (14-day inactivity auto-wipe just fired)
//
// Reads identityRegistry from StudentsContext to build the vault on import.

import React, {
  createContext, useContext, useEffect, useMemo, useState, useCallback,
} from 'react';
import {
  buildVaultFromRegistry,
  loadVault,
  enablePersistence as dbEnable,
  updatePersistedNames,
  isPersistenceOn,
  purge as dbPurge,
  touch as dbTouch,
  INACTIVITY_DAYS,
} from '../privacy/realNameVault';

const VaultContext = createContext(null);

export function useVault() {
  const v = useContext(VaultContext);
  if (!v) throw new Error('useVault must be used inside <VaultProvider>');
  return v;
}

export function VaultProvider({ identityRegistry, onPurgeIdentityRegistry, children }) {
  const [showRealNames, setShowRealNames] = useState(false);
  const [vault, setVault] = useState({}); // { paraAppNumber: realName }
  const [persisted, setPersisted] = useState(false);
  const [expiredBanner, setExpiredBanner] = useState(false);
  const [confirmPersistOpen, setConfirmPersistOpen] = useState(false);
  // 'idle' before any roster load; after a load: 'matched' (every entry resolved),
  // 'partial' (some unresolved), 'no_match' (0 resolved). Drives the missing-names
  // warning banner so reconnect failures aren't silent.
  const [reconnectStatus, setReconnectStatus] = useState('idle');
  const [unresolvedNames, setUnresolvedNames] = useState([]);

  // On mount: hydrate from IndexedDB if user previously opted in
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const state = await loadVault();
        if (cancelled) return;
        if (state?.expired) {
          setExpiredBanner(true);
          setPersisted(false);
          return;
        }
        if (state?.enabled) {
          setVault(state.names || {});
          setPersisted(true);
          setShowRealNames(true); // persisted users expect to see names
          dbTouch(); // roll the expiry window on use
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[vault] load failed', e);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // When identityRegistry changes (new bundle imported, roster JSON loaded),
  // merge those names into the vault. Persist if enabled. Also compute the
  // reconnect status so a banner can surface partial/no-match situations.
  useEffect(() => {
    if (!identityRegistry || identityRegistry.length === 0) return;
    const fresh = buildVaultFromRegistry(identityRegistry);
    const provided = identityRegistry.length;
    const resolved = identityRegistry.filter((e) => e.studentId).length;
    const unresolved = identityRegistry
      .filter((e) => !e.studentId && e.realName)
      .map((e) => e.realName);
    if (resolved === 0 && provided > 0) {
      setReconnectStatus('no_match');
    } else if (resolved < provided) {
      setReconnectStatus('partial');
    } else {
      setReconnectStatus('matched');
    }
    setUnresolvedNames(unresolved);
    if (Object.keys(fresh).length === 0) return;
    setVault((prev) => {
      const next = { ...prev, ...fresh };
      if (persisted) updatePersistedNames(next).catch((err) => { console.warn('[VaultProvider] persistNames failed', err); });
      return next;
    });
    // First-time roster load auto-enables the toggle
    setShowRealNames((s) => s || Object.keys(fresh).length > 0);
  }, [identityRegistry, persisted]);

  const dismissReconnectStatus = useCallback(() => {
    setReconnectStatus('idle');
    setUnresolvedNames([]);
  }, []);

  const hasVault = Object.keys(vault).length > 0;

  const toggleShowRealNames = useCallback(() => {
    setShowRealNames((s) => !s);
    if (persisted) dbTouch();
  }, [persisted]);

  const requestEnablePersistence = useCallback(() => {
    setConfirmPersistOpen(true);
  }, []);

  const confirmEnablePersistence = useCallback(async () => {
    setConfirmPersistOpen(false);
    try {
      await dbEnable(vault);
      setPersisted(true);
      setShowRealNames(true);
      setExpiredBanner(false);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[vault] enable failed', e);
    }
  }, [vault]);

  const cancelEnablePersistence = useCallback(() => {
    setConfirmPersistOpen(false);
  }, []);

  // Merge in a batch of { paraAppNumber -> realName } entries. If persistence
  // is on, the merged set is written back to IndexedDB. Returns a summary.
  const mergeVault = useCallback(async (additions) => {
    if (!additions || Object.keys(additions).length === 0) {
      return { added: 0, updated: 0 };
    }
    let added = 0, updated = 0;
    const next = { ...vault };
    Object.entries(additions).forEach(([k, v]) => {
      const key = String(k).trim();
      const name = String(v).trim();
      if (!key || !name) return;
      if (next[key] === name) return;
      if (next[key]) updated++; else added++;
      next[key] = name;
    });
    setVault(next);
    setShowRealNames(true);
    if (persisted) {
      try { await updatePersistedNames(next); } catch (err) { console.warn('[VaultProvider] persistNames failed', err); }
    }
    return { added, updated };
  }, [vault, persisted]);

  const purgeVault = useCallback(async () => {
    try { await dbPurge(); } catch (err) { console.warn('[VaultProvider] purge failed', err); }
    setVault({});
    setPersisted(false);
    setShowRealNames(false);
    setExpiredBanner(false);
    // Also tell the app to clear its identityRegistry so other surfaces update
    if (onPurgeIdentityRegistry) onPurgeIdentityRegistry();
  }, [onPurgeIdentityRegistry]);

  const dismissExpiredBanner = useCallback(() => setExpiredBanner(false), []);

  const value = useMemo(() => ({
    showRealNames,
    vault,
    hasVault,
    persisted,
    expiredBanner,
    inactivityDays: INACTIVITY_DAYS,
    confirmPersistOpen,
    reconnectStatus,
    unresolvedNames,
    toggleShowRealNames,
    requestEnablePersistence,
    confirmEnablePersistence,
    cancelEnablePersistence,
    purgeVault,
    dismissExpiredBanner,
    dismissReconnectStatus,
    mergeVault,
  }), [
    showRealNames, vault, hasVault, persisted, expiredBanner,
    confirmPersistOpen, reconnectStatus, unresolvedNames,
    toggleShowRealNames, requestEnablePersistence,
    confirmEnablePersistence, cancelEnablePersistence,
    purgeVault, dismissExpiredBanner, dismissReconnectStatus, mergeVault,
  ]);

  return <VaultContext.Provider value={value}>{children}</VaultContext.Provider>;
}

// Pure helper — apply the vault to a students map. When toggle is on and a
// student has a paraAppNumber that matches, inject `realName` onto the clone.
// Leaves students unchanged when toggle is off.
export function enrichStudentsWithNames(students, vault, showRealNames) {
  if (!students || !showRealNames || !vault) return students;
  const out = {};
  Object.entries(students).forEach(([id, s]) => {
    if (!s) { out[id] = s; return; }
    const key = s.paraAppNumber || s.externalKey;
    const realName = key ? vault[String(key).trim()] : null;
    out[id] = realName ? { ...s, realName } : s;
  });
  return out;
}
