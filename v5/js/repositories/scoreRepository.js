import { countLeagueRows, selectAllLeagueRows, selectLeagueRows, upsertLeagueRows } from "./baseRepository.js";

export async function listScores(leagueId){
  return selectAllLeagueRows("calculated_player_scores",leagueId,{order:"calculated_at",ascending:false});
}
export async function scoreCoverageCount(leagueId){return countLeagueRows("calculated_player_scores",leagueId)}
export async function scoresForPlayers(leagueId,playerIds){
  if(!playerIds.length)return [];
  return selectLeagueRows("calculated_player_scores",leagueId,{order:"calculated_at",ascending:false,filters:[q=>q.in("player_id",playerIds)]});
}
export async function upsertScores(rows){
  return upsertLeagueRows("calculated_player_scores",rows,"player_id,score_version");
}
