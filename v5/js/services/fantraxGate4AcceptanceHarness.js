import { canonicalFantraxSyncManifest, fantraxSyncManifestDigest, validateFantraxSyncManifest } from "./fantraxSyncAuditService.js?v5-4-6e-opt-in";
import { controlledFantraxRosterSelection, fantraxRosterSyncPeriodGuard, fantraxRosterSyncReleasePolicy, fantraxRosterSyncReleaseSignature, validateControlledFantraxStatusUpdates } from "./fantraxRosterSyncService.js?v5-4-6e-opt-in";
import { fantraxSeasonWriteGuard } from "./fantraxSeasonContextService.js?v5-4-6c-season";
import { executeReviewedFantraxSync } from "./fantraxSyncCoordinator.js";
import { fetchFantraxPublicPreview, normalizeFantraxPreviewState } from "./fantraxPublicPreviewService.js?v5-4-6e-gate4d3a-preview-shape";
import { currentUser } from "../repositories/leagueRepository.js?v5-4-6c-season";
import { listFantraxSyncAttempts } from "../repositories/fantraxSyncAuditRepository.js?v5-4-6e-opt-in";
import { appState } from "../state/appState.js?v5-4-6e-gate4c1-auth-state";

export const GATE4_EXPECTED_LEAGUE_ID="6573ac24-f433-48c7-a834-ffe6b58726bc";
export const GATE4_CANDIDATE_COUNT=10;
export const GATE4_RELEASE_TIER="V5.4.6E_OPT_IN_10";
export const GATE4_CHECKPOINTS=["authenticatedUser","activeLeague","auditBaseline","gateA","previewA","candidates","protectedBaseline","optInTransition","previewAInvalidated","previewB","gateB","manifest","preWriteGuards","humanConfirmation","persistence","auditOutcomes","protectedComparison","postWriteAgreement","replayRejection","optInDisabled"];

const clean=value=>String(value??"").trim();
const stable=value=>{
  if(Array.isArray(value))return value.map(stable);
  if(value&&typeof value==="object")return Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])]));
  return value;
};
export function serializeGate4Evidence(value){return JSON.stringify(stable(value))}
export async function gate4EvidenceDigest(value){
  const bytes=new TextEncoder().encode(serializeGate4Evidence(value));
  const digest=await crypto.subtle.digest("SHA-256",bytes);
  return [...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,"0")).join("");
}
function shortDigest(value){let hash=2166136261;for(const character of serializeGate4Evidence(value)){hash^=character.charCodeAt(0);hash=Math.imul(hash,16777619)}return (hash>>>0).toString(16).padStart(8,"0")}
function requirePass(checkpoints,names){
  const missing=names.filter(name=>checkpoints[name]?.status!=="PASS");
  if(missing.length)throw new Error(`Required Gate 4 checkpoints are not PASS: ${missing.join(", ")}.`);
}
function exactCandidateProjection(row){return {id:clean(row.id),name:clean(row.name),fantraxApiPlayerId:clean(row.fantraxApiPlayerId),fantraxTeamId:clean(row.fantraxTeamId),expectedOwnerTeamId:clean(row.expectedOwnerTeamId),currentRosterStatus:clean(row.currentRosterStatus),roster_status:clean(row.roster_status),rosterStatusSource:clean(row.rosterStatusSource),rosterStatusOverrideAt:clean(row.rosterStatusOverrideAt),rosterStatusOverrideBy:clean(row.rosterStatusOverrideBy),recommendation:clean(row.recommendation)}}
function canonicalLiveContext(currentState){
  const league=currentState?.activeLeague,preview=currentState?.fantraxPreview||{};
  return {authUserId:clean(currentState?.authUser?.id),leagueId:clean(league?.id),releaseSetting:stable(league?.settings?.fantraxRosterSyncRelease||null),period:clean(preview.period),externalLeagueId:clean(preview.externalLeagueId),previewFetchedAt:clean(preview.data?.fetchedAt),seasonContext:stable(preview.data?.seasonContextComparison||null),candidateIds:[...(preview.rosterSyncSelectedIds||[])].map(clean).sort()};
}

export function createGate4AcceptanceHarness({artifactCommit="",persistenceAuthority=false,dependencies={}}={}){
  const d={appState,canonicalFantraxSyncManifest,controlledFantraxRosterSelection,currentUser,executeReviewedFantraxSync,fantraxRosterSyncPeriodGuard,fantraxRosterSyncReleasePolicy,fantraxRosterSyncReleaseSignature,fantraxSeasonWriteGuard,fantraxSyncManifestDigest,fetchFantraxPublicPreview,listFantraxSyncAttempts,liveContext:()=>canonicalLiveContext(appState),normalizeFantraxPreviewState,validateControlledFantraxStatusUpdates,validateFantraxSyncManifest,...dependencies};
  const state={artifactCommit:clean(artifactCommit),checkpoints:{},candidateIds:[],previewA:null,previewB:null,manifest:null,manifestDigest:"",humanDigest:"",armedContextDigest:"",armingError:"",persistenceAuthority:Boolean(persistenceAuthority),persistenceAvailable:false,persistenceExecutable:false,armed:false,persistenceCalled:false};
  const refreshPersistenceState=()=>{
    const ready=["authenticatedUser","activeLeague","auditBaseline","gateA","candidates","protectedBaseline","optInTransition","previewAInvalidated","previewB","gateB","manifest","preWriteGuards"].every(name=>state.checkpoints[name]?.status==="PASS");
    state.persistenceAvailable=Boolean(state.persistenceAuthority&&!state.persistenceCalled&&ready&&state.manifest?.version==="2"&&state.manifestDigest);
    state.persistenceExecutable=Boolean(state.persistenceAvailable&&state.armed&&!state.persistenceCalled);
  };
  const set=(name,result,reasons=[],evidence={})=>{const prerequisiteDigests=Object.fromEntries(Object.entries(state.checkpoints).map(([key,value])=>[key,value.digest]));const payload={version:"gate4d-1",artifactCommit:state.artifactCommit,name,status:result,reasons:[...reasons],evidence:stable(evidence),prerequisiteDigests};state.checkpoints[name]=Object.freeze({...payload,timestamp:new Date().toISOString(),digest:shortDigest(payload)});refreshPersistenceState();return state.checkpoints[name]};
  const invalidateFrom=name=>{const index=GATE4_CHECKPOINTS.indexOf(name);GATE4_CHECKPOINTS.slice(index).forEach(key=>delete state.checkpoints[key]);state.armed=false;state.armedContextDigest="";state.humanDigest="";state.armingError="";refreshPersistenceState()};
  const authorizationContext=()=>({liveContext:d.liveContext(),protectedDigest:state.checkpoints.protectedBaseline?.evidence?.digest||""});
  const verifyCurrentWriteContext=async()=>{
    const liveUser=await d.currentUser(),live=d.appState,preview=live?.fantraxPreview||{},policy=d.fantraxRosterSyncReleasePolicy(live?.activeLeague),period=d.fantraxRosterSyncPeriodGuard(preview.period),season=d.fantraxSeasonWriteGuard(preview.data?.seasonContextComparison),validation=d.validateControlledFantraxStatusUpdates(preview.data?.rosterItems||[],state.candidateIds,policy.effectiveCap),current=(validation.updates||[]).map(exactCandidateProjection).sort((a,b)=>a.id.localeCompare(b.id)),reviewed=state.checkpoints.gateB?.evidence?.rows||[],manifestDigest=await d.fantraxSyncManifestDigest(state.manifestInput),liveContextDigest=await gate4EvidenceDigest(authorizationContext());
    const valid=liveUser?.id===state.checkpoints.authenticatedUser?.evidence?.id&&live?.activeLeague?.id===GATE4_EXPECTED_LEAGUE_ID&&policy.valid&&policy.optedIn&&policy.releaseTier===GATE4_RELEASE_TIER&&policy.effectiveCap===10&&period.valid&&season.valid&&clean(preview.data?.fetchedAt)===clean(state.previewB?.data?.fetchedAt)&&clean(preview.externalLeagueId)===clean(state.previewB?.externalLeagueId)&&validation.valid&&current.length===GATE4_CANDIDATE_COUNT&&serializeGate4Evidence(current)===serializeGate4Evidence(reviewed)&&manifestDigest===state.manifestDigest&&state.manifest?.version==="2"&&liveContextDigest===state.armedContextDigest;
    if(!valid)throw new Error("Gate 4 authorization was invalidated by authentication, league, preview, candidate, release, season, period, protected baseline, manifest, or digest drift.");
    return true;
  };
  return {
    state,
    async recordAuthenticatedUser(){invalidateFrom("authenticatedUser");let user=null;try{user=await d.currentUser()}catch(error){return set("authenticatedUser","UNAVAILABLE",[String(error?.message||error)],{artifactCommit:state.artifactCommit})}const rendered=d.appState?.authUser,valid=Boolean(user?.id)&&rendered?.id===user.id;return set("authenticatedUser",valid?"PASS":"UNAVAILABLE",valid?[]:["The canonical authenticated repository and rendered auth state do not identify the same user."],valid?{id:user.id,email:user.email||"",artifactCommit:state.artifactCommit}:{artifactCommit:state.artifactCommit})},
    recordActiveLeague(){requirePass(state.checkpoints,["authenticatedUser"]);invalidateFrom("activeLeague");const league=d.appState?.activeLeague,policy=d.fantraxRosterSyncReleasePolicy(league),valid=league?.id===GATE4_EXPECTED_LEAGUE_ID&&league?.name==="Reddit Phanatics";return set("activeLeague",valid?"PASS":"FAIL",valid?[]:["The active league is not the exact Reddit Phanatics league."],valid?{id:league.id,name:league.name,releaseSignature:d.fantraxRosterSyncReleaseSignature(policy)}:{id:league?.id||"",name:league?.name||""})},
    async loadAuditBaseline(){requirePass(state.checkpoints,["activeLeague"]);let attempts;try{attempts=await d.listFantraxSyncAttempts(GATE4_EXPECTED_LEAGUE_ID)}catch(error){return this.recordAuditBaseline(null,String(error?.message||error))}return this.recordAuditBaseline(attempts)},
    recordAuditBaseline(attempts,error=""){requirePass(state.checkpoints,["activeLeague"]);invalidateFrom("auditBaseline");if(!Array.isArray(attempts))return set("auditBaseline","UNAVAILABLE",[error||"Fantrax synchronization audit history is unavailable."],{});const items=attempts.flatMap(row=>row.fantrax_sync_attempt_items||[]);return set("auditBaseline","PASS",[],{attemptCount:attempts.length,itemCount:items.length,attemptIds:attempts.map(row=>row.id).sort()})},
    recordGateA(readiness={}){requirePass(state.checkpoints,["auditBaseline"]);invalidateFrom("gateA");const failures=Object.entries(readiness).filter(([,value])=>value!==true).map(([key])=>`${key} is not ready.`);return set("gateA",failures.length?"FAIL":"PASS",failures,readiness)},
    recordPreviewA(preview){requirePass(state.checkpoints,["gateA"]);invalidateFrom("previewA");const period=d.fantraxRosterSyncPeriodGuard(preview?.period),season=d.fantraxSeasonWriteGuard(preview?.data?.seasonContextComparison);if(!period.valid||!season.valid)return set("previewA","FAIL",[period.error,season.error].filter(Boolean),{});state.previewA=preview;return set("previewA","PASS",[],{fetchedAt:preview.data?.fetchedAt,externalLeagueId:preview.externalLeagueId,period:preview.period||"",seasonContext:preview.data?.seasonContextComparison?.observed})},
    async fetchPreviewA(input){const response=await d.fetchFantraxPublicPreview({...input,period:""}),preview=d.normalizeFantraxPreviewState(response);return this.recordPreviewA({...preview,externalLeagueId:input.externalLeagueId,period:""})},
    reviewCandidates(ids=[],rosterItems=[]){requirePass(state.checkpoints,["previewA"]);invalidateFrom("candidates");const unique=[...new Set(ids.map(clean).filter(Boolean))];if(unique.length!==GATE4_CANDIDATE_COUNT)return set("candidates","FAIL",[`Exactly ${GATE4_CANDIDATE_COUNT} unique player UUIDs are required.`],{requestedCount:unique.length});const validation=d.validateControlledFantraxStatusUpdates(rosterItems,unique,GATE4_CANDIDATE_COUNT);if(!validation.valid||validation.updates?.length!==GATE4_CANDIDATE_COUNT)return set("candidates","FAIL",validation.errors||["The exact candidate set is not eligible."],{});const projected=validation.updates.map(exactCandidateProjection).sort((a,b)=>a.id.localeCompare(b.id));if(projected.some(row=>row.recommendation&&row.recommendation!=="APPLY_FANTRAX_STATUS"||row.rosterStatusSource==="MANUAL"||row.rosterStatusOverrideAt||row.rosterStatusOverrideBy||!row.fantraxApiPlayerId||!row.fantraxTeamId||!row.expectedOwnerTeamId||row.roster_status==="UNCLASSIFIED"))return set("candidates","FAIL",["A candidate violates exact identity, ownership, known-status, or manual-override protection."],{});state.candidateIds=unique;return set("candidates","PASS",[],{rows:projected})},
    async recordProtectedBaseline(summary){requirePass(state.checkpoints,["candidates"]);invalidateFrom("protectedBaseline");const digest=await gate4EvidenceDigest(summary);return set("protectedBaseline","PASS",[],{digest,summary})},
    recordOptInTransition(beforeLeague,afterLeague){requirePass(state.checkpoints,["protectedBaseline"]);invalidateFrom("optInTransition");const before=d.fantraxRosterSyncReleasePolicy(beforeLeague),after=d.fantraxRosterSyncReleasePolicy(afterLeague),valid=!before.optedIn&&after.optedIn&&after.releaseTier===GATE4_RELEASE_TIER&&after.effectiveCap===10&&beforeLeague?.id===afterLeague?.id&&afterLeague?.id===GATE4_EXPECTED_LEAGUE_ID;if(!valid)return set("optInTransition","FAIL",["The exact reviewed expanded opt-in transition was not observed."],{});set("optInTransition","PASS",[],{before:d.fantraxRosterSyncReleaseSignature(before),after:d.fantraxRosterSyncReleaseSignature(after)});state.previewA=null;set("previewAInvalidated","PASS",[],{reason:"Expanded release configuration changed."});return state.checkpoints.optInTransition},
    recordPreviewB(preview){requirePass(state.checkpoints,["optInTransition","previewAInvalidated"]);invalidateFrom("previewB");const period=d.fantraxRosterSyncPeriodGuard(preview?.period),season=d.fantraxSeasonWriteGuard(preview?.data?.seasonContextComparison);if(!period.valid||!season.valid)return set("previewB","FAIL",[period.error,season.error].filter(Boolean),{});state.previewB=preview;return set("previewB","PASS",[],{fetchedAt:preview.data?.fetchedAt,externalLeagueId:preview.externalLeagueId,period:preview.period||"",seasonContext:preview.data?.seasonContextComparison?.observed})},
    async fetchPreviewB(input){const response=await d.fetchFantraxPublicPreview({...input,period:""}),preview=d.normalizeFantraxPreviewState(response);return this.recordPreviewB({...preview,externalLeagueId:input.externalLeagueId,period:""})},
    recordGateB(activeLeague,rosterItems=[]){requirePass(state.checkpoints,["previewB"]);invalidateFrom("gateB");const policy=d.fantraxRosterSyncReleasePolicy(activeLeague),period=d.fantraxRosterSyncPeriodGuard(state.previewB?.period),season=d.fantraxSeasonWriteGuard(state.previewB?.data?.seasonContextComparison),validation=d.validateControlledFantraxStatusUpdates(rosterItems,state.candidateIds,policy.effectiveCap),previous=state.checkpoints.candidates?.evidence?.rows||[],current=(validation.updates||[]).map(exactCandidateProjection).sort((a,b)=>a.id.localeCompare(b.id)),same=serializeGate4Evidence(previous)===serializeGate4Evidence(current),valid=policy.valid&&policy.optedIn&&policy.releaseTier===GATE4_RELEASE_TIER&&policy.effectiveCap===10&&period.valid&&season.valid&&validation.valid&&current.length===10&&same;return set("gateB",valid?"PASS":"FAIL",valid?[]:[policy.error,period.error,season.error,...(validation.errors||[]),...(!same?["Preview B candidate projections differ from the reviewed set."]:[])].filter(Boolean),{rows:current,releaseSignature:d.fantraxRosterSyncReleaseSignature(policy)})},
    async buildManifest(activeLeague){requirePass(state.checkpoints,["gateB"]);invalidateFrom("manifest");const policy=d.fantraxRosterSyncReleasePolicy(activeLeague),updates=state.checkpoints.gateB.evidence.rows,manifestInput={leagueId:activeLeague.id,period:state.previewB.period,seasonContext:state.previewB.data?.seasonContextComparison?.observed,updates,releaseTier:policy.releaseTier,effectiveCap:policy.effectiveCap},manifest=d.canonicalFantraxSyncManifest(manifestInput),validation=d.validateFantraxSyncManifest(manifest);if(!validation.valid||manifest.version!=="2"||manifest.rows.length!==10) return set("manifest","FAIL",validation.errors||["Manifest-v2 must contain exactly ten rows."],{});state.manifest=manifest;state.manifestInput=manifestInput;state.manifestDigest=await d.fantraxSyncManifestDigest(manifestInput);return set("manifest","PASS",[],{manifest,digest:state.manifestDigest})},
    recordPreWriteGuards(evidence={}){requirePass(state.checkpoints,["manifest"]);invalidateFrom("preWriteGuards");const valid=evidence.authUserId===state.checkpoints.authenticatedUser.evidence.id&&evidence.leagueId===GATE4_EXPECTED_LEAGUE_ID&&evidence.previewFetchedAt===state.previewB?.data?.fetchedAt&&evidence.manifestDigest===state.manifestDigest&&evidence.releaseSignature===state.checkpoints.gateB.evidence.releaseSignature&&evidence.seasonValid===true&&evidence.periodValid===true&&evidence.identityValid===true&&evidence.candidateSetValid===true;return set("preWriteGuards",valid?"PASS":"FAIL",valid?[]:["Immediate pre-write evidence does not match the reviewed checkpoint chain."],evidence)},
    async humanConfirmationDigest(){requirePass(state.checkpoints,["preWriteGuards"]);const review={artifactCommit:state.artifactCommit,user:state.checkpoints.authenticatedUser.evidence.id,league:GATE4_EXPECTED_LEAGUE_ID,manifestDigest:state.manifestDigest,protectedDigest:state.checkpoints.protectedBaseline.evidence.digest,preWrite:state.checkpoints.preWriteGuards.evidence};state.humanDigest=await gate4EvidenceDigest(review);return state.humanDigest},
    async armHumanConfirmation({confirmationDigest="",manifestDigest=""}={}){requirePass(state.checkpoints,["preWriteGuards"]);invalidateFrom("humanConfirmation");const expected=await this.humanConfirmationDigest(),digestMatches=clean(confirmationDigest)===expected&&clean(manifestDigest)===state.manifestDigest,valid=state.persistenceAvailable&&digestMatches&&state.manifest?.version==="2";state.armed=valid;state.armingError=!valid&&state.persistenceAvailable&&state.manifest?.version==="2"&&!digestMatches?"DIGEST_MISMATCH":"";state.armedContextDigest=valid?await gate4EvidenceDigest(authorizationContext()):"";return set("humanConfirmation",valid?"PASS":"FAIL",valid?[]:[state.armingError||"Persistence must be available and the human confirmation and current manifest-v2 digests must exactly match the review artifact."],{expectedDigest:expected,manifestDigest:state.manifestDigest,armingError:state.armingError})},
    async persist(){
      if(!state.persistenceAuthority)throw new Error("Gate 4 persistence is disabled for this implementation checkpoint.");
      requirePass(state.checkpoints,["humanConfirmation"]);
      if(state.persistenceCalled)throw new Error("The Gate 4 one-call persistence boundary has already been used.");
      if(!state.armed)throw new Error("Explicit exact-digest human confirmation is required.");
      try{await verifyCurrentWriteContext()}catch(error){
        invalidateFrom("preWriteGuards");
        throw error;
      }
      state.persistenceCalled=true;
      state.armed=false;
      refreshPersistenceState();
      try{
        const immediateGuard=async()=>{requirePass(state.checkpoints,["preWriteGuards","humanConfirmation"]);await verifyCurrentWriteContext()};
        const result=await d.executeReviewedFantraxSync({manifestInput:state.manifestInput,beforeAttempt:immediateGuard,beforeGroup:immediateGuard});
        set("persistence","PASS",[],{attemptId:result.attempt.id,digest:result.digest});
        return result;
      }catch(error){
        set("persistence","FAIL",[String(error?.message||error)],{});
        throw error;
      }finally{
        state.armed=false;
        state.armedContextDigest="";
        refreshPersistenceState();
      }
    },
    cancelBeforePersistence(){
      if(state.persistenceCalled)throw new Error("A consumed Gate 4 persistence session cannot be reset or reused.");
      invalidateFrom("optInTransition");
      state.persistenceAuthority=false;
      state.previewB=null;
      state.manifest=null;
      state.manifestInput=null;
      state.manifestDigest="";
      state.humanDigest="";
      state.armedContextDigest="";
      state.armingError="";
      state.armed=false;
      refreshPersistenceState();
      return this.reviewArtifact();
    },
    recordAuditOutcomes(evidence){requirePass(state.checkpoints,["persistence"]);const valid=evidence?.manifestVersion==="2"&&evidence?.digest===state.manifestDigest&&evidence?.reviewedCount===10&&evidence?.terminalCount===10&&evidence?.recoverableCount===0&&evidence?.status==="COMPLETED"&&evidence?.outcomes?.every(value=>value==="APPLIED");return set("auditOutcomes",valid?"PASS":"FAIL",valid?[]:["Durable audit outcomes are not the exact completed ten-item manifest."],evidence||{})},
    recordProtectedComparison(evidence){requirePass(state.checkpoints,["auditOutcomes"]);return set("protectedComparison",evidence?.matches===true?"PASS":"FAIL",evidence?.matches===true?[]:["Protected fields changed outside the authorized status fields."],evidence||{})},
    async fetchPostWriteAgreement(input){requirePass(state.checkpoints,["protectedComparison"]);const response=await d.fetchFantraxPublicPreview({...input,period:""}),preview=d.normalizeFantraxPreviewState(response),period=d.fantraxRosterSyncPeriodGuard(preview?.period),season=d.fantraxSeasonWriteGuard(preview?.data?.seasonContextComparison),byId=new Map((preview?.data?.rosterItems||[]).map(row=>[clean(row.matchedPlayerUuid),row])),rows=(state.manifest?.rows||[]).map(item=>{const row=byId.get(item.playerId);return {playerId:item.playerId,currentStatus:clean(row?.currentRosterStatus),fantraxStatus:clean(row?.normalizedRosterStatus),targetStatus:item.targetStatus,exactIdentity:row?.playerIdentityResult==="MATCHED"}}),valid=!clean(preview?.error)&&period.valid&&season.valid&&rows.length===GATE4_CANDIDATE_COUNT&&rows.every(row=>row.exactIdentity&&row.currentStatus===row.targetStatus&&row.fantraxStatus===row.targetStatus);return set("postWriteAgreement",valid?"PASS":"FAIL",valid?[]:[preview?.error,period.error,season.error,"The fresh post-write Fantrax preview does not agree with all ten completed manifest rows."].filter(Boolean),{fetchedAt:preview?.data?.fetchedAt||"",rows})},
    recordReplayRejection(evidence){requirePass(state.checkpoints,["protectedComparison"]);const valid=evidence?.duplicateAttemptCreated===false&&evidence?.playerWrites===0&&evidence?.terminalReplayRejected===true;return set("replayRejection",valid?"PASS":"FAIL",valid?[]:["Duplicate-manifest or terminal replay protection failed."],evidence||{})},
    recordOptInDisabled(league){const policy=d.fantraxRosterSyncReleasePolicy(league),valid=!policy.optedIn;return set("optInDisabled",valid?"PASS":"FAIL",valid?[]:["Expanded opt-in remains enabled."],{releaseSignature:d.fantraxRosterSyncReleaseSignature(policy)})},
    reviewArtifact(){refreshPersistenceState();return {artifactCommit:state.artifactCommit,checkpoints:state.checkpoints,candidates:state.checkpoints.candidates?.evidence?.rows||[],manifest:state.manifest,manifestDigest:state.manifestDigest,protectedBaseline:state.checkpoints.protectedBaseline?.evidence||null,humanConfirmationDigest:state.humanDigest,armingError:state.armingError,persistenceAuthority:state.persistenceAuthority,persistenceAvailable:state.persistenceAvailable,persistenceExecutable:state.persistenceExecutable,armed:state.armed,persistenceCalled:state.persistenceCalled}}
  };
}
