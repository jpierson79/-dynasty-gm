import { selectLeagueRows } from "./baseRepository.js";
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
