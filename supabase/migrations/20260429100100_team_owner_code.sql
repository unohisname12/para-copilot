-- Phase B of the team-joining UX overhaul:
--   Owner codes — a separate, longer-format invite code that joins as
--   sped_teacher (admin) instead of as a para. Multi-use, regeneratable.

-- 1. owner_code column. Format: 'OWN-' + 8 random alphanumerics (12 chars total).
--    Distinct prefix lets the client auto-detect vs the 6-char para invite_code.
alter table public.teams
  add column if not exists owner_code text;

create unique index if not exists teams_owner_code_uniq
  on public.teams (owner_code) where owner_code is not null;

-- 2. Generator helper. Random alphanumeric, no lookalike chars (no 0/O, 1/I/L).
--    Returns the full prefixed string (e.g. 'OWN-A7K9X2P4'). Loops until it
--    finds an unused one.
create or replace function generate_owner_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; -- 31 chars, no 0OILK
  candidate text;
  collision int;
begin
  loop
    candidate := 'OWN-' || (
      select string_agg(substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1), '')
      from generate_series(1, 8)
    );
    select count(*) into collision from public.teams where owner_code = candidate;
    if collision = 0 then
      return candidate;
    end if;
  end loop;
end $$;

revoke all on function generate_owner_code() from public;

-- 3. Backfill: every existing team gets an owner code. Idempotent — only fills NULLs.
update public.teams
  set owner_code = generate_owner_code()
  where owner_code is null;

-- 4. Regenerate RPC. Owner-only — checks the caller is in team_members with role='owner'.
create or replace function regenerate_owner_code(tid uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  is_owner boolean;
  new_code text;
begin
  select exists (
    select 1 from team_members
    where team_id = tid and user_id = auth.uid() and role = 'owner' and active is not false
  ) into is_owner;
  if not is_owner then
    raise exception 'only owners can regenerate the owner code' using errcode = '42501';
  end if;
  new_code := generate_owner_code();
  update public.teams set owner_code = new_code where id = tid;
  return new_code;
end $$;

revoke all on function regenerate_owner_code(uuid) from public;
grant execute on function regenerate_owner_code(uuid) to authenticated;

-- 5. join_team_as_owner RPC. Validates the code, inserts a team_members row
--    with role='sped_teacher'. Returns the team. Throws 22023 if no match.
--    Existing membership? Promote the role to sped_teacher.
create or replace function join_team_as_owner(code text, display text)
returns teams
language plpgsql
security definer
set search_path = public
as $$
declare
  t teams;
  trimmed_display text;
  cleaned_code text;
  existing_role text;
begin
  cleaned_code := upper(trim(coalesce(code, '')));
  trimmed_display := nullif(trim(coalesce(display, '')), '');

  if cleaned_code = '' then
    raise exception 'Owner code required' using errcode = '22023';
  end if;
  if trimmed_display is null then
    raise exception 'Display name required' using errcode = '22023';
  end if;

  select * into t from teams where owner_code = cleaned_code;
  if not found then
    raise exception 'Invalid or expired owner code' using errcode = '22023';
  end if;

  -- Already a member? Bump role to sped_teacher (or leave higher).
  select role into existing_role
  from team_members where team_id = t.id and user_id = auth.uid();

  if existing_role is null then
    insert into team_members (team_id, user_id, role, display_name, active)
      values (t.id, auth.uid(), 'sped_teacher', trimmed_display, true);
  elsif existing_role not in ('owner', 'sped_teacher') then
    update team_members
       set role = 'sped_teacher',
           display_name = coalesce(display_name, trimmed_display),
           active = true
     where team_id = t.id and user_id = auth.uid();
  end if;

  return t;
end $$;

revoke all on function join_team_as_owner(text, text) from public;
grant execute on function join_team_as_owner(text, text) to authenticated;
