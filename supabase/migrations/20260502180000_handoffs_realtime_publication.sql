-- Add handoffs to the supabase_realtime publication so postgres_changes
-- subscriptions in subscribeHandoffs() actually receive INSERT/UPDATE events.
-- Without this, pushHandoff() succeeds (row inserted) but no teammate's
-- client is notified, so the realtime fan-out the feature relies on
-- silently fails. Discovered by the War Room handoff E2E test.
--
-- NOTE: this publication is otherwise empty in production; the other
-- subscribeXxx() helpers (team_students, logs, case memory) are also
-- non-functional and need separate migrations.

ALTER PUBLICATION supabase_realtime ADD TABLE public.handoffs;
