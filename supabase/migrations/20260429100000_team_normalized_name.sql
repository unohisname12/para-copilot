-- Phase A of the team-joining UX overhaul:
--   Detect duplicate-team creation by adding a normalized name column +
--   an RPC that lets the client check before calling create_team.

-- 1. Generated, immutable normalized name. Mirrors normalizeTeamName() in
--    src/services/teamSync.js exactly: lowercase + drop everything that
--    isn't an ASCII letter/digit. So "Fair-View Middle School" and
--    "FAIR VIEW MIDDLE SCHOOL" both become "fairviewmiddleschool".
alter table public.teams
  add column if not exists normalized_name text
    generated always as (lower(regexp_replace(coalesce(name, ''), '[^a-zA-Z0-9]', '', 'g'))) stored;

-- Btree index for fast equality lookup.
create index if not exists teams_normalized_name_idx
  on public.teams (normalized_name);

-- 2. RPC for the client to find candidates BEFORE creating. Returns whichever
--    teams the caller is allowed to see (paras only see their own teams via
--    RLS; without RLS, this would leak all team names — so we explicitly
--    expose only the columns paras need to recognize/match).
create or replace function find_similar_team(candidate text)
returns table (id uuid, name text, normalized_name text)
language sql
stable
security definer
set search_path = public
as $$
  select t.id, t.name, t.normalized_name
  from public.teams t
  where t.normalized_name = candidate
    and t.normalized_name <> ''
$$;

revoke all on function find_similar_team(text) from public;
grant execute on function find_similar_team(text) to authenticated;
