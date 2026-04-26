-- ══════════════════════════════════════════════════════════════
-- PARA ASSIGNMENTS — sped teacher manually assigns students to paras
--
-- Sped teacher (owner / sped_teacher) checks boxes on a dashboard:
-- "Para Maria gets these 7 students." Stored here keyed by Para App
-- Number, never by name. Names stay on the device.
--
-- Two ways to assign:
--   A) Para already has an account → set para_user_id directly.
--   B) Para has no account yet → set pending_email; when that user
--      signs in via Google OAuth, claim_pending_assignments() binds
--      pending_email to their auth.uid().
-- ══════════════════════════════════════════════════════════════

create table para_assignments (
  id            uuid primary key default gen_random_uuid(),
  team_id       uuid not null references teams on delete cascade,
  student_id    uuid not null references team_students on delete cascade,
  para_user_id  uuid references auth.users on delete cascade,
  pending_email text,
  assigned_by   uuid not null references auth.users on delete cascade,
  assigned_at   timestamptz not null default now(),

  -- Either bind to a user or pre-register by email — never both null.
  constraint para_assignments_target_check
    check (para_user_id is not null or pending_email is not null),

  -- One assignment per (student, para) pair — bound or pending.
  constraint para_assignments_unique_bound
    unique (team_id, student_id, para_user_id),
  constraint para_assignments_unique_pending
    unique (team_id, student_id, pending_email)
);

create index para_assignments_para_idx on para_assignments (para_user_id, team_id);
create index para_assignments_pending_idx on para_assignments (pending_email);

alter table para_assignments enable row level security;

-- Admins (owner / sped_teacher) can read all assignments in their team.
-- Paras can read their own assignments only.
create policy "read assignments admin"
  on para_assignments for select
  using (is_team_admin(team_id));

create policy "read assignments self"
  on para_assignments for select
  using (para_user_id = auth.uid());

-- Only admins write (via RPCs below).
create policy "insert assignments admin"
  on para_assignments for insert
  with check (is_team_admin(team_id) and assigned_by = auth.uid());

create policy "delete assignments admin"
  on para_assignments for delete
  using (is_team_admin(team_id));

-- ── RPC: assign one or more students to a para ─────────────────
-- Either pass para_user_id (existing user) or pending_email (pre-reg).
-- If both are null → error. If both set → user_id wins, email is
-- stored only as a hint label for the admin UI.
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

  foreach sid in array student_ids loop
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

-- ── RPC: unassign one or more students ─────────────────────────
create or replace function unassign_students(
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
  removed int;
begin
  if not is_team_admin(tid) then
    raise exception 'not authorized';
  end if;

  delete from para_assignments
  where team_id = tid
    and student_id = any(student_ids)
    and (
      (para_uid is not null and para_user_id = para_uid)
      or (para_email is not null and pending_email = lower(trim(para_email)))
    );
  get diagnostics removed = row_count;
  return removed;
end;
$$;

revoke all on function unassign_students(uuid, uuid, text, uuid[]) from public;
grant execute on function unassign_students(uuid, uuid, text, uuid[]) to authenticated;

-- ── RPC: para claims pending assignments on first sign-in ──────
-- Idempotent — safe to call on every sign-in.
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

  update para_assignments
  set    para_user_id = auth.uid(),
         pending_email = null
  where  pending_email = email
    and  para_user_id is null;
  get diagnostics claimed = row_count;
  return claimed;
end;
$$;

revoke all on function claim_pending_assignments() from public;
grant execute on function claim_pending_assignments() to authenticated;

-- ── View: a para's assigned students with denormalized fields ──
-- Lets the para's app fetch their roster in one query.
create or replace view my_assigned_students as
select s.*
from   team_students s
join   para_assignments pa on pa.student_id = s.id
where  pa.para_user_id = auth.uid();

grant select on my_assigned_students to authenticated;
