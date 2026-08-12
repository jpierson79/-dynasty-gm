import { $, $all, debounce, escapeHtml, optionHtml, setHtml } from "./utils/dom.js";
import { appState, clearErrors, preferredTeamIdForLeague, saveLeagueUiPreferences, saveUiPreferences, setError, setState, setStateSilently, subscribe } from "./state/appState.js?v5-4-6e-gate4c1-auth-state";
import { initializeAuth, refreshAccessibleLeagues, selectLeague, signIn, signOut } from "./services/authService.js?v5-4-6e-gate4c1-auth-state";
import { loadLeagueOverview } from "./services/cloudDataService.js?v5-4-6e-gate4c1-auth-state";
import { runDataHealth } from "./services/dataHealthService.js?v5-4-6e-gate4a-audit-visibility";
import { runWithDataHealthTimeout } from "./services/dataHealthExecutionService.js?v5-4-6b3-data-health";
import { buildLiveScoreDiagnosticsForLeagueName } from "./services/liveScoreDiagnosticsService.js";
import { allPlayers, clearRosterStatusOverrides, positionOptions, rosterByTeam, updateRosterStatuses } from "./repositories/playerRepository.js?v5-4-6b2-reviewed-sync";
import { listPlayerIntelligence, playerIntelligenceByIds } from "./repositories/playerIntelligenceRepository.js";
import { linkManagerToTeam } from "./repositories/managerRepository.js";
import { calculateLeagueScores } from "./engine/dynastyEngine.js";
import { previewImport, runImport } from "./imports/cloudImportController.js";
import { applyAutomatedStatcastRefresh, previewAutomatedStatcastRefresh } from "./services/statcastProviderService.js";
import { applyMlbamIdentityBackfill, previewMlbamIdentityBackfill } from "./services/mlbamIdentityBackfillService.js";
import { presetQuery } from "./config/playerIntelligencePresets.js";
import { findRosterUpgradeCandidates, getRosterRecommendations, getWaiverRecommendations } from "./services/decisionIntelligenceService.js";
import { analyzeTrade, findConsolidationTargets, findTradeFits } from "./services/tradeAnalysisService.js";
import { addTradeAssetSelection, removeTradeAssetSelection } from "./services/tradeInteractionService.js";
import { resolveUserFantasyTeam } from "./services/userTeamResolver.js?v5-4-1-user-team-final";
import { bulkSetPendingStatus, clearAllPendingStatusChanges, clearPendingStatusChanges, clearSelection, filterRosterStatusRows, manualOverrideIds, rosterStatusManagerRows, savePayload, selectAllFilteredRows, selectPageRows, setPendingStatus, toggleSelection, validateRosterStatusSave } from "./services/rosterStatusManagerService.js?v5-4-6b1-manual-overrides";
import { fetchFantraxPublicPreview } from "./services/fantraxPublicPreviewService.js?v5-4-6b2-ownership-diagnostics";
import { controlledFantraxRosterSelection, fantraxRosterSyncPeriodGuard, fantraxRosterSyncReleasePolicy, fantraxRosterSyncReleaseSignature, fantraxRosterSyncSummary, validateControlledFantraxStatusUpdates } from "./services/fantraxRosterSyncService.js?v5-4-6e-opt-in";
import { setPendingTeamMapping, teamMappingSaveRows, validatePendingTeamMappings } from "./services/fantraxTeamIdentityService.js";
import { saveFantraxTeamMappings } from "./repositories/teamRepository.js?v5-4-6a-team-identity";
import { leagueById, memberships, saveFantraxSeasonContext } from "./repositories/leagueRepository.js?v5-4-6c-season";
import { clearFantraxPendingReviews, fantraxSeasonWriteGuard, reviewedFantraxSeasonSettings, validateFantraxSeasonReview } from "./services/fantraxSeasonContextService.js?v5-4-6c-season";
import { listFantraxSyncAttempts } from "./repositories/fantraxSyncAuditRepository.js?v5-4-6e-opt-in";
import { executeReviewedFantraxSync } from "./services/fantraxSyncCoordinator.js";
import { createFantraxGate4AcceptanceController } from "./services/fantraxGate4AcceptanceController.js";
import { renderDashboard } from "./views/dashboardView.js";
import { renderPlayerResults, renderPlayers } from "./views/playersView.js";
import { renderMyRoster } from "./views/rosterView.js";
import { renderRosterStatusManager } from "./views/rosterStatusManagerView.js?v5-4-6b1-manual-overrides";
import { renderWaiverOpportunities } from "./views/waiverOpportunitiesView.js";
import { renderTradeCenter } from "./views/tradeCenterView.js";
import { renderTeamsManagers } from "./views/teamsManagersView.js";
import { renderImports } from "./views/importsView.js";
import { renderSettingsDataHealth } from "./views/settingsDataHealthView.js?v5-4-6e-gate4a-audit-visibility";
import { renderFantraxPreview, renderFantraxTeamIdentityManager } from "./views/fantraxPreviewView.js";
import { renderFantraxGate4Acceptance } from "./views/fantraxGate4AcceptanceView.js";

const importUiState={previews:{},files:{},reviewed:{},preview:null,result:null,running:false,mlbamBackfill:{season:new Date().getUTCFullYear(),preview:null,reviewed:false,running:false,result:null,error:""},statcast:{playerType:"hitter",season:new Date().getUTCFullYear(),preview:null,reviewed:false,running:false,result:null,error:""}};
let dashboardOverview={dashboardStats:null};
let playerPage={rows:[],count:0,page:1,pageSize:50};
let waiverPage={recommendations:[],count:0,page:1,pageSize:50};
let engineCancelRequested=false;
let playerRequestId=0;
let waiverRequestId=0;
const tradeRequestIds={outgoing:0,incoming:0};
const USER_TEAM_FALLBACK_TOKENS=["Rum Ham","Rum Ham & Rally Nuts","RHRN"];
const gate4AcceptanceMode=new URLSearchParams(location.search).get("gate4Acceptance")==="1";
const gate4Controller=gate4AcceptanceMode?createFantraxGate4AcceptanceController({artifactCommit:new URLSearchParams(location.search).get("commit")||"CURRENT_HOSTED_ARTIFACT"}):null;

function publishGate4ControllerState(){
  if(!gate4Controller)return;
  const {harness,...safeState}=gate4Controller.state;
  setState({gate4Acceptance:safeState});
}
function resetGate4Acceptance(reason=""){
  if(!gate4Controller)return;
  gate4Controller.reset(reason);
  const {harness,...safeState}=gate4Controller.state;
  setStateSilently({gate4Acceptance:safeState});
}

function modeLabel(){
  if(!appState.authUser)return"Signed out";
  if(appState.dataMode==="cloud"&&appState.activeLeague)return`Cloud · ${appState.activeLeague.name}`;
  if(appState.dataMode==="offline")return"Cloud unavailable";
  return"Select league";
}
function renderMessages(){
  const panel=$("#messagePanel");
  const errors=appState.errors||[];
  panel.className=`message-panel ${errors.length?"active error":""}`;
  panel.textContent=errors.join(" ");
}
function renderAuthPanel(){
  const signedIn=Boolean(appState.authUser);
  const signInState=appState.authSignIn||{pending:false,error:""};
  setHtml($("#authPanel"),signedIn
    ?`<h2>Authentication</h2><p class="note">Signed in as ${escapeHtml(appState.authUser.email||"")}</p><div class="toolbar"><button id="signOut" class="secondary">Sign Out</button><button id="retryCloud" class="secondary">Retry Cloud</button></div>`
    :`<h2>Authentication</h2><p class="note">Sign in to use Supabase Cloud. Local browser league data is not used by V5.</p><form id="signInForm" class="toolbar"><label>Email<input id="email" type="email" autocomplete="email" ${signInState.pending?"disabled":""}></label><label>Password<input id="password" type="password" autocomplete="current-password" ${signInState.pending?"disabled":""}></label><button class="primary" type="submit" ${signInState.pending?"disabled":""}>${signInState.pending?"Signing in…":"Sign In"}</button></form>${signInState.error?`<p class="warning-note">${escapeHtml(signInState.error)}</p>`:""}`);
}
function renderLeaguePanel(){
  const leagues=appState.accessibleLeagues||[];
  setHtml($("#leaguePanel"),`<h2>Active League</h2><div class="toolbar"><label>Cloud league<select id="leagueSelect"><option value="">Select league</option>${leagues.map(league=>optionHtml(league.id,league.name,appState.activeLeague?.id)).join("")}</select></label><button id="refreshLeague" class="secondary">Refresh League Data</button></div><p class="note">If exactly one accessible league exists, V5 selects it automatically. Empty cloud leagues are valid.</p>`);
}
function fantraxSyncAuditFailureState(error){
  const message=String(error?.message||error||"Fantrax synchronization audit query failed.");
  return {fantraxSyncAttempts:null,fantraxSyncAuditStatus:/permission|row.level security|not authorized|42501/i.test(message)?"PERMISSION_BLOCKED":"QUERY_FAILED",fantraxSyncAuditError:message};
}
async function loadFantraxSyncAudit(leagueId){
  try{
    const attempts=await listFantraxSyncAttempts(leagueId);
    setState({fantraxSyncAttempts:attempts,fantraxSyncAuditStatus:"AVAILABLE",fantraxSyncAuditError:""});
    return attempts;
  }catch(error){
    setState(fantraxSyncAuditFailureState(error));
    return null;
  }
}
async function refreshLeagueData(){
  if(!appState.activeLeague)return;
  const leagueId=appState.activeLeague.id,previousReleaseSignature=fantraxRosterSyncReleaseSignature(fantraxRosterSyncReleasePolicy(appState.activeLeague));
  setState({loading:true});
  clearErrors();
  try{
    const refreshedLeague=await leagueById(leagueId),nextReleaseSignature=fantraxRosterSyncReleaseSignature(fantraxRosterSyncReleasePolicy(refreshedLeague));
    if(previousReleaseSignature!==nextReleaseSignature)resetGate4Acceptance("Fantrax synchronization release configuration changed.");
    setState({activeLeague:refreshedLeague,fantraxPreview:previousReleaseSignature===nextReleaseSignature?appState.fantraxPreview:clearFantraxPendingReviews(fantraxPreviewState({data:null,error:"Fantrax synchronization release configuration changed. Refresh the preview before reviewing updates."}))});
    dashboardOverview=await loadLeagueOverview(leagueId);
    await loadFantraxSyncAudit(leagueId);
    const membershipRows=await memberships(leagueId).catch(()=>[]);
    const userTeamResolution=resolveUserFantasyTeam({
      leagueId:appState.activeLeague.id,
      authenticatedUserId:appState.authUser?.id||"",
      preferredTeamId:preferredTeamIdForLeague(appState.activeLeague.id),
      leagueRows:[appState.activeLeague],
      membershipRows,
      teamRows:dashboardOverview.teams||[],
      playerRows:dashboardOverview.rosterSummary||[],
      scoreRows:[],
      fallbackTeamTokens:USER_TEAM_FALLBACK_TOKENS
    });
    const scopedPreferred=preferredTeamIdForLeague(appState.activeLeague.id);
    if(userTeamResolution.teamId&&(userTeamResolution.rejectedPreferredTeamId||scopedPreferred!==userTeamResolution.teamId))saveLeagueUiPreferences(appState.activeLeague.id,{myTeamId:userTeamResolution.teamId});
    const teamId=userTeamResolution.teamId;
    const rosterPlayers=teamId?await rosterByTeam(appState.activeLeague.id,teamId):[];
    setState({userTeamResolution,rosterPlayers,tradeCenter:{...appState.tradeCenter,userTeamId:userTeamResolution.teamId,userTeamName:userTeamResolution.team?.name||""}});
    const positions=await positionOptions(appState.activeLeague.id);
    playerPage=await loadPlayerPage();
    waiverPage=await loadWaiverPage().catch(()=>waiverPage);
    setState({positionOptions:positions,playerPage,waiverPage,userTeamResolution,rosterPlayers,tradeCenter:{...appState.tradeCenter,userTeamId:userTeamResolution.teamId,userTeamName:userTeamResolution.team?.name||""},statusMessage:"Cloud league data refreshed."});
  }catch(error){
    setError(error);
    setState({dataMode:"offline"});
  }finally{
    setState({loading:false});
  }
}
function renderPlayerResultsRegion(){
  if(appState.view==="players")setHtml($("#playerResults"),renderPlayerResults(appState,appState.playerPage||playerPage));
}
async function loadPlayerPage(query=appState.playerQuery){
  const requestId=++playerRequestId;
  setStateSilently({playersLoading:true,playersError:""});
  renderPlayerResultsRegion();
  try{
    const page=await listPlayerIntelligence(appState.activeLeague.id,query);
    if(requestId!==playerRequestId)return null;
    return page;
  }catch(error){
    if(requestId===playerRequestId)setStateSilently({playersError:String(error?.message||error)});
    throw error;
  }finally{
    if(requestId===playerRequestId)setStateSilently({playersLoading:false});
  }
}
async function loadWaiverPage(){
  const requestId=++waiverRequestId;
  setState({waiversLoading:true,waiversError:""});
  try{
    const teamId=selectedRosterTeamId();
    const page=await getWaiverRecommendations(appState.activeLeague.id,teamId,appState.waiverQuery);
    if(requestId!==waiverRequestId)return appState.waiverPage||waiverPage;
    return page;
  }catch(error){
    if(requestId===waiverRequestId)setState({waiversError:String(error?.message||error)});
    throw error;
  }finally{
    if(requestId===waiverRequestId)setState({waiversLoading:false});
  }
}
function selectedRosterTeamId(){
  return appState.userTeamResolution?.teamId||"";
}
function selectedRosterTeamName(){
  const id=selectedRosterTeamId();
  return appState.teams.find(team=>team.id===id)?.name||"";
}
function tradeState(patch={}){
  const userTeamId=selectedRosterTeamId();
  return {...appState.tradeCenter,userTeamId,userTeamName:selectedRosterTeamName(),...patch};
}
function tradeScoreVersion(){
  return appState.playerPage?.scoreVersion||appState.waiverPage?.scoreVersion||appState.tradeCenter?.analysis?.scoreVersion||"";
}
function tradeSelectedPlayers(rows,ids){
  const byId=new Map([...(appState.tradeCenter?.outgoingPlayers||[]),...(appState.tradeCenter?.incomingPlayers||[]),...(appState.tradeCenter?.outgoingCandidates||[]),...(appState.tradeCenter?.incomingCandidates||[]),...(rows||[])].map(player=>[player.id,player]));
  return ids.map(id=>byId.get(id)).filter(Boolean);
}
function rosterStatusState(patch={}){
  return {...appState.rosterStatusManager,...patch};
}
function fantraxPreviewState(patch={}){return {data:null,externalLeagueId:"",period:"",loading:false,error:"",selectedTab:"summary",page:1,pageSize:50,filters:{search:"",teamId:"",sourceStatus:"",normalizedStatus:"",matched:"",ownershipDifference:false,statusDifference:false},pendingTeamMappings:{},reviewTeamMappings:false,confirmTeamMappings:false,savingTeamMappings:false,allowReplacement:false,seasonReviewAcknowledged:false,lastTeamMappingSave:"",reviewRosterSync:false,confirmRosterSync:false,rosterSyncReviewed:false,rosterSyncSelectedIds:[],rosterSyncReleaseSignature:"",savingRosterSync:false,lastRosterSync:null,...(appState.fantraxPreview||{}),...patch}}
function fantraxFiltersFromControls(){return {search:$("#fantraxRosterSearch")?.value.trim()||"",teamId:$("#fantraxRosterTeam")?.value||"",sourceStatus:$("#fantraxSourceStatus")?.value||"",normalizedStatus:$("#fantraxNormalizedStatus")?.value||"",matched:$("#fantraxMatched")?.value||"",ownershipDifference:$("#fantraxOwnershipDiff")?.checked||false,statusDifference:$("#fantraxStatusDiff")?.checked||false}}
async function loadFantraxPreview(){
  const externalLeagueId=$("#fantraxExternalLeagueId")?.value.trim()||appState.fantraxPreview?.externalLeagueId||"";
  const period=$("#fantraxPeriod")?.value||appState.fantraxPreview?.period||"";
  if(!/^[a-z0-9]{16}$/i.test(externalLeagueId)){setState({fantraxPreview:fantraxPreviewState({externalLeagueId,period,error:"Enter a valid 16-character Fantrax league ID."})});return}
  const loadingState=fantraxPreviewState({externalLeagueId,period,loading:true,error:""});
  setState({fantraxPreview:clearFantraxPendingReviews(loadingState)});
  try{
    const [players,teams]=await Promise.all([allPlayers(appState.activeLeague.id),Promise.resolve(appState.teams||[])]);
    const next=await fetchFantraxPublicPreview({externalLeagueId,period,players,teams,reviewedSeasonContext:appState.activeLeague?.settings?.fantraxSeasonContext});
    await loadFantraxSyncAudit(appState.activeLeague.id);
    setState({fantraxPreview:{...next,externalLeagueId,period}});
  }catch(error){setState({fantraxPreview:fantraxPreviewState({externalLeagueId,period,loading:false,error:String(error?.message||error)})})}
}
async function persistFantraxTeamMappings(){
  const preview=appState.fantraxPreview,data=preview.data,pending=preview.pendingTeamMappings||{};
  const validation=validatePendingTeamMappings({leagueId:appState.activeLeague.id,fantraxTeams:data?.teamRows||[],cloudTeams:appState.teams||[],pendingMappings:pending,allowReplacement:preview.allowReplacement});
  const seasonComparison=data?.seasonContextComparison,seasonGuard=fantraxSeasonWriteGuard(seasonComparison);
  const seasonReview=validateFantraxSeasonReview({leagueId:appState.activeLeague.id,fantraxTeams:data?.teamRows||[],cloudTeams:appState.teams||[],pendingMappings:pending,observedContext:data?.observedSeasonContext,acknowledged:preview.seasonReviewAcknowledged});
  const rolloverReviewRequired=!seasonGuard.valid;
  if(!validation.valid||(rolloverReviewRequired&&!seasonReview.valid)){setState({fantraxPreview:fantraxPreviewState({confirmTeamMappings:false,error:[...validation.errors,...(rolloverReviewRequired?seasonReview.errors:[])].join(" ")})});return}
  setState({fantraxPreview:fantraxPreviewState({savingTeamMappings:true,confirmTeamMappings:false,error:""})});
  try{
    await saveFantraxTeamMappings(appState.activeLeague.id,teamMappingSaveRows({leagueId:appState.activeLeague.id,cloudTeams:appState.teams,pendingMappings:pending}));
    if(rolloverReviewRequired){const savedLeague=await saveFantraxSeasonContext(appState.activeLeague.id,reviewedFantraxSeasonSettings(data.observedSeasonContext));setState({activeLeague:savedLeague})}
    await refreshLeagueData();
    const players=await allPlayers(appState.activeLeague.id),next=await fetchFantraxPublicPreview({externalLeagueId:preview.externalLeagueId,period:preview.period,players,teams:appState.teams,reviewedSeasonContext:appState.activeLeague?.settings?.fantraxSeasonContext});
    setState({fantraxPreview:{...next,externalLeagueId:preview.externalLeagueId,period:preview.period,selectedTab:"identity",pendingTeamMappings:{},reviewTeamMappings:false,confirmTeamMappings:false,savingTeamMappings:false,allowReplacement:false,lastTeamMappingSave:new Date().toISOString()}});
  }catch(error){setState({fantraxPreview:fantraxPreviewState({savingTeamMappings:false,error:String(error?.message||error)})})}
}
async function persistReviewedFantraxRosterStatuses(){
  const preview=appState.fantraxPreview,releasePolicy=fantraxRosterSyncReleasePolicy(appState.activeLeague),releaseSignature=fantraxRosterSyncReleaseSignature(releasePolicy),periodGuard=fantraxRosterSyncPeriodGuard(preview.period),seasonGuard=fantraxSeasonWriteGuard(preview.data?.seasonContextComparison),validation=validateControlledFantraxStatusUpdates(preview.data?.rosterItems||[],preview.rosterSyncSelectedIds||[],releasePolicy.effectiveCap),releaseUnchanged=preview.rosterSyncReleaseSignature===releaseSignature;
  if(!releasePolicy.valid||!releaseUnchanged||!seasonGuard.valid||!periodGuard.valid||!preview.rosterSyncReviewed||!validation.valid){setState({fantraxPreview:fantraxPreviewState({confirmRosterSync:false,rosterSyncReviewed:false,error:releasePolicy.error||(!releaseUnchanged?"The Fantrax synchronization release changed after review. Start a new review.":"")||seasonGuard.error||periodGuard.error||validation.errors.join(" ")||"Review the eligible Fantrax status changes before applying."})});return}
  setState({fantraxPreview:fantraxPreviewState({savingRosterSync:true,confirmRosterSync:false,error:""})});
  try{
    const leagueId=appState.activeLeague.id,seasonContext=preview.data?.seasonContextComparison?.observed,previewFetchedAt=preview.data?.fetchedAt,externalLeagueId=preview.externalLeagueId;
    const manifestInput={leagueId,period:preview.period,seasonContext,updates:validation.updates,releaseTier:releasePolicy.releaseTier,effectiveCap:releasePolicy.effectiveCap};
    const repeatGuard=()=>{
      const currentPreview=appState.fantraxPreview,currentRelease=fantraxRosterSyncReleasePolicy(appState.activeLeague),currentSeason=fantraxSeasonWriteGuard(currentPreview.data?.seasonContextComparison),currentPeriod=fantraxRosterSyncPeriodGuard(currentPreview.period),stale=currentPreview.data?.fetchedAt!==previewFetchedAt||currentPreview.externalLeagueId!==externalLeagueId||appState.activeLeague?.id!==leagueId;
      if(!currentRelease.valid||fantraxRosterSyncReleaseSignature(currentRelease)!==releaseSignature||!currentSeason.valid||!currentPeriod.valid||stale)throw new Error(currentRelease.error||currentSeason.error||currentPeriod.error||"The Fantrax preview or active league changed after review. Refresh and review again.");
    };
    const execution=await executeReviewedFantraxSync({manifestInput,allowCreate:!releasePolicy.recoveryOnly,beforeAttempt:repeatGuard,beforeGroup:repeatGuard}),attempt=execution.attempt,digest=execution.digest,summary=fantraxRosterSyncSummary(execution.result);
    await refreshLeagueData();
    const players=await allPlayers(appState.activeLeague.id),next=await fetchFantraxPublicPreview({externalLeagueId:preview.externalLeagueId,period:preview.period,players,teams:appState.teams,reviewedSeasonContext:appState.activeLeague?.settings?.fantraxSeasonContext});
    const fantraxSyncAttempts=await listFantraxSyncAttempts(leagueId);
    setState({fantraxPreview:{...next,externalLeagueId:preview.externalLeagueId,period:preview.period,selectedTab:"rosters",reviewRosterSync:false,confirmRosterSync:false,rosterSyncReviewed:false,rosterSyncSelectedIds:[],savingRosterSync:false,lastRosterSync:{at:new Date().toISOString(),attemptId:attempt.id,manifestDigest:digest,...summary}},fantraxSyncAttempts});
    if(summary.skipped||summary.failedGroups)setError(`Fantrax roster-status apply was incomplete: ${summary.updated} updated, ${summary.skipped} skipped, ${summary.failedGroups} failed groups. ${Object.entries(summary.skipReasons).map(([reason,count])=>`${reason}: ${count}`).join("; ")}`);
    else setState({statusMessage:`Applied all ${summary.updated} reviewed Fantrax roster-status updates.`});
  }catch(error){setState({fantraxPreview:fantraxPreviewState({savingRosterSync:false,error:String(error?.message||error)})})}
}
async function loadRosterStatusManager(){
  if(!appState.activeLeague)return;
  try{
    const rows=rosterStatusManagerRows(await allPlayers(appState.activeLeague.id),appState.teams||[]);
    setState({rosterStatusManager:rosterStatusState({rows,error:""})});
  }catch(error){
    setState({rosterStatusManager:rosterStatusState({error:String(error?.message||error)})});
    setError(error);
  }
}
function rosterStatusFiltersFromControls(){
  return {
    search:$("#rsmSearch")?.value.trim()||"",
    currentStatus:$("#rsmCurrentStatus")?.value||"",
    teamId:$("#rsmTeam")?.value||"",
    position:$("#rsmPosition")?.value||"",
    mlbTeam:$("#rsmMlbTeam")?.value||"",
    ownerId:$("#rsmOwner")?.value||"",
    freeAgent:$("#rsmFreeAgent")?.value||"",
    changedOnly:$("#rsmChangedOnly")?.checked||false
    ,manualOnly:$("#rsmManualOnly")?.checked||false,source:$("#rsmSource")?.value||"",conflictsOnly:$("#rsmConflictsOnly")?.checked||false,missingMetadata:$("#rsmMissingMetadata")?.checked||false,updatedBy:$("#rsmUpdatedBy")?.value.trim()||""
  };
}
function rosterStatusVisibleRows(){
  const manager=appState.rosterStatusManager;
  return filterRosterStatusRows(manager.rows||[],manager.filters||{},manager.pendingChanges||{});
}
function rosterStatusPageRows(){
  const manager=appState.rosterStatusManager;
  const page=manager.page||1,pageSize=manager.pageSize||100;
  return rosterStatusVisibleRows().slice((page-1)*pageSize,page*pageSize);
}
function setRosterStatusFilters(filters){
  setState({rosterStatusManager:rosterStatusState({filters,page:1,selectedIds:[],lastSelectedId:""})});
}
async function saveRosterStatusChanges(){
  const manager=appState.rosterStatusManager;
  const validation=validateRosterStatusSave(manager.rows||[],manager.pendingChanges||{});
  if(!validation.valid){
    setState({rosterStatusManager:rosterStatusState({error:`${validation.invalid.length} invalid roster status updates.`})});
    return;
  }
  const payload=savePayload(manager.pendingChanges||{});
  if(!payload.length)return;
  try{
    setState({rosterStatusManager:rosterStatusState({saving:true,error:""})});
    await updateRosterStatuses(appState.activeLeague.id,payload);
    const rows=rosterStatusManagerRows(await allPlayers(appState.activeLeague.id),appState.teams||[]);
    setState({rosterStatusManager:rosterStatusState({rows,pendingChanges:{},selectedIds:[],lastSelectedId:"",saving:false,lastSavedAt:new Date().toLocaleString(),error:""})});
    await refreshLeagueData();
  }catch(error){
    setState({rosterStatusManager:rosterStatusState({saving:false,error:String(error?.message||error)})});
    setError(error);
  }
}
function requestClearOverrides(ids){
  const allowed=new Set(manualOverrideIds(appState.rosterStatusManager.rows||[]));
  const clearOverrideIds=[...new Set(ids)].filter(id=>allowed.has(id));
  if(clearOverrideIds.length)setState({rosterStatusManager:rosterStatusState({confirmClearOverrides:true,clearOverrideIds,error:""})});
}
async function confirmClearOverrides(){
  const ids=appState.rosterStatusManager.clearOverrideIds||[];
  try{
    await clearRosterStatusOverrides(appState.activeLeague.id,ids);
    const rows=rosterStatusManagerRows(await allPlayers(appState.activeLeague.id),appState.teams||[]);
    setState({rosterStatusManager:rosterStatusState({rows,confirmClearOverrides:false,clearOverrideIds:[],selectedIds:[],error:""})});
  }catch(error){setState({rosterStatusManager:rosterStatusState({confirmClearOverrides:false,error:String(error?.message||error)})})}
}
function requestRosterStatusSaveConfirmation(){
  const manager=appState.rosterStatusManager;
  const validation=validateRosterStatusSave(manager.rows||[],manager.pendingChanges||{});
  if(!validation.valid){
    setState({rosterStatusManager:rosterStatusState({confirmSave:false,error:`${validation.invalid.length} invalid roster status updates.`})});
    return;
  }
  if(!savePayload(manager.pendingChanges||{}).length)return;
  setState({rosterStatusManager:rosterStatusState({confirmSave:true,error:""})});
}
function tradeDraftKey(side){return side==="outgoing"?"myTeamSearchDraft":"partnerTeamSearchDraft"}
function tradeLoadingKey(side){return side==="outgoing"?"outgoingLoading":"incomingLoading"}
function tradeErrorKey(side){return side==="outgoing"?"outgoingError":"incomingError"}
function preserveTradeSearchDraft(side,value){
  setStateSilently({tradeCenter:tradeState({[tradeDraftKey(side)]:value})});
}
async function loadTradeCandidates(side,searchDraft=appState.tradeCenter[tradeDraftKey(side)]||""){
  if(!appState.activeLeague)return;
  const requestId=++tradeRequestIds[side];
  const search=String(searchDraft||"").trim();
  const trade=tradeState({[tradeDraftKey(side)]:searchDraft,[tradeLoadingKey(side)]:true,[tradeErrorKey(side)]:"",error:""});
  setState({tradeCenter:trade});
  try{
    const ownerTeamId=side==="outgoing"?selectedRosterTeamId():appState.tradeCenter.partnerTeamId;
    if(!ownerTeamId)throw new Error(side==="outgoing"?"Select My Roster team before searching assets.":"Select a partner team before searching assets.");
    const page=await listPlayerIntelligence(appState.activeLeague.id,{page:1,pageSize:25,ownerTeamId,search,sort:"dynasty_asset_score",ascending:false,scoreVersion:tradeScoreVersion()});
    if(requestId!==tradeRequestIds[side])return;
    const patch=side==="outgoing"?{outgoingSearch:search,outgoingCandidates:page.rows}:{incomingSearch:search,incomingCandidates:page.rows};
    setState({tradeCenter:tradeState({...patch,[tradeLoadingKey(side)]:false,[tradeErrorKey(side)]:"",error:""})});
  }catch(error){
    if(requestId===tradeRequestIds[side])setState({tradeCenter:tradeState({[tradeLoadingKey(side)]:false,[tradeErrorKey(side)]:String(error?.message||error)})});
  }
}
function addTradeAsset(side,playerId){
  const trade=tradeState();
  const rows=side==="outgoing"?trade.outgoingCandidates:trade.incomingCandidates;
  const player=rows.find(row=>row.id===playerId);
  setState({tradeCenter:tradeState(addTradeAssetSelection(trade,side,player))});
}
function removeTradeAsset(side,playerId){
  const trade=tradeState();
  setState({tradeCenter:tradeState(removeTradeAssetSelection(trade,side,playerId))});
}
function clearTrade(){
  setState({tradeCenter:tradeState({partnerTeamId:"",myTeamSearchDraft:"",partnerTeamSearchDraft:"",outgoingSearch:"",incomingSearch:"",outgoingPlayerIds:[],incomingPlayerIds:[],outgoingPlayers:[],incomingPlayers:[],outgoingCandidates:[],incomingCandidates:[],analysis:null,consolidationTargets:null,tradeFits:null,error:""})});
}
async function runTradeAnalysis(){
  try{
    setState({tradeCenter:tradeState({loading:true,error:""})});
    const trade=appState.tradeCenter;
    const analysis=await analyzeTrade({leagueId:appState.activeLeague.id,userTeamId:selectedRosterTeamId(),partnerTeamId:trade.partnerTeamId,outgoingPlayerIds:trade.outgoingPlayerIds,incomingPlayerIds:trade.incomingPlayerIds,scoreVersion:tradeScoreVersion()});
    setState({tradeCenter:tradeState({analysis,outgoingPlayers:analysis.outgoingAssets,incomingPlayers:analysis.incomingAssets,loading:false,error:""})});
  }catch(error){
    setState({tradeCenter:tradeState({loading:false,error:String(error?.message||error)})});
    setError(error);
  }
}
function saveTradeDraft(){
  const trade=tradeState();
  const name=$("#tradeDraftName")?.value.trim()||`Trade Draft ${trade.drafts.length+1}`;
  const now=new Date().toISOString();
  const draft={id:`draft-${Date.now()}-${trade.drafts.length}`,name,userTeamId:trade.userTeamId,partnerTeamId:trade.partnerTeamId,outgoingPlayerIds:trade.outgoingPlayerIds,incomingPlayerIds:trade.incomingPlayerIds,outgoingPlayers:trade.outgoingPlayers,incomingPlayers:trade.incomingPlayers,createdAt:now,lastAnalyzedAt:trade.analysis?now:"",analysisVersion:trade.analysis?.tradeAnalysisVersion||"",scoreVersion:trade.analysis?.scoreVersion||tradeScoreVersion(),analysis:trade.analysis};
  setState({tradeCenter:tradeState({drafts:[draft,...trade.drafts].slice(0,20),error:""})});
}
async function renderView(){
  const root=$("#viewRoot");
  if(!root)return;
  if(!appState.authUser){setHtml(root,`<section class="view-panel"><h2>Signed out</h2><p class="note">Sign in to connect to Supabase Cloud.</p></section>`);return}
  if(!appState.activeLeague){setHtml(root,`<section class="view-panel"><h2>Select a cloud league</h2><p class="note">No active cloud league is selected. Create or select one in the current application, then retry V5.</p></section>`);return}
  if(appState.view==="dashboard")setHtml(root,renderDashboard(appState,dashboardOverview));
  if(appState.view==="players")setHtml(root,renderPlayers(appState,appState.playerPage||playerPage));
  if(appState.view==="waivers")setHtml(root,renderWaiverOpportunities(appState,appState.waiverPage||waiverPage));
  if(appState.view==="tradeCenter")setHtml(root,renderTradeCenter({...appState,tradeCenter:tradeState()}));
  if(appState.view==="myRoster")setHtml(root,renderMyRoster(appState));
  if(appState.view==="rosterStatusManager")setHtml(root,renderRosterStatusManager(appState));
  if(appState.view==="teamsManagers")setHtml(root,renderTeamsManagers(appState));
  if(appState.view==="imports")setHtml(root,renderImports(appState,importUiState));
  if(appState.view==="fantraxPreview"){
    setHtml(root,renderFantraxPreview(appState));
    if(appState.fantraxPreview?.data&&appState.fantraxPreview?.selectedTab==="identity")root.querySelector(".panel")?.insertAdjacentHTML("beforeend",renderFantraxTeamIdentityManager(appState.fantraxPreview.data,appState));
  }
  if(appState.view==="settings")setHtml(root,renderSettingsDataHealth(appState));
  if(appState.view==="gate4Acceptance")setHtml(root,renderFantraxGate4Acceptance(appState));
  bindViewEvents();
}

function enableAcceptanceModeEntry(){
  if(!gate4AcceptanceMode)return;
  const settingsButton=document.querySelector('[data-view="settings"]');
  if(!settingsButton||document.querySelector('[data-view="gate4Acceptance"]'))return;
  settingsButton.insertAdjacentHTML("afterend",'<button class="nav-link" data-view="gate4Acceptance">Gate 4 Acceptance</button>');
}
function render(){
  const badge=$("#modeBadge");
  if(badge){
    badge.textContent=modeLabel();
    badge.className=`mode-badge ${appState.dataMode==="cloud"?"cloud":appState.dataMode==="offline"?"offline":""}`;
  }
  $all(".nav-link").forEach(button=>button.classList.toggle("active",button.dataset.view===appState.view));
  renderAuthPanel();
  renderLeaguePanel();
  renderMessages();
  renderView();
}
function playerQueryFromControls(){
  const context=$("#contextFilter")?.value||"";
  return {
    ...appState.playerQuery,
    search:String(appState.playerSearchDraft||$("#playerSearch")?.value||"").trim(),
    ownerTeamId:$("#ownerFilter")?.value||"",
    position:$("#positionFilter")?.value||"",
    mlbTeam:$("#mlbTeamFilter")?.value||"",
    rosterStatus:$("#rosterStatusFilter")?.value.trim()||"",
    playerStage:$("#playerStageFilter")?.value||"",
    dataAvailability:$("#dataAvailabilityFilter")?.value||"",
    context,
    freeAgentsOnly:$("#freeAgentsOnly")?.checked||context==="free",
    rosteredOnly:$("#rosteredOnly")?.checked||context==="rostered",
    sort:$("#playerSort")?.value||"dynasty_asset_score",
    ascending:$("#sortDirection")?.value==="true",
    minDynastyAssetScore:$("#minDynastyAssetScore")?.value||"",
    minChampionshipImpact:$("#minChampionshipImpact")?.value||"",
    minCeiling:$("#minCeiling")?.value||"",
    maxRisk:$("#maxRisk")?.value||"",
    minConfidence:$("#minConfidence")?.value||"",
    minBreakoutProbability:$("#minBreakoutProbability")?.value||"",
    minBuyLowScore:$("#minBuyLowScore")?.value||"",
    minAcquisitionOpportunity:$("#minAcquisitionOpportunity")?.value||"",
    pageSize:Number($("#pageSize")?.value)||50,
    page:1,
    preset:""
  };
}
function defaultPlayerQuery(){
  return {page:1,pageSize:50,search:"",ownerTeamId:"",position:"",mlbTeam:"",rosterStatus:"",playerStage:"",context:"",dataAvailability:"",sort:"dynasty_asset_score",ascending:false,scoreVersion:"",preset:""};
}
async function updatePlayerPage(query){
  setStateSilently({playerQuery:query,playerSearchDraft:query.search||""});
  const nextPage=await loadPlayerPage(query).catch(error=>{setError(error);return null});
  if(nextPage){
    playerPage=nextPage;
    setState({playerPage});
  }else renderPlayerResultsRegion();
}
async function loadComparison(){
  const ids=appState.comparisonPlayerIds||[];
  const rows=await playerIntelligenceByIds(appState.activeLeague.id,ids.slice(0,2),appState.playerPage?.scoreVersion||appState.playerQuery.scoreVersion);
  setState({comparisonPlayers:rows});
}
function waiverQueryFromControls(){
  return {
    ...appState.waiverQuery,
    position:$("#waiverPosition")?.value||"",
    playerStage:$("#waiverStage")?.value||"",
    mlbTeam:$("#waiverMlbTeam")?.value||"",
    recommendationType:$("#waiverRecommendation")?.value||"",
    dataAvailability:$("#waiverData")?.value||"",
    minDynastyAssetScore:$("#waiverMinDynasty")?.value||"",
    minChampionshipImpact:$("#waiverMinImpact")?.value||"",
    minCeiling:$("#waiverMinCeiling")?.value||"",
    maxRisk:$("#waiverMaxRisk")?.value||"",
    minConfidence:$("#waiverMinConfidence")?.value||"",
    excludeLowInformation:$("#waiverExcludeLowInfo")?.checked||false,
    page:1
  };
}
function defaultWaiverQuery(){return {page:1,pageSize:50,position:"",playerStage:"",mlbTeam:"",recommendationType:"",dataAvailability:"",minDynastyAssetScore:"",minChampionshipImpact:"",minCeiling:"",maxRisk:"",minConfidence:"",excludeLowInformation:false}}
async function updateWaiverPage(query){
  setState({waiverQuery:query});
  waiverPage=await loadWaiverPage().catch(error=>{setError(error);return waiverPage});
  setState({waiverPage});
  render();
}
function bindViewEvents(){
  $("#mlbamBackfillSeason")?.addEventListener("change",event=>{importUiState.mlbamBackfill={...importUiState.mlbamBackfill,season:Number(event.target.value),preview:null,reviewed:false,result:null,error:""};render()});
  $("#reviewMlbamBackfill")?.addEventListener("change",event=>{importUiState.mlbamBackfill={...importUiState.mlbamBackfill,reviewed:event.target.checked};render()});
  $("#previewMlbamBackfill")?.addEventListener("click",async()=>{
    const current=importUiState.mlbamBackfill;importUiState.mlbamBackfill={...current,running:true,preview:null,reviewed:false,result:null,error:""};render();
    try{const preview=await previewMlbamIdentityBackfill({leagueId:appState.activeLeague.id,season:current.season});importUiState.mlbamBackfill={...current,running:false,preview,reviewed:false,result:null,error:""}}
    catch(error){const message=String(error?.message||error);importUiState.mlbamBackfill={...current,running:false,preview:{status:"UNAVAILABLE",createdAt:new Date().toISOString(),error:message,summary:{}},reviewed:false,result:null,error:message}}render();
  });
  $("#applyMlbamBackfill")?.addEventListener("click",async()=>{
    const current=importUiState.mlbamBackfill;if(!current.preview||!current.reviewed){setError("Preview and review the MLBAM backfill first.");return}
    importUiState.mlbamBackfill={...current,running:true,result:null,error:""};render();
    try{const result=await applyMlbamIdentityBackfill({leagueId:appState.activeLeague.id,reviewedPreview:current.preview,reviewed:true});importUiState.mlbamBackfill={...current,running:false,preview:null,reviewed:false,result,error:""};await refreshLeagueData()}
    catch(error){importUiState.mlbamBackfill={...current,running:false,result:null,error:String(error?.message||error)}}render();
  });
  $("#statcastSeason")?.addEventListener("change",event=>{importUiState.statcast={...importUiState.statcast,season:Number(event.target.value),preview:null,reviewed:false,result:null,error:""};render()});
  $("#statcastPlayerType")?.addEventListener("change",event=>{importUiState.statcast={...importUiState.statcast,playerType:event.target.value,preview:null,reviewed:false,result:null,error:""};render()});
  $("#reviewAutomatedStatcast")?.addEventListener("change",event=>{importUiState.statcast={...importUiState.statcast,reviewed:event.target.checked};render()});
  $("#previewAutomatedStatcast")?.addEventListener("click",async()=>{
    const current=importUiState.statcast;
    importUiState.statcast={...current,running:true,preview:null,reviewed:false,result:null,error:""};render();
    try{
      const preview=await previewAutomatedStatcastRefresh({leagueId:appState.activeLeague.id,playerType:current.playerType,season:current.season});
      importUiState.statcast={...current,running:false,preview,reviewed:false,result:null,error:""};
    }catch(error){importUiState.statcast={...current,running:false,preview:null,reviewed:false,result:null,error:String(error?.message||error)}}
    render();
  });
  $("#applyAutomatedStatcast")?.addEventListener("click",async()=>{
    const current=importUiState.statcast;
    if(!current.preview||!current.reviewed){setError("Preview and review the automated Statcast refresh first.");return}
    importUiState.statcast={...current,running:true,result:null,error:""};render();
    try{
      const result=await applyAutomatedStatcastRefresh({leagueId:appState.activeLeague.id,playerType:current.playerType,reviewedPreview:current.preview});
      importUiState.statcast={...current,running:false,preview:null,reviewed:false,result,error:""};
      await refreshLeagueData();
    }catch(error){importUiState.statcast={...current,running:false,result:null,error:String(error?.message||error)}}
    render();
  });
  $("#startGate4Acceptance")?.addEventListener("click",async()=>{await gate4Controller?.start();publishGate4ControllerState()});
  $("#fetchGate4PreviewA")?.addEventListener("click",async()=>{await gate4Controller?.fetchPreviewA();publishGate4ControllerState()});
  $all("[data-gate4-candidate]").forEach(input=>input.addEventListener("change",event=>{gate4Controller?.toggleCandidate(event.target.dataset.gate4Candidate,event.target.checked);publishGate4ControllerState()}));
  $("#captureGate4ProtectedBaseline")?.addEventListener("click",async()=>{await gate4Controller?.captureProtectedBaseline();publishGate4ControllerState()});
  $("#enableGate4ExpandedOptIn")?.addEventListener("click",async()=>{await gate4Controller?.enableExpandedOptIn();publishGate4ControllerState()});
  $("#fetchGate4PreviewB")?.addEventListener("click",async()=>{await gate4Controller?.fetchPreviewB();publishGate4ControllerState()});
  $("#buildGate4Manifest")?.addEventListener("click",async()=>{await gate4Controller?.buildManifestReview();publishGate4ControllerState()});
  $("#armGate4ExactDigest")?.addEventListener("click",async()=>{await gate4Controller?.armExactDigest($("#gate4ExactDigest")?.value||"");publishGate4ControllerState()});
  $("#persistGate4Once")?.addEventListener("click",async()=>{await gate4Controller?.persistOnce();publishGate4ControllerState()});
  $("#fetchGate4PostWriteAgreement")?.addEventListener("click",async()=>{await gate4Controller?.fetchPostWriteAgreement();publishGate4ControllerState()});
  $("#disableGate4ExpandedOptIn")?.addEventListener("click",async()=>{await gate4Controller?.disableExpandedOptIn();publishGate4ControllerState()});
  $("#fetchFantraxPreview")?.addEventListener("click",()=>{resetGate4Acceptance("A new Fantrax preview invalidated the Gate 4 review.");loadFantraxPreview()});
  $("#fantraxExternalLeagueId")?.addEventListener("change",event=>{resetGate4Acceptance("Fantrax league configuration changed.");setState({fantraxPreview:clearFantraxPendingReviews(fantraxPreviewState({data:null,externalLeagueId:event.target.value.trim(),error:"",selectedTab:"summary",page:1}))})});
  $("#fantraxPeriod")?.addEventListener("change",event=>{resetGate4Acceptance("Fantrax period changed.");setState({fantraxPreview:clearFantraxPendingReviews(fantraxPreviewState({data:null,period:event.target.value,error:"",selectedTab:"summary",page:1}))})});
  $("#clearFantraxPreview")?.addEventListener("click",()=>{resetGate4Acceptance("Fantrax preview was cleared.");setState({fantraxPreview:clearFantraxPendingReviews(fantraxPreviewState({data:null,error:"",selectedTab:"summary",page:1}))})});
  $all("[data-fantrax-tab]").forEach(button=>button.addEventListener("click",()=>setState({fantraxPreview:fantraxPreviewState({selectedTab:button.dataset.fantraxTab,page:1})})));
  $("#applyFantraxRosterFilters")?.addEventListener("click",()=>setState({fantraxPreview:fantraxPreviewState({filters:fantraxFiltersFromControls(),page:1})}));
  $("#fantraxPrevPage")?.addEventListener("click",()=>setState({fantraxPreview:fantraxPreviewState({page:Math.max(1,(appState.fantraxPreview.page||1)-1)})}));
  $("#fantraxNextPage")?.addEventListener("click",()=>setState({fantraxPreview:fantraxPreviewState({page:(appState.fantraxPreview.page||1)+1})}));
  $all("[data-fantrax-team-map]").forEach(select=>select.addEventListener("change",event=>setState({fantraxPreview:fantraxPreviewState({pendingTeamMappings:setPendingTeamMapping(appState.fantraxPreview.pendingTeamMappings,event.target.dataset.fantraxTeamMap,event.target.value),reviewTeamMappings:false,confirmTeamMappings:false,reviewRosterSync:false,confirmRosterSync:false,rosterSyncReviewed:false,rosterSyncSelectedIds:[],rosterSyncReleaseSignature:"",error:""})})));
  $("#reviewFantraxTeamMappings")?.addEventListener("click",()=>setState({fantraxPreview:fantraxPreviewState({reviewTeamMappings:true,confirmTeamMappings:false})}));
  $("#cancelFantraxTeamMappings")?.addEventListener("click",()=>setState({fantraxPreview:fantraxPreviewState({pendingTeamMappings:{},reviewTeamMappings:false,confirmTeamMappings:false,allowReplacement:false,reviewRosterSync:false,confirmRosterSync:false,rosterSyncReviewed:false,rosterSyncSelectedIds:[],rosterSyncReleaseSignature:"",error:""})}));
  $("#confirmFantraxReplacement")?.addEventListener("change",event=>setState({fantraxPreview:fantraxPreviewState({allowReplacement:event.target.checked,reviewRosterSync:false,confirmRosterSync:false,rosterSyncReviewed:false,rosterSyncSelectedIds:[],rosterSyncReleaseSignature:""})}));
  $("#confirmFantraxSeasonReview")?.addEventListener("change",event=>setState({fantraxPreview:fantraxPreviewState({seasonReviewAcknowledged:event.target.checked,confirmTeamMappings:false,reviewRosterSync:false,confirmRosterSync:false,rosterSyncReviewed:false,rosterSyncSelectedIds:[],rosterSyncReleaseSignature:""})}));
  $("#saveFantraxTeamMappings")?.addEventListener("click",()=>setState({fantraxPreview:fantraxPreviewState({confirmTeamMappings:true})}));
  $("#dismissSaveFantraxTeamMappings")?.addEventListener("click",()=>setState({fantraxPreview:fantraxPreviewState({confirmTeamMappings:false})}));
  $("#confirmSaveFantraxTeamMappings")?.addEventListener("click",persistFantraxTeamMappings);
  $("#reviewFantraxRosterSync")?.addEventListener("click",()=>{const policy=fantraxRosterSyncReleasePolicy(appState.activeLeague);setState({fantraxPreview:fantraxPreviewState({reviewRosterSync:policy.valid,confirmRosterSync:false,rosterSyncReviewed:false,rosterSyncSelectedIds:[],rosterSyncReleaseSignature:policy.valid?fantraxRosterSyncReleaseSignature(policy):"",error:policy.error})})});
  $("#cancelFantraxRosterSync")?.addEventListener("click",()=>setState({fantraxPreview:fantraxPreviewState({reviewRosterSync:false,confirmRosterSync:false,rosterSyncReviewed:false,rosterSyncSelectedIds:[],rosterSyncReleaseSignature:"",error:""})}));
  $all("[data-fantrax-roster-select]").forEach(input=>input.addEventListener("change",event=>{
    const policy=fantraxRosterSyncReleasePolicy(appState.activeLeague),selection=controlledFantraxRosterSelection(appState.fantraxPreview?.rosterSyncSelectedIds||[],event.target.dataset.fantraxRosterSelect,event.target.checked,policy.effectiveCap);
    setState({fantraxPreview:fantraxPreviewState({rosterSyncSelectedIds:selection.selectedIds,rosterSyncReviewed:false,confirmRosterSync:false,error:policy.error||selection.error})});
  }));
  $("#confirmFantraxRosterReview")?.addEventListener("change",event=>setState({fantraxPreview:fantraxPreviewState({rosterSyncReviewed:event.target.checked,confirmRosterSync:false})}));
  $("#openFantraxRosterSyncConfirmation")?.addEventListener("click",()=>setState({fantraxPreview:fantraxPreviewState({confirmRosterSync:true})}));
  $("#dismissFantraxRosterSync")?.addEventListener("click",()=>setState({fantraxPreview:fantraxPreviewState({confirmRosterSync:false})}));
  $("#confirmFantraxRosterSync")?.addEventListener("click",persistReviewedFantraxRosterStatuses);
  $("#playerSearchButton")?.addEventListener("click",async()=>{
    await updatePlayerPage(playerQueryFromControls());
  });
  $("#playerSearch")?.addEventListener("input",event=>setStateSilently({playerSearchDraft:event.target.value}));
  $("#playerSearch")?.addEventListener("keydown",event=>{if(event.key==="Enter"){event.preventDefault();updatePlayerPage(playerQueryFromControls())}});
  $("#clearPlayerFilters")?.addEventListener("click",async()=>{setStateSilently({playerSearchDraft:""});await updatePlayerPage(defaultPlayerQuery())});
  $all("[data-player-preset]").forEach(button=>button.addEventListener("click",async()=>{
    const preset=presetQuery(button.dataset.playerPreset);
    if(preset){setStateSilently({playerSearchDraft:preset.search||""});await updatePlayerPage({...defaultPlayerQuery(),...preset})}
  }));
  $all("[data-player-detail]").forEach(button=>button.addEventListener("click",()=>{
    const row=(appState.playerPage?.rows||[]).find(item=>item.id===button.dataset.playerDetail);
    setState({selectedPlayerId:button.dataset.playerDetail,selectedPlayer:row||null});
  }));
  $("#closePlayerDetail")?.addEventListener("click",()=>setState({selectedPlayerId:"",selectedPlayer:null}));
  $all("[data-compare-player]").forEach(input=>input.addEventListener("change",async event=>{
    const id=event.target.dataset.comparePlayer;
    const current=appState.comparisonPlayerIds||[];
    const next=event.target.checked?[...current.filter(item=>item!==id),id].slice(-2):current.filter(item=>item!==id);
    setState({comparisonPlayerIds:next});
    await loadComparison().catch(setError);
  }));
  $("#clearComparison")?.addEventListener("click",()=>setState({comparisonPlayerIds:[],comparisonPlayers:[]}));
  $("#prevPlayers")?.addEventListener("click",async()=>{
    await updatePlayerPage({...appState.playerQuery,page:Math.max(1,appState.playerQuery.page-1)});
  });
  $("#nextPlayers")?.addEventListener("click",async()=>{
    await updatePlayerPage({...appState.playerQuery,page:appState.playerQuery.page+1});
  });
  $("#myTeamSelect")?.addEventListener("change",async event=>{
    saveLeagueUiPreferences(appState.activeLeague.id,{myTeamId:event.target.value});
    const userTeamResolution=resolveUserFantasyTeam({
      leagueId:appState.activeLeague.id,
      authenticatedUserId:appState.authUser?.id||"",
      preferredTeamId:event.target.value,
      leagueRows:[appState.activeLeague],
      membershipRows:await memberships(appState.activeLeague.id).catch(()=>[]),
      teamRows:appState.teams||[],
      playerRows:appState.rosterSummary||[],
      scoreRows:[],
      fallbackTeamTokens:USER_TEAM_FALLBACK_TOKENS
    });
    if(userTeamResolution.teamId&&userTeamResolution.rejectedPreferredTeamId)saveLeagueUiPreferences(appState.activeLeague.id,{myTeamId:userTeamResolution.teamId});
    const rosterPlayers=userTeamResolution.teamId?await rosterByTeam(appState.activeLeague.id,userTeamResolution.teamId):[];
    setState({userTeamResolution,rosterPlayers,rosterRecommendations:null,tradeCenter:{...appState.tradeCenter,userTeamId:userTeamResolution.teamId,userTeamName:userTeamResolution.team?.name||"",analysis:null,consolidationTargets:null,tradeFits:null}});
  });
  $("#refreshRosterRecommendations")?.addEventListener("click",async()=>{
    const teamId=selectedRosterTeamId();
    if(!teamId){setError("Select a fantasy team before loading recommendations.");return}
    try{
      setState({rosterRecommendationsLoading:true,rosterRecommendationsError:""});
      const rosterRecommendations=await getRosterRecommendations(appState.activeLeague.id,teamId,{scoreVersion:appState.playerPage?.scoreVersion});
      setState({rosterRecommendations,rosterRecommendationsLoading:false});
    }catch(error){setState({rosterRecommendationsLoading:false,rosterRecommendationsError:String(error?.message||error)});setError(error)}
  });
  $("#rsmApplyFilters")?.addEventListener("click",()=>setRosterStatusFilters(rosterStatusFiltersFromControls()));
  $("#rsmClearFilters")?.addEventListener("click",()=>setRosterStatusFilters({search:"",currentStatus:"",teamId:"",position:"",mlbTeam:"",ownerId:"",freeAgent:"",changedOnly:false,manualOnly:false,source:"",conflictsOnly:false,missingMetadata:false,updatedBy:""}));
  $all("[data-rsm-filter-status]").forEach(button=>button.addEventListener("click",()=>setRosterStatusFilters({...appState.rosterStatusManager.filters,currentStatus:button.dataset.rsmFilterStatus})));
  $("#rsmSelectPage")?.addEventListener("change",event=>{
    const rows=rosterStatusPageRows();
    const selectedIds=event.target.checked?selectPageRows(appState.rosterStatusManager.selectedIds||[],rows):clearSelection();
    setState({rosterStatusManager:rosterStatusState({selectedIds,lastSelectedId:""})});
  });
  $all("[data-rsm-select]").forEach(input=>input.addEventListener("click",event=>{
    const selectedIds=toggleSelection(appState.rosterStatusManager.selectedIds||[],input.dataset.rsmSelect,{checked:event.target.checked,visibleRows:rosterStatusPageRows(),lastSelectedId:appState.rosterStatusManager.lastSelectedId,shiftKey:event.shiftKey});
    setState({rosterStatusManager:rosterStatusState({selectedIds,lastSelectedId:input.dataset.rsmSelect})});
  }));
  $("#rsmSelectAllFiltered")?.addEventListener("click",()=>setState({rosterStatusManager:rosterStatusState({selectedIds:selectAllFilteredRows(rosterStatusVisibleRows()),lastSelectedId:""})}));
  $("#rsmClearSelection")?.addEventListener("click",()=>setState({rosterStatusManager:rosterStatusState({selectedIds:clearSelection(),lastSelectedId:""})}));
  $("#rsmPrevPage")?.addEventListener("click",()=>setState({rosterStatusManager:rosterStatusState({page:Math.max(1,(appState.rosterStatusManager.page||1)-1),lastSelectedId:""})}));
  $("#rsmNextPage")?.addEventListener("click",()=>setState({rosterStatusManager:rosterStatusState({page:(appState.rosterStatusManager.page||1)+1,lastSelectedId:""})}));
  $("#rsmPageSize")?.addEventListener("change",event=>setState({rosterStatusManager:rosterStatusState({page:1,pageSize:Number(event.target.value)||100,lastSelectedId:""})}));
  $all("[data-rsm-status]").forEach(select=>select.addEventListener("change",event=>{
    const rows=appState.rosterStatusManager.rows||[];
    const row=rows.find(item=>item.id===select.dataset.rsmStatus);
    if(!row)return;
    const pendingChanges=setPendingStatus(appState.rosterStatusManager.pendingChanges||{},row,event.target.value);
    setState({rosterStatusManager:rosterStatusState({pendingChanges,error:""})});
  }));
  $all("[data-rsm-bulk-status]").forEach(button=>button.addEventListener("click",()=>{
    const pendingChanges=bulkSetPendingStatus(appState.rosterStatusManager.pendingChanges||{},appState.rosterStatusManager.rows||[],appState.rosterStatusManager.selectedIds||[],button.dataset.rsmBulkStatus);
    setState({rosterStatusManager:rosterStatusState({pendingChanges,error:""})});
  }));
  $("#rsmClearPendingSelected")?.addEventListener("click",()=>{
    const pendingChanges=clearPendingStatusChanges(appState.rosterStatusManager.pendingChanges||{},appState.rosterStatusManager.selectedIds||[]);
    setState({rosterStatusManager:rosterStatusState({pendingChanges,error:""})});
  });
  $("#rsmClearOverridesSelected")?.addEventListener("click",()=>requestClearOverrides(appState.rosterStatusManager.selectedIds||[]));
  $("#rsmClearOverridesFiltered")?.addEventListener("click",()=>requestClearOverrides(rosterStatusVisibleRows().map(row=>row.id)));
  $("#rsmConfirmClearOverrides")?.addEventListener("click",confirmClearOverrides);
  $("#rsmDismissClearOverrides")?.addEventListener("click",()=>setState({rosterStatusManager:rosterStatusState({confirmClearOverrides:false,clearOverrideIds:[]})}));
  $("#rsmSaveChanges")?.addEventListener("click",requestRosterStatusSaveConfirmation);
  $("#rsmConfirmSave")?.addEventListener("click",saveRosterStatusChanges);
  $("#rsmDismissConfirm")?.addEventListener("click",()=>setState({rosterStatusManager:rosterStatusState({confirmSave:false})}));
  $("#rsmCancelChanges")?.addEventListener("click",()=>setState({rosterStatusManager:rosterStatusState({pendingChanges:clearAllPendingStatusChanges(),selectedIds:[],lastSelectedId:"",confirmSave:false,error:""})}));
  $("#applyWaiverFilters")?.addEventListener("click",async()=>{await updateWaiverPage(waiverQueryFromControls())});
  $("#clearWaiverFilters")?.addEventListener("click",async()=>{await updateWaiverPage(defaultWaiverQuery())});
  $("#prevWaivers")?.addEventListener("click",async()=>{await updateWaiverPage({...appState.waiverQuery,page:Math.max(1,(appState.waiverQuery.page||1)-1)})});
  $("#nextWaivers")?.addEventListener("click",async()=>{await updateWaiverPage({...appState.waiverQuery,page:(appState.waiverQuery.page||1)+1})});
  $all("[data-waiver-detail]").forEach(button=>button.addEventListener("click",()=>{
    const rec=(appState.waiverPage?.recommendations||[]).find(item=>item.playerId===button.dataset.waiverDetail);
    if(rec?.player){setState({view:"players",selectedPlayerId:rec.playerId,selectedPlayer:rec.player})}
  }));
  $all("[data-waiver-upgrade]").forEach(button=>button.addEventListener("click",async()=>{
    const teamId=selectedRosterTeamId();
    if(!teamId){setError("Select a fantasy team before comparing upgrades.");return}
    try{
      const waiverUpgrade=await findRosterUpgradeCandidates(teamId,button.dataset.waiverUpgrade,{leagueId:appState.activeLeague.id,scoreVersion:appState.waiverPage?.scoreVersion});
      setState({waiverUpgrade});
    }catch(error){setError(error)}
  }));
  $all("[data-watch-player]").forEach(button=>button.addEventListener("click",()=>{
    const id=button.dataset.watchPlayer;
    const current=appState.watchListIds||[];
    const next=current.includes(id)?current.filter(item=>item!==id):[...current,id].slice(-50);
    setState({watchListIds:next});
  }));
  $("#tradePartnerTeam")?.addEventListener("change",async event=>{
    setState({tradeCenter:tradeState({partnerTeamId:event.target.value,partnerTeamSearchDraft:"",incomingSearch:"",incomingPlayerIds:[],incomingPlayers:[],incomingCandidates:[],analysis:null,consolidationTargets:null,tradeFits:null,error:""})});
    if(event.target.value)await loadTradeCandidates("incoming");
  });
  const runTradeSearch=async side=>{
    const input=side==="outgoing"?$("#tradeOutgoingSearch"):$("#tradeIncomingSearch");
    await loadTradeCandidates(side,input?.value||"");
  };
  $("#searchTradeOutgoing")?.addEventListener("click",()=>runTradeSearch("outgoing"));
  $("#searchTradeIncoming")?.addEventListener("click",()=>runTradeSearch("incoming"));
  $("#tradeOutgoingSearch")?.addEventListener("input",event=>preserveTradeSearchDraft("outgoing",event.target.value));
  $("#tradeIncomingSearch")?.addEventListener("input",event=>preserveTradeSearchDraft("incoming",event.target.value));
  $("#tradeOutgoingSearch")?.addEventListener("keydown",event=>{if(event.key==="Enter"){event.preventDefault();runTradeSearch("outgoing")}});
  $("#tradeIncomingSearch")?.addEventListener("keydown",event=>{if(event.key==="Enter"){event.preventDefault();runTradeSearch("incoming")}});
  $("#clearTradeOutgoingSearch")?.addEventListener("click",()=>loadTradeCandidates("outgoing",""));
  $("#clearTradeIncomingSearch")?.addEventListener("click",()=>loadTradeCandidates("incoming",""));
  $all("[data-trade-add-outgoing]").forEach(button=>button.addEventListener("click",()=>addTradeAsset("outgoing",button.dataset.tradeAddOutgoing)));
  $all("[data-trade-add-incoming]").forEach(button=>button.addEventListener("click",()=>addTradeAsset("incoming",button.dataset.tradeAddIncoming)));
  $all("[data-trade-remove]").forEach(button=>button.addEventListener("click",()=>removeTradeAsset(button.dataset.tradeSide,button.dataset.tradeRemove)));
  $("#analyzeTrade")?.addEventListener("click",async()=>{await runTradeAnalysis()});
  $("#clearTrade")?.addEventListener("click",clearTrade);
  $("#findConsolidationTargets")?.addEventListener("click",async()=>{
    try{
      const trade=appState.tradeCenter;
      const consolidationTargets=await findConsolidationTargets({leagueId:appState.activeLeague.id,teamId:selectedRosterTeamId(),outgoingPlayerIds:trade.outgoingPlayerIds,targetTeamId:trade.partnerTeamId,options:{scoreVersion:tradeScoreVersion()}});
      setState({tradeCenter:tradeState({consolidationTargets,error:""})});
    }catch(error){setState({tradeCenter:tradeState({error:String(error?.message||error)})});setError(error)}
  });
  $("#findTradeFits")?.addEventListener("click",async()=>{
    try{
      const playerId=appState.tradeCenter.outgoingPlayerIds[0];
      const tradeFits=await findTradeFits({leagueId:appState.activeLeague.id,teamId:selectedRosterTeamId(),playerId,options:{scoreVersion:tradeScoreVersion()}});
      setState({tradeCenter:tradeState({tradeFits,error:""})});
    }catch(error){setState({tradeCenter:tradeState({error:String(error?.message||error)})});setError(error)}
  });
  $all("[data-trade-player-detail]").forEach(button=>button.addEventListener("click",()=>{
    const row=[...(appState.tradeCenter?.outgoingCandidates||[]),...(appState.tradeCenter?.incomingCandidates||[]),...(appState.tradeCenter?.outgoingPlayers||[]),...(appState.tradeCenter?.incomingPlayers||[])].find(item=>item.id===button.dataset.tradePlayerDetail);
    if(row)setState({view:"players",selectedPlayerId:row.id,selectedPlayer:row});
  }));
  $("#saveTradeDraft")?.addEventListener("click",saveTradeDraft);
  $all("[data-open-trade-draft]").forEach(button=>button.addEventListener("click",()=>{
    const draft=appState.tradeCenter.drafts.find(item=>item.id===button.dataset.openTradeDraft);
    if(draft)setState({tradeCenter:tradeState({...draft,drafts:appState.tradeCenter.drafts,error:""})});
  }));
  $all("[data-rename-trade-draft]").forEach(button=>button.addEventListener("click",()=>{
    const name=$("#tradeDraftName")?.value.trim();
    if(!name){setState({tradeCenter:tradeState({error:"Enter a draft name before renaming."})});return}
    setState({tradeCenter:tradeState({drafts:appState.tradeCenter.drafts.map(draft=>draft.id===button.dataset.renameTradeDraft?{...draft,name}:draft),error:""})});
  }));
  $all("[data-delete-trade-draft]").forEach(button=>button.addEventListener("click",()=>{
    setState({tradeCenter:tradeState({drafts:appState.tradeCenter.drafts.filter(draft=>draft.id!==button.dataset.deleteTradeDraft),error:""})});
  }));
  $("#linkManagerButton")?.addEventListener("click",async()=>{
    const team=appState.teams.find(item=>item.id===$("#linkTeam")?.value);
    const manager=appState.managers.find(item=>item.id===$("#linkManager")?.value);
    if(!team||!manager){setError("Select an unassigned team and an existing manager.");return}
    try{await linkManagerToTeam(appState.activeLeague.id,team,manager);await refreshLeagueData()}catch(error){setError(error)}
  });
  $all("[data-health-detail]").forEach(button=>button.addEventListener("click",()=>{
    const check=appState.health?.checks?.[Number(button.dataset.healthDetail)];
    if(check?.playerQuery){
      setState({view:"players"});
      updatePlayerPage({...defaultPlayerQuery(),...check.playerQuery});
      return;
    }
    if(check?.details)setState({healthDetails:{...check.details,page:1,pageSize:25}});
  }));
  $("#healthPrev")?.addEventListener("click",()=>{
    const details=appState.healthDetails;
    if(details)setState({healthDetails:{...details,page:Math.max(1,(details.page||1)-1)}});
  });
  $("#healthNext")?.addEventListener("click",()=>{
    const details=appState.healthDetails;
    if(details)setState({healthDetails:{...details,page:(details.page||1)+1}});
  });
  $("#recalculateEngine")?.addEventListener("click",async()=>{
    if(appState.engineRun?.running){
      engineCancelRequested=true;
      setState({engineRun:{...appState.engineRun,progress:{...(appState.engineRun.progress||{}),stage:"cancelling"}}});
      return;
    }
    engineCancelRequested=false;
    try{
      setState({engineRun:{running:true,progress:null,result:null,error:null}});
      const result=await calculateLeagueScores(appState.activeLeague.id,{
        cancelled:()=>engineCancelRequested,
        onProgress:progress=>setState({engineRun:{running:true,progress,result:null,error:null}})
      });
      setState({engineRun:{running:false,progress:null,result,error:null}});
      await refreshLeagueData();
    }catch(error){
      setState({engineRun:{running:false,progress:null,result:null,error:String(error?.message||error)}});
      if(!error?.cancelled)setError(error);
    }
  });
  $all("[data-import-file]").forEach(input=>input.addEventListener("change",event=>{
    const step=event.target.dataset.importFile;
    importUiState.files[step]=event.target.files?.[0]||null;
    delete importUiState.previews[step];
    delete importUiState.reviewed[step];
    importUiState.preview=null;
    importUiState.result=null;
    render();
  }));
  $all("[data-clear-import-file]").forEach(button=>button.addEventListener("click",()=>{
    const step=button.dataset.clearImportFile;
    importUiState.files[step]=null;
    delete importUiState.previews[step];
    delete importUiState.reviewed[step];
    importUiState.preview=null;
    importUiState.result=null;
    render();
  }));
  $all("[data-import-reviewed]").forEach(input=>input.addEventListener("change",event=>{
    importUiState.reviewed[event.target.dataset.importReviewed]=event.target.checked;
    render();
  }));
  $all("[data-preview-import]").forEach(button=>button.addEventListener("click",async()=>{
    const step=button.dataset.previewImport,file=importUiState.files[step]||$(`#file-${step}`)?.files?.[0];
    try{
      importUiState.preview=await previewImport({step,leagueId:appState.activeLeague.id,file});
      importUiState.previews[step]=importUiState.preview;
      importUiState.files[step]=file;
      importUiState.reviewed[step]=false;
      render();
    }catch(error){setError(error)}
  }));
  $all("[data-run-import]").forEach(button=>button.addEventListener("click",async()=>{
    const step=button.dataset.runImport,file=importUiState.files[step];
    if(!importUiState.previews[step]){setError("Preview this file before uploading.");return}
    if(!importUiState.reviewed[step]){setError("Review and confirm the preview before uploading.");return}
    try{
      importUiState.running=true;
      importUiState.result=await runImport({step,leagueId:appState.activeLeague.id,file,reviewedPreview:importUiState.previews[step],onProgress:progress=>{importUiState.result=progress;render()}});
      importUiState.running=false;
      await refreshLeagueData();
    }catch(error){importUiState.running=false;setError(error)}
  }));
}
function bindShellEvents(){
  document.body.addEventListener("click",event=>{
    const nav=event.target.closest("[data-view]");
    if(nav){
      setState({view:nav.dataset.view});
      saveUiPreferences({view:nav.dataset.view});
      render();
      if(nav.dataset.view==="waivers")updateWaiverPage(appState.waiverQuery);
      if(nav.dataset.view==="tradeCenter"){
        setState({tradeCenter:tradeState({outgoingCandidates:appState.tradeCenter.outgoingCandidates?.length?appState.tradeCenter.outgoingCandidates:appState.tradeCenter.outgoingCandidates})});
        loadTradeCandidates("outgoing").then(()=>render()).catch(setError);
      }
      if(nav.dataset.view==="rosterStatusManager"&&!(appState.rosterStatusManager.rows||[]).length)loadRosterStatusManager();
    }
  });
  document.body.addEventListener("submit",async event=>{
    if(event.target.id!=="signInForm")return;
    event.preventDefault();
    const email=$("#email")?.value.trim()||"",password=$("#password")?.value||"";
    setState({authSignIn:{pending:true,error:""}});
    try{
      const {error}=await signIn(email,password);
      if(error)throw error;
      await bootstrap();
    }catch(error){
      const message=String(error?.message||error||"Authentication failed.");
      setState({authSignIn:{pending:false,error:message}});
      setError(error);
    }finally{
      if(appState.authSignIn?.pending)setState({authSignIn:{pending:false,error:""}});
    }
  });
  document.body.addEventListener("click",async event=>{
    if(event.target.id==="signOut"){resetGate4Acceptance("Authentication ended.");await signOut();setState({authUser:null,activeLeague:null,dataMode:"offline",fantraxPreview:clearFantraxPendingReviews(fantraxPreviewState({data:null,externalLeagueId:"",period:"",error:""}))});render()}
    if(event.target.id==="retryCloud"){await bootstrap()}
    if(event.target.id==="refreshLeague"){await refreshLeagueData();render()}
    if(event.target.id==="runDataHealth"){
      if(appState.healthRunning)return;
      setState({healthRunning:true,healthError:""});
      try{
        const health=await runWithDataHealthTimeout(()=>runDataHealth(appState.activeLeague.id,{teamId:selectedRosterTeamId(),authenticatedUserId:appState.authUser?.id||"",preferredTeamId:preferredTeamIdForLeague(appState.activeLeague.id),userTeamResolution:appState.userTeamResolution,tradeState:appState.tradeCenter,rosterStatusManager:appState.rosterStatusManager,fantraxPreview:appState.fantraxPreview,fantraxSyncAttempts:appState.fantraxSyncAttempts,fantraxSyncAuditStatus:appState.fantraxSyncAuditStatus,fantraxSyncAuditError:appState.fantraxSyncAuditError,mlbamBackfillPreview:importUiState.mlbamBackfill.preview}));
        setState({health,healthDetails:null,healthRunning:false,healthError:""});
      }catch(error){
        setState({healthRunning:false,healthError:String(error?.message||error||"Data Health failed.")});
        setError(error);
      }
    }
  });
  document.body.addEventListener("change",async event=>{
    if(event.target.id==="leagueSelect"){
      resetGate4Acceptance("Active league changed.");
      setState({fantraxPreview:clearFantraxPendingReviews(fantraxPreviewState({data:null,externalLeagueId:"",period:"",error:""}))});
      await selectLeague(event.target.value);
      await refreshLeagueData();
      render();
    }
  });
}
async function bootstrap(){
  clearErrors();
  try{
    setState({view:appState.ui.view||"dashboard",loading:true});
    await initializeAuth((_,message)=>setHtml($("#messagePanel"),message||"Loading"));
    if(appState.authUser)await refreshAccessibleLeagues(appState.authUser.id);
    if(appState.activeLeague)await refreshLeagueData();
    if(appState.activeLeague&&appState.view==="rosterStatusManager")await loadRosterStatusManager();
  }catch(error){
    setError(error);
  }finally{
    setState({loading:false});
    render();
  }
}
subscribe(render);
enableAcceptanceModeEntry();
bindShellEvents();
window.__DYNASTY_V5_SCORE_DIAGNOSTICS__={buildLiveScoreDiagnosticsForLeagueName};
bootstrap();
