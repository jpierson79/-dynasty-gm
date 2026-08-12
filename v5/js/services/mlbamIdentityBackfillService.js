import { fetchMlbIdentityCatalog } from "../providers/mlbStatsApiProvider.js";
import { allPlayers } from "../repositories/playerRepository.js";
import { applyReviewedMlbamBackfill } from "../repositories/mlbamIdentityRepository.js";

const PREVIEW_MAX_AGE_MS=15*60*1000;
const CLASSES=Object.freeze({EXACT:"EXACT",REVIEW:"REVIEW",AMBIGUOUS:"AMBIGUOUS",UNMATCHED:"UNMATCHED",EXISTING:"EXISTING"});
function clean(value){return String(value??"").trim()}
function normalizedName(value){return clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/\b(jr|sr|ii|iii|iv)\.?\b/g,"").replace(/[^a-z0-9]+/g," ").trim()}
function tokens(value){return new Set((Array.isArray(value)?value:clean(value).split(/[\/,\s]+/)).map(item=>clean(item).toUpperCase()).filter(Boolean))}
function positionFamily(value){const set=tokens(value),out=new Set(set);if([...set].some(item=>["P","SP","RP","TWP"].includes(item)))out.add("P");if([...set].some(item=>["LF","CF","RF","OF"].includes(item)))out.add("OF");return out}
function overlaps(left,right){const a=positionFamily(left),b=positionFamily(right);return [...a].some(value=>b.has(value))}
function teamEvidence(player,candidate,mlbTeams){
  const expected=clean(player.mlb_team).toUpperCase();if(!expected||["FA","N/A","-"].includes(expected))return false;
  const team=mlbTeams.find(row=>!row.parentOrgId&&[row.abbreviation,row.teamCode,row.fileCode,row.name].map(clean).map(value=>value.toUpperCase()).includes(expected));
  const current=candidate.currentTeam||{};
  return Boolean(team&&(current.id===team.id||current.parentOrgId===team.id));
}
function baseRow(player){return {playerId:player.id,playerName:player.name,fantraxId:player.fantrax_id||"",fantraxApiPlayerId:player.fantrax_api_player_id||"",mlbTeam:player.mlb_team||"",positions:player.positions||[],currentMlbamId:player.mlbam_id==null?null:String(player.mlbam_id)} }
export function resolveMlbamBackfill(playerRows,catalog){
  const existingGroups=new Map(),byName=new Map();
  for(const player of playerRows||[]){const id=clean(player.mlbam_id);if(id){if(!existingGroups.has(id))existingGroups.set(id,[]);existingGroups.get(id).push(player)}}
  for(const person of catalog?.people||[]){const key=normalizedName(person.fullName);if(!byName.has(key))byName.set(key,[]);byName.get(key).push(person)}
  const rows=(playerRows||[]).map(player=>{
    const base=baseRow(player),current=clean(player.mlbam_id);
    if(current)return {...base,proposedMlbamId:current,matchClass:CLASSES.EXISTING,writeRecommended:false,evidence:["EXISTING_MLBAM_PRESERVED"],ambiguityReason:existingGroups.get(current)?.length>1?"DUPLICATE_EXISTING_MLBAM":""};
    const candidates=byName.get(normalizedName(player.name))||[];
    if(!candidates.length)return {...base,proposedMlbamId:null,matchClass:CLASSES.UNMATCHED,writeRecommended:false,evidence:[],ambiguityReason:"NO_PERSON_CANDIDATE"};
    if(candidates.length!==1)return {...base,proposedMlbamId:null,matchClass:CLASSES.AMBIGUOUS,writeRecommended:false,evidence:["NAME_SUPPORT_ONLY"],ambiguityReason:"DUPLICATE_NAME_CANDIDATES",candidateMlbamIds:candidates.map(row=>row.mlbamId)};
    const candidate=candidates[0],teamMatch=teamEvidence(player,candidate,catalog.teams||[]),positionMatch=overlaps(player.positions,candidate.primaryPosition),active=candidate.active!==false;
    const evidence=["NORMALIZED_NAME_SUPPORT",teamMatch?"AUTHORITATIVE_ORG_MATCH":"ORG_MISMATCH_OR_UNAVAILABLE",positionMatch?"POSITION_OVERLAP":"POSITION_MISMATCH_OR_UNAVAILABLE",active?"ACTIVE_PERSON":"INACTIVE_PERSON"];
    if(teamMatch&&positionMatch&&active)return {...base,proposedMlbamId:candidate.mlbamId,matchClass:CLASSES.EXACT,writeRecommended:true,evidence,ambiguityReason:"",candidate};
    return {...base,proposedMlbamId:candidate.mlbamId,matchClass:CLASSES.REVIEW,writeRecommended:false,evidence,ambiguityReason:!active?"INACTIVE_OR_RETIRED":!teamMatch?"TEAM_EVIDENCE_REQUIRED":"POSITION_EVIDENCE_REQUIRED",candidate};
  });
  const proposed=new Map();rows.filter(row=>row.writeRecommended).forEach(row=>{if(!proposed.has(row.proposedMlbamId))proposed.set(row.proposedMlbamId,[]);proposed.get(row.proposedMlbamId).push(row)});
  for(const group of proposed.values())if(group.length>1)group.forEach(row=>Object.assign(row,{matchClass:CLASSES.AMBIGUOUS,writeRecommended:false,ambiguityReason:"DUPLICATE_PROPOSED_MLBAM"}));
  rows.filter(row=>row.writeRecommended&&existingGroups.has(row.proposedMlbamId)).forEach(row=>Object.assign(row,{matchClass:CLASSES.AMBIGUOUS,writeRecommended:false,ambiguityReason:"CONFLICTING_EXISTING_MLBAM",conflictingPlayerIds:existingGroups.get(row.proposedMlbamId).map(player=>player.id)}));
  const summary={total:rows.length,missing:rows.filter(row=>row.currentMlbamId===null).length,exact:rows.filter(row=>row.matchClass===CLASSES.EXACT).length,review:rows.filter(row=>row.matchClass===CLASSES.REVIEW).length,ambiguous:rows.filter(row=>row.matchClass===CLASSES.AMBIGUOUS).length,unmatched:rows.filter(row=>row.matchClass===CLASSES.UNMATCHED).length,existing:rows.filter(row=>row.matchClass===CLASSES.EXISTING).length,duplicateProposed:[...proposed.entries()].filter(([,group])=>group.length>1).length,duplicateExisting:[...existingGroups.values()].filter(group=>group.length>1).length,providerFailures:(catalog?.invalid||[]).length};
  return {rows,summary};
}
export async function previewMlbamIdentityBackfill({leagueId,season,provider=fetchMlbIdentityCatalog,repositories={players:allPlayers}}={}){
  if(!leagueId)throw new Error("Active league is required.");
  const catalog=await provider({season}),players=await repositories.players(leagueId),resolution=resolveMlbamBackfill(players,catalog);
  return {schema:"mlbam-backfill-preview-v1",leagueId,season:catalog.season,provider:catalog.provider,fetchedAt:catalog.fetchedAt,createdAt:new Date().toISOString(),status:"READY",catalogMetadata:{sportIds:catalog.sportIds,people:catalog.people.length,teams:catalog.teams.length,warnings:catalog.warnings||[]},...resolution};
}
export async function applyMlbamIdentityBackfill({leagueId,reviewedPreview,reviewed=false,repositories={apply:applyReviewedMlbamBackfill}}={}){
  if(!reviewed||reviewedPreview?.schema!=="mlbam-backfill-preview-v1")throw new Error("Preview and explicitly review the MLBAM backfill first.");
  if(reviewedPreview.leagueId!==leagueId||reviewedPreview.status!=="READY")throw new Error("MLBAM backfill preview context is invalid.");
  if(Date.now()-Date.parse(reviewedPreview.createdAt)>PREVIEW_MAX_AGE_MS)throw new Error("MLBAM backfill preview is stale.");
  const rows=reviewedPreview.rows.filter(row=>row.matchClass===CLASSES.EXACT&&row.writeRecommended).map(row=>({player_id:row.playerId,mlbam_id:Number(row.proposedMlbamId)}));
  if(!rows.length)return {reviewed:0,updated:[],skipped:[]};
  const updated=await repositories.apply(leagueId,rows),updatedIds=new Set(updated.map(row=>row.player_id||row.id));
  return {reviewed:rows.length,updated,skipped:rows.filter(row=>!updatedIds.has(row.player_id))};
}
export function mlbamBackfillHealth(preview){
  if(!preview)return {status:"NEVER_RUN",lastPreviewAt:null,total:null,missing:null,exact:null,review:null,ambiguous:null,unmatched:null,duplicateProposed:null,duplicateExisting:null,providerFailures:null};
  if(preview.status!=="READY")return {status:"UNAVAILABLE",lastPreviewAt:preview.createdAt||null,error:preview.error||"MLBAM provider preview unavailable."};
  return {status:"AVAILABLE",lastPreviewAt:preview.createdAt,...preview.summary};
}
export const MLBAM_MATCH_CLASSES=CLASSES;
