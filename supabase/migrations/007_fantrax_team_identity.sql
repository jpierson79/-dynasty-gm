-- V5.4.6A: authoritative Fantrax team identity only.
-- Rollback: drop index teams_league_fantrax_team_id_unique, then drop the column.

begin;

alter table public.teams
add column if not exists fantrax_team_id text;

alter table public.teams
drop constraint if exists teams_fantrax_team_id_format;

alter table public.teams
add constraint teams_fantrax_team_id_format check (
  fantrax_team_id is null
  or (
    fantrax_team_id = btrim(fantrax_team_id)
    and fantrax_team_id ~ '^[A-Za-z0-9]{16}$'
  )
);

create unique index if not exists teams_league_fantrax_team_id_unique
on public.teams (league_id, fantrax_team_id)
where fantrax_team_id is not null;

comment on column public.teams.fantrax_team_id is
'Authoritative Fantrax team ID confirmed by a user; unique within a league. Names are suggestions only.';

commit;
