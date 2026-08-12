import { client, request } from "./baseRepository.js";

export async function applyReviewedMlbamBackfill(leagueId,rows,{batchSize=250}={}){
  if(!leagueId)throw new Error("Active league is required.");
  if(!Array.isArray(rows)||!rows.length)return [];
  if(batchSize>250||batchSize<1)throw new Error("MLBAM backfill batch size must be between 1 and 250.");
  const supabase=await client(),updated=[];
  for(let index=0;index<rows.length;index+=batchSize){
    const batch=rows.slice(index,index+batchSize).map(row=>({player_id:row.player_id,mlbam_id:row.mlbam_id}));
    const result=await request(supabase.rpc("apply_mlbam_identity_backfill",{p_league_id:leagueId,p_rows:batch}),"reviewed MLBAM identity backfill");
    updated.push(...(result.data||[]));
  }
  return updated;
}
