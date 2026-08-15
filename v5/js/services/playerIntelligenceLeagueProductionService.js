import * as leagueRepository from "../repositories/leagueRepository.js";
import * as metricRepository from "../repositories/metricRepository.js";
import * as playerRepository from "../repositories/playerRepository.js";
import { buildCanonicalPlayerIntelligenceInput,buildPlayerMetricIndex } from "./playerIntelligenceInputService.js";
import {buildLeagueProductionContext,evaluateLeagueProductionPlayer} from "../engine/playerIntelligenceLeagueProduction.js";
import {evaluateInChunks} from "./playerIntelligenceChunking.js";

export async function loadLeagueProductionEvaluation({leagueId,season,asOfDate,repositories={},replacementTopN=5,chunkSize,yieldFn,onProgress,performanceMetrics}={}){
  if(!leagueId)throw new Error("Active league ID is required.");
  const playersRepo=repositories.players||playerRepository,metricsRepo=repositories.metrics||metricRepository,leaguesRepo=repositories.leagues||leagueRepository;
  const loadStarted=performance.now(),[players,metricRows,league]=await Promise.all([playersRepo.allPlayers(leagueId),metricsRepo.listMetrics(leagueId),leaguesRepo.leagueById(leagueId)]);
  if(!league)throw new Error("Active league was not found.");
  const indexStarted=performance.now(),metricsByPlayerId=buildPlayerMetricIndex(metricRows,season),indexBuildMs=performance.now()-indexStarted,inputStarted=performance.now(),inputs=(players||[]).map(player=>buildCanonicalPlayerIntelligenceInput({player,league,metricsByPlayerId,season,asOfDate})),contextStarted=performance.now(),context=buildLeagueProductionContext(inputs,{replacementTopN}),contextBuildMs=performance.now()-contextStarted;
  const evaluated=await evaluateInChunks(inputs,input=>evaluateLeagueProductionPlayer(context,input.playerId),{chunkSize,yieldFn,onProgress,phase:"LEAGUE_PRODUCTION",progressOffset:0,progressTotal:inputs.length*4});
  if(performanceMetrics)Object.assign(performanceMetrics,{canonicalPopulationLoadCount:1,metricIndexBuildCount:1,contextBuildCounts:{production:1,replacement:1,hitterStatcast:0,pitcherStatcast:0,market:0},dataLoadMs:Math.round(indexStarted-loadStarted),indexBuildMs:Math.round(indexBuildMs),inputBuildMs:Math.round(contextStarted-inputStarted),contextBuildMs:Math.round(contextBuildMs),evaluationMs:evaluated.metrics.durationMs,yieldCount:evaluated.metrics.yieldCount,maxChunkMs:evaluated.metrics.maxChunkMs});
  return {context,players:evaluated.output};
}
