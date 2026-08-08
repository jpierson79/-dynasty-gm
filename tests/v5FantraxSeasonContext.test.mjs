import assert from "node:assert/strict";
import fs from "node:fs";
import {canonicalFantraxSeasonContext,clearFantraxPendingReviews,compareFantraxSeasonContexts,fantraxSeasonWriteGuard,reviewedFantraxSeasonSettings,validateFantraxSeasonReview} from "../v5/js/services/fantraxSeasonContextService.js";
import {fantraxPreviewHealthChecks} from "../v5/js/services/dataHealthService.js";
import {renderFantraxPreview} from "../v5/js/views/fantraxPreviewView.js";

const observed=canonicalFantraxSeasonContext({externalLeagueId:"1234567890abcdef",seasonYear:"2026",leagueHistoryId:"history-1"});
assert.deepEqual(observed,{valid:true,externalLeagueId:"1234567890abcdef",seasonYear:2026,leagueHistoryId:"history-1",leagueHistoryAvailable:true});
assert.equal(canonicalFantraxSeasonContext({externalLeagueId:"bad",seasonYear:2026}).valid,false);
assert.equal(canonicalFantraxSeasonContext({externalLeagueId:"1234567890abcdef",seasonYear:"unknown"}).valid,false);
assert.equal(compareFantraxSeasonContexts(null,observed).status,"UNREVIEWED");
assert.equal(compareFantraxSeasonContexts(observed,observed).status,"MATCH");
assert.equal(compareFantraxSeasonContexts({...observed,externalLeagueId:"fedcba0987654321"},observed).status,"ROLLOVER");
assert.equal(compareFantraxSeasonContexts({...observed,seasonYear:2025},observed).status,"ROLLOVER");
assert.equal(compareFantraxSeasonContexts({...observed,leagueHistoryId:"history-2"},observed).status,"ROLLOVER");
assert.equal(compareFantraxSeasonContexts({...observed,leagueHistoryId:null,leagueHistoryAvailable:false},observed).status,"MATCH","unavailable optional history is explicit but not guessed into a mismatch");
assert.equal(fantraxSeasonWriteGuard(compareFantraxSeasonContexts(null,observed)).valid,false);

const cleared=clearFantraxPendingReviews({pendingTeamMappings:{T:"C"},reviewTeamMappings:true,confirmTeamMappings:true,reviewRosterSync:true,confirmRosterSync:true,rosterSyncReviewed:true,rosterSyncSelectedIds:["p1"]},{externalLeagueId:"fedcba0987654321",period:"2"});
assert.deepEqual(cleared.pendingTeamMappings,{});assert.equal(cleared.reviewTeamMappings,false);assert.equal(cleared.confirmRosterSync,false);assert.deepEqual(cleared.rosterSyncSelectedIds,[]);

const fantraxTeams=[{fantraxTeamId:"aaaaaaaaaaaaaaaa",teamName:"Alpha"},{fantraxTeamId:"bbbbbbbbbbbbbbbb",teamName:"Beta"}],cloudTeams=[{id:"c1",league_id:"l1",name:"Alpha"},{id:"c2",league_id:"l1",name:"Beta"}];
assert.equal(validateFantraxSeasonReview({leagueId:"l1",fantraxTeams,cloudTeams,pendingMappings:{aaaaaaaaaaaaaaaa:"c1",bbbbbbbbbbbbbbbb:"c2"},observedContext:observed,acknowledged:true}).valid,true);
assert.equal(validateFantraxSeasonReview({leagueId:"l1",fantraxTeams,cloudTeams,pendingMappings:{aaaaaaaaaaaaaaaa:"c1"},observedContext:observed,acknowledged:true}).valid,false);
assert.match(validateFantraxSeasonReview({leagueId:"l1",fantraxTeams,cloudTeams,pendingMappings:{aaaaaaaaaaaaaaaa:"c1",bbbbbbbbbbbbbbbb:"c1"},observedContext:observed,acknowledged:true}).errors.join(" "),/more than once/);
assert.equal(validateFantraxSeasonReview({leagueId:"l1",fantraxTeams,cloudTeams:[...cloudTeams,{id:"outside",league_id:"l2"}],pendingMappings:{aaaaaaaaaaaaaaaa:"c1",bbbbbbbbbbbbbbbb:"outside"},observedContext:observed,acknowledged:true}).valid,false);
assert.deepEqual(Object.keys(reviewedFantraxSeasonSettings(observed)),["fantraxSeasonContext"]);

const comparison=compareFantraxSeasonContexts(null,observed),data={league:{scoringPeriods:[]},seasonContextComparison:comparison,observedSeasonContext:observed,rosterItems:[],teamRows:[],playerRows:[],matchups:[],standings:[],draftPicks:{currentDraftPicks:[],futureDraftPicks:[]},draftResults:{draftOrder:[],draftResults:[]},endpointHealth:[],diagnostics:{duplicateApiIds:[],invalidWrappedIds:0,unknownStatuses:[],teamMappingBlockers:0,playerMappingBlockers:0}};
const html=renderFantraxPreview({fantraxPreview:{data,selectedTab:"rosters",filters:{},page:1,pageSize:50}});
assert.match(html,/Public API preview only/);assert.match(html,/writes are blocked/);assert.match(html,/id="reviewFantraxRosterSync"[^>]*disabled/);
const health=fantraxPreviewHealthChecks({data});
assert.equal(health.find(row=>row.name==="Fantrax Season Context Review").status,"WARNING");
assert.equal(health.find(row=>row.name==="Fantrax Team And Status Writes").status,"WARNING");

const repository=fs.readFileSync(new URL("../v5/js/repositories/leagueRepository.js",import.meta.url),"utf8"),main=fs.readFileSync(new URL("../v5/js/main.js",import.meta.url),"utf8"),view=fs.readFileSync(new URL("../v5/js/views/fantraxPreviewView.js",import.meta.url),"utf8");
assert.match(repository,/update\(\{settings\}\)\.eq\("id",leagueId\)/,"reviewed settings write is league scoped and field limited");
assert.doesNotMatch(repository,/fantrax.*cookie|userSecretId/i);
assert.match(main,/fantraxSeasonWriteGuard\(preview\.data\?\.seasonContextComparison\)/,"final roster apply repeats the season guard");
assert.match(main,/clearFantraxPendingReviews/);
assert.match(main,/fantraxExternalLeagueId"\)\?\.addEventListener\("change",event=>setState\(\{fantraxPreview:clearFantraxPendingReviews\(fantraxPreviewState\(\{data:null/,"league configuration changes invalidate the preview and pending review state");
assert.match(main,/fantraxPeriod"\)\?\.addEventListener\("change",event=>setState\(\{fantraxPreview:clearFantraxPendingReviews\(fantraxPreviewState\(\{data:null/,"period changes invalidate the preview and pending review state");
assert.match(view,/Names, managers, roster overlap, and prior mappings are suggestions only/i);
console.log("V5 Fantrax season context tests passed");
