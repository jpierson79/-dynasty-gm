import {loadPlayerContextEvaluation} from "./playerIntelligenceContextService.js";
import {evaluatePlayerIntelligenceCompositePopulation} from "../engine/playerIntelligenceComposite.js";
export async function loadPlayerIntelligenceComposite(options={}){const prior=await loadPlayerContextEvaluation(options),inputs=[...prior.prior.production.context.inputsById.values()],results=prior.context.players.map(x=>({...x.output,contextEvidence:x.evidence}));return {prior,composite:evaluatePlayerIntelligenceCompositePopulation(inputs,results)}}
