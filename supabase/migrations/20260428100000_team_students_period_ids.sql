-- Multi-period support for team_students.
--
-- Previously each student row had a single `period_id` column, so a kid in
-- two classes had to be either:
--   (a) duplicated as two rows — but the unique index (team_id, external_key)
--       collapses on upsert, only one period survives, OR
--   (b) collapsed to one row with a single primary period — losing the
--       second class assignment in the cloud.
--
-- This migration adds a nullable `period_ids text[]` column. The push path
-- writes the full list there; the read path expands it back into per-period
-- dashboard entries. Legacy rows where `period_ids IS NULL` keep working via
-- a fallback to the scalar `period_id`.

alter table public.team_students
  add column if not exists period_ids text[];

-- Index for "give me all students in period X" queries. GIN handles array
-- containment (period_ids @> ARRAY['p3']) efficiently.
create index if not exists team_students_period_ids_gin
  on public.team_students using gin (period_ids);

-- Backfill existing rows: copy scalar period_id into period_ids so the new
-- read path is consistent for everyone. Safe: idempotent, only touches NULLs.
update public.team_students
  set period_ids = ARRAY[period_id]
  where period_ids is null
    and period_id is not null;
