import * as leagueRepository from "../repositories/leagueRepository.js";
import * as metricRepository from "../repositories/metricRepository.js";
import * as playerRepository from "../repositories/playerRepository.js";
import { buildCanonicalPlayerIntelligenceInput } from "./playerIntelligenceInputService.js";
import { evaluateLeagueProductionPopulation } from "../engine/playerIntelligenceLeagueProduction.js";

export async function loadLeagueProductionEvaluation({leagueId,season,asOfDate,repositories={},replacementTopN=5}={}){
  if(!leagueId)throw new Error("Active league ID is required.");
  const playersRepo=repositories.players||playerRepository,metricsRepo=repositories.metrics||metricRepository,leaguesRepo=repositories.leagues||leagueRepository;
  const [players,metricRows,league]=await Promise.all([playersRepo.allPlayers(leagueId),metricsRepo.listMetrics(leagueId),leaguesRepo.leagueById(leagueId)]);
  if(!league)throw new Error("Active league was not found.");
  const inputs=(players||[]).map(player=>buildCanonicalPlayerIntelligenceInput({player,league,metricRows,season,asOfDate}));
  return evaluateLeagueProductionPopulation(inputs,{replacementTopN});
}
