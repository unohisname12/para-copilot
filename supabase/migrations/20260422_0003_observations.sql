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
