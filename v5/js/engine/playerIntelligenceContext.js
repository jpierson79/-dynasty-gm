import {componentResult,COMPONENT_STATUS,explanation} from "./playerIntelligenceFoundation.js";

export const PLAYER_CONTEXT_VERSION="5.5B-4";
export const PROSPECT_OPPORTUNITY_COST_DIRECTION="HIGHER_IS_BETTER_LOWER_COST";
const num=value=>typeof value==="number"&&Number.isFinite(value);
const clamp=value=>Math.max(0,Math.min(100,Math.round(Number(value)||0)));
const upper=value=>String(value||"").trim().toUpperCase();
const warning=(code,message,details={})=>({code,group:"playerContext",severity:"WARNING",message,details});

function transition(input){return upper(input.role?.recentTransition||input.role?.transition);}
function level(input){return upper(input.ageDevelopment?.level||input.prospectContext?.level);}
function distance(input){
  if(!input.player?.isMinorLeaguer)return 0;
  const stage=level(input);
  if(stage==="AAA")return 1;if(stage==="AA")return 2;
  if(["A+","HIGH-A","A","LOW-A"].includes(stage))return 3;
  if(["ROOKIE","COMPLEX","DSL","FCL","ACL"].includes(stage))return 4;
  return null;
}
function roleStability(input){
  const role=input.role||{},status=upper(role.rosterStatus||input.player?.rosterStatus),mlb=upper(role.mlbStatus)==="MLB"&&!input.player?.isMinorLeaguer,move=transition(input);
  let score=50,confidence=25;const explanations=[],warnings=[];const used=[];
  if(upper(role.mlbStatus)!=="UNKNOWN"){used.push("role.mlbStatus");confidence+=20;if(mlb){score+=15;explanations.push(explanation({code:"ESTABLISHED_MLB_ROLE",data:{mlbStatus:role.mlbStatus},source:"players.mlb_team"}))}else{score-=20;explanations.push(explanation({code:"MINOR_LEAGUE_ROLE",data:{mlbStatus:role.mlbStatus},source:"players.is_minor_leaguer"}))}}
  if(status){used.push("role.rosterStatus");confidence+=20;if(status==="ACTIVE")score+=15;else if(status==="RESERVE")score-=8;else if(status==="MINORS")score-=18;else if(status==="IL")score-=10;else{score-=8;warnings.push(warning("ROLE_DATA_INCOMPLETE","Roster status does not establish a stable playing role.",{rosterStatus:status}))}}
  if(move==="PROMOTED"){used.push("role.recentTransition");confidence+=10;score-=5;explanations.push(explanation({code:"RECENT_PROMOTION",data:{transition:move},source:"canonical role evidence"}))}
  if(move==="DEMOTED"){used.push("role.recentTransition");confidence+=10;score-=25;explanations.push(explanation({code:"RECENT_DEMOTION",data:{transition:move},source:"canonical role evidence"}))}
  const explicit=[role.everydayRole,role.rotationRole,role.bullpenRole].filter(value=>typeof value==="boolean");
  if(explicit.length){used.push("role.explicitUsage");confidence+=15;if(explicit.some(Boolean)){score+=15;explanations.push(explanation({code:"ROLE_USAGE_CONFIRMED",data:{everydayRole:role.everydayRole,rotationRole:role.rotationRole,bullpenRole:role.bullpenRole},source:"canonical role evidence"}))}else score-=10}
  const pitcher=(role.pitcherEligibility||[]).map(upper),reliever=pitcher.includes("RP");
  if(reliever&&role.savesHoldsOpportunity==null){score-=5;confidence-=5;warnings.push(warning("RELIEF_ROLE_EVIDENCE_LIMITED","RP eligibility does not establish closer or leverage-role stability."))}
  const flexibility=Math.max(0,(input.positionEligibility?.eligible||[]).length-1);if(flexibility){used.push("positionEligibility");score+=Math.min(5,flexibility*2)}
  if(!explicit.length){warnings.push(warning("ROLE_DATA_INCOMPLETE","Canonical playing-time and role-clarity evidence is incomplete."));confidence-=10}
  if(!used.length)return componentResult({warnings:[warning("ROLE_DATA_INCOMPLETE","No canonical role evidence is available.")],version:PLAYER_CONTEXT_VERSION});
  return componentResult({status:COMPONENT_STATUS.CALCULATED,score:clamp(score),confidence:clamp(confidence),inputsUsed:used,explanations,warnings,version:PLAYER_CONTEXT_VERSION});
}

function ageTrajectory(input){
  const age=Number(input.ageDevelopment?.age??input.player?.age),pitcher=input.underlyingSkill?.playerType==="pitcher",minor=Boolean(input.player?.isMinorLeaguer);
  if(!Number.isFinite(age))return componentResult({warnings:[warning("AGE_DATA_INCOMPLETE","Canonical age is unavailable.")],version:PLAYER_CONTEXT_VERSION});
  let stage,score;
  if(age<24){stage="DEVELOPMENT";score=minor?72:90}else if(age<27){stage="EARLY_PRIME";score=88}else if(age<30){stage="PRIME";score=78}else if(age<33){stage="LATE_PRIME";score=pitcher?55:62}else{stage="DECLINE_RISK";score=Math.max(20,55-(age-33)*6-(pitcher?5:0))}
  const d=distance(input),warnings=[];let confidence=90;
  if(minor&&d===null){confidence-=25;warnings.push(warning("PROSPECT_DATA_INCOMPLETE","Minor-league level is unavailable; youth is not treated as MLB readiness."))}
  else if(minor&&d>=3)score-=10;
  return componentResult({status:COMPONENT_STATUS.CALCULATED,score:clamp(score),confidence:clamp(confidence),inputsUsed:["players.age","players.is_minor_leaguer",...(d===null?[]:["prospect.level"])],explanations:[explanation({code:stage==="DECLINE_RISK"?"AGING_CURVE_RISK":stage==="PRIME"?"PRIME_AGE":"FAVORABLE_AGE_TRAJECTORY",data:{age,developmentStage:stage,isMinorLeaguer:minor,level:level(input)||null},source:"canonical age/development"})],warnings,version:PLAYER_CONTEXT_VERSION});
}

function prospectOpportunityCost(input,prior){
  if(!input.prospectContext?.isProspect&&!input.player?.isMinorLeaguer)return componentResult({status:COMPONENT_STATUS.NOT_APPLICABLE,confidence:95,explanations:[explanation({code:"ESTABLISHED_MLB_PLAYER",data:{isProspect:false},source:"players.is_minor_leaguer"})],version:PLAYER_CONTEXT_VERSION});
  const d=distance(input),market=num(input.market?.value)?input.market.value:null,scarcity=prior?.components?.positionalScarcityValue?.score,replacement=prior?.replacementContext?.rawReplacementGap;
  let score=45,confidence=35;const used=["players.is_minor_leaguer"],warnings=[],explanations=[];
  if(d===null)warnings.push(warning("PROSPECT_DATA_INCOMPLETE","Canonical minor-league level and distance are unavailable."));else{used.push("prospect.level");confidence+=25;score+=[18,8,-8,-22][Math.max(0,d-1)];explanations.push(explanation({code:d<=1?"NEAR_MLB_PROSPECT":"DISTANT_PROSPECT",data:{level:level(input),distanceStage:d},source:"canonical prospect level"}))}
  if(market!==null){used.push("HKB.marketValue");confidence+=15;score+=Math.max(-10,Math.min(15,(Math.log10(Math.max(1,market))-2)*8));explanations.push(explanation({code:market>=1000?"HIGH_MARKET_SUPPORT":"MARKET_SUPPORT_LIMITED",data:{marketValue:market},source:"HKB"}))}else warnings.push(warning("PROSPECT_DATA_INCOMPLETE","HKB market support is unavailable."));
  if(num(scarcity)){used.push("league.positionalScarcity");confidence+=10;score+=(scarcity-50)*.15;explanations.push(explanation({code:scarcity>=60?"SCARCE_POSITION_SUPPORT":"DEEP_POSITION_OPPORTUNITY_COST",data:{scarcityScore:scarcity},source:"league population"}))}
  if(num(replacement)){used.push("league.replacementContext");score+=Math.max(-8,Math.min(8,replacement/50))}
  const code=score>=65?"PROSPECT_SLOT_COST_LOW":score<40?"PROSPECT_SLOT_COST_HIGH":"PROSPECT_SLOT_COST_MODERATE";explanations.push(explanation({code,data:{opportunityValue:clamp(score),scoreDirection:PROSPECT_OPPORTUNITY_COST_DIRECTION},source:"bounded prospect context"}));
  return componentResult({status:COMPONENT_STATUS.CALCULATED,score:clamp(score),confidence:clamp(confidence),inputsUsed:used,explanations,warnings,version:PLAYER_CONTEXT_VERSION});
}

function risk(input,role,prospect){
  let score=20,confidence=35;const used=[],explanations=[],warnings=[];const move=transition(input),d=distance(input);
  if(role.status===COMPONENT_STATUS.CALCULATED){used.push("roleStability");confidence+=20;score+=(100-role.score)*.35}else warnings.push(warning("ROLE_DATA_INCOMPLETE","Risk confidence is limited by unavailable role evidence."));
  if(input.player?.isMinorLeaguer){used.push("players.is_minor_leaguer");score+=12;if(d!==null){used.push("prospect.level");score+=d*5;confidence+=15}else warnings.push(warning("PROSPECT_DATA_INCOMPLETE","Prospect distance is unavailable."));if(input.underlyingSkill?.playerType==="pitcher"){score+=7;explanations.push(explanation({code:"PITCHER_PROSPECT_VOLATILITY",data:{boundedAdjustment:7},source:"player type and prospect status"}))}}
  if(move==="PROMOTED")score+=8;if(move==="DEMOTED")score+=18;
  const injury=upper(input.role?.injuryStatus);if(injury){used.push("role.injuryStatus");confidence+=10;if(["IL","INJURED"].includes(injury))score+=12}else warnings.push(warning("INJURY_DATA_UNAVAILABLE","No canonical current injury detail is available; no prognosis was inferred."));
  for(const freshness of [input.dataFreshness?.fantrax,input.dataFreshness?.statcast])if(freshness?.status==="STALE")score+=5;
  if(prospect.status===COMPONENT_STATUS.CALCULATED&&prospect.confidence<60)score+=5;
  explanations.push(explanation({code:score>=65?"CONTEXTUAL_RISK_HIGH":score>=40?"CONTEXTUAL_RISK_MODERATE":"CONTEXTUAL_RISK_LOW",data:{riskScore:clamp(score),recentTransition:move||null,distanceStage:d},source:"canonical contextual evidence"}));
  return componentResult({status:COMPONENT_STATUS.CALCULATED,score:clamp(score),confidence:clamp(confidence),inputsUsed:used,explanations,warnings,version:PLAYER_CONTEXT_VERSION});
}

export function evaluatePlayerContext(input,prior){
  if(input?.schema!=="player-intelligence-input-v1")throw new Error("Canonical Player Intelligence input is required.");
  const role=roleStability(input),age=ageTrajectory(input),prospect=prospectOpportunityCost(input,prior),downside=risk(input,role,prospect);
  const output=prior?{...prior,components:{...prior.components,roleStability:role,ageTrajectory:age,risk:downside,prospectOpportunityCost:prospect}}:null;
  return {playerId:input.playerId,components:{roleStability:role,ageTrajectory:age,risk:downside,prospectOpportunityCost:prospect},evidence:{level:level(input)||null,distanceStage:distance(input),recentTransition:transition(input)||null},output};
}

export function evaluatePlayerContextPopulation(inputs,priorResults=[]){
  if(!Array.isArray(inputs)||!inputs.length)throw new Error("Canonical league population is required.");
  const leagueId=inputs[0].leagueId;if(inputs.some(input=>input.leagueId!==leagueId))throw new Error("Context evaluation must be league scoped.");
  const priorById=new Map(priorResults.map(row=>[row.playerId,row.output||row]));
  return {leagueId,players:inputs.map(input=>evaluatePlayerContext(input,priorById.get(input.playerId)||null))};
}
