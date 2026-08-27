-- Stage 12: optional Campaign microsite creation from Election Rollout CSV.

alter table public.rollout_candidates
  add column if not exists campaign_id uuid references public.campaigns(id) on delete set null;

create or replace function public.org_admin_import_rollout_candidates(p_rollout uuid, p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
 r election_rollouts%rowtype;
 x jsonb;
 v_row int:=0;
 v_name text;
 v_email text;
 v_ward text;
 v_council text;
 v_slug text;
 v_campaign_slug text;
 v_campaign_name text;
 v_messages jsonb;
 v_status text;
 v_id uuid;
 v_ready int:=0;
 v_warn int:=0;
 v_error int:=0;
begin
 select * into r from election_rollouts where id=p_rollout;
 if r.id is null or not public.is_org_admin(r.organisation_id) then
   raise exception 'Not authorised';
 end if;

 if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)>1000 then
   raise exception 'Import must contain 1-1000 rows';
 end if;

 for x in select value from jsonb_array_elements(p_rows) loop
  v_row:=v_row+1;
  v_messages:='[]'::jsonb;
  v_status:='ready';

  v_name=trim(coalesce(x->>'candidate_name',''));
  v_email=lower(trim(coalesce(x->>'email','')));
  v_ward=trim(coalesce(x->>'ward',''));
  v_council=trim(coalesce(x->>'council',''));
  v_slug=coalesce(
    nullif(public.slugify_candidate(x->>'site_slug'),''),
    public.slugify_candidate(v_name||'-'||v_ward)
  );

  v_campaign_name=trim(coalesce(x->>'campaign_name',''));
  v_campaign_slug=public.slugify_candidate(x->>'campaign_slug');
  if v_campaign_name<>'' and coalesce(v_campaign_slug,'')='' then
    v_campaign_slug=public.slugify_candidate(v_campaign_name||'-'||v_ward);
  end if;

  if v_name='' then
    v_messages=v_messages||'"Candidate name is required"'::jsonb;
    v_status='error';
  end if;
  if v_ward='' then
    v_messages=v_messages||'"Ward is required"'::jsonb;
    v_status='error';
  end if;
  if v_council='' then
    v_messages=v_messages||'"Council is required"'::jsonb;
    v_status='error';
  end if;
  if v_email='' or v_email !~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$' then
    v_messages=v_messages||'"Valid email is required"'::jsonb;
    v_status='error';
  end if;
  if exists(select 1 from rollout_candidates c where c.rollout_id=p_rollout and lower(c.email)=v_email) then
    v_messages=v_messages||'"Duplicate email in rollout"'::jsonb;
    v_status='error';
  end if;
  if exists(select 1 from rollout_candidates c where c.rollout_id=p_rollout and c.site_slug=v_slug) then
    v_messages=v_messages||'"Duplicate site slug in rollout"'::jsonb;
    v_status='error';
  end if;

  if v_campaign_name='' and coalesce(v_campaign_slug,'')<>'' then
    v_messages=v_messages||'"Campaign name is required when campaign slug is supplied"'::jsonb;
    v_status='error';
  end if;

  if v_campaign_name<>'' and exists(
    select 1 from rollout_candidates c
    where c.rollout_id=p_rollout
      and public.slugify_candidate(c.import_payload->>'campaign_slug')=v_campaign_slug
  ) then
    v_messages=v_messages||'"Duplicate campaign slug in rollout"'::jsonb;
    v_status='error';
  end if;

  if coalesce(x->>'candidate_photo_filename','')=''
     and coalesce(x->>'candidate_photo_url','')='' then
    v_messages=v_messages||'"Candidate photo missing"'::jsonb;
    if v_status='ready' then v_status='warning'; end if;
  end if;

  x:=x||jsonb_build_object(
    'campaign_name',v_campaign_name,
    'campaign_slug',coalesce(v_campaign_slug,'')
  );

  begin
   insert into rollout_candidates(
     rollout_id,organisation_id,candidate_name,first_name,last_name,email,
     ward,council,region,association_name,organiser_email,postcode,site_slug,
     bio,priorities,candidate_photo_filename,candidate_photo_url,import_row,
     import_payload,validation_status,validation_messages,photo_status
   )
   values(
     p_rollout,r.organisation_id,left(v_name,160),left(x->>'first_name',80),
     left(x->>'last_name',80),left(v_email,254),left(v_ward,160),left(v_council,160),
     left(x->>'region',160),left(x->>'association_name',160),
     left(x->>'organiser_email',254),left(x->>'postcode',20),left(v_slug,180),
     left(x->>'bio',5000),coalesce(x->'priorities','[]'::jsonb),
     nullif(left(x->>'candidate_photo_filename',255),''),
     nullif(left(x->>'candidate_photo_url',2000),''),
     v_row,x,v_status,v_messages,
     case
       when coalesce(x->>'candidate_photo_filename','')<>'' then 'matched'
       when coalesce(x->>'candidate_photo_url','')<>'' then 'external'
       else 'missing'
     end
   )
   returning id into v_id;
  exception when unique_violation then
    v_error:=v_error+1;
    continue;
  end;

  if v_status='ready' then
    v_ready:=v_ready+1;
  elsif v_status='warning' then
    v_warn:=v_warn+1;
  else
    v_error:=v_error+1;
  end if;
 end loop;

 return jsonb_build_object(
   'rows',v_row,
   'ready',v_ready,
   'warnings',v_warn,
   'errors',v_error
 );
end $$;

create or replace function public.org_admin_provision_rollout(p_rollout uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
 r election_rollouts%rowtype;
 c rollout_candidates%rowtype;
 v_account uuid;
 v_site uuid;
 v_campaign uuid;
 v_created int:=0;
 v_campaigns_created int:=0;
 v_failed int:=0;
 v_content jsonb;
 v_campaign_name text;
 v_campaign_slug text;
 v_campaign_points jsonb;
begin
 select * into r from election_rollouts where id=p_rollout;
 if r.id is null or not public.is_org_admin(r.organisation_id) then
   raise exception 'Not authorised';
 end if;

 update election_rollouts
 set status='provisioning',updated_at=now()
 where id=r.id;

 for c in
   select * from rollout_candidates
   where rollout_id=r.id
     and validation_status<>'error'
     and provision_status='pending'
   order by import_row
 loop
  begin
   insert into accounts(
     owner_user_id,name,first_name,last_name,organisation_id,account_type,
     postcode,represented_ward,local_authority,region,activation_status,rollout_candidate_id
   )
   values(
     null,c.candidate_name,c.first_name,c.last_name,r.organisation_id,'local_candidate',
     c.postcode,c.ward,c.council,c.region,'pending',c.id
   )
   returning id into v_account;

   v_content:=coalesce(r.default_content,'{}'::jsonb)||
     jsonb_build_object(
       'candidateName',c.candidate_name,
       'candidateArea',c.ward,
       'aboutLead',coalesce(c.bio,''),
       'priorities',coalesce(c.priorities,'[]'::jsonb),
       'rollout',jsonb_build_object('election',r.name,'council',c.council,'ward',c.ward)
     );

   insert into websites(
     account_id,name,area,site_type,status,slug,branding,content,
     hero_image_path,about_image_path,has_unpublished_changes,publishing_state
   )
   values(
     v_account,c.candidate_name,c.ward,'campaign_site','draft',c.site_slug,
     coalesce(r.default_branding,'{}'::jsonb),v_content,c.hero_image_path,
     c.candidate_photo_path,true,'draft'
   )
   returning id into v_site;

   v_campaign_name=trim(coalesce(c.import_payload->>'campaign_name',''));
   v_campaign_slug=public.slugify_candidate(c.import_payload->>'campaign_slug');

   if v_campaign_name<>'' then
     if jsonb_typeof(c.import_payload->'campaign_key_points')='array' then
       v_campaign_points=c.import_payload->'campaign_key_points';
     else
       v_campaign_points=to_jsonb(
         string_to_array(coalesce(c.import_payload->>'campaign_key_points',''),'|')
       );
     end if;

     insert into campaigns(
       account_id,website_id,name,slug,status,headline,supporting_copy,
       key_points,settings,branding,supporter_count,has_unpublished_changes,publishing_state
     )
     values(
       v_account,null,v_campaign_name,v_campaign_slug,'draft',
       nullif(c.import_payload->>'campaign_headline',''),
       nullif(c.import_payload->>'campaign_supporting_copy',''),
       coalesce(v_campaign_points,'[]'::jsonb),
       jsonb_build_object(
         'rollout_id',r.id,
         'candidate_id',c.id,
         'ward',c.ward,
         'council',c.council
       ),
       coalesce(r.default_branding,'{}'::jsonb),0,true,'draft'
     )
     returning id into v_campaign;

     v_campaigns_created:=v_campaigns_created+1;
   else
     v_campaign:=null;
   end if;

   update rollout_candidates
   set account_id=v_account,
       website_id=v_site,
       campaign_id=v_campaign,
       provision_status='provisioned',
       updated_at=now()
   where id=c.id;

   v_created:=v_created+1;

  exception when others then
   update rollout_candidates
   set provision_status='failed',
       validation_messages=validation_messages||to_jsonb('Provisioning failed'::text),
       updated_at=now()
   where id=c.id;
   v_failed:=v_failed+1;
  end;
 end loop;

 update election_rollouts
 set status='active',updated_at=now()
 where id=r.id;

 return jsonb_build_object(
   'created',v_created,
   'campaigns_created',v_campaigns_created,
   'failed',v_failed
 );
end $$;

create or replace function public.org_admin_rollout_candidates_v2(p_rollout uuid)
returns table(
 id uuid,
 candidate_name text,
 email text,
 ward text,
 council text,
 region text,
 association_name text,
 site_slug text,
 validation_status text,
 validation_messages jsonb,
 provision_status text,
 activation_status text,
 photo_status text,
 candidate_photo_filename text,
 candidate_photo_path text,
 account_id uuid,
 website_id uuid,
 publishing_state text,
 campaign_id uuid,
 campaign_name text,
 campaign_publishing_state text,
 import_payload jsonb,
 updated_at timestamptz
)
language sql
stable security definer
set search_path=public
as $$
 select
   c.id,c.candidate_name,c.email,c.ward,c.council,c.region,c.association_name,
   c.site_slug,c.validation_status,c.validation_messages,c.provision_status,
   c.activation_status,c.photo_status,c.candidate_photo_filename,c.candidate_photo_path,
   c.account_id,c.website_id,w.publishing_state,c.campaign_id,cp.name,
   cp.publishing_state,c.import_payload,c.updated_at
 from rollout_candidates c
 left join websites w on w.id=c.website_id
 left join campaigns cp on cp.id=c.campaign_id
 where c.rollout_id=p_rollout
   and public.is_org_admin(c.organisation_id)
 order by c.import_row,c.candidate_name
$$;

grant execute on function public.org_admin_rollout_candidates_v2(uuid) to authenticated;
