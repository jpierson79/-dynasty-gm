import { appState } from "../state/appState.js?v5-4-6e-gate4c1-auth-state";
import { createGate4AcceptanceHarness, GATE4_CANDIDATE_COUNT, GATE4_EXPECTED_LEAGUE_ID } from "./fantraxGate4AcceptanceHarness.js";
import { controlledFantraxRosterSelection, fantraxRosterSyncPeriodGuard, validateControlledFantraxStatusUpdates } from "./fantraxRosterSyncService.js?v5-4-6e-opt-in";
import { fantraxSeasonWriteGuard } from "./fantraxSeasonContextService.js?v5-4-6c-season";
import { allPlayers } from "../repositories/playerRepository.js?v5-4-6b2-reviewed-sync";
import { captureFantraxProtectedBaseline } from "./fantraxProtectedBaselineService.js";

export const GATE4_CONTROLLER_STATES=["NOT_STARTED","RUNNING","PASS","BLOCKED","UNAVAILABLE","PERMISSION_BLOCKED","QUERY_FAILED"];
const clean=value=>String(value??"").trim();
const initial=()=>({stage:"NOT_STARTED",status:"NOT_STARTED",error:"",harness:null,preview:null,previewAGateB:null,eligibleRows:[],excludedRows:[],selectedIds:[],protectedBaseline:null,artifact:null,persistenceEnabled:false,armed:false});
function errorStatus(error){const message=String(error?.message||error||"Gate 4 review failed.");return {message,status:/permission|row.level security|not authorized|42501/i.test(message)?"PERMISSION_BLOCKED":/unavailable|network|timeout/i.test(message)?"UNAVAILABLE":"QUERY_FAILED"}}
function exclusionReason(row){
  if(row.playerIdentityResult!=="MATCHED")return "Player identity is not an exact authoritative match.";
  if(row.teamIdentityResult!=="MATCHED")return "Team identity is not an exact persisted match.";
  if(row.activeManualOverride)return "Manual roster-status override is active.";
  if(row.ownershipDifference||row.fantraxConflict)return "Ownership or override conflict requires review.";
  if(clean(row.normalizedRosterStatus).toUpperCase()==="UNCLASSIFIED")return "Fantrax status is unknown or unclassified.";
  if(row.futureSyncRecommendation!=="APPLY_FANTRAX_STATUS")return row.futureSyncRecommendation==="RELEASE"?"Release/removal is prohibited.":"Row is not an eligible status-only update.";
  return "";
}
export function classifyGate4PreviewCandidates(rows=[]){return rows.map(row=>({...row,gate4ExclusionReason:exclusionReason(row)}))}

export function createFantraxGate4AcceptanceController({artifactCommit="",dependencies={}}={}){
  const d={appState,allPlayers,captureFantraxProtectedBaseline,controlledFantraxRosterSelection,createGate4AcceptanceHarness,fantraxRosterSyncPeriodGuard,fantraxSeasonWriteGuard,validateControlledFantraxStatusUpdates,...dependencies};
  let state=initial();
  const publish=patch=>state={...state,...patch,persistenceEnabled:false,armed:false};
  const fail=error=>{const result=errorStatus(error);return publish({status:result.status,error:result.message,artifact:null})};
  return {
    get state(){return state},
    reset(reason=""){state={...initial(),error:reason};return state},
    async start(){
      this.reset();publish({stage:"Gate A",status:"RUNNING"});
      try{
        const harness=d.createGate4AcceptanceHarness({artifactCommit,persistenceAuthority:false,dependencies:d.harnessDependencies||{}});
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
        const preview=state.harness.state.previewA,period=d.fantraxRosterSyncPeriodGuard(preview.period),season=d.fantraxSeasonWriteGuard(preview.data?.seasonContextComparison);
        if(!period.valid||!season.valid)return publish({status:"BLOCKED",error:period.error||season.error});
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
    }
  };
}
