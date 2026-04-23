// All Supabase-facing code lives here. Components never import supabaseClient directly.
// Every cloud-bound payload passes through assertSafe + stripUnsafeKeys.

import { supabase } from './supabaseClient';
import { stripUnsafeKeys, assertSafe } from './stripUnsafeKeys';

function requireClient() {
  if (!supabase) throw new Error('Supabase not configured. Check .env.local.');
}

// ---------- Auth ----------

export async function signInWithGoogle() {
  requireClient();
  const redirectTo = typeof window !== 'undefined' ? window.location.origin : undefined;
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo },
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  requireClient();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  requireClient();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export function onAuthStateChange(cb) {
  requireClient();
  const { data } = supabase.auth.onAuthStateChange((_event, session) => cb(session));
  return () => data.subscription.unsubscribe();
}

// ---------- Teams ----------

export async function createTeam(name, displayName) {
  requireClient();
  const { data, error } = await supabase.rpc('create_team', {
    team_name: name,
    display: displayName,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function joinTeamByCode(code, displayName) {
  requireClient();
  const { data, error } = await supabase.rpc('join_team_by_code', {
    code,
    display: displayName,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function getMyTeams() {
  requireClient();
  const { data, error } = await supabase
    .from('team_members')
    .select('team_id, role, display_name, teams(id, name, invite_code)')
    .order('joined_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data || []).map((row) => ({
    id: row.teams.id,
    name: row.teams.name,
    inviteCode: row.teams.invite_code,
    role: row.role,
    displayName: row.display_name,
  }));
}

export async function regenerateInviteCode(teamId) {
  requireClient();
  const { data, error } = await supabase.rpc('regenerate_invite_code', { tid: teamId });
  if (error) throw new Error(error.message);
  return data;
}

// ---------- Utility: safe cloud write wrapper ----------

export function sanitize(payload, label) {
  assertSafe(payload, label);
  return stripUnsafeKeys(payload);
}
