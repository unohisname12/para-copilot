-- Run inside Supabase SQL Editor. Each block sets a JWT claim, then queries.
-- Expected results annotated inline.
--
-- Setup: create two teams and three users via the Auth → Users panel, then
--   use create_team and join_team_by_code to populate memberships.
-- alice@example.com belongs to team_A only.
-- bob@example.com   belongs to team_A only.
-- carol@example.com belongs to team_B only.
--
-- Replace <alice_uuid>, <bob_uuid>, <carol_uuid>, <team_a_uuid>, <team_b_uuid>
-- with real values before running. Run the file one block at a time.

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
