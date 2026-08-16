import { client } from "./baseRepository.js";
import { allPlayers } from "./playerRepository.js?v5-4-6b2-reviewed-sync";
import { allTeams } from "./teamRepository.js?v5-4-6a-team-identity";
import { listManagers } from "./managerRepository.js";
import { listMetrics } from "./metricRepository.js";
import { listScores } from "./scoreRepository.js";
import { leagueById } from "./leagueRepository.js";

export async function readProtectedBaselineDomains(leagueId,{dependencies={},includeLeague=false}={}){
  if(!leagueId)throw new Error("Active league is required for protected baseline evidence.");
  const d={client,allPlayers,allTeams,listManagers,listMetrics,listScores,leagueById,...dependencies};
  const supabase=await d.client();
  const {data,error}=await supabase.auth.getUser();
  if(error||!data?.user?.id){
    const failure=new Error("Sign in before capturing protected baseline evidence.");
    failure.code="PERMISSION_BLOCKED";
    throw failure;
  }
  const [players,scores,metrics,teams,managers,league]=await Promise.all([
    d.allPlayers(leagueId),d.listScores(leagueId),d.listMetrics(leagueId),d.allTeams(leagueId),d.listManagers(leagueId),includeLeague?d.leagueById(leagueId):null
  ]);
  return {players,scores,metrics,teams,managers,...(includeLeague?{leagues:league?[league]:[]}:{})};
}
