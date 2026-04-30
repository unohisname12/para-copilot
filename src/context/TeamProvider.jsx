// React context for auth + team membership. Later phases extend it with
// teamStudents, sharedLogs, handoffs, caseMemory subscriptions.

import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import {
  onAuthStateChange,
  getSession,
  signInWithGoogle,
  signOut,
  getMyTeams,
  createTeam,
  joinTeamByCode,
  joinTeamAsOwner,
  regenerateInviteCode,
  getTeamStudents,
  getMyAssignedStudents,
  subscribeTeamStudents,
  pullSharedTeamLogs,
  subscribeSharedLogs,
  pullRecentHandoffs,
  subscribeHandoffs,
  pullCaseMemory,
  subscribeCaseMemory,
} from '../services/teamSync';
import { claimPendingAssignments } from '../services/paraAssignments';
import { supabaseConfigured } from '../services/supabaseClient';

const TeamContext = createContext(null);

export function useTeam() {
  const v = useContext(TeamContext);
  if (!v) throw new Error('useTeam must be used inside <TeamProvider>');
  return v;
}

// Same as useTeam but returns null instead of throwing when no provider.
// Use from components that can render in both cloud and offline-only mode.
export function useTeamOptional() {
  return useContext(TeamContext);
}

// Cache key for the team list. Reads on mount so the dashboard can render
// from cached data immediately instead of showing "Loading your teams..."
// every reload. Cloud refetch happens in the background; if it returns
// different data, state updates and the UI flips.
const TEAMS_CACHE_KEY = 'paraTeamsCacheV1';

function readCachedTeams() {
  try {
    const raw = globalThis.localStorage?.getItem(TEAMS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch { return null; }
}

function writeCachedTeams(teams) {
  try {
    if (Array.isArray(teams) && teams.length > 0) {
      globalThis.localStorage?.setItem(TEAMS_CACHE_KEY, JSON.stringify(teams));
    } else {
      globalThis.localStorage?.removeItem(TEAMS_CACHE_KEY);
    }
  } catch { /* ignore */ }
}

export function TeamProvider({ children }) {
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  // Hydrate from cache so the first render skips the spinner. Cloud fetch
  // below replaces this with fresh data once it lands.
  const [teams, setTeams] = useState(() => readCachedTeams() || []);
  const [activeTeamId, setActiveTeamId] = useState(null);
  const [teamsLoading, setTeamsLoading] = useState(false);

  useEffect(() => {
    if (!supabaseConfigured) { setAuthReady(true); return; }
    let off;
    (async () => {
      const s = await getSession();
      setSession(s);
      setAuthReady(true);
      off = onAuthStateChange((next) => setSession(next));
    })();
    return () => { if (off) off(); };
  }, []);

  useEffect(() => {
    if (!session) {
      setTeams([]);
      setActiveTeamId(null);
      writeCachedTeams(null);
      return;
    }
    let cancelled = false;
    // Only show the spinner if we DON'T already have cached teams. Otherwise
    // the dashboard renders from cache while the cloud fetch happens silently.
    const hadCache = (teams || []).length > 0;
    if (!hadCache) setTeamsLoading(true);
    (async () => {
      try {
        const t = await getMyTeams();
        if (cancelled) return;
        setTeams(t);
        writeCachedTeams(t);
        setActiveTeamId((prev) => prev || (t[0] ? t[0].id : null));
      } finally {
        if (!cancelled) setTeamsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [session]);

  const activeTeam = useMemo(
    () => teams.find((t) => t.id === activeTeamId) || null,
    [teams, activeTeamId]
  );

  // Current user's role in the active team, plus derived admin flag.
  const currentRole = activeTeam?.role || null;
  const isAdmin = currentRole === 'owner' || currentRole === 'sped_teacher';
  const isSub = currentRole === 'sub';
  const subLockedOut = isSub && activeTeam && activeTeam.allowSubs === false;

  const [teamStudents, setTeamStudents] = useState([]);
  const [cloudSyncError, setCloudSyncError] = useState(null);
  const reportCloudError = useCallback((message) => {
    setCloudSyncError(message || 'Cloud sync failed.');
  }, []);

  useEffect(() => {
    if (!activeTeamId) { setTeamStudents([]); return; }
    let cancelled = false;
    let off;
    (async () => {
      try {
        const initial = isAdmin
          ? await getTeamStudents(activeTeamId)
          : await getMyAssignedStudents();
        if (cancelled) return;
        setTeamStudents(initial);
      } catch (e) {
        if (!cancelled) reportCloudError(e.message || 'Could not load cloud roster.');
        // eslint-disable-next-line no-console
        console.error('[teamStudents] initial load failed', e);
      }
      if (cancelled) return;
      off = subscribeTeamStudents(activeTeamId, (payload) => {
        setTeamStudents((prev) => {
          if (payload.eventType === 'INSERT') {
            if (prev.find((s) => s.id === payload.new.id)) return prev;
            return [...prev, payload.new];
          }
          if (payload.eventType === 'UPDATE') {
            return prev.map((s) => (s.id === payload.new.id ? payload.new : s));
          }
          if (payload.eventType === 'DELETE') {
            return prev.filter((s) => s.id !== payload.old.id);
          }
          return prev;
        });
      });
    })();
    return () => { cancelled = true; if (off) off(); };
  }, [activeTeamId, isAdmin, reportCloudError]);

  // ── Shared team logs ─────────────────────────────────────────
  // Pulls every team log the signed-in user is allowed to see: shared
  // logs from any para + the user's own logs regardless of shared flag.
  // Including own logs is what restores the Vault after a local reset —
  // they live in the cloud but were filtered out of the team-shared pull.
  const ownUserId = session?.user?.id;
  const [sharedLogs, setSharedLogs] = useState([]);
  useEffect(() => {
    if (!activeTeamId) { setSharedLogs([]); return; }
    let cancelled = false;
    let off;
    (async () => {
      try {
        const initial = await pullSharedTeamLogs(activeTeamId, ownUserId);
        if (!cancelled) setSharedLogs(initial);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('[sharedLogs] initial load failed', e);
      }
      if (cancelled) return;
      off = subscribeSharedLogs(activeTeamId, (payload) => {
        setSharedLogs((prev) => {
          if (prev.find((l) => l.id === payload.new.id)) return prev;
          return [payload.new, ...prev];
        });
      }, ownUserId);
    })();
    return () => { cancelled = true; if (off) off(); };
  }, [activeTeamId, ownUserId]);

  // ── Handoffs ─────────────────────────────────────────────────
  const [handoffs, setHandoffs] = useState([]);
  useEffect(() => {
    if (!activeTeamId) { setHandoffs([]); return; }
    let cancelled = false;
    let off;
    (async () => {
      try {
        const initial = await pullRecentHandoffs(activeTeamId);
        if (!cancelled) setHandoffs(initial);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('[handoffs] initial load failed', e);
      }
      if (cancelled) return;
      off = subscribeHandoffs(activeTeamId, (payload) => {
        setHandoffs((prev) => {
          if (payload.eventType === 'INSERT') {
            if (prev.find((h) => h.id === payload.new.id)) return prev;
            return [payload.new, ...prev];
          }
          if (payload.eventType === 'UPDATE') {
            return prev.map((h) => (h.id === payload.new.id ? payload.new : h));
          }
          if (payload.eventType === 'DELETE') {
            return prev.filter((h) => h.id !== payload.old.id);
          }
          return prev;
        });
      });
    })();
    return () => { cancelled = true; if (off) off(); };
  }, [activeTeamId]);

  // ── Case memory (incidents, interventions, outcomes) ─────────
  const [caseMemoryCloud, setCaseMemoryCloud] = useState({
    incidents: [], interventions: [], outcomes: [],
  });
  useEffect(() => {
    if (!activeTeamId) {
      setCaseMemoryCloud({ incidents: [], interventions: [], outcomes: [] });
      return;
    }
    let cancelled = false;
    let off;
    (async () => {
      try {
        const initial = await pullCaseMemory(activeTeamId);
        if (!cancelled) setCaseMemoryCloud(initial);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('[caseMemory] initial load failed', e);
      }
      if (cancelled) return;
      off = subscribeCaseMemory(activeTeamId, (kind, payload) => {
        const pluralKey = { incident: 'incidents', intervention: 'interventions', outcome: 'outcomes' }[kind];
        if (!pluralKey) return;
        setCaseMemoryCloud((prev) => {
          const list = prev[pluralKey] || [];
          if (payload.eventType === 'INSERT') {
            if (list.find((x) => x.id === payload.new.id)) return prev;
            return { ...prev, [pluralKey]: [payload.new, ...list] };
          }
          if (payload.eventType === 'UPDATE') {
            return { ...prev, [pluralKey]: list.map((x) => (x.id === payload.new.id ? payload.new : x)) };
          }
          if (payload.eventType === 'DELETE') {
            return { ...prev, [pluralKey]: list.filter((x) => x.id !== payload.old.id) };
          }
          return prev;
        });
      });
    })();
    return () => { cancelled = true; if (off) off(); };
  }, [activeTeamId]);

  // Reload teams list — used after admin actions (promotion, pause, etc.)
  const reloadTeams = useCallback(async () => {
    if (!session) return;
    const t = await getMyTeams();
    setTeams(t);
  }, [session]);

  const value = useMemo(() => ({
    session,
    user: session?.user || null,
    authReady,
    teams,
    activeTeam,
    activeTeamId,
    teamsLoading,
    currentRole,
    isAdmin,
    isSub,
    subLockedOut,
    teamStudents,
    sharedLogs,
    handoffs,
    caseMemoryCloud,
    cloudSyncError,
    setActiveTeamId,
    clearCloudSyncError: () => setCloudSyncError(null),
    reportCloudError,
    reloadTeams,
    signInWithGoogle,
    signOut: async () => {
      await signOut();
      setSession(null);
      setTeams([]);
      setActiveTeamId(null);
    },
    createTeam: async (name, display) => {
      const t = await createTeam(name, display);
      const mapped = {
        id: t.id,
        name: t.name,
        inviteCode: t.invite_code,
        role: 'owner',
        displayName: display,
      };
      setTeams((ts) => [...ts, mapped]);
      setActiveTeamId(t.id);
      return mapped;
    },
    joinTeamByCode: async (code, display, requestedRole = 'para') => {
      const t = await joinTeamByCode(code, display, requestedRole);
      await claimPendingAssignments().catch(() => {});
      // We don't know the final role without a reload (server validates and
      // may coerce to 'para' if requestedRole was invalid). Reload instead
      // of guessing.
      const all = await getMyTeams();
      setTeams(all);
      setActiveTeamId(t.id);
      return all.find(x => x.id === t.id);
    },
    joinTeamAsOwner: async (code, display) => {
      const t = await joinTeamAsOwner(code, display);
      await claimPendingAssignments().catch(() => {});
      const all = await getMyTeams();
      setTeams(all);
      setActiveTeamId(t.id);
      return all.find(x => x.id === t.id);
    },
    regenerateInviteCode: async () => {
      if (!activeTeamId) return null;
      const code = await regenerateInviteCode(activeTeamId);
      setTeams((ts) => ts.map((t) => (t.id === activeTeamId ? { ...t, inviteCode: code } : t)));
      return code;
    },
    regenerateOwnerCode: async () => {
      if (!activeTeamId) return null;
      const { regenerateOwnerCode } = await import('../services/teamSync');
      const code = await regenerateOwnerCode(activeTeamId);
      setTeams((ts) => ts.map((t) => (t.id === activeTeamId ? { ...t, ownerCode: code } : t)));
      return code;
    },
  }), [
    session, authReady, teams, activeTeam, activeTeamId, teamsLoading,
    currentRole, isAdmin, isSub, subLockedOut,
    teamStudents, sharedLogs, handoffs, caseMemoryCloud, cloudSyncError, reportCloudError, reloadTeams,
  ]);

  return <TeamContext.Provider value={value}>{children}</TeamContext.Provider>;
}
