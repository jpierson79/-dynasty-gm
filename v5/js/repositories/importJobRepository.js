import { client, request, selectLeagueRows } from "./baseRepository.js";

export async function latestImportJobs(leagueId){
  return selectLeagueRows("import_jobs",leagueId,{order:"started_at",ascending:false});
}

export async function startAutomatedStatcastJob(leagueId,{playerType,sourceMetadata}={}){
  if(!leagueId)throw new Error("Active league is required.");
  const supabase=await client(),auth=await supabase.auth.getUser();
  if(auth.error||!auth.data?.user?.id)throw new Error("Sign in before refreshing Statcast metrics.");
  const startedAt=new Date().toISOString();
  const result=await request(supabase.from("import_jobs").insert({
    league_id:leagueId,user_id:auth.data.user.id,import_type:`statcast_automated_${playerType}`,
    file_name:null,status:"running",started_at:startedAt,source_metadata:sourceMetadata||{}
  }).select("*").single(),"Statcast import job insert");
  return result.data;
}

export async function finishAutomatedStatcastJob(leagueId,jobId,{status,processed=0,matched=0,unmatched=0,inserted=0,updated=0,failed=0,errors=[],errorMessage=null,sourceMetadata={}}={}){
  if(!leagueId||!jobId)throw new Error("Active league and Statcast import job are required.");
  const supabase=await client();
  const result=await request(supabase.from("import_jobs").update({
    status,rows_processed:processed,rows_matched:matched,rows_unmatched:unmatched,
    rows_inserted:inserted,rows_updated:updated,rows_failed:failed,errors,error_message:errorMessage,
    source_metadata:sourceMetadata,completed_at:new Date().toISOString()
  }).eq("league_id",leagueId).eq("id",jobId).select("*").single(),"Statcast import job update");
  return result.data;
}
