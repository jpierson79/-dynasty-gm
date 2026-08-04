import { buildTeamContext } from "./decisionIntelligenceService.js";
import { listManagers, managerPreferences } from "../repositories/managerRepository.js";
import { listTeams } from "../repositories/teamRepository.js";
import { listPlayerIntelligence, playerIntelligenceByIds, scoreValue } from "../repositories/playerIntelligenceRepository.js";

export const TRADE_ANALYSIS_VERSION="5.4.0";

export const TRADE_REASON_CODES=Object.freeze({
  MY_TEAM_VALUE_GAIN:"MY_TEAM_VALUE_GAIN",
  PARTNER_VALUE_GAIN:"PARTNER_VALUE_GAIN",
  BALANCED_VALUE:"BALANCED_VALUE",
  CONSOLIDATION_PREMIUM:"CONSOLIDATION_PREMIUM",
  ROSTER_SLOT_GAIN:"ROSTER_SLOT_GAIN",
  ROSTER_SLOT_LOSS:"ROSTER_SLOT_LOSS",
  POSITIONAL_NEED_FILLED:"POSITIONAL_NEED_FILLED",
  POSITIONAL_SURPLUS_SPENT:"POSITIONAL_SURPLUS_SPENT",
  LOW_CONFIDENCE:"LOW_CONFIDENCE",
  HIGH_RISK_INCOMING:"HIGH_RISK_INCOMING",
  MISSING_MANAGER_DATA:"MISSING_MANAGER_DATA",
  MANAGER_DATA_AVAILABLE:"MANAGER_DATA_AVAILABLE",
  INVALID_OUTGOING_OWNER:"INVALID_OUTGOING_OWNER",
  INVALID_INCOMING_OWNER:"INVALID_INCOMING_OWNER",
  DUPLICATE_ASSET:"DUPLICATE_ASSET",
  SAME_PLAYER_BOTH_SIDES:"SAME_PLAYER_BOTH_SIDES",
  MISSING_SCORE:"MISSING_SCORE",
  ROSTER_BASED_FIT_ONLY:"ROSTER_BASED_FIT_ONLY"
});

function clamp(value,min=0,max=100){
  const n=Number(value);
  if(!Number.isFinite(n))return min;
  return Math.max(min,Math.min(max,n));
}
function round(value){return Math.round(Number(value||0)*10)/10}
function positions(player){return Array.isArray(player?.positions)?player.positions:[]}
function score(player,key,fallback=50){
  const value=scoreValue(player,key);
  return value===null?fallback:value;
}
function avg(players,key,fallback=50){
  if(!players.length)return fallback;
  return players.reduce((sum,player)=>sum+score(player,key,fallback),0)/players.length;
}
function sum(players,key,fallback=50){return players.reduce((total,player)=>total+score(player,key,fallback),0)}
function best(players,key="dynasty_asset_score",fallback=0){return Math.max(0,...players.map(player=>score(player,key,fallback)))}
function playerStage(player){return String(player?.playerStage||player?.score?.explanation?.metadata?.player_stage||"UNKNOWN")}
function uniqueIds(ids=[]){return [...new Set(ids.filter(Boolean))]}
function addReason(list,code,condition){if(condition&&!list.includes(code))list.push(code)}
function orderedPlayers(players){
  return players.slice().sort((a,b)=>{
    const diff=score(b,"dynasty_asset_score",0)-score(a,"dynasty_asset_score",0);
    return diff||String(a.id).localeCompare(String(b.id));
  });
}

export function validateTradeAssets({userTeamId,partnerTeamId,outgoingPlayers=[],incomingPlayers=[]}){
  const warnings=[];
  const outgoingIds=outgoingPlayers.map(player=>player.id).filter(Boolean);
  const incomingIds=incomingPlayers.map(player=>player.id).filter(Boolean);
  const allIds=[...outgoingIds,...incomingIds];
  const duplicates=allIds.filter((id,index)=>allIds.indexOf(id)!==index);
  duplicates.forEach(playerId=>warnings.push({code:TRADE_REASON_CODES.DUPLICATE_ASSET,playerId,message:"A player appears more than once in this proposal."}));
  outgoingIds.filter(id=>incomingIds.includes(id)).forEach(playerId=>warnings.push({code:TRADE_REASON_CODES.SAME_PLAYER_BOTH_SIDES,playerId,message:"A player cannot be on both sides of one trade."}));
  outgoingPlayers.filter(player=>player.owner_team_id!==userTeamId).forEach(player=>warnings.push({code:TRADE_REASON_CODES.INVALID_OUTGOING_OWNER,playerId:player.id,message:"Outgoing player is not owned by My Team."}));
  incomingPlayers.filter(player=>player.owner_team_id!==partnerTeamId).forEach(player=>warnings.push({code:TRADE_REASON_CODES.INVALID_INCOMING_OWNER,playerId:player.id,message:"Incoming player is not owned by the selected partner."}));
  [...outgoingPlayers,...incomingPlayers].filter(player=>!player.score||scoreValue(player,"dynasty_asset_score")===null).forEach(player=>warnings.push({code:TRADE_REASON_CODES.MISSING_SCORE,playerId:player.id,message:"Player is missing stored score data."}));
  return warnings;
}

export function packageValue(players=[],context={},direction={sends:0,receives:0}){
  const sorted=orderedPlayers(players);
  // V5.4 package weights: best asset 1.35x, then 0.72/0.48/0.32/0.22 for depth,
  // with separate present/future blends, roster-slot value, positional fit, risk,
  // and confidence penalties. Future calibration should change this function only.
  const weights=[1.35,.72,.48,.32,.22];
  const weightedAsset=sorted.reduce((total,player,index)=>total+score(player,"dynasty_asset_score",50)*(weights[index]||.16),0);
  const rawAssetValue=sum(sorted,"dynasty_asset_score",50);
  const presentValue=avg(sorted,"championship_impact",50)*.42+avg(sorted,"floor_score",50)*.22+avg(sorted,"league_fit",50)*.16+avg(sorted,"trade_liquidity",50)*.10+avg(sorted,"confidence_score",50)*.10;
  const futureValue=avg(sorted,"dynasty_asset_score",50)*.30+avg(sorted,"ceiling_score",50)*.26+avg(sorted,"market_appreciation",50)*.20+avg(sorted,"breakout_probability",50)*.16+avg(sorted,"risk_score",50)*-.08+8;
  const positionNeedBonus=sorted.reduce((bonus,player)=>bonus+positions(player).filter(pos=>(context.positionWeakness||[]).includes(pos)).length*3.5,0);
  const positionSurplusPenalty=sorted.reduce((penalty,player)=>penalty+positions(player).filter(pos=>(context.positionSurplus||[]).includes(pos)).length*2.4,0);
  const rosterSlotDelta=Number(direction.sends||0)-Number(direction.receives||0);
  const rosterSlotValue=rosterSlotDelta>0?rosterSlotDelta*4:rosterSlotDelta*2.5;
  const consolidationPremium=sorted.length===1&&Number(direction.sends||0)>Number(direction.receives||0)&&best(sorted)>=65?Math.min(14,6+best(sorted)*.08):0;
  const diminishingPenalty=Math.max(0,sorted.length-2)*2.2+Math.max(0,rawAssetValue-weightedAsset)*.05;
  const riskPenalty=Math.max(0,avg(sorted,"risk_score",50)-60)*.22;
  const confidencePenalty=Math.max(0,58-avg(sorted,"confidence_score",55))*.32;
  const uncertaintyPenalty=riskPenalty+confidencePenalty;
  const total=weightedAsset*.54+presentValue*.19+futureValue*.19+positionNeedBonus-positionSurplusPenalty+rosterSlotValue+consolidationPremium-diminishingPenalty-riskPenalty-confidencePenalty;
  return {
    playerCount:sorted.length,
    rawAssetValue:round(rawAssetValue),
    adjustedPackageValue:round(total),
    totalPackageValue:round(total),
    weightedAssetValue:round(weightedAsset),
    bestAssetScore:round(best(sorted)),
    presentValue:round(presentValue),
    futureValue:round(futureValue),
    championshipImpact:round(avg(sorted,"championship_impact",50)),
    ceiling:round(avg(sorted,"ceiling_score",50)),
    floor:round(avg(sorted,"floor_score",50)),
    risk:round(avg(sorted,"risk_score",50)),
    liquidity:round(avg(sorted,"trade_liquidity",50)),
    confidence:round(avg(sorted,"confidence_score",55)),
    portfolioFit:round(avg(sorted,"portfolio_fit",50)),
    leagueFit:round(avg(sorted,"league_fit",50)),
    rosterSlotValue:round(rosterSlotValue),
    rosterSlotBenefit:round(rosterSlotValue),
    consolidationPremium:round(consolidationPremium),
    diminishingPenalty:round(diminishingPenalty),
    depthRedundancyPenalty:round(diminishingPenalty+positionSurplusPenalty),
    uncertaintyPenalty:round(uncertaintyPenalty),
    positionNeedBonus:round(positionNeedBonus),
    positionSurplusPenalty:round(positionSurplusPenalty)
  };
}

function applyRosterChange(rosterRows=[],removePlayers=[],addPlayers=[]){
  const removeIds=new Set(removePlayers.map(player=>player.id));
  return [...rosterRows.filter(player=>!removeIds.has(player.id)),...addPlayers];
}
function deltaMetric(incoming,outgoing,key){return round(incoming[key]-outgoing[key])}
function headlineFor(net,confidence,warnings=[]){
  if(warnings.some(warning=>["INVALID_OUTGOING_OWNER","INVALID_INCOMING_OWNER","DUPLICATE_ASSET","SAME_PLAYER_BOTH_SIDES","MISSING_SCORE"].includes(warning.code)))return"Too Uncertain";
  if(confidence<45)return"Too Uncertain";
  if(net>=6)return"Leans toward My Team";
  if(net<=-6)return"Leans toward Partner";
  return"Approximately Balanced";
}
function reasonExplanation(code){
  const text={
    MY_TEAM_VALUE_GAIN:"The incoming package grades higher for My Team after package, roster, and confidence adjustments.",
    PARTNER_VALUE_GAIN:"The outgoing package grades higher than the incoming return.",
    BALANCED_VALUE:"The adjusted values are close enough to treat this as balanced.",
    CONSOLIDATION_PREMIUM:"The side receiving fewer, stronger assets gets an elite-player consolidation premium.",
    ROSTER_SLOT_GAIN:"My Team opens usable roster space in the deal.",
    ROSTER_SLOT_LOSS:"My Team loses roster flexibility by taking on more players.",
    POSITIONAL_NEED_FILLED:"The incoming players address a position that looks thin on My Team.",
    POSITIONAL_SURPLUS_SPENT:"The outgoing side draws from a position that looks deep on My Team.",
    LOW_CONFIDENCE:"One or more selected assets has low score confidence.",
    HIGH_RISK_INCOMING:"The incoming package carries elevated player risk.",
    MISSING_MANAGER_DATA:"Manager intelligence was not available, so fit is roster-based only.",
    MANAGER_DATA_AVAILABLE:"Manager intelligence rows exist and can inform fit labels.",
    INVALID_OUTGOING_OWNER:"At least one outgoing player is not owned by My Team.",
    INVALID_INCOMING_OWNER:"At least one incoming player is not owned by the selected partner.",
    DUPLICATE_ASSET:"A selected player appears more than once.",
    SAME_PLAYER_BOTH_SIDES:"A selected player appears on both sides.",
    MISSING_SCORE:"A selected player is missing stored score data.",
    ROSTER_BASED_FIT_ONLY:"This fit uses roster needs and surplus because manager data is absent."
  };
  return text[code]||code;
}
function explain(codes){
  return codes.map(code=>({code,text:reasonExplanation(code)}));
}
function managerForTeam(managerRows=[],team={}){
  return managerRows.find(manager=>manager.id&&manager.id===team.manager_id)||managerRows.find(manager=>String(manager.team_name||"").trim().toLowerCase()===String(team.name||"").trim().toLowerCase())||null;
}
function managerEvidence(manager,preferences=[],player){
  if(!manager)return {available:false,evidence:[],inference:[],preferences:[]};
  const playerPrefs=preferences.filter(pref=>(pref.manager_id===manager.id)&&(pref.player_id===player?.id||String(pref.player_name||"").trim().toLowerCase()===String(player?.name||"").trim().toLowerCase()));
  const evidence=[
    manager.competitive_window?`Competitive window: ${manager.competitive_window}`:"",
    manager.trade_style?`Trade style: ${manager.trade_style}`:"",
    manager.hkb_reliance?`HKB reliance: ${manager.hkb_reliance}`:"",
    Array.isArray(manager.preferred_player_types)&&manager.preferred_player_types.length?`Preferred types: ${manager.preferred_player_types.join(", ")}`:"",
    Array.isArray(manager.favorite_mlb_teams)&&manager.favorite_mlb_teams.length?`Favorite MLB teams: ${manager.favorite_mlb_teams.join(", ")}`:"",
    manager.negotiation_notes?`Negotiation notes available`:""
  ].filter(Boolean);
  const preferenceEvidence=playerPrefs.map(pref=>`${pref.preference_type} ${pref.strength}/5${pref.notes?`: ${pref.notes}`:""}`);
  return {
    available:true,
    managerId:manager.id,
    managerName:manager.manager_name||manager.team_name||"",
    rosterDerivedEvidence:[],
    managerDerivedEvidence:evidence,
    modelInference:["Manager evidence can adjust fit confidence, but stored player scores remain authoritative."],
    preferences:preferenceEvidence
  };
}
async function rosterContext(leagueId,teamId,scoreVersion){
  if(!teamId)return {rows:[],context:buildTeamContext([],[]),scoreVersion};
  const roster=await listPlayerIntelligence(leagueId,{page:1,pageSize:120,ownerTeamId:teamId,sort:"dynasty_asset_score",ascending:false,scoreVersion});
  return {rows:roster.rows,context:buildTeamContext(roster.rows,[]),scoreVersion:roster.scoreVersion};
}

export async function analyzeTrade({leagueId,userTeamId,partnerTeamId,outgoingPlayerIds=[],incomingPlayerIds=[],scoreVersion,options={}}){
  const ids=uniqueIds([...outgoingPlayerIds,...incomingPlayerIds]);
  const players=await playerIntelligenceByIds(leagueId,ids,scoreVersion);
  const byId=new Map(players.map(player=>[player.id,player]));
  const outgoingPlayers=outgoingPlayerIds.map(id=>byId.get(id)).filter(Boolean);
  const incomingPlayers=incomingPlayerIds.map(id=>byId.get(id)).filter(Boolean);
  const [userRoster,partnerRoster,managerRows,teamRows,prefRows]=await Promise.all([
    rosterContext(leagueId,userTeamId,scoreVersion),
    rosterContext(leagueId,partnerTeamId,scoreVersion),
    listManagers(leagueId).catch(()=>[]),
    listTeams(leagueId).catch(()=>[]),
    managerPreferences(leagueId).catch(()=>[])
  ]);
  const warnings=validateTradeAssets({userTeamId,partnerTeamId,outgoingPlayers,incomingPlayers});
  outgoingPlayerIds.filter(id=>!byId.has(id)).forEach(playerId=>warnings.push({code:TRADE_REASON_CODES.MISSING_SCORE,playerId,message:"Selected outgoing player was not found in stored scores."}));
  incomingPlayerIds.filter(id=>!byId.has(id)).forEach(playerId=>warnings.push({code:TRADE_REASON_CODES.MISSING_SCORE,playerId,message:"Selected incoming player was not found in stored scores."}));
  const managerAvailable=managerRows.length>0;
  const partnerTeam=teamRows.find(team=>team.id===partnerTeamId)||{};
  const partnerManager=managerForTeam(managerRows,partnerTeam);
  const partnerManagerEvidence=incomingPlayers.map(player=>({playerId:player.id,...managerEvidence(partnerManager,prefRows,player)}));
  const outgoing=packageValue(outgoingPlayers,userRoster.context,{sends:incomingPlayers.length,receives:outgoingPlayers.length});
  const incoming=packageValue(incomingPlayers,userRoster.context,{sends:outgoingPlayers.length,receives:incomingPlayers.length});
  const net=round(incoming.totalPackageValue-outgoing.totalPackageValue);
  const confidence=round(Math.max(10,Math.min(100,(incoming.confidence+outgoing.confidence)/2-warnings.length*12)));
  const reasonCodes=[];
  addReason(reasonCodes,TRADE_REASON_CODES.MY_TEAM_VALUE_GAIN,net>=6);
  addReason(reasonCodes,TRADE_REASON_CODES.PARTNER_VALUE_GAIN,net<=-6);
  addReason(reasonCodes,TRADE_REASON_CODES.BALANCED_VALUE,Math.abs(net)<6);
  addReason(reasonCodes,TRADE_REASON_CODES.CONSOLIDATION_PREMIUM,outgoingPlayers.length>incomingPlayers.length&&incoming.consolidationPremium>0);
  addReason(reasonCodes,TRADE_REASON_CODES.ROSTER_SLOT_GAIN,outgoingPlayers.length>incomingPlayers.length);
  addReason(reasonCodes,TRADE_REASON_CODES.ROSTER_SLOT_LOSS,outgoingPlayers.length<incomingPlayers.length);
  addReason(reasonCodes,TRADE_REASON_CODES.POSITIONAL_NEED_FILLED,incoming.positionNeedBonus>0);
  addReason(reasonCodes,TRADE_REASON_CODES.POSITIONAL_SURPLUS_SPENT,outgoing.positionSurplusPenalty>0);
  addReason(reasonCodes,TRADE_REASON_CODES.LOW_CONFIDENCE,confidence<55);
  addReason(reasonCodes,TRADE_REASON_CODES.HIGH_RISK_INCOMING,incoming.risk>=68);
  addReason(reasonCodes,managerAvailable?TRADE_REASON_CODES.MANAGER_DATA_AVAILABLE:TRADE_REASON_CODES.MISSING_MANAGER_DATA,true);
  warnings.forEach(warning=>addReason(reasonCodes,warning.code,true));
  const userAfter=buildTeamContext(applyRosterChange(userRoster.rows,outgoingPlayers,incomingPlayers),[]);
  const partnerAfter=buildTeamContext(applyRosterChange(partnerRoster.rows,incomingPlayers,outgoingPlayers),[]);
  const missingDataWarnings=warnings.filter(warning=>warning.code===TRADE_REASON_CODES.MISSING_SCORE);
  return {
    tradeAnalysisVersion:TRADE_ANALYSIS_VERSION,
    scoreVersion:scoreVersion||userRoster.scoreVersion||partnerRoster.scoreVersion||players[0]?.scoreVersion||"",
    leagueId,
    userTeamId,
    partnerTeamId,
    outgoingAssets:outgoingPlayers,
    incomingAssets:incomingPlayers,
    teamContextBeforeTrade:userRoster.context,
    teamContextAfterTrade:userAfter,
    partnerContextBeforeTrade:partnerRoster.context,
    partnerContextAfterTrade:partnerAfter,
    teamContexts:{myTeam:{before:userRoster.context,after:userAfter},partner:{before:partnerRoster.context,after:partnerAfter}},
    valueSummary:{
      headline:headlineFor(net,confidence,warnings),
      netValue:net,
      outgoing,
      incoming,
      deltas:{
        present:deltaMetric(incoming,outgoing,"presentValue"),
        future:deltaMetric(incoming,outgoing,"futureValue"),
        championship:deltaMetric(incoming,outgoing,"championshipImpact"),
        ceiling:deltaMetric(incoming,outgoing,"ceiling"),
        floor:deltaMetric(incoming,outgoing,"floor"),
        risk:round(incoming.risk-outgoing.risk),
        liquidity:deltaMetric(incoming,outgoing,"liquidity"),
        roster:round(incoming.rosterSlotValue-outgoing.rosterSlotValue),
        position:round(incoming.positionNeedBonus-outgoing.positionSurplusPenalty),
        portfolio:deltaMetric(incoming,outgoing,"portfolioFit"),
        league:deltaMetric(incoming,outgoing,"leagueFit"),
        confidence:confidence
      }
    },
    confidence,
    reasonCodes,
    cautions:reasonCodes.filter(code=>["LOW_CONFIDENCE","HIGH_RISK_INCOMING","MISSING_MANAGER_DATA","INVALID_OUTGOING_OWNER","INVALID_INCOMING_OWNER","DUPLICATE_ASSET","SAME_PLAYER_BOTH_SIDES","MISSING_SCORE"].includes(code)),
    warnings,
    missingDataWarnings,
    explanation:explain(reasonCodes),
    explanationMetadata:{
      rosterDerivedEvidence:{
        myTeamWeakness:userRoster.context.positionWeakness||[],
        myTeamSurplus:userRoster.context.positionSurplus||[],
        partnerWeakness:partnerRoster.context.positionWeakness||[],
        partnerSurplus:partnerRoster.context.positionSurplus||[]
      },
      managerDerivedEvidence:partnerManagerEvidence,
      modelInference:["Package value is derived from stored V5 scores, roster construction, risk, confidence, and bounded team context."]
    },
    options
  };
}

export async function findConsolidationTargets({leagueId,teamId,outgoingPlayerIds=[],targetTeamId="",options={}}){
  const outgoing=await playerIntelligenceByIds(leagueId,uniqueIds(outgoingPlayerIds),options.scoreVersion);
  const teamRoster=await rosterContext(leagueId,teamId,outgoing[0]?.scoreVersion||options.scoreVersion);
  const packageScore=packageValue(outgoing,teamRoster.context,{sends:outgoing.length,receives:1});
  const query={page:1,pageSize:options.pageSize||80,sort:"dynasty_asset_score",ascending:false,scoreVersion:outgoing[0]?.scoreVersion||options.scoreVersion,rosteredOnly:!targetTeamId,ownerTeamId:targetTeamId||""};
  const candidates=await listPlayerIntelligence(leagueId,query);
  const bestOutgoing=best(outgoing);
  const rows=candidates.rows.filter(player=>player.owner_team_id&&player.owner_team_id!==teamId&&!outgoingPlayerIds.includes(player.id)&&score(player,"dynasty_asset_score",0)>bestOutgoing)
    .map(player=>{
      const targetValue=packageValue([player],teamRoster.context,{sends:outgoing.length,receives:1});
      const gap=round(targetValue.totalPackageValue-packageScore.totalPackageValue);
      const confidence=round(Math.max(10,Math.min(100,(packageScore.confidence+targetValue.confidence)/2-Math.max(0,Math.abs(gap)-16)*.8)));
      const reasonCodes=[TRADE_REASON_CODES.CONSOLIDATION_PREMIUM,TRADE_REASON_CODES.ROSTER_SLOT_GAIN];
      if(targetValue.positionNeedBonus>0)reasonCodes.push(TRADE_REASON_CODES.POSITIONAL_NEED_FILLED);
      if(confidence<55)reasonCodes.push(TRADE_REASON_CODES.LOW_CONFIDENCE);
      return {
        targetPlayerId:player.id,
        targetPlayer:player,
        targetTeamId:player.owner_team_id,
        packageFit:round(100-Math.min(70,Math.abs(gap)*2)+targetValue.consolidationPremium),
        valueGap:gap,
        whyPartnerMight:"The outgoing package adds multiple scored assets and depth while preserving UUID-based player identity.",
        whyUserMight:"The target concentrates value into a stronger single asset and opens roster space.",
        rosterSpace:outgoing.length-1,
        risk:targetValue.risk,
        confidence,
        suggestedOutgoingPackage:outgoing.map(player=>({id:player.id,name:player.name,dynasty:score(player,"dynasty_asset_score",0)})),
        reasonCodes,
        explanation:explain(reasonCodes)
      };
    }).sort((a,b)=>b.packageFit-a.packageFit||String(a.targetPlayerId).localeCompare(String(b.targetPlayerId))).slice(0,12);
  return {tradeAnalysisVersion:TRADE_ANALYSIS_VERSION,teamId,scoreVersion:candidates.scoreVersion||outgoing[0]?.scoreVersion||"",outgoingAssets:outgoing,packageScore,targets:rows};
}

export async function findTradeFits({leagueId,teamId,playerId,options={}}){
  const [player]=await playerIntelligenceByIds(leagueId,[playerId],options.scoreVersion);
  if(!player)return {tradeAnalysisVersion:TRADE_ANALYSIS_VERSION,teamId,playerId,fits:[],warnings:[{code:TRADE_REASON_CODES.MISSING_SCORE,message:"Player was not found in stored scores."}]};
  const [teams,managers,prefRows]=await Promise.all([listTeams(leagueId),listManagers(leagueId).catch(()=>[]),managerPreferences(leagueId).catch(()=>[])]);
  const managerAvailable=managers.length>0;
  const fits=[];
  for(const team of teams.filter(row=>row.id!==teamId).slice(0,12)){
    const roster=await listPlayerIntelligence(leagueId,{page:1,pageSize:80,ownerTeamId:team.id,sort:"dynasty_asset_score",ascending:false,scoreVersion:player.scoreVersion||options.scoreVersion});
    const context=buildTeamContext(roster.rows,[]);
    const manager=managerForTeam(managers,team);
    const evidence=managerEvidence(manager,prefRows,player);
    const need=positions(player).filter(pos=>context.positionWeakness.includes(pos));
    const surplus=positions(player).filter(pos=>context.positionSurplus.includes(pos));
    const positionFit=need.length?72:surplus.length?38:55;
    const managerFitBonus=evidence.preferences.length?6:evidence.available?2:0;
    const scoreFit=score(player,"championship_impact",50)*.24+score(player,"dynasty_asset_score",50)*.28+score(player,"trade_liquidity",50)*.18+score(player,"confidence_score",50)*.12+positionFit*.18+managerFitBonus;
    fits.push({
      teamId:team.id,
      teamName:team.name,
      fitScore:round(scoreFit),
      reasonCodes:[need.length?TRADE_REASON_CODES.POSITIONAL_NEED_FILLED:TRADE_REASON_CODES.ROSTER_BASED_FIT_ONLY,managerAvailable?TRADE_REASON_CODES.MANAGER_DATA_AVAILABLE:TRADE_REASON_CODES.MISSING_MANAGER_DATA],
      fitBasis:managerAvailable?"Roster context plus available manager intelligence":"Roster-based fit only",
      positionNeed:need.join("/")||"",
      positionSurplus:surplus.join("/")||"",
      likelyOutgoingNeeds:context.positionWeakness.join("/")||"Best available scored assets",
      confidence:round(clamp(score(player,"confidence_score",50)-(managerAvailable?0:8)+(evidence.preferences.length?4:0),10,100)),
      evidence:{rosterDerivedEvidence:[need.length?`Needs ${need.join("/")}`:"No direct positional need",surplus.length?`Has surplus ${surplus.join("/")}`:"No direct positional surplus"].filter(Boolean),managerDerivedEvidence:evidence.managerDerivedEvidence,modelInference:evidence.modelInference,preferences:evidence.preferences},
      missingManagerDataWarning:managerAvailable&&!evidence.available?"No manager row linked to this team.":managerAvailable?"":"No manager rows were available.",
      explanation:managerAvailable?`Manager rows exist for the league. ${team.name} fit is anchored to roster need, stored scores, and any linked manager evidence.`:`No manager rows were available; ${team.name} is labeled from roster need and surplus only.`
    });
  }
  fits.sort((a,b)=>b.fitScore-a.fitScore||String(a.teamId).localeCompare(String(b.teamId)));
  return {tradeAnalysisVersion:TRADE_ANALYSIS_VERSION,teamId,playerId,player,scoreVersion:player.scoreVersion||options.scoreVersion,fits:fits.slice(0,10)};
}
