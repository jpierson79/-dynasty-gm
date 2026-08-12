import { fetchStatcastSnapshot } from "../providers/baseballSavantStatcastProvider.js";
import { allPlayers } from "../repositories/playerRepository.js";
import { listMetrics, upsertStatcastMetricRows } from "../repositories/metricRepository.js";
import { finishAutomatedStatcastJob, startAutomatedStatcastJob } from "../repositories/importJobRepository.js";

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
function sourceMetadata(snapshot){return {
  provider:snapshot.provider,playerType:snapshot.playerType,season:snapshot.season,fetchedAt:snapshot.fetchedAt,
  snapshotId:snapshot.snapshotId,sources:snapshot.sources.map(source=>({sourceType:source.sourceType,endpoint:source.endpoint,season:source.season,fetchedAt:source.fetchedAt,rowCount:source.rowCount,headers:source.headers,schemaVersion:source.schemaVersion,checksum:source.checksum,warnings:source.warnings||[]})),
  warnings:snapshot.warnings||[]
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
export async function applyAutomatedStatcastRefresh({leagueId,playerType,reviewedPreview,repositories={upsert:upsertStatcastMetricRows,startJob:startAutomatedStatcastJob,finishJob:finishAutomatedStatcastJob}}={}){
  assertPreview(reviewedPreview,{leagueId,playerType});
  const {snapshot,resolution,plan}=reviewedPreview,metadata=sourceMetadata(snapshot);
  let job;
  try{
    job=await repositories.startJob(leagueId,{playerType,sourceMetadata:metadata});
    const saved=await repositories.upsert(leagueId,plan.writeRows);
    const warningRows=(reviewedPreview.warnings||[]).slice(0,100),partial=reviewedPreview.warnings?.length>0;
    const result={status:partial?"partial":"completed",processed:snapshot.rows.length,matched:resolution.matched.length,unmatched:resolution.unmatched.length,inserted:plan.inserted.length,updated:plan.updated.length,unchanged:plan.unchanged.length,failed:resolution.invalid.length+(snapshot.invalidRows?.length||0),warnings:warningRows,warningCount:reviewedPreview.warnings?.length||0,snapshot:metadata,saved:saved.length};
    await repositories.finishJob(leagueId,job.id,{...result,errors:result.warnings,sourceMetadata:metadata});
    return result;
  }catch(error){
    const savedCount=Number(error?.statcastBatchResult?.savedCount||0),savedInserted=Math.min(savedCount,plan.inserted.length),savedUpdated=Math.max(0,savedCount-plan.inserted.length);
    if(job?.id)await repositories.finishJob(leagueId,job.id,{status:savedCount?"partial":"failed",processed:snapshot.rows.length,matched:resolution.matched.length,unmatched:resolution.unmatched.length,inserted:savedInserted,updated:savedUpdated,failed:Number(error?.statcastBatchResult?.remainingCount??plan.writeRows.length),errors:[{message:String(error?.message||error),batch:error?.statcastBatchResult||null}],errorMessage:String(error?.message||error),sourceMetadata:metadata}).catch(()=>{});
    throw error;
  }
}

export function statcastRefreshHealth({metricRows=[],importJobs=[],now=Date.now(),staleAfterMs=36*60*60*1000,available=true,error=""}={}){
  if(!available)return {status:"UNAVAILABLE",error:error||"Statcast refresh history is unavailable.",checks:[]};
  const jobs=importJobs.filter(job=>String(job.import_type||"").startsWith("statcast_automated_"));
  const successful=jobs.filter(job=>job.status==="completed").sort((a,b)=>String(b.completed_at||"").localeCompare(String(a.completed_at||"")))[0]||null;
  const latest=jobs.slice().sort((a,b)=>String(b.started_at||b.created_at||"").localeCompare(String(a.started_at||a.created_at||"")))[0]||null;
  const reporting=successful||latest,statcastRows=metricRows.filter(row=>row.source===SOURCE),latestAt=successful?.completed_at||"",stale=!latestAt||now-Date.parse(latestAt)>staleAfterMs;
  const meta=reporting?.source_metadata||{},status=latest?.status==="failed"?"FAILED":latest?.status==="partial"?"PARTIAL":successful?"AVAILABLE":"NEVER_RUN";
  return {status,lastSuccessfulAt:latestAt,latestStatus:latest?.status||"NEVER_RUN",season:meta.season??null,provider:meta.provider||"",rowsFetched:reporting?.rows_processed??null,matched:reporting?.rows_matched??null,unmatched:reporting?.rows_unmatched??null,inserted:reporting?.rows_inserted??null,updated:reporting?.rows_updated??null,failed:reporting?.rows_failed??null,metricRows:statcastRows.length,stale,warnings:meta.warnings||[],errors:latest?.errors||[],error};
}

export const AUTOMATED_STATCAST_SOURCE=SOURCE;
