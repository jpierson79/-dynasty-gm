const clean=value=>String(value??"").trim();
export const FANTRAX_SYNC_MANIFEST_VERSION="1";
export const FANTRAX_SYNC_TERMINAL_OUTCOMES=new Set(["APPLIED","SKIPPED"]);

function canonicalContext(context={}){
  return {externalLeagueId:clean(context.externalLeagueId),seasonYear:Number(context.seasonYear),leagueHistoryId:clean(context.leagueHistoryId)||null,leagueHistoryAvailable:Boolean(context.leagueHistoryAvailable)};
}

export function canonicalFantraxSyncManifest({leagueId,period="",seasonContext,updates=[]}={}){
  const rows=(updates||[]).map(update=>({playerId:clean(update.id),expectedOwnerTeamId:clean(update.expectedOwnerTeamId),previewedStatus:clean(update.currentRosterStatus).toUpperCase(),targetStatus:clean(update.roster_status).toUpperCase(),fantraxApiPlayerId:clean(update.fantraxApiPlayerId),fantraxTeamId:clean(update.fantraxTeamId)})).sort((a,b)=>a.playerId.localeCompare(b.playerId));
  return {version:FANTRAX_SYNC_MANIFEST_VERSION,leagueId:clean(leagueId),period:clean(period),seasonContext:canonicalContext(seasonContext),rows};
}

export function serializeFantraxSyncManifest(input){return JSON.stringify(canonicalFantraxSyncManifest(input))}

export async function fantraxSyncManifestDigest(input){
  const bytes=new TextEncoder().encode(serializeFantraxSyncManifest(input));
  const digest=await globalThis.crypto.subtle.digest("SHA-256",bytes);
  return [...new Uint8Array(digest)].map(value=>value.toString(16).padStart(2,"0")).join("");
}

export function validateFantraxSyncManifest(manifest={}){
  const errors=[],ids=new Set();
  if(!manifest.leagueId)errors.push("Active league is required for a synchronization audit.");
  if(manifest.period)errors.push("Only the Current Fantrax period can be audited for synchronization.");
  if(!/^[A-Za-z0-9]{16}$/.test(clean(manifest.seasonContext?.externalLeagueId))||!Number.isInteger(manifest.seasonContext?.seasonYear))errors.push("A valid reviewed Fantrax season context is required.");
  if(!manifest.rows?.length)errors.push("The reviewed synchronization manifest is empty.");
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
  const invalid=(attempts||[]).filter(row=>!row.manifest_digest||!row.actor_user_id||!row.season_context);
  return {incomplete,invalid,status:invalid.length?"FAIL":incomplete.length?"WARNING":"PASS"};
}
