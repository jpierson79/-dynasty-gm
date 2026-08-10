import { client } from "../repositories/baseRepository.js";
import {canonicalFantraxSeasonContext,compareFantraxSeasonContexts} from "./fantraxSeasonContextService.js";

export const FANTRAX_PREVIEW_OPERATIONS=["league-info","team-rosters","matchup-scores","standings","draft-picks","draft-results"];
export const FANTRAX_PREVIEW_VERSION="5.4.5";

const clean=value=>String(value??"").trim();
const same=(a,b)=>clean(a)===clean(b);
const upper=value=>clean(value).toUpperCase();
const normalizeName=value=>upper(value).replace(/&/g," AND ").replace(/[^A-Z0-9]+/g," ").replace(/\s+/g," ").trim();

export function unwrapStoredFantraxId(value){
  const id=clean(value);
  return id.length>2&&id.startsWith("*")&&id.endsWith("*")&&!id.startsWith("**")&&!id.endsWith("**")?id.slice(1,-1):"";
}
export function normalizePublicRosterStatus(value){
  return ({ACTIVE:"ACTIVE",RESERVE:"RESERVE",INJURED_RESERVE:"IL",MINORS:"MINORS"})[upper(value)]||"UNCLASSIFIED";
}
export function buildPlayerIdentityIndex(players=[]){
  const byApiId=new Map(),invalidWrappedIds=[],missingIds=[];
  players.forEach(player=>{
    const explicit=clean(player.fantrax_api_player_id);
    const derived=explicit||unwrapStoredFantraxId(player.fantrax_id);
    if(!derived){
      if(clean(player.fantrax_id))invalidWrappedIds.push(player);
      else missingIds.push(player);
      return;
    }
    if(!byApiId.has(derived))byApiId.set(derived,[]);
    byApiId.get(derived).push(player);
  });
  return {byApiId,invalidWrappedIds,missingIds,duplicateIds:[...byApiId.entries()].filter(([,rows])=>rows.length>1).map(([fantraxApiPlayerId,rows])=>({fantraxApiPlayerId,count:rows.length,playerUuids:rows.map(row=>row.id)}))};
}
export function playerIdentityResult(fantraxApiPlayerId,index){
  const id=clean(fantraxApiPlayerId),matches=index.byApiId.get(id)||[];
  if(!id)return {identityResult:"MISSING_API_ID",diagnosticReason:"Fantrax player ID is missing.",matchedPlayerUuid:"",storedFantraxId:""};
  if(matches.length>1)return {identityResult:"DUPLICATE",diagnosticReason:"Multiple cloud players have this exact Fantrax API identity.",matchedPlayerUuid:"",storedFantraxId:""};
  if(!matches.length)return {identityResult:"UNMATCHED",diagnosticReason:"No exact cloud Fantrax identity match.",matchedPlayerUuid:"",storedFantraxId:""};
  return {identityResult:"MATCHED",diagnosticReason:"Exact Fantrax API identity match.",matchedPlayerUuid:matches[0].id,storedFantraxId:clean(matches[0].fantrax_id),matchedPlayer:matches[0]};
}
export function buildTeamIdentityIndex(teams=[]){
  const byFantraxId=new Map();
  teams.forEach(team=>{const id=clean(team.fantrax_team_id);if(id){if(!byFantraxId.has(id))byFantraxId.set(id,[]);byFantraxId.get(id).push(team)}});
  return {byFantraxId,teams};
}
export function teamIdentityResult(fantraxTeamId,teamName,index){
  const matches=index.byFantraxId.get(clean(fantraxTeamId))||[];
  if(matches.length===1)return {identityResult:"MATCHED",diagnosticReason:"Exact persisted Fantrax team ID match.",matchedTeamUuid:matches[0].id,matchedTeam:matches[0]};
  if(matches.length>1)return {identityResult:"AMBIGUOUS",diagnosticReason:"Duplicate persisted Fantrax team ID.",matchedTeamUuid:""};
  const suggestions=index.teams.filter(team=>normalizeName(team.name)===normalizeName(teamName));
  return {identityResult:suggestions.length?"SUGGESTED_ONLY":"UNMAPPED",diagnosticReason:suggestions.length===1?"Name-only suggestion; not authoritative and not persisted.":suggestions.length>1?"Ambiguous name-only suggestions; not authoritative.":"No persisted Fantrax team ID.",matchedTeamUuid:"",suggestedTeamUuids:suggestions.map(team=>team.id)};
}
export function compareFantraxPreview(responses,{players=[],teams=[]}={}){
  const league=responses["league-info"]?.data||{},rosterSource=responses["team-rosters"]?.data||{};
  const playerIndex=buildPlayerIdentityIndex(players),teamIndex=buildTeamIdentityIndex(teams);
  const playerRows=(league.players||[]).map(player=>({...player,...playerIdentityResult(player.fantraxApiPlayerId,playerIndex)}));
  const teamRows=(league.teams||[]).map(team=>({...team,...teamIdentityResult(team.fantraxTeamId,team.teamName,teamIndex)}));
  const rosterItems=(rosterSource.rosterItems||[]).map(item=>{
    const playerMatch=playerIdentityResult(item.fantraxApiPlayerId,playerIndex),teamMatch=teamIdentityResult(item.fantraxTeamId,item.fantraxTeamName,teamIndex);
    const cloudPlayer=playerMatch.matchedPlayer||null,currentOwnerTeamId=clean(cloudPlayer?.owner_team_id),currentOwnerTeam=teamIndex.teams.find(team=>same(team.id,currentOwnerTeamId))||null,currentRosterStatus=upper(cloudPlayer?.roster_status)||"UNCLASSIFIED";
    const normalizedRosterStatus=normalizePublicRosterStatus(item.sourceStatus),currentStatusSource=upper(cloudPlayer?.roster_status_source)||"LEGACY";
    const activeManualOverride=currentStatusSource==="MANUAL",rosterStatusDifference=Boolean(playerMatch.matchedPlayerUuid&&currentRosterStatus!==normalizedRosterStatus);
    const ownershipDifference=Boolean(playerMatch.matchedPlayerUuid&&teamMatch.matchedTeamUuid&&!same(currentOwnerTeamId,teamMatch.matchedTeamUuid));
    const ownershipConflictType=ownershipDifference?(currentOwnerTeamId?"DIFFERENT_CLOUD_OWNER":"CLOUD_FREE_AGENT"):"";
    const ownershipDiagnostic=ownershipConflictType==="CLOUD_FREE_AGENT"?"Cloud player is a free agent but Fantrax has the player rostered; roster status requires review.":ownershipConflictType==="DIFFERENT_CLOUD_OWNER"?`Cloud owner ${currentOwnerTeam?.name||currentOwnerTeamId} differs from Fantrax team ${teamMatch.matchedTeam?.name||item.fantraxTeamName}; roster status requires review.`:"";
    const futureSyncRecommendation=normalizedRosterStatus==="UNCLASSIFIED"||ownershipDifference?"REVIEW_CONFLICT":!rosterStatusDifference?"NO_CHANGE":activeManualOverride?"PRESERVE_MANUAL_OVERRIDE":"APPLY_FANTRAX_STATUS";
    return {...item,normalizedRosterStatus,currentStatusSource,activeManualOverride,fantraxConflict:rosterStatusDifference||ownershipDifference,futureSyncRecommendation,...playerMatch,playerIdentityResult:playerMatch.identityResult,matchedTeamUuid:teamMatch.matchedTeamUuid||"",matchedTeam:teamMatch.matchedTeam||null,teamIdentityResult:teamMatch.identityResult,teamDiagnosticReason:teamMatch.diagnosticReason,currentOwnerTeamId,currentOwnerTeamName:currentOwnerTeam?.name||"",ownershipConflictType,currentRosterStatus,ownershipDifference,rosterStatusDifference,diagnosticReason:[playerMatch.diagnosticReason,teamMatch.diagnosticReason,ownershipDiagnostic].filter(Boolean).join(" ")};
  });
  const matchups=(responses["matchup-scores"]?.data?.matchups||[]).map(row=>({...row,awayTeamIdentity:teamIdentityResult(row.awayFantraxTeamId,row.awayTeamName,teamIndex),homeTeamIdentity:teamIdentityResult(row.homeFantraxTeamId,row.homeTeamName,teamIndex),scoreDifference:row.awayScore===null||row.homeScore===null?null:Math.abs(row.awayScore-row.homeScore),winner:row.awayScore===row.homeScore?"Tie":row.awayScore>row.homeScore?row.awayTeamName:row.homeTeamName}));
  const draftIdentity=row=>{const teamId=clean(row?.teamId||row?.fantraxTeamId||row?.ownerTeamId),playerId=clean(row?.playerId||row?.fantraxApiPlayerId);return {...row,fantraxTeamId:teamId,fantraxApiPlayerId:playerId,teamIdentity:teamId?teamIdentityResult(teamId,row?.teamName||"",teamIndex):{identityResult:"NOT_PRESENT",diagnosticReason:"No team ID in this source row."},playerIdentity:playerId?playerIdentityResult(playerId,playerIndex):{identityResult:"NOT_PRESENT",diagnosticReason:"No player ID in this source row."}}};
  const rawDraftPicks=responses["draft-picks"]?.data||{},rawDraftResults=responses["draft-results"]?.data||{};
  const draftPicks={...rawDraftPicks,currentDraftPicks:(rawDraftPicks.currentDraftPicks||[]).map(draftIdentity),futureDraftPicks:(rawDraftPicks.futureDraftPicks||[]).map(draftIdentity)};
  const draftResults={...rawDraftResults,draftOrder:(rawDraftResults.draftOrder||[]).map(draftIdentity),draftResults:(rawDraftResults.draftResults||[]).map(draftIdentity)};
  const rowCountFor=operation=>operation==="league-info"?(league.players?.length||0)+(league.teams?.length||0):operation==="team-rosters"?rosterItems.length:operation==="matchup-scores"?matchups.length:operation==="standings"?(responses.standings?.data?.standings?.length||0):operation==="draft-picks"?(draftPicks.currentDraftPicks.length+draftPicks.futureDraftPicks.length):draftResults.draftResults.length;
  const endpointHealth=FANTRAX_PREVIEW_OPERATIONS.map(operation=>({endpoint:operation,success:Boolean(responses[operation]&&!responses[operation].error),httpStatus:responses[operation]?.httpStatus||null,schemaValid:responses[operation]?.schemaValid===true,normalizedRowCount:rowCountFor(operation),responseTimestamp:responses[operation]?.data?.fetchedAt||"",missingFields:[],responseSizeWarning:false,timeoutWarning:/timed out/i.test(responses[operation]?.error||""),error:responses[operation]?.error||""}));
  const unknownStatuses=[...new Set(rosterItems.filter(row=>row.normalizedRosterStatus==="UNCLASSIFIED").map(row=>row.sourceStatus||"(missing)"))];
  return {version:FANTRAX_PREVIEW_VERSION,fetchedAt:new Date().toISOString(),league,playerRows,teamRows,rosterItems,matchups,standings:responses.standings?.data?.standings||[],draftPicks,draftResults,endpointHealth,diagnostics:{invalidWrappedIds:playerIndex.invalidWrappedIds.length,missingStoredIds:playerIndex.missingIds.length,duplicateApiIds:playerIndex.duplicateIds,unknownStatuses,teamMappingBlockers:teamRows.filter(row=>row.identityResult!=="MATCHED").length,playerMappingBlockers:playerRows.filter(row=>row.identityResult!=="MATCHED").length}};
}
export async function fetchFantraxPublicPreview({externalLeagueId,period,players=[],teams=[],reviewedSeasonContext=null}={}){
  const supabase=await client(),responses={};
  for(const operation of FANTRAX_PREVIEW_OPERATIONS){
    const {data,error}=await supabase.functions.invoke("fantrax-public-league-preview",{body:{operation,externalLeagueId,period}});
    if(error)responses[operation]={error:error.message||String(error)};
    else responses[operation]=data;
  }
  const failures=Object.values(responses).filter(row=>row?.error);
  if(failures.length===FANTRAX_PREVIEW_OPERATIONS.length)throw new Error(failures[0].error||"Fantrax preview failed.");
  const preview=buildFantraxPreview(responses,{players,teams});
  const observedSeasonContext=canonicalFantraxSeasonContext({externalLeagueId,seasonYear:preview.league?.seasonYear,leagueHistoryId:preview.league?.leagueHistoryId});
  const reviewed=canonicalFantraxSeasonContext(reviewedSeasonContext||{});
  preview.observedSeasonContext=observedSeasonContext;
  preview.reviewedSeasonContext=reviewed;
  preview.seasonContextComparison=compareFantraxSeasonContexts(reviewed,observedSeasonContext);
  return buildPreviewState(preview);
}
function buildFantraxPreview(responses,context){return compareFantraxPreview(responses,context)}
export function buildPreviewState(data){return {data,loading:false,error:"",selectedTab:"summary",page:1,pageSize:50,filters:{search:"",teamId:"",sourceStatus:"",normalizedStatus:"",matched:"",ownershipDifference:false,statusDifference:false}}}
const previewPayload=value=>Boolean(value&&typeof value==="object"&&!Array.isArray(value)&&value.seasonContextComparison&&typeof value.seasonContextComparison==="object");
export function normalizeFantraxPreviewState(response){
  if(previewPayload(response))return buildPreviewState(response);
  if(!response||typeof response!=="object"||Array.isArray(response))throw new Error("Fantrax preview response is unavailable or malformed.");
  const layers=[];
  let payload=response;
  while(!previewPayload(payload)&&payload&&typeof payload==="object"&&!Array.isArray(payload)&&Object.hasOwn(payload,"data")&&layers.length<2){layers.push(payload);payload=payload.data}
  if(!previewPayload(payload))throw new Error("Fantrax preview response is unavailable or malformed.");
  const metadata=Object.assign({},...layers.slice().reverse());
  return {...buildPreviewState(payload),...metadata,data:payload};
}
export function filterRosterPreview(rows=[],filters={}){
  const search=upper(filters.search);
  return rows.filter(row=>(!search||upper([row.matchedPlayer?.name,row.fantraxApiPlayerId,row.fantraxTeamName,row.sourcePosition].join(" ")).includes(search))&&(!filters.teamId||row.fantraxTeamId===filters.teamId)&&(!filters.sourceStatus||row.sourceStatus===filters.sourceStatus)&&(!filters.normalizedStatus||row.normalizedRosterStatus===filters.normalizedStatus)&&(!filters.matched||(filters.matched==="matched")===(row.playerIdentityResult==="MATCHED"))&&(!filters.ownershipDifference||row.ownershipDifference)&&(!filters.statusDifference||row.rosterStatusDifference));
}
