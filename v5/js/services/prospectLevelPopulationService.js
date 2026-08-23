import {fetchMlbIdentityCatalog} from "../providers/mlbStatsApiProvider.js";
import {allPlayers} from "../repositories/playerRepository.js";
import {applyProspectLevelBatches,authenticatedProspectLevelUser} from "../repositories/prospectLevelRepository.js";
import {finishProspectLevelPopulationJob,startProspectLevelPopulationJob} from "../repositories/importJobRepository.js";
import {captureProtectedBaseline,protectedDigest} from "./protectedBaselineService.js";

const SCHEMA="prospect-level-population-preview-v1",MAX_AGE=15*60*1000,RAW_SCHEMA="mlb-stats-prospect-level-evidence-v1",MAX_RAW_OBSERVATIONS=16;
export const PROSPECT_LEVEL_MUTATION_FIELDS=Object.freeze(["current_level","level_source","level_availability","level_observed_at","level_raw_evidence"]);
export const PROSPECT_LEVEL_IMMUTABLE_GUARD_FIELDS=Object.freeze(["player_id","mlbam_id","expected_current_level","expected_level_source","expected_level_availability","expected_level_observed_at","expected_level_raw_evidence"]);
const clean=value=>String(value??"").trim();
const canon=value=>value&&typeof value==="object"?Array.isArray(value)?value.map(canon):Object.fromEntries(Object.keys(value).sort().map(key=>[key,canon(value[key])])):value??null;
const same=(a,b)=>JSON.stringify(canon(a))===JSON.stringify(canon(b));
function numericSportIds(person,evidence){
  const raw=Array.isArray(evidence.rawEvidence)?evidence.rawEvidence:[evidence.rawEvidence],values=[...(person.sportIds||[]),person.sportId,...raw.map(row=>row?.sportId)];
  return [...new Set(values.map(Number).filter(value=>Number.isInteger(value)&&value>0))].sort((a,b)=>a-b);
}
export function serializeProspectLevelRawEvidence(person={},evidence={}){
  const allSportIds=numericSportIds(person,evidence),sportIds=allSportIds.slice(0,MAX_RAW_OBSERVATIONS),raw=Array.isArray(evidence.rawEvidence)?evidence.rawEvidence:[evidence.rawEvidence],observations=[];
  for(const sportId of sportIds){const entries=raw.filter(row=>Number(row?.sportId)===sportId),active=entries.some(row=>row?.active===false)?false:person.active!==false;observations.push({sportId,active})}
  return {schema:RAW_SCHEMA,mlbamId:clean(person.mlbamId).slice(0,20),sportIds,observations,active:person.active!==false,currentTeamId:Number.isInteger(Number(person.currentTeam?.id))?Number(person.currentTeam.id):null,normalization:{inputSportIdCount:allSportIds.length,truncatedSportIdCount:Math.max(0,allSportIds.length-sportIds.length)}};
}
function payload(player,person){const evidence=person.levelEvidence||{},availability=evidence.levelAvailability||"UNKNOWN",conflict=availability==="CONFLICT";return {current_level:conflict?null:evidence.currentLevel??null,level_source:evidence.levelSource||"MLB_STATS_API",level_availability:availability,level_observed_at:evidence.levelObservedAt||null,level_raw_evidence:serializeProspectLevelRawEvidence(person,evidence)}}
export function buildProspectLevelPlan(players=[],catalog={}){
  const groups=new Map();for(const player of players){const id=clean(player.mlbam_id);if(id){if(!groups.has(id))groups.set(id,[]);groups.get(id).push(player)}}
  const rows=[],unmatched=[],conflicts=[],invalid=[];
  for(const person of catalog.people||[]){const id=clean(person.mlbamId),matches=groups.get(id)||[];
    if(!id||!person.levelEvidence){invalid.push({mlbamId:id||null,reason:"INVALID_LEVEL_EVIDENCE"});continue}
    if(matches.length===0){unmatched.push({mlbamId:id,reason:"NO_EXISTING_PLAYER_UUID"});continue}
    if(matches.length!==1){conflicts.push({mlbamId:id,playerIds:matches.map(row=>row.id),reason:"AMBIGUOUS_MLBAM_IDENTITY"});continue}
    const player=matches[0],next=payload(player,person),current=Object.fromEntries(PROSPECT_LEVEL_MUTATION_FIELDS.map(field=>[field,player[field]??null]));
    if(next.level_observed_at&&current.level_observed_at&&Date.parse(next.level_observed_at)<Date.parse(current.level_observed_at)){invalid.push({mlbamId:id,playerId:player.id,reason:"STALE_PROVIDER_EVIDENCE"});continue}
    if(next.level_availability==="CONFLICT"&&current.current_level&&["AVAILABLE","STALE"].includes(current.level_availability)){conflicts.push({mlbamId:id,playerId:player.id,reason:"NON_WRITABLE_PROVIDER_CONFLICT_PRESERVES_VALID_LEVEL",incoming:next});continue}
    rows.push({playerId:player.id,mlbamId:id,playerName:player.name||"",current,next,action:same(current,next)?"NO_OP":"UPDATE"});
  }
  const updates=rows.filter(row=>row.action==="UPDATE"),noOps=rows.filter(row=>row.action==="NO_OP"),distribution={};for(const row of rows){const key=row.next.level_availability==="CONFLICT"?"CONFLICT":row.next.level_availability==="UNKNOWN"?"UNKNOWN":row.next.current_level||"UNKNOWN";distribution[key]=(distribution[key]||0)+1}
  return {rows,updates,noOps,unmatched,conflicts,invalid,distribution,providerConflictCount:rows.filter(row=>row.next.level_availability==="CONFLICT").length+conflicts.filter(row=>row.reason?.includes("PROVIDER_CONFLICT")).length};
}
function writeRow(row){return {player_id:row.playerId,mlbam_id:Number(row.mlbamId),...row.next,expected_current_level:row.current.current_level,expected_level_source:row.current.level_source,expected_level_availability:row.current.level_availability,expected_level_observed_at:row.current.level_observed_at,expected_level_raw_evidence:row.current.level_raw_evidence}}
async function manifestDigest(preview){return protectedDigest({schema:SCHEMA,leagueId:preview.leagueId,userId:preview.userId,snapshot:{provider:preview.provider,season:preview.season,fetchedAt:preview.fetchedAt,sportIds:preview.sportIds},baseline:{profile:preview.baseline.profile,contractVersion:preview.baseline.contractVersion,protectedHash:preview.baseline.domains?.players?.hash,schemaState:preview.baseline.domains?.prospectLevelEvidence?.schemaState},writePlan:preview.plan.updates.map(writeRow)})}
export async function previewProspectLevelPopulation({leagueId,season,baseline,provider=fetchMlbIdentityCatalog,repositories={players:allPlayers,user:authenticatedProspectLevelUser}}={}){
  if(!leagueId)throw new Error("Active league is required.");if(baseline?.profile!=="PROSPECT_LEVEL_POPULATION"||baseline.status!=="AVAILABLE")throw new Error("Capture the PROSPECT_LEVEL_POPULATION protected baseline first.");
  const [user,catalog,players]=await Promise.all([repositories.user(),provider({season}),repositories.players(leagueId)]),plan=buildProspectLevelPlan(players,catalog);
  const preview={schema:SCHEMA,status:"READY",leagueId,userId:user.id,provider:catalog.provider,season:catalog.season,fetchedAt:catalog.fetchedAt,sportIds:[...new Set((catalog.sportIds||[]).map(Number).filter(Number.isInteger))].sort((a,b)=>a-b),createdAt:new Date().toISOString(),baseline,plan,counts:{provider:(catalog.people||[]).length,matched:plan.rows.length,updates:plan.updates.length,noOps:plan.noOps.length,unmatched:plan.unmatched.length,conflicts:plan.conflicts.length,providerConflicts:plan.providerConflictCount,invalid:plan.invalid.length},warnings:[...(catalog.warnings||[])],errors:[]};preview.digest=await manifestDigest(preview);return preview;
}
export async function applyProspectLevelPopulation({leagueId,reviewedPreview,reviewed=false,repositories={players:allPlayers,user:authenticatedProspectLevelUser,baseline:captureProtectedBaseline,apply:applyProspectLevelBatches,startJob:startProspectLevelPopulationJob,finishJob:finishProspectLevelPopulationJob}}={}){
  if(!reviewed||reviewedPreview?.schema!==SCHEMA)throw new Error("Preview and explicitly review prospect-level population first.");
  if(reviewedPreview.leagueId!==leagueId||reviewedPreview.status!=="READY")throw new Error("Reviewed prospect-level context changed.");
  if(Date.now()-Date.parse(reviewedPreview.createdAt)>MAX_AGE)throw new Error("Reviewed prospect-level preview is stale.");
  const [user,players,baseline]=await Promise.all([repositories.user(),repositories.players(leagueId),repositories.baseline({leagueId,profile:"PROSPECT_LEVEL_POPULATION"})]);
  if(user.id!==reviewedPreview.userId)throw new Error("Authenticated user changed after review.");
  if(baseline.status!=="AVAILABLE"||baseline.domains?.prospectLevelEvidence?.schemaState!=="PRESENT")throw new Error("Prospect-level schema is not safely available for apply.");
  if(baseline.domains?.players?.hash!==reviewedPreview.baseline.domains?.players?.hash)throw new Error("Protected player or identity evidence changed after review.");
  const freshPlan=buildProspectLevelPlan(players,{people:reviewedPreview.plan.rows.map(row=>({mlbamId:row.mlbamId,levelEvidence:{currentLevel:row.next.current_level,levelSource:row.next.level_source,levelAvailability:row.next.level_availability,levelObservedAt:row.next.level_observed_at,rawEvidence:row.next.level_raw_evidence?.observations},sportIds:row.next.level_raw_evidence?.sportIds,active:row.next.level_raw_evidence?.active,currentTeam:{id:row.next.level_raw_evidence?.currentTeamId}}))}),check={...reviewedPreview,baseline,plan:freshPlan};
  if(await manifestDigest(check)!==reviewedPreview.digest)throw new Error("Prospect-level identity or write plan changed after review.");
  const rows=freshPlan.updates.map(writeRow);if(!rows.length)return {status:"COMPLETED",attempted:0,successful:[],failed:[],skipped:freshPlan.noOps.map(row=>row.playerId),noOps:freshPlan.noOps.map(row=>row.playerId)};
  const metadata={schema:SCHEMA,digest:reviewedPreview.digest,provider:reviewedPreview.provider,season:reviewedPreview.season,fetchedAt:reviewedPreview.fetchedAt,distribution:freshPlan.distribution,plannedUpdates:rows.length,noOps:freshPlan.noOps.length,warnings:reviewedPreview.warnings||[]},job=await repositories.startJob(leagueId,{sourceMetadata:metadata});
  let saved=[],writeError=null,failed=[],unattempted=[];
  try{saved=await repositories.apply(leagueId,rows,{batchSize:250})}catch(error){writeError=error;const partial=error.prospectLevelBatchResult||{};saved=(partial.savedPlayerIds||[]).map(player_id=>({player_id}));failed=partial.failedPlayerIds||rows.map(row=>row.player_id);unattempted=partial.unattemptedPlayerIds||[]}
  const savedIds=new Set(saved.map(row=>row.player_id));if(!writeError)failed=rows.filter(row=>!savedIds.has(row.player_id)).map(row=>row.player_id);
  const playerWriteStatus=writeError?(savedIds.size?"PARTIAL":"FAILED"):failed.length?"PARTIAL":"COMPLETED",auditPayload={status:playerWriteStatus.toLowerCase(),processed:rows.length-unattempted.length,matched:rows.length,updated:savedIds.size,failed:failed.length,errors:writeError?[{message:String(writeError?.message||writeError)}]:[],errorMessage:writeError?String(writeError?.message||writeError):null,sourceMetadata:{...metadata,successfulPlayerIds:[...savedIds],failedPlayerIds:failed,unattemptedPlayerIds:unattempted}},auditError=await repositories.finishJob(leagueId,job.id,auditPayload).then(()=>null).catch(error=>error);
  const status=auditError?"AUDIT_FINALIZATION_FAILURE":playerWriteStatus==="COMPLETED"?"COMPLETED":playerWriteStatus==="PARTIAL"?"PARTIAL_WRITE_FAILURE":"FAILED_BEFORE_WRITES";
  return {status,jobId:job.id,attempted:rows.length,successful:[...savedIds],failed,unattempted,skipped:[],noOps:freshPlan.noOps.map(row=>row.playerId),playerWrites:{status:playerWriteStatus,error:writeError?String(writeError?.message||writeError):null},auditFinalization:{status:auditError?"FAILED":"COMPLETED",error:auditError?String(auditError?.message||auditError):null},errors:[writeError,auditError].filter(Boolean).map(error=>String(error?.message||error))};
}
export function createProspectLevelPopulationUiState({season=new Date().getUTCFullYear(),status="NOT_PREVIEWED",invalidationReason=""}={}){return {season,status,invalidationReason,preview:null,reviewed:false,running:false,result:null,error:""}}
export const PROSPECT_LEVEL_POPULATION_SCHEMA=SCHEMA;
