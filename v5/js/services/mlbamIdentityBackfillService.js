import { fetchMlbIdentityCatalog } from "../providers/mlbStatsApiProvider.js";
import { allPlayers } from "../repositories/playerRepository.js";
import { applyReviewedMlbamBackfill } from "../repositories/mlbamIdentityRepository.js";

const PREVIEW_MAX_AGE_MS=15*60*1000;
const CLASSES=Object.freeze({EXACT:"EXACT",REVIEW:"REVIEW",AMBIGUOUS:"AMBIGUOUS",UNMATCHED:"UNMATCHED",EXISTING:"EXISTING"});
const REASONS=Object.freeze({
  EXACT_ORG_POSITION_ACTIVE:"Exact active candidate with authoritative organization and overlapping position.",
  MISSING_ORG_EVIDENCE:"Candidate organization does not provide the required authoritative agreement.",
  MISSING_POSITION_EVIDENCE:"Candidate position does not overlap the stored player position.",
  INACTIVE_PERSON:"Candidate is not active in the selected season catalog.",
  DUPLICATE_NAME:"Multiple MLB Stats candidates share the supported normalized name.",
  DUPLICATE_PROPOSED_MLBAM:"Multiple cloud player UUIDs propose the same MLBAM identity.",
  EXISTING_MLBAM_CONFLICT:"Proposed MLBAM identity is already stored on another cloud player.",
  NO_MLB_STATS_RESULT:"No candidate exists in the selected MLB Stats season catalog.",
  EXISTING_MLBAM_PRESERVED:"Existing MLBAM identity is preserved without a write.",
  PROVIDER_LOOKUP_FAILURE:"Provider input was unavailable or malformed.",
  OTHER_INSUFFICIENT_EVIDENCE:"Available evidence is insufficient for an exact match.",
  OTHER_UNMATCHED:"No safe MLB Stats identity could be established."
});
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
function withReason(row,reasonCode){return {...row,reasonCode,humanReason:REASONS[reasonCode]||REASONS.OTHER_INSUFFICIENT_EVIDENCE}}
export function resolveMlbamBackfill(playerRows,catalog){
  const existingGroups=new Map(),byName=new Map();
  for(const player of playerRows||[]){const id=clean(player.mlbam_id);if(id){if(!existingGroups.has(id))existingGroups.set(id,[]);existingGroups.get(id).push(player)}}
  for(const person of catalog?.people||[]){const key=normalizedName(person.fullName);if(!byName.has(key))byName.set(key,[]);byName.get(key).push(person)}
  const rows=(playerRows||[]).map(player=>{
    const base=baseRow(player),current=clean(player.mlbam_id);
    if(current)return withReason({...base,proposedMlbamId:current,matchClass:CLASSES.EXISTING,writeRecommended:false,evidence:["EXISTING_MLBAM_PRESERVED"],ambiguityReason:existingGroups.get(current)?.length>1?"DUPLICATE_EXISTING_MLBAM":""},"EXISTING_MLBAM_PRESERVED");
    const candidates=byName.get(normalizedName(player.name))||[];
    if(!candidates.length)return withReason({...base,proposedMlbamId:null,matchClass:CLASSES.UNMATCHED,writeRecommended:false,evidence:[],ambiguityReason:"NO_PERSON_CANDIDATE"},"NO_MLB_STATS_RESULT");
    if(candidates.length!==1)return withReason({...base,proposedMlbamId:null,matchClass:CLASSES.AMBIGUOUS,writeRecommended:false,evidence:["NAME_SUPPORT_ONLY"],ambiguityReason:"DUPLICATE_NAME_CANDIDATES",candidateMlbamIds:candidates.map(row=>row.mlbamId)},"DUPLICATE_NAME");
    const candidate=candidates[0],teamMatch=teamEvidence(player,candidate,catalog.teams||[]),positionMatch=overlaps(player.positions,candidate.primaryPosition),active=candidate.active!==false;
    const evidence=["NORMALIZED_NAME_SUPPORT",teamMatch?"AUTHORITATIVE_ORG_MATCH":"ORG_MISMATCH_OR_UNAVAILABLE",positionMatch?"POSITION_OVERLAP":"POSITION_MISMATCH_OR_UNAVAILABLE",active?"ACTIVE_PERSON":"INACTIVE_PERSON"];
    if(teamMatch&&positionMatch&&active)return withReason({...base,proposedMlbamId:candidate.mlbamId,matchClass:CLASSES.EXACT,writeRecommended:true,evidence,ambiguityReason:"",candidate},"EXACT_ORG_POSITION_ACTIVE");
    const reasonCode=!active?"INACTIVE_PERSON":!teamMatch?"MISSING_ORG_EVIDENCE":!positionMatch?"MISSING_POSITION_EVIDENCE":"OTHER_INSUFFICIENT_EVIDENCE";
    return withReason({...base,proposedMlbamId:candidate.mlbamId,matchClass:CLASSES.REVIEW,writeRecommended:false,evidence,ambiguityReason:!active?"INACTIVE_OR_RETIRED":!teamMatch?"TEAM_EVIDENCE_REQUIRED":"POSITION_EVIDENCE_REQUIRED",candidate},reasonCode);
  });
  const proposed=new Map();rows.filter(row=>row.currentMlbamId===null&&clean(row.proposedMlbamId)).forEach(row=>{const id=clean(row.proposedMlbamId);if(!proposed.has(id))proposed.set(id,[]);proposed.get(id).push(row)});
  for(const [mlbamId,group] of proposed)if(new Set(group.map(row=>row.playerId)).size>1){const conflicts=group.map(row=>({playerId:row.playerId,playerName:row.playerName}));group.forEach(row=>Object.assign(row,withReason({...row,matchClass:CLASSES.AMBIGUOUS,writeRecommended:false,ambiguityReason:"DUPLICATE_PROPOSED_MLBAM",conflictingProposedMlbamId:mlbamId,conflictingPlayers:conflicts},"DUPLICATE_PROPOSED_MLBAM")))}
  rows.filter(row=>row.currentMlbamId===null&&clean(row.proposedMlbamId)&&existingGroups.has(clean(row.proposedMlbamId))).forEach(row=>Object.assign(row,withReason({...row,matchClass:CLASSES.AMBIGUOUS,writeRecommended:false,ambiguityReason:"CONFLICTING_EXISTING_MLBAM",conflictingPlayerIds:existingGroups.get(clean(row.proposedMlbamId)).map(player=>player.id)},"EXISTING_MLBAM_CONFLICT")));
  const reasonCounts=Object.fromEntries([...new Set(rows.map(row=>row.reasonCode))].sort().map(code=>[code,rows.filter(row=>row.reasonCode===code).length]));
  const summary={total:rows.length,missing:rows.filter(row=>row.currentMlbamId===null).length,exact:rows.filter(row=>row.matchClass===CLASSES.EXACT).length,review:rows.filter(row=>row.matchClass===CLASSES.REVIEW).length,ambiguous:rows.filter(row=>row.matchClass===CLASSES.AMBIGUOUS).length,unmatched:rows.filter(row=>row.matchClass===CLASSES.UNMATCHED).length,existing:rows.filter(row=>row.matchClass===CLASSES.EXISTING).length,duplicateProposed:[...proposed.values()].filter(group=>new Set(group.map(row=>row.playerId)).size>1).length,duplicateExisting:[...existingGroups.values()].filter(group=>group.length>1).length,providerFailures:(catalog?.invalid||[]).length,reasonCounts};
  summary.classPercentages=Object.fromEntries(["exact","review","ambiguous","unmatched","existing"].map(key=>[key,summary.total?Number((100*summary[key]/summary.total).toFixed(2)):0]));
  summary.missingClassPercentages=Object.fromEntries(["exact","review","ambiguous","unmatched"].map(key=>[key,summary.missing?Number((100*summary[key]/summary.missing).toFixed(2)):0]));
  return {rows,summary};
}

export function queryMlbamPreviewRows(preview,{matchClass="ALL",reasonCode="ALL",search="",page=1,pageSize=50}={}){
  const needle=normalizedName(search),size=Math.max(1,Math.min(250,Number(pageSize)||50));
  const filtered=(preview?.rows||[]).filter(row=>(matchClass==="ALL"||row.matchClass===matchClass)&&(reasonCode==="ALL"||row.reasonCode===reasonCode)&&(!needle||normalizedName(`${row.playerName} ${row.playerId} ${row.fantraxId} ${row.fantraxApiPlayerId} ${row.currentMlbamId} ${row.proposedMlbamId}`).includes(needle)));
  const pageCount=Math.max(1,Math.ceil(filtered.length/size)),currentPage=Math.max(1,Math.min(pageCount,Number(page)||1)),start=(currentPage-1)*size;
  return {rows:filtered.slice(start,start+size),total:filtered.length,page:currentPage,pageSize:size,pageCount};
}
function csvCell(value){const text=Array.isArray(value)?value.join("|"):typeof value==="object"&&value?JSON.stringify(value):String(value??"");return `"${text.replaceAll('"','""')}"`}
export function buildMlbamReviewCsv(preview){
  const headers=["player_uuid","player_name","fantrax_id","fantrax_api_id","stored_organization","stored_positions","existing_mlbam","proposed_mlbam","candidate_team","candidate_parent_organization","candidate_position","active_person","classification","writable","reason_code","human_reason","evidence","conflicting_mlbam","conflicting_player_uuids","conflicting_player_names"];
  const rows=(preview?.rows||[]).map(row=>{const conflicts=row.conflictingPlayers||[];return [row.playerId,row.playerName,row.fantraxId,row.fantraxApiPlayerId,row.mlbTeam,row.positions,row.currentMlbamId,row.proposedMlbamId,row.candidate?.currentTeam?.name,row.candidate?.currentTeam?.parentOrgName,row.candidate?.primaryPosition,row.candidate?.active,row.matchClass,row.writeRecommended?"YES":"NO",row.reasonCode,row.humanReason,row.evidence,row.conflictingProposedMlbamId||"",conflicts.length?conflicts.map(item=>item.playerId):row.conflictingPlayerIds||[],conflicts.map(item=>item.playerName)];});
  return [headers,...rows].map(row=>row.map(csvCell).join(",")).join("\r\n");
}
export function downloadMlbamReviewCsv(preview,{season,documentRef=globalThis.document,urlApi=globalThis.URL,BlobCtor=globalThis.Blob,defer=globalThis.setTimeout}={}){
  if(!documentRef?.createElement||!urlApi?.createObjectURL||!BlobCtor||!defer)throw new Error("Browser download support is unavailable.");
  const csv=buildMlbamReviewCsv(preview),url=urlApi.createObjectURL(new BlobCtor([csv],{type:"text/csv;charset=utf-8"})),link=documentRef.createElement("a");
  link.href=url;link.download=`mlbam-identity-full-evidence-${season||preview?.season||"unknown"}.csv`;link.style.display="none";documentRef.body?.appendChild(link);link.click();
  defer(()=>{link.remove?.();urlApi.revokeObjectURL(url)},0);
  return {filename:link.download,rowCount:preview?.rows?.length||0};
}
export function hypotheticalStatcastCoverage(mlbamPreview,statcastPreview){
  if(!mlbamPreview||mlbamPreview.status!=="READY"||!statcastPreview?.snapshot?.rows)return {status:"UNAVAILABLE",error:"Both ready MLBAM and Statcast previews are required."};
  const safe=new Set(mlbamPreview.rows.filter(row=>row.matchClass===CLASSES.EXACT&&row.writeRecommended).map(row=>clean(row.proposedMlbamId))),current=new Set((statcastPreview.resolution?.matched||[]).map(item=>clean(item.row?.mlbamId)));
  const fetched=statcastPreview.snapshot.rows.length,hypothetical=statcastPreview.snapshot.rows.filter(row=>current.has(clean(row.mlbamId))||safe.has(clean(row.mlbamId))).length;
  return {status:"AVAILABLE",playerType:statcastPreview.playerType,fetched,currentlyMatchable:statcastPreview.resolution?.matched?.length||0,hypotheticallyMatchable:hypothetical,remainingUnmatched:fetched-hypothetical,coveragePercent:fetched?Number((100*hypothetical/fetched).toFixed(2)):0};
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
  return {status:"AVAILABLE",lastPreviewAt:preview.createdAt,...preview.summary,hypotheticalStatcast:preview.hypotheticalStatcast||{}};
}
export const MLBAM_MATCH_CLASSES=CLASSES;
export const MLBAM_REASON_DESCRIPTIONS=REASONS;
