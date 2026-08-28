-- Stage 14A: keep central campaign parent/site lifecycle states consistent.
create or replace function public.org_admin_bulk_set_central_campaign_sites(p_rollout uuid,p_status text)
returns integer
language plpgsql security definer set search_path=public
as $$
declare v_org uuid; v_count integer;
begin
 select organisation_id into v_org from public.central_campaign_rollouts where id=p_rollout;
 if v_org is null or not public.is_org_global_admin(v_org) then raise exception 'Not authorised'; end if;
 if p_status not in ('draft','live','paused','ended') then raise exception 'Invalid site status'; end if;
 update public.central_campaign_sites set status=p_status,updated_at=now() where rollout_id=p_rollout;
 get diagnostics v_count=row_count;
 if p_status='live' then
   update public.central_campaign_rollouts set status='active',updated_at=now() where id=p_rollout and status in ('draft','paused');
 elsif p_status='paused' then
   update public.central_campaign_rollouts set status='paused',updated_at=now() where id=p_rollout and status not in ('ended','archived');
 end if;
 return v_count;
end $$;
grant execute on function public.org_admin_bulk_set_central_campaign_sites(uuid,text) to authenticated;
