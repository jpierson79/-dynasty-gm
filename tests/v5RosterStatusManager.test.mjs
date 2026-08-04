import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  bulkSetPendingStatus,
  clearAllPendingStatusChanges,
  clearPendingStatusChanges,
  EDITABLE_ROSTER_STATUSES,
  filterRosterStatusRows,
  manualOverrideIds,
  reviewGroups,
  rosterStatusManagerRows,
  savePayload,
  selectAllFilteredRows,
  selectPageRows,
  setPendingStatus,
  statusSummary,
  toggleSelection,
  validateRosterStatusSave
} from "../v5/js/services/rosterStatusManagerService.js";
import { renderRosterStatusManager } from "../v5/js/views/rosterStatusManagerView.js";

const root=new URL("../",import.meta.url);
const html=await readFile(new URL("v5/index.html",root),"utf8");
const main=await readFile(new URL("v5/js/main.js",root),"utf8");
const state=await readFile(new URL("v5/js/state/appState.js",root),"utf8");
const repo=await readFile(new URL("v5/js/repositories/playerRepository.js",root),"utf8");
const dataHealth=await readFile(new URL("v5/js/services/dataHealthService.js",root),"utf8");
const migration=await readFile(new URL("supabase/migrations/008_manual_roster_status_overrides.sql",root),"utf8");

const teams=[{id:"team-1",name:"Rum Ham"},{id:"team-2",name:"DPC"}];
const players=[
  {id:"p1",league_id:"l1",name:"Alpha",positions:["OF"],mlb_team:"NYY",owner_team_id:"team-1",roster_status:"ACTIVE",roster_status_source:"MANUAL",roster_status_override_at:"2026-07-01",roster_status_override_by:"user-1",is_free_agent:false,fantrax_id:"*F1*",mlbam_id:1,updated_at:"2026-07-01"},
  {id:"p2",league_id:"l1",name:"Bravo",positions:["SP"],mlb_team:"LAD",owner_team_id:"team-1",roster_status:"ROSTERED",is_free_agent:false,fantrax_id:"*F2*",mlbam_id:2,updated_at:"2026-07-02"},
  {id:"p3",league_id:"l1",name:"Charlie",positions:["SS"],mlb_team:"BOS",owner_team_id:"team-2",roster_status:"RESERVE",is_free_agent:false,fantrax_id:"*F3*",mlbam_id:3,updated_at:"2026-07-03"},
  {id:"p4",league_id:"l1",name:"Delta",positions:["RP"],mlb_team:"NYM",owner_team_id:null,roster_status:"FREE_AGENT",is_free_agent:true,fantrax_id:"*F4*",mlbam_id:4,updated_at:"2026-07-04"}
];
const rows=rosterStatusManagerRows(players,teams);

assert.deepEqual(EDITABLE_ROSTER_STATUSES,["ACTIVE","RESERVE","IL","MINORS","UNCLASSIFIED"]);
assert.equal(rows.find(row=>row.id==="p2").currentStatus,"UNCLASSIFIED");
assert.equal(rows.find(row=>row.id==="p1").ownerName,"Rum Ham");
assert.equal(rows.find(row=>row.id==="p2").source,"LEGACY");
assert.deepEqual(manualOverrideIds(rows),["p1"]);
assert.deepEqual(filterRosterStatusRows(rows,{manualOnly:true},{}).map(row=>row.id),["p1"]);

let pending={};
pending=setPendingStatus(pending,rows[0],"IL");
assert.equal(pending.p1.newStatus,"IL","single change should create a pending edit");
pending=setPendingStatus(pending,rows[0],"ACTIVE");
assert.equal(pending.p1,undefined,"setting the original status clears a pending edit");

pending=bulkSetPendingStatus({},rows,["p1","p2"],"MINORS");
assert.equal(Object.keys(pending).length,2,"bulk change should affect selected rows");
assert.equal(pending.p2.currentStatus,"UNCLASSIFIED");
assert.equal(pending.p2.newStatus,"MINORS");

const shiftSelected=toggleSelection(["p1"],"p3",{checked:true,visibleRows:rows,lastSelectedId:"p1",shiftKey:true});
assert.deepEqual(shiftSelected,["p1","p2","p3"],"shift-click should select the visible range");
assert.deepEqual(selectPageRows(["p1"],rows.slice(1,3)),["p1","p2","p3"]);

const filtered=filterRosterStatusRows(rows,{search:"bravo"},pending);
assert.deepEqual(filtered.map(row=>row.id),["p2"],"search should filter before bulk operations");
const searchBulk=bulkSetPendingStatus({},rows,selectAllFilteredRows(filtered),"RESERVE");
assert.deepEqual(Object.keys(searchBulk),["p2"]);
assert.equal(searchBulk.p2.newStatus,"RESERVE");

assert.deepEqual(statusSummary(rows,pending).find(row=>row.status==="MINORS"),{status:"MINORS",count:2});
assert.equal(reviewGroups(pending).find(group=>group.status==="MINORS").rows.length,2);
assert.equal(clearPendingStatusChanges(pending,["p1"]).p1,undefined);
assert.deepEqual(clearAllPendingStatusChanges(),{},"cancel clears every pending change");

const payload=savePayload(pending);
assert.deepEqual(payload,[{id:"p1",roster_status:"MINORS"},{id:"p2",roster_status:"MINORS"}],"save payload contains only id and roster_status");
assert.deepEqual(Object.keys(payload[0]).sort(),["id","roster_status"]);
assert.equal(validateRosterStatusSave(rows,pending).valid,true);
assert.equal(validateRosterStatusSave(rows,{p4:{playerId:"p4",playerName:"Delta",currentStatus:"FREE_AGENT",newStatus:"ACTIVE"}}).valid,false,"free agents cannot receive owned roster slots");
assert.equal(validateRosterStatusSave(rows,{p1:{playerId:"p1",playerName:"Alpha",currentStatus:"ACTIVE",newStatus:"BAD"}}).valid,false,"unknown statuses are invalid");

const rendered=renderRosterStatusManager({teams,rosterStatusManager:{rows,filters:{},pendingChanges:pending,selectedIds:["p1","p2"],confirmSave:true}});
assert.match(rendered,/Roster Status Manager/);
assert.match(rendered,/id="rsmSearch"/);
assert.match(rendered,/id="rsmSelectPage"/);
assert.match(rendered,/id="rsmPageSize"/);
assert.match(rendered,/Showing 1-4 of 4/);
assert.match(rendered,/data-rsm-bulk-status="IL"/);
assert.match(rendered,/Save Changes/);
assert.match(rendered,/Apply 2 roster status updates\?/);
assert.match(rendered,/Statuses only will be changed/);
assert.match(rendered,/id="rsmConfirmSave"/);
assert.match(rendered,/Pending Changes/);
assert.match(rendered,/Move to Minors/);
assert.match(rendered,/Status Source/);
assert.match(rendered,/Manual overrides only/);
assert.match(rendered,/Clear Manual Overrides/);
const clearRendered=renderRosterStatusManager({teams,rosterStatusManager:{rows,filters:{},pendingChanges:{},selectedIds:["p1"],confirmClearOverrides:true,clearOverrideIds:["p1"]}});
assert.match(clearRendered,/Clearing the override allows a future Fantrax sync/);
assert.match(clearRendered,/id="rsmConfirmClearOverrides"/);

assert.match(html,/Roster Status Manager/);
assert.match(state,/rosterStatusManager:\{/);
assert.match(main,/renderRosterStatusManager/);
assert.match(main,/loadRosterStatusManager/);
assert.match(main,/rosterStatusPageRows/);
assert.doesNotMatch(main,/window\.confirm/);
assert.match(main,/requestRosterStatusSaveConfirmation/);
assert.match(main,/rsmConfirmSave/);
assert.match(main,/updateRosterStatuses\(appState\.activeLeague\.id,payload/);
assert.match(repo,/export async function updateRosterStatuses/);
assert.match(repo,/roster_status_source:"MANUAL"/);
assert.match(repo,/supabase\.auth\.getUser/);
assert.match(repo,/export async function clearRosterStatusOverrides/);
assert.doesNotMatch(repo,/owner_team_id\s*:|fantrax_id\s*:|fantrax_api_player_id\s*:|mlbam_id\s*:|is_free_agent\s*:/,"roster-status save must not write protected fields");
assert.match(dataHealth,/Manual Status Overrides/);
assert.match(dataHealth,/Pending Status Changes/);
assert.match(dataHealth,/Unclassified Count/);
assert.match(dataHealth,/Last Manual Update/);
assert.match(dataHealth,/Roster Status Source Coverage/);
assert.match(dataHealth,/Manual Overrides Missing User/);
assert.match(migration,/roster_status_source in \('FANTRAX','MANUAL','CSV','LEGACY','UNKNOWN'\)/);
assert.match(migration,/new\.roster_status_override_by := \(select auth\.uid\(\)\)/,"database prevents browser audit spoofing");
assert.doesNotMatch(migration,/update public\.players|owner_team_id|fantrax_id|mlbam_id|calculated_player_scores/i,"migration has no backfill or protected-field writes");

console.log("v5RosterStatusManager tests passed");
