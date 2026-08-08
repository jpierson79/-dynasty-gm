import { client, countLeagueRows, pagedLeagueRows, request, selectAllLeagueRows, selectLeagueRows } from "./baseRepository.js";
import { fantraxRosterSyncSkipReason } from "../services/fantraxRosterSyncService.js?v5-4-6b3-controlled-apply";

export async function listPlayers(leagueId,query={}){
  const filters=[];
  if(query.search)filters.push(q=>q.ilike("name",`%${query.search}%`));
  if(query.ownerTeamId)filters.push(q=>query.ownerTeamId==="FREE_AGENT"?q.is("owner_team_id",null):q.eq("owner_team_id",query.ownerTeamId));
  if(query.rosterStatus)filters.push(q=>q.eq("roster_status",query.rosterStatus));
  if(query.position)filters.push(q=>q.contains("positions",[query.position]));
  const sort=query.sort||"name";
  return pagedLeagueRows("players",leagueId,{page:query.page||1,pageSize:query.pageSize||50,order:sort,ascending:true,filters});
}
export async function allPlayers(leagueId){
  return selectAllLeagueRows("players",leagueId,{order:"name",ascending:true});
}
export async function playerCount(leagueId){return countLeagueRows("players",leagueId)}
export async function ownedPlayerCount(leagueId){return countLeagueRows("players",leagueId,{filters:[q=>q.not("owner_team_id","is",null)]})}
export async function freeAgentCount(leagueId){return countLeagueRows("players",leagueId,{filters:[q=>q.is("owner_team_id",null)]})}
export async function hkbCoverageCount(leagueId){return countLeagueRows("players",leagueId,{filters:[q=>q.not("hkb_value","is",null)]})}
export async function fantraxIdCount(leagueId){return countLeagueRows("players",leagueId,{filters:[q=>q.not("fantrax_id","is",null)]})}
export async function mlbamIdCount(leagueId){return countLeagueRows("players",leagueId,{filters:[q=>q.not("mlbam_id","is",null)]})}
export async function bothExternalIdCount(leagueId){return countLeagueRows("players",leagueId,{filters:[q=>q.not("fantrax_id","is",null),q=>q.not("mlbam_id","is",null)]})}
export async function rosterByTeam(leagueId,teamId){
  if(!teamId)return [];
  return selectLeagueRows("players",leagueId,{columns:"*",order:"name",ascending:true,filters:[q=>q.eq("owner_team_id",teamId)]});
}
export async function rosterSummaryRows(leagueId){
  return selectAllLeagueRows("players",leagueId,{columns:"id,name,owner_team_id,roster_status,is_free_agent,hkb_value,fantrax_id,mlbam_id",order:"owner_team_id",ascending:true});
}
export async function positionOptions(leagueId){
  const rows=await selectAllLeagueRows("players",leagueId,{columns:"positions",order:"name",ascending:true});
  return [...new Set(rows.flatMap(player=>Array.isArray(player.positions)?player.positions:String(player.positions||"").split(/[\/,\s]+/)).filter(Boolean))].sort();
}
async function authenticatedClient(){
  const supabase=await client();
  const {data,error}=await supabase.auth.getUser();
  if(error||!data?.user?.id)throw new Error("Sign in before saving roster-status overrides.");
  return supabase;
}
export async function updateRosterStatuses(leagueId,updates){
  if(!leagueId)throw new Error("Active league is required.");
  if(!Array.isArray(updates)||!updates.length)return [];
  const supabase=await authenticatedClient();
  const updated_at=new Date().toISOString();
  const rows=[];
  for(const update of updates){
    const row={roster_status:update.roster_status,roster_status_source:"MANUAL",updated_at};
    const result=await request(
      supabase.from("players").update(row).eq("league_id",leagueId).eq("id",update.id).select("id,name,owner_team_id,roster_status,roster_status_source,roster_status_override_at,roster_status_override_by,is_free_agent,fantrax_id,mlbam_id,updated_at").single(),
      "players roster_status update"
    );
    rows.push(result.data);
  }
  return rows;
}
export async function clearRosterStatusOverrides(leagueId,playerIds=[]){
  if(!leagueId)throw new Error("Active league is required.");
  if(!playerIds.length)return [];
  const supabase=await authenticatedClient(),rows=[];
  for(const id of playerIds){
    const result=await request(supabase.from("players").update({roster_status_source:"UNKNOWN",roster_status_override_at:null,roster_status_override_by:null,updated_at:new Date().toISOString()}).eq("league_id",leagueId).eq("id",id).eq("roster_status_source","MANUAL").select("id,roster_status,roster_status_source,roster_status_override_at,roster_status_override_by").single(),"players roster override clear");
    rows.push(result.data);
  }
  return rows;
}
export async function applyFantraxRosterStatuses(leagueId,updates=[],{beforeGroup=()=>{}}={}){
  if(!leagueId)throw new Error("Active league is required.");
  if(!updates.length)return {reviewed:0,updated:[],skipped:[],failures:[]};
  const supabase=await authenticatedClient(),updated=[],failures=[],groups=new Map();
  updates.forEach(update=>{
    const key=`${update.expectedOwnerTeamId}\u0000${update.currentRosterStatus}\u0000${update.roster_status}`;
    if(!groups.has(key))groups.set(key,{expectedOwnerTeamId:update.expectedOwnerTeamId,currentRosterStatus:update.currentRosterStatus,rosterStatus:update.roster_status,ids:[]});
    groups.get(key).ids.push(update.id);
  });
  for(const group of groups.values()){
    try{
      await beforeGroup(group);
      const result=await request(
        supabase.from("players").update({roster_status:group.rosterStatus,roster_status_source:"FANTRAX",updated_at:new Date().toISOString()}).eq("league_id",leagueId).in("id",group.ids).eq("owner_team_id",group.expectedOwnerTeamId).eq("roster_status",group.currentRosterStatus).or("roster_status_source.is.null,roster_status_source.neq.MANUAL").select("id,name,owner_team_id,roster_status,roster_status_source,roster_status_override_at,roster_status_override_by,is_free_agent,fantrax_id,mlbam_id,updated_at"),
        "players reviewed Fantrax roster-status update"
      );
      updated.push(...(result.data||[]));
    }catch(error){
      failures.push({message:String(error?.message||error),expectedOwnerTeamId:group.expectedOwnerTeamId,currentRosterStatus:group.currentRosterStatus,rosterStatus:group.rosterStatus,playerIds:[...group.ids]});
      break;
    }
  }
  const updatedIds=new Set(updated.map(row=>row.id));
  const skippedUpdates=updates.filter(update=>!updatedIds.has(update.id)),currentById=new Map();
  if(skippedUpdates.length){
    try{
      const current=await request(supabase.from("players").select("id,owner_team_id,roster_status,roster_status_source").eq("league_id",leagueId).in("id",skippedUpdates.map(update=>update.id)),"players reviewed Fantrax skip classification");
      (current.data||[]).forEach(row=>currentById.set(row.id,row));
    }catch(error){failures.push({message:String(error?.message||error),classificationRead:true,playerIds:skippedUpdates.map(update=>update.id)})}
  }
  const skipped=skippedUpdates.map(update=>({...update,reason:fantraxRosterSyncSkipReason(update,currentById.get(update.id),{writeFailed:failures.length>0}),currentRow:currentById.get(update.id)||null}));
  return {reviewed:updates.length,updated,skipped,failures};
}
