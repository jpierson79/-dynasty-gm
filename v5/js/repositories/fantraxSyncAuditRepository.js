import { client, request, selectLeagueRows } from "./baseRepository.js";

async function authenticatedClient(){
  const supabase=await client(),{data,error}=await supabase.auth.getUser();
  if(error||!data?.user?.id)throw new Error("Sign in before recording a Fantrax synchronization attempt.");
  return supabase;
}

export async function listFantraxSyncAttempts(leagueId){
  return selectLeagueRows("fantrax_sync_attempts",leagueId,{columns:"*,fantrax_sync_attempt_items(*)",order:"created_at",ascending:false});
}

export async function prepareFantraxSyncAttempt(leagueId,{digest,manifest}={}){
  if(!leagueId||leagueId!==manifest?.leagueId)throw new Error("The synchronization manifest must match the active league.");
  const supabase=await authenticatedClient();
  const existing=await request(supabase.from("fantrax_sync_attempts").select("*,fantrax_sync_attempt_items(*)").eq("league_id",leagueId).eq("manifest_digest",digest).maybeSingle(),"Fantrax synchronization attempt lookup");
  if(existing.data)return existing.data;
  const created=await request(supabase.from("fantrax_sync_attempts").insert({league_id:leagueId,manifest_digest:digest,manifest_version:manifest.version,season_context:manifest.seasonContext,period:manifest.period,status:"PREPARED",reviewed_count:manifest.rows.length}).select("*").single(),"Fantrax synchronization attempt create");
  const items=manifest.rows.map((row,index)=>({attempt_id:created.data.id,league_id:leagueId,player_id:row.playerId,ordinal:index,expected_owner_team_id:row.expectedOwnerTeamId,previewed_status:row.previewedStatus,target_status:row.targetStatus,fantrax_api_player_id:row.fantraxApiPlayerId,fantrax_team_id:row.fantraxTeamId,outcome:"PENDING"}));
  const inserted=await request(supabase.from("fantrax_sync_attempt_items").insert(items).select("*"),"Fantrax synchronization manifest create");
  return {...created.data,fantrax_sync_attempt_items:inserted.data||[]};
}

export async function markFantraxSyncAttemptApplying(leagueId,attemptId){
  const supabase=await authenticatedClient();
  return (await request(supabase.from("fantrax_sync_attempts").update({status:"APPLYING"}).eq("league_id",leagueId).eq("id",attemptId).in("status",["PREPARED","APPLYING","PARTIAL","FAILED"]).select("*").single(),"Fantrax synchronization attempt start")).data;
}

export async function recordFantraxSyncOutcomes(leagueId,attemptId,rows=[]){
  if(!rows.length)return [];
  const supabase=await authenticatedClient(),saved=[];
  for(const row of rows){
    const result=await request(supabase.from("fantrax_sync_attempt_items").update({outcome:row.outcome,reason:row.reason,detail:row.detail||{}}).eq("league_id",leagueId).eq("attempt_id",attemptId).eq("player_id",row.player_id).in("outcome",["PENDING","FAILED"]).select("*").single(),"Fantrax synchronization outcome record");
    saved.push(result.data);
  }
  return saved;
}

export async function finalizeFantraxSyncAttempt(leagueId,attemptId,status){
  const supabase=await authenticatedClient();
  return (await request(supabase.from("fantrax_sync_attempts").update({status}).eq("league_id",leagueId).eq("id",attemptId).eq("status","APPLYING").select("*").single(),"Fantrax synchronization attempt finalize")).data;
}
