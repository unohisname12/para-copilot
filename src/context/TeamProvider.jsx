// React context for auth + team membership. Later phases extend it with
// teamStudents, sharedLogs, handoffs, caseMemory subscriptions.

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  onAuthStateChange,
  getSession,
  signInWithGoogle,
  signOut,
  getMyTeams,
  createTeam,
  joinTeamByCode,
  regenerateInviteCode,
  getTeamStudents,
  subscribeTeamStudents,
  pullSharedTeamLogs,
  subscribeSharedLogs,
  pullRecentHandoffs,
  subscribeHandoffs,
  pullCaseMemory,
  subscribeCaseMemory,
} from '../services/teamSync';
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

export function TeamProvider({ children }) {
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [teams, setTeams] = useState([]);
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
    if (!session) { setTeams([]); setActiveTeamId(null); return; }
    let cancelled = false;
    setTeamsLoading(true);
    (async () => {
      try {
        const t = await getMyTeams();
        if (cancelled) return;
        setTeams(t);
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

  const [teamStudents, setTeamStudents] = useState([]);

  useEffect(() => {
    if (!activeTeamId) { setTeamStudents([]); return; }
    let cancelled = false;
    let off;
    (async () => {
      try {
        const initial = await getTeamStudents(activeTeamId);
        if (cancelled) return;
        setTeamStudents(initial);
      } catch (e) {
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
  }, [activeTeamId]);

  // ── Shared team logs ─────────────────────────────────────────
  const [sharedLogs, setSharedLogs] = useState([]);
  useEffect(() => {
    if (!activeTeamId) { setSharedLogs([]); return; }
    let cancelled = false;
    let off;
    (async () => {
      try {
        const initial = await pullSharedTeamLogs(activeTeamId);
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
      });
    })();
    return () => { cancelled = true; if (off) off(); };
  }, [activeTeamId]);

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

  const value = useMemo(() => ({
    session,
    user: session?.user || null,
    authReady,
    teams,
    activeTeam,
    activeTeamId,
    teamsLoading,
    teamStudents,
    sharedLogs,
    handoffs,
    caseMemoryCloud,
    setActiveTeamId,
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
    joinTeamByCode: async (code, display) => {
      const t = await joinTeamByCode(code, display);
      const mapped = {
        id: t.id,
        name: t.name,
        inviteCode: t.invite_code,
        role: 'member',
        displayName: display,
      };
      setTeams((ts) => (ts.find((x) => x.id === t.id) ? ts : [...ts, mapped]));
      setActiveTeamId(t.id);
      return mapped;
    },
    regenerateInviteCode: async () => {
      if (!activeTeamId) return null;
      const code = await regenerateInviteCode(activeTeamId);
      setTeams((ts) => ts.map((t) => (t.id === activeTeamId ? { ...t, inviteCode: code } : t)));
      return code;
    },
  }), [
    session, authReady, teams, activeTeam, activeTeamId, teamsLoading,
    teamStudents, sharedLogs, handoffs, caseMemoryCloud,
  ]);

  return <TeamContext.Provider value={value}>{children}</TeamContext.Provider>;
}
