# SupaPara — Privacy Architecture & Data Model

## The privacy invariant

**Real student names never leave the user's device.**

This rule is what makes SupaPara easier to review for school use than ordinary shared docs or generic cloud tools. Every architectural decision flows from it.

## How the invariant is enforced (defense in depth)

There are 5 layers. A bug in any one of them is caught by the others.

### Layer 1 — VaultProvider owns the names

`src/context/VaultProvider.jsx` is a React Context that holds `realNameById` (a map from studentId → real name). This is the **only place** real names live in the running app.

- It's never passed as a prop into any cloud-call function.
- Persistence is opt-in: by default, names are session-only (gone on refresh).
- Opt-in persistence writes to **IndexedDB** (the user's browser) — never to the network.
- Auto-wipes after 14 days of inactivity (configurable).

### Layer 2 — `resolveLabel()` is the only name display function

`src/privacy/nameResolver.js` exports `resolveLabel(student, mode)`. This is the single function any UI component uses to get a display string.

- If `showRealNames === true` AND a name is loaded in the vault → returns the real name.
- Otherwise → returns the **pseudonym** (e.g. "Red Student 1") OR the **Para App Number** (e.g. "847293").
- Mode argument: `"compact"`, `"full"`, or default. Controls truncation.

By auditing this one file, you prove no name leaks via display. Every screen, modal, log card, and AI prompt routes through here.

### Layer 3 — `stripUnsafeKeys()` filters cloud writes

`src/services/stripUnsafeKeys.js` is called on every payload before a Supabase insert/update.

- Strips known PII keys: `realName`, `firstName`, `lastName`, `studentName`, `name` (when in student context).
- Defensive — even if a developer forgets to use `resolveLabel`, this catches the leak.

### Layer 4 — AI prompt scrubbing

`src/features/import/iepExtractor.js` exports `stripNameFromSection()`. Before any IEP text is sent to AI (Ollama or Gemini), the student's real name is replaced with `[STUDENT]`.

`src/context/buildContext.js` always uses `resolveLabel(student)` to build student blocks for AI prompts. The AI receives "Red Student 1" or the Para App Number — never the real name.

This applies to **both** local Ollama and cloud Gemini.

### Layer 5 — Separate export functions

`src/utils/exportCSV.js` exports two distinct functions:
- `exportCSV(logs)` — public export. Pseudonyms only. Used by "Export filtered data" / "Export everything" buttons (orange CTA + secondary).
- `exportCSVPrivate(logs)` — names included. Used by "Export with real names" — bright yellow warning button, only shown when name list is loaded.

Both share the same column shape: `Date, Period, Period ID, Student, Para App Number, Type, Category, Flagged, Tags, Observation`. The Para App Number column is present in both safe and private exports — it's the FERPA-safe stable identifier (see below).

The richer Sheets-ready `.xlsx` export from `src/features/export/exportWorkbook.js` follows the same rule: pseudonyms-by-default, real names only behind the explicit private path.

The user has to actively choose the private export. Default is always safe.

## The Para App Number — the FERPA-safe stable bridge identifier

This is the single most important identifier in SupaPara's privacy model, and the part that does the most subtle work. Worth being explicit about how it differs from the local `studentId`.

### Why two identifiers exist

The app has **two** student identifiers, and they do different jobs:

- **`studentId` (local).** Generated on the device when the kid first appears in the user's roster. Ephemeral. **Regenerates** when:
  - the roster is re-imported (different file, same kids — fresh ids);
  - local storage is cleared (browser data wipe, "forget this site");
  - a fresh device first-syncs from the cloud (the cloud row has a UUID, but the local mirror gets a fresh local id).
  - This is a feature, not a bug — locally regenerated ids decouple the local app instance from any global registry, which is part of why the local side stays cheap and offline-friendly.
- **`paraAppNumber` (stable).** Assigned once when the kid enters the system. Persists across re-imports. Survives device migration. Never tied to a real name. Unique within the para's app instance (and, when the team is wired in, agreed across the team via the cloud row's `external_key`).

The pseudonym ("Red Student 1") is just a display affordance — it's derived from `studentId` and is not the bridge. The bridge is `paraAppNumber`.

### Why this matters in practice — roster turnover

The whole point of the bridge is that a kid's history stays attached to them across the kinds of churn that real para work produces:

- Last semester this kid was Period 3. This semester she's in Period 1.
- The roster file got re-exported from the SIS and re-imported.
- Dre got a new Chromebook and synced fresh.

In all of those cases, the local `studentId` rotates. Every log written under the *old* local id would be orphaned if `studentId` were the only handle. With `paraAppNumber` carried on every log row, the reconnect path can heal them: same kid, same paraAppNumber, fresh local id mapped underneath.

### Where it lives in the schema

- Local logs carry `paraAppNumber` directly on the log object.
- Cloud rows carry it as `external_key` — same value, schema-level column. Migration `20260429120000_logs_external_key.sql` added this column to `logs`, `handoffs`, `incidents`, `interventions`, and `outcomes`. Indexed by `(team_id, external_key)` so the reconnect lookup is cheap.
- The cloud `logs.student_id` foreign key is `references team_students on delete set null`. When a `team_students` row gets regenerated (a different para re-imports the roster, a fresh device first-syncs), the FK can go null. The `external_key` column is what survives that transition and re-attaches the log to the right kid.
- `team_students.external_key` (the same column name on the student row) is what `(team_id, external_key)` upserts on, so re-imports update in place rather than minting duplicate rows.

### Where the resolver fallback lives

Two specific spots in the code make the bridge real for paras:

- **`src/components/modals/StudentProfileModal.jsx`** — the `stuLogs` filter. When the user opens a kid's profile, the logs tab needs to find every log for that kid. It does both: matches by `studentId` (the modern path) **AND** by `paraAppNumber` (the bridge path). So a log written under the old local id, after a re-import, still shows up on the kid's profile.
- **`src/utils/exportCSV.js`** — the row builder. When pulling the Para App Number for the column, it prefers `student.paraAppNumber` (current state) but falls back to `log.paraAppNumber` so logs whose student record has gone missing still surface their bridge id in the export.
- **`src/features/roster/rosterUtils.js`** — exposes `resolveStudentByParaAppNumber` for any caller that needs the bridge directly, plus the merging logic that re-attaches `paraAppNumber` onto incoming roster entries when older imports didn't carry it.

### FERPA implication

`paraAppNumber` is generated locally, never carries real names, and is unique within the para's app instance. The cloud bridge — `logs.external_key` and friends — only widens the cloud surface to include this para-internal identifier, not anything that increases the reidentification surface against an outside observer. A breach of the cloud database still hands an attacker:

- pseudonyms ("Red Student 1"),
- per-team Para App Numbers like `847293`,
- structured fields with no names anywhere.

It does not hand them anything that can be cross-referenced back to a real student without the local Vault. The bridge is a *para* convenience, not a global registry.

## Data flow diagram (text version)

```
USER'S COMPUTER                          CLOUD (Supabase)
─────────────────                        ─────────────────
[Real names file]                        teams (no names)
     ↓                                   team_members (user IDs only)
VaultProvider (RAM)         →            team_students (Para App # only,
     ↓                                                  + period_ids[])
resolveLabel()                           logs / handoffs (FK to team_students,
     ↓                                                   + external_key bridge)
Display ✓                                parent_notes (admin-only, FK to team_students)
     ↓                                   para_assignments (student assignments)
buildContext (uses resolveLabel)         team_join_requests (pending join requests)
     ↓                                   incidents/interventions/outcomes
AI prompt → Ollama (local) OR Gemini (cloud)
                               ↑
                    Names already resolved/stripped
                    BEFORE this point
```

## Supabase data model

SQL migrations live in `supabase/migrations/`. Schema below in plain language.

### Tables

#### `teams`
One row per school's special-ed team.
- `id` (uuid, primary key)
- `name` (text)
- `normalized_name` (text, generated stored — lower-case + non-alphanumerics stripped). Indexed for the duplicate-team pre-flight check (`find_similar_team`). So "Fair-View Middle School" and "FAIR VIEW MIDDLE SCHOOL" both normalize to `fairviewmiddleschool`.
- `invite_code` (text, unique) — 6-character team join code. Joins as `para` or `sub`; never as admin.
- `owner_code` (text, unique) — 12-character `OWN-XXXXXXXX` admin invite code. Joins as `sped_teacher`. Distinct prefix from `invite_code` so the client auto-detects which path to use. Drawn from a 31-char alphabet that omits look-alike chars (no 0/O/1/I/L). Multi-use, owner-rotatable.
- `created_by` (uuid → auth.users)
- `allow_subs` (bool, default true) — master switch for sub access
- `created_at`

#### `team_members`
Membership + role per user per team.
- `team_id` (uuid → teams)
- `user_id` (uuid → auth.users)
- `display_name` (text)
- `role` (text: `owner` | `sped_teacher` | `para` | `sub`)
- `active` (bool, default true) — admin can deactivate without deleting
- `joined_at`
- Composite primary key: `(team_id, user_id)`

#### `team_students`
Cloud-safe student records. **Never has real names.**
- `id` (uuid)
- `team_id` (uuid → teams)
- `pseudonym` (text — e.g. "Red Student 1")
- `color` (text — hex color)
- `external_key` (text — the Para App Number when available)
- `period_id` (text — legacy single-period column, kept for fallback)
- `period_ids` (text[]) — array of all periods this kid appears in. GIN-indexed. Lets a kid in Period 1 *and* Period 3 survive cloud sync without one period's row erasing the other. Backfilled from `period_id` for legacy rows.
- `class_label`, `eligibility`, `case_manager`, `grade_level`
- `goals`, `accs`, `tags`, `flags`, `watch_fors`, `do_this_actions`, `health_notes`, `cross_period`, `source_meta` — JSONB IEP/support data
- `created_by` (uuid → auth.users)
- `created_at`
- Unique index: `(team_id, external_key)` when an external key exists, so repeated imports update the same student instead of duplicating them.

#### `logs`
Notes, behavior observations, goal progress, and local records of handoffs.
- `id` (uuid)
- `team_id`, `user_id`
- `student_id` (uuid → team_students, `on delete set null`)
- `external_key` (text — the Para App Number; the FERPA-safe stable bridge that survives even when the FK above goes null)
- `type` (text: General Observation, Behavior Note, Goal Progress, Handoff Note, etc.)
- `category`, `note`, `tags`
- `date`, `timestamp`, `period_id`
- `flagged` (bool)
- `shared` (bool) — when true, other team members see it; when false, only the author
- `created_at`
- Indexed: `(team_id, external_key)` partial index for non-null bridge keys.

#### `handoffs`
Realtime team handoffs separate from normal logs.
- `id`, `team_id`, `from_user_id`, `student_id`, `external_key`
- `audience`, `urgency`, `body`
- `acknowledged_by` (uuid array)
- `expires_at` defaults to 24 hours after creation

#### `parent_notes`
Sped-teacher-only private notes about parents.
- `id`, `team_id`, `student_id`
- `body` (text)
- `created_by` (user_id)
- RLS: only owner + sped_teacher can SELECT.

#### `para_assignments`
Maps assigned students to paras/subs.
- `id`, `team_id`, `student_id`
- `para_user_id` for an existing user OR `pending_email` for pre-registration
- `assigned_by`, `assigned_at`
- Admins can read all assignments in their team. Paras/subs can read their own current assignments.

#### `team_join_requests` (Phase C)
Pending requests when a para hits "request to join" without an invite or owner code.
- `id`, `team_id`, `user_id`, `display_name`, `message`
- `requested_role` (`para` | `sub` | `sped_teacher`)
- `status` (`pending` | `approved` | `denied`)
- `decision_reason`, `decided_at`, `decided_by`
- `created_at`
- Unique partial index on `(team_id, user_id)` where `status = 'pending'` — one open ask at a time per (team, user).
- RLS:
  - The requester can SELECT their own row at any status.
  - Owner + sped teachers of the target team can SELECT all rows for their team.
  - INSERT and UPDATE only flow through `security definer` RPCs (`request_to_join_team`, `approve_join_request`, `deny_join_request`); no direct policies for those verbs.

#### `incidents`, `interventions`, `outcomes`
Case-memory tables for behavior events and what worked.
- All include `team_id`, `user_id`, optional `student_id`, `external_key`, and structured fields.
- Team members can read team case memory while active/allowed; inserts must be authored by the caller.
- The `external_key` column rides the same paraAppNumber bridge as `logs`, so case-memory rows reconnect across roster regen too.

### Row Level Security (RLS) — the auth boundary

Every table has RLS enabled. Policies use **security-definer helper functions** to avoid the recursion problem and to enforce role/access rules:

```sql
-- Helper: can the caller currently access this team?
-- Requires active membership. Subs also require teams.allow_subs = true.
create or replace function can_access_team(tid uuid)
returns boolean language sql stable as $$
  select exists(
    select 1
    from team_members tm
    join teams t on t.id = tm.team_id
    where tm.team_id = tid
      and tm.user_id = auth.uid()
      and tm.active = true
      and (tm.role <> 'sub' or t.allow_subs = true)
  );
$$ security definer;

-- Backward-compatible helper name used by older policies.
create or replace function is_member_of_team(tid uuid)
returns boolean language sql stable as $$
  select can_access_team(tid);
$$ security definer;

-- Helper: is the caller an admin (owner OR sped teacher)?
create or replace function is_team_admin(tid uuid)
returns boolean language sql stable as $$
  select exists(
    select 1 from team_members
    where team_id = tid and user_id = auth.uid()
      and role in ('owner', 'sped_teacher') and active = true
  );
$$ security definer;
```

Why `security definer`? Because policies on `team_members` that query `team_members` directly cause infinite recursion. The helper function runs as the function owner (postgres) so it bypasses RLS on its internal query.

This bug **caused** migration `20260423100500_rls_recursion_fix.sql` — every login was forcing the "Create Team" modal because the SELECT policy was recursing and returning empty.

### Migration log

All migrations under `supabase/migrations/` use the 14-digit timestamp filename convention (since the rename in commit `1e3a0f6`):

| File | What it adds |
|---|---|
| `20260422100100_teams_and_members.sql` | Initial teams + team_members tables and base RLS. |
| `20260422100200_team_students.sql` | `team_students` table for cloud-safe student rows (Para App Number only, no real names). |
| `20260422100300_observations.sql` | Logs / observations table with `shared` flag and per-row RLS. |
| `20260422100400_rpcs.sql` | Initial RPCs for member management. |
| `20260423100500_rls_recursion_fix.sql` | Fixes the RLS recursion bug via `security definer` helper. |
| `20260423100600_roles_and_admin.sql` | Adds the role enum (`owner`, `sped_teacher`, `para`, `sub`) plus admin RPCs. |
| `20260423100700_join_role.sql` | Adjusts the join flow so an invitee picks a role at join time. |
| `20260425100800_para_assignments.sql` | `para_assignments` table + `my_assigned_students` view + RPCs. |
| `20260426120000_access_control_hardening.sql` | RLS hardening (paused users, disabled subs, assigned-vs-created reads, etc.). |
| `20260428100000_team_students_period_ids.sql` | `period_ids text[]` for cross-period kids. |
| `20260429100000_team_normalized_name.sql` | `teams.normalized_name` + `find_similar_team` RPC. |
| `20260429100100_team_owner_code.sql` | `teams.owner_code` + `generate_owner_code`, `regenerate_owner_code`, `join_team_as_owner`. |
| `20260429100200_team_join_requests.sql` | `team_join_requests` table + `request_to_join_team` / `approve_join_request` / `deny_join_request`. |
| `20260429120000_logs_external_key.sql` | `external_key` bridge column on logs/handoffs/incidents/interventions/outcomes. |
| `20260430100000_create_team_owner_code.sql` | Patches `create_team` to call `generate_owner_code()` inline so freshly minted teams have an owner code from row zero. |

### Access-control hardening (Apr 26)

`20260426120000_access_control_hardening.sql`:

- Paused users and disabled subs are blocked in RLS, not just in React UI.
- Admins see/write the full team roster.
- Paras/subs see assigned students and rows they personally created.
- Paras/subs can still add students to their active team.
- Paras/subs cannot edit other people's roster rows or browse unassigned admin-created students.
- Assignment RPCs validate that each assigned student belongs to the same team.
- `my_assigned_students` is a `security_invoker` view.

### Phase B (owner code) — privacy posture

The owner code is treated as a **credential**, not a public identifier:

- Multi-use is intentional — a sped teacher who joins late in the year still needs to be able to redeem the code their owner shared months ago.
- That same multi-use property means a leaked owner code is a real escalation risk: anyone with it can join the team at admin level.
- So the code is **regeneratable**. `regenerate_owner_code(tid)` is owner-only and rotates the code; the prior code is invalidated immediately.
- The product copy in the AdminDashboard surfaces a one-line nudge: rotate after onboarding the sped teacher.
- The 6-character `invite_code` doesn't carry the same risk because it can only ever grant `para` or `sub` — never admin. The admin path is gated behind the longer, prefixed code.

### Phase C (request to join) — privacy posture

The pending-request flow has its own RLS shape because requests live before the user is a member of the team:

- The author of a request can read their own row at any status (pending/approved/denied). They never see anyone else's request.
- Owners and sped teachers of the **target team** can read all requests targeting their team. They cannot read requests for other teams.
- No INSERT or UPDATE policies — those operations only happen via `security definer` RPCs (`request_to_join_team`, `approve_join_request`, `deny_join_request`). This means the request author can't forge a request as somebody else, and an admin can't fabricate or edit somebody else's request.
- The unique partial index `(team_id, user_id) where status='pending'` means a single user can have at most one pending request per team. Re-requesting after a denial clears the prior denied row inside the RPC — so denied history doesn't permanently lock somebody out.

### Sample policies

```sql
-- Read team logs
create policy "read team logs" on logs for select
  using (can_access_team(team_id) and (shared = true or user_id = auth.uid()));

-- Insert your own logs
create policy "insert own logs" on logs for insert
  with check (user_id = auth.uid() and can_access_team(team_id));

-- Read student rows by role
create policy "read team students by role" on team_students for select
  using (
    is_team_admin(team_id)
    or (can_access_team(team_id) and is_assigned_student(id))
    or (can_access_team(team_id) and created_by = auth.uid())
  );

-- Parent notes: only admins
create policy "read parent notes" on parent_notes for select
  using (is_team_admin(team_id));

-- Read pending join requests: requester sees their own; admins see their team's.
create policy "select_own" on team_join_requests for select
  using (user_id = auth.uid());
create policy "admin_select_team" on team_join_requests for select
  using (exists (
    select 1 from team_members tm
    where tm.team_id = team_join_requests.team_id
      and tm.user_id = auth.uid()
      and tm.role in ('owner','sped_teacher')
      and tm.active is not false
  ));
```

### RPCs (callable from the client)

Important callable RPCs:

| RPC | Purpose |
|---|---|
| `create_team(team_name, display)` | Atomically creates a team, makes caller the owner, generates an `owner_code` inline, and returns the team row. |
| `join_team_by_code(code, display, requested_role)` | 6-char invite code path. Adds the caller as `para` or `sub`; never grants admin through this code. |
| `join_team_as_owner(code, display)` | OWN- code path. Inserts the caller as `sped_teacher`, or promotes an existing lower-role membership. |
| `request_to_join_team(tid, display, msg, requested)` | Para-facing. Files a pending join request. |
| `approve_join_request(rid)` / `deny_join_request(rid, reason)` | Admin-facing. Closes a pending request. Approval inserts the `team_members` row at the requested role. |
| `find_similar_team(candidate)` | Pre-flight check: returns teams whose normalized name matches the candidate, used to warn against duplicate-team creation. |
| `regenerate_owner_code(tid)` | Owner-only. Rotates the OWN- code. |
| `regenerate_invite_code(tid)` | Admin-only. Rotates the 6-char team invite code. |
| `set_member_role(tid, uid, new_role)` | Admin-only. Changes another member's role. |
| `set_member_active(tid, uid, is_active)` | Admin-only. Toggles active flag. |
| `remove_member(tid, uid)` | Admin-only. |
| `set_team_allow_subs(tid, allow)` | Admin-only. Disables/enables all subs at once. |
| `add_parent_note(tid, sid, note_body)` | Admin-only insert into parent_notes. |
| `assign_students(tid, para_uid, para_email, student_ids)` | Admin-only. Assigns students to a para/sub or pre-registers by email. |
| `unassign_students(tid, para_uid, para_email, student_ids)` | Admin-only. Removes assignments. |
| `claim_pending_assignments()` | Called after sign-in/join. Binds pending email assignments to the current user. |

All RPCs validate `auth.uid()` and re-check role internally — no client trust.

## Auto-wipe + opt-in persistence

When a user opts in to "Remember on this device":
1. A privacy modal explains: "Real names will be saved in this browser's storage on this computer. They never leave the computer and are never uploaded anywhere."
2. They check a box and click "I understand, enable."
3. Names go to IndexedDB.
4. A `lastActiveAt` timestamp updates every session.
5. On app load, if `lastActiveAt` was more than 14 days ago, IndexedDB auto-wipes and an "Stored names expired" banner appears.

This protects against: laptop changes hands, sub uses someone else's device, person leaves school but device wasn't wiped.

## Training-Gap Agenda — privacy framing

The Training-Gap Agenda feature (the para's **🔖 Topics for Next Check-in** panel and the sped teacher's **🔖 Coaching** tab in Admin Dashboard) raises a question worth being explicit about: when topics fire on a para's logs, can the sped teacher see them?

**Answer: yes, and that's by design. No new data exposure happens.**

- Logs that feed the rules are pulled from `team.sharedLogs` — the team-shared cloud feed already populated by `pullSharedTeamLogs` / `subscribeSharedLogs` in `TeamProvider`. Sped teachers (and admins) already have read access to this feed via RLS.
- The training-gap rules don't introduce any new database table, column, or sync path. They are a **new lens on data the sped teacher already has access to**, computed in the browser at view time.
- The sped teacher's actions in the Coaching tab are intentionally limited to "share a tip with the para" via a copy-to-clipboard email draft. There is no UI for "flag for follow-up," "performance note," "mark as addressed," or any other surface that could turn the feature into a record about the para.
- The para's panel includes a one-line disclosure: *"Topics here are also visible to your sped teacher so they can come ready with tips."* This is transparency, not a new data flow.
- All of this still operates under the FERPA invariant: only Para App Numbers and pseudonyms are in the cloud-side data the rules read. Real names never participate.

## Audit checklist (for reviewers)

To verify the privacy invariant holds:

1. `grep -r "realName" src/services/ src/engine/` should show only `stripUnsafeKeys.js` filtering it out.
2. Every component that displays a name should `import { resolveLabel } from '.../nameResolver'` and use it. No raw `student.realName` in JSX.
3. `buildContext.js` and any AI serializer should use `resolveLabel` or `stripNameFromSection`.
4. Network requests in the browser DevTools should never contain real names — only Para App Numbers and pseudonyms.
5. Supabase tables can be inspected directly: no real names in any row. The `external_key` column on `logs` and friends should be a Para App Number, never anything that resembles a real name.
