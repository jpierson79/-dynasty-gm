begin;

-- Player identity migration.
-- This migration changes identity constraints only. It must preserve every
-- players.id UUID and every related record. It never deletes, merges, or
-- rewrites player rows automatically.

alter table public.players
add column if not exists fantrax_id text;

do $$
declare
  duplicate_fantrax_count integer := 0;
  duplicate_mlbam_count integer := 0;
begin
  select count(*) into duplicate_fantrax_count
  from (
    select league_id, btrim(fantrax_id) as fantrax_id
    from public.players
    where fantrax_id is not null
      and btrim(fantrax_id) <> ''
    group by league_id, btrim(fantrax_id)
    having count(*) > 1
  ) duplicates;

  select count(*) into duplicate_mlbam_count
  from (
    select league_id, mlbam_id
    from public.players
    where mlbam_id is not null
    group by league_id, mlbam_id
    having count(*) > 1
  ) duplicates;

  if duplicate_fantrax_count > 0 then
    raise exception
      'Duplicate Fantrax IDs detected. Resolve duplicates before applying Player Identity migration.';
  end if;

  if duplicate_mlbam_count > 0 then
    raise exception
      'Duplicate MLBAM IDs detected. Resolve duplicates before applying Player Identity migration.';
  end if;
end $$;

-- Duplicate audit queries for manual review. These do not mutate data.
-- Fantrax duplicates:
-- select league_id, btrim(fantrax_id) as fantrax_id, count(*) as duplicate_count, array_agg(id order by created_at, id) as player_ids
-- from public.players
-- where fantrax_id is not null
--   and btrim(fantrax_id) <> ''
-- group by league_id, btrim(fantrax_id)
-- having count(*) > 1;
--
-- MLBAM duplicates:
-- select league_id, mlbam_id, count(*) as duplicate_count, array_agg(id order by created_at, id) as player_ids
-- from public.players
-- where mlbam_id is not null
-- group by league_id, mlbam_id
-- having count(*) > 1;

alter table public.players
drop constraint if exists players_league_id_normalized_name_key;

-- Remove known historical identity indexes before creating the hardened
-- versions below. These statements affect indexes only; they do not mutate
-- player rows or related records.
drop index if exists public.players_league_normalized_name_key;
drop index if exists public.players_league_normalized_name_unique;
drop index if exists public.players_league_fantrax_unique;
drop index if exists public.players_league_mlbam_unique;

create index if not exists players_league_normalized_name_idx
on public.players (league_id, normalized_name);

create unique index players_league_fantrax_unique
on public.players (league_id, fantrax_id)
where fantrax_id is not null
  and btrim(fantrax_id) <> '';

create unique index players_league_mlbam_unique
on public.players (league_id, mlbam_id)
where mlbam_id is not null;

notify pgrst, 'reload schema';

commit;
