import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { renderImports } from "../v5/js/views/importsView.js";
import { renderPlayers } from "../v5/js/views/playersView.js";
import { renderTeamsManagers } from "../v5/js/views/teamsManagersView.js";
import { normalizeRosterStatus } from "../v5/js/domain/rosterStatus.js";

const root=new URL("../",import.meta.url);
const main=await readFile(new URL("v5/js/main.js",root),"utf8");
const state=await readFile(new URL("v5/js/state/appState.js",root),"utf8");
const css=await readFile(new URL("v5/css/styles.css",root),"utf8");
const dataHealth=await readFile(new URL("v5/js/services/dataHealthService.js",root),"utf8");

const importState={files:{fantrax:{name:"reddit-phanatics.csv"}},previews:{},reviewed:{}};
const importRendered=renderImports({},importState);
assert.match(importRendered,/data-import-filename="fantrax">reddit-phanatics\.csv</);
assert.match(importRendered,/data-clear-import-file="fantrax"/);
assert.match(renderImports({},{}),/data-import-filename="fantrax">No file selected</);
assert.match(renderImports({},{...importState,files:{fantrax:{name:"replacement.csv"}}}),/data-import-filename="fantrax">replacement\.csv</);
assert.equal((importRendered.match(/id="file-fantrax"/g)||[]).length,1,"each import type must render one file input");

const playerState={
  teams:[],positionOptions:[],mlbTeamOptions:[],playerSearchDraft:"J",
  playerQuery:{page:1,pageSize:50,search:"",sort:"name",ascending:true},
  comparisonPlayerIds:[],comparisonPlayers:[],playersLoading:false,playersError:""
};
const playerRendered=renderPlayers(playerState,{rows:[],count:0,page:1,pageSize:50,scoreVersion:"5.1.1"});
assert.match(playerRendered,/id="playerSearch" value="J"/,"draft search must survive a result rerender");
assert.match(playerRendered,/id="playerResults"/);
assert.match(state,/playerSearchDraft:""/);
assert.match(main,/setStateSilently\(\{playerSearchDraft:event\.target\.value\}\)/);
assert.match(main,/event\.key==="Enter"/);
assert.doesNotMatch(main,/#playerSearch"\)\?\.addEventListener\("input",debounce/,"typing must not execute a cloud query");
assert.match(main,/if\(requestId!==playerRequestId\)return null/,"stale player searches must not overwrite newer results");
assert.match(main,/renderPlayerResultsRegion/,"loading should update the result region");

assert.match(css,/\.table-wrap\{[^}]*max-width:100%;[^}]*overflow-y:scroll;[^}]*scrollbar-gutter:stable/);
assert.match(css,/th\{[^}]*position:sticky;top:0;z-index:2/);
assert.match(css,/\.workspace\{[^}]*min-width:0;overflow:hidden/);
assert.match(css,/#viewRoot\{[^}]*min-width:0;max-width:100%;overflow:hidden/);
assert.match(css,/\.panel,\.view-panel\{[^}]*width:auto;[^}]*min-width:0;max-width:100%;overflow:hidden/);

assert.equal(normalizeRosterStatus("ACTIVE",{ownerTeamId:"team"}),"ACTIVE");
assert.equal(normalizeRosterStatus("BENCH",{ownerTeamId:"team"}),"RESERVE");
assert.equal(normalizeRosterStatus("IL60",{ownerTeamId:"team"}),"IL");
assert.equal(normalizeRosterStatus("MINORS",{ownerTeamId:"team"}),"MINORS");
assert.notEqual(normalizeRosterStatus("FA",{ownerTeamId:"team"}),"FREE_AGENT");
assert.match(dataHealth,/STORED_CLOUD_DATA_INSUFFICIENT/);
assert.match(dataHealth,/automaticMutationPerformed:false/);

const missingManagers=renderTeamsManagers({teams:[{id:"team",name:"Aces"}],managers:[],rosterSummary:[]});
assert.match(missingManagers,/No manager intelligence rows are available/);
assert.match(missingManagers,/Import a reviewed Manager Intelligence JSON file/);
assert.match(missingManagers,/id="linkManagerButton"[^>]*disabled/);
const assignedManagers=renderTeamsManagers({teams:[{id:"team",name:"Aces",manager_id:"manager"}],managers:[{id:"manager",manager_name:"Alex"}],rosterSummary:[]});
assert.match(assignedManagers,/Alex/);
assert.match(assignedManagers,/1 assigned team/);
assert.match(assignedManagers,/0 unassigned/);
assert.match(assignedManagers,/Minor League and IL counts are included in Players/);

console.log("v5UiStabilization tests passed");
