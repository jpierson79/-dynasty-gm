import * as leagues from "../repositories/leagueRepository.js";
import * as players from "../repositories/playerRepository.js";
import * as teams from "../repositories/teamRepository.js";
import * as managers from "../repositories/managerRepository.js";
import * as metrics from "../repositories/metricRepository.js";
import * as scores from "../repositories/scoreRepository.js";
import { NORMALIZED_ROSTER_STATUSES, normalizeRosterStatus } from "../domain/rosterStatus.js";
import { validFantasyTeamsForPlayers } from "../domain/teamRules.js";
import { ENGINE_VERSION } from "../engine/dynastyEngine.js";
import { DECISION_RULE_VERSION, getRosterRecommendations, getWaiverRecommendations } from "./decisionIntelligenceService.js";
import { TRADE_ANALYSIS_VERSION } from "./tradeAnalysisService.js";
import { USER_TEAM_RESOLUTION_VERSION, resolveUserFantasyTeam } from "./userTeamResolver.js?v5-4-2-user-team-association";
import { buildLiveScoreDiagnostics } from "./liveScoreDiagnosticsService.js";

const USER_TEAM_FALLBACK_TOKENS=["Rum Ham","Rum Ham & Rally Nuts","RHRN"];

function detail(name,rows=[]){return {name,count:rows.length,rows}}
function duplicateRows(rows,key){
  const groups=new Map();
  rows.forEach(row=>{
    const value=String(row[key]??"").trim();
    if(!value)return;
    if(!groups.has(value))groups.set(value,[]);
    groups.get(value).push(row);
  });
  return [...groups.values()].filter(group=>group.length>1).flat();
}
function numericInvalid(player){
  return ["age","hkb_value","overall_rank","position_rank"].some(key=>player[key]!==null&&player[key]!==undefined&&player[key]!==""&&!Number.isFinite(Number(player[key])));
}
function externalIdMissing(value){return value===null||value===undefined||String(value).trim()===""}
function rosterStatusDiagnostics(playerRows){
  const groups=new Map();
  playerRows.forEach(player=>{
    const raw=String(player.roster_status||"").trim()||"(blank)";
    const mapped=normalizeRosterStatus(player.roster_status,{ownerTeamId:player.owner_team_id,isFreeAgent:player.is_free_agent,availabilityStatus:player.availability_status});
    const key=`${raw}|${mapped}`;
    if(!groups.has(key))groups.set(key,{rawRosterStatus:raw,mappedRosterStatus:mapped,playerCount:0,examples:[]});
    const group=groups.get(key);
    group.playerCount++;
    if(group.examples.length<10)group.examples.push(player.name||player.id||"");
  });
  return [...groups.values()].sort((a,b)=>a.mappedRosterStatus.localeCompare(b.mappedRosterStatus)||a.rawRosterStatus.localeCompare(b.rawRosterStatus));
}
export function fantraxPreviewHealthChecks(preview=null){
  const data=preview?.data||null,health=data?.endpointHealth||[],ok=name=>health.find(row=>row.endpoint===name)?.success===true;
  const playerTotal=data?.playerRows?.length||0,playerMatches=data?.playerRows?.filter(row=>row.identityResult==="MATCHED").length||0;
  const teamTotal=data?.teamRows?.length||0,teamMatches=data?.teamRows?.filter(row=>row.identityResult==="MATCHED").length||0;
  const persistedIds=(data?.teamRows||[]).filter(row=>row.identityResult==="MATCHED").map(row=>row.fantraxTeamId),duplicateTeamIds=persistedIds.filter((id,index)=>persistedIds.indexOf(id)!==index);
  const rosterRows=data?.rosterItems||[],validTeamRosterRows=rosterRows.filter(row=>row.teamIdentityResult==="MATCHED");
  const item=(name,status,rows)=>({name,status,details:detail(name,rows)});
  return [
    item("Fantrax Public API Reachable",health.some(row=>row.success)?"PASS":"WARNING",health),
    item("Fantrax League Metadata Available",ok("league-info")?"PASS":"WARNING",[{available:ok("league-info"),previewOnly:true}]),
    item("Fantrax Player Identity Match Rate",playerTotal&&playerMatches===playerTotal?"PASS":playerTotal?"WARNING":"INFO",[{matched:playerMatches,total:playerTotal,previewOnly:true}]),
    item("Fantrax Team Identity Match Rate",teamTotal&&teamMatches===teamTotal?"PASS":teamTotal?"WARNING":"INFO",[{matched:teamMatches,total:teamTotal,persistable:Boolean(teamMatches),previewOnly:true}]),
    item("Fantrax Teams Found",teamTotal?"PASS":"WARNING",[{found:teamTotal}]),
    item("Fantrax Team IDs Persisted",teamTotal&&teamMatches===teamTotal?"PASS":"WARNING",[{persisted:teamMatches,total:teamTotal}]),
    item("Duplicate Fantrax Team IDs",duplicateTeamIds.length?"FAIL":"PASS",duplicateTeamIds.map(fantraxTeamId=>({fantraxTeamId}))),
    item("Unmapped Fantrax Teams",teamTotal===teamMatches?"PASS":"WARNING",(data?.teamRows||[]).filter(row=>row.identityResult!=="MATCHED")),
    item("Cloud Teams Without Fantrax IDs",teamTotal===teamMatches?"PASS":"WARNING",[{withoutIdentity:Math.max(0,teamTotal-teamMatches),total:teamTotal}]),
    item("Roster Entries With Valid Team Identity",rosterRows.length&&validTeamRosterRows.length===rosterRows.length?"PASS":rosterRows.length?"WARNING":"INFO",[{valid:validTeamRosterRows.length,total:rosterRows.length}]),
    item("Ownership Differences Detected",rosterRows.some(row=>row.ownershipDifference)?"WARNING":"PASS",rosterRows.filter(row=>row.ownershipDifference)),
    item("Status Differences Detected",rosterRows.some(row=>row.rosterStatusDifference)?"WARNING":"PASS",rosterRows.filter(row=>row.rosterStatusDifference)),
    item("Manual Override Protection Available","WARNING",[{available:false,blocker:"players has no reviewed status source, manual-override flag, override timestamp, updated_by audit field, or synchronization timestamp."}]),
    item("Fantrax Roster Preview Available",ok("team-rosters")?"PASS":"WARNING",[{rows:data?.rosterItems?.length||0,cloudWrites:0}]),
    item("Unknown Fantrax Roster Statuses",data?.diagnostics?.unknownStatuses?.length?"WARNING":"PASS",(data?.diagnostics?.unknownStatuses||[]).map(status=>({status}))),
    item("Fantrax Matchup Period Available",ok("matchup-scores")?"PASS":"WARNING",[{rows:data?.matchups?.length||0}]),
    item("Fantrax Standings Snapshot Available",ok("standings")?"PASS":"WARNING",[{rows:data?.standings?.length||0,snapshotScope:"CURRENT_ONLY"}]),
    item("Fantrax Draft Data Available",ok("draft-picks")||ok("draft-results")?"PASS":"WARNING",[{draftPickEndpoint:ok("draft-picks"),draftResultEndpoint:ok("draft-results")}]),
    item("Last Fantrax Preview Fetch",data?.fetchedAt?"INFO":"WARNING",[{fetchedAt:data?.fetchedAt||"Never",previewOnly:true,cloudWrites:0}])
  ];
}
export async function runDataHealth(leagueId,{teamId="",authenticatedUserId="",preferredTeamId="",userTeamResolution=null,tradeState={},rosterStatusManager=null,fantraxPreview=null}={}){
  const [membershipRows,playerRows,rawTeamRows,managerRows,metricRows,scoreRows,leagueRows]=await Promise.all([
    leagues.memberships(leagueId),
    players.allPlayers(leagueId),
    teams.allTeams(leagueId),
    managers.listManagers(leagueId),
    metrics.listMetrics(leagueId),
    scores.listScores(leagueId),
    leagues.leagueById(leagueId).then(row=>row?[row]:[]).catch(()=>[])
  ]);
  const teamRows=validFantasyTeamsForPlayers(rawTeamRows,playerRows);
  const invalidTeamRows=await teams.excludedInvalidTeamRows(leagueId,playerRows);
  const teamIds=new Set(teamRows.map(team=>team.id));
  const playerIds=new Set(playerRows.map(player=>player.id));
  const managerIds=new Set(managerRows.map(manager=>manager.id));
  const fantraxMissing=playerRows.filter(player=>externalIdMissing(player.fantrax_id));
  const mlbamMissing=playerRows.filter(player=>externalIdMissing(player.mlbam_id));
  const bothMissing=playerRows.filter(player=>externalIdMissing(player.fantrax_id)&&externalIdMissing(player.mlbam_id));
  const bothPresent=playerRows.filter(player=>!externalIdMissing(player.fantrax_id)&&!externalIdMissing(player.mlbam_id));
  const latestScoreByPlayer=new Map();
  scoreRows.forEach(score=>{
    const current=latestScoreByPlayer.get(score.player_id);
    if(!current||String(score.calculated_at||"")>String(current.calculated_at||""))latestScoreByPlayer.set(score.player_id,score);
  });
  const currentVersionScores=scoreRows.filter(score=>score.score_version===ENGINE_VERSION);
  const currentVersionPlayerIds=new Set(currentVersionScores.map(score=>score.player_id));
  const playersNeedingRecalculation=playerRows.filter(player=>!currentVersionPlayerIds.has(player.id));
  const latestScore=scoreRows.slice().sort((a,b)=>String(b.calculated_at||"").localeCompare(String(a.calculated_at||"")))[0]||null;
  const latestEngineVersion=latestScore?.score_version||"none";
  const latestCalculationTime=latestScore?.calculated_at||"none";
  const scoreDiagnostics=await buildLiveScoreDiagnostics(leagueId,{version:ENGINE_VERSION});
  let decisionDiagnostics={teamId,rosterRecommendations:[],waiverRecommendations:[],error:""};
  try{
    const waiverPage=await getWaiverRecommendations(leagueId,teamId,{page:1,pageSize:25,scoreVersion:ENGINE_VERSION});
    const rosterPage=teamId?await getRosterRecommendations(leagueId,teamId,{scoreVersion:ENGINE_VERSION}):null;
    decisionDiagnostics={teamId,rosterRecommendations:rosterPage?.recommendations||[],waiverRecommendations:waiverPage.recommendations||[],error:""};
  }catch(error){
    decisionDiagnostics.error=String(error?.message||error);
  }
  const decisionRows=[...decisionDiagnostics.rosterRecommendations,...decisionDiagnostics.waiverRecommendations];
  const duplicateDecisionIds=duplicateRows(decisionRows.map(row=>({id:`${row.playerId}|${row.recommendation}`,key:`${row.playerId}|${row.recommendation}`})),"key");
  const invalidDecisionRefs=decisionRows.filter(row=>!playerIds.has(row.playerId));
  const insufficientDecisionRows=decisionRows.filter(row=>row.reasonCodes?.includes("INSUFFICIENT_DATA"));
  const rosterTeamPlayerIds=new Set(playerRows.filter(player=>player.owner_team_id===teamId).map(player=>player.id));
  const freeAgentDecisionErrors=decisionDiagnostics.waiverRecommendations.filter(row=>row.player?.owner_team_id);
  const rosterDecisionErrors=teamId?decisionDiagnostics.rosterRecommendations.filter(row=>!rosterTeamPlayerIds.has(row.playerId)):[];
  const distributionRows=Object.values(scoreDiagnostics.distributions);
  const sampleRows=Object.entries(scoreDiagnostics.samples).map(([sampleType,row])=>({
    sampleType,
    playerName:row?.name||"Not found",
    playerId:row?.id||"",
    age:row?.age??"",
    positions:Array.isArray(row?.positions)?row.positions.join("/"):row?.positions||"",
    rosterStatus:row?.roster_status||"",
    hkbValue:row?.hkb_value??"",
    metricTypes:Array.isArray(row?.metricTypes)?row.metricTypes.join(", "):"",
    scores:row?.scores||null,
    metadata:row?.metadata||null
  }));
  const groupRows=[
    {groupType:"player_stage",groups:scoreDiagnostics.stageAverages},
    {groupType:"position",groups:scoreDiagnostics.positionAverages},
    {groupType:"ownership",groups:scoreDiagnostics.ownershipAverages},
    {groupType:"confidence",groups:scoreDiagnostics.confidenceAverages}
  ];
  const rosterDiagnostics=rosterStatusDiagnostics(playerRows);
  const ownedPlayers=playerRows.filter(player=>player.owner_team_id);
  const unclassifiedPlayers=playerRows.filter(player=>normalizeRosterStatus(player.roster_status,{ownerTeamId:player.owner_team_id,isFreeAgent:player.is_free_agent,availabilityStatus:player.availability_status})==="UNCLASSIFIED");
  const normalizedRosterCounts=NORMALIZED_ROSTER_STATUSES.map(status=>({
    status,
    count:playerRows.filter(player=>normalizeRosterStatus(player.roster_status,{ownerTeamId:player.owner_team_id,isFreeAgent:player.is_free_agent,availabilityStatus:player.availability_status})===status).length
  }));
  const storedRosterStatusInsufficient=Boolean(ownedPlayers.length&&ownedPlayers.every(player=>normalizeRosterStatus(player.roster_status,{ownerTeamId:player.owner_team_id,isFreeAgent:player.is_free_agent,availabilityStatus:player.availability_status})==="UNCLASSIFIED"));
  const pendingStatusChanges=Object.values(rosterStatusManager?.pendingChanges||{});
  const latestRosterStatusUpdate=playerRows.filter(player=>player.roster_status&&player.updated_at).slice().sort((a,b)=>String(b.updated_at||"").localeCompare(String(a.updated_at||"")))[0]||null;
  const manualOverrideGuidance={
    supported:false,
    pendingChanges:pendingStatusChanges.length,
    futureRequirement:"Future Fantrax synchronization must preserve reviewed manual roster-status overrides.",
    currentSchema:"No reviewed manual override marker was found in the current players schema.",
    safeBehavior:"Roster Status Manager writes only players.roster_status and players.updated_at. It does not alter ownership, free-agent state, UUIDs, Fantrax IDs, or MLBAM IDs."
  };
  const ownedFreeAgent=playerRows.filter(player=>player.owner_team_id&&normalizeRosterStatus(player.roster_status,{ownerTeamId:player.owner_team_id,isFreeAgent:player.is_free_agent,availabilityStatus:player.availability_status})==="FREE_AGENT");
  const freeAgentWithOwner=playerRows.filter(player=>player.is_free_agent&&player.owner_team_id);
  const teamsWithoutManagers=teamRows.filter(team=>!team.manager_id||!managerIds.has(team.manager_id));
  const resolvedUserTeam=resolveUserFantasyTeam({leagueId,authenticatedUserId,preferredTeamId,leagueRows,membershipRows,teamRows,playerRows,scoreRows,scoreVersion:ENGINE_VERSION,fallbackTeamTokens:USER_TEAM_FALLBACK_TOKENS});
  const effectiveResolution=userTeamResolution?.teamId===resolvedUserTeam.teamId?userTeamResolution:resolvedUserTeam;
  const canonicalTeamId=effectiveResolution.teamId||teamId;
  const canonicalTeam=teamRows.find(team=>team.id===canonicalTeamId)||null;
  const canonicalOwnedPlayers=playerRows.filter(player=>player.owner_team_id===canonicalTeamId);
  const currentVersionScoreIds=new Set(scoreRows.filter(score=>score.score_version===ENGINE_VERSION).map(score=>score.player_id));
  const canonicalScoredPlayers=canonicalOwnedPlayers.filter(player=>currentVersionScoreIds.has(player.id));
  const canonicalMissingScores=canonicalOwnedPlayers.filter(player=>!currentVersionScoreIds.has(player.id));
  const selectedTeamExists=Boolean(canonicalTeamId&&teamRows.some(team=>team.id===canonicalTeamId));
  const selectedTeamInLeague=Boolean(canonicalTeam&&canonicalTeam.league_id===leagueId);
  const selectedBelongsToUser=Boolean(canonicalTeam&&canonicalTeam.is_user_team===true);
  const selectedResolvedByFallback=effectiveResolution.source==="unambiguous_name_code_fallback";
  const associatedTeams=teamRows.filter(team=>team.is_user_team===true);
  const associationGuidance={
    leagueId,
    authenticatedUserId,
    resolvedTeamId:canonicalTeamId,
    resolvedTeamName:canonicalTeam?.name||"",
    currentMarkedTeamIds:associatedTeams.map(team=>team.id),
    requiredState:"Exactly one valid team in this league has is_user_team=true.",
    safeRepair:"After confirming the resolved team UUID is correct, an authorized league owner/editor should mark that team as the user team and clear is_user_team on every other team in the same league.",
    security:"Use the existing authenticated teams update policy; do not weaken RLS or rely on a name/abbreviation match.",
    automaticMutationPerformed:false
  };
  const storedPreferenceValid=Boolean(!preferredTeamId||preferredTeamId===canonicalTeamId&&!resolvedUserTeam.rejectedPreferredTeamId);
  const myRosterTradeSame=Boolean(!tradeState.userTeamId||tradeState.userTeamId===canonicalTeamId);
  const outgoingCandidateOwnerErrors=(tradeState.outgoingCandidates||[]).filter(player=>player.owner_team_id!==canonicalTeamId||player.is_free_agent);
  const tradeOutgoingIds=tradeState.outgoingPlayerIds||[];
  const tradeIncomingIds=tradeState.incomingPlayerIds||[];
  const tradeAllIds=[...tradeOutgoingIds,...tradeIncomingIds];
  const tradeDuplicateIds=tradeAllIds.filter((id,index)=>tradeAllIds.indexOf(id)!==index).map(id=>({id,reason:"duplicate selected trade asset"}));
  const tradeBothSides=tradeOutgoingIds.filter(id=>tradeIncomingIds.includes(id)).map(id=>({id,reason:"selected on both sides"}));
  const currentScorePlayerIds=new Set(currentVersionScores.map(score=>score.player_id));
  const tradeMissingScores=tradeAllIds.filter(id=>!currentScorePlayerIds.has(id)).map(id=>({id,reason:"missing current score"}));
  const tradeOutgoingOwnerErrors=tradeOutgoingIds.map(id=>playerRows.find(player=>player.id===id)).filter(player=>player&&player.owner_team_id!==teamId);
  const tradeIncomingOwnerErrors=tradeIncomingIds.map(id=>playerRows.find(player=>player.id===id)).filter(player=>player&&player.owner_team_id!==tradeState.partnerTeamId);
  const tradePartnerExists=!tradeState.partnerTeamId||teamIds.has(tradeState.partnerTeamId);
  const lowConfidenceTrade=tradeState.analysis&&Number(tradeState.analysis.confidence)<55?[tradeState.analysis]:[];
  const staleTradeVersion=tradeState.analysis&&tradeState.analysis.tradeAnalysisVersion!==TRADE_ANALYSIS_VERSION?[tradeState.analysis]:[];
  const tradeScoreVersion=tradeState.analysis?.scoreVersion||tradeState.scoreVersion||"";
  const checks=[
    {name:"League exists",status:leagueId?"PASS":"FAIL",details:detail("League exists",leagueId?[{leagueId}]:[])},
    {name:"Membership exists",status:membershipRows.length?"PASS":"FAIL",details:detail("Membership exists",membershipRows)},
    {name:"Player count",status:"INFO",details:detail("Players",playerRows)},
    {name:"Expected valid team count = 10",status:teamRows.length===10?"PASS":"FAIL",details:detail("Valid fantasy teams",teamRows)},
    {name:"Excluded invalid team rows",status:invalidTeamRows.length?"WARNING":"PASS",details:detail("Excluded invalid team rows",invalidTeamRows)},
    {name:"Actual manager count",status:"INFO",details:detail("Managers",managerRows)},
    {name:"Teams without managers",status:teamsWithoutManagers.length?"WARNING":"PASS",details:detail("Teams without managers",teamsWithoutManagers)},
    {name:"Manager assignment coverage",status:managerRows.length&&teamsWithoutManagers.length===0?"PASS":"WARNING",details:detail("Manager assignment coverage",[{managerRows:managerRows.length,assignedTeams:teamRows.length-teamsWithoutManagers.length,unassignedTeams:teamsWithoutManagers.length,guidance:managerRows.length?"Assign existing manager UUIDs to unassigned teams in Teams & Managers.":"Import reviewed Manager Intelligence JSON before assigning teams."}])},
    {name:"Players with Fantrax ID",status:"INFO",details:detail("Players with Fantrax ID",playerRows.filter(player=>!externalIdMissing(player.fantrax_id)))},
    {name:"Players with MLBAM ID",status:"INFO",details:detail("Players with MLBAM ID",playerRows.filter(player=>!externalIdMissing(player.mlbam_id)))},
    {name:"Players with both external IDs",status:"INFO",details:detail("Players with both external IDs",bothPresent)},
    {name:"Players missing Fantrax ID",status:fantraxMissing.length?"WARNING":"PASS",details:detail("Players missing Fantrax ID",fantraxMissing)},
    {name:"Players missing MLBAM ID",status:mlbamMissing.length?"WARNING":"PASS",details:detail("Players missing MLBAM ID",mlbamMissing),playerQuery:{dataAvailability:"missingMlbam",sort:"name",ascending:true}},
    {name:"Players missing both external IDs",status:bothMissing.length?"WARNING":"PASS",details:detail("Players missing both external IDs",bothMissing)},
    {name:"Roster Status Diagnostics",status:"INFO",details:detail("Roster Status Diagnostics",rosterDiagnostics)},
    {name:"Normalized roster status counts",status:"INFO",details:detail("Normalized roster status counts",normalizedRosterCounts)},
    {name:"Manual Status Overrides",status:"WARNING",details:detail("Manual Status Overrides",[manualOverrideGuidance])},
    {name:"Pending Status Changes",status:pendingStatusChanges.length?"WARNING":"PASS",details:detail("Pending Status Changes",pendingStatusChanges)},
    {name:"Unclassified Count",status:unclassifiedPlayers.length?"WARNING":"PASS",details:detail("Unclassified Count",[{count:unclassifiedPlayers.length}])},
    {name:"Last Manual Update",status:latestRosterStatusUpdate?"INFO":"WARNING",details:detail("Last Manual Update",latestRosterStatusUpdate?[{playerId:latestRosterStatusUpdate.id,playerName:latestRosterStatusUpdate.name,rosterStatus:latestRosterStatusUpdate.roster_status,updatedAt:latestRosterStatusUpdate.updated_at,note:"No manual override marker exists, so this is the latest roster_status row timestamp, not a proven manual-only audit."}]:[manualOverrideGuidance])},
    {name:"Stored roster-slot detail available",status:storedRosterStatusInsufficient?"WARNING":"PASS",details:detail("Stored roster-slot detail",[{ownedPlayers:ownedPlayers.length,unclassifiedOwnedPlayers:unclassifiedPlayers.filter(player=>player.owner_team_id).length,classification:storedRosterStatusInsufficient?"STORED_CLOUD_DATA_INSUFFICIENT":"NORMALIZED_GROUPS_AVAILABLE",guidance:storedRosterStatusInsufficient?"Cloud rows do not contain enough roster-slot detail to distinguish ACTIVE, RESERVE, IL, or MINORS. Re-preview a Fantrax export that contains a roster-slot column; do not rewrite cloud rows by assumption.":"Stored values support normalized roster groups.",automaticMutationPerformed:false}])},
    {name:"Unknown roster status values",status:unclassifiedPlayers.length?"WARNING":"PASS",details:detail("Players in UNCLASSIFIED roster group",unclassifiedPlayers),playerQuery:{rosterStatus:"UNCLASSIFIED",sort:"name",ascending:true}},
    {name:"Owned players mapped to FREE_AGENT",status:ownedFreeAgent.length?"FAIL":"PASS",details:detail("Owned players mapped to FREE_AGENT",ownedFreeAgent)},
    {name:"Free agents with owner_team_id",status:freeAgentWithOwner.length?"FAIL":"PASS",details:detail("Free agents with owner_team_id",freeAgentWithOwner)},
    {name:"Players in UNCLASSIFIED roster group",status:unclassifiedPlayers.length?"WARNING":"PASS",details:detail("Players in UNCLASSIFIED roster group",unclassifiedPlayers),playerQuery:{rosterStatus:"UNCLASSIFIED",sort:"name",ascending:true}},
    {name:"Valid owner_team_id references",status:playerRows.some(player=>player.owner_team_id&&!teamIds.has(player.owner_team_id))?"FAIL":"PASS",details:detail("Invalid owners",playerRows.filter(player=>player.owner_team_id&&!teamIds.has(player.owner_team_id)))},
    {name:"Free agents have null owner_team_id",status:freeAgentWithOwner.length?"FAIL":"PASS",details:detail("Free-agent owner conflicts",freeAgentWithOwner)},
    {name:"Rostered players are not marked free agent",status:playerRows.some(player=>player.owner_team_id&&player.is_free_agent)?"FAIL":"PASS",details:detail("Rostered/free-agent conflicts",playerRows.filter(player=>player.owner_team_id&&player.is_free_agent))},
    {name:"Duplicate Fantrax IDs",status:duplicateRows(playerRows,"fantrax_id").length?"FAIL":"PASS",details:detail("Duplicate Fantrax IDs",duplicateRows(playerRows,"fantrax_id"))},
    {name:"Duplicate MLBAM IDs",status:duplicateRows(playerRows,"mlbam_id").length?"FAIL":"PASS",details:detail("Duplicate MLBAM IDs",duplicateRows(playerRows,"mlbam_id"))},
    {name:"Duplicate normalized names",status:duplicateRows(playerRows,"normalized_name").length?"WARNING":"PASS",details:detail("Duplicate normalized names",duplicateRows(playerRows,"normalized_name")),playerQuery:{sort:"name",ascending:true}},
    {name:"Orphaned metrics",status:metricRows.some(metric=>!playerIds.has(metric.player_id))?"FAIL":"PASS",details:detail("Orphaned metrics",metricRows.filter(metric=>!playerIds.has(metric.player_id)))},
    {name:"Orphaned scores",status:scoreRows.some(score=>!playerIds.has(score.player_id))?"FAIL":"PASS",details:detail("Orphaned scores",scoreRows.filter(score=>!playerIds.has(score.player_id)))},
    {name:"Calculated score coverage",status:currentVersionPlayerIds.size===playerRows.length?"PASS":currentVersionPlayerIds.size?"WARNING":"FAIL",details:detail("Calculated score coverage",[{players:playerRows.length,currentVersionScores:currentVersionPlayerIds.size,engineVersion:ENGINE_VERSION}])},
    {name:"Latest engine version",status:latestEngineVersion===ENGINE_VERSION?"PASS":latestEngineVersion==="none"?"FAIL":"WARNING",details:detail("Latest engine version",[{latestEngineVersion,expectedEngineVersion:ENGINE_VERSION}])},
    {name:"Latest calculation time",status:latestCalculationTime==="none"?"FAIL":"INFO",details:detail("Latest calculation time",[{latestCalculationTime}])},
    {name:"Players needing recalculation",status:playersNeedingRecalculation.length?"WARNING":"PASS",details:detail("Players needing recalculation",playersNeedingRecalculation),playerQuery:{sort:"name",ascending:true}},
    {name:"Score value validity",status:scoreDiagnostics.malformedScoreRows?"FAIL":"PASS",details:detail("Score value validity",[{malformedScoreRows:scoreDiagnostics.malformedScoreRows,duplicateScoreRows:scoreDiagnostics.duplicateScoreRows,missingScorePlayers:scoreDiagnostics.missingScorePlayers}])},
    {name:"Score distribution diagnostics",status:"INFO",details:detail("Score distribution diagnostics",distributionRows)},
    {name:"Score grouping diagnostics",status:"INFO",details:detail("Score grouping diagnostics",groupRows)},
    {name:"Score confidence coverage",status:scoreDiagnostics.confidenceCoverage?.confidenceRows===scoreDiagnostics.currentVersionRows?"PASS":"WARNING",details:detail("Score confidence coverage",[scoreDiagnostics.confidenceCoverage])},
    {name:"Low-confidence scores",status:"INFO",details:detail("Low-confidence scores",[]),playerQuery:{dataAvailability:"lowConfidence",sort:"dynasty_asset_score",ascending:false}},
    {name:"Decision rule version",status:"INFO",details:detail("Decision rule version",[{decisionRuleVersion:DECISION_RULE_VERSION}])},
    {name:"Decision roster team selected",status:teamId?"PASS":"WARNING",details:detail("Decision roster team selected",teamId?[{teamId}]:[])},
    {name:"User-team resolver version",status:"INFO",details:detail("User-team resolver version",[{userTeamResolutionVersion:USER_TEAM_RESOLUTION_VERSION}])},
    {name:"Authenticated user has valid team in selected league",status:effectiveResolution.teamId?"PASS":"FAIL",details:detail("Authenticated user team resolution",[effectiveResolution])},
    {name:"Selected user-team UUID exists",status:selectedTeamExists?"PASS":"FAIL",details:detail("Selected user-team UUID exists",canonicalTeam?[canonicalTeam]:[{teamId:canonicalTeamId}])},
    {name:"Selected team belongs to authenticated user",status:selectedBelongsToUser?"PASS":selectedResolvedByFallback?"WARNING":"FAIL",details:detail("Selected team belongs to authenticated user",canonicalTeam?[{...canonicalTeam,resolutionSource:effectiveResolution.source,reasons:effectiveResolution.reasons}]:[])},
    {name:"Explicit user-team association is unambiguous",status:associatedTeams.length===1&&associatedTeams[0].id===canonicalTeamId?"PASS":"WARNING",details:detail("Explicit user-team association guidance",[associationGuidance])},
    {name:"Selected team belongs to selected league",status:selectedTeamInLeague?"PASS":"FAIL",details:detail("Selected team belongs to selected league",canonicalTeam?[canonicalTeam]:[])},
    {name:"Stored user-team preference is valid",status:storedPreferenceValid?"PASS":"WARNING",details:detail("Stored user-team preference is valid",[{preferredTeamId,canonicalTeamId,rejectedPreferredTeamId:resolvedUserTeam.rejectedPreferredTeamId}])},
    {name:"My Roster and Trade Center use same UUID",status:myRosterTradeSame?"PASS":"FAIL",details:detail("My Roster and Trade Center use same UUID",[{myRosterTeamId:canonicalTeamId,tradeCenterTeamId:tradeState.userTeamId||""}])},
    {name:"User team owned-player count",status:canonicalOwnedPlayers.length?"PASS":"WARNING",details:detail("User team owned players",[{teamId:canonicalTeamId,teamName:canonicalTeam?.name||"",ownedPlayerCount:canonicalOwnedPlayers.length}])},
    {name:"User team current-version scored players",status:canonicalScoredPlayers.length?"PASS":"WARNING",details:detail("User team current-version scored players",[{teamId:canonicalTeamId,scoreVersion:ENGINE_VERSION,scoredPlayers:canonicalScoredPlayers.length,missingScores:canonicalMissingScores.length}])},
    {name:"User team missing current scores",status:canonicalMissingScores.length?"WARNING":"PASS",details:detail("User team missing current scores",canonicalMissingScores.slice(0,100)),playerQuery:{ownerTeamId:canonicalTeamId,dataAvailability:"lowConfidence",sort:"name",ascending:true}},
    {name:"User-team roster status counts",status:"INFO",details:detail("User-team roster status counts",Object.entries(effectiveResolution.diagnostics?.rosterStatusCounts||{}).map(([rosterStatus,count])=>({rosterStatus,count})))},
    {name:"First 25 user-team owned players",status:"INFO",details:detail("First 25 user-team owned players",canonicalOwnedPlayers.slice(0,25).map(player=>({id:player.id,name:player.name,owner_team_id:player.owner_team_id,scorePresent:currentVersionScoreIds.has(player.id),scoreVersion:currentVersionScoreIds.has(player.id)?ENGINE_VERSION:"",roster_status:player.roster_status})))},
    {name:"Outgoing query returns only selected-team players",status:outgoingCandidateOwnerErrors.length?"FAIL":"PASS",details:detail("Outgoing candidates not owned by selected user team",outgoingCandidateOwnerErrors)},
    {name:"Recommendation coverage",status:decisionDiagnostics.error?"WARNING":"PASS",details:detail("Recommendation coverage",[{rosterRecommendations:decisionDiagnostics.rosterRecommendations.length,waiverRecommendations:decisionDiagnostics.waiverRecommendations.length,error:decisionDiagnostics.error}])},
    {name:"Recommendations with insufficient data",status:insufficientDecisionRows.length?"WARNING":"PASS",details:detail("Recommendations with insufficient data",insufficientDecisionRows)},
    {name:"Invalid recommendation player references",status:invalidDecisionRefs.length?"FAIL":"PASS",details:detail("Invalid recommendation player references",invalidDecisionRefs)},
    {name:"Duplicate recommendation entries",status:duplicateDecisionIds.length?"FAIL":"PASS",details:detail("Duplicate recommendation entries",duplicateDecisionIds)},
    {name:"Free-agent recommendation owner check",status:freeAgentDecisionErrors.length?"FAIL":"PASS",details:detail("Free-agent recommendations referencing rostered players",freeAgentDecisionErrors)},
    {name:"Roster recommendation team check",status:rosterDecisionErrors.length?"FAIL":"PASS",details:detail("Roster recommendations referencing another team",rosterDecisionErrors)},
    {name:"Trade analysis version",status:staleTradeVersion.length?"WARNING":"PASS",details:detail("Stale trade analysis version",tradeState.analysis?[{current:tradeState.analysis.tradeAnalysisVersion,expected:TRADE_ANALYSIS_VERSION}]:[])},
    {name:"Trade score version available",status:tradeScoreVersion||latestEngineVersion!=="none"?"PASS":"WARNING",details:detail("Trade score version available",[{tradeScoreVersion,latestEngineVersion}])},
    {name:"Trade selected team exists",status:teamId&&tradePartnerExists?"PASS":teamId?"WARNING":"FAIL",details:detail("Trade selected team exists",[{teamId,partnerTeamId:tradeState.partnerTeamId||"",partnerExists:tradePartnerExists}])},
    {name:"Trade asset references valid",status:tradeAllIds.every(id=>playerIds.has(id))?"PASS":"FAIL",details:detail("Invalid trade asset references",tradeAllIds.filter(id=>!playerIds.has(id)).map(id=>({id})))},
    {name:"Trade outgoing user owned",status:tradeOutgoingOwnerErrors.length?"FAIL":"PASS",details:detail("Outgoing trade assets not owned by selected team",tradeOutgoingOwnerErrors)},
    {name:"Trade incoming partner owned",status:tradeIncomingOwnerErrors.length?"FAIL":"PASS",details:detail("Incoming trade assets not owned by partner",tradeIncomingOwnerErrors)},
    {name:"Trade duplicate references",status:tradeDuplicateIds.length?"FAIL":"PASS",details:detail("Duplicate selected trade assets",tradeDuplicateIds)},
    {name:"Trade player selected both sides",status:tradeBothSides.length?"FAIL":"PASS",details:detail("Trade players selected on both sides",tradeBothSides)},
    {name:"Trade assets missing scores",status:tradeMissingScores.length?"WARNING":"PASS",details:detail("Trade assets missing scores",tradeMissingScores)},
    {name:"Low-confidence trade analyses",status:lowConfidenceTrade.length?"WARNING":"PASS",details:detail("Low-confidence trade analyses",lowConfidenceTrade)},
    {name:"Trade manager intelligence availability",status:managerRows.length?"PASS":"WARNING",details:detail("Manager intelligence availability",[{managerRows:managerRows.length,label:managerRows.length?"manager data available":"roster-based fit only"}])},
    {name:"Representative score sample",status:"INFO",details:detail("Representative score sample",sampleRows)},
    {name:"Invalid numeric values",status:playerRows.some(numericInvalid)?"FAIL":"PASS",details:detail("Invalid numeric values",playerRows.filter(numericInvalid))},
    {name:"Team-manager links",status:teamRows.some(team=>team.manager_id&&!managerRows.some(manager=>manager.id===team.manager_id))?"WARNING":"PASS",details:detail("Team-manager link issues",teamRows.filter(team=>team.manager_id&&!managerRows.some(manager=>manager.id===team.manager_id)))},
    {name:"RLS access",status:"PASS",details:detail("RLS access",[{leagueId,readSucceeded:true}])}
  ];
  checks.push(...fantraxPreviewHealthChecks(fantraxPreview));
  return {checks,failed:checks.filter(check=>check.status==="FAIL").length,warnings:checks.filter(check=>check.status==="WARNING").length};
}
