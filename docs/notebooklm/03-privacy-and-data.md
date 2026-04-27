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

The user has to actively choose the private export. Default is always safe.

## The Para App Number

A 6-digit number assigned by an admin to each student (e.g. `847293`). Same number everywhere — every para sees the same student as the same number.

- Goes in the cloud, in shared logs, in the Vault, in handoffs to teammates.
- Is stored as `external_key` on `team_students` when available. Other tables usually reference the `team_students.id` UUID, which points back to that cloud-safe student row.
- Is what AI sees if names aren't loaded.

When a name list is loaded, the app maps `847293 → "Maria"` locally and shows "Maria" in the UI for that para. The number stays unchanged in the database.

## Data flow diagram (text version)

```
USER'S COMPUTER                          CLOUD (Supabase)
─────────────────                        ─────────────────
[Real names file]                        teams (no names)
     ↓                                   team_members (user IDs only)
VaultProvider (RAM)         →            team_students (Para App # only)
     ↓                                   logs / handoffs (FK to team_students)
resolveLabel()                           parent_notes (admin-only, FK to team_students)
     ↓                                   para_assignments (student assignments)
Display ✓
     ↓
buildContext (uses resolveLabel)
     ↓
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
- `invite_code` (text, unique) — 6-character team join code
- `created_by` (uuid → auth.users)
- `allow_subs` (bool, default true) — master switch for sub access
- `created_at`

#### `team_members`
Membership + role per user per team.
- `team_id` (uuid → teams)
- `user_id` (uuid → auth.users)
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
- `external_key` (text — the 6-digit Para App Number when available)
- `period_id`, `class_label`, `eligibility`, `case_manager`, `grade_level`
- `goals`, `accs`, `tags`, `flags`, `watch_fors`, `do_this_actions`, `health_notes`, `cross_period`, `source_meta` — JSONB IEP/support data
- `created_by` (uuid → auth.users)
- `created_at`
- Unique index: `(team_id, external_key)` when an external key exists, so repeated imports update the same student instead of duplicating them.

#### `logs`
Notes, behavior observations, goal progress, and local records of handoffs.
- `id` (uuid)
- `team_id`, `user_id`
- `student_id` (uuid → team_students)
- `type` (text: General Observation, Behavior Note, Goal Progress, Handoff Note, etc.)
- `category`, `note`, `tags`
- `date`, `timestamp`, `period_id`
- `flagged` (bool)
- `shared` (bool) — when true, other team members see it; when false, only the author
- `created_at`

#### `handoffs`
Realtime team handoffs separate from normal logs.
- `id`, `team_id`, `from_user_id`, `student_id`
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

#### `incidents`, `interventions`, `outcomes`
Case-memory tables for behavior events and what worked.
- All include `team_id`, `user_id`, optional `student_id`, and structured fields.
- Team members can read team case memory while active/allowed; inserts must be authored by the caller.

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
| `20260426120000_access_control_hardening.sql` | Latest hardening (see below). |

### Latest hardening migration

`20260426120000_access_control_hardening.sql`.

What it adds:
- Paused users and disabled subs are blocked in RLS, not just in React UI.
- Admins see/write the full team roster.
- Paras/subs see assigned students and rows they personally created.
- Paras/subs can still add students to their active team.
- Paras/subs cannot edit other people's roster rows or browse unassigned admin-created students.
- Assignment RPCs validate that each assigned student belongs to the same team.
- `my_assigned_students` is a `security_invoker` view.

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
```

### RPCs (callable from the client)

Important callable RPCs:

| RPC | Purpose |
|---|---|
| `create_team(team_name, display)` | Atomically creates a team, makes caller the owner, and returns the team row with invite code |
| `join_team_by_code(code, display, requested_role)` | Adds the caller as `para` or `sub`; never grants admin through an invite |
| `set_member_role(tid, uid, new_role)` | Admin-only. Changes another member's role |
| `set_member_active(tid, uid, is_active)` | Admin-only. Toggles active flag |
| `remove_member(tid, uid)` | Admin-only |
| `set_team_allow_subs(tid, allow)` | Admin-only. Disables/enables all subs at once |
| `regenerate_invite_code(tid)` | Admin-only. Rotates the team invite code |
| `add_parent_note(tid, sid, note_body)` | Admin-only insert into parent_notes |
| `assign_students(tid, para_uid, para_email, student_ids)` | Admin-only. Assigns students to a para/sub or pre-registers by email |
| `unassign_students(tid, para_uid, para_email, student_ids)` | Admin-only. Removes assignments |
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
5. Supabase tables can be inspected directly: no real names in any row.
