-- Logs (and case memory + handoffs) external_key bridge.
--
-- Background: the cloud `logs.student_id` foreign key is `references
-- team_students on delete set null`. When a team_students row is regenerated
-- (roster re-upload, a different para's import session, etc.), that FK can
-- go null and the log loses its only handle on the kid. The Vault then shows
-- the entry orphaned ("data is still there but doesn't have their names").
--
-- The rosterReconnect logic already uses paraAppNumber as the FERPA-safe
-- stable bridge at the student-registry layer. This migration extends the
-- same bridge down into the LOG layer: every cloud row also carries the
-- paraAppNumber (as `external_key`, mirroring the column name on
-- team_students), so reconnect works even after the FK goes null.
--
-- No historical backfill — only the on-write path is covered going forward.
-- Old logs stay queryable via the existing student_id FK as long as the
-- team_students row is intact.

alter table public.logs
  add column if not exists external_key text;
create index if not exists logs_team_external_key_idx
  on public.logs (team_id, external_key)
  where external_key is not null;

alter table public.handoffs
  add column if not exists external_key text;
create index if not exists handoffs_team_external_key_idx
  on public.handoffs (team_id, external_key)
  where external_key is not null;

alter table public.incidents
  add column if not exists external_key text;
create index if not exists incidents_team_external_key_idx
  on public.incidents (team_id, external_key)
  where external_key is not null;

alter table public.interventions
  add column if not exists external_key text;
create index if not exists interventions_team_external_key_idx
  on public.interventions (team_id, external_key)
  where external_key is not null;

alter table public.outcomes
  add column if not exists external_key text;
create index if not exists outcomes_team_external_key_idx
  on public.outcomes (team_id, external_key)
  where external_key is not null;
