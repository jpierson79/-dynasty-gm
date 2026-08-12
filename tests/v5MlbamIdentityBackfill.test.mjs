import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fetchMlbIdentityCatalog } from "../v5/js/providers/mlbStatsApiProvider.js";
import { applyMlbamIdentityBackfill, buildMlbamReviewCsv, downloadMlbamReviewCsv, hypotheticalStatcastCoverage, mlbamBackfillHealth, previewMlbamIdentityBackfill, queryMlbamPreviewRows, resolveMlbamBackfill } from "../v5/js/services/mlbamIdentityBackfillService.js";
import { renderImports } from "../v5/js/views/importsView.js";

function response(payload,type="application/json; charset=utf-8"){return {ok:true,status:200,headers:{get:name=>name.toLowerCase()==="content-type"?type:""},json:async()=>payload}}
const teams=[{id:147,name:"New York Yankees",abbreviation:"NYY",teamCode:"nya",fileCode:"nyy"},{id:111,name:"Boston Red Sox",abbreviation:"BOS",teamCode:"bos",fileCode:"bos"},{id:999,name:"Yankees Affiliate",parentOrgId:147,parentOrgName:"New York Yankees"}];
const people=[
  {id:101,fullName:"José Example Jr.",active:true,currentTeam:{id:147,parentOrgId:147,name:"New York Yankees"},primaryPosition:{abbreviation:"SS"}},
  {id:202,fullName:"Duplicate Name",active:true,currentTeam:{id:147,parentOrgId:147},primaryPosition:{abbreviation:"P"}},
  {id:203,fullName:"Duplicate Name",active:true,currentTeam:{id:111,parentOrgId:111},primaryPosition:{abbreviation:"P"}},
  {id:303,fullName:"Retired Player",active:false,currentTeam:{id:147,parentOrgId:147},primaryPosition:{abbreviation:"OF"}},
  {id:404,fullName:"Prospect One",active:true,currentTeam:{id:999},primaryPosition:{abbreviation:"CF"}}
];
function fetchFixture(url){if(url.includes("/teams?"))return response({teams});return response({people})}

const catalog=await fetchMlbIdentityCatalog({season:2026,sportIds:[1],fetchImpl:fetchFixture});
assert.equal(catalog.provider,"MLB Stats API");assert.equal(catalog.people.length,5);assert.equal(catalog.teams.length,3);
await assert.rejects(fetchMlbIdentityCatalog({season:2026,sportIds:[1],fetchImpl:()=>response({bad:[]})}),/malformed/);
await assert.rejects(fetchMlbIdentityCatalog({season:2026,sportIds:[1],fetchImpl:()=>response({},"text/html")}),/content type/);

const players=[
  {id:"p1",name:"Jose Example",fantrax_id:"*fx1*",fantrax_api_player_id:"api101",mlbam_id:null,mlb_team:"NYY",positions:["SS"]},
  {id:"p2",name:"Duplicate Name",mlbam_id:null,mlb_team:"NYY",positions:["SP"]},
  {id:"p3",name:"Retired Player",mlbam_id:null,mlb_team:"NYY",positions:["OF"]},
  {id:"p4",name:"Prospect One",mlbam_id:null,mlb_team:"NYY",positions:["OF"]},
  {id:"p5",name:"Name Only",mlbam_id:null,mlb_team:"",positions:[]},
  {id:"p6",name:"Existing",mlbam_id:606,mlb_team:"BOS",positions:["C"]}
];
const resolved=resolveMlbamBackfill(players,catalog);
assert.equal(resolved.rows.find(row=>row.playerId==="p1").matchClass,"EXACT","accents and suffixes support a multi-factor exact match");
assert.equal(resolved.rows.find(row=>row.playerId==="p2").matchClass,"AMBIGUOUS","duplicate names never authorize identity");
assert.equal(resolved.rows.find(row=>row.playerId==="p3").matchClass,"REVIEW","inactive/retired rows remain review-only");
assert.equal(resolved.rows.find(row=>row.playerId==="p4").matchClass,"EXACT","MiLB parent organization plus position can support an active prospect");
assert.equal(resolved.rows.find(row=>row.playerId==="p5").matchClass,"UNMATCHED");
assert.equal(resolved.rows.find(row=>row.playerId==="p6").matchClass,"EXISTING");
assert.equal(resolved.rows.find(row=>row.playerId==="p6").writeRecommended,false,"populated MLBAM is preserved");

const nameOnlyCatalog={...catalog,people:[{mlbamId:"707",fullName:"Name Only",active:true,primaryPosition:"",currentTeam:{}}]};
assert.equal(resolveMlbamBackfill([players[4]],nameOnlyCatalog).rows[0].matchClass,"REVIEW","name-only result cannot write");
const duplicateProposed=resolveMlbamBackfill([{...players[0],id:"a"},{...players[0],id:"b"}],catalog);
assert.ok(duplicateProposed.rows.every(row=>row.matchClass==="AMBIGUOUS"));assert.equal(duplicateProposed.summary.duplicateProposed,1);
assert.ok(duplicateProposed.rows.every(row=>row.reasonCode==="DUPLICATE_PROPOSED_MLBAM"&&!row.writeRecommended));
assert.ok(duplicateProposed.rows.every(row=>row.conflictingPlayers.length===2),"all colliding UUIDs and names remain visible");
const mixedCollision=resolveMlbamBackfill([{...players[0],id:"exact"},{...players[0],id:"review",mlb_team:""}],catalog);
assert.ok(mixedCollision.rows.every(row=>row.matchClass==="AMBIGUOUS"&&!row.writeRecommended),"an exact/review collision blocks every participant without choosing a winner");
const existingConflictCatalog={...catalog,people:[...catalog.people,{mlbamId:"606",fullName:"Conflict Person",active:true,primaryPosition:"C",currentTeam:{id:111,name:"Boston Red Sox"}}]};
const existingConflict=resolveMlbamBackfill([...players,{id:"p7",name:"Conflict Person",mlbam_id:null,mlb_team:"BOS",positions:["C"]}],existingConflictCatalog).rows.find(row=>row.playerId==="p7");
assert.equal(existingConflict.matchClass,"AMBIGUOUS");assert.equal(existingConflict.writeRecommended,false);assert.equal(existingConflict.ambiguityReason,"CONFLICTING_EXISTING_MLBAM");assert.deepEqual(existingConflict.conflictingPlayerIds,["p6"]);

const preview=await previewMlbamIdentityBackfill({leagueId:"league-1",season:2026,provider:async()=>catalog,repositories:{players:async()=>players}});
assert.equal(preview.status,"READY");assert.equal(preview.summary.exact,2);assert.equal(preview.rows[0].playerId,"p1");
let writeCalls=0,writePayload=[];
await assert.rejects(applyMlbamIdentityBackfill({leagueId:"league-1",reviewedPreview:preview,reviewed:false,repositories:{}}),/explicitly review/);
const applied=await applyMlbamIdentityBackfill({leagueId:"league-1",reviewedPreview:preview,reviewed:true,repositories:{apply:async(_league,rows)=>{writeCalls++;writePayload=rows;return rows}}});
assert.equal(writeCalls,1);assert.equal(applied.updated.length,2);assert.deepEqual(Object.keys(writePayload[0]).sort(),["mlbam_id","player_id"]);
assert.equal("fantrax_id" in writePayload[0],false);assert.equal("owner_team_id" in writePayload[0],false);assert.equal("roster_status" in writePayload[0],false);
const stale={...preview,createdAt:"2000-01-01T00:00:00.000Z"};
await assert.rejects(applyMlbamIdentityBackfill({leagueId:"league-1",reviewedPreview:stale,reviewed:true,repositories:{apply:async()=>[]}}),/stale/);
assert.equal(mlbamBackfillHealth(null).status,"NEVER_RUN");assert.equal(mlbamBackfillHealth(preview).exact,2);
assert.equal(mlbamBackfillHealth({status:"UNAVAILABLE",error:"provider failed"}).status,"UNAVAILABLE");
assert.equal(Object.values(preview.summary.reasonCounts).reduce((sum,count)=>sum+count,0),preview.summary.total,"reason accounting reconciles to every preview row");
assert.equal(preview.summary.exact+preview.summary.review+preview.summary.ambiguous+preview.summary.unmatched+preview.summary.existing,preview.summary.total,"class accounting reconciles");
assert.equal(preview.summary.classPercentages.exact,33.33);assert.equal(preview.summary.missingClassPercentages.exact,40,"Data Health receives deterministic total and missing-population percentages");
const pageOne=queryMlbamPreviewRows(preview,{page:1,pageSize:2});assert.equal(pageOne.rows.length,2);assert.equal(pageOne.pageCount,3);
assert.ok(queryMlbamPreviewRows(preview,{matchClass:"EXACT"}).rows.every(row=>row.matchClass==="EXACT"));
assert.ok(queryMlbamPreviewRows(preview,{reasonCode:"NO_MLB_STATS_RESULT"}).rows.every(row=>row.reasonCode==="NO_MLB_STATS_RESULT"));
assert.deepEqual(queryMlbamPreviewRows(preview,{search:"p4"}).rows.map(row=>row.playerId),["p4"],"search retains stable UUID identity");
assert.deepEqual(queryMlbamPreviewRows(preview,{search:"jose example"}).rows.map(row=>row.playerId),["p1"],"player-name search is case-insensitive");
assert.deepEqual(queryMlbamPreviewRows(preview,{search:"FX1"}).rows.map(row=>row.playerId),["p1"],"Fantrax identity search is case-insensitive");
assert.deepEqual(queryMlbamPreviewRows(preview,{search:"api101"}).rows.map(row=>row.playerId),["p1"],"Fantrax API identity search uses the canonical preview row");
assert.deepEqual(queryMlbamPreviewRows(preview,{search:"404"}).rows.map(row=>row.playerId),["p4"],"proposed MLBAM search filters canonical preview rows");
assert.deepEqual(queryMlbamPreviewRows(preview,{search:"606"}).rows.map(row=>row.playerId),["p6"],"existing MLBAM search filters canonical preview rows");
assert.deepEqual(queryMlbamPreviewRows(preview,{matchClass:"EXACT",search:"prospect"}).rows.map(row=>row.playerId),["p4"],"classification and search compose before pagination");
assert.deepEqual(queryMlbamPreviewRows(preview,{reasonCode:"EXACT_ORG_POSITION_ACTIVE",search:"jose"}).rows.map(row=>row.playerId),["p1"],"reason and search compose before pagination");
assert.equal(queryMlbamPreviewRows(preview,{search:"retired",page:99,pageSize:1}).page,1,"pagination clamps after filtering rather than before it");
assert.equal(queryMlbamPreviewRows(preview,{search:"",pageSize:50}).total,preview.rows.length,"clearing search restores the complete preview");
const immutableBefore=preview.rows.map(row=>({matchClass:row.matchClass,writeRecommended:row.writeRecommended}));queryMlbamPreviewRows(preview,{search:"jose"});assert.deepEqual(preview.rows.map(row=>({matchClass:row.matchClass,writeRecommended:row.writeRecommended})),immutableBefore,"search never mutates identity classification or writability");
const csvRows=[...duplicateProposed.rows,{...preview.rows[0],playerId:'csv-row',playerName:'Comma, "Quote"\nLine',fantraxApiPlayerId:'api-1'}];
const csvReview=buildMlbamReviewCsv({...preview,rows:csvRows});assert.match(csvReview,/player_uuid/);assert.match(csvReview,/DUPLICATE_PROPOSED_MLBAM/);assert.match(csvReview,/conflicting_mlbam/);assert.match(csvReview,/conflicting_player_uuids/);assert.match(csvReview,/conflicting_player_names/);assert.match(csvReview,/"a"/);assert.match(csvReview,/"b"/);assert.match(csvReview,/"Comma, ""Quote""\nLine"/);assert.equal(csvReview.split("\r\n").length,csvRows.length+1,"full export contains one header plus every canonical row");
let clicked=0,appended=0,removed=0,revoked="",createdBlob=null,deferred=null;
const fakeLink={style:{},click(){clicked++},remove(){removed++}};
const downloadResult=downloadMlbamReviewCsv({...preview,rows:csvRows},{season:2026,documentRef:{createElement:tag=>{assert.equal(tag,"a");return fakeLink},body:{appendChild:link=>{assert.equal(link,fakeLink);appended++}}},urlApi:{createObjectURL:blob=>{createdBlob=blob;return "blob:evidence"},revokeObjectURL:url=>{revoked=url}},BlobCtor:class{constructor(parts,options){this.parts=parts;this.options=options}},defer:callback=>{deferred=callback}});
assert.equal(downloadResult.rowCount,csvRows.length);assert.match(downloadResult.filename,/full-evidence-2026\.csv$/);assert.equal(clicked,1);assert.equal(appended,1);assert.equal(fakeLink.href,"blob:evidence");assert.equal(createdBlob.options.type,"text/csv;charset=utf-8");assert.equal(revoked,"","object URL remains valid through the browser click");deferred();assert.equal(removed,1);assert.equal(revoked,"blob:evidence","temporary object URL is cleaned up after the click task");
const statcastPreview={playerType:"hitter",snapshot:{rows:[{mlbamId:"101"},{mlbamId:"404"},{mlbamId:"999"}]},resolution:{matched:[]}};
const hypothetical=hypotheticalStatcastCoverage(preview,statcastPreview);assert.equal(hypothetical.fetched,3);assert.equal(hypothetical.hypotheticallyMatchable,2);assert.equal(hypothetical.remainingUnmatched,1);
assert.equal(hypotheticalStatcastCoverage(null,statcastPreview).status,"UNAVAILABLE");
const collisionCoverage=hypotheticalStatcastCoverage({...preview,rows:duplicateProposed.rows},statcastPreview);assert.equal(collisionCoverage.hypotheticallyMatchable,0,"ambiguous proposals never count as hypothetical coverage");

const root=new URL("../",import.meta.url);
const migration=await readFile(new URL("supabase/migrations/013_mlbam_identity_backfill_boundary.sql",root),"utf8");
const repository=await readFile(new URL("v5/js/repositories/mlbamIdentityRepository.js",root),"utf8");
const service=await readFile(new URL("v5/js/services/mlbamIdentityBackfillService.js",root),"utf8");
const main=await readFile(new URL("v5/js/main.js",root),"utf8");
const dataHealth=await readFile(new URL("v5/js/services/dataHealthService.js",root),"utf8");
assert.match(migration,/security invoker/i);assert.match(migration,/set search_path = ''/i);assert.match(migration,/private\.can_edit_league/);
assert.match(migration,/p\.mlbam_id is null/);assert.match(migration,/jsonb_array_length\(p_rows\) > 250/);assert.doesNotMatch(migration,/service_role|public\.can_edit_league/i);
assert.match(repository,/batchSize=250/);assert.match(service,/matchClass===CLASSES\.EXACT/);
assert.doesNotMatch(service,/calculated_player_scores|owner_team_id|roster_status|is_free_agent/);
const ui=renderImports({}, {mlbamBackfill:{season:2026,preview,reviewed:false,running:false},statcast:{season:2026}});
assert.match(ui,/MLBAM Identity Backfill/);assert.match(ui,/Apply 2 Exact MLBAM IDs/);assert.match(ui,/p1/);assert.match(ui,/AMBIGUOUS/);
assert.match(ui,/Existing MLBAM/);assert.match(ui,/Candidate org \/ position/);assert.match(ui,/NO WRITE/);
assert.match(ui,/Download review CSV/);assert.match(ui,/Reason-code breakdown/);assert.match(ui,/page 1 of/);assert.match(ui,/Player, UUID, Fantrax or MLBAM/);
assert.doesNotMatch(await readFile(new URL("v5/js/views/importsView.js",root),"utf8"),/statsapi\.mlb\.com|fetch\(/);
assert.match(main,/previewMlbamIdentityBackfill/);assert.match(main,/reviewMlbamBackfill/);assert.match(dataHealth,/MLBAM Backfill Provider Preview/);
assert.match(main,/hypotheticalStatcastCoverage/);assert.match(main,/downloadMlbamReviewCsv/);assert.match(main,/addEventListener\("input"/);assert.match(main,/search,page:1/);assert.match(dataHealth,/MLBAM Backfill Reason Accounting/);assert.match(dataHealth,/MLBAM Hypothetical Statcast Coverage/);

console.log("v5MlbamIdentityBackfill tests passed");
