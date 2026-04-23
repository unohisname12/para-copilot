# Cloud Backend (Supabase + Vercel) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a team-scoped cloud backend so paras on the same team can share pseudonymous data in realtime (handoffs, shared logs, case memory), while preserving the FERPA guarantee that real student names never leave the device.

**Architecture:** Supabase-only backend (managed Postgres + Auth + Realtime) + Vercel static hosting. Row Level Security is the entire authorization layer — no custom server. React SPA talks directly to Supabase via the JS client. `identityRegistry` (real names) stays in React state, never persisted, never uploaded.

**Tech Stack:** React 19, `@supabase/supabase-js` v2, Postgres 15 (Supabase), Supabase CLI, Vercel, Playwright (already in devDependencies), Google OAuth.

**Spec:** `docs/superpowers/specs/2026-04-22-cloud-backend-design.md`

---

## File Structure

### New files

```
supabase/
  config.toml                                 Supabase CLI project config
  migrations/
    20260422_0001_teams_and_members.sql      teams, team_members, RLS, invite-code func
    20260422_0002_team_students.sql          canonical team roster + RLS
    20260422_0003_observations.sql           logs, incidents, interventions, outcomes, handoffs + RLS
    20260422_0004_rpcs.sql                   join_team_by_code, regenerate_invite_code
  tests/
    rls_test.sql                              pgtap-style smoke tests

src/
  services/
    supabaseClient.js                         singleton Supabase client
    stripUnsafeKeys.js                        FERPA guard (recursive key strip)
    teamSync.js                               all cloud CRUD + realtime subscriptions
  context/
    TeamProvider.jsx                          React context: user, team, subscriptions
  components/
    SignInScreen.jsx                          signed-out landing page
    TeamOnboardingModal.jsx                   create / join team modal
    TeamSwitcher.jsx                          dropdown in BrandHeader
    HandoffInbox.jsx                          incoming handoff toasts + list
  __tests__/
    stripUnsafeKeys.test.js                   FERPA key strip unit tests
    teamSync.test.js                          teamSync unit tests (mocked client)

e2e/
  team-realtime.spec.ts                       Playwright two-browser test

.env.local.example                            template for local env vars
vercel.json                                   Vercel build config
```

### Modified files

```
.gitignore                                    add .env.local
package.json                                  add @supabase/supabase-js, dotenv-cli
src/App.jsx                                   wrap in TeamProvider, gate on auth
src/components/IEPImport.jsx                  push to team_students on bundle import
src/components/BrandHeader.jsx                add TeamSwitcher + sign-out
src/components/panels.jsx                     HandoffBuilder: "share with team" toggle
```

### Why these boundaries

- `supabaseClient.js` is the only file that instantiates a client. Every other module imports from it. One place to change URL/key logic.
- `stripUnsafeKeys.js` is its own file so the FERPA test has a single narrow contract to exercise.
- `teamSync.js` is the *only* module that talks to cloud tables. `TeamProvider.jsx` consumes it. Keeps IO at the edge.
- `TeamProvider.jsx` is the only React-context consumer of teamSync. All UI reads from context — no direct Supabase calls in components.

---

## Phased approach

Phases run in order. Each phase leaves the app buildable and (where applicable) runnable. Phase 7 requires the user to perform platform operations I cannot perform (Supabase + Vercel signup, Google OAuth credentials).

- **Phase 0:** Dependencies + env scaffolding (no behavior change)
- **Phase 1:** Schema + RLS migrations + RLS smoke tests
- **Phase 2:** FERPA guard + Supabase client singleton
- **Phase 3:** Auth + TeamProvider skeleton + SignInScreen
- **Phase 4:** Create/join team flow + team switcher
- **Phase 5:** Roster sync (`team_students`)
- **Phase 6:** Logs + shared-log realtime + handoffs + case memory
- **Phase 7:** Deploy (user-assisted)
- **Phase 8:** Playwright integration test + manual demo verification

---

# Phase 0 — Dependencies & env scaffolding

### Task 1: Install Supabase client SDK

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install the SDK**

```bash
cd "/home/dre/Documents/code mach/JPDs-gZD"
npm install @supabase/supabase-js@^2.45.0
```

- [ ] **Step 2: Verify package.json updated**

Run: `grep supabase package.json`
Expected: `"@supabase/supabase-js": "^2.45.0"` in dependencies.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add @supabase/supabase-js"
```

---

### Task 2: Add env template and gitignore entry

**Files:**
- Create: `.env.local.example`
- Modify: `.gitignore`

- [ ] **Step 1: Create env template**

```
# .env.local.example
# Copy to .env.local and fill in from Supabase dashboard → Settings → API
REACT_APP_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
REACT_APP_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

- [ ] **Step 2: Add to .gitignore**

Append to `.gitignore`:
```
# Local env
.env.local
.env.*.local
```

- [ ] **Step 3: Verify**

Run: `cat .env.local.example && grep -n env.local .gitignore`
Expected: template shown; `.env.local` appears in gitignore.

- [ ] **Step 4: Commit**

```bash
git add .env.local.example .gitignore
git commit -m "chore: add .env.local template and ignore rule"
```

---

# Phase 1 — Schema + RLS migrations

These SQL files will be applied to a Supabase project in Phase 7. For now they go into the repo so Phase 2+ code can be written against them.

### Task 3: Create Supabase project structure

**Files:**
- Create: `supabase/config.toml`
- Create: `supabase/migrations/` (directory)
- Create: `supabase/tests/` (directory)

- [ ] **Step 1: Create directories**

```bash
mkdir -p supabase/migrations supabase/tests
```

- [ ] **Step 2: Create minimal config.toml**

```toml
# supabase/config.toml
project_id = "supapara"

[api]
port = 54321
schemas = ["public"]

[db]
port = 54322

[auth]
enabled = true
site_url = "http://localhost:3000"
additional_redirect_urls = ["http://localhost:3000"]

[auth.external.google]
enabled = true
# client_id and secret set via Supabase dashboard env
```

- [ ] **Step 3: Commit**

```bash
git add supabase/
git commit -m "chore: scaffold supabase/ directory"
```

---

### Task 4: Migration 0001 — teams and team_members

**Files:**
- Create: `supabase/migrations/20260422_0001_teams_and_members.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260422_0001_teams_and_members.sql

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

-- Members can read their team rows
create policy "members read teams"
  on teams for select
  using (id in (select team_id from team_members where user_id = auth.uid()));

-- Any authenticated user may create a team
create policy "authenticated create team"
  on teams for insert
  with check (auth.uid() = created_by);

-- Only owners can update
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
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260422_0001_teams_and_members.sql
git commit -m "feat(db): teams + team_members schema with RLS"
```

---

### Task 5: Migration 0002 — team_students

**Files:**
- Create: `supabase/migrations/20260422_0002_team_students.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260422_0002_team_students.sql

create table team_students (
  id               uuid primary key default gen_random_uuid(),
  team_id          uuid not null references teams on delete cascade,
  pseudonym        text not null,
  color            text not null,
  period_id        text,
  class_label      text,
  eligibility      text,
  accs             jsonb default '[]'::jsonb,
  goals            jsonb default '[]'::jsonb,
  case_manager     text,
  grade_level      text,
  tags             jsonb default '[]'::jsonb,
  flags            jsonb default '{}'::jsonb,
  watch_fors       jsonb default '[]'::jsonb,
  do_this_actions  jsonb default '[]'::jsonb,
  health_notes     jsonb default '[]'::jsonb,
  cross_period     jsonb default '{}'::jsonb,
  source_meta      jsonb default '{}'::jsonb,
  external_key     text,
  created_by       uuid references auth.users on delete set null,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

create index team_students_team_period_idx
  on team_students (team_id, period_id);

-- Belt-and-suspenders: reject any row whose jsonb contains a real-name-shaped key.
-- The client also strips, but this catches mistakes.
create or replace function reject_realname_keys()
returns trigger language plpgsql as $$
declare payload jsonb;
begin
  payload := to_jsonb(new) - 'id' - 'team_id' - 'created_by' - 'created_at' - 'updated_at';
  if payload::text ~* '"(realname|real_name|student_name|first_name|last_name|firstname|lastname)"'
  then
    raise exception 'FERPA guard: row contains forbidden real-name key';
  end if;
  return new;
end $$;

create trigger reject_realname_keys_ts
  before insert or update on team_students
  for each row execute function reject_realname_keys();

alter table team_students enable row level security;

create policy "members read team students"
  on team_students for select
  using (team_id in (select team_id from team_members where user_id = auth.uid()));

create policy "members insert team students"
  on team_students for insert
  with check (
    team_id in (select team_id from team_members where user_id = auth.uid())
    and (created_by is null or created_by = auth.uid())
  );

create policy "members update team students"
  on team_students for update
  using (team_id in (select team_id from team_members where user_id = auth.uid()));
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260422_0002_team_students.sql
git commit -m "feat(db): team_students table with FERPA trigger and RLS"
```

---

### Task 6: Migration 0003 — logs, case memory, handoffs

**Files:**
- Create: `supabase/migrations/20260422_0003_observations.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260422_0003_observations.sql

-- Shared helper: a user can see a team if they're a member
create or replace function is_team_member(tid uuid)
returns boolean
language sql stable as $$
  select exists(
    select 1 from team_members where team_id = tid and user_id = auth.uid()
  );
$$;

-- Logs
create table logs (
  id             uuid primary key default gen_random_uuid(),
  team_id        uuid not null references teams on delete cascade,
  user_id        uuid not null references auth.users on delete cascade,
  student_id     uuid references team_students on delete set null,
  type           text,
  category       text,
  note           text,
  date           date,
  timestamp      timestamptz,
  period_id      text,
  tags           jsonb default '[]'::jsonb,
  source         text,
  situation_id   text,
  strategy_used  text,
  goal_id        text,
  flagged        boolean default false,
  shared         boolean default false,
  created_at     timestamptz default now()
);

create index logs_team_created_idx on logs (team_id, created_at desc);
create index logs_team_shared_idx on logs (team_id, shared, created_at desc);

alter table logs enable row level security;

create policy "read team logs"
  on logs for select
  using (is_team_member(team_id) and (shared = true or user_id = auth.uid()));

create policy "insert own logs"
  on logs for insert
  with check (user_id = auth.uid() and is_team_member(team_id));

create policy "update own logs"
  on logs for update
  using (user_id = auth.uid());

create policy "delete own logs"
  on logs for delete
  using (user_id = auth.uid());

-- Incidents
create table incidents (
  id             uuid primary key default gen_random_uuid(),
  team_id        uuid not null references teams on delete cascade,
  user_id        uuid not null references auth.users on delete cascade,
  student_id     uuid references team_students on delete set null,
  description    text,
  period_id      text,
  intensity      text,
  triggers       jsonb default '[]'::jsonb,
  antecedent     text,
  behavior       text,
  consequence    text,
  duration_min   int,
  staff_response text,
  follow_up      text,
  created_at     timestamptz default now()
);

create index incidents_team_created_idx on incidents (team_id, created_at desc);

alter table incidents enable row level security;

create policy "read team incidents"
  on incidents for select using (is_team_member(team_id));
create policy "insert own incidents"
  on incidents for insert with check (user_id = auth.uid() and is_team_member(team_id));
create policy "update own incidents"
  on incidents for update using (user_id = auth.uid());

-- Interventions
create table interventions (
  id             uuid primary key default gen_random_uuid(),
  incident_id    uuid references incidents on delete cascade,
  team_id        uuid not null references teams on delete cascade,
  user_id        uuid not null references auth.users on delete cascade,
  student_id     uuid references team_students on delete set null,
  strategy       text,
  notes          text,
  worked         text,
  created_at     timestamptz default now()
);

create index interventions_team_created_idx on interventions (team_id, created_at desc);

alter table interventions enable row level security;

create policy "read team interventions"
  on interventions for select using (is_team_member(team_id));
create policy "insert own interventions"
  on interventions for insert with check (user_id = auth.uid() and is_team_member(team_id));
create policy "update own interventions"
  on interventions for update using (user_id = auth.uid());

-- Outcomes
create table outcomes (
  id              uuid primary key default gen_random_uuid(),
  intervention_id uuid references interventions on delete cascade,
  team_id         uuid not null references teams on delete cascade,
  user_id         uuid not null references auth.users on delete cascade,
  student_id      uuid references team_students on delete set null,
  result          text,
  notes           text,
  created_at      timestamptz default now()
);

create index outcomes_team_created_idx on outcomes (team_id, created_at desc);

alter table outcomes enable row level security;

create policy "read team outcomes"
  on outcomes for select using (is_team_member(team_id));
create policy "insert own outcomes"
  on outcomes for insert with check (user_id = auth.uid() and is_team_member(team_id));
create policy "update own outcomes"
  on outcomes for update using (user_id = auth.uid());

-- Handoffs
create table handoffs (
  id              uuid primary key default gen_random_uuid(),
  team_id         uuid not null references teams on delete cascade,
  from_user_id    uuid not null references auth.users on delete cascade,
  student_id      uuid references team_students on delete set null,
  audience        text,
  urgency         text default 'normal',
  body            text not null check (length(trim(body)) > 0),
  acknowledged_by uuid[] default '{}',
  created_at      timestamptz default now(),
  expires_at      timestamptz default (now() + interval '24 hours')
);

create index handoffs_team_created_idx on handoffs (team_id, created_at desc);

alter table handoffs enable row level security;

create policy "read team handoffs"
  on handoffs for select using (is_team_member(team_id));
create policy "insert own handoffs"
  on handoffs for insert with check (from_user_id = auth.uid() and is_team_member(team_id));
create policy "ack team handoffs"
  on handoffs for update using (is_team_member(team_id));
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260422_0003_observations.sql
git commit -m "feat(db): logs, case memory, handoffs with RLS"
```

---

### Task 7: Migration 0004 — RPCs

**Files:**
- Create: `supabase/migrations/20260422_0004_rpcs.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260422_0004_rpcs.sql

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

  -- Retry on collision (extremely unlikely in 32^6 space)
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
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260422_0004_rpcs.sql
git commit -m "feat(db): join_team_by_code, create_team, regenerate_invite_code RPCs"
```

---

### Task 8: RLS smoke test SQL

**Files:**
- Create: `supabase/tests/rls_test.sql`

This file is for the user to run inside the Supabase SQL editor after migrations apply in Phase 7. It documents the RLS contract.

- [ ] **Step 1: Write the tests**

```sql
-- supabase/tests/rls_test.sql
-- Run inside Supabase SQL Editor. Each block sets a JWT claim, then queries.
-- Expected results annotated inline.

-- Setup: two teams, two users each via seed (run once manually in dashboard).
-- alice@example.com belongs to team_A only.
-- bob@example.com belongs to team_A only.
-- carol@example.com belongs to team_B only.

-- Assumes you've captured the user ids and team ids into psql vars; adjust as needed.

-- --- Alice reads team A shared logs: should succeed ---
set local "request.jwt.claim.sub" to '<alice_uuid>';
select count(*) from logs where team_id = '<team_a_uuid>' and shared = true;
-- Expected: row count >= 0, no error

-- --- Alice reads Bob's private logs: should return 0 rows (RLS filter, not error) ---
set local "request.jwt.claim.sub" to '<alice_uuid>';
select count(*) from logs where user_id = '<bob_uuid>' and shared = false;
-- Expected: 0

-- --- Carol reads team A logs: should return 0 rows ---
set local "request.jwt.claim.sub" to '<carol_uuid>';
select count(*) from logs where team_id = '<team_a_uuid>';
-- Expected: 0

-- --- Carol tries to insert a log into team A: should fail ---
set local "request.jwt.claim.sub" to '<carol_uuid>';
insert into logs (team_id, user_id, note)
  values ('<team_a_uuid>', '<carol_uuid>', 'intrusion');
-- Expected: "new row violates row-level security policy"

-- --- FERPA trigger: insert team_students with realName key in jsonb: should fail ---
set local "request.jwt.claim.sub" to '<alice_uuid>';
insert into team_students (team_id, pseudonym, color, goals)
  values ('<team_a_uuid>', 'Red 1', '#ef4444',
          '[{"id":"g1","realName":"John Doe","text":"reading"}]'::jsonb);
-- Expected: "FERPA guard: row contains forbidden real-name key"
```

- [ ] **Step 2: Commit**

```bash
git add supabase/tests/rls_test.sql
git commit -m "test(db): RLS + FERPA trigger smoke tests"
```

---

# Phase 2 — FERPA guard + Supabase client

### Task 9: stripUnsafeKeys FERPA guard + tests

**Files:**
- Create: `src/services/stripUnsafeKeys.js`
- Create: `src/__tests__/stripUnsafeKeys.test.js`

- [ ] **Step 1: Write the failing test**

```js
// src/__tests__/stripUnsafeKeys.test.js
import { stripUnsafeKeys, containsUnsafeKey } from '../services/stripUnsafeKeys';

describe('stripUnsafeKeys', () => {
  test('removes top-level realName', () => {
    const input = { id: 'x', realName: 'John Doe', pseudonym: 'Red 1' };
    expect(stripUnsafeKeys(input)).toEqual({ id: 'x', pseudonym: 'Red 1' });
  });

  test('removes nested real_name inside jsonb-shaped field', () => {
    const input = {
      id: 'x',
      goals: [{ id: 'g1', real_name: 'Jane', text: 'reading' }],
    };
    expect(stripUnsafeKeys(input)).toEqual({
      id: 'x',
      goals: [{ id: 'g1', text: 'reading' }],
    });
  });

  test('removes multiple variants: firstName, lastName, studentName', () => {
    const input = { firstName: 'A', lastName: 'B', studentName: 'C', keep: true };
    expect(stripUnsafeKeys(input)).toEqual({ keep: true });
  });

  test('is case-insensitive', () => {
    const input = { RealName: 'x', FIRSTNAME: 'y', keep: 1 };
    expect(stripUnsafeKeys(input)).toEqual({ keep: 1 });
  });

  test('leaves arrays of primitives alone', () => {
    const input = { tags: ['a', 'b'], flags: { alert: true } };
    expect(stripUnsafeKeys(input)).toEqual(input);
  });

  test('containsUnsafeKey detects nested keys', () => {
    expect(containsUnsafeKey({ a: { b: { realName: 'x' } } })).toBe(true);
    expect(containsUnsafeKey({ a: 1, b: [{ keep: 2 }] })).toBe(false);
  });
});
```

- [ ] **Step 2: Run — verify it fails**

```bash
npm test -- --watchAll=false stripUnsafeKeys
```

Expected: FAIL, module not found.

- [ ] **Step 3: Implement the module**

```js
// src/services/stripUnsafeKeys.js
// FERPA guard. Removes keys that might carry real student names from any
// payload destined for the cloud. Used by teamSync.js before every write.

const UNSAFE_KEY_RE = /^(real_?name|student_?name|first_?name|last_?name)$/i;

export function containsUnsafeKey(value) {
  if (value === null || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some(containsUnsafeKey);
  for (const k of Object.keys(value)) {
    if (UNSAFE_KEY_RE.test(k)) return true;
    if (containsUnsafeKey(value[k])) return true;
  }
  return false;
}

export function stripUnsafeKeys(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(stripUnsafeKeys);
  const out = {};
  for (const k of Object.keys(value)) {
    if (UNSAFE_KEY_RE.test(k)) continue;
    out[k] = stripUnsafeKeys(value[k]);
  }
  return out;
}

// Dev-only assertion. Call in teamSync.js write paths.
// In production, silently strips; in development, throws so bugs show up in tests.
export function assertSafe(payload, label = 'payload') {
  if (containsUnsafeKey(payload)) {
    const msg = `FERPA guard: ${label} contains a real-name key. Strip before sending to cloud.`;
    if (process.env.NODE_ENV !== 'production') throw new Error(msg);
    console.error(msg);
  }
}
```

- [ ] **Step 4: Run — verify pass**

```bash
npm test -- --watchAll=false stripUnsafeKeys
```

Expected: all 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/services/stripUnsafeKeys.js src/__tests__/stripUnsafeKeys.test.js
git commit -m "feat(ferpa): stripUnsafeKeys + containsUnsafeKey guards"
```

---

### Task 10: Supabase client singleton

**Files:**
- Create: `src/services/supabaseClient.js`

- [ ] **Step 1: Implement**

```js
// src/services/supabaseClient.js
// Singleton Supabase client. Every other module imports `supabase` from here.
// Reads env from CRA at build time.

import { createClient } from '@supabase/supabase-js';

const url = process.env.REACT_APP_SUPABASE_URL;
const anonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(url && anonKey);

if (!supabaseConfigured) {
  // Don't throw. We want the app to run signed-out with a clear hint in the console.
  // eslint-disable-next-line no-console
  console.warn(
    '[supabase] REACT_APP_SUPABASE_URL / _ANON_KEY not set. ' +
    'Cloud features disabled. Create .env.local from .env.local.example.'
  );
}

export const supabase = supabaseConfigured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
      realtime: {
        params: { eventsPerSecond: 10 },
      },
    })
  : null;
```

- [ ] **Step 2: Verify it imports without side effects**

Run: `node -e "require('./node_modules/@supabase/supabase-js')"`
Expected: no output, exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/services/supabaseClient.js
git commit -m "feat: supabase client singleton"
```

---

### Task 11: teamSync module — auth + teams API

**Files:**
- Create: `src/services/teamSync.js`
- Create: `src/__tests__/teamSync.test.js`

This task stands up teamSync with the auth / teams portion only. Subsequent tasks add logs, handoffs, case memory APIs.

- [ ] **Step 1: Write failing test (mocks the client)**

```js
// src/__tests__/teamSync.test.js
jest.mock('../services/supabaseClient', () => ({
  supabaseConfigured: true,
  supabase: {
    auth: {
      getSession: jest.fn(async () => ({ data: { session: null }, error: null })),
      signInWithOAuth: jest.fn(async () => ({ data: {}, error: null })),
      signOut: jest.fn(async () => ({ error: null })),
      onAuthStateChange: jest.fn((cb) => {
        return { data: { subscription: { unsubscribe: jest.fn() } } };
      }),
    },
    rpc: jest.fn(async (name, args) => {
      if (name === 'create_team') {
        return { data: { id: 't1', name: args.team_name, invite_code: 'ABC123' }, error: null };
      }
      if (name === 'join_team_by_code') {
        if (args.code === 'BAD') return { data: null, error: { message: 'Invalid invite code' } };
        return { data: { id: 't1', name: 'Team', invite_code: 'ABC123' }, error: null };
      }
      return { data: null, error: null };
    }),
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn(async () => ({ data: [], error: null })),
    })),
  },
}));

import { signInWithGoogle, signOut, createTeam, joinTeamByCode } from '../services/teamSync';
import { supabase } from '../services/supabaseClient';

describe('teamSync auth + teams', () => {
  test('signInWithGoogle calls OAuth with google provider', async () => {
    await signInWithGoogle();
    expect(supabase.auth.signInWithOAuth).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'google' })
    );
  });

  test('signOut calls supabase.auth.signOut', async () => {
    await signOut();
    expect(supabase.auth.signOut).toHaveBeenCalled();
  });

  test('createTeam calls create_team RPC and returns team', async () => {
    const t = await createTeam('Lincoln MS', 'Alice');
    expect(t.name).toBe('Lincoln MS');
    expect(supabase.rpc).toHaveBeenCalledWith('create_team', {
      team_name: 'Lincoln MS',
      display: 'Alice',
    });
  });

  test('joinTeamByCode throws on invalid code', async () => {
    await expect(joinTeamByCode('BAD', 'Alice')).rejects.toThrow('Invalid invite code');
  });

  test('joinTeamByCode returns team on success', async () => {
    const t = await joinTeamByCode('ABC123', 'Alice');
    expect(t.id).toBe('t1');
  });
});
```

- [ ] **Step 2: Run — verify FAIL**

```bash
npm test -- --watchAll=false teamSync
```

Expected: FAIL, module not found.

- [ ] **Step 3: Implement (auth + teams slice only)**

```js
// src/services/teamSync.js
// All Supabase-facing code lives here. Components never import supabaseClient directly.
//
// Exports grow across phases:
//   Phase 3: auth + teams
//   Phase 5: team_students
//   Phase 6: logs, handoffs, case memory
//
// Every cloud-bound payload passes through assertSafe + stripUnsafeKeys.

import { supabase } from './supabaseClient';
import { stripUnsafeKeys, assertSafe } from './stripUnsafeKeys';

function requireClient() {
  if (!supabase) throw new Error('Supabase not configured. Check .env.local.');
}

// ---------- Auth ----------

export async function signInWithGoogle() {
  requireClient();
  const redirectTo = window.location.origin;
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo },
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  requireClient();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  requireClient();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export function onAuthStateChange(cb) {
  requireClient();
  const { data } = supabase.auth.onAuthStateChange((_event, session) => cb(session));
  return () => data.subscription.unsubscribe();
}

// ---------- Teams ----------

export async function createTeam(name, displayName) {
  requireClient();
  const { data, error } = await supabase.rpc('create_team', {
    team_name: name,
    display: displayName,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function joinTeamByCode(code, displayName) {
  requireClient();
  const { data, error } = await supabase.rpc('join_team_by_code', {
    code,
    display: displayName,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function getMyTeams() {
  requireClient();
  const { data, error } = await supabase
    .from('team_members')
    .select('team_id, role, display_name, teams(id, name, invite_code)')
    .order('joined_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data || []).map((row) => ({
    id: row.teams.id,
    name: row.teams.name,
    inviteCode: row.teams.invite_code,
    role: row.role,
    displayName: row.display_name,
  }));
}

export async function regenerateInviteCode(teamId) {
  requireClient();
  const { data, error } = await supabase.rpc('regenerate_invite_code', { tid: teamId });
  if (error) throw new Error(error.message);
  return data; // new code string
}

// ---------- Utility: safe cloud write wrapper ----------
// Used by later phases for writes into jsonb-heavy tables.
export function sanitize(payload, label) {
  assertSafe(payload, label);
  return stripUnsafeKeys(payload);
}
```

- [ ] **Step 4: Run — verify pass**

```bash
npm test -- --watchAll=false teamSync
```

Expected: all 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/services/teamSync.js src/__tests__/teamSync.test.js
git commit -m "feat: teamSync auth + teams API with mocked tests"
```

---

# Phase 3 — Auth gate + TeamProvider + SignInScreen

### Task 12: TeamProvider skeleton (auth + teams only)

**Files:**
- Create: `src/context/TeamProvider.jsx`

- [ ] **Step 1: Implement**

```jsx
// src/context/TeamProvider.jsx
// React context for auth + team membership. Later phases extend it with
// teamStudents, sharedLogs, handoffs, caseMemory subscriptions.

import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  onAuthStateChange,
  getSession,
  signInWithGoogle,
  signOut,
  getMyTeams,
  createTeam,
  joinTeamByCode,
  regenerateInviteCode,
} from '../services/teamSync';
import { supabaseConfigured } from '../services/supabaseClient';

const TeamContext = createContext(null);

export function useTeam() {
  const v = useContext(TeamContext);
  if (!v) throw new Error('useTeam must be used inside <TeamProvider>');
  return v;
}

export function TeamProvider({ children }) {
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [teams, setTeams] = useState([]);
  const [activeTeamId, setActiveTeamId] = useState(null);
  const [teamsLoading, setTeamsLoading] = useState(false);

  // Initial session probe + auth listener
  useEffect(() => {
    if (!supabaseConfigured) { setAuthReady(true); return; }
    let off;
    (async () => {
      const s = await getSession();
      setSession(s);
      setAuthReady(true);
      off = onAuthStateChange((next) => setSession(next));
    })();
    return () => { if (off) off(); };
  }, []);

  // Load teams whenever session becomes present
  useEffect(() => {
    if (!session) { setTeams([]); setActiveTeamId(null); return; }
    let cancelled = false;
    setTeamsLoading(true);
    (async () => {
      try {
        const t = await getMyTeams();
        if (cancelled) return;
        setTeams(t);
        setActiveTeamId((prev) => prev || (t[0] ? t[0].id : null));
      } finally {
        if (!cancelled) setTeamsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [session]);

  const activeTeam = useMemo(
    () => teams.find((t) => t.id === activeTeamId) || null,
    [teams, activeTeamId]
  );

  const value = useMemo(() => ({
    session,
    user: session?.user || null,
    authReady,
    teams,
    activeTeam,
    activeTeamId,
    teamsLoading,
    setActiveTeamId,
    signInWithGoogle,
    signOut: async () => { await signOut(); setSession(null); setTeams([]); setActiveTeamId(null); },
    createTeam: async (name, display) => {
      const t = await createTeam(name, display);
      const mapped = { id: t.id, name: t.name, inviteCode: t.invite_code, role: 'owner', displayName: display };
      setTeams((ts) => [...ts, mapped]);
      setActiveTeamId(t.id);
      return mapped;
    },
    joinTeamByCode: async (code, display) => {
      const t = await joinTeamByCode(code, display);
      const mapped = { id: t.id, name: t.name, inviteCode: t.invite_code, role: 'member', displayName: display };
      setTeams((ts) => (ts.find((x) => x.id === t.id) ? ts : [...ts, mapped]));
      setActiveTeamId(t.id);
      return mapped;
    },
    regenerateInviteCode: async () => {
      if (!activeTeamId) return null;
      const code = await regenerateInviteCode(activeTeamId);
      setTeams((ts) => ts.map((t) => (t.id === activeTeamId ? { ...t, inviteCode: code } : t)));
      return code;
    },
  }), [session, authReady, teams, activeTeam, activeTeamId, teamsLoading]);

  return <TeamContext.Provider value={value}>{children}</TeamContext.Provider>;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/context/TeamProvider.jsx
git commit -m "feat: TeamProvider context (auth + teams slice)"
```

---

### Task 13: SignInScreen component

**Files:**
- Create: `src/components/SignInScreen.jsx`

- [ ] **Step 1: Implement**

```jsx
// src/components/SignInScreen.jsx
import React, { useState } from 'react';
import { useTeam } from '../context/TeamProvider';

export default function SignInScreen() {
  const { signInWithGoogle } = useTeam();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  async function handleClick() {
    setBusy(true); setErr(null);
    try { await signInWithGoogle(); } catch (e) { setErr(e.message || String(e)); }
    finally { setBusy(false); }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-deep, #04080f)', color: 'white', flexDirection: 'column', gap: 24,
    }}>
      <div style={{ textAlign: 'center' }}>
        <img src="/assets/logo.png" alt="SupaPara" style={{ height: 56 }} />
        <h1 style={{ marginTop: 16, fontWeight: 600 }}>SupaPara</h1>
        <p style={{ opacity: 0.7 }}>Powering ParaProfessionals</p>
      </div>
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        style={{
          background: '#fff', color: '#222', padding: '12px 24px', borderRadius: 8,
          border: 'none', fontWeight: 600, fontSize: 16, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 12, minWidth: 260, justifyContent: 'center',
        }}
      >
        <span style={{ fontSize: 20 }}>G</span>
        {busy ? 'Opening Google...' : 'Sign in with Google'}
      </button>
      {err && <div style={{ color: '#f87171', maxWidth: 400, textAlign: 'center' }}>{err}</div>}
      <div style={{ opacity: 0.5, fontSize: 12, maxWidth: 420, textAlign: 'center' }}>
        Real student names never leave your device. Only pseudonymous data syncs to the cloud.
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/SignInScreen.jsx
git commit -m "feat: SignInScreen component"
```

---

### Task 14: Gate App.jsx behind auth

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Read App.jsx to find the top-level render and wrap it**

Open `src/App.jsx` and locate the root component's return. Wrap the existing tree in `<TeamProvider>`, and above the existing Dashboard/BrandHeader render, branch on auth state.

Concretely, at the very top of the file add:
```js
import { TeamProvider, useTeam } from './context/TeamProvider';
import SignInScreen from './components/SignInScreen';
import TeamOnboardingModal from './components/TeamOnboardingModal'; // created in Task 15
```

Rename the current default-exported function `App` to `AppInner` and export a new default:

```jsx
function AppGate() {
  const { authReady, session, teams, teamsLoading } = useTeam();
  if (!authReady) {
    return <div style={{ padding: 40, color: 'white' }}>Loading…</div>;
  }
  if (!session) return <SignInScreen />;
  if (teamsLoading) return <div style={{ padding: 40, color: 'white' }}>Loading your teams…</div>;
  if (teams.length === 0) return <TeamOnboardingModal mustChoose />;
  return <AppInner />;
}

export default function App() {
  return (
    <TeamProvider>
      <AppGate />
    </TeamProvider>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: successful build. If it fails because `TeamOnboardingModal` doesn't exist yet, temporarily replace `<TeamOnboardingModal mustChoose />` with `<div>Need a team</div>`, then restore it after Task 15.

- [ ] **Step 3: Commit**

```bash
git add src/App.jsx
git commit -m "feat: gate App behind auth + team membership"
```

---

### Task 15: TeamOnboardingModal (create / join tabs)

**Files:**
- Create: `src/components/TeamOnboardingModal.jsx`

- [ ] **Step 1: Implement**

```jsx
// src/components/TeamOnboardingModal.jsx
import React, { useState } from 'react';
import { useTeam } from '../context/TeamProvider';

export default function TeamOnboardingModal({ onClose, mustChoose = false }) {
  const { user, createTeam, joinTeamByCode } = useTeam();
  const [tab, setTab] = useState('create');
  const [teamName, setTeamName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const defaultDisplay = user?.user_metadata?.given_name
    || user?.user_metadata?.name
    || user?.email?.split('@')[0]
    || 'Para';
  const [displayName, setDisplayName] = useState(defaultDisplay);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [created, setCreated] = useState(null);

  async function handleCreate(e) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const t = await createTeam(teamName.trim(), displayName.trim());
      setCreated(t);
    } catch (e) { setErr(e.message || String(e)); }
    finally { setBusy(false); }
  }

  async function handleJoin(e) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      await joinTeamByCode(inviteCode.trim().toUpperCase(), displayName.trim());
      if (!mustChoose && onClose) onClose();
    } catch (e) { setErr(e.message || String(e)); }
    finally { setBusy(false); }
  }

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <h2 style={{ marginTop: 0 }}>Welcome to SupaPara</h2>
        <p style={{ opacity: 0.75 }}>Create a team for your school, or join one with an invite code.</p>
        <div style={{ display: 'flex', gap: 8, margin: '16px 0' }}>
          <TabBtn active={tab === 'create'} onClick={() => setTab('create')}>Create a team</TabBtn>
          <TabBtn active={tab === 'join'} onClick={() => setTab('join')}>Join a team</TabBtn>
        </div>

        {tab === 'create' && !created && (
          <form onSubmit={handleCreate}>
            <Field label="Team name">
              <input value={teamName} onChange={(e) => setTeamName(e.target.value)} required autoFocus style={inputStyle} placeholder="e.g. Lincoln Middle School" />
            </Field>
            <Field label="Your display name">
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required style={inputStyle} />
            </Field>
            <button type="submit" disabled={busy} style={primaryBtnStyle}>{busy ? 'Creating…' : 'Create team'}</button>
          </form>
        )}

        {tab === 'create' && created && (
          <div>
            <p>Team <b>{created.name}</b> created.</p>
            <p>Invite code:</p>
            <div style={{ fontSize: 28, fontFamily: 'JetBrains Mono, monospace', letterSpacing: 4, padding: 12, background: 'rgba(255,255,255,0.05)', borderRadius: 8, textAlign: 'center' }}>
              {created.inviteCode}
            </div>
            <button type="button" onClick={() => navigator.clipboard.writeText(created.inviteCode)} style={secondaryBtnStyle}>
              Copy code
            </button>
            {!mustChoose && (
              <button type="button" onClick={onClose} style={primaryBtnStyle}>Done</button>
            )}
          </div>
        )}

        {tab === 'join' && (
          <form onSubmit={handleJoin}>
            <Field label="Invite code">
              <input value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} required autoFocus maxLength={6} style={{ ...inputStyle, letterSpacing: 4, textTransform: 'uppercase' }} placeholder="ABC123" />
            </Field>
            <Field label="Your display name">
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required style={inputStyle} />
            </Field>
            <button type="submit" disabled={busy} style={primaryBtnStyle}>{busy ? 'Joining…' : 'Join team'}</button>
          </form>
        )}

        {err && <div style={{ color: '#f87171', marginTop: 12 }}>{err}</div>}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: 'block', marginBottom: 12 }}>
      <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 4 }}>{label}</div>
      {children}
    </label>
  );
}

function TabBtn({ active, onClick, children }) {
  return (
    <button type="button" onClick={onClick} style={{
      padding: '8px 14px', borderRadius: 6, border: '1px solid var(--border, #1c2d4a)',
      background: active ? 'var(--accent, #4d9fff)' : 'transparent', color: active ? '#000' : '#fff',
      cursor: 'pointer', fontWeight: 500,
    }}>
      {children}
    </button>
  );
}

const overlayStyle = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
};
const modalStyle = {
  background: 'var(--bg-surface, #0f1a2e)', color: 'white', padding: 24,
  borderRadius: 12, minWidth: 360, maxWidth: 480, border: '1px solid var(--border, #1c2d4a)',
};
const inputStyle = {
  width: '100%', padding: 10, borderRadius: 6, border: '1px solid var(--border, #1c2d4a)',
  background: 'rgba(255,255,255,0.05)', color: 'white', fontSize: 15,
};
const primaryBtnStyle = {
  width: '100%', padding: 12, borderRadius: 6, border: 'none',
  background: 'var(--accent, #4d9fff)', color: '#000', fontWeight: 600, cursor: 'pointer', marginTop: 8,
};
const secondaryBtnStyle = {
  width: '100%', padding: 10, borderRadius: 6, border: '1px solid var(--border, #1c2d4a)',
  background: 'transparent', color: 'white', cursor: 'pointer', marginTop: 8, marginBottom: 8,
};
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: success.

- [ ] **Step 3: Commit**

```bash
git add src/components/TeamOnboardingModal.jsx
git commit -m "feat: TeamOnboardingModal (create/join team)"
```

---

### Task 16: TeamSwitcher + BrandHeader integration

**Files:**
- Create: `src/components/TeamSwitcher.jsx`
- Modify: `src/components/BrandHeader.jsx`

- [ ] **Step 1: Implement TeamSwitcher**

```jsx
// src/components/TeamSwitcher.jsx
import React, { useState } from 'react';
import { useTeam } from '../context/TeamProvider';
import TeamOnboardingModal from './TeamOnboardingModal';

export default function TeamSwitcher() {
  const { teams, activeTeam, setActiveTeamId, signOut } = useTeam();
  const [onboardingOpen, setOnboardingOpen] = useState(false);

  if (!activeTeam) return null;

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {teams.length > 1 ? (
          <select
            value={activeTeam.id}
            onChange={(e) => setActiveTeamId(e.target.value)}
            style={selectStyle}
          >
            {teams.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
          </select>
        ) : (
          <span style={{ opacity: 0.85, fontSize: 13 }}>{activeTeam.name}</span>
        )}
        <span style={codeStyle} title="Team invite code">
          {activeTeam.inviteCode}
        </span>
        <button type="button" onClick={() => setOnboardingOpen(true)} style={smallBtnStyle}>
          + Join / Create
        </button>
        <button type="button" onClick={signOut} style={smallBtnStyle}>Sign out</button>
      </div>
      {onboardingOpen && <TeamOnboardingModal onClose={() => setOnboardingOpen(false)} />}
    </>
  );
}

const selectStyle = {
  background: 'transparent', color: 'white',
  border: '1px solid var(--border, #1c2d4a)', borderRadius: 6, padding: '4px 8px',
};
const codeStyle = {
  fontFamily: 'JetBrains Mono, monospace', letterSpacing: 2, fontSize: 12,
  padding: '4px 8px', background: 'rgba(255,255,255,0.05)', borderRadius: 4,
};
const smallBtnStyle = {
  padding: '4px 10px', borderRadius: 6,
  border: '1px solid var(--border, #1c2d4a)', background: 'transparent',
  color: 'white', fontSize: 12, cursor: 'pointer',
};
```

- [ ] **Step 2: Modify BrandHeader.jsx — wire in switcher**

Open `src/components/BrandHeader.jsx`. It currently accepts a `right` prop. Pass a `<TeamSwitcher />` through that prop from `App.jsx`, OR, if simpler, import TeamSwitcher inside BrandHeader and render it alongside `right`.

Minimal change — in BrandHeader.jsx, replace the line rendering `right` with:

```jsx
import TeamSwitcher from './TeamSwitcher';
// ...
<div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
  <TeamSwitcher />
  {right}
</div>
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```

Expected: success.

- [ ] **Step 4: Commit**

```bash
git add src/components/TeamSwitcher.jsx src/components/BrandHeader.jsx
git commit -m "feat: TeamSwitcher in BrandHeader"
```

---

# Phase 5 — Roster sync (team_students)

### Task 17: Extend teamSync with team_students API

**Files:**
- Modify: `src/services/teamSync.js`

- [ ] **Step 1: Append to teamSync.js**

```js
// Append after existing exports:

// ---------- team_students ----------

// Map app-shape student → DB row. Intentionally drops any realName field.
// (stripUnsafeKeys is the backstop; this function is the explicit contract.)
function toTeamStudentRow(teamId, s, userId) {
  return {
    team_id: teamId,
    pseudonym: s.pseudonym,
    color: s.color,
    period_id: s.periodId || s.period_id || null,
    class_label: s.classLabel || s.class_label || null,
    eligibility: s.eligibility || null,
    accs: s.accs || [],
    goals: s.goals || [],
    case_manager: s.caseManager || s.case_manager || null,
    grade_level: s.gradeLevel || s.grade_level || null,
    tags: s.tags || [],
    flags: s.flags || {},
    watch_fors: s.watchFors || s.watch_fors || [],
    do_this_actions: s.doThisActions || s.do_this_actions || [],
    health_notes: s.healthNotes || s.health_notes || [],
    cross_period: s.crossPeriodInfo || s.cross_period || {},
    source_meta: s.sourceMeta || s.source_meta || {},
    external_key: s.externalStudentKey || s.external_key || null,
    created_by: userId,
  };
}

// Bulk push: one INSERT per student. RLS requires team membership.
// Returns inserted rows.
export async function pushStudents(teamId, students, userId) {
  requireClient();
  if (!teamId || !students || students.length === 0) return [];
  const rows = students.map((s) => sanitize(toTeamStudentRow(teamId, s, userId), 'team_students row'));
  const { data, error } = await supabase.from('team_students').insert(rows).select();
  if (error) throw new Error(error.message);
  return data || [];
}

export async function getTeamStudents(teamId) {
  requireClient();
  const { data, error } = await supabase
    .from('team_students')
    .select('*')
    .eq('team_id', teamId)
    .order('period_id', { ascending: true });
  if (error) throw new Error(error.message);
  return data || [];
}

export function subscribeTeamStudents(teamId, onChange) {
  requireClient();
  const channel = supabase
    .channel(`team_students:${teamId}`)
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'team_students', filter: `team_id=eq.${teamId}` },
      (payload) => onChange(payload))
    .subscribe();
  return () => supabase.removeChannel(channel);
}
```

- [ ] **Step 2: Add test for toTeamStudentRow sanitization**

Append to `src/__tests__/teamSync.test.js`:

```js
import { pushStudents } from '../services/teamSync';

describe('pushStudents sanitization', () => {
  test('strips realName from goals before insert', async () => {
    const insertMock = jest.fn(() => ({
      select: jest.fn(async () => ({ data: [], error: null })),
    }));
    supabase.from.mockReturnValueOnce({ insert: insertMock });

    const students = [{
      pseudonym: 'Red 1', color: '#ef4444',
      goals: [{ id: 'g1', realName: 'Jane Doe', text: 'reading' }],
    }];
    await pushStudents('t1', students, 'u1');

    const rows = insertMock.mock.calls[0][0];
    expect(JSON.stringify(rows)).not.toMatch(/realName|Jane Doe/i);
  });
});
```

- [ ] **Step 3: Run — verify pass**

```bash
npm test -- --watchAll=false teamSync
```

Expected: all tests pass (original 5 + new 1).

- [ ] **Step 4: Commit**

```bash
git add src/services/teamSync.js src/__tests__/teamSync.test.js
git commit -m "feat: teamSync pushStudents, getTeamStudents, subscribeTeamStudents"
```

---

### Task 18: Extend TeamProvider with teamStudents

**Files:**
- Modify: `src/context/TeamProvider.jsx`

- [ ] **Step 1: Add state + subscription**

Inside the TeamProvider function, after the teams effect, add:

```jsx
const [teamStudents, setTeamStudents] = useState([]);

useEffect(() => {
  if (!activeTeamId) { setTeamStudents([]); return; }
  let cancelled = false;
  (async () => {
    const list = await import('../services/teamSync').then((m) => m.getTeamStudents(activeTeamId));
    if (!cancelled) setTeamStudents(list);
  })();
  const unsub = (() => {
    let off;
    import('../services/teamSync').then((m) => {
      if (cancelled) return;
      off = m.subscribeTeamStudents(activeTeamId, (payload) => {
        setTeamStudents((prev) => {
          if (payload.eventType === 'INSERT') return [...prev, payload.new];
          if (payload.eventType === 'UPDATE')
            return prev.map((s) => (s.id === payload.new.id ? payload.new : s));
          if (payload.eventType === 'DELETE')
            return prev.filter((s) => s.id !== payload.old.id);
          return prev;
        });
      });
    });
    return () => off && off();
  })();
  return () => { cancelled = true; unsub(); };
}, [activeTeamId]);
```

And add `teamStudents` to the value object returned in the memo.

- [ ] **Step 2: Commit**

```bash
git add src/context/TeamProvider.jsx
git commit -m "feat: TeamProvider subscribes to team_students"
```

---

### Task 19: Wire IEPImport to push team_students

**Files:**
- Modify: `src/components/IEPImport.jsx`

- [ ] **Step 1: Read IEPImport.jsx and locate doBundleImport**

Find the bundle import path where `buildIdentityRegistry` runs and `onBulkImport(Object.values(importStudents), periodMap)` is called.

- [ ] **Step 2: Add cloud push after local import**

Add `useTeam` import, and after `onBulkImport(...)`:

```jsx
import { useTeam } from '../context/TeamProvider';
import { pushStudents } from '../services/teamSync';
// ...
const { activeTeamId, user } = useTeam();
// ... inside doBundleImport, after onBulkImport:
if (activeTeamId) {
  try {
    await pushStudents(activeTeamId, Object.values(importStudents), user?.id);
  } catch (e) {
    console.error('Failed to push to team_students', e);
    // Local import still succeeded; user sees data locally. Non-fatal.
  }
}
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/components/IEPImport.jsx
git commit -m "feat: push roster to team_students on bundle import"
```

---

# Phase 6 — Logs, handoffs, case memory

### Task 20: teamSync logs API + subscribe

**Files:**
- Modify: `src/services/teamSync.js`

- [ ] **Step 1: Append**

```js
// ---------- Logs ----------

function toLogRow(teamId, userId, log) {
  return {
    team_id: teamId,
    user_id: userId,
    student_id: log.studentDbId || null,  // uuid of team_students row
    type: log.type || null,
    category: log.category || null,
    note: log.note || null,
    date: log.date || null,
    timestamp: log.timestamp || new Date().toISOString(),
    period_id: log.periodId || log.period || null,
    tags: log.tags || [],
    source: log.source || 'manual',
    situation_id: log.situationId || null,
    strategy_used: log.strategyUsed || null,
    goal_id: log.goalId || null,
    flagged: Boolean(log.flagged),
    shared: Boolean(log.shared),
  };
}

export async function pushLog(teamId, userId, log) {
  requireClient();
  const row = sanitize(toLogRow(teamId, userId, log), 'logs row');
  const { data, error } = await supabase.from('logs').insert(row).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function pullMyLogs(teamId, userId) {
  requireClient();
  const { data, error } = await supabase
    .from('logs').select('*').eq('team_id', teamId).eq('user_id', userId)
    .order('created_at', { ascending: false }).limit(1000);
  if (error) throw new Error(error.message);
  return data || [];
}

export async function pullSharedTeamLogs(teamId) {
  requireClient();
  const { data, error } = await supabase
    .from('logs').select('*').eq('team_id', teamId).eq('shared', true)
    .order('created_at', { ascending: false }).limit(500);
  if (error) throw new Error(error.message);
  return data || [];
}

export function subscribeSharedLogs(teamId, onChange) {
  requireClient();
  const channel = supabase
    .channel(`logs_shared:${teamId}`)
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'logs', filter: `team_id=eq.${teamId}` },
      (payload) => { if (payload.new?.shared) onChange(payload); })
    .subscribe();
  return () => supabase.removeChannel(channel);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/services/teamSync.js
git commit -m "feat: teamSync logs API + shared-log subscription"
```

---

### Task 21: Wire App.jsx addLog to cloud

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Find existing addLog handler**

Locate the `addLog` function in App.jsx (per `APP_KNOWLEDGE.md` section 9.1).

- [ ] **Step 2: Patch to push to cloud when signed in**

Inside AppInner, near existing `addLog`:

```jsx
import { useTeam } from './context/TeamProvider';
import { pushLog } from './services/teamSync';
// ...
const { activeTeamId, user, teamStudents } = useTeam();

// Replace existing addLog body (or add a wrapper) so cloud push happens:
const addLog = useCallback(async (partial) => {
  const log = createLog(partial);
  setLogs((prev) => [log, ...prev]);
  if (activeTeamId && user?.id) {
    try {
      // Resolve studentDbId: teamStudents array holds rows keyed by pseudonym
      const dbStudent = teamStudents.find((s) => s.pseudonym === partial.pseudonym);
      await pushLog(activeTeamId, user.id, {
        ...log,
        studentDbId: dbStudent?.id || null,
        shared: Boolean(partial.shared),
      });
    } catch (e) {
      console.error('Failed to push log to cloud', e);
    }
  }
}, [activeTeamId, user, teamStudents]);
```

Note: existing call sites that pass `studentId: stu_gen_001` don't know the DB uuid. We look up by pseudonym. Alternate plan: augment app students with `dbId` once the team_students initial pull completes. For this demo, pseudonym match is enough.

- [ ] **Step 3: Verify build**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx
git commit -m "feat: addLog pushes to cloud when signed in"
```

---

### Task 22: Shared-log realtime into TeamProvider

**Files:**
- Modify: `src/context/TeamProvider.jsx`

- [ ] **Step 1: Add sharedLogs state + subscription**

Inside TeamProvider:

```jsx
const [sharedLogs, setSharedLogs] = useState([]);

useEffect(() => {
  if (!activeTeamId) { setSharedLogs([]); return; }
  let cancelled = false;
  let off;
  (async () => {
    const sync = await import('../services/teamSync');
    const initial = await sync.pullSharedTeamLogs(activeTeamId);
    if (cancelled) return;
    setSharedLogs(initial);
    off = sync.subscribeSharedLogs(activeTeamId, (payload) => {
      setSharedLogs((prev) => [payload.new, ...prev]);
    });
  })();
  return () => { cancelled = true; off && off(); };
}, [activeTeamId]);
```

Add `sharedLogs` to the exposed context value.

- [ ] **Step 2: Commit**

```bash
git add src/context/TeamProvider.jsx
git commit -m "feat: TeamProvider subscribes to shared team logs"
```

---

### Task 23: Handoffs API + HandoffInbox

**Files:**
- Modify: `src/services/teamSync.js`
- Create: `src/components/HandoffInbox.jsx`

- [ ] **Step 1: Append handoffs API to teamSync.js**

```js
// ---------- Handoffs ----------

export async function pushHandoff(teamId, fromUserId, h) {
  requireClient();
  const row = sanitize({
    team_id: teamId,
    from_user_id: fromUserId,
    student_id: h.studentDbId || null,
    audience: h.audience || null,
    urgency: h.urgency || 'normal',
    body: h.body,
  }, 'handoffs row');
  const { data, error } = await supabase.from('handoffs').insert(row).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function pullRecentHandoffs(teamId) {
  requireClient();
  const { data, error } = await supabase
    .from('handoffs').select('*').eq('team_id', teamId)
    .gte('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false }).limit(50);
  if (error) throw new Error(error.message);
  return data || [];
}

export function subscribeHandoffs(teamId, onChange) {
  requireClient();
  const channel = supabase
    .channel(`handoffs:${teamId}`)
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'handoffs', filter: `team_id=eq.${teamId}` },
      (payload) => onChange(payload))
    .subscribe();
  return () => supabase.removeChannel(channel);
}

export async function acknowledgeHandoff(handoffId, userId) {
  requireClient();
  // Append-only array update; RLS allows team members to update any handoff.
  const { data: existing, error: e1 } = await supabase
    .from('handoffs').select('acknowledged_by').eq('id', handoffId).single();
  if (e1) throw new Error(e1.message);
  const next = Array.from(new Set([...(existing.acknowledged_by || []), userId]));
  const { error: e2 } = await supabase
    .from('handoffs').update({ acknowledged_by: next }).eq('id', handoffId);
  if (e2) throw new Error(e2.message);
}
```

- [ ] **Step 2: Implement HandoffInbox**

```jsx
// src/components/HandoffInbox.jsx
import React, { useEffect, useState } from 'react';
import { useTeam } from '../context/TeamProvider';
import { pullRecentHandoffs, subscribeHandoffs, acknowledgeHandoff } from '../services/teamSync';

export default function HandoffInbox() {
  const { activeTeamId, user } = useTeam();
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (!activeTeamId) return;
    let cancel = false, off;
    (async () => {
      const initial = await pullRecentHandoffs(activeTeamId);
      if (!cancel) setItems(initial);
      off = subscribeHandoffs(activeTeamId, (payload) => {
        if (payload.eventType === 'INSERT') {
          setItems((prev) => [payload.new, ...prev]);
        } else if (payload.eventType === 'UPDATE') {
          setItems((prev) => prev.map((h) => h.id === payload.new.id ? payload.new : h));
        }
      });
    })();
    return () => { cancel = true; off && off(); };
  }, [activeTeamId]);

  const unseen = items.filter((h) => !(h.acknowledged_by || []).includes(user?.id));

  return (
    <div style={{ padding: 12, borderTop: '1px solid var(--border, #1c2d4a)' }}>
      <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 6 }}>
        Handoffs {unseen.length > 0 && <b style={{ color: '#f87171' }}> · {unseen.length} new</b>}
      </div>
      {items.length === 0 && <div style={{ opacity: 0.5, fontSize: 12 }}>No handoffs yet.</div>}
      {items.map((h) => {
        const seen = (h.acknowledged_by || []).includes(user?.id);
        return (
          <div key={h.id} style={{ padding: 8, marginBottom: 6, background: seen ? 'transparent' : 'rgba(248,113,113,0.1)', borderRadius: 6, border: '1px solid var(--border, #1c2d4a)' }}>
            <div style={{ fontSize: 11, opacity: 0.7 }}>{new Date(h.created_at).toLocaleTimeString()} · {h.urgency}</div>
            <div style={{ fontSize: 13, margin: '4px 0' }}>{h.body}</div>
            {!seen && (
              <button type="button" onClick={() => acknowledgeHandoff(h.id, user?.id)} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, cursor: 'pointer' }}>
                Mark seen
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Render HandoffInbox somewhere visible**

Pick a spot: either in the sidebar (below existing nav in `App.jsx`) or as a dock panel. For the demo, mount in the sidebar: find the sidebar section in App.jsx and add `<HandoffInbox />` just above the Private Roster button.

- [ ] **Step 4: Verify build**

```bash
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add src/services/teamSync.js src/components/HandoffInbox.jsx src/App.jsx
git commit -m "feat: handoffs realtime API + HandoffInbox sidebar panel"
```

---

### Task 24: HandoffBuilder panel — "share with team" toggle

**Files:**
- Modify: `src/components/panels.jsx`

- [ ] **Step 1: Find HandoffBuilder component**

- [ ] **Step 2: Add a "Share with team" toggle and send via pushHandoff**

Inside HandoffBuilder (`src/components/panels.jsx`), import `useTeam` and `pushHandoff`, add a checkbox state, and on save:

```jsx
import { useTeam } from '../context/TeamProvider';
import { pushHandoff } from '../services/teamSync';
// ...
const { activeTeamId, user, teamStudents } = useTeam();
const [shareWithTeam, setShareWithTeam] = useState(true);
// ... in existing submit handler, after local onSave:
if (shareWithTeam && activeTeamId && user?.id) {
  // For multi-student handoffs, send one handoff per student (keeps schema simple)
  for (const stu of selectedStudents) {
    const dbStu = teamStudents.find((s) => s.pseudonym === stu.pseudonym);
    await pushHandoff(activeTeamId, user.id, {
      studentDbId: dbStu?.id,
      audience,
      urgency,
      body: draft, // the AI- or hand-drafted note body
    });
  }
}
```

Render the toggle:
```jsx
<label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
  <input type="checkbox" checked={shareWithTeam} onChange={(e) => setShareWithTeam(e.target.checked)} />
  <span style={{ fontSize: 13 }}>Share with team</span>
</label>
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/components/panels.jsx
git commit -m "feat: HandoffBuilder publishes to team handoffs"
```

---

### Task 25: Case memory sync (incidents / interventions / outcomes)

**Files:**
- Modify: `src/services/teamSync.js`
- Modify: existing case-memory module (likely `src/features/case-memory/*` — locate via `grep -r caseMemory src`)

- [ ] **Step 1: Append to teamSync.js**

```js
// ---------- Case memory ----------

export async function pushIncident(teamId, userId, incident) {
  requireClient();
  const row = sanitize({
    team_id: teamId, user_id: userId,
    student_id: incident.studentDbId || null,
    description: incident.description,
    period_id: incident.periodId || null,
    intensity: incident.intensity || null,
    triggers: incident.triggers || [],
    antecedent: incident.antecedent || null,
    behavior: incident.behavior || null,
    consequence: incident.consequence || null,
    duration_min: incident.durationMin || null,
    staff_response: incident.staffResponse || null,
    follow_up: incident.followUp || null,
  }, 'incidents row');
  const { data, error } = await supabase.from('incidents').insert(row).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function pushIntervention(teamId, userId, intervention) {
  requireClient();
  const row = sanitize({
    team_id: teamId, user_id: userId,
    incident_id: intervention.incidentId || null,
    student_id: intervention.studentDbId || null,
    strategy: intervention.strategy,
    notes: intervention.notes || null,
    worked: intervention.worked || 'unknown',
  }, 'interventions row');
  const { data, error } = await supabase.from('interventions').insert(row).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function pushOutcome(teamId, userId, outcome) {
  requireClient();
  const row = sanitize({
    team_id: teamId, user_id: userId,
    intervention_id: outcome.interventionId || null,
    student_id: outcome.studentDbId || null,
    result: outcome.result,
    notes: outcome.notes || null,
  }, 'outcomes row');
  const { data, error } = await supabase.from('outcomes').insert(row).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function pullCaseMemory(teamId) {
  requireClient();
  const [inc, intv, out] = await Promise.all([
    supabase.from('incidents').select('*').eq('team_id', teamId).order('created_at', { ascending: false }),
    supabase.from('interventions').select('*').eq('team_id', teamId).order('created_at', { ascending: false }),
    supabase.from('outcomes').select('*').eq('team_id', teamId).order('created_at', { ascending: false }),
  ]);
  if (inc.error) throw new Error(inc.error.message);
  return { incidents: inc.data || [], interventions: intv.data || [], outcomes: out.data || [] };
}

export function subscribeCaseMemory(teamId, onChange) {
  requireClient();
  const channel = supabase
    .channel(`case:${teamId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'incidents', filter: `team_id=eq.${teamId}` }, (p) => onChange('incident', p))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'interventions', filter: `team_id=eq.${teamId}` }, (p) => onChange('intervention', p))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'outcomes', filter: `team_id=eq.${teamId}` }, (p) => onChange('outcome', p))
    .subscribe();
  return () => supabase.removeChannel(channel);
}
```

- [ ] **Step 2: Locate existing case memory code path and wire cloud writes**

Run: `grep -rn "caseMemory\|incident\|intervention" src --include="*.js" --include="*.jsx" | head -40`

Find the function that saves a new incident locally (likely `saveIncident` or similar in a `caseMemory` module). After the local save, call `pushIncident` when signed in, and patch the local record with the returned `id` for future interventions/outcomes to reference.

- [ ] **Step 3: Add cloud subscription to TeamProvider**

In `TeamProvider.jsx`, add `caseMemory` state ({ incidents, interventions, outcomes }) and subscribe/pull similarly to sharedLogs.

- [ ] **Step 4: Verify build**

```bash
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add src/services/teamSync.js src/context/TeamProvider.jsx src/features/case-memory
git commit -m "feat: case memory sync (incidents, interventions, outcomes)"
```

---

# Phase 7 — Deploy (user-assisted)

This phase has steps the user must perform (Supabase signup, Google OAuth creds, Vercel hookup). The plan marks each clearly. The AI can prepare files and paste commands into the terminal but cannot complete the cloud operations.

### Task 26: vercel.json + README deploy section

**Files:**
- Create: `vercel.json`
- Modify: `README.md`

- [ ] **Step 1: Write vercel.json**

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "build",
  "framework": "create-react-app",
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

- [ ] **Step 2: Append to README.md a "Cloud deploy" section**

```markdown
## Cloud deploy (Supabase + Vercel)

### 1. Create a Supabase project
1. Sign in at https://supabase.com, click **New project**.
2. Name it `supapara-demo`, pick a region near you, choose the free tier.
3. Once provisioned, open **Settings → API**. Copy **Project URL** and **anon public key**.

### 2. Configure Google OAuth
1. In Google Cloud Console, create an OAuth 2.0 Client ID (Web).
2. Authorized redirect URI: `https://<your-project-ref>.supabase.co/auth/v1/callback`.
3. Paste the Client ID and Client Secret into Supabase → **Auth → Providers → Google**. Enable.
4. In Supabase → **Auth → URL Configuration**, set Site URL to your Vercel URL (set after step 4).

### 3. Apply migrations
```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```
Verify in dashboard → Table Editor that all 7 tables are present with RLS enabled.

### 4. Deploy to Vercel
1. Push repo to GitHub if not already.
2. On Vercel, import the repo. Framework: Create React App. Build: `npm run build`. Output: `build/`.
3. Project Settings → Environment Variables — add **Production + Preview**:
   - `REACT_APP_SUPABASE_URL` = your project URL
   - `REACT_APP_SUPABASE_ANON_KEY` = your anon key
4. Deploy. Copy the production URL back into Supabase Site URL (step 2.4).

### 5. Local dev
```bash
cp .env.local.example .env.local
# fill in URL + anon key from Supabase dashboard
npm start
```
```

- [ ] **Step 3: Commit**

```bash
git add vercel.json README.md
git commit -m "docs: add cloud deploy instructions + vercel.json"
```

---

### Task 27: USER ACTION — provision Supabase + apply migrations

**User-only steps. AI pauses here.**

- [ ] User signs up at https://supabase.com and creates project `supapara-demo`.
- [ ] User runs `npx supabase link --project-ref <ref>` then `npx supabase db push`.
- [ ] User configures Google OAuth provider in Supabase dashboard per README.
- [ ] User pastes anon key + URL into local `.env.local`.
- [ ] User runs `npm start` and verifies sign-in flow works.

---

### Task 28: USER ACTION — Vercel deploy

**User-only steps.**

- [ ] User connects repo to Vercel.
- [ ] User sets env vars in Vercel for Production + Preview.
- [ ] User triggers first deploy.
- [ ] User adds production URL to Supabase Auth → URL Configuration → Site URL + Additional Redirect URLs.
- [ ] User verifies Google OAuth works on the deployed URL.

---

# Phase 8 — Integration test + demo verification

### Task 29: Playwright two-browser realtime test

**Files:**
- Create: `e2e/team-realtime.spec.ts`

- [ ] **Step 1: Write the test**

```ts
// e2e/team-realtime.spec.ts
// Verifies realtime fan-out between two paras on the same team.
// Prerequisites (manual): two test Google accounts, both invited into a test team.
// Env: E2E_APP_URL, E2E_A_EMAIL, E2E_A_PASSWORD, E2E_B_EMAIL, E2E_B_PASSWORD, E2E_INVITE_CODE.
import { test, expect, chromium } from '@playwright/test';

test('shared handoff appears on teammate within 3s', async () => {
  const browser = await chromium.launch();
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const pageA = await ctxA.newPage();
  const pageB = await ctxB.newPage();

  await pageA.goto(process.env.E2E_APP_URL!);
  await pageB.goto(process.env.E2E_APP_URL!);

  // Sign in flow is manual via Google; this test assumes already-signed-in sessions
  // via saved storage state. For a first cut, skip the sign-in automation and
  // require the tester to run `npx playwright codegen` to capture storage state first.

  // Post a handoff from A
  await pageA.getByRole('button', { name: /handoff/i }).click();
  const unique = `chair throw at ${Date.now()}`;
  await pageA.getByRole('textbox', { name: /handoff note/i }).fill(unique);
  await pageA.getByRole('checkbox', { name: /share with team/i }).check();
  await pageA.getByRole('button', { name: /save|send/i }).click();

  // Expect it to appear on B within 3 seconds
  await expect(pageB.getByText(unique)).toBeVisible({ timeout: 3000 });

  await browser.close();
});
```

- [ ] **Step 2: Add npm script**

In `package.json` add:
```json
"scripts": {
  "test:e2e": "playwright test e2e/"
}
```

- [ ] **Step 3: Commit**

```bash
git add e2e/team-realtime.spec.ts package.json
git commit -m "test(e2e): two-browser realtime handoff test"
```

---

### Task 30: Manual demo script + success criteria sign-off

**Files:** none (this is a procedural task)

- [ ] **Step 1: Walk the spec's success criteria live**

Replay all 5 success criteria from `docs/superpowers/specs/2026-04-22-cloud-backend-design.md` section "Success criteria":

1. Create team, share invite code, second account joins in < 30 s.
2. Team owner imports combined bundle; second account sees roster within 5 s without reload.
3. Second account posts a shared log + handoff; first account sees within 2 s.
4. Audit: run `select * from team_students` in Supabase dashboard. Confirm no row contains any real name. Also check `logs`, `handoffs`, `incidents`.
5. Sign out + back in. Personal logs return. Real names are NOT restored — user must re-load private-roster JSON locally.

- [ ] **Step 2: If any criterion fails, file an issue and return to the offending phase.**

- [ ] **Step 3: Tag release**

```bash
git tag -a v1.0-cloud-demo -m "Cloud backend demo ready"
```

---

## Self-review checklist

Run before considering the plan done:

- **Spec coverage:**
  - Auth + team create/join → Tasks 12–16 ✓
  - Schema (teams, team_members, team_students, logs, incidents, interventions, outcomes, handoffs) → Tasks 4–7 ✓
  - RLS + FERPA trigger → Tasks 4–7 ✓
  - Sync strategy (realtime for team_students, shared logs, handoffs, case memory; pull-on-login for personal logs) → Tasks 18, 20–25 ✓
  - FERPA client guard → Task 9 ✓
  - Roster / pseudonym resolution → Tasks 17–19 ✓
  - Deployment → Tasks 26–28 ✓
  - Testing → Tasks 9, 11, 17, 29 ✓
  - Open questions (handoff expiry 24h default) → Task 6 `expires_at default` ✓
- **No placeholders:** grep the plan for TBD/TODO → none.
- **Type consistency:**
  - `pushStudents`, `pushLog`, `pushHandoff`, `pushIncident`, `pushIntervention`, `pushOutcome` — consistent naming ✓
  - Subscribe helpers all return an unsubscribe function ✓
  - `sanitize()` wraps every cloud-bound payload ✓
