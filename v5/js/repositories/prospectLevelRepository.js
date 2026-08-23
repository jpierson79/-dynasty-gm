import {client,request} from "./baseRepository.js";

export async function authenticatedProspectLevelUser(){
  const supabase=await client(),auth=await supabase.auth.getUser();
  if(auth.error||!auth.data?.user?.id)throw new Error("Sign in before reviewing prospect-level evidence.");
  return auth.data.user;
}
export async function applyProspectLevelBatches(leagueId,rows,{batchSize=250,dependencies={}}={}){
  if(!leagueId)throw new Error("Active league is required.");
  if(!Array.isArray(rows)||!rows.length)return [];
  if(!Number.isInteger(batchSize)||batchSize<1||batchSize>250)throw new Error("Prospect-level batches must contain 1 through 250 rows.");
  const getClient=dependencies.client||client,runRequest=dependencies.request||request,supabase=await getClient(),saved=[];
  for(let index=0;index<rows.length;index+=batchSize){
    const batch=rows.slice(index,index+batchSize);
    try{const result=await runRequest(supabase.rpc("apply_prospect_level_population",{p_league_id:leagueId,p_rows:batch}),"reviewed prospect level population");saved.push(...(result.data||[]))}
    catch(error){error.prospectLevelBatchResult={savedCount:saved.length,savedPlayerIds:saved.map(row=>row.player_id),failedPlayerIds:batch.map(row=>row.player_id),unattemptedPlayerIds:rows.slice(index+batch.length).map(row=>row.player_id),batchStart:index,failedBatchSize:batch.length};throw error}
  }
  return saved;
}
