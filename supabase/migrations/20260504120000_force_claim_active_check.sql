-- 20260504120000_force_claim_active_check.sql
-- Force-overwrite claim_pending_assignments to ensure active-team-members check
-- is applied across all envs. Defends against partial migration application.

drop function if exists claim_pending_assignments(text);
drop function if exists claim_pending_assignments();

create or replace function claim_pending_assignments()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  email text := lower(trim((auth.jwt() ->> 'email')::text));
  claimed int;
begin
  if email is null or email = '' then
    return 0;
  end if;

  update para_assignments pa
  set    para_user_id = auth.uid(),
         pending_email = null
  where  pa.pending_email = email
    and  pa.para_user_id is null
    and  exists (
      select 1 from team_members tm
      where tm.team_id = pa.team_id
        and tm.user_id = auth.uid()
        and tm.active = true
        and tm.role in ('para', 'sub')
    );
  get diagnostics claimed = row_count;
  return claimed;
end;
$$;

revoke all on function claim_pending_assignments() from public;
grant execute on function claim_pending_assignments() to authenticated;
