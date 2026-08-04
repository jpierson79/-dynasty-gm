import { selectAllLeagueRows } from "./baseRepository.js";

export async function listMetrics(leagueId){
  return selectAllLeagueRows("player_metrics",leagueId,{order:"imported_at",ascending:false});
}
export async function metricCoverageRows(leagueId){
  return selectAllLeagueRows("player_metrics",leagueId,{columns:"player_id,metric_type",order:"player_id",ascending:true});
}
export function coverageByType(metrics,type){
  return new Set((metrics||[]).filter(metric=>String(metric.metric_type||"").includes(type)).map(metric=>metric.player_id)).size;
}
