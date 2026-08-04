import { numberValue } from "./math.js";

export const PLAYER_STAGES=Object.freeze({
  MLB_ESTABLISHED:"MLB_ESTABLISHED",
  MLB_EMERGING:"MLB_EMERGING",
  MLB_ROLE_PLAYER:"MLB_ROLE_PLAYER",
  PROSPECT_NEAR_MLB:"PROSPECT_NEAR_MLB",
  PROSPECT_DEVELOPMENTAL:"PROSPECT_DEVELOPMENTAL",
  RELIEVER:"RELIEVER",
  UNKNOWN:"UNKNOWN"
});

function positions(player){
  return Array.isArray(player?.positions)?player.positions.map(pos=>String(pos||"").toUpperCase()):String(player?.positions||"").split(/[\/,\s]+/).map(pos=>pos.toUpperCase());
}

function hasMetricEvidence(metrics={}){
  return Object.keys(metrics||{}).some(key=>Number.isFinite(Number(metrics[key])));
}

function isMinorStatus(player){
  return ["MINORS","MINOR","MILB","NA","FARM"].includes(String(player?.roster_status||"").toUpperCase());
}

export function classifyPlayerStage({player,metrics={}}={}){
  const pos=positions(player);
  const age=numberValue(player?.age,0);
  const hkb=numberValue(player?.hkb_value,0);
  const hasMlbTeam=Boolean(player?.mlb_team||player?.team||player?.org);
  const hasMetrics=hasMetricEvidence(metrics);
  const isOwned=Boolean(player?.owner_team_id);
  const minor=isMinorStatus(player);
  const reliever=pos.includes("RP")&&!pos.includes("SP");
  if(reliever)return PLAYER_STAGES.RELIEVER;
  if(!age&&!hasMetrics&&!hkb)return PLAYER_STAGES.UNKNOWN;
  if((minor||!hasMetrics)&&(age&&age<=23)){
    return hkb>=900||isOwned||hasMlbTeam?PLAYER_STAGES.PROSPECT_NEAR_MLB:PLAYER_STAGES.PROSPECT_DEVELOPMENTAL;
  }
  if(hasMetrics&&age&&age<=27)return PLAYER_STAGES.MLB_EMERGING;
  if(hasMetrics&&age>=28)return PLAYER_STAGES.MLB_ESTABLISHED;
  if(hasMlbTeam||isOwned){
    if(age&&age<=25&&hkb>=600)return PLAYER_STAGES.PROSPECT_NEAR_MLB;
    return PLAYER_STAGES.MLB_ROLE_PLAYER;
  }
  if(age&&age<=23)return PLAYER_STAGES.PROSPECT_DEVELOPMENTAL;
  return PLAYER_STAGES.UNKNOWN;
}

export function stageScore(stage,kind="current"){
  const table={
    current:{MLB_ESTABLISHED:86,MLB_EMERGING:74,MLB_ROLE_PLAYER:52,PROSPECT_NEAR_MLB:42,PROSPECT_DEVELOPMENTAL:26,RELIEVER:46,UNKNOWN:38},
    floor:{MLB_ESTABLISHED:82,MLB_EMERGING:66,MLB_ROLE_PLAYER:54,PROSPECT_NEAR_MLB:34,PROSPECT_DEVELOPMENTAL:20,RELIEVER:45,UNKNOWN:35},
    ceiling:{MLB_ESTABLISHED:76,MLB_EMERGING:82,MLB_ROLE_PLAYER:58,PROSPECT_NEAR_MLB:80,PROSPECT_DEVELOPMENTAL:68,RELIEVER:55,UNKNOWN:45},
    liquidity:{MLB_ESTABLISHED:78,MLB_EMERGING:76,MLB_ROLE_PLAYER:48,PROSPECT_NEAR_MLB:72,PROSPECT_DEVELOPMENTAL:52,RELIEVER:42,UNKNOWN:36}
  };
  return table[kind]?.[stage]??50;
}

export default classifyPlayerStage;
