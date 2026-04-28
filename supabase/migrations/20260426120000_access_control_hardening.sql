-- Access-control hardening:
--   * paused members cannot keep using table APIs
--   * subs respect teams.allow_subs at the RLS layer
--   * paras/subs only read assigned students
--   * roster writes are admin-only
--   * assignment RPCs cannot point at students from another team

create or replace function can_access_team(tid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from team_members tm
    join teams t on t.id = tm.team_id
    where tm.team_id = tid
      and tm.user_id = auth.uid()
      and tm.active = true
      and (tm.role <> 'sub' or t.allow_subs = true)
  );
$$;

revoke all on function can_access_team(uuid) from public;
grant execute on function can_access_team(uuid) to authenticated;

create or replace function is_assigned_student(sid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from para_assignments pa
    join team_students s on s.id = pa.student_id and s.team_id = pa.team_id
    where pa.student_id = sid
      and pa.para_user_id = auth.uid()
      and can_access_team(pa.team_id)
  );
$$;

revoke all on function is_assigned_student(uuid) from public;
grant execute on function is_assigned_student(uuid) to authenticated;

-- Keep older helper name but make it honor active/sub-lock status.
create or replace function is_team_member(tid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select can_access_team(tid);
$$;

revoke all on function is_team_member(uuid) from public;
grant execute on function is_team_member(uuid) to authenticated;

create or replace function is_member_of_team(tid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select can_access_team(tid);
$$;

revoke all on function is_member_of_team(uuid) from public;
grant execute on function is_member_of_team(uuid) to authenticated;

drop policy if exists "read teams I'm in" on teams;
drop policy if exists "members read teams" on teams;
create policy "read teams I can access"
  on teams for select
  using (can_access_team(id));

drop policy if exists "owner update team" on teams;
create policy "admin update team"
  on teams for update
  using (is_team_admin(id))
  with check (is_team_admin(id));

-- Team roster:
--   * admins see/write all
--   * paras/subs see assigned students
--   * active allowed members can add and maintain rows they created
drop policy if exists "members read team students" on team_students;
create policy "read team students by role"
  on team_students for select
  using (
    is_team_admin(team_id)
    or (can_access_team(team_id) and is_assigned_student(id))
    or (can_access_team(team_id) and created_by = auth.uid())
  );

drop policy if exists "members insert team students" on team_students;
create policy "members insert own team students"
  on team_students for insert
  with check (
    can_access_team(team_id)
    and (created_by is null or created_by = auth.uid())
  );

drop policy if exists "members update team students" on team_students;
create policy "update team students by role"
  on team_students for update
  using (
    is_team_admin(team_id)
    or (can_access_team(team_id) and created_by = auth.uid())
  )
  with check (
    is_team_admin(team_id)
    or (can_access_team(team_id) and created_by = auth.uid())
  );

-- Repeated imports should update the same roster row when an external key exists.
create unique index if not exists team_students_team_external_key_uidx
  on team_students (team_id, external_key);

-- Observation tables: active/sub-allowed team access only.
drop policy if exists "read team logs" on logs;
create policy "read team logs"
  on logs for select
  using (can_access_team(team_id) and (shared = true or user_id = auth.uid()));

drop policy if exists "insert own logs" on logs;
create policy "insert own logs"
  on logs for insert
  with check (user_id = auth.uid() and can_access_team(team_id));

drop policy if exists "read team incidents" on incidents;
create policy "read team incidents"
  on incidents for select using (can_access_team(team_id));
drop policy if exists "insert own incidents" on incidents;
create policy "insert own incidents"
  on incidents for insert with check (user_id = auth.uid() and can_access_team(team_id));

drop policy if exists "read team interventions" on interventions;
create policy "read team interventions"
  on interventions for select using (can_access_team(team_id));
drop policy if exists "insert own interventions" on interventions;
create policy "insert own interventions"
  on interventions for insert with check (user_id = auth.uid() and can_access_team(team_id));

drop policy if exists "read team outcomes" on outcomes;
create policy "read team outcomes"
  on outcomes for select using (can_access_team(team_id));
drop policy if exists "insert own outcomes" on outcomes;
create policy "insert own outcomes"
  on outcomes for insert with check (user_id = auth.uid() and can_access_team(team_id));

drop policy if exists "read team handoffs" on handoffs;
create policy "read team handoffs"
  on handoffs for select using (can_access_team(team_id));
drop policy if exists "insert own handoffs" on handoffs;
create policy "insert own handoffs"
  on handoffs for insert with check (from_user_id = auth.uid() and can_access_team(team_id));
drop policy if exists "ack team handoffs" on handoffs;
create policy "ack team handoffs"
  on handoffs for update using (can_access_team(team_id));

-- Assignments: self reads also require current active access.
drop policy if exists "read assignments self" on para_assignments;
create policy "read assignments self"
  on para_assignments for select
  using (para_user_id = auth.uid() and can_access_team(team_id));

create or replace function assign_students(
  tid uuid,
  para_uid uuid,
  para_email text,
  student_ids uuid[]
) returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted int := 0;
  sid uuid;
begin
  if not is_team_admin(tid) then
    raise exception 'not authorized';
  end if;
  if para_uid is null and (para_email is null or trim(para_email) = '') then
    raise exception 'must provide either para_uid or para_email';
  end if;
  if para_uid is not null and not exists (
    select 1 from team_members
    where team_id = tid
      and user_id = para_uid
      and active = true
      and role in ('para', 'sub')
  ) then
    raise exception 'target user is not an active para/sub on this team';
  end if;

  foreach sid in array student_ids loop
    if not exists (select 1 from team_students where id = sid and team_id = tid) then
      raise exception 'student % does not belong to this team', sid;
    end if;

    insert into para_assignments (team_id, student_id, para_user_id, pending_email, assigned_by)
    values (
      tid, sid, para_uid,
      case when para_uid is null then lower(trim(para_email)) else null end,
      auth.uid()
    )
    on conflict do nothing;
    if found then inserted := inserted + 1; end if;
  end loop;

  return inserted;
end;
$$;

revoke all on function assign_students(uuid, uuid, text, uuid[]) from public;
grant execute on function assign_students(uuid, uuid, text, uuid[]) to authenticated;

create or replace function claim_pending_assignments()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  email text := lower(trim((auth.jwt() ->> 'email')::text));
  claimed int;
begin
  if email is null or email = '' then
    return 0;
  end if;

  update para_assignments pa
  set    para_user_id = auth.uid(),
         pending_email = null
  where  pa.pending_email = email
    and  pa.para_user_id is null
    and  exists (
      select 1 from team_members tm
      where tm.team_id = pa.team_id
        and tm.user_id = auth.uid()
        and tm.active = true
        and tm.role in ('para', 'sub')
    );
  get diagnostics claimed = row_count;
  return claimed;
end;
$$;

revoke all on function claim_pending_assignments() from public;
grant execute on function claim_pending_assignments() to authenticated;

drop view if exists my_assigned_students;
create view my_assigned_students
with (security_invoker = true)
as
select s.*
from   team_students s
join   para_assignments pa
  on   pa.student_id = s.id
 and   pa.team_id = s.team_id
where  pa.para_user_id = auth.uid()
  and  can_access_team(pa.team_id);

grant select on my_assigned_students to authenticated;
