-- Bit 2: organisation-wide Facebook Custom Audience mapping library.
create table if not exists public.central_facebook_audiences (
 id uuid primary key default gen_random_uuid(),
 organisation_id uuid not null references public.organisations(id) on delete cascade,
 area text not null,
 area_key text not null,
 filename text,
 audience_id text not null,
 audience_name text not null,
 metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(organisation_id,area_key)
);
alter table public.central_facebook_audiences enable row level security;
create or replace function public.org_admin_facebook_audiences(p_org uuid)
returns setof public.central_facebook_audiences language sql stable security definer set search_path=public as $$
 select a.* from public.central_facebook_audiences a where a.organisation_id=p_org and public.is_org_admin(p_org) order by a.area
$$;
grant execute on function public.org_admin_facebook_audiences(uuid) to authenticated;
create or replace function public.org_admin_upsert_facebook_audiences(p_org uuid,p_rows jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare x jsonb; v_area text; v_key text; v_file text; v_id text; v_name text; v_saved int:=0; v_errors int:=0;
begin
 if not public.is_org_global_admin(p_org) then raise exception 'Not authorised'; end if;
 if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)<1 or jsonb_array_length(p_rows)>5000 then raise exception 'Import must contain 1-5000 rows'; end if;
 for x in select value from jsonb_array_elements(p_rows) loop
  begin
   v_area=trim(coalesce(x->>'area',x->>'constituency',x->>'name',''));
   v_key=lower(regexp_replace(coalesce(nullif(x->>'area_key',''),v_area),'[^a-zA-Z0-9]+','','g'));
   v_file=nullif(trim(x->>'filename'),''); v_id=trim(coalesce(x->>'audience_id','')); v_name=trim(coalesce(x->>'audience_name',''));
   if v_area='' or v_key='' or v_id='' or v_name='' then raise exception 'Missing required field'; end if;
   insert into public.central_facebook_audiences(organisation_id,area,area_key,filename,audience_id,audience_name,metadata,updated_at)
   values(p_org,left(v_area,180),left(v_key,180),v_file,left(v_id,120),left(v_name,240),coalesce(x->'metadata','{}'::jsonb),now())
   on conflict(organisation_id,area_key) do update set area=excluded.area,filename=excluded.filename,audience_id=excluded.audience_id,audience_name=excluded.audience_name,metadata=excluded.metadata,updated_at=now();
   v_saved:=v_saved+1;
  exception when others then v_errors:=v_errors+1; end;
 end loop;
 return jsonb_build_object('saved',v_saved,'errors',v_errors);
end $$;
grant execute on function public.org_admin_upsert_facebook_audiences(uuid,jsonb) to authenticated;
create or replace function public.org_admin_delete_facebook_audience(p_audience uuid)
returns boolean language plpgsql security definer set search_path=public as $$
declare v_org uuid;
begin
 select organisation_id into v_org from public.central_facebook_audiences where id=p_audience;
 if v_org is null or not public.is_org_global_admin(v_org) then raise exception 'Not authorised'; end if;
 delete from public.central_facebook_audiences where id=p_audience; return true;
end $$;
grant execute on function public.org_admin_delete_facebook_audience(uuid) to authenticated;
