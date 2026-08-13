import { buildPlayerIdentityIndex, playerIdentityResult, unwrapStoredFantraxId } from "./fantraxPublicPreviewService.js";
import { canonicalFantraxSeasonContext } from "./fantraxSeasonContextService.js";

export const FANTRAX_PRODUCTION_SOURCE="Fantrax";
export const FANTRAX_PRODUCTION_METRIC_TYPE="fantrax_league_production";
export const FANTRAX_PLAYERS_HEADER=Object.freeze(["ID","Player","Team","Position","RkOv","Status","Age","Opponent","FPts","FP/G","Drafted","ADP","Ros","+/-","Act","+/-"]);
export const FANTRAX_PLAYERS_RAW_ALIASES=Object.freeze(["id","player","team","position","rankOverall","status","age","opponent","fantasyPoints","fantasyPointsPerGame","drafted","adp","rawRos","rawRosDelta","rawAct","rawActDelta","rawUnlabeled16","rawUnlabeled17"]);

const clean=value=>String(value??"").trim();
const sameHeader=header=>Array.isArray(header)&&header.length===FANTRAX_PLAYERS_HEADER.length&&header.every((value,index)=>clean(value)===FANTRAX_PLAYERS_HEADER[index]);
const numeric=value=>{const text=clean(value);if(!text)return null;const parsed=Number(text.replace(/,/g,""));return Number.isFinite(parsed)?parsed:null};
const positions=value=>[...new Set(clean(value).split(",").map(item=>item.trim().toUpperCase()).filter(Boolean))];
export function classifyFantraxProductionStatus(value){
  const raw=clean(value),text=raw.replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim();
  if(raw==="FA")return {raw,classification:"FA",ownerTeamId:null};
  if(/^W(?:\s|$)/i.test(text))return {raw,classification:"WAIVER_STATE",ownerTeamId:null};
  if(/^[A-Za-z0-9][A-Za-z0-9 _.-]*$/.test(raw))return {raw,classification:"ROSTERED_TEAM_TOKEN",ownerTeamId:null};
  return {raw,classification:"UNKNOWN",ownerTeamId:null};
}
export function normalizeFantraxPlayersRawRow(row){
  if(!Array.isArray(row)||row.length!==FANTRAX_PLAYERS_RAW_ALIASES.length)return {valid:false,error:"UNEXPECTED_ROW_ARITY",expected:18,actual:Array.isArray(row)?row.length:null,rawValues:Array.isArray(row)?[...row]:[]};
  return {valid:true,rawValues:[...row],raw:Object.fromEntries(FANTRAX_PLAYERS_RAW_ALIASES.map((key,index)=>[key,row[index]]))};
}
function reviewedContext(league){
  const context=canonicalFantraxSeasonContext(league?.settings?.fantraxSeasonContext||{});
  return league?.id&&context.valid?context:null;
}
export function previewFantraxPlayerProduction({league,header,rows=[],players=[],sourceFilename=null,sourceJobId=null,importedAt=new Date().toISOString()}={}){
  if(!league?.id)throw new Error("Active league is required.");
  if(!sameHeader(header))throw new Error("Fantrax Players header does not match the reviewed 16-column schema.");
  const context=reviewedContext(league),identityIndex=buildPlayerIdentityIndex(players),sourceIds=new Map();
  const records=[],invalidRows=[],identityFailures=[];
  rows.forEach((row,rowIndex)=>{
    const normalized=normalizeFantraxPlayersRawRow(row);
    if(!normalized.valid){invalidRows.push({rowIndex:rowIndex+2,...normalized});return}
    const raw=normalized.raw,fantraxId=unwrapStoredFantraxId(raw.id)||clean(raw.id);
    sourceIds.set(fantraxId,(sourceIds.get(fantraxId)||0)+1);
    const identity=playerIdentityResult(fantraxId,identityIndex);
    if(identity.identityResult!=="MATCHED")identityFailures.push({rowIndex:rowIndex+2,fantraxId,playerName:clean(raw.player),...identity});
    const fantasyPoints=numeric(raw.fantasyPoints),fantasyPointsPerGame=numeric(raw.fantasyPointsPerGame),warnings=[];
    if(clean(raw.fantasyPoints)&&fantasyPoints===null)warnings.push("INVALID_FANTASY_POINTS");
    if(clean(raw.fantasyPointsPerGame)&&fantasyPointsPerGame===null)warnings.push("INVALID_FANTASY_POINTS_PER_GAME");
    if(!context)warnings.push("SEASON_CONTEXT_UNAVAILABLE");
    if(identity.identityResult!=="MATCHED")warnings.push(`IDENTITY_${identity.identityResult}`);
    const status=!context||identity.identityResult!=="MATCHED"||warnings.some(item=>item.startsWith("INVALID_"))?"UNAVAILABLE":fantasyPoints===null?"MISSING":"AVAILABLE";
    records.push({schema:"fantrax-league-production-v1",playerId:identity.matchedPlayerUuid||null,leagueId:league.id,season:context?.seasonYear??null,fantraxId,playerName:clean(raw.player)||null,fantasyPoints,fantasyPointsPerGame,positionEligibility:positions(raw.position),statusEvidence:classifyFantraxProductionStatus(raw.status),source:FANTRAX_PRODUCTION_SOURCE,sourceFilename,sourceJobId,importedAt,freshness:{status:context?"AVAILABLE":"UNAVAILABLE",importedAt,season:context?.seasonYear??null},status,warnings,raw:normalized.raw,rawValues:normalized.rawValues});
  });
  const duplicateSourceIds=[...sourceIds.entries()].filter(([id,count])=>id&&count>1).map(([fantraxId,count])=>({fantraxId,count}));
  if(duplicateSourceIds.length){const duplicates=new Set(duplicateSourceIds.map(item=>item.fantraxId));records.forEach(record=>{if(duplicates.has(record.fantraxId)){record.status="UNAVAILABLE";record.warnings.push("DUPLICATE_SOURCE_FANTRAX_ID")}})}
  return {schema:"fantrax-player-production-preview-v1",writePerformed:false,leagueId:league.id,seasonContext:context,sourceFilename,sourceJobId,importedAt,schemaEvidence:{headerCount:header.length,rowCountExpected:18,headerRowArityMismatch:"REVIEWED_ACCEPTABLE",aliases:[...FANTRAX_PLAYERS_RAW_ALIASES]},counts:{total:rows.length,available:records.filter(row=>row.status==="AVAILABLE").length,matched:records.filter(row=>row.playerId).length,identityFailures:identityFailures.length,invalidRows:invalidRows.length,duplicateSourceIds:duplicateSourceIds.length},records,invalidRows,identityFailures,duplicateSourceIds,warnings:["REVIEWED_HEADER_ROW_ARITY_MISMATCH","RAW_COLUMNS_12_TO_17_NOT_USED_FOR_PLAYER_INTELLIGENCE"]};
}
export function fantraxProductionMetricRow(record){
  if(record?.status!=="AVAILABLE"||!record.playerId||!record.leagueId||!record.season)throw new Error("Only an available, exactly identified production record can become a metric row.");
  return {league_id:record.leagueId,player_id:record.playerId,source:FANTRAX_PRODUCTION_SOURCE,season:record.season,metric_type:FANTRAX_PRODUCTION_METRIC_TYPE,imported_at:record.importedAt,metrics:{fantasyPoints:record.fantasyPoints,fantasyPointsPerGame:record.fantasyPointsPerGame,fantraxId:record.fantraxId,positionEligibility:record.positionEligibility,statusEvidence:record.statusEvidence,_fantraxProduction:{sourceFilename:record.sourceFilename,sourceJobId:record.sourceJobId,importedAt:record.importedAt,freshness:record.freshness,status:record.status,warnings:record.warnings}}};
}
