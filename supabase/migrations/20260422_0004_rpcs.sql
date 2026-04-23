-- Join a team by invite code. Runs as security definer so the caller can read the
-- team row and insert the membership even though they aren't a member yet.
create or replace function join_team_by_code(code text, display text)
returns teams
language plpgsql
security definer
set search_path = public
as $$
declare
  t teams;
  trimmed_code text;
  trimmed_display text;
begin
  trimmed_code := upper(nullif(trim(code), ''));
  trimmed_display := nullif(trim(display), '');

  if trimmed_code is null then
    raise exception 'Invite code required' using errcode = '22023';
  end if;
  if trimmed_display is null then
    raise exception 'Display name required' using errcode = '22023';
  end if;

  select * into t from teams where invite_code = trimmed_code;
  if not found then
    raise exception 'Invalid invite code' using errcode = 'P0002';
  end if;

  insert into team_members (team_id, user_id, role, display_name)
  values (t.id, auth.uid(), 'member', trimmed_display)
  on conflict (team_id, user_id)
    do update set display_name = excluded.display_name;

  return t;
end $$;

revoke all on function join_team_by_code(text, text) from public;
grant execute on function join_team_by_code(text, text) to authenticated;

-- Regenerate invite code (owner only).
create or replace function regenerate_invite_code(tid uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare new_code text;
begin
  if not exists (
    select 1 from team_members
    where team_id = tid and user_id = auth.uid() and role = 'owner'
  ) then
    raise exception 'Only team owners can regenerate invite code' using errcode = '42501';
  end if;

  loop
    new_code := gen_invite_code();
    begin
      update teams set invite_code = new_code where id = tid;
      exit;
    exception when unique_violation then
      continue;
    end;
  end loop;

  return new_code;
end $$;

revoke all on function regenerate_invite_code(uuid) from public;
grant execute on function regenerate_invite_code(uuid) to authenticated;

-- Create team + owner membership atomically. Avoids the client needing two round-trips.
create or replace function create_team(team_name text, display text)
returns teams
language plpgsql
security definer
set search_path = public
as $$
declare
  t teams;
  trimmed_name text;
  trimmed_display text;
begin
  trimmed_name := nullif(trim(team_name), '');
  trimmed_display := nullif(trim(display), '');

  if trimmed_name is null then raise exception 'Team name required' using errcode = '22023'; end if;
  if trimmed_display is null then raise exception 'Display name required' using errcode = '22023'; end if;

  insert into teams (name, created_by) values (trimmed_name, auth.uid()) returning * into t;
  insert into team_members (team_id, user_id, role, display_name)
    values (t.id, auth.uid(), 'owner', trimmed_display);
  return t;
end $$;

revoke all on function create_team(text, text) from public;
grant execute on function create_team(text, text) to authenticated;
