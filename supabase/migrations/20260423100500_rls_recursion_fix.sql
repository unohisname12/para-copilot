-- Fix: RLS on team_members had a subquery referencing team_members itself,
-- which Postgres refuses ("infinite recursion detected in policy").
-- Symptom: any authenticated read of team_members returns the error, which
-- getMyTeams() swallows, so the app sees teams.length === 0 and forces the
-- user to create a new team every time they log in.
--
-- Fix: add a security-definer helper that checks membership bypassing RLS,
-- then rewrite the affected policy to use it.

create or replace function is_member_of_team(tid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from team_members
    where team_id = tid and user_id = auth.uid()
  );
$$;

revoke all on function is_member_of_team(uuid) from public;
grant execute on function is_member_of_team(uuid) to authenticated;

-- team_members read: can see rows where you're a member of that team
drop policy if exists "members read own team members" on team_members;
create policy "read members of teams I'm in"
  on team_members for select
  using (is_member_of_team(team_id));

-- teams read: use the same helper instead of the self-referential subquery
-- that caused the recursion through team_members.
drop policy if exists "members read teams" on teams;
create policy "read teams I'm in"
  on teams for select
  using (is_member_of_team(id));

-- team_members insert: user can only insert themselves, and only into teams
-- they're already in. Joining by invite code goes through the security-definer
-- RPC which bypasses this check.
drop policy if exists "insert self into own team" on team_members;
create policy "insert self into own team"
  on team_members for insert
  with check (user_id = auth.uid() and is_member_of_team(team_id));
