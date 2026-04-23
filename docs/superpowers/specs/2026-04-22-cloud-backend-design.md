# Cloud Backend (Supabase + Vercel) — Design Spec
**Date:** 2026-04-22
**Status:** Draft — awaiting user review
**Scope:** Add a cloud backend to SupaPara so paras on the same team can share pseudonymous data in realtime. Preserve existing FERPA guarantees. No changes to local AI (Ollama) or classroom tools.

---

## Problem

SupaPara is frontend-only today. Logs and imported students live in `localStorage`; `identityRegistry` (real names) lives in React state. This is great for privacy but blocks the roadmap's core team feature:

> *"If a kid throws a chair in 1st period, the para who has him in 2nd period needs to see that context when class starts."*

A real school has multiple paras sharing students across the day. Without a backend they have no way to pass handoff notes, share case memory, or see what another para already tried with a given student. The existing demo data is static — impressive to walk through once, but it can't show multi-para collaboration.

---

## Goals

- Multiple paras sign in with Google, create or join a team via invite code, and share pseudonymous data.
- Handoffs between paras appear in near-realtime (< 2 s) without a page reload.
- Case memory (incidents / interventions / outcomes) is team-shared so every para benefits from what others have tried.
- A para's personal notebook (non-shared logs) is cloud-backed so their data isn't lost if a device breaks. Last-write-wins across devices; no multi-device realtime.
- Real names **never** leave the device. The cloud schema has no place to store them.
- The app still works offline — cached data from the last sync is readable; writes queue and flush on reconnect.
- Deployed to a public URL so the user can demo from any laptop.
- Demo/pilot cost: $0/mo. Growth path: $25/mo Supabase Pro + $20/mo Vercel Pro if needed.

---

## Out of Scope

- Multi-device realtime for a *single* para's personal logs. Hybrid sync (pull on login, push on change) only.
- Cloud-hosted AI. Ollama stays local; `engine/cloudAI.js` is a future concern.
- Email invites, password reset flows. Google OAuth only.
- Admin / case-manager view (the "school pilot" tier from brainstorming). Teams only.
- Offline conflict resolution for shared data. Realtime assumes online-ish; offline writes reconcile last-write-wins.
- Mobile layout work. Desktop demo only per user's explicit scope.
- Migrating existing `localStorage` data into the cloud. First sign-in starts clean; user can re-import their bundle.

---

## Architecture

### Stack

- **Hosting:** Vercel (static React build, hobby tier).
- **Backend:** Supabase — managed Postgres + Auth + Realtime. No custom server.
- **Client:** Existing React SPA + `@supabase/supabase-js` v2.
- **Auth:** Google OAuth via Supabase Auth.
- **Authorization:** Postgres Row Level Security. Every team-scoped table filters by `team_id ∈ (teams where user is member)`.

### Component map

```
Browser (Vercel-served React SPA)
│
├── SESSION-ONLY, never leaves device:
│     identityRegistry (real names, React state)
│     private-roster-*.json files (user downloads)
│
├── src/services/supabaseClient.js
│     Singleton Supabase client. Reads REACT_APP_SUPABASE_URL / _ANON_KEY.
│
├── src/services/teamSync.js
│     All cloud CRUD and realtime channels. Exposes:
│       signIn(), signOut()
│       createTeam(name), joinTeamByCode(code), getMyTeams()
│       pushStudents(students), subscribeStudents(teamId)
│       pushLog(log, { shared }), subscribeSharedLogs(teamId)
│       pushHandoff(handoff), subscribeHandoffs(teamId)
│       pushIncident / Intervention / Outcome and their subscribers
│     All writes run through stripUnsafeKeys() first.
│
├── src/services/stripUnsafeKeys.js
│     Recursive guard. Removes keys matching
│     /realname|real_name|student_name|firstname|lastname/i before any cloud write.
│     Throws in development; silently strips in production.
│
└── src/context/TeamProvider.jsx
      React context around the tree. Exposes:
        { user, team, teamStudents, sharedLogs, handoffs, caseMemory,
          signIn, signOut, createTeam, joinTeam, switchTeam }
      Wires subscriptions on team load, tears them down on unmount / signout.
```

### Data flow

**On sign-in:**
1. Supabase returns session → `TeamProvider` loads `getMyTeams()`.
2. If zero teams, show create/join modal. If one team, auto-select. If multiple, show switcher.
3. On team select, open realtime subscriptions for `team_students`, shared `logs`, `handoffs`, `incidents`, `interventions`, `outcomes`.
4. Pull personal `logs` (where `user_id = self`, `shared = false`) — last-write-wins into localStorage cache.

**On log create:**
1. User clicks log. Existing code calls `createLog()`.
2. `TeamProvider.pushLog(log, { shared })` writes to Supabase.
3. If `shared = true`, realtime fans it out to team members instantly.
4. Local state updates optimistically; reconciles with server id on ack.

**On handoff send:**
1. HandoffBuilder panel gets a "Share with team" toggle (default on).
2. `pushHandoff()` writes a row with `team_id`, `from_user_id`, `student_id`, `body`, `urgency`.
3. Other paras on the team see a toast + red-dot sidebar indicator within ~1 s.

---

## Schema

All tables carry `team_id uuid` and are covered by RLS.

```sql
-- Teams and membership
teams
  id              uuid primary key default gen_random_uuid()
  name            text not null
  invite_code     text unique not null  -- 6-char uppercase alphanumeric
  created_by      uuid references auth.users not null
  created_at      timestamptz default now()

team_members
  team_id         uuid references teams on delete cascade
  user_id         uuid references auth.users on delete cascade
  role            text check (role in ('owner','member')) default 'member'
  display_name    text not null         -- "Alice", shown on handoffs
  joined_at       timestamptz default now()
  primary key (team_id, user_id)

-- Canonical team roster (pseudonymous only)
team_students
  id              uuid primary key default gen_random_uuid()
  team_id         uuid references teams on delete cascade
  pseudonym       text not null         -- "Red Student 1"
  color           text not null         -- "#ef4444"
  period_id       text
  class_label     text
  eligibility     text
  accs            jsonb default '[]'
  goals           jsonb default '[]'
  case_manager    text
  grade_level     text
  tags            jsonb default '[]'
  flags           jsonb default '{}'
  watch_fors      jsonb default '[]'
  do_this_actions jsonb default '[]'
  health_notes    jsonb default '[]'
  cross_period    jsonb default '{}'
  source_meta     jsonb default '{}'
  external_key    text                  -- future: roadmap's externalStudentKey
  created_by      uuid references auth.users
  created_at      timestamptz default now()
  updated_at      timestamptz default now()

-- Observations and notes
logs
  id              uuid primary key default gen_random_uuid()
  team_id         uuid references teams on delete cascade
  user_id         uuid references auth.users
  student_id      uuid references team_students
  type            text
  category        text
  note            text
  date            date
  timestamp       timestamptz
  period_id       text
  tags            jsonb default '[]'
  source          text                  -- manual|quick_action|engine|ai
  situation_id    text
  strategy_used   text
  goal_id         text
  flagged         boolean default false
  shared          boolean default false -- true = team-visible
  created_at      timestamptz default now()

-- Case memory chain
incidents
  id              uuid primary key default gen_random_uuid()
  team_id         uuid references teams on delete cascade
  user_id         uuid references auth.users
  student_id      uuid references team_students
  description     text
  period_id       text
  intensity       text
  triggers        jsonb default '[]'
  antecedent      text
  behavior        text
  consequence     text
  duration_min    int
  staff_response  text
  follow_up       text
  created_at      timestamptz default now()

interventions
  id              uuid primary key default gen_random_uuid()
  incident_id     uuid references incidents on delete cascade
  team_id         uuid references teams on delete cascade
  user_id         uuid references auth.users
  student_id      uuid references team_students
  strategy        text
  notes           text
  worked          text                  -- yes|partial|no|unknown
  created_at      timestamptz default now()

outcomes
  id              uuid primary key default gen_random_uuid()
  intervention_id uuid references interventions on delete cascade
  team_id         uuid references teams on delete cascade
  user_id         uuid references auth.users
  student_id      uuid references team_students
  result          text
  notes           text
  created_at      timestamptz default now()

-- Pseudonymous notes between paras
handoffs
  id              uuid primary key default gen_random_uuid()
  team_id         uuid references teams on delete cascade
  from_user_id    uuid references auth.users
  student_id      uuid references team_students  -- nullable = team-wide
  audience        text                  -- next_para|teacher|end_of_day|urgent
  urgency         text                  -- normal|important|urgent
  body            text not null
  acknowledged_by uuid[] default '{}'
  created_at      timestamptz default now()
  expires_at      timestamptz           -- auto-hide after 24h by default
```

### Indexes

- `logs (team_id, created_at desc)`
- `logs (team_id, shared, created_at desc)` for the team feed
- `handoffs (team_id, created_at desc)`
- `team_students (team_id, period_id)`
- `team_members (user_id)` for `getMyTeams()`

### RLS policies (pattern repeats per table)

```sql
alter table logs enable row level security;

create policy "read team logs"
  on logs for select using (
    team_id in (select team_id from team_members where user_id = auth.uid())
    and (shared = true or user_id = auth.uid())
  );

create policy "insert own logs"
  on logs for insert with check (
    user_id = auth.uid()
    and team_id in (select team_id from team_members where user_id = auth.uid())
  );

create policy "update own logs"
  on logs for update using (user_id = auth.uid());
```

Same pattern on `team_students`, `incidents`, `interventions`, `outcomes`, `handoffs` — members read team rows, users insert as themselves, users update only their own rows.

### Join-by-invite-code RPC

Users aren't members yet when they look up a team by code, so a normal RLS policy can't let them see `teams` rows. Use a `security definer` RPC:

```sql
create function join_team_by_code(code text, display text)
returns teams
language plpgsql security definer
set search_path = public
as $$
declare t teams;
begin
  select * into t from teams where invite_code = upper(trim(code));
  if not found then
    raise exception 'Invalid invite code' using errcode = 'P0002';
  end if;
  insert into team_members (team_id, user_id, role, display_name)
  values (t.id, auth.uid(), 'member', display)
  on conflict (team_id, user_id) do update set display_name = excluded.display_name;
  return t;
end $$;

grant execute on function join_team_by_code(text, text) to authenticated;
```

---

## Auth and team flows

### Sign in

- Signed-out landing page: BrandHeader + centered "Sign in with Google" button.
- Click → `supabase.auth.signInWithOAuth({ provider: 'google' })` → Google consent → redirect back.
- Supabase session persists in localStorage automatically; `onAuthStateChange` drives the TeamProvider.

### First-time user (zero teams)

Modal with two tabs:

- **Create team.** Input: team name (e.g. "Lincoln Middle School"). On submit:
  - Insert into `teams`, generating `invite_code` via a `gen_invite_code()` SQL function (6 chars, uppercase, no ambiguous `O/0/I/1`).
  - Insert self into `team_members` as `owner`.
  - Show the invite code with a copy button.
- **Join team.** Input: invite code, display name (prefilled from Google given name). Calls `join_team_by_code` RPC.

### Returning user

Straight to Dashboard. Team switcher dropdown in BrandHeader when `getMyTeams().length > 1`.

### Sign out

Sign-out handler:
1. Clears React state: `identityRegistry`, cached logs, cached students.
2. Calls `supabase.auth.signOut()`.
3. Routes to the signed-out landing page.

---

## Sync strategy

| Data | Storage | Realtime? | Notes |
|---|---|---|---|
| `team_students` | Cloud | Subscribe on team load | Initial pull + stream updates |
| `handoffs` | Cloud | Yes | Toast + sidebar indicator on new |
| `logs (shared=true)` | Cloud | Yes | Team Data Vault |
| `logs (shared=false)` | Cloud + localStorage cache | No | Pull on login, push on change, last-write-wins |
| `incidents / interventions / outcomes` | Cloud | Yes | Team-shared case memory |
| `identityRegistry` (real names) | React state only | **Never** | Session-only, zero persistence |
| UI prefs | localStorage | No | Per-device |

### Offline behavior

- Reads fall through to localStorage cache when the Supabase client is offline.
- Writes queue in an in-memory outbox (`pendingWrites[]`) and flush on reconnect.
- `supabase-js` v2's realtime client auto-reconnects; on reconnect we re-fetch and re-subscribe.
- This is a demo-grade safety net, not a full offline-first implementation.

---

## Roster and pseudonym resolution

The existing `IEPImport.doBundleImport()` flow runs unchanged through `buildIdentityRegistry()`. One added step:

1. `buildIdentityRegistry(bundleData)` → `{ registry, importStudents, periodMap }` (as today).
2. **New:** if a team is active, `teamSync.pushStudents(Object.values(importStudents))` writes the pseudonymous students to `team_students`.
3. `registry` (with real names) remains in React state only. "Save Private Roster JSON" modal works exactly as today.

Other paras who join the team auto-receive `team_students` via the initial subscribe. If they have the matching `private-roster-*.json` file (shared out-of-band — USB, in person, whatever school policy allows), they load it through the RosterPanel to hydrate their local `identityRegistry`. If they don't have the file, they see all team data with pseudonyms only — the app still works.

---

## FERPA guarantees (defense in depth)

1. **Schema has no real-name column.** Grep-able guarantee.
2. **`stripUnsafeKeys()` guard** runs on every cloud-bound payload. Removes keys matching `/realname|real_name|student_name|firstname|lastname/i` recursively. Throws in dev if any match.
3. **`teamSync.js` never imports `identityRegistry`.** The module boundary prevents accidental leaks.
4. **Unit test** feeds a student object with `realName`, `student_name`, `firstName` fields through every serializer and cloud-write path. Asserts output contains no trace.
5. **RLS prevents cross-team reads** even if the client is compromised or asks for the wrong row.
6. **Private roster artifacts stay on-device.** The app never uploads a `.json` file containing real names. RosterPanel upload/download is local-only.

---

## Deployment

### Supabase

- One project, `supapara-demo`, on the free tier.
- Migrations in `supabase/migrations/` (SQL, committed to the repo).
- Apply migrations via `supabase db push` from the Supabase CLI.
- Seed data (nothing — team creation is in-app).
- Google OAuth enabled in Supabase Auth settings; authorized redirect URL includes the Vercel domain(s).

### Vercel

- Project linked to the git repo (initialize repo if not already — check `JPDs-gZD/` for `.git`).
- Build command: `npm run build` (existing `react-scripts build`).
- Env vars (Preview + Production): `REACT_APP_SUPABASE_URL`, `REACT_APP_SUPABASE_ANON_KEY`.
- Preview URL per PR; Production on `main`.

### Local dev

- `.env.local` (git-ignored) with the same two env vars.
- `npm start` hits the cloud Supabase project — no local Postgres needed for the demo. Swap to a local Supabase stack later if we need it.

---

## Testing

### Unit

- `stripUnsafeKeys()` with various nested payloads, including deeply nested `realName` keys.
- Pseudonym generator unaffected (existing tests pass).
- Log category detection and tag generation (existing tests pass).

### Schema

- Migrations apply cleanly on a fresh Supabase project.
- RLS policies: SQL tests (pgtap-style) asserting user A in team X can read their own + shared logs, cannot read user B's private logs, cannot read team Y's logs at all.

### Integration (Playwright — already in devDependencies)

- Two-browser test: User A signs in to team X, posts a shared log. User B (different Google account, same team) sees the log within 2 s via realtime.
- User C in team Y never receives the event.
- Handoff flow: User A sends handoff to team; User B sees toast, acknowledges, `acknowledged_by` updates.

### Manual demo script

- The three scenarios from `DEMO_MODE_PLAN.md` replayed across two browsers with two accounts. Handoff from one browser appears in the other inside two seconds.
- Sign out → sign back in → personal logs restored from cloud, real names *not* restored (requires re-loading private-roster JSON).

---

## Migration and rollout

This is additive. Existing `localStorage`-only behavior remains the default when the user is signed out. Sign-in activates cloud features. First sign-in starts with empty cloud state; user re-imports their bundle to populate the team roster.

No automatic migration of existing local data into the cloud in v1. If users ask for it later, add a one-time "Upload my local data to this team" button.

---

## Open questions (fix before implementation plan)

- **Handoff expiry default.** 24 h feels right but should confirm. Expired handoffs are hidden in the UI, not deleted, so they're still queryable for analytics.
- **Display name editing.** Show in a small settings modal, or only at team-join time? Demo leans toward join-time only; editable later.
- **Team switcher location.** BrandHeader dropdown vs. a sidebar item. BrandHeader matches existing layout best.
- **Invite code regeneration.** Should owners be able to rotate the code if it leaks? Add `regenerate_invite_code` RPC, owner-only. Nice-to-have for demo, essential for pilot.

---

## Success criteria

The design is successful if, during a demo:

1. User creates a team, shares the invite code, a second account joins inside 30 seconds.
2. One account imports the combined bundle; the other account sees the team roster within 5 seconds without reloading.
3. One account posts a shared log / handoff; the other sees it within 2 seconds.
4. No cloud row, in any table, anywhere, ever contains a real student name. Provable by `select` audit.
5. Signing out and back in restores the user's personal notebook from the cloud. Real names are not restored (they're gone with the session, as designed).
