import { appState } from "../state/appState.js?v5-4-6e-gate4c1-auth-state";
import { createGate4AcceptanceHarness, GATE4_CANDIDATE_COUNT, GATE4_EXPECTED_LEAGUE_ID } from "./fantraxGate4AcceptanceHarness.js";
import { controlledFantraxRosterSelection, fantraxRosterSyncPeriodGuard, fantraxRosterSyncReleasePolicy, fantraxRosterSyncReleaseSignature, fantraxStatusUpdateExclusionReason, validateControlledFantraxStatusUpdates } from "./fantraxRosterSyncService.js?v5-4-6e-gate4d3b-conflicts";
import { fantraxSeasonWriteGuard } from "./fantraxSeasonContextService.js?v5-4-6c-season";
import { allPlayers } from "../repositories/playerRepository.js?v5-4-6b2-reviewed-sync";
import { captureFantraxProtectedBaseline } from "./fantraxProtectedBaselineService.js";
import { saveFantraxSeasonContext } from "../repositories/leagueRepository.js?v5-4-6c-season";

export const GATE4_CONTROLLER_STATES=["NOT_STARTED","RUNNING","PASS","BLOCKED","UNAVAILABLE","PERMISSION_BLOCKED","QUERY_FAILED"];
const clean=value=>String(value??"").trim();
const initial=()=>({stage:"NOT_STARTED",status:"NOT_STARTED",error:"",harness:null,preview:null,previewAGateB:null,eligibleRows:[],excludedRows:[],selectedIds:[],protectedBaseline:null,postProtectedBaseline:null,artifact:null,manifest:null,manifestDigest:"",confirmationDigest:"",persistenceResult:null,reviewStale:false,persistenceAuthority:false,persistenceAvailable:false,persistenceExecutable:false,armed:false,persistenceCalled:false});
function errorStatus(error){const message=String(error?.message||error||"Gate 4 review failed.");return {message,status:/permission|row.level security|not authorized|42501/i.test(message)?"PERMISSION_BLOCKED":/unavailable|network|timeout/i.test(message)?"UNAVAILABLE":"QUERY_FAILED"}}
function exclusionReason(row){
  return fantraxStatusUpdateExclusionReason(row);
}
export function classifyGate4PreviewCandidates(rows=[]){return rows.map(row=>({...row,gate4ExclusionReason:exclusionReason(row)}))}

export function createFantraxGate4AcceptanceController({artifactCommit="",dependencies={}}={}){
  const d={appState,allPlayers,captureFantraxProtectedBaseline,controlledFantraxRosterSelection,createGate4AcceptanceHarness,fantraxRosterSyncPeriodGuard,fantraxRosterSyncReleasePolicy,fantraxRosterSyncReleaseSignature,fantraxSeasonWriteGuard,saveFantraxSeasonContext,validateControlledFantraxStatusUpdates,...dependencies};
  d.publishPreviewObservation=d.publishPreviewObservation||((preview)=>{d.appState.fantraxPreview=preview});
  d.invalidatePreviewObservation=d.invalidatePreviewObservation||(()=>{d.appState.fantraxPreview={...(d.appState.fantraxPreview||{}),data:null,loading:false,error:""}});
  let state=initial();
  const publish=patch=>{const artifact=state.harness?.reviewArtifact();return state={...state,...patch,persistenceAuthority:Boolean(artifact?.persistenceAuthority),persistenceAvailable:Boolean(artifact?.persistenceAvailable),persistenceExecutable:Boolean(artifact?.persistenceExecutable),armed:Boolean(artifact?.armed),persistenceCalled:Boolean(artifact?.persistenceCalled)}};
  const fail=error=>{const result=errorStatus(error);return publish({status:result.status,error:result.message,artifact:null})};
  const reviewedInput=async()=>({externalLeagueId:clean(d.appState.activeLeague?.settings?.fantraxSeasonContext?.externalLeagueId),players:await d.allPlayers(GATE4_EXPECTED_LEAGUE_ID),teams:d.appState.teams||[],reviewedSeasonContext:d.appState.activeLeague?.settings?.fantraxSeasonContext});
  const guardEvidence=()=>{
    const preview=state.harness?.state.previewB,policy=d.fantraxRosterSyncReleasePolicy(d.appState.activeLeague),period=d.fantraxRosterSyncPeriodGuard(preview?.period),season=d.fantraxSeasonWriteGuard(preview?.data?.seasonContextComparison),validation=d.validateControlledFantraxStatusUpdates(preview?.data?.rosterItems||[],state.selectedIds,policy.effectiveCap);
    return {authUserId:clean(d.appState.authUser?.id),leagueId:clean(d.appState.activeLeague?.id),previewFetchedAt:clean(preview?.data?.fetchedAt),manifestDigest:state.harness?.state.manifestDigest||"",releaseSignature:d.fantraxRosterSyncReleaseSignature(policy),seasonValid:season.valid===true,periodValid:period.valid===true,identityValid:validation.valid===true&&validation.updates?.length===GATE4_CANDIDATE_COUNT,candidateSetValid:validation.valid===true&&validation.updates?.length===GATE4_CANDIDATE_COUNT&&state.selectedIds.length===GATE4_CANDIDATE_COUNT};
  };
  const protectedMatches=(before,after)=>["players","teams","managers","metrics","scores"].every(key=>before?.[key]?.count===after?.[key]?.count&&before?.[key]?.digest===after?.[key]?.digest);
  return {
    get state(){return state},
    reset(reason=""){d.invalidatePreviewObservation();state={...initial(),error:reason};return state},
    async start(){
      this.reset();publish({stage:"Gate A",status:"RUNNING"});
      try{
        const harness=d.createGate4AcceptanceHarness({artifactCommit,persistenceAuthority:true,dependencies:d.harnessDependencies||{}});
        state.harness=harness;
        const authenticated=await harness.recordAuthenticatedUser();if(authenticated.status!=="PASS")return fail(authenticated.reasons.join(" "));
        const league=harness.recordActiveLeague();if(league.status!=="PASS")return publish({status:"BLOCKED",error:league.reasons.join(" ")});
        const audit=await harness.loadAuditBaseline();if(audit.status!=="PASS")return fail(audit.reasons.join(" "));
        const active=d.appState.activeLeague,teams=d.appState.teams||[],readiness={authenticatedUser:Boolean(d.appState.authUser?.id),correctLeague:active?.id===GATE4_EXPECTED_LEAGUE_ID,auditAvailable:true,authoritativeTeamIdentity:teams.length>0&&teams.every(team=>/^[A-Za-z0-9]{16}$/.test(clean(team.fantrax_team_id))),manualOverrideProtection:true,currentPeriodCapability:true,durableAuditRecovery:true,databaseCapBoundary:true};
        const gateA=harness.recordGateA(readiness);if(gateA.status!=="PASS")return publish({status:"BLOCKED",error:gateA.reasons.join(" ")});
        return publish({stage:"Gate A",status:"PASS",artifact:harness.reviewArtifact()});
      }catch(error){return fail(error)}
    },
    async fetchPreviewA(){
      if(state.status!=="PASS"||state.stage!=="Gate A")return publish({status:"BLOCKED",error:"Gate A must pass before Preview A."});
      publish({stage:"Preview A",status:"RUNNING",selectedIds:[],protectedBaseline:null,artifact:null});
      try{
        const reviewed=d.appState.activeLeague?.settings?.fantraxSeasonContext,externalLeagueId=clean(reviewed?.externalLeagueId),players=await d.allPlayers(GATE4_EXPECTED_LEAGUE_ID),teams=d.appState.teams||[];
        if(!/^[A-Za-z0-9]{16}$/.test(externalLeagueId))return publish({status:"BLOCKED",error:"The reviewed Fantrax external league ID is unavailable or invalid."});
        const checkpoint=await state.harness.fetchPreviewA({externalLeagueId,players,teams,reviewedSeasonContext:reviewed});if(checkpoint.status!=="PASS")return publish({status:"BLOCKED",error:checkpoint.reasons.join(" ")});
        const preview=state.harness.state.previewA;
        if(clean(preview.error))return fail(preview.error);
        const period=d.fantraxRosterSyncPeriodGuard(preview.period),season=d.fantraxSeasonWriteGuard(preview.data?.seasonContextComparison);
        if(!period.valid||!season.valid)return publish({status:"BLOCKED",error:period.error||season.error});
        d.publishPreviewObservation(preview);
        const classified=classifyGate4PreviewCandidates(preview.data?.rosterItems||[]),eligibleRows=classified.filter(row=>!row.gate4ExclusionReason),excludedRows=classified.filter(row=>row.gate4ExclusionReason);
        return publish({stage:"Candidate Review",status:"PASS",preview,previewAGateB:{status:"PASS",period:period.period||"CURRENT",seasonStatus:preview.data?.seasonContextComparison?.status||"MATCH"},eligibleRows,excludedRows,artifact:state.harness.reviewArtifact()});
      }catch(error){return fail(error)}
    },
    toggleCandidate(playerId,checked){
      if(state.stage!=="Candidate Review"||state.status!=="PASS")return publish({status:"BLOCKED",error:"Preview A candidate review is not ready."});
      const id=clean(playerId),eligible=state.eligibleRows.some(row=>clean(row.matchedPlayerUuid)===id);
      if(!eligible)return publish({status:"BLOCKED",error:"Only an exact eligible Preview A player UUID may be selected."});
      if(checked&&state.selectedIds.includes(id))return publish({status:"PASS",error:"Duplicate player UUID selection is blocked."});
      const selection=d.controlledFantraxRosterSelection(state.selectedIds,id,checked,GATE4_CANDIDATE_COUNT);
      return publish({selectedIds:selection.selectedIds,protectedBaseline:null,artifact:state.harness.reviewArtifact(),error:selection.error,status:"PASS"});
    },
    async captureProtectedBaseline(){
      if(state.stage!=="Candidate Review"||state.status!=="PASS")return publish({status:"BLOCKED",error:"Candidate review is not ready."});
      if(state.selectedIds.length!==GATE4_CANDIDATE_COUNT)return publish({status:"BLOCKED",error:`Exactly ${GATE4_CANDIDATE_COUNT} reviewed candidates are required.`});
      publish({stage:"Protected Baseline",status:"RUNNING",artifact:null});
      try{
        const validation=d.validateControlledFantraxStatusUpdates(state.preview.data?.rosterItems||[],state.selectedIds,GATE4_CANDIDATE_COUNT);if(!validation.valid)return publish({status:"BLOCKED",error:validation.errors.join(" ")});
        const candidateCheckpoint=state.harness.reviewCandidates(state.selectedIds,state.preview.data?.rosterItems||[]);if(candidateCheckpoint.status!=="PASS")return publish({status:"BLOCKED",error:candidateCheckpoint.reasons.join(" ")});
        const baseline=await d.captureFantraxProtectedBaseline(GATE4_EXPECTED_LEAGUE_ID),checkpoint=await state.harness.recordProtectedBaseline(baseline);if(checkpoint.status!=="PASS")return publish({status:"BLOCKED",error:checkpoint.reasons.join(" ")});
        return publish({stage:"Ready for Next Gate",status:"PASS",protectedBaseline:baseline,artifact:state.harness.reviewArtifact()});
      }catch(error){return fail(error)}
    },
    async enableExpandedOptIn(){
      if(state.stage!=="Ready for Next Gate"||state.status!=="PASS")return publish({status:"BLOCKED",error:"The accepted read-only artifact is required before expanded opt-in."});
      publish({stage:"EXPANDED OPT-IN REQUIRED",status:"RUNNING",error:""});
      try{
        const before=structuredClone(d.appState.activeLeague),setting={enabled:true,leagueId:GATE4_EXPECTED_LEAGUE_ID,reviewed:true,releaseId:"V5.4.6E_OPT_IN_10"};
        const after=await d.saveFantraxSeasonContext(GATE4_EXPECTED_LEAGUE_ID,{fantraxRosterSyncRelease:setting});
        d.appState.activeLeague=after;
        const checkpoint=state.harness.recordOptInTransition(before,after);
        if(checkpoint.status!=="PASS")return publish({status:"BLOCKED",error:checkpoint.reasons.join(" ")});
        d.invalidatePreviewObservation();
        return publish({stage:"PREVIEW B REQUIRED",status:"PASS",preview:null,previewAGateB:null,reviewStale:true,manifest:null,manifestDigest:"",confirmationDigest:"",artifact:state.harness.reviewArtifact(),error:""});
      }catch(error){return fail(error)}
    },
    async fetchPreviewB(){
      if(state.stage!=="PREVIEW B REQUIRED"||state.status!=="PASS")return publish({status:"BLOCKED",error:"Expanded opt-in and Preview A invalidation are required before Preview B."});
      publish({stage:"PREVIEW B REQUIRED",status:"RUNNING",error:""});
      try{
        const input=await reviewedInput();
        if(!/^[A-Za-z0-9]{16}$/.test(input.externalLeagueId))return publish({status:"BLOCKED",error:"The reviewed Fantrax external league ID is unavailable or invalid."});
        const previewCheckpoint=await state.harness.fetchPreviewB(input);
        if(previewCheckpoint.status!=="PASS")return publish({status:"BLOCKED",error:previewCheckpoint.reasons.join(" ")});
        const preview=state.harness.state.previewB;
        if(clean(preview.error))return fail(preview.error);
        const gateB=state.harness.recordGateB(d.appState.activeLeague,preview.data?.rosterItems||[]);
        if(gateB.status!=="PASS")return publish({status:"BLOCKED",error:gateB.reasons.join(" ")});
        d.publishPreviewObservation({...preview,rosterSyncSelectedIds:[...state.selectedIds]});
        return publish({stage:"PREVIEW B PASSED",status:"PASS",preview,previewAGateB:{status:"PASS",period:preview.period||"CURRENT",seasonStatus:preview.data?.seasonContextComparison?.status||"MATCH"},reviewStale:false,artifact:state.harness.reviewArtifact(),error:""});
      }catch(error){return fail(error)}
    },
    async buildManifestReview(){
      if(state.stage!=="PREVIEW B PASSED"||state.status!=="PASS")return publish({status:"BLOCKED",error:"A fresh Preview B must pass before manifest creation."});
      publish({stage:"MANIFEST REVIEW",status:"RUNNING",error:""});
      try{
        const manifestCheckpoint=await state.harness.buildManifest(d.appState.activeLeague);
        if(manifestCheckpoint.status!=="PASS")return publish({status:"BLOCKED",error:manifestCheckpoint.reasons.join(" ")});
        const guards=state.harness.recordPreWriteGuards(guardEvidence());
        if(guards.status!=="PASS")return publish({status:"BLOCKED",error:guards.reasons.join(" ")});
        const confirmationDigest=await state.harness.humanConfirmationDigest();
        return publish({stage:"UNARMED",status:"PASS",manifest:state.harness.state.manifest,manifestDigest:state.harness.state.manifestDigest,confirmationDigest,artifact:state.harness.reviewArtifact(),error:""});
      }catch(error){return fail(error)}
    },
    async armExactDigest(typedDigest=""){
      if(state.stage!=="UNARMED"||state.status!=="PASS")return publish({status:"BLOCKED",error:"The final manifest review must be complete before arming."});
      if(clean(typedDigest)!==state.manifestDigest)return publish({status:"BLOCKED",error:"The typed digest does not exactly match the current manifest-v2 digest."});
      try{
        const guards=state.harness.recordPreWriteGuards(guardEvidence());
        if(guards.status!=="PASS")return publish({status:"BLOCKED",error:guards.reasons.join(" ")});
        const confirmationDigest=await state.harness.humanConfirmationDigest(),armed=await state.harness.armHumanConfirmation({confirmationDigest,manifestDigest:clean(typedDigest)});
        if(armed.status!=="PASS")return publish({status:"BLOCKED",error:armed.reasons.join(" ")});
        return publish({stage:"ARMED FOR EXACT DIGEST",status:"PASS",confirmationDigest,artifact:state.harness.reviewArtifact(),error:""});
      }catch(error){return fail(error)}
    },
    async persistOnce(){
      if(state.stage!=="ARMED FOR EXACT DIGEST"||!state.harness?.state.armed)return publish({status:"BLOCKED",error:"Exact-digest arming is required before the one-call persistence boundary."});
      publish({stage:"PERSISTENCE USED",status:"RUNNING",error:""});
      try{
        const execution=await state.harness.persist(),items=execution.auditItems||[],outcomes=items.map(item=>clean(item.outcome)),terminalCount=outcomes.filter(value=>["APPLIED","SKIPPED"].includes(value)).length,recoverableCount=outcomes.filter(value=>["PENDING","FAILED"].includes(value)).length;
        const audit=state.harness.recordAuditOutcomes({attemptId:execution.attempt?.id,manifestVersion:execution.manifest?.version,digest:execution.digest,reviewedCount:execution.manifest?.rows?.length,terminalCount,recoverableCount,status:execution.status,outcomes,actorUserId:execution.attempt?.actor_user_id||execution.attempt?.created_by||execution.attempt?.requested_by||""});
        const post=await d.captureFantraxProtectedBaseline(GATE4_EXPECTED_LEAGUE_ID),matches=protectedMatches(state.protectedBaseline,post);
        state.harness.recordProtectedComparison({matches,before:state.protectedBaseline,after:post});
        const passed=audit.status==="PASS"&&matches;
        return publish({stage:passed?"COMPLETED":"FAILED",status:passed?"PASS":"BLOCKED",postProtectedBaseline:post,persistenceResult:{attemptId:execution.attempt?.id,status:execution.status,digest:execution.digest,actorUserId:audit.evidence?.actorUserId||"",terminalCount,recoverableCount,items,postWriteAgreement:"NOT_CHECKED",optInDisabled:false},artifact:state.harness.reviewArtifact(),error:passed?"":"Audit outcomes or protected-field verification did not pass."});
      }catch(error){return publish({stage:"FAILED",status:"QUERY_FAILED",error:String(error?.message||error),persistenceResult:{attemptId:state.harness?.state.checkpoints.persistence?.evidence?.attemptId||"",status:"FAILED",digest:state.manifestDigest,actorUserId:"",terminalCount:0,recoverableCount:GATE4_CANDIDATE_COUNT,items:[],postWriteAgreement:"NOT_CHECKED",optInDisabled:false},artifact:state.harness.reviewArtifact()})}
    },
    async fetchPostWriteAgreement(){
      if(state.stage!=="COMPLETED"||!state.persistenceResult)return publish({status:"BLOCKED",error:"A completed one-call persistence result is required before post-write agreement inspection."});
      try{
        const checkpoint=await state.harness.fetchPostWriteAgreement(await reviewedInput());
        return publish({status:checkpoint.status==="PASS"?"PASS":"BLOCKED",persistenceResult:{...state.persistenceResult,postWriteAgreement:checkpoint.status,postWriteFetchedAt:checkpoint.evidence?.fetchedAt||""},artifact:state.harness.reviewArtifact(),error:checkpoint.status==="PASS"?"":checkpoint.reasons.join(" ")});
      }catch(error){return fail(error)}
    },
    async disableExpandedOptIn(){
      if(!state.harness?.state.checkpoints.optInTransition)return publish({status:"BLOCKED",error:"No Gate 4 expanded opt-in transition exists to disable."});
      try{
        const setting={enabled:false,leagueId:GATE4_EXPECTED_LEAGUE_ID,reviewed:true,releaseId:"V5.4.6E_OPT_IN_10"},league=await d.saveFantraxSeasonContext(GATE4_EXPECTED_LEAGUE_ID,{fantraxRosterSyncRelease:setting});
        d.appState.activeLeague=league;
        const checkpoint=state.harness.recordOptInDisabled(league);
        return publish({status:checkpoint.status==="PASS"?state.status:"BLOCKED",persistenceResult:state.persistenceResult?{...state.persistenceResult,optInDisabled:checkpoint.status==="PASS"}:null,artifact:state.harness.reviewArtifact(),error:checkpoint.status==="PASS"?state.error:checkpoint.reasons.join(" ")});
      }catch(error){return fail(error)}
    }
  };
}
