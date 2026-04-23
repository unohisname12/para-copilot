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

// ---------- team_students ----------

// Map app-shape student → DB row. Intentionally drops any realName field.
// (stripUnsafeKeys is the backstop; this function is the explicit contract.)
function toTeamStudentRow(teamId, s, userId) {
  return {
    team_id: teamId,
    pseudonym: s.pseudonym,
    color: s.color,
    period_id: s.periodId || s.period_id || null,
    class_label: s.classLabel || s.class_label || null,
    eligibility: s.eligibility || null,
    accs: s.accs || [],
    goals: s.goals || [],
    case_manager: s.caseManager || s.case_manager || null,
    grade_level: s.gradeLevel || s.grade_level || null,
    tags: s.tags || [],
    flags: s.flags || {},
    watch_fors: s.watchFors || s.watch_fors || [],
    do_this_actions: s.doThisActions || s.do_this_actions || [],
    health_notes: s.healthNotes || s.health_notes || [],
    cross_period: s.crossPeriodInfo || s.cross_period || {},
    source_meta: s.sourceMeta || s.source_meta || {},
    external_key: s.externalStudentKey || s.external_key || null,
    created_by: userId,
  };
}

export async function pushStudents(teamId, students, userId) {
  requireClient();
  if (!teamId || !students || students.length === 0) return [];
  const rows = students.map((s) =>
    sanitize(toTeamStudentRow(teamId, s, userId), 'team_students row')
  );
  const { data, error } = await supabase.from('team_students').insert(rows).select();
  if (error) throw new Error(error.message);
  return data || [];
}

export async function getTeamStudents(teamId) {
  requireClient();
  const { data, error } = await supabase
    .from('team_students')
    .select('*')
    .eq('team_id', teamId)
    .order('period_id', { ascending: true });
  if (error) throw new Error(error.message);
  return data || [];
}

export function subscribeTeamStudents(teamId, onChange) {
  requireClient();
  const channel = supabase
    .channel(`team_students:${teamId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'team_students', filter: `team_id=eq.${teamId}` },
      (payload) => onChange(payload)
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}
