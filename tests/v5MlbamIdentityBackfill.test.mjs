import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fetchMlbIdentityCatalog } from "../v5/js/providers/mlbStatsApiProvider.js";
import { applyMlbamIdentityBackfill, mlbamBackfillHealth, previewMlbamIdentityBackfill, resolveMlbamBackfill } from "../v5/js/services/mlbamIdentityBackfillService.js";
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
  {id:"p1",name:"Jose Example",fantrax_id:"*fx1*",mlbam_id:null,mlb_team:"NYY",positions:["SS"]},
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
assert.doesNotMatch(await readFile(new URL("v5/js/views/importsView.js",root),"utf8"),/statsapi\.mlb\.com|fetch\(/);
assert.match(main,/previewMlbamIdentityBackfill/);assert.match(main,/reviewMlbamBackfill/);assert.match(dataHealth,/MLBAM Backfill Provider Preview/);

console.log("v5MlbamIdentityBackfill tests passed");
