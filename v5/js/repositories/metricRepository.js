import { selectAllLeagueRows, upsertLeagueRows } from "./baseRepository.js";

export async function listMetrics(leagueId){
  return selectAllLeagueRows("player_metrics",leagueId,{order:"imported_at",ascending:false});
}
export async function metricCoverageRows(leagueId){
  return selectAllLeagueRows("player_metrics",leagueId,{columns:"player_id,metric_type",order:"player_id",ascending:true});
}
export function coverageByType(metrics,type){
  return new Set((metrics||[]).filter(metric=>String(metric.metric_type||"").includes(type)).map(metric=>metric.player_id)).size;
}

export async function upsertStatcastMetricRows(leagueId,rows,{batchSize=250}={}){
  if(!leagueId)throw new Error("Active league is required.");
  if(!Array.isArray(rows)||!rows.length)return [];
  const saved=[];
  for(let index=0;index<rows.length;index+=batchSize){
    const batch=rows.slice(index,index+batchSize).map(row=>({...row,league_id:leagueId}));
    try{
      saved.push(...await upsertLeagueRows("player_metrics",batch,"player_id,source,season,metric_type"));
    }catch(error){
      error.statcastBatchResult={savedCount:saved.length,failedBatchSize:batch.length,remainingCount:rows.length-saved.length,batchStart:index};
      throw error;
    }
  }
  return saved;
}

export async function upsertFantraxProductionMetricRows(leagueId,rows,{batchSize=250}={}){
  if(!leagueId)throw new Error("Active league is required.");
  if(!Array.isArray(rows)||!rows.length)return [];
  if(!Number.isInteger(batchSize)||batchSize<1||batchSize>250)throw new Error("Fantrax production batches must contain at most 250 rows.");
  const saved=[];
  for(let index=0;index<rows.length;index+=batchSize){
    const batch=rows.slice(index,index+batchSize).map(row=>({...row,league_id:leagueId}));
    try{
      saved.push(...await upsertLeagueRows("player_metrics",batch,"player_id,source,season,metric_type"));
    }catch(error){
      error.fantraxProductionBatchResult={savedCount:saved.length,savedPlayerIds:saved.map(row=>row.player_id),failedBatchSize:batch.length,remainingCount:rows.length-saved.length,batchStart:index,failedPlayerIds:rows.slice(index).map(row=>row.player_id)};
      throw error;
    }
  }
  return saved;
}
