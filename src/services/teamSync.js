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

// Mirrors the SQL `lower(regexp_replace(name, '[^a-z0-9]', '', 'g'))` — must
// stay in sync with the generated column in the team_normalized_name
// migration so client checks line up with what the DB stores.
export function normalizeTeamName(name) {
  if (name == null) return '';
  return String(name).toLowerCase().replace(/[^a-z0-9]/g, '');
}

// ── Owner codes ──────────────────────────────────────────────
// Owner codes are how a sped teacher / owner joins an existing team.
// Format is `OWN-XXXXXXXX` (4-char prefix + 8 random alphanumerics) so the
// client can auto-detect them in the join form vs the para invite code.
const OWNER_CODE_RE = /^own-[a-z0-9]{6,12}$/i;

export function isOwnerCode(code) {
  if (!code) return false;
  return OWNER_CODE_RE.test(String(code).trim());
}

// Join an existing team as a sped teacher / owner. Server-side RPC validates
// the code, inserts a team_members row with role='sped_teacher'.
export async function joinTeamAsOwner(code, displayName) {
  requireClient();
  const cleaned = String(code || '').trim().toUpperCase();
  const display = String(displayName || '').trim();
  if (!cleaned) throw new Error('Owner code required');
  if (!display) throw new Error('Display name required');
  const { data, error } = await supabase.rpc('join_team_as_owner', {
    code: cleaned,
    display,
  });
  if (error) throw new Error(error.message);
  return data;
}

// Owner-only — generate a new owner code for a team and return it. Old code
// is invalidated. Server checks the caller is an owner of the team.
export async function regenerateOwnerCode(teamId) {
  if (!teamId) throw new Error('team id required');
  requireClient();
  const { data, error } = await supabase.rpc('regenerate_owner_code', { tid: teamId });
  if (error) throw new Error(error.message);
  return data;
}

// Find existing teams whose normalized name matches the candidate. Used by
// the create-team flow to warn when a para is about to make a duplicate.
export async function findSimilarTeam(name) {
  const candidate = normalizeTeamName(name);
  if (!candidate) return [];
  requireClient();
  const { data, error } = await supabase.rpc('find_similar_team', { candidate });
  if (error) throw new Error(error.message);
  return data || [];
}

export async function createTeam(name, displayName) {
  requireClient();
  const { data, error } = await supabase.rpc('create_team', {
    team_name: name,
    display: displayName,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function joinTeamByCode(code, displayName, requestedRole = 'para') {
  requireClient();
  // requestedRole is validated server-side — only 'para' or 'sub' are
  // honored. Admin roles must be granted by an existing admin.
  const { data, error } = await supabase.rpc('join_team_by_code', {
    code,
    display: displayName,
    requested_role: requestedRole,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function getMyTeams() {
  requireClient();
  const { data, error } = await supabase
    .from('team_members')
    .select('team_id, role, display_name, active, teams(id, name, invite_code, owner_code, allow_subs)')
    .eq('active', true)
    .order('joined_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data || []).map((row) => ({
    id: row.teams.id,
    name: row.teams.name,
    inviteCode: row.teams.invite_code,
    ownerCode: row.teams.owner_code,
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
  // Only include fields that have actual content. The upsert path uses
  // ON CONFLICT DO UPDATE on the columns we send — if we send `accs: []`
  // for a re-upload that didn't carry IEP data, Postgres overwrites the
  // existing cloud accs with []. Omitting the column instead preserves
  // whatever's already on the row. This is what makes a "skinny" re-upload
  // (e.g. a name-list-only file) safe: cloud IEP data survives.
  const row = {
    team_id: teamId,
    pseudonym: s.pseudonym,
    color: s.color,
    external_key: s.paraAppNumber || s.externalKey || s.externalStudentKey || s.external_key || null,
    created_by: userId,
  };
  const periodId = s.periodId || s.period_id;
  if (periodId) row.period_id = periodId;

  // period_ids[]: full list of periods this kid belongs to. Cross-period
  // kids (e.g., a math student who shows up in both p3 and p6) need this
  // because the unique index on (team_id, external_key) collapses them
  // to ONE row, so we can't represent multi-period via duplicate rows.
  // Fall back to [periodId] when only the legacy single field is set so
  // the new read path always sees an array.
  const periodIds = Array.isArray(s.periodIds) ? s.periodIds.filter(Boolean) : null;
  if (periodIds && periodIds.length > 0) row.period_ids = periodIds;
  else if (periodId) row.period_ids = [periodId];
  const classLabel = s.classLabel || s.class_label;
  if (classLabel) row.class_label = classLabel;
  if (s.eligibility) row.eligibility = s.eligibility;
  if (Array.isArray(s.accs) && s.accs.length) row.accs = s.accs;
  if (Array.isArray(s.goals) && s.goals.length) row.goals = s.goals;
  const cm = s.caseManager || s.case_manager;
  if (cm) row.case_manager = cm;
  const gl = s.gradeLevel || s.grade_level;
  if (gl) row.grade_level = gl;
  if (Array.isArray(s.tags) && s.tags.length) row.tags = s.tags;
  if (s.flags && Object.keys(s.flags).length) row.flags = s.flags;
  const watchFors = s.watchFors || s.watch_fors;
  if (Array.isArray(watchFors) && watchFors.length) row.watch_fors = watchFors;
  const doThisActions = s.doThisActions || s.do_this_actions;
  if (Array.isArray(doThisActions) && doThisActions.length) row.do_this_actions = doThisActions;
  const healthNotes = s.healthNotes || s.health_notes;
  if (Array.isArray(healthNotes) && healthNotes.length) row.health_notes = healthNotes;
  const crossPeriod = s.crossPeriodInfo || s.cross_period;
  if (crossPeriod && (crossPeriod.note || (Array.isArray(crossPeriod.otherPeriods) && crossPeriod.otherPeriods.length))) {
    row.cross_period = crossPeriod;
  }
  const sourceMeta = s.sourceMeta || s.source_meta;
  if (sourceMeta && Object.keys(sourceMeta).length) row.source_meta = sourceMeta;
  return row;
}

export async function pushStudents(teamId, students, userId) {
  requireClient();
  if (!teamId || !students || students.length === 0) return [];
  const rows = students.map((s) =>
    sanitize(toTeamStudentRow(teamId, s, userId), 'team_students row')
  );
  const keyed = rows.filter((row) => row.external_key);
  const unkeyed = rows.filter((row) => !row.external_key);
  const written = [];

  if (keyed.length > 0) {
    const { data, error } = await supabase
      .from('team_students')
      .upsert(keyed, { onConflict: 'team_id,external_key' })
      .select();
    if (error) throw new Error(error.message);
    written.push(...(data || []));
  }

  if (unkeyed.length > 0) {
    const { data, error } = await supabase.from('team_students').insert(unkeyed).select();
    if (error) throw new Error(error.message);
    written.push(...(data || []));
  }

  // Auto-cleanup: every push by this uploader represents the canonical set
  // of THEIR contributions to the team roster. Any row in team_students where
  // created_by matches this user but external_key isn't in the keys we just
  // pushed is a stale leftover (algorithm change, kid removed, etc.) — delete
  // it. RLS + the created_by predicate make this multi-para safe: we only
  // ever touch rows the current user uploaded.
  // Skipped when keyed.length === 0 because we don't have a "keep" set —
  // running it would delete every row the uploader owns.
  if (keyed.length > 0 && userId) {
    const keepKeys = keyed.map(r => r.external_key);
    const inList = `(${keepKeys.map(k => String(k).replace(/[(),]/g, '')).join(',')})`;
    await supabase
      .from('team_students')
      .delete()
      .eq('team_id', teamId)
      .eq('created_by', userId)
      .not('external_key', 'in', inList)
      .select();
    // Don't throw on cleanup error — the upsert already succeeded; cleanup
    // is best-effort. Surfaced via console for debugging.
  }

  return written;
}

export async function getMyAssignedStudents() {
  requireClient();
  const { data, error } = await supabase
    .from('my_assigned_students')
    .select('*')
    .order('period_id', { ascending: true });
  if (error) throw new Error(error.message);
  return data || [];
}

// Delete every student record from team_students for this team. Owner /
// sped_teacher only — RLS enforces. Cascade rules on logs etc. fire as
// configured (set null for observation tables, cascade for parent_notes
// + para_assignments). Use case: starting a clean roster for a new term,
// or recovering from an import gone wrong.
export async function deleteAllTeamStudents(teamId) {
  requireClient();
  if (!teamId) throw new Error('deleteAllTeamStudents: teamId required');
  const { data, error } = await supabase
    .from('team_students')
    .delete()
    .eq('team_id', teamId)
    .select('id');
  if (error) throw new Error(error.message);
  return (data || []).length;
}

// Surgical cloud cleanup — used by the Roster Health Check "Wipe cloud
// orphans" button to remove individual stale rows by paraAppNumber rather
// than nuking the whole team table.
export async function deleteTeamStudentByExternalKey(teamId, externalKey) {
  requireClient();
  if (!teamId || !externalKey) throw new Error('deleteTeamStudentByExternalKey: teamId + externalKey required');
  const { error } = await supabase
    .from('team_students')
    .delete()
    .eq('team_id', teamId)
    .eq('external_key', String(externalKey).trim());
  if (error) throw new Error(error.message);
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

// Returns every team log the signed-in user is allowed to see — shared
// logs from any para PLUS the user's own logs (any shared status). Was
// `shared=true only` before, but that hid the user's own historical logs
// after a local reset, breaking the Vault's "show me everything from before
// the wipe" expectation.
export async function pullSharedTeamLogs(teamId, userId) {
  requireClient();
  let q = supabase.from('logs').select('*').eq('team_id', teamId);
  if (userId) {
    q = q.or(`shared.eq.true,user_id.eq.${userId}`);
  } else {
    q = q.eq('shared', true);
  }
  const { data, error } = await q
    .order('created_at', { ascending: false }).limit(1000);
  if (error) throw new Error(error.message);
  return data || [];
}

export function subscribeSharedLogs(teamId, onChange, userId) {
  requireClient();
  const channel = supabase
    .channel(`logs_shared:${teamId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'logs', filter: `team_id=eq.${teamId}` },
      (payload) => {
        if (!payload.new) return;
        if (payload.new.shared || (userId && payload.new.user_id === userId)) {
          onChange(payload);
        }
      }
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
