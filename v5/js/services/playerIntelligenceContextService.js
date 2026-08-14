import {loadUnderlyingSkillEvaluation} from "./playerIntelligenceUnderlyingSkillService.js";
import {evaluatePlayerContextPopulation} from "../engine/playerIntelligenceContext.js";

export async function loadPlayerContextEvaluation(options={}){
  const evaluation=await loadUnderlyingSkillEvaluation(options);
  const inputs=[...evaluation.production.context.inputsById.values()];
  return {prior:evaluation,context:evaluatePlayerContextPopulation(inputs,evaluation.skill.players)};
}
