import { supabase, supabaseConfigured } from './supabaseClient';

// All payloads are Para App Number / student_id / email — never real names.
// The sped teacher can SEE names locally, but we never send them here.

export async function listAssignments(teamId) {
  if (!supabaseConfigured) return { data: [], error: null };
  const { data, error } = await supabase
    .from('para_assignments')
    .select('id, student_id, para_user_id, pending_email, assigned_at')
    .eq('team_id', teamId);
  return { data: data || [], error };
}

export async function listMyAssignedStudents() {
  if (!supabaseConfigured) return { data: [], error: null };
  const { data, error } = await supabase
    .from('my_assigned_students')
    .select('*');
  return { data: data || [], error };
}

export async function assignStudents({ teamId, paraUserId = null, paraEmail = null, studentIds }) {
  if (!supabaseConfigured) return { data: 0, error: new Error('cloud not configured') };
  const { data, error } = await supabase.rpc('assign_students', {
    tid: teamId,
    para_uid: paraUserId,
    para_email: paraEmail,
    student_ids: studentIds,
  });
  return { data: data ?? 0, error };
}

export async function unassignStudents({ teamId, paraUserId = null, paraEmail = null, studentIds }) {
  if (!supabaseConfigured) return { data: 0, error: new Error('cloud not configured') };
  const { data, error } = await supabase.rpc('unassign_students', {
    tid: teamId,
    para_uid: paraUserId,
    para_email: paraEmail,
    student_ids: studentIds,
  });
  return { data: data ?? 0, error };
}

// Call after every sign-in. Idempotent. Binds pending email assignments
// to the now-signed-in user.
export async function claimPendingAssignments() {
  if (!supabaseConfigured) return { data: 0, error: null };
  const { data, error } = await supabase.rpc('claim_pending_assignments');
  return { data: data ?? 0, error };
}
