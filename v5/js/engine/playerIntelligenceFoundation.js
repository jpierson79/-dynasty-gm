export const PLAYER_INTELLIGENCE_FOUNDATION_VERSION="5.5B-1";
export const COMPONENT_STATUS=Object.freeze({CALCULATED:"CALCULATED",INSUFFICIENT_DATA:"INSUFFICIENT_DATA",NOT_APPLICABLE:"NOT_APPLICABLE",STALE:"STALE",FAILED:"FAILED"});
export const COMPONENT_CODES=Object.freeze(["leagueProduction","underlyingSkill","roleStability","positionalScarcityValue","ageTrajectory","marketValue","risk","replacementAdvantage","prospectOpportunityCost"]);

export function explanation({code,severity="INFO",message="",data={},source=null,confidenceImpact=0}={}){if(!code)throw new Error("Explanation code is required.");return {code,severity,message,data,source,confidenceImpact}}
export function componentResult({status=COMPONENT_STATUS.INSUFFICIENT_DATA,score=null,confidence=null,inputsUsed=[],explanations=[],warnings=[],version=PLAYER_INTELLIGENCE_FOUNDATION_VERSION}={}){
  if(!Object.values(COMPONENT_STATUS).includes(status))throw new Error("Unsupported component status.");
  if(status!==COMPONENT_STATUS.CALCULATED&&score!==null)throw new Error("Unavailable component scores must remain null.");
  return {score,status,confidence,inputsUsed:[...inputsUsed],explanations:[...explanations],warnings:[...warnings],version};
}
export function scenarioContract(){return {floor:{status:COMPONENT_STATUS.INSUFFICIENT_DATA,score:null,assumptions:[],warnings:[]},expected:{status:COMPONENT_STATUS.INSUFFICIENT_DATA,score:null,assumptions:[],warnings:[]},ceiling:{status:COMPONENT_STATUS.INSUFFICIENT_DATA,score:null,assumptions:[],warnings:[]},confidence:{status:COMPONENT_STATUS.INSUFFICIENT_DATA,score:null,inputs:[],warnings:[]}}}
export function buildPlayerIntelligenceFoundation(input){
  if(input?.schema!=="player-intelligence-input-v1"||!input.playerId||!input.leagueId)throw new Error("Canonical Player Intelligence input is required.");
  const components=Object.fromEntries(COMPONENT_CODES.map(code=>[code,componentResult()]));
  return {schema:"player-intelligence-foundation-v1",foundationVersion:PLAYER_INTELLIGENCE_FOUNDATION_VERSION,inputVersion:input.inputVersion,playerId:input.playerId,leagueId:input.leagueId,asOfDate:input.asOfDate,season:input.season,components,scenarios:scenarioContract(),signals:[],explanations:[],warnings:[...input.warnings],dataFreshness:structuredClone(input.dataFreshness),compatibility:{scoreVersion:"5.1.1",productionCalculationChanged:false}};
}
