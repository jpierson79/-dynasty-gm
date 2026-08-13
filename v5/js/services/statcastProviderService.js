import { fetchStatcastSnapshot } from "../providers/baseballSavantStatcastProvider.js";
import { allPlayers } from "../repositories/playerRepository.js";
import { listMetrics, upsertStatcastMetricRows } from "../repositories/metricRepository.js";
import { finishAutomatedStatcastJob, startAutomatedStatcastJob } from "../repositories/importJobRepository.js";
import { normalizeStatcastTypeOutcome, statcastSessionStatus } from "./statcastRefreshSessionService.js";

const SOURCE="Statcast";
const PREVIEW_MAX_AGE_MS=15*60*1000;
const METRIC_TYPES={hitter:"statcast_hitting",pitcher:"statcast_pitching"};

function mlbam(value){const cleaned=String(value??"").trim();return /^\d+$/.test(cleaned)?cleaned:""}
function stable(value){
  if(Array.isArray(value))return value.map(stable);
  if(value&&typeof value==="object")return Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])]));
  return value;
}
function same(a,b){return JSON.stringify(stable(a||{}))===JSON.stringify(stable(b||{}))}
function metricValues(metrics={}){
  if(metrics.values&&typeof metrics.values==="object")return metrics.values;
  const {_statcast,statcast,...values}=metrics;
  return values;
}
function sourceMetadata(snapshot,refreshSession=null){return {
  provider:snapshot.provider,playerType:snapshot.playerType,season:snapshot.season,fetchedAt:snapshot.fetchedAt,
  snapshotId:snapshot.snapshotId,sources:snapshot.sources.map(source=>({sourceType:source.sourceType,endpoint:source.endpoint,season:source.season,fetchedAt:source.fetchedAt,rowCount:source.rowCount,headers:source.headers,schemaVersion:source.schemaVersion,checksum:source.checksum,warnings:source.warnings||[]})),
  warnings:snapshot.warnings||[],...(refreshSession?{refreshSession}:{})
}}
async function snapshotId(snapshot){
  const value=snapshot.sources.map(source=>`${source.sourceType}:${source.checksum}`).sort().join("|");
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,"0")).join("");
}
export function resolveStatcastRows(snapshot,playerRows){
  const byMlbam=new Map(),duplicates=new Set();
  for(const player of playerRows||[]){
    const id=mlbam(player.mlbam_id);if(!id)continue;
    if(byMlbam.has(id)){duplicates.add(id);continue}
    byMlbam.set(id,player);
  }
  const matched=[],unmatched=[],conflicts=[],invalid=[];
  for(const row of snapshot?.rows||[]){
    const id=mlbam(row.mlbamId);
    if(!id){invalid.push({...row,reason:"MISSING_OR_INVALID_MLBAM"});continue}
    if(duplicates.has(id)){conflicts.push({...row,reason:"DUPLICATE_CLOUD_MLBAM"});continue}
    const player=byMlbam.get(id);
    if(!player){unmatched.push({...row,reason:"UNMATCHED_MLBAM"});continue}
    matched.push({player,row});
  }
  return {matched,unmatched,conflicts,invalid,duplicateMlbamIds:[...duplicates].sort()};
}
function planMetricRows({leagueId,snapshot,resolution,existingMetrics}){
  const metricType=METRIC_TYPES[snapshot.playerType],existingByPlayer=new Map((existingMetrics||[]).filter(row=>row.source===SOURCE&&row.season===snapshot.season&&row.metric_type===metricType).map(row=>[row.player_id,row]));
  const inserted=[],updated=[],unchanged=[];
  for(const {player,row} of resolution.matched){
    const existing=existingByPlayer.get(player.id),prior=existing?.metrics||{},priorValues=metricValues(prior);
    const values={...priorValues,...row.metrics};
    const metadata={provider:snapshot.provider,mlbamId:row.mlbamId,season:snapshot.season,sourceDate:String(snapshot.season),fetchedAt:snapshot.fetchedAt,freshness:"FRESH",snapshotId:snapshot.snapshotId,sourceTypes:row.sourceTypes};
    const next={league_id:leagueId,player_id:player.id,source:SOURCE,season:snapshot.season,metric_type:metricType,metrics:{...values,_statcast:metadata},imported_at:snapshot.fetchedAt};
    if(!existing)inserted.push(next);
    else if(same(priorValues,values)&&(prior._statcast||prior.statcast)?.snapshotId===snapshot.snapshotId)unchanged.push(existing);
    else updated.push(next);
  }
  return {inserted,updated,unchanged,writeRows:[...inserted,...updated]};
}
export async function previewAutomatedStatcastRefresh({leagueId,playerType,season,provider=fetchStatcastSnapshot,repositories={players:allPlayers,metrics:listMetrics}}={}){
  if(!leagueId)throw new Error("Active league is required.");
  const snapshot=await provider({playerType,season});
  snapshot.snapshotId=await snapshotId(snapshot);
  const [playerRows,existingMetrics]=await Promise.all([repositories.players(leagueId),repositories.metrics(leagueId)]);
  const resolution=resolveStatcastRows(snapshot,playerRows),plan=planMetricRows({leagueId,snapshot,resolution,existingMetrics});
  const sourceInvalid=snapshot.invalidRows||[],errors=[...resolution.conflicts],warnings=[...resolution.unmatched,...resolution.invalid,...sourceInvalid,...(snapshot.warnings||[])];
  return {schema:"statcast-refresh-preview-v1",leagueId,playerType,snapshot,resolution,plan,createdAt:new Date().toISOString(),status:errors.length?"BLOCKED":"READY",errors,warnings};
}
function assertPreview(preview,{leagueId,playerType}){
  if(preview?.schema!=="statcast-refresh-preview-v1")throw new Error("A valid Statcast refresh preview is required.");
  if(preview.leagueId!==leagueId||preview.playerType!==playerType)throw new Error("Statcast refresh preview context changed.");
  if(preview.status!=="READY"||preview.errors?.length)throw new Error("Blocked Statcast preview cannot be persisted.");
  if(Date.now()-Date.parse(preview.createdAt)>PREVIEW_MAX_AGE_MS)throw new Error("Statcast refresh preview is stale.");
}
export async function applyAutomatedStatcastRefresh({leagueId,playerType,reviewedPreview,refreshSession=null,repositories={upsert:upsertStatcastMetricRows,startJob:startAutomatedStatcastJob,finishJob:finishAutomatedStatcastJob}}={}){
  assertPreview(reviewedPreview,{leagueId,playerType});
  const {snapshot,resolution,plan}=reviewedPreview,metadata=sourceMetadata(snapshot,refreshSession);
  let job;
  try{
    job=await repositories.startJob(leagueId,{playerType,sourceMetadata:metadata});
    const saved=await repositories.upsert(leagueId,plan.writeRows);
    const warningRows=(reviewedPreview.warnings||[]).slice(0,100),partial=reviewedPreview.warnings?.length>0;
    const result={status:partial?"partial":"completed",processed:snapshot.rows.length,matched:resolution.matched.length,unmatched:resolution.unmatched.length,inserted:plan.inserted.length,updated:plan.updated.length,unchanged:plan.unchanged.length,failed:resolution.invalid.length+(snapshot.invalidRows?.length||0),warnings:warningRows,warningCount:reviewedPreview.warnings?.length||0,snapshot:metadata,saved:saved.length,importJobId:job.id,importType:`statcast_automated_${playerType}`};
    await repositories.finishJob(leagueId,job.id,{...result,errors:result.warnings,sourceMetadata:{...metadata,outcome:{unchanged:result.unchanged,warningCount:result.warningCount}}});
    return result;
  }catch(error){
    const savedCount=Number(error?.statcastBatchResult?.savedCount||0),savedInserted=Math.min(savedCount,plan.inserted.length),savedUpdated=Math.max(0,savedCount-plan.inserted.length);
    if(job?.id)await repositories.finishJob(leagueId,job.id,{status:savedCount?"partial":"failed",processed:snapshot.rows.length,matched:resolution.matched.length,unmatched:resolution.unmatched.length,inserted:savedInserted,updated:savedUpdated,failed:Number(error?.statcastBatchResult?.remainingCount??plan.writeRows.length),errors:[{message:String(error?.message||error),batch:error?.statcastBatchResult||null}],errorMessage:String(error?.message||error),sourceMetadata:metadata}).catch(()=>{});
    throw error;
  }
}

function jobType(job){const value=String(job?.import_type||"").replace("statcast_automated_","");return METRIC_TYPES[value]?value:""}
function jobEvidence(job,now,staleAfterMs){
  if(!job)return {status:"NEVER_RUN",stale:false};
  const meta=job.source_metadata||{},completedAt=job.completed_at||"",status=normalizeStatcastTypeOutcome(job.status),sources=(meta.sources||[]).map(source=>({sourceType:source.sourceType,sourceChecksum:source.checksum,schemaChecksum:source.schemaVersion,rowCount:source.rowCount,fetchedAt:source.fetchedAt}));
  return {status,fetched:job.rows_processed??null,matched:job.rows_matched??null,unmatched:job.rows_unmatched??null,inserted:job.rows_inserted??null,updated:job.rows_updated??null,unchanged:meta.outcome?.unchanged??null,failed:job.rows_failed??null,warnings:meta.outcome?.warningCount??meta.warnings?.length??0,errors:job.errors||[],provider:meta.provider||"",season:meta.season??null,snapshotId:meta.snapshotId||"",sources,refreshTimestamp:completedAt||job.started_at||job.created_at||"",stale:Boolean(completedAt&&now-Date.parse(completedAt)>staleAfterMs),refreshSession:meta.refreshSession||null};
}
export function statcastRefreshHealth({metricRows=[],importJobs=[],now=Date.now(),staleAfterMs=36*60*60*1000,available=true,error=""}={}){
  if(!available)return {status:"UNAVAILABLE",error:error||"Statcast refresh history is unavailable.",checks:[]};
  const jobs=importJobs.filter(job=>String(job.import_type||"").startsWith("statcast_automated_"));
  const ordered=jobs.slice().sort((a,b)=>String(b.completed_at||b.started_at||b.created_at||"").localeCompare(String(a.completed_at||a.started_at||a.created_at||""))),latestByType=type=>ordered.find(job=>jobType(job)===type)||null;
  const types={hitter:jobEvidence(latestByType("hitter"),now,staleAfterMs),pitcher:jobEvidence(latestByType("pitcher"),now,staleAfterMs)};
  const coordinated=ordered.find(job=>Array.isArray(job.source_metadata?.refreshSession?.intendedTypes)&&job.source_metadata.refreshSession.intendedTypes.length>1),sessionId=coordinated?.source_metadata?.refreshSession?.id||"",sessionJobs=sessionId?ordered.filter(job=>job.source_metadata?.refreshSession?.id===sessionId):[],intendedTypes=coordinated?.source_metadata?.refreshSession?.intendedTypes||[];
  const sessionTypes=Object.fromEntries(["hitter","pitcher"].map(type=>[type,{result:sessionJobs.find(job=>jobType(job)===type)?{status:sessionJobs.find(job=>jobType(job)===type).status}:null,error:""}])),sessionStatus=sessionId?statcastSessionStatus(sessionTypes,intendedTypes):"NOT_RUN";
  const session={status:sessionStatus,sessionId,timestamp:sessionJobs.map(job=>job.completed_at||job.started_at||job.created_at||"").sort().at(-1)||"",typesIntended:intendedTypes,typesCompleted:intendedTypes.filter(type=>normalizeStatcastTypeOutcome(sessionJobs.find(job=>jobType(job)===type)?.status)==="SUCCESS"),typesPartial:intendedTypes.filter(type=>normalizeStatcastTypeOutcome(sessionJobs.find(job=>jobType(job)===type)?.status)==="PARTIAL"),typesFailed:intendedTypes.filter(type=>normalizeStatcastTypeOutcome(sessionJobs.find(job=>jobType(job)===type)?.status)==="FAILED")};
  const latest=ordered[0]||null,latestEvidence=jobEvidence(latest,now,staleAfterMs),statcastRows=metricRows.filter(row=>row.source===SOURCE),lastSuccessfulAt=ordered.find(job=>normalizeStatcastTypeOutcome(job.status)==="SUCCESS")?.completed_at||"";
  return {status:sessionId?sessionStatus:latestEvidence.status,lastSuccessfulAt,latestStatus:latestEvidence.status,metricRows:statcastRows.length,stale:sessionId?intendedTypes.some(type=>types[type].stale):latestEvidence.stale,types,session,error};
}

export const AUTOMATED_STATCAST_SOURCE=SOURCE;
