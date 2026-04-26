# SupaPara — Privacy Architecture & Data Model

## The privacy invariant

**Real student names never leave the user's device.**

This rule is what makes SupaPara legally usable in US schools without a 12-month FERPA review. Every architectural decision flows from it.

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
- Is the FK in every Supabase table.
- Is what AI sees if names aren't loaded.

When a name list is loaded, the app maps `847293 → "Maria"` locally and shows "Maria" in the UI for that para. The number stays unchanged in the database.

## Data flow diagram (text version)

```
USER'S COMPUTER                          CLOUD (Supabase)
─────────────────                        ─────────────────
[Real names file]                        teams (no names)
     ↓                                   team_members (user IDs only)
VaultProvider (RAM)         →            team_students (Para App # only)
     ↓                                   observations (Para App # only)
resolveLabel()                           parent_notes (FK to Para App #)
     ↓                                   invites (codes only)
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

7 SQL migrations in `supabase/migrations/`. Schema below in plain language.

### Tables

#### `teams`
One row per school's special-ed team.
- `id` (uuid, primary key)
- `name` (text)
- `owner_id` (uuid → auth.users)
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
- `student_uid` (text — the 6-digit Para App Number)
- `pseudonym` (text — e.g. "Red Student 1")
- `color` (text — hex color)
- `eligibility`, `goals`, `accs`, `strategies`, `triggers`, `watch_fors` etc. — JSONB IEP data
- `created_at`

#### `observations` (also called `logs`)
Notes, behavior incidents, goal progress, handoffs.
- `id` (uuid)
- `team_id`, `user_id`
- `student_id` (uuid → team_students)
- `student_uid` (text — denormalized Para App Number for fast queries)
- `type` (text: General Observation, Behavior Note, Goal Progress, Handoff Note, etc.)
- `category`, `note`, `tags` (jsonb)
- `date`, `timestamp`, `period_id`
- `flagged` (bool)
- `shared` (bool) — when true, other team members see it; when false, only the author
- `created_at`

#### `parent_notes`
Sped-teacher-only private notes about parents.
- `id`, `team_id`, `student_id`
- `note` (text)
- `created_by` (user_id)
- RLS: only owner + sped_teacher can SELECT.

#### `invites`
6-letter join codes.
- `code` (text, unique)
- `team_id`
- `created_by`, `created_at`, `expires_at`
- `revoked` (bool)

### Row Level Security (RLS) — the auth boundary

Every table has RLS enabled. Policies use **security-definer helper functions** to avoid the recursion problem:

```sql
-- Helper: is the calling user a member of this team?
create or replace function is_member_of_team(tid uuid)
returns boolean language sql stable as $$
  select exists(
    select 1 from team_members
    where team_id = tid and user_id = auth.uid() and active = true
  );
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

This bug **caused** migration `20260423_0005_rls_recursion_fix.sql` — every login was forcing the "Create Team" modal because the SELECT policy was recursing and returning empty.

### Sample policies

```sql
-- Read team logs
create policy "read team logs" on observations for select
  using (is_member_of_team(team_id) and (shared = true or user_id = auth.uid()));

-- Insert your own logs
create policy "insert own logs" on observations for insert
  with check (user_id = auth.uid() and is_member_of_team(team_id));

-- Update your own logs only
create policy "update own logs" on observations for update
  using (user_id = auth.uid());

-- Parent notes: only admins
create policy "read parent notes" on parent_notes for select
  using (is_team_admin(team_id));
```

### RPCs (callable from the client)

Defined in `20260422_0004_rpcs.sql` and `20260423_0006_roles_and_admin.sql`:

| RPC | Purpose |
|---|---|
| `create_team_with_invite(name)` | Atomically creates a team, makes caller the owner, and returns an invite code |
| `join_team_by_code(code, role)` | Adds the caller as a member with the specified non-admin role |
| `set_member_role(tid, uid, new_role)` | Admin-only. Changes another member's role |
| `set_member_active(tid, uid, active)` | Admin-only. Toggles active flag |
| `remove_member(tid, uid)` | Admin-only |
| `set_team_allow_subs(tid, bool)` | Admin-only. Disables/enables all subs at once |
| `add_parent_note(tid, sid, note)` | Admin-only insert into parent_notes |
| `transfer_ownership(tid, new_owner_uid)` | Owner-only. Atomic ownership transfer |

All RPCs validate `auth.uid()` and re-check role internally — no client trust.

## Auto-wipe + opt-in persistence

When a user opts in to "Remember on this device":
1. A privacy modal explains: "Real names will be saved in this browser's storage on this computer. They never leave the computer and are never uploaded anywhere."
2. They check a box and click "I understand, enable."
3. Names go to IndexedDB.
4. A `lastActiveAt` timestamp updates every session.
5. On app load, if `lastActiveAt` was more than 14 days ago, IndexedDB auto-wipes and an "Stored names expired" banner appears.

This protects against: laptop changes hands, sub uses someone else's device, person leaves school but device wasn't wiped.

## Audit checklist (for reviewers)

To verify the privacy invariant holds:

1. `grep -r "realName" src/services/ src/engine/` should show only `stripUnsafeKeys.js` filtering it out.
2. Every component that displays a name should `import { resolveLabel } from '.../nameResolver'` and use it. No raw `student.realName` in JSX.
3. `buildContext.js` and any AI serializer should use `resolveLabel` or `stripNameFromSection`.
4. Network requests in the browser DevTools should never contain real names — only Para App Numbers and pseudonyms.
5. Supabase tables can be inspected directly: no real names in any row.
