-- Phase C of the team-joining UX overhaul:
--   Pending join requests. Lets a para hit a team's "request to join"
--   flow without needing an invite code, and lets owners approve/deny.

-- 1. Table
create table if not exists public.team_join_requests (
  id              uuid primary key default gen_random_uuid(),
  team_id         uuid not null references public.teams(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  display_name    text not null,
  message         text,
  requested_role  text not null default 'para'
                    check (requested_role in ('para','sub','sped_teacher')),
  status          text not null default 'pending'
                    check (status in ('pending','approved','denied')),
  decision_reason text,
  decided_at      timestamptz,
  decided_by      uuid references auth.users(id),
  created_at      timestamptz not null default now()
);

-- One pending request per (team, user). Approved/denied requests stay as
-- a history record but don't block re-requesting.
create unique index if not exists team_join_requests_one_pending
  on public.team_join_requests (team_id, user_id)
  where status = 'pending';

create index if not exists team_join_requests_team_status_idx
  on public.team_join_requests (team_id, status, created_at desc);

-- 2. RLS
alter table public.team_join_requests enable row level security;

-- Author can see their own requests (any status)
drop policy if exists "select_own" on public.team_join_requests;
create policy "select_own" on public.team_join_requests
  for select to authenticated
  using (user_id = auth.uid());

-- Team admins can see all requests for their team
drop policy if exists "admin_select_team" on public.team_join_requests;
create policy "admin_select_team" on public.team_join_requests
  for select to authenticated
  using (exists (
    select 1 from public.team_members tm
    where tm.team_id = team_join_requests.team_id
      and tm.user_id = auth.uid()
      and tm.role in ('owner','sped_teacher')
      and tm.active is not false
  ));

-- INSERT/UPDATE go through SECURITY DEFINER RPCs, so no direct policies.

-- 3. Para flow — request_to_join_team
create or replace function request_to_join_team(
  tid uuid, display text, msg text, requested text
)
returns team_join_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  trimmed_display text;
  rec team_join_requests;
  already_member boolean;
begin
  trimmed_display := nullif(trim(coalesce(display, '')), '');
  if tid is null then raise exception 'team id required' using errcode = '22023'; end if;
  if trimmed_display is null then raise exception 'display name required' using errcode = '22023'; end if;
  if requested is null or requested not in ('para','sub','sped_teacher') then
    requested := 'para';
  end if;

  -- Already a member? Don't allow a redundant request.
  select exists (
    select 1 from team_members
    where team_id = tid and user_id = auth.uid() and active is not false
  ) into already_member;
  if already_member then
    raise exception 'already a member of this team' using errcode = '22023';
  end if;

  -- Re-request after a denial: clear the prior denied row.
  delete from team_join_requests
   where team_id = tid and user_id = auth.uid() and status = 'denied';

  insert into team_join_requests (team_id, user_id, display_name, message, requested_role)
    values (tid, auth.uid(), trimmed_display, nullif(trim(coalesce(msg, '')), ''), requested)
    on conflict (team_id, user_id) where status = 'pending'
    do update set display_name = excluded.display_name,
                  message = excluded.message,
                  requested_role = excluded.requested_role
    returning * into rec;
  return rec;
end $$;

revoke all on function request_to_join_team(uuid, text, text, text) from public;
grant execute on function request_to_join_team(uuid, text, text, text) to authenticated;

-- 4. Owner flow — approve_join_request
create or replace function approve_join_request(rid uuid)
returns team_join_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  req team_join_requests;
  is_admin boolean;
begin
  select * into req from team_join_requests where id = rid;
  if not found then raise exception 'request not found' using errcode = '22023'; end if;
  if req.status <> 'pending' then
    raise exception 'request already %', req.status using errcode = '22023';
  end if;

  select exists (
    select 1 from team_members tm
    where tm.team_id = req.team_id and tm.user_id = auth.uid()
      and tm.role in ('owner','sped_teacher') and tm.active is not false
  ) into is_admin;
  if not is_admin then
    raise exception 'not authorized to approve' using errcode = '42501';
  end if;

  -- Add as member with the requested role. If they already have a membership
  -- (e.g. paused/inactive), re-activate at the requested role.
  insert into team_members (team_id, user_id, role, display_name, active)
    values (req.team_id, req.user_id, req.requested_role, req.display_name, true)
  on conflict (team_id, user_id) do update
    set role = excluded.role,
        display_name = excluded.display_name,
        active = true;

  update team_join_requests
     set status = 'approved', decided_at = now(), decided_by = auth.uid()
   where id = rid
   returning * into req;
  return req;
end $$;

revoke all on function approve_join_request(uuid) from public;
grant execute on function approve_join_request(uuid) to authenticated;

-- 5. Owner flow — deny_join_request
create or replace function deny_join_request(rid uuid, reason text)
returns team_join_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  req team_join_requests;
  is_admin boolean;
begin
  select * into req from team_join_requests where id = rid;
  if not found then raise exception 'request not found' using errcode = '22023'; end if;
  if req.status <> 'pending' then
    raise exception 'request already %', req.status using errcode = '22023';
  end if;

  select exists (
    select 1 from team_members tm
    where tm.team_id = req.team_id and tm.user_id = auth.uid()
      and tm.role in ('owner','sped_teacher') and tm.active is not false
  ) into is_admin;
  if not is_admin then
    raise exception 'not authorized to deny' using errcode = '42501';
  end if;

  update team_join_requests
     set status = 'denied',
         decision_reason = nullif(trim(coalesce(reason, '')), ''),
         decided_at = now(),
         decided_by = auth.uid()
   where id = rid
   returning * into req;
  return req;
end $$;

revoke all on function deny_join_request(uuid, text) from public;
grant execute on function deny_join_request(uuid, text) to authenticated;
