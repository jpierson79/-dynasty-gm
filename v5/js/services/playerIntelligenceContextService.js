import {loadUnderlyingSkillEvaluation} from "./playerIntelligenceUnderlyingSkillService.js";
import {evaluatePlayerContext} from "../engine/playerIntelligenceContext.js";
import {evaluateInChunks} from "./playerIntelligenceChunking.js";

export async function loadPlayerContextEvaluation(options={}){
  const evaluation=await loadUnderlyingSkillEvaluation(options);
  const inputs=[...evaluation.production.context.inputsById.values()];
  const priorById=new Map(evaluation.skill.players.map(row=>[row.playerId,row.output||row])),evaluated=await evaluateInChunks(inputs,input=>evaluatePlayerContext(input,priorById.get(input.playerId)||null),{chunkSize:options.chunkSize,yieldFn:options.yieldFn,onProgress:options.onProgress,phase:"PLAYER_CONTEXT",progressOffset:inputs.length*2,progressTotal:inputs.length*4});if(options.performanceMetrics){options.performanceMetrics.evaluationMs=(options.performanceMetrics.evaluationMs||0)+evaluated.metrics.durationMs;options.performanceMetrics.yieldCount=(options.performanceMetrics.yieldCount||0)+evaluated.metrics.yieldCount;options.performanceMetrics.maxChunkMs=Math.max(options.performanceMetrics.maxChunkMs||0,evaluated.metrics.maxChunkMs)}
  return {prior:evaluation,context:{leagueId:inputs[0]?.leagueId,players:evaluated.output}};
}
