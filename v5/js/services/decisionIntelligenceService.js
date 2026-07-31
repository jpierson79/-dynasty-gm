import { listPlayerIntelligence, playerIntelligenceByIds, scoreValue } from "../repositories/playerIntelligenceRepository.js";

export const DECISION_RULE_VERSION="5.4.5";
export const REASON_CODES=Object.freeze({
  HIGH_DYNASTY_VALUE:"HIGH_DYNASTY_VALUE",
  HIGH_CHAMPIONSHIP_IMPACT:"HIGH_CHAMPIONSHIP_IMPACT",
  HIGH_ACQUISITION_OPPORTUNITY:"HIGH_ACQUISITION_OPPORTUNITY",
  POSITIONAL_NEED:"POSITIONAL_NEED",
  POSITIONAL_SURPLUS:"POSITIONAL_SURPLUS",
  LOW_CONFIDENCE:"LOW_CONFIDENCE",
  HIGH_RISK:"HIGH_RISK",
  LOW_FLOOR:"LOW_FLOOR",
  BLOCKED_PROSPECT:"BLOCKED_PROSPECT",
  ROSTER_CRUNCH:"ROSTER_CRUNCH",
  FREE_AGENT_UPGRADE:"FREE_AGENT_UPGRADE",
  CONSOLIDATION_ASSET:"CONSOLIDATION_ASSET",
  CORE_ASSET_PROTECTION:"CORE_ASSET_PROTECTION",
  UNCLASSIFIED_ROSTER_STATUS:"UNCLASSIFIED_ROSTER_STATUS",
  INSUFFICIENT_DATA:"INSUFFICIENT_DATA"
});

const GROUPS={
  ADD:"Immediate Adds",
  WATCH:"Watch List",
  STASH:"Dynasty Stashes",
  HOLD:"Core Holds",
  SHOP:"Trade / Shop Candidates",
  CONSOLIDATE:"Consolidation Assets",
  DROP_CANDIDATE:"Drop Candidates",
  PROMOTE:"Promotion Candidates",
  DEMOTE:"Promotion Candidates",
  NO_ACTION:"Insufficient Data"
};

function positions(player){return Array.isArray(player?.positions)?player.positions:[]}
function score(player,key,fallback=0){const value=scoreValue(player,key);return value===null?fallback:value}
function hasPositionOverlap(a,b){
  const ap=positions(a),bp=positions(b);
  if(ap.some(pos=>bp.includes(pos)))return true;
  if(ap.some(pos=>["OF","UT"].includes(pos))&&bp.some(pos=>["OF","UT","1B","3B"].includes(pos)))return true;
  if(ap.some(pos=>["SP","RP","P"].includes(pos))&&bp.some(pos=>["SP","RP","P"].includes(pos)))return true;
  return false;
}
function addReason(reasons,code,condition){if(condition&&!reasons.includes(code))reasons.push(code)}
function confidenceFor(player,reasons=[]){
  let confidence=score(player,"confidence_score",45);
  if(String(player.roster_status||"").toUpperCase()==="UNCLASSIFIED")confidence-=18;
  if(reasons.includes(REASON_CODES.INSUFFICIENT_DATA))confidence-=14;
  return Math.max(10,Math.min(100,Math.round(confidence)));
}
function evidence(player,reasons=[]){
  const out=[];
  out.push(`Dynasty ${score(player,"dynasty_asset_score","Unavailable")}`);
  out.push(`Impact ${score(player,"championship_impact","Unavailable")}`);
  out.push(`Ceiling ${score(player,"ceiling_score","Unavailable")}`);
  if(reasons.includes(REASON_CODES.POSITIONAL_NEED))out.push("Fits a thin roster position");
  if(reasons.includes(REASON_CODES.POSITIONAL_SURPLUS))out.push("Position appears deep on roster");
  return out;
}
function cautions(player,reasons=[]){
  const out=[];
  if(reasons.includes(REASON_CODES.HIGH_RISK))out.push("Higher risk profile");
  if(reasons.includes(REASON_CODES.LOW_CONFIDENCE))out.push("Low data confidence");
  if(reasons.includes(REASON_CODES.UNCLASSIFIED_ROSTER_STATUS))out.push("Roster status is unclassified");
  if(reasons.includes(REASON_CODES.INSUFFICIENT_DATA))out.push("Recommendation has limited supporting data");
  return out;
}
function rec({player,type,priority,reasons,context={}}){
  const deterministic=[...new Set(reasons)].sort();
  return {
    recommendation:type,
    group:GROUPS[type]||"Watch List",
    priority:Math.max(0,Math.min(100,Math.round(priority))),
    confidence:confidenceFor(player,deterministic),
    playerId:player.id,
    player,
    scoreVersion:player.scoreVersion||player.score?.score_version||"",
    reasonCodes:deterministic,
    evidence:evidence(player,deterministic),
    cautions:cautions(player,deterministic),
    rosterContext:context,
    calculatedAt:player.calculatedAt||player.score?.calculated_at||"",
    decisionRuleVersion:DECISION_RULE_VERSION
  };
}
export function buildTeamContext(rosterRows=[],freeAgentRows=[]){
  const counts={active:0,reserve:0,il:0,minors:0,unclassified:0};
  const byPosition=new Map();
  rosterRows.forEach(player=>{
    const status=String(player.roster_status||"").toUpperCase();
    if(status==="ACTIVE"||status==="ROSTERED")counts.active++;
    else if(status==="RESERVE")counts.reserve++;
    else if(status==="IL")counts.il++;
    else if(status==="MINORS")counts.minors++;
    else counts.unclassified++;
    positions(player).forEach(pos=>{
      if(!byPosition.has(pos))byPosition.set(pos,[]);
      byPosition.get(pos).push(player);
    });
  });
  const depth=Object.fromEntries([...byPosition.entries()].map(([pos,players])=>[pos,{count:players.length,avgDynasty:Math.round(players.reduce((sum,p)=>sum+score(p,"dynasty_asset_score",50),0)/players.length)}]));
  const weakness=Object.entries(depth).filter(([,v])=>v.count<=2||v.avgDynasty<54).map(([pos])=>pos);
  const surplus=Object.entries(depth).filter(([pos,v])=>v.count>=6||(["OF","RP"].includes(pos)&&v.count>=5)).map(([pos])=>pos);
  const prospects=rosterRows.filter(player=>String(player.playerStage||"").includes("PROSPECT")).length;
  const veterans=rosterRows.filter(player=>Number(player.age||0)>=31).length;
  const weakestRosteredAssets=rosterRows.slice().sort((a,b)=>score(a,"dynasty_asset_score",0)-score(b,"dynasty_asset_score",0)).slice(0,10);
  const strongestFreeAgentAlternatives=freeAgentRows.slice().sort((a,b)=>score(b,"dynasty_asset_score",0)-score(a,"dynasty_asset_score",0)).slice(0,10);
  return {counts,positionalDepth:depth,positionWeakness:weakness,positionSurplus:surplus,veteranProspectBalance:{veterans,prospects},weakestRosteredAssets,strongestFreeAgentAlternatives,rosterPressure:{unclassified:counts.unclassified,activeOverTarget:Math.max(0,counts.active-33),reserveOverTarget:Math.max(0,counts.reserve-14),minorsOverTarget:Math.max(0,counts.minors-17)}};
}
function teamNeedFor(player,context){
  const pos=positions(player);
  return pos.find(item=>context.positionWeakness.includes(item))||"";
}
function teamSurplusFor(player,context){
  const pos=positions(player);
  return pos.find(item=>context.positionSurplus.includes(item))||"";
}
export function recommendFreeAgent(player,context={}){
  const reasons=[];
  const dynasty=score(player,"dynasty_asset_score",0),impact=score(player,"championship_impact",0),ceiling=score(player,"ceiling_score",0),risk=score(player,"risk_score",100),confidence=score(player,"confidence_score",0),acq=score(player,"acquisition_opportunity",0);
  addReason(reasons,REASON_CODES.HIGH_DYNASTY_VALUE,dynasty>=62);
  addReason(reasons,REASON_CODES.HIGH_CHAMPIONSHIP_IMPACT,impact>=58);
  addReason(reasons,REASON_CODES.HIGH_ACQUISITION_OPPORTUNITY,acq>=58);
  addReason(reasons,REASON_CODES.POSITIONAL_NEED,Boolean(teamNeedFor(player,context)));
  addReason(reasons,REASON_CODES.LOW_CONFIDENCE,confidence<55);
  addReason(reasons,REASON_CODES.HIGH_RISK,risk>=70);
  addReason(reasons,REASON_CODES.INSUFFICIENT_DATA,confidence<45&&!Number(player.hkb_value));
  const prospect=String(player.playerStage||"").includes("PROSPECT");
  let type="WATCH";
  if(dynasty>=62&&acq>=58&&confidence>=55)type="ADD";
  else if(prospect&&ceiling>=58)type="STASH";
  else if(impact>=58&&risk<=65)type="ADD";
  else if(confidence<55)type="WATCH";
  const priority=dynasty*.32+impact*.20+ceiling*.20+acq*.18+(teamNeedFor(player,context)?8:0)-Math.max(0,risk-65)*.22;
  return rec({player,type,priority,reasons,context:{positionNeed:teamNeedFor(player,context),freeAgent:true}});
}
export function recommendRosterPlayer(player,context={}){
  const reasons=[];
  const dynasty=score(player,"dynasty_asset_score",0),impact=score(player,"championship_impact",0),ceiling=score(player,"ceiling_score",0),floor=score(player,"floor_score",0),risk=score(player,"risk_score",100),confidence=score(player,"confidence_score",0);
  const prospect=String(player.playerStage||"").includes("PROSPECT");
  const hkb=Number(player.hkb_value||0);
  const coreAsset=dynasty>=64||impact>=62||hkb>=1800||(dynasty>=60&&ceiling>=68)||(prospect&&dynasty>=58&&ceiling>=72);
  addReason(reasons,REASON_CODES.HIGH_DYNASTY_VALUE,dynasty>=68);
  addReason(reasons,REASON_CODES.HIGH_CHAMPIONSHIP_IMPACT,impact>=65);
  addReason(reasons,REASON_CODES.CORE_ASSET_PROTECTION,coreAsset);
  addReason(reasons,REASON_CODES.POSITIONAL_SURPLUS,Boolean(teamSurplusFor(player,context)));
  addReason(reasons,REASON_CODES.LOW_CONFIDENCE,confidence<55);
  addReason(reasons,REASON_CODES.HIGH_RISK,risk>=70);
  addReason(reasons,REASON_CODES.LOW_FLOOR,floor<42);
  addReason(reasons,REASON_CODES.UNCLASSIFIED_ROSTER_STATUS,String(player.roster_status||"").toUpperCase()==="UNCLASSIFIED");
  addReason(reasons,REASON_CODES.ROSTER_CRUNCH,context.rosterPressure?.activeOverTarget||context.rosterPressure?.reserveOverTarget||context.rosterPressure?.minorsOverTarget);
  let type="HOLD";
  if(coreAsset)type="HOLD";
  else if(teamSurplusFor(player,context)&&dynasty>=55)type="CONSOLIDATE";
  else if(risk>=75&&dynasty>=55)type="SHOP";
  else if(dynasty<44&&floor<42&&!prospect&&confidence>=55)type="DROP_CANDIDATE";
  else if(prospect&&ceiling>=58&&impact<55)type="PROMOTE";
  else if(confidence<50)type="NO_ACTION";
  const priority=dynasty*.25+impact*.20+ceiling*.18+(teamSurplusFor(player,context)?10:0)-Math.max(0,risk-70)*.15;
  return rec({player,type,priority,reasons,context:{positionSurplus:teamSurplusFor(player,context),rostered:true}});
}
export async function getRosterRecommendations(leagueId,teamId,options={}){
  const roster=await listPlayerIntelligence(leagueId,{page:1,pageSize:120,ownerTeamId:teamId,sort:"dynasty_asset_score",ascending:false,scoreVersion:options.scoreVersion});
  const freeAgents=await listPlayerIntelligence(leagueId,{page:1,pageSize:80,ownerTeamId:"FREE_AGENT",sort:"dynasty_asset_score",ascending:false,scoreVersion:roster.scoreVersion});
  const context=buildTeamContext(roster.rows,freeAgents.rows);
  const seen=new Set();
  const recommendations=roster.rows.map(player=>recommendRosterPlayer(player,context)).filter(item=>{
    if(seen.has(item.playerId))return false;
    seen.add(item.playerId);
    return true;
  });
  return {teamId,scoreVersion:roster.scoreVersion,decisionRuleVersion:DECISION_RULE_VERSION,context,recommendations};
}
export async function getWaiverRecommendations(leagueId,teamId,options={}){
  const roster=teamId?await listPlayerIntelligence(leagueId,{page:1,pageSize:120,ownerTeamId:teamId,sort:"dynasty_asset_score",ascending:false,scoreVersion:options.scoreVersion}):{rows:[],scoreVersion:options.scoreVersion};
  const query={page:options.page||1,pageSize:options.pageSize||50,ownerTeamId:"FREE_AGENT",sort:options.sort||"dynasty_asset_score",ascending:options.ascending===true,scoreVersion:roster.scoreVersion||options.scoreVersion,position:options.position,playerStage:options.playerStage,minDynastyAssetScore:options.minDynastyAssetScore,minChampionshipImpact:options.minChampionshipImpact,minCeiling:options.minCeiling,maxRisk:options.maxRisk,minConfidence:options.minConfidence,dataAvailability:options.dataAvailability,mlbTeam:options.mlbTeam};
  if(options.hasHkb)query.dataAvailability="hasHkb";
  if(options.hasStatcast)query.dataAvailability="hasStatcast";
  if(options.missingMlbam)query.dataAvailability="missingMlbam";
  const freeAgents=await listPlayerIntelligence(leagueId,query);
  const context=buildTeamContext(roster.rows,freeAgents.rows);
  let recommendations=freeAgents.rows.map(player=>recommendFreeAgent(player,context));
  if(options.recommendationType)recommendations=recommendations.filter(item=>item.recommendation===options.recommendationType);
  if(options.excludeLowInformation)recommendations=recommendations.filter(item=>!item.reasonCodes.includes(REASON_CODES.INSUFFICIENT_DATA));
  return {...freeAgents,teamId,decisionRuleVersion:DECISION_RULE_VERSION,context,recommendations};
}
export async function getPlayerRecommendation(playerId,teamId,options={}){
  const rows=await playerIntelligenceByIds(options.leagueId, [playerId], options.scoreVersion);
  const player=rows[0];
  if(!player)return null;
  return player.owner_team_id?recommendRosterPlayer(player,options.context||{}):recommendFreeAgent(player,options.context||{});
}
export async function findRosterUpgradeCandidates(teamId,freeAgentPlayerId,options={}){
  const leagueId=options.leagueId;
  const [freeAgent]=await playerIntelligenceByIds(leagueId,[freeAgentPlayerId],options.scoreVersion);
  const roster=await listPlayerIntelligence(leagueId,{page:1,pageSize:120,ownerTeamId:teamId,sort:"dynasty_asset_score",ascending:true,scoreVersion:freeAgent?.scoreVersion||options.scoreVersion});
  const candidates=roster.rows.filter(player=>hasPositionOverlap(player,freeAgent)).map(player=>{
    const dynastyDiff=score(freeAgent,"dynasty_asset_score",0)-score(player,"dynasty_asset_score",0);
    const impactDiff=score(freeAgent,"championship_impact",0)-score(player,"championship_impact",0);
    const ceilingDiff=score(freeAgent,"ceiling_score",0)-score(player,"ceiling_score",0);
    let upgradeType="no clear upgrade";
    if(impactDiff>=8)upgradeType="immediate upgrade";
    else if(dynastyDiff>=8||ceilingDiff>=10)upgradeType="long-term upgrade";
    else if(ceilingDiff>=6&&score(freeAgent,"confidence_score",0)<60)upgradeType="speculative upgrade";
    return {playerId:player.id,player,freeAgentId:freeAgent.id,upgradeType,deltas:{dynastyDiff,impactDiff,ceilingDiff,riskDiff:score(freeAgent,"risk_score",0)-score(player,"risk_score",0)},decisionRuleVersion:DECISION_RULE_VERSION};
  }).sort((a,b)=>b.deltas.dynastyDiff-a.deltas.dynastyDiff).slice(0,8);
  return {freeAgent,teamId,candidates,decisionRuleVersion:DECISION_RULE_VERSION};
}
