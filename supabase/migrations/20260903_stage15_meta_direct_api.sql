-- Stage 15: Direct Meta API support for centrally run campaigns.
-- Applied to Campaign Platform Supabase on 2026-09-03.
create table if not exists public.central_campaign_meta_connections (
 organisation_id uuid not null references public.organisations(id) on delete cascade,
 rollout_id uuid primary key references public.central_campaign_rollouts(id) on delete cascade,
 ad_account_id text not null, page_id text, access_token text not null,
 meta_user_id text, meta_user_name text, ad_account_name text, currency text, account_status integer,
 graph_version text not null default 'v26.0', connected_at timestamptz not null default now(),
 last_checked_at timestamptz, last_error text, metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.central_campaign_meta_batches (
 id uuid primary key default gen_random_uuid(), organisation_id uuid not null references public.organisations(id) on delete cascade,
 rollout_id uuid not null references public.central_campaign_rollouts(id) on delete cascade,
 campaign_id text not null, campaign_name text not null, graph_version text not null default 'v26.0',
 status text not null default 'created', created_objects integer not null default 0, expected_objects integer not null default 0,
 error text, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.central_campaign_meta_drafts (
 id uuid primary key default gen_random_uuid(), batch_id uuid not null references public.central_campaign_meta_batches(id) on delete cascade,
 organisation_id uuid not null references public.organisations(id) on delete cascade,
 rollout_id uuid not null references public.central_campaign_rollouts(id) on delete cascade,
 site_id uuid not null references public.central_campaign_sites(id) on delete cascade,
 area text not null, audience_name text not null, audience_id text not null default '', adset_id text, adset_name text not null,
 landing_url text not null, graphic_filename text not null default '', image_hash text, creative_id text, ad_id text, ad_name text,
 status text not null default 'planned', error text, metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.central_campaign_meta_assets (
 id uuid primary key default gen_random_uuid(), organisation_id uuid not null references public.organisations(id) on delete cascade,
 rollout_id uuid not null references public.central_campaign_rollouts(id) on delete cascade,
 site_id uuid references public.central_campaign_sites(id) on delete cascade, area text, variant_key text not null default 'A',
 media_type text not null, filename text not null, meta_image_hash text, meta_video_id text, creative_id text, ad_id text,
 status text not null default 'ready', error text, metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.central_campaign_meta_performance (
 id uuid primary key default gen_random_uuid(), organisation_id uuid not null references public.organisations(id) on delete cascade,
 rollout_id uuid not null references public.central_campaign_rollouts(id) on delete cascade,
 site_id uuid not null references public.central_campaign_sites(id) on delete cascade,
 ad_id text not null, adset_id text, area text, date_start date, date_stop date,
 spend numeric not null default 0, impressions bigint not null default 0, reach bigint not null default 0,
 clicks bigint not null default 0, link_clicks bigint not null default 0, landing_page_views bigint not null default 0,
 ctr numeric not null default 0, cpc numeric not null default 0, cost_per_landing_page_view numeric not null default 0,
 raw jsonb not null default '{}'::jsonb, synced_at timestamptz not null default now(),
 unique(rollout_id,site_id,ad_id)
);
create index if not exists central_campaign_meta_batches_rollout_idx on public.central_campaign_meta_batches(rollout_id,created_at desc);
create index if not exists central_campaign_meta_drafts_rollout_idx on public.central_campaign_meta_drafts(rollout_id,site_id);
create index if not exists central_campaign_meta_assets_rollout_idx on public.central_campaign_meta_assets(rollout_id,site_id);
create index if not exists central_campaign_meta_performance_rollout_idx on public.central_campaign_meta_performance(rollout_id,site_id);
alter table public.central_campaign_meta_connections enable row level security;
alter table public.central_campaign_meta_batches enable row level security;
alter table public.central_campaign_meta_drafts enable row level security;
alter table public.central_campaign_meta_assets enable row level security;
alter table public.central_campaign_meta_performance enable row level security;
revoke all on public.central_campaign_meta_connections from anon,authenticated;
revoke all on public.central_campaign_meta_batches from anon,authenticated;
revoke all on public.central_campaign_meta_drafts from anon,authenticated;
revoke all on public.central_campaign_meta_assets from anon,authenticated;
revoke all on public.central_campaign_meta_performance from anon,authenticated;
