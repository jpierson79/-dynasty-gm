import { buildPlayerIntelligenceFoundation, componentResult, COMPONENT_STATUS, explanation } from "./playerIntelligenceFoundation.js";

export const LEAGUE_PRODUCTION_VERSION="5.5B-2";
export const REPLACEMENT_POSITIONS=Object.freeze(["C","1B","2B","3B","SS","OF","SP","RP"]);
export const AVAILABILITY=Object.freeze({ROSTERED:"ROSTERED",FREE_AGENT:"FREE_AGENT",WAIVER:"WAIVER",UNKNOWN:"UNKNOWN"});
const HITTER_POSITIONS=new Set(["C","1B","2B","3B","SS","OF"]),PITCHER_POSITIONS=new Set(["SP","RP"]);

const clamp=value=>Math.max(0,Math.min(100,Number(value)||0));
const round=value=>Math.round(Number(value)*100)/100;
const numeric=value=>typeof value==="number"&&Number.isFinite(value);
const median=values=>{const rows=[...values].sort((a,b)=>b-a);if(!rows.length)return null;const middle=Math.floor(rows.length/2);return rows.length%2?rows[middle]:(rows[middle-1]+rows[middle])/2};
function percentile(value,values){const rows=values.filter(numeric).sort((a,b)=>a-b);if(!rows.length||!numeric(value))return null;if(rows.length===1)return 100;const below=rows.filter(item=>item<value).length,equal=rows.filter(item=>item===value).length;return round(100*(below+Math.max(0,equal-1)/2)/(rows.length-1));}
function warning(code,message,details={}){return {code,group:"leagueProduction",severity:"WARNING",message,details}}
function availability(input){
  const player=input.player||{},status=String(player.rosterStatus||"").toUpperCase();
  if(["WAIVER","WAIVERS","CLAIMED","PENDING"].includes(status))return AVAILABILITY.WAIVER;
  if(player.isFreeAgent===true&&player.ownerTeamId==null)return AVAILABILITY.FREE_AGENT;
  if(player.ownerTeamId&&player.isFreeAgent!==true)return AVAILABILITY.ROSTERED;
  return AVAILABILITY.UNKNOWN;
}
function eligible(input){return (input.positionEligibility?.eligible||[]).filter(position=>REPLACEMENT_POSITIONS.includes(position))}
function viable(input){return !input.player?.isMinorLeaguer&&!["MINORS","INACTIVE"].includes(String(input.player?.rosterStatus||"").toUpperCase())&&numeric(input.production?.fantasyPoints)&&eligible(input).length>0}
function slotCount(value){if(numeric(value))return value;if(value&&typeof value==="object")return Number(value.count??value.slots??value.quantity)||0;return 0}
function lineupDemand(input){
  const slots=input?.leagueContext?.lineupSlots,teamCount=Number(input?.leagueContext?.teamCount);
  if(!slots||typeof slots!=="object"||!Number.isFinite(teamCount)||teamCount<1)return {authoritative:false,teamCount:Number.isFinite(teamCount)?teamCount:null,byPosition:{},utility:0,pitcherFlex:0};
  const upper=Object.fromEntries(Object.entries(slots).map(([key,value])=>[String(key).toUpperCase(),slotCount(value)]));
  return {authoritative:true,teamCount,byPosition:Object.fromEntries(REPLACEMENT_POSITIONS.map(position=>[position,(upper[position]||0)*teamCount])),utility:(upper.UT||upper.UTIL||upper.UTILITY||0)*teamCount,pitcherFlex:(upper.P||0)*teamCount};
}
function poolEvidence({position,eligibleRows,availableRows,demand,topN}){
  const rankedAvailable=[...availableRows].sort((a,b)=>b.production.fantasyPoints-a.production.fantasyPoints),top=rankedAvailable.slice(0,topN),values=top.map(row=>row.production.fantasyPoints);
  const rostered=eligibleRows.filter(row=>row.availability===AVAILABILITY.ROSTERED),rosteredValues=rostered.map(row=>row.production.fantasyPoints),replacementProduction=median(values);
  const positiveCount=rankedAvailable.filter(row=>row.production.fantasyPoints>0).length,rosteredMedian=median(rosteredValues),cliff=numeric(rosteredMedian)&&numeric(replacementProduction)?Math.max(0,rosteredMedian-replacementProduction):0;
  const scale=Math.max(1,...eligibleRows.map(row=>Math.abs(row.production.fantasyPoints))),depthScarcity=1-Math.min(1,positiveCount/Math.max(1,demand.teamCount||10));
  const cliffScarcity=Math.min(1,cliff/scale),positionDemand=demand.byPosition[position]||0,demandPressure=demand.authoritative&&positionDemand?Math.min(1,positionDemand/Math.max(1,eligibleRows.length)):null;
  const scarcity=round(100*(demandPressure===null?.65*depthScarcity+.35*cliffScarcity:.5*depthScarcity+.3*cliffScarcity+.2*demandPressure));
  return {position,eligibleCount:eligibleRows.length,rosteredCount:rostered.length,availableCount:rankedAvailable.length,positiveProductionAvailableCount:positiveCount,topAvailableFPts:rankedAvailable[0]?.production.fantasyPoints??null,medianTop3AvailableFPts:median(rankedAvailable.slice(0,3).map(row=>row.production.fantasyPoints)),medianTop5AvailableFPts:median(rankedAvailable.slice(0,5).map(row=>row.production.fantasyPoints)),replacementProduction,starterTierMedian:rosteredMedian,gapBetweenStarterTierAndAvailableTier:numeric(rosteredMedian)&&numeric(replacementProduction)?round(rosteredMedian-replacementProduction):null,lineupDemand:positionDemand||null,lineupDemandAuthoritative:demand.authoritative,utilityDemand:HITTER_POSITIONS.has(position)?demand.utility:0,pitcherFlexDemand:PITCHER_POSITIONS.has(position)?demand.pitcherFlex:0,scarcityScore:clamp(scarcity),benchmarkTopN:top.length};
}

export function buildLeagueProductionContext(inputs,{replacementTopN=5}={}){
  if(!Array.isArray(inputs)||!inputs.length)throw new Error("Canonical league population is required.");
  if(!Number.isInteger(replacementTopN)||replacementTopN<1||replacementTopN>10)throw new Error("Replacement top-N must be between 1 and 10.");
  const leagueId=inputs[0].leagueId,season=inputs[0].season;
  if(inputs.some(input=>input.schema!=="player-intelligence-input-v1"||input.leagueId!==leagueId))throw new Error("All canonical inputs must belong to one league.");
  const demand=lineupDemand(inputs[0]),rows=inputs.map(input=>({input,id:input.playerId,availability:availability(input),positions:eligible(input),production:input.production}));
  const productionValues=rows.filter(row=>numeric(row.production?.fantasyPoints)).map(row=>row.production.fantasyPoints),pools={},availableByPosition={};
  for(const position of REPLACEMENT_POSITIONS){const positionRows=rows.filter(row=>viable(row.input)&&row.positions.includes(position)),available=positionRows.filter(row=>row.availability===AVAILABILITY.FREE_AGENT).sort((a,b)=>b.production.fantasyPoints-a.production.fantasyPoints);availableByPosition[position]=available;pools[position]=poolEvidence({position,eligibleRows:positionRows,availableRows:available,demand,topN:replacementTopN})}
  return {schema:"player-intelligence-league-context-v1",version:LEAGUE_PRODUCTION_VERSION,leagueId,season,inputsById:new Map(inputs.map(input=>[input.playerId,input])),rows,productionValues,demand,pools,availableByPosition,replacementTopN};
}

function replacementFor(context,position,excludedId){
  const candidates=(context.availableByPosition[position]||[]).filter(row=>row.id!==excludedId).slice(0,context.replacementTopN);
  return {production:median(candidates.map(row=>row.production.fantasyPoints)),count:candidates.length};
}
function confidence(input,pool){let score=90,warnings=[];if(input.production.status==="STALE"){score-=30;warnings.push(warning("STALE_FANTRAX_PRODUCTION","Fantrax production is stale."))}if(input.production.gamesPlayed==null&&input.production.plateAppearances==null&&input.production.inningsPitched==null&&input.production.appearances==null){score-=15;warnings.push(warning("SAMPLE_SIZE_UNAVAILABLE","No authoritative opportunity field is available; sample size was not inferred."))}if(availability(input)===AVAILABILITY.UNKNOWN){score-=20;warnings.push(warning("OWNERSHIP_STATE_UNKNOWN","Canonical ownership/free-agent evidence is incomplete; this player is not treated as immediately available."))}if(!pool?.lineupDemandAuthoritative){score-=10;warnings.push(warning("LINEUP_CONFIGURATION_INCOMPLETE","Exact lineup demand is unavailable; empirical roster/free-agent depth is used."))}return {score:clamp(score),warnings}}
function productionExplanation(percentileValue){if(percentileValue>=90)return "LEAGUE_PRODUCTION_ELITE";if(percentileValue>=60)return "LEAGUE_PRODUCTION_ABOVE_AVERAGE";return "LEAGUE_PRODUCTION_BELOW_AVERAGE"}

export function evaluateLeagueProductionPlayer(context,playerId){
  const input=context.inputsById.get(playerId);if(!input)throw new Error("Player UUID is not present in the league context.");
  const points=input.production?.fantasyPoints,positions=eligible(input),base=buildPlayerIntelligenceFoundation(input);
  if(!numeric(points)){
    const status=input.player?.isMinorLeaguer?COMPONENT_STATUS.NOT_APPLICABLE:COMPONENT_STATUS.INSUFFICIENT_DATA,missing=warning("MISSING_FANTRAX_PRODUCTION","Canonical Fantrax fantasy points are unavailable.");
    base.components.leagueProduction=componentResult({status,warnings:[missing],version:LEAGUE_PRODUCTION_VERSION});base.components.positionalScarcityValue=componentResult({status:COMPONENT_STATUS.INSUFFICIENT_DATA,warnings:[missing],version:LEAGUE_PRODUCTION_VERSION});base.components.replacementAdvantage=componentResult({status:COMPONENT_STATUS.INSUFFICIENT_DATA,warnings:[missing],version:LEAGUE_PRODUCTION_VERSION});return base;
  }
  if(!positions.length){const missing=warning("NO_ELIGIBLE_POSITION","No supported position is available.");base.components.leagueProduction=componentResult({status:COMPONENT_STATUS.CALCULATED,score:clamp(percentile(points,context.productionValues)),confidence:60,inputsUsed:["Fantrax.fantasyPoints"],warnings:[missing],version:LEAGUE_PRODUCTION_VERSION});base.components.positionalScarcityValue=componentResult({warnings:[missing],version:LEAGUE_PRODUCTION_VERSION});base.components.replacementAdvantage=componentResult({warnings:[missing],version:LEAGUE_PRODUCTION_VERSION});return base}
  const poolRows=positions.map(position=>context.pools[position]),primaryPool=[...poolRows].sort((a,b)=>b.scarcityScore-a.scarcityScore)[0],quality=confidence(input,primaryPool),productionPercentile=percentile(points,context.productionValues),productionStatus=input.production.status==="STALE"?COMPONENT_STATUS.STALE:COMPONENT_STATUS.CALCULATED;
  base.components.leagueProduction=componentResult({status:productionStatus,score:productionStatus===COMPONENT_STATUS.CALCULATED?clamp(productionPercentile):null,confidence:quality.score,inputsUsed:["Fantrax.fantasyPoints","Fantrax.fantasyPointsPerGame","Fantrax.importedAt"],explanations:[explanation({code:productionExplanation(productionPercentile),data:{fantasyPoints:points,fantasyPointsPerGame:input.production.fantasyPointsPerGame,leaguePercentile:productionPercentile,populationSize:context.productionValues.length},source:"Fantrax"})],warnings:quality.warnings,version:LEAGUE_PRODUCTION_VERSION});
  const scarcityScore=round(Math.max(...poolRows.map(row=>row.scarcityScore))+Math.min(5,Math.max(0,positions.length-1)*2));
  const depthCode=primaryPool.availableCount>=Math.max(5,context.demand.teamCount||5)?"FREE_AGENT_DEPTH_HIGH":"FREE_AGENT_DEPTH_LOW",scarcityCode=scarcityScore>=60?"POSITION_SHALLOW":"POSITION_DEEP";
  base.components.positionalScarcityValue=componentResult({status:COMPONENT_STATUS.CALCULATED,score:clamp(scarcityScore),confidence:quality.score,inputsUsed:["players.positions","players.owner_team_id","players.is_free_agent","Fantrax.fantasyPoints","league.settings.lineupSlots"],explanations:[explanation({code:scarcityCode,data:{position:primaryPool.position,scarcityScore:primaryPool.scarcityScore,availableCount:primaryPool.availableCount,replacementFPts:primaryPool.replacementProduction},source:"league population"}),explanation({code:depthCode,data:{position:primaryPool.position,availableCount:primaryPool.availableCount,positiveProductionAvailableCount:primaryPool.positiveProductionAvailableCount},source:"league population"}),...(positions.length>1?[explanation({code:"MULTI_POSITION_FLEXIBILITY",data:{positions,flexibilityPremium:Math.min(5,(positions.length-1)*2)},source:"players.positions"})]:[])],warnings:[...quality.warnings,...(primaryPool.availableCount<3?[warning("REPLACEMENT_POOL_SMALL","Fewer than three available alternatives support this replacement benchmark.",{position:primaryPool.position,count:primaryPool.availableCount})]:[])],version:LEAGUE_PRODUCTION_VERSION});
  const comparisons=positions.map(position=>{const replacement=replacementFor(context,position,playerId);return {position,playerFantasyPoints:points,replacementFantasyPoints:replacement.production,rawGap:numeric(replacement.production)?round(points-replacement.production):null,availableCompared:replacement.count}}),valid=comparisons.filter(row=>numeric(row.rawGap)).sort((a,b)=>b.rawGap-a.rawGap),best=valid[0]||null,range=Math.max(1,Math.max(...context.productionValues)-Math.min(...context.productionValues));
  if(!best){base.components.replacementAdvantage=componentResult({warnings:[warning("REPLACEMENT_POOL_EMPTY","No immediately available eligible replacement pool exists.")],version:LEAGUE_PRODUCTION_VERSION});return base}
  const replacementScore=clamp(50+50*best.rawGap/range),replacementCode=best.rawGap<0?"BELOW_REPLACEMENT":best.rawGap>=range*.25?"REPLACEMENT_ADVANTAGE_STRONG":"REPLACEMENT_ADVANTAGE_MODEST";
  base.components.replacementAdvantage=componentResult({status:COMPONENT_STATUS.CALCULATED,score:replacementScore,confidence:quality.score,inputsUsed:["Fantrax.fantasyPoints","players.positions","players.owner_team_id","players.is_free_agent"],explanations:[explanation({code:replacementCode,data:{bestReplacementPosition:best.position,playerFantasyPoints:points,replacementFantasyPoints:best.replacementFantasyPoints,rawReplacementGap:best.rawGap,availability:availability(input)},source:"league population"})],warnings:quality.warnings,version:LEAGUE_PRODUCTION_VERSION});
  base.replacementContext={availability:availability(input),positions:comparisons,bestReplacementPosition:best.position,replacementProduction:best.replacementFantasyPoints,playerProduction:points,rawReplacementGap:best.rawGap};base.positionalContext={positions:poolRows};return base;
}

export function evaluateLeagueProductionPopulation(inputs,options){const context=buildLeagueProductionContext(inputs,options);return {context,players:inputs.map(input=>evaluateLeagueProductionPlayer(context,input.playerId))}}
