-- plot twist. initial schema
-- Mirrors src/lib/types.ts. Nested structures are jsonb; arrays of ids are text[].
-- The Next.js server uses the service-role key and enforces roles in lib/auth;
-- RLS below additionally restricts any direct client access to signed-in internal users.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- users
create table if not exists profiles (
  id text primary key,
  email text not null unique,
  name text not null,
  role text not null default 'editor' check (role in ('admin','editor','viewer')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- reference data
create table if not exists destinations (
  id text primary key,
  name text not null,
  slug text not null unique,
  kind text not null default 'country',
  country text not null,
  continent text not null,
  tourism_board text,
  board_website text,
  india_page text,
  photo_query text not null default '',
  photo_file text,
  tagline text,
  board_verified boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists sources (
  id text primary key,
  url text not null unique,
  title text not null,
  publisher text not null,
  source_type text not null,
  published_at timestamptz,
  retrieved_at timestamptz not null,
  excerpt text not null default '',
  is_demo boolean not null default false
);

create table if not exists claims (
  id text primary key,
  subject_type text not null,
  subject_id text not null,
  section text not null,
  text text not null,
  status text not null check (status in ('Verified','Corroborated','Needs Verification','Unverified')),
  status_reason text not null default '',
  evidence jsonb not null default '[]',          -- [{source_id, quote, quote_found}] (claim evidence)
  reporting_period text,
  freshness_class text not null default 'general',
  verified_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists claims_subject_idx on claims (subject_type, subject_id);

create table if not exists verification_events (
  id text primary key,
  subject_type text not null,
  subject_id text not null,
  status text not null,
  note text not null default '',
  actor text not null,
  created_at timestamptz not null default now()
);
create index if not exists verification_events_subject_idx on verification_events (subject_type, subject_id);

-- ---------------------------------------------------------------- news
create table if not exists news_articles (
  id text primary key,
  url text not null,
  title text not null,
  summary text not null default '',
  image jsonb,
  source_name text not null,
  publisher text not null,
  source_type text not null,
  published_at timestamptz,
  retrieved_at timestamptz not null,
  event_date text,
  destinations text[] not null default '{}',
  continent text,
  category text not null,
  tourism_board text,
  india_relevance text not null default 'Low',
  why_it_matters text,
  take text,
  dedupe_key text not null unique,
  via text not null,
  is_demo boolean not null default false
);
create index if not exists news_published_idx on news_articles (published_at desc);
create index if not exists news_destinations_idx on news_articles using gin (destinations);

create table if not exists feeds (
  id text primary key,
  name text not null,
  url text not null unique,
  publisher text not null,
  source_type text not null,
  enabled boolean not null default true,
  last_status text not null default 'never',
  last_checked_at timestamptz,
  last_error text,
  item_count int not null default 0
);

create table if not exists outbound_stats (
  id text primary key,
  metric text not null,
  destination text not null,
  value numeric not null,
  unit text not null,
  reporting_period text not null,
  definition text not null,
  geography text not null,
  yoy_change_pct numeric,
  comparison_value numeric,
  comparison_period text,
  publisher text not null,
  source_title text not null,
  source_url text not null,
  source_type text not null,
  published_date text,
  verified_at timestamptz not null,
  notes text not null default '',
  status text not null,
  created_by text not null,
  created_at timestamptz not null default now()
);

create table if not exists opportunity_signals (
  id text primary key,
  destination text not null,
  what_happened text not null,
  evidence_news_ids text[] not null default '{}',
  evidence_urls text[] not null default '{}',
  why_it_matters text not null,
  time_sensitivity text not null,
  next_action text not null,
  confidence text not null,
  created_at timestamptz not null default now(),
  is_demo boolean not null default false
);

-- ---------------------------------------------------------------- research
create table if not exists research_jobs (
  id text primary key,
  kind text not null,
  status text not null,
  input jsonb not null default '{}',
  result_id text,
  error text,
  attempts int not null default 0,
  log jsonb not null default '[]',
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists research_jobs_status_idx on research_jobs (status, updated_at);

create table if not exists reports (
  id text primary key,
  destination_id text references destinations(id) on delete set null,
  destination_name text not null,
  query text not null,
  options jsonb not null,
  version int not null default 1,
  status text not null,
  content jsonb,                       -- structured report sections
  source_ids text[] not null default '{}',
  health jsonb,
  job_id text,
  partial_notes text[] not null default '{}',
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_demo boolean not null default false
);
create index if not exists reports_destination_idx on reports (lower(destination_name));

create table if not exists report_versions (
  id text primary key,
  report_id text not null references reports(id) on delete cascade,
  version int not null,
  content jsonb,
  source_ids text[] not null default '{}',
  health jsonb,
  change_summary text not null default '',
  created_at timestamptz not null default now(),
  unique (report_id, version)
);

-- ---------------------------------------------------------------- campaigns
create table if not exists campaign_sets (
  id text primary key,
  title text not null,
  destination text not null,
  report_id text references reports(id) on delete set null,
  report_version int,
  input_mode text not null,
  supplied_research text,
  supplied_filename text,
  brief jsonb not null,
  extras jsonb,
  status text not null,
  error text,
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_demo boolean not null default false
);

create table if not exists campaign_ideas (
  id text primary key,
  set_id text not null references campaign_sets(id) on delete cascade,
  report_id text references reports(id) on delete set null,
  report_version int,
  destination text not null,
  content jsonb not null,
  status text not null default 'draft',
  locked_fields text[] not null default '{}',
  origin text not null,
  parent_ids text[] not null default '{}',
  merge_notes text,
  reviewer text,
  approval_note text,
  image jsonb,
  version int not null default 1,
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_demo boolean not null default false
);
create index if not exists campaign_ideas_set_idx on campaign_ideas (set_id);

create table if not exists campaign_revisions (
  id text primary key,
  idea_id text not null references campaign_ideas(id) on delete cascade,
  version int not null,
  content jsonb not null,
  locked_fields text[] not null default '{}',
  action text not null,
  author text not null,
  created_at timestamptz not null default now()
);
create index if not exists campaign_revisions_idea_idx on campaign_revisions (idea_id, version);

create table if not exists campaign_comments (
  id text primary key,
  idea_id text not null references campaign_ideas(id) on delete cascade,
  kind text not null default 'comment',
  body text not null,
  author text not null,
  created_at timestamptz not null default now()
);

create table if not exists comparisons (
  id text primary key,
  idea_ids text[] not null,
  criteria text[] not null,
  scores jsonb not null,
  verdict text not null,
  created_by text not null,
  created_at timestamptz not null default now()
);

create table if not exists pitches (
  id text primary key,
  idea_id text not null references campaign_ideas(id) on delete cascade,
  title text not null,
  destination text not null,
  sections jsonb not null,
  source_ids text[] not null default '{}',
  version int not null default 1,
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_demo boolean not null default false
);

create table if not exists reference_campaigns (
  id text primary key,
  name text not null,
  tourism_board text not null,
  destination text not null,
  launch_date text,
  objective text not null,
  insight text not null,
  creative_idea text not null,
  execution text not null,
  participation_mechanism text not null,
  channels text[] not null default '{}',
  target_audience text not null,
  campaign_types text[] not null default '{}',
  official_link text,
  sources jsonb not null default '[]',
  published_results text,
  strategic_learning text not null,
  scapia_relevance text not null,
  verification text not null,
  verified_at timestamptz not null,
  image jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- contacts
create table if not exists contacts (
  id text primary key,
  full_name text not null,
  job_title text not null,
  organisation text not null,
  destination text not null,
  responsibility text not null default '',
  india_relevance text not null default '',
  india_office text,
  agency text,
  email text,
  phone text,
  website text,
  linkedin text,
  sources jsonb not null default '[]',
  status text not null check (status in ('Officially Verified','Cross-Verified','Needs Verification','Not Found')),
  verification_reason text not null default '',
  last_verified_at timestamptz not null,
  notes text not null default '',
  query text not null default '',
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_demo boolean not null default false
);
create index if not exists contacts_destination_idx on contacts (lower(destination));

create table if not exists contact_searches (
  id text primary key,
  query text not null,
  status text not null,
  contact_ids text[] not null default '{}',
  organisation text,
  notes text[] not null default '{}',
  error text,
  created_by text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- opportunities
create table if not exists opportunities (
  id text primary key,
  name text not null,
  destination text not null,
  tourism_board text,
  summary text not null default '',
  stage text not null,
  priority text not null default 'Medium',
  owner text,
  next_action text,
  next_action_date date,
  last_interaction text,
  campaign_window text,
  commercial_notes text,
  notes text not null default '',
  news_ids text[] not null default '{}',
  report_id text references reports(id) on delete set null,
  idea_ids text[] not null default '{}',
  shortlisted_idea_id text references campaign_ideas(id) on delete set null,
  pitch_id text references pitches(id) on delete set null,
  contact_ids text[] not null default '{}',
  source_links jsonb not null default '[]',
  manual_checks jsonb not null default '{}',   -- pitch readiness: true/false/null (= not assessed)
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists opportunities_stage_idx on opportunities (stage);

create table if not exists opportunity_activities (
  id text primary key,
  opportunity_id text not null references opportunities(id) on delete cascade,
  kind text not null,
  body text not null,
  author text not null,
  created_at timestamptz not null default now()
);
create index if not exists opportunity_activities_opp_idx on opportunity_activities (opportunity_id, created_at desc);

-- ---------------------------------------------------------------- user data, settings, audit
create table if not exists saved_items (
  id text primary key,
  user_id text not null,
  item_type text not null,
  item_id text not null,
  label text not null default '',
  created_at timestamptz not null default now(),
  unique (user_id, item_type, item_id)
);

create table if not exists watchlist (
  id text primary key,
  user_id text not null,
  kind text not null,
  value text not null,
  created_at timestamptz not null default now(),
  unique (user_id, kind, value)
);

create table if not exists app_settings (
  id text primary key,
  news_refresh_hours int not null default 8,
  news_lookback_days int not null default 30,
  default_research_depth text not null default 'comprehensive',
  report_cache_days int not null default 14,
  daily_research_limit int not null default 25,
  daily_ai_limit int not null default 300,
  preferred_domains text[] not null default '{}',
  blocked_domains text[] not null default '{}',
  ai_model text,
  scoring_weights jsonb not null default '{}',
  last_news_refresh_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists audit_log (
  id text primary key,
  actor text not null,
  action text not null,
  target text not null,
  meta jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists audit_log_created_idx on audit_log (created_at desc);

create table if not exists usage_events (
  id text primary key,
  user_id text not null,
  kind text not null,
  units int not null default 1,
  meta jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists usage_events_user_idx on usage_events (user_id, kind, created_at desc);

-- ---------------------------------------------------------------- row-level security
-- Direct client access (anon/authenticated keys) is read-only for signed-in users with a profile;
-- writes go through the server, which checks roles. Service role bypasses RLS.
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','destinations','sources','claims','verification_events','news_articles','feeds','outbound_stats',
    'opportunity_signals','research_jobs','reports','report_versions','campaign_sets','campaign_ideas','campaign_revisions',
    'campaign_comments','comparisons','pitches','reference_campaigns','contacts','contact_searches','opportunities',
    'opportunity_activities','saved_items','watchlist','app_settings','audit_log','usage_events'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "internal read" on %I', t);
  end loop;
end $$;

create or replace function is_internal_user() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles p where p.id = auth.uid()::text)
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'destinations','sources','claims','news_articles','outbound_stats','opportunity_signals','reports','report_versions',
    'campaign_sets','campaign_ideas','campaign_revisions','campaign_comments','comparisons','pitches','reference_campaigns',
    'contacts','opportunities','opportunity_activities'
  ] loop
    execute format('create policy "internal read" on %I for select to authenticated using (is_internal_user())', t);
  end loop;
end $$;

-- Users can only read their own saved items, watchlist and profile.
create policy "internal read" on saved_items for select to authenticated using (user_id = auth.uid()::text);
create policy "internal read" on watchlist for select to authenticated using (user_id = auth.uid()::text);
create policy "internal read" on profiles for select to authenticated using (id = auth.uid()::text);
-- audit_log, usage_events, app_settings, feeds, research_jobs, contact_searches, verification_events: server only.
