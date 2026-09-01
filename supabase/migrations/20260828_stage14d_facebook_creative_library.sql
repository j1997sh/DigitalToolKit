-- Bit 3: rollout-specific Facebook creative library.
create table if not exists public.central_facebook_creatives (
 id uuid primary key default gen_random_uuid(),
 organisation_id uuid not null references public.organisations(id) on delete cascade,
 rollout_id uuid not null references public.central_campaign_rollouts(id) on delete cascade,
 area text not null, area_key text not null, filename text not null, storage_path text not null,
 mime_type text, file_size bigint, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(rollout_id,area_key)
);
alter table public.central_facebook_creatives enable row level security;
create or replace function public.org_admin_facebook_creatives(p_rollout uuid)
returns setof public.central_facebook_creatives language sql stable security definer set search_path=public as $$
 select c.* from public.central_facebook_creatives c join public.central_campaign_rollouts r on r.id=c.rollout_id
 where c.rollout_id=p_rollout and public.is_org_admin(r.organisation_id) order by c.area
$$;
grant execute on function public.org_admin_facebook_creatives(uuid) to authenticated;
create or replace function public.org_admin_upsert_facebook_creative(p_rollout uuid,p_area text,p_filename text,p_storage_path text,p_mime_type text default null,p_file_size bigint default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_org uuid; v_key text; v_id uuid;
begin
 select organisation_id into v_org from public.central_campaign_rollouts where id=p_rollout;
 if v_org is null or not public.is_org_global_admin(v_org) then raise exception 'Not authorised'; end if;
 v_key=lower(regexp_replace(coalesce(p_area,''),'[^a-zA-Z0-9]+','','g'));
 insert into public.central_facebook_creatives(organisation_id,rollout_id,area,area_key,filename,storage_path,mime_type,file_size,updated_at)
 values(v_org,p_rollout,left(trim(p_area),180),left(v_key,180),left(trim(p_filename),255),trim(p_storage_path),nullif(trim(coalesce(p_mime_type,'')),''),p_file_size,now())
 on conflict(rollout_id,area_key) do update set filename=excluded.filename,storage_path=excluded.storage_path,mime_type=excluded.mime_type,file_size=excluded.file_size,updated_at=now()
 returning id into v_id; return v_id;
end $$;
grant execute on function public.org_admin_upsert_facebook_creative(uuid,text,text,text,text,bigint) to authenticated;
create or replace function public.org_admin_delete_facebook_creative(p_creative uuid)
returns text language plpgsql security definer set search_path=public as $$
declare v_org uuid; v_path text;
begin
 select organisation_id,storage_path into v_org,v_path from public.central_facebook_creatives where id=p_creative;
 if v_org is null or not public.is_org_global_admin(v_org) then raise exception 'Not authorised'; end if;
 delete from public.central_facebook_creatives where id=p_creative; return v_path;
end $$;
grant execute on function public.org_admin_delete_facebook_creative(uuid) to authenticated;
