import {loadLeagueProductionEvaluation} from "./playerIntelligenceLeagueProductionService.js";
import {evaluateUnderlyingSkillPopulation} from "../engine/playerIntelligenceUnderlyingSkill.js";
export async function loadUnderlyingSkillEvaluation(options={}){const production=await loadLeagueProductionEvaluation(options),inputs=[...production.context.inputsById.values()];return {production,skill:evaluateUnderlyingSkillPopulation(inputs,production.players)}}
