import * as players from "../repositories/playerRepository.js";
import * as teams from "../repositories/teamRepository.js";
import * as managers from "../repositories/managerRepository.js";
import * as metrics from "../repositories/metricRepository.js";
import * as scores from "../repositories/scoreRepository.js";
import * as imports from "../repositories/importJobRepository.js";
import { setState } from "../state/appState.js?v5-4-6e-gate4c1-auth-state";
import { validFantasyTeamsForPlayers } from "../domain/teamRules.js";

export async function loadLeagueOverview(leagueId){
  const [playerCount,ownedPlayers,freeAgents,hkbCoverage,fantraxIdCount,mlbamIdCount,bothExternalIdCount,teamRows,managerRows,metricRows,scoreCoverage,jobRows,rosterSummary]=await Promise.all([
    players.playerCount(leagueId),
    players.ownedPlayerCount(leagueId),
    players.freeAgentCount(leagueId),
    players.hkbCoverageCount(leagueId),
    players.fantraxIdCount(leagueId),
    players.mlbamIdCount(leagueId),
    players.bothExternalIdCount(leagueId),
    teams.listTeams(leagueId),
    managers.listManagers(leagueId),
    metrics.metricCoverageRows(leagueId),
    scores.scoreCoverageCount(leagueId),
    imports.latestImportJobs(leagueId),
    players.rosterSummaryRows(leagueId)
  ]);
  const activeTeamRows=validFantasyTeamsForPlayers(teamRows,rosterSummary);
  const latestImportJobs=jobRows.slice(0,8);
  const hitterStatcastCoverage=new Set(metricRows.filter(metric=>String(metric.metric_type||"").includes("hitting")).map(metric=>metric.player_id)).size;
  const pitcherStatcastCoverage=new Set(metricRows.filter(metric=>String(metric.metric_type||"").includes("pitching")).map(metric=>metric.player_id)).size;
  const neitherExternalId=Math.max(0,playerCount-(fantraxIdCount+mlbamIdCount-bothExternalIdCount));
  const dashboardStats={playerCount,ownedPlayers,freeAgents,hkbCoverage,fantraxIdCount,mlbamIdCount,bothExternalIdCount,neitherExternalId,hitterStatcastCoverage,pitcherStatcastCoverage,scoreCoverage,teamCount:activeTeamRows.length,managerCount:managerRows.length};
  setState({players:[],dashboardStats,teams:activeTeamRows,managers:managerRows,latestImportJobs,rosterSummary});
  return {dashboardStats,teams:activeTeamRows,managers:managerRows,latestImportJobs,rosterSummary};
}
