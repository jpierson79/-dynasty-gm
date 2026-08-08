const clean=value=>String(value??"").trim();
export const FANTRAX_SYNC_MANIFEST_VERSION="2";
export const FANTRAX_SYNC_TERMINAL_OUTCOMES=new Set(["APPLIED","SKIPPED"]);

function canonicalContext(context={}){
  return {externalLeagueId:clean(context.externalLeagueId),seasonYear:Number(context.seasonYear),leagueHistoryId:clean(context.leagueHistoryId)||null,leagueHistoryAvailable:Boolean(context.leagueHistoryAvailable)};
}

function canonicalRows(updates=[]){
  return (updates||[]).map(update=>({playerId:clean(update.id),expectedOwnerTeamId:clean(update.expectedOwnerTeamId),previewedStatus:clean(update.currentRosterStatus).toUpperCase(),targetStatus:clean(update.roster_status).toUpperCase(),fantraxApiPlayerId:clean(update.fantraxApiPlayerId),fantraxTeamId:clean(update.fantraxTeamId)})).sort((a,b)=>a.playerId.localeCompare(b.playerId));
}

export function canonicalFantraxSyncManifest({leagueId,period="",seasonContext,updates=[],releaseTier,effectiveCap}={}){
  return {version:FANTRAX_SYNC_MANIFEST_VERSION,leagueId:clean(leagueId),period:clean(period),releaseTier:clean(releaseTier),effectiveCap:Number(effectiveCap),seasonContext:canonicalContext(seasonContext),rows:canonicalRows(updates)};
}

export function serializeFantraxSyncManifest(input){return JSON.stringify(canonicalFantraxSyncManifest(input))}

export function canonicalFantraxSyncManifestV1({leagueId,period="",seasonContext,updates=[]}={}){
  return {version:"1",leagueId:clean(leagueId),period:clean(period),seasonContext:canonicalContext(seasonContext),rows:canonicalRows(updates)};
}

export function serializeFantraxSyncManifestV1(input){return JSON.stringify(canonicalFantraxSyncManifestV1(input))}

async function sha256(value){
  const bytes=new TextEncoder().encode(value),digest=await globalThis.crypto.subtle.digest("SHA-256",bytes);
  return [...new Uint8Array(digest)].map(item=>item.toString(16).padStart(2,"0")).join("");
}

export async function fantraxSyncManifestDigest(input){
  return sha256(serializeFantraxSyncManifest(input));
}

export async function fantraxSyncManifestDigestV1(input){return sha256(serializeFantraxSyncManifestV1(input))}

export function validateFantraxSyncManifest(manifest={}){
  const errors=[],ids=new Set();
  const legacy=clean(manifest.version)==="1",releaseTier=legacy?"CONTROLLED_3":clean(manifest.releaseTier),effectiveCap=legacy?3:Number(manifest.effectiveCap);
  if(!manifest.leagueId)errors.push("Active league is required for a synchronization audit.");
  if(manifest.period)errors.push("Only the Current Fantrax period can be audited for synchronization.");
  if(!["CONTROLLED_3","V5.4.6E_OPT_IN_10"].includes(releaseTier))errors.push("A recognized Fantrax synchronization release tier is required.");
  const requiredCap=releaseTier==="V5.4.6E_OPT_IN_10"?10:3;
  if(!Number.isInteger(effectiveCap)||effectiveCap!==requiredCap)errors.push("The synchronization manifest cap does not match its release tier.");
  if(!/^[A-Za-z0-9]{16}$/.test(clean(manifest.seasonContext?.externalLeagueId))||!Number.isInteger(manifest.seasonContext?.seasonYear))errors.push("A valid reviewed Fantrax season context is required.");
  if(!manifest.rows?.length)errors.push("The reviewed synchronization manifest is empty.");
  if((manifest.rows?.length||0)>requiredCap)errors.push(`The reviewed synchronization manifest exceeds its ${requiredCap}-player release cap.`);
  (manifest.rows||[]).forEach(row=>{
    if(!row.playerId||ids.has(row.playerId))errors.push(`Invalid or duplicate player UUID ${row.playerId||"(blank)"}.`);
    ids.add(row.playerId);
    if(!row.expectedOwnerTeamId||!row.previewedStatus||!row.targetStatus||!row.fantraxApiPlayerId||!row.fantraxTeamId)errors.push(`Incomplete reviewed identity or status fields for ${row.playerId||"a player"}.`);
  });
  return {valid:errors.length===0,errors:[...new Set(errors)]};
}

export function pendingFantraxSyncUpdates(manifest={},auditItems=[]){
  const terminal=new Set((auditItems||[]).filter(item=>FANTRAX_SYNC_TERMINAL_OUTCOMES.has(clean(item.outcome))).map(item=>clean(item.player_id||item.playerId)));
  return (manifest.rows||[]).filter(row=>!terminal.has(row.playerId)).map(row=>({id:row.playerId,expectedOwnerTeamId:row.expectedOwnerTeamId,currentRosterStatus:row.previewedStatus,roster_status:row.targetStatus,fantraxApiPlayerId:row.fantraxApiPlayerId,fantraxTeamId:row.fantraxTeamId}));
}

export function validatePreparedFantraxSyncAttempt(attempt={},manifest={},digest=""){
  const errors=[],items=attempt.fantrax_sync_attempt_items||[],byPlayer=new Map(items.map(item=>[clean(item.player_id),item]));
  const legacy=clean(manifest.version)==="1",releaseTier=legacy?"CONTROLLED_3":clean(manifest.releaseTier),effectiveCap=legacy?3:Number(manifest.effectiveCap);
  if(clean(attempt.manifest_digest)!==clean(digest))errors.push("The durable attempt digest does not match the reviewed manifest.");
  if(clean(attempt.manifest_version)!==clean(manifest.version)||clean(attempt.release_tier)!==releaseTier||Number(attempt.batch_limit)!==effectiveCap||Number(attempt.reviewed_count)!==manifest.rows?.length)errors.push("The durable attempt release metadata does not match the reviewed manifest.");
  if(items.length!==manifest.rows?.length)errors.push("The durable attempt does not contain the complete reviewed item set.");
  (manifest.rows||[]).forEach((row,ordinal)=>{
    const item=byPlayer.get(row.playerId);
    if(!item||Number(item.ordinal)!==ordinal||clean(item.league_id)!==clean(manifest.leagueId)||clean(item.expected_owner_team_id)!==row.expectedOwnerTeamId||clean(item.previewed_status)!==row.previewedStatus||clean(item.target_status)!==row.targetStatus||clean(item.fantrax_api_player_id)!==row.fantraxApiPlayerId||clean(item.fantrax_team_id)!==row.fantraxTeamId)errors.push(`Durable audit item mismatch for ${row.playerId}.`);
  });
  return {valid:errors.length===0,errors:[...new Set(errors)]};
}

export function fantraxSyncAttemptStatus(items=[]){
  if(!items.length)return "FAILED";
  if(items.some(item=>clean(item.outcome)==="PENDING"))return "PARTIAL";
  if(items.some(item=>["FAILED","SKIPPED"].includes(clean(item.outcome))))return "PARTIAL";
  return "COMPLETED";
}

export function fantraxSyncOutcomeRows(attemptId,result={}){
  const rows=[];
  (result.updated||[]).forEach(row=>rows.push({attempt_id:attemptId,player_id:row.id,outcome:"APPLIED",reason:null,detail:{rosterStatus:row.roster_status},applied_at:row.updated_at||new Date().toISOString()}));
  (result.skipped||[]).forEach(row=>rows.push({attempt_id:attemptId,player_id:row.id,outcome:"SKIPPED",reason:row.reason||"UNKNOWN",detail:{currentRow:row.currentRow||null}}));
  const recorded=new Set(rows.map(row=>row.player_id));
  (result.failures||[]).flatMap(failure=>failure.playerIds||[]).filter(id=>!recorded.has(id)).forEach(id=>rows.push({attempt_id:attemptId,player_id:id,outcome:"FAILED",reason:"WRITE_FAILED_OR_NOT_ATTEMPTED",detail:{writeFailure:true}}));
  return rows;
}

export function fantraxSyncAuditHealth(attempts=[]){
  const incomplete=(attempts||[]).filter(row=>!["COMPLETED","ABANDONED"].includes(clean(row.status)));
  const releaseIssues=(attempts||[]).filter(row=>{
    const tier=clean(row.release_tier),cap=Number(row.batch_limit),reviewed=Number(row.reviewed_count),expected=tier==="CONTROLLED_3"?3:tier==="V5.4.6E_OPT_IN_10"?10:0;
    return !expected||cap!==expected||!Number.isInteger(reviewed)||reviewed<1||reviewed>cap;
  });
  const invalid=(attempts||[]).filter(row=>!row.manifest_digest||!row.actor_user_id||!row.season_context||releaseIssues.includes(row));
  return {incomplete,invalid,releaseIssues,status:invalid.length?"FAIL":incomplete.length?"WARNING":"PASS"};
}
