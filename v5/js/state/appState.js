const ACTIVE_LEAGUE_KEY="dynasty_active_league_id";
const UI_PREF_KEY="dynasty_v5_ui_preferences";

export const appState={
  authUser:null,
  activeLeague:null,
  dataMode:"offline",
  players:[],
  playerPage:{rows:[],count:0,page:1,pageSize:50},
  rosterPlayers:[],
  dashboardStats:null,
  teams:[],
  managers:[],
  latestImportJobs:[],
  health:null,
  engineRun:{running:false,progress:null,result:null,error:null},
  loading:false,
  errors:[],
  statusMessage:"",
  view:"dashboard",
  playerQuery:{page:1,pageSize:50,search:"",ownerTeamId:"",position:"",mlbTeam:"",rosterStatus:"",playerStage:"",context:"",dataAvailability:"",sort:"dynasty_asset_score",ascending:false,scoreVersion:"",preset:""},
  playerSearchDraft:"",
  selectedPlayerId:"",
  selectedPlayer:null,
  comparisonPlayerIds:[],
  comparisonPlayers:[],
  playersLoading:false,
  playersError:"",
  waiverQuery:{page:1,pageSize:50,position:"",playerStage:"",mlbTeam:"",recommendationType:"",dataAvailability:"",minDynastyAssetScore:"",minChampionshipImpact:"",minCeiling:"",maxRisk:"",minConfidence:"",excludeLowInformation:false},
  waiverPage:{recommendations:[],count:0,page:1,pageSize:50},
  waiversLoading:false,
  waiversError:"",
  waiverUpgrade:null,
  tradeCenter:{userTeamId:"",userTeamName:"",partnerTeamId:"",myTeamSearchDraft:"",partnerTeamSearchDraft:"",outgoingSearch:"",incomingSearch:"",outgoingPlayerIds:[],incomingPlayerIds:[],outgoingPlayers:[],incomingPlayers:[],outgoingCandidates:[],incomingCandidates:[],analysis:null,consolidationTargets:null,tradeFits:null,drafts:[],outgoingLoading:false,incomingLoading:false,outgoingError:"",incomingError:"",loading:false,error:""},
  userTeamResolution:null,
  rosterRecommendations:null,
  rosterRecommendationsLoading:false,
  rosterRecommendationsError:"",
  watchListIds:[],
  healthDetails:null,
  ui:readUiPreferences()
};

const listeners=new Set();

export function subscribe(listener){
  listeners.add(listener);
  return ()=>listeners.delete(listener);
}
export function setState(patch){
  Object.assign(appState,patch);
  listeners.forEach(listener=>listener(appState));
}
export function setStateSilently(patch){
  Object.assign(appState,patch);
}
export function setError(error){
  setState({errors:[String(error?.message||error||"Unknown error")]});
}
export function clearErrors(){setState({errors:[]})}
export function getActiveLeagueId(){
  try{return localStorage.getItem(ACTIVE_LEAGUE_KEY)||""}catch{return""}
}
export function setActiveLeagueId(leagueId){
  try{
    if(leagueId)localStorage.setItem(ACTIVE_LEAGUE_KEY,leagueId);
    else localStorage.removeItem(ACTIVE_LEAGUE_KEY);
  }catch{}
}
export function readUiPreferences(){
  try{return JSON.parse(localStorage.getItem(UI_PREF_KEY)||"{}")}catch{return{}}
}
export function saveUiPreferences(patch){
  const next={...appState.ui,...patch};
  appState.ui=next;
  try{localStorage.setItem(UI_PREF_KEY,JSON.stringify(next))}catch{}
  return next;
}
export function leagueUiPreferences(leagueId){
  const prefs=appState.ui||{};
  return prefs.leagues?.[leagueId]||{};
}
export function preferredTeamIdForLeague(leagueId){
  return leagueUiPreferences(leagueId).myTeamId||appState.ui?.myTeamId||"";
}
export function saveLeagueUiPreferences(leagueId,patch){
  const current=appState.ui||{};
  const leagues={...(current.leagues||{}),[leagueId]:{...(current.leagues?.[leagueId]||{}),...patch}};
  const next={...current,leagues};
  appState.ui=next;
  try{localStorage.setItem(UI_PREF_KEY,JSON.stringify(next))}catch{}
  return next;
}
