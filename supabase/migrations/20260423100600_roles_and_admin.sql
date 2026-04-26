-- Phase 2: role system + admin primitives
--
-- Roles (team_members.role):
--   owner         — first creator, full admin rights (god access)
--   sped_teacher  — Special Ed Teacher, full admin rights
--   para          — default. Sees IEP Summary, logs, handoffs, case memory.
--                   Does NOT see parent notes.
--   sub           — substitute para. Same as para UNLESS the team's
--                   allow_subs = false, in which case they see a locked screen.
--
-- Admin (owner + sped_teacher) can:
--   • promote/demote members
--   • pause (active = false) a member
--   • toggle allow_subs
--   • read/write parent_notes
--   • regenerate invite code

-- ── Expand role check constraint ─────────────────────────────
alter table team_members
  drop constraint if exists team_members_role_check;
alter table team_members
  add constraint team_members_role_check
  check (role in ('owner', 'sped_teacher', 'para', 'sub', 'member'));
-- 'member' kept for backward compat with rows created before Phase 2.

-- ── Active flag (admin can pause a user) ─────────────────────
alter table team_members
  add column if not exists active boolean not null default true;

-- ── Team-level toggle for subs ───────────────────────────────
alter table teams
  add column if not exists allow_subs boolean not null default true;

-- ── Parent notes table (Sped-only) ───────────────────────────
-- Kept separate from team_students so RLS can restrict reads to admins
-- without taking the whole student row away from paras.
create table if not exists parent_notes (
  id           uuid primary key default gen_random_uuid(),
  team_id      uuid not null references teams on delete cascade,
  student_id   uuid not null references team_students on delete cascade,
  body         text not null check (length(trim(body)) > 0),
  created_by   uuid references auth.users on delete set null,
  created_at   timestamptz default now()
);

create index if not exists parent_notes_team_student_idx
  on parent_notes (team_id, student_id, created_at desc);

-- ── is_team_admin helper (owner + sped_teacher) ──────────────
-- security definer so it can read team_members without triggering RLS recursion.
create or replace function is_team_admin(tid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from team_members
    where team_id = tid
      and user_id = auth.uid()
      and active = true
      and role in ('owner', 'sped_teacher')
  );
$$;

revoke all on function is_team_admin(uuid) from public;
grant execute on function is_team_admin(uuid) to authenticated;

-- ── RLS for parent_notes: admins only ────────────────────────
alter table parent_notes enable row level security;

drop policy if exists "admins read parent notes" on parent_notes;
create policy "admins read parent notes"
  on parent_notes for select using (is_team_admin(team_id));

drop policy if exists "admins insert parent notes" on parent_notes;
create policy "admins insert parent notes"
  on parent_notes for insert
  with check (is_team_admin(team_id) and created_by = auth.uid());

drop policy if exists "admins delete parent notes" on parent_notes;
create policy "admins delete parent notes"
  on parent_notes for delete using (is_team_admin(team_id));

-- ── Admin RPCs (security definer, gated by is_team_admin) ────

-- Set a team member's role. Only admins can call. An admin cannot
-- demote the last admin of a team (prevents lockout).
create or replace function set_member_role(tid uuid, uid uuid, new_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare admin_count int;
begin
  if not is_team_admin(tid) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if new_role not in ('owner', 'sped_teacher', 'para', 'sub') then
    raise exception 'Invalid role: %', new_role using errcode = '22023';
  end if;
  -- Lockout guard: if we're demoting a current admin and they're the last one, reject.
  if new_role not in ('owner', 'sped_teacher') then
    select count(*) into admin_count
      from team_members
      where team_id = tid and role in ('owner', 'sped_teacher') and active = true;
    if admin_count <= 1 and exists(
      select 1 from team_members
      where team_id = tid and user_id = uid and role in ('owner','sped_teacher')
    ) then
      raise exception 'Cannot demote the last active admin' using errcode = 'P0001';
    end if;
  end if;
  update team_members set role = new_role where team_id = tid and user_id = uid;
end $$;

revoke all on function set_member_role(uuid, uuid, text) from public;
grant execute on function set_member_role(uuid, uuid, text) to authenticated;

-- Pause or reactivate a member's access. Admin only. Can't pause self if
-- you're the last active admin.
create or replace function set_member_active(tid uuid, uid uuid, is_active boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare admin_count int;
begin
  if not is_team_admin(tid) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if is_active = false then
    select count(*) into admin_count
      from team_members
      where team_id = tid and role in ('owner','sped_teacher') and active = true;
    if admin_count <= 1 and exists(
      select 1 from team_members
      where team_id = tid and user_id = uid and role in ('owner','sped_teacher')
    ) then
      raise exception 'Cannot pause the last active admin' using errcode = 'P0001';
    end if;
  end if;
  update team_members set active = is_active where team_id = tid and user_id = uid;
end $$;

revoke all on function set_member_active(uuid, uuid, boolean) from public;
grant execute on function set_member_active(uuid, uuid, boolean) to authenticated;

-- Remove a member from a team. Admin only. Same last-admin guard.
create or replace function remove_member(tid uuid, uid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare admin_count int;
begin
  if not is_team_admin(tid) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  select count(*) into admin_count
    from team_members
    where team_id = tid and role in ('owner','sped_teacher') and active = true;
  if admin_count <= 1 and exists(
    select 1 from team_members
    where team_id = tid and user_id = uid and role in ('owner','sped_teacher')
  ) then
    raise exception 'Cannot remove the last active admin' using errcode = 'P0001';
  end if;
  delete from team_members where team_id = tid and user_id = uid;
end $$;

revoke all on function remove_member(uuid, uuid) from public;
grant execute on function remove_member(uuid, uuid) to authenticated;

-- Toggle whether subs can use the app at all. Admin only.
create or replace function set_team_allow_subs(tid uuid, allow boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_team_admin(tid) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  update teams set allow_subs = allow where id = tid;
end $$;

revoke all on function set_team_allow_subs(uuid, boolean) from public;
grant execute on function set_team_allow_subs(uuid, boolean) to authenticated;

-- Add a parent note. Admin only. created_by is forced to auth.uid().
create or replace function add_parent_note(tid uuid, sid uuid, note_body text)
returns parent_notes
language plpgsql
security definer
set search_path = public
as $$
declare note parent_notes;
begin
  if not is_team_admin(tid) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  insert into parent_notes (team_id, student_id, body, created_by)
  values (tid, sid, note_body, auth.uid())
  returning * into note;
  return note;
end $$;

revoke all on function add_parent_note(uuid, uuid, text) from public;
grant execute on function add_parent_note(uuid, uuid, text) to authenticated;

-- ── Promote the first team creator to sped_teacher ──────────
-- For users who joined in Phase 1 as 'owner' (pre-Phase-2), their role
-- stays 'owner' which counts as admin via is_team_admin. No migration
-- needed. This comment is here to make that explicit.

-- ── Upgrade team_members read policy to hide inactive members
-- from the team's regular members (so a paused sub doesn't show in
-- the member list to other paras). Admins still see everyone.
drop policy if exists "read members of teams I'm in" on team_members;
create policy "read members of teams I'm in"
  on team_members for select
  using (
    is_member_of_team(team_id)
    and (active = true or is_team_admin(team_id))
  );
