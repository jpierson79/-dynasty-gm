import { client, request, selectLeagueRows } from "./baseRepository.js";
import { invalidFantasyTeamReason, isValidFantasyTeam, playerCountByTeam } from "../domain/teamRules.js";

export async function allTeams(leagueId){
  return selectLeagueRows("teams",leagueId,{order:"name",ascending:true});
}

export async function listTeams(leagueId){
  const rows=await allTeams(leagueId);
  return rows.filter(isValidFantasyTeam);
}

export async function teamCount(leagueId){
  return (await listTeams(leagueId)).length;
}

export async function excludedInvalidTeamRows(leagueId,playerRows=[]){
  const rows=await allTeams(leagueId);
  const counts=playerCountByTeam(playerRows);
  return rows.filter(team=>!isValidFantasyTeam(team,{playerCount:counts.get(team.id)||0})).map(team=>({
    id:team.id,
    name:team.name||"",
    abbreviation:team.abbreviation||"",
    playerCount:counts.get(team.id)||0,
    created_at:team.created_at||"",
    reason:invalidFantasyTeamReason(team,{playerCount:counts.get(team.id)||0})
  }));
}

export async function saveFantraxTeamMappings(leagueId,rows=[]){
  if(!leagueId)throw new Error("Active league is required.");
  if(!rows.length)return [];
  const supabase=await client(),saved=[];
  for(const row of rows){
    const fantraxTeamId=String(row.fantrax_team_id||"").trim();
    if(!/^[A-Za-z0-9]{16}$/.test(fantraxTeamId))throw new Error("A valid 16-character Fantrax team ID is required.");
    let query=supabase.from("teams").update({fantrax_team_id:fantraxTeamId}).eq("league_id",leagueId).eq("id",row.id);
    if(row.current_fantrax_team_id)query=query.eq("fantrax_team_id",row.current_fantrax_team_id);else query=query.is("fantrax_team_id",null);
    const result=await request(query.select("id,league_id,name,manager_id,fantrax_team_id,updated_at").single(),"Fantrax team identity update");
    saved.push(result.data);
  }
  return saved;
}
