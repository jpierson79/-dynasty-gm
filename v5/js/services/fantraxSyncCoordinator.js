import { applyFantraxRosterStatuses } from "../repositories/playerRepository.js?v5-4-6b2-reviewed-sync";
import { finalizeFantraxSyncAttempt, findFantraxSyncAttempt, markFantraxSyncAttemptApplying, prepareFantraxSyncAttempt, recordFantraxSyncOutcomes } from "../repositories/fantraxSyncAuditRepository.js?v5-4-6e-opt-in";
import { canonicalFantraxSyncManifest, canonicalFantraxSyncManifestV1, fantraxSyncAttemptStatus, fantraxSyncManifestDigest, fantraxSyncManifestDigestV1, fantraxSyncOutcomeRows, pendingFantraxSyncUpdates, validateFantraxSyncManifest, validatePreparedFantraxSyncAttempt } from "./fantraxSyncAuditService.js?v5-4-6e-opt-in";

const productionDependencies={
  applyFantraxRosterStatuses,
  canonicalFantraxSyncManifest,
  canonicalFantraxSyncManifestV1,
  fantraxSyncAttemptStatus,
  fantraxSyncManifestDigest,
  fantraxSyncManifestDigestV1,
  fantraxSyncOutcomeRows,
  finalizeFantraxSyncAttempt,
  findFantraxSyncAttempt,
  markFantraxSyncAttemptApplying,
  pendingFantraxSyncUpdates,
  prepareFantraxSyncAttempt,
  recordFantraxSyncOutcomes,
  validateFantraxSyncManifest,
  validatePreparedFantraxSyncAttempt
};

export async function prepareReviewedFantraxSync(manifestInput,{allowCreate=true,dependencies=productionDependencies}={}){
  const d=dependencies,leagueId=manifestInput?.leagueId;
  let manifest=d.canonicalFantraxSyncManifest(manifestInput),validation=d.validateFantraxSyncManifest(manifest);
  if(!validation.valid)throw new Error(validation.errors.join(" "));
  let digest=await d.fantraxSyncManifestDigest(manifestInput),attempt=await d.findFantraxSyncAttempt(leagueId,digest);
  if(!attempt&&manifestInput?.releaseTier==="CONTROLLED_3"){
    const legacyManifest=d.canonicalFantraxSyncManifestV1(manifestInput),legacyDigest=await d.fantraxSyncManifestDigestV1(manifestInput),legacyAttempt=await d.findFantraxSyncAttempt(leagueId,legacyDigest);
    if(legacyAttempt){manifest=legacyManifest;digest=legacyDigest;attempt=legacyAttempt}
  }
  if(!attempt)attempt=await d.prepareFantraxSyncAttempt(leagueId,{digest,manifest,allowCreate});
  const durable=d.validatePreparedFantraxSyncAttempt(attempt,manifest,digest);
  if(!durable.valid)throw new Error(durable.errors.join(" "));
  const remaining=d.pendingFantraxSyncUpdates(manifest,attempt.fantrax_sync_attempt_items||[]);
  if(!remaining.length)throw new Error("This reviewed Fantrax synchronization manifest already has terminal outcomes and cannot be replayed.");
  return {attempt,digest,manifest,remaining};
}

export async function executeReviewedFantraxSync({manifestInput,allowCreate=true,beforeAttempt=()=>{},beforeGroup=()=>{},dependencies=productionDependencies}={}){
  const d=dependencies;
  await beforeAttempt();
  const prepared=await prepareReviewedFantraxSync(manifestInput,{allowCreate,dependencies:d});
  await beforeAttempt(prepared);
  await d.markFantraxSyncAttemptApplying(manifestInput.leagueId,prepared.attempt.id);
  const result=await d.applyFantraxRosterStatuses(manifestInput.leagueId,prepared.remaining,{beforeGroup});
  const recorded=await d.recordFantraxSyncOutcomes(manifestInput.leagueId,prepared.attempt.id,d.fantraxSyncOutcomeRows(prepared.attempt.id,result));
  const recordedByPlayer=new Map(recorded.map(item=>[item.player_id,item]));
  const auditItems=(prepared.attempt.fantrax_sync_attempt_items||[]).map(item=>recordedByPlayer.get(item.player_id)||item);
  const status=d.fantraxSyncAttemptStatus(auditItems);
  await d.finalizeFantraxSyncAttempt(manifestInput.leagueId,prepared.attempt.id,status);
  return {...prepared,result,auditItems,status};
}

export { productionDependencies as fantraxSyncProductionDependencies };
