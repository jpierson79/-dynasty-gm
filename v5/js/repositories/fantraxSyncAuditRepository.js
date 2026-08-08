import { client, request, selectLeagueRows } from "./baseRepository.js";

async function authenticatedClient(){
  const supabase=await client(),{data,error}=await supabase.auth.getUser();
  if(error||!data?.user?.id)throw new Error("Sign in before recording a Fantrax synchronization attempt.");
  return supabase;
}

export async function listFantraxSyncAttempts(leagueId){
  return selectLeagueRows("fantrax_sync_attempts",leagueId,{columns:"*,fantrax_sync_attempt_items(*)",order:"created_at",ascending:false});
}

export async function findFantraxSyncAttempt(leagueId,digest){
  const supabase=await authenticatedClient();
  return (await request(supabase.from("fantrax_sync_attempts").select("*,fantrax_sync_attempt_items(*)").eq("league_id",leagueId).eq("manifest_digest",digest).maybeSingle(),"Fantrax synchronization attempt lookup")).data||null;
}

export async function prepareFantraxSyncAttempt(leagueId,{digest,manifest,allowCreate=true}={}){
  if(!leagueId||leagueId!==manifest?.leagueId)throw new Error("The synchronization manifest must match the active league.");
  const cap=Number(manifest?.effectiveCap),tier=String(manifest?.releaseTier||"");
  if(!((tier==="CONTROLLED_3"&&cap===3)||(tier==="V5.4.6E_OPT_IN_10"&&cap===10))||manifest?.rows?.length>cap)throw new Error("The synchronization manifest exceeds the supported durable batch boundary.");
  const existing=await findFantraxSyncAttempt(leagueId,digest);
  if(existing)return existing;
  if(!allowCreate)throw new Error("The expanded release is disabled. Only an existing exact durable attempt can be recovered.");
  const supabase=await authenticatedClient();
  const created=await request(supabase.from("fantrax_sync_attempts").insert({league_id:leagueId,manifest_digest:digest,manifest_version:manifest.version,release_tier:manifest.releaseTier,batch_limit:manifest.effectiveCap,season_context:manifest.seasonContext,period:manifest.period,status:"PREPARED",reviewed_count:manifest.rows.length}).select("*").single(),"Fantrax synchronization attempt create");
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
