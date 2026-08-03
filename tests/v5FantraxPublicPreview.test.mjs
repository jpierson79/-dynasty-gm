import assert from "node:assert/strict";
import fs from "node:fs";
import {normalizeFantraxResponse,normalizeFantraxRosterStatus,validExternalLeagueId,FANTRAX_OPERATIONS} from "../supabase/functions/_shared/fantraxPreviewCore.js";
import {buildPlayerIdentityIndex,buildTeamIdentityIndex,compareFantraxPreview,filterRosterPreview,playerIdentityResult,teamIdentityResult,unwrapStoredFantraxId} from "../v5/js/services/fantraxPublicPreviewService.js";

const fetchedAt="2026-08-02T12:00:00.000Z";
assert.deepEqual(Object.keys(FANTRAX_OPERATIONS).sort(),["draft-picks","draft-results","league-info","matchup-scores","standings","team-rosters"].sort());
assert.equal(validExternalLeagueId("abc123def456gh78"),true);
assert.equal(validExternalLeagueId("bad"),false);
assert.equal(normalizeFantraxRosterStatus("ACTIVE"),"ACTIVE");
assert.equal(normalizeFantraxRosterStatus("RESERVE"),"RESERVE");
assert.equal(normalizeFantraxRosterStatus("INJURED_RESERVE"),"IL");
assert.equal(normalizeFantraxRosterStatus("MINORS"),"MINORS");
assert.equal(normalizeFantraxRosterStatus("NEW_SLOT"),"UNCLASSIFIED");
assert.equal(unwrapStoredFantraxId("*abc*"),"abc");
assert.equal(unwrapStoredFantraxId("**abc**"),"");
assert.equal(unwrapStoredFantraxId("abc"),"");

const league=normalizeFantraxResponse("league-info",{leagueName:"Synthetic",seasonYear:2026,teamInfo:{T1:{id:"T1",name:"Alpha"},T2:{id:"T2",name:"Beta"}},playerInfo:{P1:{eligiblePos:["OF"],status:"ACTIVE"},P2:{eligiblePos:["SP"],status:"RESERVE"}},scoringPeriods:[{number:3,startDate:"2026-04-01",endDate:"2026-04-07"}],matchups:[{period:3,matchupList:[{}]}]},{fetchedAt});
const rosters=normalizeFantraxResponse("team-rosters",{period:3,rosters:{T1:{teamName:"Alpha",rosterItems:[{id:"P1",position:"OF",status:"ACTIVE"},{id:"P2",position:"SP",status:"NEW_SLOT"}]}}},{fetchedAt});
const matchups=normalizeFantraxResponse("matchup-scores",{period:3,matchups:[{away:{teamId:"T1",teamName:"Alpha",score:10},home:{teamId:"T2",teamName:"Beta",score:10}}]},{fetchedAt});
const standings=normalizeFantraxResponse("standings",[{teamId:"T1",teamName:"Alpha",rank:1,totalPointsFor:99,gamesBack:0}],{fetchedAt});
const draftPicks=normalizeFantraxResponse("draft-picks",{currentDraftPicks:[{round:1,teamId:"T1"}],futureDraftPicks:[{year:2027,round:2,teamId:"T2"}]},{fetchedAt});
const draftResults=normalizeFantraxResponse("draft-results",{draftOrder:[{teamId:"T1",order:1}],draftPicks:[{round:1,overall:1,teamId:"T1",playerId:"P1"}]},{fetchedAt});
assert.equal(league.externalLeagueId,"[REDACTED]");
assert.equal(rosters.periodNumber,3);
assert.equal(rosters.rosterItems[1].normalizedRosterStatus,"UNCLASSIFIED");
assert.equal(matchups.matchups[0].awayScore,10);
assert.equal(standings.snapshotScope,"CURRENT_ONLY");
assert.equal(draftPicks.futureDraftPicks.length,1);
assert.equal(draftResults.draftResults[0].playerId,"P1");
assert.throws(()=>normalizeFantraxResponse("league-info",{error:{code:"INVALID_LEAGUE_ID"}}),/INVALID_LEAGUE_ID/);
assert.throws(()=>normalizeFantraxResponse("league-info",{}),/schema validation/);
assert.throws(()=>normalizeFantraxResponse("team-rosters",{period:3}),/schema validation/);
assert.throws(()=>normalizeFantraxResponse("matchup-scores",{period:3}),/schema validation/);
assert.throws(()=>normalizeFantraxResponse("standings",{}),/schema validation/);
assert.throws(()=>normalizeFantraxResponse("draft-picks",{}),/schema validation/);
assert.throws(()=>normalizeFantraxResponse("draft-results",{}),/schema validation/);
assert.throws(()=>normalizeFantraxResponse("unknown",{}),/allowlisted/);

const cloudPlayers=[
  {id:"uuid-1",name:"Exact",fantrax_api_player_id:"P1",fantrax_id:"*OLD*",mlbam_id:1,owner_team_id:"team-uuid-1",roster_status:"RESERVE",roster_status_source:"MANUAL",roster_status_override_at:fetchedAt,roster_status_override_by:"user-1"},
  {id:"uuid-2",name:"Wrapped",fantrax_id:"*P2*",mlbam_id:2,owner_team_id:"team-uuid-1",roster_status:"RESERVE"},
  {id:"uuid-3",name:"Bad wrapper",fantrax_id:"P3",mlbam_id:3},
  {id:"uuid-4",name:"No ID",fantrax_id:"",mlbam_id:4}
];
const playerIndex=buildPlayerIdentityIndex(cloudPlayers);
assert.equal(playerIdentityResult("P1",playerIndex).matchedPlayerUuid,"uuid-1","explicit API identity is preferred");
assert.equal(playerIdentityResult("P2",playerIndex).matchedPlayerUuid,"uuid-2","strict wrapper identity is supported");
assert.equal(playerIdentityResult("",playerIndex).identityResult,"MISSING_API_ID");
assert.equal(playerIdentityResult("UNKNOWN",playerIndex).identityResult,"UNMATCHED");
assert.equal(playerIdentityResult("4",playerIndex).identityResult,"UNMATCHED","MLBAM must not be a fallback");
assert.equal(playerIdentityResult("Exact",playerIndex).identityResult,"UNMATCHED","name must not be a fallback");
assert.equal(playerIndex.invalidWrappedIds.length,1);
const duplicateIndex=buildPlayerIdentityIndex([{id:"a",fantrax_id:"*DUP*"},{id:"b",fantrax_api_player_id:"DUP"}]);
assert.equal(playerIdentityResult("DUP",duplicateIndex).identityResult,"DUPLICATE");

const cloudTeams=[{id:"team-uuid-1",name:"Alpha",fantrax_team_id:"T1"},{id:"team-uuid-2",name:"Beta"}];
const teamIndex=buildTeamIdentityIndex(cloudTeams);
assert.equal(teamIdentityResult("T1","Alpha",teamIndex).matchedTeamUuid,"team-uuid-1");
assert.equal(teamIdentityResult("T2","Beta",teamIndex).identityResult,"SUGGESTED_ONLY");
assert.equal(teamIdentityResult("T2","Beta",teamIndex).matchedTeamUuid,"","name suggestion must remain non-authoritative");

const responses={
  "league-info":{httpStatus:200,schemaValid:true,data:league},
  "team-rosters":{httpStatus:200,schemaValid:true,data:rosters},
  "matchup-scores":{httpStatus:200,schemaValid:true,data:matchups},
  standings:{httpStatus:200,schemaValid:true,data:standings},
  "draft-picks":{httpStatus:200,schemaValid:true,data:draftPicks},
  "draft-results":{httpStatus:200,schemaValid:true,data:draftResults}
};
const preview=compareFantraxPreview(responses,{players:cloudPlayers,teams:cloudTeams});
assert.equal(preview.rosterItems.length,2);
assert.equal(preview.rosterItems[0].playerIdentityResult,"MATCHED");
assert.equal(preview.rosterItems[0].teamIdentityResult,"MATCHED");
assert.equal(preview.rosterItems[0].ownershipDifference,false);
assert.equal(preview.rosterItems[0].rosterStatusDifference,true);
assert.equal(preview.rosterItems[0].futureSyncRecommendation,"PRESERVE_MANUAL_OVERRIDE");
assert.equal(preview.rosterItems[0].activeManualOverride,true);
assert.equal(preview.rosterItems[1].normalizedRosterStatus,"UNCLASSIFIED");
assert.equal(preview.rosterItems[1].futureSyncRecommendation,"REVIEW_CONFLICT");
assert.equal(preview.matchups[0].winner,"Tie");
assert.equal(preview.matchups[0].scoreDifference,0);
assert.equal(preview.standings[0].snapshotScope,"CURRENT_ONLY");
assert.equal(preview.draftResults.draftResults[0].playerIdentity.identityResult,"MATCHED");
assert.equal(preview.draftResults.draftResults[0].teamIdentity.identityResult,"MATCHED");
assert.equal(preview.endpointHealth.find(row=>row.endpoint==="team-rosters").normalizedRowCount,2);
assert.equal(filterRosterPreview(preview.rosterItems,{search:"Exact"}).length,1);
assert.equal(filterRosterPreview(preview.rosterItems,{normalizedStatus:"UNCLASSIFIED"}).length,1);
assert.equal(filterRosterPreview(preview.rosterItems,{statusDifference:true}).length,2);

const edge=fs.readFileSync(new URL("../supabase/functions/fantrax-public-league-preview/index.ts",import.meta.url),"utf8");
const service=fs.readFileSync(new URL("../v5/js/services/fantraxPublicPreviewService.js",import.meta.url),"utf8");
const view=fs.readFileSync(new URL("../v5/js/views/fantraxPreviewView.js",import.meta.url),"utf8");
const main=fs.readFileSync(new URL("../v5/js/main.js",import.meta.url),"utf8");
const html=fs.readFileSync(new URL("../v5/index.html",import.meta.url),"utf8");
assert.match(edge,/MAX_RESPONSE_BYTES/);
assert.match(edge,/AbortController/);
assert.match(edge,/JSON\.parse\(body\)/,"valid JSON is accepted independently of content type");
assert.match(edge,/credentials:"omit"/);
assert.match(edge,/request\.method==="OPTIONS"/);
assert.match(edge,/access-control-allow-origin/);
assert.doesNotMatch(edge,/cookie|userSecretId|service_role|\.from\(/i);
assert.doesNotMatch(service,/\.update\(|\.upsert\(|\.insert\(|calculateLeagueScores/);
assert.doesNotMatch(`${edge}\n${service}`,/fxpa\/req|selenium|\bpython\b|from ["']fantraxapi["']/i);
assert.match(html,/data-view="fantraxPreview"/);
assert.match(html,/v5-4-6a-team-identity/);
assert.match(main,/dataHealthService\.js\?v5-4-6b1-manual-overrides/);
assert.match(main,/fetchFantraxPublicPreview/);
assert.match(view,/Fantrax standings period semantics have not been verified/);
assert.match(view,/Team Matchup Scores/);
assert.doesNotMatch(view,/>\s*(Save|Apply|Sync|Import)\s*</i);
assert.match(view,/fantraxPrevPage/);
assert.match(view,/fantraxRosterSearch/);
assert.match(view,/Clear Preview/);

console.log("V5 Fantrax public preview tests passed");
