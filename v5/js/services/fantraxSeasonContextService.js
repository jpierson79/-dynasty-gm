const clean=value=>String(value??"").trim();
const validLeagueId=value=>/^[A-Za-z0-9]{16}$/.test(clean(value));
const validSeasonYear=value=>Number.isInteger(Number(value))&&Number(value)>=2000&&Number(value)<=2100;
const permissionError=value=>/permission|row.level security|not authorized|42501/i.test(clean(value));

export function canonicalFantraxSeasonContext({externalLeagueId,seasonYear,leagueHistoryId}={}){
  const leagueId=clean(externalLeagueId),historyId=clean(leagueHistoryId);
  if(!validLeagueId(leagueId)||!validSeasonYear(seasonYear))return {valid:false,externalLeagueId:leagueId,seasonYear:null,leagueHistoryId:null,leagueHistoryAvailable:false};
  return {valid:true,externalLeagueId:leagueId,seasonYear:Number(seasonYear),leagueHistoryId:historyId||null,leagueHistoryAvailable:Boolean(historyId)};
}

export function compareFantraxSeasonContexts(reviewed,observed){
  if(!observed?.valid)return {status:"INVALID",valid:false,writeAllowed:false,reasons:["Observed Fantrax league or season identity is invalid."],reviewed:reviewed||null,observed:observed||null};
  if(!reviewed?.valid)return {status:"UNREVIEWED",valid:true,writeAllowed:false,reasons:["Fantrax season context has not been explicitly reviewed."],reviewed:reviewed||null,observed};
  const reasons=[];
  if(clean(reviewed.externalLeagueId)!==clean(observed.externalLeagueId))reasons.push("External league ID changed.");
  if(Number(reviewed.seasonYear)!==Number(observed.seasonYear))reasons.push("Fantrax season year changed.");
  if(reviewed.leagueHistoryAvailable&&observed.leagueHistoryAvailable&&clean(reviewed.leagueHistoryId)!==clean(observed.leagueHistoryId))reasons.push("Fantrax league-history identity changed.");
  return reasons.length?{status:"ROLLOVER",valid:true,writeAllowed:false,reasons,reviewed,observed}:{status:"MATCH",valid:true,writeAllowed:true,reasons:[],reviewed,observed};
}

export function fantraxSeasonWriteGuard(comparison){
  return comparison?.status==="MATCH"&&comparison?.writeAllowed===true?{valid:true,error:""}:{valid:false,error:`Fantrax writes are blocked: ${comparison?.reasons?.join(" ")||"season context is unavailable or unreviewed."}`};
}

export function clearFantraxPendingReviews(state={},patch={}){
  return {...state,...patch,pendingTeamMappings:{},reviewTeamMappings:false,confirmTeamMappings:false,allowReplacement:false,seasonReviewAcknowledged:false,reviewRosterSync:false,confirmRosterSync:false,rosterSyncReviewed:false,rosterSyncSelectedIds:[],rosterSyncReleaseSignature:""};
}

export function fantraxSeasonContextAuthority({league=null,observedContext=null,queryError=""}={}){
  if(queryError)return {status:permissionError(queryError)?"PERMISSION_BLOCKED":"QUERY_FAILED",reviewStatus:"UNAVAILABLE",source:"durable settings",context:null,comparison:null,error:clean(queryError),writeAllowed:false};
  const stored=league?.settings?.fantraxSeasonContext||null,context=canonicalFantraxSeasonContext(stored||{}),reviewedAt=clean(stored?.reviewedAt);
  if(!stored||!Object.keys(stored).length)return {status:"MISSING",reviewStatus:"MISSING",source:"durable settings",context:null,comparison:null,error:"No durable Fantrax season context is stored for the active league.",writeAllowed:false};
  if(!context.valid)return {status:"STALE",reviewStatus:"UNREVIEWED",source:"durable settings",context:null,comparison:null,error:"Stored Fantrax season context is invalid.",writeAllowed:false};
  if(!reviewedAt)return {status:"AVAILABLE_UNREVIEWED",reviewStatus:"UNREVIEWED",source:"durable settings",context,comparison:null,error:"Stored Fantrax season context has not been explicitly reviewed.",writeAllowed:false};
  if(observedContext){
    const comparison=compareFantraxSeasonContexts(context,observedContext);
    if(comparison.status!=="MATCH")return {status:comparison.status==="ROLLOVER"?"CONFLICTING":"STALE",reviewStatus:"CONFLICTING",source:"durable settings + observed context",context,comparison,error:comparison.reasons.join(" "),writeAllowed:false};
    return {status:"AVAILABLE_REVIEWED",reviewStatus:"REVIEWED",source:"durable settings + observed context",context,comparison,error:"",writeAllowed:true};
  }
  return {status:"AVAILABLE_REVIEWED",reviewStatus:"REVIEWED",source:"durable settings",context,comparison:null,error:"",writeAllowed:true};
}

export function validateFantraxSeasonReview({leagueId,fantraxTeams=[],cloudTeams=[],pendingMappings={},observedContext,acknowledged=false}={}){
  const errors=[],externalIds=new Set(),cloudIds=new Set(),cloudById=new Map(cloudTeams.map(team=>[clean(team.id),team]));
  if(!observedContext?.valid)errors.push("A valid observed Fantrax season context is required.");
  if(!acknowledged)errors.push("Acknowledge that team identities are not assumed stable across seasons.");
  fantraxTeams.forEach(team=>{
    const externalId=clean(team.fantraxTeamId),cloudId=clean(pendingMappings[externalId]),cloudTeam=cloudById.get(cloudId);
    if(!validLeagueId(externalId)||externalIds.has(externalId))errors.push(`Invalid or duplicate Fantrax team ID: ${externalId||"(blank)"}.`);
    externalIds.add(externalId);
    if(!cloudId)errors.push(`A reviewed cloud-team mapping is required for ${team.teamName||externalId}.`);
    if(!cloudTeam||clean(cloudTeam.league_id)!==clean(leagueId))errors.push(`Cloud team ${cloudId||"(blank)"} is outside the active league.`);
    if(cloudId&&cloudIds.has(cloudId))errors.push(`Cloud team ${cloudId} is selected more than once.`);
    if(cloudId)cloudIds.add(cloudId);
  });
  if(Object.keys(pendingMappings).length!==fantraxTeams.length)errors.push("The rollover review must contain the complete external team list.");
  return {valid:errors.length===0,errors:[...new Set(errors)],mappingCount:cloudIds.size};
}

export function reviewedFantraxSeasonSettings(context){
  if(!context?.valid)throw new Error("A valid Fantrax season context is required.");
  return {fantraxSeasonContext:{externalLeagueId:context.externalLeagueId,seasonYear:context.seasonYear,leagueHistoryId:context.leagueHistoryId,leagueHistoryAvailable:context.leagueHistoryAvailable,reviewedAt:new Date().toISOString()}};
}
