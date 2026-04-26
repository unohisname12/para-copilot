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
