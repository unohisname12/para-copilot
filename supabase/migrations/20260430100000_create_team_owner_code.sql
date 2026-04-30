-- create_team was authored before owner_code existed (Apr 22). The Apr 29
-- owner-code migration backfilled existing teams, but new teams created via
-- this RPC came back with owner_code = NULL, so admins joining a freshly
-- minted team had no code to share. Replace the function to generate one
-- inline.

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

  insert into teams (name, created_by, owner_code)
    values (trimmed_name, auth.uid(), generate_owner_code())
    returning * into t;
  insert into team_members (team_id, user_id, role, display_name)
    values (t.id, auth.uid(), 'owner', trimmed_display);
  return t;
end $$;

revoke all on function create_team(text, text) from public;
grant execute on function create_team(text, text) to authenticated;
