-- V5.5B-6G0C: reviewed, league-scoped prospect-level population boundary.
-- Implementation checkpoint only; do not apply without separate approval.
-- player_id, mlbam_id, and expected_* values are immutable identity/concurrency guards.
-- The SET clause is the authoritative five-field mutation allowlist.

create or replace function public.apply_prospect_level_population(p_league_id uuid, p_rows jsonb)
returns table(player_id uuid, current_level text, level_source text, level_availability text, level_observed_at timestamptz)
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not (select private.can_edit_league(p_league_id)) then
    raise exception 'Not authorized to edit this league' using errcode = '42501';
  end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) < 1 or jsonb_array_length(p_rows) > 250 then
    raise exception 'Prospect level population batch must contain 1 through 250 rows';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_rows) items(row_data)
    where jsonb_typeof(row_data) <> 'object'
       or not (row_data ?& array['player_id','mlbam_id','current_level','level_source','level_availability','level_observed_at','level_raw_evidence','expected_current_level','expected_level_source','expected_level_availability','expected_level_observed_at','expected_level_raw_evidence'])
       or exists (select 1 from jsonb_object_keys(row_data) key where key not in ('player_id','mlbam_id','current_level','level_source','level_availability','level_observed_at','level_raw_evidence','expected_current_level','expected_level_source','expected_level_availability','expected_level_observed_at','expected_level_raw_evidence'))
  ) then
    raise exception 'Prospect level population rows contain unsupported fields';
  end if;
  if exists (select 1 from jsonb_to_recordset(p_rows) x(player_id uuid) group by x.player_id having count(*) > 1) then
    raise exception 'Prospect level population batch contains duplicate player UUIDs';
  end if;
  return query
  with requested as (
    select * from jsonb_to_recordset(p_rows) as x(
      player_id uuid, mlbam_id bigint, current_level text, level_source text,
      level_availability text, level_observed_at timestamptz, level_raw_evidence jsonb,
      expected_current_level text, expected_level_source text, expected_level_availability text,
      expected_level_observed_at timestamptz, expected_level_raw_evidence jsonb
    )
  )
  update public.players p set
    current_level=r.current_level, level_source=r.level_source,
    level_availability=r.level_availability, level_observed_at=r.level_observed_at,
    level_raw_evidence=r.level_raw_evidence
  from requested r
  where p.id=r.player_id and p.league_id=p_league_id and p.mlbam_id=r.mlbam_id
    and p.current_level is not distinct from r.expected_current_level
    and p.level_source is not distinct from r.expected_level_source
    and p.level_availability is not distinct from r.expected_level_availability
    and p.level_observed_at is not distinct from r.expected_level_observed_at
    and p.level_raw_evidence is not distinct from r.expected_level_raw_evidence
  returning p.id,p.current_level,p.level_source,p.level_availability,p.level_observed_at;
end;
$$;

revoke all on function public.apply_prospect_level_population(uuid,jsonb) from public, anon;
grant execute on function public.apply_prospect_level_population(uuid,jsonb) to authenticated;
