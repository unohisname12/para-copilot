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
    .select('team_id, role, display_name, active, teams(id, name, invite_code, allow_subs)')
    .eq('active', true)
    .order('joined_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data || []).map((row) => ({
    id: row.teams.id,
    name: row.teams.name,
    inviteCode: row.teams.invite_code,
    allowSubs: row.teams.allow_subs,
    role: row.role,
    displayName: row.display_name,
    active: row.active,
  }));
}

// ---------- Admin (owner / sped_teacher) ----------

export async function listTeamMembers(teamId) {
  requireClient();
  const { data, error } = await supabase
    .from('team_members')
    .select('team_id, user_id, role, display_name, active, joined_at')
    .eq('team_id', teamId)
    .order('joined_at', { ascending: true });
  if (error) throw new Error(error.message);
  return data || [];
}

export async function setMemberRole(teamId, userId, newRole) {
  requireClient();
  const { error } = await supabase.rpc('set_member_role', {
    tid: teamId, uid: userId, new_role: newRole,
  });
  if (error) throw new Error(error.message);
}

export async function setMemberActive(teamId, userId, isActive) {
  requireClient();
  const { error } = await supabase.rpc('set_member_active', {
    tid: teamId, uid: userId, is_active: isActive,
  });
  if (error) throw new Error(error.message);
}

export async function removeMember(teamId, userId) {
  requireClient();
  const { error } = await supabase.rpc('remove_member', { tid: teamId, uid: userId });
  if (error) throw new Error(error.message);
}

export async function setTeamAllowSubs(teamId, allow) {
  requireClient();
  const { error } = await supabase.rpc('set_team_allow_subs', { tid: teamId, allow });
  if (error) throw new Error(error.message);
}

// ---------- Parent notes (admin-only reads + writes) ----------

export async function listParentNotes(teamId, studentId) {
  requireClient();
  const { data, error } = await supabase
    .from('parent_notes')
    .select('*')
    .eq('team_id', teamId)
    .eq('student_id', studentId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data || [];
}

export async function addParentNote(teamId, studentId, body) {
  requireClient();
  const { data, error } = await supabase.rpc('add_parent_note', {
    tid: teamId, sid: studentId, note_body: body,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteParentNote(noteId) {
  requireClient();
  const { error } = await supabase.from('parent_notes').delete().eq('id', noteId);
  if (error) throw new Error(error.message);
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
    external_key: s.paraAppNumber || s.externalKey || s.externalStudentKey || s.external_key || null,
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

// ---------- Logs ----------

function toLogRow(teamId, userId, log) {
  return {
    team_id: teamId,
    user_id: userId,
    student_id: log.studentDbId || null,
    type: log.type || null,
    category: log.category || null,
    note: log.note || null,
    date: log.date || null,
    timestamp: log.timestamp || new Date().toISOString(),
    period_id: log.periodId || log.period || null,
    tags: log.tags || [],
    source: log.source || 'manual',
    situation_id: log.situationId || null,
    strategy_used: log.strategyUsed || null,
    goal_id: log.goalId || null,
    flagged: Boolean(log.flagged),
    shared: Boolean(log.shared),
  };
}

export async function pushLog(teamId, userId, log) {
  requireClient();
  const row = sanitize(toLogRow(teamId, userId, log), 'logs row');
  const { data, error } = await supabase.from('logs').insert(row).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function pullMyLogs(teamId, userId) {
  requireClient();
  const { data, error } = await supabase
    .from('logs').select('*').eq('team_id', teamId).eq('user_id', userId)
    .order('created_at', { ascending: false }).limit(1000);
  if (error) throw new Error(error.message);
  return data || [];
}

export async function pullSharedTeamLogs(teamId) {
  requireClient();
  const { data, error } = await supabase
    .from('logs').select('*').eq('team_id', teamId).eq('shared', true)
    .order('created_at', { ascending: false }).limit(500);
  if (error) throw new Error(error.message);
  return data || [];
}

export function subscribeSharedLogs(teamId, onChange) {
  requireClient();
  const channel = supabase
    .channel(`logs_shared:${teamId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'logs', filter: `team_id=eq.${teamId}` },
      (payload) => { if (payload.new?.shared) onChange(payload); }
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}

// ---------- Handoffs ----------

export async function pushHandoff(teamId, fromUserId, h) {
  requireClient();
  const row = sanitize({
    team_id: teamId,
    from_user_id: fromUserId,
    student_id: h.studentDbId || null,
    audience: h.audience || null,
    urgency: h.urgency || 'normal',
    body: h.body,
  }, 'handoffs row');
  const { data, error } = await supabase.from('handoffs').insert(row).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function pullRecentHandoffs(teamId) {
  requireClient();
  const { data, error } = await supabase
    .from('handoffs').select('*').eq('team_id', teamId)
    .gte('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false }).limit(50);
  if (error) throw new Error(error.message);
  return data || [];
}

export function subscribeHandoffs(teamId, onChange) {
  requireClient();
  const channel = supabase
    .channel(`handoffs:${teamId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'handoffs', filter: `team_id=eq.${teamId}` },
      (payload) => onChange(payload)
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}

export async function acknowledgeHandoff(handoffId, userId) {
  requireClient();
  const { data: existing, error: e1 } = await supabase
    .from('handoffs').select('acknowledged_by').eq('id', handoffId).single();
  if (e1) throw new Error(e1.message);
  const next = Array.from(new Set([...(existing.acknowledged_by || []), userId]));
  const { error: e2 } = await supabase
    .from('handoffs').update({ acknowledged_by: next }).eq('id', handoffId);
  if (e2) throw new Error(e2.message);
}

// ---------- Case memory ----------

export async function pushIncident(teamId, userId, incident) {
  requireClient();
  const row = sanitize({
    team_id: teamId,
    user_id: userId,
    student_id: incident.studentDbId || null,
    description: incident.description,
    period_id: incident.periodId || null,
    intensity: incident.intensity || null,
    triggers: incident.triggers || [],
    antecedent: incident.antecedent || null,
    behavior: incident.behavior || null,
    consequence: incident.consequence || null,
    duration_min: incident.durationMin || null,
    staff_response: incident.staffResponse || null,
    follow_up: incident.followUp || null,
  }, 'incidents row');
  const { data, error } = await supabase.from('incidents').insert(row).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function pushIntervention(teamId, userId, intervention) {
  requireClient();
  const row = sanitize({
    team_id: teamId,
    user_id: userId,
    incident_id: intervention.incidentId || null,
    student_id: intervention.studentDbId || null,
    strategy: intervention.strategy,
    notes: intervention.notes || null,
    worked: intervention.worked || 'unknown',
  }, 'interventions row');
  const { data, error } = await supabase.from('interventions').insert(row).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function pushOutcome(teamId, userId, outcome) {
  requireClient();
  const row = sanitize({
    team_id: teamId,
    user_id: userId,
    intervention_id: outcome.interventionId || null,
    student_id: outcome.studentDbId || null,
    result: outcome.result,
    notes: outcome.notes || null,
  }, 'outcomes row');
  const { data, error } = await supabase.from('outcomes').insert(row).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function pullCaseMemory(teamId) {
  requireClient();
  const [inc, intv, out] = await Promise.all([
    supabase.from('incidents').select('*').eq('team_id', teamId).order('created_at', { ascending: false }),
    supabase.from('interventions').select('*').eq('team_id', teamId).order('created_at', { ascending: false }),
    supabase.from('outcomes').select('*').eq('team_id', teamId).order('created_at', { ascending: false }),
  ]);
  if (inc.error) throw new Error(inc.error.message);
  if (intv.error) throw new Error(intv.error.message);
  if (out.error) throw new Error(out.error.message);
  return {
    incidents: inc.data || [],
    interventions: intv.data || [],
    outcomes: out.data || [],
  };
}

export function subscribeCaseMemory(teamId, onChange) {
  requireClient();
  const channel = supabase
    .channel(`case:${teamId}`)
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'incidents', filter: `team_id=eq.${teamId}` },
      (p) => onChange('incident', p))
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'interventions', filter: `team_id=eq.${teamId}` },
      (p) => onChange('intervention', p))
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'outcomes', filter: `team_id=eq.${teamId}` },
      (p) => onChange('outcome', p))
    .subscribe();
  return () => supabase.removeChannel(channel);
}
