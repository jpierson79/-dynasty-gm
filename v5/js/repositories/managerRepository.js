import { countLeagueRows, selectLeagueRows, updateLeagueRow } from "./baseRepository.js";

export async function listManagers(leagueId){
  return selectLeagueRows("managers",leagueId,{order:"team_name",ascending:true});
}
export async function managerCount(leagueId){return countLeagueRows("managers",leagueId)}
export async function linkManagerToTeam(leagueId,team,manager){
  if(!team?.id||!manager?.team_name)throw new Error("Choose a team and manager to link.");
  return updateLeagueRow("teams",team.id,{manager_id:manager.id||null,league_id:leagueId});
}
export async function managerPreferences(leagueId){
  return selectLeagueRows("manager_preferences",leagueId,{order:"created_at",ascending:false});
}
