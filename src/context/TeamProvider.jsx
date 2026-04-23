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
} from '../services/teamSync';
import { supabaseConfigured } from '../services/supabaseClient';

const TeamContext = createContext(null);

export function useTeam() {
  const v = useContext(TeamContext);
  if (!v) throw new Error('useTeam must be used inside <TeamProvider>');
  return v;
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

  const value = useMemo(() => ({
    session,
    user: session?.user || null,
    authReady,
    teams,
    activeTeam,
    activeTeamId,
    teamsLoading,
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
  }), [session, authReady, teams, activeTeam, activeTeamId, teamsLoading]);

  return <TeamContext.Provider value={value}>{children}</TeamContext.Provider>;
}
