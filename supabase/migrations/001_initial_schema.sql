-- Dynasty Front Office V4
-- Initial Supabase database schema

begin;

-- =========================================================
-- USER PROFILES
-- =========================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================================
-- LEAGUES AND MEMBERSHIP
-- =========================================================

create table if not exists public.leagues (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  platform text default 'Fantrax',
  format text default 'Dynasty',
  team_count integer,
  scoring_type text,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.league_members (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner'
    check (role in ('owner', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  unique (league_id, user_id)
);

-- =========================================================
-- MANAGERS AND TEAMS
-- =========================================================

create table if not exists public.managers (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  team_name text not null,
  manager_name text,
  competitive_window text
    check (
      competitive_window is null
      or competitive_window in ('Contender', 'Retooling', 'Rebuilder')
    ),
  trade_style text,
  hkb_reliance text
    check (
      hkb_reliance is null
      or hkb_reliance in ('Low', 'Medium', 'High')
    ),
  preferred_player_types text[],
  favorite_prospects text[],
  favorite_mlb_teams text[],
  negotiation_notes text,
  communication_style text,
  highly_valued_players text[],
  willing_to_move_players text[],
  trade_history_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (league_id, team_name)
);

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  manager_id uuid references public.managers(id) on delete set null,
  name text not null,
  abbreviation text,
  competitive_window text,
  is_user_team boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (league_id, name)
);

-- =========================================================
-- PLAYERS
-- =========================================================

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  mlbam_id bigint,
  name text not null,
  normalized_name text not null,
  age numeric(5,2),
  positions text[],
  mlb_team text,
  owner_team_id uuid references public.teams(id) on delete set null,
  roster_status text,
  asset_class text,
  hkb_value numeric,
  overall_rank integer,
  position_rank integer,
  is_minor_leaguer boolean not null default false,
  is_free_agent boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (league_id, normalized_name)
);

create unique index if not exists players_league_mlbam_unique
on public.players (league_id, mlbam_id)
where mlbam_id is not null;

create index if not exists players_league_idx
on public.players (league_id);

create index if not exists players_owner_team_idx
on public.players (owner_team_id);

create index if not exists players_hkb_value_idx
on public.players (hkb_value desc);

-- =========================================================
-- IMPORTED PLAYER METRICS
-- =========================================================

create table if not exists public.player_metrics (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  source text not null,
  season integer,
  metric_type text,
  metrics jsonb not null default '{}'::jsonb,
  imported_at timestamptz not null default now(),
  unique (player_id, source, season, metric_type)
);

create index if not exists player_metrics_player_idx
on public.player_metrics (player_id);

create index if not exists player_metrics_source_idx
on public.player_metrics (source);

-- =========================================================
-- CALCULATED SCORES
-- =========================================================

create table if not exists public.calculated_player_scores (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  score_version text not null default 'v4',
  gm_score numeric,
  breakout_score numeric,
  championship_impact numeric,
  scarcity_score numeric,
  trade_liquidity numeric,
  market_appreciation numeric,
  risk_score numeric,
  dynasty_asset_score numeric,
  roster_pressure_score numeric,
  explanation jsonb not null default '{}'::jsonb,
  calculated_at timestamptz not null default now(),
  unique (player_id, score_version)
);

create index if not exists calculated_scores_player_idx
on public.calculated_player_scores (player_id);

create index if not exists calculated_scores_dynasty_idx
on public.calculated_player_scores (dynasty_asset_score desc);

-- =========================================================
-- MANAGER PREFERENCES
-- =========================================================

create table if not exists public.manager_preferences (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  manager_id uuid not null references public.managers(id) on delete cascade,
  player_id uuid references public.players(id) on delete set null,
  player_name text,
  preference_type text not null,
  strength integer not null default 3
    check (strength between 1 and 5),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists manager_preferences_manager_idx
on public.manager_preferences (manager_id);

-- =========================================================
-- TRADES AND TRADE ASSETS
-- =========================================================

create table if not exists public.trades (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  transaction_date date,
  team_a_id uuid references public.teams(id) on delete set null,
  team_b_id uuid references public.teams(id) on delete set null,
  trade_type text,
  notes text,
  source text,
  external_transaction_id text,
  imported_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists trades_league_date_idx
on public.trades (league_id, transaction_date desc);

create table if not exists public.trade_assets (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  trade_id uuid not null references public.trades(id) on delete cascade,
  player_id uuid references public.players(id) on delete set null,
  player_name text,
  from_team_id uuid references public.teams(id) on delete set null,
  to_team_id uuid references public.teams(id) on delete set null,
  asset_type text not null default 'player',
  asset_details jsonb not null default '{}'::jsonb
);

create index if not exists trade_assets_trade_idx
on public.trade_assets (trade_id);

create index if not exists trade_assets_player_idx
on public.trade_assets (player_id);

-- =========================================================
-- PLAYER SNAPSHOTS
-- =========================================================

create table if not exists public.player_snapshots (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  snapshot_date date not null default current_date,
  owner_team_id uuid references public.teams(id) on delete set null,
  hkb_value numeric,
  overall_rank integer,
  roster_status text,
  calculated_scores jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (player_id, snapshot_date)
);

create index if not exists player_snapshots_player_date_idx
on public.player_snapshots (player_id, snapshot_date desc);

-- =========================================================
-- IMPORT JOB TRACKING
-- =========================================================

create table if not exists public.import_jobs (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  import_type text not null,
  file_name text,
  status text not null default 'pending'
    check (
      status in ('pending', 'running', 'completed', 'failed', 'partial')
    ),
  rows_processed integer not null default 0,
  rows_matched integer not null default 0,
  rows_unmatched integer not null default 0,
  errors jsonb not null default '[]'::jsonb,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists import_jobs_league_idx
on public.import_jobs (league_id, created_at desc);

-- =========================================================
-- UPDATED_AT TRIGGER
-- =========================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists leagues_set_updated_at on public.leagues;
create trigger leagues_set_updated_at
before update on public.leagues
for each row execute function public.set_updated_at();

drop trigger if exists managers_set_updated_at on public.managers;
create trigger managers_set_updated_at
before update on public.managers
for each row execute function public.set_updated_at();

drop trigger if exists teams_set_updated_at on public.teams;
create trigger teams_set_updated_at
before update on public.teams
for each row execute function public.set_updated_at();

drop trigger if exists players_set_updated_at on public.players;
create trigger players_set_updated_at
before update on public.players
for each row execute function public.set_updated_at();

drop trigger if exists manager_preferences_set_updated_at
on public.manager_preferences;

create trigger manager_preferences_set_updated_at
before update on public.manager_preferences
for each row execute function public.set_updated_at();

commit;