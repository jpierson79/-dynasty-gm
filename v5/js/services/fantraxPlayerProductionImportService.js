import { parseCsvFile } from "../../../js/services/cloudCsvImportService.js";
import { leagueById } from "../repositories/leagueRepository.js";
import { allPlayers } from "../repositories/playerRepository.js";
import { listMetrics, upsertFantraxProductionMetricRows } from "../repositories/metricRepository.js";
import { finishFantraxProductionJob, startFantraxProductionJob } from "../repositories/importJobRepository.js";
import { FANTRAX_PLAYERS_HEADER, FANTRAX_PRODUCTION_METRIC_TYPE, FANTRAX_PRODUCTION_SOURCE, fantraxProductionMetricRow, previewFantraxPlayerProduction } from "./fantraxPlayerProductionService.js";

const PREVIEW_MAX_AGE_MS=15*60*1000;
const clean=value=>String(value??"").trim();
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==="object"?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
const same=(left,right)=>JSON.stringify(stable(left))===JSON.stringify(stable(right));
const fileSignature=file=>({name:file?.name||"",size:Number(file?.size||0),lastModified:Number(file?.lastModified||0)});
const productionRows=rows=>(rows||[]).filter(row=>row.source===FANTRAX_PRODUCTION_SOURCE&&row.metric_type===FANTRAX_PRODUCTION_METRIC_TYPE);
function valueMetrics(metrics={}){return {fantasyPoints:metrics.fantasyPoints??null,fantasyPointsPerGame:metrics.fantasyPointsPerGame??null,fantraxId:metrics.fantraxId??null,positionEligibility:metrics.positionEligibility||[],statusEvidence:metrics.statusEvidence||null}}
function metricPlan(preview,existingMetrics=[]){
  const existingByPlayer=new Map(productionRows(existingMetrics).filter(row=>Number(row.season)===Number(preview.seasonContext?.seasonYear)).map(row=>[row.player_id,row])),inserted=[],updated=[],unchanged=[],nonWritable=[];
  for(const record of preview.records){
    if(record.status!=="AVAILABLE"){nonWritable.push(record);continue}
    const existing=existingByPlayer.get(record.playerId),prior=valueMetrics(existing?.metrics||{}),row=fantraxProductionMetricRow(record),next=valueMetrics(row.metrics);
    if(existing&&record.fantasyPointsPerGame===null&&prior.fantasyPointsPerGame!==null){row.metrics.fantasyPointsPerGame=prior.fantasyPointsPerGame;next.fantasyPointsPerGame=prior.fantasyPointsPerGame;row.metrics._fantraxProduction.warnings=[...row.metrics._fantraxProduction.warnings,"BLANK_FP_PER_GAME_PRESERVED_EXISTING_VALUE"]}
    if(!existing)inserted.push(row);
    else if(same(prior,next))unchanged.push(existing);
    else updated.push(row);
  }
  return {inserted,updated,unchanged,nonWritable,writeRows:[...inserted,...updated]};
}
function evidenceCounts(preview){
  const present=(record,key)=>clean(record.raw?.[key])!=="",invalid=(record,code)=>record.warnings.includes(code);
  return {rowsWithFantasyPoints:preview.records.filter(row=>present(row,"fantasyPoints")&&!invalid(row,"INVALID_FANTASY_POINTS")).length,rowsWithFantasyPointsPerGame:preview.records.filter(row=>present(row,"fantasyPointsPerGame")&&!invalid(row,"INVALID_FANTASY_POINTS_PER_GAME")).length,zeroFantasyPoints:preview.records.filter(row=>present(row,"fantasyPoints")&&row.fantasyPoints===0).length,missingFantasyPoints:preview.records.filter(row=>!present(row,"fantasyPoints")).length,invalidFantasyPoints:preview.records.filter(row=>invalid(row,"INVALID_FANTASY_POINTS")).length,zeroFantasyPointsPerGame:preview.records.filter(row=>present(row,"fantasyPointsPerGame")&&row.fantasyPointsPerGame===0).length,missingFantasyPointsPerGame:preview.records.filter(row=>!present(row,"fantasyPointsPerGame")).length,invalidFantasyPointsPerGame:preview.records.filter(row=>invalid(row,"INVALID_FANTASY_POINTS_PER_GAME")).length};
}
function reviewSignature(preview){return JSON.stringify(stable({leagueId:preview.leagueId,seasonContext:preview.seasonContext,file:preview.fileSignature,rows:preview.plan.writeRows.map(row=>({playerId:row.player_id,season:row.season,values:valueMetrics(row.metrics)})).sort((a,b)=>a.playerId.localeCompare(b.playerId))}))}
function metadata(preview,outcome=null){return {provider:FANTRAX_PRODUCTION_SOURCE,season:preview.seasonContext?.seasonYear??null,seasonContext:preview.seasonContext,filename:preview.sourceFilename,schemaSignature:"fantrax-players-16-header-18-row-v1",schema:{headers:[...FANTRAX_PLAYERS_HEADER],headerCount:16,rowValueCount:18},previewedAt:preview.createdAt,sourceRows:preview.counts.total,matched:preview.counts.matched,unmatched:preview.importCounts.unmatched,conflicts:preview.importCounts.conflicts,counts:preview.productionCounts,warnings:[...preview.warnings,...preview.identityFailures.slice(0,100),...preview.invalidRows.slice(0,100)],errors:preview.errors,...(outcome?{outcome}:{})}}

export async function previewFantraxProductionImport({leagueId,file,repositories={parseFile:parseCsvFile,league:leagueById,players:allPlayers,metrics:listMetrics}}={}){
  if(!leagueId)throw new Error("Active league is required.");if(!file)throw new Error("Choose a Fantrax Players CSV before previewing production.");
  const parsed=await repositories.parseFile(file),header=parsed[0]||[],rows=parsed.slice(1),[league,players,existingMetrics]=await Promise.all([repositories.league(leagueId),repositories.players(leagueId),repositories.metrics(leagueId)]);
  const createdAt=new Date().toISOString(),normalized=previewFantraxPlayerProduction({league,header,rows,players,sourceFilename:file.name||null,importedAt:createdAt}),plan=metricPlan(normalized,existingMetrics),productionCounts=evidenceCounts(normalized),errors=[];
  if(!normalized.seasonContext)errors.push({code:"SEASON_CONTEXT_UNAVAILABLE",message:"A valid reviewed Fantrax season context is required."});
  if(!plan.writeRows.length&&!plan.unchanged.length)errors.push({code:"NO_WRITABLE_PRODUCTION",message:"No exact, season-valid Fantrax production rows are available."});
  const importCounts={unmatched:normalized.identityFailures.filter(row=>row.identityResult!=="DUPLICATE").length,conflicts:normalized.identityFailures.filter(row=>row.identityResult==="DUPLICATE").length+normalized.duplicateSourceIds.length};
  const preview={...normalized,schema:"fantrax-production-import-preview-v1",createdAt,fileSignature:fileSignature(file),plan,productionCounts,importCounts,errors,status:errors.length?"BLOCKED":"READY"};
  preview.reviewSignature=reviewSignature(preview);preview.sourceMetadata=metadata(preview);return preview;
}
async function revalidate(reviewedPreview,file,repositories){
  if(reviewedPreview?.schema!=="fantrax-production-import-preview-v1"||reviewedPreview.status!=="READY")throw new Error("A ready reviewed Fantrax production preview is required.");
  if(Date.now()-Date.parse(reviewedPreview.createdAt)>PREVIEW_MAX_AGE_MS)throw new Error("Fantrax production preview is stale.");
  if(!same(reviewedPreview.fileSignature,fileSignature(file)))throw new Error("The selected Fantrax production file changed after preview.");
  const fresh=await previewFantraxProductionImport({leagueId:reviewedPreview.leagueId,file,repositories});
  if(fresh.status!=="READY"||fresh.reviewSignature!==reviewedPreview.reviewSignature)throw new Error("Fantrax production season, identity, file, or write plan changed after review.");
  return fresh;
}
export async function applyFantraxProductionImport({leagueId,file,reviewedPreview,reviewed=false,repositories={parseFile:parseCsvFile,league:leagueById,players:allPlayers,metrics:listMetrics,upsert:upsertFantraxProductionMetricRows,startJob:startFantraxProductionJob,finishJob:finishFantraxProductionJob}}={}){
  if(!reviewed)throw new Error("Explicit Fantrax production preview review is required.");
  if(reviewedPreview?.leagueId!==leagueId)throw new Error("Fantrax production preview league changed.");
  const fresh=await revalidate(reviewedPreview,file,repositories),sourceMetadata=metadata(fresh),plan=fresh.plan;let job,savedRows=[];
  try{
    job=await repositories.startJob(leagueId,{fileName:file.name,sourceMetadata});
    savedRows=await repositories.upsert(leagueId,plan.writeRows,{batchSize:250});const nonWritable=fresh.plan.nonWritable.length,status=nonWritable?"partial":"completed",outcome={unchanged:plan.unchanged.length,nonWritable,failed:0};
    const result={importType:"fantrax_player_production",status:status.toUpperCase(),processed:fresh.counts.total,matched:fresh.counts.matched,unmatched:fresh.importCounts.unmatched,conflicts:fresh.importCounts.conflicts,inserted:plan.inserted.length,updated:plan.updated.length,unchanged:plan.unchanged.length,failed:0,nonWritable,importJobId:job.id,saved:savedRows.length,sourceMetadata:{...sourceMetadata,outcome}};
    await repositories.finishJob(leagueId,job.id,{status,processed:result.processed,matched:result.matched,unmatched:result.unmatched,inserted:result.inserted,updated:result.updated,failed:result.failed,errors:fresh.identityFailures.slice(0,100),sourceMetadata:result.sourceMetadata});return result;
  }catch(error){
    const batch=error?.fantraxProductionBatchResult||{},savedIds=new Set(batch.savedPlayerIds||savedRows.map(row=>row.player_id)),savedCount=Number(batch.savedCount??savedRows.length),savedInserted=plan.inserted.filter(row=>savedIds.has(row.player_id)).length,savedUpdated=plan.updated.filter(row=>savedIds.has(row.player_id)).length,failed=Number(batch.remainingCount??Math.max(0,plan.writeRows.length-savedCount)),outcome={unchanged:plan.unchanged.length,nonWritable:plan.nonWritable.length,failed,savedPlayerIds:[...savedIds],failedPlayerIds:batch.failedPlayerIds||plan.writeRows.filter(row=>!savedIds.has(row.player_id)).map(row=>row.player_id)};
    if(job?.id)await repositories.finishJob(leagueId,job.id,{status:savedCount?"partial":"failed",processed:fresh.counts.total,matched:fresh.counts.matched,unmatched:fresh.importCounts.unmatched,inserted:savedInserted,updated:savedUpdated,failed,errors:[{message:String(error?.message||error),batch}],errorMessage:String(error?.message||error),sourceMetadata:{...sourceMetadata,outcome}}).catch(()=>{});
    if(!savedCount)throw error;
    return {importType:"fantrax_player_production",status:"PARTIAL",processed:fresh.counts.total,matched:fresh.counts.matched,unmatched:fresh.importCounts.unmatched,conflicts:fresh.importCounts.conflicts,inserted:savedInserted,updated:savedUpdated,unchanged:plan.unchanged.length,failed,nonWritable:plan.nonWritable.length,importJobId:job.id,saved:savedCount,error:String(error?.message||error),sourceMetadata:{...sourceMetadata,outcome}};
  }
}

export function fantraxProductionHealth({metricRows=[],importJobs=[],playerRows=[],league=null,now=Date.now(),staleAfterMs=36*60*60*1000,available=true,error=""}={}){
  if(!available)return {status:"UNAVAILABLE",error:error||"Fantrax production import history is unavailable."};
  const jobs=importJobs.filter(job=>job.import_type==="fantrax_player_production").sort((a,b)=>String(b.completed_at||b.started_at||b.created_at||"").localeCompare(String(a.completed_at||a.started_at||a.created_at||""))),latest=jobs[0]||null,meta=latest?.source_metadata||{},season=league?.settings?.fantraxSeasonContext?.seasonYear??null,rows=productionRows(metricRows).filter(row=>Number(row.season)===Number(season)),timestamp=latest?.completed_at||latest?.started_at||latest?.created_at||"",stale=Boolean(timestamp&&now-Date.parse(timestamp)>staleAfterMs);
  const withProduction=new Set(rows.filter(row=>row.metrics?.fantasyPoints!==null&&row.metrics?.fantasyPoints!==undefined).map(row=>row.player_id));
  if(!latest)return {status:"NEVER_RUN",season,playersWithProduction:withProduction.size,playersMissingProduction:Math.max(0,playerRows.length-withProduction.size),stale:false};
  return {status:String(latest.status||"").toUpperCase(),latestImportId:latest.id||null,season:meta.season??season,totalSourceRows:latest.rows_processed??meta.sourceRows??null,matched:latest.rows_matched??meta.matched??null,unmatched:latest.rows_unmatched??meta.unmatched??null,conflicts:meta.conflicts??null,playersWithProduction:withProduction.size,playersMissingProduction:Math.max(0,playerRows.length-withProduction.size),inserted:latest.rows_inserted??null,updated:latest.rows_updated??null,unchanged:meta.outcome?.unchanged??null,failed:latest.rows_failed??null,nonWritable:meta.outcome?.nonWritable??null,freshness:stale?"STALE":"FRESH",stale,source:meta.provider||FANTRAX_PRODUCTION_SOURCE,filename:meta.filename||latest.file_name||null,schema:meta.schema||null,schemaSignature:meta.schemaSignature||null,seasonContextStatus:Number(meta.season)===Number(season)&&season?"MATCH":"CONFLICTING",timestamp,error};
}
