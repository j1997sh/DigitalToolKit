-- Already applied to the configured Supabase project.
-- Secure Global Admin website read/update RPCs.
create or replace function public.org_admin_website_detail(p_website uuid)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare v_org uuid; result jsonb;
begin
  select a.organisation_id into v_org from public.websites w join public.accounts a on a.id=w.account_id where w.id=p_website;
  if v_org is null or not public.is_org_admin(v_org) then raise exception 'Not authorised'; end if;
  select jsonb_build_object('website',to_jsonb(w),'account',jsonb_build_object('id',a.id,'name',a.name,'represented_ward',a.represented_ward,'local_authority',a.local_authority,'activation_status',a.activation_status),'candidate',(select to_jsonb(c)-'activation_token_hash' from public.rollout_candidates c where c.website_id=w.id limit 1))
  into result from public.websites w join public.accounts a on a.id=w.account_id where w.id=p_website;
  return result;
end $$;

create or replace function public.org_admin_update_website(p_website uuid,p_patch jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_org uuid; w public.websites;
begin
  select a.organisation_id into v_org from public.websites x join public.accounts a on a.id=x.account_id where x.id=p_website;
  if v_org is null or not public.is_org_admin(v_org) then raise exception 'Not authorised'; end if;
  update public.websites x set name=coalesce(nullif(p_patch->>'name',''),x.name),area=case when p_patch?'area' then p_patch->>'area' else x.area end,slug=case when p_patch?'slug' then nullif(p_patch->>'slug','') else x.slug end,branding=case when jsonb_typeof(p_patch->'branding')='object' then p_patch->'branding' else x.branding end,content=case when jsonb_typeof(p_patch->'content')='object' then p_patch->'content' else x.content end,has_unpublished_changes=true,updated_at=now() where x.id=p_website returning x.* into w;
  return to_jsonb(w);
end $$;
grant execute on function public.org_admin_website_detail(uuid) to authenticated;
grant execute on function public.org_admin_update_website(uuid,jsonb) to authenticated;
