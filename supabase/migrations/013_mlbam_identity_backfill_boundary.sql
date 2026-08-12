-- V5.5A-1: reviewed, league-scoped, null-only MLBAM identity backfill boundary.
-- Implementation checkpoint only; do not apply without separate approval.

create or replace function public.apply_mlbam_identity_backfill(p_league_id uuid, p_rows jsonb)
returns table(player_id uuid, mlbam_id bigint)
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not (select private.can_edit_league(p_league_id)) then
    raise exception 'Not authorized to edit this league' using errcode = '42501';
  end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) < 1 or jsonb_array_length(p_rows) > 250 then
    raise exception 'MLBAM backfill batch must contain 1 through 250 rows';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_rows) as items(row_data)
    where jsonb_typeof(row_data) <> 'object'
       or not (row_data ? 'player_id' and row_data ? 'mlbam_id')
       or exists (select 1 from jsonb_object_keys(row_data) key where key not in ('player_id','mlbam_id'))
  ) then
    raise exception 'MLBAM backfill rows may contain only player_id and mlbam_id';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(p_rows) as x(player_id uuid, mlbam_id bigint)
    group by x.player_id having count(*) > 1
  ) or exists (
    select 1 from jsonb_to_recordset(p_rows) as x(player_id uuid, mlbam_id bigint)
    group by x.mlbam_id having count(*) > 1
  ) then
    raise exception 'MLBAM backfill batch contains duplicate player or MLBAM identity';
  end if;
  return query
  with requested as (
    select distinct x.player_id, x.mlbam_id
    from jsonb_to_recordset(p_rows) as x(player_id uuid, mlbam_id bigint)
    where x.player_id is not null and x.mlbam_id is not null and x.mlbam_id > 0
  )
  update public.players p
     set mlbam_id = requested.mlbam_id,
         updated_at = now()
    from requested
   where p.id = requested.player_id
     and p.league_id = p_league_id
     and p.mlbam_id is null
  returning p.id, p.mlbam_id;
end;
$$;

revoke all on function public.apply_mlbam_identity_backfill(uuid,jsonb) from public, anon;
grant execute on function public.apply_mlbam_identity_backfill(uuid,jsonb) to authenticated;
