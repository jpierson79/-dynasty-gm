import { $, $all, debounce, escapeHtml, optionHtml, setHtml } from "./utils/dom.js";
import { appState, clearErrors, preferredTeamIdForLeague, saveLeagueUiPreferences, saveUiPreferences, setError, setState, setStateSilently, subscribe } from "./state/appState.js";
import { initializeAuth, refreshAccessibleLeagues, selectLeague, signIn, signOut } from "./services/authService.js";
import { loadLeagueOverview } from "./services/cloudDataService.js";
import { runDataHealth } from "./services/dataHealthService.js?v5-4-1-user-team";
import { buildLiveScoreDiagnosticsForLeagueName } from "./services/liveScoreDiagnosticsService.js";
import { positionOptions, rosterByTeam } from "./repositories/playerRepository.js";
import { listPlayerIntelligence, playerIntelligenceByIds } from "./repositories/playerIntelligenceRepository.js";
import { linkManagerToTeam } from "./repositories/managerRepository.js";
import { calculateLeagueScores } from "./engine/dynastyEngine.js";
import { previewImport, runImport } from "./imports/cloudImportController.js";
import { presetQuery } from "./config/playerIntelligencePresets.js";
import { findRosterUpgradeCandidates, getRosterRecommendations, getWaiverRecommendations } from "./services/decisionIntelligenceService.js";
import { analyzeTrade, findConsolidationTargets, findTradeFits } from "./services/tradeAnalysisService.js";
import { addTradeAssetSelection, removeTradeAssetSelection } from "./services/tradeInteractionService.js";
import { resolveUserFantasyTeam } from "./services/userTeamResolver.js?v5-4-1-user-team-final";
import { memberships } from "./repositories/leagueRepository.js";
import { renderDashboard } from "./views/dashboardView.js";
import { renderPlayers } from "./views/playersView.js";
import { renderMyRoster } from "./views/rosterView.js";
import { renderWaiverOpportunities } from "./views/waiverOpportunitiesView.js";
import { renderTradeCenter } from "./views/tradeCenterView.js";
import { renderTeamsManagers } from "./views/teamsManagersView.js";
import { renderImports } from "./views/importsView.js";
import { renderSettingsDataHealth } from "./views/settingsDataHealthView.js";

const importUiState={previews:{},files:{},reviewed:{},preview:null,result:null,running:false};
let dashboardOverview={dashboardStats:null};
let playerPage={rows:[],count:0,page:1,pageSize:50};
let waiverPage={recommendations:[],count:0,page:1,pageSize:50};
let engineCancelRequested=false;
let playerRequestId=0;
let waiverRequestId=0;
const tradeRequestIds={outgoing:0,incoming:0};
const USER_TEAM_FALLBACK_TOKENS=["Rum Ham","Rum Ham & Rally Nuts","RHRN"];

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
  setHtml($("#authPanel"),signedIn
    ?`<h2>Authentication</h2><p class="note">Signed in as ${escapeHtml(appState.authUser.email||"")}</p><div class="toolbar"><button id="signOut" class="secondary">Sign Out</button><button id="retryCloud" class="secondary">Retry Cloud</button></div>`
    :`<h2>Authentication</h2><p class="note">Sign in to use Supabase Cloud. Local browser league data is not used by V5.</p><form id="signInForm" class="toolbar"><label>Email<input id="email" type="email" autocomplete="email"></label><label>Password<input id="password" type="password" autocomplete="current-password"></label><button class="primary" type="submit">Sign In</button></form>`);
}
function renderLeaguePanel(){
  const leagues=appState.accessibleLeagues||[];
  setHtml($("#leaguePanel"),`<h2>Active League</h2><div class="toolbar"><label>Cloud league<select id="leagueSelect"><option value="">Select league</option>${leagues.map(league=>optionHtml(league.id,league.name,appState.activeLeague?.id)).join("")}</select></label><button id="refreshLeague" class="secondary">Refresh League Data</button></div><p class="note">If exactly one accessible league exists, V5 selects it automatically. Empty cloud leagues are valid.</p>`);
}
async function refreshLeagueData(){
  if(!appState.activeLeague)return;
  setState({loading:true});
  clearErrors();
  try{
    dashboardOverview=await loadLeagueOverview(appState.activeLeague.id);
    const membershipRows=await memberships(appState.activeLeague.id).catch(()=>[]);
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
async function loadPlayerPage(){
  const requestId=++playerRequestId;
  setState({playersLoading:true,playersError:""});
  try{
    const page=await listPlayerIntelligence(appState.activeLeague.id,appState.playerQuery);
    if(requestId!==playerRequestId)return appState.playerPage||playerPage;
    return page;
  }catch(error){
    if(requestId===playerRequestId)setState({playersError:String(error?.message||error)});
    throw error;
  }finally{
    if(requestId===playerRequestId)setState({playersLoading:false});
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
  if(appState.view==="teamsManagers")setHtml(root,renderTeamsManagers(appState));
  if(appState.view==="imports")setHtml(root,renderImports(appState,importUiState));
  if(appState.view==="settings")setHtml(root,renderSettingsDataHealth(appState));
  bindViewEvents();
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
    search:$("#playerSearch")?.value.trim()||"",
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
  setState({playerQuery:query});
  playerPage=await loadPlayerPage().catch(error=>{setError(error);return playerPage});
  setState({playerPage});
  render();
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
  $("#playerSearchButton")?.addEventListener("click",async()=>{
    await updatePlayerPage(playerQueryFromControls());
  });
  $("#playerSearch")?.addEventListener("input",debounce(async()=>{
    await updatePlayerPage(playerQueryFromControls());
  },300));
  $("#clearPlayerFilters")?.addEventListener("click",async()=>{await updatePlayerPage(defaultPlayerQuery())});
  $all("[data-player-preset]").forEach(button=>button.addEventListener("click",async()=>{
    const preset=presetQuery(button.dataset.playerPreset);
    if(preset)await updatePlayerPage({...defaultPlayerQuery(),...preset});
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
      importUiState.result=await runImport({step,leagueId:appState.activeLeague.id,file,onProgress:progress=>{importUiState.result=progress;render()}});
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
    }
  });
  document.body.addEventListener("submit",async event=>{
    if(event.target.id!=="signInForm")return;
    event.preventDefault();
    try{
      const {error}=await signIn($("#email")?.value.trim(),$("#password")?.value||"");
      if(error)throw error;
      await bootstrap();
    }catch(error){setError(error)}
  });
  document.body.addEventListener("click",async event=>{
    if(event.target.id==="signOut"){await signOut();setState({authUser:null,activeLeague:null,dataMode:"offline"});render()}
    if(event.target.id==="retryCloud"){await bootstrap()}
    if(event.target.id==="refreshLeague"){await refreshLeagueData();render()}
    if(event.target.id==="runDataHealth"){
    try{setState({health:await runDataHealth(appState.activeLeague.id,{teamId:selectedRosterTeamId(),authenticatedUserId:appState.authUser?.id||"",preferredTeamId:preferredTeamIdForLeague(appState.activeLeague.id),userTeamResolution:appState.userTeamResolution,tradeState:appState.tradeCenter}),healthDetails:null})}catch(error){setError(error)}
    }
  });
  document.body.addEventListener("change",async event=>{
    if(event.target.id==="leagueSelect"){
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
  }catch(error){
    setError(error);
  }finally{
    setState({loading:false});
    render();
  }
}
subscribe(render);
bindShellEvents();
window.__DYNASTY_V5_SCORE_DIAGNOSTICS__={buildLiveScoreDiagnosticsForLeagueName};
bootstrap();
