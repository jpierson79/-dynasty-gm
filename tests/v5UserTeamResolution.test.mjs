import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolveUserFantasyTeam, USER_TEAM_RESOLUTION_VERSION } from "../v5/js/services/userTeamResolver.js";

const root=new URL("../",import.meta.url);
const resolverSource=await readFile(new URL("v5/js/services/userTeamResolver.js",root),"utf8");
const main=await readFile(new URL("v5/js/main.js",root),"utf8");
const state=await readFile(new URL("v5/js/state/appState.js",root),"utf8");
const rosterView=await readFile(new URL("v5/js/views/rosterView.js",root),"utf8");
const tradeView=await readFile(new URL("v5/js/views/tradeCenterView.js",root),"utf8");
const dataHealth=await readFile(new URL("v5/js/services/dataHealthService.js",root),"utf8");
const playerRepo=await readFile(new URL("v5/js/repositories/playerIntelligenceRepository.js",root),"utf8");

const leagueId="league-1";
const userId="user-1";
const rumHam={id:"rum-ham-uuid",league_id:leagueId,name:"Rum Ham & Rally Nuts",abbreviation:"RHRN",is_user_team:true,manager_id:"manager-rum"};
const dpc={id:"dpc-uuid",league_id:leagueId,name:"DPC",abbreviation:"DPC",is_user_team:false,manager_id:"manager-dpc"};
const staleRumDuplicate={id:"stale-rhrn",league_id:leagueId,name:"Rum Ham",abbreviation:"RHRN",is_user_team:false};
const teams=[rumHam,dpc,staleRumDuplicate];
const unmarkedRumHam={...rumHam,is_user_team:false};
const players=[
  {id:"owned-1",name:"Owned Scored",owner_team_id:rumHam.id,roster_status:"ACTIVE"},
  {id:"owned-2",name:"Owned Unclassified",owner_team_id:rumHam.id,roster_status:"UNCLASSIFIED"},
  {id:"owned-3",name:"Owned Missing Score",owner_team_id:rumHam.id,roster_status:"RESERVE"},
  {id:"dpc-1",name:"Other Team",owner_team_id:dpc.id,roster_status:"ACTIVE"},
  {id:"fa-1",name:"Free Agent",owner_team_id:null,roster_status:"FREE_AGENT",is_free_agent:true}
];
const scores=[
  {player_id:"owned-1",score_version:"5.1.1"},
  {player_id:"owned-2",score_version:"5.1.1"},
  {player_id:"dpc-1",score_version:"5.1.1"}
];

assert.equal(USER_TEAM_RESOLUTION_VERSION,"5.4.2");

const resolvedByUuid=resolveUserFantasyTeam({leagueId,authenticatedUserId:userId,preferredTeamId:rumHam.id,leagueRows:[{id:leagueId,owner_user_id:userId}],membershipRows:[{league_id:leagueId,user_id:userId,role:"owner"}],teamRows:teams,playerRows:players,scoreRows:scores});
assert.equal(resolvedByUuid.teamId,rumHam.id);
assert.equal(resolvedByUuid.source,"preferred_user_team_uuid");
assert.equal(resolvedByUuid.diagnostics.ownedPlayerCount,3);
assert.equal(resolvedByUuid.diagnostics.scoredOwnedPlayerCount,2);
assert.equal(resolvedByUuid.diagnostics.missingCurrentScoreCount,1);
assert.equal(resolvedByUuid.diagnostics.rosterStatusCounts.UNCLASSIFIED,1,"UNCLASSIFIED owned players remain part of user team diagnostics");

const staleDpc=resolveUserFantasyTeam({leagueId,authenticatedUserId:userId,preferredTeamId:dpc.id,leagueRows:[{id:leagueId,owner_user_id:userId}],membershipRows:[{league_id:leagueId,user_id:userId,role:"owner"}],teamRows:teams,playerRows:players,scoreRows:scores});
assert.equal(staleDpc.teamId,rumHam.id,"stale DPC browser preference should be rejected in favor of canonical user team");
assert.equal(staleDpc.rejectedPreferredTeamId,dpc.id);
assert.ok(staleDpc.reasons.some(reason=>reason.includes("not linked to the authenticated user")));

const nameCodeDuplicate=resolveUserFantasyTeam({leagueId,authenticatedUserId:userId,preferredTeamId:staleRumDuplicate.id,leagueRows:[{id:leagueId,owner_user_id:userId}],membershipRows:[{league_id:leagueId,user_id:userId,role:"owner"}],teamRows:teams,playerRows:players,scoreRows:scores});
assert.equal(nameCodeDuplicate.teamId,rumHam.id,"team name/code duplicate must not override explicit user-team UUID association");
assert.equal(nameCodeDuplicate.rejectedPreferredTeamId,staleRumDuplicate.id);

const finalFallback=resolveUserFantasyTeam({leagueId,authenticatedUserId:userId,preferredTeamId:dpc.id,leagueRows:[{id:leagueId,owner_user_id:userId}],membershipRows:[{league_id:leagueId,user_id:userId,role:"owner"}],teamRows:[unmarkedRumHam,dpc],playerRows:players,scoreRows:scores,fallbackTeamTokens:["Rum Ham","RHRN"]});
assert.equal(finalFallback.teamId,rumHam.id,"final display-token fallback may select one unambiguous Rum Ham/RHRN team only after UUID association fails");
assert.equal(finalFallback.source,"unambiguous_name_code_fallback");
assert.equal(finalFallback.rejectedPreferredTeamId,dpc.id);

const ambiguousFallback=resolveUserFantasyTeam({leagueId,authenticatedUserId:userId,preferredTeamId:dpc.id,leagueRows:[{id:leagueId,owner_user_id:userId}],membershipRows:[{league_id:leagueId,user_id:userId,role:"owner"}],teamRows:[unmarkedRumHam,{...staleRumDuplicate,is_user_team:false}],playerRows:players,scoreRows:scores,fallbackTeamTokens:["Rum Ham","RHRN"]});
assert.equal(ambiguousFallback.teamId,"","ambiguous name/code fallback must not guess among duplicate Rum Ham/RHRN rows");

const ambiguousExplicitAssociation=resolveUserFantasyTeam({leagueId,authenticatedUserId:userId,preferredTeamId:rumHam.id,leagueRows:[{id:leagueId,owner_user_id:userId}],membershipRows:[{league_id:leagueId,user_id:userId,role:"owner"}],teamRows:[rumHam,{...dpc,is_user_team:true}],playerRows:players,scoreRows:scores});
assert.equal(ambiguousExplicitAssociation.teamId,"","browser preference must not choose among multiple teams marked is_user_team");
assert.equal(ambiguousExplicitAssociation.diagnostics.associationStatus,"ambiguous");
assert.equal(ambiguousExplicitAssociation.diagnostics.userTeamAssociations.length,2);

const noPreferred=resolveUserFantasyTeam({leagueId,authenticatedUserId:userId,leagueRows:[{id:leagueId,owner_user_id:userId}],membershipRows:[{league_id:leagueId,user_id:userId,role:"owner"}],teamRows:teams,playerRows:players,scoreRows:scores});
assert.equal(noPreferred.teamId,rumHam.id,"owner membership should resolve the one explicit is_user_team association");
assert.equal(noPreferred.diagnostics.associationStatus,"explicit");

assert.match(state,/leagueUiPreferences/);
assert.match(state,/preferredTeamIdForLeague/);
assert.match(state,/saveLeagueUiPreferences/);
assert.match(main,/resolveUserFantasyTeam/);
assert.match(main,/USER_TEAM_FALLBACK_TOKENS=\["Rum Ham","Rum Ham & Rally Nuts","RHRN"\]/);
assert.match(main,/preferredTeamIdForLeague\(appState\.activeLeague\.id\)/);
assert.match(main,/saveLeagueUiPreferences\(appState\.activeLeague\.id,\{myTeamId:userTeamResolution\.teamId\}\)/);
assert.match(main,/tradeCenter:\{[^}]*userTeamId:userTeamResolution\.teamId/s,"Trade Center state should receive canonical user team UUID");
assert.match(main,/selectedRosterTeamId\(\)\{\s*return appState\.userTeamResolution\?\.teamId\|\|"";\s*\}/s);
assert.doesNotMatch(main,/selectedRosterTeamId\(\)\{\s*return appState\.ui\?\.myTeamId/);
assert.match(rosterView,/state\.userTeamResolution\?\.teamId/);
assert.doesNotMatch(rosterView,/state\.ui\?\.myTeamId\|\|teams\.find/);
assert.match(tradeView,/trade\.userTeamId/);
assert.match(playerRepo,/eq\("players\.owner_team_id",filters\.ownerTeamId\)/,"Trade Center outgoing queries should use owner_team_id UUID filter through repository");
assert.match(playerRepo,/order\("player_id",\{ascending:true\}\)/,"score pagination should keep stable player-id tie-breaker");
const filterBody=playerRepo.match(/function applyPlayerFilters\(query,filters=\{\}\)\{[\s\S]*?return query;\n\}/)?.[0]||"";
assert.doesNotMatch(filterBody,/normalized_name|abbreviation|team_code/i,"player intelligence ownership filters must not use names or team codes");
assert.match(dataHealth,/Authenticated user has valid team in selected league/);
assert.match(dataHealth,/Stored user-team preference is valid/);
assert.match(dataHealth,/My Roster and Trade Center use same UUID/);
assert.match(dataHealth,/Outgoing query returns only selected-team players/);
assert.match(dataHealth,/First 25 user-team owned players/);
assert.match(dataHealth,/USER_TEAM_FALLBACK_TOKENS/);
assert.match(dataHealth,/Explicit user-team association is unambiguous/);
assert.match(dataHealth,/Exactly one valid team in this league has is_user_team=true/);
assert.match(dataHealth,/automaticMutationPerformed:false/);

console.log("v5UserTeamResolution tests passed");
