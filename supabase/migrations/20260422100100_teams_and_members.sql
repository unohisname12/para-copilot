-- Invite code generator: 6 chars, uppercase, no ambiguous O/0/I/1
create or replace function gen_invite_code()
returns text
language plpgsql
as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text := '';
  i int;
begin
  for i in 1..6 loop
    code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  end loop;
  return code;
end $$;

-- Teams
create table teams (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (length(trim(name)) > 0),
  invite_code  text unique not null default gen_invite_code(),
  created_by   uuid references auth.users on delete set null,
  created_at   timestamptz default now()
);

-- Team membership
create table team_members (
  team_id       uuid references teams on delete cascade,
  user_id       uuid references auth.users on delete cascade,
  role          text not null default 'member' check (role in ('owner','member')),
  display_name  text not null,
  joined_at     timestamptz default now(),
  primary key (team_id, user_id)
);

create index team_members_user_idx on team_members (user_id);

-- RLS: teams
alter table teams enable row level security;

create policy "members read teams"
  on teams for select
  using (id in (select team_id from team_members where user_id = auth.uid()));

create policy "authenticated create team"
  on teams for insert
  with check (auth.uid() = created_by);

create policy "owner update team"
  on teams for update
  using (
    id in (
      select team_id from team_members
      where user_id = auth.uid() and role = 'owner'
    )
  );

-- RLS: team_members
alter table team_members enable row level security;

create policy "members read own team members"
  on team_members for select
  using (team_id in (select team_id from team_members where user_id = auth.uid()));

-- Insert only self, and only into teams you already belong to.
-- Joining via invite code goes through the join_team_by_code RPC (security definer),
-- which bypasses this.
create policy "insert self into own team"
  on team_members for insert
  with check (
    user_id = auth.uid()
    and team_id in (select team_id from team_members where user_id = auth.uid())
  );

create policy "update own membership"
  on team_members for update
  using (user_id = auth.uid());

create policy "delete own membership"
  on team_members for delete
  using (user_id = auth.uid());
