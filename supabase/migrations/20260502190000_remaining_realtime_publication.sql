-- Add remaining subscribed tables to supabase_realtime publication.
-- Without these, the corresponding subscribeXxx() helpers in
-- src/services/teamSync.js silently never fire:
--   subscribeTeamStudents → team_students
--   subscribeSharedLogs   → logs
--   subscribeCaseMemory   → incidents, interventions, outcomes
-- Companion to 20260502180000 which added handoffs.

ALTER PUBLICATION supabase_realtime ADD TABLE
  public.team_students,
  public.logs,
  public.incidents,
  public.interventions,
  public.outcomes;
