-- Change the default role for users joining via invite code.
-- Before: role = 'member' (legacy, vague).
-- After:  role = caller-supplied 'para' or 'sub' only. Never admin.
--
-- Rationale: a new joiner should never land with admin access via an
-- invite code. Only the team creator (owner) or an existing admin
-- (promoting someone) should be able to grant admin. Subs CAN self-
-- declare (low-privilege), paras are the default.

create or replace function join_team_by_code(code text, display text, requested_role text default 'para')
returns teams
language plpgsql
security definer
set search_path = public
as $$
declare
  t teams;
  trimmed_code text;
  trimmed_display text;
  final_role text;
begin
  trimmed_code := upper(nullif(trim(code), ''));
  trimmed_display := nullif(trim(display), '');

  if trimmed_code is null then
    raise exception 'Invite code required' using errcode = '22023';
  end if;
  if trimmed_display is null then
    raise exception 'Display name required' using errcode = '22023';
  end if;

  -- Only para and sub are self-selectable. Anything else falls back to para.
  -- Admin roles (owner, sped_teacher) must be granted by an existing admin
  -- via set_member_role, never self-declared through an invite code.
  if requested_role in ('para', 'sub') then
    final_role := requested_role;
  else
    final_role := 'para';
  end if;

  select * into t from teams where invite_code = trimmed_code;
  if not found then
    raise exception 'Invalid invite code' using errcode = 'P0002';
  end if;

  insert into team_members (team_id, user_id, role, display_name)
  values (t.id, auth.uid(), final_role, trimmed_display)
  on conflict (team_id, user_id)
    -- If they rejoin, only update display name — don't silently change
    -- their role. Admin changes stick.
    do update set display_name = excluded.display_name;

  return t;
end $$;

revoke all on function join_team_by_code(text, text, text) from public;
grant execute on function join_team_by_code(text, text, text) to authenticated;

-- Keep the old 2-arg signature working for the current deployed client
-- until we ship the 3-arg call. Defaults requested_role to 'para'.
create or replace function join_team_by_code(code text, display text)
returns teams
language plpgsql
security definer
set search_path = public
as $$
begin
  return join_team_by_code(code, display, 'para');
end $$;

revoke all on function join_team_by_code(text, text) from public;
grant execute on function join_team_by_code(text, text) to authenticated;
